/**
 * مسیرهای داده‌ی ماندگار — یک منبع حقیقت برای همه‌ی جاهایی که روی دیسک می‌نویسند.
 *
 * چرا این فایل وجود دارد: مسیر دیتابیس و بکاپ‌ها در پنج جای مختلف جداگانه با
 * path.resolve(__dirname, '../../database') حساب می‌شد. یعنی مسیر عملاً «داخل پوشه‌ی
 * پروژه» قفل بود و با هیچ متغیر محیطی قابل جابه‌جایی نبود. روی هاست‌هایی مثل ریلوی
 * که فایل‌سیستم کانتینر موقت است، این یعنی با هر دیپلوی کل دیتابیس، آپلودها و
 * بکاپ‌ها پاک می‌شوند — یک سال کار یک بیمارستان با یک push از بین می‌رفت.
 *
 * حالا همه از اینجا می‌خوانند و با DATA_DIR می‌شود همه را یک‌جا روی یک والیوم
 * ماندگار برد:
 *
 *   DATA_DIR=/data        →  /data/database/hospital.db و /data/uploads و /data/backups
 *
 * اگر DATA_DIR ست نشود، ریشه همان پوشه‌ی پروژه است و رفتار دقیقاً مثل قبل می‌ماند،
 * پس نصب‌های موجود و اجرای محلی چیزی از دست نمی‌دهند.
 *
 * مسیرهای تک‌تک هم قابل override هستند (DB_DIR / UPLOAD_DIR / BACKUP_DIR) برای
 * حالتی که دیتابیس و آپلودها روی دو دیسک جدا باشند.
 */
const path = require('path');
const fs = require('fs');

// این ماژول ممکن است پیش از هر config دیگری require شود، پس .env را خودش می‌خواند —
// وگرنه DATA_DIR فقط وقتی کار می‌کرد که به‌صورت متغیر محیطی واقعی ست شده باشد.
// dotenv مقادیر از قبل ست‌شده را بازنویسی نمی‌کند، پس فراخوانی دوباره‌اش بی‌ضرر است.
require('dotenv').config();

const REPO_ROOT = path.resolve(__dirname, '../..');

// ریشه‌ی داده‌های ماندگار. روی سرور واقعی یا والیوم ابری این را ست کنید.
const DATA_DIR = path.resolve(process.env.DATA_DIR || REPO_ROOT);

// پوشه‌ی فایل SQLite. توجه: فقط خودِ فایل .db اینجاست — اسکریپت‌های مهاجرت
// همچنان در database/ داخل مخزن می‌مانند و از این مسیر مستقل‌اند.
const dbDir = path.resolve(process.env.DB_DIR || path.join(DATA_DIR, 'database'));
const dbPath = path.join(dbDir, 'hospital.db');

// بکاپ‌ها کنار خود دیتابیس می‌مانند تا اگر کسی فقط والیوم دیتابیس را مانت کرد،
// بکاپ‌ها هم به‌طور خودکار ماندگار شوند و بی‌سروصدا روی دیسک موقت نیفتند.
const dbBackupsDir = path.join(dbDir, 'backups');

const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(DATA_DIR, 'uploads'));
const backupDir = path.resolve(process.env.BACKUP_DIR || path.join(DATA_DIR, 'backups'));

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

module.exports = { REPO_ROOT, DATA_DIR, dbDir, dbPath, dbBackupsDir, uploadDir, backupDir, ensureDir };
