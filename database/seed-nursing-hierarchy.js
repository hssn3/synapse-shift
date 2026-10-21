/**
 * Migration + Seed: زیرساختار سازمانی حوزه‌ی پرستاری (زیر کارت «پرستاری» در org_divisions)
 *
 * سه جدول سبک، idempotent، مستقل از org_units (که واحدهای عملیاتی کل بیمارستان را مدل
 * می‌کند و به‌عمد دست‌نخورده می‌ماند — دلیل جداسازی همان دلیلی است که seed-org-divisions.js
 * برای عدم استفاده از org_units نوشته: این‌جا یک لایه‌ی مدیریتی متفاوت با کنترل کامل مدیر
 * پرستاری/مترون است، نه فهرست عمومی بخش‌های بیمارستان):
 *
 *  - nursing_supervisor_slots: سوپروایزر بالینی ۱..N — تعداد/نام/ترتیب را مدیر پرستاری
 *    تعیین می‌کند (هیچ عددی هاردکد نیست)، پیش‌فرض خالی.
 *  - nursing_cross_cover: پرچم «این سوپروایزر آموزشی/کنترل عفونت گاهی شیفت سوپروایزر
 *    بالینی هم می‌پوشاند» — فقط یادداشت/پرچم، بدون منطق برنامه‌ریزی.
 *  - nursing_wards: بخش‌های زیرمجموعه‌ی پرستاری با آیکون یونیکد انتخابی، هر کدام یک
 *    سرپرستار + دو جانشین (از کاربران فعال بیمارستان).
 *
 * پرسنل پرستار هر بخش از روی users.department (متن آزاد موجود، همان الگویی که
 * seed-org-structure.js توضیح داده) تشخیص داده می‌شود — ستون جدیدی به users اضافه نمی‌شود.
 *
 * نقش جدید: nursing_office_assistant («مسئول دفتر پرستاری») — نقش سراسری (hospital_id
 * NULL) هم‌ردیفِ بقیه‌ی ROLE_DEFINITIONS در migrate-sqlite.js (staff_nurse، سوپروایزرها …)
 * که همه سراسری‌اند؛ اینجا هم همان الگو دنبال شده، نه نقش سفارشی per-hospital.
 *
 * Run: npm run seed-nursing-hierarchy (یا خودکار روی هر boot). idempotent است.
 */
const { db } = require('../src/config/database-sqlite');
const { grantPerms } = require('./seed-library');
const crypto = require('crypto');

const TABLES = [
  `CREATE TABLE IF NOT EXISTS nursing_supervisor_slots (
    id TEXT PRIMARY KEY,
    hospital_id TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS nursing_cross_cover (
    id TEXT PRIMARY KEY,
    hospital_id TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    can_cover_clinical INTEGER DEFAULT 0,
    note TEXT,
    updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_nursing_crosscover_uniq ON nursing_cross_cover(hospital_id, user_id)`,
  `CREATE TABLE IF NOT EXISTS nursing_wards (
    id TEXT PRIMARY KEY,
    hospital_id TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    icon TEXT DEFAULT '✚',
    head_nurse_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    deputy1_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    deputy2_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_nursing_ward_uniq ON nursing_wards(hospital_id, title)`,
];

const ROLE_PERMS = {
  admin: ['manage_nursing_hierarchy', 'view_nursing_hierarchy'],
  nursing_director: ['manage_nursing_hierarchy', 'view_nursing_hierarchy'],
  clinical_supervisor: ['view_nursing_hierarchy'],
};

// در این برش فقط دو نقش «مدیر پرستاری» و «سرپرستار» وجود دارد؛ نقش دفتر
// پرستاری و بقیهٔ نقش‌های نسخهٔ کامل عمداً ساخته نمی‌شوند.
function runMigration() {
  console.log('[Seed NursingHierarchy] Starting...');
  try {
    for (const sql of TABLES) db.exec(sql);
    grantPerms(ROLE_PERMS, 'Seed NursingHierarchy');
    console.log('[Seed NursingHierarchy] ✅ nursing_supervisor_slots / nursing_cross_cover / nursing_wards ready');
  } catch (err) {
    console.error('[Seed NursingHierarchy] ❌ Failed:', err);
    throw err;
  }
}

if (require.main === module) {
  runMigration();
  process.exit(0);
}

module.exports = { runMigration };
