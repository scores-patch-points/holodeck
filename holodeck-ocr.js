// holodeck-ocr.js — read pixels in THIS browser: tesseract (OCR, a recogniser, never a language model) via tesseract.js, with pdf.js to
// rasterise scanned PDF pages. Every file it loads is a pinned URL that the offline service worker keeps, so it runs with the network off.
// The page tries the dev server's POST /ocr first (native tesseract, faster); this is the fallback that needs no server at all.
//
// Pure of the page: it takes bytes and an onPage callback and returns { text, pages, total, words, conf }.
import { PINNED, hasSimd } from './reading/offline.js';

let tessP = null, pdfP = null;
const loadScript = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.crossOrigin = 'anonymous'; s.onload = res; s.onerror = () => rej(new Error('could not load ' + src)); document.head.appendChild(s); });
export const loadTesseract = () => (tessP ||= (self.Tesseract ? Promise.resolve(self.Tesseract) : loadScript(PINNED.tesseract).then(() => self.Tesseract)));
export const loadPdfjs = () => (pdfP ||= import(PINNED.pdfjs).then((m) => { m.GlobalWorkerOptions.workerSrc = PINNED.pdfjsWorker; return m; }));

// mean word confidence + word count from a tesseract result (words carry their own confidence)
const stats = (data) => { const w = (data.words || []).filter((x) => x.text && x.text.trim()); return { words: w.length, conf: w.length ? Math.round(w.reduce((a, b) => a + b.confidence, 0) / w.length) : null }; };

/**
 * @param {Uint8Array} buf  an image or a PDF
 * @param {'image'|'pdf'} kind
 * @param {{maxPages?: number, onPage?: (p:{n:number,total:number,text:string,conf:number|null,words:number})=>void, onStatus?: (s:string)=>void}} o
 */
// THE LAYOUT: where every word sits. The page's text is rebuilt from the recogniser's own lines and words — not taken from its flat
// text — so every word knows its character offsets in the text the reader reads, its box on the page, its confidence, its line and block.
// Within a line, a gap wider than the line's own spacing becomes two spaces: that is how a printed form's "label    value" survives into
// text, where Alhazen's field reader (extractFormFields) looks for it.
function linesOf(data) {
  const fromBlocks = (data.blocks || []).flatMap((b, bi) => (b.paragraphs || []).flatMap((p) => (p.lines || []).map((l) => ({ ...l, block: bi }))));
  if (fromBlocks.length) return fromBlocks;
  if (data.lines && data.lines.length) return data.lines.map((l) => ({ ...l, block: 0 }));
  // no structure: group the words by their vertical centre
  const ws = (data.words || []).slice().sort((a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0), out = [];
  for (const w of ws) { const cy = (w.bbox.y0 + w.bbox.y1) / 2, h = w.bbox.y1 - w.bbox.y0, L = out[out.length - 1]; if (L && Math.abs(cy - L.cy) < h * 0.6) { L.words.push(w); } else out.push({ cy, words: [w], block: 0 }); }
  return out;
}
export function layoutText(data, base = 0) {
  const words = [], lines = []; let text = '', lastBlock = null;
  for (const L of linesOf(data)) {
    const ws = (L.words || []).filter((w) => w.text && w.text.trim()).sort((a, b) => a.bbox.x0 - b.bbox.x0);
    if (!ws.length) continue;
    if (text) text += lastBlock !== null && L.block !== lastBlock ? '\n\n' : '\n';
    lastBlock = L.block;
    const charW = ws.reduce((n, w) => n + (w.bbox.x1 - w.bbox.x0) / Math.max(1, w.text.length), 0) / ws.length;
    const ls = base + text.length, i0 = words.length;
    ws.forEach((w, i) => {
      if (i) text += (w.bbox.x0 - ws[i - 1].bbox.x1) > charW * 2.2 ? '  ' : ' ';
      const s = base + text.length; text += w.text.trim();
      words.push({ t: w.text.trim(), s, e: base + text.length, b: [w.bbox.x0, w.bbox.y0, w.bbox.x1, w.bbox.y1], c: Math.round(w.confidence ?? 0), line: lines.length, block: L.block });
    });
    lines.push({ s: ls, e: base + text.length, words: [i0, words.length], block: L.block, b: [Math.min(...ws.map((w) => w.bbox.x0)), Math.min(...ws.map((w) => w.bbox.y0)), Math.max(...ws.map((w) => w.bbox.x1)), Math.max(...ws.map((w) => w.bbox.y1))] });
  }
  return { text, words, lines };
}

export async function browserOcr(buf, kind, { maxPages = 40, onPage = () => {}, onStatus = () => {} } = {}) {
  const T = await loadTesseract();
  onStatus('starting the recogniser');
  const worker = await T.createWorker('eng', 1, {
    workerPath: PINNED.tesseractWorker,
    corePath: PINNED.tesseractCore, // a directory: tesseract.js picks the SIMD or plain core from it
    langPath: PINNED.tessdata, gzip: true,
    workerBlobURL: true,
  });
  try {
    const canvases = []; let total = 1;
    if (kind === 'pdf') {
      const pdfjs = await loadPdfjs();
      const pdf = await pdfjs.getDocument({ data: buf.slice() }).promise;
      total = Math.min(pdf.numPages, maxPages);
      for (let i = 1; i <= total; i++) canvases.push({ n: i, get: async () => {
        const page = await pdf.getPage(i); const vp = page.getViewport({ scale: 2 });
        const cv = document.createElement('canvas'); cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
        // intent 'print': pdf.js then renders without requestAnimationFrame, so a page in a background tab still renders (found live: a hidden tab stalled OCR forever)
        await page.render({ canvasContext: cv.getContext('2d'), viewport: vp, intent: 'print' }).promise; return cv;
      } });
    } else canvases.push({ n: 1, get: async () => new Blob([buf]) });
    let text = '', pages = 0, words = 0, confSum = 0; const layout = { schema: 'OcrLayout@1', engine: 'tesseract.js (this browser)', pages: [] };
    for (const p of canvases) {
      onStatus(`page ${p.n} of ${total}`);
      const img = await p.get();
      const { data } = await worker.recognize(img, {}, { text: true, blocks: true });
      const s = stats(data); pages++;
      const sep = text ? '\n\n' : '', L = layoutText(data, text.length + sep.length);
      if (L.text) text += sep + L.text;
      // the page as an image the reading can be drawn on: a JPEG of the rendered page (a PDF), or the picture itself
      const w = img.width || data.imageWidth || null, h = img.height || data.imageHeight || null;
      const image = img.toDataURL ? img.toDataURL('image/jpeg', 0.72) : URL.createObjectURL(img);
      let size = { w, h }; if (!w || !h) { try { const bm = await createImageBitmap(img); size = { w: bm.width, h: bm.height }; } catch (e) {} }
      layout.pages.push({ n: p.n, w: size.w, h: size.h, image, words: L.words, lines: L.lines });
      if (s.conf != null) { words += s.words; confSum += s.conf * s.words; }
      onPage({ n: p.n, total, text: data.text || '', conf: s.conf, words: s.words });
    }
    return { text, pages, total, words, conf: words ? Math.round(confSum / words) : null, simd: hasSimd(), layout };
  } finally { await worker.terminate(); }
}
