from pathlib import Path

# ۱) سرور اصلی: ساعت اعشاری (نیم‌ساعت)
w = Path('cloudflare/worker.js')
s = w.read_text(encoding='utf-8')
old = "  const num = (v, d) => (Number.isFinite(+v) && +v >= 0 && +v <= 24) ? Math.round(+v) : d;"
new = "  const num = (v, d) => (Number.isFinite(+v) && +v >= 0 && +v <= 24) ? (Math.round(+v * 100) / 100) : d;"
assert old in s
s = s.replace(old, new, 1)
w.write_text(s, encoding='utf-8')

# ۲) ساعت گروه پشتیبانی و ترکیب‌ها
h = Path('cloudflare/hours-api.js')
t = h.read_text(encoding='utf-8')
old2 = "    const num = (v, d) => (Number.isFinite(+v) && +v >= 0 && +v <= 24) ? Math.round(+v) : d;"
new2 = "    const num = (v, d) => (Number.isFinite(+v) && +v >= 0 && +v <= 24) ? (Math.round(+v * 100) / 100) : d;"
assert old2 in t
t = t.replace(old2, new2, 1)
old3 = "          : ((Number.isFinite(+rawHour) && +rawHour >= 0 && +rawHour <= 48) ? Math.round(+rawHour) : null),"
new3 = "          : ((Number.isFinite(+rawHour) && +rawHour >= 0 && +rawHour <= 48) ? (Math.round(+rawHour * 100) / 100) : null),"
assert old3 in t
t = t.replace(old3, new3, 1)
h.write_text(t, encoding='utf-8')

# ۳) کلاینت: بدون گردکردن نیم‌ساعت
p = Path('public/js/shift-schedule.js')
c = p.read_text(encoding='utf-8')
old4 = "      if (out && h != null) out.value = String(Math.round(h));"
new4 = "      if (out && h != null) out.value = String(Math.round(h * 100) / 100);"
assert old4 in c
c = c.replace(old4, new4, 1)
p.write_text(c, encoding='utf-8')
print('half-hours ok')
