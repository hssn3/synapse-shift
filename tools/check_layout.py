import sys, pymupdf

pdf = sys.argv[1]
doc = pymupdf.open(pdf)
page = doc[0]
W = page.rect.width
words = page.get_text('words')
def find(needle):
    hits = [w for w in words if needle in w[4]]
    return [(round(w[0]), round(w[2]), w[4]) for w in hits[:4]]

print('page width %.0f' % W)
for needle in ['ردیف', 'اضافه', 'نام', 'سابقه', '30', '1']:
    print(needle, '->', find(needle))
print('pages:', doc.page_count)
