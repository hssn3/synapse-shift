import json, io, sys

d = json.load(io.open('tools/docx-structure.json', encoding='utf-8-sig'))
for x in d:
    print('=' * 78)
    print(x['file'], '|', x['counts'], '|', x['core'])
    print('SECTION:', x['sections'][0])
    for i, t in enumerate(x['tables_detail']):
        print('-- TABLE %d: %dr x %dc' % (i + 1, t['rows'], t['cols']))
        print('   header:', t['header'])
        for r in t['sample'][:5]:
            print('   row:', r)
    print('PARAS:')
    for p in x['all_text_first_60']:
        print('   -', p)
