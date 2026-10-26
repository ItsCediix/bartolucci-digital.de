#!/usr/bin/env node
// QA v12: fluid width, line length, scroll distance, scene size, price card.
//  - 1440 × 900, 1920 × 1080, 2560 × 1440, 3440 × 1440, light + dark: review/width_<w>[_dark].png at 0 % and
//    review/width_<w>_preise[_dark].png at the price section; margin left/right of every container
//  - longest rendered text line in characters (all pages, scenes excluded), gate ≤ 80
//  - review/scene_website_100_<w>.png at 1440 and 1920: website scene width vs. stage column, demo headline px
//  - page length of / at 1440 × 900 in viewport heights, scroll distance per chapter, beat-vs-copy visibility
//  - review/preise_<w>[_dark].png at 1440 and 2560
// Writes review/v12-qa.json. Needs `npx serve public -l 4173` running.
//   node scripts/qa-v12.mjs [--base http://localhost:4173] [--out review]
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

const SIZES = [[1440, 900], [1920, 1080], [2560, 1440], [3440, 1440]];
const report = {width: {}, lines: {}, scene: {}, scroll: {}, errors: []};

// longest rendered line per text block, in characters (spaces included)
const longestLines = () => {
  const skip = '.stage, .m-stage, .auto-fig, svg, script, style, noscript, .rail, .skip, template';
  const lines = new Map();
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  while (w.nextNode()) {
    const n = w.currentNode;
    const p = n.parentElement;
    if (!p || p.closest(skip) || !n.nodeValue.trim()) continue;
    const block = p.closest('p, li, dd, dt, h1, h2, h3, a, button, div');
    for (let i = 0; i < n.nodeValue.length; i++) {
      range.setStart(n, i);
      range.setEnd(n, i + 1);
      const r = range.getClientRects()[0];
      if (!r || !r.width && n.nodeValue[i] !== ' ') continue;
      const key = block;
      if (!lines.has(key)) lines.set(key, new Map());
      const rows = lines.get(key);
      const row = Math.round((r.top + window.scrollY) / 6);
      rows.set(row, (rows.get(row) || '') + n.nodeValue[i]);
    }
  }
  let best = {chars: 0, text: ''};
  for (const rows of lines.values()) {
    for (const t of rows.values()) {
      const s = t.replace(/\s+/g, ' ').trim();
      if (s.length > best.chars) best = {chars: s.length, text: s};
    }
  }
  return best;
};

const margins = () => {
  const vw = document.documentElement.clientWidth;
  const m = (sel) => {
    const e = document.querySelector(sel);
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return {left: Math.round(r.left), right: Math.round(vw - r.right), leftPct: +(r.left / vw * 100).toFixed(1), rightPct: +((vw - r.right) / vw * 100).toFixed(1)};
  };
  return {vw, story: m('.story'), header: m('.site-header .brand'), preise: m('#preise .wrap'), ablauf: m('#ablauf .wrap'), kontakt: m('#kontakt .wrap'), autoWrap: m('.auto .wrap'), legal: m('.legal')};
};

const browser = await chromium.launch();
async function open(url, w, h, dark) {
  const context = await browser.newContext({viewport: {width: w, height: h}, deviceScaleFactor: 1});
  if (dark) await context.addInitScript(() => { try { localStorage.setItem('bd-theme', 'dark'); } catch (e) { /* ignore */ } });
  const page = await context.newPage();
  page.on('pageerror', (e) => report.errors.push(`${url} ${w}: ${e}`));
  await page.goto(url, {waitUntil: 'load'});
  await page.waitForTimeout(1500);
  return {context, page};
}
async function toPrice(page) {
  await page.evaluate(() => { const el = document.getElementById('preise'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 72); });
  await page.waitForTimeout(1200);
}

// ---------------------------------------------------------------- width + price shots + line lengths on /
for (const [w, h] of SIZES) {
  for (const dark of [false, true]) {
    const sfx = dark ? '_dark' : '';
    const {context, page} = await open(`${BASE}/?mode=desktop`, w, h, dark);
    await page.screenshot({path: path.join(OUT, `width_${w}${sfx}.png`)});
    const m = await page.evaluate(margins);
    await toPrice(page);
    await page.screenshot({path: path.join(OUT, `width_${w}_preise${sfx}.png`)});
    if ((w === 1440 || w === 2560)) {
      const card = await page.$('#preise .wrap');
      await card.screenshot({path: path.join(OUT, `preise_${w}${sfx}.png`)});
    }
    if (!dark) {
      // all chapters revealed first (end of every timeline), then measure every rendered line
      await page.evaluate(() => (window.__bdChapters || []).forEach((c) => c.tl && c.tl.progress(1)));
      report.lines[`index_${w}`] = await page.evaluate(longestLines);
      report.width[w] = m;
    }
    await context.close();
  }
  for (const [name, url] of [['impressum', '/impressum.html'], ['datenschutz', '/datenschutz.html']]) {
    const {context, page} = await open(BASE + url, w, h, false);
    report.width[`${name}_${w}`] = await page.evaluate(margins);
    report.lines[`${name}_${w}`] = await page.evaluate(longestLines);
    await context.close();
  }
}

// ---------------------------------------------------------------- scene size + scroll distance at 1440 / 1920
for (const [w, h] of [[1440, 900], [1920, 1080]]) {
  const {context, page} = await open(`${BASE}/?mode=desktop`, w, h, false);
  const y = await page.evaluate(() => { const st = window.__bdChapters.find((c) => c.id === 'website').tl.scrollTrigger; return Math.round(st.end) - 2; });
  await page.evaluate((yy) => window.scrollTo(0, yy), y);
  await page.waitForTimeout(1800);
  await page.screenshot({path: path.join(OUT, `scene_website_100_${w}.png`)});
  report.scene[w] = await page.evaluate(() => {
    const col = document.querySelector('.col-panel');
    const fit = document.querySelector('#stage [data-scene="website"] .scene-fit');
    const k = new DOMMatrix(getComputedStyle(fit).transform).a;
    const demo = new DOMMatrix(getComputedStyle(document.querySelector('#stage .demo-desk')).transform).a;
    const dh = document.querySelector('#stage .demo-desk .d-h');
    return {
      column: col.clientWidth, sceneWidth: Math.round(1180 * k), scale: +k.toFixed(3),
      fillPct: +((1180 * k) / col.clientWidth * 100).toFixed(1),
      demoHeadlinePx: +(parseFloat(getComputedStyle(dh).fontSize) * demo * k).toFixed(1),
      demoHeadlineBoxPx: Math.round(dh.getBoundingClientRect().height),
    };
  });
  if (w === 1440) {
    report.scroll = await page.evaluate(() => {
      const vh = innerHeight;
      const out = {pageVh: +(document.documentElement.scrollHeight / vh).toFixed(2), chapters: {}};
      window.__bdChapters.forEach((c) => {
        const st = c.tl && c.tl.scrollTrigger;
        out.chapters[c.id] = {heightVh: +(c.el.offsetHeight / vh).toFixed(2), scrollVh: st ? +((st.end - st.start) / vh).toFixed(2) : null, beatShares: c.beatShares || null};
      });
      return out;
    });
    // at the start of every beat: are all copy elements of that beat inside the viewport (below the header)?
    const checks = [];
    for (const id of ['website', 'betreuung']) {
      const shares = report.scroll.chapters[id].beatShares;
      for (let b = 0; b < shares.length; b++) {
        const yy = await page.evaluate(([cid, s]) => { const st = window.__bdChapters.find((c) => c.id === cid).tl.scrollTrigger; return Math.round(st.start + (st.end - st.start) * s) + 4; }, [id, shares[b]]);
        await page.evaluate((v) => window.scrollTo(0, v), yy);
        await page.waitForTimeout(900);
        const r = await page.evaluate(([cid, n]) => Array.from(document.querySelectorAll(`#k-${cid} [data-beat="${n}"]`)).map((el) => {
          const rc = el.getBoundingClientRect();
          return {el: el.tagName.toLowerCase(), top: Math.round(rc.top), bottom: Math.round(rc.bottom), inView: rc.top >= 60 && rc.bottom <= innerHeight};
        }), [id, b + 1]);
        checks.push({chapter: id, beat: b + 1, scrollY: yy, elements: r, pass: r.every((e) => e.inView)});
      }
    }
    report.scroll.beatVisibility = checks;
  }
  await context.close();
}
await browser.close();

// ---------------------------------------------------------------- gates
const gate = {};
gate.margins = Object.fromEntries([2560, 3440].map((w) => {
  const m = report.width[w];
  const worst = Math.max(...['story', 'preise', 'ablauf', 'kontakt'].flatMap((k) => [m[k].leftPct, m[k].rightPct]));
  const subs = ['impressum', 'datenschutz'].map((n) => report.width[`${n}_${w}`]).flatMap((x) => [x.autoWrap, x.legal].filter(Boolean)).flatMap((r) => [r.leftPct, r.rightPct]);
  const all = Math.max(worst, ...subs);
  return [w, {worstMarginPct: all, pass: all <= 7}];
}));
const longest = Object.entries(report.lines).sort((a, b) => b[1].chars - a[1].chars)[0];
gate.lineLength = {worst: longest[0], chars: longest[1].chars, text: longest[1].text, pass: longest[1].chars <= 80};
gate.sceneFill = {1440: report.scene[1440].fillPct >= 85, 1920: report.scene[1920].fillPct >= 90, headline1920: report.scene[1920].demoHeadlinePx >= 20};
gate.pageLength = {vh: report.scroll.pageVh, pass: report.scroll.pageVh <= 10};
gate.beats = report.scroll.beatVisibility.every((c) => c.pass);
report.gate = gate;
fs.writeFileSync(path.join(OUT, 'v12-qa.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({gate, scene: report.scene, scroll: {pageVh: report.scroll.pageVh, chapters: report.scroll.chapters}, errors: report.errors}, null, 2));
for (const c of report.scroll.beatVisibility) console.log(c.chapter, c.beat, c.pass, JSON.stringify(c.elements));
const ok = Object.values(gate.margins).every((g) => g.pass) && gate.lineLength.pass && Object.values(gate.sceneFill).every(Boolean) && gate.pageLength.pass && gate.beats && !report.errors.length;
if (!ok) process.exitCode = 1;
