"""تولید SQL ورود رستری کد ۵۵/۹۹ از فایل‌های Word به جدول shift_code_entries."""
import json, io

HOSPITAL = 'dd43b5de-bd17-4245-8dbf-246de3db401d'
YEAR, MONTH = 1405, 8

with io.open('build/code-rosters.json', encoding='utf-8') as f:
    rosters = json.load(f)


def esc(s):
    return s.replace("'", "''")


lines = ['-- رستری کد ۵۵ و ۹۹ — آبان ۱۴۰۵ (استخراج‌شده از فایل‌های Word)',
         '-- safe to re-run: ON CONFLICT DO UPDATE', '']
count = 0
for code in ('55', '99'):
    data = rosters.get(code) or {}
    for shift in ('M', 'E', 'N'):
        for role in ('1', '2', '3', '4', '5', '6'):
            days = (data.get(shift) or {}).get(role) or {}
            for day_s, name in sorted(days.items(), key=lambda kv: int(kv[0])):
                name = (name or '').strip()
                if not name:
                    continue
                day = int(day_s)
                lines.append(
                    "INSERT INTO shift_code_entries (id, hospital_id, code_type, jalali_year, jalali_month, day, shift, role_no, person_name, updated_at) "
                    "VALUES (lower(hex(randomblob(16))), '%s', '%s', %d, %d, %d, '%s', %d, '%s', datetime('now')) "
                    "ON CONFLICT(hospital_id, code_type, jalali_year, jalali_month, day, shift, role_no) "
                    "DO UPDATE SET person_name = excluded.person_name, updated_at = datetime('now');"
                    % (HOSPITAL, code, YEAR, MONTH, day, shift, int(role), esc(name))
                )
                count += 1

with io.open('cloudflare/seed-code-rosters.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines) + '\n')

print('statements:', count)
