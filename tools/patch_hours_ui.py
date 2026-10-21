from pathlib import Path

p = Path('public/js/shift-schedule.js')
s = p.read_text(encoding='utf-8')

btn = """          ${SS.isManager ? `<button class="btn btn-o btn-sm" onclick="ssToggleSettings()">${I('settings')} ساعتِ شیفت</button>` : ''}\n"""
n = s.count(btn)
s = s.replace(btn, "")

# افزودن شاخهٔ تب ساعت در ssDraw
old_render = "    ${SS.tab === 'allstaff' ? ssAllStaffHtml() : (SS.tab === 'staff' ? ssStaffHtml() : (SS.tab === 'crisis' ? ssCrisisHtml() : (SS.tab === 'codes' ? ssCodesHtml() : ssGridHtml())))}"
new_render = "    ${SS.tab === 'hours' ? ssHoursHtml() : (SS.tab === 'allstaff' ? ssAllStaffHtml() : (SS.tab === 'staff' ? ssStaffHtml() : (SS.tab === 'crisis' ? ssCrisisHtml() : (SS.tab === 'codes' ? ssCodesHtml() : ssGridHtml()))))}"
assert old_render in s, 'render anchor'
s = s.replace(old_render, new_render, 1)

# کارت «ساعت شیفت» در گروه مدیر پرستاری
old_card = """          <button type="button" class="ss-ward-card ${SS.tab === 'allstaff' ? 'active' : ''}" onclick="ssOpenAllStaff()" title="همهٔ پرسنل همهٔ بخش‌ها">
            <span class="ss-ward-ico">👥</span><span class="ss-ward-name">همه پرسنل</span>
          </button>"""
new_card = """          <button type="button" class="ss-ward-card ${SS.tab === 'allstaff' ? 'active' : ''}" onclick="ssOpenAllStaff()" title="همهٔ پرسنل همهٔ بخش‌ها">
            <span class="ss-ward-ico">👥</span><span class="ss-ward-name">همه پرسنل</span>
          </button>
          <button type="button" class="ss-ward-card ${SS.tab === 'hours' ? 'active' : ''}" onclick="ssOpenHours()" title="ساعت شیفت بخش‌ها (فقط مدیر پرستاری)">
            <span class="ss-ward-ico">⏱️</span><span class="ss-ward-name">ساعت شیفت</span>
          </button>"""
assert old_card in s, 'card anchor'
s = s.replace(old_card, new_card, 1)

p.write_text(s, encoding='utf-8')
print('buttons removed:', n)
