/**
 * Clinical Shift Schedule & Plan Routes
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
  SHIFT_STAFF_ORDER,
  SHIFT_STAFF_ORDER_W,
  SHIFT_SETTINGS_DEFAULT,
  shiftCellHours,
  shiftClockHours,
  daysInJalaliMonth,
  shiftAccessUnit,
  getWardShiftSettings,
  parseHolidays,
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

router.get('/shift/schedule', authRequired, hospitalScope, (req, res) => {
  const wardTitle = req.query.ward;
  const year = parseInt(req.query.year, 10), month = parseInt(req.query.month, 10);
  if (!wardTitle) return res.status(400).json({ error: 'بخش الزامی است' });
  const acc = shiftAccessUnit(req, wardTitle);
  if (acc.error) return res.status(acc.status).json({ error: acc.error });
  if (!year || !month || month < 1 || month > 12) return res.status(400).json({ error: 'سال/ماه نامعتبر است' });
  try {
    const days = daysInJalaliMonth(year, month);
    const hrs = getWardShiftSettings(req.hospitalId, acc.ward.title);
    let sched = query('SELECT * FROM shift_schedules WHERE hospital_id=? AND ward=? AND jalali_year=? AND jalali_month=?',
      [req.hospitalId, acc.ward.title, year, month]).rows[0];
    if (!sched) sched = { id: null, note: null, holidays: '', description: null, custom_rows: null, finalized_at: null, finalized_by: null, audit_json: null };
    const finalizedBy = sched.finalized_by
      ? query('SELECT full_name FROM users WHERE id = ?', [sched.finalized_by]).rows[0]
      : null;
    const staff = query(`SELECT * FROM ward_staff WHERE hospital_id=? AND ward=? AND is_active=1 ORDER BY ${SHIFT_STAFF_ORDER}`,
      [req.hospitalId, acc.ward.title]).rows;
    const entries = sched.id
      ? query('SELECT staff_id, day, codes, is_lead FROM shift_entries WHERE schedule_id=?', [sched.id]).rows
      : [];
    const byStaff = {}, leadByStaff = {};
    for (const e of entries) {
      (byStaff[e.staff_id] = byStaff[e.staff_id] || {})[e.day] = e.codes;
      if (e.is_lead) (leadByStaff[e.staff_id] = leadByStaff[e.staff_id] || {})[e.day] = 1;
    }
    const headcount = {};
    for (let d = 1; d <= days; d++) headcount[d] = { M: 0, E: 0, N: 0, H: 0 };
    const rows = staff.map(s => {
      const cells = byStaff[s.id] || {};
      let total = 0;
      for (let d = 1; d <= days; d++) {
        const c = cells[d] || '';
        total += shiftCellHours(c, hrs);
        if (c.includes('M')) headcount[d].M++;
        if (c.includes('E')) headcount[d].E++;
        if (c.includes('N')) headcount[d].N++;
        if (c.includes('H')) headcount[d].H++;
      }
      return { id: s.id, first_name: s.first_name, last_name: s.last_name, personnel_code: s.personnel_code,
        position: s.position, gender: s.gender, monthly_hour_quota: s.monthly_hour_quota,
        years_experience: s.years_experience, hire_date: s.hire_date, fixed_shift: s.fixed_shift,
        employment_status: s.employment_status, sort_order: s.sort_order,
        cells, leads: leadByStaff[s.id] || {}, total_hours: total, overtime: total - s.monthly_hour_quota };
    });
    res.json({
      schedule: { ward: acc.ward.title, jalali_year: year, jalali_month: month, note: sched.note, days,
        holidays: parseHolidays(sched.holidays), description: sched.description || null,
        custom_rows: parseJSON(sched.custom_rows, []),
        finalized_at: sched.finalized_at || null,
        finalized_by: sched.finalized_by || null,
        finalized_by_name: finalizedBy ? finalizedBy.full_name : null,
        audit: parseJSON(sched.audit_json, null) },
      settings: hrs, staff: rows, headcount, can_edit: acc.isHead || acc.isDeputy || acc.isOverseer,
    });
  } catch (err) { console.error('[ShiftSchedule]', err); res.status(500).json({ error: 'خطای سرور' }); }
});

router.put('/shift/schedule/note', authRequired, hospitalScope, (req, res) => {
  const b = req.body || {};
  const acc = shiftAccessUnit(req, b.ward);
  if (acc.error) return res.status(acc.status).json({ error: acc.error });
  if (!(acc.isHead || acc.isDeputy || acc.isOverseer)) return res.status(403).json({ error: 'دسترسی ندارید' });
  const year = parseInt(b.year, 10), month = parseInt(b.month, 10);
  if (!year || !month) return res.status(400).json({ error: 'سال/ماه نامعتبر است' });
  try {
    const sched = query('SELECT id FROM shift_schedules WHERE hospital_id=? AND ward=? AND jalali_year=? AND jalali_month=?',
      [req.hospitalId, acc.ward.title, year, month]).rows[0];
    const note = b.note ? String(b.note).trim().slice(0, 200) : null;
    const holidays = Array.isArray(b.holidays)
      ? b.holidays.map(n => parseInt(n, 10)).filter(n => Number.isFinite(n) && n >= 1 && n <= 31).join(',')
      : (sched ? undefined : '');
    // description جدا از note است: note یک برچسبِ کوتاهِ بالای برگه («۲۶ روز
    // کاری») و description متنِ توضیحیِ زیرِ برگه‌ی چاپی است.
    const description = b.description !== undefined
      ? (b.description ? String(b.description).trim().slice(0, 2000) : null)
      : (sched ? undefined : null);
    if (sched) query(`UPDATE shift_schedules SET note = ?, holidays = COALESCE(?, holidays),
        description = CASE WHEN ? THEN ? ELSE description END, updated_at = datetime('now') WHERE id = ?`,
      [note, holidays === undefined ? null : holidays,
        description === undefined ? 0 : 1, description === undefined ? null : description, sched.id]);
    else query(`INSERT INTO shift_schedules (id, hospital_id, ward, jalali_year, jalali_month, note, holidays, description, created_by) VALUES (?,?,?,?,?,?,?,?,?)`,
      [uuid(), req.hospitalId, acc.ward.title, year, month, note, holidays || '', description || null, req.user.id]);
    res.json({ status: 'updated' });
  } catch (err) { console.error('[ShiftSchedule]', err); res.status(500).json({ error: 'خطای سرور' }); }
});

// ---- ردیف‌های دلخواهِ سربرگ/پاورقی — «مثل اکسل» ----
// هر ردیف روی کلِ عرضِ جدول مرج می‌شود؛ کارفرما دقیقاً همین را خواست («ردیف
// سربرگ یا پاورقی با متن … اضافه کنه، مرج کنه»).
router.put('/shift/schedule/custom-rows', authRequired, hospitalScope, (req, res) => {
  const b = req.body || {};
  const acc = shiftAccessUnit(req, b.ward);
  if (acc.error) return res.status(acc.status).json({ error: acc.error });
  if (!(acc.isHead || acc.isDeputy || acc.isOverseer)) return res.status(403).json({ error: 'دسترسی ندارید' });
  const year = parseInt(b.year, 10), month = parseInt(b.month, 10);
  if (!year || !month) return res.status(400).json({ error: 'سال/ماه نامعتبر است' });
  const rows = Array.isArray(b.rows) ? b.rows.slice(0, 12).map(r => ({
    area: r && r.area === 'footer' ? 'footer' : 'header',
    text: String((r && r.text) || '').trim().slice(0, 500),
    bold: r && (r.bold === true || r.bold === 1) ? 1 : 0,
    align: r && ['right', 'left', 'center'].includes(r.align) ? r.align : 'center',
  })).filter(r => r.text) : [];
  try {
    const sched = query('SELECT id FROM shift_schedules WHERE hospital_id=? AND ward=? AND jalali_year=? AND jalali_month=?',
      [req.hospitalId, acc.ward.title, year, month]).rows[0];
    const json = JSON.stringify(rows);
    if (sched) query(`UPDATE shift_schedules SET custom_rows = ?, updated_at = datetime('now') WHERE id = ?`, [json, sched.id]);
    else query(`INSERT INTO shift_schedules (id, hospital_id, ward, jalali_year, jalali_month, custom_rows, created_by) VALUES (?,?,?,?,?,?,?)`,
      [uuid(), req.hospitalId, acc.ward.title, year, month, json, req.user.id]);
    res.json({ status: 'updated', rows });
  } catch (err) { console.error('[ShiftSchedule]', err); res.status(500).json({ error: 'خطای سرور' }); }
});

// ---- پایان نوشتن برنامه: ثبت نهایی + گزارش همگنی و شیفت‌های خالی ----
router.post('/shift/finalize', authRequired, hospitalScope, (req, res) => {
  const b = req.body || {};
  const acc = shiftAccessUnit(req, b.ward);
  if (acc.error) return res.status(acc.status).json({ error: acc.error });
  if (!(acc.isHead || acc.isDeputy || acc.isOverseer)) return res.status(403).json({ error: 'دسترسی ندارید' });
  const year = parseInt(b.year, 10), month = parseInt(b.month, 10);
  if (!year || !month || month < 1 || month > 12) return res.status(400).json({ error: 'سال/ماه نامعتبر است' });
  try {
    const days = daysInJalaliMonth(year, month);
    const staff = query('SELECT id, gender FROM ward_staff WHERE hospital_id=? AND ward=? AND is_active=1',
      [req.hospitalId, acc.ward.title]).rows;
    let sched = query('SELECT id FROM shift_schedules WHERE hospital_id=? AND ward=? AND jalali_year=? AND jalali_month=?',
      [req.hospitalId, acc.ward.title, year, month]).rows[0];
    if (!sched) {
      const id = uuid();
      query('INSERT INTO shift_schedules (id, hospital_id, ward, jalali_year, jalali_month, created_by) VALUES (?,?,?,?,?,?)',
        [id, req.hospitalId, acc.ward.title, year, month, req.user.id]);
      sched = { id };
    }
    const entries = query('SELECT staff_id, day, codes FROM shift_entries WHERE schedule_id=?', [sched.id]).rows;
    const cells = {};
    for (const e of entries) (cells[e.staff_id] = cells[e.staff_id] || {})[e.day] = e.codes;
    const labels = { M: 'صبح', E: 'عصر', N: 'شب' };
    const mixed = [], zero = [], mixedDaysSet = new Set();
    for (let d = 1; d <= days; d++) {
      for (const k of ['M', 'E', 'N']) {
        let male = 0, female = 0;
        for (const s of staff) {
          const c = (cells[s.id] && cells[s.id][d]) || '';
          if (!c.includes(k)) continue;
          if (s.gender === 'مرد') male++; else female++;
        }
        if (male && female) { mixed.push({ day: d, shift: k, male, female }); mixedDaysSet.add(d); }
        if (!male && !female) zero.push({ day: d, shift: k });
      }
    }
    const audit = { days, mixed, zero, mixedDays: [...mixedDaysSet], labels, generated_at: new Date().toISOString() };
    query(`UPDATE shift_schedules SET finalized_at = datetime('now'), finalized_by = ?, audit_json = ?,
        updated_at = datetime('now') WHERE id = ?`,
      [req.user.id, JSON.stringify(audit), sched.id]);
    const saved = query('SELECT finalized_at FROM shift_schedules WHERE id = ?', [sched.id]).rows[0];
    res.json({ status: 'finalized', finalized_at: saved && saved.finalized_at, audit });
  } catch (err) { console.error('[ShiftSchedule]', err); res.status(500).json({ error: 'خطای سرور' }); }
});

// ---- تنظیم ساعت هر شیفت برای یک بخش — معادلِ ردیف‌های AG30:AJ32 اکسل ----
router.get('/shift/settings', authRequired, hospitalScope, (req, res) => {
  const wardTitle = req.query.ward;
  if (!wardTitle) return res.status(400).json({ error: 'بخش الزامی است' });
  const acc = shiftAccessUnit(req, wardTitle);
  if (acc.error) return res.status(acc.status).json({ error: acc.error });
  try { res.json({ ward: acc.ward.title, settings: getWardShiftSettings(req.hospitalId, acc.ward.title) }); }
  catch (err) { console.error('[ShiftSchedule]', err); res.status(500).json({ error: 'خطای سرور' }); }
});

router.put('/shift/settings', authRequired, hospitalScope, (req, res) => {
  const b = req.body || {};
  // فقط مدیر پرستاری ساعت شیفت را تعیین می‌کند؛ سرپرستار بخش اجازهٔ این تغییر را ندارد.
  if (!nrsCanManage(req)) return res.status(403).json({ error: 'فقط مدیر پرستاری می‌تواند ساعت شیفت را تغییر دهد' });
  const acc = shiftAccessUnit(req, b.ward);
  if (acc.error) return res.status(acc.status).json({ error: acc.error });
  const num = (v, d) => (Number.isFinite(+v) && +v >= 0 && +v <= 24) ? Math.round(+v) : d;
  const clock = (v, d) => (typeof v === 'string' && v.trim()) ? v.trim().slice(0, 30) : d;
  const cur = getWardShiftSettings(req.hospitalId, acc.ward.title);
  const clockM = clock(b.clock_m, cur.clock_m), clockE = clock(b.clock_e, cur.clock_e), clockN = clock(b.clock_n, cur.clock_n);
  const hM = shiftClockHours(clockM), hE = shiftClockHours(clockE), hN = shiftClockHours(clockN);
  const next = {
    hour_m: hM != null ? hM : num(b.hour_m, cur.hour_m), clock_m: clockM,
    hour_e: hE != null ? hE : num(b.hour_e, cur.hour_e), clock_e: clockE,
    hour_n: hN != null ? hN : num(b.hour_n, cur.hour_n), clock_n: clockN,
    // مرخصی همیشه معادل شیفت صبح است.
    hour_h: hM != null ? hM : num(b.hour_h, cur.hour_h),
  };
  try {
    query(`INSERT INTO shift_ward_settings (hospital_id, ward, hour_m, clock_m, hour_e, clock_e, hour_n, clock_n, hour_h, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?, datetime('now'))
      ON CONFLICT(hospital_id, ward) DO UPDATE SET
        hour_m=excluded.hour_m, clock_m=excluded.clock_m, hour_e=excluded.hour_e, clock_e=excluded.clock_e,
        hour_n=excluded.hour_n, clock_n=excluded.clock_n, hour_h=excluded.hour_h, updated_at=datetime('now')`,
      [req.hospitalId, acc.ward.title, next.hour_m, next.clock_m, next.hour_e, next.clock_e, next.hour_n, next.clock_n, next.hour_h]);
    res.json({ status: 'updated', settings: next });
  } catch (err) { console.error('[ShiftSchedule]', err); res.status(500).json({ error: 'خطای سرور' }); }
});

// ---- سمت‌های قابل انتخاب (فقط مدیر پرستاری) ----
const DEFAULT_POSITIONS = ['مدیر پرستاری', 'سوپروایزر بالینی', 'سرپرستار', 'پرستار', 'کمک‌پرستار', 'بهیار', 'منشی بخش'];
function positionsOf() {
  try {
    const row = query("SELECT value FROM platform_settings WHERE key = 'shift_positions'").rows[0];
    const list = row ? parseJSON(row.value, []) : [];
    return (Array.isArray(list) && list.length) ? list : DEFAULT_POSITIONS;
  } catch (e) { return DEFAULT_POSITIONS; }
}
router.get('/shift/positions', authRequired, hospitalScope, (req, res) => {
  res.json({ positions: positionsOf(), can_manage: nrsCanManage(req) });
});
router.put('/shift/positions', authRequired, hospitalScope, (req, res) => {
  if (!nrsCanManage(req)) return res.status(403).json({ error: 'فقط مدیر پرستاری می‌تواند سمت تعریف کند' });
  const raw = Array.isArray(req.body && req.body.positions) ? req.body.positions : [];
  const list = [...new Set(raw.map(x => String(x || '').trim().slice(0, 60)).filter(Boolean))].slice(0, 40);
  if (!list.length) return res.status(400).json({ error: 'حداقل یک سمت لازم است' });
  try {
    query("INSERT INTO platform_settings (key, value) VALUES ('shift_positions', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [JSON.stringify(list)]);
    res.json({ status: 'updated', positions: list });
  } catch (err) { console.error('[ShiftSchedule] positions:', err); res.status(500).json({ error: 'خطای سرور' }); }
});

// ---- قالب چاپِ برگه‌ی شیفت (کد فرم، یادآوری‌ها، برچسبِ امضاها، تماس‌ها) ----
// سراسریِ بیمارستان است، نه per-ward — دقیقاً مثل letterhead_config که از قبل
// همین‌جوری روی خودِ hospitals نشسته. فقط کسی که تنظیمات بیمارستان را مدیریت
// می‌کند (manage_hospital_settings) می‌تواند تغییرش دهد؛ خواندنش برای هر عضو
// همان بیمارستان آزاد است چون فقط برای چاپ لازم است.
const SHIFT_PRINT_DEFAULT = {
  form_code: '', revision_date: '',
  clinical_supervisor_name: '', nursing_manager_name: '', hospital_president_name: '',
  training_title: 'افراد معرفی شده به کلاس‌های آموزشی:',
  contract_hours: 158, care_method: 'Case Method',
  reminders: [],
  signatures: ['تأیید مدیریت پرستاری:', 'نام و نام‌خانوادگی/مهر و امضاء سوپروایزر بالینی:', 'نام و نام‌خانوادگی/مهر و امضاء سرپرستار:'],
  contacts: [],
};
router.get('/shift/print-config', authRequired, hospitalScope, (req, res) => {
  try {
    const row = query('SELECT shift_print_config FROM hospitals WHERE id = ?', [req.hospitalId]).rows[0];
    const cfg = { ...SHIFT_PRINT_DEFAULT, ...parseJSON(row && row.shift_print_config, {}) };
    res.json({ config: cfg });
  } catch (err) { console.error('[ShiftSchedule]', err); res.status(500).json({ error: 'خطای سرور' }); }
});

router.put('/shift/print-config', authRequired, hospitalScope, (req, res) => {
  if (!(nrsCanManage(req) || (req.user.permissions || []).includes('manage_hospital_settings'))) {
    return res.status(403).json({ error: 'دسترسی ندارید' });
  }
  const b = req.body || {};
  const asStrList = (v, max) => Array.isArray(v) ? v.map(x => String(x || '').trim()).filter(Boolean).slice(0, max) : undefined;
  const cur = { ...SHIFT_PRINT_DEFAULT, ...parseJSON(query('SELECT shift_print_config FROM hospitals WHERE id = ?', [req.hospitalId]).rows[0]?.shift_print_config, {}) };
  const next = {
    form_code: b.form_code !== undefined ? String(b.form_code).trim().slice(0, 60) : cur.form_code,
    revision_date: b.revision_date !== undefined ? String(b.revision_date).trim().slice(0, 20) : cur.revision_date,
    clinical_supervisor_name: b.clinical_supervisor_name !== undefined ? String(b.clinical_supervisor_name).trim().slice(0, 80) : cur.clinical_supervisor_name,
    nursing_manager_name: b.nursing_manager_name !== undefined ? String(b.nursing_manager_name).trim().slice(0, 80) : cur.nursing_manager_name,
    hospital_president_name: b.hospital_president_name !== undefined ? String(b.hospital_president_name).trim().slice(0, 80) : cur.hospital_president_name,
    training_title: b.training_title !== undefined ? String(b.training_title).trim().slice(0, 120) : cur.training_title,
    contract_hours: Number.isFinite(+b.contract_hours) ? Math.round(+b.contract_hours) : cur.contract_hours,
    care_method: b.care_method !== undefined ? String(b.care_method).trim().slice(0, 60) : cur.care_method,
    reminders: asStrList(b.reminders, 10) || cur.reminders,
    signatures: (asStrList(b.signatures, 6) && asStrList(b.signatures, 6).length >= 1) ? asStrList(b.signatures, 6) : cur.signatures,
    contacts: asStrList(b.contacts, 10) || cur.contacts,
  };
  try {
    query('UPDATE hospitals SET shift_print_config = ? WHERE id = ?', [JSON.stringify(next), req.hospitalId]);
    res.json({ status: 'updated', config: next });
  } catch (err) { console.error('[ShiftSchedule]', err); res.status(500).json({ error: 'خطای سرور' }); }
});

// ثبتِ برگه‌ی شیفت به‌عنوان «فرمِ کنترل‌شده» در دفترچه کد مدارک.
// کارفرما: «این یک فرم سازمانی است، پس باید کد دفترچه مثل سایر کدها بخورد و
// توی کدها وارد شود». تا امروز فقط یک form_code متنیِ آزاد در تنظیمات چاپ بود
// که هیچ‌جا ثبت نمی‌شد. حالا یک سند واقعی از نوع «فرم» ساخته می‌شود، کدش با
// همان موتورِ استانداردِ doc-codes.js گرفته می‌شود (پس در گروه‌بندیِ دفترچه هم
// کنار بقیه‌ی فرم‌ها می‌نشیند) و همان کد در قالبِ چاپ می‌نشیند.
// idempotent: اگر قبلاً ثبت شده، همان سند و همان کد برگردانده می‌شود — وگرنه هر
// کلیک یک ردیف تازه در دفترچه می‌ساخت.
const SHIFT_FORM_TITLE = 'برنامه‌ی ماهانه‌ی شیفت پرسنل';
router.post('/shift/register-form', authRequired, hospitalScope, async (req, res) => {
  if (!(nrsCanManage(req) || (req.user.permissions || []).includes('manage_hospital_settings'))) {
    return res.status(403).json({ error: 'دسترسی ندارید' });
  }
  try {
    let doc = query(`SELECT id, doc_code FROM controlled_documents
      WHERE hospital_id = ? AND title = ? LIMIT 1`, [req.hospitalId, SHIFT_FORM_TITLE]).rows[0];
    if (!doc) {
      const id = uuid();
      const meta = { doc_type: 'فرم', title: SHIFT_FORM_TITLE, responsible_person: 'مدیریت پرستاری' };
      const code = docCodes.buildCode(req.hospitalId, meta, null, id);
      query(`INSERT INTO controlled_documents (id, hospital_id, doc_type, title, doc_code,
        responsible_person, purpose, scope, status, created_by, updated_by)
        VALUES (?, ?, 'فرم', ?, ?, 'مدیریت پرستاری', ?, ?, 'approved', ?, ?)`,
        [id, req.hospitalId, SHIFT_FORM_TITLE, code,
          'ثبت و ابلاغ برنامه‌ی ماهانه‌ی شیفت پرسنل هر بخش/واحد و محاسبه‌ی کارکرد و اضافه‌کار.',
          'همه‌ی بخش‌های بالینی و واحدهای پشتیبانی دارای برنامه‌ی شیفت.',
          req.user.id, req.user.id]);
      await logAction({ hospitalId: req.hospitalId, userId: (req.previewAdmin && req.previewAdmin.id) || req.user.id, action: 'document_created',
        targetTable: 'controlled_documents', targetId: id, ipAddress: req.ip });
      doc = { id, doc_code: code };
    }
    // کدِ سند در قالبِ چاپ می‌نشیند تا روی هر برگه‌ی چاپ‌شده دیده شود
    const cur = { ...SHIFT_PRINT_DEFAULT, ...parseJSON(query('SELECT shift_print_config FROM hospitals WHERE id = ?', [req.hospitalId]).rows[0]?.shift_print_config, {}) };
    cur.form_code = doc.doc_code;
    cur.document_id = doc.id;
    query('UPDATE hospitals SET shift_print_config = ? WHERE id = ?', [JSON.stringify(cur), req.hospitalId]);
    res.json({ document: doc, config: cur });
  } catch (err) { console.error('[ShiftSchedule]', err); res.status(500).json({ error: 'خطای سرور' }); }
});

router.put('/shift/schedule/cell', authRequired, hospitalScope, (req, res) => {
  const b = req.body || {};
  const acc = shiftAccessUnit(req, b.ward);
  if (acc.error) return res.status(acc.status).json({ error: acc.error });
  if (!(acc.isHead || acc.isDeputy || acc.isOverseer)) return res.status(403).json({ error: 'دسترسی ندارید' });
  const year = parseInt(b.year, 10), month = parseInt(b.month, 10), day = parseInt(b.day, 10);
  if (!year || !month || !day || day < 1 || day > 31) return res.status(400).json({ error: 'تاریخ نامعتبر است' });
  const set = new Set(String(b.codes || '').toUpperCase().split('').filter(c => 'MENH'.includes(c)));
  if (set.has('H') && set.size > 1) return res.status(400).json({ error: 'مرخصی (H) با شیفت دیگری در یک روز ترکیب نمی‌شود' });
  const codes = ['M', 'E', 'N', 'H'].filter(c => set.has(c)).join('');
  try {
    const staffRow = query('SELECT id FROM ward_staff WHERE id = ? AND hospital_id = ? AND ward = ?',
      [b.staff_id, req.hospitalId, acc.ward.title]).rows[0];
    if (!staffRow) return res.status(404).json({ error: 'پرسنل یافت نشد' });
    let sched = query('SELECT id FROM shift_schedules WHERE hospital_id=? AND ward=? AND jalali_year=? AND jalali_month=?',
      [req.hospitalId, acc.ward.title, year, month]).rows[0];
    if (!sched) {
      const id = uuid();
      query(`INSERT INTO shift_schedules (id, hospital_id, ward, jalali_year, jalali_month, created_by) VALUES (?,?,?,?,?,?)`,
        [id, req.hospitalId, acc.ward.title, year, month, req.user.id]);
      sched = { id };
    }
    const ex = query('SELECT id FROM shift_entries WHERE schedule_id=? AND staff_id=? AND day=?', [sched.id, b.staff_id, day]).rows[0];
    let entryId = ex ? ex.id : null;
    if (codes === '') {
      if (ex) query('DELETE FROM shift_entries WHERE id = ?', [ex.id]);
      entryId = null;
    } else if (ex) {
      query(`UPDATE shift_entries SET codes = ?, updated_at = datetime('now') WHERE id = ?`, [codes, ex.id]);
    } else {
      entryId = uuid();
      query(`INSERT INTO shift_entries (id, schedule_id, staff_id, day, codes) VALUES (?,?,?,?,?)`, [entryId, sched.id, b.staff_id, day, codes]);
    }
    // ستارهٔ «مسئول شیفت»: برگه در هر روز فقط یک مسئول دارد؛ با روشن‌کردن ستارهٔ
    // یک نفر، ستارهٔ بقیهٔ همان روز خودکار خاموش می‌شود تا دو مسئول هم‌زمان نداشته باشیم.
    const lead = b.lead === true || b.lead === 1 || b.lead === '1';
    const leadOff = b.lead === false || b.lead === 0 || b.lead === '0';
    if (lead && entryId) {
      query('UPDATE shift_entries SET is_lead = 0 WHERE schedule_id = ? AND day = ? AND staff_id <> ?', [sched.id, day, b.staff_id]);
      query('UPDATE shift_entries SET is_lead = 1, updated_at = datetime(\'now\') WHERE id = ?', [entryId]);
    } else if (leadOff && entryId) {
      query('UPDATE shift_entries SET is_lead = 0 WHERE id = ?', [entryId]);
    }
    const isLead = lead && !!entryId;
    res.json({ status: 'updated', codes, hours: shiftCellHours(codes, getWardShiftSettings(req.hospitalId, acc.ward.title)), is_lead: isLead });
  } catch (err) { console.error('[ShiftSchedule]', err); res.status(500).json({ error: 'خطای سرور' }); }
});


module.exports = router;
