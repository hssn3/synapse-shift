/**
 * Migration + Seed: کتابخانه دیجیتال (مخزن ساده فایل)
 * ساخت جدول digital_library_items و افزودن مجوزهای manage_library / view_library.
 *
 * چرا مجوز جدا از مدارک کنترل‌شده؟ (docs/hassan_ANALYSIS.md بخش ۳.۵)
 * «کتابخانه دیجیتال» عمداً بدون گردش‌کار امضا است — آیین‌نامه/پمفلت/فرم ابلاغی/کتابچه/جزوه آموزشی.
 * مجوز manage_documents در این پروژه دقیقاً همان گردش‌کار امضا و نسخه‌بندی را کنترل می‌کند،
 * پس بستن یک مخزن فایل ساده پشت آن، دسترسی را بی‌دلیل تنگ می‌کرد. view_library عمداً گسترده است.
 * Run: npm run seed-library — idempotent است و روی هر boot امن اجرا می‌شود.
 */
const { db } = require('../src/config/database-sqlite');

const TABLES = [
  `CREATE TABLE IF NOT EXISTS digital_library_items (
    id TEXT PRIMARY KEY,
    hospital_id TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    category TEXT NOT NULL DEFAULT 'regulation',
    title TEXT NOT NULL,
    description TEXT,
    file_path TEXT,
    file_name TEXT,
    file_size_bytes INTEGER,
    section_id TEXT,
    uploaded_by TEXT REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_lib_hospital ON digital_library_items(hospital_id, category)`,
  `CREATE INDEX IF NOT EXISTS idx_lib_section ON digital_library_items(section_id)`,
];

// مشاهده برای همه نقش‌های بالینی/مدیریتی، ویرایش برای مدیریت کیفیت و مدیر سامانه
const ROLE_PERMS = {
  admin: ['manage_library', 'view_library'],
  quality_control_manager: ['manage_library', 'view_library'],
  nursing_director: ['manage_library', 'view_library'],
  education_supervisor: ['manage_library', 'view_library'],
  infection_control_supervisor: ['view_library'],
  clinical_supervisor: ['view_library'],
  breastfeeding_specialist: ['view_library'],
  staff_nurse: ['view_library'],
};

function grantPerms(roleperms, label) {
  const roles = db.prepare('SELECT id, code, permissions FROM roles').all();
  const upd = db.prepare('UPDATE roles SET permissions = ? WHERE id = ?');
  let changed = 0;
  const tx = db.transaction(() => {
    for (const r of roles) {
      const wanted = roleperms[r.code];
      if (!wanted) continue;
      let perms;
      try { perms = JSON.parse(r.permissions || '[]'); } catch { perms = []; }
      if (!Array.isArray(perms)) perms = [];
      const missing = wanted.filter(p => !perms.includes(p));
      if (!missing.length) continue;
      upd.run(JSON.stringify(perms.concat(missing)), r.id);
      changed++;
    }
  });
  tx();
  console.log(`[${label}] ${changed} role(s) granted permissions`);
}

function runMigration() {
  console.log('[Seed Library] Starting...');
  try {
    for (const sql of TABLES) db.exec(sql);
    grantPerms(ROLE_PERMS, 'Seed Library');
    console.log('[Seed Library] ✅ digital_library_items ready');
  } catch (err) {
    console.error('[Seed Library] ❌ Failed:', err);
    throw err;
  }
}

if (require.main === module) {
  runMigration();
  process.exit(0);
}

module.exports = { runMigration, grantPerms };
