#!/usr/bin/env node
// bench.mjs — score the eyes against a PDF's own text layer. The text layer is exact, so a page of it rendered to
// pixels is a page with a known answer: read the pixels with each eye, and with the eyes folded together (fuse.mjs,
// the PDF's other pages as the prior, the page itself subtracted), and compare with what the PDF says.
//
//   node tools/ocr-server/bench.mjs <file.pdf> [--pages 12 | --list 13,37,75] [--dpi 150] [--admit 0.90] [--json]
//
// --admit F: exit 1 unless the best single eye and the fusion both reach word F1 >= F — the bar an adapter has to clear
// on a new platform, set BEFORE it is run. Clean born-digital pages are easier than real scans: this bounds an eye from
// above, it does not certify it on a scan.
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from './proc.mjs';
import { detect } from './engines.mjs';
import { Prior, fuse, wordF1 } from './fuse.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const file = process.argv[2];
if (!file || file.startsWith('--')) { console.error('usage: bench.mjs <file.pdf> [--pages 12] [--dpi 150] [--admit 0.90] [--json]'); process.exit(2); }
const N = Number(arg('pages', 12)), DPI = Number(arg('dpi', 150)), ADMIT = arg('admit', null);
const chars = (t) => (String(t).match(/[\p{L}\p{N}]/gu) || []).length;

const { eyes } = await detect({ force: true });
if (eyes.length < 1) { console.error('no eye available on this machine'); process.exit(2); }
const tl = await run('pdftotext', ['-layout', file, '-'], { timeout: 600000 });
if (tl.code !== 0) { console.error('pdftotext: ' + tl.err.trim()); process.exit(2); }
const pages = tl.out.split('\f'); if (pages.at(-1).trim() === '') pages.pop();
const textPages = pages.map((t, i) => ({ n: i + 1, t })).filter((p) => chars(p.t) >= 80);
const dense = textPages.filter((p) => chars(p.t) >= 1500);
const step = Math.max(1, Math.floor(dense.length / N));
const LIST = arg('list', null); // --list 13,37,75: score exactly these pages (to reproduce an earlier sample)
const picks = LIST ? LIST.split(',').map(Number).map((n) => textPages.find((p) => p.n === n)).filter(Boolean)
  : Array.from({ length: Math.min(N, dense.length) }, (_, i) => dense[i * step + (step >> 1)] || dense[i]);
const prior = new Prior(2); for (const p of textPages) prior.add(p.t);

const dir = await mkdtemp(join(tmpdir(), 'hd-bench-'));
const rows = []; const ms = Object.fromEntries(eyes.map((e) => [e.id, 0]));
try {
  for (const p of picks) {
    const base = join(dir, 'p' + p.n);
    const r = await run('pdftoppm', ['-r', String(DPI), '-f', String(p.n), '-l', String(p.n), '-png', '-singlefile', file, base], { timeout: 120000 });
    if (r.code !== 0) { console.error('pdftoppm page ' + p.n + ': ' + r.err.trim()); continue; }
    const img = base + '.png';
    const read = await Promise.all(eyes.map(async (e) => { const t = Date.now(); const [x] = await e.read([img], {}); ms[e.id] += Date.now() - t; return { id: e.id, ...x }; }));
    const row = { page: p.n, words: p.t.split(/\s+/).filter(Boolean).length };
    const ok = read.filter((x) => x.lines);
    for (const x of ok) row[x.id] = wordF1(p.t, x.lines.map((l) => l.t).join('\n'));
    if (ok.length >= 2) {
      const own = Prior.partsOf(p.t);
      for (const policy of ['keep-base', 'strict']) { const f = fuse(ok[0].lines, ok[1].lines, prior, { own, policy }); row['fused/' + policy] = wordF1(p.t, f.text); row['fused/' + policy].dropped = f.dropped.length; }
      const none = fuse(ok[0].lines, ok[1].lines, new Prior(2), { policy: 'keep-base' }); row['fused/no-prior'] = wordF1(p.t, none.text);
    }
    rows.push(row);
  }
} finally { rm(dir, { recursive: true, force: true }).catch(() => {}); }

const keys = [...new Set(rows.flatMap((r) => Object.keys(r).filter((k) => !['page', 'words'].includes(k))))];
const mean = (k, f) => { const v = rows.filter((r) => r[k]).map((r) => r[k][f]); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const summary = Object.fromEntries(keys.map((k) => [k, { f1: mean(k, 'f1'), recall: mean(k, 'recall'), precision: mean(k, 'precision'), n: rows.filter((r) => r[k]).length }]));
const out = { file, pages: rows.map((r) => r.page), dpi: DPI, platform: process.platform, eyes: eyes.map((e) => e.id), priorPages: prior.pages, readMs: ms, summary };
if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 1));
else {
  console.log(`${file}\n${rows.length} text pages rendered at ${DPI} dpi, scored against the PDF's own text (prior: ${prior.pages} pages, the page itself subtracted)`);
  for (const [k, v] of Object.entries(summary)) console.log(`  ${k.padEnd(18)} F1 ${v.f1.toFixed(3)}  recall ${v.recall.toFixed(3)}  precision ${v.precision.toFixed(3)}  (n=${v.n})`);
  console.log('  eye read time, summed (wall, includes any machine load):', JSON.stringify(ms));
}
if (ADMIT != null) {
  const single = Math.max(...eyes.map((e) => summary[e.id] ? summary[e.id].f1 : 0)), fusedF = summary['fused/keep-base'] ? summary['fused/keep-base'].f1 : single;
  const pass = single >= Number(ADMIT) && fusedF >= Number(ADMIT);
  console.log(`admit bar ${ADMIT}: best single eye ${single.toFixed(3)}, fused ${fusedF.toFixed(3)} -> ${pass ? 'PASS' : 'FAIL'}`);
  process.exit(pass ? 0 : 1);
}
