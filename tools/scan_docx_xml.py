import zipfile, re, sys, io

def scan(path):
    z = zipfile.ZipFile(path)
    xml = z.read('word/document.xml').decode('utf-8')
    print('=' * 70)
    print(path.split('\\')[-1])
    print('parts:', [n for n in z.namelist() if n.startswith('word/') and n.endswith('.xml')][:12])
    for tag in ['w:tbl', 'w:tr', 'w:tc', 'w:p ', 'w:txbxContent', 'mc:AlternateContent', 'w:drawing', 'w:pict']:
        print('  %-22s %d' % (tag, xml.count('<' + tag.strip())))
    # text inside textboxes
    boxes = re.findall(r'<w:txbxContent>(.*?)</w:txbxContent>', xml, re.S)
    print('  textboxes:', len(boxes))
    for i, b in enumerate(boxes):
        txt = ''.join(re.findall(r'<w:t[^>]*>(.*?)</w:t>', b, re.S))
        if txt.strip():
            print('    box%d: %s' % (i, txt.strip()[:160]))
    # any mention of code numbers as standalone text
    hits = re.findall(r'<w:t[^>]*>([^<]*کد[^<]*)</w:t>', xml)
    print('  texts containing کد:', hits[:10])
    # legacy pict text (VML)
    vml = re.findall(r'<v:textbox[^>]*>(.*?)</v:textbox>', xml, re.S)
    print('  vml textboxes:', len(vml))

for p in sys.argv[1:]:
    scan(p)
