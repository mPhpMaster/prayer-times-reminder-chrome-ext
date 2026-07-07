"""Generate the extension's PNG icons (crescent moon on a teal disc).

Icons are the shared source of truth under core/assets/icons/; sync-core.mjs
copies them into each target's build. Run from anywhere: paths resolve off the
repo root (this file's parent's parent), not the current working directory.
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw

ICONS_DIR = Path(__file__).resolve().parents[1] / "core" / "assets" / "icons"
OUT = {16: ICONS_DIR / "icon16.png", 32: ICONS_DIR / "icon32.png",
       48: ICONS_DIR / "icon48.png", 128: ICONS_DIR / "icon128.png"}
# Render large then downscale for clean anti-aliasing.
SS = 8  # supersample factor


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def make(size, background=True):
    """The brand icon. background=False renders only the crescent + star on
    transparency — used for the Android adaptive-icon foreground layer, where
    the launcher paints the (teal) background itself."""
    S = size * SS
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Rounded-square teal gradient background.
    top = (45, 212, 167)      # accent green-teal
    bot = (15, 76, 92)        # deep teal
    if background:
        radius = int(S * 0.22)
        bg = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        bd = ImageDraw.Draw(bg)
        for y in range(S):
            bd.line([(0, y), (S, y)], fill=lerp(top, bot, y / S) + (255,))
        # mask to rounded rect
        mask = Image.new("L", (S, S), 0)
        md = ImageDraw.Draw(mask)
        md.rounded_rectangle([0, 0, S - 1, S - 1], radius=radius, fill=255)
        img.paste(bg, (0, 0), mask)
        d = ImageDraw.Draw(img)

    # Crescent moon: a light disc with an offset dark disc subtracted.
    cx, cy = S * 0.52, S * 0.50
    r = S * 0.30
    moon = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    mdraw = ImageDraw.Draw(moon)
    mdraw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 255, 255, 255))
    # subtract offset circle to carve the crescent
    ox, oy, orad = cx + r * 0.42, cy - r * 0.12, r * 0.92
    cut = Image.new("L", (S, S), 0)
    cdraw = ImageDraw.Draw(cut)
    cdraw.ellipse([ox - orad, oy - orad, ox + orad, oy + orad], fill=255)
    moon_px = moon.load()
    cut_px = cut.load()
    for y in range(S):
        for x in range(S):
            if cut_px[x, y] > 0:
                moon_px[x, y] = (0, 0, 0, 0)
    img.alpha_composite(moon)

    # A small five-pointed star next to the crescent.
    sx, sy, sr = S * 0.70, S * 0.34, S * 0.085
    pts = []
    for i in range(5):
        ang = -math.pi / 2 + i * 2 * math.pi / 5
        pts.append((sx + sr * math.cos(ang), sy + sr * math.sin(ang)))
        ang2 = ang + math.pi / 5
        pts.append((sx + sr * 0.45 * math.cos(ang2), sy + sr * 0.45 * math.sin(ang2)))
    ImageDraw.Draw(img).polygon(pts, fill=(255, 255, 255, 255))

    return img.resize((size, size), Image.LANCZOS)


def main():
    ICONS_DIR.mkdir(parents=True, exist_ok=True)
    for size, path in OUT.items():
        make(size).save(path)
        print("wrote", path)


# Importable: make_promo.py reuses make() so the promo tile and the shipped
# icon are drawn from one source and never drift.
if __name__ == "__main__":
    main()
