#!/usr/bin/env node
// v19: local static server that sends the global headers of public/_headers (CSP included), so a wrong inline-script
// hash shows up locally as "Refused to execute inline script" instead of only after the deploy (`serve` ignores
// _headers). Clean URLs like Cloudflare (/impressum -> impressum.html), 404.html for unknown paths. No dependencies.
//   node scripts/serve-headers.mjs [--port 4174] [--root public]
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : def; };
const PORT = +arg('port', 4174);
const PUB = path.resolve(ROOT, arg('root', 'public'));
const TYPES = {'.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml'};

// the "/*" block of _headers: indented "Name: value" lines up to the next blank line
const global = {};
const lines = fs.readFileSync(path.join(PUB, '_headers'), 'utf8').split('\n');
for (let i = lines.indexOf('/*') + 1; i > 0 && i < lines.length && lines[i].trim(); i++) {
  const m = /^\s+([\w-]+):\s*(.+)$/.exec(lines[i]);
  if (m && m[1] !== 'Strict-Transport-Security') global[m[1]] = m[2];
}

http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const candidates = url.endsWith('/') ? [url + 'index.html'] : [url, url + '.html'];
  let file = null;
  for (const c of candidates) {
    const p = path.join(PUB, path.normalize(c));
    if (p.startsWith(PUB) && fs.existsSync(p) && fs.statSync(p).isFile()) { file = p; break; }
  }
  const status = file ? 200 : 404;
  if (!file) file = path.join(PUB, '404.html');
  res.writeHead(status, {...global, 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache'});
  res.end(fs.readFileSync(file));
}).listen(PORT, () => console.log(`serve-headers: http://localhost:${PORT} (${Object.keys(global).length} global headers from _headers)`));
