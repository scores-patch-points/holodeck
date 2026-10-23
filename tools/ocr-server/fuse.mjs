// fuse.mjs — two eyes and a prior, folded into one reading. Pure: no files, no processes.
//
// Two recognisers read the same page and disagree on some words. Where they agree the word stands. Where they
// disagree, a PRIOR decides: the words the document itself already uses (its own text layer, page by page), so a
// misread that spells a word the document never uses ("Perks" in a PDF about "Parks") loses to the spelling it does.
// Nothing disputed is thrown away silently: every word that does not make the reading is returned in `dropped`,
// naming the eye that produced it.
//
// Measured on a 674-page email-thread PDF with tools/ocr-server/bench.mjs (40 pages spread across it, each rendered to pixels and
// scored against the PDF's own text layer, the page itself subtracted from the prior), word F1:
//                      Apple Vision   tesseract   both eyes + the PDF's own words   ('strict')
//     rendered 150 dpi     0.873         0.778            0.886                       0.897
//     rendered 220 dpi     0.927         0.944            0.958                       0.961
// With a prior that knows nothing the fusion is exactly the primary eye (a test holds it to that), so every point above the
// primary eye is the prior's. Clean born-digital pages bound a reader from above; they do not certify it on a scan.
//
// NOT SAFE ALONE YET. The primary eye is fixed (the best-ranked eye on the machine: Vision on a Mac). On two other PDFs the fused
// reading fell BELOW the better single eye at 220 dpi (an IRS form: fused 0.963, Vision 0.984; a screenplay: fused 0.978, tesseract
// 0.999): when one eye is clearly better, fusion lands between the two. Choosing the primary per document is open work (the fold suite's
// goal `ocr-primary-eye`). Until then, treat the fused reading as the safer default, not as never worse.
//
// Rules, in order, over the alignment (longest common subsequence) of the two word streams:
//   agreed      both eyes produced the word                               -> kept
//   replaced    a run where the eyes differ                               -> per word if the runs are the same length
//               (the prior picks the spelling it knows; if it knows both or neither, the primary eye stands), else the
//               whole run from the side the prior knows better
//   base-only   only the primary eye produced it                          -> kept ('keep-base'), or kept if known ('strict')
//   other-only  only the secondary eye produced it                        -> kept only if the prior knows it
//   a word with a digit in it is never dropped on the prior's say-so: the prior cannot know an amount or a date.

const PARTS = /[\p{L}\p{N}]+/gu;
/** the letters-and-digits runs of a word, lower-cased: "jane.doe@example.gov" -> jane doe example gov */
export const parts = (w) => String(w).toLowerCase().match(PARTS) || [];
export const keyOf = (w) => { const p = parts(w); return p.length ? p.join(' ') : String(w); };
export const hasDigit = (w) => /\p{N}/u.test(w);

/** The words a document already uses, counted by how many of its pages use them. A word is KNOWN when at least
 *  `minPages` pages use it; a page being read can subtract itself (`own`) so it never vouches for its own misreads. */
export class Prior {
  constructor(minPages = 2) { this.df = new Map(); this.pages = 0; this.minPages = minPages; }
  static partsOf(text) { return new Set(parts(text)); }
  /** add one page: its text, or the Set of its parts. Returns the Set added. */
  add(page) {
    const set = typeof page === 'string' ? Prior.partsOf(page) : page;
    for (const p of set) this.df.set(p, (this.df.get(p) || 0) + 1);
    this.pages++; return set;
  }
  knows(word, own = null) {
    const ps = parts(word); if (!ps.length) return true; // pure punctuation: nothing to know
    return ps.every((p) => (this.df.get(p) || 0) - (own && own.has(p) ? 1 : 0) >= this.minPages);
  }
  get size() { return this.df.size; }
}

/** lines [{ t, words?:[{t}] }] -> [{ w, line }] in reading order */
export function wordsOf(lines) {
  const out = [];
  (lines || []).forEach((l, i) => {
    const ws = l.words && l.words.length ? l.words.map((w) => w.t) : String(l.t || '').split(/\s+/).filter(Boolean);
    for (const w of ws) out.push({ w, line: i });
  });
  return out;
}

/** matched index pairs of the longest common subsequence of two key arrays, or null when it is too big to align */
export function align(ka, kb, maxCells) {
  let s = 0; while (s < ka.length && s < kb.length && ka[s] === kb[s]) s++;
  let ea = ka.length, eb = kb.length; while (ea > s && eb > s && ka[ea - 1] === kb[eb - 1]) { ea--; eb--; }
  const n = ea - s, m = eb - s;
  if (n * m > maxCells) return null;
  const pairs = []; for (let i = 0; i < s; i++) pairs.push([i, i]);
  if (n && m) {
    const W = m + 1, L = new Uint16Array((n + 1) * W);
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
      L[i * W + j] = ka[s + i] === kb[s + j] ? L[(i + 1) * W + j + 1] + 1 : Math.max(L[(i + 1) * W + j], L[i * W + j + 1]);
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (ka[s + i] === kb[s + j]) { pairs.push([s + i, s + j]); i++; j++; }
      else if (L[(i + 1) * W + j] >= L[i * W + j + 1]) i++; else j++;
    }
  }
  for (let k = 0; k < ka.length - ea; k++) pairs.push([ea + k, eb + k]);
  return pairs;
}

/** fuse(base, other, prior, { own, policy }) — base and other are lines [{ t, words? }] from the primary and secondary eye.
 *  -> { text, words:[{ w, line, from }], dropped:[{ eye, w }], agreed:[w], stats, aligned } */
export function fuse(base, other, prior, { own = null, policy = 'keep-base', maxCells = 6e6 } = {}) {
  const A = wordsOf(base), B = wordsOf(other);
  const kn = (w) => prior.knows(w, own);
  const stats = { agreed: 0, replaced: 0, inserted: 0, baseOnlyKept: 0, dropped: 0 };
  const words = [], dropped = [], agreed = [];
  const take = (w, line, from) => words.push({ w, line, from });
  const drop = (eye, w) => { dropped.push({ eye, w }); stats.dropped++; };
  const finish = (aligned) => ({ text: assemble(words), words, dropped, agreed, stats, aligned });

  if (!B.length) { for (const x of A) take(x.w, x.line, 'base'); return finish(true); }
  if (!A.length) { for (const y of B) take(y.w, y.line, 'other'); return finish(true); }
  const pairs = align(A.map((x) => keyOf(x.w)), B.map((y) => keyOf(y.w)), maxCells);
  if (!pairs) { for (const x of A) take(x.w, x.line, 'base'); return finish(false); } // too dense to align: the primary eye stands

  // a real word the document knows: punctuation alone is nothing to know, so it never beats a word
  const kw = (w) => parts(w).length > 0 && kn(w);
  // 'strict' needs a prior that has read something; a prior of fewer than 3 pages knows too little to throw words away on its say-so
  const strict = policy === 'strict' && prior.pages >= 3;
  const strictKeep = (w) => !strict || kw(w) || hasDigit(w) || parts(w).length === 0;
  const hunk = (a, b, prevLine) => {
    if (!b.length) { for (const x of a) { if (strictKeep(x.w)) { take(x.w, x.line, 'base'); stats.baseOnlyKept++; } else drop('base', x.w); } return; }
    if (!a.length) { for (const y of b) { if (kw(y.w)) { take(y.w, prevLine, 'other'); stats.inserted++; } else drop('other', y.w); } return; }
    if (a.length === b.length) {
      a.forEach((x, i) => {
        const y = b[i];
        if (kw(y.w) && !kw(x.w)) { take(y.w, x.line, 'other'); stats.replaced++; drop('base', x.w); }
        else if (strictKeep(x.w)) { take(x.w, x.line, 'base'); drop('other', y.w); }
        else { drop('base', x.w); drop('other', y.w); }
      });
      return;
    }
    const frac = (r) => r.filter((q) => kw(q.w)).length / r.length;
    if (frac(b) > frac(a)) { b.forEach((y, i) => { take(y.w, a[Math.min(i, a.length - 1)].line, 'other'); stats.replaced++; }); for (const x of a) drop('base', x.w); }
    else { for (const x of a) { if (strictKeep(x.w)) take(x.w, x.line, 'base'); else drop('base', x.w); } for (const y of b) drop('other', y.w); }
  };

  let ia = 0, ib = 0, prevLine = 0;
  for (const [pa, pb] of pairs) {
    hunk(A.slice(ia, pa), B.slice(ib, pb), prevLine);
    take(A[pa].w, A[pa].line, 'both'); agreed.push(A[pa].w); stats.agreed++; prevLine = A[pa].line;
    ia = pa + 1; ib = pb + 1;
  }
  hunk(A.slice(ia), B.slice(ib), prevLine);
  return finish(true);
}

/** words with line numbers -> text, a new line wherever the line number changes */
export function assemble(words) {
  const out = []; let cur = null, last = null;
  for (const x of words) {
    if (x.line !== last) { cur = []; out.push(cur); last = x.line; }
    cur.push(x.w);
  }
  return out.map((l) => l.join(' ')).join('\n');
}

/** word-level precision / recall / F1 of `read` against `truth` (multiset of lower-cased letter-digit runs) */
export function wordF1(truth, read) {
  const count = (t) => { const m = new Map(); for (const p of parts(t)) m.set(p, (m.get(p) || 0) + 1); return m; };
  const T = count(truth), R = count(read); let ov = 0;
  for (const [k, n] of T) ov += Math.min(n, R.get(k) || 0);
  const tn = [...T.values()].reduce((a, b) => a + b, 0), rn = [...R.values()].reduce((a, b) => a + b, 0);
  const recall = tn ? ov / tn : 0, precision = rn ? ov / rn : 0;
  return { recall, precision, f1: recall + precision ? 2 * recall * precision / (recall + precision) : 0 };
}
