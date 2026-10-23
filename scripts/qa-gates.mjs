#!/usr/bin/env node
// Static design + wording gates of v11 over public/ (writes review/gates.json, exit 1 on a failed gate):
//  - every border-left / border-inline-start in CSS is listed (each must be justified in REPORT.md)
//  - no eyebrow / kicker / overline classes in HTML, CSS or JS
//  - no phone-frame classes (.device, .phone, .phone-gloss, device-screen) left
//  - .facts has no ::before / ::after markers, no list-style other than none
//  - forbidden words: zero hits in public/ (text files)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(ROOT, 'public');
const files = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'vendor' && e.name !== 'fonts') walk(p); } else if (/\.(html|css|js|json|svg|md|txt|xml)$/.test(e.name)) files.push(p);
  }
};
walk(PUB);
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');
const hits = (re, filter = () => true) => {
  const out = [];
  for (const f of files.filter(filter)) {
    fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => { if (re.test(line)) out.push(`${rel(f)}:${i + 1}: ${line.trim().slice(0, 160)}`); });
  }
  return out;
};
const css = (f) => f.endsWith('.css');
const gates = {
  borderLeft: hits(/border-(left|inline-start)\s*:/i, css),
  eyebrow: hits(/eyebrow|kicker|overline/i, (f) => /\.(html|css|js)$/.test(f)),
  // the laptop + phone *inside* the website scene (.ws-phone) are content devices and allowed
  phoneFrame: hits(/class="(?:[^"]*\s)?(device|phone|phone-gloss|device-screen)(?=["\s])|(?<![\w-])\.(device|phone|phone-gloss|device-screen)(?![\w-])|getElementById\(['"]phone['"]\)/, (f) => /\.(html|css|js)$/.test(f)),
  factsMarkers: hits(/\.facts[^{]*::?(before|after)|\.facts[^{]*\{[^}]*list-style:\s*(?!none)[a-z]/, css),
  forbiddenWords: hits(/ganzheitlich|maßgeschneidert|innovativ|Lösungen|Synergien|digital transformieren|state of the art|KI-gestützt|revolutionär/i),
};
const failed = Object.entries(gates).filter(([k, v]) => k !== 'borderLeft' && v.length);
fs.mkdirSync(path.join(ROOT, 'review'), {recursive: true});
fs.writeFileSync(path.join(ROOT, 'review', 'gates.json'), JSON.stringify(gates, null, 2));
for (const [k, v] of Object.entries(gates)) console.log(`${k}: ${v.length}${v.length ? '\n  ' + v.join('\n  ') : ''}`);
if (gates.borderLeft.length) { console.error('FAIL: border-left stripes found (justify or remove)'); process.exitCode = 1; }
if (failed.length) { console.error('FAIL:', failed.map(([k]) => k).join(', ')); process.exitCode = 1; }
