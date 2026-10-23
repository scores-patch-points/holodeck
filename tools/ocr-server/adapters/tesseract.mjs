// adapters/tesseract.mjs — the portable eye: the tesseract binary, on macOS, Linux and Windows alike. A recogniser
// that runs on this machine; it never touches the network.
//
// Every adapter is { id, label, platforms, onDevice, rank, probe(), read(images, { lang }) } and read() returns,
// per image, { image, ms, lines:[{ t, c, b, words:[{ t, b, c }] }] } — c is 0..100, b is [x0,y0,x1,y1] in pixels.
import { run } from '../proc.mjs';

/** tesseract TSV -> lines of words. Level-5 rows are words; block.par.line groups them into lines. */
export function parseTsv(tsv) {
  const lines = new Map();
  for (const row of String(tsv || '').split('\n').slice(1)) {
    const c = row.split('\t');
    if (c.length < 12 || c[0] !== '5' || !c[11].trim()) continue;
    const conf = parseFloat(c[10]); if (!(conf >= 0)) continue;
    const key = c[2] + '.' + c[3] + '.' + c[4];
    const l = +c[6], t = +c[7], w = +c[8], h = +c[9];
    if (!lines.has(key)) lines.set(key, []);
    lines.get(key).push({ t: c[11], b: [l, t, l + w, t + h], c: conf });
  }
  return [...lines.values()].map((ws) => ({
    t: ws.map((w) => w.t).join(' '),
    c: ws.reduce((a, w) => a + w.c, 0) / ws.length,
    b: [Math.min(...ws.map((w) => w.b[0])), Math.min(...ws.map((w) => w.b[1])), Math.max(...ws.map((w) => w.b[2])), Math.max(...ws.map((w) => w.b[3]))],
    words: ws,
  }));
}

export default {
  id: 'tesseract', label: 'Tesseract', platforms: ['darwin', 'linux', 'win32'], onDevice: true, rank: 10,
  async probe() {
    const r = await run('tesseract', ['--version'], { timeout: 8000 });
    if (r.code === -1) return { ok: false, hint: process.platform === 'win32' ? 'install Tesseract (the UB-Mannheim build) and put it on PATH' : process.platform === 'darwin' ? 'brew install tesseract' : 'apt install tesseract-ocr (or your distribution\'s package)' };
    const v = /tesseract\s+v?([\d.]+)/i.exec(r.out + r.err);
    return { ok: true, version: v ? v[1] : null };
  },
  async read(images, { lang = 'eng', timeout = 120000 } = {}) {
    const out = [];
    for (const image of images) {
      const t0 = Date.now();
      // one thread per page: the pages are read in parallel by the reader, and tesseract's own threads fight each other
      const r = await run('tesseract', [image, 'stdout', '-l', lang, '--psm', '3', 'tsv'], { timeout, env: { OMP_THREAD_LIMIT: '1' } });
      if (r.code !== 0) { out.push({ image, ms: Date.now() - t0, error: 'tesseract: ' + (r.err.trim() || 'exit ' + r.code) }); continue; }
      out.push({ image, ms: Date.now() - t0, lines: parseTsv(r.out) });
    }
    return out;
  },
};
