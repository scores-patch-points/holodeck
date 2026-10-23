#!/usr/bin/env node
// server.mjs — the fold's local OCR service. A tiny loopback HTTP service, the same pattern as tools/asr-server.py:
// the bytes go to 127.0.0.1, the text comes back, nothing leaves the machine.
//
//   GET  /health   -> { ok, platform, canReadPixels, eyes, engines:[{ id, label, ok, version?, note?, hint? }], poppler, privacy, install }
//   POST /ocr      -> NDJSON events (see route.mjs); body = a PDF or an image; ?max=40&dpi=220&lang=eng&pool=2&policy=keep-base|strict
//
// Usage:  node tools/ocr-server/server.mjs [--port 11461] [--host 127.0.0.1]     (or: npm run ocr)
// HD_OCR_ENGINES=tesseract narrows the eyes; HD_OCR_ORIGINS=https://my.site lets that page call this service.
import { createServer } from 'node:http';
import { handleOcr, handleHealth, corsHeaders } from './route.mjs';
import { detect } from './engines.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const PORT = Number(arg('port', process.env.FOLD_OCR_PORT || 11461));
const HOST = arg('host', process.env.FOLD_OCR_HOST || '127.0.0.1');
const log = (...a) => console.error('[ocr]', ...a);

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const cors = corsHeaders(req);
  try {
    if (req.method === 'OPTIONS') return res.writeHead(204, cors).end();
    if (req.method === 'GET' && url.pathname === '/health') return await handleHealth(req, res, cors);
    if (req.method === 'POST' && url.pathname === '/ocr') return await handleOcr(req, res, url, cors);
    res.writeHead(404, { 'Content-Type': 'application/json', ...cors }).end(JSON.stringify({ error: 'not found' }));
  } catch (e) {
    log('ERROR', e);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json', ...cors });
    res.end(JSON.stringify({ error: String((e && e.message) || e) }));
  }
});

server.listen(PORT, HOST, async () => {
  log(`listening on http://${HOST}:${PORT}`);
  const { report } = await detect({ force: true }); // prewarm: compiles the Apple Vision helper on the first run
  for (const r of report) log(`${r.label}: ${r.ok ? 'ready' + (r.version ? ' (' + r.version + ')' : '') : 'not available — ' + (r.note || r.hint || '')}`);
});
