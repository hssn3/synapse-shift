import io, re
p = 'public/js/shift-schedule.js'
s = io.open(p, encoding='utf-8').read()

# ۱) پاک‌سازی کامنت خراب‌شده در ابتدای فایل
start = s.find('<div class="ss-legend">')
if start != -1 and start < 1200:
    # از ابتدای خط تا انتهای بلوک تزریق‌شده
    line_start = s.rfind('\n', 0, start) + 1
    end = s.find('</div>', s.find('MEN', start))
    end = s.find('\n', end) + 1 if end != -1 else line_start
    s = s[:line_start] + '   پرسنل، گرید ماهانه، اضافه‌کار و چاپ A4 افقی.\n' + s[end:]
    print('comment cleaned')

# ۲) تغییر نام تب
s = s.replace('فرم‌های کد</button>', 'گروه بحران</button>')
s = s.replace('>فرم‌های کد<', '>گروه بحران<')
s = s.replace("'فرم‌های کد'", "'گروه بحران'")
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('tab renamed:', s.count('گروه بحران'))
