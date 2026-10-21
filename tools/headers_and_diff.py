import zipfile, re, sys, os, hashlib

def text_of(xml):
    # join all w:t, adding paragraph breaks
    xml = re.sub(r'</w:p>', '\n', xml)
    parts = re.findall(r'<w:t[^>]*>(.*?)</w:t>', xml, re.S)
    return parts

def show_header(path):
    z = zipfile.ZipFile(path)
    print('=' * 74)
    print(os.path.basename(path))
    for name in z.namelist():
        if re.match(r'word/header\d*\.xml', name) or re.match(r'word/footer\d*\.xml', name):
            raw = z.read(name).decode('utf-8')
            txt = ''.join(text_of(raw)).strip()
            print('  %s: %r' % (name, txt[:300]))
    return z

def body_text(path):
    z = zipfile.ZipFile(path)
    raw = z.read('word/document.xml').decode('utf-8')
    raw = re.sub(r'<w:tab/>', '\t', raw)
    raw = re.sub(r'</w:p>', '\n', raw)
    raw = re.sub(r'</w:tc>', ' | ', raw)
    txt = ''.join(re.findall(r'<w:t[^>]*>(.*?)</w:t>|\n|\|', raw))
    return txt

paths = sys.argv[1:]
zs = [show_header(p) for p in paths]

print('\n' + '#' * 74)
print('DIFF 55 vs 99 (line based)')
import difflib
p55 = [p for p in paths if '55' in p][0]
p99 = [p for p in paths if '99' in p][0]
a = [l.strip() for l in body_text(p55).splitlines() if l.strip()]
b = [l.strip() for l in body_text(p99).splitlines() if l.strip()]
print('lines 55:', len(a), ' lines 99:', len(b))
for line in difflib.unified_diff(a, b, 'code55', 'code99', lineterm='', n=1):
    print(line[:200])
