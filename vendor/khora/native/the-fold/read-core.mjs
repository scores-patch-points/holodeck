// the-fold/read-core.mjs — THE READER, ONE CORE FOR EVERY SURFACE (2026-10-24).
//
// Before this file the one reader existed three times: reader-bundle.js assembled it under Node (fs reads of the priors), the
// Holodeck's holodeck-reader.js assembled it again for a page (fetch), and read-process.mjs read every text a second time to learn
// its cast. Each copy drifted: the page cut sentences with abbreviations the hyperlexicon resolved while canon never passed the
// splitter any; canon read a Spanish text with the English priors; the cast in the weft was not the index the edges were resolved
// against; the pronoun bindings the reader made were thrown away. This is the one assembly. It imports no file system: every prior
// arrives by name through prior-source.mjs, so the same module runs under Node and in a page, and a surface supplies only what it
// alone has (its lexicon giver, its features, its own extra organs).
//
//   priorsFor(language)             → { stem, posPrior, verbForms, lemmatizer, punctuation, gaps } — the language's priors, cached
//   buildPriors({ pos, posLexicon, morphology, unimorph, punctuation })
//                                   → the same from priors handed in as data (a test, an eval, a page with its own copies)
//   abbreviationsFor(text, { priors, aliases, abbreviations })
//                                   → { set, n, prior, derived, aliases }: the tokens that keep their period — the language's
//                                     MEASURED punctuation prior, the text's own (spans.js::deriveAbbreviations), and the aliases
//                                     the hyperlexicon resolved for this text; each as written, Capitalised and UPPER
//   consultAliases(text, lexicon, { priors }) → Promise<{ aliases, rows, giver, gap }>: ask the hyperlexicon only about the dotted
//                                     forms the priors and the text cannot settle (organs/lexicon.js)
//   makeReader({ priors, language, abbreviations, features, ...organs }) → the relation reader (organs/hypergraph.js)
//   relationsFor(list, opts)        → the reader's report over passages (chunked, read through the language's ear)
//   readDocument(text, opts)        → Promise<WeftEntry@4>: THE MASTER PIPELINE — the one call every surface makes. Asks the
//                                     hyperlexicon handed in (opts.lexicon: an organs/lexicon.js organ over any giver) about the
//                                     dotted forms the priors cannot settle, then readWith. Node (reading.js) hands in the local
//                                     Wiktionary pack; a page hands in its server's; no lexicon is a typed gap on the entry.
//   readWith(text, opts)            → WeftEntry@4 (synchronous, given the aliases; readerOptions: a surface's own organs;
//                                     selfRead: claims with verdicts; .reader / .abbreviationSet ride it, not enumerable): edges, the reader's own cast with every mention's address (mentionsAt: UTF-8 byte
//                                     offsets, the weft's unit; mentionSpans: character spans), its sentences and pronoun bindings
//                                     (character offsets), the clause tree, polarity, surprise, and every gap typed
//
// Nothing here is a word list. The English closed classes (adapters/text/priors.js) are passed only to an English read; another
// language without its own is a typed gap, never English applied to it (the Greenberg rule).

import { makeRelationReader } from "../organs/hypergraph.js";
import { chunkSource, tokenize, blankLabelRows } from "../organs/source.js";
import { splitSentences, deriveAbbreviations } from "../adapters/text/spans.js";
import { GRAMMAR_MIN_SHARE } from "../adapters/text/grain-typing.js";
import { extractSurfaces, discoverReferents, namesCorefer, diaNorm } from "../adapters/text/surfaces.js";
import { withEar } from "../adapters/text/active-ear.js";
import { resolvePronouns, resolvePronounsByPresence } from "../adapters/text/pronouns.js";
import { relationExtractorsFor } from "../adapters/text/relations-language.js";
import { classifyWord, dominantClass } from "../adapters/text/wordclass.js";
import { createLemmatizer, morphologyFromPrior } from "../adapters/text/morphology.js";
import * as P from "../adapters/text/priors.js";
import { aliasJunctions, resolveAliases, dottedIn } from "../organs/lexicon.js";
import { consultNonPersonal } from "../adapters/text/non-personal.js";
import { buildReferentLedger } from "../adapters/text/reading-referents.js";
import { renderCard } from "../adapters/text/folded-card.js";
import { createDeclensionFolder } from "../adapters/text/declension.js";
import { extractSurfacesHeard, languageContextFor } from "./language-context.js";
import { formUsageFor, formUsageOf, usedMostlyAsOther } from "../adapters/text/form-usage.js";
import { conventionOf, conventionsGap } from "../adapters/text/conventions.js";
import { stemOf } from "./language-grammar.js";
import { tokenEvents, surpriseCut } from "./surprise-gate.mjs";
import { applyPolarity, readGates, nestedClauses, scopePolarity } from "./read-quality.mjs";
import { priorJson, priorGeneration } from "./prior-source.mjs";
import { figuresOf } from "../adapters/text/figure-period.en.js";
import { castIdentity as castIdentityPass } from "../organs/cast-identity.js";

export const READ_CORE = Object.freeze({
  schema: "ReadCore@1",
  module: "native/the-fold/read-core.mjs",
  priors: "by name through prior-source.mjs: pos-<stem>, pos-<stem>-lexicon, morphology-<stem>, punctuation-<stem> (janus/priors)",
  abbreviations: "the measured punctuation prior + the text's own + the hyperlexicon's dotted words (read ahead, dotted-<stem>.json) and its live aliases; never a hand list",
  emits: "WeftEntry@4 + sentences, pronouns, language, abbreviations, gaps",
});

// ── priors ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The received priors, from data handed in. Data-gated: an absent piece leaves that leg bare (exact match), never a guess. */
export function buildPriors({ pos = null, posLexicon = null, morphology = null, unimorph = null, punctuation = null, dotted = null, conventions = null, stem = null } = {}) {
  // a copy, so the class lexicon rides this reader's prior and never the shared one other organs read
  const posPrior = pos ? (posLexicon ? { ...pos, lexicon: posLexicon } : pos) : null;
  const morph = morphology ? morphologyFromPrior(morphology) : null;
  const uni = unimorph ? morphologyFromPrior(unimorph) : null;
  const prior = morph ?? uni;
  const forms = new Set();
  for (const source of [morph?.forms, uni?.forms]) {
    for (const k of Object.keys(source ?? {})) {
      forms.add(String(k).toLowerCase());
      const v = source[k];
      for (const x of Array.isArray(v) ? v : [v]) if (typeof x === "string") forms.add(x.toLowerCase());
    }
  }
  // THE POS ATTESTATION (2026-09-29): the morphology prior is an inflection subset that omits the common verbs of ordinary prose,
  // so the POS prior's verb-dominant forms (VERB|AUX at the vocabulary gate's own GRAMMAR_MIN_SHARE) join the attested set.
  if (posPrior?.forms) {
    for (const [w, counts] of Object.entries(posPrior.forms)) {
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      if (total > 0 && ((counts.VERB ?? 0) + (counts.AUX ?? 0)) / total >= GRAMMAR_MIN_SHARE) forms.add(w.toLowerCase());
    }
  }
  const lemmatizer = prior ? createLemmatizer(prior.forms, { language: prior.language }) : null;
  const gaps = [];
  if (!posPrior) gaps.push({ gap: "no_pos_prior", stem, detail: `pos-${stem ?? "?"}.json absent: the vocabulary gate reads bare` });
  if (!lemmatizer) gaps.push({ gap: "no_morphology", stem, detail: `no morphology prior for ${stem ?? "?"}: verbs match exactly` });
  if (!punctuation) gaps.push({ gap: "no_punctuation_prior", stem, detail: `punctuation-${stem ?? "?"}.json absent: abbreviations come from the text and the hyperlexicon only` });
  if (!dotted) gaps.push({ gap: "no_dotted_prior", stem, detail: `dotted-${stem ?? "?"}.json absent: only the live hyperlexicon knows the words written with their period` });
  return { stem, posPrior, verbForms: forms.size ? forms : null, lemmatizer, punctuation: punctuation ?? null, dotted: dotted ? new Set(dotted.words || []) : null, dottedGiver: dotted?.giver ?? null, conventions: conventions ?? null, gaps };
}

const priorCache = new Map();
/** The language's priors from the one home. `language` is any name stemOf reads (en, eng, es-MX …); an unknown one is a gap. */
export function priorsFor(language = "eng") {
  const stem = stemOf(language) ?? String(language ?? "").toLowerCase();
  const key = `${stem}|${priorGeneration()}`;
  if (priorCache.has(key)) return priorCache.get(key);
  const built = buildPriors({
    stem,
    pos: priorJson(`pos-${stem}.json`),
    posLexicon: priorJson(`pos-${stem}-lexicon.json`),
    morphology: priorJson(`morphology-${stem}.json`),
    punctuation: priorJson(`punctuation-${stem}.json`),
    dotted: priorJson(`dotted-${stem}.json`),
    conventions: priorJson(`conventions-${stem}.json`),
  });
  if (priorCache.size > 16) priorCache.clear();
  priorCache.set(key, built);
  return built;
}

// ── which dotted tokens are words ─────────────────────────────────────────────────────────────────────────────────────────────

const variants = (t) => { const s = String(t); return [s, s.toLowerCase(), s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(), s.toUpperCase()]; };

/** The tokens that keep their period, for one text. `abbreviations` (a caller's own set) is added, not substituted. */
export function abbreviationsFor(text, { priors = null, aliases = [], abbreviations = null } = {}) {
  const src = String(text ?? "").replace(/\r\n?/g, "\n");
  const fromPrior = priors?.punctuation?.abbreviations ?? [];
  const derived = [...deriveAbbreviations(src)];
  // the hyperlexicon read ahead: the dotted words its giver lists (janus dotted-<stem>.json) that this text uses as words
  const known = new Set([...fromPrior, ...derived].map((a) => String(a).toLowerCase()));
  const fromDotted = priors?.dotted ? dottedIn(src, priors.dotted, known) : [];
  // the splitter tests the letter run before a period, so a dotted initialism ("U.S.") is kept by its last run ("S")
  const lastRun = (a) => String(a).replace(/\.$/, "").split(".").pop();
  const fromAliases = [...aliases, ...fromDotted].map(lastRun).filter(Boolean);
  const set = new Set();
  for (const t of [...fromPrior, ...derived, ...fromAliases, ...(abbreviations ?? [])]) for (const v of variants(t)) set.add(v);
  return { set, n: set.size, prior: fromPrior.length, derived: derived.length, aliases: aliases.length, dotted: fromDotted.length, giver: priors?.punctuation?.giver ?? null };
}

// THE PRIOR IS THE GIVER READ AHEAD. janus's dotted-words prior is every dotted headword of one Wiktionary pack (letters and dots, at
// most 12 characters), named by its file and snapshot. When the live lexicon answers from that same pack, a junction form outside the
// prior is one the pack does not list with its period (the giver answers exact headwords only), and one inside it was settled by the
// prior or is refused by the text's own bare use: no answer could keep an alias, so nothing is asked. The one case the prior leaves to
// the live giver, a dotted headword longer than 12 characters, is still asked. Measured 2026-10-25: the Holodeck asked ~500 forms per
// long document of a giver that answers one form in ~3.5 ms, one request at a time, and every reading waited on that queue.
// one giver: the same hyperlexicon (its head), or the same pack of one giver (its file and snapshot)
const sameGiver = (a, b) => !!(a && b && ((a.head && a.head === b.head) || (a.pack && a.pack === b.pack && (a.snapshot ?? null) === (b.snapshot ?? null))));

/** Ask the hyperlexicon about the dotted forms the priors and the text cannot settle; keep each one the text's own use allows. */
export async function consultAliases(text, lexicon, { priors = null } = {}) {
  if (!lexicon) return { aliases: [], rows: [], giver: null, gap: "no hyperlexicon was handed to this read" };
  const asked = lexicon.log?.length ?? 0;   // a gap is this consult's own: an earlier read's unanswered ask is not this read's
  const known = new Set([...(priors?.punctuation?.abbreviations ?? []), ...deriveAbbreviations(String(text ?? ""))].map((a) => String(a).toLowerCase()));
  // what the dotted prior already settles is not asked again
  for (const f of priors?.dotted ? dottedIn(String(text ?? ""), priors.dotted, known) : []) known.add(f.slice(0, -1).toLowerCase());
  let junctions = aliasJunctions(text, known);
  if (!junctions.size) return { aliases: [], rows: [], giver: lexicon.giver ?? null, gap: null };
  if (priors?.dotted && priors.dottedGiver) {
    // a giver that has not answered yet is asked one form first, to learn which pack it reads
    if (!lexicon.giver) await lexicon.want([junctions.keys().next().value]);
    if (sameGiver(priors.dottedGiver, lexicon.giver)) {
      junctions = new Map([...junctions].filter(([f]) => f.length > 12));
      if (!junctions.size) return { aliases: [], rows: [], giver: lexicon.giver, gap: null, settled: priors.dottedGiver.head ? `the dotted-words prior is this hyperlexicon's own (head ${String(priors.dottedGiver.head).slice(0, 16)})` : `the dotted-words prior is this giver's own pack (${priors.dottedGiver.pack})` };
    }
  }
  await lexicon.want(junctions.keys());
  const rows = resolveAliases(lexicon, junctions, text);
  // the treebank's own evidence, the rule janus's dotted prior is built by (scripts/build-dotted-priors.mjs): a giver lists "ports."
  // (portraits) and "Apr." beside the words "ports" and "APR", and a text that writes the word only at a stop cannot refuse them by
  // its own use. A single-dot form whose base the class prior attests as a word is kept only where the class prior also attests the
  // dotted token ("Inc.", "Dr.", "etc."). With no class prior the rule cannot be read, and the text's own use decides alone.
  const attested = (f) => Object.values(priors?.posPrior?.forms?.[String(f).toLowerCase()] ?? {}).some((n) => n > 0);
  if (priors?.posPrior?.forms) for (const r of rows) {
    if (!r.kept || r.form.split(".").length !== 2) continue;
    const base = r.form.slice(0, -1);
    if (attested(base) && !attested(r.form)) Object.assign(r, { kept: false, why: `the treebank writes “${base}” as a word and never “${r.form}”` });
  }
  const gap = (lexicon.log ?? []).slice(asked).find((x) => x.gap)?.gap ?? null;
  return { aliases: rows.filter((r) => r.kept).map((r) => r.form), rows, giver: lexicon.giver ?? null, gap };
}

// ── the reader ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const ENGLISH_CLOSED = Object.freeze({
  determiners: new Set([...P.DEFINITE_DETERMINERS, ...P.INDEFINITE_DETERMINERS]),
  definiteDeterminers: new Set(P.DEFINITE_DETERMINERS),
  negationWords: P.NEGATION_WORDS,
  firstPerson: P.FIRST_PERSON,
});
/** The received closed classes for a language: English's from adapters/text/priors.js, none for another (a typed gap). */
export const closedClassesFor = (stem) => (stem === "eng" ? ENGLISH_CLOSED : null);

const dispatches = new Map();
function dispatchFor(stem, classify, roleConfig) {
  const key = `${stem}|${classify === classifyWord ? "" : "own"}|${roleConfig ? "role" : ""}`;
  if (!dispatches.has(key)) dispatches.set(key, relationExtractorsFor({ language: stem, roleConfig: roleConfig ?? null, posPrior: null, classifyWord: classify, dominantClass }));
  return dispatches.get(key);
}

/**
 * The relation reader, assembled once from its priors. `features` are the switches a surface may turn off to see what each organ
 * costs (every one defaults on): posPrior, morphology, nounPhraseSubjects, phrasalPredicates. `sameAct` widens the lemmatizer's
 * same-act test (a surface's own class, never a rewrite of a label). `extendRelations(base)` returns the extractor to use in place
 * of this assembly's clause-aware dispatch, given that dispatch — a surface adds a pass over the base reading without rebuilding
 * it. Any organ makeRelationReader takes may be passed to replace this assembly's (discoverRelationVocab …), and `closedClasses`
 * replaces the language's received set.
 */
export function makeReader({ priors = null, language = "eng", abbreviations = null, features = {}, classifyWord: classify = classifyWord, roleConfig = null, sameAct = null, closedClasses = undefined, extendRelations = null, ...extra } = {}) {
  const stem = stemOf(language) ?? String(language);
  const pr = priors ?? priorsFor(stem);
  const split = abbreviations ? (t, o = {}) => splitSentences(t, { ...o, abbreviations: o.abbreviations ?? abbreviations }) : splitSentences;
  const closed = closedClasses === undefined ? closedClassesFor(stem) : closedClasses;
  const usePos = features.posPrior !== false;
  const useMorph = features.morphology !== false && !!pr.lemmatizer;
  const baseExtract = (text, opts = {}) => { const d = dispatchFor(stem, classify, roleConfig); return d.extractRelations(text, d.mode === "gfp" ? { ...opts, clauseAware: true } : opts); };
  const same = (a, b) => (sameAct ? sameAct(a, b) ?? null : null) ?? (useMorph ? pr.lemmatizer.sameAct(a, b) : String(a).toLowerCase() === String(b).toLowerCase());
  return makeRelationReader({
    splitSentences: split,
    extractSurfaces: extractSurfacesHeard,
    discoverReferents,
    namesCorefer,
    diaNorm,
    // read at CALL time, not bound at construction: a reader built once picks up a later dispatch change
    discoverRelationVocab: (...a) => dispatchFor(stem, classify, roleConfig).discoverRelationVocab(...a),
    // clause-aware adjacency in GFP mode (2026-09-23: 195 → 150 arrangements on Marie Curie, a strict subset, all dropped cross-clause)
    extractRelations: extendRelations ? extendRelations(baseExtract) : baseExtract,
    extractorsMode: "dispatch",
    tokenize,
    posPriorFor: () => (usePos ? pr.posPrior : null),
    verbForms: pr.verbForms,
    oovLexicon: pr.verbForms,
    attestedVerbs: true,
    ...(closed ? { determiners: closed.determiners, definiteDeterminers: closed.definiteDeterminers, negationWords: closed.negationWords, firstPerson: closed.firstPerson } : {}),
    ...(useMorph || sameAct ? { createLemmatizer: () => ({ sameAct: same }), morphologyIndex: {} } : {}),
    blankFurniture: (text) => blankLabelRows(text, { minRun: 4, maxCell: 60 }),
    resolvePronouns,
    nounPhraseSubjects: features.nounPhraseSubjects !== false,
    phrasalPredicates: features.phrasalPredicates !== false,
    ...extra,
  });
}

const passagesOf = (list) => (list ?? []).map((p) => {
  if (p && typeof p === "object" && p.text && (p.ref ?? p._ledger?.source)) return { ref: String(p.ref ?? p._ledger.source), text: p.text };
  if (typeof p === "string") return { ref: "surf", text: p };
  return p;
});

/** The reader's report over passages, read whole through the material's own ear. Returns { report, chunks, context }. */
export function relationsFor(list, { reader = null, language = null, ...opts } = {}) {
  const R = reader ?? makeReader({ language: language ?? "eng", ...opts });
  const joined = passagesOf(list).map((p) => p.text).join("\n\n");
  const context = languageContextFor(joined, { language: language ?? null });
  const chunks = chunkSource("material", joined, {});
  return { report: withEar(context.ear, () => R(chunks)), chunks, context, text: joined };
}

// ── one document, read whole ──────────────────────────────────────────────────────────────────────────────────────────────────

const utf8Length = (s) => { let n = 0; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); if (c < 0x80) n += 1; else if (c < 0x800) n += 2; else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length && (s.charCodeAt(i + 1) & 0xfc00) === 0xdc00) { n += 4; i++; } else n += 3; } return n; };

// the reader cuts newline-normalised text; its offsets map back to the bytes the caller handed in
function toRawOffsets(raw) {
  if (!/\r/.test(raw)) return (i) => i;
  const map = []; for (let i = 0; i < raw.length; i++) { if (raw[i] === "\r" && raw[i + 1] === "\n") continue; map.push(i); } map.push(raw.length);
  return (i) => map[Math.min(Math.max(0, i), map.length - 1)];
}

// UTF-8 byte offset of every character position: the weft addresses a mention as `<source>#<byteOffset>` (weft.js::holonAddress)
function byteOffsets(str) {
  const cum = new Uint32Array(str.length + 1); let b = 0;
  for (let i = 0; i < str.length; i++) { cum[i] = b; const c = str.charCodeAt(i); if (c < 0x80) b += 1; else if (c < 0x800) b += 2; else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length && (str.charCodeAt(i + 1) & 0xfc00) === 0xdc00) { b += 4; cum[++i] = b; } else b += 3; }
  cum[str.length] = b; return cum;
}

/** A surface that is one token this read keeps the period of (its abbreviation set): a title or a unit, not a name on its own. */
export const isAbbreviationSurface = (surface, set) => { const t = String(surface ?? "").trim().replace(/\.$/, ""); return !!t && !/\s/.test(t) && !!set && set.has(t); };

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Every place a surface stands as a whole word, longest surface first, overlaps given to the longer. The index keeps a name in
 *  its folded form ("Mr Brown" for "Mr. Brown", a lower-cased "messrs"), so a token may carry its period in the text and a
 *  folded surface matches without case. */
export function mentionsOf(text, surfaces) {
  const hits = [];
  for (const s of [...surfaces].sort((a, b) => b.length - a.length)) {
    if (!s) continue;
    const body = String(s).trim().split(/\s+/).map(escapeRe).join("\\.?\\s+");
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${body}\\.?(?![\\p{L}\\p{N}])`, s === s.toLowerCase() ? "giu" : "gu");
    for (const m of text.matchAll(re)) hits.push([m.index, m.index + m[0].length]);
  }
  hits.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const out = []; let end = -1;
  for (const h of hits) if (h[0] >= end) { out.push(h); end = h[1]; }
  return out;
}

const edgeOf = (e) => ({ end1: e.end1, end1Face: e.end1Face ?? null, label: e.label, end2: e.end2, end2Face: e.end2Face ?? null, polarity: e.polarity ?? null, refs: e.refs ?? null, spans: e.spans ?? null, assertion: e.assertion ?? null });

/**
 * The organs the declension fold adds to the reader, or {} (and a typed gap) when it cannot run. `option` is true (read the language's prior by name) or { prior } (a caller's own).
 * Pure given its inputs; the gate is the part-of-speech prior's own count (form-usage.js::formUsageOf, form-usage.js::usedMostlyAsOther): a form it has seen used significantly more as a non-nominal than as a nominal (an exact tail at a fair coin, the capital's own test) is not folded.
 */
export function declensionOrgansFor(option, { stem, pr, discoverReferents: discover, namesCorefer: corefer, gaps, report }) {
  if (!option) return {};
  const prior = option === true ? priorJson(`declension-${stem}.json`) : option.prior ?? null;
  const folder = createDeclensionFolder(prior);
  if (folder.gap) { gaps.push({ gap: folder.gap.reason, stem, detail: folder.gap.detail }); report({ stem, folded: false, why: folder.gap.reason }); return {}; }
  const usage = formUsageOf(pr?.posPrior);
  if (!usage) { gaps.push({ gap: "declension_ungated", stem, detail: `no part-of-speech prior for ${stem}: the fold would join pronouns and verbs with the names, so it is not run` }); report({ stem, folded: false, why: "declension_ungated" }); return {}; }
  const memo = new Map();
  const functional = (t) => { let v = memo.get(t); if (v === undefined) { v = usedMostlyAsOther(usage(t)); memo.set(t, v); } return v; };
  const sameStem = (a, b) => !functional(a) && !functional(b) && folder.sameStem(a, b);
  report({ stem, folded: true, giver: prior.provenance?.giver ?? null, gate: { prior: pr.posPrior?.provenance?.giver ?? null, rule: "a form the part-of-speech prior uses significantly more (exact tail at a fair coin, alpha 0.05) as other than as NOUN, PROPN or ADJ is not folded; a form it has not seen, or seen too few times to say, is" } });
  return {
    discoverReferents: (s, o = {}) => discover(s, { ...o, sameStem }),
    namesCorefer: (a, b, o = {}) => corefer(a, b, { ...(typeof o === "function" ? { sameStem: o } : o), sameStem }),
  };
}

/**
 * Read one document into a WeftEntry@4. `language` is declared (any BCP-47/ISO name) or, when null, heard from the text; neither
 * gives the repo's default, English, and says so. `aliases` are the dotted forms the hyperlexicon resolved (consultAliases) — the
 * synchronous read cannot ask, so an async caller asks first (reading.js::readDocument does) and hands its report in as
 * `aliasReport`, which rides the entry. A short source is a typed skip, a reader failure a typed error — never silent.
 */
export function readWith(text, { address = null, category = null, language = null, priors = null, aliases = [], abbreviations = null, quality = true, minCharacters = 200, features = {}, reader = null, readerOptions = {}, selfRead = false, aliasReport = null, rowsOf = null, referents = false, declension = null, card = false, castIdentity = false } = {}) {
  // `readerOptions.formUsage` is the cast's own, not an organ of the reader, so it is taken out before the reader is assembled: the
  // treebank's measured use of a capitalised form the text never writes lower-case (adapters/text/form-usage.js). A caller's own
  // wins; null turns it off.
  const { formUsage: callerUsage, pronounPresence, ...readerOrgans } = readerOptions ?? {};
  const str = String(text ?? "");
  const bytes = utf8Length(str);
  const gaps = [];
  const heard = language ? null : languageContextFor(str, {});
  const stem = (language ? stemOf(language) : null) ?? (heard?.language ? stemOf(heard.language) ?? heard.language : null) ?? "eng";
  const languageRead = { declared: language ?? null, stem, source: language ? (stemOf(language) ? "declared" : "declared-unknown") : heard?.language ? "heard" : "default" };
  if (language && !stemOf(language)) gaps.push({ gap: "unknown_language", detail: `no prior stem is filed for ${language}: read with the ${stem} priors` });
  if (!language && !heard?.language) gaps.push({ gap: "language_default", detail: "no language was declared or heard: read as English, the repo's default" });
  const pr = priors ?? priorsFor(stem);
  for (const g of pr.gaps ?? []) gaps.push(g);
  const abbr = abbreviationsFor(str, { priors: pr, aliases, abbreviations });
  const empty = { schema: "WeftEntry@4", address, category, bytes, readCharacters: 0, vocabulary: null, cast: [], heard: [], edges: [], clauses: null, quality: null, surprise: null, sentences: [], pronouns: [], language: languageRead, abbreviations: { n: abbr.n, prior: abbr.prior, derived: abbr.derived, aliases: abbr.aliases, dotted: abbr.dotted }, aliasReport: aliasReport ?? null, gaps, error: null, ms: 0 };
  if (str.trim().length < minCharacters) {
    // too short to read for relations, but its sentences are still cut the one way
    const raw0 = toRawOffsets(str);
    const sentences = splitSentences(str, { abbreviations: abbr.set }).map((x, order) => ({ text: x.text, offset: raw0(x.offset), order }));
    return { ...empty, sentences, skipped: "too_short" };
  }
  const t0 = Date.now();
  let out = null, chunks = [], err = null, R = null, claims, declensionReport = null;
  try {
    // a surface's own organs (readerOptions: classifyWord, extendRelations, sameAct, roleConfig …) join the one assembly; the
    // abbreviations are this read's, so a surface never builds a reader beside it
    // THE DECLENSION FOLD (opt-in, `declension: true` or `{ prior }`; off, nothing here runs and the entry is byte-identical): "Пьер", "Пьера" and "Пьеру" are one name in different cases. The language's
    // declension prior (UniMorph rules, janus/priors/declension-<stem>.json; adapters/text/declension.js) answers pairwise whether one observed form reaches another, and the index
    // and the pronoun pass consult it through the organs they already take (discoverReferents, namesCorefer: no second reader). Ungated it also folds pronouns and verbs the capital tier admitted
    // ("Он"/"Она", "Приехала"/"Приехал"), so a form the language's own part-of-speech prior uses more often as something other than a noun, a name or an adjective is refused:
    // the gate is that prior's count (form-usage.js), a form it has not seen is not refused, and with no part-of-speech prior the fold is not run, with a typed gap.
    const declensionOrgans = declensionOrgansFor(declension, { stem, pr, discoverReferents, namesCorefer, gaps, report: (r) => { declensionReport = r; } });
    R = reader ?? makeReader({ priors: pr, language: stem, abbreviations: abbr.set, features, ...declensionOrgans, ...readerOrgans });
    ({ report: out, chunks } = relationsFor([{ text: str }], { reader: R, language: language ? stem : null }));
    // selfRead: the material read back as an answer against itself, so every claim carries the reader's verdict and its span
    if (selfRead && out?.read) claims = out.read(str)?.claims ?? [];
  } catch (e) { err = String(e?.message ?? e); }
  const raw = toRawOffsets(str);
  // each chunk's own place in the document (chunk.text is its body trimmed, so it is located inside its span)
  const norm = str.replace(/\r\n?/g, "\n");
  const bases = chunks.map((c) => { const at = norm.indexOf(c.text, Math.max(0, (c.start ?? 0) - 2)); return at >= 0 ? at : c.start ?? 0; });
  // THE SENTENCES are the one cut over the WHOLE document (the reader drops a passage under 20 characters, a heading, from what it
  // relates; the document's sentences keep it). Same splitter, same abbreviations as the reader's, so inside a passage they agree.
  // `cuts` are in the newline-normalised space the clause parser reads; `sentences` carry the caller's addresses.
  const cuts = splitSentences(norm, { abbreviations: abbr.set }).map((x) => ({ text: x.text, offset: x.offset }));
  const sentences = cuts.map((c, order) => ({ text: c.text, offset: raw(c.offset), order }));
  // THE PARSE, handed in by the surface (opt-in; nothing here loads a parser, so this module stays page-safe). `rowsOf(sentenceText)` returns that sentence's
  // dependency rows (UD: id, form, lemma, upos, feats, head, deprel) from whatever universal parser the surface holds (reading.js hands in grammar-en / grammar-ud
  // by the language this read decided). The rows ride the entry beside the sentences they parse, so a layer above (atoms, the stage) reads the ONE parse and the
  // one cut instead of cutting and parsing again. A sentence the parser cannot read is a typed gap on the entry, never a silent hole.
  let parsed = null;
  if (typeof rowsOf === "function") {
    parsed = sentences.map((x, order) => {
      try { const rows = rowsOf(x.text); if (Array.isArray(rows) && rows.length) return { order, offset: x.offset, text: x.text, rows }; gaps.push({ gap: "parse_empty", detail: `sentence ${order} parsed to no rows` }); }
      catch (e) { gaps.push({ gap: "parse_failed", detail: `sentence ${order}: ${String(e?.message ?? e).slice(0, 80)}` }); }
      return { order, offset: x.offset, text: x.text, rows: null };
    });
  }
  const sentenceAt = (at) => { let lo = 0, hi = cuts.length - 1, best = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (cuts[m].offset <= at) { best = m; lo = m + 1; } else hi = m - 1; } return best; };
  // THE CAST — the reader's own index, the beings its edges were resolved against (its ids, its floor), each with the address of
  // every mention. A being is what the capital tier names; a row the index holds only through the heard tier (a caseless nominal,
  // a common noun) is kept apart in `heard`, because the weft's company is between beings (weft.js::weftReferents) and common
  // nouns are not beings. SCOPE (Greenberg): the capital tier is a cased-script test. In a caseless script it names nothing, so
  // every row is `heard` and the cast is empty, as the second cast this replaced also was; in German, where every noun is
  // capitalised, every noun is a being. A being test that holds across scripts is owed, not implied.
  // TYPED GAP (2026-10-27, found by the Referents session and routed by the omnilingual check; owner: the referent-read session, branch referent-read):
  // `mentionsOf` bounds a mention by \p{L} on both sides, so in a script written without spaces (a zh probe) every row gets zero spans and the cast
  // is empty. Not fixed here: it changes the cast's output for every language and needs its own registration. Suggested fix: take the mention
  // boundaries from the language's tokenizer adapter (Intl.Segmenter), not the regex.
  let cast = [], heardRows = [], formUsageReport = null, identity = null;
  const identityRows = [];
  try {
    // A capital is a convention of the language (conventions.js): form-usage.js decides, per language, whether it has a ledgered convention to read by
    // (English). Another language, or no pos prior (a typed gap already: `no_pos_prior`), reads the capital tier exactly as it was.
    // The language must be KNOWN (declared with a filed stem, or heard): a language with no stem filed is read with the English priors as a typed gap
    // (`unknown_language`, `language_default`), and an English treebank's counts say nothing of a Turkish or Swahili capital.
    const languageKnown = languageRead.source === "declared" || languageRead.source === "heard";
    const formUsage = callerUsage !== undefined ? callerUsage : languageKnown ? formUsageFor(stem, pr.posPrior) : null;
    const verdicts = formUsage ? { undecided: [], separated: [] } : null;
    const capitalSurfaces = extractSurfaces(cuts, formUsage ? { formUsage, verdicts } : {});
    const capital = new Set(capitalSurfaces.map((x) => x.surface));
    // what the treebank's use refused, kept beside the entry (not enumerable: the wire stays what it was) so the rule is auditable
    // the conventions this branch reads by, cited from their one home (janus priors/conventions-<stem>.json); a gap is typed here, not on the wire
    if (formUsage) formUsageReport = { conventions: ["capital-marks-a-name", "treebank-attests-a-forms-use"].map((s) => conventionOf(pr.conventions, s)).filter(Boolean), gap: conventionsGap(pr.conventions), giver: "UD_English-EWT (pos-eng.json)", refused: extractSurfaces(cuts, {}).map((x) => x.surface).filter((s) => !capital.has(s) && !verdicts.undecided.some((u) => u.surface === s)), undecided: verdicts.undecided, separated: verdicts.separated };
    const bytes = byteOffsets(str);
    const byRef = new Map();
    for (const ev of out?.index?.events ?? []) {
      if (ev?.type !== "DEF.admit" || !ev.referent_id || !ev.surface) continue;
      const r = byRef.get(ev.referent_id) ?? { ref: ev.referent_id, surfaces: new Set() };
      r.surfaces.add(ev.surface); byRef.set(ev.referent_id, r);
    }
    for (const r of byRef.values()) {
      const surface = out.index.represent?.(r.ref) ?? [...r.surfaces].sort((a, b) => b.length - a.length)[0];
      const spansN = mentionsOf(norm, r.surfaces);
      const spans = spansN.map(([a, b]) => [raw(a), raw(b)]);
      // a word whose period is its own (this read's abbreviations: "Messrs.", "No.", "Ltd.") is a title, a unit or a suffix the
      // capital tier caught, not a being; standing alone it is kept with the heard rows
      const being = [...r.surfaces].some((x) => capital.has(x) && !isAbbreviationSurface(x, abbr.set));
      // mentionsAt: UTF-8 byte offsets, the weft's address unit; mentionSpans: [start, end) character spans into the text given
      const row = { ref: r.ref, surface, allSurfaces: [...r.surfaces], mentionsAt: spans.map(([a]) => bytes[a]), mentionSpans: spans, standing: being ? "referent" : "heard" };
      (being ? cast : heardRows).push(row);
      if (castIdentity && being) identityRows.push({ ref: r.ref, surfaces: [...r.surfaces], spans: spansN, standing: "referent", represent: surface });
    }
    // ONE NAME, ONE BEING (opt-in, `castIdentity: true | { rescue, claims, lead, unmerge, fold, spans }`; off, none of this runs and the entry is byte-identical): the cast
    // repaired by structural rules and the text's own evidence (organs/cast-identity.js). The rows are rebuilt the way they were built above.
    if (castIdentity) {
      const connectorOk = (t) => { const c = classifyWord(t, { posPrior: pr.posPrior }); if (!c.found || !(c.total > 0)) return null; const share = (tags) => c.candidates.filter((x) => tags.includes(x.upos)).reduce((n, x) => n + x.count, 0) * 2 >= c.total; return share(["CCONJ", "SCONJ"]) ? false : share(["ADP", "DET", "PART"]) ? true : null; };
      identity = castIdentityPass({ text: norm, rows: identityRows, mentionsOf, abbreviations: abbr.set, connectorOk, commonNoun: (t) => { const c = classifyWord(String(t).toLowerCase(), { posPrior: pr.posPrior }); if (!c.found || !(c.total > 0)) return false; const n = (u) => c.candidates.filter((x) => x.upos === u).reduce((a, x) => a + x.count, 0); return n("NOUN") > n("PROPN"); }, nominalOk: (t) => { const u = formUsageOf(pr.posPrior)?.(String(t).toLowerCase()); return !u || !usedMostlyAsOther(u); }, options: castIdentity === true ? {} : castIdentity });
      cast = identity.rows.map((r) => {
        const keep = r.represent && r.surfaces.includes(r.represent) ? r.represent : [...r.surfaces].sort((a, b) => b.length - a.length)[0];
        const spans = r.spans.map(([a, b]) => [raw(a), raw(b)]);
        return { ref: r.ref, surface: keep, allSurfaces: [...r.surfaces], mentionsAt: spans.map(([a]) => bytes[a]), mentionSpans: spans, standing: "referent" };
      });
    }
  } catch (e) { if (!err) err = `cast_failed: ${String(e?.message ?? e)}`; }
  // THE PRONOUNS — each binding the reader made, addressed in the document, naming the cast row it binds
  const refOf = (surface) => { try { const ids = out?.index?.resolve?.(surface); return ids && ids.size ? [...ids][0] : null; } catch { return null; } };
  const pronouns = [];
  (out?.pronouns ?? []).forEach((list, pi) => {
    for (const b of list ?? []) {
      const at = bases[pi] + (b.offset ?? 0);
      pronouns.push({ pronoun: b.pronoun, at: [raw(at), raw(at + String(b.pronoun ?? "").length)], sentence: sentenceAt(at), surface: b.surface ?? null, ref: b.surface ? refOf(b.surface) : null, margin: b.margin ?? null });
    }
  });
  if (identity) for (const p of pronouns) if (p.ref && identity.refMap.has(p.ref)) p.ref = identity.refMap.get(p.ref);
  // THE PRESENCE RUNG (readerOptions.pronounPresence = { window, boost, feed, floor, margin, locality }; opt-in, every dial declared, off = absent and then
  // nothing below runs and the entry is what it was): the pronouns of the resolver's own class bound by decayed presence over the beings of THIS cast
  // (adapters/text/pronouns.js::resolvePronounsByPresence, PREREG-PRESENCE.md), beside the shipped resolver's `entry.pronouns`, which it does not touch.
  let pronounsPresence = null, presenceInputs = null;
  if (pronounPresence && typeof pronounPresence === "object") {
    pronounsPresence = [];
    try {
      const refSurface = new Map(), surfaceToRef = new Map();
      for (const c of cast) { refSurface.set(c.ref, c.surface); for (const x of c.allSurfaces) surfaceToRef.set(x, c.ref); }
      let np = [];
      try { if (typeof readerOrgans.nonPersonalOf === "function") np = readerOrgans.nonPersonalOf(surfaceToRef) ?? []; } catch { np = []; }
      const mentions = cast.flatMap((c) => (c.mentionSpans ?? []).map(([a, b]) => ({ ref: c.ref, start: a, end: b })));
      presenceInputs = { sentences, mentions, nonPersonal: np };   // kept beside the entry (not enumerable) so a caller can re-run the pure rung on the same inputs
      const r = resolvePronounsByPresence(sentences, mentions, { ...pronounPresence, nonPersonal: np });
      for (const b of r.bindings) pronounsPresence.push({ pronoun: b.pronoun, at: [b.offset, b.offset + b.pronoun.length], sentence: b.sentenceOrder, surface: refSurface.get(b.referentId) ?? null, ref: b.referentId, mechanism: b.mechanism, activation: b.activation, margin: b.margin });
      for (const g of r.gaps) gaps.push(g);
    } catch (e) { gaps.push({ gap: "pronoun_presence_failed", detail: String(e?.message ?? e).slice(0, 120) }); }
  }
  // THE UNBOUND PRONOUNS (readerOptions.pronounGaps === true; default off, and then nothing below runs and the entry is what it was): every pronoun of the
  // resolver's own class this read did not bind, as a typed item addressed like entry.pronouns, with the reason, the regime that ran and the beings the
  // resolver had in hand. A gap the resolver filed, a frame it did not read, a passage with no being to bind to: none is a silent drop any more.
  let pronounGaps = null;
  if (readerOrgans.pronounGaps === true) {
    pronounGaps = [];
    (out?.pronounGaps ?? []).forEach((list, pi) => {
      for (const g of list ?? []) {
        const at = bases[pi] + (g.offset ?? 0);
        pronounGaps.push({
          pronoun: g.pronoun, at: [raw(at), raw(at + String(g.pronoun ?? "").length)], sentence: sentenceAt(at),
          reason: g.reason, regime: g.regime ?? "none",
          candidates: (g.candidates ?? []).map((c) => ({ ref: c.surface ? refOf(c.surface) : null, surface: c.surface ?? null, score: c.score ?? null })),
          detail: g.detail ?? null,
        });
      }
    });
    pronounGaps.sort((a, b) => a.at[0] - b.at[0]);
  }
  // SURPRISE — the canonical cycle's second constitutive gate (SEG+EVA)
  let surprise = null;
  try { surprise = surpriseCut(tokenEvents(str)); } catch (e) { if (!err) err = `surprise_failed: ${String(e?.message ?? e)}`; }
  // THE QUALITY LAYER — learned polarity scoped to the clause; the clause tree parsed inside the reader's own sentences
  let edges = (out?.edges ?? []).map(edgeOf);
  let qualityReport = null, clauses = null;
  if (quality !== false) {
    const lang = languageRead.stem;
    const applied = applyPolarity(edges, lang);
    edges = applied.edges;
    qualityReport = { polarity: applied.report };
    const nested = nestedClauses(norm, lang, { sentences: cuts });
    if (!nested.gap) {
      const sc = scopePolarity(edges, nested.clauses, lang);
      edges = sc.edges; clauses = nested.clauses;
      qualityReport.polarity = { ...applied.report, scoped: sc.report };
      qualityReport.clauses = { sentences: nested.sentences, clauses: nested.clauses.length, nested: nested.clauses.filter((c) => c.parent).length, skippedLong: nested.skippedLong };
    } else qualityReport.clauses = { gap: nested.gap };
    qualityReport.gates = readGates({ edges, cast, text: str });
  }
  const entry = {
    ...empty,
    readCharacters: str.length,
    vocabulary: out?.vocabulary ?? null,
    cast, heard: heardRows, edges, clauses, quality: qualityReport, surprise,
    sentences, pronouns,
    ...(pronounsPresence ? { pronounsPresence } : {}),
    ...(pronounGaps ? { pronounGaps } : {}),
    // OPT-IN (features.figures): the money figures of the document with the period and sign each is about, as atoms with addresses (adapters/text/figure-period.en.js); absent, the entry is exactly what it was
    ...(features.figures ? { figures: stem === "eng" ? figuresOf(str, { sentences, timePrior: priorJson("time-prior.json") }) : { figures: [], gaps: [{ gap: "figures_english_only", detail: `the period binder reads English; this read is ${stem}` }] } } : {}),
    ...(parsed ? { parse: parsed } : {}),
    ...(selfRead ? { claims: claims ?? [] } : {}),
    error: err, ms: Date.now() - t0,
  };
  // the reader this read used and its abbreviation set, for a surface that reads prefixes of the same text the same way (a replay);
  // not enumerable, so the entry stays plain data on the wire and in the weft
  Object.defineProperty(entry, "reader", { value: R, enumerable: false });
  Object.defineProperty(entry, "abbreviationSet", { value: abbr.set, enumerable: false });
  Object.defineProperty(entry, "formUsageReport", { value: formUsageReport, enumerable: false });
  if (presenceInputs) Object.defineProperty(entry, "presenceInputs", { value: presenceInputs, enumerable: false });
  // THE REFERENT LEDGER (opt-in, `referents: true`; off, the entry is byte-identical to before): the same reading projected onto referents, each inserted once and
  // addressed by its event, a span only its address, an edge between referents per statement; what the spans cannot decide is a typed gap (adapters/text/reading-referents.js).
  if (referents) {
    try {
      const L = buildReferentLedger({ text: str, source: address, cast, heard: heardRows, pronouns, edges, sentences, chunks, bases, norm, toRaw: raw, abbreviations: abbr.set });
      entry.referents = L.ledger;
      for (const g of L.gaps) gaps.push(g);
    } catch (e) { gaps.push({ gap: "referents_failed", detail: String(e?.message ?? e).slice(0, 160) }); }
  }
  // THE FOLDED CARD (opt-in, `card: true`, needs `referents: true`; off, the entry is byte-identical): a NON-ENUMERABLE entry.renderCard(referentId, opts) that renders one referent's fold as plain
  // information with a private map to its addresses (adapters/text/folded-card.js). It is a method of the entry and not a field of it, so the entry on the wire is unchanged.
  if (card) {
    if (!entry.referents) gaps.push({ gap: "card_needs_referents", detail: "card: true renders from the referent ledger; read with referents: true" });
    else {
      const decPrior = declension ? (declension === true ? priorJson(`declension-${stem}.json`) : declension.prior ?? null) : null;
      Object.defineProperty(entry, "renderCard", { value: (referentId, o = {}) => renderCard(entry, referentId, { declension: decPrior ? { prior: decPrior } : null, ...o }), enumerable: false });
    }
  }
  if (declension) entry.declension = declensionReport;
  if (identity) { entry.castIdentity = identity.report; for (const g of identity.report.gaps) gaps.push(g); }
  return entry;
}

/**
 * THE MASTER PIPELINE (2026-10-24): one document in, one WeftEntry@4 out, the same in Node and in a page. The language is declared
 * or heard; the priors are that language's (prior-source.mjs); the hyperlexicon is asked first when one is handed in; then the one
 * reader reads the document whole. Every tool reads through this call (reading.js re-exports it with the local giver as default).
 */
export async function readDocument(text, { language = null, lexicon = null, priors = null, ...opts } = {}) {
  const str = String(text ?? "");
  const heard = language ? null : languageContextFor(str, {});
  const stem = (language ? stemOf(language) : null) ?? (heard?.language ? stemOf(heard.language) ?? heard.language : null) ?? "eng";
  const pr = priors ?? priorsFor(stem);
  const c = await consultAliases(str, lexicon, { priors: pr });
  // the same lexicon is asked a second thing, once: which of the text's words are common nouns, and which time names, so the
  // pronoun resolver is told who is NOT a person (adapters/text/non-personal.js). No lexicon, no ask: the read is what it was.
  // A caller's own readerOptions.nonPersonalOf wins over the givers'.
  const np = lexicon ? await consultNonPersonal(str, lexicon, { timePrior: priorJson("time-prior.json"), language: stem }) : null;
  const readerOptions = np?.nonPersonalOf ? { nonPersonalOf: np.nonPersonalOf, ...(opts.readerOptions ?? {}) } : opts.readerOptions;
  return readWith(str, { ...opts, ...(readerOptions ? { readerOptions } : {}), language, priors: pr, aliases: [...(opts.aliases ?? []), ...c.aliases], aliasReport: { giver: c.giver, rows: c.rows, gap: c.gap, ...(c.settled ? { settled: c.settled } : {}), ...(np ? { nonPersonal: np.report } : {}) } });
}
