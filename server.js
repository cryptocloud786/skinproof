// SkinProof local server (zero dependencies, Node 18+).
// Serves the static app and proxies /api/s2s/* to the YouCam API with YOUCAM_API_KEY,
// so the key stays on the server and never reaches the browser.
//
//   YOUCAM_API_KEY=sk-... node server.js            # India region (default)
//   YOUCAM_API_HOST=https://yce-api-01.perfectcorp.com YOUCAM_API_KEY=sk-... node server.js
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = process.env.PORT || 8787;
const HOST = process.env.YOUCAM_API_HOST || 'https://yce-api-01.makeupar.com';
const KEY = process.env.YOUCAM_API_KEY || '';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
// Only these YouCam endpoints are forwarded
const ALLOWED = [/^\/s2s\/v2\.0\/file$/, /^\/s2s\/v2\.0\/task\/(skin-analysis|skin-simulation)(\/[\w\-+=%]+)?$/];

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/api/health') return json(res, 200, { proxy: !!KEY, host: HOST });
    if (url.pathname.startsWith('/api/')) {
      const path = url.pathname.slice(4);
      if (!KEY) return json(res, 503, { error: 'Server has no YOUCAM_API_KEY set' });
      if (!ALLOWED.some((r) => r.test(path))) return json(res, 404, { error: 'Not allowed' });
      const body = req.method === 'POST' ? await readBody(req) : undefined;
      const up = await fetch(HOST + path, { method: req.method, body,
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' } });
      res.writeHead(up.status, { 'Content-Type': 'application/json' });
      return res.end(await up.text());
    }
    let file = normalize(join(ROOT, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname)));
    if (!file.startsWith(ROOT) || file.includes('node_modules') || file.endsWith('.env')) return json(res, 403, { error: 'Forbidden' });
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    json(res, e.code === 'ENOENT' ? 404 : 500, { error: e.code === 'ENOENT' ? 'Not found' : e.message });
  }
});

function readBody(req) {
  return new Promise((resolve, reject) => {
    let d = ''; req.on('data', (c) => { d += c; if (d.length > 1e6) req.destroy(); });
    req.on('end', () => resolve(d)); req.on('error', reject);
  });
}
function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }

server.listen(PORT, () => console.log(`SkinProof on http://localhost:${PORT}  (proxy ${KEY ? 'ON' : 'OFF - demo / bring-your-own-key'} -> ${HOST})`));
