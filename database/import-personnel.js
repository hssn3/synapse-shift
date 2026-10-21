/**
 * ورود فهرست پرسنل بیمارستان (بر اساس برگه‌های بخش‌ها و سمت‌ها)
 * ------------------------------------------------------------------
 * اجرا:  node database/import-personnel.js
 *
 * اسکریپت idempotent است: اگر دوباره اجرا شود، پرسنل موجود را با
 * «بخش + نام + نام خانوادگی» پیدا می‌کند و فقط سمت/ترتیب/جنسیت را
 * به‌روز می‌کند. شیفت ثابت، سابقه و ساعت قراردادیِ پرسنل موجود
 * دست‌نخورده می‌ماند.
 *
 * نکتهٔ داده: در برگهٔ «ICU 2» چند نام تکراری بود (زهرا میلادی، فاطمه
 * قلاوند، مهدی بازوند، محسن آزادبخت، علی عبدوی) که فقط یک‌بار ثبت
 * می‌شوند. «مسعود حق دوست» در دو بخش «کمک اتاق عمل» و «کمک ICU»
 * آمده و چون برگه هر دو بخش را جدا معرفی کرده، در هر دو ثبت می‌شود.
 */
'use strict';
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const DB_PATH = process.argv[2] || path.join(__dirname, 'hospital.db');
const db = new Database(DB_PATH);
const HOSPITAL_ID = 'dd43b5de-bd17-4245-8dbf-246de3db401d';
const MANAGER_ID = '4ee9de45-dca3-4c1d-921a-e1c631c2967c';
const QUOTA = 158;

const groups = [
  {
    ward: 'اورژانس',
    icon: '🚑',
    position: 'پرستار',
    chiefPosition: 'سرپرستار',
    people: [
      ['مریم', 'بهنامی نژاد', 'زن'],
      ['نغمه', 'صادقی پری', 'زن'],
      ['مهدیه', 'خادم', 'زن'],
      ['محمدامین', 'مقدم', 'مرد'],
      ['حمید', 'شادمهر', 'مرد'],
      ['ناهید', 'مومن', 'زن'],
      ['افسانه', 'حیدری', 'زن'],
      ['علی', 'بوستان افروز', 'مرد'],
      ['علی', 'محتشم', 'مرد'],
      ['محدثه', 'محمدی', 'زن'],
    ],
  },
  {
    ward: 'کارشناسان بیهوشی',
    icon: '💉',
    position: 'کارشناس بیهوشی',
    people: [
      ['رضا', 'بهادری خسروشاهی', 'مرد'],
      ['گیتی', 'رحمانی', 'زن'],
      ['مژگان', 'طاهری', 'زن'],
      ['سجاد', 'امیرحسینی', 'مرد'],
      ['میثم', 'رحیمی', 'مرد'],
      ['سعید', 'عسگری', 'مرد'],
      ['ساسان', 'نظری', 'مرد'],
      ['سینا', 'میلان', 'مرد'],
      ['حمیدرضا', 'یزدی', 'مرد'],
      ['زهرا', 'نعیمی', 'زن'],
      ['پرنیا', 'بابازاده', 'زن'],
      ['حامد', 'سیاهی', 'مرد'],
      ['مرتضی', 'سلیمانی', 'مرد'],
      ['رکسانا', 'اصغری', 'زن'],
      ['ملیکا', 'نوری', 'زن'],
      ['حسام', 'شیری', 'مرد'],
      ['محمد', 'سهرابی', 'مرد'],
    ],
  },
  {
    ward: 'کمک اتاق عمل',
    icon: '🩺',
    position: 'کمک بهیار',
    people: [
      ['محمد', 'اسکندرزاده', 'مرد'],
      ['احسان', 'ناطقی', 'مرد'],
      ['مسعود', 'حق دوست', 'مرد'],
      ['خانم', 'احمدی', 'زن'],
      ['مهران', 'ابوذر', 'مرد'],
    ],
  },
  {
    ward: 'CSSD',
    icon: '♻️',
    position: 'کمک بهیار CSSD',
    people: [
      ['حسن', 'ایرانی', 'مرد'],
      ['رضا', 'رنجبری', 'مرد'],
    ],
  },
  {
    ward: 'انبار',
    icon: '📦',
    position: 'انباردار',
    people: [
      ['عباس', 'منصوری', 'مرد'],
      ['مهناز', 'صبوری', 'زن'],
    ],
  },
  {
    ward: 'منشی اتاق عمل',
    icon: '🗂️',
    position: 'منشی',
    people: [
      ['خاطره', 'کریمیان', 'زن'],
      ['سمانه', 'رحیمی', 'زن'],
    ],
  },
  {
    ward: 'کمک اورژانس',
    icon: '🚑',
    position: 'کمک بهیار',
    people: [
      ['علی اکبر', 'بندانی', 'مرد'],
      ['صدیقه', 'صوفی', 'زن'],
      ['علیرضا', 'کلهری', 'مرد'],
    ],
  },
  {
    ward: 'جراحی',
    icon: '🏥',
    position: 'پرستار',
    chiefPosition: 'سرپرستار',
    people: [
      ['فرح', 'طاهری', 'زن'],
      ['نسرین', 'میرزایی', 'زن'],
      ['معصومه', 'استیری', 'زن'],
      ['علی', 'آژند', 'مرد'],
      ['حسین', 'آزاد بخش', 'مرد'],
      ['محبوبه', 'کاظمی', 'زن'],
      ['امیرحسین', 'شاهعلیزاده', 'مرد'],
      ['هانیه', 'یعقوبی', 'زن'],
      ['اکرم', 'ترابی', 'زن'],
      ['پیام', 'باتمانی', 'مرد'],
      ['فرناز', 'قدرتی', 'زن'],
      ['امیرحسین', 'وحیدنیا', 'مرد'],
      ['متین', 'عزیزی', 'مرد'],
      ['عباس', 'پریسایی', 'مرد'],
      ['راهله', 'شریفی', 'زن'],
    ],
  },
  {
    ward: 'کمک جراحی',
    icon: '🩹',
    position: 'کمک بهیار',
    people: [
      ['سعید', 'بیگدلی', 'مرد'],
      ['معصومه', 'زنده دل', 'زن'],
      ['شهلا', 'صدر مرنی', 'زن'],
      ['هادی', 'صفرلو', 'مرد'],
      ['فهیمه', 'خسروی', 'زن'],
      ['شمسی', 'عاشور', 'زن'],
      ['زینب', 'رامین', 'زن'],
      ['سهیلا', 'مطلب نژاد', 'زن'],
      ['سعید', 'باباپور', 'مرد'],
      ['سجاد', 'خداپناه', 'مرد'],
      ['فاطمه', 'محمودی راد', 'زن'],
    ],
  },
  {
    ward: 'ICU 2',
    icon: '🫀',
    position: 'پرستار',
    chiefPosition: 'سرپرستار',
    people: [
      ['زهرا', 'میلادی', 'زن'],
      ['فاطمه', 'قلاوند', 'زن'],
      ['مهدی', 'بازوند', 'مرد'],
      ['محسن', 'آزادبخت', 'مرد'],
      ['علی', 'عبدوی', 'مرد'],
      ['احسان', 'سلیمان پور', 'مرد'],
      ['سیمین', 'صحرایی', 'زن'],
      ['مینا', 'وارسته', 'زن'],
    ],
  },
  {
    ward: 'ICU 1',
    icon: '🫀',
    position: 'پرستار',
    chiefPosition: 'سرپرستار',
    people: [
      ['علیرضا', 'ترقی', 'مرد'],
      ['مجتبی', 'سالمی', 'مرد'],
      ['حمید', 'عسکری پور', 'مرد'],
      ['اعظم', 'جعفری', 'زن'],
      ['بهروز', 'اسدی', 'مرد'],
      ['محمد', 'حسینی', 'مرد'],
      ['ساسان', 'آتشکار', 'مرد'],
      ['ابراهیم', 'امیری', 'مرد'],
      ['سروش', 'بیات', 'مرد'],
    ],
  },
  {
    ward: 'کمک ICU',
    icon: '🩺',
    position: 'کمک بهیار',
    people: [
      ['زهرا', 'محمدخانی', 'زن'],
      ['شیما', 'مالمیر', 'زن'],
      ['عزیزه', 'اسماعیلی', 'زن'],
      ['حسن', 'آیتی', 'مرد'],
      ['حسین', 'خرازی', 'مرد'],
      ['سعیده', 'بهرامی', 'زن'],
      ['محمد', 'عابدی', 'مرد'],
      ['مسعود', 'حق دوست', 'مرد'],
    ],
  },
  {
    ward: 'کارشناسان اتاق عمل',
    icon: '🏥',
    position: 'کارشناس اتاق عمل',
    chiefPosition: 'مسئول بخش',
    people: [
      ['معصومه', 'خیاز', 'زن'],
      ['نغمه', 'کرمی', 'زن'],
      ['شیوا', 'احمدی', 'زن'],
      ['محبوبه', 'ناصریان', 'زن'],
      ['نیما', 'قویدل', 'مرد'],
      ['علی', 'بیاتانی', 'مرد'],
      ['هادی', 'میرهاشمی', 'مرد'],
      ['رضا', 'فتوکیان', 'مرد'],
      ['علیرضا', 'متقی فرد', 'مرد'],
      ['سید مصطفی', 'نوربخش', 'مرد'],
      ['حسام', 'نادری', 'مرد'],
      ['پویا', 'زند', 'مرد'],
      ['فاطمه', 'مقامی', 'زن'],
      ['حسن', 'دارابی', 'مرد'],
      ['علیرضا', 'حق بین', 'مرد'],
      ['ریحانه', 'صفری', 'زن'],
      ['میلاد', 'حنیفه', 'مرد'],
      ['یاسمن', 'وثوقی', 'زن'],
      ['پوریا', 'کلماتی', 'مرد'],
      ['علیرضا', 'امیدادی', 'مرد'],
      ['معین', 'زمانی', 'مرد'],
      ['کیانا', 'صالحی', 'زن'],
    ],
  },
];

function h12(text) {
  return crypto.createHash('sha1').update(text).digest('hex').slice(0, 12);
}
function wardId(title) {
  return `b0000000-0000-4000-8000-${h12('ward|' + title)}`;
}
function staffId(ward, first, last) {
  return `c0000000-0000-4000-8000-${h12('staff|' + ward + '|' + first + '|' + last)}`;
}

const tx = db.transaction(() => {
  // اصلاح دو نام قدیمیِ نمونهٔ اورژانس، پیش از upsert
  db.prepare(`UPDATE ward_staff SET last_name = 'صادقی پری', updated_at = datetime('now')
              WHERE hospital_id = ? AND ward = 'اورژانس' AND first_name = 'نغمه' AND last_name = 'صادقی'`)
    .run(HOSPITAL_ID);
  db.prepare(`UPDATE ward_staff SET last_name = 'محتشم', updated_at = datetime('now')
              WHERE hospital_id = ? AND ward = 'اورژانس' AND first_name = 'علی' AND last_name = 'مختشم'`)
    .run(HOSPITAL_ID);

  const findWard = db.prepare('SELECT id, sort_order FROM nursing_wards WHERE hospital_id = ? AND title = ?');
  const insertWard = db.prepare(`INSERT INTO nursing_wards
    (id, hospital_id, title, icon, head_nurse_id, deputy1_id, deputy2_id, sort_order, bed_count, created_at, updated_at)
    VALUES (?,?,?,?,NULL,NULL,NULL,?,0,datetime('now'),datetime('now'))`);
  const updateWard = db.prepare(`UPDATE nursing_wards SET icon = ?, sort_order = ?, updated_at = datetime('now')
                                 WHERE hospital_id = ? AND title = ?`);
  const findStaff = db.prepare(`SELECT id, fixed_shift, monthly_hour_quota, years_experience
                                FROM ward_staff WHERE hospital_id = ? AND ward = ? AND first_name = ? AND last_name = ?`);
  const insertStaff = db.prepare(`INSERT INTO ward_staff
    (id, hospital_id, ward, first_name, last_name, gender, personnel_code, mobile, position, hire_date,
     fixed_shift, monthly_hour_quota, years_experience, extra_info, is_active, created_by,
     employment_status, sort_order, created_at, updated_at)
    VALUES (?,?,?,?,?,?,NULL,NULL,?,NULL,NULL,?,NULL,'{}',1,?,'قراردادی',?,datetime('now'),datetime('now'))`);
  const updateStaff = db.prepare(`UPDATE ward_staff SET position = ?, gender = ?, is_active = 1,
                                  sort_order = ?, updated_at = datetime('now')
                                  WHERE id = ? AND hospital_id = ?`);

  let wardOrder = 1;
  let inserted = 0, updated = 0;
  for (const g of groups) {
    const existingWard = findWard.get(HOSPITAL_ID, g.ward);
    if (existingWard) {
      // اورژانس ترتیب ۱ را نگه می‌دارد؛ بقیه به ترتیب فهرست بعد از آن می‌آیند.
      updateWard.run(g.icon, wardOrder, HOSPITAL_ID, g.ward);
    } else {
      insertWard.run(wardId(g.ward), HOSPITAL_ID, g.ward, g.icon, wardOrder);
    }
    wardOrder++;

    g.people.forEach(([first, last, gender], i) => {
      const position = i === 0 && g.chiefPosition ? g.chiefPosition : g.position;
      const found = findStaff.get(HOSPITAL_ID, g.ward, first, last);
      if (found) {
        updateStaff.run(position, gender, i, found.id, HOSPITAL_ID);
        updated++;
      } else {
        insertStaff.run(staffId(g.ward, first, last), HOSPITAL_ID, g.ward, first, last, gender,
          position, QUOTA, MANAGER_ID, i);
        inserted++;
      }
    });
  }
  return { inserted, updated };
});

try {
  const result = tx();
  const total = db.prepare('SELECT COUNT(*) AS n FROM ward_staff WHERE hospital_id = ?').get(HOSPITAL_ID).n;
  const wards = db.prepare('SELECT COUNT(*) AS n FROM nursing_wards WHERE hospital_id = ?').get(HOSPITAL_ID).n;
  console.log(`[personnel] ${result.inserted} نفر جدید، ${result.updated} نفر به‌روزرسانی شد.`);
  console.log(`[personnel] مجموع: ${total} پرسنل در ${wards} بخش/واحد.`);
  console.table(db.prepare(`SELECT ward, COUNT(*) AS n,
      SUM(CASE WHEN position LIKE '%سرپرستار%' OR position = 'مسئول بخش' THEN 1 ELSE 0 END) AS heads
    FROM ward_staff WHERE hospital_id = ? GROUP BY ward ORDER BY MIN(sort_order)`).all(HOSPITAL_ID));
} catch (err) {
  console.error('[personnel] خطا:', err);
  process.exitCode = 1;
} finally {
  db.close();
}
