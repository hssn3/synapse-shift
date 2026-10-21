/**
 * Clinical Shift Staff & Units Routes
 * Part of Modular Monolith (Clean Architecture) — Project 313
 */
const express = require('express');
const router = express.Router();
const common = require('../common');
const {
  query, db, authRequired, requirePermission, requireAnyPermission,
  hospitalScope, requireFeature, scopeFor, axisCodeOf, measureAllowed,
  jalaliYearRange, jalaliMonthRange, safeYear, toGregorian, toJalali,
  todayJalali, JMONTHS, tehranNow, tehranTodayStr, TEHRAN_OFFSET_MS,
  logAction, uuid, parseJSON, safeArray, buildTrackingCode,
  bcrypt, config,
  applyYearFilter, loadOverrides, evaluatePolicy,
  upload, uploadSingle, uploadMultiple, compressImage,
  path, fs, RULE_TYPES, RULE_TYPE_FA, reminderItemsFor,
  timelineFor, dismissMilestone, snoozeMilestone, setMilestoneState,
  assistantNext, assistantReview, periodProgress,
  getSmartDecisions, myWork, assistantChat,
  extractText, classifyDocument, extractFlowchart,
  crudNormalize,
  crudHasUpdatedAt,
  TIME_RE,
  DATE_RE,
  statusYear,
  codeCmp,
  sortTree,
  canAssignRole,
  hasPerm,
  normFa,
  matchFa,
  truthy,
  MER_EVAL_STATUSES,
  merValidate,
  merInsert,
  originalName,
  storeUploadedFile,
  sendStoredFile,
  LIB_CATEGORIES,
  libSectionId,
  getChecklist,
  saveChecklistMeasurers,
  chkMeasurers,
  itemHasSubmissions,
  BSC_PERSPECTIVES,
  JMONTHS_FA,
  matchPerspective,
  currentJalaliYear,
  bscYear,
  bscData,
  IND_ASPECTS,
  IND_TYPES,
  IND_INTERVALS,
  IND_DESIRABILITY,
  IND_VALUE_STATUS,
  IND_TEXT_FIELDS,
  IND_NUM_FIELDS,
  IND_FLAG_FIELDS,
  indBody,
  nrsCanManage,
  nrsCanView,
  headNurseWardsOf,
  hnAccessWard,
  hnHeadPresentToday,
  SHIFT_STAFF_ORDER_W,
  docCodes,
  signatureImageFor,
  resolveRecipient,
  nrsUserOrNull,
  FMEA_STATUSES,
  fmeaBody,
  fmeaInsert,
  CL_ANSWER_VALUES,
  CL_ANSWER_LABELS,
  CL_NONCONFORMITY,
  isNonConformity,
  indJudge,
  indRow
} = common;

// Helper to bind mountCrud to this module router
const mountCrud = (prefix, ...args) => common.mountCrud(router, prefix, ...args);

// ===== پرسنل بخش و برنامه‌ی ماهانه‌ی شیفت — database/seed-shift-schedule.js =====
// دسترسی دقیقاً از همان hnAccessWard بالا استفاده می‌کند (سرپرستار/جانشین همان
// بخش، یا مدیر پرستاری/ادمین برای نظارت) — بخش با عنوان (nursing_wards.title)
// شناسایی می‌شود، نه یک مدل دسترسی جدید.
//
// محاسبه‌ی ساعت هر سلول دقیقاً از فرمول‌های اکسل کارفرما آمده: هر سلول رشته‌ای
// از حروف M(صبح)/E(عصر)/N(شب)/H(مرخصی) است. M و E شش ساعت، N دوازده ساعت؛
// H به‌تنهایی (نه همراه شیفت) شش ساعت بستانکار می‌شود — دقیقاً مثل ستون
// «کارکرد افراد» اکسل که مرخصی را هم‌ارز یک روز کاریِ عادی حساب می‌کرد.
// ترتیبِ نمایشِ پرسنل در برنامه‌ی شیفت: سلسله‌مراتب، نه ترتیبِ ثبت.
// کارفرما دو ترتیب خواست و یک CASE هر دو را پوشش می‌دهد، چون رده‌های بالاتر
// در بخش‌های بالینی اصلاً وجود ندارند و خودبه‌خود کنار می‌روند:
//   • بخش بالینی:   سرپرستار → پرستار → کمک‌پرستار → منشی
//   • دفتر پرستاری: مدیر پرستاری → سوپروایزر بالینی → کنترل عفونت → آموزش → منشی
// ترتیبِ بندها مهم است: «سوپروایزر کنترل عفونت» خودش کلمه‌ی سوپروایزر را دارد،
// پس بندهای خاص‌تر باید *پیش از* بندِ عمومیِ سوپروایزر بیایند، وگرنه همه‌ی
// سوپروایزرها در یک رده می‌افتند.
// در ردهٔ یکسان، سابقهٔ بیشتر بالاتر می‌آید — همان چیزی که یادآوریِ خودِ برگه
// می‌گوید: «چیدمان پرسنل بر اساس سابقه از بالا به پایین و سلسله‌مراتب».
const SHIFT_STAFF_ORDER = `CASE
    WHEN position LIKE '%مدیر پرستاری%' OR position LIKE '%مترون%' THEN 1
    WHEN position LIKE '%سوپروایزر بالینی%' THEN 2
    WHEN position LIKE '%کنترل عفونت%' THEN 3
    WHEN position LIKE '%آموزش%' THEN 4
    WHEN position LIKE '%سوپروایزر%' THEN 5
    WHEN position LIKE '%سرپرستار%' THEN 6
    WHEN position LIKE '%کمک%' OR position LIKE '%بهیار%' THEN 8
    WHEN position LIKE '%منشی%' THEN 9
    WHEN position LIKE '%پرستار%' THEN 7
    ELSE 10 END, COALESCE(sort_order, 9999), IFNULL(years_experience, -1) DESC, created_at`;

const SHIFT_SETTINGS_DEFAULT = { hour_m: 7, clock_m: '07:00-14:00', hour_e: 6, clock_e: '13:00-19:00', hour_n: 12, clock_n: '19:00-07:00', hour_h: 7 };
// ساعتِ هر حرف دیگر عددِ ثابت نیست: از تنظیمِ همان بخش می‌آید (پیش‌فرض‌ها دقیقاً
// همان اعدادِ ردیف‌های AG30:AJ32 اکسل کارفرما). اگر بخش هنوز تنظیم نکرده باشد،
// پیش‌فرض همان رفتار قبلی را می‌دهد.
function shiftCellHours(codes, hrs) {
  hrs = hrs || SHIFT_SETTINGS_DEFAULT;
  if (!codes) return 0;
  // مرخصی (H) معادل شیفت صبح است و در کارکرد کل جمع می‌شود.
  if (codes.includes('H')) return hrs.hour_m;
  let h = 0;
  if (codes.includes('M')) h += hrs.hour_m;
  if (codes.includes('E')) h += hrs.hour_e;
  if (codes.includes('N')) h += hrs.hour_n;
  return h;
}
function daysInJalaliMonth(jy, jm) {
  const r = jalaliMonthRange(jy, jm);
  return Math.round((new Date(r.end) - new Date(r.start)) / 86400000);
}
// برنامه‌ی شیفت فقط مالِ بخش‌های پرستاری نیست: کارفرما خواست برای کارکنان
// پشتیبانی هم استفاده شود. پس اول بخشِ پرستاری امتحان می‌شود (با همان مدلِ
// سرپرستار/جانشین)، و اگر نبود، واحدِ دلخواهِ shift_units — که چون سرپرستار
// تعریف‌شده ندارد، فقط مدیر پرستاری/ادمین (nrsCanManage) می‌تواند اداره‌اش کند.
function shiftAccessUnit(req, title) {
  const asWard = hnAccessWard(req, title, false);
  if (!asWard.error) return asWard;
  // بخشِ پرستاری هست ولی این کاربر سرپرست/جانشینش نیست. اگر دسترسیِ نظارتیِ
  // پرستاری دارد (سوپروایزر بالینی، ریاست) باید برنامه را *ببیند* — سوپروایزر
  // بدون دیدنِ برنامه نمی‌داند چه کسی سرِ شیفت است. قبلاً این حالت به شاخه‌ی
  // «واحد دلخواه» سُر می‌خورد و چون آن‌جا پیدا نمی‌شد، کاربر «۴۰۴ بخش یافت نشد»
  // می‌گرفت؛ یعنی صفحه‌ی برنامه‌ی شیفت برای سوپروایزر عملاً خراب بود.
  // نوشتن باز نمی‌شود: هر endpointی که می‌نویسد جداگانه
  // isHead||isDeputy||isOverseer را چک می‌کند و این سه این‌جا false می‌مانند.
  if (asWard.status === 403 && nrsCanView(req)) {
    const w = query('SELECT id, title, icon FROM nursing_wards WHERE hospital_id = ? AND title = ?',
      [req.hospitalId, title]).rows[0];
    if (w) return { ward: w, isHead: false, isDeputy: false, isOverseer: false, isViewer: true };
  }
  const unit = query('SELECT * FROM shift_units WHERE hospital_id = ? AND title = ?',
    [req.hospitalId, title]).rows[0];
  if (!unit) return { error: 'بخش/واحد یافت نشد', status: 404 };
  if (!nrsCanManage(req)) return { error: 'دسترسی ندارید', status: 403 };
  return { ward: { id: unit.id, title: unit.title, icon: null }, isHead: false, isDeputy: false, isOverseer: true, isCustomUnit: true };
}

// شیفتِ کاریِ ثابتِ هر نفر — همان ستونِ «شیفت ثابت M/E/N» برگهٔ فرم. فقط حروف
// M/E/N قبول می‌شوند (مرخصی را نمی‌شود شیفتِ ثابت گذاشت)، خالی هم یعنی چرخشی.
function normFixedShift(v) {
  const s = new Set(String(v || '').toUpperCase().split('').filter(c => 'MEN'.includes(c)));
  return ['M', 'E', 'N'].filter(c => s.has(c)).join('') || null;
}

function getWardShiftSettings(hospitalId, ward) {
  const row = query('SELECT * FROM shift_ward_settings WHERE hospital_id = ? AND ward = ?', [hospitalId, ward]).rows[0];
  return row ? { hour_m: row.hour_m, clock_m: row.clock_m, hour_e: row.hour_e, clock_e: row.clock_e,
    hour_n: row.hour_n, clock_n: row.clock_n, hour_h: row.hour_h } : { ...SHIFT_SETTINGS_DEFAULT };
}
function parseHolidays(csv) {
  return String(csv || '').split(',').map(s => parseInt(s, 10)).filter(n => Number.isFinite(n) && n >= 1 && n <= 31);
}

// ---- واحدهای دلخواهِ شیفت (غیرپرستاری: خدمات، تأسیسات، نگهبانی، آشپزخانه، …) ----
router.get('/shift/units', authRequired, hospitalScope, (req, res) => {
  try {
    res.json({
      units: query('SELECT id, title, kind FROM shift_units WHERE hospital_id = ? ORDER BY sort_order, created_at',
        [req.hospitalId]).rows,
      can_manage: nrsCanManage(req),
    });
  } catch (err) { console.error('[ShiftSchedule]', err); res.status(500).json({ error: 'خطای سرور' }); }
});

router.post('/shift/units', authRequired, hospitalScope, (req, res) => {
  if (!nrsCanManage(req)) return res.status(403).json({ error: 'دسترسی ندارید' });
  const title = String((req.body || {}).title || '').trim();
  const kind = String((req.body || {}).kind || 'پشتیبانی').trim().slice(0, 40) || 'پشتیبانی';
  if (!title) return res.status(400).json({ error: 'نام واحد الزامی است' });
  // نامِ تکراری با یک بخشِ پرستاری، دو «بخش» هم‌نام می‌ساخت و شناساییِ واحد را مبهم می‌کرد
  const clash = query('SELECT id FROM nursing_wards WHERE hospital_id = ? AND title = ?', [req.hospitalId, title]).rows[0];
  if (clash) return res.status(409).json({ error: 'بخشی با همین نام در سلسله‌مراتب پرستاری وجود دارد' });
  try {
    const id = uuid();
    query('INSERT INTO shift_units (id, hospital_id, title, kind, created_by) VALUES (?,?,?,?,?)',
      [id, req.hospitalId, title, kind, req.user.id]);
    res.status(201).json({ id });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) return res.status(409).json({ error: 'این واحد قبلاً ثبت شده است' });
    console.error('[ShiftSchedule]', err); res.status(500).json({ error: 'خطای سرور' });
  }
});

router.delete('/shift/units/:id', authRequired, hospitalScope, (req, res) => {
  if (!nrsCanManage(req)) return res.status(403).json({ error: 'دسترسی ندارید' });
  const u = query('SELECT * FROM shift_units WHERE id = ? AND hospital_id = ?', [req.params.id, req.hospitalId]).rows[0];
  if (!u) return res.status(404).json({ error: 'واحد یافت نشد' });
  const n = query('SELECT COUNT(*) AS c FROM ward_staff WHERE hospital_id = ? AND ward = ?', [req.hospitalId, u.title]).rows[0].c;
  if (n > 0) return res.status(409).json({ error: `این واحد ${n} پرسنل ثبت‌شده دارد؛ اول آن‌ها را منتقل یا حذف کنید` });
  try {
    query('DELETE FROM shift_units WHERE id = ?', [u.id]);
    res.json({ status: 'deleted' });
  } catch (err) { console.error('[ShiftSchedule]', err); res.status(500).json({ error: 'خطای سرور' }); }
});

router.get('/shift/staff', authRequired, hospitalScope, (req, res) => {
  const wardTitle = req.query.ward;
  if (!wardTitle) return res.status(400).json({ error: 'بخش الزامی است' });
  const acc = shiftAccessUnit(req, wardTitle);
  if (acc.error) return res.status(acc.status).json({ error: acc.error });
  try {
    const includeInactive = req.query.include_inactive === '1';
    const rows = query(`SELECT * FROM ward_staff WHERE hospital_id = ? AND ward = ? ${includeInactive ? '' : 'AND is_active = 1'} ORDER BY ${SHIFT_STAFF_ORDER}`,
      [req.hospitalId, acc.ward.title]).rows.map(r => ({ ...r, extra_info: parseJSON(r.extra_info, {}) }));
    res.json({ ward: acc.ward.title, staff: rows, can_edit: acc.isHead || acc.isDeputy || acc.isOverseer });
  } catch (err) { console.error('[ShiftSchedule]', err); res.status(500).json({ error: 'خطای سرور' }); }
});

router.post('/shift/staff', authRequired, hospitalScope, (req, res) => {
  const b = req.body || {};
  const acc = shiftAccessUnit(req, b.ward);
  if (acc.error) return res.status(acc.status).json({ error: acc.error });
  if (!(acc.isHead || acc.isDeputy || acc.isOverseer)) return res.status(403).json({ error: 'دسترسی ندارید' });
  const firstName = String(b.first_name || '').trim();
  const lastName = String(b.last_name || '').trim();
  if (!firstName || !lastName) return res.status(400).json({ error: 'نام و نام‌خانوادگی الزامی است' });
  const gender = b.gender === 'مرد' ? 'مرد' : 'زن';
  const quota = Number.isFinite(+b.monthly_hour_quota) && +b.monthly_hour_quota > 0 ? Math.round(+b.monthly_hour_quota) : 169;
  try {
    const id = uuid();
    const employment = b.employment_status ? String(b.employment_status).trim().slice(0, 40) : 'قراردادی';
    const maxOrder = query('SELECT COALESCE(MAX(sort_order), 0) AS m FROM ward_staff WHERE hospital_id = ? AND ward = ?',
      [req.hospitalId, acc.ward.title]).rows[0].m;
    query(`INSERT INTO ward_staff (id, hospital_id, ward, first_name, last_name, gender, personnel_code, mobile, position, hire_date, fixed_shift, monthly_hour_quota, years_experience, extra_info, created_by, employment_status, sort_order)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, req.hospitalId, acc.ward.title, firstName, lastName, gender,
        b.personnel_code ? String(b.personnel_code).trim() : null,
        b.mobile ? String(b.mobile).trim() : null,
        b.position ? String(b.position).trim() : null,
        b.hire_date || null, normFixedShift(b.fixed_shift), quota,
        Number.isFinite(+b.years_experience) && +b.years_experience >= 0 ? Math.round(+b.years_experience) : null,
        JSON.stringify(b.extra_info && typeof b.extra_info === 'object' ? b.extra_info : {}),
        req.user.id, employment, maxOrder + 1]);
    res.status(201).json({ id });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) return res.status(409).json({ error: 'این کد پرسنلی قبلاً برای همین بیمارستان ثبت شده است' });
    console.error('[ShiftSchedule]', err); res.status(500).json({ error: 'خطای سرور' });
  }
});

router.put('/shift/staff/:id', authRequired, hospitalScope, (req, res) => {
  const st = query('SELECT * FROM ward_staff WHERE id = ? AND hospital_id = ?', [req.params.id, req.hospitalId]).rows[0];
  if (!st) return res.status(404).json({ error: 'پرسنل یافت نشد' });
  const acc = shiftAccessUnit(req, st.ward);
  if (acc.error) return res.status(acc.status).json({ error: acc.error });
  if (!(acc.isHead || acc.isDeputy || acc.isOverseer)) return res.status(403).json({ error: 'دسترسی ندارید' });
  const b = req.body || {};
  try {
    query(`UPDATE ward_staff SET
        first_name = COALESCE(?, first_name), last_name = COALESCE(?, last_name),
        gender = COALESCE(?, gender), personnel_code = ?, mobile = ?, position = ?,
        hire_date = ?, fixed_shift = ?, monthly_hour_quota = COALESCE(?, monthly_hour_quota),
        years_experience = ?, extra_info = ?, employment_status = COALESCE(?, employment_status),
        is_active = COALESCE(?, is_active), updated_at = datetime('now')
      WHERE id = ?`,
      [b.first_name ? String(b.first_name).trim() : null, b.last_name ? String(b.last_name).trim() : null,
        b.gender === 'مرد' || b.gender === 'زن' ? b.gender : null,
        b.personnel_code !== undefined ? (b.personnel_code ? String(b.personnel_code).trim() : null) : st.personnel_code,
        b.mobile !== undefined ? (b.mobile ? String(b.mobile).trim() : null) : st.mobile,
        b.position !== undefined ? (b.position ? String(b.position).trim() : null) : st.position,
        b.hire_date !== undefined ? (b.hire_date || null) : st.hire_date,
        b.fixed_shift !== undefined ? normFixedShift(b.fixed_shift) : st.fixed_shift,
        Number.isFinite(+b.monthly_hour_quota) && +b.monthly_hour_quota > 0 ? Math.round(+b.monthly_hour_quota) : null,
        b.years_experience !== undefined
          ? (Number.isFinite(+b.years_experience) && +b.years_experience >= 0 ? Math.round(+b.years_experience) : null)
          : st.years_experience,
        b.extra_info !== undefined ? JSON.stringify(b.extra_info && typeof b.extra_info === 'object' ? b.extra_info : {}) : st.extra_info,
        b.employment_status !== undefined ? (String(b.employment_status).trim().slice(0, 40) || null) : null,
        b.is_active === 0 || b.is_active === false ? 0 : (b.is_active === 1 || b.is_active === true ? 1 : null),
        st.id]);
    res.json({ status: 'updated' });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) return res.status(409).json({ error: 'این کد پرسنلی قبلاً برای همین بیمارستان ثبت شده است' });
    console.error('[ShiftSchedule]', err); res.status(500).json({ error: 'خطای سرور' });
  }
});

router.delete('/shift/staff/:id', authRequired, hospitalScope, (req, res) => {
  const st = query('SELECT * FROM ward_staff WHERE id = ? AND hospital_id = ?', [req.params.id, req.hospitalId]).rows[0];
  if (!st) return res.status(404).json({ error: 'پرسنل یافت نشد' });
  const acc = shiftAccessUnit(req, st.ward);
  if (acc.error) return res.status(acc.status).json({ error: acc.error });
  if (!(acc.isHead || acc.isDeputy || acc.isOverseer)) return res.status(403).json({ error: 'دسترسی ندارید' });
  try {
    query('DELETE FROM ward_staff WHERE id = ?', [st.id]);
    res.json({ status: 'deleted' });
  } catch (err) { console.error('[ShiftSchedule]', err); res.status(500).json({ error: 'خطای سرور' }); }
});

// ترتیب دلخواه نام‌ها در گرید (drag & drop). ترتیب فقط داخل همان بخش و همان
// گروه اعمال می‌شود؛ گروه هر فرد را سمتش تعیین می‌کند، نه این ترتیب.
router.put('/shift/staff-order', authRequired, hospitalScope, (req, res) => {
  const b = req.body || {};
  const acc = shiftAccessUnit(req, b.ward);
  if (acc.error) return res.status(acc.status).json({ error: acc.error });
  if (!(acc.isHead || acc.isDeputy || acc.isOverseer)) return res.status(403).json({ error: 'دسترسی ندارید' });
  const ids = Array.isArray(b.ids) ? [...new Set(b.ids.map(x => String(x || '')).filter(Boolean))].slice(0, 500) : [];
  if (!ids.length) return res.status(400).json({ error: 'ترتیب نامعتبر است' });
  try {
    const placeholders = ids.map(() => '?').join(',');
    const owned = query(`SELECT id FROM ward_staff WHERE hospital_id = ? AND ward = ? AND id IN (${placeholders})`,
      [req.hospitalId, acc.ward.title, ...ids]).rows;
    const ownedSet = new Set(owned.map(r => r.id));
    let order = 0;
    for (const id of ids) {
      if (!ownedSet.has(id)) continue;
      query('UPDATE ward_staff SET sort_order = ?, updated_at = datetime(\'now\') WHERE id = ? AND hospital_id = ?',
        [order++, id, req.hospitalId]);
    }
    res.json({ status: 'updated', count: order });
  } catch (err) { console.error('[ShiftSchedule]', err); res.status(500).json({ error: 'خطای سرور' }); }
});


module.exports = router;
