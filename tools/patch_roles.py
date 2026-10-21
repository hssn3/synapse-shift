from pathlib import Path

p = Path('public/js/shift-schedule.js')
src = p.read_text(encoding='utf-8')

old2 = "2: p => /سوپروایزر|سرپرستار|مسئول/.test(p),"
new2 = "2: p => /سوپروایزر/.test(p) && !/سرپرستار/.test(p),"

old4 = "4: p => /پرستار/.test(p) && !/کمک|بهیار/.test(p),"
new4 = "4: p => /پرستار/.test(p) && !/کمک|بهیار|سرپرستار|سوپروایزر/.test(p),"

old5 = "5: p => /پرستار/.test(p) && !/کمک|بهیار/.test(p),"
new5 = "5: p => /پرستار/.test(p) && !/کمک|بهیار|سرپرستار|سوپروایزر/.test(p),"

old6 = "6: p => /پرستار|بهیار|کمک/.test(p),"
new6 = "6: p => /پرستار/.test(p) && !/کمک|بهیار|سرپرستار|سوپروایزر/.test(p),"

for o, n in [(old2, new2), (old4, new4), (old5, new5), (old6, new6)]:
    if o not in src:
        raise SystemExit('not found: ' + o)
    src = src.replace(o, n, 1)

p.write_text(src, encoding='utf-8')
print('role match updated')
