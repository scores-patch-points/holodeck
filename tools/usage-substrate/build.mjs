// build.mjs (run as substrate3.mjs) — SUBSTRATE-3 (SUBSTRATE-3-PREREG.md; the paired order test: c_real | n ~ Binomial(n, 1/2)): giver-nominated numbers licensed by use, measure nouns, question-word selections.
//   node --max-old-space-size=8000 build.mjs <v1-dir> <giver-num.json> <out.json>   (then export.mjs <out.json> ../../usage-substrate.json)
// Nothing here names a unit. The giver nominates numerals; use licenses them (Same vs Other); measure nouns are what follows the licensed
// class beyond a shuffled-order null; a question word selects the measure nouns it keeps company with beyond a count-banded shuffled null.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const [, , V1, GIVER, OUT] = process.argv;
const NT = 15000, NF = 4000, R = 3, NFEAT = 2 * R * NF, MINC = 5, MINUSES = 20;
const BANDS = [5, 10, 20, 50, 100, 1e12]; const band = c => BANDS.findIndex((b, i) => c >= b && c < BANDS[i + 1]);
const t0 = Date.now(); const say = (...a) => console.error(((Date.now() - t0) / 1000).toFixed(0) + 's', ...a);
function mulberry32(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function typesOfNpy(file) { const b = fs.readFileSync(file); const ver = b[6], hl = ver === 1 ? b.readUInt16LE(8) : b.readUInt32LE(8), off = (ver === 1 ? 10 : 12) + hl;
  const n = (b.length - off) / 12, out = new Uint32Array(n); for (let i = 0; i < n; i++) out[i] = b.readUInt32LE(off + i * 12); return out; }

const docs = JSON.parse(fs.readFileSync(path.join(V1, 'docs.json'), 'utf8')).filter(d => d.lang === 'en');
const vocab = zlib.gunzipSync(fs.readFileSync(path.join(V1, 'vocab.tsv.gz'))).toString('utf8').split('\n').filter(Boolean).map(l => l.slice(0, l.lastIndexOf('\t')));
const head = fs.readFileSync(path.join(V1, 'head.sha256'), 'utf8').trim().split(/\s+/)[0];
const giver = JSON.parse(fs.readFileSync(GIVER, 'utf8'));
const rnd = mulberry32(20261103), rnd2 = mulberry32(424242); const real = [], shuf = [], shuf2 = []; let tokens = 0;
for (const d of docs) { let t; try { t = typesOfNpy(path.join(V1, 'postings', d.id + '.npy')); } catch (e) { continue; }
  const s = t.slice(); for (let i = s.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const x = s[i]; s[i] = s[j]; s[j] = x; }
  const s2 = t.slice(); for (let i = s2.length - 1; i > 0; i--) { const j = Math.floor(rnd2() * (i + 1)); const x = s2[i]; s2[i] = s2[j]; s2[j] = x; }
  real.push(t); shuf.push(s); shuf2.push(s2); tokens += t.length; }
say('read', real.length, 'docs,', tokens, 'tokens');

const freq = new Uint32Array(vocab.length + 1); for (const t of real) for (let i = 0; i < t.length; i++) freq[t[i]]++;
const order = Array.from({ length: freq.length }, (_, i) => i).filter(i => freq[i] > 0).sort((a, b) => freq[b] - freq[a]);
const tIdx = new Int32Array(freq.length).fill(-1), fIdx = new Int32Array(freq.length).fill(-1);
order.slice(0, NT).forEach((ty, i) => { tIdx[ty] = i; }); order.slice(0, NF).forEach((ty, i) => { fIdx[ty] = i; });
const word = x => vocab[order[x]]; const byWord = new Map(order.slice(0, NT).map((ty, i) => [vocab[ty], i]));
const isDigit = new Uint8Array(freq.length); for (let ty = 0; ty < vocab.length; ty++) if (/^\d[\d,.]*$/.test(vocab[ty])) isDigit[ty] = 1;

function countAll(seqs) { const C = new Uint32Array(NT * NFEAT), row = new Float64Array(NT);
  for (const t of seqs) { const n = t.length;
    for (let i = 0; i < n; i++) { const x = tIdx[t[i]]; if (x < 0) continue; row[x]++; const base = x * NFEAT;
      for (let o = 1; o <= R; o++) {
        if (i - o >= 0) { const f = fIdx[t[i - o]]; if (f >= 0) C[base + ((o - 1) * 2) * NF + f]++; }
        if (i + o < n) { const f = fIdx[t[i + o]]; if (f >= 0) C[base + ((o - 1) * 2 + 1) * NF + f]++; } } } }
  const col = new Float64Array(NFEAT), rowF = new Float64Array(NT); let T = 0;
  for (let x = 0; x < NT; x++) for (let k = 0; k < NFEAT; k++) { const c = C[x * NFEAT + k]; col[k] += c; rowF[x] += c; T += c; }
  return { C, row, col, rowF, T }; }
const Rl = countAll(real); say('counted real'); const Sh = countAll(shuf); say('counted shuffled'); const Sh2 = countAll(shuf2); say('counted shuffled 2');

// ── licensing: the giver's candidates that are Same as the other licensed candidates, iterated to a fixed point
const W1 = 2 * NF, L1 = new Float32Array(NT * W1);
for (let x = 0; x < NT; x++) { let rw = 0; for (let k = 0; k < W1; k++) rw += Rl.C[x * NFEAT + k]; let n2 = 0; if (!rw) continue;
  for (let k = 0; k < W1; k++) { const c = Rl.C[x * NFEAT + k]; if (!c) continue; const v = Math.log((c * Rl.T) / (rw * Rl.col[k])); if (v > 0) { L1[x * W1 + k] = v; n2 += v * v; } }
  const n = Math.sqrt(n2) || 1; for (let k = 0; k < W1; k++) L1[x * W1 + k] /= n; }
const dot1 = (a, v) => { let s = 0; for (let k = 0; k < W1; k++) s += L1[a * W1 + k] * v[k]; return s; };
const pq = mulberry32(5), rs = []; for (let i = 0; i < 100000; i++) { const a = Math.floor(pq() * NT); let b; do { b = Math.floor(pq() * NT); } while (b === a); rs.push(dot1(a, L1.subarray(b * W1, (b + 1) * W1))); }
rs.sort((a, b) => a - b); const sameNull = rs[Math.floor(0.999 * (rs.length - 1))];
const cands = giver.candidates.map(c => c.w).filter(w => byWord.has(w)).map(w => byWord.get(w));
let lic = new Set(cands), rounds = 0, cosOf = new Map();
for (; rounds < 10; rounds++) { const next = new Set();
  for (const c of cands) { const cen = new Float64Array(W1); let m = 0; for (const o of lic) { if (o === c) continue; m++; for (let k = 0; k < W1; k++) cen[k] += L1[o * W1 + k]; }
    let n = 0; for (let k = 0; k < W1; k++) n += cen[k] * cen[k]; n = Math.sqrt(n) || 1; for (let k = 0; k < W1; k++) cen[k] /= n;
    const c0 = m ? dot1(c, cen) : 0; cosOf.set(c, c0); if (c0 > sameNull) next.add(c); }
  const same = next.size === lic.size && [...next].every(x => lic.has(x)); lic = next; if (same) break; }
const licensed = [...lic].map(x => [word(x), +cosOf.get(x).toFixed(3)]).sort((a, b) => b[1] - a[1]);
const refused = cands.filter(x => !lic.has(x)).map(x => [word(x), +cosOf.get(x).toFixed(3)]).sort((a, b) => b[1] - a[1]);
say('licensed', licensed.length, 'of', cands.length, 'in', rounds + 1, 'rounds; null', sameNull.toFixed(3));

// ── measure nouns: share of uses straight after the licensed class (or a digit token), against the same class over shuffled order
const inCls = new Uint8Array(freq.length); for (const x of lic) inCls[order[x]] = 1; for (let ty = 0; ty < vocab.length; ty++) if (isDigit[ty]) inCls[ty] = 1;
function afterCls(seqs) { const a = new Uint32Array(NT); for (const t of seqs) for (let i = 1; i < t.length; i++) { const x = tIdx[t[i]]; if (x >= 0 && inCls[t[i - 1]]) a[x]++; } return a; }
const aR = afterCls(real), aS = afterCls(shuf);
const shareS = []; for (let x = 0; x < NT; x++) if (Sh.row[x] >= MINUSES) shareS.push(aS[x] / Sh.row[x]); shareS.sort((a, b) => a - b);
const share999 = shareS[Math.floor(0.999 * (shareS.length - 1))];
const measureOf = (a, M) => { const out = new Map(); for (let x = 0; x < NT; x++) { if (!/^\p{L}/u.test(word(x)) || a[x] < MINUSES) continue; const s = a[x] / M.row[x]; if (s > share999) out.set(x, s); } return out; };
const measR = measureOf(aR, Rl), measS = measureOf(aS, Sh);
say('measure nouns real', measR.size, 'shuffled', measS.size, 'share999', share999.toFixed(4));

// ── selections: real and shuffled counts of a cell are two draws of one mean under the null; given n, c_real ~ Binomial(n, 1/2)
const ALPHA = 1e-5; const lgam = (() => { const t = [0]; for (let i = 1; i < 200000; i++) t[i] = t[i - 1] + Math.log(i); return t; })();
function binomTail(c, n) { // P(X >= c | n, 1/2), exact by log terms up to a cap, normal beyond
  if (n > 150000) { const z = (c - 0.5 - n / 2) / Math.sqrt(n / 4); return 0.5 * Math.exp(-z * z / 2) / Math.max(1, z * 0.8); }
  let s = 0; const ln2n = n * Math.LN2; for (let k = c; k <= n; k++) { const t = Math.exp(lgam[n] - lgam[k] - lgam[n - k] - ln2n); s += t; if (t < s * 1e-12) break; } return s; }
function selections(M, N, meas) { const out = {}; let pairs = 0;
  for (let f = 0; f < NF; f++) { const q = vocab[order[f]]; if (!/^\p{L}+$/u.test(q)) continue; const best = new Map();
    for (let o = 1; o <= R; o++) for (let s = 0; s < 2; s++) { const k = ((o - 1) * 2 + s) * NF + f;
      for (const x of meas.keys()) { const c = M.C[x * NFEAT + k]; if (c < MINC) continue; const cs = N.C[x * NFEAT + k]; if (c <= cs || binomTail(c, c + cs) >= ALPHA) continue;
        const p = Math.log((c + 0.5) / (cs + 0.5)); const b = best.get(x); if (!b || p > b[0]) best.set(x, [p, c, (s ? '+' : '-') + o, cs]); } }
    if (best.size) { pairs += best.size; out[q] = [...best.entries()].sort((a, b) => b[1][0] - a[1][0]).map(([x, [p, c, at, cs]]) => [word(x), +p.toFixed(3), c, at, cs]); } }
  return { out, pairs }; }
const selR = selections(Rl, Sh, measR), selC = selections(Sh2, Sh, measR);
say('selections real', selR.pairs, 'pairs over', Object.keys(selR.out).length, 'question words; control', selC.pairs, 'pairs');
fs.writeFileSync(OUT, JSON.stringify({ schema: 'UsageSubstrate@1', prereg: 'SUBSTRATE-3', head, docs: real.length, tokens, NT, NF, R, minCount: MINC,
  giver: giver.giver, sameNull, rounds: rounds + 1, licensed, refused, share999, selectionNull: 'paired: P(X >= c_real | c_real + c_shuf, 1/2) < 1e-5, c_real >= 5',
  measure: [...measR.entries()].map(([x, s]) => [word(x), +s.toFixed(4), aR[x]]).sort((a, b) => b[1] - a[1]), selects: selR.out, pairs: selR.pairs,
  control: { measure: measS.size, measureWords: [...measS.keys()].map(word).slice(0, 50), pairs: selC.pairs, selects: Object.fromEntries(['long', 'cost', 'distant', 'old'].map(q => [q, (selC.out[q] || []).map(r => r[0])])) } }));
say('wrote', OUT);
