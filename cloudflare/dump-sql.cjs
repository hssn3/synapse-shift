/* =====================================================================
   تولید schema.sql و seed.sql از دیتابیسِ محلی همان پروژه
   ---------------------------------------------------------------------
   چرا این اسکریپت هست: نسخهٔ Cloudflare (worker.js) روی D1 اجرا می‌شود و
   D1 فقط SQL می‌خورد. همین اسکریپت جدول‌های ماژول را از لحظهٔ فعلیِ
   database/hospital.db برمی‌دارد تا اسکیمای D1 دقیقاً همان اسکیمای
   نسخهٔ Node باشد (UNIQUE ها و پیش‌فرض‌ها حفظ می‌شوند) و دادهٔ فعلی هم
   بدون سر و صدا منتقل شود.

   نکتهٔ کلیدهای خارجی: چند ستون به جدول‌هایی اشاره می‌کنند که در D1
   ترتیبِ درج را قفل می‌کردند (hospitals→users و users→users و
   controlled_documents→accreditation_sections که اصلاً بخشی از این
   ماژول نیست). همان‌ها اول NULL درج می‌شوند و در پایانِ فایل با UPDATE
   مقدار واقعی می‌گیرند — نتیجه یکسان، بدون خطای FK.

   اجرا:  node cloudflare/dump-sql.cjs
   خروجی: cloudflare/schema.sql و cloudflare/seed.sql
   ===================================================================== */
'use strict';
const path = require('path');
const fs = require('fs');
const root = path.join(__dirname, '..');
const Database = require(path.join(root, 'node_modules', 'better-sqlite3'));

const dbPath = process.argv[2] || path.join(root, 'database', 'hospital.db');
const outDir = __dirname;
const db = new Database(dbPath, { readonly: true });

// ترتیب دقیقاً وابستگی‌محور است (والد قبل از فرزند)
const TABLES = [
  'platform_settings', 'super_admins', 'roles', 'hospitals', 'users',
  'nursing_wards', 'ward_staff',
  'shift_schedules', 'shift_entries', 'shift_ward_settings', 'shift_units',
  'controlled_documents',
];

// ستون‌هایی که موقتاً NULL می‌شوند (به‌خاطر ترتیب FK) و در پایان با UPDATE برمی‌گردند
const DEFER_COLUMNS = {
  hospitals: ['admin_user_id', 'created_by_super_admin'],
  users: ['supervisor_id'],
  // ماژول اعتباربخشی در این نسخه نیست؛ ارجاع بخشِ سند در ابتدا NULL می‌شود و
  // مقدارش در پایانِ فایل با UPDATE برمی‌گردد (بدون قیدِ FK — پایین را ببینید).
  controlled_documents: ['section_id'],
};

// اصلاحِ اسکیمای تولیدی برای D1:
//  • controlled_documents.section_id به جدولِ ماژولِ اعتباربخشی اشاره می‌کرد که
//    در این نسخهٔ سبک وجود ندارد؛ قیدِ REFERENCES برداشته می‌شود (مقدارِ ستون
//    عیناً منتقل می‌شود، فقط قیدِ خارجی حذف می‌گردد). بدون این کار، D1 که FK را
//    در زمان نوشتن چک می‌کند با «no such table» خطا می‌داد.
const SCHEMA_REWRITE = {
  controlled_documents: [['REFERENCES accreditation_sections(id)', '']],
};

function sqlVal(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'bigint') return String(v);
  if (Buffer.isBuffer(v)) return `X'${v.toString('hex')}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
}
const q = s => `'${String(s).replace(/'/g, "''")}'`;

/* ---------- schema.sql ---------- */
let schema = `-- =====================================================================
-- اسکیمای D1 برای نسخهٔ Cloudflare — تولیدشده با cloudflare/dump-sql.cjs
-- مبدأ: ${path.basename(dbPath)} • تاریخ: ${new Date().toISOString()}
-- اجرا: npx wrangler d1 execute synapse-shift --local --file=cloudflare/schema.sql
-- =====================================================================
PRAGMA foreign_keys=OFF;
`;
for (const t of TABLES) {
  const row = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`).get(t);
  if (!row || !row.sql) { console.warn(`[dump] جدول ${t} پیدا نشد!`); continue; }
  let sql = row.sql;
  for (const [from, to] of (SCHEMA_REWRITE[t] || [])) sql = sql.split(from).join(to);
  schema += `\n${sql};\n`;
}
// ایندکس‌های صریح (UNIQUE های جدا) — ایندکس‌های خودکارِ SQLite نیازی نیستند
for (const t of TABLES) {
  const idx = db.prepare(`SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name=? AND sql IS NOT NULL`).all(t);
  for (const r of idx) schema += `${r.sql};\n`;
}
fs.writeFileSync(path.join(outDir, 'schema.sql'), schema, 'utf8');

/* ---------- seed.sql ---------- */
let seed = `-- =====================================================================
-- دادهٔ فعلی برای نسخهٔ Cloudflare — تولیدشده با cloudflare/dump-sql.cjs
-- مبدأ: ${path.basename(dbPath)} • تاریخ: ${new Date().toISOString()}
-- اجرا: npx wrangler d1 execute synapse-shift --local --file=cloudflare/seed.sql
-- =====================================================================
PRAGMA defer_foreign_keys=ON;
`;
const deferred = []; // [ {table, id, col, value} ]
let total = 0;
for (const t of TABLES) {
  const cols = db.prepare(`PRAGMA table_info("${t}")`).all().map(c => c.name);
  const rows = db.prepare(`SELECT * FROM "${t}"`).all();
  if (!rows.length) continue;
  const nullCols = DEFER_COLUMNS[t] || [];
  seed += `\nDELETE FROM "${t}";\n`;
  const colList = cols.map(c => `"${c}"`).join(', ');
  for (const r of rows) {
    for (const c of nullCols) {
      if (r[c] !== null && r[c] !== undefined) deferred.push({ table: t, id: r.id, col: c, value: r[c] });
    }
    const vals = cols.map(c => sqlVal(nullCols.includes(c) ? null : r[c]));
    seed += `INSERT INTO "${t}" (${colList}) VALUES (${vals.join(', ')});\n`;
  }
  total += rows.length;
  console.log(`[dump] ${t}: ${rows.length} ردیف${nullCols.length ? ' (ستون‌های FK با تأخیر پر می‌شوند)' : ''}`);
}
if (deferred.length) {
  seed += '\n-- برگرداندن ستون‌های ارجاعی (بعد از درجِ همه‌ی جدول‌ها)\n';
  for (const d of deferred) {
    seed += `UPDATE "${d.table}" SET "${d.col}" = ${sqlVal(d.value)} WHERE id = ${q(d.id)};\n`;
  }
}
fs.writeFileSync(path.join(outDir, 'seed.sql'), seed, 'utf8');
console.log(`[dump] ✅ schema.sql و seed.sql نوشته شد (${total} ردیف داده، ${deferred.length} ستون FK با UPDATE نهایی)`);
