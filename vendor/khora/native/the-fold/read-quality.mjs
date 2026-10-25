// the-fold/read-quality.mjs — the READING-QUALITY layer: what the three archons add to a read.  (2026-10-14)
//
// The canonical reader (read-process.mjs::readToWeft → reader-bundle.js::engineRelationsFor) emits `{ end1, label, end2 }` edges
// whose polarity is the constant "+" — relations-gfp.js:190, "polarity is a language-specific lens (negation class); GFP leaves
// it unmeasured rather than guessing". Measured on the foundation read (falsify-foundation.mjs T3), 7 of 1,423 negated
// sentences yielded a negative edge: "we never went back" and "nobody came" were stored as affirmations. For testimony that
// inverts the record. This layer measures the lens the reader declined to guess.
//
//   SULLIVAN — morph-cues.js: a mark is learned from what reliably comes with it, each cue admitted only above its own
//     null. The learned `Polarity` model for the language (janus/priors/morph-cues-<iso>.json, from a gold treebank)
//     is APPLIED, never re-written as a rule: a sentence is negative when a token's firing cues bind `Neg`.
//   CHOMSKY — universal-grammar.js / relations-language.js: the arrangement (the record) stays GFP; polarity is the
//     language-specific lens scoped ABOVE it, exactly where relations-gfp.js left a hole. Nothing here says "subject".
//   CHAMPOLLION — language-training.js: a read is scored against the gates it must clear; `readGates` is the part of that
//     bar a single read can answer for itself (edges bind, cast is beings, claims survive the byte). The Rosetta grid is
//     never content — nothing here copies a relation from one language to another.
//
// Pure given its prior files. A language with no learned Polarity model is a TYPED GAP (`polarity: "unmeasured"` stays what
// the reader said), never a default. The model's own scope is its limit: the English model's carrier classes are
// CCONJ/INTJ/PART ("not", "n't", "no"), so "never", "nobody" and "none" are not covered, and `scope` says so.

import { priorJson, readJsonAt } from "./prior-source.mjs";
import { predict } from "../adapters/text/morph-cues.js";
import { loadModel, sentences as splitEn, tokenize as tokenizeEn, analyse } from "../adapters/text/english-parser.js";
import { clausesOf } from "../adapters/text/nested-clauses.js";

// the corpus's language codes → the file stems the priors are filed under (morph-cues-en, morph-cues-la …)
const MORPH_STEM = { en: "en", eng: "en", la: "la", lat: "la", grc: "grc", ar: "ar", arb: "ar", he: "he", heb: "he", sa: "sa-vedic", san: "sa-vedic" };
const POS_STEM = { en: "eng", eng: "eng", la: "lat", lat: "lat", grc: "grc", ar: "arb", arb: "arb", he: "heb", heb: "heb", san: "san", sa: "san" };

const cache = new Map();
// a prior by name through the one door (prior-source.mjs), or from an explicit directory a test or an eval passes
const readPrior = (priorsDir, name) => (priorsDir ? readJsonAt(priorsDir, name) : priorJson(name));

/** The polarity lens for a language: { model, pos, scope } or { gap }. Cached. */
export function polarityLens(language = "en", { priorsDir = null } = {}) {
  const key = `${language}|${priorsDir}`;
  if (cache.has(key)) return cache.get(key);
  const stem = MORPH_STEM[String(language).toLowerCase()];
  let lens;
  if (!stem) lens = { gap: `no learned morph-cue prior filed for ${language}` };
  else {
    const mc = readPrior(priorsDir, `morph-cues-${stem}.json`);
    const model = mc?.features?.Polarity;
    const pos = readPrior(priorsDir, `pos-${POS_STEM[String(language).toLowerCase()] ?? stem}.json`);
    if (!model?.cues) lens = { gap: `morph-cues-${stem} holds no Polarity model` };
    else lens = {
      model, pos, language: stem, giver: mc.provenance?.giver ?? null, license: mc.provenance?.license ?? null,
      scope: `carrier classes ${(model.classes ?? []).join("/")} only — a negator outside them is not read`,
    };
  }
  cache.set(key, lens); return lens;
}

const classOf = (pos, w) => {
  const c = pos?.forms?.[w]; if (!c) return "";
  return Object.entries(c).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0];
};

/** Tokens of a sentence in the shape the cue model reads ({ form, upos }), contractions split the way the treebank splits them. */
export function tokensForCues(sentence, pos) {
  const s = String(sentence ?? "").toLowerCase().replace(/[’‘]/g, "'");
  const raw = s.match(/[\p{L}\p{M}]+(?=n't)|n't|[\p{L}\p{M}']+/gu) ?? [];
  return raw.map((form, i) => ({ id: i + 1, form, upos: classOf(pos, form) }));
}

/** One sentence → { polarity: "-" | "+", cue } or { polarity: null, why } when the lens has nothing to say. */
export function polarityOfSentence(sentence, lens) {
  if (!lens || lens.gap) return { polarity: null, why: lens?.gap ?? "no lens" };
  const toks = tokensForCues(sentence, lens.pos);
  if (!toks.length) return { polarity: null, why: "no tokens" };
  const sent = { tokens: toks };
  let sawBound = false;
  for (const t of toks) {
    if (!(lens.model.classes ?? []).includes(t.upos)) continue;
    const p = predict(lens.model, t, sent);
    if (p.verdict === "bound" || p.verdict === "contested") {
      if (p.value === "Neg") return { polarity: "-", cue: `${p.cue.kind}:${p.cue.key}`, token: t.form };
      if (p.value === "Pos") sawBound = true;
    }
  }
  return { polarity: "+", cue: sawBound ? "Pos" : null };
}

/**
 * Apply the polarity lens to a read's edges, in place of the reader's constant. An edge cites a sentence (`spans[0].text`);
 * the polarity is the sentence's. An edge with no cited sentence keeps what the reader said. Returns { edges, report }.
 */
export function applyPolarity(edges, language = "en", opts) {
  const lens = polarityLens(language, opts);
  if (lens.gap) return { edges, report: { applied: false, why: lens.gap } };
  let negative = 0, changed = 0, kept = 0;
  const bySentence = new Map();
  const out = (edges ?? []).map((e) => {
    const text = e?.spans?.[0]?.text;
    if (!text) { kept += 1; return e; }
    let r = bySentence.get(text); if (!r) { r = polarityOfSentence(text, lens); bySentence.set(text, r); }
    if (r.polarity == null) { kept += 1; return e; }
    if (r.polarity === "-") negative += 1;
    if (r.polarity !== e.polarity) changed += 1;
    return { ...e, polarity: r.polarity, polarityCue: r.polarity === "-" ? r.cue : undefined };
  });
  return { edges: out, report: { applied: true, giver: lens.giver, license: lens.license, scope: lens.scope, edges: out.length, negative, changed, kept } };
}

/** The part of Champollion's good-enough bar a single read can answer for itself. Not a score: three typed booleans and why. */
export function readGates({ edges = [], cast = [], text = "" } = {}) {
  const bound = edges.filter((e) => e?.end1 && e?.end2 && e?.label);
  const low = String(text).toLowerCase();
  const castInBytes = cast.filter((c) => c?.surface && low.includes(String(c.surface).toLowerCase().replace(/\./g, ""))).length;
  return {
    edgesBind: bound.length > 0,
    castIsInTheText: cast.length === 0 ? null : castInBytes === cast.length,
    castSurfacesAbsent: cast.length - castInBytes,
    claimsCiteTheByte: bound.length ? bound.every((e) => (e.refs?.length ?? 0) > 0) : null,
  };
}

// ───────────────────────────── NESTED CLAUSES (Chomsky's parser, the clause tree kept) ─────────────────────────────
// relations-gfp.js flattens clauseSpans' tree into windows; the edge a reader emits has no memory that one clause is the
// content of another. This reads each sentence through the learned English dependency parser (UD_English-EWT) and keeps the
// TREE: every clause with its parent, the relation that attaches it (complement, adverbial, relative, coordinate…), its marker
// ("that", "because", "who"), its own words, its subject/predicate/object, and its own polarity. Character offsets are into
// the text given, so a caller can address them in the file. Held-out on EWT test the nested triples score F1 0.54 against
// 160 hits for a random-parent null (nested-clauses.test.js) — real, and not good enough to call solved.
let parserModel = null; let parserGap = null;
function parser() {
  if (parserModel) return parserModel;
  const prior = priorJson("parser-eng-ewt.json");
  if (!prior) { parserGap = "no English dependency parser: parser-eng-ewt.json is not in the priors home"; return null; }
  try { parserModel = loadModel(prior); }
  catch (e) { parserGap = `no English dependency parser: ${String(e?.message ?? e).slice(0, 80)}`; }
  return parserModel;
}
const MAX_SENTENCE_TOKENS = 120;      // the parser is a transition system over a whole sentence; a run-on beyond this is cut, not parsed

/** text → { clauses, sentences, gap }. English only; another language is a typed gap, never an English parse of it.
 *  `sentences` — the reader's own cuts ({ text, offset }, from spans.js::splitSentences with the read's abbreviations). Given,
 *  the clause tree is parsed inside exactly the sentences the relations were read from, so the two never disagree about where a
 *  sentence ends ("Messrs." is one word in both); omitted, the parser's own segmentation is used, as before. */
export function nestedClauses(text, language = "en", { sentences = null } = {}) {
  if (!["en", "eng"].includes(String(language).toLowerCase())) return { clauses: [], sentences: 0, gap: `no dependency parser for ${language}` };
  const model = parser(); if (!model) return { clauses: [], sentences: 0, gap: parserGap };
  const out = []; let nSent = 0, skipped = 0;
  const cuts = Array.isArray(sentences) ? sentences.map((x) => ({ text: x.text, start: x.offset ?? x.start ?? 0 })) : splitEn(String(text ?? ""));
  for (const sent of cuts) {
    const toks = tokenizeEn(sent.text); if (toks.length < 2) continue;
    if (toks.length > MAX_SENTENCE_TOKENS) { skipped += 1; continue; }
    nSent += 1;
    const rows = analyse(model, toks.map((t) => t.form)).map((r, i) => ({ ...r, start: sent.start + toks[i].start, end: sent.start + toks[i].end }));
    for (const c of clausesOf(rows)) out.push({ ...c, sentence: nSent - 1, id: `s${nSent - 1}.${c.id}`, parent: c.parent ? `s${nSent - 1}.${c.parent}` : null, complement: c.complement.map((x) => `s${nSent - 1}.${x}`) });
  }
  return { clauses: out, sentences: nSent, skippedLong: skipped, gap: null };
}

/**
 * Polarity SCOPED to the clause. A sentence is not negative; a clause is. "Nobody told them that the school would not
 * reopen" has two negations, one per clause; "she said the road was open although it was not" has one, in the subordinate.
 * An edge whose two ends both sit in one clause's own words takes THAT clause's polarity — the clause's own negator by the
 * parser (not/n't/never/no/nobody… on its own tokens) OR the learned Polarity lens over its own words. An edge that fits no
 * single clause keeps the sentence-level lens. Returns { edges, report }.
 */
export function scopePolarity(edges, clauses, language = "en", opts) {
  const lens = polarityLens(language, opts);
  const bySent = new Map(); for (const c of clauses) { (bySent.get(c.sentence) ?? bySent.set(c.sentence, []).get(c.sentence)).push(c); }
  const norm = (x) => String(x ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  let scoped = 0, fallback = 0, negative = 0, changed = 0;
  const out = (edges ?? []).map((e) => {
    const sentText = e?.spans?.[0]?.text; if (!sentText) return e;
    const a = norm(e.end1Face ?? e.end1), b = norm(e.end2Face ?? e.end2);
    const labelWords = norm(e.label).split(" ").filter((w) => w.length > 2);
    // THE CLAUSE THAT GOVERNS THE EDGE: the one whose own words hold the connector (the label) and as many of its ends as any
    // clause does. Ends may sit in different clauses — a subject in the matrix, an object in its complement — but the connector
    // is one clause's verb, and negation is a property of that clause.
    const sentN = norm(sentText);
    let pick = null, best = 0;
    for (const list of bySent.values()) for (const c of list) {
      const own = norm(c.own.text); if (!own || !sentN.includes(own.slice(0, Math.min(25, own.length)))) continue;
      const whole = own + " " + norm(c.subject?.text) + " " + norm(c.object?.text);
      const lab = labelWords.filter((w) => own.split(" ").includes(w)).length;
      const ends = (a && whole.includes(a) ? 1 : 0) + (b && whole.includes(b) ? 1 : 0);
      const score = lab * 2 + ends;
      if (lab > 0 && ends > 0 && score > best) { best = score; pick = c; }
      else if (!pick && ends === 2 && score > best) { best = score; pick = c; }
    }
    let pol;
    if (pick) {
      const viaLens = lens.gap ? null : polarityOfSentence(pick.own.text, lens).polarity;
      pol = pick.polarity === "-" || viaLens === "-" ? "-" : "+"; scoped += 1;
    } else {
      const r = polarityOfSentence(sentText, lens); if (r.polarity == null) return e; pol = r.polarity; fallback += 1;
    }
    if (pol === "-") negative += 1; if (pol !== e.polarity) changed += 1;
    return { ...e, polarity: pol, clause: pick ? pick.id : undefined };
  });
  return { edges: out, report: { scopedToClause: scoped, sentenceFallback: fallback, negative, changed, edges: out.length } };
}
