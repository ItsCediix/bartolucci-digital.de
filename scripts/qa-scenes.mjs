#!/usr/bin/env node
// QA: freeze every chapter scene at 0 / 50 / 100 % of its scroll timeline (desktop 1440 × 900) and save
// review/scene_<id>_<pct>.png. The hook has no scroll timeline (it plays on load), so its intro timeline
// is paused and seeked instead. Needs `npx serve public -l 4173` running.
//   node scripts/qa-scenes.mjs [--base http://localhost:4173] [--out review] [--theme dark]
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, def) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : def; };
const BASE = opt('base', 'http://localhost:4173');
const OUT = path.resolve(ROOT, opt('out', 'review'));
const THEME = opt('theme', 'light');
const only = opt('only', null);
fs.mkdirSync(OUT, {recursive: true});

const browser = await chromium.launch();
const context = await browser.newContext({viewport: {width: 1440, height: 900}, deviceScaleFactor: 1});
if (THEME === 'dark') await context.addInitScript(() => localStorage.setItem('bd-theme', 'dark'));
const page = await context.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`${BASE}/?mode=desktop`, {waitUntil: 'load'});
await page.waitForTimeout(2500);
const ids = await page.evaluate(() => window.__bdChapters.map((c) => c.id));
for (const id of ids) {
  if (only && id !== only) continue;
  for (const pct of [0, 50, 100]) {
    const y = await page.evaluate(([cid, p]) => {
      const c = window.__bdChapters.find((x) => x.id === cid);
      if (!c.tl.scrollTrigger) {
        c.tl.pause();
        c.tl.progress(p / 100);
        return 0;
      }
      const st = c.tl.scrollTrigger;
      return Math.round(st.start + (st.end - st.start) * (p / 100)) + (p === 0 ? 2 : p === 100 ? -2 : 0);
    }, [id, pct]);
    if (id !== 'hook') await page.evaluate((yy) => window.scrollTo(0, yy), y);
    else await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1600);
    const file = path.join(OUT, `scene_${id}_${String(pct).padStart(3, '0')}${THEME === 'dark' ? '_dark' : ''}.png`);
    await page.screenshot({path: file});
    console.log(`${id} ${pct}% -> ${path.basename(file)} (y=${y})`);
  }
}
await browser.close();
if (errors.length) { console.error('ERRORS', errors); process.exitCode = 3; }
