-- =====================================================================
-- مهاجرت D1: فرم‌های کد ۵۵ / ۹۹ (فقط مدیر پرستاری)
-- ---------------------------------------------------------------------
-- بی‌خطر برای اجرای دوباره: CREATE ... IF NOT EXISTS.
-- هیچ جدول موجودی تغییر نمی‌کند و هیچ داده‌ای پاک نمی‌شود.
--
--   npx wrangler d1 execute synapse-shift --remote --file=cloudflare/migration-shift-codes.sql
-- =====================================================================

CREATE TABLE IF NOT EXISTS shift_code_entries (
  id TEXT PRIMARY KEY,
  hospital_id TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  code_type TEXT NOT NULL,
  jalali_year INTEGER NOT NULL,
  jalali_month INTEGER NOT NULL,
  day INTEGER NOT NULL,
  shift TEXT NOT NULL,
  role_no INTEGER NOT NULL,
  person_name TEXT NOT NULL DEFAULT '',
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_code_entry_uniq
  ON shift_code_entries(hospital_id, code_type, jalali_year, jalali_month, day, shift, role_no);

-- تنظیمات هر فرم (سربرگ، کد فرم، پاورقی، امضاها، سطوح بیماران) — قابل ویرایش از رابط
CREATE TABLE IF NOT EXISTS shift_code_meta (
  hospital_id TEXT NOT NULL,
  code_type TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (hospital_id, code_type)
);
