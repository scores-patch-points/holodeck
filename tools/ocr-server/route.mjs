// route.mjs — the HTTP face of the OCR reader, shared by the dev server (tools/serve.mjs mounts it at POST /ocr) and by
// the standalone loopback service (server.mjs). The response is one JSON line per event, as /ocr always was:
//   {event:'start', kind, pages, total, engine, engines, textLayerPages, scannedPages, prior}
//   {event:'page', page, text, words, conf, eye, witnesses?, fusion?, dropped?, error?}     in page order
//   {event:'done', pages, total, textLayer, ocr, ms}
// A request is refused before any line is written when the body is not a PDF or an image (415), too big (413), or when
// something it needs is missing (503, with the install line for this platform) — so a page that gets a 503 falls back to
// reading in the browser, as reading/demo.html does.
import { readDocument, health } from './reader.mjs';

// a request body cap (a resource guard, not a decision): DECLARED, giver = this server
export const MAX_BODY = 48 * 1024 * 1024;

const plain = (res, status, msg) => res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }).end(msg);
const LOOPBACK = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
const extra = (process.env.HD_OCR_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);

/** CORS for the standalone service: loopback pages, plus any origin named in HD_OCR_ORIGINS. Never a wildcard. */
export function corsHeaders(req) {
  const o = req.headers.origin;
  if (!o || !(LOOPBACK.test(o) || extra.includes(o))) return {};
  return { 'Access-Control-Allow-Origin': o, 'Vary': 'Origin', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' };
}

export async function handleHealth(req, res, headers = {}) {
  const h = await health({ force: true });
  res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers }).end(JSON.stringify(h));
}

/** POST /ocr?max=40&dpi=220&lang=eng&pool=2&policy=keep-base|strict — body = the PDF or image bytes */
export async function handleOcr(req, res, url, headers = {}) {
  const chunks = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > MAX_BODY) { req.destroy(); return plain(res, 413, 'too large'); } chunks.push(c); }
  const buf = Buffer.concat(chunks);
  const q = url.searchParams;
  const num = (k, d, lo, hi) => Math.min(Math.max(parseInt(q.get(k) || '', 10) || d, lo), hi);
  const lang = /^[A-Za-z_+]{2,24}$/.test(q.get('lang') || '') ? q.get('lang') : 'eng';
  const ac = new AbortController(); res.on('close', () => ac.abort());
  let started = false;
  const emit = (o) => {
    if (!started) { started = true; res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Converter': 'ocr (' + (o.engine || 'text layer') + ')', ...headers }); }
    if (!ac.signal.aborted && !res.writableEnded) res.write(JSON.stringify(o) + '\n');
  };
  try {
    // max pages: a resource guard, declared (default 40, ceiling 2000 — text-layer pages cost almost nothing)
    await readDocument(buf, { max: num('max', 40, 1, 2000), dpi: num('dpi', 220, 72, 400), pool: num('pool', 2, 1, 8), lang, policy: q.get('policy') === 'strict' ? 'strict' : 'keep-base', signal: ac.signal }, emit);
  } catch (e) {
    if (!started) return plain(res, e.status || 500, String((e && e.message) || e));
    emit({ event: 'error', error: String((e && e.message) || e) });
  }
  if (!res.writableEnded) res.end();
}
