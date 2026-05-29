"""
sync.so lipsync post-processing.

Env vars:
  SYNCSO_API_KEY  — sync.so API key; if unset, lipsync step is skipped
  SYNCSO_MODEL    — model ID (default: lipsync-1.9.0-beta)
"""

import os
import time
import requests

_BASE          = "https://api.sync.so"
_POLL_INTERVAL = 10    # seconds
_MAX_WAIT      = 600   # 10 minutes


def _api_key() -> str | None:
    return os.getenv("SYNCSO_API_KEY")


def is_configured() -> bool:
    return bool(_api_key())


def lipsync(video_url: str) -> str:
    """
    Submit a lipsync job using video_url for both video and audio tracks.
    Blocks until complete and returns the output video URL.
    Raises RuntimeError on failure or timeout.
    """
    key = _api_key()
    if not key:
        raise RuntimeError("SYNCSO_API_KEY not set")

    model = os.getenv("SYNCSO_MODEL", "lipsync-1.9.0-beta")
    headers = {"x-api-key": key, "Content-Type": "application/json"}

    payload = {
        "model": model,
        "input": [
            {"type": "video", "url": video_url},
            {"type": "audio", "url": video_url},
        ],
        "options": {
            "output_format": "mp4",
            "sync_mode": "cut_off",
        },
    }

    print(f"[syncso] Submitting lipsync job (model={model})…", flush=True)
    resp = requests.post(f"{_BASE}/v2/generate", headers=headers, json=payload, timeout=30)
    if not resp.ok:
        print(f"[syncso] Submit error {resp.status_code}: {resp.text}", flush=True)
    resp.raise_for_status()

    data   = resp.json()
    job_id = data.get("id")
    if not job_id:
        raise RuntimeError(f"sync.so: unexpected response — {data}")

    print(f"[syncso] Job submitted: {job_id}", flush=True)
    return _poll(job_id, headers)


def _poll(job_id: str, headers: dict) -> str:
    deadline = time.time() + _MAX_WAIT
    while time.time() < deadline:
        resp = requests.get(f"{_BASE}/v2/generate/{job_id}", headers=headers, timeout=15)
        resp.raise_for_status()
        data   = resp.json()
        status = data.get("status")
        if status == "completed":
            url = data.get("outputUrl") or data.get("output_url")
            if not url:
                raise RuntimeError(f"sync.so job {job_id} completed but no outputUrl")
            print(f"[syncso] Done: {url}", flush=True)
            return url
        if status == "failed":
            raise RuntimeError(f"sync.so job {job_id} failed: {data.get('error', 'unknown')}")
        print(f"[syncso] Polling {job_id} — status: {status}", flush=True)
        time.sleep(_POLL_INTERVAL)
    raise RuntimeError(f"sync.so job {job_id} timed out after {_MAX_WAIT}s")
