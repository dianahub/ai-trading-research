"""
HeyGen avatar video generation (twin videos).

Env vars:
  HEYGEN_API_KEY   — HeyGen API key
  HEYGEN_AVATAR_ID — trained avatar/twin ID
  HEYGEN_VOICE_ID  — voice ID for the avatar (optional, uses avatar default if unset)
"""

import os
import time
import requests

_BASE = "https://api.heygen.com"
_POLL_INTERVAL = 10   # seconds
_MAX_WAIT      = 600  # 10 minutes


def _headers() -> dict:
    api_key = os.getenv("HEYGEN_API_KEY")
    if not api_key:
        raise RuntimeError("HEYGEN_API_KEY not set")
    return {"X-Api-Key": api_key, "Content-Type": "application/json"}


def generate_twin_video(script: str) -> str:
    """Submit a 9:16 talking-head video job and return the public video URL when ready."""
    avatar_id = os.getenv("HEYGEN_AVATAR_ID")
    voice_id  = os.getenv("HEYGEN_VOICE_ID", "")
    if not avatar_id:
        raise RuntimeError("HEYGEN_AVATAR_ID not set")

    avatar_type = os.getenv("HEYGEN_AVATAR_TYPE", "talking_photo")

    voice_block: dict = {"type": "text", "input_text": script, "speed": 1.0}
    if voice_id:
        voice_block["voice_id"] = voice_id

    if avatar_type == "talking_photo":
        character = {"type": "talking_photo", "talking_photo_id": avatar_id}
    else:
        character = {"type": "avatar", "avatar_id": avatar_id, "avatar_style": "normal"}

    payload = {
        "video_inputs": [{
            "character": character,
            "voice":     voice_block,
        }],
        "dimension":    {"width": 720, "height": 1280},
        "aspect_ratio": "9:16",
    }

    resp = requests.post(f"{_BASE}/v2/video/generate", headers=_headers(), json=payload, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    video_id = (data.get("data") or {}).get("video_id") or data.get("video_id")
    if not video_id:
        raise RuntimeError(f"HeyGen generate: unexpected response — {data}")

    print(f"[heygen] Video job submitted: {video_id}", flush=True)
    return _poll_video(video_id)


def _poll_video(video_id: str) -> str:
    deadline = time.time() + _MAX_WAIT
    while time.time() < deadline:
        resp = requests.get(f"{_BASE}/v1/video_status.get", params={"video_id": video_id}, headers=_headers(), timeout=15)
        resp.raise_for_status()
        data   = resp.json().get("data", {})
        status = data.get("status")
        if status == "completed":
            url = data.get("video_url")
            if not url:
                raise RuntimeError(f"HeyGen video {video_id} completed but no video_url")
            print(f"[heygen] Video ready: {url}", flush=True)
            return url
        if status == "failed":
            raise RuntimeError(f"HeyGen video {video_id} failed: {data.get('error', 'unknown')}")
        print(f"[heygen] Polling {video_id} — status: {status}", flush=True)
        time.sleep(_POLL_INTERVAL)
    raise RuntimeError(f"HeyGen video {video_id} timed out after {_MAX_WAIT}s")
