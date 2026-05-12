"""
Meta Graph API — post Reels and images to Instagram.

Env vars:
  INSTAGRAM_ACCESS_TOKEN — long-lived page/user access token
  INSTAGRAM_ACCOUNT_ID   — IG Business Account ID
"""

import os
import time
import requests

_GRAPH         = "https://graph.facebook.com/v21.0"
_POLL_INTERVAL = 5    # seconds
_MAX_WAIT      = 300  # 5 minutes for video processing


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


def post_reel(video_url: str, caption: str) -> dict:
    """Upload a Reel. Returns {"media_id": ..., "permalink": ...}."""
    account_id = _account_id()
    token      = _token()

    r = requests.post(
        f"{_GRAPH}/{account_id}/media",
        params={"access_token": token},
        json={"media_type": "REELS", "video_url": video_url, "caption": caption, "share_to_feed": True},
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
