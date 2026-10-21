import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const html = fs.readFileSync('build/code99-print-8787.html', 'utf8');
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1200, height: 900 });
await p.setContent(html, { waitUntil: 'networkidle0' });
const info = await p.evaluate(() => {
  const tbl = document.querySelector('table.cd-table');
  const tr = tbl.querySelector('tbody tr');
  const td = tr.querySelector('td.cd-day') || tr.querySelector('td');
  const cs = getComputedStyle(td);
  const ts = getComputedStyle(tbl);
  return {
    tableH: Math.round(tbl.getBoundingClientRect().height),
    tableCssH: ts.height,
    rowH: Math.round(tr.getBoundingClientRect().height),
    tdH: Math.round(td.getBoundingClientRect().height),
    font: cs.fontSize, lh: cs.lineHeight, pad: cs.padding,
    sheets: [...document.querySelectorAll('.cd-sheet')].length,
    bodyFont: getComputedStyle(document.body).fontSize,
  };
});
console.log(JSON.stringify(info, null, 1));
await b.close();
