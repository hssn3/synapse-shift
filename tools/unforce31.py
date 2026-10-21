import io
p = 'public/js/shift-schedule.js'
s = io.open(p, encoding='utf-8').read()
bad = "\n    // تعداد روزها از تقویم جلالی (ماه ۳۱ روزه ستون ۳۱ را هم می‌سازد، حتی خالی)\n    if (SS.sched && SS.sched.schedule) SS.sched.schedule.days = ssJalaliDays(SS.year, SS.month);"
if bad in s:
    s = s.replace(bad, "", 1)
    io.open(p, 'w', encoding='utf-8', newline='').write(s)
    print('forced-days line removed')
else:
    print('line not found')
