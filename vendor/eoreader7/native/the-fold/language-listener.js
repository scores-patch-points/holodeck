// the-fold/language-listener.js — the language leg, heard the way a person hears it.
//
// A listener does not decide the language of a book from its last page. It
// hears a sentence, forms a view from what it has heard so far, and revises
// that view if the evidence turns (READING-SPEC S3 lookahead, S92 per-sentence
// script, S39 language as declared-or-causally-inferred). This is that:
//
//   listen(sentence) → { language, grammar, ear, revised?, gap? }
//
//   · the SCRIPT FAMILY of THIS sentence picks the candidate priors (a Chinese
//     sentence in an English document is read as Chinese);
//   · each candidate prior's running coverage (how many of the words heard so
//     far in that family it attests) is updated by this sentence only — O(words
//     × candidates), never a re-read;
//   · the current view per family is the same evidence rule as
//     language-grammar.js::detectLanguage (a strong share outright, or a lower
//     share with a margin over the runner-up) — and until the evidence clears
//     it the sentence is a typed gap, `language_unheard`, never a guess;
//   · when the leader changes, a `revision` event is recorded (append-only: the
//     sentences already read keep the language they were read in).
//   · a DECLARED language (S39) bypasses listening: it is a fact, not evidence.
//
// The ear for each candidate (segmentation, proclitics, enclitics) is built once.
import { availableStems, grammarFor } from "./language-grammar.js";
import { makeEar } from "../adapters/text/ear.js";

const SCRIPTS = [
  ["Han", /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu], ["Hangul", /\p{Script=Hangul}/gu],
  ["Arabic", /\p{Script=Arabic}/gu], ["Hebrew", /\p{Script=Hebrew}/gu], ["Cyrillic", /\p{Script=Cyrillic}/gu],
  ["Greek", /\p{Script=Greek}/gu], ["Devanagari", /\p{Script=Devanagari}/gu], ["Latin", /\p{Script=Latin}/gu],
];
const familyOf = (text) => {
  let best = null, n = 0;
  for (const [name, re] of SCRIPTS) { const c = (text.match(re) ?? []).length; if (c > n) { n = c; best = name; } }
  return best;
};
const STRONG = 0.3, FLOOR = 0.1, MARGIN = 1.8; // the same evidence rule as detectLanguage, declared once there

export function createLanguageListener({ declared = null } = {}) {
  const fixed = declared ? grammarFor(declared) : null;
  const fixedEar = fixed?.language ? makeEar({ posPrior: fixed.posPrior, proclitics: fixed.proclitics, enclitics: fixed.enclitics, contractions: fixed.contractions }) : null;
  const candidates = new Map(); // family -> [{stem, grammar, ear, hit, words}]
  const view = new Map();       // family -> current stem
  const revisions = [];
  let heard = 0;

  const candidatesFor = (family) => {
    if (candidates.has(family)) return candidates.get(family);
    const list = [];
    for (const stem of availableStems()) {
      const grammar = grammarFor(stem);
      if (!grammar.language || !grammar.framePrior) continue;
      const forms = Object.keys(grammar.posPrior.forms).slice(0, 4000);
      let sample = null;
      for (const [name, re] of SCRIPTS) { const c = forms.filter((w) => (re.lastIndex = 0, re.test(w))).length; if (!sample || c > sample[1]) sample = [name, c]; }
      if (sample[0] !== family) continue;
      list.push({ stem, grammar, ear: makeEar({ posPrior: grammar.posPrior, proclitics: grammar.proclitics, enclitics: grammar.enclitics, contractions: grammar.contractions }), hit: 0, words: 0 });
    }
    candidates.set(family, list);
    return list;
  };

  const listen = (text, si = heard) => {
    heard += 1;
    if (fixed) return fixed.language ? { language: fixed.language, grammar: fixed, ear: fixedEar, declared: true } : { language: null, gap: fixed.gap };
    const family = familyOf(text);
    if (!family) return { language: null, gap: "no letters in a known script" };
    const list = candidatesFor(family);
    for (const c of list) {
      let t = text;
      if (c.ear.segment) t = c.ear.segment(t);
      if (c.ear.peel) t = c.ear.peel(t);
      for (const w of t.match(/[\p{L}\p{M}\p{N}]+/gu) ?? []) { c.words += 1; if (c.grammar.posPrior.forms[w]) c.hit += 1; }
    }
    const scored = list.filter((c) => c.words).map((c) => ({ c, cov: c.hit / c.words })).sort((a, b) => b.cov - a.cov);
    const top = scored[0], second = scored[1];
    const clear = top && (top.cov >= STRONG || (top.cov >= FLOOR && (!second || second.cov === 0 || top.cov / second.cov >= MARGIN)));
    if (!clear) return { language: null, gap: "language_unheard" };
    const prev = view.get(family);
    if (prev && prev !== top.c.stem) revisions.push({ at: si, family, from: prev, to: top.c.stem });
    view.set(family, top.c.stem);
    return { language: top.c.stem, grammar: top.c.grammar, ear: top.c.ear, revised: prev && prev !== top.c.stem ? { from: prev, to: top.c.stem } : null };
  };

  return { listen, revisions: () => revisions.slice(), views: () => Object.fromEntries(view) };
}
