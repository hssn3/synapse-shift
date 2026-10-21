import io, re
p = 'public/js/shift-schedule.js'
s = io.open(p, encoding='utf-8').read()
old = "    if (jm <= 6) return 31;\n    if (jm <= 11) return 30;\n    return ssIsLeapJalali(jy) ? 30 : 29;"
new = "    if (jm <= 6) return 31;\n    if (jm === 7) return 30;\n    if (jm <= 11) return 31;   // به درخواست کارفرما: آبان تا بهمن ۳۱ روز\n    return ssIsLeapJalali(jy) ? 30 : 29;"
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8', newline='').write(s)
    print('days rule patched')
else:
    print('pattern not found')
