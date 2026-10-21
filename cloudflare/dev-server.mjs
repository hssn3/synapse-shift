/* =====================================================================
   سرور محلیِ ورکر برای تست در مرورگر (بدون wrangler و بدون اینترنت)
   ---------------------------------------------------------------------
   دقیقاً همان worker.js را با شیم‌های D1/ASSETS بالا می‌آورد تا کل اپ
   (فایل‌های ثابت + API) روی http://localhost:8787 کار کند.

   اجرا:  node cloudflare/dev-server.mjs [port]
   نکته: کار می‌کند روی یک کپیِ موقت از database/hospital.db — دادهٔ
         اصلی دست‌نخورده می‌ماند.
   ===================================================================== */
import http from 'node:http';
import { loadWorkerEnv } from './dev-shims.mjs';

const PORT = Number(process.argv[2] || 8787);
const { env, dbPath } = await loadWorkerEnv();
// worker-main.js همان worker.js است + مسیرهای فرم‌های کد؛ دقیقاً همان چیزی که deploy می‌شود.
const worker = (await import('./worker-main.js')).default;

const server = http.createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (v !== undefined) headers[k] = Array.isArray(v) ? v.join(', ') : v;
    }
    const request = new Request(`http://localhost:${PORT}${req.url}`, { method: req.method, headers, body });
    const response = await worker.fetch(request, env);
    res.statusCode = response.status;
    response.headers.forEach((v, k) => {
      if (k.toLowerCase() !== 'set-cookie') res.setHeader(k, v);
    });
    if (typeof response.headers.getSetCookie === 'function') {
      const cookies = response.headers.getSetCookie();
      if (cookies.length) res.setHeader('Set-Cookie', cookies);
    }
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (err) {
    console.error('[dev-server]', err && err.stack || err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'خطای سرور محلی' }));
  }
});

server.listen(PORT, () => {
  console.log(`[dev-server] worker running on http://localhost:${PORT}`);
  console.log(`[dev-server] temp DB: ${dbPath}`);
});
