/**
 * Local static + /api/ask server for the personal-site demo.
 * Uses process.env.CLOD_API_KEY (never hard-code the key).
 *
 *   node scripts/local-server.mjs
 *   open http://127.0.0.1:4173
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 4173);
const askHandler = require('../api/ask.js');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) return send(res, 403, 'Forbidden');
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return send(res, 404, 'Not found');
  }
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const urlPath = (req.url || '').split('?')[0];
  if (urlPath === '/api/ask' || urlPath === '/api/ask/') {
    try {
      await askHandler(req, res);
    } catch (err) {
      console.error(err);
      if (!res.headersSent) send(res, 500, JSON.stringify({ error: 'server_error' }), {
        'Content-Type': 'application/json'
      });
    }
    return;
  }
  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res);
  send(res, 405, 'Method not allowed');
});

if (!process.env.CLOD_API_KEY) {
  console.warn('[warn] CLOD_API_KEY is not set. /api/ask will return missing_api_key.');
} else {
  console.log('[ok] CLOD_API_KEY detected (length %d)', process.env.CLOD_API_KEY.length);
  console.log('[ok] model=%s base=%s', process.env.CLOD_MODEL || 'GPT OSS 20B', process.env.CLOD_BASE_URL || 'https://api.clod.io/v1');
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Personal site demo: http://127.0.0.1:${PORT}`);
  console.log(`Ask page:           http://127.0.0.1:${PORT}/pages/ask.html`);
});
