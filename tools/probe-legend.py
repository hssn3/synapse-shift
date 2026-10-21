import io, re
p = 'public/js/shift-schedule.js'
s = io.open(p, encoding='utf-8').read()
for m in re.finditer('M=صبح', s):
    i = m.start()
    print('---', i)
    print(s[max(0, i-260):i+120].replace('\n', ' ⏎ ')[:420])
print('total', s.count('M=صبح'))
