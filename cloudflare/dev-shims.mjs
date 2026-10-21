/* =====================================================================
   شیم‌های اجرای محلیِ ورکر (بدون wrangler و بدون اینترنت)
   ---------------------------------------------------------------------
   همان چیزهایی که Cloudflare در زمان اجرا به ورکر می‌دهد این‌جا شبیه‌سازی
   می‌شوند:
     • DB      → D1 روی better-sqlite3 (همان دیتابیس SQLite محلی)
     • ASSETS  → سرو فایل‌های پوشهٔ public/
   استفاده‌کننده‌ها: cloudflare/dev-harness.mjs (تست خودکار) و
                     cloudflare/dev-server.mjs (سرور محلی برای مرورگر)
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..');
export const PUBLIC_DIR = path.join(ROOT, 'public');
export const SRC_DB = path.join(ROOT, 'database', 'hospital.db');

function getDatabase() {
  return require(path.join(ROOT, 'node_modules', 'better-sqlite3'));
}

/** کپیِ سازگار از دیتابیس اصلی (DB در حالت WAL است؛ کپیِ ساده کافی نیست). */
export function copyDbToTemp() {
  const Database = getDatabase();
  const tmp = path.join(os.tmpdir(), `synapse-worker-local-${process.pid}-${Date.now()}.db`);
  const src = new Database(SRC_DB, { readonly: true });
  src.prepare('VACUUM INTO ?').run(tmp);
  src.close();
  return tmp;
}

export function openDb(dbPath) {
  const Database = getDatabase();
  return new Database(dbPath);
}

/* ---------------- شیمِ D1 ---------------- */
export function makeD1(db) {
  return {
    prepare(sql) {
      const st = { params: [] };
      const api = {
        bind(...params) {
          st.params = params.map(p => (p === undefined ? null : p));
          return api;
        },
        async all() {
          const results = db.prepare(sql).all(...st.params);
          return { results, success: true, meta: { rows_read: results.length, rows_written: 0 } };
        },
        async first() {
          const row = db.prepare(sql).get(...st.params);
          return row === undefined ? null : row;
        },
        async run() {
          const info = db.prepare(sql).run(...st.params);
          return { success: true, meta: { changes: info.changes, last_row_id: Number(info.lastInsertRowid) } };
        },
        async raw() {
          return db.prepare(sql).raw().all(...st.params);
        },
      };
      return api;
    },
    async batch(stmts) {
      const out = [];
      for (const s of stmts) out.push(await s.run());
      return out;
    },
    async exec(sql) {
      db.exec(sql);
      return { count: 1, duration: 0 };
    },
  };
}

/* ---------------- شیمِ ASSETS ---------------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
};
export function makeAssets(publicDir = PUBLIC_DIR) {
  return {
    async fetch(req) {
      const url = new URL(typeof req === 'string' ? req : req.url);
      let p = decodeURIComponent(url.pathname);
      if (p === '/' || p === '') p = '/index.html';
      const file = path.join(publicDir, ...p.split('/').filter(seg => seg && seg !== '..'));
      if (!path.resolve(file).startsWith(path.resolve(publicDir))) return new Response('bad', { status: 400 });
      let st = null;
      try { st = fs.statSync(file); } catch (e) { /* نیست */ }
      if (!st) return new Response('Not Found', { status: 404 });
      if (st.isDirectory()) {
        const idx = path.join(file, 'index.html');
        if (!fs.existsSync(idx)) return new Response('Not Found', { status: 404 });
        return new Response(fs.readFileSync(idx), { status: 200, headers: { 'Content-Type': MIME['.html'] } });
      }
      return new Response(fs.readFileSync(file), {
        status: 200,
        headers: { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' },
      });
    },
  };
}

/** ورکر + env شبیه‌سازی‌شده را آماده می‌کند. dbPath اگر داده نشود، کپی موقت ساخته می‌شود. */
export async function loadWorkerEnv(opts = {}) {
  const dbPath = opts.dbPath || copyDbToTemp();
  const db = openDb(dbPath);
  const worker = (await import('./worker.js')).default;
  const env = {
    DB: makeD1(db),
    ASSETS: makeAssets(opts.publicDir || PUBLIC_DIR),
    JWT_SECRET: opts.jwtSecret || 'harness_secret_for_local_tests_only',
  };
  return { worker, env, db, dbPath };
}
