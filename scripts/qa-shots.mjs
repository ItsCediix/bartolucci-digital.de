#!/usr/bin/env node
// QA: screenshots at defined scroll positions (desktop 1440x900 + mobile 390x844), network log with
// origin assertion, console error capture. Needs `npx serve public -l 4173` running.
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
const report = {base: BASE, requests: [], foreign: [], consoleErrors: [], pageErrors: [], shots: []};

const browser = await chromium.launch();
async function session(name, viewport, url, extra = {}) {
  const context = await browser.newContext({viewport, deviceScaleFactor: 1, ...extra});
  const page = await context.newPage();
  page.on('request', (r) => {
    report.requests.push({who: name, url: r.url(), type: r.resourceType()});
    if (!r.url().startsWith(BASE)) report.foreign.push({who: name, url: r.url()});
  });
  page.on('console', (m) => { if (m.type() === 'error') report.consoleErrors.push({who: name, text: m.text()}); });
  page.on('pageerror', (e) => report.pageErrors.push({who: name, text: String(e)}));
  await page.goto(url, {waitUntil: 'load'});
  await page.waitForTimeout(3000);
  // rendered DOM for validation (only one body variant exists after boot)
  fs.writeFileSync(path.join(OUT, `dom-${name}.html`), await page.content());
  const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  for (const p of positions) {
    const y = Math.round((total * p) / 100);
    await page.evaluate((yy) => { window.__lenisStop && window.__lenisStop(); window.scrollTo(0, yy); }, y);
    await page.waitForTimeout(p === 0 ? 1200 : 1800);
    // give the frame scheduler a moment to lerp + decode
    await page.waitForTimeout(900);
    const file = path.join(OUT, `${name}_${String(p).padStart(3, '0')}.png`);
    await page.screenshot({path: file, fullPage: false});
    const state = await page.evaluate(() => ({
      scrollY: Math.round(scrollY),
      panel: document.getElementById('panel')?.getAttribute('data-state') || null,
      time: document.querySelector('[data-time]')?.textContent || null,
      active: document.querySelector('[data-rail][aria-current="true"]')?.getAttribute('data-rail') || null,
    }));
    report.shots.push({who: name, pct: p, file: path.basename(file), ...state});
    console.log(`${name} ${p}% -> ${path.basename(file)} ${JSON.stringify(state)}`);
  }
  await context.close();
}

await session('desktop', {width: 1440, height: 900}, `${BASE}/?mode=desktop`);
await session('mobile', {width: 390, height: 844}, `${BASE}/?mode=mobile`, {isMobile: true, hasTouch: true});
await session('dark', {width: 1440, height: 900}, `${BASE}/?mode=desktop`, {colorScheme: 'dark'});
await browser.close();

const own = report.requests.filter((r) => r.url.startsWith(BASE)).length;
report.summary = {total: report.requests.length, ownOrigin: own, foreign: report.foreign.length, consoleErrors: report.consoleErrors.length, pageErrors: report.pageErrors.length};
fs.writeFileSync(path.join(OUT, 'qa-report.json'), JSON.stringify(report, null, 2));
console.log('\nsummary', report.summary);
if (report.foreign.length) { console.error('FOREIGN REQUESTS:', report.foreign); process.exitCode = 2; }
if (report.consoleErrors.length || report.pageErrors.length) { console.error('ERRORS:', report.consoleErrors, report.pageErrors); process.exitCode = 3; }
