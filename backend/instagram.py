"""
Meta Graph API — post Reels and images to Instagram, and videos to Facebook.

Env vars:
  INSTAGRAM_ACCESS_TOKEN — long-lived page/user access token
  INSTAGRAM_ACCOUNT_ID   — IG Business Account ID
  FACEBOOK_PAGE_ID       — Facebook Page numeric ID (enables FB cross-posting)
"""

import os
import time
import requests

_GRAPH         = "https://graph.facebook.com/v21.0"
_POLL_INTERVAL = 5    # seconds
_MAX_WAIT      = 300  # 5 minutes for video processing

_fb_token_cache: dict = {}


def _account_id() -> str:
    v = os.getenv("INSTAGRAM_ACCOUNT_ID")
    if not v:
        raise RuntimeError("INSTAGRAM_ACCOUNT_ID not set")
    return v


def _token() -> str:
    v = os.getenv("INSTAGRAM_ACCESS_TOKEN")
    if not v:
        raise RuntimeError("INSTAGRAM_ACCESS_TOKEN not set")
    return v


def _fb_page_token(page_id: str) -> str:
    if page_id in _fb_token_cache:
        return _fb_token_cache[page_id]
    # Use a dedicated page token if provided — never expires
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


def post_reel(video_url: str, caption: str, cover_url: str | None = None) -> dict:
    """Upload a Reel. Returns {"media_id": ..., "permalink": ...}."""
    account_id = _account_id()
    token      = _token()

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

    # Wait for server-side video processing
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
