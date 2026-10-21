import json, io

with io.open('build/personnel-diff.json', encoding='utf-8') as f:
    report = json.load(f)

lines = ['# مغایرت نام‌های پرسنل — تصاویر ارسالی در برابر دیتابیس', '',
         'تعداد کل در تصاویر: **۱۱۴ نفر** — تعداد در دیتابیس: **۱۱۴ نفر** (تعداد هر بخش دقیقاً برابر است).',
         'اختلاف فقط در املای ۳۷ نام است. ستون «در دیتابیس» همان چیزی است که از فایل‌های Word وارد شده بود.', '']

for r in report:
    if not (r['missing'] or r['extra'] or r['posDiff']):
        continue
    lines.append('## ' + r['ward'])
    lines.append('')
    lines.append('| در تصویر | در دیتابیس |')
    lines.append('|---|---|')
    for a, b in zip(r['missing'], r['extra']):
        lines.append('| %s | %s |' % (a, b))
    if r['posDiff']:
        lines.append('')
        lines.append('سمت متفاوت: ' + '، '.join(r['posDiff']))
    lines.append('')

with io.open('deliverables/مغایرت-نام-پرسنل.md', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

print('rows written')
