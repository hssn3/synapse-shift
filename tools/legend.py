import io, re
p = 'public/js/shift-schedule.js'
s = io.open(p, encoding='utf-8').read()
i = s.find('M=صبح')
print('found at', i)
if i > 0:
    ls = s.rfind('\n', 0, i) + 1
    le = s.find('\n', i)
    line = s[ls:le]
    print('line len', len(line))
    new = ('<div class="ss-legend">\n'
           '        <div class="ss-legend-box"><div class="ss-legend-title">ساعت شیفت‌ها</div>\n'
           '          <table><tr><th>M — صبح</th><td>${F(SS.settings && SS.settings.hour_m)} ساعت · ${e(SS.settings && SS.settings.clock_m || "")}</td></tr>\n'
           '          <tr><th>E — عصر</th><td>${F(SS.settings && SS.settings.hour_e)} ساعت · ${e(SS.settings && SS.settings.clock_e || "")}</td></tr>\n'
           '          <tr><th>N — شب</th><td>${F(SS.settings && SS.settings.hour_n)} ساعت · ${e(SS.settings && SS.settings.clock_n || "")}</td></tr></table>\n'
           '        </div>\n'
           '        <div class="ss-legend-box"><div class="ss-legend-title">مرخصی و کلاس</div>\n'
           '          <table><tr><th>H — مرخصی</th><td>${F(SS.settings && SS.settings.hour_h)} ساعت · معادل شیفت صبح</td></tr>\n'
           '          <tr><th>S — استعلاجی</th><td>مرخصی استعلاجی</td></tr>\n'
           '          <tr><th>C — کلاس</th><td>کلاس آموزشی</td></tr></table>\n'
           '        </div>\n'
           '        <div class="ss-legend-box"><div class="ss-legend-title">ترکیب‌های رایج</div>\n'
           '          <table><tr><th>ME</th><td>صبح + عصر (لانگ)</td></tr>\n'
           '          <tr><th>EN</th><td>عصر + شب</td></tr>\n'
           '          <tr><th>MEN</th><td>۲۴ ساعته</td></tr></table>\n'
           '        </div>\n'
           '      </div>')
    s = s[:ls] + new + s[le:]
    io.open(p, 'w', encoding='utf-8', newline='').write(s)
    print('patched')
