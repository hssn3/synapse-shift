/**
 * Application configuration
 */
const dotenv = require('dotenv');

dotenv.config();

const paths = require('./paths');

const isProduction = process.env.NODE_ENV === 'production';
const WEAK_JWT_SECRETS = new Set([
  'dev_secret_change_in_production',
  'changeme',
  'secret',
  // پلیس‌هولدر پیشنهادی داخل docker-compose.yml — قبلاً از چک رد می‌شد و
  // سرور production می‌توانست با یک مقدارِ عمومیِ معلوم بالا بیاید (ممیزی ۱۴۰۵-۰۷-۲۰).
  'change_this_to_a_random_long_string_at_least_32_chars',
]);

// جلوگیری از اجرای production با JWT_SECRET غایب/ضعیف/پیش‌فرض (این مقدار پیش‌فرض در سورس عمومی قابل مشاهده است)
if (isProduction) {
  const secret = process.env.JWT_SECRET;
  if (!secret || WEAK_JWT_SECRETS.has(secret) || secret.length < 32) {
    console.error('[Config] FATAL: JWT_SECRET غایب یا ضعیف است. در production باید یک مقدار تصادفی حداقل ۳۲ کاراکتری تنظیم شود.');
    console.error('[Config] برای تولید مقدار امن: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
    process.exit(1);
  }
}

module.exports = {
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || 'development',
  baseUrl: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`,

  jwt: {
    secret: process.env.JWT_SECRET || 'dev_secret_change_in_production',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    cookieName: process.env.SESSION_COOKIE_NAME || 'sid',
    superCookieName: process.env.SUPER_SESSION_COOKIE_NAME || 'ssid',
    // نشست موقتِ «پیش‌نمایش داشبورد یک نقش» — کاملاً جدا از کوکی نشست واقعی (sid)، تا نشست ادمین
    // هرگز دست نخورد؛ خیلی کوتاه‌مدت و فقط با درخواست صریح ادمین صادر می‌شود (src/routes/api.js: /preview/*)
    previewCookieName: process.env.PREVIEW_COOKIE_NAME || 'pvid',
    previewExpiresIn: '15m',
  },
  
  bcrypt: {
    rounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    // سقف عمومی به ازای هر کاربرِ واردشده (یا هر IP برای ترافیک بدون ورود).
    // ۱۰۰ خیلی کم بود: این یک SPA است و یک بازدید کوتاه — ورود و باز کردن شش صفحه —
    // حدود ۲۴ درخواست مصرف می‌کند، پس کاربری که واقعاً کار می‌کرد ظرف نیم ساعت قفل
    // می‌شد. ۲۰۰۰ برای کار عادی فراوان است و همچنان جلوی اسکرپ و سوءاستفاده را می‌گیرد.
    max: parseInt(process.env.RATE_LIMIT_MAX) || 2000,
    loginMax: parseInt(process.env.LOGIN_RATE_LIMIT_MAX) || 5,
    // سقف *IP* برای ورودِ بدونِ‌رمز (کاشی سمت + dev-login) — سطلی جدا از loginMax.
    // چرا سخاوتمندتر (۶۰): این مسیرها با پیش‌فرضِ نصب حتی رمز نمی‌گیرند، پس هدف این سقف
    // جلوگیری از شمارش/اسکن است، نه محافظت از رمز؛ قفلِ حساب (۵ تلاش) را خودِ
    // /api/entry/role-login وقتی require_password روشن است اعمال می‌کند
    // (src/routes/entry.js). اگر این سقف هم ۵ بود، درِ اصلیِ ورودِ کارکنان با چند تلاش
    // ناموفقِ کلاسیک روی همان IP بسته می‌شد.
    tileLoginMax: parseInt(process.env.TILE_LOGIN_RATE_LIMIT_MAX) || 60,
    // سقف *ارسال* فرم‌های عمومی به ازای هر IP. خواندن‌ها زیر این سقف نیستند
    // (src/middleware/security.js). ۲۰ برای بیمارستانی که همه‌ی مراجعانش پشت یک IP
    // عمومی‌اند کم بود؛ ۶۰ در ۱۵ دقیقه (۴ در دقیقه) برای ارسال واقعی فراوان است و
    // همچنان جلوی اسپمِ اسکریپتی را می‌گیرد.
    publicFormMax: parseInt(process.env.PUBLIC_FORM_RATE_LIMIT_MAX) || 60,
  },
  
  // مسیرها از src/config/paths.js می‌آیند تا با DATA_DIR بشود همه‌ی داده‌ی ماندگار را
  // یک‌جا روی والیوم برد. قبلاً نسبت به پوشه‌ی جاری حساب می‌شد و روی ریلوی با هر
  // دیپلوی پاک می‌شد.
  upload: {
    dir: paths.uploadDir,
    maxFileSize: (parseInt(process.env.MAX_UPLOAD_SIZE_MB) || 5) * 1024 * 1024,
  },

  backup: {
    dir: paths.backupDir,
    retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS) || 30,
  },
  
  defaultHospitalName: process.env.DEFAULT_HOSPITAL_NAME || 'بیمارستان پیش‌فرض',
  
  isProduction: process.env.NODE_ENV === 'production',
};
