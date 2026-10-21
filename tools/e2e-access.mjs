/* بررسی دسترسی: سرپرستار نباید تب/داده را ببیند؛ مدیر باید فرم بحران را چاپ کند */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:8787';
const OUT = path.join(process.cwd(), 'build');
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });

async function loginAs(page, tileText) {
  await page.goto(BASE + '/?v=2#staffshift', { waitUntil: 'networkidle2', timeout: 60000 });
  try {
    await page.waitForFunction(t => [...document.querySelectorAll('button')].some(b => (b.textContent || '').includes(t)), { timeout: 20000 }, tileText);
  } catch (e) {
    const txt = await page.evaluate(() => document.body.innerText.slice(0, 400));
    throw new Error('tile not found: ' + tileText + ' | body: ' + txt.replace(/\s+/g, ' '));
  }
  await page.evaluate(t => {
    const el = [...document.querySelectorAll('button')].find(b => (b.textContent || '').includes(t));
    el.click();
  }, tileText);
  await page.waitForSelector('input[type="password"]', { timeout: 20000 });
  await page.type('input[type="password"]', '0000', { delay: 20 });
  await page.keyboard.press('Enter');
  await new Promise(r => setTimeout(r, 2500));
}

// ---------- سرپرستار ----------
const ctxHead = await browser.createBrowserContext();
const head = await ctxHead.newPage();
await head.setViewport({ width: 1360, height: 900 });
const headErrors = [];
head.on('pageerror', e => headErrors.push(e.message));
await loginAs(head, 'اورژانس');
const headState = await head.evaluate(async () => {
  const hasTab = [...document.querySelectorAll('button')].some(b => (b.textContent || '').includes('فرم‌های کد'));
  let apiStatus = 0;
  try {
    const r = await fetch('/api/shift/codes?type=99&year=1405&month=8', { credentials: 'same-origin' });
    apiStatus = r.status;
  } catch (e) { apiStatus = -1; }
  const who = document.body.innerText.includes('مدیر پرستاری') ? 'manager' : 'other';
  return { hasTab, apiStatus, who };
});
console.log('HEAD NURSE:', JSON.stringify(headState), 'errors:', headErrors.length);

// ---------- مدیر: فرم بحران ----------
const ctxMgr = await browser.createBrowserContext();
const mgr = await ctxMgr.newPage();
await mgr.setViewport({ width: 1360, height: 900 });
await loginAs(mgr, 'مدیر پرستاری');
const crisisHtml = await mgr.evaluate(() => window.ssBuildPrintHtml({ form_code: 'MFH-HM-FR-00/17', nursing_manager_name: 'سلیمه احتسابی', clinical_supervisor_name: 'سودابه جهانگیری', hospital_president_name: 'دکتر فرزاد سالاری' }));
const mgrState = await mgr.evaluate(() => ({
  hasTab: [...document.querySelectorAll('button')].some(b => (b.textContent || '').includes('فرم‌های کد')),
  who: document.body.innerText.includes('مدیر پرستاری') ? 'manager' : 'other',
}));
console.log('MANAGER:', JSON.stringify(mgrState));
fs.writeFileSync(path.join(OUT, 'crisis-print.html'), crisisHtml, 'utf8');
const p2 = await browser.newPage();
await p2.goto(BASE + '/?v=2#staffshift', { waitUntil: 'domcontentloaded' });
await p2.evaluate(h => { document.open(); document.write(h); document.close(); }, crisisHtml);
await new Promise(r => setTimeout(r, 900));
await p2.evaluate(() => (document.fonts ? document.fonts.ready : null));
await p2.pdf({ path: path.join(OUT, 'crisis-print.pdf'), format: 'A4', landscape: true, printBackground: true, preferCSSPageSize: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
console.log('crisis html bytes:', crisisHtml.length);

await browser.close();
