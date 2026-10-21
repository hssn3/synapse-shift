import io, re
p = 'public/js/shift-schedule.js'
s = io.open(p, encoding='utf-8').read()
lines = s.split('\n')
print('LINE 547:', lines[546][:300])
# ایمن‌سازی دسترسی به شمارش روزها (روز ۳۱ ممکن است در داده نباشد)
s2 = s.replace('hc[d][r.k]', '((hc[d] || {})[r.k] || 0)')
s2 = s2.replace('hc[d][k]', '((hc[d] || {})[k] || 0)')
io.open(p, 'w', encoding='utf-8', newline='').write(s2)
print('guards:', s2.count('(hc[d] || {})'))
