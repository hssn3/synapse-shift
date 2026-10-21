import io
p = 'public/js/shift-schedule.js'
s = io.open(p, encoding='utf-8').read()
start = s.find('<div>M=صبح')
if start < 0:
    start = s.find('M=صبح')
    start = s.rfind('<div>', 0, start)
end = s.find('</div>', start) + len('</div>')
print('span', end - start)
new = ('<div class="ss-legend">\n'
       '        <div class="ss-legend-box"><div class="ss-legend-title">ساعت شیفت‌ها</div><table>\n'
       '          <tr><th>M — صبح</th><td>${F(st.hour_m)} ساعت · ${e(st.clock_m)}</td></tr>\n'
       '          <tr><th>E — عصر</th><td>${F(st.hour_e)} ساعت · ${e(st.clock_e)}</td></tr>\n'
       '          <tr><th>N — شب</th><td>${F(st.hour_n)} ساعت · ${e(st.clock_n)}</td></tr></table></div>\n'
       '        <div class="ss-legend-box"><div class="ss-legend-title">مرخصی و کلاس</div><table>\n'
       '          <tr><th>H</th><td>مرخصی استحقاقی · ${F(st.hour_h)} ساعت</td></tr>\n'
       '          <tr><th>S</th><td>مرخصی استعلاجی</td></tr>\n'
       '          <tr><th>C</th><td>کلاس آموزشی</td></tr></table></div>\n'
       '        <div class="ss-legend-box"><div class="ss-legend-title">ترکیب‌های رایج</div><table>\n'
       '          <tr><th>ME</th><td>صبح + عصر (لانگ)</td></tr>\n'
       '          <tr><th>EN</th><td>عصر + شب</td></tr>\n'
       '          <tr><th>MEN</th><td>۲۴ ساعته</td></tr></table></div>\n'
       '      </div>')
s = s[:start] + new + s[end:]
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('patched', s.count('ss-legend-box'))
