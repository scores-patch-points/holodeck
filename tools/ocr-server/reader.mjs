// reader.mjs — read a PDF or an image into text, page by page, with the eyes this machine has.
//
//   a page that carries its own characters   -> its text layer (exact, nearly free); no pixels are read
//   a page that does not (a scan, a photo)   -> every on-device eye reads it, and the eyes are folded into one
//                                               reading by fuse.mjs, with the document's own words as the prior
//
// Which eye runs is SENSED from the bytes, never chosen up front (holodeck-eyes.js: "a PDF that carries a text layer
// never needs OCR"). Every disagreement between the eyes is returned with the page, so a reader can see what was
// dropped and which eye said it. Events are the /ocr route's: start, page (in page order), done.
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run, have } from './proc.mjs';
import { detect } from './engines.mjs';
import { Prior, fuse } from './fuse.mjs';

const IMAGE_TYPES = [[/^\x89PNG/, 'png'], [/^\xff\xd8\xff/, 'jpg'], [/^GIF8/, 'gif'], [/^(II\*\x00|MM\x00\*)/, 'tif'], [/^BM/, 'bmp'], [/^RIFF[\s\S]{4}WEBP/, 'webp']];
const headOf = (buf) => Buffer.from(buf.slice(0, 16)).toString('latin1');

/** 'pdf' | 'image' | null, from the file's own first bytes */
export function sniff(buf) {
  const head = headOf(buf);
  if (head.startsWith('%PDF')) return 'pdf';
  return IMAGE_TYPES.some(([re]) => re.test(head)) ? 'image' : null;
}

// dpi 220 for pixels: on 24 screenshot-quality scan pages (144 ppi images), the two eyes agreed with each other at F1 0.882 when the
// page was rendered at 150 dpi, 0.925 at 220, 0.922 at 300 (and 300 took twice as long). No ground truth exists for a scan; this is agreement.
const err = (status, message) => Object.assign(new Error(message), { status });
const chars = (t) => (String(t || '').match(/[\p{L}\p{N}]/gu) || []).length;
const wordCount = (t) => (String(t || '').match(/\S+/g) || []).length;
const INSTALL = {
  darwin: 'brew install tesseract poppler  (Apple Vision needs the Xcode command line tools: xcode-select --install)',
  linux: 'apt install tesseract-ocr poppler-utils  (or your distribution\'s packages)',
  win32: 'install Tesseract (the UB-Mannheim build) and Poppler for Windows, and put both on PATH',
};

/** a counting gate: at most `n` tasks run at once */
function gate(n) {
  let free = Math.max(1, n); const q = [];
  const next = () => { if (free > 0 && q.length) { free--; q.shift()(); } };
  return (task) => new Promise((resolve, reject) => { q.push(() => task().then(resolve, reject).finally(() => { free++; next(); })); next(); });
}

/** mean confidence of an eye's lines, weighted by words (0..100) */
const meanConf = (lines) => { let w = 0, s = 0; for (const l of lines) { const n = (l.words && l.words.length) || wordCount(l.t); w += n; s += (l.c ?? 0) * n; } return w ? Math.round(s / w) : null; };

/** what this machine can do, for GET /health */
export async function health({ force = false } = {}) {
  const { report, eyes } = await detect({ force });
  const poppler = {}; for (const c of ['pdfinfo', 'pdftotext', 'pdftoppm']) poppler[c] = await have(c, ['-v']);
  return { ok: true, platform: process.platform, canReadPixels: eyes.length > 0, eyes: eyes.map((e) => e.id), engines: report, poppler,
    privacy: 'every engine listed is on-device; the recognisers open no sockets (check.mjs --offline proves it for Apple Vision on macOS)',
    install: eyes.length ? null : INSTALL[process.platform] || 'install tesseract' };
}

/**
 * readDocument(buf, opts, emit) -> { pages, total, textLayer, ocr, ms }
 * opts: { max = 40 (first N pages), dpi = 220, lang = 'eng', pool = 2, minChars = 80, policy = 'keep-base', engines (inject), signal }
 * emit({ event: 'start' | 'page' | 'done', ... }) — page events arrive in page order.
 * Throws an Error with .status (415 not a PDF or an image, 503 something needed is missing) before anything is emitted.
 */
export async function readDocument(buf, opts = {}, emit = () => {}) {
  const o = { max: 40, dpi: 220, lang: 'eng', pool: 2, minChars: 80, policy: 'keep-base', ...opts };
  const kind = sniff(buf); if (!kind) throw err(415, 'not a PDF or an image');
  const t0 = Date.now();
  const eyes = (o.engines || (await detect()).eyes).slice(0, 2);
  const dir = await mkdtemp(join(tmpdir(), 'hd-ocr-'));
  try {
    const isPdf = kind === 'pdf';
    const ext = isPdf ? 'pdf' : (IMAGE_TYPES.find(([re]) => re.test(headOf(buf))) || [0, 'img'])[1];
    const src = join(dir, 'in.' + ext); await writeFile(src, buf);
    let pages = 1, layer = null, layerNote = null;
    if (isPdf) {
      const info = await run('pdfinfo', [src], { timeout: 30000 });
      if (info.code === -1) throw err(503, 'pdfinfo (poppler) is not installed — ' + (INSTALL[process.platform] || ''));
      pages = parseInt((/Pages:\s+(\d+)/.exec(info.out) || [])[1], 10) || 1;
    }
    const total = Math.min(pages, Math.max(1, o.max));

    // ── the text layer: one call for the whole range, split on form feeds ───────────────────────────────────────
    if (isPdf) {
      const tl = await run('pdftotext', ['-layout', '-f', '1', '-l', String(total), src, '-'], { timeout: 300000 });
      if (tl.code === 0) layer = tl.out.split('\f'); else layerNote = 'no text layer read: ' + (tl.err.trim().split('\n').pop() || 'pdftotext exit ' + tl.code);
    }
    const layerText = (n) => (layer && layer[n - 1] != null ? layer[n - 1].replace(/\r/g, '').replace(/\s+$/, '') : '');
    const scanned = []; // pages whose characters are absent, or too few to be the page
    for (let n = 1; n <= total; n++) if (!layer || chars(layerText(n)) < o.minChars) scanned.push(n);
    if (scanned.length && !eyes.length) throw err(503, 'nothing on this machine can read pixels yet (' + scanned.length + ' of ' + total + ' pages need it) — ' + (INSTALL[process.platform] || 'install tesseract'));

    // ── the prior: the words this document already uses, counted by page ───────────────────────────────────────
    const prior = new Prior(2);
    if (layer) { const isScan = new Set(scanned); for (let n = 1; n <= total; n++) if (!isScan.has(n)) prior.add(layerText(n)); }
    const bootstrap = scanned.length > 1 && prior.pages < 3; // too little of the document speaks for itself: let the eyes' agreed words speak

    emit({ event: 'start', kind, pages, total, engine: eyes.map((e) => e.id).join('+') || 'text layer', engines: eyes.map((e) => ({ id: e.id, label: e.label })),
      lang: o.lang, dpi: o.dpi, textLayerPages: total - scanned.length, scannedPages: scanned.length, prior: { pages: prior.pages, words: prior.size, bootstrap }, ...(layerNote ? { note: layerNote } : {}) });

    // ── a scanned page: rasterise, let each eye read it, keep each eye's lines ──────────────────────────────────
    const gated = gate(o.pool);
    const readEyes = async (n) => {
      if (o.signal && o.signal.aborted) return { n, skipped: true };
      let img = src;
      if (isPdf) {
        const base = join(dir, 'p' + n);
        const r = await run('pdftoppm', ['-r', String(o.dpi), '-f', String(n), '-l', String(n), '-png', '-singlefile', src, base], { timeout: 120000 });
        if (r.code !== 0) return { n, error: 'pdftoppm: ' + (r.err.trim().split('\n').pop() || 'exit ' + r.code) };
        img = base + '.png';
      }
      const got = await Promise.all(eyes.map(async (e) => { try { const [r] = await e.read([img], { lang: o.lang }); return { eye: e.id, ...r }; } catch (x) { return { eye: e.id, error: String((x && x.message) || x) }; } }));
      if (isPdf) rm(img, { force: true }).catch(() => {});
      return { n, got };
    };
    const raw = new Map(scanned.map((n) => [n, gated(() => readEyes(n))]));

    // bootstrap: with little text layer, build the prior from the words the two eyes AGREE on, page by page
    const own = new Map();
    if (bootstrap) {
      const empty = new Prior(2);
      for (const n of scanned) {
        const r = await raw.get(n); const ok = (r.got || []).filter((g) => g.lines);
        if (ok.length === 2) own.set(n, prior.add(fuse(ok[0].lines, ok[1].lines, empty).agreed.join(' ')));
      }
    }

    // ── fold one scanned page's readings into the page event ───────────────────────────────────────────────────
    const scannedPage = (n, r) => {
      if (r.skipped) return null;
      if (r.error) return { event: 'page', page: n, error: r.error };
      const ok = r.got.filter((g) => g.lines), bad = r.got.filter((g) => g.error);
      if (!ok.length) return { event: 'page', page: n, error: bad.map((b) => b.error).join('; ') || 'no eye could read the page' };
      const witnesses = ok.map((g) => ({ eye: g.eye, words: g.lines.reduce((a, l) => a + wordCount(l.t), 0), conf: meanConf(g.lines), ms: g.ms }));
      let text, eye, extra = {};
      if (ok.length === 1) { text = ok[0].lines.map((l) => l.t).join('\n'); eye = ok[0].eye; }
      else {
        const f = fuse(ok[0].lines, ok[1].lines, prior, { own: own.get(n) || null, policy: o.policy });
        text = f.text; eye = ok.map((g) => g.eye).join('+');
        extra = { fusion: { ...f.stats, aligned: f.aligned, priorPages: prior.pages }, dropped: f.dropped.slice(0, 60) };
      }
      if (bad.length) extra.note = bad.map((b) => b.error).join('; ');
      // a page that carries a little text of its own and whose pixels gave less: the characters stand
      const lt = layerText(n);
      if (lt && chars(lt) > chars(text)) return { event: 'page', page: n, text: lt, words: wordCount(lt), conf: null, eye: 'textlayer', witnesses };
      return { event: 'page', page: n, text, words: wordCount(text), conf: meanConf(ok[0].lines), eye, witnesses, ...extra };
    };

    let nText = 0, nOcr = 0;
    for (let n = 1; n <= total; n++) {
      if (o.signal && o.signal.aborted) break;
      let ev;
      if (raw.has(n)) {
        ev = scannedPage(n, await raw.get(n));
        if (ev && !ev.error) { if (ev.eye === 'textlayer') nText++; else nOcr++; }
      } else { const t = layerText(n); ev = { event: 'page', page: n, text: t, words: wordCount(t), conf: null, eye: 'textlayer' }; nText++; }
      if (ev) emit(ev);
    }
    const out = { pages, total, textLayer: nText, ocr: nOcr, ms: Date.now() - t0 };
    emit({ event: 'done', ...out });
    return out;
  } finally { rm(dir, { recursive: true, force: true }).catch(() => {}); }
}
