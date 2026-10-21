from pathlib import Path

target = Path('public/js/shift-schedule.js')
src = target.read_text(encoding='utf-8')
new_fn = Path('tools/_editcell.txt').read_text(encoding='utf-8')

start = src.index('  global.ssEditCell = function (staffId, day, current, isLead) {')
end = src.index('  async function ssSubmitCell(staffId, day, codes, lead) {')
src = src[:start] + new_fn + '\n' + src[end:]
target.write_text(src, encoding='utf-8')
print('ok', end - start, len(new_fn))
