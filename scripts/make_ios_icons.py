"""Generate the iOS app icons and launch splash from the same crescent-and-star
artwork as the extension and Android icons (make_icons.make).

Writes into targets/mobile/ios/App/App/Assets.xcassets/:
  AppIcon.appiconset/   every iPhone + iPad size plus the 1024 App Store
                        (marketing) icon, all full-bleed squares WITHOUT alpha
                        (iOS applies its own rounded mask; App Store Connect
                        rejects a marketing icon with transparency)
  Splash.imageset/      2732x2732 launch image (brand teal + centred icon art)

Run from anywhere: paths resolve off the repo root.
"""
import json
from pathlib import Path
from PIL import Image, ImageDraw

import make_icons

ASSETS = (Path(__file__).resolve().parents[1]
          / "targets" / "mobile" / "ios" / "App" / "App" / "Assets.xcassets")

TOP = (45, 212, 167)   # brand gradient, as in make_icons.make
BOT = (15, 76, 92)

# (idiom, point size, scale) — the full classic iOS/iPadOS AppIcon set.
SLOTS = [
    ("iphone", 20, 2), ("iphone", 20, 3),
    ("iphone", 29, 2), ("iphone", 29, 3),
    ("iphone", 40, 2), ("iphone", 40, 3),
    ("iphone", 60, 2), ("iphone", 60, 3),
    ("ipad", 20, 1), ("ipad", 20, 2),
    ("ipad", 29, 1), ("ipad", 29, 2),
    ("ipad", 40, 1), ("ipad", 40, 2),
    ("ipad", 76, 1), ("ipad", 76, 2),
    ("ipad", 83.5, 2),
    ("ios-marketing", 1024, 1),
]


def gradient(size):
    bg = Image.new("RGB", (size, size))
    d = ImageDraw.Draw(bg)
    for y in range(size):
        d.line([(0, y), (size, y)], fill=make_icons.lerp(TOP, BOT, y / size))
    return bg


def master(size=1024):
    """Full-bleed square icon, no transparency."""
    make_icons.SS = 2  # 2048px work canvas is plenty for a 1024 master
    art = make_icons.make(size, background=False)
    img = gradient(size).convert("RGBA")
    img.alpha_composite(art)
    return img.convert("RGB")


def fmt(n):
    return ("%g" % n)


def main():
    icon_dir = ASSETS / "AppIcon.appiconset"
    icon_dir.mkdir(parents=True, exist_ok=True)
    for old in icon_dir.glob("*.png"):
        old.unlink()
    big = master(1024)
    images, written = [], {}
    for idiom, pt, scale in SLOTS:
        px = int(round(pt * scale))
        name = "AppIcon-1024.png" if idiom == "ios-marketing" else f"AppIcon-{px}.png"
        if name not in written:
            img = big if px == 1024 else big.resize((px, px), Image.LANCZOS)
            img.save(icon_dir / name, optimize=True)
            written[name] = px
        images.append({
            "filename": name,
            "idiom": idiom,
            "scale": f"{scale}x",
            "size": f"{fmt(pt)}x{fmt(pt)}",
        })
    (icon_dir / "Contents.json").write_text(
        json.dumps({"images": images, "info": {"author": "xcode", "version": 1}}, indent=2) + "\n",
        encoding="utf-8")
    print("wrote", len(written), "icon files ->", icon_dir)

    # Launch splash: deep teal with the art centred. LaunchScreen.storyboard
    # shows it aspect-fill, so a phone crops the sides of the square — keep the
    # art small and central.
    splash_dir = ASSETS / "Splash.imageset"
    splash_dir.mkdir(parents=True, exist_ok=True)
    for old in splash_dir.glob("*.png"):
        old.unlink()
    S = 2732
    splash = Image.new("RGBA", (S, S), BOT + (255,))
    art_px = 640
    art = big.resize((art_px, art_px), Image.LANCZOS)
    mask = Image.new("L", (art_px * 4, art_px * 4), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, art_px * 4 - 1, art_px * 4 - 1], radius=int(art_px * 4 * 0.22), fill=255)
    mask = mask.resize((art_px, art_px), Image.LANCZOS)
    off = (S - art_px) // 2
    splash.paste(art, (off, off), mask)
    splash = splash.convert("RGB")
    splash.save(splash_dir / "splash-2732x2732.png", optimize=True)
    (splash_dir / "Contents.json").write_text(json.dumps({
        "images": [
            {"idiom": "universal", "filename": "splash-2732x2732.png", "scale": "1x"},
            {"idiom": "universal", "scale": "2x"},
            {"idiom": "universal", "scale": "3x"},
        ],
        "info": {"author": "xcode", "version": 1},
    }, indent=2) + "\n", encoding="utf-8")
    print("wrote splash ->", splash_dir)


if __name__ == "__main__":
    main()
