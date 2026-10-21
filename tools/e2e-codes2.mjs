import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.BASE_URL || 'http://localhost:8787';
const OUT = path.join(process.cwd(), 'build');

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto(BASE + '/?v=2#staffshift', { waitUntil: 'networkidle2', timeout: 60000 });
await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => (b.textContent || '').includes('مدیر پرستاری')), { timeout: 30000 });
await page.evaluate(() => [...document.querySelectorAll('button')].find(b => (b.textContent || '').includes('مدیر پرستاری')).click());
await page.waitForSelector('input[type="password"]', { timeout: 20000 });
await page.type('input[type="password"]', '0000');
await page.keyboard.press('Enter');
await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => (b.textContent || '').includes('فرم‌های کد')), { timeout: 30000 });
await page.evaluate(() => [...document.querySelectorAll('button')].find(b => (b.textContent || '').includes('فرم‌های کد')).click());
await page.waitForSelector('.ss-cd-grid', { timeout: 30000 });
await new Promise(r => setTimeout(r, 700));
await page.screenshot({ path: path.join(OUT, 'codes-tab-99.png') });

const filled = await page.evaluate(() => document.querySelectorAll('.ss-cd-grid tbody td.cd-cell').length && document.querySelector('.ss-cd-grid tbody td.cd-cell').textContent.trim());
console.log('first cell:', JSON.stringify(filled));

// چاپ کد ۹۹ در همین وضعیت (داده‌ها بارگذاری شده)
const codeHtml = await page.evaluate(() => window.ssBuildCodePrintHtml('99'));
fs.writeFileSync(path.join(OUT, 'code99-print.html'), codeHtml, 'utf8');

// حالا چیپ بحران و چاپ آن
await page.evaluate(() => [...document.querySelectorAll('button')].find(b => (b.textContent || '').includes('بحران اورژانس')).click());
await page.waitForSelector('.ss-meta-box', { timeout: 20000 });
await new Promise(r => setTimeout(r, 700));
await page.screenshot({ path: path.join(OUT, 'codes-tab-crisis.png') });

const crisisHtml = await page.evaluate(async () => {
  const r = await fetch('/api/shift/codes/meta?type=crisis', { credentials: 'same-origin' });
  const d = await r.json();
  const m = d.meta || {};
  return window.ssBuildPrintHtml(Object.assign({}, m, {
    title: m.title, form_code: m.form_code, beds: m.beds, care_method: m.method,
    contract_hours: m.contract_hours, level_avg: m.level_avg, level_hours: m.level_hours,
    training_title: m.training_title,
    clinical_supervisor_name: (m.signs || [])[1] && m.signs[1].name,
    nursing_manager_name: (m.signs || [])[2] && m.signs[2].name,
    hospital_president_name: (m.signs || [])[3] && m.signs[3].name,
  }));
});
fs.writeFileSync(path.join(OUT, 'crisis-print.html'), crisisHtml, 'utf8');

// PDF از همان صفحهٔ دارای نشست (لوگو با کوکی می‌آید)
async function printPdf(html, out) {
  await page.goto(BASE + '/?v=2#staffshift', { waitUntil: 'domcontentloaded' });
  await page.evaluate(h => { document.open(); document.write(h); document.close(); }, html);
  await new Promise(r => setTimeout(r, 1000));
  await page.pdf({ path: out, format: 'A4', landscape: true, printBackground: true, preferCSSPageSize: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
}

await printPdf(codeHtml, path.join(OUT, 'code99-print.pdf'));
await printPdf(crisisHtml, path.join(OUT, 'crisis-print.pdf'));
console.log('pdfs done');
console.log('errors:', errors.length ? JSON.stringify(errors.slice(0, 5)) : 'none');
await browser.close();
