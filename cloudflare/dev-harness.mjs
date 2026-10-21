/* =====================================================================
   هارنسِ تستِ محلیِ ورکر (بدون نیاز به wrangler یا اینترنت)
   ---------------------------------------------------------------------
   چه می‌کند:
     1) یک کپیِ سازگار از database/hospital.db در پوشهٔ موقت می‌سازد
        (دیتابیسِ اصلی دست‌نخورده می‌ماند).
     2) شیم‌های D1 و ASSETS را از dev-shims.mjs می‌گیرد.
     3) worker.js را همان‌طور که Cloudflare اجرا می‌کند صدا می‌زند و یک
        باتری تست (ورود، نشست، بخش‌ها، پرسنل، برنامه، سلول/ستارهٔ مسئول،
        تنظیمات، قالب چاپ، ثبت فرم، رمز عبور) را اجرا می‌کند.

   اجرا:  node cloudflare/dev-harness.mjs
   ===================================================================== */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { loadWorkerEnv } from './dev-shims.mjs';

const require = createRequire(import.meta.url);

// حالت پیش‌فرض: کپیِ سازگار از database/hospital.db
// با آرگومان:  node cloudflare/dev-harness.mjs --db <path>  (مثلاً DB ساخته‌شده از schema.sql+seed.sql)
const argIdx = process.argv.indexOf('--db');
const dbArg = argIdx >= 0 ? process.argv[argIdx + 1] : null;
const { worker, env, db: raw, dbPath: TMP_DB } = await loadWorkerEnv(dbArg ? { dbPath: dbArg } : {});
const OWN_TMP = !dbArg;

/* ---------------- ابزار تست ---------------- */
const BASE = 'https://worker.local';
let cookie = null;
let pass = 0, fail = 0;
const failures = [];

function check(name, cond, extra) {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; failures.push(name); console.log(`FAIL  ${name}${extra !== undefined ? '  ::  ' + extra : ''}`); }
}

async function call(method, pathname, body, opts = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json; charset=utf-8';
  if (cookie && !opts.noCookie) headers['Cookie'] = opts.cookie || cookie;
  if (opts.headers) Object.assign(headers, opts.headers);
  const req = new Request(BASE + pathname, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const res = await worker.fetch(req, env);
  const sc = res.headers.get('set-cookie');
  if (sc && !opts.noCookie) cookie = sc.split(';')[0];
  const ct = res.headers.get('content-type') || '';
  let data;
  if (ct.includes('application/json')) data = await res.json();
  else data = Buffer.from(await res.arrayBuffer());
  return { status: res.status, data, headers: res.headers };
}

/* ---------------- دادهٔ مرجع از دیتابیس ---------------- */
const hospital = raw.prepare("SELECT id, name FROM hospitals WHERE is_active = 1 LIMIT 1").get();
const admin = raw.prepare(
  `SELECT u.id, u.full_name FROM users u JOIN roles r ON u.role_id = r.id
   WHERE u.hospital_id = ? AND u.is_active = 1 AND r.permissions LIKE '%manage_nursing_hierarchy%'
   ORDER BY u.full_name LIMIT 1`).get(hospital.id);
const wardRow = raw.prepare(
  `SELECT ward, COUNT(*) c FROM ward_staff WHERE hospital_id = ? AND is_active = 1
   GROUP BY ward ORDER BY c DESC LIMIT 1`).get(hospital.id);
const passwordRequired = (raw.prepare(
  "SELECT value FROM platform_settings WHERE key = 'require_password'").get() || {}).value === '1';

console.log('== harness: DB copy =', TMP_DB);
console.log('== hospital:', hospital.id, '| admin:', admin && admin.full_name, '| ward:', wardRow.ward, `(${wardRow.c} staff)`);

/* ---------------- ۱) پایه ---------------- */
{
  const r = await call('GET', '/healthz');
  check('healthz 200', r.status === 200 && r.data.status === 'ok', JSON.stringify(r.data));
}
{
  const r = await call('GET', '/api/public/hospitals');
  const ok = r.status === 200 && Array.isArray(r.data.hospitals) && r.data.hospitals[0] && r.data.hospitals[0].id === hospital.id;
  check('public hospitals', ok, JSON.stringify(r.data));
  const logo = await call('GET', `/api/public/hospital/${hospital.id}/logo`);
  check('public hospital logo (asset)', logo.status === 200 && String(logo.headers.get('content-type')).includes('image/webp'), `status=${logo.status}`);
  const logo404 = await call('GET', '/api/public/hospital/00000000-0000-0000-0000-000000000000/logo');
  check('public logo unknown hospital 404', logo404.status === 404);
}
{
  const r = await call('GET', '/api/server-time');
  check('server-time', r.status === 200 && r.data.jalali && r.data.jalali.jy >= 1400 && r.data.jalali.jd >= 1, JSON.stringify(r.data));
}
{
  const r = await call('GET', '/api/entry/require-password');
  check('entry require-password', r.status === 200 && typeof r.data.require_password === 'boolean', JSON.stringify(r.data));
}
{
  const r = await call('GET', `/api/entry/hospital/${hospital.id}/roles`);
  const ok = r.status === 200 && r.data.manager && Array.isArray(r.data.wards) && r.data.wards.length > 0;
  check('entry roles (tiles)', ok, `manager=${!!r.data.manager} wards=${r.data.wards && r.data.wards.length}`);
}

/* ---------------- ۲) ورود و نشست ---------------- */
{
  const r = await call('GET', '/api/auth/session', undefined, { noCookie: true, cookie: '' });
  check('session anonymous', r.status === 200 && r.data.authenticated === false, JSON.stringify(r.data));
}
{
  const r = await call('GET', '/api/shift/units');
  check('protected route without login = 401', r.status === 401, `status=${r.status}`);
}
{
  const r = await call('POST', '/api/entry/role-login', { user_id: '00000000-0000-0000-0000-000000000000' });
  check('role-login unknown user = 401', r.status === 401, `status=${r.status}`);
}
{
  const body = { user_id: admin.id };
  if (passwordRequired) body.password = '0000';
  const r = await call('POST', '/api/entry/role-login', body);
  check('role-login admin = 200 + cookie', r.status === 200 && cookie && cookie.startsWith('sid='), `status=${r.status}`);
}
{
  const r = await call('GET', '/api/auth/session');
  const u = r.data.user || {};
  const ok = r.status === 200 && r.data.authenticated === true && u.id === admin.id && Array.isArray(u.permissions) && u.permissions.includes('manage_nursing_hierarchy') && u.hospital_id === hospital.id && typeof u.hospital_has_logo === 'boolean';
  check('session user payload', ok, JSON.stringify({ id: u.id, perms: u.permissions && u.permissions.length, logo: u.hospital_has_logo }));
}

/* ---------------- ۳) بخش‌ها/واحدها ---------------- */
{
  const r = await call('GET', '/api/nursing/hierarchy');
  check('nursing hierarchy', r.status === 200 && Array.isArray(r.data.wards) && r.data.wards.length > 0, `wards=${r.data.wards && r.data.wards.length}`);
  const r2 = await call('GET', '/api/nursing/head/my-wards');
  check('nursing my-wards', r2.status === 200 && Array.isArray(r2.data.wards));
  const r3 = await call('GET', '/api/shift/units');
  check('shift units', r3.status === 200 && Array.isArray(r3.data.units), JSON.stringify(r3.data).slice(0, 120));
}

/* ---------------- ۴) پرسنل ---------------- */
{
  const r = await call('GET', `/api/shift/staff?ward=${encodeURIComponent(wardRow.ward)}`);
  const st = r.data.staff || [];
  const ok = r.status === 200 && st.length === wardRow.c && r.data.can_edit === true;
  check('staff list (count = DB)', ok, `status=${r.status} count=${st.length} expected=${wardRow.c}`);
  check('staff rows carry fixed_shift & hire_date fields', st.length > 0 && ('fixed_shift' in st[0]) && ('hire_date' in st[0]));
}
{
  // CRUD گذرا: ساخت → ویرایش (شیفت ثابت ME و تاریخ استخدام) → حذف
  const created = await call('POST', '/api/shift/staff', {
    ward: wardRow.ward, first_name: 'آزمون', last_name: 'هارنس', gender: 'زن',
    position: 'پرستار', fixed_shift: 'nN', hire_date: '1400/01/02', monthly_hour_quota: 169,
  });
  check('staff create (fixed_shift normalized)', created.status === 201 && created.data.id, JSON.stringify(created.data).slice(0, 120));
  const sid = created.data.id;
  const upd = await call('PUT', `/api/shift/staff/${sid}`, { fixed_shift: 'M', monthly_hour_quota: 176, is_active: 1 });
  check('staff update fixed_shift M', upd.status === 200, JSON.stringify(upd.data).slice(0, 120));
  const check1 = raw.prepare('SELECT fixed_shift, hire_date, monthly_hour_quota FROM ward_staff WHERE id = ?').get(sid);
  check('staff DB values after update', check1.fixed_shift === 'M' && check1.hire_date === '1400/01/02' && check1.monthly_hour_quota === 176, JSON.stringify(check1));
  const del = await call('DELETE', `/api/shift/staff/${sid}`);
  const gone = raw.prepare('SELECT COUNT(*) c FROM ward_staff WHERE id = ?').get(sid).c === 0;
  check('staff delete', del.status === 200 && gone, `status=${del.status}`);
}

/* ---------------- ۵) برنامهٔ ماهانه (۱۴۰۵/۶ — دادهٔ نمونه) ---------------- */
const ward = wardRow.ward;
const YEAR = 1405, MONTH = 6;
let schedule = null;
{
  const r = await call('GET', `/api/shift/schedule?ward=${encodeURIComponent(ward)}&year=${YEAR}&month=${MONTH}`);
  schedule = r.data;
  const ok = r.status === 200 && Array.isArray(r.data.staff) && r.data.schedule.days >= 29 && r.data.settings && typeof r.data.settings.hour_m === 'number';
  check('schedule fetch', ok, `status=${r.status} days=${r.data.schedule && r.data.schedule.days}`);
  check('schedule staff count = DB', r.data.staff.length === wardRow.c, `${r.data.staff.length} vs ${wardRow.c}`);
  // بازشماری headcount از سلول‌های همان پاسخ (مثل کاری که کلاینت می‌کند)
  const days = r.data.schedule.days;
  let mismatch = 0;
  for (let d = 1; d <= days; d++) {
    const rec = { M: 0, E: 0, N: 0, H: 0 };
    for (const s of r.data.staff) {
      const c = (s.cells && s.cells[d]) || '';
      for (const k of ['M', 'E', 'N', 'H']) if (c.includes(k)) rec[k]++;
    }
    const hc = r.data.headcount[d] || {};
    for (const k of ['M', 'E', 'N', 'H']) if ((hc[k] || 0) !== rec[k]) mismatch++;
  }
  check('server headcount == client recount (all days)', mismatch === 0, `mismatched day/shift cells: ${mismatch}`);
  const employees = r.data.staff.filter(s => Object.keys(s.cells || {}).length > 0).length;
  console.log(`      info: days=${days}, staff with cells=${employees}, sample headcount day1=`, JSON.stringify(r.data.headcount[1]));
}

/* ---------------- ۶) سلول + ستارهٔ مسئول شیفت ---------------- */
{
  const s0 = schedule.staff[0], s1 = schedule.staff[1];
  const orig0 = (s0.cells && s0.cells[1]) || '';
  const orig1 = (s1.cells && s1.cells[1]) || '';
  const origLead0 = !!(s0.leads && s0.leads[1]);
  const origLead1 = !!(s1.leads && s1.leads[1]);

  const p1 = await call('PUT', '/api/shift/schedule/cell', { ward, year: YEAR, month: MONTH, staff_id: s0.id, day: 1, codes: 'M', lead: true });
  check('cell PUT with lead', p1.status === 200 && p1.data.is_lead === true, JSON.stringify(p1.data));
  let g = await call('GET', `/api/shift/schedule?ward=${encodeURIComponent(ward)}&year=${YEAR}&month=${MONTH}`);
  let d1leads = g.data.staff.filter(s => s.leads && s.leads[1]);
  check('exactly one lead after set', d1leads.length === 1 && d1leads[0].id === s0.id, `leads=${d1leads.length}`);

  const p2 = await call('PUT', '/api/shift/schedule/cell', { ward, year: YEAR, month: MONTH, staff_id: s1.id, day: 1, codes: 'E', lead: true });
  g = await call('GET', `/api/shift/schedule?ward=${encodeURIComponent(ward)}&year=${YEAR}&month=${MONTH}`);
  d1leads = g.data.staff.filter(s => s.leads && s.leads[1]);
  check('lead moved (only latest staff)', p2.status === 200 && d1leads.length === 1 && d1leads[0].id === s1.id, `leads=${d1leads.length}`);

  await call('PUT', '/api/shift/schedule/cell', { ward, year: YEAR, month: MONTH, staff_id: s1.id, day: 1, codes: 'E', lead: false });
  g = await call('GET', `/api/shift/schedule?ward=${encodeURIComponent(ward)}&year=${YEAR}&month=${MONTH}`);
  check('lead off', g.data.staff.filter(s => s.leads && s.leads[1]).length === 0);

  const hcomb = await call('PUT', '/api/shift/schedule/cell', { ward, year: YEAR, month: MONTH, staff_id: s0.id, day: 1, codes: 'MH' });
  check('H + M rejected', hcomb.status === 400, `status=${hcomb.status}`);

  // بازگرداندن مقادیر اولیه (دیتابیس موقت است، ولی برای مقایسهٔ تمیز)
  await call('PUT', '/api/shift/schedule/cell', { ward, year: YEAR, month: MONTH, staff_id: s0.id, day: 1, codes: orig0, lead: origLead0 });
  await call('PUT', '/api/shift/schedule/cell', { ward, year: YEAR, month: MONTH, staff_id: s1.id, day: 1, codes: orig1, lead: origLead1 });
  const g2 = await call('GET', `/api/shift/schedule?ward=${encodeURIComponent(ward)}&year=${YEAR}&month=${MONTH}`);
  const s0b = g2.data.staff.find(s => s.id === s0.id), s1b = g2.data.staff.find(s => s.id === s1.id);
  check('restore original day1 cells', ((s0b.cells && s0b.cells[1]) || '') === orig0 && ((s1b.cells && s1b.cells[1]) || '') === orig1, `${orig0}/${orig1}`);
}

/* ---------------- ۷) یادداشت/تعطیلات/سطرهای دلخواه (ماه خالی ۱۴۰۶/۱) ---------------- */
{
  const Y = 1406, M = 1;
  const n1 = await call('PUT', '/api/shift/schedule/note', { ward, year: Y, month: M, note: 'یادداشت تست', holidays: [2, 9], description: 'توضیح تست' });
  check('note/holidays PUT', n1.status === 200, JSON.stringify(n1.data));
  let g = await call('GET', `/api/shift/schedule?ward=${encodeURIComponent(ward)}&year=${Y}&month=${M}`);
  const okNote = g.data.schedule.note === 'یادداشت تست' && JSON.stringify(g.data.schedule.holidays) === '[2,9]' && g.data.schedule.description === 'توضیح تست';
  check('note/holidays GET roundtrip', okNote, JSON.stringify(g.data.schedule));

  const r1 = await call('PUT', '/api/shift/schedule/custom-rows', { ward, year: Y, month: M, rows: [{ area: 'header', text: 'سطر آزمون', bold: 1, align: 'center' }, { area: 'footer', text: '', align: 'left' }] });
  check('custom-rows PUT (empty filtered)', r1.status === 200 && r1.data.rows.length === 1, JSON.stringify(r1.data));
  g = await call('GET', `/api/shift/schedule?ward=${encodeURIComponent(ward)}&year=${Y}&month=${M}`);
  check('custom-rows GET roundtrip', Array.isArray(g.data.schedule.custom_rows) && g.data.schedule.custom_rows.length === 1 && g.data.schedule.custom_rows[0].bold === 1, JSON.stringify(g.data.schedule.custom_rows));
}

/* ---------------- ۸) تنظیمات ساعت شیفت ---------------- */
{
  const r = await call('GET', `/api/shift/settings?ward=${encodeURIComponent(ward)}`);
  const cur = r.data.settings;
  check('settings GET', r.status === 200 && cur && typeof cur.hour_n === 'number', JSON.stringify(cur));
  const p = await call('PUT', '/api/shift/settings', { ward, ...cur });
  check('settings PUT (same values)', p.status === 200 && p.data.settings.hour_m === cur.hour_m && p.data.settings.clock_n === cur.clock_n, JSON.stringify(p.data));
  const bad = await call('PUT', '/api/shift/settings', { ward, ...cur, hour_m: 99 });
  check('settings PUT clamps invalid hours', bad.status === 200 && bad.data.settings.hour_m === cur.hour_m, JSON.stringify(bad.data.settings));
}

/* ---------------- ۹) قالب چاپ ---------------- */
{
  const r = await call('GET', '/api/shift/print-config');
  const cfg = r.data.config;
  check('print-config GET', r.status === 200 && cfg && Array.isArray(cfg.signatures) && typeof cfg.form_code === 'string', JSON.stringify(cfg && Object.keys(cfg)));
  const p = await call('PUT', '/api/shift/print-config', cfg);
  check('print-config PUT roundtrip', p.status === 200 && p.data.config.form_code === cfg.form_code && p.data.config.signatures.length === cfg.signatures.length, JSON.stringify(p.data.config && { fc: p.data.config.form_code, sig: p.data.config.signatures.length }));
  const g2 = await call('GET', '/api/shift/print-config');
  check('print-config persisted', g2.data.config.form_code === cfg.form_code && JSON.stringify(g2.data.config.reminders) === JSON.stringify(cfg.reminders));
  const six = await call('PUT', '/api/shift/print-config', { ...cfg, signatures: ['a', 'b', 'c', 'd', 'e', 'f'] });
  check('print-config accepts 6 signatures', six.status === 200 && six.data.config.signatures.length === 6);
  check('print-config rejects empty signatures (keeps old)', (await call('PUT', '/api/shift/print-config', { ...cfg, signatures: [] })).data.config.signatures.length === 6);
  await call('PUT', '/api/shift/print-config', cfg); // بازگردانی
}

/* ---------------- ۱۰) ثبت فرم کنترل‌شده ---------------- */
{
  const r1 = await call('POST', '/api/shift/register-form', {});
  check('register-form POST', r1.status === 200 && r1.data.document && /^[A-Z0-9]+-FM-\d+$/.test(r1.data.document.doc_code), JSON.stringify(r1.data.document));
  const r2 = await call('POST', '/api/shift/register-form', {});
  check('register-form idempotent', r2.status === 200 && r2.data.document.id === r1.data.document.id, JSON.stringify(r2.data.document));
  const g = await call('GET', '/api/shift/print-config');
  check('form_code saved into print-config', g.data.config.form_code === r1.data.document.doc_code);
}

/* ---------------- ۱۱) لوگو (سربرگ چاپ) و فایل‌های ثابت ---------------- */
{
  const r = await call('GET', '/api/hospital/logo');
  check('hospital logo (auth, asset)', r.status === 200 && String(r.headers.get('content-type')).includes('image/webp'), `status=${r.status}`);
  const idx = await call('GET', '/');
  const html = idx.data.toString('utf8');
  check('static index.html', idx.status === 200 && html.includes('shift-schedule.js'), `status=${idx.status}`);
  const css = await call('GET', '/css/app.css');
  check('static css', css.status === 200 && css.data.length > 1000, `status=${css.status}`);
  const spa = await call('GET', '/some/deep/link');
  check('SPA fallback serves index.html', spa.status === 200 && spa.data.toString('utf8').includes('shift-schedule.js'), `status=${spa.status}`);
  const nf = await call('GET', '/api/does/not/exist');
  check('unknown api = 404 json', nf.status === 404 && nf.data && nf.data.error, `status=${nf.status}`);
}

/* ---------------- ۱۲) رمز عبور (bcryptjs) ---------------- */
{
  const bcrypt = require('bcryptjs');
  const hash = bcrypt.hashSync('harmess-pass', 4);
  raw.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, admin.id);
  raw.prepare("UPDATE platform_settings SET value = '1' WHERE key = 'require_password'").run();

  const noPass = await call('POST', '/api/entry/role-login', { user_id: admin.id }, { noCookie: true });
  check('role-login without password rejected', noPass.status === 401 && /رمز/.test(noPass.data.error || ''), `status=${noPass.status}`);
  const wrong = await call('POST', '/api/entry/role-login', { user_id: admin.id, password: 'wrong' }, { noCookie: true });
  check('role-login wrong password rejected', wrong.status === 401, `status=${wrong.status}`);
  const good = await call('POST', '/api/entry/role-login', { user_id: admin.id, password: 'harmess-pass' }, { noCookie: true });
  check('role-login correct password accepted', good.status === 200 && good.data.user && good.data.user.id === admin.id, `status=${good.status}`);

  // بازگردانی مقدار تنظیم به حالت قبلی
  raw.prepare("UPDATE platform_settings SET value = '0' WHERE key = 'require_password'").run();
}

/* ---------------- ۱۳) خروج ---------------- */
{
  const r = await call('POST', '/api/auth/logout', {});
  check('logout clears cookie', r.status === 200 && String(r.headers.get('set-cookie') || '').startsWith('sid=;'), String(r.headers.get('set-cookie')).slice(0, 40));
  const s = await call('GET', '/api/auth/session', undefined, { cookie: 'sid=garbage' });
  check('invalid token -> anonymous', s.status === 200 && s.data.authenticated === false);
}

/* ---------------- نتیجه ---------------- */
console.log('');
console.log(`== RESULT: ${pass} passed, ${fail} failed`);
if (fail) console.log('== FAILED:', failures.join(' | '));

try { raw.close(); } catch (e) { /* */ }
if (OWN_TMP) { try { fs.unlinkSync(TMP_DB); } catch (e) { /* */ } }
process.exit(fail ? 1 : 0);
