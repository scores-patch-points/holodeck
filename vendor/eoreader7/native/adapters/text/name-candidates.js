// name-candidates.js — NOMINATE the words a language's received priors read as
// possible NAMES, from a SINGLE mention, with no capital letter and no
// recurrence. For de-identification: a name typed in lowercase is still a name;
// "my cousin mike and his wife sarah went to marlow dental, my sister priya says
// hi" must yield mike, sarah, marlow, priya although each occurs once.
//
// WHY A SEPARATE TIER. surfaces.js reads names by capital letter (one witness).
// listening-cast.js / heard-nominals.js hear caselessly but admit a word only
// after it RECURS (>= 2 arrivals, S16) and earns keyness standing — a name
// mentioned once is never found. That gate is right for ADMITTING a being. It is
// wrong for NOMINATING a candidate for a downstream witness: recall matters, the
// consumer filters. This module is the single-mention NOMINATOR. It admits
// nothing: standing is always "nominated".
//
// THE RULES THIS OBEYS (READING-SPEC / READING-POLICY, LEVELS "heard rule")
//   1. PRIORS REFUSE OR NOMINATE, NEVER ADMIT. Every prior has a giver: the POS
//      prior (UD treebank, train split) and FramePrior@1 (the gold classes of
//      the treebank's hapax words by the classes of their neighbours). A language
//      with no prior is a TYPED GAP (no_prior), never another language's grammar.
//   2. CAUSAL. A sentence is read with only the prefix: its candidates are a
//      function of that sentence and (when the language is not declared) of the
//      language listener's view from the prefix. Nothing later is read.
//   3. CASE-BLIND. The text is lowercased before anything reads it (per code
//      point, length-preserving, so offsets into the ORIGINAL text survive).
//      Capitals are one witness (surfaces.js); this module never reads them. A
//      text, its lowercase and its uppercase give the same candidates.
//   4. ONE CUT. The only number is minShare = 0.5, the repo's one declared
//      settledness cut (GRAMMAR_MIN_SHARE). Two structural facts about the FORM,
//      not tuned: a name has at least two glyphs in a phonographic script (one in
//      a logographic one), and a token holding a digit is not a name. The
//      "significant PROPN share" arm uses the prior's OWN base rate of PROPN as
//      its boundary (a form whose PROPN share is above chance is evidence for
//      PROPN; a derived lift >= 1, not a dial). Precision/recall as a function of
//      the frame-implied naming mass is the instrument's curve (information only).
//
// HOW A WORD IS JUDGED (per occurrence; classAt from heard-nominals.js)
//   dist = classAt(unit, prev, next): the form's own UPOS tally when the prior
//   attests it (frame-corrected when ambiguous), the frame's class distribution
//   when it does not (or when the prior knows it only as X: a transliterated
//   foreign name).  settled = the class holding >= minShare of dist.
//     REFUSE   settled as a function/verbal class (VERB AUX PART ADP DET PRON NUM
//              CCONJ SCONJ INTJ). The prior refuses; it never admits.
//     NOMINATE prior:PROPN         attested, PROPN holds >= minShare
//              prior:PROPN-share   attested, nothing settled, own PROPN share
//                                  above the prior's base rate of PROPN
//              unseen|frame:P|N    unseen by the prior, frame-implied naming mass
//                                  (NOUN+PROPN) >= minShare   (x-only|frame:..
//                                  when attested only as X)
//     NOT      a form attested as a settled common NOUN (or any other settled
//              class: ADJ ADV ..) is not a name candidate.
//   Adjacent nominated words are joined into one span ("eleanor voss"; a hyphen
//   joins "jean-luc"). A PROPN-attested title or an initial followed by "." joins
//   the candidate after it ("dr. kim", "j. smith": basis title+candidate /
//   initial+candidate). A title is a token whose dotted form the prior attests as
//   PROPN ("dr." "mr."), or one letter.
//
// GAPS (typed, never guessed)
//   language_unheard  no prior's coverage of the prefix clears the listener's
//                     evidence rule: the sentence is not read.
//   no_prior          the declared language has no received prior.
//   no_frame_prior    the language has a POS prior but no frame prior: an unseen
//                     word has no class evidence and is neither nominated nor
//                     refused.
//   ear_unaligned     the ear's segmentation changed more than spacing (offsets
//                     could not be mapped); that sentence is read without the ear.
//
// EAR. Unspaced scripts (Chinese/Japanese) are segmented and Arabic/Hebrew
// proclitics / Korean enclitics are peeled by adapters/text/ear.js from the
// language's own priors; spans are mapped back to the ORIGINAL text by the
// ordinal of non-space characters (the ear only ever adds or removes spacing).
//
// LIMITS (see the instrument for measurements). A common word that is also a
// name (mike, greg, mark, will, bill, rose) is nominated when the prior attests
// it as PROPN and the frame does not settle it as a verb: precision is not what
// this tier optimises. A name the prior attests only as a common NOUN (most
// surnames that are words: "baker") is not found. "marlow dental": "dental" is an
// attested ADJ, so only "marlow" is a candidate.
//
// PURE. Priors are the caller's (injected `grammar`, or `language`, or heard).

import { grammarFor } from "../../the-fold/language-grammar.js";
import { createLanguageListener } from "../../the-fold/language-listener.js";
import { makeEar } from "./ear.js";
import { classAt } from "./heard-nominals.js";

export const MIN_SHARE = 0.5; // GRAMMAR_MIN_SHARE: the repo's one declared settledness cut
export const LANE = "name-candidate";

const UNIT = /[\p{L}\p{M}\p{N}'’]+|[^\s\p{L}\p{M}\p{N}]/gu;
const WORDISH = /^[\p{L}\p{M}\p{N}'’]+$/u;
const NUMERIC = /^[\p{N}'’]+$/u;
const HAS_DIGIT = /\p{N}/u;
const HAS_LETTER = /\p{L}/u;
const LOGOGRAPHIC = /\p{Script=Han}/u;
const LOCATOR = /\b(?:https?|ftp):\/\/\S+|\bwww\.\S+|\S+@\S+\.\S+/giu;
const TERMINATOR = /[.!?]+["'”’)\]»]*(?=\s|$)|[。！？｡؟।]+[”’」』)\]»"']*/gu;
const APOS = /['’]/;
// the closed classes a prior may SETTLE a form into, which cannot name a being
export const REFUSED_CLASSES = Object.freeze(new Set(["VERB", "AUX", "PART", "ADP", "DET", "PRON", "NUM", "CCONJ", "SCONJ", "INTJ"]));
const NAMING = ["NOUN", "PROPN"];

const total = (m) => Object.values(m).reduce((a, b) => a + b, 0);
const naming = (dist) => (dist ? NAMING.reduce((s, c) => s + (dist[c] ?? 0), 0) : null);
const settledClass = (dist, minShare) => {
  if (!dist) return null;
  const [c, p] = Object.entries(dist).sort((a, b) => b[1] - a[1])[0] ?? [];
  return p >= minShare ? c : null;
};

const baseRates = new WeakMap();
/** The prior's OWN base rate of PROPN over all its tokens (derived, not tuned). */
function propnBaseRate(posPrior) {
  if (baseRates.has(posPrior)) return baseRates.get(posPrior);
  let all = 0, propn = 0;
  for (const c of Object.values(posPrior.forms)) { all += total(c); propn += c.PROPN ?? 0; }
  const r = all ? propn / all : 0;
  baseRates.set(posPrior, r);
  return r;
}

/** The text as the ear hears it: lowercased per code point (length-preserving,
 * so every offset survives) with links and addresses blanked to spaces. */
export function heardText(text) {
  let out = "";
  for (const ch of String(text ?? "")) { const l = ch.toLowerCase(); out += l.length === ch.length ? l : ch; }
  return out.replace(LOCATOR, (m) => " ".repeat(m.length));
}

/** Sentence chunks over the heard text: newlines, ! ? and a full stop followed by
 * space/end (an ellipsis is not a stop). A chunk ending in "word." keeps `dotWord`
 * so that, once the language is known, an abbreviation ("dr." "j.") can be merged
 * back with what follows. */
function chunkSentences(H) {
  const out = [];
  let ls = 0;
  const lines = H.split("\n");
  for (const line of lines) {
    const le = ls + line.length;
    const pieces = [];
    let cursor = 0;
    TERMINATOR.lastIndex = 0;
    let m;
    while ((m = TERMINATOR.exec(line))) {
      if (/^\.{2,}$/.test(m[0])) continue; // ellipsis
      const end = m.index + m[0].length;
      const before = line.slice(cursor, m.index);
      const dotWord = m[0] === "." ? (before.match(/([\p{L}\p{M}]+)$/u)?.[1] ?? null) : null;
      pieces.push({ a: cursor, b: end, dotWord });
      cursor = end;
    }
    if (cursor < line.length) pieces.push({ a: cursor, b: line.length, dotWord: null });
    const kept = [];
    for (const p of pieces) {
      const seg = line.slice(p.a, p.b);
      if (!HAS_LETTER.test(seg) && !HAS_DIGIT.test(seg)) continue;
      const lead = seg.length - seg.trimStart().length;
      const trail = seg.length - seg.trimEnd().length;
      kept.push({ start: ls + p.a + lead, end: ls + p.b - trail, dotWord: p.dotWord, lastInLine: false });
    }
    if (kept.length) kept[kept.length - 1].lastInLine = true;
    out.push(...kept);
    ls = le + 1;
  }
  return out;
}

const isAbbreviation = (g, w) => (w.length === 1 && /\p{L}/u.test(w)) || Boolean(g?.posPrior?.forms?.[`${w}.`]);

/** Split a unit at a clitic the prior itself attests as a separate token
 * ("mike's" -> mike + 's; "don't" -> do + n't; "l'ami" -> l' + ami). A form the
 * prior attests whole, or whose clitic it does not know, stays whole ("o'brien"). */
function splitClitic(u, forms) {
  const a = u.text.search(APOS);
  if (a <= 0) return [u];
  const key = u.text.replace(/’/g, "'");
  if (forms[key]) return [u];
  const cut = (i, hostNegated) => {
    const left = { ...u, text: u.text.slice(0, i), end: u.start + i };
    const right = { ...u, text: u.text.slice(i), start: u.start + i };
    return [{ ...left, hostOfClitic: hostNegated ? "negation" : "clitic" }, { ...right, kind: "clitic" }];
  };
  if (forms[key.slice(a)]) return cut(a, false);
  if (key[a - 1] === "n" && forms[key.slice(a - 1)]) return cut(a - 1, true);
  const pre = key.slice(0, a + 1);
  if (forms[pre] && a + 1 < key.length) {
    return [{ ...u, text: u.text.slice(0, a + 1), end: u.start + a + 1, kind: "clitic" }, { ...u, text: u.text.slice(a + 1), start: u.start + a + 1 }];
  }
  return [u];
}

/** Quotation marks written as apostrophes ('mike') are not part of the word; a form the prior
 * attests whole ("'s") keeps them. */
function trimQuotes(u, forms) {
  if (forms[u.text.replace(/’/g, "'")]) return u;
  const lead = u.text.match(/^['’]+/)?.[0].length ?? 0;
  const trail = u.text.match(/['’]+$/)?.[0].length ?? 0;
  if (!lead && !trail) return u;
  const text = u.text.slice(lead, u.text.length - trail);
  if (!text) return { ...u, kind: "punct" };
  return { ...u, text, start: u.start + lead, end: u.end - trail };
}

/** Units of ONE sentence with offsets into the ORIGINAL text. */
function sentenceUnits(H, s, ear, gaps) {
  const T = H.slice(s.start, s.end);
  let Tp = T;
  if (ear?.segment) Tp = ear.segment(Tp);
  if (ear?.peel) Tp = ear.peel(Tp);
  const ns = (str) => { const idx = []; for (let i = 0; i < str.length; i++) if (!/\s/.test(str[i])) idx.push(i); return idx; };
  const idxT = ns(T), idxP = ns(Tp);
  let mapPos = null;
  if (idxT.length === idxP.length) {
    mapPos = new Int32Array(Tp.length).fill(-1);
    for (let k = 0; k < idxP.length; k++) mapPos[idxP[k]] = idxT[k];
  } else {
    gaps.add("ear_unaligned", "the ear changed more than spacing; sentence read without it");
    Tp = T;
    mapPos = Int32Array.from({ length: T.length }, (_, i) => i);
  }
  const units = [];
  UNIT.lastIndex = 0;
  let m;
  while ((m = UNIT.exec(Tp))) {
    const text = m[0];
    const a = mapPos[m.index], b = mapPos[m.index + text.length - 1];
    if (a < 0 || b < 0) continue;
    units.push({ text, start: s.start + a, end: s.start + b + 1, kind: WORDISH.test(text) ? "word" : "punct" });
  }
  return units;
}

const makeGaps = () => {
  const m = new Map();
  return {
    add(reason, detail) { const g = m.get(reason) ?? { reason, detail, n: 0 }; g.n += 1; m.set(reason, g); },
    list() { return [...m.values()].map((g) => ({ reason: g.reason, detail: g.n > 1 ? `${g.detail} (x${g.n})` : g.detail })); },
  };
};

/** Judge ONE word occurrence against the language's priors. */
function judge(unit, prev, next, g, minShare, gaps) {
  const { posPrior, framePrior } = g;
  const text = unit.text.replace(/’/g, "'");
  const out = { arm: null, flagged: false, refused: null, mass: null, propn: null, unseen: false, xOnly: false, pathB: false, basis: null };
  const floor = LOGOGRAPHIC.test(text) ? 1 : 2;
  if ([...text].length < floor) { out.refused = "below-glyph-floor"; return out; }
  if (HAS_DIGIT.test(text) || NUMERIC.test(text)) { out.refused = "digit"; return out; }
  const counts = posPrior.forms[text];
  const attestedAtAll = Boolean(counts && total(counts) >= 1);
  out.xOnly = attestedAtAll && (counts.X ?? 0) / total(counts) >= 0.5;
  const { dist, basis } = classAt(text, prev?.text.replace(/’/g, "'") ?? null, next?.text.replace(/’/g, "'") ?? null, { posPrior, framePrior, minShare });
  const attested = basis.startsWith("attested");
  out.unseen = !attestedAtAll;
  out.basis = basis;
  if (!dist) { gaps.add("no_frame_prior", "unseen words have no class evidence without a frame prior; not nominated, not refused"); out.refused = "no-frame-prior"; return out; }
  out.mass = naming(dist);
  out.propn = dist.PROPN ?? 0;
  const settled = settledClass(dist, minShare);
  out.settled = settled;
  if (settled && REFUSED_CLASSES.has(settled)) { out.refused = `settled:${settled}`; return out; }
  if (attested) {
    if (settled === "PROPN") { out.arm = "prior:PROPN"; out.flagged = true; return out; }
    if (settled) { out.refused = settled === "NOUN" ? "common-noun" : `settled:${settled}`; return out; }
    // nothing settles: a significant PROPN share is one above the prior's own base rate
    const own = counts && total(counts) ? (counts.PROPN ?? 0) / total(counts) : (dist.PROPN ?? 0);
    if (own > propnBaseRate(posPrior)) { out.arm = "prior:PROPN-share"; out.flagged = true; }
    return out;
  }
  // unseen by the prior, or attested only as X: the frame's naming mass decides
  out.pathB = true;
  if (out.mass >= minShare) { out.arm = `${out.xOnly ? "x-only" : "unseen"}|${basis.split("|").slice(1).join("|")}`; out.flagged = true; }
  return out;
}

// building an ear scans the prior's whole vocabulary; a grammar is read many times
const earCache = new WeakMap(); // posPrior -> { proclitics, enclitics, contractions, ear }
function cachedEar(g) {
  const hit = earCache.get(g.posPrior);
  if (hit && hit.proclitics === g.proclitics && hit.enclitics === g.enclitics && hit.contractions === (g.contractions ?? null)) return hit.ear;
  const built = makeEar({ posPrior: g.posPrior, proclitics: g.proclitics, enclitics: g.enclitics, contractions: g.contractions ?? null });
  earCache.set(g.posPrior, { proclitics: g.proclitics, enclitics: g.enclitics, contractions: g.contractions ?? null, ear: built });
  return built;
}

function resolveGrammar({ language, grammar, ear, text }) {
  const earOf = (g) => (ear === false ? { segment: null, peel: null } : cachedEar(g));
  if (grammar) {
    if (!grammar.posPrior?.forms) return { mode: "gap", reason: "no_prior", detail: grammar.gap ?? "the injected grammar carries no POS prior" };
    return { mode: "fixed", language: grammar.language ?? language ?? null, grammar, ear: earOf(grammar) };
  }
  if (language) {
    const g = grammarFor(language, { text });
    if (!g.language || !g.posPrior?.forms) return { mode: "gap", reason: "no_prior", detail: g.gap ?? `no received prior for "${language}" — a typed gap, never another language's grammar` };
    return { mode: "fixed", language: g.language, grammar: g, ear: earOf(g) };
  }
  return { mode: "listen", earOf };
}

function read(text, { language = null, grammar = null, minShare = MIN_SHARE, ear = true } = {}) {
  const original = String(text ?? "");
  const gaps = makeGaps();
  const empty = (language_) => ({ candidates: [], units: [], gaps: gaps.list(), language: language_, languages: {}, regime: { sentences: 0, tokens: 0 } });
  const res = resolveGrammar({ language, grammar, ear, text: original });
  if (res.mode === "gap") { gaps.add(res.reason, res.detail); return empty(language ?? grammar?.language ?? null); }
  const listener = res.mode === "listen" ? createLanguageListener() : null;
  const H = heardText(original);
  const chunks = chunkSentences(H);
  const hearOf = (s) => {
    if (res.mode === "fixed") return { language: res.language, grammar: res.grammar, ear: res.ear };
    const h = listener.listen(H.slice(s.start, s.end));
    if (!h.language) return { language: null, gap: h.gap };
    return { language: h.language, grammar: h.grammar, ear: ear === false ? { segment: null, peel: null } : h.ear };
  };

  const candidates = [];
  const allUnits = [];
  const languages = {};
  let sentences = 0, tokens = 0;
  for (let ci = 0; ci < chunks.length; ci++) {
    let s = chunks[ci];
    let ctx = hearOf(s);
    // an abbreviation's full stop is not a sentence end: merge with what follows
    while (ctx.language && s.dotWord && !s.lastInLine && ci + 1 < chunks.length && isAbbreviation(ctx.grammar, s.dotWord)) {
      const nx = chunks[++ci];
      s = { start: s.start, end: nx.end, dotWord: nx.dotWord, lastInLine: nx.lastInLine };
      ctx = hearOf(s);
    }
    if (!ctx.language) { gaps.add("language_unheard", ctx.gap ?? "no prior clearly attests this sentence's words — the sentence is not read"); continue; }
    sentences += 1;
    languages[ctx.language] = (languages[ctx.language] ?? 0) + 1;
    const g = ctx.grammar;
    const raw = sentenceUnits(H, s, ctx.ear, gaps);
    const forms = g.posPrior.forms;
    const units = [];
    for (const u of raw) {
      if (u.kind === "word") { const t = trimQuotes(u, forms); if (t.kind === "word") units.push(...splitClitic(t, forms)); else units.push(t); } else units.push(u);
    }
    // judge every word occurrence
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (u.kind !== "word") continue;
      tokens += 1;
      if (u.hostOfClitic === "negation") { Object.assign(u, { arm: null, flagged: false, refused: "negated-aux-host", mass: null, propn: null, unseen: false, pathB: false, xOnly: false, basis: null }); u.si = sentences - 1; u.language = ctx.language; continue; }
      Object.assign(u, judge(u, units[i - 1] ?? null, units[i + 1] ?? null, g, minShare, gaps));
      u.si = sentences - 1; u.language = ctx.language;
    }
    allUnits.push(...units);

    // titles and initials: "dr." / "j." + a candidate
    const titleOf = (i) => {
      const u = units[i];
      if (u.kind !== "word") return null;
      const dot = units[i + 1], nx = units[i + 2];
      if (!dot || dot.text !== "." || dot.start !== u.end || !nx || nx.kind !== "word" || !nx.flagged) return null;
      if (/^\p{L}$/u.test(u.text)) return "initial";
      const c = forms[`${u.text}.`];
      return c && total(c) && (c.PROPN ?? 0) / total(c) >= minShare ? "title" : null;
    };
    const titleKind = new Map();
    for (let i = 0; i < units.length; i++) { const k = titleOf(i); if (k) titleKind.set(i, k); }

    // runs of adjacent members
    let run = null;
    const flush = () => {
      if (!run) return;
      const ws = run.members.map((i) => units[i]);
      const start = ws[0].start, end = ws[ws.length - 1].end;
      const evid = ws.map((w, k) => ({ text: w.text, start: w.start, end: w.end, basis: run.titles.has(run.members[k]) && !w.flagged ? run.titles.get(run.members[k]) : w.arm, mass: w.mass == null ? null : Number(w.mass.toFixed(4)), propn: w.propn == null ? null : Number(w.propn.toFixed(4)), unseen: Boolean(w.unseen) }));
      const masses = evid.filter((e) => e.mass != null).map((e) => e.mass);
      const lead = run.titles.size ? [...run.titles.values()][0] : null;
      candidates.push({
        surface: original.slice(start, end), start, end,
        basis: lead ? `${lead}+candidate` : evid.map((e) => e.basis).join("+"),
        standing: "nominated", lane: LANE,
        mass: masses.length ? Math.min(...masses) : null,
        unseen: evid.filter((e) => e.unseen).length,
        evidence: { language: ctx.language, sentence: sentences - 1, words: evid },
      });
      run = null;
    };
    let last = -1;
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      const member = u.kind === "word" && (u.flagged || titleKind.has(i));
      if (!member) continue;
      let join = false;
      if (run && last >= 0) {
        const between = units.slice(last + 1, i);
        if (between.length === 0) join = true;
        else if (between.length === 1 && between[0].text === "." && titleKind.has(last) && between[0].start === units[last].end) join = true;
        else if (between.length === 1 && between[0].text === "-" && between[0].start === units[last].end && between[0].end === u.start) join = true;
      }
      if (!join) { flush(); run = { members: [], titles: new Map() }; }
      run.members.push(i);
      if (titleKind.has(i)) run.titles.set(i, `${titleKind.get(i)}`);
      last = i;
    }
    flush();
  }
  const dominant = Object.entries(languages).sort((a, b) => b[1] - a[1])[0]?.[0] ?? (res.mode === "fixed" ? res.language : null);
  return { candidates, units: allUnits.filter((u) => u.kind === "word"), gaps: gaps.list(), language: dominant, languages, regime: { sentences, tokens } };
}

/**
 * nameCandidates(text, { language, grammar, minShare, ear }) →
 *   { candidates: [{ surface, start, end, basis, standing: "nominated", lane: "name-candidate", mass, unseen, evidence }],
 *     gaps: [{ reason, detail }], language, regime: { sentences, tokens } }
 *
 * `start`/`end` are offsets into the ORIGINAL `text` (the case-folding is length-preserving and
 * the ear's respacing is mapped back). `grammar` is `{ language, posPrior, framePrior, proclitics, enclitics }`
 * (the shape of the-fold/language-grammar.js grammarFor); with neither `language` nor `grammar` the
 * language is heard per sentence from the prefix by the language listener.
 */
export function nameCandidates(text, opts = {}) {
  const r = read(text, opts);
  return { candidates: r.candidates, gaps: r.gaps, language: r.language, regime: r.regime };
}

/**
 * nameUnits(text, opts) — the same read, but returning EVERY word unit with its judgement (arm,
 * mass, refusal, whether the prior attested it). For instruments (baselines, controls, curves);
 * `nameCandidates` is the product.
 */
export function nameUnits(text, opts = {}) {
  const r = read(text, opts);
  return { units: r.units, candidates: r.candidates, gaps: r.gaps, language: r.language, languages: r.languages, regime: r.regime };
}
