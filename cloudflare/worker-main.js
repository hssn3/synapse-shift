/* =====================================================================
   ورودیِ ورکر: worker.js + فرم‌های کد
   ---------------------------------------------------------------------
   worker.js دست‌نخورده می‌ماند (همان نسخهٔ تست‌شده و مستقرشده)؛ این فایل
   فقط درخواست‌های /api/shift/codes/* را به codes-api.js می‌دهد و بقیه را
   مو‌به‌مو به worker.js می‌سپارد. اگر روزی این ماژول لازم نبود، کافی است
   در wrangler.toml مقدار main را به cloudflare/worker.js برگردانید.

   تعداد روز دقیقاً از تقویم ایران می‌آید (آبان ۳۰، اسفند ۲۹/۳۰)؛ این‌جا فقط
   کارکرد/اضافه‌کار/شمارش نفرات از همان خانه‌های واقعی بازمحاسبه می‌شود.
   ===================================================================== */
import worker from './worker.js';
import { isCodesPath, handleCodes } from './codes-api.js';
import { isCrisisPath, handleCrisis } from './crisis-api.js';
import { isHoursPath, handleHours } from './hours-api.js';

const FORM_DAYS = 31;                 // فقط پشتیبان، اگر سرور تعداد روز را نداد
const SHIFT_KEYS = ['M', 'E', 'N', 'H'];

/** ساعتِ یک خانه — دقیقاً مثل shiftCellHours در worker.js. */
function cellHours(codes, s) {
  if (!codes) return 0;
  if (codes.includes('H')) return Number(s.hour_m) || 0;
  let h = 0;
  if (codes.includes('M')) h += Number(s.hour_m) || 0;
  if (codes.includes('E')) h += Number(s.hour_e) || 0;
  if (codes.includes('N')) h += Number(s.hour_n) || 0;
  return h;
}

/** روزها را به ۳۱ می‌برد و جمع‌ها را از روی همان خانه‌ها دوباره حساب می‌کند. */
function withFormDays(data) {
  if (!data || !data.schedule || !Array.isArray(data.staff)) return data;
  const s = data.settings || {};
  // تعداد روز از تقویم واقعی می‌آید (۳۰/۳۱/۲۹)؛ فقط اگر سرور عدد نداد ۳۱ می‌شود.
  const days = Number(data.schedule.days) || FORM_DAYS;
  const headcount = {};
  for (let d = 1; d <= days; d++) {
    headcount[d] = { M: 0, E: 0, N: 0, H: 0 };
  }
  data.staff = data.staff.map(row => {
    const cells = row.cells || {};
    const rowHrs = row.hrs || s;
    let total = 0;
    for (let d = 1; d <= days; d++) {
      const codes = cells[d] || '';
      total += cellHours(codes, rowHrs);
      for (const k of SHIFT_KEYS) {
        if (codes.includes(k)) headcount[d][k] += 1;
      }
    }
    const quota = Number(row.monthly_hour_quota) || 0;
    return Object.assign({}, row, { total_hours: total, overtime: total - quota });
  });
  data.schedule.days = days;
  data.headcount = headcount;
  return data;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (isCodesPath(url.pathname)) return handleCodes(request, env, worker);
    if (isCrisisPath(url.pathname)) return handleCrisis(request, env, worker);
    if (isHoursPath(url.pathname)) return handleHours(request, env, worker);

    // فقط پاسخِ خواندنِ برنامه را گسترش می‌دهیم؛ نوشتن‌ها دست نمی‌خورند
    // (endpoint خانه، روز ۱ تا ۳۱ را از قبل می‌پذیرد).
    if (url.pathname === '/api/shift/schedule' && request.method === 'GET') {
      const res = await worker.fetch(request, env, ctx);
      if (!res.ok) return res;
      let data = null;
      try { data = await res.clone().json(); } catch (e) { return res; }
      if (!data || !data.schedule) return res;
      const body = JSON.stringify(withFormDays(data));
      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    }

    return worker.fetch(request, env, ctx);
  },
};
