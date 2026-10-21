/**
 * SQLite Database Connection (fallback when PostgreSQL is not available)
 * Uses better-sqlite3 - no external server needed
 */
const Database = require('better-sqlite3');
const dotenv = require('dotenv');

dotenv.config();

// مسیر از src/config/paths.js می‌آید تا با DATA_DIR بشود دیتابیس را روی یک والیوم
// ماندگار برد. بدون آن، فایل داخل کانتینر می‌ماند و با هر دیپلوی پاک می‌شود.
const { dbDir, dbPath, ensureDir } = require('./paths');
ensureDir(dbDir);

// این خط عمداً همیشه چاپ می‌شود. تشخیص «دیتابیس روی والیوم ماندگار است یا هر بار
// از صفر ساخته می‌شود» از روی لاگ‌های غیرمستقیم بسیار سخت بود؛ با این یک خط،
// هر بوت صریحاً می‌گوید کجا می‌نویسد و آیا فایل از قبل وجود داشته یا نه.
// existed=false روی یک استقرار قدیمی یعنی داده نمانده است.
{
  const fs = require('fs');
  const existed = fs.existsSync(dbPath);
  let sizeKb = 0;
  try { if (existed) sizeKb = Math.round(fs.statSync(dbPath).size / 1024); } catch (e) { /* بی‌اهمیت */ }
  console.log(`[DB] path=${dbPath} existed=${existed}${existed ? ` size=${sizeKb}KB` : ''} DATA_DIR=${process.env.DATA_DIR || '(unset)'}`);
}

const db = new Database(dbPath, { verbose: null });
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// سطل بازیافت: جدولش را می‌سازد و از اینجا به بعد هر DELETE را بایگانی می‌کند
const recycleBin = require('../services/recycle-bin');
recycleBin.init(db);

/**
 * Execute a query (SQLite-compatible)
 * تبدیل خودکار پارامترهای سبک PostgreSQL ($1, $2, ...) به سبک SQLite (?)
 * چون فایل‌های seed.js/seed-gen6.js با سینتکس $N نوشته شده‌اند ولی موتور فعلی SQLite است.
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 */
function query(sql, params = []) {
  try {
    // اگر SQL شامل $1, $2, ... است، به ? تبدیل کن (SQLite این سینتکس را ندارد)
    const normalizedSql = /\$\d+/.test(sql) ? sql.replace(/\$\d+/g, '?') : sql;
    // حذف "RETURNING id" که در SQLite (نسخه‌های قدیمی‌تر better-sqlite3) پشتیبانی متفاوتی دارد؛
    // به‌جایش از lastInsertRowid استفاده می‌کنیم (منطق پایین‌تر همین کار را می‌کند)
    const sqlNoReturning = normalizedSql.replace(/\s+RETURNING\s+\w+/i, '');
    const stmt = db.prepare(sqlNoReturning);
    // Detect query type
    const trimmed = sqlNoReturning.trim().toUpperCase();
    if (trimmed.startsWith('SELECT') || trimmed.startsWith('WITH') || trimmed.startsWith('PRAGMA')) {
      const rows = stmt.all(...params);
      return { rows, rowCount: rows.length };
    } else if (trimmed.startsWith('INSERT')) {
      const info = stmt.run(...params);
      // Try to get the inserted row
      if (info.lastInsertRowid) {
        try {
          const lastRow = db.prepare('SELECT * FROM ' + getTableName(sqlNoReturning) + ' WHERE id = ?').get(info.lastInsertRowid);
          return { rows: [lastRow], rowCount: 1 };
        } catch { return { rows: [], rowCount: info.changes }; }
      }
      return { rows: [], rowCount: info.changes };
    } else {
      // پیش از هر DELETE، ردیف‌های هدف در سطل بازیافت اسنپ‌شات می‌شوند.
      // اینجا تنها گلوگاهی است که همه‌ی ۲۴ مسیر حذف از آن رد می‌شوند، پس
      // پوشش کامل است و هیچ کوئریِ خواندنِ موجودی تغییر نمی‌کند.
      if (trimmed.startsWith('DELETE')) {
        try { recycleBin.archiveBeforeDelete(sqlNoReturning, params); }
        catch (e) { /* بایگانی نباید جلوی خودِ حذف را بگیرد */ }
      }
      const info = stmt.run(...params);
      return { rows: [], rowCount: info.changes };
    }
  } catch (err) {
    console.error('[DB] Query error:', err.message, 'SQL:', sql.substring(0, 200));
    throw err;
  }
}

function getTableName(sql) {
  const match = sql.match(/INSERT\s+INTO\s+(\w+)/i);
  return match ? match[1] : 'unknown';
}

async function getClient() {
  // Return a mock client for compatibility (SQLite is synchronous)
  return {
    query: (sql, params = []) => query(sql, params),
    release: () => {},
  };
}

module.exports = { db, query, getClient };
