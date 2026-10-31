#!/usr/bin/env node
// QA v19 (31.10.): hero wording, "Beispielprojekt" label, jump-link navigation. Needs a server that sends the CSP from
// public/_headers (a blocked inline script must show up as a console error): node scripts/serve-headers.mjs --port 4174
//   node scripts/qa-v19.mjs [--base http://localhost:4174] [--out review_v19]
//  - 1440, 1920 desktop and 390 mobile (touch), light and dark: hero shot (label visible), the label above every
//    scene without covering scene content, header height 71 px
//  - nav: one link focused (shot), every link clicked -> target top = header + 8 px (+-12; wide desktop story chapters:
//    0, like the rail), shot per target; "Preise"
//    leaves the stage handed over; Back returns to the previous target; mobile menu closed / open, aria-expanded,
//    closes on link click and Escape
//  - JavaScript off: new wording, nav links jump natively, no overlap of nav and logo
//  - 0 console errors (incl. "Refused to execute inline script"), 0 requests to other origins
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const opt = (name, def) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : def; };
const BASE = opt('base', 'http://localhost:4174');
const OUT = path.resolve(ROOT, opt('out', 'review_v19'));
fs.mkdirSync(OUT, {recursive: true});

const HEADER = 71, MARGIN = 8, TOL = 12;
const NAV = [['Beispiel', 'k-website'], ['Betreuung', 'k-betreuung'], ['Ablauf', 'ablauf'], ['Preise', 'preise'], ['Über uns', 'ueber-uns']];
const VIEWPORTS = [
  ['1440', {viewport: {width: 1440, height: 900}}],
  ['1920', {viewport: {width: 1920, height: 1080}}],
  ['390', {viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true, deviceScaleFactor: 2}],
];
const report = {errors: [], foreign: [], checks: []};
const check = (name, ok, detail) => { report.checks.push({name, ok: !!ok, detail}); if (!ok) console.log('FAIL', name, JSON.stringify(detail)); };

const browser = await chromium.launch();
async function open(extra, {dark = false, js = true, url = '/'} = {}) {
  const context = await browser.newContext({deviceScaleFactor: 1, javaScriptEnabled: js, ...extra});
  if (dark) await context.addInitScript(() => { try { localStorage.setItem('bd-theme', 'dark'); } catch (e) { /* ignore */ } });
  const page = await context.newPage();
  page.on('pageerror', (e) => report.errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') report.errors.push(m.text()); });
  page.on('request', (r) => { if (!r.url().startsWith(BASE) && !r.url().startsWith('data:')) report.foreign.push(r.url()); });
  await page.goto(BASE + url, {waitUntil: 'load'});
  await page.waitForTimeout(1200);
  return {context, page};
}
const shot = (page, name) => page.screenshot({path: path.join(OUT, name + '.png')});

// label box vs. the visible content of the scene on the stage (desktop) or of the website card (mobile)
const labelOverlap = () => {
  const badge = document.querySelector('.stage-badge');
  if (!badge) return {visible: false};
  const b = badge.getBoundingClientRect();
  const cs = getComputedStyle(badge);
  const visible = b.width > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.9;
  const box = badge.parentElement.querySelectorAll('.scene');
  const hits = [];
  box.forEach((sc) => {
    if (+getComputedStyle(sc).opacity < 0.5 || getComputedStyle(sc).visibility === 'hidden') return;
    sc.querySelectorAll('.hk-b, .ws-tag, .ws-laptop, .ws-phone, .ws-inquiry, .bt-card, .bt-status, .bt-ask, .bt-done').forEach((el) => {
      const r = el.getBoundingClientRect();
      const x = Math.min(b.right, r.right) - Math.max(b.left, r.left), y = Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top);
      if (x > 1 && y > 1) hits.push({scene: sc.getAttribute('data-scene'), el: el.className, x: Math.round(x), y: Math.round(y)});
    });
  });
  // the label ignores the pointer (pointer-events: none); switch that off for the hit test only
  badge.style.pointerEvents = 'auto';
  const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
  badge.style.pointerEvents = '';
  return {visible, onTop: !!top && badge.contains(top), text: badge.textContent, hits};
};

for (const [name, extra] of VIEWPORTS) {
  const mobile = name === '390';
  for (const dark of [false, true]) {
    const sfx = dark ? 'dark' : 'light';
    const {context, page} = await open(extra, {dark});
    const hdr = await page.evaluate(() => Math.round(document.querySelector('[data-header]').getBoundingClientRect().height));
    check(`header height ${name} ${sfx}`, hdr === HEADER, {hdr});
    const h2 = await page.evaluate(() => document.querySelector('#k-website h2').textContent.trim());
    check(`C1 wording ${name}`, h2 === 'Deine Webseite, maßgeschneidert.', {h2});
    if (!mobile) {
      await shot(page, `hero_${name}_${sfx}`);
      // the label over each of the three scenes, after the cut has settled
      for (const id of ['k-hook', 'k-website', 'k-betreuung']) {
        await page.evaluate((i) => window.scrollTo(0, document.getElementById(i).getBoundingClientRect().top + scrollY), id);
        await page.waitForTimeout(1600);
        const ov = await page.evaluate(labelOverlap);
        const st = await page.evaluate(() => window.__bdStage && window.__bdStage().current);
        check(`C2 label ${name} ${sfx} scene ${st}`, ov.visible && ov.onTop && ov.hits.length === 0, ov);
        if (id === 'k-website') await shot(page, `label_${name}_${sfx}_website`);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(800);
    } else {
      await shot(page, `hero_${name}_${sfx}`);
      await page.evaluate(() => { const c = document.getElementById('k-website'); window.scrollTo(0, c.getBoundingClientRect().top + scrollY - 79); });
      await page.waitForTimeout(3200);
      const ov = await page.evaluate(labelOverlap);
      check(`C2 label ${name} ${sfx}`, ov.visible && ov.onTop && ov.hits.length === 0, ov);
      // the sticky CTA and the header do not cover the label
      const cover = await page.evaluate(() => {
        const b = document.querySelector('.stage-badge').getBoundingClientRect();
        const h = document.querySelector('[data-header]').getBoundingClientRect();
        const c = document.querySelector('.m-cta').getBoundingClientRect();
        return {underHeader: b.top < h.bottom, underCta: b.bottom > c.top && b.top < c.bottom};
      });
      check(`C2 label free of header/CTA ${name} ${sfx}`, !cover.underHeader && !cover.underCta, cover);
      await shot(page, `label_${name}_${sfx}_website`);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(600);
    }
    if (dark) { await context.close(); continue; }

    // ---- nav (light only)
    if (!mobile) {
      await page.focus('.main-nav a[href="#preise"]');
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      const focus = await page.evaluate(() => { const a = document.activeElement; const cs = getComputedStyle(a); return {text: a.textContent, outline: cs.outlineStyle + ' ' + cs.outlineWidth}; });
      check(`C3 focus ring ${name}`, focus.text === 'Preise' && focus.outline.startsWith('solid'), focus);
      await page.locator('[data-header]').screenshot({path: path.join(OUT, `nav_${name}_focus.png`)});
    } else {
      await page.locator('[data-header]').screenshot({path: path.join(OUT, `nav_${name}_closed.png`)});
      const btn = page.locator('[data-nav-toggle]');
      check(`C3 menu button ${name}`, await btn.isVisible() && (await btn.getAttribute('aria-expanded')) === 'false', {});
      await btn.click();
      await page.waitForTimeout(300);
      check(`C3 menu opens ${name}`, (await btn.getAttribute('aria-expanded')) === 'true' && await page.locator('#main-nav a[href="#preise"]').isVisible(), {});
      await shot(page, `nav_${name}_open`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      const esc = await page.evaluate(() => ({exp: document.querySelector('[data-nav-toggle]').getAttribute('aria-expanded'), focus: document.activeElement.hasAttribute('data-nav-toggle')}));
      check(`C3 Escape closes, focus on button ${name}`, esc.exp === 'false' && esc.focus, esc);
    }
    const targets = mobile ? NAV.concat([['Kontakt', 'kontakt']]) : NAV;
    let prev = null;
    for (const [label, id] of targets) {
      if (mobile) { await page.click('[data-nav-toggle]'); await page.waitForTimeout(250); }
      await page.click(`#main-nav a[href="#${id}"]`);
      await page.waitForTimeout(2200);
      const res = await page.evaluate((i) => ({
        top: Math.round(document.getElementById(i).getBoundingClientRect().top), hash: location.hash,
        stage: window.__bdStage ? window.__bdStage() : null,
        menu: document.querySelector('[data-nav-toggle]').getAttribute('aria-expanded'),
      }), id);
      // the contact section is the last one: the page may end before it reaches the header line
      // the one-viewport story chapters of the wide desktop layout land at 0 like the rail and the v16 settle
      const wanted = !mobile && id.startsWith('k-') ? 0 : HEADER + MARGIN;
      const atBottom = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight - scrollY < 60);
      // mobile #kontakt: Lenis stops ~74 px early, the same as the existing "Erstgespräch anfragen" CTA on main
      // (Lenis limit below the real page end; reported in REPORT.md), the heading is fully in view
      const ok = Math.abs(res.top - wanted) <= TOL || (atBottom && res.top > wanted) || (id === 'kontakt' && res.top > wanted && res.top < 260);
      check(`C3 ${name} ${label} -> #${id}`, ok && res.hash === '#' + id && (!mobile || res.menu === 'false'), res);
      if (label === 'Preise' && !mobile) check(`C3 ${name} Preise: stage handed over`, res.stage && res.stage.handed === true, res.stage);
      if (label === 'Beispiel' && !mobile) check(`C3 ${name} Beispiel: website scene`, res.stage && res.stage.current === 'website', res.stage);
      await shot(page, `anchor_${name}_${id}`);
      prev = id;
    }
    // back button: one step back = the previous target
    await page.goBack();
    await page.waitForTimeout(2000);
    const back = await page.evaluate(() => location.hash);
    const backTarget = mobile ? 'ueber-uns' : 'preise';
    const backTop = await page.evaluate((i) => Math.round(document.getElementById(i).getBoundingClientRect().top), backTarget);
    check(`C3 ${name} back -> #${backTarget}`, back === '#' + backTarget && Math.abs(backTop - HEADER - MARGIN) <= TOL, {back, backTop, from: prev});
    await context.close();
  }
}

// ---- JavaScript off (desktop 1440 and 390 without touch emulation: the mode needs JS, so both are the static body)
for (const [name, vp] of [['1440', {width: 1440, height: 900}], ['390', {width: 390, height: 844}]]) {
  const {context, page} = await open({viewport: vp}, {js: false});
  const r = await page.evaluate(() => {
    const h2 = document.querySelector('#k-website h2').textContent.trim();
    const brand = document.querySelector('.brand').getBoundingClientRect();
    const nav = document.querySelector('.main-nav').getBoundingClientRect();
    const right = document.querySelector('.header-right').getBoundingClientRect();
    return {h2, navVisible: nav.width > 0, overlap: nav.left < brand.right - 1 || nav.right > right.left + 1, toggleHidden: getComputedStyle(document.querySelector('[data-nav-toggle]')).display === 'none',
      note: document.querySelector('#k-website .demo-note').textContent.trim()};
  });
  check(`no-JS ${name} wording + nav`, r.h2 === 'Deine Webseite, maßgeschneidert.' && r.navVisible && !r.overlap && r.toggleHidden, r);
  await shot(page, `nojs_${name}_hero`);
  await page.click('#main-nav a[href="#preise"]');
  await page.waitForTimeout(1500);
  const top = await page.evaluate(() => Math.round(document.getElementById('preise').getBoundingClientRect().top));
  check(`no-JS ${name} Preise jumps natively`, Math.abs(top - HEADER - MARGIN) <= TOL, {top});
  await shot(page, `nojs_${name}_preise`);
  await context.close();
}
await browser.close();

check('0 console errors', report.errors.length === 0, report.errors.slice(0, 5));
check('0 third-party requests', report.foreign.length === 0, report.foreign.slice(0, 5));
fs.writeFileSync(path.join(OUT, 'v19-qa.json'), JSON.stringify(report, null, 2));
const failed = report.checks.filter((c) => !c.ok);
console.log(`qa-v19: ${report.checks.length - failed.length}/${report.checks.length} PASS`);
process.exit(failed.length ? 1 : 0);
