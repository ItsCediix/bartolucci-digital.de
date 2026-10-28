#!/usr/bin/env node
// QA v18 (audit M1): the start page is static HTML.
//  1. raw HTML (fetched, no JavaScript): H1, every H2 of the page, the prices (995 €, 1.990 €, 49 €, 79 €), the phone
//     number and the e-mail address are in the response body; no <template>, no static-copy block, no site-data.js
//  2. Playwright with JavaScript disabled, desktop 1440 and mobile 390: every chapter heading and section heading is
//     visible (opacity > 0, in the layout) and in document order; prices and contact lines readable
//  3. Playwright with JavaScript enabled: no request for /data/*, the deferred scripts enhance the static DOM
//     (stage scenes present, chapters still the static sections / cards, no duplicate ids)
// Needs `npx serve public -l 4173` running.   node scripts/qa-static.mjs [--base …] [--out review]
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
const company = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'company.json'), 'utf8'));
const offer = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'offer.json'), 'utf8'));
const nb = (s) => s.replace(/ /g, ' ');
const gate = {};

// 1. raw HTML
const raw = await (await fetch(`${BASE}/`)).text();
const h2s = [...raw.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => nb(m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()));
const h1 = (/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(raw) || [])[1];
const body = raw.slice(raw.indexOf('<body'));
const must = {
  h1: !!h1 && body.includes(h1),
  h2count: h2s.length,
  launchPrice: nb(body).includes(offer.launchPrice.toLocaleString('de-DE') + ' €'),
  regularPrice: nb(body).includes(offer.regularPrice.toLocaleString('de-DE') + ' €'),
  carePrice: nb(body).includes(offer.carePrice + ' €'),
  roundPrice: nb(body).includes(offer.roundPrice + ' €'),
  phoneDisplay: nb(body).includes(company.phone.display),
  phoneHref: body.includes('tel:' + company.phone.e164),
  email: body.includes(company.email),
  noTemplate: !/<template\b/.test(raw),
  noStaticCopy: !raw.includes('static-copy'),
  noSiteData: !raw.includes('site-data.js'),
  jsonLdTelephone: raw.includes('"telephone"'),
};
gate.raw = {...must, h2s, pass: must.h1 && must.h2count >= 7 && must.launchPrice && must.regularPrice && must.carePrice && must.roundPrice && must.phoneDisplay && must.phoneHref && must.email && must.noTemplate && must.noStaticCopy && must.noSiteData};

// 2. JavaScript off
const browser = await chromium.launch();
const headingsVisible = () => {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    let o = 1;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const cs = getComputedStyle(e); o *= +cs.opacity; if (cs.display === 'none' || cs.visibility === 'hidden') return false; }
    return o > 0.5 && r.width > 0 && r.height > 0;
  };
  const hs = Array.from(document.querySelectorAll('main h1, main h2')).filter((h) => !h.closest('.stage'));
  let lastTop = -1, ordered = true;
  const items = hs.map((h) => { const top = h.getBoundingClientRect().top + scrollY; if (top < lastTop) ordered = false; lastTop = top; return {text: h.textContent.trim(), top: Math.round(top), visible: vis(h)}; });
  const price = document.querySelector('.price-now'), mail = document.querySelector('[data-contact] a[href^="mailto:"]'), tel = document.querySelector('[data-contact] a[href^="tel:"]');
  return {items, ordered, allVisible: items.every((i) => i.visible), priceVisible: !!price && vis(price), mailVisible: !!mail && vis(mail), telVisible: !!tel && vis(tel), mode: document.documentElement.getAttribute('data-mode'), js: document.documentElement.classList.contains('js')};
};
gate.nojs = {};
for (const [name, w, h, touch] of [['desktop', 1440, 900, false], ['mobile', 390, 844, true]]) {
  const ctx = await browser.newContext({viewport: {width: w, height: h}, javaScriptEnabled: false, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1});
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, {waitUntil: 'load'});
  const r = await page.evaluate(headingsVisible);
  await page.screenshot({path: path.join(OUT, `static_nojs_${name}.png`), fullPage: true});
  gate.nojs[name] = {...r, pass: r.ordered && r.allVisible && r.items.length >= 8 && r.priceVisible && r.mailVisible && r.telVisible && !r.js};
  await ctx.close();
}

// 3. JavaScript on: no /data request, static DOM enhanced in place
gate.js = {};
for (const [name, w, h, touch] of [['desktop', 1440, 900, false], ['mobile', 390, 844, true]]) {
  const ctx = await browser.newContext({viewport: {width: w, height: h}, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1});
  const page = await ctx.newPage();
  const reqs = [];
  page.on('request', (q) => reqs.push(q.url().replace(BASE, '')));
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${BASE}/`, {waitUntil: 'load'});
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const ids = Array.from(document.querySelectorAll('[id]')).map((e) => e.id);
    const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
    const mode = document.documentElement.getAttribute('data-mode');
    return {
      mode, dupIds: dup, h1: document.querySelectorAll('h1').length,
      chapters: Array.from(document.querySelectorAll(mode === 'mobile' ? '.m-card[data-chapter]' : '.chapter[data-chapter]')).map((e) => e.getAttribute('data-chapter')),
      scenes: document.querySelectorAll(mode === 'mobile' ? '.m-stage .scene' : '#stage .scene').length,
      heroVisible: +getComputedStyle(document.querySelector('#k-hook h1')).opacity === 1,
      priceText: document.querySelector('.price-now') && document.querySelector('.price-now').textContent,
      contactLines: document.querySelectorAll('[data-contact] .contact-line').length,
    };
  });
  await ctx.close();
  const dataReq = reqs.filter((u) => u.startsWith('/data/'));
  gate.js[name] = {...r, dataRequests: dataReq, errors, pass: !dup(r) && r.h1 === 1 && r.chapters.join() === 'hook,website,betreuung' && r.scenes === 3 && r.heroVisible && !!r.priceText && r.contactLines === 2 && !dataReq.length && !errors.length};
}
function dup(r) { return r.dupIds.length > 0; }
await browser.close();

const pass = gate.raw.pass && Object.values(gate.nojs).every((g) => g.pass) && Object.values(gate.js).every((g) => g.pass);
fs.writeFileSync(path.join(OUT, 'static-qa.json'), JSON.stringify(gate, null, 2));
console.log('raw', JSON.stringify({...gate.raw, h2s: gate.raw.h2s.length}));
for (const k of Object.keys(gate.nojs)) console.log('nojs', k, JSON.stringify({...gate.nojs[k], items: gate.nojs[k].items.map((i) => (i.visible ? '' : '!') + i.text.slice(0, 24))}));
for (const k of Object.keys(gate.js)) console.log('js', k, JSON.stringify(gate.js[k]));
console.log(pass ? 'PASS qa-static' : 'FAIL qa-static');
if (!pass) process.exitCode = 1;
