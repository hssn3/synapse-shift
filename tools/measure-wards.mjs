import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:8787';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 1000 });
await p.goto(BASE + '/?v=2#staffshift', { waitUntil: 'networkidle2' });
await p.waitForFunction(() => [...document.querySelectorAll('button')].some(x => (x.textContent || '').includes('مدیر پرستاری')));
await p.evaluate(() => [...document.querySelectorAll('button')].find(x => (x.textContent || '').includes('مدیر پرستاری')).click());
await p.waitForSelector('input[type=password]');
await p.type('input[type=password]', '0000');
await p.keyboard.press('Enter');
await p.waitForSelector('.ss-ward-card');
const info = await p.evaluate(() => {
  const cards = [...document.querySelectorAll('.ss-ward-card')];
  const rows = new Map();
  cards.forEach(c => {
    const r = Math.round(c.getBoundingClientRect().top);
    rows.set(r, (rows.get(r) || 0) + 1);
  });
  return {
    count: cards.length,
    widths: [...new Set(cards.map(c => Math.round(c.getBoundingClientRect().width)))],
    rowSizes: [...rows.values()],
    panel: Math.round(document.querySelector('.ss-ward-groups').getBoundingClientRect().width),
  };
});
console.log(JSON.stringify(info));
await b.close();
