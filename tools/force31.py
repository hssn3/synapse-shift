import io
p = 'public/js/shift-schedule.js'
s = io.open(p, encoding='utf-8').read()
anchor = "    SS.sched = schedRes;"
if anchor in s and 'روز ۳۱' not in s:
    add = anchor + "\n    // تعداد روزها از تقویم جلالی (ماه ۳۱ روزه ستون ۳۱ را هم می‌سازد، حتی خالی)\n    if (SS.sched && SS.sched.schedule) SS.sched.schedule.days = ssJalaliDays(SS.year, SS.month);"
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8', newline='').write(s)
    print('patched')
else:
    print('anchor missing or already patched')
