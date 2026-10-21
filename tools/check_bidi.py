import sys, zipfile
from lxml import etree

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
def q(t): return '{%s}%s' % (W, t)

for path in sys.argv[1:]:
    z = zipfile.ZipFile(path)
    print('=' * 60)
    print(path.split('\\')[-1])
    for part in ['word/document.xml', 'word/header1.xml']:
        if part not in z.namelist():
            continue
        root = etree.fromstring(z.read(part))
        for i, tbl in enumerate(root.iter(q('tbl'))):
            pr = tbl.find(q('tblPr'))
            bidi = pr is not None and pr.find(q('bidiVisual')) is not None
            rows = len(tbl.findall(q('tr')))
            first = tbl.find(q('tr'))
            ncell = len(first.findall(q('tc'))) if first is not None else 0
            print('  %-18s tbl#%-3d %2dr %2dc  bidiVisual=%s' % (part.split('/')[-1], i + 1, rows, ncell, bidi))
