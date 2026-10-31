#!/usr/bin/env node
// FAQ page: reads public/data/faq.json and writes, between markers in public/faq.html,
//   - the visible questions (<details>/<summary>, no JavaScript, works under the strict CSP) and
//   - the FAQPage JSON-LD (a data block, not executed, so it needs no CSP hash).
// Both come from the same source, so the text on the page and the structured data never drift apart.
// Part of `npm run build`.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(ROOT, 'public');
const data = JSON.parse(fs.readFileSync(path.join(PUB, 'data', 'faq.json'), 'utf8'));

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// non-breaking space between number and €, as on the start page
const nb = (s) => s.replace(/(\d) €/g, '$1&nbsp;€');
const slug = (s) => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').split('-').slice(0, 7).join('-');
// mail address and phone number in answers become links
const linkify = (html) => html
  .replace(/info@bartolucci-digital\.de/g, '<a href="mailto:info@bartolucci-digital.de">info@bartolucci-digital.de</a>')
  .replace(/0170 7240 195/g, '<a href="tel:+491707240195">0170&nbsp;7240&nbsp;195</a>');

const toc = data.groups.map((g) => `<li><a href="#${g.id}">${esc(g.title)}</a></li>`).join('');
let html = `<nav class="faq-toc" aria-label="Themen"><ul>${toc}</ul></nav>\n`;
for (const g of data.groups) {
  html += `  <section class="faq-group" id="${g.id}" aria-labelledby="${g.id}-h">\n    <h2 id="${g.id}-h">${esc(g.title)}</h2>\n`;
  for (const it of g.items) {
    const body = it.a.map((p) => `<p>${linkify(nb(esc(p)))}</p>`).join('');
    html += `    <details class="faq-item" id="${slug(it.q)}"><summary><h3>${nb(esc(it.q))}</h3></summary><div class="faq-a">${body}</div></details>\n`;
  }
  html += '  </section>\n';
}

const ld = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  url: 'https://bartolucci-digital.de/faq',
  inLanguage: 'de-DE',
  mainEntity: data.groups.flatMap((g) => g.items.map((it) => ({
    '@type': 'Question',
    name: it.q,
    acceptedAnswer: {'@type': 'Answer', text: it.a.join(' ')},
  }))),
};
const ldTag = `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`;

const file = path.join(PUB, 'faq.html');
let page = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const put = (src, name, content) => {
  const re = new RegExp(`(<!-- ${name}:start[^>]*-->)[\\s\\S]*?(<!-- ${name}:end -->)`);
  if (!re.test(src)) throw new Error(`build-faq: marker ${name} missing in faq.html`);
  return src.replace(re, `$1\n${content}\n$2`);
};
page = put(page, 'faq-jsonld', ldTag);
page = put(page, 'faq', '  ' + html.trimEnd());
fs.writeFileSync(file, page);
console.log(`build-faq: ${ld.mainEntity.length} questions in ${data.groups.length} groups`);
