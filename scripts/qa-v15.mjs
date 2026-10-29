#!/usr/bin/env node
// QA v15: the background colour fields must be visible. For every field and viewport it samples the screen with
// and without #bg (same scroll position) and reports the mean sRGB distance field-vs-paper, measured only on
// 32 px patches where nothing but paper is underneath (no text, no stage). Also lists every element above #bg
// that paints an opaque background at the field centre, and the contrast of H1 / lead on the sampled background.
//  - review_2026-10-27_v15/bg_<w>_<light|dark>.png (+ _preise), v15-bg.json; exit 1 when a gate fails
//  - gate: light mode mean distance ≥ 14 for every field that is on screen; text contrast ≥ 4.5
//   node scripts/qa-v15.mjs [--base http://localhost:4173] [--out ../review_2026-10-27_v15] [--tag local] [--no-gate]
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, def) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : def; };
const BASE = opt('base', 'http://localhost:4173');
const OUT = path.resolve(ROOT, opt('out', '../review_2026-10-27_v15'));
const TAG = opt('tag', 'local');
const NO_GATE = args.includes('--no-gate');
fs.mkdirSync(OUT, {recursive: true});

const VIEWS = [
  {w: 1440, h: 900, mobile: false},
  {w: 390, h: 844, mobile: true},
];
const report = {base: BASE, tag: TAG, runs: [], errors: []};
let fail = false;
const browser = await chromium.launch();

const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const parseRgb = (s) => s.match(/[\d.]+/g).slice(0, 3).map(Number);

async function raw(page) {
  const buf = await page.screenshot();
  const {data, info} = await sharp(buf).removeAlpha().raw().toBuffer({resolveWithObject: true});
  return {data, w: info.width, h: info.height, buf};
}
const px = (img, x, y) => { const i = (y * img.w + x) * 3; return [img.data[i], img.data[i + 1], img.data[i + 2]]; };
const patchMean = (img, x0, y0, s) => {
  const m = [0, 0, 0]; let n = 0;
  for (let y = y0; y < y0 + s; y += 2) for (let x = x0; x < x0 + s; x += 2) { const p = px(img, x, y); m[0] += p[0]; m[1] += p[1]; m[2] += p[2]; n++; }
  return m.map((v) => v / n);
};
const patchFlat = (img, x0, y0, s, ref) => {
  for (let y = y0; y < y0 + s; y += 2) for (let x = x0; x < x0 + s; x += 2) { const p = px(img, x, y); if (Math.abs(p[0] - ref[0]) + Math.abs(p[1] - ref[1]) + Math.abs(p[2] - ref[2]) > 9) return false; }
  return true;
};
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

async function measure(page, label) {
  const info = await page.evaluate(() => {
    const bg = document.getElementById('bg');
    const fields = [...document.querySelectorAll('#bg .f')].map((f) => {
      const r = f.getBoundingClientRect();
      const cs = getComputedStyle(f);
      // the solid core of a field: the inner 50 % of its box (the gradient is ≥ 55 % strength there)
      const core = {x0: r.left + r.width * 0.25, y0: r.top + r.height * 0.25, x1: r.right - r.width * 0.25, y1: r.bottom - r.height * 0.25};
      const cx = Math.min(Math.max((core.x0 + core.x1) / 2, 2), innerWidth - 2), cy = Math.min(Math.max((core.y0 + core.y1) / 2, 2), innerHeight - 2);
      // opaque painters above #bg at the field centre
      const above = [];
      for (const el of document.elementsFromPoint(cx, cy)) {
        if (el === bg || bg.contains(el)) break;
        const s = getComputedStyle(el);
        const a = s.backgroundColor.match(/[\d.]+/g);
        const alpha = a ? (a.length > 3 ? +a[3] : 1) : 0;
        if (alpha > 0.5 || s.backgroundImage !== 'none') above.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${[...el.classList].join('.')} bg=${s.backgroundColor}`);
      }
      return {cls: f.className.replace(/^f /, ''), box: [r.left, r.top, r.width, r.height].map(Math.round), core, color: cs.getPropertyValue('--c').trim(), opacity: cs.opacity, above};
    });
    const chain = []; for (let e = bg.parentElement; e; e = e.parentElement) { const s = getComputedStyle(e); chain.push({el: e.tagName, bg: s.backgroundColor, opacity: s.opacity, filter: s.filter, isolation: s.isolation, z: s.zIndex, pos: s.position}); }
    const paper = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    const t = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return {sel, color: getComputedStyle(el).color, box: [r.left, r.top, r.width, r.height].map(Math.round)}; };
    return {fields, bgStyle: (() => { const s = getComputedStyle(bg); return {z: s.zIndex, pos: s.position, opacity: s.opacity}; })(), chain, paper, mode: document.documentElement.dataset.mode, texts: [t('h1'), t('[data-chapter="hook"] .lead'), t('#preise-h'), t('#preise .price-copy .lead'), t('.price-note'), t('#k-betreuung h2')]};
  });
  const withBg = await raw(page);
  await page.addStyleTag({content: '#bg { visibility: hidden !important; }'}).then((h) => h.evaluate((n) => { n.id = 'qa-hide'; }));
  await page.waitForTimeout(120);
  const noBg = await raw(page);
  await page.evaluate(() => document.getElementById('qa-hide').remove());
  await page.waitForTimeout(120);
  // the paper: html's background (v15) or body's (main, propagated to the canvas)
  const paperRgb = parseRgb(await page.evaluate(() => { const h = getComputedStyle(document.documentElement).backgroundColor; return /, 0\)$/.test(h) || h === 'transparent' ? getComputedStyle(document.body).backgroundColor : h; }));
  const S = 32;
  const fields = info.fields.map((f) => {
    const x0 = Math.max(0, Math.round(f.core.x0)), y0 = Math.max(0, Math.round(f.core.y0));
    const x1 = Math.min(withBg.w - S, Math.round(f.core.x1)), y1 = Math.min(withBg.h - S, Math.round(f.core.y1));
    const ds = []; let best = null;
    for (let y = y0; y <= y1; y += S) for (let x = x0; x <= x1; x += S) {
      const ref = patchMean(noBg, x, y, S);
      // only plain paper underneath: flat and the paper colour (not inside a card, stage or header)
      if (!patchFlat(noBg, x, y, S, ref) || dist(ref, paperRgb) > 3) continue;
      const d = dist(patchMean(withBg, x, y, S), ref);
      ds.push(d); if (!best || d > best.d) best = {x, y, d: +d.toFixed(1)};
    }
    const onScreen = x1 > x0 && y1 > y0;
    const mean = ds.length ? +(ds.reduce((a, b) => a + b, 0) / ds.length).toFixed(1) : null;
    return {field: f.cls, color: f.color, box: f.box, onScreen, patches: ds.length, mean, max: best?.d ?? null, above: f.above};
  });
  // contrast of the text against the background sampled right next to it (left edge of its box, inside the line gap)
  const texts = info.texts.filter(Boolean).map((t) => {
    const x = Math.min(Math.max(t.box[0] - 6, 0), withBg.w - 1), y = Math.min(Math.max(t.box[1] + 4, 0), withBg.h - 1);
    if (t.box[1] < 0 || t.box[1] > withBg.h) return {sel: t.sel, offscreen: true};
    const bgc = px(withBg, x, y);
    return {sel: t.sel, ink: t.color, bg: bgc, contrast: +contrast(parseRgb(t.color), bgc).toFixed(2)};
  });
  fs.writeFileSync(path.join(OUT, `${label}.png`), withBg.buf);
  return {label, mode: info.mode, paper: info.paper, paperRgb, bgStyle: info.bgStyle, chain: info.chain, fields, texts};
}

for (const v of VIEWS) for (const dark of [false, true]) {
  const context = await browser.newContext({viewport: {width: v.w, height: v.h}, deviceScaleFactor: 1, isMobile: v.mobile, hasTouch: v.mobile});
  if (dark) await context.addInitScript(() => { try { localStorage.setItem('bd-theme', 'dark'); } catch (e) { /* ignore */ } });
  await context.addInitScript(() => { try { sessionStorage.clear(); } catch (e) { /* ignore */ } });
  const page = await context.newPage();
  page.on('pageerror', (e) => report.errors.push(`${v.w}${dark ? ' dark' : ''}: ${e}`));
  await page.goto(`${BASE}/`, {waitUntil: 'load'});
  await page.waitForTimeout(2200);
  const theme = dark ? 'dark' : 'light';
  const top = await measure(page, `bg_${TAG}_${v.w}_${theme}`);
  // further positions: the sand field (Betreuung) and the price card
  const at = async (id, name) => {
    await page.evaluate((s) => { const el = document.getElementById(s); window.scrollTo({top: el.getBoundingClientRect().top + scrollY - 72, behavior: 'instant'}); }, id);
    await page.waitForTimeout(2600);
    return measure(page, `bg_${TAG}_${v.w}_${theme}_${name}`);
  };
  const betreuung = await at('k-betreuung', 'betreuung');
  const preise = await at('preise', 'preise');
  for (const r of [top, betreuung, preise]) {
    // v16/v17 markup: #bg .f1..f4 (v15.1 renamed .bg-f); blue fields (f1, f3) need ≥ 14 wherever ≥ 4 clean patches of them are on screen; sand is reported only
    const shown = r.fields.filter((f) => f.onScreen && f.patches >= 4);
    const blue = shown.filter((f) => f.field === 'f1' || f.field === 'f3');
    r.gate = {
      fieldsOnScreen: shown.map((f) => `${f.field}:${f.mean}`),
      blueMin: blue.length ? Math.min(...blue.map((f) => f.mean)) : null,
      textContrastOk: r.texts.every((t) => t.offscreen || t.contrast >= 4.5),
    };
    const sandView = r.label.endsWith('_betreuung');
    r.gate.pass = (dark || TAG === 'live' || (sandView ? r.gate.blueMin === null || r.gate.blueMin >= 14 : blue.length > 0 && r.gate.blueMin >= 14)) && r.gate.textContrastOk;
    if (!r.gate.pass) fail = true;
    report.runs.push(r);
  }
  await context.close();
}
// contact line at 360 / 390 (mobile) and 1440: one line, not cut, 15 px on mobile, "E‑Mail" with U+2011
report.contact = [];
for (const [w, h, mobile] of [[360, 780, true], [390, 844, true], [1440, 900, false]]) {
  if (TAG === 'live') break;
  const context = await browser.newContext({viewport: {width: w, height: h}, isMobile: mobile, hasTouch: mobile});
  const page = await context.newPage();
  await page.goto(`${BASE}/`, {waitUntil: 'load'});
  await page.evaluate(() => document.getElementById('kontakt').scrollIntoView());
  await page.waitForTimeout(1500);
  const c = await page.evaluate(() => {
    const a = document.querySelector('#kontakt .contact-line a'), v = a.querySelector('.contact-val'), s = getComputedStyle(v);
    return {text: v.textContent, href: a.getAttribute('href'), title: a.title, hint: a.querySelector('.small').textContent,
      oneLine: v.getBoundingClientRect().height < parseFloat(s.lineHeight || '0') * 1.5 || v.getBoundingClientRect().height < 30,
      cut: v.scrollWidth > v.clientWidth + 1, fontSize: s.fontSize, lineInView: a.getBoundingClientRect().right <= innerWidth};
  });
  c.w = w;
  c.pass = c.oneLine && !c.cut && c.lineInView && c.hint === 'E‑Mail' && c.href === 'mailto:info@bartolucci-digital.de' && (!mobile || c.fontSize === '15px');
  if (!c.pass) fail = true;
  report.contact.push(c);
  await page.screenshot({path: path.join(OUT, `kontakt_${w}.png`)});
  await context.close();
}
await browser.close();
for (const c of report.contact) console.log(`contact ${c.w}: "${c.text}" ${c.fontSize} oneLine=${c.oneLine} cut=${c.cut} hint=${JSON.stringify(c.hint)} ${c.pass ? 'PASS' : 'FAIL'}`);
fs.writeFileSync(path.join(OUT, `v15-bg-${TAG}.json`), JSON.stringify(report, null, 2));
for (const r of report.runs) {
  console.log(`${r.label.padEnd(34)} ${r.mode.padEnd(7)} ${r.fields.map((f) => `${f.field}=${f.mean ?? '-'}/${f.max ?? '-'}[${f.patches}]`).join('  ')}  contrast=${r.texts.map((t) => t.contrast ?? '-').join('/')} ${r.gate.pass ? 'PASS' : 'FAIL'}`);
}
if (report.errors.length) console.log('page errors:', report.errors);
console.log(fail ? 'v15 background gate: FAIL' : 'v15 background gate: PASS');
process.exit(fail && !NO_GATE ? 1 : 0);
