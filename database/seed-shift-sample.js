/**
 * برنامه‌ی نمونه‌ی شیفت برای همه‌ی بخش‌ها + دفتر پرستاری
 * ---------------------------------------------------------------------
 * کارفرما خواست «برای هر سرپرستارِ هر بخش یک نمونه برنامه پر شود» تا موقع
 * ارائه، ماژول شیفت خالی نباشد و بشود چاپِ واقعی گرفت.
 *
 * دو چیز که این اسکریپت را از یک داده‌ی تصادفیِ ساده جدا می‌کند:
 *
 *  ۱) روستر با پوششِ واقعی ساخته می‌شود، نه با چرخه‌ی کور. برای هر روز به تعدادِ
 *     لازم نفر در صبح/عصر/شب گذاشته می‌شود و «هرکس شب کار کرد، فردایش آف است»
 *     رعایت می‌شود. چرخه‌ی کورِ ثابت، شب‌کارِ پشت‌سرهم می‌سازد که هم غیرقانونی
 *     است و هم اولین چیزی است که ارزیاب روی برگه می‌بیند.
 *
 *  ۲) اندازه‌ی بخش‌ها عمداً متفاوت است. کارفرما خواست بخش‌های پرپرسنل روی چند
 *     صفحه با شماره‌ی صفحه چاپ شوند؛ اگر همه‌ی بخش‌ها ده‌نفره بودند، آن قابلیت
 *     اصلاً روی داده‌ی نمونه دیده نمی‌شد. پس چند بخش بالای سقفِ یک صفحه‌اند.
 *
 * ترتیبِ نمایش (سلسله‌مراتب) کارِ این اسکریپت نیست — SHIFT_STAFF_ORDER در
 * src/routes/api.js آن را روی خواندن اعمال می‌کند. این‌جا فقط سمتِ درست ثبت
 * می‌شود.
 *
 * idempotent: اگر بخشی از قبل پرسنل دارد، دست‌نخورده رد می‌شود — وگرنه هر بوت
 * روی داده‌ی واقعیِ مشتری پرسنلِ ساختگی می‌ریخت.
 *
 * Run: node database/seed-shift-sample.js
 */
const { db } = require('../src/config/database-sqlite');
const crypto = require('crypto');
const uuid = () => crypto.randomUUID();

const YEAR = 1405, MONTH = 6, DAYS = 31;   // شهریور ۱۴۰۵
const HOLIDAYS = [6, 13, 20, 27];          // جمعه‌های ماه

const FEMALE = ['زهرا', 'فاطمه', 'مریم', 'نرگس', 'سمیه', 'الهام', 'شبنم', 'مهسا', 'سارا', 'نازنین',
  'لیلا', 'مینا', 'پریسا', 'راضیه', 'اکرم', 'طاهره', 'معصومه', 'سکینه', 'هانیه', 'نسرین',
  'فرزانه', 'شیما', 'مهناز', 'رویا', 'سحر', 'آزاده', 'بهاره', 'کبری', 'زینب', 'مرضیه'];
const MALE = ['رضا', 'علی', 'حسن', 'امیر', 'محمد', 'مهدی', 'حسین', 'سعید', 'مجید', 'کاظم',
  'یاسر', 'بهروز', 'فرهاد', 'ناصر', 'جواد', 'وحید', 'میثم', 'ابوالفضل'];
const LAST = ['محمدی', 'حسینی', 'رضایی', 'کریمی', 'موسوی', 'اکبری', 'قاسمی', 'شریفی', 'یوسفی',
  'ابراهیمی', 'جلیلیان', 'تحرزی', 'صادقی', 'نوری', 'احمدی', 'رحیمی', 'زارعی', 'کاظمی',
  'میرزایی', 'سلطانی', 'نجفی', 'فتحی', 'عباسی', 'هاشمی', 'مرادی', 'بابایی', 'طاهری',
  'جعفری', 'داوودی', 'اسدی', 'شعبانی', 'قربانی', 'محمودی', 'صالحی', 'علوی', 'بیگی'];

// اندازه‌ی هر بخش: [پرستار، کمک‌پرستار، منشی]. عمداً متفاوت‌اند تا هم بخشِ
// یک‌صفحه‌ای داشته باشیم و هم بخشِ دوصفحه‌ای (سقفِ یک صفحه ۱۶ ردیف است).
const WARD_SIZE = {
  'اورژانس': [18, 4, 1],
  'مراقبت‌های ویژه (ICU)': [16, 3, 1],
  'جراحی عمومی': [14, 3, 1],
  'داخلی': [13, 3, 1],
  'اتاق عمل': [12, 3, 1],
  'مراقبت‌های ویژه نوزادان (NICU)': [12, 2, 1],
  'زنان و زایمان': [11, 2, 1],
  'قلب (CCU)': [11, 2, 1],
  'اطفال': [10, 2, 1],
  'ارتوپدی': [9, 2, 1],
  'دیالیز': [7, 1, 1],
  'ریکاوری (بعد از عمل)': [6, 1, 0],
};
const DEFAULT_SIZE = [10, 2, 1];

// نیازِ پوششِ هر شیفت بر حسب اندازه‌ی بخش. بخشِ ویژه شبِ پرنفرتر می‌خواهد،
// ولی این‌جا یک نسبتِ ساده کافی است چون هدف، داده‌ی نمونه‌ی معقول است نه
// برنامه‌ریزیِ عملیاتیِ واقعی.
function coverageFor(poolSize) {
  return {
    M: Math.max(2, Math.round(poolSize * 0.30)),
    E: Math.max(2, Math.round(poolSize * 0.22)),
    N: Math.max(2, Math.round(poolSize * 0.18)),
  };
}

// دفتر پرستاری — ترتیبی که کارفرما خواست: مدیر، سوپروایزرهای بالینی،
// کنترل عفونت، آموزش، و آخر منشی.
const NURSING_OFFICE = 'دفتر پرستاری';
const OFFICE_ROLES = [
  ['مدیر پرستاری', 'زن', 26, 169],
  ['سوپروایزر بالینی', 'زن', 19, 169],
  ['سوپروایزر بالینی', 'مرد', 17, 169],
  ['سوپروایزر بالینی', 'زن', 15, 169],
  ['سوپروایزر بالینی', 'مرد', 13, 169],
  ['سوپروایزر کنترل عفونت', 'زن', 16, 169],
  ['سوپروایزر آموزشی', 'زن', 14, 169],
  ['منشی دفتر پرستاری', 'زن', 6, 189],
];

let nameSeq = 0;
function pickName(gender) {
  const pool = gender === 'مرد' ? MALE : FEMALE;
  const f = pool[nameSeq % pool.length];
  const l = LAST[(nameSeq * 7 + 3) % LAST.length];
  nameSeq++;
  return [f, l];
}

let codeSeq = 1000;
function mkStaff(hospitalId, ward, position, gender, years, quota) {
  const [first, last] = pickName(gender);
  codeSeq++;
  const id = uuid();
  db.prepare(`INSERT INTO ward_staff
    (id, hospital_id, ward, first_name, last_name, gender, personnel_code, mobile, position,
     monthly_hour_quota, years_experience, is_active)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,1)`)
    .run(id, hospitalId, ward, first, last, gender, 'P' + codeSeq,
      '0912' + String(3000000 + codeSeq * 137).slice(0, 7), position, quota, years);
  return { id, position };
}

/**
 * روسترِ یک ماه برای یک بخش.
 * قاعده‌ها: سرپرستار/منشی صبح‌کارِ اداری‌اند (جمعه‌ها آف)؛ پرستار و کمک‌پرستار
 * در گردشِ M/E/N با استراحتِ اجباری بعد از شب.
 */
function buildRoster(rotating, fixedMorning) {
  const cells = {};                       // staffId → { day: code }
  for (const s of rotating.concat(fixedMorning)) cells[s.id] = {};
  const lastNight = {};                   // staffId → روزی که شب کار کرد
  const worked = {};                      // برای پخشِ عادلانه‌ی بار
  for (const s of rotating) worked[s.id] = 0;

  for (let d = 1; d <= DAYS; d++) {
    const isHoliday = HOLIDAYS.includes(d);
    for (const s of fixedMorning) if (!isHoliday) cells[s.id][d] = 'M';

    const need = coverageFor(rotating.length);
    const taken = new Set();
    for (const shift of ['N', 'M', 'E']) {          // شب اول انتخاب می‌شود چون محدودترین است
      const eligible = rotating
        .filter(s => !taken.has(s.id))
        // بعد از شب‌کاری، روز بعد آف — الزامِ ساعتِ استراحت
        .filter(s => !(lastNight[s.id] === d - 1))
        .sort((a, b) => worked[a.id] - worked[b.id]);
      for (let i = 0; i < need[shift] && i < eligible.length; i++) {
        const s = eligible[i];
        cells[s.id][d] = shift;
        taken.add(s.id);
        worked[s.id] += shift === 'N' ? 12 : 6;
        if (shift === 'N') lastNight[s.id] = d;
      }
    }
  }

  // چند روز مرخصی پراکنده — برگه‌ی بدون هیچ مرخصی غیرواقعی به‌نظر می‌رسد
  rotating.forEach((s, i) => {
    const day = ((i * 5) % (DAYS - 2)) + 2;
    if (!cells[s.id][day]) cells[s.id][day] = 'H';
  });
  return cells;
}

function seedUnit(hospitalId, ward, staffPlan) {
  const has = db.prepare('SELECT COUNT(*) c FROM ward_staff WHERE hospital_id = ? AND ward = ?')
    .get(hospitalId, ward).c;
  if (has > 0) return { ward, skipped: true, staff: has };

  const created = staffPlan.map(p => mkStaff(hospitalId, ward, p[0], p[1], p[2], p[3]));
  // «صبح‌کارِ اداری» = کسی که در گردشِ شیفت نیست: مدیر/سرپرستار/منشی
  const fixed = created.filter(s => /سرپرستار|مدیر پرستاری|منشی/.test(s.position));
  const rotating = created.filter(s => !fixed.includes(s));
  const cells = buildRoster(rotating, fixed);

  const schedId = uuid();
  db.prepare(`INSERT INTO shift_schedules (id, hospital_id, ward, jalali_year, jalali_month, note, holidays, description)
    VALUES (?,?,?,?,?,?,?,?)`)
    .run(schedId, hospitalId, ward, YEAR, MONTH, `${DAYS - HOLIDAYS.length} روز کاری`,
      HOLIDAYS.join(','),
      'برنامه‌ی نمونه. مسئول شیفت در هر نوبت با هماهنگی سرپرستار تعیین می‌شود. '
      + 'هرگونه جابه‌جایی شیفت نیازمند تأیید کتبی سرپرستار و اطلاع به سوپروایزر بالینی است.');

  const ins = db.prepare(`INSERT INTO shift_entries (id, schedule_id, staff_id, day, codes) VALUES (?,?,?,?,?)`);
  const tx = db.transaction(() => {
    for (const staffId of Object.keys(cells)) {
      for (const day of Object.keys(cells[staffId])) {
        ins.run(uuid(), schedId, staffId, +day, cells[staffId][day]);
      }
    }
  });
  tx();
  return { ward, staff: created.length, rotating: rotating.length };
}

function runMigration() {
  const hospitals = db.prepare('SELECT id, name FROM hospitals').all();
  const out = [];
  for (const h of hospitals) {
    const wards = db.prepare('SELECT title FROM nursing_wards WHERE hospital_id = ? ORDER BY title')
      .all(h.id).map(r => r.title);

    // دفتر پرستاری بخشِ بالینی نیست؛ به‌عنوان «واحد» ثبت می‌شود تا ماژول شیفت
    // بشناسدش (همان shift_units که برای واحدهای پشتیبانی ساخته شد).
    const exists = db.prepare('SELECT id FROM shift_units WHERE hospital_id = ? AND title = ?')
      .get(h.id, NURSING_OFFICE);
    if (!exists) {
      db.prepare(`INSERT INTO shift_units (id, hospital_id, title, kind, sort_order) VALUES (?,?,?,?,0)`)
        .run(uuid(), h.id, NURSING_OFFICE, 'ستادی');
    }
    out.push(seedUnit(h.id, NURSING_OFFICE, OFFICE_ROLES.map(r => [r[0], r[1], r[2], r[3]])));

    for (const ward of wards) {
      const [nurses, aides, secretaries] = WARD_SIZE[ward] || DEFAULT_SIZE;
      const plan = [['سرپرستار', 'زن', 18, 169]];
      for (let i = 0; i < nurses; i++) {
        plan.push(['پرستار', i % 4 === 3 ? 'مرد' : 'زن', 3 + ((i * 3) % 16), 169]);
      }
      for (let i = 0; i < aides; i++) plan.push(['کمک‌پرستار', i % 2 ? 'مرد' : 'زن', 2 + i * 4, 169]);
      for (let i = 0; i < secretaries; i++) plan.push(['منشی بخش', 'زن', 4 + i * 3, 189]);
      out.push(seedUnit(h.id, ward, plan));
    }
  }
  const made = out.filter(o => !o.skipped);
  const skipped = out.filter(o => o.skipped);
  console.log(`[Seed ShiftSample] ✅ ${made.length} بخش/واحد برنامه‌ی نمونه گرفت`
    + ` (${made.reduce((a, o) => a + o.staff, 0)} پرسنل)`
    + (skipped.length ? ` — ${skipped.length} مورد از قبل پرسنل داشت و دست‌نخورده ماند` : ''));
  for (const o of made) {
    console.log(`   • ${o.ward}: ${o.staff} نفر` + (o.staff > 16 ? '  → چاپ چندصفحه‌ای' : ''));
  }
}

module.exports = { runMigration };
if (require.main === module) runMigration();
