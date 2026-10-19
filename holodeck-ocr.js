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
        await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise; return cv;
      } });
    } else canvases.push({ n: 1, get: async () => new Blob([buf]) });
    let text = '', pages = 0, words = 0, confSum = 0;
    for (const p of canvases) {
      onStatus(`page ${p.n} of ${total}`);
      const { data } = await worker.recognize(await p.get());
      const s = stats(data); pages++;
      if (data.text && data.text.trim()) text += (text ? '\n\n' : '') + data.text.trim();
      if (s.conf != null) { words += s.words; confSum += s.conf * s.words; }
      onPage({ n: p.n, total, text: data.text || '', conf: s.conf, words: s.words });
    }
    return { text, pages, total, words, conf: words ? Math.round(confSum / words) : null, simd: hasSimd() };
  } finally { await worker.terminate(); }
}
