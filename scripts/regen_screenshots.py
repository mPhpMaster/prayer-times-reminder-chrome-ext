from PIL import Image
import os

repo = r"E:\\chrome-ext"
ref_path = os.path.join(repo, "1.png")
ref = Image.open(ref_path).convert("RGB")
W,H = ref.size

# Compute reference card bbox using mid-line scans (works for provided reference images)
bg_ref = ref.getpixel((0,0))

def dist(c):
    return abs(c[0]-bg_ref[0]) + abs(c[1]-bg_ref[1]) + abs(c[2]-bg_ref[2])

mid_y = H//2
row = [ref.getpixel((x, mid_y)) for x in range(W)]
thr=25
left=None
right=None
for x in range(W):
    if dist(row[x])>thr:
        left=x
        break
for x in range(W-1,-1,-1):
    if dist(row[x])>thr:
        right=x
        break

col = [ref.getpixel((W//2,y)) for y in range(H)]
top=None
bottom=None
for y in range(H):
    if dist(col[y])>thr:
        top=y
        break
for y in range(H-1,-1,-1):
    if dist(col[y])>thr:
        bottom=y
        break

ref_bbox = (left, top, right+1, bottom+1)
ref_w = ref_bbox[2]-ref_bbox[0]
ref_h = ref_bbox[3]-ref_bbox[1]
print('ref size', ref.size, 'ref card bbox', ref_bbox, 'card', (ref_w, ref_h))

# Map languages to source images in assets
assets_dir = r"C:\\Users\\Administrator\\.cursor\\projects\\e-chrome-ext\\assets"
lang_sources = {
    'en': 'd7a7960b-c275-451e-acac-0f496438852e',
    'ar': 'd5d7faa5-251d-4460-a6ec-37389935f1a2',
    'ur': 'd4a97e1b-4ed3-4030-bacd-cfec7763786a',
    'hi': '51a2face-7b49-48d6-8d9f-dabb928d772e',
    'id': '87749fd2-f6d1-488d-86f8-1a021fb12960',
    'de': 'b16e9a86-0096-4458-bcf3-1cdb2a8511c8',
    'fr': 'b1516f9c-4df9-427d-bd09-6a145646fccd',
    'es': '054a4841-8c17-4d91-8891-43ddb4182f4d',
}

# Find source file by substring
for k,sub in list(lang_sources.items()):
    fn = [f for f in os.listdir(assets_dir) if sub in f and f.endswith('.png')]
    if not fn:
        raise SystemExit(f'missing source for {k}: {sub}')
    lang_sources[k] = os.path.join(assets_dir, fn[0])

out_dir = os.path.join(repo, 'screenshots')
os.makedirs(out_dir, exist_ok=True)

# Card bbox detector for sources (assumes outer background near top-left is reasonably uniform)

def card_bbox_from_bg(im, thr=25):
    bg = im.getpixel((0,0))
    w,h = im.size
    minx,miny = 10**9, 10**9
    maxx,maxy = -1,-1
    for y in range(h):
        for x in range(w):
            c = im.getpixel((x,y))
            if abs(c[0]-bg[0]) + abs(c[1]-bg[1]) + abs(c[2]-bg[2]) > thr:
                minx = min(minx, x)
                miny = min(miny, y)
                maxx = max(maxx, x)
                maxy = max(maxy, y)
    if maxx==-1:
        return (0,0,w,h)
    return (minx, miny, maxx+1, maxy+1)

for code, src_path in lang_sources.items():
    src = Image.open(src_path).convert('RGB')
    bbox = card_bbox_from_bg(src, thr=25)
    crop = src.crop(bbox)
    crop_resized = crop.resize((ref_w, ref_h), Image.Resampling.LANCZOS)

    canvas = ref.copy()
    canvas.paste(crop_resized, (ref_bbox[0], ref_bbox[1]))

    out_path = os.path.join(out_dir, f'{code}.png')
    canvas.save(out_path, 'PNG', optimize=True)
    print(code, 'src', src.size, 'bbox', bbox, 'crop', crop.size, '-> out', out_path)

print('done')
