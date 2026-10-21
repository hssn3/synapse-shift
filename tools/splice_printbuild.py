from pathlib import Path

p = Path('public/js/shift-schedule.js')
s = p.read_text(encoding='utf-8')
fn = Path('tools/_printbuild.txt').read_text(encoding='utf-8')

start = s.index('  function ssBuildPrintHtml(cfg) {')
end = s.index('  // برای تست/پیش‌نمایش بدون باز کردن پنجرهٔ چاپ')
s = s[:start] + fn + '\n' + s[end:]
p.write_text(s, encoding='utf-8')
print('print build replaced')
