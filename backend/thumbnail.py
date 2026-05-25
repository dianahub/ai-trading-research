"""Generate branded 1080×1920 thumbnail images for social posts."""

import os
import re

THUMB_W  = 1080
THUMB_H  = 1920
PERM_DIR = os.getenv("SOCIAL_MEDIA_DIR", "/tmp/social_videos/perm")


def ensure_perm_dir():
    os.makedirs(PERM_DIR, exist_ok=True)


def _find_font(size: int):
    from PIL import ImageFont
    candidates = [
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "DejaVuSans.ttf"),
        "/app/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for p in candidates:
        if p and os.path.exists(p) and os.path.getsize(p) > 100_000:
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()


def _draw_centered(draw, text: str, y: int, font, color):
    bbox = draw.textbbox((0, 0), text, font=font)
    w = bbox[2] - bbox[0]
    draw.text(((THUMB_W - w) // 2, y), text, fill=color, font=font)


def _draw_wrapped(draw, text: str, start_y: int, font, color, margin: int, line_h: int, max_lines: int):
    max_w = THUMB_W - 2 * margin
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        test = (current + " " + word).strip()
        bbox = draw.textbbox((0, 0), test, font=font)
        if bbox[2] - bbox[0] <= max_w:
            current = test
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)

    for i, line in enumerate(lines[:max_lines]):
        bbox = draw.textbbox((0, 0), line, font=font)
        lw = bbox[2] - bbox[0]
        draw.text(((THUMB_W - lw) // 2, start_y + i * line_h), line, fill=color, font=font)


def _infer_topic_from_headline(headline: str) -> str | None:
    """Derive the badge topic from the headline so it reflects the video content."""
    hl = headline.lower()
    if any(w in hl for w in ["bitcoin", "btc", "crypto", "ethereum", "eth"]):
        return "crypto"
    if any(w in hl for w in ["gold", "silver", "precious metals"]):
        return "gold"
    if any(w in hl for w in ["oil", "opec", "crude", "energy"]):
        return "oil"
    if any(w in hl for w in ["stock market", "s&p", "nasdaq", "equities", "wall street", "dow jones"]):
        return "stocks"
    if any(w in hl for w in ["interest rate", "federal reserve", " fed ", "bond yield", "treasury yield"]):
        return "rates"
    if any(w in hl for w in ["inflation", "cpi", "cost of living"]):
        return "inflation"
    if any(w in hl for w in ["dollar", "euro", "yuan", "yen", "forex", "exchange rate"]):
        return "currency"
    if any(w in hl for w in ["china", "tariff", "trade war"]):
        return "china"
    return None


_TOPIC_ACCENT: dict[str, tuple[int, int, int]] = {
    "crypto":    (251, 146,  60),  # orange
    "gold":      (234, 179,   8),  # gold
    "oil":       (249, 115,  22),  # amber-orange
    "stocks":    ( 34, 197,  94),  # green
    "rates":     ( 99, 102, 241),  # indigo
    "inflation": (239,  68,  68),  # red
    "currency":  ( 56, 189, 248),  # sky blue
    "china":     (239,  68,  68),  # red
}
_DEFAULT_ACCENT = (139, 92, 246)  # violet


def _topic_accent(topic: str | None) -> tuple[int, int, int]:
    return _TOPIC_ACCENT.get((topic or "").lower(), _DEFAULT_ACCENT)


def _build_image_prompt(headline: str, topic: str | None) -> str:
    """Build a Pollinations.ai prompt that matches the headline's subject matter."""
    topic_l = (topic or "").lower()
    headline_l = headline.lower()

    if any(w in topic_l + headline_l for w in ["bitcoin", "btc", "crypto", "ethereum", "eth"]):
        scene = "bitcoin cryptocurrency glowing golden digital coins vibrant colorful cinematic"
    elif any(w in topic_l + headline_l for w in ["gold", "silver", "bullion"]):
        scene = "gold bullion bars gleaming warm rich golden light vivid colorful studio"
    elif any(w in topic_l + headline_l for w in ["oil", "energy", "opec"]):
        scene = "oil refinery at dusk vibrant orange amber sunset sky colorful dramatic"
    elif any(w in topic_l + headline_l for w in ["dollar", "forex", "currency", "yuan", "yen", "euro"]):
        scene = "currency exchange forex trading screens vivid blue green glowing colorful cinematic"
    elif any(w in topic_l + headline_l for w in ["fed", "rate", "inflation", "interest"]):
        scene = "federal reserve grand columns golden light vibrant warm cinematic architecture"
    elif any(w in topic_l + headline_l for w in ["war", "conflict", "sanction", "geopolit"]):
        scene = "geopolitical world map glowing neon borders vibrant electric blue red cinematic"
    elif any(w in topic_l + headline_l for w in ["stock", "equity", "nasdaq", "s&p", "dow"]):
        scene = "stock market trading floor vivid green screens colorful energy cinematic"
    else:
        scene = "financial markets glowing vibrant data charts colorful neon cinematic"

    excerpt = re.sub(r'[^a-zA-Z0-9 ]', '', headline[:60]).strip()
    return f"cinematic vibrant colorful {scene}, {excerpt}, vivid professional photography, no text, no people, 4k"


def _fetch_bg_image(headline: str, topic: str | None) -> bytes | None:
    """Fetch an AI-generated background image from Pollinations.ai (free, no key needed)."""
    import hashlib
    import urllib.request
    import urllib.parse

    prompt = _build_image_prompt(headline, topic)
    # Seed derived from headline so the same headline always returns the same image
    # but different headlines get genuinely different generations (avoids Pollinations cache)
    seed = int(hashlib.md5(headline.encode()).hexdigest()[:8], 16) % 1_000_000
    url = (
        "https://image.pollinations.ai/prompt/"
        + urllib.parse.quote(prompt)
        + f"?width=1080&height=1920&nologo=true&model=flux&enhance=true&seed={seed}"
    )
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "StarSignal/1.0"})
        with urllib.request.urlopen(req, timeout=60) as r:
            data = r.read()
        # Sanity-check: must be a real image (>10KB), not an error page
        if len(data) > 10_000 and data[:4] in (b'\xff\xd8\xff\xe0', b'\xff\xd8\xff\xe1', b'\x89PNG'):
            return data
    except Exception:
        pass
    return None


def generate_thumbnail(
    headline: str,
    topic: str | None = None,
    date_str: str | None = None,
    suffix: str | None = None,
) -> str:
    """
    Generate a branded 1080×1920 JPEG thumbnail unique to this news headline.
    Fetches an AI-generated background image from Pollinations.ai; falls back
    to a dark gradient if the fetch fails.
    Returns the absolute path to the saved file.
    `suffix` is used as the filename key (post_id, date, or "preview").
    """
    from PIL import Image, ImageDraw, ImageFilter

    ensure_perm_dir()
    key  = suffix or date_str or "preview"
    path = os.path.join(PERM_DIR, f"{key}_thumb.jpg")

    # Prefer headline-derived topic for the badge so it matches the video content
    effective_topic = _infer_topic_from_headline(headline) or topic

    accent = _topic_accent(effective_topic)
    accent_dim = tuple(max(0, c - 60) for c in accent)  # darker shade for fills

    # ── Background: AI image or fallback gradient ─────────────────────────
    bg_bytes = _fetch_bg_image(headline, effective_topic)
    if bg_bytes:
        import io as _io
        from PIL import ImageEnhance
        bg = Image.open(_io.BytesIO(bg_bytes)).convert("RGB")
        bg = bg.resize((THUMB_W, THUMB_H), Image.LANCZOS)
        bg = ImageEnhance.Color(bg).enhance(1.4)      # boost saturation
        bg = ImageEnhance.Contrast(bg).enhance(1.1)   # slight contrast lift
        bg = bg.filter(ImageFilter.GaussianBlur(radius=1))
        # Semi-transparent overlay — lighter than before so bg colors show through
        overlay = Image.new("RGBA", (THUMB_W, THUMB_H), (8, 12, 28, 148))
        img = Image.alpha_composite(bg.convert("RGBA"), overlay).convert("RGB")
    else:
        # Fallback: deep gradient in the topic accent color
        r0, g0, b0 = accent_dim
        img = Image.new("RGB", (THUMB_W, THUMB_H), (r0 // 4, g0 // 4, b0 // 4))
        _gd = ImageDraw.Draw(img)
        for y in range(THUMB_H):
            t = y / THUMB_H
            _gd.line(
                [(0, y), (THUMB_W, y)],
                fill=(int(r0 // 4 + r0 // 2 * t), int(g0 // 4 + g0 // 2 * t), int(b0 // 4 + b0 // 2 * t)),
            )

    draw = ImageDraw.Draw(img)

    # ── Branding ──────────────────────────────────────────────────────────

    # Top accent bar — thicker, topic color
    draw.rectangle([0, 0, THUMB_W, 18], fill=accent)

    # Logo
    font_logo = _find_font(72)
    _draw_centered(draw, "STAR SIGNAL", 84, font_logo, (255, 255, 255))

    # Tagline — use accent color instead of muted gray
    _draw_centered(draw, "Financial Astrology · AI Signals", 182, _find_font(34), accent)

    # Topic badge — solid accent fill with white text for maximum pop
    if effective_topic:
        font_badge = _find_font(40)
        badge = effective_topic.upper()
        bbox  = draw.textbbox((0, 0), badge, font=font_badge)
        bw, bh = bbox[2] - bbox[0], bbox[3] - bbox[1]
        pad_x, pad_y = 36, 16
        bx = (THUMB_W - bw - pad_x * 2) // 2
        by = 290
        draw.rounded_rectangle(
            [bx, by, bx + bw + pad_x * 2, by + bh + pad_y * 2],
            radius=12, fill=accent,
        )
        draw.text((bx + pad_x, by + pad_y), badge, fill=(10, 10, 20), font=font_badge)

    # Divider under header — accent color
    draw.rectangle([80, 408, THUMB_W - 80, 412], fill=accent)

    # Headline — white for contrast against colorful background
    _draw_wrapped(draw, headline.upper(), 448, _find_font(66), (255, 255, 255), margin=80, line_h=84, max_lines=8)

    # Divider above footer — accent color
    draw.rectangle([80, THUMB_H - 195, THUMB_W - 80, THUMB_H - 191], fill=accent)

    # Domain — accent color
    _draw_centered(draw, "starsignal.io", THUMB_H - 158, _find_font(44), accent)

    # Date (bottom-left)
    if date_str:
        draw.text((80, THUMB_H - 98), date_str, fill=(200, 210, 220), font=_find_font(30))

    img.save(path, "JPEG", quality=90)
    return path
