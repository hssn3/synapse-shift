-- =====================================================================
-- ادغام بخش‌های زیرمجموعه در بخش اصلی (دادهٔ D1)
-- ---------------------------------------------------------------------
-- اورژانس ← کمک اورژانس
-- جراحی  ← کمک جراحی
-- اتاق عمل ← کارشناسان اتاق عمل + کارشناسان بیهوشی + کمک اتاق عمل + منشی اتاق عمل
-- ICU 1 ← کمک ICU ، و همان نفرات یک نسخه هم در ICU 2 (خواستهٔ کارفرما: در هر دو)
-- کارت‌های بخش‌های زیرمجموعه حذف می‌شوند تا فقط یک کارت بماند.
-- =====================================================================

-- ۱) بخش «اتاق عمل» به‌عنوان یک بخش واحد
INSERT INTO nursing_wards (id, hospital_id, title, icon, sort_order, bed_count)
SELECT 'b0000000-0000-4000-8000-0000000a0001', hospital_id, 'اتاق عمل', '🏥', 2, 0
FROM nursing_wards LIMIT 1;

-- ۲) انتقال پرسنل زیرمجموعه‌ها به بخش اصلی
UPDATE ward_staff SET ward = 'اتاق عمل'
WHERE ward IN ('کارشناسان اتاق عمل', 'کارشناسان بیهوشی', 'کمک اتاق عمل', 'منشی اتاق عمل');

UPDATE ward_staff SET ward = 'اورژانس' WHERE ward = 'کمک اورژانس';
UPDATE ward_staff SET ward = 'جراحی'  WHERE ward = 'کمک جراحی';
UPDATE ward_staff SET ward = 'ICU 1'  WHERE ward = 'کمک ICU';

-- ۳) یک نسخه از کمک‌بهیاران ICU در ICU 2
INSERT INTO ward_staff (id, hospital_id, ward, first_name, last_name, gender, personnel_code, position,
                        monthly_hour_quota, years_experience, fixed_shift, employment_status, sort_order, is_active)
SELECT 'd1' || substr(hex(randomblob(15)), 1, 30), hospital_id, 'ICU 2', first_name, last_name, gender, NULL, position,
       monthly_hour_quota, years_experience, fixed_shift, employment_status, sort_order, is_active
FROM ward_staff
WHERE ward = 'ICU 1' AND COALESCE(position, '') LIKE '%کمک%';

-- ۴) حذف کارت بخش‌های زیرمجموعه
DELETE FROM nursing_wards
WHERE title IN ('کمک اورژانس', 'کمک جراحی', 'کمک ICU',
                'کارشناسان اتاق عمل', 'کارشناسان بیهوشی', 'کمک اتاق عمل', 'منشی اتاق عمل');
