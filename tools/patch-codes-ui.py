import io

path = 'public/js/shift-schedule.js'
with io.open(path, encoding='utf-8') as f:
    src = f.read()

start_marker = '  function ssCodesHtml() {\n'
end_marker = '  function ssOpenPrintWindow(html) {'

i = src.index(start_marker)
j = src.index(end_marker)
new_block = io.open('build/ss-codes-html-block.js', encoding='utf-8').read()
if not new_block.endswith('\n'):
    new_block += '\n'
out = src[:i] + new_block + src[j:]

with io.open(path, 'w', encoding='utf-8', newline='') as f:
    f.write(out)

print('replaced', j - i, 'chars with', len(new_block))
