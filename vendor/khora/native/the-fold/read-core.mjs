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
//   readWith(text, opts)            → WeftEntry@4: edges, the reader's own cast with every mention's address, its sentences, its
//                                     pronoun bindings, the clause tree, polarity, surprise, and every gap typed
//
// Nothing here is a word list. The English closed classes (adapters/text/priors.js) are passed only to an English read; another
// language without its own is a typed gap, never English applied to it (the Greenberg rule).

import { makeRelationReader } from "../organs/hypergraph.js";
import { chunkSource, tokenize, blankLabelRows } from "../organs/source.js";
import { splitSentences, deriveAbbreviations } from "../adapters/text/spans.js";
import { GRAMMAR_MIN_SHARE } from "../adapters/text/grain-typing.js";
import { extractSurfaces, discoverReferents, namesCorefer, diaNorm } from "../adapters/text/surfaces.js";
import { withEar } from "../adapters/text/active-ear.js";
import { resolvePronouns } from "../adapters/text/pronouns.js";
import { relationExtractorsFor } from "../adapters/text/relations-language.js";
import { classifyWord, dominantClass } from "../adapters/text/wordclass.js";
import { createLemmatizer, morphologyFromPrior } from "../adapters/text/morphology.js";
import * as P from "../adapters/text/priors.js";
import { aliasJunctions, resolveAliases } from "../organs/lexicon.js";
import { extractSurfacesHeard, languageContextFor } from "./language-context.js";
import { stemOf } from "./language-grammar.js";
import { tokenEvents, surpriseCut } from "./surprise-gate.mjs";
import { applyPolarity, readGates, nestedClauses, scopePolarity } from "./read-quality.mjs";
import { priorJson, priorGeneration } from "./prior-source.mjs";

export const READ_CORE = Object.freeze({
  schema: "ReadCore@1",
  module: "native/the-fold/read-core.mjs",
  priors: "by name through prior-source.mjs: pos-<stem>, pos-<stem>-lexicon, morphology-<stem>, punctuation-<stem> (janus/priors)",
  abbreviations: "the measured punctuation prior + the text's own + the hyperlexicon's aliases; never a hand list",
  emits: "WeftEntry@4 + sentences, pronouns, language, abbreviations, gaps",
});

// ── priors ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The received priors, from data handed in. Data-gated: an absent piece leaves that leg bare (exact match), never a guess. */
export function buildPriors({ pos = null, posLexicon = null, morphology = null, unimorph = null, punctuation = null, stem = null } = {}) {
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
  return { stem, posPrior, verbForms: forms.size ? forms : null, lemmatizer, punctuation: punctuation ?? null, gaps };
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
  });
  if (priorCache.size > 16) priorCache.clear();
  priorCache.set(key, built);
  return built;
}

// ── which dotted tokens are words ─────────────────────────────────────────────────────────────────────────────────────────────

const variants = (t) => { const s = String(t); return [s, s.toLowerCase(), s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(), s.toUpperCase()]; };

/** The tokens that keep their period, for one text. `abbreviations` (a caller's own set) is added, not substituted. */
export function abbreviationsFor(text, { priors = null, aliases = [], abbreviations = null } = {}) {
  const fromPrior = priors?.punctuation?.abbreviations ?? [];
  const derived = [...deriveAbbreviations(String(text ?? "").replace(/\r\n?/g, "\n"))];
  const fromAliases = [...aliases].map((a) => String(a).replace(/\.$/, ""));
  const set = new Set();
  for (const t of [...fromPrior, ...derived, ...fromAliases, ...(abbreviations ?? [])]) for (const v of variants(t)) set.add(v);
  return { set, n: set.size, prior: fromPrior.length, derived: derived.length, aliases: fromAliases.length, giver: priors?.punctuation?.giver ?? null };
}

/** Ask the hyperlexicon about the dotted forms the priors and the text cannot settle; keep each one the text's own use allows. */
export async function consultAliases(text, lexicon, { priors = null } = {}) {
  if (!lexicon) return { aliases: [], rows: [], giver: null, gap: "no hyperlexicon was handed to this read" };
  const known = new Set([...(priors?.punctuation?.abbreviations ?? []), ...deriveAbbreviations(String(text ?? ""))].map((a) => String(a).toLowerCase()));
  const junctions = aliasJunctions(text, known);
  if (!junctions.size) return { aliases: [], rows: [], giver: lexicon.giver ?? null, gap: null };
  await lexicon.want(junctions.keys());
  const rows = resolveAliases(lexicon, junctions, text);
  const last = lexicon.log?.[lexicon.log.length - 1];
  return { aliases: rows.filter((r) => r.kept).map((r) => r.form), rows, giver: lexicon.giver ?? null, gap: last?.gap ?? null };
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

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Every place a surface stands as a whole word, longest surface first, overlaps given to the longer. The index keeps a name in
 *  its folded form ("Mr Brown" for "Mr. Brown", a lower-cased "messrs"), so a token may carry its period in the text and a
 *  folded surface matches without case. */
function mentionsOf(text, surfaces) {
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
 * Read one document into a WeftEntry@4. `language` is declared (any BCP-47/ISO name) or, when null, heard from the text; neither
 * gives the repo's default, English, and says so. `aliases` are the dotted forms the hyperlexicon resolved (consultAliases) — the
 * synchronous read cannot ask, so an async caller asks first (reading.js::readDocument does) and hands its report in as
 * `aliasReport`, which rides the entry. A short source is a typed skip, a reader failure a typed error — never silent.
 */
export function readWith(text, { address = null, category = null, language = null, priors = null, aliases = [], abbreviations = null, quality = true, minCharacters = 200, features = {}, reader = null, aliasReport = null } = {}) {
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
  const empty = { schema: "WeftEntry@4", address, category, bytes, readCharacters: 0, vocabulary: null, cast: [], heard: [], edges: [], clauses: null, quality: null, surprise: null, sentences: [], pronouns: [], language: languageRead, abbreviations: { n: abbr.n, prior: abbr.prior, derived: abbr.derived, aliases: abbr.aliases }, aliasReport: aliasReport ?? null, gaps, error: null, ms: 0 };
  if (str.trim().length < minCharacters) {
    // too short to read for relations, but its sentences are still cut the one way
    const raw0 = toRawOffsets(str);
    const sentences = splitSentences(str, { abbreviations: abbr.set }).map((x, order) => ({ text: x.text, offset: raw0(x.offset), order }));
    return { ...empty, sentences, skipped: "too_short" };
  }
  const t0 = Date.now();
  let out = null, chunks = [], err = null;
  try {
    const R = reader ?? makeReader({ priors: pr, language: stem, abbreviations: abbr.set, features });
    ({ report: out, chunks } = relationsFor([{ text: str }], { reader: R, language: language ? stem : null }));
  } catch (e) { err = String(e?.message ?? e); }
  const raw = toRawOffsets(str);
  // each chunk's own place in the document (chunk.text is its body trimmed, so it is located inside its span)
  const norm = str.replace(/\r\n?/g, "\n");
  const bases = chunks.map((c) => { const at = norm.indexOf(c.text, Math.max(0, (c.start ?? 0) - 2)); return at >= 0 ? at : c.start ?? 0; });
  const cuts = []; // in the reader's (newline-normalised) space, for the clause parser; `sentences` carries the caller's addresses
  (out?.sentences ?? []).forEach((list, pi) => { for (const s of list ?? []) cuts.push({ text: s.text, offset: bases[pi] + s.offset }); });
  const sentences = cuts.map((c, order) => ({ text: c.text, offset: raw(c.offset), order }));
  const sentenceBase = []; { let n = 0; for (const list of out?.sentences ?? []) { sentenceBase.push(n); n += (list ?? []).length; } }
  // THE CAST — the reader's own index, the beings its edges were resolved against (its ids, its floor), each with the address of
  // every mention. A being is what the capital tier names; a row the index holds only through the heard tier (a caseless nominal,
  // a common noun) is kept apart in `heard`, because the weft's company is between beings (weft.js::weftReferents) and common
  // nouns are not beings. SCOPE (Greenberg): the capital tier is a cased-script test. In a caseless script it names nothing, so
  // every row is `heard` and the cast is empty, as the second cast this replaced also was; in German, where every noun is
  // capitalised, every noun is a being. A being test that holds across scripts is owed, not implied.
  let cast = [], heardRows = [];
  try {
    const capital = new Set(extractSurfaces(cuts, {}).map((x) => x.surface));
    const byRef = new Map();
    for (const ev of out?.index?.events ?? []) {
      if (ev?.type !== "DEF.admit" || !ev.referent_id || !ev.surface) continue;
      const r = byRef.get(ev.referent_id) ?? { ref: ev.referent_id, surfaces: new Set() };
      r.surfaces.add(ev.surface); byRef.set(ev.referent_id, r);
    }
    for (const r of byRef.values()) {
      const surface = out.index.represent?.(r.ref) ?? [...r.surfaces].sort((a, b) => b.length - a.length)[0];
      const spans = mentionsOf(norm, r.surfaces).map(([a, b]) => [raw(a), raw(b)]);
      const being = [...r.surfaces].some((x) => capital.has(x));
      const row = { ref: r.ref, surface, allSurfaces: [...r.surfaces], mentionsAt: spans.map(([a]) => a), mentionSpans: spans, standing: being ? "referent" : "heard" };
      (being ? cast : heardRows).push(row);
    }
  } catch (e) { if (!err) err = `cast_failed: ${String(e?.message ?? e)}`; }
  // THE PRONOUNS — each binding the reader made, addressed in the document, naming the cast row it binds
  const refOf = (surface) => { try { const ids = out?.index?.resolve?.(surface); return ids && ids.size ? [...ids][0] : null; } catch { return null; } };
  const pronouns = [];
  (out?.pronouns ?? []).forEach((list, pi) => {
    for (const b of list ?? []) {
      const at = bases[pi] + (b.offset ?? 0);
      pronouns.push({ pronoun: b.pronoun, at: [raw(at), raw(at + String(b.pronoun ?? "").length)], sentence: sentenceBase[pi] + (b.sentenceOrder ?? 0), surface: b.surface ?? null, ref: b.surface ? refOf(b.surface) : null, margin: b.margin ?? null });
    }
  });
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
  return {
    ...empty,
    readCharacters: str.length,
    vocabulary: out?.vocabulary ?? null,
    cast, heard: heardRows, edges, clauses, quality: qualityReport, surprise,
    sentences, pronouns,
    error: err, ms: Date.now() - t0,
  };
}
