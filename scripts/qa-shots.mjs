#!/usr/bin/env node
// QA: screenshots at defined scroll positions (desktop 1440x900 light + dark, mobile 390x844 + 360x780,
// reduced motion), network log with origin assertion, console error capture, initial-theme check.
// Needs `npx serve public -l 4173` running.
//   node scripts/qa-shots.mjs [--base http://localhost:4173] [--out review]
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, def) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : def; };
const BASE = opt('base', 'http://localhost:4173');
const OUT = path.resolve(ROOT, opt('out', 'review'));
fs.mkdirSync(OUT, {recursive: true});
// html-validate config for the rendered DOM dumps (serialised boolean attributes, GSAP inline styles)
fs.writeFileSync(path.join(OUT, '.htmlvalidate.json'), JSON.stringify({extends: ['html-validate:recommended'], rules: {'no-multiple-main': 'off', 'unique-landmark': 'off', 'no-inline-style': 'off', 'attribute-boolean-style': 'off', 'attribute-empty-style': 'off'}}, null, 2));

const positions = [0, 15, 35, 55, 75, 100];
const report = {base: BASE, requests: [], foreign: [], consoleErrors: [], pageErrors: [], initialTheme: {}, shots: []};

const browser = await chromium.launch();
async function session(name, viewport, url, extra = {}, opts = {}) {
  const context = await browser.newContext({viewport, deviceScaleFactor: 1, ...extra});
  if (opts.dark) await context.addInitScript(() => { try { localStorage.setItem('bd-theme', 'dark'); } catch (e) { /* ignore */ } });
  const page = await context.newPage();
  page.on('request', (r) => {
    report.requests.push({who: name, url: r.url(), type: r.resourceType()});
    if (!r.url().startsWith(BASE)) report.foreign.push({who: name, url: r.url()});
  });
  page.on('console', (m) => { if (m.type() === 'error') report.consoleErrors.push({who: name, text: m.text()}); });
  page.on('pageerror', (e) => report.pageErrors.push({who: name, text: String(e)}));
  await page.goto(url, {waitUntil: 'load'});
  await page.waitForTimeout(2500);
  report.initialTheme[name] = await page.evaluate(() => ({theme: document.documentElement.getAttribute('data-theme'), mode: document.documentElement.getAttribute('data-mode')}));
  fs.writeFileSync(path.join(OUT, `dom-${name}.html`), await page.content());
  const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  for (const p of opts.positions || positions) {
    const y = Math.round((total * p) / 100);
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(p === 0 ? 1200 : 2600);
    const file = path.join(OUT, `${name}_${String(p).padStart(3, '0')}.png`);
    await page.screenshot({path: file, fullPage: false});
    const state = await page.evaluate(() => ({
      scrollY: Math.round(scrollY),
      theme: document.documentElement.getAttribute('data-theme'),
      videos: document.querySelectorAll('video, canvas').length,
      active: document.querySelector('[data-rail][aria-current="true"]')?.getAttribute('data-rail') || null,
    }));
    report.shots.push({who: name, pct: p, file: path.basename(file), ...state});
    console.log(`${name} ${p}% -> ${path.basename(file)} ${JSON.stringify(state)}`);
  }
  await context.close();
}

// the OS asks for dark here: the page must still start light (light is the default, prefers-color-scheme is ignored)
await session('desktop', {width: 1440, height: 900}, `${BASE}/`, {colorScheme: 'dark'});
await session('dark', {width: 1440, height: 900}, `${BASE}/`, {colorScheme: 'light'}, {dark: true});
await session('mobile', {width: 390, height: 844}, `${BASE}/`, {isMobile: true, hasTouch: true}, {positions: [0, 30, 100]});
await session('mobile360', {width: 360, height: 780}, `${BASE}/`, {isMobile: true, hasTouch: true}, {positions: [0, 30, 100]});
await session('reduced', {width: 1440, height: 900}, `${BASE}/`, {reducedMotion: 'reduce'}, {positions: [0, 35, 75]});
await browser.close();

const own = report.requests.filter((r) => r.url.startsWith(BASE)).length;
report.summary = {total: report.requests.length, ownOrigin: own, foreign: report.foreign.length, consoleErrors: report.consoleErrors.length, pageErrors: report.pageErrors.length, uniqueUrls: [...new Set(report.requests.map((r) => r.url.replace(BASE, '')))].sort()};
fs.writeFileSync(path.join(OUT, 'qa-report.json'), JSON.stringify(report, null, 2));
console.log('\ninitial theme', report.initialTheme);
console.log('summary', report.summary);
if (report.initialTheme.desktop?.theme !== 'light') { console.error('FAIL: initial theme is not light'); process.exitCode = 4; }
if (report.foreign.length) { console.error('FOREIGN REQUESTS:', report.foreign); process.exitCode = 2; }
if (report.consoleErrors.length || report.pageErrors.length) { console.error('ERRORS:', report.consoleErrors, report.pageErrors); process.exitCode = 3; }
