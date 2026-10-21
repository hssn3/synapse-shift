from pathlib import Path

p = Path('public/js/shift-schedule.js')
s = p.read_text(encoding='utf-8')
fn = Path('tools/_wardlayout.txt').read_text(encoding='utf-8')

start = s.index('  function ssWardGroupsHtml() {')
end = s.index('  // بخش‌هایی که برنامهٔ بحران ندارند')
s = s[:start] + fn + s[end:]

# تب پیش‌فرض: هیچ تبی باز نباشد
old_tab = "dragStaffId: null, crisis: null };"
new_tab = "dragStaffId: null, crisis: null, allStaff: null, hoursWard: null };"
assert old_tab in s, 'state anchor'
s = s.replace(old_tab, new_tab, 1)

old_tab2 = "wardTitle: null, wardId: null, wardBedCount: null, tab: 'staff', year: null, month: null,"
new_tab2 = "wardTitle: null, wardId: null, wardBedCount: null, tab: null, year: null, month: null,"
assert old_tab2 in s, 'tab anchor'
s = s.replace(old_tab2, new_tab2, 1)

# محتوای تب: اگر تبی باز نبود، هیچ چیز رندر نشود
old_render = "    ${SS.tab === 'hours' ? ssHoursHtml() : (SS.tab === 'allstaff' ? ssAllStaffHtml() : (SS.tab === 'staff' ? ssStaffHtml() : (SS.tab === 'crisis' ? ssCrisisHtml() : (SS.tab === 'codes' ? ssCodesHtml() : ssGridHtml()))))}"
new_render = "    ${SS.tab === null ? '' : (SS.tab === 'hours' ? ssHoursHtml() : (SS.tab === 'allstaff' ? ssAllStaffHtml() : (SS.tab === 'staff' ? ssStaffHtml() : (SS.tab === 'crisis' ? ssCrisisHtml() : (SS.tab === 'codes' ? ssCodesHtml() : ssGridHtml())))))}"
assert old_render in s, 'render anchor'
s = s.replace(old_render, new_render, 1)

# تعویض بخش: اگر تبی باز نبود، همان‌طور بسته بماند
old_reset = """  function ssResetViewOnWardChange() {
    SS.tab = 'grid';
    SS.showDoctors = false;
    SS.codes = null;
  }"""
new_reset = """  function ssResetViewOnWardChange() {
    if (SS.tab === 'crisis' || SS.tab === 'codes' || SS.tab === 'hours' || SS.tab === 'allstaff') SS.tab = 'grid';
    SS.showDoctors = false;
    SS.codes = null;
  }"""
assert old_reset in s, 'reset anchor'
s = s.replace(old_reset, new_reset, 1)

p.write_text(s, encoding='utf-8')
print('layout patched')
