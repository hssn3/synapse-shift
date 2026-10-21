import io
s = io.open('public/js/shift-schedule.js', encoding='utf-8').read()
i = s.find('ss-legend-box')
print(s[max(0, i-900):i+200])
