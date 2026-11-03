// frames2.mjs — FRAMES-2: measured reach (U's widening) and Same per use (FRAMES-2-PREREG.md). Read-only over v1 postings.
//   node --max-old-space-size=8000 frames2.mjs <v1-dir> <out.json> [shuffle]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const [, , V1, OUT, MODE] = process.argv;
const SHUFFLE = MODE === 'shuffle';
const NT = 15000, NF = 4000, R = 3, NFEAT = 2 * R * NF, NPAIRS = 200000, MAXUSES = 30000, MINSENSE = 300, MAXDEPTH = 3;
const SEEDS = ['feet', 'inches', 'miles', 'yards', 'shillings', 'ounces', 'pounds', 'gallons', 'minutes', 'three', 'years', 'long', 'cost'];
const SENSE_SEEDS = ['feet', 'pounds', 'inches', 'miles', 'shillings', 'ounces', 'long'];
const REACH_WORDS = ['inches', 'shillings', 'ounces', 'gallons', 'minutes', 'feet', 'miles', 'three', 'the', 'king', 'red'];
const t0 = Date.now(); const say = (...a) => console.error(((Date.now() - t0) / 1000).toFixed(0) + 's', ...a);

function mulberry32(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function typesOfNpy(file) {
  const b = fs.readFileSync(file);
  const ver = b[6], hl = ver === 1 ? b.readUInt16LE(8) : b.readUInt32LE(8), off = (ver === 1 ? 10 : 12) + hl;
  const n = (b.length - off) / 12, out = new Uint32Array(n);
  for (let i = 0; i < n; i++) out[i] = b.readUInt32LE(off + i * 12);
  return out;
}

const docs = JSON.parse(fs.readFileSync(path.join(V1, 'docs.json'), 'utf8')).filter(d => d.lang === 'en');
const vocab = zlib.gunzipSync(fs.readFileSync(path.join(V1, 'vocab.tsv.gz'))).toString('utf8').split('\n').filter(Boolean).map(l => l.slice(0, l.lastIndexOf('\t')));
const rnd = mulberry32(20261103);
const seqs = []; let tokens = 0;
for (const d of docs) {
  let t; try { t = typesOfNpy(path.join(V1, 'postings', d.id + '.npy')); } catch (e) { continue; }
  if (SHUFFLE) for (let i = t.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const x = t[i]; t[i] = t[j]; t[j] = x; }
  seqs.push(t); tokens += t.length;
}
say('read', seqs.length, 'docs,', tokens, 'tokens');

const freq = new Uint32Array(vocab.length + 1);
for (const t of seqs) for (let i = 0; i < t.length; i++) freq[t[i]]++;
const order = Array.from({ length: freq.length }, (_, i) => i).filter(i => freq[i] > 0).sort((a, b) => freq[b] - freq[a]);
const tIdx = new Int32Array(freq.length).fill(-1), fIdx = new Int32Array(freq.length).fill(-1);
const targets = order.slice(0, NT); targets.forEach((ty, i) => { tIdx[ty] = i; });
order.slice(0, NF).forEach((ty, i) => { fIdx[ty] = i; });
const word = i => vocab[targets[i]]; const byWord = new Map(targets.map((ty, i) => [vocab[ty], i]));
const featName = k => { const blk = Math.floor(k / NF), o = Math.floor(blk / 2) + 1, s = blk % 2; return (s ? '+' : '-') + o + ':' + vocab[order[k % NF]]; };

// ── counts per half, and the uses of the sense seeds (every k-th, with their positioned context and document parity)
const A = new Uint32Array(NT * NFEAT), B = new Uint32Array(NT * NFEAT);
const senseIx = new Map(SENSE_SEEDS.map(w => [byWord.get(w), w]).filter(([i]) => i != null));
const uses = new Map([...senseIx.values()].map(w => [w, { feats: [], par: [], seen: 0, stride: Math.max(1, Math.ceil(freq[targets[byWord.get(w)]] / MAXUSES)) }]));
seqs.forEach((t, di) => { const M = di % 2 ? B : A; const n = t.length;
  for (let i = 0; i < n; i++) { const x = tIdx[t[i]]; if (x < 0) continue; const base = x * NFEAT;
    const sw = senseIx.get(x); let rec = null;
    if (sw) { const u = uses.get(sw); if (u.seen++ % u.stride === 0 && u.par.length < MAXUSES) { rec = new Int32Array(2 * R).fill(-1); u.feats.push(rec); u.par.push(di % 2); } }
    for (let o = 1; o <= R; o++) {
      if (i - o >= 0) { const f = fIdx[t[i - o]]; if (f >= 0) { const k = ((o - 1) * 2) * NF + f; M[base + k]++; if (rec) rec[(o - 1) * 2] = k; } }
      if (i + o < n) { const f = fIdx[t[i + o]]; if (f >= 0) { const k = ((o - 1) * 2 + 1) * NF + f; M[base + k]++; if (rec) rec[(o - 1) * 2 + 1] = k; } }
    } } });
say('counted');

const colA = new Float64Array(NFEAT), colB = new Float64Array(NFEAT), col = new Float64Array(NFEAT);
for (let x = 0; x < NT; x++) for (let k = 0; k < NFEAT; k++) { const a = A[x * NFEAT + k], b = B[x * NFEAT + k]; colA[k] += a; colB[k] += b; }
for (let k = 0; k < NFEAT; k++) col[k] = colA[k] + colB[k];
const W = r => 2 * r * NF; const Tof = (c, r) => { let s = 0; for (let k = 0; k < W(r); k++) s += c[k]; return s; };
const T = [0, 1, 2, 3].map(r => r ? Tof(col, r) : 0), TA = [0, 1, 2, 3].map(r => r ? Tof(colA, r) : 0), TB = [0, 1, 2, 3].map(r => r ? Tof(colB, r) : 0);

// λ of a count row at reach r (positive PMI, L2-normalised) into `out`
function lam(get, r, c, Tr, out) { const w = W(r); let row = 0; for (let k = 0; k < w; k++) row += get(k); let n2 = 0;
  for (let k = 0; k < w; k++) { const v0 = get(k); let v = 0; if (v0 && row) { v = Math.log((v0 * Tr) / (row * c[k])); if (v < 0) v = 0; } out[k] = v; n2 += v * v; }
  const n = Math.sqrt(n2) || 1; for (let k = 0; k < w; k++) out[k] /= n; return out; }
const dot = (P, po, Q, qo, w) => { let s = 0; for (let k = 0; k < w; k++) s += P[po + k] * Q[qo + k]; return s; };

const L = [null], self = [null]; const ta = new Float32Array(NFEAT), tb = new Float32Array(NFEAT);
for (let r = 1; r <= R; r++) { const w = W(r); const M = new Float32Array(NT * w); const S = new Float32Array(NT);
  for (let x = 0; x < NT; x++) { const o = x * NFEAT;
    lam(k => A[o + k] + B[o + k], r, col, T[r], M.subarray(x * w, (x + 1) * w));
    lam(k => A[o + k], r, colA, TA[r], ta); lam(k => B[o + k], r, colB, TB[r], tb); S[x] = dot(ta, 0, tb, 0, w); }
  L.push(M); self.push(S); say('lambda r' + r); }

const NULL = [null]; const dec = x => Math.floor((x / NT) * 10);
for (let r = 1; r <= R; r++) { const pr = mulberry32(7 + r), w = W(r), s = new Float32Array(NPAIRS);
  for (let i = 0; i < NPAIRS; i++) { const a = Math.floor(pr() * NT), d = dec(a); let b; do { b = d * (NT / 10) + Math.floor(pr() * (NT / 10)); } while (b === a); s[i] = dot(L[r], a * w, L[r], b * w, w); }
  NULL.push(Array.from(s).sort((p, q) => p - q)[Math.floor(0.999 * NPAIRS)]); }
say('nulls', NULL.slice(1).map(v => v.toFixed(4)).join(' '));

// ── U(x): reach = first r where widening's change ≤ chance
const reach = new Uint8Array(NT);
for (let x = 0; x < NT; x++) { let r = 1;
  for (; r < R; r++) { const w0 = W(r), w1 = W(r + 1); const change = 1 - dot(L[r], x * w0, L[r + 1], x * w1, w0); const chance = 1 - self[r + 1][x]; if (change <= chance) break; }
  reach[x] = r; }
const hist = [0, 0, 0, 0]; reach.forEach(r => hist[r]++);
say('reach histogram r1/r2/r3', hist.slice(1).join('/'));

function sameSet(vec, r, exclude, n = 20) { const w = W(r), rows = [];
  for (let b = 0; b < NT; b++) { if (b === exclude || self[r][b] <= NULL[r]) continue; const c = dot(vec, 0, L[r], b * w, w); if (c > NULL[r]) rows.push([word(b), +c.toFixed(4)]); }
  rows.sort((p, q) => q[1] - p[1]); return { count: rows.length, top: rows.slice(0, n) }; }

const out = { prereg: 'FRAMES-2', mode: SHUFFLE ? 'shuffle' : 'real', docs: seqs.length, tokens, NT, NF, R, null: NULL.slice(1), reachHistogram: hist.slice(1),
  reach: Object.fromEntries(REACH_WORDS.filter(w => byWord.has(w)).map(w => [w, reach[byWord.get(w)]])), seeds: {}, senses: {} };
for (const s of SEEDS) { const a = byWord.get(s); if (a == null) { out.seeds[s] = { gap: 'not among the targets' }; continue; }
  // Same at max(r*(a), r*(b)): evaluate per b at its pair reach
  const rows = [];
  for (let b = 0; b < NT; b++) { if (b === a) continue; const r = Math.max(reach[a], reach[b]), w = W(r);
    if (self[r][a] <= NULL[r] || self[r][b] <= NULL[r]) continue; const c = dot(L[r], a * w, L[r], b * w, w); if (c > NULL[r]) rows.push([word(b), +c.toFixed(4), r]); }
  rows.sort((p, q) => q[1] - p[1]);
  out.seeds[s] = { reach: reach[a], self: [1, 2, 3].map(r => +self[r][a].toFixed(4)), sameCount: rows.length, top: rows.slice(0, 30) }; }
say('seeds');

// ── Same per use: split while the parts are Other and each is the same as itself; the null decides how many senses
function senseLam(ix, U, r, parity) { const w = W(r), cnt = new Float64Array(w); let n = 0;
  for (const i of ix) { if (parity != null && U.par[i] !== parity) continue; n++; const f = U.feats[i]; for (let j = 0; j < 2 * r; j++) if (f[j] >= 0) cnt[f[j]]++; }
  const c = parity == null ? col : parity ? colB : colA, Tr = parity == null ? T[r] : parity ? TB[r] : TA[r];
  return { v: lam(k => cnt[k], r, c, Tr, new Float32Array(w)), n }; }
function split(ix, U, r) { const w = W(r); const idf = new Float64Array(w); for (let k = 0; k < w; k++) idf[k] = col[k] ? Math.log(T[r] / col[k]) : 0;
  const vec = i => { const f = U.feats[i], v = []; for (let j = 0; j < 2 * r; j++) if (f[j] >= 0) v.push(f[j]); return v; };
  const cdot = (C, v) => { let s = 0; for (const k of v) s += C[k] * idf[k]; return s; };
  const norm = C => { let s = 0; for (let k = 0; k < w; k++) s += C[k] * C[k]; s = Math.sqrt(s) || 1; for (let k = 0; k < w; k++) C[k] /= s; };
  const C1 = new Float64Array(w), C2 = new Float64Array(w); vec(ix[Math.floor(ix.length / 3)]).forEach(k => { C1[k] = idf[k]; }); norm(C1);
  let worst = ix[0], wv = Infinity; for (const i of ix) { const v = vec(i); if (!v.length) continue; const c = cdot(C1, v); if (c < wv) { wv = c; worst = i; } }
  vec(worst).forEach(k => { C2[k] = idf[k]; }); norm(C2);
  let as = new Uint8Array(ix.length);
  for (let it = 0; it < 20; it++) { ix.forEach((i, j) => { const v = vec(i); as[j] = cdot(C2, v) > cdot(C1, v) ? 1 : 0; });
    C1.fill(0); C2.fill(0); ix.forEach((i, j) => { const C = as[j] ? C2 : C1; for (const k of vec(i)) C[k] += idf[k]; }); norm(C1); norm(C2); }
  return [ix.filter((_, j) => !as[j]), ix.filter((_, j) => as[j])]; }
function senses(ix, U, r, depth) {
  const whole = senseLam(ix, U, r); const node = { uses: ix.length, depth };
  const sA = senseLam(ix, U, r, 0), sB = senseLam(ix, U, r, 1); node.self = +dot(sA.v, 0, sB.v, 0, W(r)).toFixed(4);
  if (depth < MAXDEPTH && ix.length >= 2 * MINSENSE) { const [p, q] = split(ix, U, r);
    if (p.length >= MINSENSE && q.length >= MINSENSE) { const lp = senseLam(p, U, r), lq = senseLam(q, U, r); const between = dot(lp.v, 0, lq.v, 0, W(r));
      const selfOf = s => { const a = senseLam(s, U, r, 0), b = senseLam(s, U, r, 1); return dot(a.v, 0, b.v, 0, W(r)); };
      const sp = selfOf(p), sq = selfOf(q);
      node.trial = { sizes: [p.length, q.length], between: +between.toFixed(4), selfs: [+sp.toFixed(4), +sq.toFixed(4)], null: +NULL[r].toFixed(4) };
      if (between < NULL[r] && sp > NULL[r] && sq > NULL[r]) { node.kept = true; node.children = [senses(p, U, r, depth + 1), senses(q, U, r, depth + 1)]; return node; } } }
  // a leaf: its own Same set, and the context words that most mark it
  node.same = sameSet(whole.v, r, -1).top.slice(0, 20);
  node.marks = Array.from(whole.v).map((v, k) => [k, v]).sort((p, q) => q[1] - p[1]).slice(0, 8).map(([k]) => featName(k));
  return node; }
for (const [w, U] of uses) { const a = byWord.get(w), r = reach[a]; const ix = U.par.map((_, i) => i);
  out.senses[w] = { reach: r, usesSampled: ix.length, tree: senses(ix, U, r, 0) }; say('senses', w); }
fs.writeFileSync(OUT, JSON.stringify(out, null, 1)); say('wrote', OUT);
