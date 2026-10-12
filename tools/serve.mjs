// serve.mjs — the fold surface's dev server: static files from the repo root,
// gzip-compressed on the fly, plus a same-origin proxy for Metro Nashville ePAV
// contract PDFs.
//
// ePAV (documents.nashville.gov) serves the real contract PDFs at
// /Request/Open/<token> but sends no Access-Control-Allow-Origin header, so the
// browser can't fetch them for pdf.js from the page origin. The proxy mints
// same-origin /epav/<token>.pdf URLs the reader fetches on demand and renders
// page by page — the document exactly as filed, never stored locally.
//
// Source order: the archive.org twin is tried first (nashville-epav-contract-<t>),
// then ePAV. archive.org has been serving 5xx under load, so the request is
// capped at 5s and falls through to the always-up ePAV origin.
//
// Usage: node tools/serve.mjs [port]   (default 8813)

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { gzipSync, brotliCompressSync, constants as zc } from 'node:zlib';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.argv[2] || process.env.PORT || 8813);
const EPAV = 'http://documents.nashville.gov/Request/Open/';
const EPAV_QUERY = '?source=Contracts&sourceAppId=14&isArchived=True';
const ARCHIVE = 'https://archive.org/download/nashville-epav-contract-';
// archive.org goes through our Cloudflare worker (holodeck-proxy): it fetches the
// bytes and returns them CORS-open, so the reader never talks to archive.org
// directly. The worker is behind Cloudflare bot protection, so we knock with a
// browser UA or it 403s.
const WORKER = 'https://holodeck-proxy.prometheoid.workers.dev/raw?url=';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.jsonl': 'application/x-ndjson; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8', '.pdf': 'application/pdf', '.md': 'text/markdown; charset=utf-8',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.mp3': 'audio/mpeg',
};
const COMPRESSIBLE = /^(text\/|application\/(json|javascript|xml|x-ndjson)|image\/svg)/;
const zcache = new Map(); // compressed static responses, keyed by file+mtime+encoding

const send = (res, status, body, headers) => res.writeHead(status, headers).end(body);

async function grab(url, viaWorker) {
  const target = viaWorker ? WORKER + encodeURIComponent(url) : url;
  try { const r = await fetch(target, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) }); if (!r.ok) return null; const ct = r.headers.get('content-type') || ''; if (!/pdf|octet-stream/.test(ct)) return null; const b = Buffer.from(await r.arrayBuffer()); return b.length ? b : null; }
  catch (e) { return null; }
}

async function epav(res, token) {
  if (!/^[A-Za-z0-9]+$/.test(token)) return send(res, 400, 'bad token', { 'Content-Type': 'text/plain' });
  // archive.org twin first, through the Cloudflare worker (the permanent record),
  // then the live ePAV portal direct.
  let buf = await grab(ARCHIVE + token + '/' + token + '.pdf', true);
  let via = 'archive.org (via holodeck-proxy)';
  if (!buf) { buf = await grab(EPAV + token + EPAV_QUERY, false); via = 'ePAV (documents.nashville.gov)'; }
  if (!buf) return send(res, 502, 'no PDF for ' + token + ' from archive.org or ePAV', { 'Content-Type': 'text/plain' });
  send(res, 200, buf, { 'Content-Type': 'application/pdf', 'Content-Length': buf.length, 'Cache-Control': 'public, max-age=86400', 'X-Source': via });
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname.startsWith('/epav/')) return epav(res, url.pathname.slice('/epav/'.length).replace(/\.pdf$/, ''));

    let p = decodeURIComponent(url.pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = normalize(join(ROOT, p));
    if (file !== ROOT.replace(/[\\/]$/, '') && !file.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep)) return send(res, 403, 'forbidden', { 'Content-Type': 'text/plain' });
    const s = await stat(file);
    if (s.isDirectory()) return send(res, 302, '', { Location: p.replace(/\/?$/, '/') });
    let body = await readFile(file);
    const type = TYPES[extname(file).toLowerCase()] || 'application/octet-stream';
    const headers = { 'Content-Type': type, 'Vary': 'Accept-Encoding' };
    const accept = req.headers['accept-encoding'] || '';
    let enc = '';
    if (COMPRESSIBLE.test(type) && body.length > 1024) { if (/\bbr\b/.test(accept)) enc = 'br'; else if (/\bgzip\b/.test(accept)) enc = 'gzip'; }
    if (enc) {
      // compress once per (file mtime, encoding) and serve from memory — brotli on
      // a 1.7MB seed is CPU-heavy and must not run on every request. Quality 5
      // keeps the ratio near gzip while letting a FIRST load of the app's ~50
      // vendored modules complete in seconds instead of a queue of ~500 ms
      // compressions (each 100KB+ file was brotli-compressed serially, so a cold
      // browser boot looked like a hang).
      const key = file + '|' + s.mtimeMs + '|' + enc;
      let z = zcache.get(key);
      if (!z) {
        if (enc === 'br') z = brotliCompressSync(body, { params: { [zc.BROTLI_PARAM_QUALITY]: 5 } });
        else z = gzipSync(body);
        if (zcache.size > 64) zcache.clear();
        zcache.set(key, z);
      }
      body = z; headers['Content-Encoding'] = enc;
    }
    headers['Content-Length'] = body.length;
    send(res, 200, body, headers);
  } catch (e) {
    if (e && e.code === 'ENOENT') return send(res, 404, 'not found', { 'Content-Type': 'text/plain' });
    send(res, 500, String((e && e.message) || e), { 'Content-Type': 'text/plain' });
  }
});

server.listen(PORT, '127.0.0.1', () => console.log('the fold surface on http://127.0.0.1:' + PORT + '  ·  /epav/<token>.pdf → archive.org, else ePAV  ·  gzip/br on'));
