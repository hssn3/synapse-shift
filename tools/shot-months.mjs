/* اسکرین‌شات نوار ماه‌ها در دو تب (گرید و فرم‌های کد) */
import puppeteer from 'puppeteer-core';
import path from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.BASE_URL || 'http://localhost:8787';
const OUT = path.join(process.cwd(), 'build');

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));

await page.goto(BASE + '/?v=2#staffshift', { waitUntil: 'networkidle2', timeout: 60000 });
await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => (b.textContent || '').includes('مدیر پرستاری')), { timeout: 30000 });
await page.evaluate(() => [...document.querySelectorAll('button')].find(b => (b.textContent || '').includes('مدیر پرستاری')).click());
await page.waitForSelector('input[type="password"]', { timeout: 20000 });
await page.type('input[type="password"]', '0000', { delay: 20 });
await page.keyboard.press('Enter');
await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => (b.textContent || '').includes('فرم‌های کد')), { timeout: 30000 });

// تب گرید
await page.evaluate(() => [...document.querySelectorAll('button')].find(b => (b.textContent || '').includes('برنامه‌ی شیفت')).click());
await page.waitForSelector('.ss-month-tabs', { timeout: 20000 });
const barGrid = await page.$('.ss-month-tabs');
await barGrid.screenshot({ path: path.join(OUT, 'month-tabs-grid.png') });

// تب فرم‌های کد
await page.evaluate(() => [...document.querySelectorAll('button')].find(b => (b.textContent || '').includes('فرم‌های کد')).click());
await page.waitForSelector('.ss-cd-grid', { timeout: 30000 });
await new Promise(r => setTimeout(r, 600));
const barCodes = await page.$('.ss-month-tabs');
await barCodes.screenshot({ path: path.join(OUT, 'month-tabs-codes.png') });
await page.screenshot({ path: path.join(OUT, 'ui-codes-tab.png') });

const box = await barGrid.boundingBox();
console.log('month bar size:', Math.round(box.width) + 'x' + Math.round(box.height));
console.log('errors:', errors.length);
await browser.close();
