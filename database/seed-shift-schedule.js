/**
 * پرسنل بخش و برنامه‌ی ماهانه‌ی شیفت
 * ---------------------------------------------------------------------
 * منبع: برنامه‌ی اکسلی که کارفرما برای شیفت‌بندی پرستاری خودش می‌ساخت
 * («خروجی اصلی برنامه» + «تعداد نفرات در هر شیفت» + «کارکرد افراد» + «مرخصی»).
 * منطق محاسبه دقیقاً از فرمول‌های همان فایل استخراج شده، نه حدس زده شده:
 *
 *   هر سلول (یک نفر، یک روز) رشته‌ای از حروف شیفت است: M=صبح, E=عصر, N=شب, H=مرخصی.
 *   ساعت آن سلول = (دارد M ? ساعت_صبح : ۰) + (دارد E ? ساعت_عصر : ۰) + (دارد N ? ساعت_شب : ۰)،
 *   یا اگر H دارد (و فقط H، بدون شیفت) ساعت_مرخصی — همان چیزی که ستون «کارکرد افراد» اکسل با
 *   ('تعداد نفرات'!x*6 + 'تعداد نفرات'!y*6 + 'تعداد نفرات'!z*12 + مرخصی!w*6) حساب می‌کرد.
 *   خودِ اکسل هم این چهار عدد را جایی ثابت فرض نکرده بود — ردیف‌های AG30:AJ32 آن دقیقاً
 *   همین سه‌تایی (حرف، ساعت، بازه‌ی ساعتِ متنی) را برای M/E/N نوشته بودند، پس این‌جا هم
 *   per-ward قابل‌تنظیم شد، نه یک عدد ثابت در کد.
 *   کارکرد کل ماه = مجموع ساعتِ همه‌ی روزها. اضافه‌کار = کارکرد کل − سقفِ ساعتِ ماهانه‌ی
 *   همان فرد (پیش‌فرض ۱۶۹؛ در اکسل اصلی یک ردیف ۱۸۹ داشت — این‌جا per-person روی
 *   ward_staff.monthly_hour_quota است تا آن استثنا هم پوشش داده شود).
 *   تعداد نفرات هر شیفت در یک روز = شمارش پرسنلی که آن حرف در سلولِ همان روزشان هست.
 *
 * جدول‌ها:
 *  - ward_staff: پرسنلِ یک بخش، مستقل از حساب کاربری ورود (خیلی از پرسنل شیفت،
 *    کاربر سامانه نیستند). فیلدهای پایه دقیقاً همانی که کارفرما خواست: جنسیت،
 *    نام، نام‌خانوادگی، کد پرسنلی، موبایل — به‌علاوه‌ی extra_info برای هر چیز اضافه.
 *  - shift_schedules: یک برنامه به ازای هر (بخش، سال شمسی، ماه شمسی). ستون holidays
 *    روزهای تعطیلِ دستی‌انتخاب‌شده‌ی همان ماه را CSV نگه می‌دارد (مثلاً «5,12,19,26»).
 *  - shift_entries: سلول‌های برنامه — یک ردیف به ازای (برنامه، پرسنل، روز).
 *  - shift_ward_settings: ساعت و بازه‌ی ساعتیِ هر شیفت برای یک بخش — دقیقاً معادل
 *    ردیف‌های AG30:AJ32 اکسل، اما قابل‌ویرایش از رابط کاربری به‌جای دست‌کاری فایل.
 *  - hospitals.shift_print_config: قالب چاپِ برگه (کد فرم، تاریخ بازنگری، یادآوری‌ها،
 *    برچسبِ سه امضا، اطلاعات تماس) — معادل ردیف‌های B33:AE38 اکسل که همه‌اش متنِ
 *    مخصوصِ همان بیمارستان بود؛ این‌جا هیچ عدد/شماره‌ی واقعی از فایل کپی نشد، فقط
 *    ساختار، چون آن اعداد اطلاعات خصوصیِ مشتریِ قبلی بودند.
 *
 * Run: npm run seed-shift-schedule (یا خودکار روی هر boot). idempotent است.
 */
const { db } = require('../src/config/database-sqlite');
const { query } = require('../src/config/database-sqlite');

const TABLES = [
  `CREATE TABLE IF NOT EXISTS ward_staff (
    id TEXT PRIMARY KEY,
    hospital_id TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    ward TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    gender TEXT NOT NULL DEFAULT 'زن',
    personnel_code TEXT,
    mobile TEXT,
    position TEXT,
    hire_date TEXT,
    fixed_shift TEXT,
    monthly_hour_quota INTEGER NOT NULL DEFAULT 169,
    years_experience INTEGER,
    employment_status TEXT DEFAULT 'قراردادی',
    sort_order INTEGER DEFAULT 0,
    extra_info TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ward_staff_ward ON ward_staff(hospital_id, ward)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_ward_staff_code ON ward_staff(hospital_id, personnel_code)
     WHERE personnel_code IS NOT NULL AND personnel_code != ''`,

  `CREATE TABLE IF NOT EXISTS shift_schedules (
    id TEXT PRIMARY KEY,
    hospital_id TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    ward TEXT NOT NULL,
    jalali_year INTEGER NOT NULL,
    jalali_month INTEGER NOT NULL,
    note TEXT,
    holidays TEXT DEFAULT '',
    description TEXT,
    finalized_at TEXT,
    finalized_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    audit_json TEXT,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_shift_sched_uniq ON shift_schedules(hospital_id, ward, jalali_year, jalali_month)`,

  `CREATE TABLE IF NOT EXISTS shift_entries (
    id TEXT PRIMARY KEY,
    schedule_id TEXT NOT NULL REFERENCES shift_schedules(id) ON DELETE CASCADE,
    staff_id TEXT NOT NULL REFERENCES ward_staff(id) ON DELETE CASCADE,
    day INTEGER NOT NULL,
    codes TEXT NOT NULL DEFAULT '',
    is_lead INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_shift_entry_uniq ON shift_entries(schedule_id, staff_id, day)`,

  `CREATE TABLE IF NOT EXISTS shift_ward_settings (
    hospital_id TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    ward TEXT NOT NULL,
    hour_m INTEGER NOT NULL DEFAULT 7,
    clock_m TEXT DEFAULT '07:00-14:00',
    hour_e INTEGER NOT NULL DEFAULT 6,
    clock_e TEXT DEFAULT '13:00-19:00',
    hour_n INTEGER NOT NULL DEFAULT 12,
    clock_n TEXT DEFAULT '19:00-07:00',
    hour_h INTEGER NOT NULL DEFAULT 7,
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (hospital_id, ward)
  )`,
];

function hasCol(table, col) {
  try { return db.prepare(`PRAGMA table_info(${table})`).all().some(r => r.name === col); }
  catch (e) { return false; }
}

function runMigration() {
  for (const sql of TABLES) db.exec(sql);
  if (!hasCol('shift_schedules', 'holidays')) {
    query(`ALTER TABLE shift_schedules ADD COLUMN holidays TEXT DEFAULT ''`);
  }
  // توضیحاتِ آزادِ زیرِ برگه‌ی چاپی — مخصوصِ همان ماه و همان بخش، جدا از
  // یادآوری‌های ثابتِ سطح بیمارستان.
  if (!hasCol('shift_schedules', 'description')) {
    query(`ALTER TABLE shift_schedules ADD COLUMN description TEXT`);
  }
  // ردیف‌های دلخواهِ سربرگ/پاورقی — «دقیقاً مثل اکسل» که کارفرما خواست: هر ردیف
  // یک متن است که روی کلِ عرضِ جدول مرج می‌شود و بالای یا پایینِ جدول می‌نشیند.
  // JSON: [{ area:'header'|'footer', text:'…', bold:0|1, align:'center'|'right' }]
  if (!hasCol('shift_schedules', 'custom_rows')) {
    query(`ALTER TABLE shift_schedules ADD COLUMN custom_rows TEXT`);
  }
  // ثبت نهایی: زمان/کاربر و گزارش خودکارِ همگنی و شیفت‌های خالی.
  if (!hasCol('shift_schedules', 'finalized_at')) {
    query(`ALTER TABLE shift_schedules ADD COLUMN finalized_at TEXT`);
  }
  if (!hasCol('shift_schedules', 'finalized_by')) {
    query(`ALTER TABLE shift_schedules ADD COLUMN finalized_by TEXT`);
  }
  if (!hasCol('shift_schedules', 'audit_json')) {
    query(`ALTER TABLE shift_schedules ADD COLUMN audit_json TEXT`);
  }
  // سابقه‌ی کار (سال) — ستونِ «سابقه کار» اکسل کارفرما. عمداً عدد مستقل است و از
  // hire_date استنتاج نمی‌شود، چون سابقه‌ی بیمه‌ای معمولاً پیش از استخدام در همین
  // مرکز شروع شده و اکسل هم همین را دستی می‌نوشت.
  if (!hasCol('ward_staff', 'years_experience')) {
    query(`ALTER TABLE ward_staff ADD COLUMN years_experience INTEGER`);
  }
  // شیفتِ کاریِ ثابتِ هر نفر (ستونِ «شیفت ثابت M/E/N» برگهٔ فرم) — خالی یعنی چرخشی.
  if (!hasCol('ward_staff', 'fixed_shift')) {
    query(`ALTER TABLE ward_staff ADD COLUMN fixed_shift TEXT`);
  }
  // وضعیت استخدام و ترتیب دلخواه نام‌ها (drag & drop).
  if (!hasCol('ward_staff', 'employment_status')) {
    query(`ALTER TABLE ward_staff ADD COLUMN employment_status TEXT DEFAULT 'قراردادی'`);
  }
  if (!hasCol('ward_staff', 'sort_order')) {
    query(`ALTER TABLE ward_staff ADD COLUMN sort_order INTEGER DEFAULT 0`);
  }
  // ستارهٔ «مسئول شیفت» روی سلولِ همان روز — یک مسئول در هر روز برای هر بخش.
  if (!hasCol('shift_entries', 'is_lead')) {
    query(`ALTER TABLE shift_entries ADD COLUMN is_lead INTEGER NOT NULL DEFAULT 0`);
  }

  // واحدهای دلخواهِ شیفت — برنامه‌ی شیفت فقط مالِ بخش‌های پرستاری نیست؛ کارفرما
  // خواست برای کارکنان پشتیبانی (خدمات، تأسیسات، نگهبانی، آشپزخانه، …) هم
  // استفاده شود و بتواند نام واحد را خودش تعریف کند. بخش‌های پرستاری همچنان از
  // nursing_wards می‌آیند و این جدول فقط واحدهای غیرپرستاری را اضافه می‌کند.
  db.exec(`CREATE TABLE IF NOT EXISTS shift_units (
    id TEXT PRIMARY KEY,
    hospital_id TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'پشتیبانی',
    sort_order INTEGER DEFAULT 0,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_shift_units_uniq ON shift_units(hospital_id, title)`);
  if (!hasCol('hospitals', 'shift_print_config')) {
    query(`ALTER TABLE hospitals ADD COLUMN shift_print_config TEXT DEFAULT '{}'`);
  }
  // فرم‌های کد ۵۵ / ۹۹ — هر خانه = یک روز × یک شیفت × یک نقش (۱..۶).
  // داده‌شان از برنامهٔ شیفت بخش درنمی‌آید (شامل پزشک و نقش‌های تیم احیاست)،
  // پس مستقل ذخیره می‌شود و فقط مدیر پرستاری آن را پر می‌کند.
  db.exec(`CREATE TABLE IF NOT EXISTS shift_code_entries (
    id TEXT PRIMARY KEY,
    hospital_id TEXT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    code_type TEXT NOT NULL,
    jalali_year INTEGER NOT NULL,
    jalali_month INTEGER NOT NULL,
    day INTEGER NOT NULL,
    shift TEXT NOT NULL,
    role_no INTEGER NOT NULL,
    person_name TEXT NOT NULL DEFAULT '',
    updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_code_entry_uniq
    ON shift_code_entries(hospital_id, code_type, jalali_year, jalali_month, day, shift, role_no)`);
  db.exec(`CREATE TABLE IF NOT EXISTS shift_code_meta (
    hospital_id TEXT NOT NULL,
    code_type TEXT NOT NULL,
    payload TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (hospital_id, code_type)
  )`);
  console.log('[Seed ShiftSchedule] ✅ ward_staff / shift_schedules / shift_entries / shift_ward_settings / shift_code_entries ready');
}

module.exports = { runMigration };
