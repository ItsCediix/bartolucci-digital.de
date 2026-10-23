#!/usr/bin/env node
// Compares the text content of impressum.html and datenschutz.html between origin/main and the working
// tree. Only the <main> content counts (the header/back link wrapper is design, not legal text);
// whitespace is normalised. Exit code 1 on any difference.
//   node scripts/qa-legal.mjs [--ref origin/main]
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const i = process.argv.indexOf('--ref');
const REF = i >= 0 ? process.argv[i + 1] : 'origin/main';
const textNodes = (html) => {
  const main = (html.match(/<main[^>]*>([\s\S]*?)<\/main>/i) || [, html])[1];
  return main
    .replace(/<!--[\s\S]*?-->/g, ' ') // commented-out placeholders are not visible text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h1|h2|h3|li|ul|div)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
};
let diffs = 0;
const out = {};
for (const f of ['impressum.html', 'datenschutz.html']) {
  const a = textNodes(execFileSync('git', ['-C', ROOT, 'show', `${REF}:public/${f}`], {encoding: 'utf8'}));
  const b = textNodes(fs.readFileSync(path.join(ROOT, 'public', f), 'utf8'));
  const onlyA = a.filter((l) => !b.includes(l));
  const onlyB = b.filter((l) => !a.includes(l));
  out[f] = {linesMain: a.length, linesBranch: b.length, onlyInMain: onlyA, onlyInBranch: onlyB};
  diffs += onlyA.length + onlyB.length;
  console.log(`${f}: ${a.length} lines in ${REF}, ${b.length} on the branch, ${onlyA.length + onlyB.length} differences`);
  onlyA.forEach((l) => console.log(`  - ${l}`));
  onlyB.forEach((l) => console.log(`  + ${l}`));
}
fs.mkdirSync(path.join(ROOT, 'review'), {recursive: true});
fs.writeFileSync(path.join(ROOT, 'review', 'legal-diff.json'), JSON.stringify({ref: REF, differences: diffs, files: out}, null, 2));
process.exitCode = diffs ? 1 : 0;
