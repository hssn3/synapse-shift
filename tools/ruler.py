from PIL import Image, ImageDraw
import sys

src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
d = ImageDraw.Draw(im)
w, h = im.size
for x in range(0, w, 50):
    d.line([(x, 0), (x, h)], fill=(255, 0, 0), width=1)
    d.text((x + 2, 2), str(x), fill=(255, 0, 0))
for y in range(0, h, 50):
    d.line([(0, y), (w, y)], fill=(0, 128, 255), width=1)
    d.text((2, y + 1), str(y), fill=(0, 128, 255))
im.save(out)
print(out, im.size)
