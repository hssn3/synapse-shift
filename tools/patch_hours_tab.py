from pathlib import Path

p = Path('public/js/shift-schedule.js')
s = p.read_text(encoding='utf-8')

# دکمهٔ بستن جعبهٔ ساعت فقط در تب برنامهٔ شیفت
old_x = """        <button type="button" class="ss-box-close" aria-label="بستن" title="بستن" onclick="ssToggleSettings()">×</button>"""
new_x = """        ${SS.tab === 'hours' ? '' : `<button type="button" class="ss-box-close" aria-label="بستن" title="بستن" onclick="ssToggleSettings()">×</button>`}"""
assert old_x in s, 'close anchor'
s = s.replace(old_x, new_x, 1)

fn = """  /* ---------------- تب «ساعت شیفت» (فقط مدیر پرستاری) ---------------- */
  global.ssOpenHours = async function () {
    if (!SS.isManager) return;
    SS.tab = 'hours';
    SS.hoursWard = SS.hoursWard || SS.wardTitle;
    try { const r = await API.shiftGetSettings(SS.hoursWard); SS.settings = r.settings; } catch (e) { /* پیش‌فرض */ }
    ssDraw();
  };
  global.ssHoursWardChange = async function (w) {
    SS.hoursWard = w;
    try { const r = await API.shiftGetSettings(w); SS.settings = r.settings; } catch (e) { /* پیش‌فرض */ }
    ssDraw();
  };
  function ssHoursHtml() {
    const wards = SS.wards || [];
    const cur = SS.hoursWard || SS.wardTitle;
    return `<div class="panel g noprint">
      <div class="phd">${I('clock', 'lg')}<div style="flex:1"><h3>ساعت شیفت بخش‌ها</h3>
        <div class="sub">فقط مدیر پرستاری — برای هر بخش جداگانه. بازه را عوض کنی ساعت خودکار می‌آید؛ عدد را دستی هم می‌توانی بزنی.</div></div></div>
      <div class="pbody" style="padding-top:0">
        <div class="fg" style="max-width:320px;margin-bottom:12px"><label>بخش</label>
          <select onchange="ssHoursWardChange(this.value)">
            ${wards.map(w => `<option value="${e(w.title)}"${w.title === cur ? ' selected' : ''}>${e(w.title)}</option>`).join('')}
          </select></div>
        ${ssSettingsHtml()}
      </div>
    </div>`;
  }

"""

marker = "  /* ---------------- کارت «همه پرسنل» (مدیر پرستاری) ---------------- */"
i = s.index(marker)
s = s[:i] + fn + s[i:]
p.write_text(s, encoding='utf-8')
print('hours tab added')
