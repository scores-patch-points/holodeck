// reading/tokenize.js — punctuation is settled HERE, at tokenization, so part-of-speech only ever
// receives word forms. Script-neutral: a character is punctuation or a symbol by its Unicode general
// category (\p{P}, \p{S}), never by an English list. Offsets s/e are UTF-16 indices into the text given
// (+ base), exactly as the old word regex produced them, so the byte anchoring of a reading is unchanged.
//
//   word  : letters/numbers/marks, with an apostrophe, hyphen or dot kept INSIDE ("don’t", "well-known",
//           "3.14", "U.S"). No edge punctuation. A trailing dot stays only for an abbreviation, and which
//           tokens are abbreviations is the sentence splitter's knowledge, handed in as `abbreviations`
//           (spans.js deriveAbbreviations / its injected prior) — plus the structural initialism "U.S.".
//   punct : one token per \p{P} / \p{S} code point, class PUNCT (P*) or SYM (S*), carried as `upos`.
//           It is never sent to the word-class prior.
const WORD_CORE = /[\p{L}\p{N}\p{M}]+(?:['’\-.][\p{L}\p{N}\p{M}]+)*/uy;
const PUNCT_OR_SYM = /[\p{P}\p{S}]/u;
const INITIALISM = /^(?:\p{L}\.)+\p{L}$/u;
const lastLetterRun = (w) => { let j = w.length; while (j > 0 && /[\p{L}\p{M}]/u.test(w[j - 1])) j--; return w.slice(j); };

/** The class a punctuation/symbol character carries, from its Unicode category alone. */
export const punctClass = (ch) => (/^\p{P}$/u.test(ch) ? 'PUNCT' : /^\p{S}$/u.test(ch) ? 'SYM' : null);

/** All tokens in order: {w, s, e, kind:'word'} or {w, s, e, kind:'punct', upos:'PUNCT'|'SYM'}. */
export function tokensIn(text, base = 0, { abbreviations = null } = {}) {
  const src = String(text ?? ''), out = [], abbr = abbreviations instanceof Set ? abbreviations : new Set(abbreviations || []);
  let i = 0;
  while (i < src.length) {
    WORD_CORE.lastIndex = i;
    const m = WORD_CORE.exec(src);
    if (m) {
      let w = m[0];
      if (src[i + w.length] === '.' && (INITIALISM.test(w) || (/\p{L}$/u.test(w) && abbr.has(lastLetterRun(w))))) w += '.';
      out.push({ w, s: base + i, e: base + i + w.length, kind: 'word' });
      i += w.length; continue;
    }
    const cp = String.fromCodePoint(src.codePointAt(i)), n = cp.length;
    if (PUNCT_OR_SYM.test(cp)) out.push({ w: cp, s: base + i, e: base + i + n, kind: 'punct', upos: punctClass(cp) });
    i += n;
  }
  return out;
}

/** The word tokens only — what part-of-speech is asked about. */
export const wordsIn = (text, base = 0, opts) => tokensIn(text, base, opts).filter((t) => t.kind === 'word').map(({ w, s, e }) => ({ w, s, e }));
/** The punctuation/symbol tokens only, each already classed. */
export const punctIn = (text, base = 0, opts) => tokensIn(text, base, opts).filter((t) => t.kind === 'punct');
