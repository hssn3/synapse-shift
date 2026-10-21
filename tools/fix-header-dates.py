import io, re
p = 'public/js/shift-schedule.js'
src = io.open(p, encoding='utf-8').read()
new = ('<div class="sub">ماه: <b>${e(monthLabel)}</b></div>\n'
       '            <div class="sub">از تاریخ <span class="cd-date" dir="ltr">${ssFaDate(from, month, year)}</span>'
       ' تا تاریخ <span class="cd-date" dir="ltr">${ssFaDate(to, month, year)}</span></div>')
pat = re.compile(r'<div class="sub">ماه:.*?</div>', re.S)
out, n = pat.subn(new, src, count=1)
io.open(p, 'w', encoding='utf-8', newline='').write(out)
print('replaced:', n)
print('cd-date count:', out.count('cd-date'))
