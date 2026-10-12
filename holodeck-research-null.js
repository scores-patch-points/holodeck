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
//   2. SATURATION — is another source still expected to bring anything the corpus lacks?
//      f1/n, leave-one-out, below one item (see the section below). A floor of one indivisible unit, not a tuned
//      constant — and not a drawn null: the drawn alternative (re-sampling the corpus's own referents) was tried on a
//      shakedown run and is biased toward "inside" in any heavy-tailed corpus, so it is not used to stop anything.
//
// A corpus too small to measure is `testable:false`, never a made-up verdict.

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

// ── saturation ──────────────────────────────────────────────────────────────────────────────────────────────────────
// When has reading more stopped being worth it? Not "when it has stopped confirming names": a real topic's long tail
// keeps confirming moderately common names for a long time (measured on a shakedown run — a corpus of 6 sources still
// confirmed ~20 names per batch). What DOES saturate is novelty. The Good–Turing / Chao argument: if f1 of the items
// (names and words) seen so far were said by exactly one source, then one more source is expected to bring about
// f1/n items nobody has said yet (n = sources read). Below ONE item, reading another source is expected to turn up not
// even a single thing the corpus lacks — the unit of a count is the floor of what can be told from nothing.
//
// To be robust it is leave-one-out: the largest of the n estimates, each with one source set aside, must be below one.
// With fewer than three sources, setting one aside leaves no overlap to measure, so it is untestable — and reading goes on.
// A corpus of mirrors or syndicated copies saturates at once; a diverse one essentially never does, and then the run
// ends where the relevance null ends the pool (and says so).
export function supportOf(sets) {
  const m = new Map();
  for (const S of sets) for (const r of S) m.set(r, (m.get(r) || 0) + 1);
  return m;
}
export function unseenExpectation(sets) {
  const n = sets.length; let f1 = 0;
  for (const c of supportOf(sets).values()) if (c === 1) f1++;
  return { n, f1, expected: n ? f1 / n : 0 };
}
export function saturationTest(sets) {
  const n = sets.length;
  if (n < 3) return { testable: false, why: 'fewer than three sources: setting one aside would leave no overlap to measure' };
  const pt = unseenExpectation(sets);
  const loo = sets.map((_, j) => unseenExpectation(sets.filter((__, i) => i !== j)).expected);
  const looMax = Math.max(...loo);
  return { testable: true, n, f1: pt.f1, expected: +pt.expected.toFixed(2), looMax: +looMax.toFixed(2), saturated: looMax < 1 };
}

/** How many referents a batch carried across the earned line (support >= 2), given `prior` (Map ref -> number of
 *  sources that witness it so far) and `batch` (an array of Set of refs, one per source). Reported, never a stop. */
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

// ── is it prose? ────────────────────────────────────────────────────────────────────────────────────────────────────
// A page can mention the question's words and still be no account of anything: a metadata record returned as a string
// ("{'type': 'BOOK CHAPTER', 'id': None, …}"), a JSON blob, a template dump. Prose is the reference class the corpus is
// made of, so the null is the OTHER sources: the share of structure characters in this text against the share in 199
// same-size stretches drawn from the other sources read. More than every one of them → it is a record, not prose.
// With no other source there is nothing to be unlike, so it is untestable — and kept.
const STRUCT = /[{}\[\]<>=_\\|^~]|["']\s*:/g;
export function structureRate(text) { const t = String(text == null ? '' : text); if (!t.length) return 0; const m = t.match(STRUCT); return (m ? m.length : 0) / t.length; }
export function proseTest(text, peers, { key = '', draws = DRAWS } = {}) {
  const others = (peers || []).filter(p => typeof p === 'string' && p.length >= 40);
  const t = String(text || '');
  if (!others.length || !t.length) return { testable: false, why: 'no other source to compare its structure with' };
  const r = rng(hash32(key + '|' + t.length + '|' + others.length)), win = Math.min(4000, t.length);
  const obs = structureRate(t); let hi = 0;
  for (let d = 0; d < draws; d++) {
    const src = others[Math.floor(r() * others.length)], w = Math.min(win, src.length), at = Math.floor(r() * (src.length - w + 1));
    const x = structureRate(src.slice(at, at + w)); if (x > hi) hi = x;
  }
  return { testable: true, obs: +obs.toFixed(5), nullMax: +hi.toFixed(5), outside: obs > hi, draws };
}
