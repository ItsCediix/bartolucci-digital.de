#!/usr/bin/env node
// QA v13: free flow, background, texts, "morgens" section, price footnote. Writes review/v13-qa.json and the
// review screenshots; exit 1 when a gate fails. Needs `npx serve public -l 4173` running.
//  - page length of / at 1440 × 900 in viewport heights (gate ≤ 6.5)
//  - mouse-wheel scroll top -> bottom in 600 px steps, 80 ms pauses: scrollY grows monotonically, the visible
//    text changes on every step (no stall); back to the top: no [data-beat] / section block left at opacity 0
//  - stage: scene follows the scroll both ways; reload mid-page lands on the right scene without the fly-in
//  - review/bg_<w>_<light|dark>_<top|preise>.png at 1440/1920/2560/3440, review/flow_<w>_<pct>.png at
//    1440/1920, review/morgens_<w>[_dark].png and review/preise_<w>[_dark].png at 1440/2560, review/team_1440.png
//  - grep gates (team wording, automation jargon), footnote, slotsLeft 0, /automatisierung gone
//   node scripts/qa-v13.mjs [--base http://localhost:4173] [--out review]
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(ROOT, 'public');
const args = process.argv.slice(2);
const opt = (n, def) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : def; };
const BASE = opt('base', 'http://localhost:4173');
const OUT = path.resolve(ROOT, opt('out', 'review'));
fs.mkdirSync(OUT, {recursive: true});

const report = {errors: []};
const gate = {};
const browser = await chromium.launch();
async function open(w, h, {dark = false, url = `${BASE}/?mode=desktop`, extra = {}, route = null} = {}) {
  const context = await browser.newContext({viewport: {width: w, height: h}, deviceScaleFactor: 1, ...extra});
  if (dark) await context.addInitScript(() => { try { localStorage.setItem('bd-theme', 'dark'); } catch (e) { /* ignore */ } });
  const page = await context.newPage();
  if (route) await route(page);
  page.on('pageerror', (e) => report.errors.push(`${w}: ${e}`));
  await page.goto(url, {waitUntil: 'load'});
  await page.waitForTimeout(1500);
  return {context, page};
}
const toSel = async (page, sel, wait = 2600) => {
  await page.evaluate((s) => { const el = document.querySelector(s); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 72); }, sel);
  await page.waitForTimeout(wait);
};

// ---------------------------------------------------------------- 1. page length + wheel scroll + leftovers
{
  const {context, page} = await open(1440, 900);
  report.pageVh = await page.evaluate(() => +(document.documentElement.scrollHeight / innerHeight).toFixed(2));
  gate.pageLength = {vh: report.pageVh, pass: report.pageVh <= 6.5};

  // the visible text: every text block whose box intersects the viewport and is not transparent
  const visibleText = () => {
    const out = [];
    document.querySelectorAll('main p, main h1, main h2, main h3, main li, main dd, main dt').forEach((el) => {
      if (el.closest('.stage')) return;
      const r = el.getBoundingClientRect();
      if (r.bottom <= 71 || r.top >= innerHeight || !r.height) return;
      let o = 1;
      for (let e = el; e && e.nodeType === 1; e = e.parentElement) o *= +getComputedStyle(e).opacity;
      if (o > 0.05) out.push(el.textContent.trim().slice(0, 40));
    });
    return out.join('|');
  };
  await page.mouse.move(500, 450);
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const steps = [];
  let prev = {y: await page.evaluate(() => scrollY), text: await page.evaluate(visibleText)};
  for (let i = 0; i < 60; i++) {
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(80);
    const cur = {y: await page.evaluate(() => Math.round(scrollY)), text: await page.evaluate(visibleText)};
    steps.push({i, y: cur.y, dy: cur.y - prev.y, textChanged: cur.text !== prev.text});
    prev = cur;
    if (cur.y >= max - 1) break;
  }
  await page.waitForTimeout(1500);
  const finalY = await page.evaluate(() => Math.round(scrollY));
  // a step counts while a whole wheel step still fits below; the last ones only ease into the page end
  const moving = steps.filter((s, k) => (k ? steps[k - 1].y : 0) < max - 600);
  gate.wheelScroll = {
    steps: steps.length, reachedBottom: finalY >= max - 2, max,
    monotonic: steps.every((s) => s.dy >= 0) && moving.every((s) => s.dy > 0),
    textChangedEveryStep: moving.every((s) => s.textChanged),
    stalls: moving.filter((s) => !(s.dy > 0) || !s.textChanged),
  };
  gate.wheelScroll.pass = gate.wheelScroll.reachedBottom && gate.wheelScroll.monotonic && gate.wheelScroll.textChangedEveryStep;
  report.wheelSteps = steps;
  const atBottom = await page.evaluate(() => window.__bdStage());
  // back to the top with the wheel
  for (let i = 0; i < 40; i++) {
    await page.mouse.wheel(0, -900);
    await page.waitForTimeout(80);
    if (await page.evaluate(() => scrollY) <= 0) break;
  }
  await page.waitForTimeout(2000);
  const leftovers = await page.evaluate(() => {
    const hidden = (el) => getComputedStyle(el).opacity === '0';
    const beats = Array.from(document.querySelectorAll('[data-beat], [data-beat] li, .chapter li[data-beat]')).filter(hidden).map((e) => e.tagName + ':' + e.textContent.trim().slice(0, 30));
    const blocks = Array.from(document.querySelectorAll('.section > .wrap > *, #kontakt > .wrap')).filter(hidden).map((e) => e.className);
    return {beats, blocks, scrollY: scrollY, stage: window.__bdStage(), stageOpacity: getComputedStyle(document.getElementById('stage')).opacity};
  });
  gate.leftovers = {...leftovers, atBottom, pass: !leftovers.beats.length && !leftovers.blocks.length};
  gate.stageBack = {pass: leftovers.stage.current === 'hook' && !leftovers.stage.handed && leftovers.stageOpacity === '1', ...leftovers.stage, atBottomHanded: atBottom.handed};
  await context.close();
}

// ---------------------------------------------------------------- 2. reload mid-page: right scene, no fly-in
{
  const {context, page} = await open(1440, 900);
  await page.evaluate(() => { const el = document.getElementById('k-betreuung'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 100); });
  await page.waitForTimeout(1500);
  await page.reload({waitUntil: 'load'});
  const samples = [];
  for (const ms of [100, 300, 800]) {
    await page.waitForTimeout(ms);
    samples.push(await page.evaluate(() => ({y: Math.round(scrollY), stage: window.__bdStage ? window.__bdStage() : {current: null}, hook: +getComputedStyle(document.querySelector('#stage [data-scene="hook"]')).opacity, hookY: getComputedStyle(document.querySelector('#stage [data-scene="hook"] .scene-in')).transform})));
  }
  // the hook never flies up (its .scene-in keeps no transform) and the stage ends on "betreuung"
  gate.reloadMidPage = {samples, pass: samples[samples.length - 1].stage.current === 'betreuung' && samples.every((s) => s.hookY === 'none' || /matrix\(1, 0, 0, 1, 0, 0\)/.test(s.hookY)) && samples[samples.length - 1].hook === 0};
  await context.close();
}

// ---------------------------------------------------------------- 3. screenshots
const BG = [[1440, 900], [1920, 1080], [2560, 1440], [3440, 1440]];
for (const [w, h] of BG) {
  for (const dark of [false, true]) {
    const {context, page} = await open(w, h, {dark});
    const t = dark ? 'dark' : 'light';
    await page.waitForTimeout(2000); // the hook bubbles finish their intro (~3 s after load)
    await page.screenshot({path: path.join(OUT, `bg_${w}_${t}_top.png`)});
    await toSel(page, '#preise');
    await page.screenshot({path: path.join(OUT, `bg_${w}_${t}_preise.png`)});
    if (w === 1440 || w === 2560) {
      await (await page.$('#preise')).screenshot({path: path.join(OUT, `preise_${w}${dark ? '_dark' : ''}.png`)});
      await toSel(page, '#morgens', 5200);
      await (await page.$('#morgens')).screenshot({path: path.join(OUT, `morgens_${w}${dark ? '_dark' : ''}.png`)});
    }
    if (w === 1440 && !dark) {
      await toSel(page, '#ueber-uns');
      await (await page.$('#ueber-uns')).screenshot({path: path.join(OUT, 'team_1440.png')});
      report.bgLayer = await page.evaluate(() => {
        const bg = document.getElementById('bg');
        const cs = getComputedStyle(bg);
        const grain = getComputedStyle(bg, '::after');
        return {position: cs.position, zIndex: cs.zIndex, pointerEvents: cs.pointerEvents, rect: bg.getBoundingClientRect().toJSON(), grainOpacity: grain.opacity, blend: grain.mixBlendMode, fields: Array.from(bg.children).map((f) => getComputedStyle(f).transform), filters: Array.from(bg.querySelectorAll('*')).map((f) => getComputedStyle(f).filter).filter((f) => f !== 'none')};
      });
    }
    await context.close();
  }
}
for (const [w, h] of [[1440, 900], [1920, 1080]]) {
  const {context, page} = await open(w, h);
  const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  for (const p of [0, 20, 40, 60, 80, 100]) {
    await page.evaluate((y) => window.scrollTo(0, y), Math.round((total * p) / 100));
    await page.waitForTimeout(p === 0 ? 800 : 2800);
    await page.screenshot({path: path.join(OUT, `flow_${w}_${String(p).padStart(3, '0')}.png`)});
  }
  await context.close();
}
// legal pages carry the background too
for (const f of ['impressum', 'datenschutz']) {
  const {context, page} = await open(2560, 1440, {url: `${BASE}/${f}.html`});
  report[`bg_${f}`] = await page.evaluate(() => !!document.getElementById('bg'));
  await page.screenshot({path: path.join(OUT, `bg_2560_light_${f}.png`)});
  await context.close();
}
gate.background = {layer: report.bgLayer, legal: [report.bg_impressum, report.bg_datenschutz]};
gate.background.pass = report.bgLayer.position === 'fixed' && report.bgLayer.zIndex === '-1' && report.bgLayer.pointerEvents === 'none' && !report.bgLayer.filters.length && report.bg_impressum && report.bg_datenschutz;
// the grain tile is a data: URI of at most 8 KB
const baseCss = fs.readFileSync(path.join(PUB, 'assets', 'base.css'), 'utf8');
const uri = (baseCss.match(/url\("(data:image\/svg\+xml[^"]+)"\)/) || [])[1] || '';
gate.background.grainUriBytes = uri.length;
gate.background.pass = gate.background.pass && uri.length > 0 && uri.length <= 8192;

// ---------------------------------------------------------------- 4. price card + footnote (+ slotsLeft 0)
async function priceFacts(page) {
  return page.evaluate(() => {
    const card = document.querySelector('.price');
    const note = document.querySelector('.price-note');
    const cr = card.getBoundingClientRect();
    const nr = note && note.getBoundingClientRect();
    const cs = note && getComputedStyle(note);
    const star = document.querySelector('.price-now .price-star');
    const nb = (s) => s && s.replace(/ /g, ' '); // prices use a non-breaking space before €
    return {
      now: nb(document.querySelector('.price-now').textContent), reg: nb(document.querySelector('.price-reg s')?.textContent) || null,
      facts: Array.from(card.querySelectorAll('.facts li')).map((l) => l.textContent),
      note: note && nb(note.textContent), noteOutside: !!note && !card.contains(note) && nr.top >= cr.bottom, noteLeftAligned: !!note && Math.abs(nr.left - cr.left) < 1,
      noteSize: cs && cs.fontSize, noteColor: cs && cs.color, ink3: getComputedStyle(document.documentElement).getPropertyValue('--ink-3').trim(),
      starColorSame: !!star && getComputedStyle(star).color === getComputedStyle(document.querySelector('.price-now')).color,
      starRatio: star ? +(parseFloat(getComputedStyle(star).fontSize) / parseFloat(getComputedStyle(document.querySelector('.price-now')).fontSize)).toFixed(2) : null,
      fineGone: !/Alle Preise sind Endpreise/.test(document.body.textContent),
    };
  });
}
{
  const {context, page} = await open(1440, 900);
  const f = await priceFacts(page);
  gate.footnote = {...f, pass: f.now === '995 €*' && f.reg === '1.990 €*' && f.facts.length === 2 && !f.facts.some((t) => t.includes('*')) && f.note === '* Endpreis. Es kommt keine Umsatzsteuer dazu – wir sind Kleinunternehmer nach § 19 UStG.' && f.noteOutside && f.noteLeftAligned && f.noteSize === '13.5px' && f.starColorSame && f.starRatio === 0.6 && f.fineGone};
  await context.close();
}
{
  // slotsLeft = 0, the data file rewritten on the fly
  const route = (page) => page.route('**/data/site-data.js*',async (r) => {
    const res = await r.fetch();
    const body = (await res.text()).replace(/"slotsLeft":\d+/, '"slotsLeft":0');
    await r.fulfill({response: res, body});
  });
  const {context, page} = await open(1440, 900, {route});
  const f = await priceFacts(page);
  await toSel(page, '#preise');
  await (await page.$('#preise')).screenshot({path: path.join(OUT, 'preise_slots0_1440.png')});
  gate.footnoteSlots0 = {now: f.now, reg: f.reg, note: f.note, pass: f.now === '1.990 €*' && f.reg === null && !!f.note && f.noteOutside};
  await context.close();
}

// ---------------------------------------------------------------- 5. text + grep gates, /automatisierung gone
const textFiles = [];
const walk = (dir) => { for (const e of fs.readdirSync(dir, {withFileTypes: true})) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else if (/\.(html|css|js|json|svg|md|txt|xml)$/.test(e.name)) textFiles.push(p); } };
walk(PUB);
const grep = (re, files = textFiles) => files.flatMap((f) => fs.readFileSync(f, 'utf8').split('\n').map((l, i) => (re.test(l) ? `${path.relative(ROOT, f)}:${i + 1}` : null)).filter(Boolean));
gate.teamWords = {hits: grep(/E-Government|Handelsfachwirt|Marktleitung|Warenwirtschaft|Blender|Python|Einzelhandel/)};
gate.teamWords.pass = !gate.teamWords.hits.length;
// automation jargon: the page source without script/link URLs (ScrollTrigger.min.js is a file name, not page text)
const indexSrc = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8').replace(/<script[^>]*\bsrc="[^"]*"[^>]*><\/script>/g, '');
// "Make" and "API" as words in their own spelling, the rest in any case
const jargonLine = (l) => /\bn8n\b|\bMake\b|\bAPI\b/.test(l) || /workflow|trigger|pipeline/i.test(l);
gate.jargon = {source: indexSrc.split('\n').filter(jargonLine).map((l) => l.trim().slice(0, 80))};
{
  const {context, page} = await open(1440, 900);
  const t = await page.evaluate(() => document.body.innerText + ' ' + document.title);
  gate.jargon.rendered = (t.match(/\bn8n\b|\bMake\b|\bAPI\b|Workflow|Trigger|Pipeline/gi) || []);
  gate.jargon.pass = !gate.jargon.source.length && !gate.jargon.rendered.length;
  const team = await page.evaluate(() => ({
    lead: document.querySelector('#ueber-uns .lead').textContent,
    roles: Array.from(document.querySelectorAll('.person-role')).map((e) => e.textContent),
    bios: Array.from(document.querySelectorAll('.person-text p:last-child')).map((e) => e.textContent),
  }));
  gate.teamTexts = {...team, pass: team.lead.startsWith('Zu zweit, kurze Wege: Du redest mit einem von uns, und der kümmert sich. Wir bauen') && !/Ladenfläche/.test(team.lead) && team.roles.join('|') === 'Konzept, Texte, dein Ansprechpartner|Technik, Hosting, Updates'};
  const m = await page.evaluate(() => {
    const s = document.getElementById('morgens');
    const order = Array.from(document.querySelectorAll('main section[id]')).map((e) => e.id);
    return {
      exists: !!s, order, h2: s && s.querySelector('h2').textContent, links: s ? Array.from(s.querySelectorAll('a')).map((a) => a.textContent + ' -> ' + a.getAttribute('href')) : [], buttons: s ? s.querySelectorAll('.btn, button').length : -1,
      price: s ? /€/.test(s.textContent) : null, railEntry: !!document.querySelector('[data-rail="morgens"]'),
      autoLinks: document.querySelectorAll('a[href*="automatisierung"]').length,
      focus: (document.body.textContent.match(/automatisierung/gi) || []).length,
      msg: s && s.querySelector('.mg-text').textContent, chips: s ? Array.from(s.querySelectorAll('.mg-chip')).map((c) => c.textContent) : [],
    };
  });
  const i = m.order.indexOf('morgens');
  gate.morgens = {...m, pass: m.exists && m.order[i - 1] === 'preise' && m.order[i + 1] === 'ueber-uns' && m.links.length === 1 && m.links[0] === 'Frag uns danach -> #kontakt' && m.buttons === 0 && !m.price && !m.railEntry};
  gate.focus = {count: m.focus, pass: m.focus <= 5};
  await context.close();
}
{
  const {context, page} = await open(1440, 900);
  const st = await page.evaluate(async () => (await fetch('/automatisierung', {cache: 'no-store'}).catch(() => ({status: 'blocked'}))).status).catch((e) => String(e));
  await context.close();
  // the page's own CSP forbids fetch (connect-src 'none'), so ask the server directly as well
  const direct = await (async () => { try { return (await fetch(`${BASE}/automatisierung`)).status; } catch (e) { return String(e); } })();
  const sitemap = fs.readFileSync(path.join(PUB, 'sitemap.xml'), 'utf8');
  gate.automatisierungGone = {
    files: ['automatisierung.html', 'assets/automatisierung.css', 'assets/automatisierung.js'].filter((f) => fs.existsSync(path.join(PUB, f))),
    links: grep(/href="\/automatisierung/), sitemap: /automatisierung/.test(sitemap), httpStatus: direct, inPageFetch: st,
  };
  gate.automatisierungGone.pass = !gate.automatisierungGone.files.length && !gate.automatisierungGone.links.length && !gate.automatisierungGone.sitemap && direct === 404;
}
await browser.close();

report.gate = gate;
fs.writeFileSync(path.join(OUT, 'v13-qa.json'), JSON.stringify(report, null, 2));
for (const [k, v] of Object.entries(gate)) console.log(`${v.pass ? 'PASS' : 'FAIL'} ${k}`, JSON.stringify(v).slice(0, 400));
if (report.errors.length) console.error('page errors', report.errors);
if (Object.values(gate).some((g) => !g.pass) || report.errors.length) process.exitCode = 1;
