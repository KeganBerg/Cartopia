# Lays each model's close-up views out on one contact sheet (4 across).
# python3 scripts/closeup/sheet.py inDir outDir [cols] [cell]
import os, re, sys
from collections import defaultdict
from PIL import Image, ImageDraw

src, dst = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 4
cell = int(sys.argv[4]) if len(sys.argv) > 4 else 400
os.makedirs(dst, exist_ok=True)
groups = defaultdict(list)
for f in sorted(os.listdir(src)):
    m = re.match(r'(.+)-(\d\d)\.png$', f)
    if m: groups[m.group(1)].append(f)
for tag, files in groups.items():
    rows = (len(files) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * cell, rows * cell + 28), '#111')
    d = ImageDraw.Draw(sheet)
    d.text((8, 8), tag, fill='#fff')
    for i, f in enumerate(files):
        im = Image.open(os.path.join(src, f)).convert('RGB').resize((cell, cell))
        sheet.paste(im, ((i % cols) * cell, 28 + (i // cols) * cell))
        d.text(((i % cols) * cell + 4, 28 + (i // cols) * cell + 4), str(i), fill='#ff0')
    sheet.save(os.path.join(dst, tag + '.png'))
    print(tag)
