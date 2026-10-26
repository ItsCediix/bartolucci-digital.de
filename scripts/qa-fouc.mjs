#!/usr/bin/env node
// QA v12: load flicker (FOUC). Desktop 1440 × 900, CPU throttled × 4.
//  1. screenshots at domcontentloaded and 0 / 50 / 150 ms after navigation start (review/fouc_*.png), each with
//     the computed state of chapter 2/3 copy, the stage layers and the price card
//  2. 10 reloads: at domcontentloaded a below-fold [data-beat] element must have computed opacity '0' and no
//     inline opacity (= the hidden state comes from the stylesheet, not from GSAP)
//  3. same check with desktop.js blocked (no GSAP timeline at all): the CSS alone hides the element
//  4. v13: the sections after the story (incl. "morgens" and its scene) are hidden at domcontentloaded
// Needs `npx serve public -l 4173` running.   node scripts/qa-fouc.mjs [--base …] [--out review]
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

const probe = () => {
  const op = (el) => (el ? getComputedStyle(el).opacity : null);
  const vis = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    let o = 1;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) o *= +getComputedStyle(e).opacity;
    return o > 0.01 && getComputedStyle(el).visibility !== 'hidden' && r.bottom > 0 && r.top < innerHeight && r.width > 0;
  };
  const q = (s) => document.querySelector(s);
  const all = (s) => Array.from(document.querySelectorAll(s));
  return {
    t: Math.round(performance.now()),
    readyState: document.readyState,
    htmlJs: document.documentElement.classList.contains('js'),
    scrollY: scrollY,
    ch23Opacity: all('#k-website [data-beat], #k-betreuung [data-beat]').map(op),
    ch23Visible: all('#k-website [data-beat], #k-betreuung [data-beat], #k-website [data-beat] li, #k-betreuung li').some(vis),
    stageLayers: all('#stage .scene').map((s) => ({id: s.dataset.scene, opacity: op(s.querySelector('.scene-in'))})),
    stageLayersVisible: all('#stage .scene:not([data-scene="hook"]) .scene-in').filter(vis).length,
    priceVisible: vis(q('.price')),
    hookBubbleOpacity: op(q('#stage .hk-b')),
  };
};

const report = {timeline: [], reloads: [], cssOnly: [], auto: []};
const browser = await chromium.launch();

async function throttledPage(extra = {}) {
  const context = await browser.newContext({viewport: {width: 1440, height: 900}, deviceScaleFactor: 1, ...extra});
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', {rate: 4});
  return {context, page};
}

// 1. timeline screenshots
{
  const {context, page} = await throttledPage();
  const shots = [];
  page.once('domcontentloaded', () => {
    shots.push((async () => {
      const state = await page.evaluate(probe).catch((e) => ({error: String(e)}));
      await page.screenshot({path: path.join(OUT, 'fouc_domcontentloaded.png')});
      report.timeline.push({at: 'domcontentloaded', file: 'fouc_domcontentloaded.png', ...state});
    })());
  });
  // t0 = the response is committed (the new document exists); before that there is only about:blank
  await page.goto(`${BASE}/?mode=desktop`, {waitUntil: 'commit'});
  const nav = page.waitForLoadState('load');
  const t0 = Date.now();
  for (const ms of [0, 50, 150]) {
    const wait = t0 + ms - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    const state = await page.evaluate(probe).catch((e) => ({error: String(e)}));
    const file = `fouc_${String(ms).padStart(3, '0')}ms.png`;
    await page.screenshot({path: path.join(OUT, file)}).catch(() => {});
    report.timeline.push({at: `${ms} ms`, file, ...state});
  }
  await nav;
  await Promise.all(shots);
  await page.waitForTimeout(600);
  const state = await page.evaluate(probe);
  await page.screenshot({path: path.join(OUT, 'fouc_load.png')});
  report.timeline.push({at: 'load + 600 ms', file: 'fouc_load.png', ...state});
  await context.close();
}

// 2. ten reloads, assertion at domcontentloaded
const check = () => {
  const el = document.querySelector('#k-betreuung [data-beat]');
  const cs = getComputedStyle(el);
  return {el: el.tagName.toLowerCase() + '.' + el.className, top: Math.round(el.getBoundingClientRect().top), opacity: cs.opacity, inlineOpacity: el.style.opacity || null};
};
{
  const {context, page} = await throttledPage();
  for (let i = 0; i < 10; i++) {
    const p = new Promise((res) => page.once('domcontentloaded', () => res(page.evaluate(check))));
    if (i === 0) await page.goto(`${BASE}/?mode=desktop`, {waitUntil: 'load'});
    else await page.reload({waitUntil: 'load'});
    const r = await p;
    report.reloads.push({run: i + 1, ...r, pass: r.opacity === '0' && r.top > 900});
  }
  await context.close();
}

// 3. CSS only: desktop.js blocked, so no timeline ever touches the copy
{
  const {context, page} = await throttledPage();
  await page.route('**/assets/desktop.js', (route) => route.fulfill({status: 200, contentType: 'text/javascript', body: '/* blocked for the FOUC test */'}));
  const p = new Promise((res) => page.once('domcontentloaded', () => res(page.evaluate(check))));
  await page.goto(`${BASE}/?mode=desktop`, {waitUntil: 'load'});
  const r = await p;
  const stage = await page.evaluate(() => Array.from(document.querySelectorAll('#stage .scene')).map((s) => s.dataset.scene + ':' + getComputedStyle(s.querySelector('.scene-in')).opacity + '/' + getComputedStyle(s.querySelector('.hk-b') || s).opacity));
  await page.screenshot({path: path.join(OUT, 'fouc_css_only.png')});
  report.cssOnly.push({...r, stage, pass: r.opacity === '0' && !r.inlineOpacity});
  await context.close();
}

// 4. v13 (the sub-page is gone): the "morgens" section and its scene layer are hidden at domcontentloaded
{
  const {context, page} = await throttledPage();
  const p = new Promise((res) => page.once('domcontentloaded', () => res(page.evaluate(() => ['#morgens .morgens-copy', '#morgens .morgens-fig', '[data-morning] .scene-in', '#preise .price-col', '#ueber-uns .team'].map((s) => getComputedStyle(document.querySelector(s)).opacity)))));
  await page.goto(`${BASE}/?mode=desktop`, {waitUntil: 'load'});
  const r = await p;
  report.auto.push({opacities: r, pass: r.every((o) => o === '0')});
  await context.close();
}
await browser.close();

const tlPass = report.timeline.every((s) => !s.error && !s.ch23Visible && !s.priceVisible && !s.stageLayersVisible);
report.summary = {
  timelinePass: tlPass,
  reloadsPassed: report.reloads.filter((r) => r.pass).length + '/10',
  cssOnlyPass: report.cssOnly.every((r) => r.pass),
  autoPass: report.auto.every((r) => r.pass),
};
fs.writeFileSync(path.join(OUT, 'fouc.json'), JSON.stringify(report, null, 2));
for (const s of report.timeline) console.log(s.at, JSON.stringify({rs: s.readyState, js: s.htmlJs, ch23Visible: s.ch23Visible, layersVisible: s.stageLayersVisible, priceVisible: s.priceVisible, bubble: s.hookBubbleOpacity, err: s.error}));
console.log('reloads', report.reloads.map((r) => `${r.run}:${r.opacity}${r.inlineOpacity ? '(inline ' + r.inlineOpacity + ')' : ''}`).join(' '));
console.log('css only', JSON.stringify(report.cssOnly));
console.log('auto', JSON.stringify(report.auto));
console.log('summary', report.summary);
if (!tlPass || report.reloads.some((r) => !r.pass) || !report.summary.cssOnlyPass || !report.summary.autoPass) process.exitCode = 1;
