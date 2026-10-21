/* =====================================================================
   سازوکار کدگذاری مدارک کنترل‌شده
   ---------------------------------------------------------------------
   خواسته‌ی کاربر: «کد مرحله‌ی اول دستی، بعد هر ادیت طبق استاندارد تغییر کند».
   یعنی موقع ساخت سند، مدیر اعتباربخشی می‌تواند هر کدی بنویسد (یا خالی
   بگذارد)؛ ولی از اولین ویرایش به بعد، کد به شکل استاندارد نرمال می‌شود.

   استاندارد کد:   «کد واحد - نوع سند - شماره ترتیبی دو رقمی»
                   مثال: IC-PR-01

   نوع سند (همان قراردادی که در راهنمای فیلدها هم به کاربر گفته شده):
     PL = خط‌مشی        PR = روش اجرایی
     WI = دستورالعمل    FM = فرم

   کد واحد از روی «فرد پاسخگو / واحد» سند حدس زده می‌شود؛ اگر نشد، از
   پیشوند کدِ دستیِ خودِ کاربر، و در نهایت GEN (عمومی).

   چرا این فایل جداست: منطق کد هم در مسیر ذخیره‌ی سند لازم است و هم در
   صفحه‌ی «دفتر کد مدارک». دو نسخه‌ی جدا یعنی دو رفتار متفاوت.
   ===================================================================== */
'use strict';

const { query } = require('../config/database');
const { toJalali, todayJalali } = require('../config/jalali');

// نوع سند → کد دو حرفی
const TYPE_CODE = {
  'خط‌مشی': 'PL',
  'خط مشی': 'PL',
  policy: 'PL',
  'روش اجرایی': 'PR',
  procedure: 'PR',
  'دستورالعمل': 'WI',
  instruction: 'WI',
  'فرم': 'FM',
  form: 'FM',
  // مقادیر انگلیسیِ ذخیره‌شده در ستون doc_type
  work_instruction: 'WI',
  guideline: 'WI'
};

// واحدهای رایج بیمارستانی → کد واحد. کلید، تکه‌ای است که در متن جستجو می‌شود.
const UNIT_CODE = [
  ['کنترل عفونت', 'IC'],
  ['بهبود کیفیت', 'QM'],
  ['اعتباربخشی', 'QM'],
  ['پرستاری', 'NR'],
  ['اورژانس', 'ER'],
  ['اتاق عمل', 'OR'],
  ['آزمایشگاه', 'LAB'],
  ['تصویربرداری', 'RAD'],
  ['رادیولوژی', 'RAD'],
  ['داروخانه', 'PH'],
  ['دارو', 'PH'],
  ['تغذیه', 'NUT'],
  ['تجهیزات', 'BME'],
  ['بهداشت محیط', 'EH'],
  ['بهداشت حرفه‌ای', 'OH'],
  ['منابع انسانی', 'HR'],
  ['مالی', 'FIN'],
  ['حسابداری', 'ACC'],
  ['مدارک پزشکی', 'MR'],
  ['فناوری اطلاعات', 'IT'],
  ['ایمنی بیمار', 'PS'],
  ['تأسیسات', 'FM2'],
  ['خدمات', 'SRV']
];

const TYPE_ORDER = ['PL', 'PR', 'WI', 'FM'];
const TYPE_FA = { PL: 'خط‌مشی', PR: 'روش اجرایی', WI: 'دستورالعمل', FM: 'فرم' };

// الگوی کد استاندارد: حروف/رقم واحد، خط تیره، نوع، خط تیره، دو رقم
const STD = /^([A-Z][A-Z0-9]{1,4})-(PL|PR|WI|FM)-(\d{2,3})$/;

function typeCodeOf(docType) {
  if (!docType) return 'PR';
  return TYPE_CODE[String(docType).trim()] || 'PR';
}

// کد واحد را از متن‌های سند حدس می‌زند (پاسخگو، عنوان، دامنه)
function unitCodeOf(doc, fallbackFromCode) {
  const hay = [doc && doc.responsible_person, doc && doc.title,
               doc && doc.scope, doc && doc.related_staff]
    .filter(Boolean).join(' ');
  for (const [needle, code] of UNIT_CODE) {
    if (hay.includes(needle)) return code;
  }
  // اگر کاربر خودش کد دستی نوشته، پیشوندش را نگه می‌داریم — انتخاب او مهم‌تر
  // از حدسِ ما است، فقط شکلش استاندارد می‌شود.
  if (fallbackFromCode) {
    const m = String(fallbackFromCode).toUpperCase().match(/^([A-Z][A-Z0-9]{1,4})\b/);
    if (m) return m[1];
  }
  return 'GEN';
}

// بزرگ‌ترین شماره‌ی مصرف‌شده در همان (واحد، نوع) + ۱
function nextSeq(hospitalId, unit, type, excludeId) {
  const rows = query(
    'SELECT id, doc_code FROM controlled_documents WHERE hospital_id = ? AND doc_code IS NOT NULL',
    [hospitalId]).rows;
  let max = 0;
  for (const r of rows) {
    if (excludeId && r.id === excludeId) continue;
    const m = STD.exec(String(r.doc_code || '').toUpperCase());
    if (m && m[1] === unit && m[2] === type) max = Math.max(max, parseInt(m[3], 10));
  }
  return max + 1;
}

/**
 * کد بعدیِ استاندارد برای یک سند.
 * @param {string} hospitalId
 * @param {object} doc  حداقل doc_type؛ هرچه بیشتر (responsible_person/title) دقیق‌تر
 * @param {string} manualCode کد دستیِ فعلی، اگر هست
 * @param {string} excludeId  شناسه‌ی خود سند (تا کد فعلی خودش شمارش نشود)
 */
function buildCode(hospitalId, doc, manualCode, excludeId) {
  const type = typeCodeOf(doc && doc.doc_type);
  const unit = unitCodeOf(doc, manualCode);
  const seq = nextSeq(hospitalId, unit, type, excludeId);
  return `${unit}-${type}-${String(seq).padStart(2, '0')}`;
}

/**
 * نرمال‌سازی هنگام ویرایش.
 * قاعده: اگر کد فعلی همین حالا استاندارد است و نوعش با نوع سند می‌خواند،
 * دست‌نخورده می‌ماند (شماره‌ی سند نباید بی‌دلیل عوض شود — روی کاغذهای چاپ‌شده
 * ارجاع داده شده). فقط وقتی کد خالی است، یا شکلش استاندارد نیست، یا نوع سند
 * عوض شده و دیگر با کد نمی‌خواند، کد تازه ساخته می‌شود.
 */
function normalizeOnEdit(hospitalId, doc, currentCode, docId) {
  const wantType = typeCodeOf(doc && doc.doc_type);
  const m = STD.exec(String(currentCode || '').toUpperCase().trim());
  if (m && m[2] === wantType) return String(currentCode).toUpperCase().trim();
  return buildCode(hospitalId, doc, currentCode, docId);
}

// آیا این کد در همین بیمارستان تکراری است؟
function isDuplicate(hospitalId, code, exceptId) {
  if (!code) return false;
  const rows = query(
    'SELECT id FROM controlled_documents WHERE hospital_id = ? AND UPPER(doc_code) = UPPER(?)',
    [hospitalId, code]).rows;
  return rows.some(r => r.id !== exceptId);
}

/** فهرست دفتر کد، گروه‌بندی‌شده بر اساس نوع سند */
// سالِ شمسیِ یک تاریخِ میلادیِ ISO. تاریخِ خراب/خالی → null تا چیزی حدس زده نشود.
function jalaliYearOf(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return null;
  try { return toJalali(+m[1], +m[2], +m[3]).jy; } catch (e) { return null; }
}

function register(hospitalId) {
  const rows = query(
    `SELECT id, doc_type, title, doc_code, status, version_no, responsible_person,
            created_at, updated_at, review_date, prepared_date
       FROM controlled_documents WHERE hospital_id = ?
      ORDER BY doc_type, doc_code, title`, [hospitalId]).rows;

  const groups = {};
  for (const r of rows) {
    const tc = typeCodeOf(r.doc_type);
    const key = r.doc_type || TYPE_FA[tc] || 'سایر';
    (groups[key] = groups[key] || { type_code: tc, doc_type: key, items: [] });
    // سالِ تولیدِ فرم و شماره‌ی ویرایشِ سالانه — خواسته‌ی کارفرما: «هر فرمی که
    // وارد می‌شود مثلاً از سال ۱۴۰۳ تولید شده، شماره ویرایشش جلوش سالانه بخورد».
    // هر دو محاسبه‌ای‌اند و روی داده‌ی موجود (تاریخ ایجاد) می‌نشینند، پس ستون
    // تازه‌ای لازم نشد و اسناد قدیمی هم بی‌مهاجرت درست نمایش داده می‌شوند.
    const originYear = jalaliYearOf(r.prepared_date || r.created_at);
    const thisYear = todayJalali().jy;
    groups[key].items.push({
      ...r,
      type_code: tc,
      origin_year: originYear,
      annual_revision: originYear ? Math.max(1, thisYear - originYear + 1) : null,
      standard: STD.test(String(r.doc_code || '').toUpperCase()),
      duplicate: !!r.doc_code && rows.filter(x =>
        String(x.doc_code || '').toUpperCase() === String(r.doc_code).toUpperCase()).length > 1
    });
  }
  // ترتیب گروه‌ها طبق ترتیب استاندارد نوع سند، نه الفبایی
  const ordered = Object.values(groups).sort(
    (a, b) => TYPE_ORDER.indexOf(a.type_code) - TYPE_ORDER.indexOf(b.type_code));
  return { groups: ordered, total: rows.length };
}

module.exports = {
  TYPE_CODE, UNIT_CODE, TYPE_FA, TYPE_ORDER, STD,
  typeCodeOf, unitCodeOf, buildCode, normalizeOnEdit, isDuplicate, register
};
