/* =====================================================================
   برنامهٔ بحران هر بخش — API مستقل
   ---------------------------------------------------------------------
   دادهٔ بحران در همان جدول‌های برنامهٔ شیفت نگه داشته می‌شود، فقط با کلیدِ
   بخشِ «<نام بخش> ⟪بحران⟫» تا هیچ برنامهٔ عادی قاطی نشود و اسکیمای D1
   دست‌نخورده بماند. worker.js هم اصلاً تغییر نمی‌کند.

   GET  /api/shift/crisis?ward=&year=&month=   → پرسنل + خانه‌های بحران
   PUT  /api/shift/crisis/cell                 → ذخیرهٔ یک خانه
   ===================================================================== */

const SUFFIX = ' ⟪بحران⟫';

const json = (o, st = 200) => new Response(JSON.stringify(o), {
  status: st,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));

async function q1(env, sql, args = []) {
  return env.DB.prepare(sql).bind(...args).first();
}
async function qall(env, sql, args = []) {
  const r = await env.DB.prepare(sql).bind(...args).all();
  return (r && r.results) || [];
}
async function qrun(env, sql, args = []) {
  return env.DB.prepare(sql).bind(...args).run();
}

export function isCrisisPath(pathname) {
  return pathname === '/api/shift/crisis' || pathname.startsWith('/api/shift/crisis/');
}

async function sessionUser(request, env, worker) {
  try {
    const sessionUrl = new URL('/api/auth/session', request.url);
    const res = await worker.fetch(new Request(sessionUrl.toString(), {
      method: 'GET',
      headers: request.headers,
    }), env, { waitUntil() {}, passThroughOnException() {} });
    if (!res.ok) return null;
    const d = await res.json().catch(() => null);
    return (d && d.authenticated && d.user) ? d.user : null;
  } catch (e) {
    return null;
  }
}

async function ensureSchedule(env, hospitalId, wardKey, year, month, userId) {
  const row = await q1(env,
    'SELECT * FROM shift_schedules WHERE hospital_id=? AND ward=? AND jalali_year=? AND jalali_month=?',
    [hospitalId, wardKey, year, month]);
  if (row) return row;
  const id = newId();
  await qrun(env,
    'INSERT INTO shift_schedules (id, hospital_id, ward, jalali_year, jalali_month, created_by) VALUES (?,?,?,?,?,?)',
    [id, hospitalId, wardKey, year, month, userId || null]);
  return { id, ward: wardKey, jalali_year: year, jalali_month: month };
}

export async function handleCrisis(request, env, worker) {
  const url = new URL(request.url);
  const user = await sessionUser(request, env, worker);
  if (!user) return json({ error: 'نشست معتبر نیست' }, 401);
  const hospitalId = user.hospital_id;

  if (url.pathname === '/api/shift/crisis' && request.method === 'GET') {
    const ward = String(url.searchParams.get('ward') || '').trim();
    const year = parseInt(url.searchParams.get('year'), 10);
    const month = parseInt(url.searchParams.get('month'), 10);
    if (!ward) return json({ error: 'بخش الزامی است' }, 400);
    if (!year || !month) return json({ error: 'سال/ماه نامعتبر است' }, 400);

    // فقط پرسنل پرستاری و کارشناسی؛ کمک‌پرستار/بهیار در برنامهٔ بحران نمی‌آید.
    const staff = await qall(env,
      `SELECT id, first_name, last_name, position, fixed_shift, gender, sort_order
       FROM ward_staff
       WHERE hospital_id=? AND ward=? AND is_active=1
         AND COALESCE(position,'') NOT LIKE '%کمک%'
         AND COALESCE(position,'') NOT LIKE '%بهیار%'
       ORDER BY COALESCE(sort_order, 999), created_at, last_name`,
      [hospitalId, ward]);

    const sched = await q1(env,
      'SELECT * FROM shift_schedules WHERE hospital_id=? AND ward=? AND jalali_year=? AND jalali_month=?',
      [hospitalId, ward + SUFFIX, year, month]);
    const entries = sched
      ? await qall(env, 'SELECT staff_id, day, codes FROM shift_entries WHERE schedule_id=?', [sched.id])
      : [];
    const cells = {};
    for (const e of entries) {
      if (!e.codes) continue;
      (cells[e.staff_id] = cells[e.staff_id] || {})[e.day] = e.codes;
    }
    return json({ ward, year, month, staff: staff.map(s => Object.assign({}, s, { cells: cells[s.id] || {} })) });
  }

  if (url.pathname === '/api/shift/crisis/cell' && request.method === 'PUT') {
    const b = await request.json().catch(() => ({}));
    const ward = String(b.ward || '').trim();
    const year = parseInt(b.year, 10);
    const month = parseInt(b.month, 10);
    const staffId = String(b.staff_id || '').trim();
    const day = parseInt(b.day, 10);
    const codes = String(b.codes || '').replace(/[^MENHSC]/g, '').slice(0, 3);
    if (!ward || !year || !month || !staffId || !day) return json({ error: 'پارامتر ناقص' }, 400);

    const owns = await q1(env, 'SELECT id FROM ward_staff WHERE id=? AND hospital_id=?', [staffId, hospitalId]);
    if (!owns) return json({ error: 'پرسنل پیدا نشد' }, 404);

    const sched = await ensureSchedule(env, hospitalId, ward + SUFFIX, year, month, user.id);
    const old = await q1(env, 'SELECT id FROM shift_entries WHERE schedule_id=? AND staff_id=? AND day=?', [sched.id, staffId, day]);
    if (old) {
      await qrun(env, "UPDATE shift_entries SET codes=?, updated_at=datetime('now') WHERE id=?", [codes, old.id]);
    } else if (codes) {
      await qrun(env, 'INSERT INTO shift_entries (id, schedule_id, staff_id, day, codes) VALUES (?,?,?,?,?)',
        [newId(), sched.id, staffId, day, codes]);
    }
    return json({ status: 'saved', codes });
  }

  return json({ error: 'مسیر پیدا نشد' }, 404);
}
