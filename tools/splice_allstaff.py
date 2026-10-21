from pathlib import Path

p = Path('public/js/shift-schedule.js')
s = p.read_text(encoding='utf-8')
fn = Path('tools/_allstaff.txt').read_text(encoding='utf-8')

marker = "  /* ---------------- تب برنامهٔ بحران ---------------- */"
i = s.index(marker)
s = s[:i] + fn + s[i:]
p.write_text(s, encoding='utf-8')
print('inserted')
