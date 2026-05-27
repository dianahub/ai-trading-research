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
    from datetime import date as _date
    avatar_id_1 = os.getenv("HEYGEN_AVATAR_ID", "abe6938e92cc46c396ac0c0b92b59eda")
    avatar_id_2 = os.getenv("HEYGEN_AVATAR_ID_2", "b22515f8b3244a88bd53d5c483eeed39")
    # Alternate every day: even day-of-year → avatar 1, odd → avatar 2
    avatar_id = avatar_id_1 if _date.today().timetuple().tm_yday % 2 == 0 else avatar_id_2
    voice_id  = os.getenv("HEYGEN_VOICE_ID", "")
    if not avatar_id:
        raise RuntimeError("HEYGEN_AVATAR_ID not set")
    print(f"[heygen] day={_date.today().timetuple().tm_yday} using avatar={avatar_id[:8]}…", flush=True)

    avatar_type = os.getenv("HEYGEN_AVATAR_TYPE", "talking_photo")

    voice_block: dict = {"type": "text", "input_text": script, "speed": 1.0}
    if voice_id:
        voice_block["voice_id"] = voice_id

    if avatar_type == "talking_photo":
        character = {"type": "talking_photo", "talking_photo_id": avatar_id}
    else:
        character = {"type": "avatar", "avatar_id": avatar_id, "avatar_style": "normal"}

    bg_value = os.getenv("HEYGEN_BACKGROUND", "")

    video_input: dict = {"character": character, "voice": voice_block}
    if bg_value:
        bg_type = "image" if bg_value.startswith("http") else "color"
        video_input["background"] = (
            {"type": bg_type, "url": bg_value} if bg_type == "image"
            else {"type": bg_type, "value": bg_value}
        )

    payload = {
        "video_inputs": [video_input],
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
    """Find the ffmpeg binary. Uses imageio-ffmpeg (bundled binary) as primary source."""
    # 1. imageio-ffmpeg ships its own static binary — always works on Railway
    try:
        import imageio_ffmpeg
        p = imageio_ffmpeg.get_ffmpeg_exe()
        if p and os.path.isfile(p):
            return p
    except Exception:
        pass

    # 2. Direct command (works if ffmpeg is on PATH)
    try:
        r = subprocess.run(["ffmpeg", "-version"], capture_output=True, timeout=5)
        if r.returncode == 0:
            return "ffmpeg"
    except Exception:
        pass

    # 3. Ask bash — sources nix profile paths Python's os.environ may miss
    try:
        r = subprocess.run(["bash", "-c", "which ffmpeg"],
                           capture_output=True, text=True, timeout=5)
        if r.returncode == 0 and r.stdout.strip():
            return r.stdout.strip()
    except Exception:
        pass

    # 4. Well-known paths
    for p in [
        "/root/.nix-profile/bin/ffmpeg",
        "/nix/var/nix/profiles/default/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
        "/usr/bin/ffmpeg",
    ]:
        if os.path.isfile(p) and os.access(p, os.X_OK):
            return p

    return None


def _escape_drawtext(text: str) -> str:
    """Escape text for ffmpeg drawtext single-quoted option value."""
    # Use chr() to avoid editor substituting typographic apostrophes/quotes.
    apos = chr(39)   # U+0027 straight apostrophe
    bs   = chr(92)   # U+005C backslash
    # Normalise typographic apostrophes to straight before escaping.
    text = text.replace(chr(0x2018), apos)
    text = text.replace(chr(0x2019), apos)
    text = text.replace(bs,  bs + bs)                       # \ → \\
    # Inside a single-quoted ffmpeg value, apostrophe must be ‘\’’
    # (close-quote, literal-apostrophe, open-quote).
    text = text.replace(apos, apos + bs + apos + apos)      # ‘ → ‘\’’
    text = text.replace(":",  bs + ":")                     # colon
    text = text.replace("%",  bs + "%")                     # percent
    return text


def _find_font_file() -> str | None:
    """Find a valid TTF font file — prefers nix-installed font over bundled."""
    # 1. nix store: dejavu_fonts is listed in nixpacks.toml — guaranteed real binary
    try:
        r = subprocess.run(
            ["find", "/nix/store", "-name", "DejaVuSans.ttf", "-type", "f"],
            capture_output=True, text=True, timeout=15,
        )
        if r.returncode == 0 and r.stdout.strip():
            p = r.stdout.strip().splitlines()[0]
            if os.path.isfile(p):
                return p
    except Exception:
        pass

    # 2. Standard system font paths
    for p in [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/TTF/DejaVuSans.ttf",
    ]:
        if os.path.isfile(p):
            return p

    # 3. Bundled file (may be corrupted — last resort)
    bundled = os.path.join(os.path.dirname(__file__), "DejaVuSans.ttf")
    if os.path.isfile(bundled) and os.path.getsize(bundled) > 100_000:
        return bundled

    return None


def _srt_to_drawtext(srt: str, text_y: int = 1000, fontsize: int = 28,
                     temp_dir: str | None = None) -> str:
    """Convert SRT text to a comma-joined chain of ffmpeg drawtext filters.

    Uses textfile= (writes each cue to a temp file) when temp_dir is provided,
    completely avoiding text-escaping issues with apostrophes and other chars.
    """
    font_file = _find_font_file()
    if font_file:
        sz = os.path.getsize(font_file)
        print(f"[heygen] Using font: {font_file} ({sz} bytes)", flush=True)
        font_part = f":fontfile={font_file}"
    else:
        print("[heygen] No font file found — drawtext will use built-in", flush=True)
        font_part = ""

    blocks = re.split(r'\n\s*\n', srt.strip())
    filters = []
    for block in blocks:
        lines = block.strip().splitlines()
        timing_idx = next((i for i, l in enumerate(lines) if '-->' in l), None)
        if timing_idx is None:
            continue
        timing   = lines[timing_idx]
        text     = ' '.join(lines[timing_idx + 1:]).strip()
        if not text:
            continue

        m = re.match(
            r'(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)',
            timing,
        )
        if not m:
            continue

        def _s(h, mi, s, ms):
            return int(h) * 3600 + int(mi) * 60 + int(s) + int(ms) / 1000

        t0 = _s(*m.group(1, 2, 3, 4))
        t1 = _s(*m.group(5, 6, 7, 8))

        text_truncated = text[:80]

        if temp_dir:
            # Write cue text to a file — textfile= avoids ALL escaping issues
            cue_path = os.path.join(temp_dir, f"cue_{len(filters)}.txt")
            with open(cue_path, "w", encoding="utf-8") as fh:
                fh.write(text_truncated)
            if not filters:
                print(f"[heygen] first cue text: {repr(text_truncated)}", flush=True)
            text_part = f"textfile='{cue_path}'"
        else:
            escaped = _escape_drawtext(text_truncated)
            if not filters:
                print(f"[heygen] first cue escaped: {repr(escaped)}", flush=True)
            text_part = f"text='{escaped}'"

        f = (
            f"drawtext={text_part}"
            f":enable='between(t,{t0:.3f},{t1:.3f})'"
            f":fontsize={fontsize}"
            f"{font_part}"
            f":fontcolor=white"
            f":x=(w-text_w)/2"
            f":y={text_y}"
            f":shadowx=3:shadowy=3:shadowcolor=black@0.95"
            f":box=1:boxcolor=black@0.55:boxborderw=12"
        )
        filters.append(f)

    return ','.join(filters)


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
    cap_dir  = os.path.join(_TEMP_DIR, f"{file_id}_caps")

    try:
        os.makedirs(cap_dir, exist_ok=True)

        # Download raw video
        print("[heygen] Downloading video for caption burn...", flush=True)
        _download(video_url, raw_path)

        # Get subtitles (HeyGen VTT → SRT, or estimated from script)
        srt_content = _get_srt(caption_url, script)
        if os.getenv("HEYGEN_CAPTION_TEST") == "1":
            srt_content = "1\n00:00:00,000 --> 00:00:30,000\nHELLO\n"
            print("[heygen] CAPTION TEST MODE — using 'HELLO' placeholder", flush=True)
        with open(sub_path, "w", encoding="utf-8") as f:
            f.write(srt_content)

        # Build drawtext filter chain — captions near bottom, no dark panel
        drawtext_filters = _srt_to_drawtext(srt_content, text_y=1150, fontsize=42, temp_dir=cap_dir)
        if not drawtext_filters:
            print("[heygen] No drawtext cues built — skipping caption burn", flush=True)
            return None

        # Static "Starsignal.io" label at the top
        font_file = _find_font_file()
        font_part = f":fontfile={font_file}" if font_file else ""
        starsignal_label = (
            f"drawtext=text='Starsignal.io'"
            f":fontsize=38"
            f"{font_part}"
            f":fontcolor=white"
            f":x=(w-text_w)/2"
            f":y=50"
            f":shadowx=3:shadowy=3:shadowcolor=black@0.9"
        )

        vf = starsignal_label + "," + drawtext_filters
        print(f"[heygen] drawtext cues built ({drawtext_filters.count('drawtext=')} cues)", flush=True)
        cmd = [
            ffmpeg_bin, "-y",
            "-i", raw_path,
            "-vf", vf,
            "-c:a", "copy",
            "-preset", "fast",
            out_path,
        ]
        print("[heygen] Burning captions with FFmpeg...", flush=True)
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
        if result.stderr:
            print(f"[heygen] FFmpeg stderr:\n{result.stderr[-2000:]}", flush=True)
        if result.returncode != 0:
            print(f"[heygen] FFmpeg failed (exit {result.returncode})", flush=True)
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
        shutil.rmtree(cap_dir, ignore_errors=True)


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
