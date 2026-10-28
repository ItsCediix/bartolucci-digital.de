#!/usr/bin/env node
// QA v18 (audit M11): the JSON-LD block of public/index.html. Fails (exit 1) when the block is missing or not valid
// JSON, when telephone / address / e-mail / name / url are missing, when any string anywhere is empty, when the
// prices in makesOffer do not match data/offer.json, when the address and founders differ from data/company.json
// (which mirrors impressum.html), or when a new text contains an em dash.   node scripts/qa-jsonld.mjs [--out review]
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(ROOT, 'public');
const args = process.argv.slice(2);
const opt = (n, def) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : def; };
const OUT = path.resolve(ROOT, opt('out', 'review'));
fs.mkdirSync(OUT, {recursive: true});

const html = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
const offer = JSON.parse(fs.readFileSync(path.join(PUB, 'data', 'offer.json'), 'utf8'));
const company = JSON.parse(fs.readFileSync(path.join(PUB, 'data', 'company.json'), 'utf8'));
const impressum = fs.readFileSync(path.join(PUB, 'impressum.html'), 'utf8').replace(/\s+/g, ' ');
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };

const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
check(blocks.length === 1, `expected exactly one JSON-LD block, found ${blocks.length}`);
let ld = null;
try { ld = JSON.parse(blocks[0] || ''); } catch (e) { fails.push('JSON-LD is not valid JSON: ' + e.message); }

if (ld) {
  check(ld['@context'] === 'https://schema.org', '@context must be https://schema.org');
  check(ld['@type'] === 'ProfessionalService', '@type must be ProfessionalService');
  for (const k of ['name', 'url', 'telephone', 'email', 'address', 'description', 'logo', 'priceRange']) check(ld[k] != null && ld[k] !== '', `missing: ${k}`);
  // no empty strings, no em dashes, anywhere
  const walk = (v, p) => {
    if (typeof v === 'string') { check(v.trim() !== '', `empty string at ${p}`); check(!/—/.test(v), `em dash at ${p}`); }
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${p}.${k}`);
  };
  walk(ld, '$');
  // address = Impressum (via company.json, which the build uses)
  const a = ld.address || {};
  check(a['@type'] === 'PostalAddress', 'address.@type must be PostalAddress');
  for (const k of ['streetAddress', 'postalCode', 'addressLocality', 'addressCountry']) check(a[k] === company.address[k], `address.${k} must equal company.json (${company.address[k]})`);
  for (const k of ['streetAddress', 'postalCode', 'addressLocality']) check(impressum.includes(company.address[k]), `impressum.html does not contain ${company.address[k]}`);
  check(impressum.includes(company.legalName), 'impressum.html does not contain the legal name');
  check(ld.telephone === company.phone.international, `telephone must be ${company.phone.international}`);
  check(/^\+49 \d{3} \d{7}$/.test(ld.telephone || ''), 'telephone must be in the form +49 170 1234567');
  check(ld.email === company.email, 'email must equal company.json');
  // founders exactly as in the Impressum
  const founders = [].concat(ld.founder || []);
  check(founders.length === company.founders.length && founders.every((f, i) => f['@type'] === 'Person' && f.name === company.founders[i]), 'founder must list the Impressum names as Person entries');
  founders.forEach((f) => check(impressum.includes(f.name), `impressum.html does not name ${f.name}`));
  // offers: website (launch price), care per month, revision round
  const offers = [].concat(ld.makesOffer || []);
  check(offers.length === 3, `makesOffer must hold 3 offers, found ${offers.length}`);
  const price = (o) => String(o.price != null ? o.price : (o.priceSpecification && o.priceSpecification.price));
  const want = [String(offer.launchPrice), String(offer.carePrice), String(offer.roundPrice)];
  want.forEach((p, i) => check(offers[i] && price(offers[i]) === p, `makesOffer[${i}].price must be ${p}`));
  offers.forEach((o, i) => { check(o['@type'] === 'Offer', `makesOffer[${i}] must be an Offer`); check((o.priceCurrency || (o.priceSpecification && o.priceSpecification.priceCurrency)) === 'EUR', `makesOffer[${i}] must be in EUR`); });
  check(offers[1] && offers[1].priceSpecification && offers[1].priceSpecification['@type'] === 'UnitPriceSpecification' && offers[1].priceSpecification.billingDuration === 'P1M', 'care offer needs a UnitPriceSpecification with billingDuration P1M');
  check(ld.priceRange === `${offer.launchPrice} € - ${offer.regularPrice} €`, `priceRange must be "${offer.launchPrice} € - ${offer.regularPrice} €"`);
  // sameAs only with URLs that occur in the repo (Impressum or index); never invented
  for (const u of [].concat(ld.sameAs || [])) check(impressum.includes(u) || html.includes(u), `sameAs URL not in the repo: ${u}`);
  check(ld.url === company.url && ld.logo === company.logo, 'url / logo must equal company.json');
}
fs.writeFileSync(path.join(OUT, 'jsonld-qa.json'), JSON.stringify({pass: !fails.length, fails, jsonld: ld}, null, 2));
console.log(fails.length ? 'FAIL qa-jsonld:\n  ' + fails.join('\n  ') : `PASS qa-jsonld (${Object.keys(ld).length} top-level keys, ${[].concat(ld.makesOffer || []).length} offers)`);
if (fails.length) process.exitCode = 1;
