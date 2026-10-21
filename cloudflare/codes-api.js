/* =====================================================================
   API فرم‌های کد ۵۵ / ۹۹ روی Cloudflare — فقط مدیر پرستاری
   ---------------------------------------------------------------------
   چرا یک فایل جدا و نه داخل worker.js؟
   worker.js مو‌به‌مو همان فایلِ تست‌شده و مستقرشده می‌ماند؛ این ماژول فقط
   روی مسیرهای /api/shift/codes/* می‌نشیند و بقیهٔ درخواست‌ها را دست
   نمی‌زند. احراز هویت هم دوباره پیاده نشده: همان /api/auth/session خودِ
   ورکر صدا زده می‌شود و نتیجه‌اش (کاربر + مجوزها) مبنای تصمیم است.
   ===================================================================== */

const CODE_TYPES = ['55', '99'];
const CODE_SHIFTS = ['M', 'E', 'N'];
const MANAGER_PERMISSION = 'manage_nursing_hierarchy';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export function isCodesPath(pathname) {
  return pathname === '/api/shift/codes' || pathname.startsWith('/api/shift/codes/')
    || pathname === '/api/shift/doctors' || pathname.startsWith('/api/shift/doctors/');
}

/** فهرست پزشکان بیمارستان — مستقل از بخش‌ها (برای پیشنهاد نام در فرم‌های کد). */
async function doctorsOf(env, hospitalId) {
  const rows = await env.DB.prepare(
    `SELECT id, full_name, specialty, sort_order FROM hospital_doctors
      WHERE hospital_id = ? AND is_active = 1
      ORDER BY COALESCE(sort_order, 100), full_name`).bind(hospitalId).all();
  return rows.results || [];
}

/** هر نام پزشکی که در خانه‌ای نوشته شود، خودکار به فهرست پزشکان اضافه می‌شود. */
async function rememberDoctor(env, hospitalId, name) {
  const clean = String(name || '').trim().slice(0, 80);
  if (!clean) return false;
  const r = await env.DB.prepare(
    `INSERT OR IGNORE INTO hospital_doctors (id, hospital_id, full_name, specialty, sort_order)
     VALUES (?, ?, ?, 'پزشک طب اورژانس', 100)`).bind(crypto.randomUUID(), hospitalId, clean).run();
  return !!(r.meta && r.meta.changes);
}

/** کاربر جاری را از خودِ ورکر اصلی می‌پرسد (بدون بازپیاده‌سازی JWT). */
async function currentUser(request, env, worker) {
  try {
    const sessionUrl = new URL('/api/auth/session', request.url);
    const res = await worker.fetch(new Request(sessionUrl.toString(), {
      method: 'GET',
      headers: request.headers,
    }), env, { waitUntil() {}, passThroughOnException() {} });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return (data && data.authenticated && data.user) ? data.user : null;
  } catch (e) {
    return null;
  }
}

function isManager(user) {
  return !!(user && Array.isArray(user.permissions) && user.permissions.includes(MANAGER_PERMISSION));
}

async function q1meta(env, hospitalId, type) {
  const row = await env.DB.prepare('SELECT payload FROM shift_code_meta WHERE hospital_id = ? AND code_type = ?')
    .bind(hospitalId, type).first();
  if (!row || !row.payload) return {};
  try { return JSON.parse(row.payload) || {}; } catch (e) { return {}; }
}

const intIn = (v, min, max) => {
  const n = parseInt(v, 10);
  return (Number.isFinite(n) && n >= min && n <= max) ? n : null;
};

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

export async function handleCodes(request, env, worker) {
  const url = new URL(request.url);
  const user = await currentUser(request, env, worker);
  if (!user) return json({ error: 'احراز هویت الزامی است' }, 401);
  if (!isManager(user)) return json({ error: 'این فرم‌ها فقط در دسترس مدیر پرستاری است' }, 403);
  const hospitalId = user.hospital_id;

  if (url.pathname === '/api/shift/codes' && request.method === 'GET') {
    const type = String(url.searchParams.get('type') || '99');
    if (!CODE_TYPES.includes(type)) return json({ error: 'نوع کد نامعتبر است' }, 400);
    const year = intIn(url.searchParams.get('year'), 1300, 1500);
    const month = intIn(url.searchParams.get('month'), 1, 12);
    if (year == null || month == null) return json({ error: 'سال/ماه نامعتبر است' }, 400);
    try {
      const entries = await env.DB.prepare(
        `SELECT day, shift, role_no, person_name FROM shift_code_entries
          WHERE hospital_id = ? AND code_type = ? AND jalali_year = ? AND jalali_month = ?
          ORDER BY day, shift, role_no`).bind(hospitalId, type, year, month).all();
      const rows = await env.DB.prepare(
        `SELECT first_name, last_name, position, ward FROM ward_staff
          WHERE hospital_id = ? AND is_active = 1
          ORDER BY ward, COALESCE(sort_order, 9999), last_name`).bind(hospitalId).all();
      const people = (rows.results || []).map(r => ({
        name: ((r.first_name || '') + ' ' + (r.last_name || '')).trim(),
        position: r.position || '',
        ward: r.ward || '',
      })).filter(p => p.name);
      return json({ type, year, month, can_edit: true, entries: entries.results || [], people,
        doctors: await doctorsOf(env, hospitalId) });
    } catch (e) {
      return json({ error: 'خطای دیتابیس: ' + (e.message || e) + ' — مهاجرت migration-shift-codes.sql اجرا شده است؟' }, 500);
    }
  }

  if (url.pathname === '/api/shift/codes/entry' && request.method === 'PUT') {
    let b = {};
    try { b = await request.json(); } catch (e) { return json({ error: 'بدنهٔ نامعتبر' }, 400); }
    const type = String(b.type || '');
    if (!CODE_TYPES.includes(type)) return json({ error: 'نوع کد نامعتبر است' }, 400);
    const shift = String(b.shift || '').toUpperCase();
    if (!CODE_SHIFTS.includes(shift)) return json({ error: 'شیفت نامعتبر است' }, 400);
    const year = intIn(b.year, 1300, 1500);
    const month = intIn(b.month, 1, 12);
    const day = intIn(b.day, 1, 31);
    const role = intIn(b.role, 1, 6);
    if (year == null || month == null || day == null || role == null) return json({ error: 'خانهٔ نامعتبر' }, 400);
    const name = String(b.name == null ? '' : b.name).trim().slice(0, 80);
    // پزشک تازه‌ای که دستی نوشته شود، در فهرست پزشکان هم می‌ماند.
    const doctorAdded = (role === 1 && name) ? await rememberDoctor(env, hospitalId, name) : false;
    try {
      if (!name) {
        await env.DB.prepare(
          `DELETE FROM shift_code_entries
            WHERE hospital_id = ? AND code_type = ? AND jalali_year = ? AND jalali_month = ?
              AND day = ? AND shift = ? AND role_no = ?`)
          .bind(hospitalId, type, year, month, day, shift, role).run();
        return json({ status: 'cleared', day, shift, role_no: role });
      }
      await env.DB.prepare(
        `INSERT INTO shift_code_entries
            (id, hospital_id, code_type, jalali_year, jalali_month, day, shift, role_no, person_name, updated_by, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(hospital_id, code_type, jalali_year, jalali_month, day, shift, role_no)
          DO UPDATE SET person_name = excluded.person_name, updated_by = excluded.updated_by, updated_at = datetime('now')`)
        .bind(crypto.randomUUID(), hospitalId, type, year, month, day, shift, role, name, user.id).run();
      return json({ status: 'saved', day, shift, role_no: role, person_name: name, doctor_added: doctorAdded });
    } catch (e) {
      return json({ error: 'خطای دیتابیس: ' + (e.message || e) + ' — مهاجرت migration-shift-codes.sql اجرا شده است؟' }, 500);
    }
  }

  if (url.pathname === '/api/shift/codes/meta' && request.method === 'GET') {
    const type = String(url.searchParams.get('type') || 'crisis');
    try {
      const row = await q1meta(env, hospitalId, type);
      return json({ type, meta: row });
    } catch (e) {
      return json({ error: 'خطای دیتابیس: ' + (e.message || e) }, 500);
    }
  }

  if (url.pathname === '/api/shift/codes/meta' && request.method === 'PUT') {
    let b = {};
    try { b = await request.json(); } catch (e) { return json({ error: 'بدنهٔ نامعتبر' }, 400); }
    const type = String(b.type || 'crisis').slice(0, 20);
    try {
      const cur = await q1meta(env, hospitalId, type);
      const next = sanitizeMeta(b.meta || {}, cur);
      await env.DB.prepare(`INSERT INTO shift_code_meta (hospital_id, code_type, payload, updated_at)
          VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT(hospital_id, code_type) DO UPDATE SET payload = excluded.payload, updated_at = datetime('now')`)
        .bind(hospitalId, type, JSON.stringify(next)).run();
      return json({ status: 'saved', type, meta: next });
    } catch (e) {
      return json({ error: 'خطای دیتابیس: ' + (e.message || e) }, 500);
    }
  }

  /* ---------- فهرست پزشکان (جدا از پرسنل بخش‌ها) ---------- */
  const doctorName = v => String(v == null ? '' : v).trim().slice(0, 80);
  const doctorSpec = v => String(v == null ? '' : v).trim().slice(0, 60) || 'پزشک طب اورژانس';

  if (url.pathname === '/api/shift/doctors' && request.method === 'GET') {
    try { return json({ doctors: await doctorsOf(env, hospitalId) }); }
    catch (e) { return json({ error: 'خطای دیتابیس: ' + (e.message || e) + ' — مهاجرت migration-doctors.sql اجرا شده است؟' }, 500); }
  }

  if (url.pathname === '/api/shift/doctors' && request.method === 'POST') {
    let b = {};
    try { b = await request.json(); } catch (e) { return json({ error: 'بدنهٔ نامعتبر' }, 400); }
    const name = doctorName(b.full_name);
    if (name.length < 2) return json({ error: 'نام پزشک لازم است' }, 400);
    try {
      await env.DB.prepare(
        `INSERT INTO hospital_doctors (id, hospital_id, full_name, specialty, sort_order)
         VALUES (?, ?, ?, ?, 100)
         ON CONFLICT(hospital_id, full_name) DO UPDATE SET specialty = excluded.specialty, is_active = 1`)
        .bind(crypto.randomUUID(), hospitalId, name, doctorSpec(b.specialty)).run();
      return json({ status: 'saved', doctors: await doctorsOf(env, hospitalId) });
    } catch (e) {
      return json({ error: 'خطای دیتابیس: ' + (e.message || e) + ' — مهاجرت migration-doctors.sql اجرا شده است؟' }, 500);
    }
  }

  const docMatch = url.pathname.match(/^\/api\/shift\/doctors\/([^/]+)$/);
  if (docMatch && (request.method === 'PUT' || request.method === 'DELETE')) {
    const id = decodeURIComponent(docMatch[1]);
    try {
      const row = await env.DB.prepare('SELECT id FROM hospital_doctors WHERE id = ? AND hospital_id = ?')
        .bind(id, hospitalId).first();
      if (!row) return json({ error: 'پزشک یافت نشد' }, 404);
      if (request.method === 'DELETE') {
        await env.DB.prepare('UPDATE hospital_doctors SET is_active = 0 WHERE id = ?').bind(id).run();
      } else {
        let b = {};
        try { b = await request.json(); } catch (e) { return json({ error: 'بدنهٔ نامعتبر' }, 400); }
        const name = doctorName(b.full_name);
        if (name.length < 2) return json({ error: 'نام پزشک لازم است' }, 400);
        await env.DB.prepare('UPDATE hospital_doctors SET full_name = ?, specialty = ? WHERE id = ? AND hospital_id = ?')
          .bind(name, doctorSpec(b.specialty), id, hospitalId).run();
      }
      return json({ status: 'saved', doctors: await doctorsOf(env, hospitalId) });
    } catch (e) {
      return json({ error: 'خطای دیتابیس: ' + (e.message || e) + ' — مهاجرت migration-doctors.sql اجرا شده است؟' }, 500);
    }
  }

  return json({ error: 'مسیر پشتیبانی نمی‌شود' }, 404);
}
