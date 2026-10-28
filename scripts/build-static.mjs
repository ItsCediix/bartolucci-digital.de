#!/usr/bin/env node
// v18 (M1 of the audit of 28.10.): the start page is static HTML. Every text, the prices, the phone number and the
// e-mail address sit in <body> of public/index.html, readable without JavaScript and by crawlers that do not run it.
// This script fills the generated parts of index.html between markers (idempotent, part of `npm run build`):
//   <!-- offer:start --> … <!-- offer:end -->      price card + footnote from data/offer.json
//   <!-- contact:start --> … <!-- contact:end -->  e-mail and phone lines from data/company.json
//   <!-- jsonld:start --> … <!-- jsonld:end -->    the ProfessionalService block from company.json + offer.json
// and validates offer.json / chapters.json (formerly build-data.mjs: data/site-data.js and window.BD are gone,
// nothing is fetched or injected at runtime any more). The renderers are exported for the QA scripts
// (qa-v13: slotsLeft 0, qa-jsonld). Edit the JSON files, then `npm run build`.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(ROOT, 'public');
const read = (p) => JSON.parse(fs.readFileSync(path.join(PUB, p), 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ---------- validation (v13 rules, formerly build-data.mjs) ---------- */
export function validate(offer, chapters, company) {
  for (const k of ['launchPrice', 'regularPrice', 'slotsTotal', 'slotsLeft', 'carePrice', 'roundPrice']) {
    if (typeof offer[k] !== 'number') throw new Error(`offer.json: "${k}" must be a number`);
  }
  for (const k of ['heading', 'headingRegular', 'regularLabel', 'included', 'care', 'button', 'footnote']) {
    if (typeof offer.text?.[k] !== 'string') throw new Error(`offer.json: "text.${k}" must be a string`);
  }
  // availability sentence per free slot count: index 0 = one place left … slotsTotal - 1 = all free
  const avail = offer.text.availability;
  if (!Array.isArray(avail) || avail.length !== offer.slotsTotal || avail.some((s) => typeof s !== 'string')) throw new Error('offer.json: "text.availability" needs one sentence per slot (slotsTotal)');
  // UWG § 5: the higher price may only appear as the future regular price, never as a "was"-price
  if (/\b(statt|vorher|UVP)\b|%/i.test(Object.values(offer.text).flat().join(' '))) throw new Error('offer.json: no "statt"/"vorher"/"UVP"/percent wording');
  if (offer.slotsLeft < 0 || offer.slotsLeft > offer.slotsTotal) throw new Error('offer.json: slotsLeft out of range');
  for (const c of chapters.chapters) {
    if (!Array.isArray(c.beats) || c.beats.length < 1) throw new Error(`chapters.json: "${c.id}" needs a beats array`);
  }
  for (const k of ['name', 'legalName', 'url', 'logo', 'email', 'description']) {
    if (typeof company[k] !== 'string' || !company[k]) throw new Error(`company.json: "${k}" must be a non-empty string`);
  }
  for (const k of ['display', 'e164', 'international']) if (!company.phone?.[k]) throw new Error(`company.json: "phone.${k}" missing`);
  for (const k of ['streetAddress', 'postalCode', 'addressLocality', 'addressCountry']) if (!company.address?.[k]) throw new Error(`company.json: "address.${k}" missing`);
  if (!Array.isArray(company.founders) || !company.founders.length) throw new Error('company.json: founders missing');
  if (!/^[^@\s]+@[^@\s]+\.[a-z]+$/i.test(company.email)) throw new Error('company.json: e-mail address malformed');
  if (!/^\+\d{8,15}$/.test(company.phone.e164)) throw new Error('company.json: phone.e164 must be +<digits>');
}

/* ---------- price card (v12 card in the logo palette: heading, price row, availability sentence, .facts, button;
   v13: asterisk on the website prices, footnote below the card, outside it). The struck regular price is never
   shown as "statt"/"vorher": it has not been charged yet (UWG § 5). slotsLeft 0 -> fixed-price heading, 1.990 € as
   the only price, no availability sentence. Same output as the former renderOffer() in shared.js. ---------- */
const fmt = (n) => n.toLocaleString('de-DE') + ' €';
// a .facts row: lead clause (up to the first comma, full stop or bracket) semibold, the rest regular
const fact = (text) => {
  const m = /^([^,.(]+[,.]?)(.*)$/.exec(text);
  return m ? `<li><strong>${esc(m[1])}</strong>${esc(m[2])}</li>` : `<li><strong>${esc(text)}</strong></li>`;
};
const star = '<sup class="price-star">*</sup>';
export function renderOffer(o, company) {
  const t = o.text;
  const values = {launch: fmt(o.launchPrice), regular: fmt(o.regularPrice), care: fmt(o.carePrice), round: fmt(o.roundPrice)};
  const fill = (s) => s.replace(/\{(\w+)\}/g, (_, k) => values[k]);
  const launch = o.slotsLeft > 0;
  let h = `<div class="price" data-offer><h3 class="price-h">${esc(launch ? t.heading : t.headingRegular)}</h3><div class="price-row">`;
  h += `<p class="price-now">${fmt(launch ? o.launchPrice : o.regularPrice)}${star}</p>`;
  if (launch) h += `<p class="price-reg"><s>${fmt(o.regularPrice)}${star}</s><span>${esc(t.regularLabel)}</span></p>`;
  h += '</div>';
  if (launch && t.availability[o.slotsLeft - 1]) h += `<p class="price-avail">${esc(t.availability[o.slotsLeft - 1])}</p>`;
  h += `<ul class="facts">${fact(fill(t.included))}${fact(fill(t.care))}</ul>`;
  h += `<a class="btn btn-primary btn-lg" href="#kontakt">${esc(t.button)}</a>`;
  h += '</div>';
  h += `<p class="price-note">${esc(t.footnote)}</p>`;
  return h;
}

/* ---------- contact lines (v15 layout: icon, value, hint; "E‑Mail" with a non-breaking hyphen U+2011, the phone
   number with non-breaking spaces so it never wraps; shared.js swaps "Mail schreiben" in when the address does not fit) ---------- */
const ICON_MAIL = 'M3 6h18v12H3zM3 6l9 7 9-7';
const ICON_TEL = 'M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z';
const line = (href, label, icon, hint, title) => `<a class="contact-line" href="${esc(href)}"${title ? ` title="${esc(title)}"` : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icon}"/></svg><span class="contact-val">${esc(label)}</span><span class="small">${hint}</span></a>`;
export function renderContact(company) {
  const tel = company.phone.display.replace(/ /g, ' ');
  return line('mailto:' + company.email, company.email, ICON_MAIL, 'E‑Mail', company.email) + '\n        ' + line('tel:' + company.phone.e164, tel, ICON_TEL, 'Telefon');
}

/* ---------- JSON-LD (ProfessionalService) ---------- */
export function renderJsonLd(company, offer) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: company.name,
    url: company.url,
    logo: company.logo,
    image: company.image,
    description: company.description,
    email: company.email,
    address: {'@type': 'PostalAddress', addressLocality: company.address.addressLocality, postalCode: company.address.postalCode, addressCountry: company.address.addressCountry},
    telephone: company.phone.international,
    areaServed: company.areaServed,
    founder: company.founders.map((name) => ({'@type': 'Person', name})),
    priceRange: '€€',
  };
  return JSON.stringify(data);
}

/* ---------- assemble ---------- */
const between = (html, name, inner) => {
  const re = new RegExp(`(<!-- ${name}:start[^>]*-->)[\\s\\S]*?(<!-- ${name}:end -->)`);
  if (!re.test(html)) throw new Error(`build-static: ${name} markers missing in index.html`);
  return html.replace(re, (_, a, b) => `${a}\n${inner}\n${b}`);
};
export function build() {
  const offer = read('data/offer.json');
  const chapters = read('data/chapters.json');
  const company = read('data/company.json');
  validate(offer, chapters, company);
  const FILE = path.join(PUB, 'index.html');
  const html = fs.readFileSync(FILE, 'utf8');
  let out = html;
  out = between(out, 'offer', '        ' + renderOffer(offer, company));
  out = between(out, 'contact', '        ' + renderContact(company));
  out = between(out, 'jsonld', `<script type="application/ld+json">\n${renderJsonLd(company, offer)}\n</script>`);
  for (const s of [fmt(offer.launchPrice), company.phone.display.replace(/ /g, ' '), company.email, '<h1']) {
    if (!out.includes(s)) throw new Error(`build-static: "${s}" not in index.html`);
  }
  if (/<template\b/.test(out)) throw new Error('build-static: a <template> is left in index.html (v18: the page is static)');
  if (out !== html) fs.writeFileSync(FILE, out);
  console.log(`build-static: offer card, contact lines and JSON-LD rendered${out === html ? ' (unchanged)' : ''}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) build();
