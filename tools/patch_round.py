from pathlib import Path

p = Path('public/js/shift-schedule.js')
s = p.read_text(encoding='utf-8')

old = "      if (out && h != null) out.value = String(h);"
new = "      if (out && h != null) out.value = String(Math.round(h));"
assert old in s, 'auto hours anchor'
s = s.replace(old, new, 1)

old2 = """      const v = parseInt(String(el.value).replace(/[۰-۹]/g, ch => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(ch))), 10);
      return Number.isFinite(v) ? v : 0;"""
new2 = """      const v = parseFloat(String(el.value).replace(/[۰-۹]/g, ch => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(ch))));
      return Number.isFinite(v) ? v : 0;"""
assert old2 in s, 'sum parse anchor'
s = s.replace(old2, new2, 1)

p.write_text(s, encoding='utf-8')
print('rounding patched')
