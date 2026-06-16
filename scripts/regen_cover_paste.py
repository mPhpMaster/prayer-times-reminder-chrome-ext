from PIL import Image
import os

repo = r"E:\\chrome-ext"
ref_path = os.path.join(repo, "1.png")
ref = Image.open(ref_path).convert("RGB")

# Target card bbox derived from reference image
ref_x, ref_y = 440, 40
ref_w, ref_h = 416, 720

assets_dir = r"C:\\Users\\Administrator\\.cursor\\projects\\e-chrome-ext\\assets"
lang_sources = {
    'en': 'd7a7960b-c275-451e-acac-0f496438852e',
    'ar': 'd5d7faa5-251d-4460-a6ec-37389935f1a2',
    'ur': 'd4a97e1b-4ed3-4030-bacd-cfec7763786a',
    'fr': 'b1516f9c-4df9-427d-bd09-6a145646fccd',
    'es': '054a4841-8c17-4d91-8891-43ddb4182f4d',
}

# Resolve full paths
for code, sub in list(lang_sources.items()):
    fn = [f for f in os.listdir(assets_dir) if sub in f and f.endswith('.png')]
    if not fn:
        raise SystemExit(f"missing source for {code}: {sub}")
    lang_sources[code] = os.path.join(assets_dir, fn[0])

out_dir = os.path.join(repo, 'screenshots')
os.makedirs(out_dir, exist_ok=True)

for code, src_path in lang_sources.items():
    src = Image.open(src_path).convert('RGB')
    sw, sh = src.size
    scale = max(ref_w / sw, ref_h / sh)
    rw = int(round(sw * scale))
    rh = int(round(sh * scale))
    resized = src.resize((rw, rh), Image.Resampling.LANCZOS)

    # Center crop to target
    cx = (rw - ref_w) // 2
    cy = (rh - ref_h) // 2
    crop = resized.crop((cx, cy, cx + ref_w, cy + ref_h))

    canvas = ref.copy()
    canvas.paste(crop, (ref_x, ref_y))
    out_path = os.path.join(out_dir, f'{code}.png')
    canvas.save(out_path, 'PNG', optimize=True)
    print(code, 'src', src.size, 'resized', (rw, rh), 'crop', crop.size, '->', out_path)

print('done')
