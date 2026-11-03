// frames.mjs — FRAMES-1: word classes from Same vs Other over immediate frames (FRAMES-1-PREREG.md). Read-only over v1 postings.
//   node --max-old-space-size=8000 frames.mjs <v1-dir> <out.json> [shuffle]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const [, , V1, OUT, MODE] = process.argv;
const SHUFFLE = MODE === 'shuffle';
const NT = 20000, NF = 2000, NK = 3000, NPAIRS = 200000;
const SEEDS = ['feet', 'miles', 'inches', 'three', 'shillings', 'ounces', 'pounds', 'long', 'tall', 'cost', 'years', 'red', 'king'];
const t0 = Date.now(); const say = (...a) => console.error(((Date.now() - t0) / 1000).toFixed(0) + 's', ...a);

function mulberry32(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function typesOfNpy(file) {
  const b = fs.readFileSync(file);
  const ver = b[6], hl = ver === 1 ? b.readUInt16LE(8) : b.readUInt32LE(8), off = (ver === 1 ? 10 : 12) + hl;
  const n = (b.length - off) / 12, out = new Uint32Array(n);
  for (let i = 0; i < n; i++) out[i] = b.readUInt32LE(off + i * 12);
  return out;
}

// ── the English documents, read once
const docs = JSON.parse(fs.readFileSync(path.join(V1, 'docs.json'), 'utf8')).filter(d => d.lang === 'en');
const vocab = zlib.gunzipSync(fs.readFileSync(path.join(V1, 'vocab.tsv.gz'))).toString('utf8').split('\n').filter(Boolean).map(l => l.slice(0, l.lastIndexOf('\t')));
say('english docs', docs.length, 'vocab', vocab.length);
const rnd = mulberry32(20261103);
const seqs = []; let tokens = 0;
for (const d of docs) {
  let t; try { t = typesOfNpy(path.join(V1, 'postings', d.id + '.npy')); } catch (e) { continue; }
  if (SHUFFLE) for (let i = t.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const x = t[i]; t[i] = t[j]; t[j] = x; }
  seqs.push(t); tokens += t.length;
}
say('read', seqs.length, 'docs,', tokens, 'tokens');

// ── frequency ranks (English only): targets and frame words
const freq = new Uint32Array(vocab.length + 1);
for (const t of seqs) for (let i = 0; i < t.length; i++) freq[t[i]]++;
const order = Array.from({ length: freq.length }, (_, i) => i).filter(i => freq[i] > 0).sort((a, b) => freq[b] - freq[a]);
const tIdx = new Int32Array(freq.length).fill(-1), fIdx = new Int32Array(freq.length).fill(-1);
const targets = order.slice(0, NT); targets.forEach((ty, i) => { tIdx[ty] = i; });
order.slice(0, NF).forEach((ty, i) => { fIdx[ty] = i; });

// ── the most frequent frames L ___ R over frame words
const fc = new Uint32Array(NF * NF);
for (const t of seqs) for (let i = 1; i + 1 < t.length; i++) { const l = fIdx[t[i - 1]], r = fIdx[t[i + 1]]; if (l >= 0 && r >= 0) fc[l * NF + r]++; }
const frames = Array.from({ length: NF * NF }, (_, i) => i).sort((a, b) => fc[b] - fc[a]).slice(0, NK);
const kIdx = new Int32Array(NF * NF).fill(-1); frames.forEach((f, i) => { kIdx[f] = i; });
say('frames chosen; top:', frames.slice(0, 8).map(f => vocab[order[Math.floor(f / NF)]] + '_' + vocab[order[f % NF]]).join(' '));

// ── counts per half (even / odd documents)
const A = new Uint32Array(NT * NK), B = new Uint32Array(NT * NK);
seqs.forEach((t, di) => { const M = di % 2 ? B : A;
  for (let i = 1; i + 1 < t.length; i++) { const x = tIdx[t[i]]; if (x < 0) continue; const l = fIdx[t[i - 1]], r = fIdx[t[i + 1]]; if (l < 0 || r < 0) continue; const k = kIdx[l * NF + r]; if (k >= 0) M[x * NK + k]++; } });
say('counted');

// ── λ: positive PMI, L2-normalised (difference from the average word)
function lambda(get) {
  const row = new Float64Array(NT), col = new Float64Array(NK); let T = 0;
  for (let x = 0; x < NT; x++) for (let k = 0; k < NK; k++) { const c = get(x * NK + k); row[x] += c; col[k] += c; T += c; }
  const L = new Float32Array(NT * NK);
  for (let x = 0; x < NT; x++) { let n2 = 0; if (!row[x]) continue;
    for (let k = 0; k < NK; k++) { const c = get(x * NK + k); if (!c) continue; const v = Math.log((c * T) / (row[x] * col[k])); if (v > 0) { L[x * NK + k] = v; n2 += v * v; } }
    const n = Math.sqrt(n2) || 1; for (let k = 0; k < NK; k++) L[x * NK + k] /= n; }
  return { L, row };
}
const full = lambda(i => A[i] + B[i]), la = lambda(i => A[i]), lb = lambda(i => B[i]);
const cos = (P, a, Q, b) => { let s = 0; const oa = a * NK, ob = b * NK; for (let k = 0; k < NK; k++) s += P[oa + k] * Q[ob + k]; return s; };
const self = new Float32Array(NT); for (let x = 0; x < NT; x++) self[x] = cos(la.L, x, lb.L, x);
say('lambda + self');

// ── null: random pairs within the same frequency decile
const dec = x => Math.floor((x / NT) * 10); const pr = mulberry32(7); const sample = new Float32Array(NPAIRS);
for (let i = 0; i < NPAIRS; i++) { const a = Math.floor(pr() * NT); const d = dec(a); let b; do { b = d * (NT / 10) + Math.floor(pr() * (NT / 10)); } while (b === a); sample[i] = cos(full.L, a, full.L, b); }
const sorted = Array.from(sample).sort((a, b) => a - b); const NULL = sorted[Math.floor(0.999 * NPAIRS)];
const conceptShare = Array.from(self).filter(v => v > NULL).length / NT;
say('null', NULL.toFixed(4), 'concept share', conceptShare.toFixed(3));

// ── Same sets for the seeds
const word = ty => vocab[ty]; const byWord = new Map(targets.map((ty, i) => [word(ty), i]));
const out = { prereg: 'FRAMES-1', mode: SHUFFLE ? 'shuffle' : 'real', docs: seqs.length, tokens, NT, NF, NK, null: NULL, conceptShare,
  topFrames: frames.slice(0, 40).map(f => word(order[Math.floor(f / NF)]) + ' ___ ' + word(order[f % NF])), seeds: {} };
for (const s of SEEDS) { const a = byWord.get(s); if (a == null) { out.seeds[s] = { gap: 'not among the 20,000 targets' }; continue; }
  const rows = []; for (let b = 0; b < NT; b++) if (b !== a) { const c = cos(full.L, a, full.L, b); if (c > NULL && self[a] > NULL && self[b] > NULL) rows.push([word(targets[b]), +c.toFixed(4)]); }
  rows.sort((x, y) => y[1] - x[1]);
  out.seeds[s] = { self: +self[a].toFixed(4), concept: self[a] > NULL, sameCount: rows.length, top: rows.slice(0, 30) }; }
const fT = byWord.get('feet'), th = byWord.get('three');
if (fT != null && th != null) out.feetVsThree = +cos(full.L, fT, full.L, th).toFixed(4);
fs.writeFileSync(OUT, JSON.stringify(out, null, 1)); say('wrote', OUT);
