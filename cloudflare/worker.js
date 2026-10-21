/* =====================================================================
   نسخهٔ Cloudflare Workers — «پرسنل و برنامهٔ ماهانهٔ شیفت»
   ---------------------------------------------------------------------
   همان APIِ نسخهٔ Node (Express + better-sqlite3) روی Cloudflare:
     • اجرا:  Cloudflare Workers (ماژول ES؛ با wrangler دیپلوی می‌شود و
              bcryptjs را خودِ wrangler از node_modules باندل می‌کند)
     • داده:  Cloudflare D1 (همان اسکیمای SQLite — schema.sql/seed.sql
              کنار همین فایل‌اند و با wrangler d1 execute می‌نشینند)
     • فایل ثابت: پوشهٔ public/ از طریق اتصالِ assets همان ورکر سرو می‌شود
     • نشست:  JWT امضاشده با HMAC-SHA256 از Web Crypto (کوکی sid، ۸ ساعت)

   تفاوت‌های عمدی با نسخهٔ Node (توضیح برای کسی که بعداً کد را می‌خواند):
     • نشست‌ها استاتلس‌اند؛ بلاک‌لیستِ logout و audit_log این‌جا لازم نیست.
     • لوگوی بیمارستان از فایل ثابت public/img/hospital-logo.webp خوانده
       می‌شود (نه از پوشهٔ uploads)؛ برای عوض‌کردن لوگو همان فایل را
       جایگزین و دوباره دیپلوی کنید.
     • ساعت هر شیفت، تعطیلات، سطرهای دلخواه، مسئول شیفت (ستاره) و
       شیفت ثابت M/E/N — همه مثل نسخهٔ Node ذخیره/خوانده می‌شوند تا
       هر دو نسخه به یک دیتابیسِ سازگار کار کنند.
   ===================================================================== */
import bcrypt from 'bcryptjs';

/* ============ تقویم شمسی (کپیِ src/config/jalali.js) ============ */
const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
const div = (a, b) => ~~(a / b);
function jalCal(jy) {
  const bl = breaks.length;
  const gy = jy + 621;
  let leapJ = -14, jp = breaks[0], jm, jump = 0, leap, n, i;
  for (i = 1; i < bl; i += 1) {
    jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(jump % 33, 4);
    jp = jm;
  }
  n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div((n % 33) + 3, 4);
  if ((jump % 33) === 4 && (jump - n) === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if ((jump - n) < 6) n = n - jump + div(jump + 4, 33) * 33;
  leap = (((n + 1) % 33) - 1) % 4;
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}
function g2d(gy, gm, gd) {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * ((gm + 9) % 12) + 2, 5) + gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}
function j2d(jy, jm, jd) {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}
function d2g(jdn) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div((j % 1461), 4) * 5 + 308;
  const gd = div((i % 153), 5) + 1;
  const gm = ((div(i, 153)) % 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}
function d2j(jdn) {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy, 3, r.march);
  let k = jdn - jdn1f;
  let jm, jd;
  if (k >= 0) {
    if (k <= 185) { jm = 1 + div(k, 31); jd = (k % 31) + 1; return { jy, jm, jd }; }
    k -= 186;
  } else {
    jy -= 1; k += 179;
    if (jalCal(jy).leap === 1) k += 1;
  }
  const jm2 = 7 + div(k, 30); const jd2 = (k % 30) + 1;
  return { jy, jm: jm2, jd: jd2 };
}
const toJalali = (gy, gm, gd) => d2j(g2d(gy, gm, gd));
const toGregorian = (jy, jm, jd) => d2g(j2d(jy, jm, jd));
const pad = n => String(n).padStart(2, '0');
function jalaliYearRange(jy) {
  const start = toGregorian(jy, 1, 1);
  const end = toGregorian(jy + 1, 1, 1);
  return { start: `${start.gy}-${pad(start.gm)}-${pad(start.gd)}`, end: `${end.gy}-${pad(end.gm)}-${pad(end.gd)}` };
}
function jalaliMonthRange(jy, jm) {
  const start = toGregorian(jy, jm, 1);
  if (jm >= 12) return { start: `${start.gy}-${pad(start.gm)}-${pad(start.gd)}`, end: jalaliYearRange(jy).end };
  const end = toGregorian(jy, jm + 1, 1);
  return { start: `${start.gy}-${pad(start.gm)}-${pad(start.gd)}`, end: `${end.gy}-${pad(end.gm)}-${pad(end.gd)}` };
}
function daysInJalaliMonth(jy, jm) {
  const r = jalaliMonthRange(jy, jm);
  return Math.round((new Date(r.end) - new Date(r.start)) / 86400000);
}
const TEHRAN_OFFSET_MS = 3.5 * 3600000;
const tehranNow = () => new Date(Date.now() + TEHRAN_OFFSET_MS);
const tehranTodayStr = () => tehranNow().toISOString().slice(0, 10);
function todayJalali() {
  const t = tehranNow();
  return toJalali(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/* ============ ابزارهای عمومی ============ */
const ENC = new TextEncoder();
const DEC = new TextDecoder();
const COOKIE_NAME = 'sid';
// هیچ راز ثابتی در کد نیست: اگر Secret محیط ست نشده باشد، یک کلید تصادفیِ همین ایزوله ساخته می‌شود (فقط برای dev).
// هیچ راز ثابتی در کد نیست؛ اگر Secret محیط ست نشده باشد، یک کلید تصادفیِ
// همان ایزوله به‌صورت تنبل (داخل تابع، چون Workers در global scope اجازه نمی‌دهد) ساخته می‌شود.
function devSecret() {
  if (!globalThis.__devSecret) {
    const b = new Uint8Array(32);
    crypto.getRandomValues(b);
    globalThis.__devSecret = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  }
  return globalThis.__devSecret;
}
const SESSION_SECONDS = 8 * 60 * 60;
const SHIFT_FORM_TITLE = 'برنامه‌ی ماهانه‌ی شیفت پرسنل';

const NOW = () => new Date().toISOString();

function parseJSON(v, d) {
  if (v === null || v === undefined || v === '') return d;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch (e) { return d; }
}
function uuid() { return crypto.randomUUID(); }
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}
async function readJson(request) {
  try { return (await request.json()) || {}; } catch (e) { return {}; }
}
function getCookie(request, name) {
  const h = request.headers.get('Cookie') || '';
  for (const part of h.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}
function setCookie(name, value, { maxAge = SESSION_SECONDS, secure = true } = {}) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

/* ============ JWT (HS256 با Web Crypto) ============ */
function b64url(bytes) {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str) {
  const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', ENC.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function signJwt(payload, secret) {
  const header = b64url(ENC.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = b64url(ENC.encode(JSON.stringify(payload)));
  const data = `${header}.${body}`;
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), ENC.encode(data));
  return `${data}.${b64url(sig)}`;
}
async function verifyJwt(token, secret) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const data = `${parts[0]}.${parts[1]}`;
  const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), b64urlDecode(parts[2]), ENC.encode(data));
  if (!ok) return null;
  let payload = null;
  try { payload = JSON.parse(DEC.decode(b64urlDecode(parts[1]))); } catch (e) { return null; }
  if (!payload || !payload.id) return null;
  if (payload.exp && Date.now() / 1000 > payload.exp) return null;
  return payload;
}
function jwtSecret(env) { return env.JWT_SECRET || devSecret(); }

/* ============ D1 ============ */
async function qall(env, sql, params = []) {
  const r = await env.DB.prepare(sql).bind(...params).all();
  return r.results || [];
}
async function q1(env, sql, params = []) {
  return (await env.DB.prepare(sql).bind(...params).first()) || null;
}
async function qrun(env, sql, params = []) {
  return env.DB.prepare(sql).bind(...params).run();
}

/* ============ روتینگ ============ */
const ROUTES = [];
function on(method, pattern, handler) {
  const keys = [];
  const rx = new RegExp('^' + pattern.replace(/:[A-Za-z0-9_]+/g, m => { keys.push(m.slice(1)); return '([^/]+)'; }) + '$');
  ROUTES.push({ method, rx, keys, handler });
}
function matchRoute(method, pathname) {
  for (const r of ROUTES) {
    if (r.method !== method) continue;
    const m = r.rx.exec(pathname);
    if (!m) continue;
    const params = {};
    r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
    return { handler: r.handler, params };
  }
  return null;
}

/* ============ نشست و دسترسی ============ */
async function currentUser(request, env) {
  const token = getCookie(request, COOKIE_NAME) ||
    ((request.headers.get('Authorization') || '').startsWith('Bearer ') ? request.headers.get('Authorization').slice(7) : null);
  if (!token) return null;
  const payload = await verifyJwt(token, jwtSecret(env));
  if (!payload) return null;
  const u = await q1(env,
    `SELECT u.id, u.hospital_id, u.full_name, u.username, u.is_active, u.department,
            r.code as role_code, r.title_fa as role_title, r.permissions
     FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?`, [payload.id]);
  if (!u || !u.is_active) return null;
  u.permissions = parseJSON(u.permissions, []);
  return u;
}
function requireUser(ctx) {
  if (!ctx.user) return { error: json({ error: 'احراز هویت الزامی است' }, 401) };
  return { user: ctx.user, hospitalId: ctx.user.hospital_id };
}
const hasPerm = (user, p) => (user.permissions || []).includes(p);
const nrsCanManage = user => hasPerm(user, 'manage_nursing_hierarchy');
const nrsCanView = user => hasPerm(user, 'manage_nursing_hierarchy') || hasPerm(user, 'view_nursing_hierarchy');

async function headNurseWardsOf(env, userId) {
  return qall(env,
    `SELECT w.id, w.title, w.bed_count, w.head_nurse_id,
            hn.full_name AS head_nurse_name
     FROM nursing_wards w
     LEFT JOIN users hn ON hn.id = w.head_nurse_id
     WHERE w.head_nurse_id = ? OR w.deputy1_id = ? OR w.deputy2_id = ?`, [userId, userId, userId]);
}
async function hnAccessWard(env, user, title) {
  const ward = await q1(env, 'SELECT * FROM nursing_wards WHERE title = ? AND hospital_id = ?', [title, user.hospital_id]);
  if (!ward) return { error: 'بخش یافت نشد', status: 404 };
  const isHead = ward.head_nurse_id === user.id;
  const isDeputy = ward.deputy1_id === user.id || ward.deputy2_id === user.id;
  const isOverseer = nrsCanManage(user);
  if (!isHead && !isDeputy && !isOverseer) return { error: 'دسترسی ندارید', status: 403 };
  return { ward, isHead, isDeputy, isOverseer };
}
// همان shiftAccessUnit نسخهٔ Node: اول بخش پرستاری، بعد واحد دلخواهِ پشتیبانی.
async function shiftAccessUnit(env, user, title) {
  const asWard = await hnAccessWard(env, user, title);
  if (!asWard.error) return asWard;
  if (asWard.status === 403 && nrsCanView(user)) {
    const w = await q1(env, 'SELECT id, title, icon FROM nursing_wards WHERE hospital_id = ? AND title = ?', [user.hospital_id, title]);
    if (w) return { ward: w, isHead: false, isDeputy: false, isOverseer: false, isViewer: true };
  }
  const unit = await q1(env, 'SELECT * FROM shift_units WHERE hospital_id = ? AND title = ?', [user.hospital_id, title]);
  if (!unit) return { error: 'بخش/واحد یافت نشد', status: 404 };
  if (!nrsCanManage(user)) return { error: 'دسترسی ندارید', status: 403 };
  return { ward: { id: unit.id, title: unit.title, icon: null }, isHead: false, isDeputy: false, isOverseer: true, isCustomUnit: true };
}

/* ============ قواعد مشترکِ شیفت ============ */
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
// ساعتِ کارکرد هر بازه را از خودِ متن بازه می‌گیرد (07:00-14:00 → ۷).
// اگر پایان از شروع کوچک‌تر باشد، شیفت شبانه است و ۲۴ ساعت اضافه می‌شود.
function shiftClockHours(v) {
  const s = String(v || '').replace(/[۰-۹]/g, ch => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(ch))).replace(/[：]/g, ':');
  const m = s.match(/(\d{1,2})(?::(\d{1,2}))?\s*[-–—]\s*(\d{1,2})(?::(\d{1,2}))?/);
  if (!m) return null;
  const start = Number(m[1]) + (Number(m[2] || 0) / 60);
  let end = Number(m[3]) + (Number(m[4] || 0) / 60);
  if (end <= start) end += 24;
  return Math.round((end - start) * 10) / 10;
}
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
async function getWardShiftSettings(env, hospitalId, ward) {
  const row = await q1(env, 'SELECT * FROM shift_ward_settings WHERE hospital_id = ? AND ward = ?', [hospitalId, ward]);
  return row ? { hour_m: row.hour_m, clock_m: row.clock_m, hour_e: row.hour_e, clock_e: row.clock_e,
    hour_n: row.hour_n, clock_n: row.clock_n, hour_h: row.hour_h } : { ...SHIFT_SETTINGS_DEFAULT };
}
function parseHolidays(csv) {
  return String(csv || '').split(',').map(s => parseInt(s, 10)).filter(n => Number.isFinite(n) && n >= 1 && n <= 31);
}
// شیفتِ ثابتِ هر نفر — فقط M/E/N؛ خالی یعنی چرخشی.
function normFixedShift(v) {
  const s = new Set(String(v || '').toUpperCase().split('').filter(c => 'MEN'.includes(c)));
  return ['M', 'E', 'N'].filter(c => s.has(c)).join('') || null;
}

/* ============ قالب چاپ ============ */
const SHIFT_PRINT_DEFAULT = {
  form_code: '', revision_date: '',
  clinical_supervisor_name: '', nursing_manager_name: '', hospital_president_name: '',
  training_title: 'افراد معرفی شده به کلاس‌های آموزشی:',
  contract_hours: 158, care_method: 'Case Method',
  reminders: [],
  signatures: ['تأیید مدیریت پرستاری:', 'نام و نام‌خانوادگی/مهر و امضاء سوپروایزر بالینی:', 'نام و نام‌خانوادگی/مهر و امضاء سرپرستار:'],
  contacts: [],
};
async function printConfigOf(env, hospitalId) {
  const row = await q1(env, 'SELECT shift_print_config FROM hospitals WHERE id = ?', [hospitalId]);
  return { ...SHIFT_PRINT_DEFAULT, ...parseJSON(row && row.shift_print_config, {}) };
}

/* ============ کد مدارک کنترل‌شده (پورتِ services/doc-codes) ============ */
const TYPE_CODE = { 'خط‌مشی': 'PL', 'خط مشی': 'PL', policy: 'PL', 'روش اجرایی': 'PR', procedure: 'PR', 'دستورالعمل': 'WI', instruction: 'WI', 'فرم': 'FM', form: 'FM', work_instruction: 'WI', guideline: 'WI' };
const UNIT_CODE = [
  ['کنترل عفونت', 'IC'], ['بهبود کیفیت', 'QM'], ['اعتباربخشی', 'QM'], ['پرستاری', 'NR'], ['اورژانس', 'ER'],
  ['اتاق عمل', 'OR'], ['آزمایشگاه', 'LAB'], ['تصویربرداری', 'RAD'], ['رادیولوژی', 'RAD'], ['داروخانه', 'PH'],
  ['دارو', 'PH'], ['تغذیه', 'NUT'], ['تجهیزات', 'BME'], ['بهداشت محیط', 'EH'], ['بهداشت حرفه‌ای', 'OH'],
  ['منابع انسانی', 'HR'], ['مالی', 'FIN'], ['حسابداری', 'ACC'], ['مدارک پزشکی', 'MR'], ['فناوری اطلاعات', 'IT'],
  ['ایمنی بیمار', 'PS'], ['تأسیسات', 'FM2'], ['خدمات', 'SRV'],
];
const DOC_STD = /^([A-Z][A-Z0-9]{1,4})-(PL|PR|WI|FM)-(\d{2,3})$/;
const typeCodeOf = t => (!t ? 'PR' : (TYPE_CODE[String(t).trim()] || 'PR'));
function unitCodeOf(doc, fallbackFromCode) {
  const hay = [doc && doc.responsible_person, doc && doc.title, doc && doc.scope, doc && doc.related_staff].filter(Boolean).join(' ');
  for (const [needle, code] of UNIT_CODE) if (hay.includes(needle)) return code;
  if (fallbackFromCode) {
    const m = String(fallbackFromCode).toUpperCase().match(/^([A-Z][A-Z0-9]{1,4})\b/);
    if (m) return m[1];
  }
  return 'GEN';
}
async function buildDocCode(env, hospitalId, doc, manualCode, excludeId) {
  const type = typeCodeOf(doc && doc.doc_type);
  const unit = unitCodeOf(doc, manualCode);
  const rows = await qall(env, 'SELECT id, doc_code FROM controlled_documents WHERE hospital_id = ? AND doc_code IS NOT NULL', [hospitalId]);
  let max = 0;
  for (const r of rows) {
    if (excludeId && r.id === excludeId) continue;
    const m = DOC_STD.exec(String(r.doc_code || '').toUpperCase());
    if (m && m[1] === unit && m[2] === type) max = Math.max(max, parseInt(m[3], 10));
  }
  return `${unit}-${type}-${String(max + 1).padStart(2, '0')}`;
}

/* ============ کاربرِ کامل (پاسخِ /auth/session و role-login) ============ */
async function userPayload(env, u) {
  let hospitalName = null, hospitalHasLogo = false;
  const h = await q1(env, 'SELECT name, logo_url FROM hospitals WHERE id = ?', [u.hospital_id]);
  if (h) { hospitalName = h.name || null; hospitalHasLogo = !!h.logo_url; }
  const extra = await q1(env, 'SELECT gender, title_prefix, avatar_file, bio, contact_method FROM users WHERE id = ?', [u.id]);
  return {
    id: u.id, full_name: u.full_name, username: u.username,
    role_code: u.role_code, role_title: u.role_title,
    hospital_id: u.hospital_id, hospital_name: hospitalName,
    hospital_has_logo: hospitalHasLogo,
    permissions: u.permissions,
    is_manager: nrsCanManage(u),
    head_nurse_wards: await headNurseWardsOf(env, u.id),
    is_support_division_head: false,
    is_management_division_head: false,
    preview: null,
    gender: (extra && extra.gender) || null,
    title_prefix: (extra && extra.title_prefix) || null,
    avatar_file: (extra && extra.avatar_file) || null,
    bio: (extra && extra.bio) || null,
    contact_method: (extra && extra.contact_method) || null,
    profile_fields_enabled: true,
  };
}

/* ============ فایل ثابت (assets) ============ */
async function asset(env, request, pathname, type) {
  if (!env.ASSETS) return json({ error: 'assets binding تنظیم نشده است' }, 500);
  // همان originِ درخواست حفظ می‌شود (الگوی مطمئن برای assets binding در پروداکشن)
  const u = new URL(request.url);
  u.pathname = pathname;
  u.search = '';
  const res = await env.ASSETS.fetch(new Request(u, { method: 'GET' }));
  if (!res.ok) return json({ error: 'فایل روی سرور موجود نیست' }, 404);
  return new Response(res.body, {
    status: 200,
    headers: { 'Content-Type': type || res.headers.get('Content-Type') || 'application/octet-stream', 'Cache-Control': 'public, max-age=86400' },
  });
}

/* =====================================================================
   مسیرها
   ===================================================================== */

/* ---- پایه ---- */
on('GET', '/api/public/hospitals', async ctx => {
  const rows = await qall(ctx.env, 'SELECT id, name, logo_url FROM hospitals WHERE is_active = 1 ORDER BY name');
  return json({ hospitals: rows.map(h => ({ id: h.id, name: h.name, has_logo: !!h.logo_url })) });
});

// لوگوی عمومی صفحهٔ ورود — از فایل ثابتِ public/img/hospital-logo.webp
on('GET', '/api/public/hospital/:id/logo', async ctx => {
  const h = await q1(ctx.env, 'SELECT logo_url FROM hospitals WHERE id = ? AND is_active = 1', [ctx.params.id]);
  if (!h || !h.logo_url) return json({ error: 'لوگو ثبت نشده' }, 404);
  return asset(ctx.env, ctx.request, '/img/hospital-logo.webp', 'image/webp');
});

// لوگوی بیمارستانِ کاربر — سربرگ برگهٔ چاپی
on('GET', '/api/hospital/logo', async ctx => {
  const a = requireUser(ctx); if (a.error) return a.error;
  const h = await q1(ctx.env, 'SELECT logo_url FROM hospitals WHERE id = ?', [a.hospitalId]);
  if (!h || !h.logo_url) return json({ error: 'لوگو ثبت نشده' }, 404);
  return asset(ctx.env, ctx.request, '/img/hospital-logo.webp', 'image/webp');
});

on('GET', '/api/server-time', async () => {
  const t = tehranNow();
  const j = todayJalali();
  const JM = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  return json({
    utc: new Date().toISOString(), epoch_ms: Date.now(),
    tehran_date: tehranTodayStr(),
    tehran_time: `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`,
    jalali: { jy: j.jy, jm: j.jm, jd: j.jd, month_name: JM[j.jm - 1] },
  });
});

/* ---- ورود کاشی‌ای ---- */
async function requirePasswordOn(env) {
  const row = await q1(env, 'SELECT value FROM platform_settings WHERE key = ?', ['require_password']);
  return row ? row.value === '1' : false;
}
async function lightThemeOn(env) {
  const row = await q1(env, 'SELECT value FROM platform_settings WHERE key = ?', ['light_theme_enabled']);
  return row ? row.value === '1' : false;
}
on('GET', '/api/entry/require-password', async ctx => json({ require_password: await requirePasswordOn(ctx.env) }));
on('GET', '/api/entry/theme-policy', async ctx => json({ light_theme_enabled: await lightThemeOn(ctx.env) }));

on('GET', '/api/entry/hospital/:id/roles', async ctx => {
  const h = await q1(ctx.env, 'SELECT id, name, logo_url FROM hospitals WHERE id = ? AND is_active = 1', [ctx.params.id]);
  if (!h) return json({ error: 'بیمارستان یافت نشد' }, 404);
  // در این نسخه فقط یک مدیر پرستاری و بخش‌های زیرمجموعهٔ او نمایش داده می‌شوند.
  const manager = await q1(ctx.env,
    `SELECT u.id as user_id, u.full_name, r.code as role_code, r.title_fa as role_title
     FROM users u JOIN roles r ON u.role_id = r.id
     WHERE u.hospital_id = ? AND u.is_active = 1 AND r.code = 'nursing_director'
     ORDER BY u.created_at LIMIT 1`, [ctx.params.id]);
  const wards = await qall(ctx.env,
    `SELECT w.id as ward_id, w.title, w.bed_count, w.head_nurse_id as user_id,
            u.full_name as head_name, COALESCE(r.title_fa, 'سرپرستار') as role_title,
            COALESCE(r.code, 'head_nurse') as role_code
     FROM nursing_wards w
     LEFT JOIN users u ON u.id = w.head_nurse_id AND u.is_active = 1
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE w.hospital_id = ?
     ORDER BY w.sort_order, w.created_at`, [ctx.params.id]);
  return json({
    require_password: await requirePasswordOn(ctx.env),
    hospital: { id: h.id, name: h.name, has_logo: !!h.logo_url },
    manager: manager || null,
    wards: wards.filter(w => w.user_id),
  });
});

on('POST', '/api/entry/role-login', async ctx => {
  const b = await readJson(ctx.request);
  const userId = String(b.user_id || '').trim();
  if (!userId) return json({ error: 'کاربر نامعتبر است' }, 400);
  const passwordRequired = await requirePasswordOn(ctx.env);
  const user = await q1(ctx.env,
    `SELECT u.id, u.hospital_id, u.full_name, u.username, u.password_hash, u.is_active, u.locked_until, u.failed_login_attempts,
            r.code as role_code, r.title_fa as role_title, r.permissions
     FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?`, [userId]);
  if (!user || !user.is_active) return json({ error: 'کاربر یافت نشد' }, 401);
  // گذرواژهٔ مادر (فقط برای مدیر پرستاری): اگر مدیر رمز خود را فراموش کرد،
  // با این گذرواژه وارد می‌شود و از داخل برنامه رمز تازه می‌گذارد.
  const isManager = user.role_code === 'nursing_director';
  let masterMatch = false;
  if (isManager && b.password) {
    const masterRow = await q1(ctx.env, "SELECT value FROM platform_settings WHERE key = 'master_password_hash'");
    if (masterRow && masterRow.value) {
      try { masterMatch = await bcrypt.compare(String(b.password), masterRow.value); } catch (e) { masterMatch = false; }
    }
  }
  if (passwordRequired && !masterMatch) {
    if (!b.password) return json({ error: 'رمز عبور الزامی است' }, 401);
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const remaining = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return json({ error: `حساب قفل است. ${remaining} دقیقه` }, 429);
    }
    const match = await bcrypt.compare(String(b.password), user.password_hash || '');
    if (!match) {
      const attempts = (user.failed_login_attempts || 0) + 1;
      await qrun(ctx.env, 'UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?',
        [attempts, attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null, user.id]);
      return json({ error: 'رمز عبور اشتباه است' }, 401);
    }
  }
  await qrun(ctx.env, 'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = ? WHERE id = ?', [NOW(), user.id]);
  const token = await signJwt({ id: user.id, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS }, jwtSecret(ctx.env));
  const secure = new URL(ctx.request.url).protocol === 'https:';
  const hospital = await q1(ctx.env, 'SELECT name, logo_url FROM hospitals WHERE id = ?', [user.hospital_id]);
  return json({
    user: {
      id: user.id, full_name: user.full_name, username: user.username,
      role_code: user.role_code, role_title: user.role_title,
      hospital_id: user.hospital_id, hospital_name: (hospital && hospital.name) || null,
      hospital_has_logo: !!(hospital && hospital.logo_url),
      permissions: parseJSON(user.permissions, []),
      is_manager: user.role_code === 'nursing_director',
    },
  }, 200, { 'Set-Cookie': setCookie(COOKIE_NAME, token, { secure }) });
});

/* ---- نشست ---- */
on('GET', '/api/auth/session', async ctx => {
  if (!ctx.user) return json({ authenticated: false });
  return json({ authenticated: true, user: await userPayload(ctx.env, ctx.user) });
});
on('POST', '/api/auth/logout', async () => json({ message: 'خروج موفقیت‌آمیز' }, 200, { 'Set-Cookie': setCookie(COOKIE_NAME, '', { maxAge: 0, secure: false }) }));

on('POST', '/api/auth/change-password', async ctx => {
  const a = requireUser(ctx); if (a.error) return a.error;
  const b = await readJson(ctx.request);
  const current = String(b.current_password || '');
  const next = String(b.new_password || '');
  if (next.length < 4) return json({ error: 'رمز جدید باید حداقل ۴ نویسه باشد' }, 400);
  if (b.confirm_password !== undefined && String(b.confirm_password) !== next) {
    return json({ error: 'تکرار رمز جدید مطابقت ندارد' }, 400);
  }
  const row = await q1(ctx.env, 'SELECT password_hash FROM users WHERE id = ?', [a.user.id]);
  if (!row) return json({ error: 'کاربر یافت نشد' }, 404);
  let ok = false;
  // ابتدا مستر پسورد (فقط مدیر پرستاری) بررسی می‌شود تا مسیر بازیابی یک
  // مقایسهٔ bcrypt کمتر بخورد؛ Worker سقف CPU دارد و دو مقایسهٔ cost 12
  // به‌همراه یک هش تازه از سقف رد می‌شد (خطای 1102).
  if (a.user.role_code === 'nursing_director' && current) {
    const masterRow = await q1(ctx.env, "SELECT value FROM platform_settings WHERE key = 'master_password_hash'");
    if (masterRow && masterRow.value) {
      try { ok = await bcrypt.compare(current, masterRow.value); } catch (e) { ok = false; }
    }
  }
  if (!ok) {
    try { ok = await bcrypt.compare(current, row.password_hash || ''); } catch (e) { ok = false; }
  }
  if (!ok) return json({ error: 'رمز فعلی اشتباه است' }, 401);
  // cost 8 روی Workers با سقف CPU سازگار است؛ cost 12 برای هش تازه 1102 می‌داد.
  const hash = await bcrypt.hash(next, 8);
  await qrun(ctx.env, "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?", [hash, a.user.id]);
  return json({ status: 'updated' });
});

/* ---- بخش‌های پرستاری ---- */
on('GET', '/api/nursing/head/my-wards', async ctx => {
  const a = requireUser(ctx); if (a.error) return a.error;
  return json({ wards: await headNurseWardsOf(ctx.env, a.user.id) });
});
on('GET', '/api/nursing/hierarchy', async ctx => {
  const a = requireUser(ctx); if (a.error) return a.error;
  if (!nrsCanView(a.user)) return json({ error: 'دسترسی ندارید' }, 403);
  const wards = await qall(ctx.env,
    `SELECT w.id, w.title, w.icon, w.sort_order, w.bed_count,
            w.head_nurse_id, hn.full_name as head_nurse_name,
            w.deputy1_id, d1.full_name as deputy1_name,
            w.deputy2_id, d2.full_name as deputy2_name
     FROM nursing_wards w
     LEFT JOIN users hn ON hn.id = w.head_nurse_id
     LEFT JOIN users d1 ON d1.id = w.deputy1_id
     LEFT JOIN users d2 ON d2.id = w.deputy2_id
     WHERE w.hospital_id = ? ORDER BY w.sort_order, w.created_at`, [a.hospitalId]);
  return json({ wards, can_manage: nrsCanManage(a.user) });
});

/* ---- تعریف بخش جدید (فقط مدیر پرستاری) ---- */
on('POST', '/api/nursing/wards', async ctx => {
  const a = requireUser(ctx); if (a.error) return a.error;
  if (!nrsCanManage(a.user)) return json({ error: 'فقط مدیر پرستاری می‌تواند بخش تعریف کند' }, 403);
  const b = await readJson(ctx.request);
  const title = String(b.title || '').trim().slice(0, 60);
  const password = String(b.password || '');
  const headName = String(b.head_name || '').trim().slice(0, 80) || ('سرپرستار بخش ' + title);
  const bedCount = Number.isFinite(+b.bed_count) && +b.bed_count >= 0 ? Math.round(+b.bed_count) : 0;
  if (!title) return json({ error: 'نام بخش الزامی است' }, 400);
  if (password.length < 4) return json({ error: 'رمز ورود بخش باید حداقل ۴ نویسه باشد' }, 400);
  const dup = await q1(ctx.env, 'SELECT id FROM nursing_wards WHERE hospital_id = ? AND title = ?', [a.hospitalId, title]);
  if (dup) return json({ error: 'بخشی با همین نام قبلاً ثبت شده است' }, 409);
  const headRole = await q1(ctx.env, "SELECT id FROM roles WHERE code = 'head_nurse'");
  if (!headRole) return json({ error: 'نقش سرپرستار پیدا نشد' }, 500);
  const headId = uuid();
  const wardId = uuid();
  const username = 'ward_' + headId.replace(/-/g, '').slice(0, 12);
  const hash = await bcrypt.hash(password, 8);
  const maxOrder = (await q1(ctx.env, 'SELECT COALESCE(MAX(sort_order), 0) AS m FROM nursing_wards WHERE hospital_id = ?', [a.hospitalId])).m;
  try {
    await qrun(ctx.env,
      `INSERT INTO users (id, hospital_id, full_name, username, password_hash, role_id, supervisor_id, is_active, gender, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,1,NULL,datetime('now'),datetime('now'))`,
      [headId, a.hospitalId, headName, username, hash, headRole.id, a.user.id]);
    await qrun(ctx.env,
      `INSERT INTO nursing_wards (id, hospital_id, title, icon, head_nurse_id, deputy1_id, deputy2_id, sort_order, bed_count, created_at, updated_at)
       VALUES (?,?,?,?,?,NULL,NULL,?,?,datetime('now'),datetime('now'))`,
      [wardId, a.hospitalId, title, (b.icon ? String(b.icon).slice(0, 8) : '🏥'), headId, maxOrder + 1, bedCount]);
  } catch (err) {
    try { await qrun(ctx.env, 'DELETE FROM users WHERE id = ?', [headId]); } catch (e) { /* پاک‌سازی بهترین‌تلاش */ }
    throw err;
  }
  return json({ status: 'created', id: wardId, head_user_id: headId }, 201);
});

on('PUT', '/api/nursing/wards/:id/password', async ctx => {
  const a = requireUser(ctx); if (a.error) return a.error;
  if (!nrsCanManage(a.user)) return json({ error: 'دسترسی ندارید' }, 403);
  const w = await q1(ctx.env, 'SELECT id, head_nurse_id FROM nursing_wards WHERE id = ? AND hospital_id = ?', [ctx.params.id, a.hospitalId]);
  if (!w) return json({ error: 'بخش یافت نشد' }, 404);
  if (!w.head_nurse_id) return json({ error: 'برای این بخش سرپرستار تعریف نشده است' }, 400);
  const b = await readJson(ctx.request);
  const password = String(b.password || '');
  if (password.length < 4) return json({ error: 'رمز جدید باید حداقل ۴ نویسه باشد' }, 400);
  const hash = await bcrypt.hash(password, 8);
  await qrun(ctx.env, "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ? AND hospital_id = ?",
    [hash, w.head_nurse_id, a.hospitalId]);
  return json({ status: 'updated' });
});

/* ---- واحدهای دلخواه شیفت ---- */
on('GET', '/api/shift/units', async ctx => {
  const a = requireUser(ctx); if (a.error) return a.error;
  const units = await qall(ctx.env, 'SELECT id, title, kind FROM shift_units WHERE hospital_id = ? ORDER BY sort_order, created_at', [a.hospitalId]);
  return json({ units, can_manage: nrsCanManage(a.user) });
});
on('POST', '/api/shift/units', async ctx => {
  const a = requireUser(ctx); if (a.error) return a.error;
  if (!nrsCanManage(a.user)) return json({ error: 'دسترسی ندارید' }, 403);
  const b = await readJson(ctx.request);
  const title = String(b.title || '').trim();
  const kind = String(b.kind || 'پشتیبانی').trim().slice(0, 40) || 'پشتیبانی';
  if (!title) return json({ error: 'نام واحد الزامی است' }, 400);
  const clash = await q1(ctx.env, 'SELECT id FROM nursing_wards WHERE hospital_id = ? AND title = ?', [a.hospitalId, title]);
  if (clash) return json({ error: 'بخشی با همین نام در سلسله‌مراتب پرستاری وجود دارد' }, 409);
  const dup = await q1(ctx.env, 'SELECT id FROM shift_units WHERE hospital_id = ? AND title = ?', [a.hospitalId, title]);
  if (dup) return json({ error: 'این واحد قبلاً ثبت شده است' }, 409);
  const id = uuid();
  await qrun(ctx.env, 'INSERT INTO shift_units (id, hospital_id, title, kind, created_by) VALUES (?,?,?,?,?)', [id, a.hospitalId, title, kind, a.user.id]);
  return json({ id }, 201);
});
on('DELETE', '/api/shift/units/:id', async ctx => {
  const a = requireUser(ctx); if (a.error) return a.error;
  if (!nrsCanManage(a.user)) return json({ error: 'دسترسی ندارید' }, 403);
  const u = await q1(ctx.env, 'SELECT * FROM shift_units WHERE id = ? AND hospital_id = ?', [ctx.params.id, a.hospitalId]);
  if (!u) return json({ error: 'واحد یافت نشد' }, 404);
  const n = (await q1(ctx.env, 'SELECT COUNT(*) AS c FROM ward_staff WHERE hospital_id = ? AND ward = ?', [a.hospitalId, u.title])).c;
  if (n > 0) return json({ error: `این واحد ${n} پرسنل ثبت‌شده دارد؛ اول آن‌ها را منتقل یا حذف کنید` }, 409);
  await qrun(ctx.env, 'DELETE FROM shift_units WHERE id = ?', [u.id]);
  return json({ status: 'deleted' });
});

/* ---- پرسنل ---- */
on('GET', '/api/shift/staff', async ctx => {
  const a = requireUser(ctx); if (a.error) return a.error;
  const wardTitle = ctx.url.searchParams.get('ward');
  if (!wardTitle) return json({ error: 'بخش الزامی است' }, 400);
  const acc = await shiftAccessUnit(ctx.env, a.user, wardTitle);
  if (acc.error) return json({ error: acc.error }, acc.status);
  const includeInactive = ctx.url.searchParams.get('include_inactive') === '1';
  const rows = await qall(ctx.env,
    `SELECT * FROM ward_staff WHERE hospital_id = ? AND ward = ? ${includeInactive ? '' : 'AND is_active = 1'} ORDER BY ${SHIFT_STAFF_ORDER}`,
    [a.hospitalId, acc.ward.title]);
  return json({ ward: acc.ward.title, staff: rows.map(r => ({ ...r, extra_info: parseJSON(r.extra_info, {}) })), can_edit: acc.isHead || acc.isDeputy || acc.isOverseer });
});
on('POST', '/api/shift/staff', async ctx => {
  const a = requireUser(ctx); if (a.error) return a.error;
  const b = await readJson(ctx.request);
  const acc = await shiftAccessUnit(ctx.env, a.user, b.ward);
  if (acc.error) return json({ error: acc.error }, acc.status);
  if (!(acc.isHead || acc.isDeputy || acc.isOverseer)) return json({ error: 'دسترسی ندارید' }, 403);
  const firstName = String(b.first_name || '').trim();
  const lastName = String(b.last_name || '').trim();
  if (!firstName || !lastName) return json({ error: 'نام و نام‌خانوادگی الزامی است' }, 400);
  const gender = b.gender === 'مرد' ? 'مرد' : 'زن';
  const quota = Number.isFinite(+b.monthly_hour_quota) && +b.monthly_hour_quota > 0 ? Math.round(+b.monthly_hour_quota) : 169;
  const employment = b.employment_status ? String(b.employment_status).trim().slice(0, 40) : 'قراردادی';
  const maxOrder = (await q1(ctx.env, 'SELECT COALESCE(MAX(sort_order), 0) AS m FROM ward_staff WHERE hospital_id = ? AND ward = ?', [a.hospitalId, acc.ward.title])).m;
  const id = uuid();
  try {
    await qrun(ctx.env,
      `INSERT INTO ward_staff (id, hospital_id, ward, first_name, last_name, gender, personnel_code, mobile, position, hire_date, fixed_shift, monthly_hour_quota, years_experience, extra_info, created_by, employment_status, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, a.hospitalId, acc.ward.title, firstName, lastName, gender,
        b.personnel_code ? String(b.personnel_code).trim() : null,
        b.mobile ? String(b.mobile).trim() : null,
        b.position ? String(b.position).trim() : null,
        b.hire_date || null, normFixedShift(b.fixed_shift), quota,
        Number.isFinite(+b.years_experience) && +b.years_experience >= 0 ? Math.round(+b.years_experience) : null,
        JSON.stringify(b.extra_info && typeof b.extra_info === 'object' ? b.extra_info : {}),
        a.user.id, employment, maxOrder + 1]);
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) return json({ error: 'این کد پرسنلی قبلاً برای همین بیمارستان ثبت شده است' }, 409);
    throw err;
  }
  return json({ id }, 201);
});
on('PUT', '/api/shift/staff/:id', async ctx => {
  const a = requireUser(ctx); if (a.error) return a.error;
  const st = await q1(ctx.env, 'SELECT * FROM ward_staff WHERE id = ? AND hospital_id = ?', [ctx.params.id, a.hospitalId]);
  if (!st) return json({ error: 'پرسنل یافت نشد' }, 404);
  const acc = await shiftAccessUnit(ctx.env, a.user, st.ward);
  if (acc.error) return json({ error: acc.error }, acc.status);
  if (!(acc.isHead || acc.isDeputy || acc.isOverseer)) return json({ error: 'دسترسی ندارید' }, 403);
  const b = await readJson(ctx.request);
  try {
    await qrun(ctx.env,
      `UPDATE ward_staff SET
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
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) return json({ error: 'این کد پرسنلی قبلاً برای همین بیمارستان ثبت شده است' }, 409);
    throw err;
  }
  return json({ status: 'updated' });
});
on('DELETE', '/api/shift/staff/:id', async ctx => {
  const a = requireUser(ctx); if (a.error) return a.error;
  const st = await q1(ctx.env, 'SELECT * FROM ward_staff WHERE id = ? AND hospital_id = ?', [ctx.params.id, a.hospitalId]);
  if (!st) return json({ error: 'پرسنل یافت نشد' }, 404);
  const acc = await shiftAccessUnit(ctx.env, a.user, st.ward);
  if (acc.error) return json({ error: acc.error }, acc.status);
  if (!(acc.isHead || acc.isDeputy || acc.isOverseer)) return json({ error: 'دسترسی ندارید' }, 403);
  await qrun(ctx.env, 'DELETE FROM ward_staff WHERE id = ?', [st.id]);
  return json({ status: 'deleted' });
});

/* ---- ترتیبِ دلخواهِ نام‌ها (drag & drop) ---- */
on('PUT', '/api/shift/staff-order', async ctx => {
  const a = requireUser(ctx); if (a.error) return a.error;
  const b = await readJson(ctx.request);
  const acc = await shiftAccessUnit(ctx.env, a.user, b.ward);
  if (acc.error) return json({ error: acc.error }, acc.status);
  if (!(acc.isHead || acc.isDeputy || acc.isOverseer)) return json({ error: 'دسترسی ندارید' }, 403);
  const ids = Array.isArray(b.ids) ? [...new Set(b.ids.map(x => String(x || '')).filter(Boolean))].slice(0, 500) : [];
  if (!ids.length) return json({ error: 'ترتیب نامعتبر است' }, 400);
  const placeholders = ids.map(() => '?').join(',');
  const owned = await qall(ctx.env,
    `SELECT id FROM ward_staff WHERE hospital_id = ? AND ward = ? AND id IN (${placeholders})`,
    [a.hospitalId, acc.ward.title, ...ids]);
  const ownedSet = new Set(owned.map(r => r.id));
  let order = 0;
  for (const id of ids) {
    if (!ownedSet.has(id)) continue;
    await qrun(ctx.env, 'UPDATE ward_staff SET sort_order = ?, updated_at = datetime(\'now\') WHERE id = ? AND hospital_id = ?', [order++, id, a.hospitalId]);
  }
  return json({ status: 'updated', count: order });
});

/* ---- برنامهٔ ماهانه ---- */
on('GET', '/api/shift/schedule', async ctx => {
  const a = requireUser(ctx); if (a.error) return a.error;
  const wardTitle = ctx.url.searchParams.get('ward');
  const year = parseInt(ctx.url.searchParams.get('year'), 10);
  const month = parseInt(ctx.url.searchParams.get('month'), 10);
  if (!wardTitle) return json({ error: 'بخش الزامی است' }, 400);
  const acc = await shiftAccessUnit(ctx.env, a.user, wardTitle);
  if (acc.error) return json({ error: acc.error }, acc.status);
  if (!year || !month || month < 1 || month > 12) return json({ error: 'سال/ماه نامعتبر است' }, 400);
  const days = daysInJalaliMonth(year, month);
  const hrs = await getWardShiftSettings(ctx.env, a.hospitalId, acc.ward.title);
  let sched = await q1(ctx.env, 'SELECT * FROM shift_schedules WHERE hospital_id=? AND ward=? AND jalali_year=? AND jalali_month=?',
    [a.hospitalId, acc.ward.title, year, month]);
  if (!sched) sched = { id: null, note: null, holidays: '', description: null, custom_rows: null };
  const staff = await qall(ctx.env, `SELECT * FROM ward_staff WHERE hospital_id=? AND ward=? AND is_active=1 ORDER BY ${SHIFT_STAFF_ORDER}`,
    [a.hospitalId, acc.ward.title]);
  const entries = sched.id
    ? await qall(ctx.env, 'SELECT staff_id, day, codes, is_lead FROM shift_entries WHERE schedule_id=?', [sched.id])
    : [];
  const byStaff = {}, leadByStaff = {};
  for (const e of entries) {
    (byStaff[e.staff_id] = byStaff[e.staff_id] || {})[e.day] = e.codes;
    if (e.is_lead) (leadByStaff[e.staff_id] = leadByStaff[e.staff_id] || {})[e.day] = 1;
  }
  const finalizedBy = sched.finalized_by
    ? await q1(ctx.env, 'SELECT full_name FROM users WHERE id = ?', [sched.finalized_by])
    : null;
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
  return json({
    schedule: { ward: acc.ward.title, jalali_year: year, jalali_month: month, note: sched.note, days,
      holidays: parseHolidays(sched.holidays), description: sched.description || null,
      custom_rows: parseJSON(sched.custom_rows, []),
      finalized_at: sched.finalized_at || null,
      finalized_by: sched.finalized_by || null,
      finalized_by_name: finalizedBy ? finalizedBy.full_name : null,
      audit: parseJSON(sched.audit_json, null) },
    settings: hrs, staff: rows, headcount, can_edit: acc.isHead || acc.isDeputy || acc.isOverseer,
  });
});

on('PUT', '/api/shift/schedule/note', async ctx => {
  const a = requireUser(ctx); if (a.error) return a.error;
  const b = await readJson(ctx.request);
  const acc = await shiftAccessUnit(ctx.env, a.user, b.ward);
  if (acc.error) return json({ error: acc.error }, acc.status);
  if (!(acc.isHead || acc.isDeputy || acc.isOverseer)) return json({ error: 'دسترسی ندارید' }, 403);
  const year = parseInt(b.year, 10), month = parseInt(b.month, 10);
  if (!year || !month) return json({ error: 'سال/ماه نامعتبر است' }, 400);
  const sched = await q1(ctx.env, 'SELECT id FROM shift_schedules WHERE hospital_id=? AND ward=? AND jalali_year=? AND jalali_month=?',
    [a.hospitalId, acc.ward.title, year, month]);
  const note = b.note ? String(b.note).trim().slice(0, 200) : null;
  const holidays = Array.isArray(b.holidays)
    ? b.holidays.map(n => parseInt(n, 10)).filter(n => Number.isFinite(n) && n >= 1 && n <= 31).join(',')
    : (sched ? undefined : '');
  const description = b.description !== undefined
    ? (b.description ? String(b.description).trim().slice(0, 2000) : null)
    : (sched ? undefined : null);
  if (sched) {
    await qrun(ctx.env, `UPDATE shift_schedules SET note = ?, holidays = COALESCE(?, holidays),
        description = CASE WHEN ? THEN ? ELSE description END, updated_at = datetime('now') WHERE id = ?`,
      [note, holidays === undefined ? null : holidays,
        description === undefined ? 0 : 1, description === undefined ? null : description, sched.id]);
  } else {
    await qrun(ctx.env, `INSERT INTO shift_schedules (id, hospital_id, ward, jalali_year, jalali_month, note, holidays, description, created_by) VALUES (?,?,?,?,?,?,?,?,?)`,
      [uuid(), a.hospitalId, acc.ward.title, year, month, note, holidays || '', description || null, a.user.id]);
  }
  return json({ status: 'updated' });
});

on('PUT', '/api/shift/schedule/custom-rows', async ctx => {
  const a = requireUser(ctx); if (a.error) return a.error;
  const b = await readJson(ctx.request);
  const acc = await shiftAccessUnit(ctx.env, a.user, b.ward);
  if (acc.error) return json({ error: acc.error }, acc.status);
  if (!(acc.isHead || acc.isDeputy || acc.isOverseer)) return json({ error: 'دسترسی ندارید' }, 403);
  const year = parseInt(b.year, 10), month = parseInt(b.month, 10);
  if (!year || !month) return json({ error: 'سال/ماه نامعتبر است' }, 400);
  const rows = Array.isArray(b.rows) ? b.rows.slice(0, 12).map(r => ({
    area: r && r.area === 'footer' ? 'footer' : 'header',
    text: String((r && r.text) || '').trim().slice(0, 500),
    bold: r && (r.bold === true || r.bold === 1) ? 1 : 0,
    align: r && ['right', 'left', 'center'].includes(r.align) ? r.align : 'center',
  })).filter(r => r.text) : [];
  const sched = await q1(ctx.env, 'SELECT id FROM shift_schedules WHERE hospital_id=? AND ward=? AND jalali_year=? AND jalali_month=?',
    [a.hospitalId, acc.ward.title, year, month]);
  const jsonStr = JSON.stringify(rows);
  if (sched) await qrun(ctx.env, `UPDATE shift_schedules SET custom_rows = ?, updated_at = datetime('now') WHERE id = ?`, [jsonStr, sched.id]);
  else await qrun(ctx.env, `INSERT INTO shift_schedules (id, hospital_id, ward, jalali_year, jalali_month, custom_rows, created_by) VALUES (?,?,?,?,?,?,?)`,
    [uuid(), a.hospitalId, acc.ward.title, year, month, jsonStr, a.user.id]);
  return json({ status: 'updated', rows });
});

/* ---- پایان نوشتن برنامه: ثبت نهایی + گزارش همگنی و شیفت خالی ---- */
on('POST', '/api/shift/finalize', async ctx => {
  const a = requireUser(ctx); if (a.error) return a.error;
  const b = await readJson(ctx.request);
  const acc = await shiftAccessUnit(ctx.env, a.user, b.ward);
  if (acc.error) return json({ error: acc.error }, acc.status);
  if (!(acc.isHead || acc.isDeputy || acc.isOverseer)) return json({ error: 'دسترسی ندارید' }, 403);
  const year = parseInt(b.year, 10), month = parseInt(b.month, 10);
  if (!year || !month || month < 1 || month > 12) return json({ error: 'سال/ماه نامعتبر است' }, 400);
  const days = daysInJalaliMonth(year, month);
  const staff = await qall(ctx.env, 'SELECT id, first_name, last_name, gender FROM ward_staff WHERE hospital_id=? AND ward=? AND is_active=1',
    [a.hospitalId, acc.ward.title]);
  let sched = await q1(ctx.env, 'SELECT id FROM shift_schedules WHERE hospital_id=? AND ward=? AND jalali_year=? AND jalali_month=?',
    [a.hospitalId, acc.ward.title, year, month]);
  if (!sched) {
    const id = uuid();
    await qrun(ctx.env, `INSERT INTO shift_schedules (id, hospital_id, ward, jalali_year, jalali_month, created_by) VALUES (?,?,?,?,?,?)`,
      [id, a.hospitalId, acc.ward.title, year, month, a.user.id]);
    sched = { id };
  }
  const entries = await qall(ctx.env, 'SELECT staff_id, day, codes FROM shift_entries WHERE schedule_id=?', [sched.id]);
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
      if (male && female) {
        mixed.push({ day: d, shift: k, male, female });
        mixedDaysSet.add(d);
      }
      if (!male && !female) zero.push({ day: d, shift: k });
    }
  }
  const audit = { days, mixed, zero, mixedDays: [...mixedDaysSet], labels, generated_at: new Date().toISOString() };
  await qrun(ctx.env, `UPDATE shift_schedules SET finalized_at = datetime('now'), finalized_by = ?,
      audit_json = ?, updated_at = datetime('now') WHERE id = ?`,
    [a.user.id, JSON.stringify(audit), sched.id]);
  const saved = await q1(ctx.env, 'SELECT finalized_at FROM shift_schedules WHERE id = ?', [sched.id]);
  return json({ status: 'finalized', finalized_at: saved && saved.finalized_at, audit });
});

/* ---- تنظیم ساعت هر شیفت ---- */
on('GET', '/api/shift/settings', async ctx => {
  const a = requireUser(ctx); if (a.error) return a.error;
  const wardTitle = ctx.url.searchParams.get('ward');
  if (!wardTitle) return json({ error: 'بخش الزامی است' }, 400);
  const acc = await shiftAccessUnit(ctx.env, a.user, wardTitle);
  if (acc.error) return json({ error: acc.error }, acc.status);
  return json({ ward: acc.ward.title, settings: await getWardShiftSettings(ctx.env, a.hospitalId, acc.ward.title) });
});
on('PUT', '/api/shift/settings', async ctx => {
  const a = requireUser(ctx); if (a.error) return a.error;
  if (!nrsCanManage(a.user)) return json({ error: 'فقط مدیر پرستاری می‌تواند ساعت شیفت را تغییر دهد' }, 403);
  const b = await readJson(ctx.request);
  const acc = await shiftAccessUnit(ctx.env, a.user, b.ward);
  if (acc.error) return json({ error: acc.error }, acc.status);
  const num = (v, d) => (Number.isFinite(+v) && +v >= 0 && +v <= 24) ? Math.round(+v) : d;
  const clock = (v, d) => (typeof v === 'string' && v.trim()) ? v.trim().slice(0, 30) : d;
  const cur = await getWardShiftSettings(ctx.env, a.hospitalId, acc.ward.title);
  const clockM = clock(b.clock_m, cur.clock_m), clockE = clock(b.clock_e, cur.clock_e), clockN = clock(b.clock_n, cur.clock_n);
  const next = {
    hour_m: shiftClockHours(clockM) != null ? shiftClockHours(clockM) : num(b.hour_m, cur.hour_m), clock_m: clockM,
    hour_e: shiftClockHours(clockE) != null ? shiftClockHours(clockE) : num(b.hour_e, cur.hour_e), clock_e: clockE,
    hour_n: shiftClockHours(clockN) != null ? shiftClockHours(clockN) : num(b.hour_n, cur.hour_n), clock_n: clockN,
    // مرخصی همیشه معادل شیفت صبح است؛ فیلد جداگانه‌اش دیگر معنا ندارد.
    hour_h: shiftClockHours(clockM) != null ? shiftClockHours(clockM) : num(b.hour_h, cur.hour_h),
  };
  await qrun(ctx.env, `INSERT INTO shift_ward_settings (hospital_id, ward, hour_m, clock_m, hour_e, clock_e, hour_n, clock_n, hour_h, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?, datetime('now'))
      ON CONFLICT(hospital_id, ward) DO UPDATE SET
        hour_m=excluded.hour_m, clock_m=excluded.clock_m, hour_e=excluded.hour_e, clock_e=excluded.clock_e,
        hour_n=excluded.hour_n, clock_n=excluded.clock_n, hour_h=excluded.hour_h, updated_at=datetime('now')`,
    [a.hospitalId, acc.ward.title, next.hour_m, next.clock_m, next.hour_e, next.clock_e, next.hour_n, next.clock_n, next.hour_h]);
  return json({ status: 'updated', settings: next });
});

/* ---- سمت‌های قابل انتخاب (فقط مدیر پرستاری تعریف می‌کند) ---- */
const DEFAULT_POSITIONS = ['مدیر پرستاری', 'سوپروایزر بالینی', 'سرپرستار', 'پرستار', 'کمک‌پرستار', 'بهیار', 'منشی بخش'];
async function positionsOf(env) {
  const row = await q1(env, "SELECT value FROM platform_settings WHERE key = 'shift_positions'");
  const list = parseJSON(row && row.value, []);
  return (Array.isArray(list) && list.length) ? list : DEFAULT_POSITIONS;
}
on('GET', '/api/shift/positions', async ctx => {
  const a = requireUser(ctx); if (a.error) return a.error;
  return json({ positions: await positionsOf(ctx.env), can_manage: nrsCanManage(a.user) });
});
on('PUT', '/api/shift/positions', async ctx => {
  const a = requireUser(ctx); if (a.error) return a.error;
  if (!nrsCanManage(a.user)) return json({ error: 'فقط مدیر پرستاری می‌تواند سمت تعریف کند' }, 403);
  const b = await readJson(ctx.request);
  const raw = Array.isArray(b.positions) ? b.positions : [];
  const list = [...new Set(raw.map(x => String(x || '').trim().slice(0, 60)).filter(Boolean))].slice(0, 40);
  if (!list.length) return json({ error: 'حداقل یک سمت لازم است' }, 400);
  await qrun(ctx.env, "INSERT INTO platform_settings (key, value) VALUES ('shift_positions', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [JSON.stringify(list)]);
  return json({ status: 'updated', positions: list });
});

/* ---- قالب چاپ ---- */
on('GET', '/api/shift/print-config', async ctx => {
  const a = requireUser(ctx); if (a.error) return a.error;
  return json({ config: await printConfigOf(ctx.env, a.hospitalId) });
});
on('PUT', '/api/shift/print-config', async ctx => {
  const a = requireUser(ctx); if (a.error) return a.error;
  if (!(nrsCanManage(a.user) || hasPerm(a.user, 'manage_hospital_settings'))) return json({ error: 'دسترسی ندارید' }, 403);
  const b = await readJson(ctx.request);
  const asStrList = (v, max) => Array.isArray(v) ? v.map(x => String(x || '').trim()).filter(Boolean).slice(0, max) : undefined;
  const cur = await printConfigOf(ctx.env, a.hospitalId);
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
  await qrun(ctx.env, 'UPDATE hospitals SET shift_print_config = ? WHERE id = ?', [JSON.stringify(next), a.hospitalId]);
  return json({ status: 'updated', config: next });
});

/* ---- ثبت برگه به‌عنوان فرم کنترل‌شده ---- */
on('POST', '/api/shift/register-form', async ctx => {
  const a = requireUser(ctx); if (a.error) return a.error;
  if (!(nrsCanManage(a.user) || hasPerm(a.user, 'manage_hospital_settings'))) return json({ error: 'دسترسی ندارید' }, 403);
  let doc = await q1(ctx.env, 'SELECT id, doc_code FROM controlled_documents WHERE hospital_id = ? AND title = ? LIMIT 1',
    [a.hospitalId, SHIFT_FORM_TITLE]);
  if (!doc) {
    const id = uuid();
    const code = await buildDocCode(ctx.env, a.hospitalId, { doc_type: 'فرم', title: SHIFT_FORM_TITLE, responsible_person: 'مدیریت پرستاری' }, null, id);
    await qrun(ctx.env, `INSERT INTO controlled_documents (id, hospital_id, doc_type, title, doc_code,
        responsible_person, purpose, scope, status, created_by, updated_by)
      VALUES (?, ?, 'فرم', ?, ?, 'مدیریت پرستاری', ?, ?, 'approved', ?, ?)`,
      [id, a.hospitalId, SHIFT_FORM_TITLE, code,
        'ثبت و ابلاغ برنامه‌ی ماهانه‌ی شیفت پرسنل هر بخش/واحد و محاسبه‌ی کارکرد و اضافه‌کار.',
        'همه‌ی بخش‌های بالینی و واحدهای پشتیبانی دارای برنامه‌ی شیفت.',
        a.user.id, a.user.id]);
    doc = { id, doc_code: code };
  }
  const cur = await printConfigOf(ctx.env, a.hospitalId);
  cur.form_code = doc.doc_code;
  cur.document_id = doc.id;
  await qrun(ctx.env, 'UPDATE hospitals SET shift_print_config = ? WHERE id = ?', [JSON.stringify(cur), a.hospitalId]);
  return json({ document: doc, config: cur });
});

/* ---- سلول برنامه (با ستارهٔ مسئول شیفت) ---- */
on('PUT', '/api/shift/schedule/cell', async ctx => {
  const a = requireUser(ctx); if (a.error) return a.error;
  const b = await readJson(ctx.request);
  const acc = await shiftAccessUnit(ctx.env, a.user, b.ward);
  if (acc.error) return json({ error: acc.error }, acc.status);
  if (!(acc.isHead || acc.isDeputy || acc.isOverseer)) return json({ error: 'دسترسی ندارید' }, 403);
  const year = parseInt(b.year, 10), month = parseInt(b.month, 10), day = parseInt(b.day, 10);
  if (!year || !month || !day || day < 1 || day > 31) return json({ error: 'تاریخ نامعتبر است' }, 400);
  const set = new Set(String(b.codes || '').toUpperCase().split('').filter(c => 'MENH'.includes(c)));
  if (set.has('H') && set.size > 1) return json({ error: 'مرخصی (H) با شیفت دیگری در یک روز ترکیب نمی‌شود' }, 400);
  const codes = ['M', 'E', 'N', 'H'].filter(c => set.has(c)).join('');
  const staffRow = await q1(ctx.env, 'SELECT id FROM ward_staff WHERE id = ? AND hospital_id = ? AND ward = ?',
    [b.staff_id, a.hospitalId, acc.ward.title]);
  if (!staffRow) return json({ error: 'پرسنل یافت نشد' }, 404);
  let sched = await q1(ctx.env, 'SELECT id FROM shift_schedules WHERE hospital_id=? AND ward=? AND jalali_year=? AND jalali_month=?',
    [a.hospitalId, acc.ward.title, year, month]);
  if (!sched) {
    const id = uuid();
    await qrun(ctx.env, `INSERT INTO shift_schedules (id, hospital_id, ward, jalali_year, jalali_month, created_by) VALUES (?,?,?,?,?,?)`,
      [id, a.hospitalId, acc.ward.title, year, month, a.user.id]);
    sched = { id };
  }
  const ex = await q1(ctx.env, 'SELECT id FROM shift_entries WHERE schedule_id=? AND staff_id=? AND day=?', [sched.id, b.staff_id, day]);
  let entryId = ex ? ex.id : null;
  if (codes === '') {
    if (ex) await qrun(ctx.env, 'DELETE FROM shift_entries WHERE id = ?', [ex.id]);
    entryId = null;
  } else if (ex) {
    await qrun(ctx.env, `UPDATE shift_entries SET codes = ?, updated_at = datetime('now') WHERE id = ?`, [codes, ex.id]);
  } else {
    entryId = uuid();
    await qrun(ctx.env, `INSERT INTO shift_entries (id, schedule_id, staff_id, day, codes) VALUES (?,?,?,?,?)`, [entryId, sched.id, b.staff_id, day, codes]);
  }
  // ستارهٔ «مسئول شیفت»: در هر روز فقط یک نفر مسئول است — با روشن‌کردنِ ستارهٔ
  // یک نفر، ستارهٔ بقیهٔ همان روز خاموش می‌شود.
  const lead = b.lead === true || b.lead === 1 || b.lead === '1';
  const leadOff = b.lead === false || b.lead === 0 || b.lead === '0';
  if (lead && entryId) {
    await qrun(ctx.env, 'UPDATE shift_entries SET is_lead = 0 WHERE schedule_id = ? AND day = ? AND staff_id <> ?', [sched.id, day, b.staff_id]);
    await qrun(ctx.env, `UPDATE shift_entries SET is_lead = 1, updated_at = datetime('now') WHERE id = ?`, [entryId]);
  } else if (leadOff && entryId) {
    await qrun(ctx.env, 'UPDATE shift_entries SET is_lead = 0 WHERE id = ?', [entryId]);
  }
  const hrs = await getWardShiftSettings(ctx.env, a.hospitalId, acc.ward.title);
  return json({ status: 'updated', codes, hours: shiftCellHours(codes, hrs), is_lead: lead && !!entryId });
});

/* =====================================================================
   ورودیِ ورکر
   ===================================================================== */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/healthz') {
        return json({ status: 'ok', app: 'synapse-shift', mode: 'cloudflare-worker', time: NOW() });
      }
      if (url.pathname.startsWith('/api/')) {
        const m = matchRoute(request.method, url.pathname);
        if (!m) return json({ error: 'مسیر یافت نشد' }, 404);
        const user = await currentUser(request, env);
        return await m.handler({ request, env, url, params: m.params, user });
      }
      // بقیهٔ مسیرها فایل ثابت‌اند (public/). اگر فایل نبود، اپِ تک‌صفحه‌ای را بده.
      if (env.ASSETS) {
        const res = await env.ASSETS.fetch(request);
        if (res.status !== 404) return res;
        if (request.method === 'GET') {
          const fallback = await env.ASSETS.fetch(new Request(new URL('/index.html', url).toString(), { method: 'GET' }));
          if (fallback.ok) return fallback;
        }
        return res;
      }
      return new Response('assets binding تنظیم نشده است', { status: 500 });
    } catch (err) {
      console.error('[worker]', err && err.stack || err);
      return json({ error: 'خطای سرور' }, 500);
    }
  },
};
