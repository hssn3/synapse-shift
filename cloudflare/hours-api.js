/* =====================================================================
   ساعت کارِ سراسری (دو گروه: پرستاری و پشتیبانی)
   ---------------------------------------------------------------------
   گروه «پرستاری» در جدول ساعتِ هر بخش ذخیره می‌شود (همان که محاسبه با
   آن انجام می‌شود) و گروه «پشتیبانی» جداگانه در platform_settings نگه
   داشته می‌شود تا اسکیمای D1 دست‌نخورده بماند.
   GET  /api/shift/hours   → { sup: {...} }
   PUT  /api/shift/hours   → ذخیرهٔ گروه پشتیبانی
   ===================================================================== */

const KEY = 'shift_hours_support';

const json = (o, st = 200) => new Response(JSON.stringify(o), {
  status: st,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

async function q1(env, sql, args) {
  return env.DB.prepare(sql).bind(...args).first();
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

export function isHoursPath(pathname) {
  return pathname === '/api/shift/hours';
}

const DEFAULTS = { hour_m: 7, clock_m: '07:00-14:00', hour_e: 6, clock_e: '13:00-19:00', hour_n: 12, clock_n: '19:00-07:00', hour_h: 7 };

export async function handleHours(request, env, worker) {
  const user = await sessionUser(request, env, worker);
  if (!user) return json({ error: 'نشست معتبر نیست' }, 401);
  if (!user.is_manager) return json({ error: 'فقط مدیر پرستاری' }, 403);

  const read = async () => {
    const row = await q1(env, 'SELECT value FROM platform_settings WHERE key = ?', [KEY]);
    let val = {};
    try { val = row && row.value ? JSON.parse(row.value) : {}; } catch (e) { val = {}; }
    return Object.assign({}, DEFAULTS, val || {});
  };

  if (request.method === 'GET') return json({ sup: await read() });

  if (request.method === 'PUT') {
    const b = await request.json().catch(() => ({}));
    const num = (v, d) => (Number.isFinite(+v) && +v >= 0 && +v <= 24) ? Math.round(+v) : d;
    const cur = await read();
    const next = {
      hour_m: num(b.hour_m, cur.hour_m), clock_m: (b.clock_m || cur.clock_m),
      hour_e: num(b.hour_e, cur.hour_e), clock_e: (b.clock_e || cur.clock_e),
      hour_n: num(b.hour_n, cur.hour_n), clock_n: (b.clock_n || cur.clock_n),
      hour_h: num(b.hour_h, cur.hour_h),
    };
    await env.DB.prepare('INSERT INTO platform_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .bind(KEY, JSON.stringify(next)).run();
    return json({ status: 'saved', sup: next });
  }

  return json({ error: 'مسیر پیدا نشد' }, 404);
}
