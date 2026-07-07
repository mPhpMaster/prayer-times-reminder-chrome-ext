"""Generate the Android launcher icons from the same crescent-and-star artwork
as the extension icons (make_icons.make), replacing Capacitor's default set.

Writes into targets/mobile/android/app/src/main/res/:
  mipmap-<density>/ic_launcher.png            legacy launcher icon (rounded square)
  mipmap-<density>/ic_launcher_round.png      circular variant
  mipmap-<density>/ic_launcher_foreground.png adaptive foreground (art only,
                                              sized for the 66/108dp safe zone)
  values/ic_launcher_background.xml           adaptive background = deep teal

Run from anywhere: paths resolve off the repo root.
"""
from pathlib import Path
from PIL import Image, ImageDraw

import make_icons

RES = (Path(__file__).resolve().parents[1]
       / "targets" / "mobile" / "android" / "app" / "src" / "main" / "res")

# Launcher icon is 48dp, adaptive canvas is 108dp; per-density scale factors.
DENSITIES = {"mdpi": 1.0, "hdpi": 1.5, "xhdpi": 2.0, "xxhdpi": 3.0, "xxxhdpi": 4.0}

# Adaptive background: the deep-teal end of the brand gradient.
BACKGROUND_XML = """<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#0F4C5C</color>
</resources>
"""


def circle_mask(size, ss=4):
    m = Image.new("L", (size * ss, size * ss), 0)
    ImageDraw.Draw(m).ellipse([0, 0, size * ss - 1, size * ss - 1], fill=255)
    return m.resize((size, size), Image.LANCZOS)


def round_icon(size):
    # The inscribed circle lies entirely inside the rounded-square fill
    # (corner radius 22%), so masking the square icon yields a clean disc.
    img = make_icons.make(size)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), circle_mask(size))
    return out


def foreground(canvas):
    # Art only (no background), scaled so the crescent sits inside the
    # adaptive-icon safe zone (66dp circle on the 108dp canvas) with room for
    # the launcher's zoom/parallax effects.
    art_box = int(canvas * 0.70)
    art = make_icons.make(art_box, background=False)
    img = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    off = (canvas - art_box) // 2
    img.alpha_composite(art, (off, off))
    return img


def main():
    for density, scale in DENSITIES.items():
        d = RES / f"mipmap-{density}"
        d.mkdir(parents=True, exist_ok=True)
        launcher = int(48 * scale)
        make_icons.make(launcher).save(d / "ic_launcher.png")
        round_icon(launcher).save(d / "ic_launcher_round.png")
        foreground(int(108 * scale)).save(d / "ic_launcher_foreground.png")
        print(f"wrote mipmap-{density} ({launcher}px launcher, {int(108 * scale)}px foreground)")

    bg = RES / "values" / "ic_launcher_background.xml"
    bg.write_text(BACKGROUND_XML, encoding="utf-8")
    print("wrote", bg)


if __name__ == "__main__":
    main()
