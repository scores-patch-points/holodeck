// the-fold/language-context.js — the production reading path's LANGUAGE LEG.
//
// reader-bundle.js (engineRelationsFor — what proxy-runner, swarm-server and
// cli/reason call) was built for English: language "eng", pos-eng, and a being
// finder whose only signal is a capital letter. This module gives that path
// the grammar of whatever it is reading:
//
//   languageContextFor(text)  → { language, grammar, ear, caseInformative }
//       the language the text's own words attest (language-grammar.js), its
//       ear (word boundaries, bound morphemes), and a MEASURED fact — whether
//       capitalisation carries information in this text.
//   extractSurfacesHeard(sentences, opts) → surfaces
//       the capital-run surfaces (surfaces.js, one witness) UNIONED with the
//       caseless nominal tier (heard-nominals.js, through the language's ear).
//       A caseless surface a capital surface already carries is counted once.
//
// CAPITALISATION IS ONE WITNESS, AND ITS INFORMATIVENESS CANNOT BE READ OFF A
// SHARE (measured: standard prose, SMS, Singlish and IRC all capitalise 2-13%
// of their non-initial tokens, and in all of them capitals mostly mark names).
// What CAN be read off the text is whether the SCRIPT has case at all. So:
//   caseless script (Han, Arabic, Hebrew, Hangul, Devanagari, Thai…): every
//     nominal the grammar reads is a being candidate — there is no descriptor
//     tier for common nouns in these languages, and capitals never existed;
//   cased script (Latin, Cyrillic, Greek…): the capital tier stands, and this
//     tier adds only what capitals cannot see — names written without one,
//     words the prior has never met. Settled common nouns stay with the
//     determiner-based descriptor tier (the-fold/referents.js), so lowercased
//     and SMS text gain their lowercase names without flooding standard prose
//     with "time" and "day".
import { grammarFor, detectLanguage } from "./language-grammar.js";
import { makeEar } from "../adapters/text/ear.js";
import { createNominalIndex } from "../adapters/text/heard-nominals.js";
import { extractSurfaces, diaNorm } from "../adapters/text/surfaces.js";

/** Fraction of word tokens that carry a cased letter — 0 for a caseless script. */
export function casedFraction(text) {
  const toks = String(text ?? "").match(/[\p{L}][\p{L}\p{M}'’]*/gu) ?? [];
  if (!toks.length) return 0;
  let cased = 0;
  for (const t of toks) if (/[\p{Lu}\p{Ll}]/u.test(t)) cased += 1;
  return cased / toks.length;
}
export const CASED_SCRIPT_FLOOR = 0.3;

const memo = new Map();
export function languageContextFor(text, { language = null } = {}) {
  const sample = String(text ?? "");
  const key = `${language ?? ""}|${sample.length}|${sample.slice(0, 160)}|${sample.slice(-160)}`;
  if (memo.has(key)) return memo.get(key);
  let grammar = language ? grammarFor(language, { text: sample }) : { language: null };
  let detected = null;
  // A DECLARED language is authoritative (the declared fact beats the inferred
  // one): if its priors are absent, that is a typed gap, never a silent
  // fall-back to another language's grammar. Only a text with NO declared
  // language has its own words choose one.
  if (!grammar.language && !language) { detected = detectLanguage(sample); if (detected.language) grammar = grammarFor(detected.language, { text: sample }); }
  const cased = casedFraction(sample);
  const ctx = Object.freeze({
    language: grammar.language ?? null,
    grammar: grammar.language ? grammar : null,
    ear: grammar.language ? makeEar({ posPrior: grammar.posPrior, proclitics: grammar.proclitics, enclitics: grammar.enclitics, contractions: grammar.contractions }) : null,
    casedFraction: Number(cased.toFixed(3)),
    casedScript: cased >= CASED_SCRIPT_FLOOR,
    gap: grammar.language ? null : (detected?.gap ?? grammar.gap ?? "language undetected"),
  });
  if (memo.size > 64) memo.clear();
  memo.set(key, ctx);
  return ctx;
}

/** A drop-in for surfaces.js::extractSurfaces: capitals + the caseless tier, through the text's own language. */
export function extractSurfacesHeard(sentences, opts = {}) {
  const capital = extractSurfaces(sentences, opts);
  const text = (sentences ?? []).map((s) => String(s?.text ?? s ?? "")).join("\n");
  const ctx = languageContextFor(text);
  if (!ctx.grammar?.framePrior) return capital;
  const idx = createNominalIndex({ posPrior: ctx.grammar.posPrior, framePrior: ctx.grammar.framePrior, segment: ctx.ear.segment, peel: ctx.ear.peel, commonNouns: !ctx.casedScript });
  for (const s of sentences ?? []) idx.add(s);
  const have = new Set(capital.map((c) => diaNorm(c.surface)));
  const heard = idx.beings({ minMentions: 2 }).filter((h) => !have.has(diaNorm(h.surface)));
  return [...capital, ...heard];
}
