#!/usr/bin/env node
// Ad-hoc screenshot: node scripts/shot.mjs <url> <out.png> [scrollY|#selector] [w] [h] [dark]
import {chromium} from 'playwright';
const [url, out, pos = '0', w = '1440', h = '900', dark = ''] = process.argv.slice(2);
const browser = await chromium.launch();
const ctx = await browser.newContext({viewport: {width: +w, height: +h}, colorScheme: dark ? 'dark' : 'light', isMobile: +w < 700, hasTouch: +w < 700});
const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto(url, {waitUntil: 'load'});
await page.waitForTimeout(2500);
if (pos.startsWith('#')) {
  await page.evaluate((s) => { const el = document.querySelector(s); window.scrollTo(0, el.getBoundingClientRect().top + scrollY); }, pos);
} else {
  await page.evaluate((y) => window.scrollTo(0, +y), pos);
}
await page.waitForTimeout(2200);
const info = await page.evaluate(() => ({y: scrollY, h: document.documentElement.scrollHeight, t: document.querySelector('[data-time]')?.textContent, st: document.getElementById('panel')?.dataset.state}));
await page.screenshot({path: out});
console.log(JSON.stringify(info), errs.length ? 'ERRORS ' + errs.join(' | ') : 'no errors');
await browser.close();
