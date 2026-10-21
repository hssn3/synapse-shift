from pathlib import Path

p = Path('public/js/shift-schedule.js')
s = p.read_text(encoding='utf-8')

# 1) رندر تب «همه پرسنل» در ssDraw
old_render = "    ${SS.tab === 'staff' ? ssStaffHtml() : (SS.tab === 'crisis' ? ssCrisisHtml() : (SS.tab === 'codes' ? ssCodesHtml() : ssGridHtml()))}"
new_render = "    ${SS.tab === 'allstaff' ? ssAllStaffHtml() : (SS.tab === 'staff' ? ssStaffHtml() : (SS.tab === 'crisis' ? ssCrisisHtml() : (SS.tab === 'codes' ? ssCodesHtml() : ssGridHtml())))}"
assert old_render in s, 'render anchor'
s = s.replace(old_render, new_render, 1)

# 2) کارت «همه پرسنل» کنار کارت گروه بحران
old_card = """      ${SS.isManager ? `<div class="ss-ward-group">
        <div class="ss-ward-group-title"><span>گروه بحران</span><span class="ss-ward-count">۱</span><i></i></div>"""
new_card = """      ${SS.isManager ? `<div class="ss-ward-group">
        <div class="ss-ward-group-title"><span>مدیر پرستاری</span><span class="ss-ward-count">۲</span><i></i></div>
        <div class="ss-ward-grid">
          <button type="button" class="ss-ward-card ${SS.tab === 'allstaff' ? 'active' : ''}" onclick="ssOpenAllStaff()" title="همهٔ پرسنل همهٔ بخش‌ها">
            <span class="ss-ward-ico">👥</span><span class="ss-ward-name">همه پرسنل</span>
          </button>
        </div>
      </div><div class="ss-ward-group">
        <div class="ss-ward-group-title"><span>گروه بحران</span><span class="ss-ward-count">۱</span><i></i></div>"""
assert old_card in s, 'card anchor'
s = s.replace(old_card, new_card, 1)

p.write_text(s, encoding='utf-8')
print('draw patched')
