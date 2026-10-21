/**
 * بلاک‌لیست JWT برای logout — با TTL هم‌ارز انقضا
 * چرا این سرویس ساخته شد: قبلاً /api/auth/logout فقط کوکی را پاک می‌کرد و
 * توکن دزدیده‌شده تا ۸ ساعت معتبر می‌ماند. حالا هش توکن با انقضای واقعی‌اش
 * ذخیره می‌شود و authRequired آن را رد می‌کند. پاک‌سازی دوره‌ای ردیف‌های
 * منقضی از رشد جدول جلوگیری می‌کند. idempotent و fail-open در خواندن.
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config/app');

function store() {
  return require('../config/database-sqlite');
}

function ensureTable() {
  try {
    store().query(
      `CREATE TABLE IF NOT EXISTS jwt_blocklist (
        token_hash TEXT PRIMARY KEY,
        exp INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`
    );
    try { store().query(`CREATE INDEX IF NOT EXISTS idx_jwt_blocklist_exp ON jwt_blocklist(exp)`); } catch (e) { /* index optional */ }
  } catch (e) { console.error('[jwt-blocklist] ensureTable failed:', e.message); }
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function ttlSecondsFor(token, fallbackSeconds) {
  const fb = Number(fallbackSeconds) > 0 ? Number(fallbackSeconds) : 8 * 3600;
  try {
    const d = jwt.decode(String(token));
    if (d && typeof d.exp === 'number') {
      const now = Math.floor(Date.now() / 1000);
      const ttl = d.exp - now;
      if (ttl > 0) return ttl;
      return 0;
    }
  } catch (e) { /* decode optional */ }
  return fb;
}

/**
 * چرا: ثبت توکن خارج‌شده با TTL واقعی‌اش.
 * @param {string} token توکن خام
 * @param {number} [fallbackSeconds] اگر exp خوانده نشد
 */
function add(token, fallbackSeconds) {
  if (!token) return;
  ensureTable();
  const ttl = ttlSecondsFor(token, fallbackSeconds);
  if (ttl <= 0) return;
  const exp = Math.floor(Date.now() / 1000) + ttl;
  try {
    store().query(
      `INSERT OR REPLACE INTO jwt_blocklist (token_hash, exp) VALUES (?, ?)`,
      [hashToken(token), exp]
    );
  } catch (e) { console.error('[jwt-blocklist] add failed:', e.message); }
  cleanup();
}

/**
 * چرا: بررسی سریع در authRequired — توکن بلاک‌شده = 401.
 * @param {string} token توکن خام
 * @returns {boolean} true یعنی بلاک شده
 */
function isBlocked(token) {
  if (!token) return false;
  try {
    ensureTable();
    const r = store().query(`SELECT 1 AS x FROM jwt_blocklist WHERE token_hash = ? AND exp > ?`, [hashToken(token), Math.floor(Date.now() / 1000)]);
    return !!(r.rows && r.rows.length);
  } catch (e) {
    console.error('[jwt-blocklist] check failed, allowing through:', e.message);
    return false;
  }
}

let lastCleanup = 0;
/**
 * چرا: حذف ردیف‌های منقضی حداکثر هر ۵ دقیقه تا جدول رشد نکند.
 */
function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < 5 * 60 * 1000) return;
  lastCleanup = now;
  try { store().query(`DELETE FROM jwt_blocklist WHERE exp <= ?`, [Math.floor(now / 1000)]); } catch (e) { /* non-fatal */ }
}

module.exports = { add, isBlocked, cleanup, ensureTable };
