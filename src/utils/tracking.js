/**
 * تولید «کد رهگیری» یکتا برای گزارش خطا/واقعه — ERR-{کد کوتاه بیمارستان}-{سال شمسی}-{شماره}
 * همیشه سمت سرور تولید می‌شود؛ هرگز از بدنهٔ درخواست کاربر خوانده نمی‌شود.
 */

function jalaliYear(date = new Date()) {
  // چرا jalali.js مرجع واحد است: Intl در بعضی بیلدها تقویم شمسی ندارد و به میلادی می‌افتاد.
  try {
    const { todayJalali } = require('../config/jalali');
    const jy = todayJalali().jy;
    if (jy > 1300 && jy < 1600) return jy;
  } catch { /* fallback پایین */ }
  try {
    const y = new Intl.DateTimeFormat('en-u-ca-persian', { year: 'numeric' }).format(date);
    const n = parseInt(String(y).replace(/\D/g, ''), 10);
    if (n > 1300 && n < 1600) return n;
  } catch { /* ICU ناقص — به میلادی برمی‌گردیم */ }
  return date.getFullYear();
}

function hospitalShort(hospitalId) {
  return String(hospitalId || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-4)
    .toUpperCase() || 'XXXX';
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} hospitalId
 * @returns {string} کد رهگیری یکتا
 */
function buildTrackingCode(db, hospitalId) {
  const year = jalaliYear();
  const prefix = `ERR-${hospitalShort(hospitalId)}-${year}-`;
  const row = db.prepare(
    `SELECT COUNT(*) AS c FROM medical_error_reports WHERE tracking_code LIKE ?`
  ).get(prefix + '%');
  let seq = (row?.c || 0) + 1;
  // در برابر رقابت همزمان / حذف رکورد: تا یافتن کد آزاد جلو می‌رویم
  const exists = db.prepare('SELECT 1 FROM medical_error_reports WHERE tracking_code = ?');
  for (let i = 0; i < 1000; i++) {
    const code = prefix + String(seq).padStart(4, '0');
    if (!exists.get(code)) return code;
    seq++;
  }
  return prefix + Date.now();
}

module.exports = { buildTrackingCode, jalaliYear };
