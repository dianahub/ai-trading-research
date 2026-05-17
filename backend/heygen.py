"""
HeyGen avatar video generation (twin videos).

Env vars:
  HEYGEN_API_KEY        — HeyGen API key
  HEYGEN_AVATAR_ID      — trained avatar/twin ID
  HEYGEN_VOICE_ID       — voice ID for the avatar (optional, uses avatar default if unset)
  HEYGEN_AVATAR_TYPE    — "talking_photo" (default) or "avatar" for video twins
  HEYGEN_BACKGROUND     — hex color (e.g. #0a0e1a) or public image URL; defaults to Star Signal homepage screenshot
  HEYGEN_CAPTIONS       — set to "false" to disable caption burning (default: true)
"""

import os
import re
import time
import uuid
import shutil
import subprocess
import requests

_BASE          = "https://api.heygen.com"
_POLL_INTERVAL = 10    # seconds
_MAX_WAIT      = 600   # 10 minutes
_TEMP_DIR      = "/tmp/social_videos"


def _headers() -> dict:
    api_key = os.getenv("HEYGEN_API_KEY")
    if not api_key:
        raise RuntimeError("HEYGEN_API_KEY not set")
    return {"X-Api-Key": api_key, "Content-Type": "application/json"}


def _ensure_temp_dir():
    os.makedirs(_TEMP_DIR, exist_ok=True)


def generate_twin_video(script: str) -> tuple[str, str | None]:
    """Submit a 9:16 talking-head video job and return (video_url, caption_url_or_none)."""
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

    bg_value = os.getenv("HEYGEN_BACKGROUND", "https://www.starsignal.io/starsignal-bg.png")
    bg_type  = "image" if bg_value.startswith("http") else "color"
    background = {"type": bg_type, "url": bg_value} if bg_type == "image" else {"type": bg_type, "value": bg_value}

    payload = {
        "video_inputs": [{
            "character":  character,
            "voice":      voice_block,
            "background": background,
        }],
        "dimension":    {"width": 720, "height": 1280},
        "aspect_ratio": "9:16",
        "caption":      True,   # request VTT caption file from HeyGen
    }

    resp = requests.post(f"{_BASE}/v2/video/generate", headers=_headers(), json=payload, timeout=30)
    if not resp.ok:
        print(f"[heygen] generate error {resp.status_code}: {resp.text}", flush=True)
    resp.raise_for_status()
    data = resp.json()
    video_id = (data.get("data") or {}).get("video_id") or data.get("video_id")
    if not video_id:
        raise RuntimeError(f"HeyGen generate: unexpected response — {data}")

    print(f"[heygen] Video job submitted: {video_id}", flush=True)
    return _poll_video(video_id)


def _poll_video(video_id: str) -> tuple[str, str | None]:
    """Poll until complete and return (video_url, caption_url_or_none)."""
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
            caption_url = data.get("caption_url") or data.get("captionUrl")
            print(f"[heygen] Video ready: {url} | caption_url: {caption_url}", flush=True)
            return url, caption_url
        if status == "failed":
            raise RuntimeError(f"HeyGen video {video_id} failed: {data.get('error', 'unknown')}")
        print(f"[heygen] Polling {video_id} — status: {status}", flush=True)
        time.sleep(_POLL_INTERVAL)
    raise RuntimeError(f"HeyGen video {video_id} timed out after {_MAX_WAIT}s")


def _find_fonts_dir() -> str | None:
    """Return a directory containing TTF fonts for libass, or None if not found."""
    candidates = [
        "/usr/share/fonts/truetype",
        "/usr/share/fonts",
        "/usr/local/share/fonts",
        "/root/.fonts",
    ]
    for d in candidates:
        if os.path.isdir(d) and any(f.endswith(".ttf") for f in os.listdir(d)):
            return d
    # Nix store search (Railway nixpkgs — dejavu_fonts installs here)
    try:
        result = subprocess.run(
            ["find", "/nix/store", "-name", "DejaVuSans*.ttf", "-type", "f"],
            capture_output=True, text=True, timeout=15,
        )
        if result.returncode == 0 and result.stdout.strip():
            return os.path.dirname(result.stdout.strip().splitlines()[0])
    except Exception:
        pass
    return None


def _find_ffmpeg() -> str | None:
    """Find the ffmpeg binary, including nix store locations Railway uses."""
    # 1. Try calling ffmpeg directly — works if it's already on PATH
    try:
        r = subprocess.run(["ffmpeg", "-version"], capture_output=True, timeout=5)
        if r.returncode == 0:
            return "ffmpeg"
    except Exception:
        pass

    # 2. Ask bash — it sources nix profile so it sees packages that Python's
    #    os.environ PATH misses (common on Railway nixpkgs builds)
    try:
        r = subprocess.run(
            ["bash", "-c", "which ffmpeg"],
            capture_output=True, text=True, timeout=5,
        )
        if r.returncode == 0 and r.stdout.strip():
            return r.stdout.strip()
    except Exception:
        pass

    # 3. Well-known nix profile paths
    for p in [
        "/root/.nix-profile/bin/ffmpeg",
        "/nix/var/nix/profiles/default/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
        "/usr/bin/ffmpeg",
    ]:
        if os.path.isfile(p) and os.access(p, os.X_OK):
            return p

    # 4. Last resort: scan nix store (slow, short timeout)
    try:
        r = subprocess.run(
            ["find", "/nix/store", "-name", "ffmpeg", "-type", "f",
             "-not", "-path", "*/share/*"],
            capture_output=True, text=True, timeout=10,
        )
        if r.returncode == 0 and r.stdout.strip():
            return r.stdout.strip().splitlines()[0]
    except Exception:
        pass

    return None


def burn_captions(video_url: str, caption_url: str | None, script: str) -> str | None:
    """
    Download the HeyGen video, burn captions at the bottom (below the face),
    and save to a temp file. Returns local path or None if ffmpeg unavailable/failed.
    """
    ffmpeg_bin = _find_ffmpeg()
    if not ffmpeg_bin:
        print("[heygen] ffmpeg not found — skipping caption burn", flush=True)
        return None
    print(f"[heygen] Using ffmpeg at: {ffmpeg_bin}", flush=True)

    _ensure_temp_dir()
    _cleanup_old_temp_files()

    file_id  = str(uuid.uuid4())
    raw_path = os.path.join(_TEMP_DIR, f"{file_id}_raw.mp4")
    sub_path = os.path.join(_TEMP_DIR, f"{file_id}.srt")
    out_path = os.path.join(_TEMP_DIR, f"{file_id}.mp4")

    try:
        # Download raw video
        print("[heygen] Downloading video for caption burn...", flush=True)
        _download(video_url, raw_path)

        # Get subtitles (HeyGen VTT → SRT, or estimated from script)
        srt_content = _get_srt(caption_url, script)
        with open(sub_path, "w", encoding="utf-8") as f:
            f.write(srt_content)

        # Dark panel over bottom 28% of the 1280px frame (pixel values,
        # not expressions, so it works across all ffmpeg builds).
        panel_h = 358   # 1280 * 0.28
        panel_y = 922   # 1280 - 358
        drawbox = f"drawbox=x=0:y={panel_y}:w=iw:h={panel_h}:color=black@0.82:t=fill"

        # Commas inside a filter option value MUST be escaped as \, so ffmpeg
        # doesn't interpret them as filter-chain separators.
        style = (
            "FontSize=26\\,"
            "PrimaryColour=&H00FFFFFF\\,"
            "OutlineColour=&H00000000\\,"
            "Outline=2\\,"
            "Bold=1\\,"
            "Alignment=2\\,"
            "MarginV=90"
        )
        fonts_dir = _find_fonts_dir()
        if fonts_dir:
            print(f"[heygen] Using fonts from: {fonts_dir}", flush=True)
            subtitle_filter = f"subtitles={sub_path}:fontsdir={fonts_dir}:force_style={style}"
        else:
            print("[heygen] No fonts dir found — libass will use built-in fallback", flush=True)
            subtitle_filter = f"subtitles={sub_path}:force_style={style}"

        vf = f"{drawbox},{subtitle_filter}"
        cmd = [
            ffmpeg_bin, "-y",
            "-i", raw_path,
            "-vf", vf,
            "-c:a", "copy",
            "-preset", "fast",
            out_path,
        ]
        print(f"[heygen] Burning captions with FFmpeg...", flush=True)
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
        if result.returncode != 0:
            print(f"[heygen] FFmpeg failed (exit {result.returncode})", flush=True)
            print(f"[heygen] FFmpeg stderr:\n{result.stderr}", flush=True)
            return None

        print(f"[heygen] Captions burned → {out_path}", flush=True)
        return out_path

    except Exception as e:
        print(f"[heygen] Caption burn error: {e}", flush=True)
        return None

    finally:
        for p in [raw_path, sub_path]:
            try:
                os.unlink(p)
            except Exception:
                pass


# ── Caption helpers ────────────────────────────────────────────────────────────

def _download(url: str, dest: str):
    resp = requests.get(url, stream=True, timeout=120)
    resp.raise_for_status()
    with open(dest, "wb") as f:
        for chunk in resp.iter_content(chunk_size=65536):
            f.write(chunk)


def _get_srt(caption_url: str | None, script: str) -> str:
    """Try to fetch HeyGen's VTT and convert it; fall back to estimated timing."""
    if caption_url:
        try:
            resp = requests.get(caption_url, timeout=15)
            resp.raise_for_status()
            converted = _vtt_to_srt(resp.text)
            if converted.strip():
                print("[heygen] Using HeyGen VTT captions", flush=True)
                return converted
        except Exception as e:
            print(f"[heygen] VTT fetch failed ({e}), using estimated timing", flush=True)
    print("[heygen] Generating estimated caption timing from script", flush=True)
    return _script_to_srt(script)


def _vtt_to_srt(vtt: str) -> str:
    """Convert WebVTT text to SRT format."""
    lines   = vtt.strip().splitlines()
    out     = []
    counter = 1
    i       = 0

    while i < len(lines) and not re.search(r"\d+:\d+.*-->", lines[i]):
        i += 1  # skip WEBVTT header and metadata

    while i < len(lines):
        line = lines[i].strip()
        if re.search(r"\d+:\d+.*-->", line):
            # Convert timestamps: VTT uses . for ms, SRT uses ,
            timing = re.sub(r"(\d{2}:\d{2}:\d{2})\.(\d{3})", r"\1,\2", line)
            # Handle MM:SS.mmm → 00:MM:SS,mmm
            timing = re.sub(r"^(\d{2}:\d{2}),(\d{3})", r"00:\1,\2", timing)
            out.append(str(counter))
            out.append(timing)
            counter += 1
            i += 1
            while i < len(lines) and lines[i].strip():
                out.append(lines[i].strip())
                i += 1
            out.append("")
        else:
            i += 1

    return "\n".join(out)


def _script_to_srt(script: str, words_per_sec: float = 2.5) -> str:
    """Generate an SRT with estimated timing based on speech rate."""
    words = script.split()
    if not words:
        return ""

    chunk_size = 6
    chunks = [words[i:i + chunk_size] for i in range(0, len(words), chunk_size)]

    lines = []
    t = 0.0
    for idx, chunk in enumerate(chunks, 1):
        duration = len(chunk) / words_per_sec
        lines += [
            str(idx),
            f"{_srt_ts(t)} --> {_srt_ts(t + duration)}",
            " ".join(chunk),
            "",
        ]
        t += duration

    return "\n".join(lines)


def _srt_ts(seconds: float) -> str:
    h  = int(seconds // 3600)
    m  = int((seconds % 3600) // 60)
    s  = int(seconds % 60)
    ms = int(round((seconds % 1) * 1000))
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _cleanup_old_temp_files(max_age_secs: int = 3600):
    """Remove processed video files older than max_age_secs from the temp dir."""
    try:
        now = time.time()
        for fname in os.listdir(_TEMP_DIR):
            fpath = os.path.join(_TEMP_DIR, fname)
            if os.path.isfile(fpath) and (now - os.path.getmtime(fpath)) > max_age_secs:
                os.unlink(fpath)
    except Exception:
        pass
