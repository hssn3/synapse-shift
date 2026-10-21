/**
 * مسیرهای پایه‌ی سایت برای ماژول شیفت:
 *   - فهرست بیمارستان‌های فعال و لوگوی عمومی (صفحه‌ی ورود بدون احراز هویت)
 *   - لوگوی بیمارستانِ کاربر (سربرگ چاپِ برنامه‌ی شیفت)
 *   - ساعت سرور (هم‌زمانی «امروز» کلاینت با سرور)
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const { query } = require('../config/database-sqlite');
const config = require('../config/app');
const { authRequired, hospitalScope } = require('../middleware/auth');

// لوگوی بیمارستان اول در پوشهٔ uploads و بعد در public/img جست‌وجو می‌شود.
// نسخهٔ Cloudflare لوگو را از public/img می‌خواند؛ نسخهٔ Node هم باید برای
// نصب‌های تازه (که هنوز چیزی در uploads ندارند) همان تصویر را نشان دهد.
const PUBLIC_IMG_DIR = path.join(__dirname, '../../public/img');
function sendHospitalLogo(res, logoUrl) {
  const name = path.basename(String(logoUrl || ''));
  if (!name) return res.status(404).json({ error: 'لوگو ثبت نشده' });
  const candidates = [path.join(config.upload.dir, name), path.join(PUBLIC_IMG_DIR, name)];
  const abs = candidates.find(p => fs.existsSync(p));
  if (!abs) return res.status(404).json({ error: 'فایل روی سرور موجود نیست' });
  const ext = path.extname(abs).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : (ext === '.jpg' || ext === '.jpeg') ? 'image/jpeg' : 'image/webp';
  res.type(mime);
  res.sendFile(abs);
}

// فهرست بیمارستان‌های فعال — برای صفحه‌ی «انتخاب مرکز» پیش از ورود
router.get('/public/hospitals', (req, res) => {
  try {
    const rows = query('SELECT id, name, logo_url FROM hospitals WHERE is_active = 1 ORDER BY name').rows;
    res.json({ hospitals: rows.map(h => ({ id: h.id, name: h.name, has_logo: !!h.logo_url })) });
  } catch (err) { res.status(500).json({ error: 'خطای سرور' }); }
});

// لوگوی بیمارستان روی صفحه‌ی ورود (بدون احراز هویت)
router.get('/public/hospital/:id/logo', (req, res) => {
  try {
    const h = query('SELECT logo_url FROM hospitals WHERE id = ? AND is_active = 1', [req.params.id]).rows[0];
    if (!h || !h.logo_url) return res.status(404).json({ error: 'لوگو ثبت نشده' });
    return sendHospitalLogo(res, h.logo_url);
  } catch (err) { res.status(500).json({ error: 'خطای سرور' }); }
});

// لوگوی بیمارستانِ خودِ کاربر (سربرگ چاپِ برنامه‌ی شیفت). ۴۰۴ حالت عادی است.
router.get('/hospital/logo', authRequired, hospitalScope, (req, res) => {
  try {
    const h = query('SELECT logo_url FROM hospitals WHERE id = ?', [req.hospitalId]).rows[0];
    if (!h || !h.logo_url) return res.status(404).json({ error: 'لوگو ثبت نشده' });
    return sendHospitalLogo(res, h.logo_url);
  } catch (err) { res.status(500).json({ error: 'خطای سرور' }); }
});

// ساعتِ مرجع — فرانت «امروز» را از اینجا می‌گیرد (ساعت دستگاه کاربر قابل اعتماد نیست)
router.get('/server-time', (req, res) => {
  const { tehranNow, tehranTodayStr, todayJalali, JMONTHS } = require('../config/jalali');
  const t = tehranNow();
  const j = todayJalali();
  res.set('Cache-Control', 'no-store');
  res.json({
    utc: new Date().toISOString(),
    epoch_ms: Date.now(),
    tehran_date: tehranTodayStr(),
    tehran_time: `${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}`,
    jalali: { jy: j.jy, jm: j.jm, jd: j.jd, month_name: JMONTHS[j.jm - 1] },
  });
});

module.exports = router;
