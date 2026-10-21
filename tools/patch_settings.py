from pathlib import Path

p = Path('public/js/shift-schedule.js')
s = p.read_text(encoding='utf-8')
new_settings = Path('tools/_settings.txt').read_text(encoding='utf-8')

# 1) جایگزینی ssAutoHours + ssSettingsHtml
start = s.index('  global.ssAutoHours = function () {')
end = s.index('  global.ssToggleSettings = function () {')
s = s[:start] + new_settings + '\n' + s[end:]

# 2) ذخیرهٔ ساعت: H جدا و ward از تب ساعت
old_save = """      const r = await API.shiftSetSettings({
        ward: SS.wardTitle,
        hour_m: document.getElementById('ss_hm').value, clock_m: document.getElementById('ss_cm').value,
        hour_e: document.getElementById('ss_he').value, clock_e: document.getElementById('ss_ce').value,
        hour_n: document.getElementById('ss_hn').value, clock_n: document.getElementById('ss_cn').value,
        hour_h: document.getElementById('ss_hm').value,
      });
      SS.settings = r.settings;
      if (typeof toast === 'function') toast('ساعتِ شیفت ذخیره شد');
      await ssLoadAll();"""
new_save = """      const ward = (SS.tab === 'hours') ? (SS.hoursWard || SS.wardTitle) : SS.wardTitle;
      const r = await API.shiftSetSettings({
        ward: ward,
        hour_m: document.getElementById('ss_hm').value, clock_m: document.getElementById('ss_cm').value,
        hour_e: document.getElementById('ss_he').value, clock_e: document.getElementById('ss_ce').value,
        hour_n: document.getElementById('ss_hn').value, clock_n: document.getElementById('ss_cn').value,
        hour_h: (document.getElementById('ss_hh') || {}).value,
      });
      SS.settings = r.settings;
      if (typeof toast === 'function') toast('ساعتِ شیفت ذخیره شد');
      if (SS.tab === 'hours') { SS.hoursWard = ward; ssDraw(); }
      else await ssLoadAll();"""
assert old_save in s, 'save anchor'
s = s.replace(old_save, new_save, 1)

p.write_text(s, encoding='utf-8')
print('settings patched')
