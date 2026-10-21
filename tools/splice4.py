from pathlib import Path

p = Path('public/js/shift-schedule.js')
src = p.read_text(encoding='utf-8')
new_fn = Path('tools/_codecell2.txt').read_text(encoding='utf-8')

start = src.index('  global.ssEditCodeCell = function (el, day, role) {')
end = src.index('  function ssCodesBlockHtml(from, to) {')
src = src[:start] + new_fn + '\n' + src[end:]
p.write_text(src, encoding='utf-8')
print('ok', end - start, len(new_fn))
