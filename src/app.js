/**
 * سیناپس — نسخه‌ی سبک: فقط «پرسنل و برنامه‌ی ماهانه‌ی شیفت»
 * ---------------------------------------------------------------------
 * همان زیرساختِ بوت/احراز هویت/دیتابیس پروژه‌ی اصلی، اما بدون هیچ ماژول دیگر.
 * زنجیره‌ی seed فقط همان چیزهایی را اجرا می‌کند که این ماژول به آن نیاز دارد.
 */
const express = require('express');
require('express-async-errors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const config = require('./config/app');
const { setupSecurity } = require('./middleware/security');

function logProcessError(kind, err) {
  console.error(`[Process] ${kind}:`, err && err.stack ? err.stack : err);
  try {
    const { query } = require('./config/database-sqlite');
    const { uuid } = require('./utils/db');
    query(
      `INSERT INTO error_log (id, hospital_id, user_id, method, route, status_code, message, stack, ip_address)
       VALUES (?, NULL, NULL, ?, ?, ?, ?, ?, NULL)`,
      [uuid(), 'PROCESS', kind, 0, String((err && err.message) || err).slice(0, 2000), String((err && err.stack) || '').slice(0, 4000)]
    );
  } catch (logErr) {
    console.error('[Process] Failed to persist process-level error log:', logErr.message);
  }
}

process.on('unhandledRejection', (reason) => {
  logProcessError('unhandledRejection', reason);
});

process.on('uncaughtException', (err) => {
  logProcessError('uncaughtException', err);
  console.error('[Process] uncaughtException — در حال خروج کنترل‌شده...');
  process.exit(1);
});

const app = express();

app.set('trust proxy', 1);

// cookieParser باید پیش از setupSecurity باشد (سطل نرخ هر کاربر از کوکی می‌آید)
app.use(cookieParser());

setupSecurity(app);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.static(path.join(__dirname, '../public')));

const uploadDir = path.resolve(config.upload.dir);
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

/* ---------- راه‌اندازیِ خودکارِ دیتابیسِ خالی ---------- */
function bootstrapEmptyDatabase() {
  const { db } = require('./config/database-sqlite');
  let hasCore = false;
  try {
    hasCore = !!db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='hospitals'").get();
  } catch (e) { hasCore = false; }
  if (hasCore) return;

  console.log('[Boot] دیتابیس خالی است — راه‌اندازیِ اولیه یک‌بار اجرا می‌شود…');
  const { execFileSync } = require('child_process');
  const steps = ['migrate-sqlite.js', 'seed.js', 'migrate-multi-tenant.js', 'migrate-roles.js'];
  for (const f of steps) {
    const script = path.join(__dirname, '..', 'database', f);
    if (!fs.existsSync(script)) continue;
    try {
      execFileSync(process.execPath, [script], { stdio: 'inherit', env: process.env });
      console.log(`[Boot] ✅ ${f}`);
    } catch (err) {
      console.error(`[Boot] ❌ ${f} شکست خورد:`, err.message);
      break;
    }
  }
}

const seedFailures = [];
function seedFail(name, err) {
  seedFailures.push(name);
  console.error('[Boot] ❌ ' + name + ' — ' + ((err && err.message) || String(err)));
}
function tryRun(label, fn) {
  try { fn(); } catch (err) { seedFail(label, err); }
}

tryRun('bootstrapEmptyDatabase', bootstrapEmptyDatabase);

// --- زنجیره‌ی seed این ماژول (همه idempotent) ---
tryRun('Platform settings', () => require('../database/seed-platform-settings').runMigration());
tryRun('Library base (grantPerms)', () => require('../database/seed-library').runMigration());
tryRun('Nursing hierarchy', () => require('../database/seed-nursing-hierarchy').runMigration());
tryRun('Shift schedule tables', () => require('../database/seed-shift-schedule').runMigration());
// دادهٔ نمونهٔ شیفت عمداً در بوت اجرا نمی‌شود؛ این نصب با یک بیمارستان و
// پرسنل واقعیِ اورژانس راه می‌افتد. اجرای دستی: npm run seed-shift-sample.

if (seedFailures.length) {
  console.error('[Boot] ⚠️ ' + seedFailures.length + ' مورد از زنجیرهٔ seed ناموفق بود: ' + seedFailures.join(' | '));
} else {
  console.log('[Boot] ✅ همه‌ی مراحل seed بدون خطا اجرا شد');
}

/* ---------- مسیرهای API ---------- */
app.use('/api/auth', require('./routes/auth'));
app.use('/api/entry', require('./routes/entry'));
app.use('/api', require('./routes/site'));       // بیمارستان‌ها/لوگو/ساعت سرور
app.use('/api', require('./modules'));           // ماژول: پرسنل و برنامه‌ی ماهانه‌ی شیفت

/* ---------- بررسی سلامت (پیش از catch-all) ---------- */
const pkg = require('../package.json');
app.get('/healthz', (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const { query } = require('./config/database-sqlite');
    query('SELECT 1');
    res.json({ status: 'ok', uptime_seconds: Math.round(process.uptime()), version: pkg.version, env: config.env });
  } catch (err) {
    res.status(503).json({ status: 'error', error: 'اتصال دیتابیس برقرار نیست' });
  }
});

/* ---------- Serve SPA ---------- */
const STATIC_ASSET_EXT = /\.(js|mjs|css|map|json|woff2?|ttf|otf|eot|png|jpe?g|gif|webp|avif|svg|ico|pdf|txt|xml|webmanifest)$/i;
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (STATIC_ASSET_EXT.test(req.path)) {
    return res.status(404).type('text/plain; charset=utf-8').send('یافت نشد');
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.use((req, res) => res.status(404).json({ error: 'یافت نشد' }));

// میان‌افزار نهایی خطا
app.use((err, req, res, next) => {
  console.error('[App] Error:', err.message);
  let statusCode = 500;
  let userMessage = 'خطای داخلی سرور';
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) { statusCode = 400; userMessage = 'JSON نامعتبر'; }
  else if (err.code === 'LIMIT_FILE_SIZE') { statusCode = 400; userMessage = 'حجم فایل زیاد است'; }
  else if (err.status === 400) { statusCode = 400; userMessage = err.message || 'اطلاعات ارسالی نامعتبر است'; }

  try {
    const { query } = require('./config/database-sqlite');
    const { uuid } = require('./utils/db');
    query(
      `INSERT INTO error_log (id, hospital_id, user_id, method, route, status_code, message, stack, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid(), req.user?.hospital_id || null, req.user?.id || null,
        req.method, req.originalUrl || req.path, statusCode,
        String(err.message || err).slice(0, 2000), String(err.stack || '').slice(0, 4000), req.ip || null,
      ]
    );
  } catch (logErr) {
    console.error('[App] Failed to persist error log:', logErr.message);
  }

  res.status(statusCode).json({ error: userMessage });
});

const server = app.listen(config.port, '0.0.0.0', () => {
  console.log('============================================');
  console.log('  پرسنل و برنامه‌ی ماهانه‌ی شیفت — Server up');
  console.log(`  URL: http://localhost:${config.port}`);
  console.log(`  Environment: ${config.env}`);
  console.log('============================================');
});

process.on('SIGTERM', () => { server.close(() => process.exit(0)); });
process.on('SIGINT', () => { server.close(() => process.exit(0)); });

module.exports = app;
