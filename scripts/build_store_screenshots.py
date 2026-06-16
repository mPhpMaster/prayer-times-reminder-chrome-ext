"""Build 1280×800 store screenshots from language popup captures."""

from __future__ import annotations

import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

REPO = Path(__file__).resolve().parents[1]
REF_PATH = REPO / "1.png"
ASSETS_DIR = Path(
    r"C:\Users\Administrator\.cursor\projects\e-chrome-ext\assets"
)
OUT_DIR = REPO / "screenshots"

# UUID fragments → language (matches files in assets/)
LANG_SOURCES = {
    "en": "d7a7960b-c275-451e-acac-0f496438852e",
    "ar": "d5d7faa5-251d-4460-a6ec-37389935f1a2",
    "ur": "d4a97e1b-4ed3-4030-bacd-cfec7763786a",
    "hi": "51a2face-7b49-48d6-8d9f-dabb928d772e",
    "id": "87749fd2-f6d1-488d-86f8-1a021fb12960",
    "de": "b16e9a86-0096-4458-bcf3-1cdb2a8511c8",
    "fr": "b1516f9c-4df9-427d-bd09-6a145646fccd",
    "es": "054a4841-8c17-4d91-8891-43ddb4182f4d",
}

# Midnight Emerald backdrop (matches theme.css)
BG_TOP = (8, 18, 22)
BG_BOTTOM = (4, 10, 14)
GLOW = (45, 212, 191, 48)


def resolve_source(fragment: str) -> Path:
    matches = [
        p
        for p in ASSETS_DIR.iterdir()
        if p.suffix.lower() == ".png" and fragment in p.name
    ]
    if not matches:
        raise FileNotFoundError(f"No asset matching {fragment!r}")
    return matches[0]


def make_backdrop(size: tuple[int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGB", size, BG_TOP)
    draw = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(h - 1, 1)
        r = int(BG_TOP[0] * (1 - t) + BG_BOTTOM[0] * t)
        g = int(BG_TOP[1] * (1 - t) + BG_BOTTOM[1] * t)
        b = int(BG_TOP[2] * (1 - t) + BG_BOTTOM[2] * t)
        draw.line([(0, y), (w, y)], fill=(r, g, b))
    return img


def trim_uniform_border(im: Image.Image, threshold: int = 18) -> Image.Image:
    """Remove flat outer margin so the popup card fills the frame."""
    rgb = im.convert("RGB")
    w, h = rgb.size
    corners = [
        rgb.getpixel((0, 0)),
        rgb.getpixel((w - 1, 0)),
        rgb.getpixel((0, h - 1)),
        rgb.getpixel((w - 1, h - 1)),
    ]
    bg = tuple(sum(c[i] for c in corners) // 4 for i in range(3))

    def is_bg(px: tuple[int, ...]) -> bool:
        return abs(px[0] - bg[0]) + abs(px[1] - bg[1]) + abs(px[2] - bg[2]) <= threshold

    min_x, min_y = w, h
    max_x, max_y = 0, 0
    for y in range(h):
        for x in range(w):
            if not is_bg(rgb.getpixel((x, y))):
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)

    if max_x <= min_x:
        return rgb
    pad = 2
    return rgb.crop(
        (
            max(0, min_x - pad),
            max(0, min_y - pad),
            min(w, max_x + pad + 1),
            min(h, max_y + pad + 1),
        )
    )


def compose_store_shot(src: Image.Image, canvas_size: tuple[int, int]) -> Image.Image:
    cw, ch = canvas_size
    card = trim_uniform_border(src)
    max_h = int(ch * 0.9)
    max_w = int(cw * 0.42)
    scale = min(max_w / card.width, max_h / card.height)
    nw = max(1, int(round(card.width * scale)))
    nh = max(1, int(round(card.height * scale)))
    card = card.resize((nw, nh), Image.Resampling.LANCZOS)

    canvas = make_backdrop(canvas_size)
    x = (cw - nw) // 2
    y = (ch - nh) // 2

    # Soft teal glow behind the card
    glow = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    pad = 28
    glow_draw.rounded_rectangle(
        (x - pad, y - pad, x + nw + pad, y + nh + pad),
        radius=36,
        fill=GLOW,
    )
    glow = glow.filter(ImageFilter.GaussianBlur(radius=42))
    canvas = Image.alpha_composite(canvas.convert("RGBA"), glow).convert("RGB")
    canvas.paste(card, (x, y))
    return canvas


def main() -> None:
    ref = Image.open(REF_PATH)
    canvas_size = ref.size
    print("canvas", canvas_size)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for code, fragment in LANG_SOURCES.items():
        src_path = resolve_source(fragment)
        src = Image.open(src_path)
        out = compose_store_shot(src, canvas_size)
        out_path = OUT_DIR / f"{code}.png"
        out.save(out_path, "PNG", optimize=True)
        print(f"{code}: {src_path.name} {src.size} -> {out_path} {out.size}")

    print("done")


if __name__ == "__main__":
    main()
