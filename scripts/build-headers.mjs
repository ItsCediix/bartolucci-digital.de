#!/usr/bin/env node
// Writes public/_headers (Cloudflare) with a strict CSP. The only inline scripts on the site are in
// index.html: the one-line `html.js` marker in <head> (v12, CSS start states of the reveals) and the boot
// script (mode + theme before first paint); their SHA-256 hashes are whitelisted here so script-src stays
// 'self' + those hashes. Re-run after changing an inline script: `npm run build`.
// Caching (v15): /assets, /vendor, /data are referenced with ?v=<content hash> (build-version.mjs) and are
// immutable for a year; the pages themselves are no-cache, so a deploy is visible on the next load.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(ROOT, 'public');

const hashes = new Set();
for (const file of ['index.html', 'impressum.html', 'datenschutz.html']) {
  // v19: hash the LF form, which is what the deploy serves (v18.1 hashed a CRLF working copy, the scripts were refused);
  // scripts/qa-csp.mjs checks the result against the built pages
  const html = fs.readFileSync(path.join(PUB, file), 'utf8').replace(/\r\n/g, '\n');
  const re = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    if (/type\s*=\s*["']application\/ld\+json["']/i.test(m[1])) continue; // data block, not executed
    hashes.add("'sha256-" + crypto.createHash('sha256').update(m[2], 'utf8').digest('base64') + "'");
  }
}
const scriptSrc = ["'self'", ...hashes].join(' ');
const csp = [
  "default-src 'self'",
  "img-src 'self' data:",
  "media-src 'self'",
  `script-src ${scriptSrc}`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "connect-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "object-src 'none'",
].join('; ');

const headers = `/*
  Content-Security-Policy: ${csp}
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
  Cross-Origin-Opener-Policy: same-origin

/fonts/*
  Cache-Control: public, max-age=31536000, immutable

/vendor/*
  Cache-Control: public, max-age=31536000, immutable

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/data/*
  Cache-Control: public, max-age=31536000, immutable

/
  Cache-Control: no-cache

/impressum
  Cache-Control: no-cache

/datenschutz
  Cache-Control: no-cache

/*.html
  Cache-Control: no-cache
`;
fs.writeFileSync(path.join(PUB, '_headers'), headers);
console.log(`_headers written, ${hashes.size} inline script hash(es)`);
