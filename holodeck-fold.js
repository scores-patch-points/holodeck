// holodeck-fold.js — the folded reading of a scan: what each OCR token is, and what it should read as, asserted
// from what the REST of the sample established, never from a language model's next-word guess.
//
// The discipline is the engine's own (cast.js::resolve, holodeck-match.js), applied token by token:
//   1. Exact      the form is established: another contract in the sample reads it. It stands as read.
//   2. Near-miss  surfaces.js::isNearMissSpelling (one edit, both sides >= MIN_VARIANT_LEN) or an OCR-style visual
//                 confusable (surfaces.js::opticalReferentForm), against forms the sample established. It is a LAST
//                 RESORT, reached only when the form itself is not established.
//   3. Witness    the neighbours: a candidate stands only if every known neighbour has been read beside it in the
//                 sample. Witnesses narrow the candidates; they never choose between ties.
//   4. Refuse     more than one candidate left, or none supported: the token is left as read and says why.
// A form is "established" by DOCUMENT frequency (how many other contracts hold it), so a page's own misreads cannot
// vouch for themselves: the page's own document is subtracted before it asks.
import { isNearMissSpelling, opticalReferentForm } from './vendor/eoreader7/native/adapters/text/surfaces.js';

const MIN_LEN = 4;                                   // surfaces.js::MIN_VARIANT_LEN, the engine's own floor
const coreOf = (t) => { const s = String(t || ''); if (/\d/.test(s)) return null;
  const m = /^([^A-Za-z]*)([A-Za-z]+(?:['’][A-Za-z]+)?)([^A-Za-z]*)$/.exec(s); return m ? { pre: m[1], w: m[2], post: m[3] } : null; };
const lc = (w) => w.toLowerCase().replace(/’/g, "'");
const isTitle = (w) => /^[A-Z][a-z]+$/.test(w);
const recase = (from, to) => (from === from.toUpperCase() && from.length > 1 ? to.toUpperCase() : /^[A-Z]/.test(from) ? to[0].toUpperCase() + to.slice(1) : to);
const deletes = (w) => { const o = [w]; for (let i = 0; i < w.length; i++) o.push(w.slice(0, i) + w.slice(i + 1)); return o; };

export function makeFold(priors) {
  const words = priors.words || {}, pairs = priors.pairs || {};
  const byDel = new Map(), byOpt = new Map();
  for (const w of Object.keys(words)) { if (w.length < MIN_LEN) continue;
    for (const k of deletes(w)) { let a = byDel.get(k); if (!a) byDel.set(k, a = []); a.push(w); }
    const o = opticalReferentForm(w); let b = byOpt.get(o); if (!b) byOpt.set(o, b = []); b.push(w); }
  const own = (rec) => { const W = new Set(), P = new Set();
    for (const pg of rec) { let prev = null; for (const e of pg.elements || []) { const c = coreOf(e.text), w = c && c.w.length >= 2 ? lc(c.w) : null;
      if (!w) { prev = null; continue; } W.add(w); if (prev) P.add(prev + ' ' + w); prev = w; } }
    return { W, P }; };
  function foldDoc(rec, { protect = new Set() } = {}) {
    const { W, P } = own(rec);
    const df = (w) => Math.max(0, (words[w] || 0) - (W.has(w) ? 1 : 0));
    const pf = (a, b) => { const k = a + ' ' + b; return Math.max(0, (pairs[k] || 0) - (P.has(k) ? 1 : 0)); };
    const out = [], stats = { read: 0, repaired: 0, refused: 0, unread: 0, name: 0, other: 0 };
    for (const pg of rec) {
      const els = pg.elements || [], toks = els.map((e) => { const c = coreOf(e.text); return { e, c, w: c ? lc(c.w) : null }; });
      const page = [];
      for (let i = 0; i < toks.length; i++) {
        const t = toks[i], r = { i, text: t.e.text, kind: 'other' };
        if (!t.c || t.c.w.length < MIN_LEN) { stats.other++; page.push(r); continue; }
        // established as read, or as a plural/singular of a form the sample read: an inflection is not a misread
        const infl = (t.w.endsWith('s') ? df(t.w.slice(0, -1)) : 0) + df(t.w + 's');
        if (df(t.w) > 0 || infl > 0 || protect.has(t.w)) { r.kind = 'read'; r.vouched = df(t.w) || infl; stats.read++; page.push(r); continue; }
        if (isTitle(t.c.w)) { r.kind = 'name'; stats.name++; page.push(r); continue; }          // a name is not respelled
        // near-miss candidates: established forms one edit away, or the same form seen through OCR-style glyph swaps
        const cand = new Set();
        for (const k of deletes(t.w)) for (const w of byDel.get(k) || []) if (df(w) > 0 && w !== t.w && isNearMissSpelling(t.w, w)) cand.add(w);
        for (const w of byOpt.get(opticalReferentForm(t.w)) || []) if (df(w) > 0 && w !== t.w) cand.add(w);
        const prev = i > 0 && toks[i - 1].w ? (out.length && page[i - 1] && page[i - 1].to ? lc(page[i - 1].to) : toks[i - 1].w) : null;
        const next = i + 1 < toks.length && toks[i + 1].w ? toks[i + 1].w : null;
        const supported = [...cand].filter((c) => (prev === null || pf(prev, c) > 0) && (next === null || pf(c, next) > 0) && (prev !== null || next !== null));
        if (supported.length === 1) { const c = supported[0]; r.kind = 'repaired'; r.to = t.c.pre + recase(t.c.w, c) + t.c.post; r.vouched = df(c); r.pairs = (prev ? pf(prev, c) : 0) + (next ? pf(c, next) : 0); stats.repaired++; }
        else if (cand.size > 0) { r.kind = 'refused'; r.why = supported.length > 1 ? 'more than one established form fits: ' + supported.slice(0, 4).join(', ') : 'no neighbour has been read beside ' + [...cand].slice(0, 3).join(' / '); stats.refused++; }
        else { r.kind = 'unread'; stats.unread++; }
        page.push(r);
      }
      // JUNK: stray glyphs the scan put in or around text (_ | ~ ¢ [ ] ⌟ ...) are noise, not text. A token carrying one is
      // CLEANED of it ("|9/30/2006" -> "9/30/2006", "$__2,000,000" -> "$2,000,000"); if nothing that reads as a word or a
      // number is left, it is DROPPED ("_]", "a¢y"). A bare symbol with no glyph in it still stands when the tokens on both
      // sides stand as read or are numbers ("Smith & Sons", "$ 1,000", a hyphen between words), the repairs' own witness.
      const ODD = /[_|~¢¬§¤¦\\^`<>{}\[\]⌟⌞⌜⌝]/, ODD_G = new RegExp(ODD.source, 'g');
      const standing = (x) => x && (x.kind === 'read' || /\d/.test(x.text));
      page.forEach((r, i) => {
        if (r.kind === 'repaired' || r.kind === 'read' || r.kind === 'name') return;
        const t = r.text || '', hasOdd = ODD.test(t), symbolOnly = !/[\p{L}\p{N}]/u.test(t);
        if (!hasOdd && !(symbolOnly && !(standing(page[i - 1]) && standing(page[i + 1])))) return;
        const rest = t.replace(ODD_G, '').replace(/^[^\p{L}\p{N}$%(“"']+|[^\p{L}\p{N}%)”"'.,;:]+$/gu, '');
        const keeps = /\p{L}{3,}/u.test(rest) || /\p{N}/u.test(rest);
        r.junk = true; r.drop = !keeps; r.cleanTo = keeps ? rest : ''; r.conf = (els[i] && els[i].conf) || 0; stats.junk = (stats.junk || 0) + 1;
      });
      out.push({ page: pg.page, tokens: page });
    }
    return { pages: out, stats };
  }
  return { foldDoc };
}
