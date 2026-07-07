"""Render the Chrome Web Store promo tiles (small 440x280 + marquee 1400x560).

Midnight-Emerald backdrop with soft teal glow, the app icon on the left, and the
wordmark + gold accent + tagline + feature line on the right. The icon art is
reused from make_icons.make() so the promo and the shipped icon never drift.

Run:  python scripts/make_promo.py
Output: screenshots/promo-small-440x280.(png|jpg)
        screenshots/promo-marquee-1400x560.(png|jpg)
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

from make_icons import make as make_app_tile  # same-dir import (scripts/ on path)

REPO = Path(__file__).resolve().parents[1]
OUT = REPO / "screenshots"

# ---- palette (matches theme.css Midnight Emerald) --------------------------
BG_TOP = (10, 28, 32)      # #0a1c20
BG_BOTTOM = (2, 9, 11)     # #02090b
GLOW = (45, 212, 191)      # teal accent
WORDMARK = (245, 250, 249)
GOLD = (240, 182, 66)      # accent underline
TAGLINE = (45, 212, 191)   # teal
MUTED = (138, 160, 158)    # muted-foreground

# ---- fonts: prefer Segoe UI (Windows), fall back to PIL's bundled DejaVu ----
_FONT_CANDIDATES = {
    "regular": [r"C:\Windows\Fonts\segoeui.ttf", "DejaVuSans.ttf"],
    "light": [r"C:\Windows\Fonts\segoeuil.ttf", r"C:\Windows\Fonts\segoeui.ttf", "DejaVuSans.ttf"],
    "semibold": [r"C:\Windows\Fonts\seguisb.ttf", r"C:\Windows\Fonts\segoeui.ttf", "DejaVuSans-Bold.ttf"],
}


def font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    for path in _FONT_CANDIDATES[weight]:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def backdrop(w: int, h: int) -> Image.Image:
    """Vertical Midnight-Emerald gradient + two soft teal glow orbs."""
    img = Image.new("RGB", (w, h), BG_TOP)
    draw = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(h - 1, 1)
        draw.line(
            [(0, y), (w, y)],
            fill=tuple(int(BG_TOP[i] * (1 - t) + BG_BOTTOM[i] * t) for i in range(3)),
        )
    # Soft blurred teal glows: one behind the icon, one faint on the right.
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    r1 = h * 0.55
    c1 = (w * 0.22, h * 0.5)
    gd.ellipse([c1[0] - r1, c1[1] - r1, c1[0] + r1, c1[1] + r1], fill=GLOW + (34,))
    r2 = h * 0.42
    c2 = (w * 0.72, h * 0.42)
    gd.ellipse([c2[0] - r2, c2[1] - r2, c2[0] + r2, c2[1] + r2], fill=GLOW + (16,))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=int(h * 0.12)))
    return Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB")


def render(w: int, h: int, spec: dict) -> Image.Image:
    img = backdrop(w, h).convert("RGBA")
    draw = ImageDraw.Draw(img)

    # App icon tile, vertically centred on the left.
    tile = make_app_tile(spec["tile"])
    tx = spec["pad"]
    ty = (h - spec["tile"]) // 2
    img.alpha_composite(tile, (tx, ty))

    # Text column to the right of the icon.
    x = tx + spec["tile"] + spec["gap"]
    wm = font("light", spec["wm"])
    line_h = int(spec["wm"] * spec["wm_lh"])
    y = spec["wm_y"]
    for line in ("Prayer Times", "Reminder"):
        draw.text((x, y), line, font=wm, fill=WORDMARK)
        y += line_h

    # Gold underline accent under the wordmark.
    uy = y + spec["ul_gap"]
    draw.rounded_rectangle(
        [x, uy, x + spec["ul_w"], uy + spec["ul_h"]], radius=spec["ul_h"] // 2, fill=GOLD
    )

    # Teal tagline + muted feature line.
    ty2 = uy + spec["ul_h"] + spec["tag_gap"]
    draw.text((x, ty2), "Never miss a prayer.", font=font("semibold", spec["tag"]), fill=TAGLINE)
    fy = ty2 + int(spec["tag"] * 1.35) + spec["feat_gap"]
    draw.text((x, fy), spec["feat"], font=font("regular", spec["feat_sz"]), fill=MUTED)

    return img.convert("RGB")


MARQUEE = dict(
    tile=330, pad=110, gap=80, wm=112, wm_lh=1.02, wm_y=110,
    ul_gap=28, ul_w=120, ul_h=10, tag_gap=34, tag=46, feat_gap=22, feat_sz=30,
    feat="Reminders · Daily schedule · Tab lock · Dhikr · 8 languages",
)
SMALL = dict(
    tile=150, pad=28, gap=26, wm=36, wm_lh=1.05, wm_y=48,
    ul_gap=14, ul_w=54, ul_h=6, tag_gap=16, tag=22, feat_gap=10, feat_sz=15,
    feat="Reminders · Schedule · Tab lock",
)


def save(img: Image.Image, name: str) -> None:
    (OUT / f"{name}.png").parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT / f"{name}.png", "PNG", optimize=True)
    img.save(OUT / f"{name}.jpg", "JPEG", quality=92)
    print(f"{name}.png / .jpg  {img.size}")


def main() -> None:
    save(render(1400, 560, MARQUEE), "promo-marquee-1400x560")
    save(render(440, 280, SMALL), "promo-small-440x280")
    print("done")


if __name__ == "__main__":
    main()
