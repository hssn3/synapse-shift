from pathlib import Path

p = Path('cloudflare/worker.js')
s = p.read_text(encoding='utf-8')

old = """  const next = {
    hour_m: shiftClockHours(clockM) != null ? shiftClockHours(clockM) : num(b.hour_m, cur.hour_m), clock_m: clockM,
    hour_e: shiftClockHours(clockE) != null ? shiftClockHours(clockE) : num(b.hour_e, cur.hour_e), clock_e: clockE,
    hour_n: shiftClockHours(clockN) != null ? shiftClockHours(clockN) : num(b.hour_n, cur.hour_n), clock_n: clockN,
    // مرخصی همیشه معادل شیفت صبح است؛ فیلد جداگانه‌اش دیگر معنا ندارد.
    hour_h: shiftClockHours(clockM) != null ? shiftClockHours(clockM) : num(b.hour_h, cur.hour_h),
  };"""

new = """  // ساعت را می‌شود دستی فرستاد؛ اگر عددی نیامد، از بازهٔ زمانی حساب می‌شود.
  const hasVal = v => v !== undefined && v !== null && String(v).trim() !== '';
  const hourPick = (raw, clockStr, curVal) => {
    if (hasVal(raw)) return num(raw, curVal);
    const h = shiftClockHours(clockStr);
    return h != null ? h : curVal;
  };
  const next = {
    hour_m: hourPick(b.hour_m, clockM, cur.hour_m), clock_m: clockM,
    hour_e: hourPick(b.hour_e, clockE, cur.hour_e), clock_e: clockE,
    hour_n: hourPick(b.hour_n, clockN, cur.hour_n), clock_n: clockN,
    hour_h: hourPick(b.hour_h, null, cur.hour_h),
  };"""

assert old in s, 'settings block not found'
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')
print('worker patched')
