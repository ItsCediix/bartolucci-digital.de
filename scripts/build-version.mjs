#!/usr/bin/env node
// Cache-busting (v15): every src/href to /assets, /vendor or /data on the three pages gets ?v=<first 10 hex of the
// file's SHA-256>, so these paths can be cached as immutable (see build-headers.mjs) and a changed file is a new URL.
// The HTML itself is served no-cache. Idempotent: an existing ?v=… is replaced, a #fragment is kept; files that do
// not exist (team photos not yet added) stay untouched. Runs in `npm run build`, before build-headers.mjs.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(ROOT, 'public');

const hashOf = new Map();
const hash = (rel) => {
  if (!hashOf.has(rel)) {
    const file = path.join(PUB, rel);
    hashOf.set(rel, fs.existsSync(file) ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 10) : null);
  }
  return hashOf.get(rel);
};

let total = 0;
for (const page of ['index.html', 'impressum.html', 'datenschutz.html']) {
  const file = path.join(PUB, page);
  const html = fs.readFileSync(file, 'utf8');
  let n = 0;
  const out = html.replace(/\b(src|href)="(\/(?:assets|vendor|data)\/[^"?#]+)(\?v=[^"#]*)?(#[^"]*)?"/g, (all, attr, p, _v, frag = '') => {
    const h = hash(p.slice(1));
    if (!h) return all;
    n++;
    return `${attr}="${p}?v=${h}${frag}"`;
  });
  if (out !== html) fs.writeFileSync(file, out);
  total += n;
  console.log(`build-version: ${page} ${n} reference(s)`);
}
console.log(`build-version: ${total} versioned reference(s)`);
