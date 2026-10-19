// build-offline-manifest.mjs — the list of everything the reading demo needs, so a browser can fetch it ONCE and then work with the network off.
//
// The list is COMPUTED, never hand-kept: it crawls the page's own import and fetch graph (every relative string that names a .js / .mjs /
// .json file that exists), the same closure a bundler would walk, then adds the few pinned third-party assets that are loaded from a CDN
// at run time (the PDF renderer and the OCR engine). Output: reading/offline-manifest.json, read by reading/offline.js and the service worker.
//
// Usage: node tools/build-offline-manifest.mjs            (writes reading/offline-manifest.json)
//        node tools/build-offline-manifest.mjs --check    (exits 1 if the committed manifest is stale)
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENTRIES = ['reading/demo.html', 'reading/how-it-reads.html'];
const OUT = resolve(ROOT, 'reading/offline-manifest.json');

// Pinned third-party assets the page loads at run time. Exact versions, immutable URLs: a cached copy is the same bytes forever.
export const EXTERNAL = [
  { url: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.min.mjs', role: 'pdf.js — reads a PDF’s text layer and renders scanned pages', group: 'ocr' },
  { url: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs', role: 'pdf.js worker', group: 'ocr' },
  { url: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js', role: 'tesseract.js — OCR in this browser', group: 'ocr' },
  { url: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js', role: 'tesseract.js worker', group: 'ocr' },
  { url: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-simd-lstm.wasm.js', role: 'tesseract engine (WASM, SIMD)', group: 'ocr' },
  { url: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-lstm.wasm.js', role: 'tesseract engine (WASM, no SIMD — only fetched by browsers without SIMD)', group: 'ocr-compat' },
  { url: 'https://tessdata.projectnaptha.com/4.0.0_fast/eng.traineddata.gz', role: 'English recognition model (fast, 2 MB)', group: 'ocr' },
];

const LITERAL = /['"`](\.{1,2}\/[^'"`\s${}()]+?\.(?:m?js|json))['"`]/g;
const seen = new Set();
const files = [];
const crawl = (abs) => {
  if (seen.has(abs) || !existsSync(abs)) return;
  seen.add(abs);
  files.push(abs);
  if (!/\.(m?js|html)$/.test(abs)) return;
  const src = readFileSync(abs, 'utf8');
  for (const m of src.matchAll(LITERAL)) {
    const next = resolve(dirname(abs), m[1]);
    if (next.startsWith(ROOT + sep) && existsSync(next)) crawl(next);
  }
};
const manifest = () => {
  seen.clear(); files.length = 0;
  for (const e of ENTRIES) crawl(resolve(ROOT, e));
  const local = files.map((abs) => ({ url: '/' + relative(ROOT, abs).split(sep).join('/'), bytes: statSync(abs).size, group: abs.endsWith('.json') ? 'data' : 'core' })).sort((a, b) => (a.url < b.url ? -1 : 1));
  const all = [...local, ...EXTERNAL.map((e) => ({ ...e, bytes: null }))];
  // the version is the hash of WHAT is listed (not when it was built), so an unchanged page never re-downloads
  const version = createHash('sha256').update(JSON.stringify(all.map((x) => [x.url, x.bytes]))).digest('hex').slice(0, 12);
  return { schema: 'OfflineManifest@1', version, note: 'Computed by tools/build-offline-manifest.mjs from the page’s own import/fetch graph. Local urls are root-relative; they are resolved against the site’s base at run time.', localBytes: local.reduce((a, b) => a + b.bytes, 0), files: all };
};

const m = manifest();
const text = JSON.stringify(m, null, 1) + '\n';
if (process.argv.includes('--check')) {
  const have = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (have !== text) { console.error('offline-manifest.json is stale — run: node tools/build-offline-manifest.mjs'); process.exit(1); }
  console.log('offline-manifest.json is current');
} else {
  writeFileSync(OUT, text);
  const by = {}; for (const f of m.files) by[f.group] = (by[f.group] || 0) + 1;
  console.log(`wrote reading/offline-manifest.json · version ${m.version} · ${m.files.length} files ${JSON.stringify(by)} · ${(m.localBytes / 1048576).toFixed(1)} MB local (+ ${EXTERNAL.length} pinned CDN assets)`);
}
