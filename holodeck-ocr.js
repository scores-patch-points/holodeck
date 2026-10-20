// holodeck-ocr.js — read pixels in THIS browser: tesseract (OCR, a recogniser, never a language model) via tesseract.js, with pdf.js to
// rasterise scanned PDF pages. Every file it loads is a pinned URL that the offline service worker keeps, so it runs with the network off.
// The page tries the dev server's POST /ocr first (native tesseract, faster); this is the fallback that needs no server at all.
//
// Pure of the page: it takes bytes and an onPage callback and returns { text, pages, total, words, conf }.
import { PINNED, hasSimd } from './reading/offline.js';
import { rulesOf } from './reading/page-views.js'; // (page-views loads Alhazen, which sets self.Alhazen)

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

// The recogniser reads the scripts it has a model for. Which models: the person's own languages (navigator.languages), mapped to tesseract's
// model names by this DECLARED table (ISO 639-1 → tesseract), always with English, the one the page keeps offline. Others download on first use.
export const TESS_LANG = { en: 'eng', es: 'spa', fr: 'fra', de: 'deu', it: 'ita', pt: 'por', nl: 'nld', sv: 'swe', da: 'dan', no: 'nor', nb: 'nor', fi: 'fin', pl: 'pol', cs: 'ces', sk: 'slk', hu: 'hun', ro: 'ron', tr: 'tur', el: 'ell', ru: 'rus', uk: 'ukr', bg: 'bul', sr: 'srp', hr: 'hrv', ar: 'ara', fa: 'fas', he: 'heb', hi: 'hin', bn: 'ben', ta: 'tam', te: 'tel', th: 'tha', vi: 'vie', id: 'ind', ms: 'msa', zh: 'chi_sim', 'zh-TW': 'chi_tra', ja: 'jpn', ko: 'kor', sw: 'swa', am: 'amh', ur: 'urd' };
export function ocrLangs(langs = (typeof navigator !== 'undefined' && navigator.languages) || ['en']) {
  const out = new Set(['eng']); for (const l of langs) { const t = TESS_LANG[l] || TESS_LANG[String(l).split('-')[0]]; if (t) out.add(t); } return [...out].join('+');
}
export async function browserOcr(buf, kind, { maxPages = 40, onPage = () => {}, onStatus = () => {}, langs = ocrLangs() } = {}) {
  const T = await loadTesseract();
  onStatus(`starting the recogniser (${langs})`);
  const worker = await T.createWorker(langs, 1, {
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
      // the form's boxes, from the page's own ink, while its pixels are at hand
      let rules = null;
      try { const cv = img.getContext ? img : await (async () => { const bm = await createImageBitmap(img); const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; c.getContext('2d').drawImage(bm, 0, 0); return c; })();
        const hs = L.words.filter((x) => /[a-z]/i.test(x.t)).map((x) => x.b[3] - x.b[1]).sort((a, b) => a - b), hMed = hs[Math.floor(hs.length / 2)] || 10;
        rules = rulesOf(cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height, hMed); } catch (e) { rules = null; }
      // A SECOND LOOK: ink the recogniser did not read. Alhazen marks where ink sits (readImage → text-like regions); any ink with no word on
      // it — small bold type in a shaded header cell ("Prior Year", "Current Year"), white type on a dark bar ("Part I  Summary") — is cut
      // out, enlarged 3×, inverted if it is light on dark, and read again. Its words go where the ink is, appended to the page's text so they
      // carry offsets too, and they say they came from a second look.
      try { const cv = img.getContext ? img : null; if (cv && self.Alhazen) {
        const W = cv.width, H = cv.height, d = cv.getContext('2d').getImageData(0, 0, W, H).data;
        const hs2 = L.words.filter((x) => /[a-z]/i.test(x.t)).map((x) => x.b[3] - x.b[1]).sort((a, b) => a - b), hM = hs2[Math.floor(hs2.length / 2)] || 10;
        const regs = self.Alhazen.readImage(d, W, H).regions.filter((g) => g.kind === 'text' && g.region[3] >= hM * 0.6 && g.region[3] <= hM * 4);
        const covered = (b) => L.words.some((w) => w.c >= 30 && Math.min(w.b[2], b[0] + b[2]) - Math.max(w.b[0], b[0]) > 0 && Math.min(w.b[3], b[1] + b[3]) - Math.max(w.b[1], b[1]) > 0);
        const loose = regs.map((g) => g.region).filter((b) => !covered(b));
        // gather loose ink into strips along a line
        const strips = []; for (const b of loose.sort((p, q) => p[1] - q[1] || p[0] - q[0])) { const cy = b[1] + b[3] / 2; const st = strips.find((t) => Math.abs(t.cy - cy) < hM * 0.7 && b[0] - t.x1 < hM * 2.5 && t.x0 - (b[0] + b[2]) < hM * 2.5);
          if (st) { st.x0 = Math.min(st.x0, b[0]); st.x1 = Math.max(st.x1, b[0] + b[2]); st.y0 = Math.min(st.y0, b[1]); st.y1 = Math.max(st.y1, b[1] + b[3]); st.n++; } else strips.push({ x0: b[0], x1: b[0] + b[2], y0: b[1], y1: b[1] + b[3], cy, n: 1 }); }
        let looked = 0;
        for (const st of strips.filter((t) => t.x1 - t.x0 >= hM * 2 && t.n >= 2).slice(0, 40)) {
          const px = 4, X0 = Math.max(0, st.x0 - px), Y0 = Math.max(0, st.y0 - px), X1 = Math.min(W, st.x1 + px), Y1 = Math.min(H, st.y1 + px);
          let sum = 0, n = 0; for (let y = Y0; y < Y1; y += 2) for (let x = X0; x < X1; x += 2) { const i = (y * W + x) * 4; sum += d[i] + d[i + 1] + d[i + 2]; n++; }
          const lightOnDark = sum / n / 3 < 110;
          const S = 3, c2 = document.createElement('canvas'); c2.width = (X1 - X0) * S; c2.height = (Y1 - Y0) * S; const g = c2.getContext('2d');
          if (lightOnDark) g.filter = 'invert(1)';
          g.drawImage(cv, X0, Y0, X1 - X0, Y1 - Y0, 0, 0, c2.width, c2.height);
          const { data: bd } = await worker.recognize(c2, {}, { text: true, blocks: true }); looked++;
          const bw = (bd.words || []).filter((w) => w.text && /[A-Za-z0-9]/.test(w.text) && w.confidence > 55);
          if (!bw.length) continue;
          const base = text.length + 1, ls = L.words.length; let line = '';
          for (const w of bw) { if (line) line += ' '; const s0 = base + line.length; line += w.text.trim();
            L.words.push({ t: w.text.trim(), s: s0, e: base + line.length, b: [X0 + w.bbox.x0 / S, Y0 + w.bbox.y0 / S, X0 + w.bbox.x1 / S, Y0 + w.bbox.y1 / S], c: Math.round(w.confidence), line: L.lines.length, block: -1, second: lightOnDark ? 'inverted' : 'enlarged' }); }
          L.lines.push({ s: base, e: base + line.length, words: [ls, L.words.length], block: -1, b: [X0, Y0, X1, Y1], second: true });
          text += '\n' + line;
        }
        L.secondLook = looked;
      } } catch (e) { /* the page is read as the first pass read it */ }
      layout.pages.push({ n: p.n, w: size.w, h: size.h, image, words: L.words, lines: L.lines, rules, secondLook: L.secondLook || 0 });
      if (s.conf != null) { words += s.words; confSum += s.conf * s.words; }
      onPage({ n: p.n, total, text: data.text || '', conf: s.conf, words: s.words });
    }
    layout.langs = langs;
    return { text, pages, total, words, conf: words ? Math.round(confSum / words) : null, simd: hasSimd(), layout };
  } finally { await worker.terminate(); }
}
