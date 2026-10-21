from pathlib import Path

p = Path('public/js/shift-schedule.js')
s = p.read_text(encoding='utf-8')
old = ".replace(/\\u0643/g, '\\u06A9').trim();"
new = ".replace(/\\u0643/g, '\\u06A9').replace(/\\s+/g, '').trim();"
if old not in s:
    raise SystemExit('anchor missing')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')
print('ok')
