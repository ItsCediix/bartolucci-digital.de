#!/usr/bin/env node
// Lists the 10 largest files in public/ and the total; fails if any file exceeds the Cloudflare
// Workers Static Assets limit of 25 MiB per file.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(ROOT, 'public');
const LIMIT = 25 * 1024 * 1024;
const files = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else files.push({file: path.relative(PUB, p).replace(/\\/g, '/'), size: fs.statSync(p).size});
  }
};
walk(PUB);
files.sort((a, b) => b.size - a.size);
const total = files.reduce((s, f) => s + f.size, 0);
const mb = (n) => (n / 1024 / 1024).toFixed(2) + ' MB';
const byDir = {};
for (const f of files) {
  const d = f.file.includes('/') ? f.file.split('/')[0] + '/' : '(root)';
  byDir[d] = (byDir[d] || 0) + f.size;
}
console.log(`public/: ${files.length} files, ${mb(total)} total`);
console.log('\nby folder:');
for (const [d, s] of Object.entries(byDir).sort((a, b) => b[1] - a[1])) console.log(`  ${d.padEnd(12)} ${mb(s)}`);
console.log('\nlargest 10 files:');
for (const f of files.slice(0, 10)) console.log(`  ${mb(f.size).padStart(10)}  ${f.file}`);
const over = files.filter((f) => f.size > LIMIT);
if (over.length) {
  console.error(`\nFAIL: ${over.length} file(s) over 25 MiB`, over);
  process.exit(1);
}
console.log(`\nOK: no file over 25 MiB (largest ${mb(files[0].size)})`);
