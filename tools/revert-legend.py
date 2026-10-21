import io, re
p = 'public/js/shift-schedule.js'
s = io.open(p, encoding='utf-8').read()

# ۱) برگرداندن راهنما به یک بلوک ساده و بی‌خطر (بدون متغیر)
pat = re.compile(r'<div class="ss-legend">.*?\n      </div>', re.S)
simple = ('<div>M=صبح · E=عصر · N=شب · H=مرخصی استحقاقی · S=استعلاجی · C=کلاس · '
          'ترکیب‌ها: ME (صبح+عصر) · EN (عصر+شب) · MEN (۲۴ ساعته)</div>')
s2, n = pat.subn(simple, s, count=1)
print('legend reverted:', n)

# ۲) دفتر پرستاری بالای فهرست
s2 = s2.replace("    SS.wards.forEach((w, wi) => {\n      const g = groups.find(x => x.test(w.title || '')) || groups[groups.length - 1];\n      g.items.push({ w, wi });\n    });",
"    SS.wards.forEach((w, wi) => {\n      const g = groups.find(x => x.test(w.title || '')) || groups[groups.length - 1];\n      g.items.push({ w, wi });\n    });\n    // دفتر پرستاری همیشه بالای فهرست\n    groups.sort((a, b) => {\n      const A = a.items.some(x => (x.w.title || '').includes('دفتر پرستاری')) ? 0 : 1;\n      const B = b.items.some(x => (x.w.title || '').includes('دفتر پرستاری')) ? 0 : 1;\n      return A - B;\n    });")
io.open(p, 'w', encoding='utf-8', newline='').write(s2)
print('office first:', 'دفتر پرستاری همیشه' in s2)
