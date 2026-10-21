import os, shutil, pymupdf

OUT = 'deliverables'
os.makedirs(OUT, exist_ok=True)

# نوار ماه‌ها و تب فرم‌ها (اسکرین‌شات‌های واقعی مرورگر)
pairs = [
    ('build/month-tabs-grid.png', 'نوار-ماه‌ها.png'),
    ('build/codes-tab-99.png', 'پنل-فرم-های-کد.png'),
]
for src, dst in pairs:
    shutil.copyfile(src, os.path.join(OUT, dst))
    print(dst, os.path.getsize(os.path.join(OUT, dst)), 'bytes')

# برگه‌های چاپی از PDF
jobs = [
    ('build/code99-print.pdf', 'چاپ-کد-۹۹'),
    ('build/crisis-print.pdf', 'چاپ-اورژانس-بحران'),
]
for pdf, stem in jobs:
    doc = pymupdf.open(pdf)
    for i, page in enumerate(doc):
        name = f'{stem}-برگه-{i + 1}.png'
        path = os.path.join(OUT, name)
        page.get_pixmap(dpi=150).save(path)
        print(name, f'{os.path.getsize(path) / 1024:.0f} KB')
