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
  const m = /^([^\p{L}]*)(\p{L}+(?:['’]\p{L}+)?)([^\p{L}]*)$/u.exec(s); return m ? { pre: m[1], w: m[2], post: m[3] } : null; };
const lc = (w) => w.toLowerCase().replace(/’/g, "'");
const isTitle = (w) => /^[A-Z][a-z]+$/.test(w);
const recase = (from, to) => { const up = (from.match(/\p{Lu}/gu) || []).length, lo = (from.match(/\p{Ll}/gu) || []).length;
  return from.length > 1 && up >= lo && up > 1 ? to.toUpperCase() : /^\p{Lu}/u.test(from) ? to[0].toUpperCase() + to.slice(1) : to; };
// A word's stem family: elevate/elevated/elevates, hook/hooks/hooked/hooking. A form whose stem family the sample has
// established is a valid form of an established word, not a misread of one: "elevate" beside an established
// "elevated" is grammar, not noise. Mechanical: strip one inflectional ending, nothing learned.
const ENDINGS = ['ing', 'ied', 'ies', 'ed', 'es', 'er', 'ly', 's', 'd', 'e', 'y'];
const stemOf = (w) => { for (const e of ENDINGS) { if (w.length - e.length >= 4 && w.endsWith(e)) return w.slice(0, -e.length); } return w; };
const deletes = (w) => { const o = [w]; for (let i = 0; i < w.length; i++) o.push(w.slice(0, i) + w.slice(i + 1)); return o; };

export function makeFold(priors) {
  const words = priors.words || {}, pairs = priors.pairs || {};
  const byDel = new Map(), byOpt = new Map(), families = new Set();
  for (const w of Object.keys(words)) if (w.length >= 4) families.add(stemOf(w));
  for (const w of Object.keys(words)) { if (w.length < MIN_LEN) continue;
    for (const k of deletes(w)) { let a = byDel.get(k); if (!a) byDel.set(k, a = []); a.push(w); }
    const o = opticalReferentForm(w); let b = byOpt.get(o); if (!b) byOpt.set(o, b = []); b.push(w); }
  const own = (rec) => { const W = new Set(), P = new Set();
    for (const pg of rec) { let prev = null; for (const e of pg.elements || []) { const c = coreOf(e.text), w = c && c.w.length >= 2 ? lc(c.w) : null;
      if (!w) { prev = null; continue; } W.add(w); if (prev) P.add(prev + ' ' + w); prev = w; } }
    return { W, P }; };
  // witness: what a repair must stand on besides being uniquely one edit away.
  //   'both'  every known neighbour has been read beside the candidate in the sample (strictest)
  //   'any'   at least one known neighbour has
  //   'self'  a neighbour pair in the sample, OR this document itself reads the candidate cleanly elsewhere
  function foldDoc(rec, { protect = new Set(), witness = 'any', selfMin = 8 } = {}) {
    const { W, P } = own(rec);
    const df = (w) => Math.max(0, (words[w] || 0) - (W.has(w) ? 1 : 0));
    const pf = (a, b) => { const k = a + ' ' + b; return Math.max(0, (pairs[k] || 0) - (P.has(k) ? 1 : 0)); };
    const out = [], stats = { read: 0, repaired: 0, refused: 0, unread: 0, name: 0, other: 0 };
    // EARNED GROUND from the page itself: the words this document reads cleanly (established by the sample), counted
    const selfRead = new Map();
    for (const pg of rec) for (const e of pg.elements || []) { const c = coreOf(e.text); if (!c || c.w.length < MIN_LEN) continue; const w = lc(c.w);
      if (df(w) > 0) selfRead.set(w, (selfRead.get(w) || 0) + 1); }
    // a form this document prints identically again and again may simply be printed that way: the source's own typo
    const sameForm = new Map();
    for (const pg of rec) for (const e of pg.elements || []) { if (e.text && !selfRead.has(lc(coreOf(e.text) ? coreOf(e.text).w : e.text))) sameForm.set(e.text, (sameForm.get(e.text) || 0) + 1); }
    for (const pg of rec) {
      const els = pg.elements || [], toks = els.map((e) => { const c = coreOf(e.text); return { e, c, w: c ? lc(c.w) : null }; });
      // the page's own type height: a box far taller than that (handwriting, a stray stroke) is not a set word, so
      // nothing is repaired from it (a handwritten "Government" was read "erent" and would have become "event")
      const hts = els.map((e) => (e.region || [])[3]).filter(Boolean).sort((a, b) => a - b), typeH = hts[Math.floor(hts.length / 2)] || 0;
      const page = [];
      for (let i = 0; i < toks.length; i++) {
        const t = toks[i], r = { i, text: t.e.text, kind: 'other' };
        if (!t.c || t.c.w.length < MIN_LEN) {
          // two things glued across an underline rule or a letter/digit join ("paTE_Jun3,2011" is "DATE Jun 3,2011"):
          // split, resolve each alphabetic part by the same rules, and join with a space
          const tx = t.e.text || '';
          // a digit INSIDE a word (grea5e) is a visual confusable for a letter, never a join: it is resolved whole through
          // the engine's optical form below. A join is an underline rule, or letters then a trailing digit group.
          const mixed = /\p{L}/u.test(tx) && /\d/.test(tx);
          // a digit in a word is a visual confusable for a letter, so a mixed token is first tried WHOLE through the optical
          // form; only when that finds nothing is it taken for two things joined
          let wholeDone = false;
          if (mixed && !/_/.test(tx)) {
            const letters = tx.replace(/[^\p{L}\d]/gu, ''), w = lc(letters);
            if (w.length >= MIN_LEN && df(w) === 0) { wholeDone = true;
              const cd = new Set(); for (const x of byOpt.get(opticalReferentForm(w)) || []) if (df(x) > 0 && x !== w) cd.add(x);
              const prevW = i > 0 && toks[i - 1].w ? toks[i - 1].w : null, nextW = i + 1 < toks.length && toks[i + 1].w ? toks[i + 1].w : null;
              const pairOkO = (c) => (prevW !== null && pf(prevW, c) > 0) || (nextW !== null && pf(c, nextW) > 0);
              const sup = [...cd].filter((c) => pairOkO(c) || (witness === 'self' && (selfRead.get(c) || 0) > 0));
              if (sup.length === 1) { const pre = (/^[^\p{L}\d]*/u.exec(tx) || [''])[0], post = (/[^\p{L}\d]*$/u.exec(tx) || [''])[0];
                r.kind = 'repaired'; r.to = pre + recase(letters.replace(/\d/g, 'x'), sup[0]) + post; r.vouched = df(sup[0]); r.pairs = (prevW ? pf(prevW, sup[0]) : 0) + (nextW ? pf(sup[0], nextW) : 0); r.self = selfRead.get(sup[0]) || 0; r.recurs = sameForm.get(tx) || 1; stats.repaired++; page.push(r); continue; }
              if (cd.size) { r.kind = 'refused'; r.why = 'one visual swap from ' + [...cd].slice(0, 3).join(' / ') + ', but no neighbour has been read beside it'; stats.refused++; page.push(r); continue; }
            }
          }
          const inner = false;
          if (!inner && !(wholeDone && !/_/.test(tx)) && (/_/.test(tx) || /\p{L}\d|\d\p{L}/u.test(tx))) {
            const segs = tx.split(/_+|(?<=\p{L})(?=\d)|(?<=\d)(?=\p{L})/u).filter(Boolean);
            if (segs.length > 1) {
              const prevW = i > 0 && toks[i - 1].w ? toks[i - 1].w : null;
              let changed = false, all = true;
              const fixed = segs.map((sg, j) => { const c = coreOf(sg); if (!c || c.w.length < MIN_LEN) return sg; const w = lc(c.w);
                if (df(w) > 0 || (selfRead.get(w) || 0) > 0) return sg;
                const cd = new Set();
                for (const k of deletes(w)) for (const x of byDel.get(k) || []) if (df(x) > 0 && x !== w && isNearMissSpelling(w, x)) cd.add(x);
                for (const x of byOpt.get(opticalReferentForm(w)) || []) if (df(x) > 0 && x !== w) cd.add(x);
                const sup = [...cd].filter((x) => (selfRead.get(x) || 0) > 0 || (j === 0 && prevW && pf(prevW, x) > 0));
                if (sup.length === 1) { changed = true; return c.pre + recase(c.w, sup[0]) + c.post; } all = false; return sg; });
              if (changed) { r.kind = 'repaired'; r.to = fixed.join(' '); r.vouched = 1; r.pairs = 0; r.self = 1; r.recurs = sameForm.get(tx) || 1; stats.repaired++; page.push(r); continue; }
            }
          }
          stats.other++; page.push(r); continue;
        }
        // established as read, or as a plural/singular of a form the sample read: an inflection is not a misread
        const infl = (t.w.endsWith('s') ? df(t.w.slice(0, -1)) : 0) + df(t.w + 's');
        if (df(t.w) > 0 || infl > 0 || protect.has(t.w)) { r.kind = 'read'; r.vouched = df(t.w) || infl; stats.read++; page.push(r); continue; }
        if (t.w.length >= 5 && families.has(stemOf(t.w))) { r.kind = 'read'; r.vouched = 0; r.form = 'a form of an established word'; stats.read++; page.push(r); continue; }
        if (isTitle(t.c.w)) { r.kind = 'name'; stats.name++; page.push(r); continue; }          // a name is not respelled
        if (typeH && t.e.region && t.e.region[3] > typeH * 1.5) { r.kind = 'refused'; r.why = 'its box is ' + Math.round(t.e.region[3] / typeH * 10) / 10 + ' times the page\'s own type height, so it is handwriting or a stray stroke, not set type'; stats.refused++; page.push(r); continue; }
        // near-miss candidates: established forms one edit away, or the same form seen through OCR-style glyph swaps
        const cand = new Set();
        for (const k of deletes(t.w)) for (const w of byDel.get(k) || []) if (df(w) > 0 && w !== t.w && isNearMissSpelling(t.w, w)) cand.add(w);
        for (const w of byOpt.get(opticalReferentForm(t.w)) || []) if (df(w) > 0 && w !== t.w) cand.add(w);
        const prev = i > 0 && toks[i - 1].w ? (out.length && page[i - 1] && page[i - 1].to ? lc(page[i - 1].to) : toks[i - 1].w) : null;
        const next = i + 1 < toks.length && toks[i + 1].w ? toks[i + 1].w : null;
        const pairOk = (c) => witness === 'any' ? ((prev !== null && pf(prev, c) > 0) || (next !== null && pf(c, next) > 0))
          : (prev === null || pf(prev, c) > 0) && (next === null || pf(c, next) > 0) && (prev !== null || next !== null);
        const supported = [...cand].filter((c) => pairOk(c) || ((selfRead.get(c) || 0) > 0 && c.length >= selfMin));
        if (supported.length === 1) { const c = supported[0]; r.kind = 'repaired'; r.to = t.c.pre + recase(t.c.w, c) + t.c.post; r.vouched = df(c); r.pairs = (prev ? pf(prev, c) : 0) + (next ? pf(c, next) : 0); r.self = selfRead.get(c) || 0; r.recurs = sameForm.get(t.e.text) || 1; stats.repaired++; }
        else if (cand.size > 0) { r.kind = 'refused'; r.why = supported.length > 1 ? 'more than one established form fits: ' + supported.slice(0, 4).join(', ') : 'no neighbour has been read beside ' + [...cand].slice(0, 3).join(' / '); stats.refused++; }
        else { r.kind = 'unread'; stats.unread++; }
        page.push(r);
      }
      // JUNK: stray glyphs the scan put in or around text (_ | ~ ¢ [ ] ⌟ ...) are noise, not text. A token carrying one is
      // CLEANED of it ("|9/30/2006" -> "9/30/2006", "$__2,000,000" -> "$2,000,000"); if nothing that reads as a word or a
      // number is left, it is DROPPED ("_]", "a¢y"). A bare symbol with no glyph in it still stands when the tokens on both
      // sides stand as read or are numbers ("Smith & Sons", "$ 1,000", a hyphen between words), the repairs' own witness.
      const ODD = /[_|~¢¬§¤¦\\^`<>{}\[\]⌟⌞⌜⌝]/, ODD_G = new RegExp(ODD.source, 'g');
      // standing: read elsewhere, a number, or a plain word of two letters or more (Inc., of, to): a separator between
      // two such words is punctuation, not noise
      const standing = (x) => x && (x.kind === 'read' || /\d/.test(x.text) || (/\p{L}{2,}/u.test(x.text) && !ODD.test(x.text)));
      page.forEach((r, i) => {
        if (r.kind === 'repaired') return;
        const t = r.text || '', hasOdd = ODD.test(t), symbolOnly = !/[\p{L}\p{N}]/u.test(t);
        if (r.kind === 'read' || r.kind === 'name') { if (!hasOdd) return; }
        if (!hasOdd && !(symbolOnly && !(standing(page[i - 1]) && standing(page[i + 1])))) return;
        const rest = t.replace(/(?<=[\p{L}\p{N}])_+(?=[\p{L}\p{N}])/gu, ' ').replace(ODD_G, '').replace(/^[^\p{L}\p{N}$%(“"']+|[^\p{L}\p{N}%)”"'.,;:]+$/gu, '');
        // a lone X (or x) left in a form box is a CHECK MARK, which is information: it is kept, not dropped
        const check = /^[xX]$/.test(rest);
        const keeps = check || /\p{L}{3,}/u.test(rest) || /\p{N}/u.test(rest);
        r.junk = true; r.drop = !keeps; r.cleanTo = keeps ? rest : ''; r.conf = (els[i] && els[i].conf) || 0; stats.junk = (stats.junk || 0) + 1;
      });
      out.push({ page: pg.page, tokens: page });
    }
    return { pages: out, stats };
  }
  return { foldDoc };
}
