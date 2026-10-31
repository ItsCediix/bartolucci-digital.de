#!/usr/bin/env node
// v19 CSP hash gate. v18.1 shipped _headers with the hashes of the CRLF copy of index.html while the deploy serves
// LF, so both inline scripts were refused and the live site ran in its no-JS fallback for a day. This gate reads
// every HTML page in public/ as bytes and fails when
//   - a page contains \r\n (the hash in _headers would not match the deployed LF file),
//   - an executable inline <script> (no src, not a JSON data block) has no matching sha256 in script-src,
//   - a sha256 in script-src (or style-src) matches no inline block on any page (stale hash),
//   - script-src allows 'unsafe-inline', or form-action / connect-src are no longer 'none'.
// Inline <style> blocks are hashed and compared only when style-src lists hashes; with 'unsafe-inline' in
// style-src (the state since v9: the skyline uses style attributes) they are not covered by a hash and only counted.
// No dependencies. Run after `npm run build`: node scripts/qa-csp.mjs (also `npm run qa:csp`).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// optional first argument: another build output to check (e.g. a CRLF copy, to see the gate fail)
const PUB = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'public');

const headers = fs.readFileSync(path.join(PUB, '_headers'), 'utf8');
const cspLine = /Content-Security-Policy:\s*(.+)/.exec(headers);
if (!cspLine) { console.error('qa-csp: no Content-Security-Policy in public/_headers'); process.exit(1); }
const directives = Object.fromEntries(cspLine[1].split(';').map((s) => s.trim()).filter(Boolean).map((s) => {
  const [name, ...values] = s.split(/\s+/);
  return [name, values];
}));
const hashesOf = (dir) => (directives[dir] || []).filter((v) => /^'sha256-/.test(v)).map((v) => v.slice(8, -1));

const problems = [];
const rows = [];
const policy = (cond, msg) => { if (!cond) problems.push({file: '_headers', pos: '-', expected: msg, found: 'not set'}); };
policy(!(directives['script-src'] || []).includes("'unsafe-inline'"), "script-src without 'unsafe-inline'");
policy((directives['form-action'] || []).join(' ') === "'none'", "form-action 'none'");
policy((directives['connect-src'] || []).join(' ') === "'none'", "connect-src 'none'");

const scriptHashes = hashesOf('script-src');
const styleHashes = hashesOf('style-src');
const styleByHash = styleHashes.length > 0;
const used = new Set();
let styleCount = 0;

const lineOf = (text, index) => text.slice(0, index).split('\n').length;
const sha = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('base64');

const pages = fs.readdirSync(PUB).filter((f) => f.endsWith('.html')).sort();
for (const file of pages) {
  const bytes = fs.readFileSync(path.join(PUB, file));
  const crlf = bytes.includes(Buffer.from('\r\n'));
  if (crlf) problems.push({file, pos: '-', expected: 'LF line endings', found: 'CRLF (\\r\\n) in file'});
  const html = bytes.toString('utf8');
  const blocks = [];
  let m;
  const scriptRe = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi;
  while ((m = scriptRe.exec(html))) {
    if (/type\s*=\s*["']application\/(ld\+)?json["']/i.test(m[1])) continue; // data block, never executed
    blocks.push({kind: 'script', index: m.index, body: m[2]});
  }
  const styleRe = /<style([^>]*)>([\s\S]*?)<\/style>/gi;
  while ((m = styleRe.exec(html))) blocks.push({kind: 'style', index: m.index, body: m[2]});
  for (const b of blocks) {
    const h = sha(b.body);
    const pos = `line ${lineOf(html, b.index)} (${b.kind})`;
    if (b.kind === 'style') {
      styleCount++;
      if (!styleByHash) continue;
      if (styleHashes.includes(h)) { used.add('style:' + h); rows.push({file, pos, hash: h, ok: true}); }
      else problems.push({file, pos, expected: '(one of style-src)', found: h});
      continue;
    }
    if (scriptHashes.includes(h)) { used.add('script:' + h); rows.push({file, pos, hash: h, ok: true}); }
    else problems.push({file, pos, expected: '(one of script-src)', found: h});
  }
}
for (const h of scriptHashes) if (!used.has('script:' + h)) problems.push({file: '_headers', pos: 'script-src', expected: h, found: 'matches no inline script'});
for (const h of styleHashes) if (!used.has('style:' + h)) problems.push({file: '_headers', pos: 'style-src', expected: h, found: 'matches no inline style'});

console.log(`qa-csp: ${pages.length} page(s), ${rows.length} inline block(s) matched, script-src hashes ${scriptHashes.length}, inline <style> ${styleCount} (${styleByHash ? 'hashed' : "style-src 'unsafe-inline', not hashed"})`);
for (const r of rows) console.log(`  ok    ${r.file.padEnd(18)} ${r.pos.padEnd(22)} ${r.hash}`);
if (problems.length) {
  console.log('\nqa-csp: FAIL');
  console.log(`  ${'file'.padEnd(18)} ${'position'.padEnd(22)} ${'expected'.padEnd(46)} found`);
  for (const p of problems) console.log(`  ${p.file.padEnd(18)} ${p.pos.padEnd(22)} ${String(p.expected).padEnd(46)} ${p.found}`);
  process.exit(1);
}
console.log('qa-csp: PASS');
