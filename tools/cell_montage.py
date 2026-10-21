from PIL import Image, ImageDraw, ImageFont
import sys, os

# ساخت شبکهٔ برچسب‌دار از خانه‌های روزهای یک یا چند نفر
# python tools/cell_montage.py <img> <x_right> <cell_w> <y_top> <row_h> <rows_csv> <days>

img_path = sys.argv[1]
x_right = float(sys.argv[2])
cell_w = float(sys.argv[3])
y_top = float(sys.argv[4])
row_h = float(sys.argv[5])
rows = [int(x) for x in sys.argv[6].split(',')]
days = int(sys.argv[7]) if len(sys.argv) > 7 else 30
out = sys.argv[8]

im = Image.open(img_path).convert('RGB')
CW, CH, GAP = 110, 70, 8
cols = 10
per = len(rows)
blocks = []
for r in rows:
    block = Image.new('RGB', (cols * (CW + GAP) + GAP, 5 * (CH + 26) + 26), 'white')
    d = ImageDraw.Draw(block)
    for day in range(1, days + 1):
        x0 = x_right - day * cell_w
        y0 = y_top + (r - 1) * row_h
        cell = im.crop((int(x0), int(y0), int(x0 + cell_w), int(y0 + row_h))).resize((CW, CH), Image.LANCZOS)
        i = day - 1
        cx = GAP + (i % cols) * (CW + GAP)
        cy = 26 + (i // cols) * (CH + 26)
        block.paste(cell, (cx, cy))
        d.rectangle([cx, cy, cx + CW, cy + CH], outline='#999')
        d.text((cx + CW // 2 - 6, cy + CH + 4), str(day), fill='black')
    d.text((5, 4), 'row %d' % r, fill='red')
    blocks.append(block)

W = max(b.width for b in blocks)
H = sum(b.height for b in blocks) + 10 * (len(blocks) - 1)
sheet = Image.new('RGB', (W, H), 'white')
y = 0
for b in blocks:
    sheet.paste(b, (0, y))
    y += b.height + 10
sheet.save(out)
print(out, sheet.size)
