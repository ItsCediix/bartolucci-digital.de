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
// team photos are optional (initials tile until the JPGs exist), so their 404 is expected and listed apart
const missing = [];
page.on('response', (r) => { if (r.status() >= 400) missing.push(`${r.status()} ${r.url()}`); });
await page.goto(`${BASE}/?mode=desktop`, {waitUntil: 'load'});
await page.waitForTimeout(2500);
const ids = await page.evaluate(() => window.__bdChapters.map((c) => c.id));
const lastId = ids[ids.length - 1];
const facts = {};
for (const id of ids) {
  if (only && id !== only) continue;
  // the last chapter hands the stage over during its final 10 % (fade to 0), so its "100 %" frame is the
  // scene's end state just before the hand-over (89 %); 60 % of "website" proves the caption is still hidden
  const shots = id === lastId ? [[0, 0], [50, 50], [100, 89]] : id === 'website' ? [[0, 0], [50, 50], [60, 60], [100, 100]] : [[0, 0], [50, 50], [100, 100]];
  for (const [label, pct] of shots) {
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
    const file = path.join(OUT, `scene_${id}_${String(label).padStart(3, '0')}${THEME === 'dark' ? '_dark' : ''}.png`);
    await page.screenshot({path: file});
    const state = await page.evaluate(() => {
      const note = document.querySelector('#k-website .demo-note');
      const inq = document.querySelector('[data-scene="website"] .ws-inquiry');
      const st = document.getElementById('stage');
      return {captionOpacity: note ? +getComputedStyle(note).opacity : null, inquiryOpacity: inq ? +getComputedStyle(inq).opacity : null, stageOpacity: st ? +getComputedStyle(st).opacity : null};
    });
    facts[`${id}_${label}`] = {pct, y, ...state};
    console.log(`${id} ${pct}% -> ${path.basename(file)} (y=${y}) ${JSON.stringify(state)}`);
  }
}
const beatShares = await page.evaluate(() => Object.fromEntries(window.__bdChapters.filter((c) => c.beatShares).map((c) => [c.id, c.beatShares])));
fs.writeFileSync(path.join(OUT, `scenes-qa${THEME === 'dark' ? '-dark' : ''}.json`), JSON.stringify({theme: THEME, beatShares, frames: facts, errors}, null, 2));
await browser.close();
const unexpected = missing.filter((m) => !/\/assets\/team\/(luca|cederic)\.jpg$/.test(m));
const realErrors = errors.filter((e) => !/status of 404/.test(e) || unexpected.length);
console.log('http errors:', missing);
if (realErrors.length || unexpected.length) { console.error('ERRORS', realErrors, unexpected); process.exitCode = 3; }
