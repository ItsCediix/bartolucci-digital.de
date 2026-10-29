#!/usr/bin/env node
// QA v18 (audit of 28.10.): screenshots and gates for the audit measures. Needs `npx serve public -l 4173`.
//   node scripts/qa-v18.mjs [--base http://localhost:4173] [--out review_v18]
//  - 1440, 1920, 390, iPad portrait (768 × 1024, touch) and landscape (1024 × 768, touch), light and dark: hero and
//    full page after a scroll-through; 0 console errors, 0 page errors, 0 third-party requests (gate)
//  - JavaScript disabled (same viewports): every chapter and section heading visible and in document order (M1)
//  - M14: iPad portrait -> mobile, landscape -> desktop; a 390 -> 1024 resize reloads into desktop, 1024 -> 390 into mobile
//  - M7: title ≤ 62 chars with "Webdesign Hamburg", description ≤ 155 chars with Festpreis + Cookies/Tracking
//  - M12: hero buttons "Erstgespräch anfragen" / "Beispiel ansehen", header "Kontakt", no "Formular" sentence
//  - M4: "Platz anfragen" and the mobile "Schreib uns" are mailto links with subject + body; copy button fills the clipboard
//  - M10: phone icon in the mobile header (tel:), absent on desktop
//  - M17: footer links /impressum and /datenschutz answer 200 without redirect; 404.html is noindex with home/tel/mailto
//  - no em dash in the texts changed for v18 (title, description, CTA labels, 404, JSON-LD, mailto)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(ROOT, 'public');
const args = process.argv.slice(2);
const opt = (n, def) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : def; };
const BASE = opt('base', 'http://localhost:4173');
const OUT = path.resolve(ROOT, opt('out', 'review_v18'));
fs.mkdirSync(OUT, {recursive: true});
const company = JSON.parse(fs.readFileSync(path.join(PUB, 'data', 'company.json'), 'utf8'));
const gate = {};
const errors = [];
const foreign = [];
const browser = await chromium.launch();

const VIEWPORTS = [
  ['1440', {width: 1440, height: 900}, {}],
  ['1920', {width: 1920, height: 1080}, {}],
  ['390', {width: 390, height: 844}, {isMobile: true, hasTouch: true}],
  ['ipad-portrait', {width: 768, height: 1024}, {isMobile: true, hasTouch: true}],
  ['ipad-landscape', {width: 1024, height: 768}, {isMobile: true, hasTouch: true}],
];
async function open(viewport, extra, {dark = false, js = true} = {}) {
  const context = await browser.newContext({viewport, deviceScaleFactor: 1, javaScriptEnabled: js, ...extra});
  if (dark) await context.addInitScript(() => { try { localStorage.setItem('bd-theme', 'dark'); } catch (e) { /* ignore */ } });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push({viewport: viewport.width, text: String(e)}));
  page.on('console', (m) => { if (m.type() === 'error') errors.push({viewport: viewport.width, text: m.text()}); });
  page.on('request', (r) => { if (!r.url().startsWith(BASE)) foreign.push(r.url()); });
  return {context, page};
}

// ---------------------------------------------------------------- 1. screenshots light + dark, 5 viewports
gate.shots = [];
for (const [name, vp, extra] of VIEWPORTS) {
  for (const dark of [false, true]) {
    const {context, page} = await open(vp, extra, {dark});
    await page.goto(`${BASE}/`, {waitUntil: 'load'});
    await page.waitForTimeout(1500);
    const mode = await page.evaluate(() => document.documentElement.getAttribute('data-mode'));
    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    await page.screenshot({path: path.join(OUT, `hero_${name}_${dark ? 'dark' : 'light'}.png`)});
    // scroll through in viewport steps so every play-once reveal has fired, then the full page
    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < total; y += Math.round(vp.height * 0.8)) { await page.evaluate((yy) => window.scrollTo(0, yy), y); await page.waitForTimeout(350); }
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(1200);
    await page.screenshot({path: path.join(OUT, `full_${name}_${dark ? 'dark' : 'light'}.png`), fullPage: true});
    gate.shots.push({name, dark, mode, theme});
    await context.close();
  }
}

// ---------------------------------------------------------------- 2. JavaScript off: order + visibility
const headings = () => {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    let o = 1;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const cs = getComputedStyle(e); o *= +cs.opacity; if (cs.display === 'none' || cs.visibility === 'hidden') return false; }
    return o > 0.5 && r.width > 0 && r.height > 0;
  };
  const hs = Array.from(document.querySelectorAll('main h1, main h2')).filter((h) => !h.closest('.stage'));
  let last = -1, ordered = true;
  const items = hs.map((h) => { const t = h.getBoundingClientRect().top + scrollY; if (t < last) ordered = false; last = t; return {text: h.textContent.trim().slice(0, 30), visible: vis(h)}; });
  return {items, ordered, allVisible: items.every((i) => i.visible), count: items.length};
};
gate.nojs = {};
for (const [name, vp, extra] of VIEWPORTS) {
  const {context, page} = await open(vp, extra, {js: false});
  await page.goto(`${BASE}/`, {waitUntil: 'load'});
  const r = await page.evaluate(headings);
  await page.screenshot({path: path.join(OUT, `nojs_${name}.png`), fullPage: true});
  gate.nojs[name] = {...r, pass: r.ordered && r.allVisible && r.count === 8};
  await context.close();
}

// ---------------------------------------------------------------- 3. M14: mode by device, reload on resize/rotation
gate.m14 = {};
{
  const modeOf = async (vp, extra) => { const {context, page} = await open(vp, extra); await page.goto(`${BASE}/`, {waitUntil: 'load'}); const m = await page.evaluate(() => document.documentElement.getAttribute('data-mode')); await context.close(); return m; };
  gate.m14.ipadPortrait = await modeOf({width: 768, height: 1024}, {isMobile: true, hasTouch: true});
  gate.m14.ipadLandscape = await modeOf({width: 1024, height: 768}, {isMobile: true, hasTouch: true});
  const resize = async (from, to, extra) => {
    const {context, page} = await open(from, extra);
    await page.goto(`${BASE}/`, {waitUntil: 'load'});
    const before = await page.evaluate(() => document.documentElement.getAttribute('data-mode'));
    await page.evaluate(() => { window.__v18marker = true; });
    const nav = page.waitForNavigation({waitUntil: 'load', timeout: 5000}).then(() => true).catch(() => false);
    await page.setViewportSize(to);
    const reloaded = await nav;
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => ({mode: document.documentElement.getAttribute('data-mode'), marker: !!window.__v18marker}));
    await context.close();
    return {before, reloaded, after: after.mode, sameDocument: after.marker};
  };
  gate.m14.rotateToLandscape = await resize({width: 768, height: 1024}, {width: 1024, height: 768}, {isMobile: true, hasTouch: true});
  gate.m14.rotateToPortrait = await resize({width: 1024, height: 768}, {width: 768, height: 1024}, {isMobile: true, hasTouch: true});
  gate.m14.grow390to1024 = await resize({width: 390, height: 844}, {width: 1024, height: 768}, {});
  gate.m14.shrink1024to390 = await resize({width: 1024, height: 768}, {width: 390, height: 844}, {});
  // a resize that keeps the mode (desktop 1440 -> 1200) must not reload
  gate.m14.sameMode = await resize({width: 1440, height: 900}, {width: 1200, height: 800}, {});
  gate.m14.pass = gate.m14.ipadPortrait === 'mobile' && gate.m14.ipadLandscape === 'desktop' &&
    gate.m14.rotateToLandscape.reloaded && gate.m14.rotateToLandscape.after === 'desktop' && !gate.m14.rotateToLandscape.sameDocument &&
    gate.m14.rotateToPortrait.reloaded && gate.m14.rotateToPortrait.after === 'mobile' &&
    gate.m14.grow390to1024.reloaded && gate.m14.grow390to1024.after === 'desktop' &&
    gate.m14.shrink1024to390.reloaded && gate.m14.shrink1024to390.after === 'mobile' &&
    !gate.m14.sameMode.reloaded && gate.m14.sameMode.sameDocument;
}

// ---------------------------------------------------------------- 4. texts: M7, M12, M4, M10, M17, em dashes
{
  const html = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
  const title = (/<title>([^<]*)<\/title>/.exec(html) || [])[1] || '';
  const desc = (/<meta name="description" content="([^"]*)"/.exec(html) || [])[1] || '';
  const og = (/<meta property="og:title" content="([^"]*)"/.exec(html) || [])[1] || '';
  const tw = (/<meta name="twitter:title" content="([^"]*)"/.exec(html) || [])[1] || '';
  gate.m7 = {title, titleLength: title.length, desc, descLength: desc.length, og, tw,
    pass: title.length <= 62 && /Webdesign Hamburg/.test(title) && /Festpreis/.test(title) && desc.length <= 155 && /Webdesign Hamburg/.test(desc) && /Festpreis/.test(desc) && /(kein Tracking|keine Cookies)/.test(desc) && og === title && tw === title};

  const {context, page} = await open({width: 1440, height: 900}, {});
  await page.goto(`${BASE}/`, {waitUntil: 'load'});
  await page.waitForTimeout(800);
  const t = await page.evaluate(() => ({
    hero: Array.from(document.querySelectorAll('#k-hook .cta-row a')).map((a) => a.textContent.trim() + ' -> ' + a.getAttribute('href')),
    header: document.querySelector('.header-cta') && document.querySelector('.header-cta').textContent.trim(),
    formular: (document.body.innerText.match(/Formular/g) || []).length,
    websiteCopy: Array.from(document.querySelectorAll('#k-website .body p')).map((p) => p.textContent),
    platz: (() => { const a = document.querySelector('#preise .price a.btn'); return a && {text: a.textContent.trim(), href: a.getAttribute('href')}; })(),
    // v18.1: no address line in the price card any more; copy icons inside both contact lines
    copyBtns: Array.from(document.querySelectorAll('#kontakt .contact-line [data-copy]')).map((b) => b.getAttribute('data-copy')),
    headerTelDesktop: (() => { const a = document.querySelector('.header-tel'); return a ? getComputedStyle(a).display : 'absent'; })(),
    footer: Array.from(document.querySelectorAll('.site-footer nav a')).map((a) => a.getAttribute('href')),
  }));
  await context.close();
  const mailtoOk = (href) => !!href && href.startsWith('mailto:' + company.email + '?') && /subject=Platz%20anfragen/.test(href) && /body=/.test(href) && /Betrieb/.test(decodeURIComponent(href)) && /Wunschtermin/.test(decodeURIComponent(href)) && !/—/.test(decodeURIComponent(href));
  gate.m12 = {...t, pass: t.hero.join('|') === 'Erstgespräch anfragen -> #kontakt|Beispiel ansehen -> #k-website' && t.header === 'Kontakt' && t.formular === 1 && t.websiteCopy.some((p) => /Wer uns schreibt, bekommt meistens am selben Tag eine Antwort\./.test(p)) && !t.websiteCopy.some((p) => /Formular abschickt/.test(p))};
  gate.m4 = {platz: t.platz, copyBtns: t.copyBtns, pass: !!t.platz && t.platz.text === 'Platz anfragen' && mailtoOk(t.platz.href) && t.copyBtns.join('|') === company.email + '|' + company.phone.display};
  gate.m10 = {desktop: t.headerTelDesktop};
  gate.m17 = {footer: t.footer};

  // copy button on desktop: clipboard permission granted, click, read back
  {
    const context = await browser.newContext({viewport: {width: 1440, height: 900}, permissions: ['clipboard-read', 'clipboard-write']});
    const page = await context.newPage();
    await page.goto(`${BASE}/`, {waitUntil: 'load'});
    await page.evaluate(() => document.getElementById('kontakt').scrollIntoView());
    await page.waitForTimeout(1500);
    const btn = page.locator('#kontakt [data-copy]').first();
    const label0 = await btn.getAttribute('aria-label');
    await btn.click();
    await page.waitForTimeout(200);
    const label1 = await btn.getAttribute('aria-label');
    const clip = await page.evaluate(() => navigator.clipboard.readText()).catch((e) => 'ERR ' + e.message);
    await page.waitForTimeout(2200);
    const label2 = await btn.getAttribute('aria-label');
    await page.screenshot({path: path.join(OUT, 'm4_copy_1440_light.png')});
    gate.m4.copy = {label0: label0.trim(), label1: label1.trim(), clipboard: clip, label2: label2.trim()};
    gate.m4.pass = gate.m4.pass && clip === company.email && label1.trim() !== label0.trim() && label2.trim() === label0.trim();
    await context.close();
  }
  // mobile: sticky CTA mailto, phone icon in the header
  {
    const {context, page} = await open({width: 390, height: 844}, {isMobile: true, hasTouch: true});
    await page.goto(`${BASE}/`, {waitUntil: 'load'});
    await page.waitForTimeout(800);
    const m = await page.evaluate(() => {
      const tel = document.querySelector('.header-tel');
      const r = tel && tel.getBoundingClientRect();
      const cta = document.querySelector('.m-cta');
      return {tel: tel && {href: tel.getAttribute('href'), label: tel.getAttribute('aria-label'), display: getComputedStyle(tel).display, w: r && Math.round(r.width), h: r && Math.round(r.height), inHeader: !!tel.closest('.site-header')},
        cta: cta && {text: cta.textContent.trim(), href: cta.getAttribute('href')}, h1First: (() => { const h1 = document.querySelector('h1'); const st = document.querySelector('.m-card .m-stage'); return !!h1 && !!st && h1.compareDocumentPosition(st) & Node.DOCUMENT_POSITION_FOLLOWING ? 'h1 before stage' : 'stage before h1'; })()};
    });
    await page.screenshot({path: path.join(OUT, 'm10_header_390_light.png')});
    await context.close();
    gate.m10 = {...gate.m10, mobile: m.tel, h1Order: m.h1First, pass: !!m.tel && m.tel.href === 'tel:' + company.phone.e164 && m.tel.display !== 'none' && m.tel.w >= 36 && m.tel.h >= 36 && m.tel.inHeader && gate.m10.desktop === 'none'};
    gate.m4.mobileCta = m.cta;
    gate.m4.pass = gate.m4.pass && !!m.cta && m.cta.text === 'Schreib uns' && mailtoOk(m.cta.href);
  }
  // M17: footer links, 404
  const status = async (p) => { try { const r = await fetch(`${BASE}${p}`, {redirect: 'manual'}); return r.status; } catch (e) { return String(e); } };
  const nf = fs.readFileSync(path.join(PUB, '404.html'), 'utf8');
  gate.m17 = {...gate.m17, impressum: await status('/impressum'), datenschutz: await status('/datenschutz'), notFoundPage: {noindex: /name="robots" content="noindex"/.test(nf), home: /href="\/"/.test(nf), tel: nf.includes('tel:' + company.phone.e164), mail: nf.includes('mailto:' + company.email), form: /<form/.test(nf)},
    wrangler: /"not_found_handling":\s*"404-page"/.test(fs.readFileSync(path.join(ROOT, 'wrangler.jsonc'), 'utf8'))};
  gate.m17.pass = gate.m17.footer.join('|') === '/impressum|/datenschutz' && gate.m17.impressum === 200 && gate.m17.datenschutz === 200 && gate.m17.notFoundPage.noindex && gate.m17.notFoundPage.home && gate.m17.notFoundPage.tel && gate.m17.notFoundPage.mail && !gate.m17.notFoundPage.form && gate.m17.wrangler;
  // em dashes in the new texts (title, description, hero CTAs, 404, JSON-LD, mailto, copy line)
  const ld = (/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html) || [])[1] || '';
  const newTexts = [title, desc, ...t.hero, nf.replace(/<[^>]+>/g, ' '), ld, decodeURIComponent(t.platz ? t.platz.href : ''), t.mailText || ''];
  gate.emDash = {hits: newTexts.filter((s) => /—/.test(s)).length, pass: !newTexts.some((s) => /—/.test(s))};
}
await browser.close();

gate.errors = {console: errors, foreign: [...new Set(foreign)], pass: !errors.length && !foreign.length};
const pass = Object.values(gate.nojs).every((g) => g.pass) && ['m14', 'm7', 'm12', 'm4', 'm10', 'm17', 'emDash', 'errors'].every((k) => gate[k].pass);
fs.writeFileSync(path.join(OUT, 'v18-qa.json'), JSON.stringify(gate, null, 2));
for (const k of ['m7', 'm12', 'm4', 'm10', 'm17', 'm14', 'emDash', 'errors']) console.log(k, gate[k].pass ? 'PASS' : 'FAIL', JSON.stringify(gate[k]).slice(0, 700));
for (const k of Object.keys(gate.nojs)) console.log('nojs', k, gate.nojs[k].pass ? 'PASS' : 'FAIL', gate.nojs[k].count, gate.nojs[k].ordered, gate.nojs[k].allVisible);
console.log('shots', gate.shots.map((s) => `${s.name}/${s.theme}=${s.mode}`).join(' '));
console.log(pass ? 'PASS qa-v18' : 'FAIL qa-v18');
if (!pass) process.exitCode = 1;
