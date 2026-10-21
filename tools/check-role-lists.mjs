import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:8787';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1400, height: 900 });
await p.goto(BASE + '/?v=2#staffshift', { waitUntil: 'networkidle2' });
await p.waitForFunction(() => [...document.querySelectorAll('button')].some(x => (x.textContent || '').includes('مدیر پرستاری')));
await p.evaluate(() => [...document.querySelectorAll('button')].find(x => (x.textContent || '').includes('مدیر پرستاری')).click());
await p.waitForSelector('input[type=password]');
await p.type('input[type=password]', '0000');
await p.keyboard.press('Enter');
await p.waitForFunction(() => [...document.querySelectorAll('button')].some(x => (x.textContent || '').includes('فرم‌های کد')));
await p.evaluate(() => [...document.querySelectorAll('button')].find(x => (x.textContent || '').includes('فرم‌های کد')).click());
await p.waitForSelector('.ss-cd-grid', { timeout: 20000 });
await new Promise(r => setTimeout(r, 800));
const info = await p.evaluate(() => {
  const out = {};
  [1, 2, 3, 4, 5, 6].forEach(i => {
    const dl = document.getElementById('ssCodePeopleList-' + i);
    const opts = dl ? [...dl.querySelectorAll('option')].map(o => o.value) : [];
    out['role' + i] = { count: opts.length, sample: opts.slice(0, 4) };
  });
  const units = [...document.querySelectorAll('.ss-ward-card')].map(e => e.textContent.trim());
  return { lists: out, hasOffice: units.some(t => t.includes('دفتر پرستاری')) };
});
console.log(JSON.stringify(info, null, 1));
await b.close();
