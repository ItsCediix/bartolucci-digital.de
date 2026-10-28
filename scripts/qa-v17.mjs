#!/usr/bin/env node
// QA v17: the stage transition ("sucked in, flown in" + light sweep), the text block cutting with it, reload
// mid-page, reduced motion, the team photo boxes, console errors / third-party requests, screenshots and the
// scroll video. Frames are sampled with requestAnimationFrame inside the page (headless Chromium, software renderer).
//  - <out>/*.png, scroll_1440_light.webm; <analysis>/v17-gates.json; exit 1 when a gate fails
//   node scripts/qa-v17.mjs [--base http://localhost:4173] [--out ../review_2026-10-28_v17] [--analysis ../analysis]
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, def) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : def; };
const BASE = opt('base', 'http://localhost:4173');
const OUT = path.resolve(ROOT, opt('out', '../review_2026-10-28_v17'));
const ANA = path.resolve(ROOT, opt('analysis', '../analysis'));
fs.mkdirSync(OUT, {recursive: true});
fs.mkdirSync(ANA, {recursive: true});

const report = {base: BASE, transitions: [], text: [], reload: null, reduced: null, team: [], errors: [], foreign: [], shots: []};
const fails = [];
const gate = (ok, msg) => { if (!ok) fails.push(msg); return ok; };
const browser = await chromium.launch();
const wait = (p, ms) => p.waitForTimeout(ms);

async function open(w, h, {dark = false, reduced = false, mobile = false, video = null} = {}) {
  const context = await browser.newContext({viewport: {width: w, height: h}, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile,
    reducedMotion: reduced ? 'reduce' : 'no-preference', ...(video ? {recordVideo: {dir: video, size: {width: w, height: h}}} : {})});
  await context.addInitScript((d) => {
    try { if (d) localStorage.setItem('bd-theme', 'dark'); sessionStorage.clear(); } catch (e) { /* ignore */ }
    window.__cls = 0;
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({type: 'layout-shift', buffered: true}); } catch (e) { /* ignore */ }
  }, dark);
  const page = await context.newPage();
  const tag = `${w}${dark ? ' dark' : ''}${reduced ? ' rm' : ''}`;
  page.on('pageerror', (e) => report.errors.push(`${tag}: ${e}`));
  page.on('console', (m) => { if (m.type() === 'error') report.errors.push(`${tag} console: ${m.text()}`); });
  page.on('request', (r) => { const u = new URL(r.url()); if (!/^(localhost|127\.0\.0\.1)$/.test(u.hostname) && !/^(data|blob):/.test(r.url())) report.foreign.push(r.url()); });
  return {context, page};
}
const chapterTop = (page, id) => page.evaluate((s) => Math.round(document.getElementById(s).getBoundingClientRect().top + scrollY), id);
// jump to the start of a chapter (as after the settle) and sample every frame for `ms`
async function jumpAndSample(page, id, ms) {
  const y = await chapterTop(page, id);
  return page.evaluate(({y, ms}) => new Promise((res) => {
    const st = document.getElementById('stage');
    const scenes = [...st.querySelectorAll('.scene')];
    const chs = window.__bdChapters;
    const frames = [];
    const t0 = performance.now();
    const cls0 = window.__cls;
    const sweep = () => { const s = getComputedStyle(st, '::after'); return {o: +s.opacity, t: s.transform}; };
    const tick = () => {
      const t = performance.now() - t0;
      frames.push({t, sc: scenes.map((sc) => ({id: sc.dataset.scene, o: +getComputedStyle(sc).opacity, s: +gsap.getProperty(sc, 'scale'), x: +gsap.getProperty(sc, 'xPercent')})),
        txt: chs.map((c) => c.block ? {id: c.id, o: +getComputedStyle(c.block).opacity, lines: c.lines.map((l) => +getComputedStyle(l).opacity)} : null), sw: sweep()});
      if (t < ms) requestAnimationFrame(tick); else res({frames, cls: window.__cls - cls0, stage: window.__bdStage()});
    };
    window.scrollTo({top: y, behavior: 'instant'});
    requestAnimationFrame(tick);
  }), {y, ms});
}
function analyse(run, from, to) {
  const f = run.frames;
  // the old scene counts until it is gone (opacity 0), the new one until it has settled (scale 1, x 0, opacity 1)
  const moving = (fr) => fr.sc.some((s) => (s.id === from && s.o > 0 && (s.o < 0.999 || s.s < 0.999)) || (s.id === to && (s.o < 0.999 || Math.abs(s.s - 1) > 0.001 || Math.abs(s.x) > 0.05)));
  const first = f.findIndex(moving);
  let last = -1; for (let i = f.length - 1; i >= 0; i--) if (moving(f[i])) { last = i; break; }
  const dur = first >= 0 && last >= 0 ? (f[Math.min(last + 1, f.length - 1)].t - f[first].t) / 1000 : null;
  const both = f.filter((fr) => fr.sc.filter((s) => s.o > 0.5).length > 1).length;
  const dts = []; for (let i = Math.max(1, first); i <= Math.min(f.length - 1, last + 1); i++) dts.push(f[i].t - f[i - 1].t);
  dts.sort((a, b) => a - b);
  const p95 = dts.length ? dts[Math.min(dts.length - 1, Math.floor(dts.length * 0.95))] : null;
  const sweepMax = Math.max(...f.map((fr) => fr.sw.o));
  const outEnd = f.find((fr) => fr.sc.find((s) => s.id === from).o === 0);
  const prevX = Math.min(...f.map((fr) => fr.sc.find((s) => s.id === from).x)), prevXmax = Math.max(...f.map((fr) => fr.sc.find((s) => s.id === from).x));
  return {from, to, duration_s: dur && +dur.toFixed(3), framesBothAbove50: both, frameP95_ms: p95 && +p95.toFixed(1), cls: +run.cls.toFixed(4), sweepPeak: +sweepMax.toFixed(2),
    outGone_s: outEnd && f[first] ? +((outEnd.t - f[first].t) / 1000).toFixed(3) : null, prevXRange: [+prevX.toFixed(1), +prevXmax.toFixed(1)], stage: run.stage.current};
}
const textAt = (run, id, ms) => {
  const fr = run.frames.reduce((b, fr) => (Math.abs(fr.t - ms) < Math.abs(b.t - ms) ? fr : b));
  const c = fr.txt.find((x) => x && x.id === id);
  return {block: +c.o.toFixed(2), linesMin: c.lines.length ? +Math.min(...c.lines).toFixed(2) : null, firstLine: c.lines.length ? +c.lines[0].toFixed(2) : null};
};

/* ---------------- 1) transitions + text block, 1440 × 900 light */
{
  const {context, page} = await open(1440, 900);
  await page.goto(`${BASE}/`, {waitUntil: 'load'});
  await wait(page, 2500);
  const seq = [['hook', 'website'], ['website', 'betreuung'], ['betreuung', 'website'], ['website', 'hook']];
  for (const [from, to] of seq) {
    const run = await jumpAndSample(page, `k-${to}`, 1300);
    const a = analyse(run, from, to);
    report.transitions.push(a);
    gate(a.stage === to, `stage ${from}->${to}: ${a.stage}`);
    gate(a.duration_s >= 0.6 && a.duration_s <= 0.75, `duration ${from}->${to} ${a.duration_s}`);
    gate(a.framesBothAbove50 === 0, `both visible ${from}->${to}: ${a.framesBothAbove50}`);
    gate(a.frameP95_ms <= 33.4, `p95 ${from}->${to} ${a.frameP95_ms}`);
    gate(a.cls === 0, `cls ${from}->${to} ${a.cls}`);
    const tx = {from, to, out_at_250ms: textAt(run, from, 250), in_at_300ms: textAt(run, to, 300), in_at_700ms: textAt(run, to, 700), in_at_1000ms: textAt(run, to, 1000)};
    report.text.push(tx);
    gate(tx.out_at_250ms.block < 0.05, `text out ${from}`);
    gate(tx.in_at_1000ms.block > 0.99 && (tx.in_at_1000ms.linesMin === null || tx.in_at_1000ms.linesMin > 0.99), `text in at 1.0 s ${to}`);
    gate(tx.in_at_700ms.block > 0.8 && (tx.in_at_700ms.firstLine === null || tx.in_at_700ms.firstLine > 0.8), `text with settled stage ${to}`);
    await wait(page, 4500); // the beats of a first visit
  }
  // screenshots 0.3 s and 1.0 s after a transition, per story chapter (fresh page, so first visits)
  await page.goto(`${BASE}/`, {waitUntil: 'load'});
  await wait(page, 2500);
  for (const id of ['website', 'betreuung']) {
    const y = await chapterTop(page, `k-${id}`);
    await page.evaluate((y) => window.scrollTo({top: y, behavior: 'instant'}), y);
    await wait(page, 300);
    await page.screenshot({path: path.join(OUT, `text_${id}_0.3s_1440_light.png`)});
    await wait(page, 700);
    await page.screenshot({path: path.join(OUT, `text_${id}_1.0s_1440_light.png`)});
    report.shots.push(`text_${id}_0.3s_1440_light.png`, `text_${id}_1.0s_1440_light.png`);
    await wait(page, 4500);
  }
  await context.close();
}

/* ---------------- 2) reload mid-page: the active chapter's text and scene at once, no transition.
   shared.js sets scrollRestoration 'manual' (v15: a reload starts at the top), so the restored position is
   simulated: the page is scrolled to Betreuung at DOMContentLoaded, i.e. before load, like a browser restore. */
{
  const {context, page} = await open(1440, 900);
  await context.addInitScript(() => addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById('k-betreuung');
    if (el) window.scrollTo({top: el.getBoundingClientRect().top + scrollY, behavior: 'instant'});
  }));
  await page.goto(`${BASE}/`, {waitUntil: 'load'});
  await wait(page, 400);
  const early = await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => {
    const c = window.__bdChapters.find((x) => x.id === 'betreuung');
    r({stage: window.__bdStage().current, y: scrollY, block: +getComputedStyle(c.block).opacity, lines: c.lines.map((l) => +getComputedStyle(l).opacity),
      sceneO: +getComputedStyle(document.querySelector('#stage .scene[data-scene="betreuung"]')).opacity, scale: +gsap.getProperty(document.querySelector('#stage .scene[data-scene="betreuung"]'), 'scale')});
  })));
  report.reload = early;
  gate(early.stage === 'betreuung' && early.block === 1 && Math.min(...early.lines) === 1 && early.sceneO === 1 && early.scale === 1, `reload mid-page ${JSON.stringify(early)}`);
  await context.close();
}

/* ---------------- 3) reduced motion: plain 0.2 s fade, no movement, no sweep */
{
  const {context, page} = await open(1440, 900, {reduced: true});
  await page.goto(`${BASE}/`, {waitUntil: 'load'});
  await wait(page, 1500);
  const run = await jumpAndSample(page, 'k-website', 700);
  const sc = run.frames.map((fr) => fr.sc.find((s) => s.id === 'website'));
  const fadeFrames = run.frames.filter((fr, i) => sc[i].o > 0.01 && sc[i].o < 0.99);
  const r = {stage: run.stage.current, moved: sc.some((s) => Math.abs(s.x) > 0.01 || Math.abs(s.s - 1) > 0.001), sweepPeak: Math.max(...run.frames.map((fr) => fr.sw.o)),
    fade_s: fadeFrames.length ? +((fadeFrames[fadeFrames.length - 1].t - fadeFrames[0].t) / 1000).toFixed(3) : 0,
    textHidden: run.frames[run.frames.length - 1].txt.some((t) => t && t.lines.some((o) => o < 1))};
  report.reduced = r;
  gate(r.stage === 'website' && !r.moved && r.sweepPeak === 0 && r.fade_s <= 0.25 && !r.textHidden, `reduced motion ${JSON.stringify(r)}`);
  await context.close();
}

/* ---------------- 4) team photo boxes (1440 + 390 light): identical boxes, eyes at the same height */
const EYE = {luca: 0.505, cederic: 0.535}; // pupil centres in the 960 × 960 files (measured on the files, 28.10.)
for (const [w, h, mobile] of [[1440, 900, false], [1920, 1080, false], [390, 844, true]]) {
  const {context, page} = await open(w, h, {mobile});
  await page.goto(`${BASE}/`, {waitUntil: 'load'});
  await page.evaluate(() => window.scrollTo({top: document.getElementById('ueber-uns').getBoundingClientRect().top + scrollY, behavior: 'instant'}));
  await wait(page, 2200);
  const boxes = await page.evaluate((EYE) => [...document.querySelectorAll('.card-photo')].filter((i) => i.getClientRects().length && i.offsetParent).map((img) => {
    const box = img.parentElement.getBoundingClientRect(), cs = getComputedStyle(img);
    const z = new DOMMatrix(cs.transform).a, o = cs.transformOrigin.split(' ').map(parseFloat);
    const name = /cederic/.test(img.src) ? 'cederic' : 'luca';
    const rh = Math.max(box.width / img.naturalWidth, box.height / img.naturalHeight) * img.naturalHeight; // object-fit: cover
    const offY = (box.height - rh) * 0.18; // object-position 50% 18%
    const eye = offY + EYE[name] * rh;
    const eyeOut = o[1] + (eye - o[1]) * z;
    return {name, w: +box.width.toFixed(1), h: +box.height.toFixed(1), top: +box.top.toFixed(1), zoom: +z.toFixed(3), origin: cs.transformOrigin, eyePct: +(eyeOut / box.height * 100).toFixed(1), src: img.getAttribute('src')};
  }), EYE);
  const r = {w, boxes, dSize: boxes.length === 2 ? Math.max(Math.abs(boxes[0].w - boxes[1].w), Math.abs(boxes[0].h - boxes[1].h)) : null,
    dEyePct: boxes.length === 2 ? +Math.abs(boxes[0].eyePct - boxes[1].eyePct).toFixed(1) : null};
  report.team.push(r);
  gate(r.dSize !== null && r.dSize <= 1 && r.dEyePct <= 3, `team ${w}: ${JSON.stringify(r)}`);
  const card = await page.$('#ueber-uns');
  if (w !== 1920) { await card.screenshot({path: path.join(OUT, `team_${w}_light.png`)}); report.shots.push(`team_${w}_light.png`); }
  await context.close();
}

/* ---------------- 5) screenshot set: 1440 / 1920, light / dark */
for (const [w, h] of [[1440, 900], [1920, 1080]]) for (const dark of [false, true]) {
  const theme = dark ? 'dark' : 'light';
  const {context, page} = await open(w, h, {dark});
  await page.goto(`${BASE}/`, {waitUntil: 'load'});
  await wait(page, 2600);
  const shot = async (name) => { await page.screenshot({path: path.join(OUT, `${name}_${w}_${theme}.png`)}); report.shots.push(`${name}_${w}_${theme}.png`); };
  await shot('hero');
  for (const id of ['website', 'betreuung']) {
    const y = await chapterTop(page, `k-${id}`);
    await page.evaluate((y) => window.scrollTo({top: y, behavior: 'instant'}), y);
    await wait(page, 5200); // settled + beats done
    await shot(`chapter_${id}_settled`);
  }
  // mid-frame of a transition (betreuung -> website): freeze gsap and the CSS sweep 0.30 s in
  const y = await chapterTop(page, 'k-website');
  await page.evaluate((y) => new Promise((res) => {
    window.scrollTo({top: y, behavior: 'instant'});
    setTimeout(() => { gsap.globalTimeline.pause(); document.getAnimations().forEach((a) => a.pause()); res(); }, 300);
  }), y);
  await shot('transition_mid');
  await page.evaluate(() => { gsap.globalTimeline.resume(); document.getAnimations().forEach((a) => a.play()); });
  await page.evaluate(() => window.scrollTo({top: document.getElementById('ueber-uns').getBoundingClientRect().top + scrollY, behavior: 'instant'}));
  await wait(page, 2000);
  await shot('team_section');
  await context.close();
}

/* ---------------- 6) console + network on all three pages, both modes, desktop + mobile, reduced motion */
for (const p of ['/', '/impressum', '/datenschutz']) for (const dark of [false, true]) for (const [w, h, mobile, reduced] of [[1440, 900, false, false], [390, 844, true, false], [1440, 900, false, true]]) {
  const {context, page} = await open(w, h, {dark, mobile, reduced});
  await page.goto(`${BASE}${p}`, {waitUntil: 'load'});
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += innerHeight * 0.7) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } });
  await wait(page, 600);
  await context.close();
}

/* ---------------- 7) scroll video 1440 light, about one viewport per 0.8 s */
{
  const vdir = path.join(OUT, '_video');
  const {context, page} = await open(1440, 900, {video: vdir});
  await page.goto(`${BASE}/`, {waitUntil: 'load'});
  await wait(page, 2000);
  const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  for (let y = 0; y < total; y += 300) { await page.mouse.move(700, 450); await page.mouse.wheel(0, 300); await wait(page, 267); }
  await wait(page, 1500);
  const v = page.video();
  await context.close();
  const src = await v.path();
  fs.copyFileSync(src, path.join(OUT, 'scroll_1440_light.webm'));
  fs.rmSync(vdir, {recursive: true, force: true});
  report.shots.push('scroll_1440_light.webm');
}

await browser.close();
gate(report.errors.length === 0, `errors: ${report.errors.length}`);
gate(report.foreign.length === 0, `foreign requests: ${report.foreign.length}`);
report.fails = fails;
fs.writeFileSync(path.join(ANA, 'v17-gates.json'), JSON.stringify(report, (k, v) => (k === 'frames' ? undefined : v), 2));
for (const t of report.transitions) console.log(`transition ${t.from} -> ${t.to}: ${t.duration_s} s, out gone ${t.outGone_s} s, both>50% ${t.framesBothAbove50}, p95 ${t.frameP95_ms} ms, CLS ${t.cls}, sweep peak ${t.sweepPeak}, prev x ${t.prevXRange}`);
for (const t of report.text) console.log(`text ${t.from} -> ${t.to}: out@0.25 ${JSON.stringify(t.out_at_250ms)} in@0.3 ${JSON.stringify(t.in_at_300ms)} in@0.7 ${JSON.stringify(t.in_at_700ms)} in@1.0 ${JSON.stringify(t.in_at_1000ms)}`);
console.log('reload', JSON.stringify(report.reload));
console.log('reduced', JSON.stringify(report.reduced));
for (const t of report.team) console.log(`team ${t.w}: ${t.boxes.map((b) => `${b.name} ${b.w}x${b.h} zoom ${b.zoom} origin ${b.origin} eyes ${b.eyePct}%`).join(' | ')} dSize ${t.dSize} dEye ${t.dEyePct}`);
console.log(`errors ${report.errors.length}, foreign ${report.foreign.length}, shots ${report.shots.length}`);
report.errors.slice(0, 10).forEach((e) => console.log('  ' + e));
console.log(fails.length ? `FAIL\n  ${fails.join('\n  ')}` : 'PASS');
process.exit(fails.length ? 1 : 0);
