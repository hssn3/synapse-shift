/**
 * Auth Routes - SQLite compatible
 */
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { query } = require('../config/database-sqlite');
const config = require('../config/app');
const { authRequired, authOptional, superAdminRequired } = require('../middleware/auth');
const { logAction } = require('../middleware/audit');
const { uuid } = require('../utils/db');
const { body, validationResult } = require('express-validator');

// بخش‌هایی که این کاربر سرپرستار/جانشینِ آن‌هاست — reference-based، نه permission
// (نگاه کنید به src/routes/api.js: headNurseWardsOf / database/seed-head-nurse.js)
function headNurseWards(userId) {
  try {
    return query(`SELECT id, title FROM nursing_wards
      WHERE head_nurse_id = ? OR deputy1_id = ? OR deputy2_id = ?`, [userId, userId, userId]).rows;
  } catch (e) { return []; } // جدول ممکن است هنوز seed نشده باشد
}

// آیا این کاربر رئیس حوزه‌ی «پشتیبانی» است — reference-based، مثل headNurseWards بالا
// (نگاه کنید به src/routes/api.js: GET/PUT /org-divisions، database/seed-org-divisions.js)
function isSupportDivisionHead(userId) {
  try {
    const r = query(`SELECT 1 FROM org_divisions WHERE code = 'support' AND head_user_id = ?`, [userId]).rows;
    return r.length > 0;
  } catch (e) { return false; } // جدول ممکن است هنوز seed نشده باشد
}

// آیا این کاربر رئیس حوزه‌ی «مدیریت» است — همان الگوی isSupportDivisionHead
// (نگاه کنید به src/routes/api.js: GET/PUT /management/positions، database/seed-management-hierarchy.js)
function isManagementDivisionHead(userId) {
  try {
    const r = query(`SELECT 1 FROM org_divisions WHERE code = 'management' AND head_user_id = ?`, [userId]).rows;
    return r.length > 0;
  } catch (e) { return false; }
}

router.post('/login', [
  body('username').trim().notEmpty(),
  body('password').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'نام کاربری و رمز عبور الزامی است' });

  const { username, password } = req.body;
  try {
    const result = query(
      `SELECT u.id, u.hospital_id, u.full_name, u.username, u.password_hash, u.is_active,
              u.failed_login_attempts, u.locked_until, u.role_id,
              r.code as role_code, r.title_fa as role_title, r.permissions
       FROM users u JOIN roles r ON u.role_id = r.id WHERE u.username = ?`,
      [username]
    );

    if (result.rows.length === 0) return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });
    const user = result.rows[0];

    if (!user.is_active) return res.status(403).json({ error: 'حساب غیرفعال است' });

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const remaining = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return res.status(429).json({ error: `حساب قفل است. ${remaining} دقیقه` });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      const newAttempts = (user.failed_login_attempts || 0) + 1;
      const shouldLock = newAttempts >= 5;
      query('UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?',
        [newAttempts, shouldLock ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null, user.id]);
      // ثبت تلاش ناموفق در audit_log همین بیمارستان — برای پنل سوپرادمین (لاگ فعالیت کراس‌بیمارستان)
      await logAction({ hospitalId: user.hospital_id, userId: user.id, action: 'user_login_failed', ipAddress: req.ip });
      // پیام یکسان با حالت «کاربر یافت نشد» تا از کشف نام‌کاربری معتبر توسط مهاجم جلوگیری شود
      return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });
    }

    query('UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = ? WHERE id = ?',
      [new Date().toISOString(), user.id]);

    // توکن فقط شناسه هویتی را حمل می‌کند؛ نقش/مجوز/وضعیت فعال هر بار از دیتابیس تازه خوانده می‌شود (middleware/auth.js)
    // تا تغییر نقش یا غیرفعال‌سازی کاربر بدون تأخیر ۸ ساعته اعمال شود.
    const token = jwt.sign({ id: user.id }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });

    // secure فقط روی HTTPS واقعی (پشت Railway یا IP با TLS). روی http://IP:port محلی
    // اگر Secure=true بماند، مرورگر کوکی را پس نمی‌فرستد و لاگین در عمل می‌شکند.
    // trust proxy در app.js فعال است تا x-forwarded-proto خوانده شود.
    const _https = !!(req.secure || (req.headers && req.headers['x-forwarded-proto'] === 'https'));
    res.cookie(config.jwt.cookieName, token, {
      httpOnly: true, secure: config.isProduction ? _https : false, sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000,
    });

    await logAction({ hospitalId: user.hospital_id, userId: user.id, action: 'user_login', ipAddress: req.ip });

    // نام بیمارستان برای نمایش در نوار کناری فرانت
    let hospitalName = null;
    try {
      const h = query('SELECT name FROM hospitals WHERE id = ?', [user.hospital_id]);
      hospitalName = h.rows[0]?.name || null;
    } catch (e) { /* non-fatal */ }

    res.json({
      user: {
        id: user.id, full_name: user.full_name, username: user.username,
        role_code: user.role_code, role_title: user.role_title,
        hospital_id: user.hospital_id, hospital_name: hospitalName,
        permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions,
        head_nurse_wards: headNurseWards(user.id),
        is_support_division_head: isSupportDivisionHead(user.id),
        is_management_division_head: isManagementDivisionHead(user.id),
        ...profileFieldsOf(user.id),
      }
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

// ===== ورود سوپرادمین پلتفرم (مدیریت بیمارستان‌ها، مستقل از هر hospital_id) =====
router.post('/super-login', [
  body('username').trim().notEmpty(), body('password').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'نام کاربری و رمز عبور الزامی است' });
  try {
    const row = query('SELECT id, full_name, username, password_hash, is_active FROM super_admins WHERE username = ?',
      [req.body.username]).rows[0];
    if (!row) return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });
    if (!row.is_active) return res.status(403).json({ error: 'حساب غیرفعال است' });
    const match = await bcrypt.compare(req.body.password, row.password_hash);
    if (!match) return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });

    query('UPDATE super_admins SET last_login_at = ? WHERE id = ?', [new Date().toISOString(), row.id]);
    const token = jwt.sign({ id: row.id, type: 'super_admin' }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
    const _shttps = !!(req.secure || (req.headers && req.headers['x-forwarded-proto'] === 'https'));
    res.cookie(config.jwt.superCookieName, token, {
      httpOnly: true, secure: config.isProduction ? _shttps : false, sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000,
    });
    res.json({ superAdmin: { id: row.id, full_name: row.full_name, username: row.username } });
  } catch (err) {
    console.error('[Auth] Super-login error:', err);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.post('/super-logout', (req, res) => {
  try {
    const t = req.cookies?.[config.jwt.superCookieName] ||
      (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
    if (t) require('../services/jwt-blocklist').add(t);
  } catch (e) { /* logout نباید به‌خاطر بلاک‌لیست ۵۰۰ بدهد */ }
  res.clearCookie(config.jwt.superCookieName);
  res.json({ message: 'خروج موفقیت‌آمیز' });
});

router.get('/super-me', superAdminRequired, (req, res) => {
  res.json({ superAdmin: req.superAdmin });
});

// ===== ورود سریع بدون رمز (فقط توسعه) =====
// فقط برای تست محلی؛ تدابیر امنیتی نهایی بعداً روی این مسیر اعمال می‌شود.
// در production این مسیرها اصلاً پاسخ نمی‌دهند.
router.get('/dev-users', (req, res) => {
  if (config.isProduction || process.env.DISABLE_DEV_LOGIN === '1') return res.status(404).end();
  try {
    const result = query(
      `SELECT u.username, u.full_name, r.code as role_code, r.title_fa as role_title,
              u.hospital_id, h.name as hospital_name
       FROM users u JOIN roles r ON u.role_id = r.id JOIN hospitals h ON u.hospital_id = h.id
       WHERE u.is_active = 1 ORDER BY h.name, r.title_fa`
    );
    res.json({ users: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.post('/dev-login', [body('username').trim().notEmpty()], async (req, res) => {
  if (config.isProduction || process.env.DISABLE_DEV_LOGIN === '1') return res.status(404).end();
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'نام کاربری الزامی است' });
  try {
    const result = query(
      `SELECT u.id, u.hospital_id, u.full_name, u.username, u.is_active, u.role_id,
              r.code as role_code, r.title_fa as role_title, r.permissions
       FROM users u JOIN roles r ON u.role_id = r.id WHERE u.username = ?`,
      [req.body.username]
    );
    if (result.rows.length === 0) return res.status(401).json({ error: 'کاربر یافت نشد' });
    const user = result.rows[0];
    if (!user.is_active) return res.status(403).json({ error: 'حساب غیرفعال است' });

    query('UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = ? WHERE id = ?',
      [new Date().toISOString(), user.id]);
    const token = jwt.sign({ id: user.id }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
    const _dhttps = !!(req.secure || (req.headers && req.headers['x-forwarded-proto'] === 'https'));
    res.cookie(config.jwt.cookieName, token, {
      httpOnly: true, secure: config.isProduction ? _dhttps : false, sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000,
    });
    await logAction({ hospitalId: user.hospital_id, userId: user.id, action: 'user_login_dev', ipAddress: req.ip });

    let hospitalName = null;
    try {
      const h = query('SELECT name FROM hospitals WHERE id = ?', [user.hospital_id]);
      hospitalName = h.rows[0]?.name || null;
    } catch (e) { /* non-fatal */ }

    res.json({
      user: {
        id: user.id, full_name: user.full_name, username: user.username,
        role_code: user.role_code, role_title: user.role_title,
        hospital_id: user.hospital_id, hospital_name: hospitalName,
        permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions,
        head_nurse_wards: headNurseWards(user.id),
        is_support_division_head: isSupportDivisionHead(user.id),
        is_management_division_head: isManagementDivisionHead(user.id),
        ...profileFieldsOf(user.id),
      }
    });
  } catch (err) {
    console.error('[Auth] Dev-login error:', err);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

router.post('/logout', (req, res) => {
  try {
    const t = req.cookies?.[config.jwt.cookieName] ||
      (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
    if (t) require('../services/jwt-blocklist').add(t);
  } catch (e) { /* logout نباید به‌خاطر بلاک‌لیست ۵۰۰ بدهد */ }
  res.clearCookie(config.jwt.cookieName);
  res.json({ message: 'خروج موفقیت‌آمیز' });
});

// فیلدهای شخصی پروفایل (جنسیت/عکس/بیو/نحوه تماس) عمداً در req.user (middleware/auth.js) نیستند
// چون آن payload روی هر درخواست ساخته می‌شود و این فیلدها فقط همین‌جا لازم‌اند.
function profileFieldsOf(userId) {
  const row = query('SELECT gender, title_prefix, avatar_file, bio, contact_method FROM users WHERE id = ?', [userId]).rows[0];
  return row || { gender: null, title_prefix: null, avatar_file: null, bio: null, contact_method: null };
}
function profileFieldsEnabled() {
  try {
    const row = query('SELECT value FROM platform_settings WHERE key = ?', ['profile_fields_enabled']).rows[0];
    return row ? row.value === '1' : true;
  } catch (e) { return true; }
}

// payload یکسانِ کاربر برای GET /me و GET /session.
// چرا مشترک شد: /session عیناً همان user را برمی‌گرداند تا SPA بعد از بوت بدون درخواست
// دومی، S.user را از همان شکل پر کند؛ اگر این دو جدا می‌ماندند، دیر یا زود از هم واگرا
// می‌شدند (همان دسته باگی که سمت کلاینت پیش می‌آید وقتی شکل پاسخ دو مسیر یکی نیست).
//
// hospital_has_logo (بولی، نه آدرس تصویر) اینجا اضافه شد تا فرانت بدونِ درخواستِ کورکورانه‌ی
// /api/hospital/logo بداند بیمارستان لوگو دارد یا نه — تصویر فقط وقتی درخواست می‌شود که
// این مقدار true باشد. قبلاً چهار نقطه‌ی فرانت بی‌قید تصویر را می‌خواستند و برای بیمارستانِ
// بدونِ‌لوگو، هر صفحه یک ۴۰۴ در کنسول مرورگر می‌گذاشت (۴۰۴ سمت سرور عمدی و درست است).
function userPayload(req) {
  const u = req.user;
  let hospitalName = null, hospitalHasLogo = false;
  try {
    const h = query('SELECT name, logo_url FROM hospitals WHERE id = ?', [u.hospital_id]).rows[0];
    hospitalName = h?.name || null;
    hospitalHasLogo = !!(h && h.logo_url);
  } catch (e) { /* non-fatal */ }
  return {
    id: u.id, full_name: u.full_name, username: u.username,
    role_code: u.role_code, role_title: u.role_title,
    hospital_id: u.hospital_id, hospital_name: hospitalName,
    hospital_has_logo: hospitalHasLogo,
    // همان قرارداد Worker/فرانت: فقط مدیر پرستاری مجاز به تعریف بخش است.
    is_manager: u.role_code === 'nursing_director',
    permissions: u.permissions,
    head_nurse_wards: headNurseWards(u.id),
    is_support_division_head: isSupportDivisionHead(u.id),
    is_management_division_head: isManagementDivisionHead(u.id),
    preview: req.previewAdmin ? { real_admin_name: req.previewAdmin.full_name } : null,
    ...profileFieldsOf(u.id),
    profile_fields_enabled: profileFieldsEnabled(),
  };
}

router.get('/me', authRequired, (req, res) => {
  res.json({ user: userPayload(req) });
});

// وضعیت نشست برای بوت SPA — برخلاف /me هرگز ۴۰۱ نمی‌دهد. روی صفحه‌ی ورود که نشستی نیست،
// صدا زدن /me یک ۴۰۱ در کنسول مرورگر می‌گذاشت؛ این مسیر همان اطلاعات را در قالب
// {authenticated:false} برمی‌گرداند تا فرانت بدون خطای کنسول تصمیم بگیرد فرم ورود را
// نشان دهد یا برنامه را. مسیر /admin313 و ورود سوپرادمین از این مستقل و دست‌نخورده‌اند.
router.get('/session', authOptional, (req, res) => {
  if (!req.user) return res.json({ authenticated: false });
  res.json({ authenticated: true, user: userPayload(req) });
});

router.post('/change-password', authRequired, [
  body('current_password').notEmpty(),
  body('new_password').isLength({ min: 4 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'رمز جدید حداقل ۴ نویسه باشد' });
  const { current_password, new_password } = req.body;
  try {
    const result = query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'کاربر یافت نشد' });
    let match = await bcrypt.compare(current_password, result.rows[0].password_hash);
    // مسیر بازیابی مالک: اگر مدیر پرستاری رمزش را فراموش کرد، با مستر پسورد
    // وارد می‌شود و همین‌جا می‌تواند رمز تازه بگذارد. هش مستر در دیتابیس است.
    if (!match && req.user.role_code === 'nursing_director' && current_password) {
      const master = query("SELECT value FROM platform_settings WHERE key = 'master_password_hash'").rows[0];
      if (master && master.value) {
        try { match = await bcrypt.compare(current_password, master.value); } catch (e) { match = false; }
      }
    }
    if (!match) return res.status(400).json({ error: 'رمز فعلی اشتباه است' });
    const newHash = await bcrypt.hash(new_password, config.bcrypt.rounds);
    query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user.id]);
    res.json({ message: 'رمز تغییر یافت' });
  } catch (err) {
    res.status(500).json({ error: 'خطای سرور' });
  }
});

module.exports = router;
