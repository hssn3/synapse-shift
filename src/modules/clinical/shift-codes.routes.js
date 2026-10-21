/**
 * فرم‌های کد ۵۵ و ۹۹ — فقط مدیر پرستاری
 * ---------------------------------------------------------------------
 * دو فرم کاغذیِ تیم احیا (کد ۵۵ مامایی، کد ۹۹ قلبی‌تنفسی) در پروژه نبودند.
 * ساختارشان سه شیفت (M/E/N) × شش نقش شماره‌دار × روزهای ماه است و اسم هر
 * خانه دستی نوشته می‌شود؛ چون بخشی از این نقش‌ها (پزشک طب اورژانس) اصلاً در
 * ward_staff نیستند و از گرید شیفت بخش قابل استنتاج نیستند.
 *
 * این مسیرها عمداً از دادهٔ برنامهٔ شیفت جدا هستند تا هیچ رفتاری از ماژول
 * موجود تغییر نکند: فقط یک جدول تازه و دو مسیر تازه.
 *
 *   GET  /api/shift/codes?type=55|99&year=1405&month=8
 *   PUT  /api/shift/codes/entry   { type, year, month, day, shift, role, name }
 */
const express = require('express');
const router = express.Router();
const common = require('../common');
const { query, db, authRequired, hospitalScope, nrsCanManage, uuid } = common;

const CODE_TYPES = ['55', '99'];
const SHIFTS = ['M', 'E', 'N'];
const ROLE_MIN = 1;
const ROLE_MAX = 6;

function ensureTable() {
  // مسیرها روی دیتابیسی اجرا می‌شوند که ممکن است جدول را نداشته باشد
  // (نصبِ قدیمی بدون اجرای seed). این‌جا یک‌بار و بی‌خطر ساخته می‌شود.
  db.exec(`CREATE TABLE IF NOT EXISTS shift_code_entries (
    id TEXT PRIMARY KEY,
    hospital_id TEXT NOT NULL,
    code_type TEXT NOT NULL,
    jalali_year INTEGER NOT NULL,
    jalali_month INTEGER NOT NULL,
    day INTEGER NOT NULL,
    shift TEXT NOT NULL,
    role_no INTEGER NOT NULL,
    person_name TEXT NOT NULL DEFAULT '',
    updated_by TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_code_entry_uniq
    ON shift_code_entries(hospital_id, code_type, jalali_year, jalali_month, day, shift, role_no)`);
  db.exec(`CREATE TABLE IF NOT EXISTS shift_code_meta (
    hospital_id TEXT NOT NULL,
    code_type TEXT NOT NULL,
    payload TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (hospital_id, code_type)
  )`);
}

const denyIfNotManager = (req, res) => {
  if (!nrsCanManage(req)) {
    res.status(403).json({ error: 'این فرم‌ها فقط در دسترس مدیر پرستاری است' });
    return true;
  }
  return false;
};

function intParam(v, min, max) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

router.get('/shift/codes', authRequired, hospitalScope, (req, res) => {
  if (denyIfNotManager(req, res)) return;
  ensureTable();
  const type = String(req.query.type || '99');
  if (!CODE_TYPES.includes(type)) return res.status(400).json({ error: 'نوع کد نامعتبر است' });
  const year = intParam(req.query.year, 1300, 1500);
  const month = intParam(req.query.month, 1, 12);
  if (year == null || month == null) return res.status(400).json({ error: 'سال/ماه نامعتبر است' });
  try {
    const entries = query(`SELECT day, shift, role_no, person_name FROM shift_code_entries
      WHERE hospital_id = ? AND code_type = ? AND jalali_year = ? AND jalali_month = ?
      ORDER BY day, shift, role_no`, [req.hospitalId, type, year, month]).rows;
    // پیشنهادِ نام برای پرکردن سریع: پرسنل ثبت‌شدهٔ همان بیمارستان (همهٔ بخش‌ها).
    const people = query(`SELECT first_name, last_name, position, ward FROM ward_staff
      WHERE hospital_id = ? AND is_active = 1
      ORDER BY ward, COALESCE(sort_order, 9999), last_name`, [req.hospitalId]).rows
      .map(r => ({
        name: ((r.first_name || '') + ' ' + (r.last_name || '')).trim(),
        position: r.position || '',
        ward: r.ward || '',
      }))
      .filter(p => p.name);
    res.json({ type, year, month, can_edit: true, entries, people });
  } catch (err) {
    console.error('[ShiftCodes]', err);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.put('/shift/codes/entry', authRequired, hospitalScope, (req, res) => {
  if (denyIfNotManager(req, res)) return;
  ensureTable();
  const b = req.body || {};
  const type = String(b.type || '');
  if (!CODE_TYPES.includes(type)) return res.status(400).json({ error: 'نوع کد نامعتبر است' });
  const shift = String(b.shift || '').toUpperCase();
  if (!SHIFTS.includes(shift)) return res.status(400).json({ error: 'شیفت نامعتبر است' });
  const year = intParam(b.year, 1300, 1500);
  const month = intParam(b.month, 1, 12);
  const day = intParam(b.day, 1, 31);
  const role = intParam(b.role, ROLE_MIN, ROLE_MAX);
  if (year == null || month == null || day == null || role == null) {
    return res.status(400).json({ error: 'خانهٔ نامعتبر' });
  }
  const name = String(b.name == null ? '' : b.name).trim().slice(0, 80);
  try {
    if (!name) {
      query(`DELETE FROM shift_code_entries
        WHERE hospital_id = ? AND code_type = ? AND jalali_year = ? AND jalali_month = ?
          AND day = ? AND shift = ? AND role_no = ?`,
        [req.hospitalId, type, year, month, day, shift, role]);
      return res.json({ status: 'cleared', day, shift, role_no: role });
    }
    query(`INSERT INTO shift_code_entries
        (id, hospital_id, code_type, jalali_year, jalali_month, day, shift, role_no, person_name, updated_by, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(hospital_id, code_type, jalali_year, jalali_month, day, shift, role_no)
      DO UPDATE SET person_name = excluded.person_name, updated_by = excluded.updated_by, updated_at = datetime('now')`,
      [uuid(), req.hospitalId, type, year, month, day, shift, role, name, req.user.id]);
    res.json({ status: 'saved', day, shift, role_no: role, person_name: name });
  } catch (err) {
    console.error('[ShiftCodes]', err);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

function sanitizeMeta(raw, cur) {
  const str = (v, max) => (v === undefined ? undefined : String(v == null ? '' : v).trim().slice(0, max));
  const intOrNull = v => (v == null || v === '' ? null : (Number.isFinite(+v) ? Math.round(+v) : null));
  const arr5 = v => (Array.isArray(v) ? v.slice(0, 5).map(x => (x == null || x === '' || !Number.isFinite(+x)) ? null : Math.round(+x)) : undefined);
  const signsOf = v => (Array.isArray(v) ? v.slice(0, 6).map(x => ({
    label: String((x && x.label) || '').trim().slice(0, 60),
    name: String((x && x.name) || '').trim().slice(0, 80),
  })) : undefined);
  const out = Object.assign({}, cur);
  const textFields = { title: 120, subtitle: 120, form_code: 60, note: 300, footer_note: 400, method: 60, training_title: 120 };
  Object.keys(textFields).forEach(k => {
    const v = str(raw[k], textFields[k]);
    if (v !== undefined) out[k] = v;
  });
  if (raw.beds !== undefined) out.beds = intOrNull(raw.beds);
  if (raw.contract_hours !== undefined) out.contract_hours = intOrNull(raw.contract_hours);
  if (raw.level_avg !== undefined) out.level_avg = arr5(raw.level_avg);
  if (raw.level_hours !== undefined) out.level_hours = arr5(raw.level_hours);
  if (raw.signs !== undefined) out.signs = signsOf(raw.signs);
  return out;
}

function metaOf(hospitalId, type) {
  const row = query('SELECT payload FROM shift_code_meta WHERE hospital_id = ? AND code_type = ?', [hospitalId, type]).rows[0];
  if (!row || !row.payload) return {};
  try { return JSON.parse(row.payload) || {}; } catch (e) { return {}; }
}

router.get('/shift/codes/meta', authRequired, hospitalScope, (req, res) => {
  if (denyIfNotManager(req, res)) return;
  ensureTable();
  const type = String(req.query.type || 'crisis').slice(0, 20);
  try { res.json({ type, meta: metaOf(req.hospitalId, type) }); } catch (err) {
    console.error('[ShiftCodes]', err); res.status(500).json({ error: 'خطای سرور' });
  }
});

router.put('/shift/codes/meta', authRequired, hospitalScope, (req, res) => {
  if (denyIfNotManager(req, res)) return;
  ensureTable();
  const b = req.body || {};
  const type = String(b.type || 'crisis').slice(0, 20);
  try {
    const next = sanitizeMeta(b.meta || {}, metaOf(req.hospitalId, type));
    query(`INSERT INTO shift_code_meta (hospital_id, code_type, payload, updated_at)
        VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(hospital_id, code_type) DO UPDATE SET payload = excluded.payload, updated_at = datetime('now')`,
      [req.hospitalId, type, JSON.stringify(next)]);
    res.json({ status: 'saved', type, meta: next });
  } catch (err) {
    console.error('[ShiftCodes]', err); res.status(500).json({ error: 'خطای سرور' });
  }
});

module.exports = router;
