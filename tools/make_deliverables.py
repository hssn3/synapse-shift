import os, pymupdf

OUT = 'deliverables'
os.makedirs(OUT, exist_ok=True)

jobs = [
    ('build/docx-render/اورژانس-بحران.pdf', 'تصویر-اورژانس-بحران'),
    ('build/docx-render/كد-55.pdf', 'تصویر-کد-۵۵'),
    ('build/docx-render/كد-99.pdf', 'تصویر-کد-۹۹'),
]

made = []
for pdf, stem in jobs:
    doc = pymupdf.open(pdf)
    for i, page in enumerate(doc):
        pix = page.get_pixmap(dpi=150)
        name = '%s-صفحه-%d.png' % (stem, i + 1)
        path = os.path.join(OUT, name)
        pix.save(path)
        made.append((path, pix.width, pix.height, os.path.getsize(path)))

for p, w, h, s in made:
    print('%s\t%dx%d\t%.1f KB' % (p, w, h, s / 1024))
