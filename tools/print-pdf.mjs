/* فقط HTML چاپی ذخیره‌شده را به PDF تبدیل می‌کند (بدون ورود و بدون UI) */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const htmlPath = process.argv[2] || 'build/code99-print.html';
const outPdf = process.argv[3] || 'build/print-check.pdf';
const html = fs.readFileSync(htmlPath, 'utf8');

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 900 });
await page.setContent(html, { waitUntil: 'networkidle0' });
await page.evaluate(() => (document.fonts ? document.fonts.ready : null));
await page.pdf({ path: outPdf, format: 'A4', landscape: true, printBackground: true, preferCSSPageSize: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
await browser.close();
console.log('pdf:', outPdf);
