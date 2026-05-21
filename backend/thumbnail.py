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


def _build_image_prompt(headline: str, topic: str | None) -> str:
    """Build a Pollinations.ai prompt that matches the headline's subject matter."""
    topic_l = (topic or "").lower()
    headline_l = headline.lower()

    if any(w in topic_l + headline_l for w in ["bitcoin", "btc", "crypto", "ethereum", "eth"]):
        scene = "bitcoin cryptocurrency glowing digital coins dark dramatic cinematic"
    elif any(w in topic_l + headline_l for w in ["gold", "silver", "bullion"]):
        scene = "gold bullion bars shining dramatic studio lighting dark background"
    elif any(w in topic_l + headline_l for w in ["oil", "energy", "opec"]):
        scene = "oil refinery at night dramatic orange glow dark sky"
    elif any(w in topic_l + headline_l for w in ["dollar", "forex", "currency", "yuan", "yen", "euro"]):
        scene = "currency exchange forex trading screens glowing dark room cinematic"
    elif any(w in topic_l + headline_l for w in ["fed", "rate", "inflation", "interest"]):
        scene = "federal reserve banking dark dramatic columns financial power"
    elif any(w in topic_l + headline_l for w in ["war", "conflict", "sanction", "geopolit"]):
        scene = "dramatic dark geopolitical world map glowing borders tension"
    elif any(w in topic_l + headline_l for w in ["stock", "equity", "nasdaq", "s&p", "dow"]):
        scene = "stock market trading floor screens glowing green red dark cinematic"
    else:
        scene = "financial markets glowing data charts dark dramatic cinematic"

    # Add a short excerpt from the headline for context
    excerpt = re.sub(r'[^a-zA-Z0-9 ]', '', headline[:60]).strip()
    return f"cinematic dramatic {scene}, {excerpt}, moody professional photography, no text, no people, 4k"


def _fetch_bg_image(headline: str, topic: str | None) -> bytes | None:
    """Fetch an AI-generated background image from Pollinations.ai (free, no key needed)."""
    import urllib.request
    import urllib.parse

    prompt = _build_image_prompt(headline, topic)
    url = (
        "https://image.pollinations.ai/prompt/"
        + urllib.parse.quote(prompt)
        + "?width=1080&height=1920&nologo=true&model=flux&enhance=true"
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

    # ── Background: AI image or fallback gradient ─────────────────────────
    bg_bytes = _fetch_bg_image(headline, topic)
    if bg_bytes:
        import io as _io
        bg = Image.open(_io.BytesIO(bg_bytes)).convert("RGB")
        bg = bg.resize((THUMB_W, THUMB_H), Image.LANCZOS)
        bg = bg.filter(ImageFilter.GaussianBlur(radius=2))
        # Dark overlay so white text stays readable (≈75% opaque dark navy)
        overlay = Image.new("RGBA", (THUMB_W, THUMB_H), (4, 10, 20, 192))
        img = Image.alpha_composite(bg.convert("RGBA"), overlay).convert("RGB")
    else:
        # Fallback: dark navy vertical gradient
        img  = Image.new("RGB", (THUMB_W, THUMB_H), (6, 13, 24))
        _gd  = ImageDraw.Draw(img)
        for y in range(THUMB_H):
            t = y / THUMB_H
            _gd.line(
                [(0, y), (THUMB_W, y)],
                fill=(int(6 + 14 * t), int(13 + 18 * t), int(24 + 30 * t)),
            )

    draw = ImageDraw.Draw(img)

    # ── Branding ──────────────────────────────────────────────────────────

    # Top accent bar
    draw.rectangle([0, 0, THUMB_W, 10], fill=(99, 102, 241))

    # Logo
    font_logo = _find_font(72)
    _draw_centered(draw, "STAR SIGNAL", 80, font_logo, (248, 250, 252))

    # Tagline
    _draw_centered(draw, "Financial Astrology · AI Signals", 178, _find_font(34), (100, 116, 139))

    # Topic badge
    if topic:
        font_badge = _find_font(38)
        badge = topic.upper()
        bbox  = draw.textbbox((0, 0), badge, font=font_badge)
        bw, bh = bbox[2] - bbox[0], bbox[3] - bbox[1]
        pad_x, pad_y = 32, 14
        bx = (THUMB_W - bw - pad_x * 2) // 2
        by = 285
        draw.rounded_rectangle(
            [bx, by, bx + bw + pad_x * 2, by + bh + pad_y * 2],
            radius=10, fill=(14, 30, 56), outline=(99, 102, 241), width=2,
        )
        draw.text((bx + pad_x, by + pad_y), badge, fill=(165, 180, 252), font=font_badge)

    # Divider under header
    draw.rectangle([80, 400, THUMB_W - 80, 404], fill=(30, 58, 95))

    # Headline — news text, centered and word-wrapped
    _draw_wrapped(draw, headline, 440, _find_font(66), (226, 232, 240), margin=80, line_h=84, max_lines=8)

    # Divider above footer
    draw.rectangle([80, THUMB_H - 195, THUMB_W - 80, THUMB_H - 191], fill=(30, 58, 95))

    # Domain
    _draw_centered(draw, "starsignal.io", THUMB_H - 158, _find_font(44), (99, 102, 241))

    # Date (bottom-left)
    if date_str:
        draw.text((80, THUMB_H - 98), date_str, fill=(71, 85, 105), font=_find_font(30))

    img.save(path, "JPEG", quality=90)
    return path
