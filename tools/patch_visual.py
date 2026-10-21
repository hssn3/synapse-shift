from pathlib import Path

# ۱) CSS
css = Path('public/css/app.css')
c = css.read_text(encoding='utf-8')
extra = Path('tools/_wardcss.txt').read_text(encoding='utf-8')
if '.ss-ward-card:focus-visible' not in c:
    c = c + extra
    css.write_text(c, encoding='utf-8')

# ۲) آیکون‌های واقعی در کارت‌ها (فقط نمایش)
p = Path('public/js/shift-schedule.js')
s = p.read_text(encoding='utf-8')

old_icon = """<span class="ss-ward-ico">${e(w.icon || '🏥')}</span>"""
new_icon = """<span class="ss-ward-ico">${I(ssWardIconName(w.title))}</span>"""
assert old_icon in s, 'ward icon anchor'
s = s.replace(old_icon, new_icon, 1)

old_all = """<span class="ss-ward-ico">👥</span>"""
new_all = """<span class="ss-ward-ico">${I('users')}</span>"""
s = s.replace(old_all, new_all, 1)

old_clock = """<span class="ss-ward-ico">⏱️</span>"""
new_clock = """<span class="ss-ward-ico">${I('clock')}</span>"""
s = s.replace(old_clock, new_clock, 1)

old_codes = """<span class="ss-ward-ico">🗂️</span>"""
new_codes = """<span class="ss-ward-ico">${I('docs')}</span>"""
s = s.replace(old_codes, new_codes, 1)

# تابع انتخاب آیکون
fn = """  // آیکون هر کارت بر اساس نام بخش (فقط ظاهر)
  const SS_WARD_ICONS = {
    'دفتر پرستاری': 'clipboard',
    'اورژانس': 'alert',
    'اتاق عمل': 'stethoscope',
    'جراحی': 'scale',
    'CSSD': 'refresh',
    'انبار': 'grid',
    'کلینیک': 'bed',
    'آندوسکوپی': 'eye',
  };
  function ssWardIconName(title) {
    if (SS_WARD_ICONS[title]) return SS_WARD_ICONS[title];
    if (/ICU/i.test(title || '')) return 'heart';
    return 'building';
  }

"""
marker = "  function ssWardGroupsHtml() {"
i = s.index(marker)
s = s[:i] + fn + s[i:]

p.write_text(s, encoding='utf-8')
print('visual patch ok')
