/**
 * JWT Authentication Middleware
 */
const jwt = require('jsonwebtoken');
const config = require('../config/app');
const { query } = require('../config/database-sqlite');

// توکن فقط هویت (id) را حمل می‌کند؛ نقش/مجوز/وضعیت فعال بودن در هر درخواست تازه از دیتابیس خوانده می‌شود
// تا غیرفعال‌سازی کاربر یا تغییر نقش بدون نیاز به پایان نشست (تا ۸ ساعت) فوراً اعمال شود.
// این یک کوئری ایندکس‌شده تک‌ردیفی روی SQLite محلی است (زیرمیلی‌ثانیه)، پس حتی با تعداد کاربر بالا مقیاس‌پذیر می‌ماند.
function authRequired(req, res, next) {
  const token = req.cookies?.[config.jwt.cookieName] ||
                (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
  if (!token) return res.status(401).json({ error: 'احراز هویت الزامی است' });
  try {
    // بلاک‌لیست logout (B-2): توکن خارج‌شده حتی با امضای معتبر رد می‌شود.
    try { if (require('../services/jwt-blocklist').isBlocked(token)) return res.status(401).json({ error: 'نشست پایان یافته است' }); } catch (e) { /* fail-open با لاگ داخل سرویس */ }
    const payload = jwt.verify(token, config.jwt.secret);
    const fresh = query(
      `SELECT u.id, u.hospital_id, u.full_name, u.username, u.is_active, u.department,
              r.code as role_code, r.title_fa as role_title, r.permissions
       FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?`,
      [payload.id]
    ).rows[0];
    if (!fresh || !fresh.is_active) return res.status(401).json({ error: 'حساب کاربری یافت نشد یا غیرفعال است' });
    req.user = {
      id: fresh.id, hospital_id: fresh.hospital_id, full_name: fresh.full_name, username: fresh.username,
      role_code: fresh.role_code, role_title: fresh.role_title, department: fresh.department,
      permissions: typeof fresh.permissions === 'string' ? JSON.parse(fresh.permissions) : fresh.permissions,
    };
    // سطل بازیافت باید بداند «چه کسی» حذف کرد. چون better-sqlite3 همگام است و
    // هر درخواست تا پایانش تنها اجراکننده است، ست‌کردن اینجا امن است؛ در پایان
    // پاسخ هم پاک می‌شود تا به درخواست بعدی نشت نکند.
    try {
      const rb = require('../services/recycle-bin');
      rb.setActor(fresh.id, fresh.hospital_id);
      res.on('finish', () => rb.clearActor());
    } catch (e) { /* سطل بازیافت اختیاری است */ }
    // نشست واقعی (sid) هرگز جای خود را به پیش‌نمایش نمی‌دهد؛ کوکی جدای «pvid» را هم بررسی می‌کنیم
    // و در صورت معتبر بودن، req.user را موقتاً با کاربر هدف پیش‌نمایش جایگزین می‌کنیم — فقط برای
    // همین درخواست، بدون اینکه نشست واقعی ادمین (sid) دست بخورد یا از بین برود.
    applyPreviewOverlay(req);
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'نشست منقضی شده' });
    return res.status(401).json({ error: 'توکن نامعتبر' });
  }
}

// اگر کوکی پیش‌نمایش (pvid) معتبر باشد و صاحب آن همان کاربر واقعی نشست فعلی (sid) باشد،
// req.user را با کاربر هدف (همان hospital) جایگزین می‌کند و req.previewAdmin را برای بنر/آدیت نگه می‌دارد.
function applyPreviewOverlay(req) {
  const pv = req.cookies?.[config.jwt.previewCookieName];
  if (!pv) return;
  try {
    const p = jwt.verify(pv, config.jwt.secret);
    if (p.type !== 'preview' || p.adminId !== req.user.id) return; // فقط صاحب نشست واقعی می‌تواند پیش‌نمایش خودش را ببیند
    const target = query(
      `SELECT u.id, u.hospital_id, u.full_name, u.username, u.is_active, u.department,
              r.code as role_code, r.title_fa as role_title, r.permissions
       FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ? AND u.hospital_id = ?`,
      [p.id, req.user.hospital_id]
    ).rows[0];
    if (!target || !target.is_active) return;
    req.previewAdmin = { id: req.user.id, full_name: req.user.full_name };
    req.user = {
      id: target.id, hospital_id: target.hospital_id, full_name: target.full_name, username: target.username,
      role_code: target.role_code, role_title: target.role_title, department: target.department,
      permissions: typeof target.permissions === 'string' ? JSON.parse(target.permissions) : target.permissions,
    };
  } catch (e) { /* توکن پیش‌نمایش نامعتبر/منقضی — بی‌صدا نادیده گرفته می‌شود، نشست واقعی دست‌نخورده می‌ماند */ }
}

// احراز هویت *اختیاری*: اگر توکن معتبر بود req.user را مثل authRequired پر می‌کند،
// وگرنه بدون ارسال هیچ پاسخی از میان‌افزار رد می‌شود.
//
// چرا لازم شد: GET /api/auth/session برای بوت SPA باید همیشه ۲۰۰ بدهد؛ «نشست نداشتن»
// در صفحه‌ی ورود یک حالت عادی است، نه خطای ۴۰۱. authRequired اینجا کار نمی‌کند چون خودش
// پاسخ ۴۰۱ می‌فرستد. عمداً authRequired دست‌نخورده مانده تا پیام/رفتار ۴۰۱ آن (که /me
// و همه‌ی مسیرهای دیگر به آن تکیه دارند) هیچ تغییری نکند؛ فقط منطق بارگذاری توکن اینجا
// تکرار شده است. overlay پیش‌نمایش (pvid) هم مثل /me اعمال می‌شود تا هنگام رفرش در
// حالت پیش‌نمایش یک نقش، /session همان کاربر هدف را برگرداند نه ادمین واقعی.
function authOptional(req, res, next) {
  const token = req.cookies?.[config.jwt.cookieName] ||
                (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
  if (!token) return next();
  try {
    try { if (require('../services/jwt-blocklist').isBlocked(token)) return next(); } catch (e) { /* fail-open */ }
    const payload = jwt.verify(token, config.jwt.secret);
    const fresh = query(
      `SELECT u.id, u.hospital_id, u.full_name, u.username, u.is_active, u.department,
              r.code as role_code, r.title_fa as role_title, r.permissions
       FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?`,
      [payload.id]
    ).rows[0];
    if (!fresh || !fresh.is_active) return next();
    req.user = {
      id: fresh.id, hospital_id: fresh.hospital_id, full_name: fresh.full_name, username: fresh.username,
      role_code: fresh.role_code, role_title: fresh.role_title, department: fresh.department,
      permissions: typeof fresh.permissions === 'string' ? JSON.parse(fresh.permissions) : fresh.permissions,
    };
    applyPreviewOverlay(req);
  } catch (e) { /* توکن نامعتبر/منقضی — مثل «بدون نشست» رفتار می‌شود، نه خطا */ }
  next();
}

// توکن سوپرادمین با claim جدا (type:'super_admin') از توکن کاربر عادی متمایز می‌شود
// تا این دو نوع نشست هرگز با هم قاطی نشوند (سوپرادمین به هیچ hospital_id مقید نیست).
function superAdminRequired(req, res, next) {
  const token = req.cookies?.[config.jwt.superCookieName] ||
                (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
  if (!token) return res.status(401).json({ error: 'احراز هویت سوپرادمین الزامی است' });
  try {
    try { if (require('../services/jwt-blocklist').isBlocked(token)) return res.status(401).json({ error: 'نشست پایان یافته است' }); } catch (e) { /* fail-open */ }
    const payload = jwt.verify(token, config.jwt.secret);
    if (payload.type !== 'super_admin') return res.status(401).json({ error: 'توکن نامعتبر' });
    const fresh = query('SELECT id, full_name, username, is_active FROM super_admins WHERE id = ?', [payload.id]).rows[0];
    if (!fresh || !fresh.is_active) return res.status(401).json({ error: 'حساب یافت نشد یا غیرفعال است' });
    req.superAdmin = { id: fresh.id, full_name: fresh.full_name, username: fresh.username };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'نشست منقضی شده' });
    return res.status(401).json({ error: 'توکن نامعتبر' });
  }
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'احراز هویت الزامی است' });
    if (!req.user.permissions?.includes(permission)) return res.status(403).json({ error: 'دسترسی ندارید' });
    next();
  };
}

function requireAnyPermission(...permissions) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'احراز هویت الزامی است' });
    if (!permissions.some(p => req.user.permissions?.includes(p))) return res.status(403).json({ error: 'دسترسی ندارید' });
    next();
  };
}

function hospitalScope(req, res, next) {
  if (!req.user?.hospital_id) return res.status(403).json({ error: 'خطا: بیمارستان یافت نشد' });
  req.hospitalId = req.user.hospital_id;
  next();
}

// دروازه‌ی «بخش خریداری‌شده» — جدا از requirePermission که «آیا این نقش اجازه دارد» را چک می‌کند،
// این middleware «آیا این بیمارستان اصلاً این بخش را در پکیج خودش دارد» را چک می‌کند. دلیل رد شدن
// کاملاً متفاوت است (نخریده، نه بی‌اجازه)، پس کد/پیام هم جدا و صریح است تا فرانت بتواند غربال‌گری کند
// و صفحه‌ی «برای فعال‌سازی این بخش خرید کنید» را نشان دهد، نه پیام عمومی «دسترسی ندارید».
// پیش‌فرض امن-به‌سمت-باز: اگر ردیفی برای این hospital×feature در جدول نبود (مثلاً migration هنوز
// برای این بیمارستان seed نشده)، رد نمی‌شود — چون پیش‌فرض همه‌ی بخش‌ها فعال است مگر صراحتاً خاموش شود.
function requireFeature(featureKey) {
  return (req, res, next) => {
    if (!req.user?.hospital_id) return res.status(403).json({ error: 'خطا: بیمارستان یافت نشد' });
    try {
      const row = query(
        'SELECT enabled FROM hospital_features WHERE hospital_id = ? AND feature_key = ?',
        [req.user.hospital_id, featureKey]
      ).rows[0];
      if (row && Number(row.enabled) === 0) {
        return res.status(403).json({ error: 'این بخش برای بیمارستان شما فعال نیست', code: 'feature_disabled', feature: featureKey });
      }
      next();
    } catch (err) {
      // اگر جدول هنوز موجود نباشد (قبل از اجرای migration) یا خطای غیرمنتظره‌ای رخ دهد،
      // بلاک‌کردن کل سامانه بدتر از یک بار عبورِ محتاطانه است — امن-به‌سمت-باز.
      console.error('[requireFeature] check failed, allowing through:', err.message);
      next();
    }
  };
}

module.exports = { authRequired, authOptional, superAdminRequired, requirePermission, requireAnyPermission, hospitalScope, requireFeature };

