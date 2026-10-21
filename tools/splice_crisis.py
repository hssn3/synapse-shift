from pathlib import Path

target = Path('public/js/shift-schedule.js')
src = target.read_text(encoding='utf-8')
new_fn = Path('tools/_crisis_fn.txt').read_text(encoding='utf-8')

start = src.index('  function ssCrisisHtml() {')
end = src.index('  global.ssEditCrisisCell')
src = src[:start] + new_fn + '\n' + src[end:]
target.write_text(src, encoding='utf-8')
print('replaced', end - start, 'chars with', len(new_fn))
