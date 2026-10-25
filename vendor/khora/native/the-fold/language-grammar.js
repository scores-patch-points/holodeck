// the-fold/language-grammar.js — the LANGUAGE LEG of
//
//   NL → language-specific grammar → EOT → language-specific output grammar → NL
//
// Given a language (declared, or heard from the text), return the received
// grammar the reader needs for it: its POS prior, its frame prior, its
// role-config (the measured subject/object strategy), its proclitics. Nothing
// is English by default and nothing is guessed silently: an unknown language
// is a typed gap `{ language: null, gap }`, never a fall-back to another
// language's grammar (the Greenberg rule).
//
// Which languages exist is read from the priors home (`<workspace root>/janus/priors/
// pos-<iso3>.json` — the ONE home for the priors; khora reads it as data through
// prior-source.mjs, never a module import), not from a list in this file; the only declared
// fact here is the mapping between the names a caller may use (BCP-47, ISO
// 639-1/3) and the file stem.
//
// DETECTION is by measurement, not by a language-identification model: the
// script of the text narrows the candidates (Unicode blocks), and among the
// candidates the one whose own POS prior ATTESTS the largest share of the
// text's words wins. Chomsky's posture: the parameters are set from the
// little the input shows. A text no candidate attests above `minCoverage`
// is reported as undetected.
//
// Isomorphic: every prior arrives through prior-source.mjs (the priors directory under Node, the page's preloaded copy in a browser).
import { makeSegmenter } from "../adapters/text/script-segment.js";
import { makeEar } from "../adapters/text/ear.js";
import { identifyLanguage } from "./langid.mjs";
import { PRIORS_DIR } from "./priors-home.js";
import { priorJson, priorNames } from "./prior-source.mjs";

// The one home for the priors (janus), resolved by priors-home.js. Re-exported
// so the eval/organ callers that import PRIORS_DIR from this module keep working.
export { PRIORS_DIR };

// ISO 639-1 / BCP-47 primary subtag → the prior file stem (ISO 639-3 or a
// declared variant). A declared fact about names, not about grammar.
const STEM = Object.freeze({
  en: "eng", es: "spa", ru: "rus", zh: "cmn", ar: "arb", he: "heb", fa: "fas", ko: "kor", ja: "jpn",
  fr: "fra", de: "deu", it: "ita", pt: "por", nl: "nld", pl: "pol", uk: "ukr", hi: "hin", vi: "vie",
  id: "ind", sv: "swe", ur: "urd", tr: "tur", el: "ell", fi: "fin", la: "lat", sa: "san", bg: "bul",
  // Ancient Greek: a register of the Greek SCRIPT, not a script of its own.
  // Named here so the detector's candidate set carries grc; the polytonic/
  // attestation gate in langid.mjs is what distinguishes it from ell.
  grc: "grc",
});
// DETECTION runs against this declared, curated set (the languages a person plausibly asks in) — the fold's finding:
// a giant group of near cousins steals the text (Galician vs Spanish, etc.). English IS detected (the reader reads
// it; "pos-en.json absent" would be a stale claim) — the exclusion was a grammar-selection rule, not detection.
export const DETECT_STEMS = [...new Set(Object.values(STEM))];
/** A stem (or any name stemOf reads) → its two-letter ISO 639-1 code where one is declared above, else null. The code a giver
 *  files entries under (Wiktionary's `en`, `es`). */
export function iso1Of(name) {
  const stem = stemOf(name); if (!stem) return null;
  return Object.entries(STEM).find(([k, v]) => v === stem && k.length === 2)?.[0] ?? null;
}
// script tags for the variants that differ by script
const VARIANT = Object.freeze({ "zh-hans": "cmn-hans", "zh-cn": "cmn-hans", "zh-sg": "cmn-hans", "zh-hant": "cmn", "zh-tw": "cmn", "zh-hk": "cmn" });

const read = (f) => priorJson(f);
const cached = read; // the door caches, and forgets when a page replaces its source

/** The prior stems present on disk. A missing home is no stems (every language
 *  then a typed gap), never a throw. Non-language priors (unimorph-derived,
 *  `pos-prior-*` backoffs, the legacy `pos-en`, a word-class list like `pos-eng-lexicon`) are not language stems. */
export const availableStems = () => {
  try {
    return priorNames().filter((f) => /^pos-[a-z-]+\.json$/.test(f) && !/unimorph|^pos-prior-|^pos-en\.json$|-lexicon\.json$/.test(f)).map((f) => f.slice(4, -5)).sort();
  } catch { return []; }
};

/** A caller's language name → a prior stem, or null (a gap). */
export function stemOf(name) {
  const low = String(name ?? "").trim().toLowerCase().replace(/_/g, "-");
  if (!low) return null;
  if (VARIANT[low]) return VARIANT[low];
  const primary = low.split("-")[0];
  const stem = STEM[primary] ?? (availableStems().includes(low) ? low : availableStems().includes(primary) ? primary : null);
  return stem && cached(`pos-${stem}.json`) ? stem : null;
}

/** grammarFor(name) → the received grammar for a language, or `{ language: null, gap }`. */
// A language written in two scripts has one prior per script (Chinese:
// Traditional `cmn`, Simplified `cmn-hans`). A bare "zh" is ambiguous; with the
// text in hand, the variant whose own prior attests more of its words wins.
const VARIANTS = Object.freeze({ cmn: ["cmn", "cmn-hans"] });
function pickVariant(stem, text) {
  const options = VARIANTS[stem];
  if (!options || !text) return stem;
  let best = stem, bestCov = -1;
  for (const o of options) {
    const prior = cached(`pos-${o}.json`);
    if (!prior) continue;
    const segment = makeSegmenter(prior);
    const sample = String(text).slice(0, 20000).toLowerCase();
    const words = (segment ? segment(sample) : sample).match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
    if (!words.length) continue;
    const cov = words.filter((w) => prior.forms[w]).length / words.length;
    if (cov > bestCov) { best = o; bestCov = cov; }
  }
  return best;
}

export function grammarFor(name, { text = null } = {}) {
  const base = stemOf(name);
  const low = String(name ?? "").toLowerCase();
  const stem = base && !VARIANT[low] ? pickVariant(base, text) : base;
  if (!stem) return { language: null, gap: `no received grammar for "${name}" — a typed gap, never another language's grammar` };
  const posPrior = cached(`pos-${stem}.json`);
  return Object.freeze({
    language: stem,
    posPrior,
    framePrior: cached(`frame-${stem}.json`),
    roleConfig: cached(`role-config-${stem}.json`),
    proclitics: cached(`proclitics-${stem}.json`)?.proclitics ?? null,
    enclitics: cached(`enclitics-${stem}.json`)?.enclitics ?? null,
    // ContractionPrior@1 (scripts/build-contraction-prior.mjs): how the treebank splits what is written as one word. null where it splits nothing.
    contractions: cached(`contractions-${stem}.json`),
    // RefusalFloor@1 (scripts/build-refusal-floor.mjs): the naming mass below which a word the prior has not met may be refused. null = uncalibrated.
    refusalFloor: cached(`refusal-${stem}.json`),
    gap: null,
  });
}

// ── DETECTION ───────────────────────────────────────────────────────────────
const SCRIPTS = [
  ["Han", /\p{Script=Han}/gu], ["Kana", /[\p{Script=Hiragana}\p{Script=Katakana}]/gu], ["Hangul", /\p{Script=Hangul}/gu],
  ["Arabic", /\p{Script=Arabic}/gu], ["Hebrew", /\p{Script=Hebrew}/gu], ["Cyrillic", /\p{Script=Cyrillic}/gu],
  ["Greek", /\p{Script=Greek}/gu], ["Devanagari", /\p{Script=Devanagari}/gu], ["Latin", /\p{Script=Latin}/gu],
];
const STEM_SCRIPT = (posPrior) => {
  // the prior's own vocabulary says what script it is in — measured, not declared
  const counts = {};
  for (const f of Object.keys(posPrior.forms).slice(0, 4000)) for (const [name, re] of SCRIPTS) { re.lastIndex = 0; if (re.test(f)) { counts[name] = (counts[name] ?? 0) + 1; break; } }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
};

/**
 * detectLanguage(text, {sample}) → { language, coverage, runnersUp, script } | { language:null, gap }
 * — the fold's detector (langid.mjs), ported: script first, then naive Bayes over each candidate's word and
 * character distributions, a decisive mark/clue for short asks, a margin/fit abstention. Undetected is a
 * typed gap, never a guess. The attestation detector it replaces is kept as `detectLanguageByAttestation`.
 */
export function detectLanguage(text, { sample = 20000, stems = DETECT_STEMS, language = null } = {}) {
  const d = identifyLanguage(String(text ?? "").slice(0, sample), { stems, language });
  if (d.confident) return { language: d.language, coverage: d.coverage, script: d.script, runnersUp: d.second ? [{ language: d.second, coverage: 0 }] : [] };
  return { language: null, script: d.script, gap: d.gap || "undetected, never guessed", runnersUp: [] };
}

/** The detection the reader used before 2026-10-07 (word-coverage attestation against every prior on disk),
 *  kept for comparison and for any caller that pinned its exact semantics. */
export function detectLanguageByAttestation(text, { strongCoverage = 0.3, minCoverage = 0.1, minMargin = 1.8, sample = 20000 } = {}) {
  const sampleText = String(text ?? "").slice(0, sample).toLowerCase();
  const scriptCounts = SCRIPTS.map(([name, re]) => [name, (sampleText.match(re) ?? []).length]).sort((a, b) => b[1] - a[1]);
  const [script, nScript] = scriptCounts[0];
  if (!nScript) return { language: null, gap: "no letters in a known script" };
  // Han and Kana share candidates (Japanese writes both); coverage is the verdict
  const family = (n) => (n === "Kana" ? "Han" : n);
  // Kana is the one letter-level tell between the Han-script languages: a text
  // that carries it can only be read by a prior whose own vocabulary carries it.
  const kana = (sampleText.match(/[\p{Script=Hiragana}\p{Script=Katakana}]/gu) ?? []).length;
  const hasKana = (p) => { const f = Object.keys(p.forms).slice(0, 4000); return f.filter((w) => /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(w)).length / f.length > 0.05; };
  const candidates = availableStems().filter((s) => { const p = cached(`pos-${s}.json`); return p && family(STEM_SCRIPT(p)) === family(script) && (kana / Math.max(1, nScript + kana) < 0.05 || hasKana(p) || family(script) !== "Han"); });
  const scored = [];
  for (const s of candidates) {
    const prior = cached(`pos-${s}.json`);
    // hear it the way the reader will: its own ear (segmentation, bound morphemes)
    const g = grammarFor(s);
    const ear = makeEar({ posPrior: prior, proclitics: g.proclitics, enclitics: g.enclitics, contractions: g.contractions });
    let heard = ear.segment ? ear.segment(sampleText) : sampleText;
    if (ear.peel) heard = ear.peel(heard);
    const words = heard.match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
    if (!words.length) continue;
    let hit = 0;
    for (const w of words) if (prior.forms[w]) hit += 1;
    scored.push({ language: s, coverage: hit / words.length });
  }
  scored.sort((a, b) => b.coverage - a.coverage);
  // a small treebank attests little of any text (Vietnamese 16%, formal Japanese 16%),
  // so the floor is low and the evidence is the MARGIN over the next candidate
  const clear = scored.length && (scored[0].coverage >= strongCoverage || (scored[0].coverage >= minCoverage && (!scored[1] || scored[1].coverage === 0 || scored[0].coverage / scored[1].coverage >= minMargin)));
  if (!clear) return { language: null, script, gap: `no candidate clearly attests the words (best ${scored[0] ? (scored[0].coverage * 100).toFixed(0) + "%" : "none"}) — undetected, never guessed`, runnersUp: scored.slice(0, 3) };
  return { language: scored[0].language, coverage: Number(scored[0].coverage.toFixed(3)), script, runnersUp: scored.slice(1, 3) };
}
