from pathlib import Path

p = Path('public/js/shift-schedule.js')
s = p.read_text(encoding='utf-8')

# ۱) چیدمان: دفتر پرستاری راست‌ترین، کنارش فرم‌های کد ۹۹/۵۵
old_layout = "    { label: 'مدیریت پرستاری و بحران', items: ['فرم‌های کد ۹۹ و ۵۵', 'دفتر پرستاری', 'همه پرسنل', 'ساعت شیفت'] },"
new_layout = "    { label: 'مدیریت پرستاری و بحران', items: ['دفتر پرستاری', 'فرم‌های کد ۹۹ و ۵۵'] },"
assert old_layout in s, 'layout anchor'
s = s.replace(old_layout, new_layout, 1)

# ۲) تب‌های داخل کارت دفتر پرستاری: همه پرسنل + ساعت شیفت
old_tabs = """          ${ssHasCrisis() ? `<button class="ss-view-tab ${SS.tab === 'crisis' ? 'active' : ''}" onclick="ssSelectTab('crisis')">${I('shield')} برنامهٔ بحران</button>` : ''}"""
new_tabs = """          ${ssHasCrisis() ? `<button class="ss-view-tab ${SS.tab === 'crisis' ? 'active' : ''}" onclick="ssSelectTab('crisis')">${I('shield')} برنامهٔ بحران</button>` : ''}
          ${(SS.isManager && SS.wardTitle === 'دفتر پرستاری') ? `<button class="ss-view-tab ${SS.tab === 'allstaff' ? 'active' : ''}" onclick="ssOpenAllStaff()">${I('users')} همه پرسنل</button>
          <button class="ss-view-tab ${SS.tab === 'hours' ? 'active' : ''}" onclick="ssOpenHours()">${I('clock')} ساعت شیفت</button>` : ''}"""
assert old_tabs in s, 'tabs anchor'
s = s.replace(old_tabs, new_tabs, 1)

p.write_text(s, encoding='utf-8')
print('layout v2 ok')
