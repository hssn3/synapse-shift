-- =====================================================================
-- مهاجرت D1: فهرست پزشکان (جدا از پرسنل بخش‌ها) + خانم احتسابی
-- ---------------------------------------------------------------------
-- بی‌خطر برای اجرای دوباره: CREATE ... IF NOT EXISTS و INSERT ... WHERE NOT EXISTS.
-- هیچ داده‌ای پاک یا بازنویسی نمی‌شود.
--
--   npx wrangler d1 execute synapse-shift --remote --file=cloudflare/migration-doctors.sql
-- =====================================================================

-- پزشکان بیمارستان، مستقل از بخش‌ها. فرم‌های کد ۵۵/۹۹ از همین فهرست پیشنهاد می‌دهند
-- و هر نامی که دستی در خانه‌ها نوشته شود، خودکار به همین جدول اضافه می‌شود.
CREATE TABLE IF NOT EXISTS hospital_doctors (
  id TEXT PRIMARY KEY,
  hospital_id TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  specialty TEXT NOT NULL DEFAULT 'پزشک طب اورژانس',
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hospital_doctors_name
  ON hospital_doctors(hospital_id, full_name);

-- پزشکانی که تا امروز فقط داخل خانه‌های فرم کد ۹۹/۵۵ تایپ شده بودند.
INSERT OR IGNORE INTO hospital_doctors (id, hospital_id, full_name, specialty, sort_order)
SELECT lower(hex(randomblob(16))), e.hospital_id, e.person_name, 'پزشک طب اورژانس', 100
  FROM shift_code_entries e
 WHERE e.role_no = 1 AND TRIM(IFNULL(e.person_name, '')) <> '';

-- خانم سلیمه احتسابی — مدیر پرستاری — ردیف اول فهرست پرسنل «دفتر پرستاری».
INSERT INTO ward_staff
  (id, hospital_id, ward, first_name, last_name, gender, personnel_code, position,
   employment_status, fixed_shift, years_experience, monthly_hour_quota, sort_order, is_active, extra_info, created_at)
SELECT lower(hex(randomblob(16))), h.id, 'دفتر پرستاری', 'سلیمه', 'احتسابی', 'زن', '', 'مدیر پرستاری',
       'قراردادی', '', 30, 169, 0, 1, '{}', datetime('now')
  FROM hospitals h
 WHERE NOT EXISTS (
       SELECT 1 FROM ward_staff s
        WHERE s.hospital_id = h.id AND s.ward = 'دفتر پرستاری' AND s.last_name = 'احتسابی'
 );
