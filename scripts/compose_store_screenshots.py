"""Compose 1280x800 Chrome Web Store screenshots from raw popup/welcome captures.

The raw captures are produced by loading the screenshot harness
(_shot_popup.html / _shot_welcome.html) in Chrome at 2x zoom and saving a
full-page PNG per language. Each card's crop rect (in raw-pixel coordinates) is
recorded below. This script crops each card and composites it, with a soft teal
glow, onto the Midnight Emerald backdrop — matching the extension theme.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

REPO = Path(__file__).resolve().parents[1]
RAW = REPO / "_shot_raw"
OUT = REPO / "screenshots"

CANVAS = (1280, 800)
BG_TOP = (8, 18, 22)
BG_BOTTOM = (4, 10, 14)
GLOW = (45, 212, 191, 60)
CORNER_RADIUS = 26  # rounds the pasted card so no rectangular halo shows

# raw crop rects: lang -> (x, y, w, h)
POPUP_RECTS = {
    "en": (28, 28, 624, 1337),
    "de": (28, 28, 624, 1337),
    "ar": (233, 28, 624, 1479),
    "ur": (233, 28, 624, 1477),
    "hi": (28, 28, 624, 1367),
    "id": (28, 28, 624, 1337),
    "fr": (28, 28, 624, 1337),
    "es": (28, 28, 624, 1365),
}
WELCOME_RECTS = {
    "en": (113, 475, 1060, 1087),
    "de": (113, 475, 1060, 1087),
    "ar": (113, 489, 1060, 1059),
    "ur": (113, 463, 1060, 1110),
    "hi": (113, 470, 1060, 1096),
    "id": (113, 475, 1060, 1087),
    "fr": (113, 449, 1060, 1138),
    "es": (113, 449, 1060, 1138),
}


def backdrop(size: tuple[int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGB", size, BG_TOP)
    draw = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(h - 1, 1)
        draw.line(
            [(0, y), (w, y)],
            fill=tuple(int(BG_TOP[i] * (1 - t) + BG_BOTTOM[i] * t) for i in range(3)),
        )
    return img


def rounded(card: Image.Image, radius: int) -> Image.Image:
    mask = Image.new("L", card.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, card.width, card.height), radius, fill=255)
    out = card.convert("RGBA")
    out.putalpha(mask)
    return out


def compose(card: Image.Image, max_w_frac: float, max_h_frac: float) -> Image.Image:
    cw, ch = CANVAS
    max_w, max_h = int(cw * max_w_frac), int(ch * max_h_frac)
    scale = min(max_w / card.width, max_h / card.height)
    nw, nh = max(1, round(card.width * scale)), max(1, round(card.height * scale))
    card = rounded(card.resize((nw, nh), Image.Resampling.LANCZOS), CORNER_RADIUS)

    canvas = backdrop(CANVAS).convert("RGBA")
    x, y = (cw - nw) // 2, (ch - nh) // 2

    glow = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    pad = 30
    ImageDraw.Draw(glow).rounded_rectangle(
        (x - pad, y - pad, x + nw + pad, y + nh + pad), radius=40, fill=GLOW
    )
    glow = glow.filter(ImageFilter.GaussianBlur(46))
    canvas = Image.alpha_composite(canvas, glow)
    canvas.alpha_composite(card, (x, y))
    return canvas.convert("RGB")


def run(rects: dict, src_prefix: str, out_name, max_w_frac, max_h_frac) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for lang, (x, y, w, h) in rects.items():
        raw = Image.open(RAW / f"{src_prefix}_{lang}_full.png").convert("RGB")
        card = raw.crop((x, y, x + w, y + h))
        out = compose(card, max_w_frac, max_h_frac)
        out_path = OUT / out_name(lang)
        out.save(out_path, "PNG", optimize=True)
        print(f"{out_path.name}: card {card.size} -> {out.size}")


def main() -> None:
    run(POPUP_RECTS, "popup", lambda l: f"{l}.png", 0.42, 0.92)
    run(WELCOME_RECTS, "welcome", lambda l: f"welcome-{l}.png", 0.52, 0.84)
    print("done")


if __name__ == "__main__":
    main()
