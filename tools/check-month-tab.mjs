import puppeteer from 'puppeteer-core';

const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox'] });
const pg = await b.newPage();
await pg.setViewport({ width: 1440, height: 1000 });
await pg.goto('http://localhost:8787/?v=2#staffshift', { waitUntil: 'networkidle2' });
await pg.waitForFunction(() => [...document.querySelectorAll('button')].some(x => (x.textContent || '').includes('مدیر پرستاری')));
await pg.evaluate(() => [...document.querySelectorAll('button')].find(x => (x.textContent || '').includes('مدیر پرستاری')).click());
await pg.waitForSelector('input[type=password]');
await pg.type('input[type=password]', '0000');
await pg.keyboard.press('Enter');
await pg.waitForFunction(() => [...document.querySelectorAll('button')].some(x => (x.textContent || '').includes('برنامه‌ی شیفت')));
await pg.evaluate(() => [...document.querySelectorAll('button')].find(x => (x.textContent || '').includes('برنامه‌ی شیفت')).click());
await pg.waitForSelector('.ss-month-tabs');
const r = await pg.evaluate(() => {
  const a = document.querySelector('.ss-month-tab.active');
  const c = getComputedStyle(a);
  const rect = a.getBoundingClientRect();
  return { text: a.textContent.trim(), color: c.color, bg: c.backgroundColor, fontSize: c.fontSize, w: Math.round(rect.width), h: Math.round(rect.height) };
});
console.log(JSON.stringify(r));
await b.close();
