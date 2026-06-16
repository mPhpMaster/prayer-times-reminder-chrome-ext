from PIL import Image
import os

def card_bbox(im, bg, thr=25):
    w, h = im.size
    pix = im.load()
    minx, miny = 10**9, 10**9
    maxx, maxy = -1, -1
    for y in range(h):
        for x in range(w):
            r, g, b = pix[x, y]
            if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) > thr:
                if x < minx: minx = x
                if y < miny: miny = y
                if x > maxx: maxx = x
                if y > maxy: maxy = y
    if maxx == -1:
        return (0, 0, w, h)
    return (minx, miny, maxx + 1, maxy + 1)

repo = r"E:\chrome-ext"
ref_path = os.path.join(repo, "1.png")
ref = Image.open(ref_path).convert("RGB")
ref_bg = ref.getpixel((0, 0))
ref_bbox = card_bbox(ref, ref_bg, thr=25)
ref_x, ref_y, ref_x2, ref_y2 = ref_bbox
ref_w, ref_h = ref_x2 - ref_x, ref_y2 - ref_y
print("ref card bbox", ref_bbox, "size", (ref_w, ref_h))

out_dir = os.path.join(repo, "screenshots")
codes = ["en", "de", "ar", "ur", "hi", "id", "fr", "es"]

for code in codes:
    p = os.path.join(out_dir, f"{code}.png")
    im = Image.open(p).convert("RGB")
    bg = im.getpixel((0, 0))
    bbox = card_bbox(im, bg, thr=25)
    x1, y1, x2, y2 = bbox
    crop = im.crop((x1, y1, x2, y2))
    crop_resized = crop.resize((ref_w, ref_h), Image.Resampling.LANCZOS)

    canvas = ref.copy()  # keep exact background gradient and orbs
    canvas.paste(crop_resized, (ref_x, ref_y))
    canvas.save(p, "PNG", optimize=True)
    print(code, "old bbox", bbox, "crop", crop.size, "-> pasted", (ref_w, ref_h))
