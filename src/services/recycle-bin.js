/* =====================================================================
   سطل بازیافت — هیچ چیزی واقعاً پاک نمی‌شود
   ---------------------------------------------------------------------
   نگرانی کاربر: «اگر کسی خواست از سازمان برود و همه‌چیز را پاک کند، همه
   باید سیو بمانَد و سوپرادمین بتواند برگرداند».

   چرا اینجا و نه ستون deleted_at روی هر جدول:
   سامانه ۲۴ مسیر DELETE دارد و ده‌ها SELECT. افزودن deleted_at یعنی
   دست‌زدن به همه‌ی آن SELECTها و اولین جایی که یادمان برود، یک ردیفِ
   پاک‌شده دوباره ظاهر می‌شود. به‌جایش، درست پیش از اجرای هر DELETE،
   ردیف‌های هدف اسنپ‌شات می‌شوند. یک نقطه‌ی گلوگاه، پوشش کامل، و هیچ
   کوئریِ خواندنِ موجودی تغییر نمی‌کند.

   بازگردانی = درج دوباره‌ی همان JSON در همان جدول. چون کلیدها UUID هستند
   و دست‌نخورده می‌مانند، ارجاع‌های فرزند هم دوباره جور می‌شوند.

   جدول‌های پرگردش (تیک‌زدن، رد کردن یادآور، مقدار خالی BSC) عمداً بایگانی
   نمی‌شوند؛ وگرنه سطل از نویز پر می‌شود و چیزِ مهم گم می‌شود.
   ===================================================================== */
'use strict';

const crypto = require('crypto');

// حذف‌هایی که «کار عادی سامانه» هستند، نه از دست دادن داده
const SKIP_TABLES = new Set([
  'guide_dismissals', 'reminder_dismissals', 'user_shortcuts',
  'bsc_monthly_values',        // پاک‌کردن مقدار = «اندازه‌گیری نشده»، خودش یک عمل عادی است
  'nursing_daily_attendance',  // روزانه بازنویسی می‌شود
  'shift_entries',             // سلول‌های شیفت هم مثل حضور‌غیاب روزانه پرنویس‌اند
  'drug_temp_logs',            // ثبت روزانه‌ی دما، پرنویس‌تر از آن است که بایگانی معنا بدهد
  'audit_log', 'error_log', 'deleted_records'
]);

const TABLE_FA = {
  controlled_documents: 'سند کنترل‌شده',
  document_signoffs: 'ردیف گردش امضا',
  committee_meeting_minutes: 'صورت‌جلسه کمیته',
  calendar_events: 'رویداد تقویم',
  checklists: 'چک‌لیست',
  checklist_items: 'سؤال چک‌لیست',
  checklist_submissions: 'اجرای چک‌لیست',
  internal_audits: 'حسابرسی داخلی',
  management_walkarounds: 'بازدید میدانی',
  walkaround_resolutions: 'مصوبه بازدید',
  improvement_programs: 'برنامه بهبود',
  processes: 'فرایند',
  training_needs: 'نیاز آموزشی',
  certifications: 'گواهینامه',
  digital_library_items: 'قلم کتابخانه',
  fmea_records: 'رکورد FMEA',
  medical_error_reports: 'گزارش خطا',
  patient_complaints_suggestions: 'انتقاد/پیشنهاد',
  staff_suggestions: 'پیشنهاد کارکنان',
  evidence_files: 'فایل شواهد',
  tasks: 'وظیفه',
  internal_messages: 'پیام داخلی',
  nursing_wards: 'بخش پرستاری',
  ward_staff: 'پرسنل بخش',
  shift_schedules: 'برنامه‌ی شیفت',
  facility_assets: 'قلم / تجهیز',
  drug_formulary: 'قلم فرمولاری دارویی',
  drug_fridges: 'یخچال دارویی',
  drug_recalls: 'فراخوان دارو/تجهیزات',
  drug_disposals: 'صورت‌جلسه انهدام',
  drug_adverse_events: 'عارضه یا خطای دارویی',
  drug_shortages: 'کمبود دارو',
  drug_off_formulary: 'تجویز خارج از فرمولاری',
  disaster_safety_assessments: 'ارزیابی ایمنی بیمارستان',
  disaster_hazards: 'عامل خطرآفرین',
  disaster_drills: 'مانور و تمرین',
  disaster_incidents: 'حادثه‌ی داخلی',
  sterilizers: 'دستگاه استریل‌کننده',
  sterilizer_tests: 'آزمون استریل‌کننده',
  sterile_batches: 'بسته‌ی استریل',
  hand_hygiene_audits: 'پایش بهداشت دست',
  hai_cases: 'مورد عفونت بیمارستانی',
  antibiograms: 'گزارش مقاومت میکروبی',
  asset_maintenance_plans: 'برنامه‌ی نگهداشت دوره‌ای',
  asset_maintenance_logs: 'سابقه‌ی نگهداشت',
  org_units: 'واحد سازمانی',
  users: 'کاربر',
  hospital_kpis: 'شاخص عملکردی',
  activity_records: 'ثبت فعالیت',
  activity_types: 'نوع فعالیت'
};

let _db = null;                 // با init تزریق می‌شود تا وابستگی حلقوی نشود
let _ready = false;

function init(db) {
  _db = db;
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS deleted_records (
      id TEXT PRIMARY KEY,
      hospital_id TEXT,
      table_name TEXT NOT NULL,
      record_id TEXT,
      label TEXT,
      snapshot TEXT NOT NULL,
      deleted_by TEXT,
      deleted_at TEXT NOT NULL DEFAULT (datetime('now')),
      restored_at TEXT,
      restored_by TEXT
    )`);
    db.exec('CREATE INDEX IF NOT EXISTS idx_delrec_hosp ON deleted_records(hospital_id, deleted_at)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_delrec_open ON deleted_records(restored_at)');
    _ready = true;
  } catch (e) {
    console.error('[RecycleBin] init failed:', e.message);
  }
}

// «چه کسی این حذف را انجام داد» — از میان‌افزار درخواست پر می‌شود
let _actor = { userId: null, hospitalId: null };
function setActor(userId, hospitalId) { _actor = { userId: userId || null, hospitalId: hospitalId || null }; }
function clearActor() { _actor = { userId: null, hospitalId: null }; }

// عنوان خوانا برای نمایش در سطل — اولین ستون متنیِ معنادار
function labelOf(row) {
  for (const k of ['title', 'name', 'subject', 'full_name', 'description', 'content', 'question_text']) {
    if (row && typeof row[k] === 'string' && row[k].trim()) return row[k].trim().slice(0, 120);
  }
  return null;
}

/**
 * پیش از اجرای DELETE صدا زده می‌شود. ردیف‌های هدف را می‌خواند و بایگانی می‌کند.
 * عمداً هیچ خطایی به بیرون پرت نمی‌کند: اگر بایگانی شکست خورد، خودِ حذف
 * نباید متوقف شود — ولی در لاگ دیده می‌شود.
 */
function archiveBeforeDelete(sql, params) {
  if (!_ready || !_db) return;
  try {
    const m = /^\s*DELETE\s+FROM\s+["'`]?(\w+)["'`]?\s*(WHERE\s+[\s\S]+)?$/i.exec(String(sql).trim());
    if (!m) return;
    const table = m[1];
    if (SKIP_TABLES.has(table)) return;
    const where = (m[2] || '').trim();
    // بدون WHERE یعنی «کل جدول» — همان چیزی که کاربر از آن می‌ترسد. بایگانی می‌شود.
    const rows = _db.prepare(`SELECT * FROM ${table} ${where}`).all(...(params || []));
    if (!rows.length) return;

    const ins = _db.prepare(`INSERT INTO deleted_records
      (id, hospital_id, table_name, record_id, label, snapshot, deleted_by)
      VALUES (?,?,?,?,?,?,?)`);
    for (const r of rows) {
      ins.run(crypto.randomUUID(), r.hospital_id || _actor.hospitalId || null,
        table, r.id != null ? String(r.id) : null, labelOf(r),
        JSON.stringify(r), _actor.userId);
    }
  } catch (e) {
    console.error('[RecycleBin] archive failed:', e.message, '| sql:', String(sql).slice(0, 120));
  }
}

/** فهرست سطل — پیش‌فرض فقط بازنگردانده‌ها */
function list(opts) {
  opts = opts || {};
  const where = ['1=1'], p = [];
  if (!opts.includeRestored) where.push('restored_at IS NULL');
  if (opts.hospitalId) { where.push('hospital_id = ?'); p.push(opts.hospitalId); }
  if (opts.table) { where.push('table_name = ?'); p.push(opts.table); }
  if (opts.q) { where.push('(label LIKE ? OR table_name LIKE ?)'); p.push('%' + opts.q + '%', '%' + opts.q + '%'); }
  const limit = Math.min(500, parseInt(opts.limit, 10) || 200);
  const rows = _db.prepare(
    `SELECT d.id, d.hospital_id, d.table_name, d.record_id, d.label, d.deleted_at,
            d.restored_at, d.deleted_by, h.name AS hospital_name, u.full_name AS deleted_by_name
       FROM deleted_records d
       LEFT JOIN hospitals h ON h.id = d.hospital_id
       LEFT JOIN users u ON u.id = d.deleted_by
      WHERE ${where.join(' AND ')}
      ORDER BY d.deleted_at DESC LIMIT ${limit}`).all(...p);
  return rows.map(r => ({ ...r, table_fa: TABLE_FA[r.table_name] || r.table_name }));
}

/** شمارش برای نشانِ صفحه */
function counts() {
  const rows = _db.prepare(
    `SELECT table_name, COUNT(*) AS n FROM deleted_records
      WHERE restored_at IS NULL GROUP BY table_name ORDER BY n DESC`).all();
  return rows.map(r => ({ ...r, table_fa: TABLE_FA[r.table_name] || r.table_name }));
}

/** بازگردانی یک ردیف به همان جدول */
function restore(archiveId, byUserId) {
  const rec = _db.prepare('SELECT * FROM deleted_records WHERE id = ?').get(archiveId);
  if (!rec) return { ok: false, error: 'رکورد بایگانی یافت نشد' };
  if (rec.restored_at) return { ok: false, error: 'این رکورد قبلاً بازگردانده شده است' };

  let data;
  try { data = JSON.parse(rec.snapshot); }
  catch (e) { return { ok: false, error: 'اسنپ‌شات خراب است' }; }

  // ستون‌هایی که هنوز در جدول هستند (اسکیما ممکن است از زمان حذف عوض شده باشد)
  let cols;
  try { cols = _db.prepare(`PRAGMA table_info(${rec.table_name})`).all().map(c => c.name); }
  catch (e) { return { ok: false, error: 'جدول مقصد دیگر وجود ندارد' }; }
  const use = Object.keys(data).filter(k => cols.includes(k));
  if (!use.length) return { ok: false, error: 'هیچ ستون سازگاری برای بازگردانی نماند' };

  if (data.id != null) {
    const dup = _db.prepare(`SELECT 1 FROM ${rec.table_name} WHERE id = ?`).get(data.id);
    if (dup) return { ok: false, error: 'رکوردی با همین شناسه از قبل وجود دارد' };
  }
  try {
    _db.prepare(`INSERT INTO ${rec.table_name} (${use.join(',')})
                 VALUES (${use.map(() => '?').join(',')})`).run(...use.map(k => data[k]));
  } catch (e) {
    // معمولاً یعنی والدش هم پاک شده — پیام روشن بهتر از خطای خام SQLite است
    return { ok: false, error: 'بازگردانی ممکن نشد: ' + e.message +
      ' — اگر رکورد والد (مثلاً خود سند یا چک‌لیست) هم حذف شده، اول آن را برگردانید.' };
  }
  _db.prepare("UPDATE deleted_records SET restored_at = datetime('now'), restored_by = ? WHERE id = ?")
    .run(byUserId || null, archiveId);
  return { ok: true, table: rec.table_name, id: data.id };
}

/** بازگردانی آبشاری (مورد ۲۱ قدیم چک‌لیست) — والد + فرزندانی که به آن ارجاع می‌دهند
 *  روش: اول والد، بعد همه رکوردهای حذف‌شده‌ای که اسنپ‌شاتشان شامل شناسه والد است
 *  (مثل checklist_items/domain/submission که checklist_id دارند). هر کدام که
 *  به‌خاطر ترتیب موفق نشود در دور دوم دوباره تلاش می‌شود. */
function restoreCascade(archiveId, byUserId) {
  const first = restore(archiveId, byUserId);
  if (!first.ok) return first;
  const parentId = String(first.id || '');
  if (!parentId) return { ...first, cascaded: [] };
  const cascaded = [];
  // حداکثر ۳ دور برای ترتیب والد->فرزند
  for (let round = 0; round < 3; round++) {
    const candidates = _db.prepare(
      `SELECT id FROM deleted_records WHERE restored_at IS NULL AND snapshot LIKE ? LIMIT 200`
    ).all('%' + parentId + '%');
    if (!candidates.length) break;
    let progressed = false;
    for (const c of candidates) {
      if (c.id === archiveId) continue;
      const r = restore(c.id, byUserId);
      if (r.ok) { cascaded.push({ id: c.id, table: r.table }); progressed = true; }
    }
    if (!progressed) break;
  }
  return { ok: true, table: first.table, id: first.id, cascaded };
}

module.exports = {
  init, setActor, clearActor, archiveBeforeDelete,
  list, counts, restore, restoreCascade, TABLE_FA, SKIP_TABLES
};
