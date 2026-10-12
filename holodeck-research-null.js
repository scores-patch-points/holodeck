// holodeck-research-null.js — the two nulls the research assistant decides by. Pure: no DOM, no network, no clock,
// no model. Seeded from the material's own key, so the same material always gives the same answer.
//
// It follows holodeck-region.js's rule exactly: a statistic is "real" only when it is more extreme than EVERY one of
// DRAWS same-size draws from the null (the finest rank sayable is 1/(DRAWS+1)). Nothing here is a typed-in threshold:
// DRAWS is the resolution of "more extreme than chance" (declared there, inherited here), and every decision below is
// "outside all draws" or it is not.
//
//   1. RELEVANCE — is this text about the question, or does it merely share words with it?
//      statistic  G = sum over the question's terms of the one-sided log-likelihood ratio
//                 2*(c*ln(c/E) - (c-E)) for c > E, where c is the term's count in the text and E = L * p(term) is what
//                 L tokens of ordinary English would hold (p from the General English prior, add-one smoothed).
//      null       the same L-token stretch of ordinary English, drawn DRAWS times: each term's count ~ Poisson(L*p).
//      So a stray mention of a common word, or one mention of a rare word in a long page, is inside the null; a page
//      that says the question's rare words again and again is far outside it.
//
//   2. CORROBORATION GAIN — did this batch of sources earn anything beyond chance?
//      A referent is "earned" when two independent sources witness it (the lineage's earned-only standing). The
//      batch's gain is how many referents it carried across that line. The null re-draws each batch source's
//      already-known referents popularity-proportionally from the corpus read so far (same count, same fresh
//      referents kept) — "this batch is just another sample of what we already have". Gain outside every draw means
//      the batch consolidated something new; inside means the corpus has stopped learning from reading more.
//
// A corpus with no earlier sources has no baseline, so it has no null: `testable:false`, never a made-up verdict.

export const DRAWS = 199;   // declared in holodeck-region.js (1/DRAWS is the resolution of "more extreme than chance")

export const hash32 = s => { s = String(s); let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
export const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

// ── words ────────────────────────────────────────────────────────────────────────────────────────────────────────
export const fold = s => String(s == null ? '' : s).normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();
export const wordsOf = text => fold(text).match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu) || [];
/** The fold's own stem rule (fold-chat-web.js stemOf): the first five letters of a longer word, so "proved/proof",
 *  "theorem/theorems" meet. Language-neutral: no suffix list. */
export const stemOf = w => (w.length > 5 ? w.slice(0, 5) : w);
export const stemsOf = text => wordsOf(text).map(stemOf);

/** The question's terms: distinct stems, minus any the caller marks function-only (a closed-class word is not about
 *  anything). `isFunction(word)` is optional — the page injects the vendored POS prior; with none, the one-sided
 *  statistic already gives a function word ~nothing (its observed rate IS the background rate). */
export function termsOf(question, isFunction = null) {
  const out = new Map();   // stem -> first word
  for (const w of wordsOf(question)) { if (isFunction && isFunction(w)) continue; const s = stemOf(w); if (!out.has(s)) out.set(s, w); }
  return [...out.keys()];
}

// ── the background: ordinary English, by stem ───────────────────────────────────────────────────────────────────
/** `entries`: [[word, count], …] or a Map of word -> count | [capitalised, total] (the shape holodeck's HD_REF.casing
 *  has). Counted by stem, add-one smoothed, so a word the prior has never seen is the rarest thing it can say. */
export function makeBackground(entries) {
  const m = new Map(); let n = 0;
  const each = entries instanceof Map ? entries.entries() : entries;
  for (const [w, v] of each) {
    const c = Array.isArray(v) ? +v[1] : +v; if (!(c > 0)) continue;
    const s = stemOf(fold(w)); m.set(s, (m.get(s) || 0) + c); n += c;
  }
  const V = m.size;
  return { n, v: V, ok: n > 0, p: stem => ((m.get(stem) || 0) + 1) / (n + V + 1), seen: stem => m.has(stem) };
}

// ── relevance ────────────────────────────────────────────────────────────────────────────────────────────────────
const g2 = (c, E) => (c > E ? 2 * (c * Math.log(c / E) - (c - E)) : 0);
function poisson(lambda, r) {
  if (!(lambda > 0)) return 0;
  if (lambda < 30) { const L = Math.exp(-lambda); let k = 0, p = 1; do { k++; p *= r(); } while (p > L); return k - 1; }
  const z = Math.sqrt(-2 * Math.log(r() || 1e-12)) * Math.cos(2 * Math.PI * r());
  return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * z));
}

/** G of a text for a set of question stems against the background. `counts` is Map stem -> count, L the token count. */
export function keyness(terms, counts, L, bg) {
  let G = 0; const matched = [];
  for (const t of terms) { const c = counts.get(t) || 0; if (!c) continue; const E = L * bg.p(t); const g = g2(c, E); if (g > 0) { G += g; matched.push({ stem: t, count: c, expected: +E.toFixed(4), g: +g.toFixed(2) }); } }
  matched.sort((a, b) => b.g - a.g);
  return { g: G, matched };
}

/** The relevance verdict for one text. `key` seeds the null (use question + address + stage). Returns
 *  { ok, g, nullMax, nullMedian, outside, p, matched, L, draws } or { ok:false, why } when it cannot be decided. */
export function relevance(terms, text, bg, { key = '', draws = DRAWS } = {}) {
  if (!bg || !bg.ok) return { ok: false, why: 'no ordinary-English background is loaded, so there is nothing to measure chance against' };
  if (!terms.length) return { ok: false, why: 'the question has no content terms to measure' };
  const toks = typeof text === 'string' ? stemsOf(text) : text, L = toks.length;
  const counts = new Map(); for (const t of toks) counts.set(t, (counts.get(t) || 0) + 1);
  const obs = keyness(terms, counts, L, bg);
  const r = rng(hash32(key + '|' + L)); const nul = [];
  for (let d = 0; d < draws; d++) { let G = 0; for (const t of terms) { const E = L * bg.p(t); G += g2(poisson(E, r), E); } nul.push(G); }
  nul.sort((a, b) => a - b);
  const nullMax = nul[nul.length - 1] || 0, ge = nul.filter(x => x >= obs.g).length;
  return { ok: true, g: +obs.g.toFixed(3), nullMax: +nullMax.toFixed(3), nullMedian: +nul[nul.length >> 1].toFixed(3), outside: obs.g > nullMax, p: (1 + ge) / (draws + 1), matched: obs.matched, L, draws };
}

// ── corroboration gain ──────────────────────────────────────────────────────────────────────────────────────────
/** How many referents a batch carried across the earned line (support >= 2), given `prior` (Map ref -> number of
 *  sources that witness it so far) and `batch` (an array of Set of refs, one per source). */
export function earnedGain(prior, batch) {
  const inBatch = new Map();
  for (const S of batch) for (const r of S) inBatch.set(r, (inBatch.get(r) || 0) + 1);
  let delta = 0, viaCorpus = 0, viaBatch = 0;
  for (const [r, k] of inBatch) {
    const before = prior.get(r) || 0;
    if (before < 2 && before + k >= 2) { delta++; if (before > 0) viaCorpus++; else viaBatch++; }
  }
  return { delta, viaCorpus, viaBatch };
}

/** The null for that gain: each batch source's already-known referents are re-drawn from the corpus read so far,
 *  weighted by how many sources witness each (what a typical new sample of this same population would carry), same
 *  count per source, its fresh referents untouched. Returns { testable, observed, nullMax, nullMedian, outside, p }. */
export function earnedGainTest(prior, batch, { key = '', draws = DRAWS } = {}) {
  const observed = earnedGain(prior, batch);
  if (!prior.size) return { testable: false, why: 'no sources were read before this batch, so there is no baseline to be unsurprised by', observed: observed.delta, draws };
  const universe = [...prior.keys()].sort(), w = universe.map(r => prior.get(r)), cum = []; let tot = 0; for (const x of w) cum.push(tot += x);
  const kinds = batch.map(S => { const known = [], fresh = []; for (const r of S) (prior.has(r) ? known : fresh).push(r); return { n: known.length, fresh }; });
  const r = rng(hash32(key + '|' + universe.length + '|' + batch.length));
  const pick = () => { const x = r() * tot; let lo = 0, hi = cum.length - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] > x) hi = mid; else lo = mid + 1; } return universe[lo]; };
  const nul = [];
  for (let d = 0; d < draws; d++) {
    const sets = kinds.map(k => { const S = new Set(k.fresh); const room = Math.min(k.n, universe.length); let guard = 0; let got = 0;
      while (got < room && guard++ < room * 40 + 40) { const x = pick(); if (!S.has(x)) { S.add(x); got++; } }
      return S; });
    nul.push(earnedGain(prior, sets).delta);
  }
  nul.sort((a, b) => a - b);
  const nullMax = nul[nul.length - 1], ge = nul.filter(x => x >= observed.delta).length;
  return { testable: true, observed: observed.delta, viaCorpus: observed.viaCorpus, viaBatch: observed.viaBatch, nullMax, nullMedian: nul[nul.length >> 1], outside: observed.delta > nullMax, p: (1 + ge) / (draws + 1), draws };
}
