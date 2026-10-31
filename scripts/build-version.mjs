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

// v19: text files are hashed with LF line endings, whatever the checkout has. The deploy serves the LF files from git;
// a CRLF working copy (Windows, core.autocrlf) used to give unchanged files a new ?v= on every machine switch.
const TEXT = /\.(css|js|mjs|svg|json|html|txt|xml)$/i;
const hashOf = new Map();
const hash = (rel) => {
  if (!hashOf.has(rel)) {
    const file = path.join(PUB, rel);
    let bytes = fs.existsSync(file) ? fs.readFileSync(file) : null;
    if (bytes && TEXT.test(rel)) bytes = Buffer.from(bytes.toString('latin1').replace(/\r\n/g, '\n'), 'latin1');
    hashOf.set(rel, bytes ? crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 10) : null);
  }
  return hashOf.get(rel);
};

let total = 0;
// v18: 404.html joins the pages; srcset lists (team photos as AVIF/WebP, M16) get the same ?v= per candidate
for (const page of ['index.html', 'impressum.html', 'datenschutz.html', '404.html']) {
  const file = path.join(PUB, page);
  if (!fs.existsSync(file)) continue;
  const html = fs.readFileSync(file, 'utf8');
  let n = 0;
  let out = html.replace(/\b(src|href)="(\/(?:assets|vendor|data)\/[^"?#]+)(\?v=[^"#]*)?(#[^"]*)?"/g, (all, attr, p, _v, frag = '') => {
    const h = hash(p.slice(1));
    if (!h) return all;
    n++;
    return `${attr}="${p}?v=${h}${frag}"`;
  });
  out = out.replace(/\bsrcset="([^"]+)"/g, (all, list) => {
    const cands = list.split(',').map((c) => c.trim()).map((c) => {
      const m = /^(\/(?:assets|vendor|data)\/[^\s?#]+)(\?v=[^\s#]*)?(\s+\S+)?$/.exec(c);
      if (!m) return c;
      const h = hash(m[1].slice(1));
      if (!h) return c;
      n++;
      return `${m[1]}?v=${h}${m[3] || ''}`;
    });
    return `srcset="${cands.join(', ')}"`;
  });
  if (out !== html) fs.writeFileSync(file, out);
  total += n;
  console.log(`build-version: ${page} ${n} reference(s)`);
}
console.log(`build-version: ${total} versioned reference(s)`);
