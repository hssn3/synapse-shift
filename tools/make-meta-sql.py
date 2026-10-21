"""تولید SQL تنظیمات پیش‌فرض سه فرم (سربرگ/پاورقی/امضا) برای SQLite و D1."""
import json, io

HOSPITAL = 'dd43b5de-bd17-4245-8dbf-246de3db401d'

ROLE_TEXT = ('شرح وظايف اعضاء: ۱- مسئول هماهنگي تيم، ۲- ناظر تيم، ۳- مسئول باز نگه‌داشتن راه هوايي، '
             '۴- برقراري تنفس، ۵- مسئول برقراري گردش خون و ماساژ قلب، ۶- مسئول دارويي')

meta = {
    '99': {
        'title': 'برنامه کد احیاء قلبی تنفسی (کد ۹۹)',
        'form_code': 'MFH-MN-FR-00/22',
        'note': '',
        'footer_note': ROLE_TEXT,
        'signs': [
            {'label': 'سوپروایزر آموزشی', 'name': 'فرشته ساعدی'},
            {'label': 'مدیریت پرستاری', 'name': 'سلیمه احتسابی'},
            {'label': 'ریاست بیمارستان', 'name': 'دکتر فرزاد سالاری'},
        ],
    },
    '55': {
        'title': 'برنامه کد احیاء مامایی (کد ۵۵)',
        'form_code': 'MFH-MN-FR-00/22',
        'note': 'در صورت نیاز با آنکال زنان تماس گرفته شود',
        'footer_note': ROLE_TEXT,
        'signs': [
            {'label': 'سوپروایزر آموزشی', 'name': 'فرشته ساعدی'},
            {'label': 'مدیریت پرستاری', 'name': 'سلیمه احتسابی'},
            {'label': 'ریاست بیمارستان', 'name': 'دکتر فرزاد سالاری'},
        ],
    },
    'crisis': {
        'title': 'برنامه درمانی ماهانه بخش اورژانس بحران',
        'form_code': 'MFH-HM-FR-00/17',
        'beds': 4,
        'method': 'Case Method',
        'contract_hours': 158,
        'level_avg': [50, 120, 550, 90, None],
        'level_hours': [4, 6, 5, 5, None],
        'training_title': 'افراد معرفی شده به کلاس‌های آموزشی:',
        'footer_note': '',
        'signs': [
            {'label': 'نام و نام خانوادگی سرپرستار اورژانس', 'name': 'مریم بهنامی نژاد'},
            {'label': 'نام و نام خانوادگی سوپروایزر بالینی', 'name': 'سودابه جهانگیری'},
            {'label': 'مدیریت پرستاری بیمارستان', 'name': 'سلیمه احتسابی'},
            {'label': 'ریاست بیمارستان', 'name': 'دکتر فرزاد سالاری'},
        ],
    },
}

lines = ['-- تنظیمات پیش‌فرض سربرگ/پاورقی فرم‌ها (re-runnable: فقط اگر خالی باشد پر می‌کند)', '']
for code, payload in meta.items():
    js = json.dumps(payload, ensure_ascii=False).replace("'", "''")
    lines.append(
        "INSERT INTO shift_code_meta (hospital_id, code_type, payload, updated_at) "
        "VALUES ('%s', '%s', '%s', datetime('now')) "
        "ON CONFLICT(hospital_id, code_type) DO NOTHING;" % (HOSPITAL, code, js))

with io.open('cloudflare/seed-code-meta.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines) + '\n')
print('written, codes:', ', '.join(meta))
