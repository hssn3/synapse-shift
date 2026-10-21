import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const html = fs.readFileSync('build/code99-print.html', 'utf8');
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1200, height: 900 });
await p.setContent(html, { waitUntil: 'networkidle0' });
const info = await p.evaluate(() => {
  const sheets = [...document.querySelectorAll('.cd-sheet')].map(s => {
    const h = s.getBoundingClientRect().height;
    const tbl = s.querySelector('table');
    return { sheet: Math.round(h), table: tbl ? Math.round(tbl.getBoundingClientRect().height) : 0 };
  });
  const css = getComputedStyle(document.querySelector('table.cd-table'));
  return { sheets, tableHeight: css.height, count: sheets.length };
});
console.log(JSON.stringify(info, null, 1));
await b.close();
