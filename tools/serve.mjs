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
import { readFile, writeFile, rm, stat, mkdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { execFile, spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
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
// a request body cap (a resource guard, not a decision): DECLARED, giver = this server (II.11).
const MAX_BODY = 48 * 1024 * 1024;
// pipe(cmd, args, input) -> { code, out, err } — the stderr is KEPT, never swallowed, so a converter
// failure names its reason instead of returning a bare null (Feynman).
const pipe = (cmd, args, input) => new Promise((resolve) => {
  let p; try { p = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] }); } catch (e) { return resolve({ code: -1, err: String((e && e.message) || e) }); }
  const o = [], e = []; p.stdout.on('data', d => o.push(d)); p.stderr.on('data', d => e.push(d));
  p.on('error', (err) => resolve({ code: -1, err: String((err && err.message) || err) }));
  p.on('close', (code) => resolve({ code, out: Buffer.concat(o).toString('utf8'), err: Buffer.concat(e).toString('utf8') }));
  p.stdin.end(input || undefined);
});

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

// GET /api/sync-status — the pipeline's live sync state for sync-dashboard.html.
// Pipes tools/sync-status.py over ssh to the VM (fixed argv, no request input in
// the command); the script is read-only and prints one JSON object. Cached 10 s,
// concurrent requests share one ssh.
const LIVE_FILE = '/mnt/watch/nashville-legistar-archive/data/live/events.jsonl';
const liveClients = new Set(); const liveRing = [];
let liveProc = null, liveBuf = '', liveStopT = null;
function liveStart() {
  if (liveProc) return;
  liveProc = spawn('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '-o', 'ServerAliveInterval=15', 'hyphae', 'tail', '-n', '100', '-F', LIVE_FILE], { stdio: ['ignore', 'pipe', 'ignore'] });
  liveProc.stdout.on('data', (b) => {
    liveBuf += b.toString('utf8'); let i;
    while ((i = liveBuf.indexOf('\n')) >= 0) {
      const line = liveBuf.slice(0, i).trim(); liveBuf = liveBuf.slice(i + 1);
      if (!line) continue;
      liveRing.push(line); if (liveRing.length > 100) liveRing.shift();
      for (const c of liveClients) { try { c.write('data: ' + line + '\n\n'); } catch (e) {} }
    }
  });
  liveProc.on('close', () => {
    liveProc = null; liveBuf = '';
    for (const c of liveClients) { try { c.write('event: down\ndata: {}\n\n'); } catch (e) {} }
    if (liveClients.size) setTimeout(liveStart, 3000);        // the pages are still there: reconnect
  });
}
function liveMaybeStop() {
  clearTimeout(liveStopT);
  if (!liveClients.size && liveProc) liveStopT = setTimeout(() => { if (!liveClients.size && liveProc) liveProc.kill(); }, 10000);
}
let syncCache = null, syncInflight = null;
function syncStatus() {
  if (syncCache && Date.now() - syncCache.at < 10000) return Promise.resolve(syncCache.body);
  if (syncInflight) return syncInflight;
  return syncInflight = new Promise((resolve, reject) => {
    const child = execFile('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', 'hyphae', 'python3', '-'],
      { timeout: 25000, maxBuffer: 1 << 20 }, (err, stdout, stderr) => {
        syncInflight = null;
        if (err) return reject(new Error(String(stderr || err.message).trim().slice(0, 400)));
        try { JSON.parse(stdout); } catch (e) { return reject(new Error('VM returned non-JSON output')); }
        syncCache = { at: Date.now(), body: stdout };
        resolve(stdout);
      });
    child.stdin.on('error', () => {});
    createReadStream(join(ROOT, 'tools', 'sync-status.py')).pipe(child.stdin);
  });
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname.startsWith('/epav/')) return epav(res, url.pathname.slice('/epav/'.length).replace(/\.pdf$/, ''));
    // GET /api/live — the pipeline's event stream (events.jsonl on the VM) as server-sent events. One shared
    // `ssh ... tail -F` serves every page; it starts with the first page and stops shortly after the last leaves.
    // Fixed argv, no request input in the command. Each new page first gets the last 100 lines from a ring buffer.
    if (url.pathname === '/api/live') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write(': connected\n\n');
      for (const l of liveRing) res.write('data: ' + l + '\n\n');
      liveClients.add(res); clearTimeout(liveStopT); liveStart();
      const ka = setInterval(() => { try { res.write(': keepalive\n\n'); } catch (e) {} }, 15000);
      req.on('close', () => { clearInterval(ka); liveClients.delete(res); liveMaybeStop(); });
      return;
    }
    if (url.pathname === '/api/sync-status') {
      const h = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
      try { return send(res, 200, await syncStatus(), h); }
      catch (e) { return send(res, 502, JSON.stringify({ error: String((e && e.message) || e) }), h); }
    }

    // POST /convert — turn a dropped PDF or HTML page into text with the platform's OWN converter
    // (pdftotext from poppler; textutil on macOS), never a model. Those tools reconstruct WORDS from
    // the page's glyph advances, which a browser-side extractor (pdf.js getTextContent) does not: a
    // letterspaced PDF comes back as "F R O M" through pdf.js and as "FROM" through poppler. The
    // converter that ran is named in X-Converter. (Measured 2026-10-18, propublica-memo.pdf.)
    if (req.method === 'POST' && url.pathname === '/convert') {
      const chunks = []; let n = 0;
      for await (const c of req) { n += c.length; if (n > MAX_BODY) { req.destroy(); return send(res, 413, 'too large', { 'Content-Type': 'text/plain' }); } chunks.push(c); }
      const buf = Buffer.concat(chunks);
      const head = buf.slice(0, 1024).toString('latin1');
      let text = null, converter = '', failure = '';
      if (buf.length >= 4 && head.startsWith('%PDF')) {
        const r = await pipe('pdftotext', ['-enc', 'UTF-8', '-', '-'], buf);
        if (r.code === 0) { text = r.out; converter = 'pdftotext (poppler)'; } else failure = 'pdftotext: ' + (r.err || ('exit ' + r.code));
      } else if (/^\s*<(?:!doctype html|html|\?xml)/i.test(head)) {
        const tmp = join(tmpdir(), 'hd-convert-' + randomUUID() + '.html');
        try { await writeFile(tmp, buf); const r = await pipe('textutil', ['-convert', 'txt', '-stdout', tmp], null); if (r.code === 0) { text = r.out; converter = 'textutil (macOS)'; } else failure = 'textutil: ' + (r.err || ('exit ' + r.code)); }
        finally { rm(tmp, { force: true }).catch(() => {}); }
      } else {
        text = buf.toString('utf8'); converter = 'none (already text)';
      }
      if (text == null) return send(res, 502, failure || 'the converter failed', { 'Content-Type': 'text/plain; charset=utf-8' });
      return send(res, 200, text, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Converter': converter });
    }

    // POST /ocr — read PIXELS. A scanned PDF has no text layer and an image is only pixels; the platform's
    // own tools read them: pdftoppm rasterises a page, tesseract reads it (a recogniser, never a language
    // model). The response streams one JSON line per page — {event:'start'|'page'|'done'} — so the page
    // can show the text arriving and each page's mean word confidence; a page that fails says why and the
    // rest still read. Pages are capped (?max=, default 40, ceiling 200): a resource guard, declared.
    if (req.method === 'POST' && url.pathname === '/ocr') {
      const chunks = []; let n = 0;
      for await (const c of req) { n += c.length; if (n > MAX_BODY) { req.destroy(); return send(res, 413, 'too large', { 'Content-Type': 'text/plain' }); } chunks.push(c); }
      const buf = Buffer.concat(chunks);
      const head = buf.slice(0, 16).toString('latin1');
      const isPdf = head.startsWith('%PDF');
      const isImg = /^(\x89PNG|\xff\xd8\xff|GIF8|II\*\x00|MM\x00\*|BM|RIFF[\s\S]{4}WEBP)/.test(head);
      if (!isPdf && !isImg) return send(res, 415, 'not a PDF or an image', { 'Content-Type': 'text/plain' });
      const max = Math.min(Math.max(parseInt(url.searchParams.get('max') || '40', 10) || 40, 1), 200);
      const dir = join(tmpdir(), 'hd-ocr-' + randomUUID());
      let gone = false; res.on('close', () => { gone = true; });
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Converter': 'tesseract (OCR)' });
      const line = (o) => { if (!gone) res.write(JSON.stringify(o) + '\n'); };
      try {
        await mkdir(dir, { recursive: true });
        const src = join(dir, 'in'); await writeFile(src, buf);
        let pages = 1;
        if (isPdf) { const info = await pipe('pdfinfo', [src], null); pages = parseInt((/Pages:\s+(\d+)/.exec(info.out || '') || [])[1], 10) || 1; }
        const total = Math.min(pages, max);
        line({ event: 'start', kind: isPdf ? 'pdf' : 'image', pages, total, engine: 'tesseract', lang: 'eng' });
        for (let i = 1; i <= total && !gone; i++) {
          let img = src;
          if (isPdf) {
            const base = join(dir, 'p' + i);
            const r = await pipe('pdftoppm', ['-r', '200', '-f', String(i), '-l', String(i), '-png', '-singlefile', src, base], null);
            if (r.code !== 0) { line({ event: 'page', page: i, error: 'pdftoppm: ' + (r.err || 'exit ' + r.code) }); continue; }
            img = base + '.png';
          }
          const t = await pipe('tesseract', [img, 'stdout', '-l', 'eng', '--psm', '3', 'tsv'], null);
          if (isPdf) rm(img, { force: true }).catch(() => {});
          if (t.code !== 0) { line({ event: 'page', page: i, error: 'tesseract: ' + (t.err || 'exit ' + t.code) }); continue; }
          // tsv → text: words (level 5) regrouped into their own lines and paragraphs, with the engine's confidence kept
          const rows = t.out.split('\n').slice(1).map((l) => l.split('\t')).filter((c) => c.length >= 12 && c[0] === '5' && c[11].trim() && parseFloat(c[10]) >= 0);
          let text = '', prev = '', sum = 0;
          for (const c of rows) {
            const key = c[2] + '.' + c[3] + '.' + c[4]; const par = c[2] + '.' + c[3];
            if (prev) text += key === prev ? ' ' : (par === prev.split('.').slice(0, 2).join('.') ? '\n' : '\n\n');
            text += c[11]; prev = key; sum += parseFloat(c[10]);
          }
          line({ event: 'page', page: i, text, words: rows.length, conf: rows.length ? Math.round(sum / rows.length) : null });
        }
        line({ event: 'done', pages, total });
      } catch (e) { line({ event: 'error', error: String((e && e.message) || e) }); }
      finally { rm(dir, { recursive: true, force: true }).catch(() => {}); res.end(); }
      return;
    }

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
