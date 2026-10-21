// ============ تقویم شمسی (جلالی) — سمت سرور ============
// تبدیل تاریخ شمسی به بازه‌ی میلادی برای فیلتر سال در کوئری‌ها.
// تاریخ‌ها در دیتابیس میلادی ISO (YYYY-MM-DD) ذخیره می‌شوند؛ «سال ۱۴۰۴» یعنی بازه‌ی
// [۱ فروردین ۱۴۰۴ ، ۱ فروردین ۱۴۰۵) = [2025-03-21 ، 2026-03-21) — با شروع/پایان بسته/باز.
// الگوریتم از نسخه‌ی فرانت (خودِ پروژه) برداشته شده تا دو سمت همیشه هم‌راستا باشند.

const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];

function div(a, b) { return ~~(a / b); }
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
  // معنای leap دقیقاً مثل الگوریتم مرجع جلالی است: «چند سال از آخرین کبیسه گذشته»
  // (۰ = خودِ سال کبیسه). این مقدار ONLY در d2j برای محاسبه‌ی اسفندِ ۳۰روزه
  // استفاده می‌شود؛ هر تغییر در معنا باید با d2j هم‌زمان باشد.
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
    // تاریخ قبل از نوروزِ سالِ jy است → متعلق به سالِ قبل است. اگر سالِ قبلِ
    // آن (jy پس از کاهش) کبیسه باشد، اسفند ۳۰ روزه است و یک روز به طول سال
    // اضافه می‌شود. توجه: پرچم leap در این پروژه «۱ = کبیسه» است (برخلاف
    // الگوریتم جلالی استاندارد که ۰ = کبیسه)، پس باید سالِ جدیدِ jy را دوباره
    // پرس‌وجو کرد — r بالایی مربوط به سالِ قبل از کاهش است.
    jy -= 1; k += 179;
    if (jalCal(jy).leap === 1) k += 1;
  }
  const jm2 = 7 + div(k, 30); const jd2 = (k % 30) + 1;
  return { jy, jm: jm2, jd: jd2 };
}

const toJalali = (gy, gm, gd) => d2j(g2d(gy, gm, gd));
const toGregorian = (jy, jm, jd) => d2g(j2d(jy, jm, jd));

function pad(n) { return String(n).padStart(2, '0'); }

// بازه‌ی میلادی [شروع، پایان) برای یک سال شمسی — شروع = ۱ فروردین، پایان = ۱ فروردین سال بعد
function jalaliYearRange(jy) {
  const start = toGregorian(jy, 1, 1);
  const end = toGregorian(jy + 1, 1, 1);
  return {
    start: `${start.gy}-${pad(start.gm)}-${pad(start.gd)}`,
    end: `${end.gy}-${pad(end.gm)}-${pad(end.gd)}`, // نیمه‌باز: date < end
  };
}

// عدد صحیح امن برای پارامتر year از کوئری
function safeYear(v) {
  const n = parseInt(v, 10);
  if (isNaN(n) || n < 1300 || n > 1500) return null;
  return n;
}

const JMONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];

// ============ منطقه‌ی زمانی تهران (Asia/Tehran, UTC+3:30) ============
// سرور ممکن است روی هر منطقه‌ی زمانی‌ای باشد (مثلاً UTC یا America/Los_Angeles)، پس
// «امروز» هرگز نباید از ساعتِ محلیِ سرور خوانده شود: در بازه‌ی اختلاف، «امروزِ سرور» با
// «امروزِ تهران» یک روز فرق می‌کند و شمارش معکوسِ مهلت‌های قانونی یک‌روز خطا می‌خورد.
// ایران از ۱۴۰۱ ساعت تابستانی ندارد، پس افست ثابت +۳:۳۰ است.
const TEHRAN_OFFSET_MS = 3.5 * 3600000;

// «حالا»ی تهران به‌شکل Date‌ای که گِتِرهای UTC آن ساعتِ دیواری تهران را می‌دهند
function tehranNow() { return new Date(Date.now() + TEHRAN_OFFSET_MS); }
// امروزِ تهران به‌صورت YYYY-MM-DD میلادی — مبنای همه‌ی مقایسه‌های سررسید
function tehranTodayStr() { return tehranNow().toISOString().slice(0, 10); }

function todayJalali() {
  const t = tehranNow();
  return toJalali(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

// بازه‌ی میلادی [شروع، پایان) یک ماه شمسی.
// برای اسفند (jm=12) نمی‌توان jm+1 داد: j2d با ماه ۱۳ یک روز جلوتر از ۱ فروردین سال بعد می‌افتد
// (۳۶۶ روز به‌جای ۳۶۵) و ۱ فروردین سال بعد داخل اسفند شمرده می‌شود — همپوشانی سال‌ها.
// پس انتهای اسفند دقیقاً همان انتهای بازه‌ی سال است.
function jalaliMonthRange(jy, jm) {
  const start = toGregorian(jy, jm, 1);
  if (jm >= 12) {
    return {
      start: `${start.gy}-${pad(start.gm)}-${pad(start.gd)}`,
      end: jalaliYearRange(jy).end,
    };
  }
  const end = toGregorian(jy, jm + 1, 1);
  return {
    start: `${start.gy}-${pad(start.gm)}-${pad(start.gd)}`,
    end: `${end.gy}-${pad(end.gm)}-${pad(end.gd)}`,
  };
}

module.exports = { jalaliYearRange, jalaliMonthRange, safeYear, toJalali, toGregorian, todayJalali, JMONTHS,
  TEHRAN_OFFSET_MS, tehranNow, tehranTodayStr };
