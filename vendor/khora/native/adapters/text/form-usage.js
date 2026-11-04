// adapters/text/form-usage.js — HOW A FORM IS USED, from the received treebank, for a capital the text cannot test (2026-10-27).
//
// surfaces.js::surfacesFromEvidence asks, of a word written both capitalised and lower-case, whether its capitals exceed a fair coin.
// A word the text NEVER writes lower-case gave that test nothing to stand on, and was admitted on a single capital: "Grab" or "Well"
// after a heading that carries no full stop, where the capital is the sentence's and the cut cannot see it. The capital is a convention
// (conventions.js, "capital-marks-a-name"), kept more or less, so the text's own capitals are weighed against the treebank's own USE
// of the form: of every time UD_English-EWT (the pos prior the reader already holds, pos-eng.json, human-annotated, counts kept) tags
// the form, how often is it one that can head a mention and how often is it not.
//
//   nominal   the tags NOUN, PROPN and ADJ: a name, a noun, or an adjective that names a people or a language ("French", "Chinese")
//   other     every other tag: a verb, an adverb, an interjection, a conjunction, a pronoun, a determiner …
//
// surfaces.js hands both to the one test it already has (capitalisationIsSignificant, exact one-sided tail at a fair coin, alpha 0.05):
// the word is refused when its non-nominal uses exceed what the nominal ones plus the text's own capitals can balance. "Grab" (8 uses,
// all verb) needs no more than its one capital to be refused; a word the treebank uses mostly as a noun ("Government") is never refused
// by it. The cost is a name whose lower-case twin the treebank saw mostly as a function word ("May", "Will"): the prior is keyed on the
// case-folded form, so it is refused unless the text's capitals nearly balance those uses (eval/referents/README.md counts it). A form the
// treebank has not seen has no use to weigh: the answer is null and the word is undecided, so it stays a being.
//
// The counts are the prior's, measured, not typed here. `classifyWord` is the repo's lens over that prior (wordclass.js); nothing is
// re-read. English only (the prior is English's, and what a capital means is a convention of the language): the caller does not build
// this for another language.
//
// A TWIN (2026-10-27, PREREG-TWIN.md): a form that is BOTH a name and a function word ("US"/"us", "May"/"may"). The prior is keyed on the case-folded
// form, so its counts are dominated by the lower-case function word and describe the other reading as much as the capital's: a twin decided by counts is
// decided by the wrong twin. `twin` says the prior attests both readings beyond its own base rates: the form's PROPN count AND its closed-class count (UD's
// declared split: ADP AUX CCONJ DET NUM PART PRON SCONJ) each exceed the share a random token of the prior has, by the exact one-sided binomial tail at the
// alpha surfaces.js already uses. No typed threshold: the null rates are the prior's own (PROPN 0.0617, closed-class 0.4198 of its 204,578 tokens), and on
// pos-eng.json that is two forms, "us" and "may". surfaces.js then returns the tied verdict, not a decision.
//
//   formUsageOf(posPrior) → (surface) => { nominal, other, twin } | null, synchronous; null for a form with no measured count
//   formUsageFor(stem, posPrior) → the above for the languages whose capital this adapter has a ledgered convention for (English), else null: the
//                              per-language gate lives HERE, so read-core.mjs names no language. A language is added by its own row in the Conventions
//                              prior (janus conventions-<stem>.json), its own pos prior and its own measurement, never by widening this line.

import { classifyWord } from "./wordclass.js";

const NOMINAL = new Set(["NOUN", "PROPN", "ADJ"]);
const CLOSED = new Set(["ADP", "AUX", "CCONJ", "DET", "NUM", "PART", "PRON", "SCONJ"]);   // UD's own closed-class tags
const ALPHA = 0.05;                                                                          // the alpha of surfaces.js CAP_SIG_ALPHA, the rule this amends

/** P(X >= k | n, p), exact, in log space (no overflow at any n the prior holds). */
const upperTail = (k, n, p) => {
  if (k <= 0) return 1;
  if (k > n) return 0;
  const step = Math.log(p) - Math.log1p(-p);
  let term = n * Math.log1p(-p), max = -Infinity;
  const kept = [];
  for (let j = 0; j < n; j++) {
    term += Math.log(n - j) - Math.log(j + 1) + step;                // log P(X = j + 1)
    if (j + 1 >= k) { kept.push(term); if (term > max) max = term; }
  }
  return Math.exp(max + Math.log(kept.reduce((a, t) => a + Math.exp(t - max), 0)));
};

const baseRates = new WeakMap();
function ratesOf(posPrior) {
  let r = baseRates.get(posPrior);
  if (!r) {
    let tokens = 0, proper = 0, closed = 0;
    for (const counts of Object.values(posPrior.forms)) for (const [tag, n] of Object.entries(counts)) { tokens += n; if (tag === "PROPN") proper += n; if (CLOSED.has(tag)) closed += n; }
    r = { proper: tokens ? proper / tokens : 0, closed: tokens ? closed / tokens : 0 };
    baseRates.set(posPrior, r);
  }
  return r;
}

const LEDGERED = new Set(["eng"]);   // the stems the Conventions@1 prior has a measured row for (janus conventions-eng.json)

/**
 * Does the prior's count say a form is MOSTLY used as something other than a nominal? The same exact one-sided tail at a fair coin and the same alpha the capital's test uses: a form seen once
 * as a conjunction (1 of 1) is not significant and stays undecided, a pronoun seen fifty times (50 of 50) is. `u` is formUsageOf(posPrior)(form), or null for a form the prior has not seen.
 * (Added for the declension fold, read-core.mjs::declensionOrgansFor, which must not let one stray count veto the case forms of a name.)
 */
export const usedMostlyAsOther = (u) => !!u && u.other > u.nominal && upperTail(u.other, u.nominal + u.other, 0.5) < ALPHA;

export function formUsageFor(stem, posPrior) {
  return LEDGERED.has(stem) ? formUsageOf(posPrior) : null;
}

export function formUsageOf(posPrior) {
  if (!posPrior || typeof posPrior.forms !== "object" || !posPrior.forms) return null;
  return (surface) => {
    const c = classifyWord(String(surface ?? ""), { posPrior });
    if (!c.found || !(c.total > 0)) return null;   // a shape or a class lexicon attests a form; it counts nothing
    const nominal = c.candidates.filter((x) => NOMINAL.has(x.upos)).reduce((n, x) => n + x.count, 0);
    const name = c.candidates.find((x) => x.upos === "PROPN")?.count ?? 0;
    const closed = c.candidates.filter((x) => CLOSED.has(x.upos)).reduce((n, x) => n + x.count, 0);
    let twin = false;
    if (name > 0 && closed > 0) { const r = ratesOf(posPrior); twin = r.proper > 0 && r.proper < 1 && r.closed > 0 && r.closed < 1 && upperTail(name, c.total, r.proper) < ALPHA && upperTail(closed, c.total, r.closed) < ALPHA; }
    return { nominal, other: c.total - nominal, twin };
  };
}
