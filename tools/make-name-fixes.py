"""اصلاح نام‌های پرسنل بر اساس تصاویر ارسالی (تصویر = معیار)."""
import json, io, difflib

with io.open('build/personnel-diff.json', encoding='utf-8') as f:
    report = json.load(f)

pairs = []
for r in report:
    missing = r['missing']
    extra = r['extra']
    if not missing or not extra:
        continue
    left = extra[:]
    for name in missing:
        best, score = None, 0.0
        for cand in left:
            s = difflib.SequenceMatcher(None, name, cand).ratio()
            if s > score:
                best, score = cand, s
        if best is None:
            continue
        left.remove(best)
        pairs.append((r['ward'], best, name, round(score, 2)))

lines = ['-- اصلاح نام‌های پرسنل مطابق تصاویر ارسالی', '']
low = []
for ward, old, new, score in pairs:
    parts = new.split(' ')
    first, last = parts[0], ' '.join(parts[1:]) or ''
    o = old.split(' ')
    ofirst, olast = o[0], ' '.join(o[1:]) or ''
    stmt = ("UPDATE ward_staff SET first_name = '%s', last_name = '%s' "
            "WHERE ward = '%s' AND first_name = '%s' AND last_name = '%s';" %
            (first.replace("'", "''"), last.replace("'", "''"), ward.replace("'", "''"),
             ofirst.replace("'", "''"), olast.replace("'", "''")))
    lines.append(stmt)
    if score < 0.75:
        low.append((ward, old, new, score))

with io.open('cloudflare/fix-personnel-names.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines) + '\n')

print('pairs:', len(pairs), ' low-similarity:', len(low))
for row in low:
    print('  ', row)
