import io, re
p = 'public/js/shift-schedule.js'
s = io.open(p, encoding='utf-8').read()
s2 = re.sub(r'function ssFaDate\(day, month, year\) \{.*?\}', "function ssFaDate(day, month, year) { return String(year) + '/' + ssPad2(month) + '/' + ssPad2(day); }", s, count=1)
s2 = re.sub(r'function ssFaYmd\(day, month, year\) \{.*?\}', "function ssFaYmd(day, month, year) { return String(year) + '/' + ssPad2(month) + '/' + ssPad2(day); }", s2, count=1)
io.open(p, 'w', encoding='utf-8', newline='').write(s2)
print('faDate:', re.search(r'function ssFaDate.*', s2).group(0))
print('faYmd:', re.search(r'function ssFaYmd.*', s2).group(0))
