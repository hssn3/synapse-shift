/* تست سرتاسری تب «فرم‌های کد» با Chrome خود سیستم (بدون دانلود مرورگر) */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.BASE_URL || 'http://localhost:8787';
const OUT = path.join(process.cwd(), 'build');
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
const logs = [];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--font-render-hinting=none'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
page.on('console', m => { logs.push(m.type() + ': ' + m.text()); if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));

async function clickByText(text) {
  for (let i = 0; i < 20; i++) {
    const ok = await page.evaluate(t => {
      const els = [...document.querySelectorAll('button, a, [role="button"]')];
      const el = els.find(e => (e.textContent || '').includes(t));
      if (!el) return false;
      el.click();
      return true;
    }, text);
    if (ok) return;
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error('دکمه پیدا نشد: ' + text);
}

await page.goto(BASE + '/?v=2#staffshift', { waitUntil: 'networkidle2', timeout: 60000 });
await page.waitForFunction(() => document.body.innerText.includes('مدیر پرستاری'), { timeout: 30000 });
await clickByText('مدیر پرستاری');
await page.waitForSelector('input[type="password"]', { timeout: 20000 });
await page.type('input[type="password"]', '0000', { delay: 30 });
await page.keyboard.press('Enter');
await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => (b.textContent || '').includes('فرم‌های کد')), { timeout: 30000 });
console.log('login: OK');

await clickByText('فرم‌های کد');
await page.waitForSelector('.ss-cd-grid', { timeout: 30000 });
const gridInfo = await page.evaluate(() => {
  const rows = document.querySelectorAll('.ss-cd-grid tbody tr').length;
  const cols = document.querySelectorAll('.ss-cd-grid thead th').length;
  return { rows, cols };
});
console.log('grid:', JSON.stringify(gridInfo));

// یک خانه را پر کن: نقش ۱، روز ۱
await page.evaluate(() => {
  const cell = document.querySelector('.ss-cd-grid tbody tr td.cd-cell');
  if (cell) cell.click();
});
await page.waitForSelector('.ss-cd-grid input.ss-code-input', { timeout: 10000 });
await page.type('.ss-cd-grid input.ss-code-input', 'د. تبرایی', { delay: 20 });
await page.keyboard.press('Enter');
await new Promise(r => setTimeout(r, 1200));
const savedText = await page.evaluate(() => {
  const cell = document.querySelector('.ss-cd-grid tbody tr td.cd-cell');
  return cell ? cell.textContent.trim() : '';
});
console.log('saved cell text:', JSON.stringify(savedText));

await page.screenshot({ path: path.join(OUT, 'ui-codes-tab.png'), fullPage: false });
console.log('screenshot: ui-codes-tab.png');

// چاپ: HTML فرم کد ۹۹ را بساز و PDF بگیر
const printHtml = await page.evaluate(() => window.ssBuildCodePrintHtml('99'));
fs.writeFileSync(path.join(OUT, 'code99-print.html'), printHtml, 'utf8');
console.log('print html bytes:', printHtml.length);

const p2 = await browser.newPage();
await p2.setViewport({ width: 1200, height: 900 });
// مهم: صفحه با setContent اصلِ مبهم دارد و به‌خاطر CORP، CSS از پورت ۳۰۰۰ بارگذاری نمی‌شود؛
// پس اول همان مبدأ باز می‌شود و بعد HTML چاپ داخل همان صفحه نوشته می‌شود.
await p2.goto(BASE + '/?v=2#staffshift', { waitUntil: 'domcontentloaded' });
await p2.evaluate(h => { document.open(); document.write(h); document.close(); }, printHtml);
await new Promise(r => setTimeout(r, 900));
await p2.evaluate(() => document.fonts && document.fonts.ready);
await p2.pdf({ path: path.join(OUT, 'code99-print.pdf'), format: 'A4', landscape: true, printBackground: true, margin: { top: '0', right: '0', bottom: '0', left: '0' }, preferCSSPageSize: true });
console.log('pdf: code99-print.pdf');

// همان صفحه چاپ را هم اسکرین‌شات کن (نمای واقعی برگه)
await p2.screenshot({ path: path.join(OUT, 'code99-print-view.png'), fullPage: true });

// ذخیره‌سازی را با بارگذاری دوباره صفحه بسنج
await page.reload({ waitUntil: 'networkidle2' });
await page.waitForFunction(() => document.body.innerText.includes('برنامه‌ی شیفت'), { timeout: 30000 });
await clickByText('فرم‌های کد');
await page.waitForSelector('.ss-cd-grid', { timeout: 30000 });
const persisted = await page.evaluate(() => {
  const cell = document.querySelector('.ss-cd-grid tbody tr td.cd-cell');
  return cell ? cell.textContent.trim() : '';
});
console.log('persisted after reload:', JSON.stringify(persisted));

await browser.close();

console.log('CONSOLE ERRORS:', errors.length ? JSON.stringify(errors.slice(0, 8), null, 1) : 'none');
