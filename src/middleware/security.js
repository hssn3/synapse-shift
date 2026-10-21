/**
 * Security middleware - simplified (no external CDN deps)
 */
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('../config/app');

function setupSecurity(app) {
  app.use(helmet({
    // CSP فعال طبق الزام بخش ۵ PROJECT_SPEC.md - سخت‌گیرانه اما سازگار با SPA فعلی
    // توجه: چون این SPA از onclick inline در HTML تولیدشده استفاده می‌کند، فعلاً 'unsafe-inline'
    // برای script-src لازم است؛ در فاز بعدی توصیه می‌شود onclick ها به addEventListener منتقل شوند
    // تا بشود 'unsafe-inline' را کامل حذف کرد.
    // نکته مهم: helmet به‌صورت پیش‌فرض script-src-attr را جدا از script-src به 'none' تنظیم می‌کند
    // (حتی وقتی script-src شامل unsafe-inline باشد) و چون این SPA کاملاً روی onclick تکیه دارد،
    // بدون این خط صریح، هیچ‌کدام از دکمه‌ها/فرم‌ها در مرورگرهای امروزی کار نمی‌کردند.
    // نکته دوم: helmet به‌صورت پیش‌فرض دستور upgrade-insecure-requests را به CSP اضافه می‌کند که
    // مرورگر را وادار می‌کند همه زیرمنابع (js/css) را حتی روی دامنه HTTP-only به HTTPS ارتقا دهد.
    // وقتی سایت پشت HTTPS واقعی نیست (مثلاً اجرای مستقیم روی IP:Port بدون گواهی SSL)، این باعث
    // خطای ERR_SSL_PROTOCOL_ERROR روی app.js/app.css می‌شود و کل صفحه در حال «بارگذاری» گیر می‌کند.
    // پس این دستور فقط در production (پشت HTTPS واقعی مثل Railway) فعال است.
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: (config.isProduction && (process.env.RAILWAY_ENVIRONMENT || process.env.FORCE_HTTPS === '1')) ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  // محدودکننده‌ی عمومی.
  //
  // چرا کلیدش کاربر است نه IP: کارکنان یک بیمارستان همه از پشت یک IP عمومی (NAT)
  // بیرون می‌آیند. با کلید IP، سقف بین همه‌ی کاربران آن مرکز مشترک می‌شد و چند نفر
  // که هم‌زمان کار می‌کردند ظرف چند دقیقه کل بیمارستان را برای ۱۵ دقیقه قفل می‌کردند
  // (یک بازدید کوتاه به‌تنهایی ~۲۴ درخواست مصرف می‌کند). حالا هر کاربرِ واردشده سقف
  // خودش را دارد و فقط ترافیک بدون‌ورود روی IP جمع می‌شود.
  const limiterOpts = {
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: { error: 'درخواست زیاد. صبر کنید' },
    standardHeaders: true,
    legacyHeaders: false,
  };

  // کاربر واردشده: سطل بر اساس خودِ توکن جلسه.
  // اعتبارسنجی امضا اینجا لازم نیست — کوکی جعلی فقط سطل خودش را می‌سوزاند و
  // چند قدم بعد در میان‌افزار احراز هویت رد می‌شود.
  const perUserLimiter = rateLimit({
    ...limiterOpts,
    keyGenerator: req => 'u:' + req.cookies[config.jwt.cookieName].slice(-32),
  });

  // بدون ورود: سطل بر اساس IP، با کلیدساز پیش‌فرض خودِ کتابخانه تا نرمال‌سازی IPv6
  // درست انجام شود (ساختن دستی کلید از req.ip راه دور زدن با زیرشبکه‌ی IPv6 باز می‌کند).
  const perIpLimiter = rateLimit(limiterOpts);

  app.use('/api/', (req, res, next) => {
    const token = req.cookies && req.cookies[config.jwt.cookieName];
    return token ? perUserLimiter(req, res, next) : perIpLimiter(req, res, next);
  });

  // محدودکننده‌ی ورودِ رمزدار — روی IP می‌ماند، چون هنوز کاربری وجود ندارد که کلید شود.
  //
  // skipSuccessfulRequests حیاتی است: هدف این سقف جلوگیری از حدس‌زدن رمز است، نه
  // محدودکردن تعداد ورودهای موفق. بدون آن، در بیمارستانی که همه پشت یک IP هستند
  // نفر ششمی که در ۱۵ دقیقه وارد می‌شد پشت در می‌ماند.
  const loginLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.loginMax,
    message: { error: 'تلاش‌های زیاد. ۱۵ دقیقه صبر کنید' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
  });
  app.use('/api/auth/login', loginLimiter);
  app.use('/api/auth/super-login', loginLimiter);

  // سطلِ مستقلِ ورودِ بدونِ‌رمز: کاشی سمت (/api/entry/role-login) و dev-login.
  //
  // چرا جدا شد: قبلاً همین سطلِ رمزدار (سقف ۵) روی role-login هم بسته بود. نقشه‌ی
  // خرابی: پنج تلاش ناموفقِ *کلاسیک* روی یک IP، کلِ ورودِ کاشی‌ای همان مرکز را ۱۵ دقیقه
  // ۴۲۹ می‌کرد — و نقشه‌ی برعکسش هم؛ درحالی‌که این دو مسیر تهدید یکسانی ندارند. کاشی سمت
  // مسیرِ روزمره‌ی ورودِ کارکنان است و با پیش‌فرضِ نصب حتی رمز نمی‌گیرد؛ ضمناً خودِ
  // /api/entry/role-login هنگام روشن بودن require_password قفلِ حساب (۵ تلاش ⇒ ۱۵ دقیقه)
  // را اعمال می‌کند (src/routes/entry.js). پس سقف اینجا فقط برای مهار شمارش/اسکن است و
  // باید سخاوتمندانه بماند تا درِ اصلیِ ورودِ کارکنان را نبندد. skipSuccessfulRequests
  // اینجا هم لازم است تا ورودهای واقعی و موفق، سهمیه‌ی IP را مصرف نکنند.
  const tileLoginLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.tileLoginMax,
    message: { error: 'تلاش‌های زیاد. ۱۵ دقیقه صبر کنید' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
  });
  app.use('/api/entry/role-login', tileLoginLimiter);
  app.use('/api/auth/dev-login', tileLoginLimiter);

  // درگاه فرم‌های عمومی (بدون ورود) — سخت‌گیرانه‌تر از حد عمومی، چون «ارسال» است.
  //
  // فقط روی نوشتن اعمال می‌شود، نه خواندن. کامنت قبلی می‌گفت «چون فقط نوشتن است»،
  // ولی محدودکننده روی کلِ /api/public/ بسته بود و زیر همان مسیر چند GET هست که
  // صرفاً صفحه را می‌سازند — مهم‌ترینشان GET /api/public/hospital/:id که نام و لوگوی
  // مرکز را می‌گیرد. یعنی با ~۲۰ بار *باز کردن* فرم نظرسنجی از یک شبکه، سقف تمام
  // می‌شد و از آن به بعد فرم خودش را پنهان می‌کرد و پیغام خطا می‌داد — بدون آنکه حتی
  // یک نظرسنجی ارسال شده باشد. گزارش کاربر دقیقاً همین بود: «حدود بیست مورد تست
  // کردم، کار نکرد».
  //
  // در بیمارستان واقعی همه‌ی مراجعان پشت یک IP عمومی‌اند، پس این سقف روی خواندن
  // یعنی بیمار بیست‌ویکمِ آن روز اصلاً نمی‌تواند فرم را باز کند.
  const publicFormLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.publicFormMax,
    message: { error: 'ارسال‌های زیاد. کمی بعد دوباره تلاش کنید' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/public/', (req, res, next) => {
    // خواندن‌ها زیر سقف عمومی می‌مانند (که خودش IP-محور و سخاوتمند است)
    if (req.method === 'GET' || req.method === 'HEAD') return next();
    return publicFormLimiter(req, res, next);
  });

  // چک Origin/Referer برای درخواست‌های تغییردهنده (B-1).
  //
  // چرا این‌جا و چرا ملایم: SameSite=Lax روی کوکی نشست، دفاع اصلی CSRF است و
  // نباید با بلاک تهاجمی بشکند (کلاینت‌های موبایل/curl معمولاً Origin نمی‌فرستند،
  // ناوبری same-origin هم گاهی Referer ندارد). پس: اگر هیچ‌کدام نیست → عبور.
  // اگر هست و host آن با میزبان فعلی/مجاز نمی‌خواند → 403. این جلوی فرم مخرب
  // کراس‌سایت را می‌گیرد بدون اینکه SameSite یا اپ موبایل بشکند.
  const allowedExtra = String(process.env.CSRF_TRUSTED_ORIGINS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  app.use('/api/', (req, res, next) => {
    try {
      if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
      const origin = req.headers.origin || null;
      const referer = req.headers.referer || req.headers.referrer || null;
      if (!origin && !referer) return next();
      const want = origin || referer;
      let wantHost = null;
      try { wantHost = new URL(want).host.toLowerCase(); } catch (e) { return res.status(403).json({ error: 'مبدأ درخواست نامعتبر است' }); }
      const hostNow = String(req.headers.host || '').toLowerCase();
      const baseHost = (() => { try { return new URL(config.baseUrl).host.toLowerCase(); } catch (e) { return null; } })();
      const ok = [hostNow, baseHost, 'localhost:3000', '127.0.0.1:3000']
        .concat(allowedExtra.map(s => s.toLowerCase()))
        .filter(Boolean)
        .some(h => wantHost === h);
      if (!ok) return res.status(403).json({ error: 'مبدأ درخواست مجاز نیست' });
      return next();
    } catch (e) { return next(); }
  });
}

module.exports = { setupSecurity };
