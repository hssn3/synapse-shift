import puppeteer from 'puppeteer-core';
import path from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.BASE_URL || 'http://localhost:8787';
const OUT = path.join(process.cwd(), 'build');

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });

async function login(page) {
  await page.goto(BASE + '/?v=2#staffshift', { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => (b.textContent || '').includes('مدیر پرستاری')), { timeout: 30000 });
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b => (b.textContent || '').includes('مدیر پرستاری')).click());
  await page.waitForSelector('input[type="password"]', { timeout: 20000 });
  await page.type('input[type="password"]', '0000');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.ss-ward-groups', { timeout: 30000 });
  await new Promise(r => setTimeout(r, 500));
}

const desk = await browser.newPage();
await desk.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 2 });
const errors = [];
desk.on('pageerror', e => errors.push(e.message));
await login(desk);
const panel = await desk.$('.ss-ward-groups');
await (await panel.evaluateHandle(el => el.closest('.panel'))).asElement().screenshot({ path: path.join(OUT, 'wards-desktop.png') });

const mobCtx = await browser.createBrowserContext();
const mob = await mobCtx.newPage();
await mob.setViewport({ width: 400, height: 900, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await login(mob);
const mpanel = await mob.$('.ss-ward-groups');
await (await mpanel.evaluateHandle(el => el.closest('.panel'))).asElement().screenshot({ path: path.join(OUT, 'wards-mobile.png') });

console.log('errors:', errors.length);
await browser.close();
