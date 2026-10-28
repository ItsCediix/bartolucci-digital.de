#!/usr/bin/env node
// v17.1: crawler copy. The visible page lives in <template>s and is assembled by the boot script; prices and
// contact lines are filled in by shared.js. Crawlers that do not run JavaScript (most AI crawlers) therefore saw
// no copy, no prices and no phone number. This script renders the same content as plain HTML into
// <div id="static-copy"> between the static-copy markers in index.html:
//   - the chapter articles (tpl-chapters) and the shared sections (tpl-shared), minus decoration
//     (aria-hidden scenes, skyline, icons, images),
//   - the price card from data/offer.json (same wording as renderOffer() in shared.js),
//   - the phone number from shared.js (the e-mail address stays runtime-only, as before).
// With JS on, `html.js .static-copy{display:none}` (inline <style> in <head>) hides it and the boot script
// removes it before inserting the templates, so there are no duplicate ids. Single source stays the
// templates + offer.json + shared.js; re-run via `npm run build` after editing any of them.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(ROOT, 'public');
const FILE = path.join(PUB, 'index.html');
const html = fs.readFileSync(FILE, 'utf8');
const START = '<!-- static-copy:start -->';
const END = '<!-- static-copy:end -->';
if (!html.includes(START) || !html.includes(END)) throw new Error('build-static: static-copy markers missing in index.html');

const tpl = (id) => {
  const m = new RegExp(`<template id="${id}">([\\s\\S]*?)</template>`).exec(html);
  if (!m) throw new Error(`build-static: <template id="${id}"> not found`);
  return m[1];
};

// remove every <tag …>…</tag> whose opening tag passes test (nesting of the same tag is counted)
function strip(src, tag, test) {
  const openRe = new RegExp(`<${tag}\\b[^>]*>`, 'g');
  let out = '';
  let i = 0;
  for (;;) {
    openRe.lastIndex = i;
    let m;
    while ((m = openRe.exec(src)) && !test(m[0]));
    if (!m) break;
    out += src.slice(i, m.index);
    const tokRe = new RegExp(`<${tag}\\b[^>]*>|</${tag}>`, 'g');
    tokRe.lastIndex = m.index + m[0].length;
    let depth = 1;
    let t;
    while (depth && (t = tokRe.exec(src))) depth += t[0][1] === '/' ? -1 : 1;
    if (depth) throw new Error(`build-static: unbalanced <${tag}>`);
    i = tokRe.lastIndex;
  }
  return out + src.slice(i);
}
const hidden = (open) => /aria-hidden="true"/.test(open);
const cls = (name) => (open) => new RegExp(`class="[^"]*\\b${name}\\b`).test(open);
const clean = (s) => {
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  for (const tag of ['div', 'svg', 'span', 'p']) s = strip(s, tag, hidden);
  s = strip(s, 'span', cls('on-mobile')); // keep one of the "Rechts"/"Oben" pair
  s = strip(s, 'div', cls('card-photo-box'));
  s = s.replace(/<img\b[^>]*>/g, '');
  s = s.replace(/\s(data-[\w-]+)(="[^"]*")?/g, ''); // no hooks for the scripts
  return s.replace(/\n\s*\n+/g, '\n').trim();
};

// ---------- price card (mirrors renderOffer in shared.js) ----------
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const {offer: o} = {offer: JSON.parse(fs.readFileSync(path.join(PUB, 'data', 'offer.json'), 'utf8'))};
const t = o.text;
const fmt = (n) => n.toLocaleString('de-DE') + ' €';
const values = {launch: fmt(o.launchPrice), regular: fmt(o.regularPrice), care: fmt(o.carePrice), round: fmt(o.roundPrice)};
const fill = (s) => s.replace(/\{(\w+)\}/g, (_, k) => values[k]);
const fact = (text) => {
  const m = /^([^,.(]+[,.]?)(.*)$/.exec(text);
  return m ? `<li><strong>${esc(m[1])}</strong>${esc(m[2])}</li>` : `<li><strong>${esc(text)}</strong></li>`;
};
const star = '<sup class="price-star">*</sup>';
const launch = o.slotsLeft > 0;
let price = `<div class="price"><h3 class="price-h">${esc(launch ? t.heading : t.headingRegular)}</h3><div class="price-row">`;
price += `<p class="price-now">${fmt(launch ? o.launchPrice : o.regularPrice)}${star}</p>`;
if (launch) price += `<p class="price-reg"><s>${fmt(o.regularPrice)}${star}</s> <span>${esc(t.regularLabel)}</span></p>`;
price += '</div>';
if (launch && t.availability[o.slotsLeft - 1]) price += `<p class="price-avail">${esc(t.availability[o.slotsLeft - 1])}</p>`;
price += `<ul class="facts">${fact(fill(t.included))}${fact(fill(t.care))}</ul><a class="btn btn-primary btn-lg" href="#kontakt">${esc(t.button)}</a></div>`;
price += `<p class="price-note">${esc(t.footnote)}</p>`;

// ---------- phone (single source: the split array in shared.js) ----------
const sharedJs = fs.readFileSync(path.join(PUB, 'assets', 'shared.js'), 'utf8');
const telM = /var tel = \[([^\]]+)\]/.exec(sharedJs);
if (!telM) throw new Error('build-static: phone array not found in shared.js');
const tel = telM[1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''));
const contact = `<div class="contact-lines"><p>Telefon: <a href="tel:+49${tel.join('').slice(1)}">${tel.join(' ')}</a></p><p>E-Mail: siehe <a href="/impressum.html">Impressum</a></p></div>`;

// ---------- assemble ----------
let shared = tpl('tpl-shared');
shared = shared.replace(/<div class="price"[^>]*><\/div>/, () => price);
shared = strip(shared, 'div', cls('contact-lines')).replace(/(<div class="contact-copy">[\s\S]*?<\/div>)/, (m) => m + contact);
if (!shared.includes('price-now') || !shared.includes('tel:')) throw new Error('build-static: price card or phone not placed');
const footerM = /<footer[\s\S]*?<\/footer>/.exec(shared);
const footer = footerM ? footerM[0] : '';
shared = shared.replace(footer, '');

const block = [
  START,
  '<div class="static-copy" id="static-copy">',
  '<main>',
  clean(tpl('tpl-chapters')),
  clean(shared),
  '</main>',
  clean(footer),
  '</div>',
  END,
].join('\n');

const out = html.slice(0, html.indexOf(START)) + block + html.slice(html.indexOf(END) + END.length);
if (out !== html) fs.writeFileSync(FILE, out);
console.log(`build-static: static copy ${block.length} bytes${out === html ? ' (unchanged)' : ''}`);
