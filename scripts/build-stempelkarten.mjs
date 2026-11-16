#!/usr/bin/env node
// Product page /stempelkarten (public/stempelkarten.html), same idea as build-faq.mjs. Fills between markers:
//   <!-- sk-faq -->      the questions from data/stempelkarten.json as <details> (no JavaScript, strict CSP)
//   <!-- sk-contact -->  the e-mail and phone lines from data/company.json (same renderer as the start page)
//   <!-- sk-jsonld -->   Service (provider = the organisation node of the start page, no price) + FAQPage
// Part of `npm run build`, before build-seo.mjs (breadcrumb, sitemap).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {renderContact, ORG_ID, SITE_ID} from './build-static.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(ROOT, 'public');
const read = (p) => JSON.parse(fs.readFileSync(path.join(PUB, p), 'utf8'));
const data = read('data/stempelkarten.json');
const company = read('data/company.json');
const URL_ = 'https://bartolucci-digital.de/stempelkarten';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slug = (s) => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').split('-').slice(0, 7).join('-');
// binding content rules (owner, 16.11.2026): no prices, no Apple Wallet promise, no "von Hand gebaut"
const all = JSON.stringify(data.faq);
if (/\d\s?€|Apple|von Hand/i.test(all)) throw new Error('build-stempelkarten: price, Apple or "von Hand" in stempelkarten.json');

const faq = data.faq.map((it) => `    <details class="faq-item" id="${slug(it.q)}"><summary><h3>${esc(it.q)}</h3></summary><div class="faq-a">${it.a.map((p) => `<p>${esc(p)}</p>`).join('')}</div></details>`).join('\n');

const ld = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Service',
      '@id': URL_ + '#service',
      name: 'Digitale Stempelkarte',
      serviceType: 'Digitale Stempelkarte für lokale Geschäfte',
      description: 'Digitale Stempelkarte ohne App für Läden in Hamburg: Kunden holen die Karte per QR-Code oder NFC-Aufkleber aufs Handy, das Personal stempelt mit einem normalen Handy. Mit Einrichtung, Flyer und Aufklebern, Einweisung und Ansprechpartner in Hamburg. Pilotphase, Preis auf Anfrage.',
      url: URL_,
      provider: {'@id': ORG_ID},
      areaServed: {'@type': 'City', name: company.areaServed},
      audience: {'@type': 'BusinessAudience', name: 'Friseure, Barbershops, Cafés, Restaurants und Bäckereien'},
    },
    {
      '@type': 'FAQPage',
      '@id': URL_ + '#fragen',
      url: URL_,
      inLanguage: 'de-DE',
      isPartOf: {'@id': SITE_ID},
      publisher: {'@id': ORG_ID},
      mainEntity: data.faq.map((it) => ({'@type': 'Question', name: it.q, acceptedAnswer: {'@type': 'Answer', text: it.a.join(' ')}})),
    },
  ],
};
const ldTag = `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`;

const file = path.join(PUB, 'stempelkarten.html');
const before = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const put = (src, name, content) => {
  const re = new RegExp(`(<!-- ${name}:start[^>]*-->)[\\s\\S]*?(<!-- ${name}:end -->)`);
  if (!re.test(src)) throw new Error(`build-stempelkarten: marker ${name} missing in stempelkarten.html`);
  return src.replace(re, (_, a, b) => `${a}\n${content}\n${b}`);
};
let page = put(before, 'sk-jsonld', ldTag);
page = put(page, 'sk-faq', faq);
page = put(page, 'sk-contact', '        ' + renderContact(company));
if (/\d\s?(&nbsp;)?€|Apple Wallet|von Hand gebaut/i.test(page.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, ''))) {
  throw new Error('build-stempelkarten: price, Apple Wallet or "von Hand gebaut" in stempelkarten.html');
}
if (page !== before) fs.writeFileSync(file, page);
console.log(`build-stempelkarten: ${data.faq.length} questions, contact lines, JSON-LD${page === before ? ' (unchanged)' : ''}`);
