"""
Meta Graph API — post Reels and images to Instagram, and videos to Facebook.

Env vars:
  INSTAGRAM_ACCESS_TOKEN — long-lived page/user access token
  INSTAGRAM_ACCOUNT_ID   — IG Business Account ID
  FACEBOOK_PAGE_ID       — Facebook Page numeric ID (enables FB cross-posting)
  RAILWAY_API_TOKEN      — optional; if set, refreshed token is written back to Railway env
"""

import os
import time
import requests

_GRAPH         = "https://graph.facebook.com/v21.0"
_IG_GRAPH      = "https://graph.instagram.com"
_POLL_INTERVAL = 5    # seconds
_MAX_WAIT      = 300  # 5 minutes for video processing

_fb_token_cache: dict = {}
_current_token: str | None = None   # in-memory refreshed token (overrides env var)


def _account_id() -> str:
    v = os.getenv("INSTAGRAM_ACCOUNT_ID")
    if not v:
        raise RuntimeError("INSTAGRAM_ACCOUNT_ID not set")
    return v


def _token() -> str:
    if _current_token:
        return _current_token
    v = os.getenv("INSTAGRAM_ACCESS_TOKEN")
    if not v:
        raise RuntimeError("INSTAGRAM_ACCESS_TOKEN not set")
    return v


def refresh_token() -> str | None:
    """Refresh the Instagram long-lived user token. Returns the new token or None on failure.
    Updates the in-memory token and, if RAILWAY_API_TOKEN is set, persists it to Railway."""
    global _current_token
    try:
        current = _token()
        r = requests.get(
            f"{_IG_GRAPH}/refresh_access_token",
            params={"grant_type": "ig_refresh_token", "access_token": current},
            timeout=15,
        )
        if not r.ok:
            print(f"[instagram] Token refresh failed: {r.status_code} {r.text}", flush=True)
            return None
        data = r.json()
        new_token = data.get("access_token")
        if not new_token:
            print(f"[instagram] Token refresh: unexpected response — {data}", flush=True)
            return None
        expires_in = data.get("expires_in", 0)
        _current_token = new_token
        print(f"[instagram] Token refreshed successfully (expires_in={expires_in}s ≈ {expires_in//86400}d)", flush=True)
        _persist_token_to_railway(new_token)
        return new_token
    except Exception as e:
        print(f"[instagram] Token refresh error: {e}", flush=True)
        return None


def _persist_token_to_railway(token: str) -> None:
    """Write the refreshed token back to Railway env vars so it survives restarts."""
    api_token    = os.getenv("RAILWAY_API_TOKEN")
    project_id   = os.getenv("RAILWAY_PROJECT_ID")
    environment_id = os.getenv("RAILWAY_ENVIRONMENT_ID")
    service_id   = os.getenv("RAILWAY_SERVICE_ID")
    if not all([api_token, project_id, environment_id, service_id]):
        return  # Railway API not configured — token lives in memory only
    try:
        query = """
        mutation UpsertVariable($input: VariableUpsertInput!) {
          variableUpsert(input: $input)
        }
        """
        payload = {
            "query": query,
            "variables": {
                "input": {
                    "projectId":     project_id,
                    "environmentId": environment_id,
                    "serviceId":     service_id,
                    "name":          "INSTAGRAM_ACCESS_TOKEN",
                    "value":         token,
                }
            },
        }
        r = requests.post(
            "https://backboard.railway.app/graphql/v2",
            headers={"Authorization": f"Bearer {api_token}", "Content-Type": "application/json"},
            json=payload,
            timeout=15,
        )
        if r.ok:
            print("[instagram] Refreshed token persisted to Railway env vars", flush=True)
        else:
            print(f"[instagram] Failed to persist token to Railway: {r.status_code} {r.text}", flush=True)
    except Exception as e:
        print(f"[instagram] Railway token persistence error: {e}", flush=True)


def _post_reel_with_token(video_url: str, caption: str, cover_url: str | None, token: str) -> dict:
    account_id = _account_id()
    payload: dict = {"media_type": "REELS", "video_url": video_url, "caption": caption, "share_to_feed": True}
    if cover_url:
        payload["cover_url"] = cover_url

    r = requests.post(
        f"{_GRAPH}/{account_id}/media",
        params={"access_token": token},
        json=payload,
        timeout=30,
    )
    r.raise_for_status()
    container_id = r.json().get("id")
    if not container_id:
        raise RuntimeError(f"Instagram container creation failed: {r.json()}")

    deadline = time.time() + _MAX_WAIT
    while time.time() < deadline:
        s = requests.get(
            f"{_GRAPH}/{container_id}",
            params={"fields": "status_code", "access_token": token},
            timeout=15,
        )
        s.raise_for_status()
        status = s.json().get("status_code")
        if status == "FINISHED":
            break
        if status == "ERROR":
            raise RuntimeError(f"Instagram video processing failed: {s.json()}")
        time.sleep(_POLL_INTERVAL)
    else:
        raise RuntimeError("Instagram video processing timed out")

    p = requests.post(
        f"{_GRAPH}/{account_id}/media_publish",
        params={"access_token": token},
        json={"creation_id": container_id},
        timeout=30,
    )
    p.raise_for_status()
    media_id = p.json().get("id")
    if not media_id:
        raise RuntimeError(f"Instagram publish failed: {p.json()}")
    return {"media_id": media_id, "permalink": _get_permalink(media_id, token)}


def post_reel(video_url: str, caption: str, cover_url: str | None = None) -> dict:
    """Upload a Reel. Auto-refreshes token on auth failure and retries once."""
    try:
        return _post_reel_with_token(video_url, caption, cover_url, _token())
    except requests.HTTPError as e:
        if e.response is not None and e.response.status_code in (400, 401):
            print("[instagram] Auth error on post — attempting token refresh and retry…", flush=True)
            new_token = refresh_token()
            if new_token:
                return _post_reel_with_token(video_url, caption, cover_url, new_token)
        raise


def post_image(image_url: str, caption: str) -> dict:
    """Post a static image. Returns {"media_id": ..., "permalink": ...}."""
    account_id = _account_id()
    token      = _token()

    r = requests.post(
        f"{_GRAPH}/{account_id}/media",
        params={"access_token": token},
        json={"image_url": image_url, "caption": caption},
        timeout=30,
    )
    r.raise_for_status()
    container_id = r.json().get("id")
    if not container_id:
        raise RuntimeError(f"Instagram container creation failed: {r.json()}")

    p = requests.post(
        f"{_GRAPH}/{account_id}/media_publish",
        params={"access_token": token},
        json={"creation_id": container_id},
        timeout=30,
    )
    p.raise_for_status()
    media_id = p.json().get("id")
    if not media_id:
        raise RuntimeError(f"Instagram publish failed: {p.json()}")

    return {"media_id": media_id, "permalink": _get_permalink(media_id, token)}


def post_to_facebook(video_url: str, caption: str) -> dict:
    """Cross-post a video to the Facebook Page. Returns {"post_id": ..., "permalink": ...}.
    No-ops (returns empty dict) if FACEBOOK_PAGE_ID is not set."""
    page_id = os.getenv("FACEBOOK_PAGE_ID", "")
    if not page_id:
        return {}
    token = _fb_page_token(page_id)
    r = requests.post(
        f"{_GRAPH}/{page_id}/videos",
        params={"access_token": token},
        json={"file_url": video_url, "description": caption, "published": True},
        timeout=60,
    )
    r.raise_for_status()
    post_id = r.json().get("id")
    if not post_id:
        raise RuntimeError(f"Facebook post failed: {r.json()}")
    return {
        "post_id":   post_id,
        "permalink": f"https://www.facebook.com/{page_id}/videos/{post_id}",
    }


def _fb_page_token(page_id: str) -> str:
    if page_id in _fb_token_cache:
        return _fb_token_cache[page_id]
    direct = os.getenv("FACEBOOK_PAGE_ACCESS_TOKEN", "")
    if direct:
        _fb_token_cache[page_id] = direct
        return direct
    r = requests.get(
        f"{_GRAPH}/me/accounts",
        params={"access_token": _token()},
        timeout=15,
    )
    r.raise_for_status()
    for page in r.json().get("data", []):
        if page["id"] == page_id:
            _fb_token_cache[page_id] = page["access_token"]
            return page["access_token"]
    raise RuntimeError(f"Facebook Page {page_id} not found in /me/accounts")


def _get_permalink(media_id: str, token: str) -> str:
    try:
        r = requests.get(
            f"{_GRAPH}/{media_id}",
            params={"fields": "permalink", "access_token": token},
            timeout=10,
        )
        return r.json().get("permalink", "")
    except Exception:
        return ""
