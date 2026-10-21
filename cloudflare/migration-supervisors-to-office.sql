-- =====================================================================
-- افزودن سوپروایزرهای فرم‌های کد ۹۹/۵۵ به برنامهٔ «دفتر پرستاری»
-- نام‌ها همان‌هایی است که در shift_code_entries با نقش «سوپروایزر» ثبت شده
-- (حروف عربی ي/ك به فارسی ی/ک تبدیل شده). تکراری اضافه نمی‌شود.
-- =====================================================================

INSERT INTO ward_staff (id, hospital_id, ward, first_name, last_name, gender, position, monthly_hour_quota, is_active, sort_order)
SELECT 'e1' || substr(hex(randomblob(15)), 1, 30), w.hospital_id, 'دفتر پرستاری', 'آ.', 'گودرزی', 'زن', 'سوپروایزر', w.monthly_hour_quota, 1, 91
FROM ward_staff w
WHERE w.ward = 'دفتر پرستاری'
  AND NOT EXISTS (SELECT 1 FROM ward_staff x WHERE x.ward = 'دفتر پرستاری' AND x.last_name = 'گودرزی')
LIMIT 1;

INSERT INTO ward_staff (id, hospital_id, ward, first_name, last_name, gender, position, monthly_hour_quota, is_active, sort_order)
SELECT 'e2' || substr(hex(randomblob(15)), 1, 30), w.hospital_id, 'دفتر پرستاری', 'خ.', 'بختیاری', 'زن', 'سوپروایزر', w.monthly_hour_quota, 1, 92
FROM ward_staff w
WHERE w.ward = 'دفتر پرستاری'
  AND NOT EXISTS (SELECT 1 FROM ward_staff x WHERE x.ward = 'دفتر پرستاری' AND x.last_name = 'بختیاری')
LIMIT 1;

INSERT INTO ward_staff (id, hospital_id, ward, first_name, last_name, gender, position, monthly_hour_quota, is_active, sort_order)
SELECT 'e3' || substr(hex(randomblob(15)), 1, 30), w.hospital_id, 'دفتر پرستاری', 'خ.', 'جهانگیری', 'زن', 'سوپروایزر', w.monthly_hour_quota, 1, 93
FROM ward_staff w
WHERE w.ward = 'دفتر پرستاری'
  AND NOT EXISTS (SELECT 1 FROM ward_staff x WHERE x.ward = 'دفتر پرستاری' AND x.last_name = 'جهانگیری')
LIMIT 1;

INSERT INTO ward_staff (id, hospital_id, ward, first_name, last_name, gender, position, monthly_hour_quota, is_active, sort_order)
SELECT 'e4' || substr(hex(randomblob(15)), 1, 30), w.hospital_id, 'دفتر پرستاری', 'خ.', 'ساعدی', 'زن', 'سوپروایزر', w.monthly_hour_quota, 1, 94
FROM ward_staff w
WHERE w.ward = 'دفتر پرستاری'
  AND NOT EXISTS (SELECT 1 FROM ward_staff x WHERE x.ward = 'دفتر پرستاری' AND x.last_name = 'ساعدی')
LIMIT 1;

INSERT INTO ward_staff (id, hospital_id, ward, first_name, last_name, gender, position, monthly_hour_quota, is_active, sort_order)
SELECT 'e5' || substr(hex(randomblob(15)), 1, 30), w.hospital_id, 'دفتر پرستاری', 'خ.', 'قلعه‌ای', 'زن', 'سوپروایزر', w.monthly_hour_quota, 1, 95
FROM ward_staff w
WHERE w.ward = 'دفتر پرستاری'
  AND NOT EXISTS (SELECT 1 FROM ward_staff x WHERE x.ward = 'دفتر پرستاری' AND x.last_name = 'قلعه‌ای')
LIMIT 1;
