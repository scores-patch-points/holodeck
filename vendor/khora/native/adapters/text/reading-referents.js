// reading-referents.js — THE READ'S ENTITY IS A REFERENT; A SPAN IS ONLY ITS ADDRESS (ReadingReferents@1, 2026-10-27).
//
// The doctrine (the user's, quoted in the-fold/referents.js): "all of our assertions of what a word is — it's just that assertion,
// it's pointing to a referent; that is how we are able to deal with typos." The reader's index keeps a being as `ref:auto:<slug of the
// first-admitted spelling>`, so the id depends on which form was met first, two beings that share a core merge ("Mr." and "Mrs. Bennet"),
// and an edge relates two lowercased STRINGS. reading-timeline.js already states the design that is not wired to the read: a span is
// content-addressed, a referent is inserted ONCE and addressed by its event, a mention is bound to it by a CON a later event can
// supersede, a merge is a claim with a holder and a lens, and the state is the fold of the log at a cursor. This module projects the
// reader's OWN reading (its cast, heard rows, pronoun bindings and edges: no second reader, U1) onto that design. It is behind
// `readWith(text, { referents: true })` and absent otherwise: the plain index, `entry.cast` and every existing field are untouched, so
// the plain arm is the old index and a comparison is inside one read.
//
// WHAT THE CANON SAYS, AND WHERE IT LANDS HERE (the user's quotes file, 2026-10-27; page references are that file's)
//   · The object is X, the unity of a rule, and nothing we can point to (Kant AA IV 80-81, A 104-106). The address `ref_<hash>` has no
//     content of its own: it is the hash of an INS event (where the first bound mention stands, who gave it), never of a spelling.
//   · Numerical identity does not come from empirical data (AA IV 81, A 107). The data here are spellings and positions, so identity is
//     POSITED by an INS and bound to spans by CON, in that order, and is never computed from a spelling.
//   · Intuitions without concepts are blind, thoughts without content are empty (B 75). A mention with no referent is unbound and says so;
//     a referent with no bound span is refused (`referent_without_span`); an edge end that resolves carries its referent AND its span.
//   · The "I think" must be able to accompany every representation (B 131-132, B 137). A CON without a giver and a lens is refused.
//   · Same description is not same object (the Amphiboly, A 263 / B 319): "die Verschiedenheit der Örter ... zu gleicher Zeit" grounds
//     numerical difference (two drops of water). For a read that is ONE SENTENCE. Same core, different modifiers, co-present in one
//     sentence: two referents. In different sentences position proves nothing: one referent and a typed gap (undecided). And AA III 222:
//     the law of indiscernibles is "lediglich eine analytische Regel der Vergleichung der Dinge durch bloße Begriffe": token containment and a
//     shared `form:<token>` may nominate, they cannot decide.
//   · A word is a type, its instances are tokens (Peirce MS 675); the object causes the sign, not the reverse (CP 5.473); a name is a
//     SYMBOL (a habit, kept to a degree: CP 4.531), a pronoun an INDEX (connected by the discourse); there is no icon here. The spelling is the
//     representamen; the characters the sign carries of its object (a title before a name, a numeral after it) are its Immediate Object
//     (MS 793), which is why those two cues, and not a word list, are what the ledger reads. The referent claims no existence (MS 634:
//     "a supposedly real Object") and naming needs acquaintance outside the sign (MS 675): an INS from the text alone is a nomination, and
//     existence and cross-source identity are for a giver.
//
// WHAT IT DOES NOT DO (named, so that nothing reads as more than it is)
//   · An address is per SOURCE. A prefix read gives the same ids as the whole only under one `address`; without one the source is the hash of
//     the text. Cross-source identity stays an explicit CON of kind correspondence with a rung (weft.js, khora#82), never an address match.
//   · Ref equality is address equality, never identity: one being admitted twice carries two refs, and only an identity verdict (janus) can
//     say they are one. This module files its own judgments as a split (`referent_split`), an undecided (`referent_merge_unearned`) or an
//     unbound mention, never as a certainty; an INS is a nomination.
//   · Per-statement polarity is not in the plain edge (a merged edge keeps its first sentence's), so a regrouped edge carries
//     `polarity: null` and `polarityPlain`; this does not fix polarity.
//   · Typos are not handled (a graded claim would need a measured degree, and none is invented). Connector names ("Ludwig van Beethoven") and
//     coordination are not handled: telling "van" from "and" needs the parse or a giver. Digits after a name are not read as numerals.
//   · Not the atoms path (weft-atoms.js mints its own entities and is not reached by readDocument) and not the weft's cross-document identity.
//
// LANGUAGE AND MODALITY (the omnilingual/omnimodal check, 2026-10-27)
//   · The address and the log do not depend on a script: a span is `{ unit, at }` and its id hashes the unit, so a referent is anchored to its seed span whatever the unit.
//     Here every unit is "utf16" (the character offsets of the reader's own mentionSpans). An audio range, an image region or a video segment enters the same INS-mention
//     and CON events under its own unit ("ms", "bbox", ...) without changing a referent's id or the fold; no such reader exists in this repo yet, so none is built.
//   · The two structural cues (a title token of the read's abbreviation set before a name, a Roman numeral after it) read WHITESPACE-separated, CASED text. They are switched on only
//     when the text's letters are mostly cased (a count compared with a count, no constant); in a caseless or no-space script they do not fire, nothing is split, and the typed gap
//     `ledger_script_unread` says so. The reader's own mention search is word-bounded (read-core.mjs::mentionsOf), so in a no-space script the plain rows carry no spans and the ledger holds none.
//   · Reference with no span (zero anaphora, pro-drop), classifier-marked reference, and the honorific or evidentiality a language marks on a reference are not read: a CON needs a span to
//     bind, and such a reference would need one anchored to its predicate. They are the characters a sign carries of its object (MS 793), not handled here and not defaulted to English.

import { sha256hex } from "./sha256hex.js";
import { isRomanNumeral } from "./surfaces.js";

export const READING_REFERENTS_SCHEMA = "ReadingReferents@1";

// The two cells this module's events sit in, as reading-timeline.js names them (INS at Entity/Making, CON at Link/Binding). They are NOT imported: reading-timeline.js reaches
// kernel/reality-register.js, which imports node:fs and node:path, and the reader's import graph must stay free of node: (native/tests/reading-pipeline.test.js, "the core loads
// in a page"). The test file pins these two against reading-timeline.js's own CELLS, so a drift fails there.
const LEDGER_CELLS = Object.freeze({ INS: Object.freeze({ site: "Entity", stance: "Making" }), CON: Object.freeze({ site: "Link", stance: "Binding" }) });

const canon = (x) => JSON.stringify(x, (_k, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v));
const h16 = (x) => sha256hex(typeof x === "string" ? x : canon(x)).slice(0, 16);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const fold = (s) => String(s ?? "").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * A claim needs a holder (the giver) and a lens, as identity-src/src/referents.mjs::assertEdge requires; without either it is refused,
 * never defaulted. The same refusal guards every CON this module emits.
 * @returns {{ok: true} | {refused: true, reason: string}}
 */
export function assertClaim(ev) {
  if (!ev || typeof ev !== "object") return { refused: true, reason: "no event" };
  if (!ev.giver || !ev.lens) return { refused: true, reason: "a claim needs a giver (its holder) and a lens" };
  if (ev.op === "CON" && !ev.basis) return { refused: true, reason: "a binding needs its basis" };
  return { ok: true };
}

// a token of this read's own abbreviation set (the measured punctuation prior plus the text's own), as written without its period
const abbreviated = (token, set) => { const t = String(token ?? "").replace(/\.$/, ""); return !!t && !!set && (set.has(t) || set.has(t.toLowerCase())); };

/** the modifiers a name mention carries in its text: a title-like token of the abbreviation set before it, a Roman numeral after it */
function modifiersOf(str, a, b, abbrSet) {
  const mention = str.slice(a, b);
  const tokens = mention.split(/\s+/).filter(Boolean);
  let left = null, leftStart = a;
  // a title has two letters or more: ONE capital and a period is an initial ("James P. Cannon"), the given or middle name's, and says nothing of the bearer's rank
  const titleLike = (tok) => abbreviated(tok, abbrSet) && /^\p{Lu}/u.test(tok) && (tok.match(/\p{L}/gu) ?? []).length >= 2;
  if (tokens.length >= 2 && titleLike(tokens[0])) left = tokens[0].replace(/\.$/, "");
  else {
    const from = Math.max(0, a - 24), pre = /(?:^|[\s("“'‘])(\p{Lu}\p{L}*)\.?\s+(?:\p{Lu}\.\s+)*$/du.exec(str.slice(from, a));   // a title, then any initials, then the name ("Mr. P. Cannon")
    if (pre && titleLike(pre[1])) { left = pre[1]; leftStart = from + pre.indices[1][0]; }
  }
  let right = null, end = b;
  const post = str.slice(b, b + 16).match(/^\s+([IVXLCDM]+)(?![\p{L}\p{N}])(\.\s+\p{Lu})?/u);
  // a numeral enumerates the bearers of a name ("Henry IV", "Henry V"); a lone "I" is the pronoun, and "V. Smith" an initial
  if (post && !post[2] && post[1] !== "I" && isRomanNumeral(post[1])) { right = post[1]; end = b + post[0].trimEnd().length; }
  return { left, right, leftStart, end };
}

/**
 * Build the ledger over one read.
 * @param {object} o
 *   text         the caller's text; every offset below is a character offset into it (the entry's own unit for mentionSpans)
 *   source       the caller's address, else null (then the source is the hash of the text)
 *   cast, heard  the reader's rows: { ref, surface, allSurfaces, mentionSpans, standing }
 *   pronouns     the reader's bindings: { pronoun, at: [a, b], ref, surface }
 *   edges        the reader's edges: { end1, label, end2, polarity, spans: [{ ref, start, end, text }], assertion }
 *   sentences    the document's sentences: [{ offset, text }] (raw offsets)
 *   chunks, bases, norm, toRaw   the chunks the edges' spans are relative to, each chunk's place in the newline-normalised text, that text, and the map back to raw offsets
 *   abbreviations  this read's abbreviation set
 * @returns {{ ledger: object, gaps: object[] }}
 */
export function buildReferentLedger({ text, source = null, cast = [], heard = [], pronouns = [], edges = [], sentences = [], chunks = [], bases = [], norm = null, toRaw = (i) => i, abbreviations = null }) {
  const str = String(text ?? "");
  const sourceId = source ?? `src_${h16(str)}`;
  const gaps = [];
  const UNIT = "utf16";
  const spanId = (a, b, unit = UNIT) => `spn_${h16(`${sourceId}|${unit}|${a}|${b}`)}`;
  const log = [];
  const emit = (body) => {
    const ev = { id: `evt_${h16({ source: sourceId, ...body })}`, source: sourceId, ...body };
    if (body.op === "INS" && body.kind === "referent") ev.ref = `ref_${h16({ op: body.op, kind: body.kind, source: sourceId, seed: body.seed, giver: body.giver })}`;
    const verdict = body.op === "CON" || (body.op === "INS" && body.kind === "referent") ? assertClaim(ev) : { ok: true };
    if (verdict.refused) throw new TypeError(`reading-referents: ${verdict.reason}`);
    log.push(ev);
    return ev;
  };
  const sentenceAt = (pos) => { let lo = 0, hi = sentences.length - 1, best = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (sentences[m].offset <= pos) { best = m; lo = m + 1; } else hi = m - 1; } return best; };

  // ── 1. the mentions the reader's rows name, as spans (a trailing sentence period is no part of a mention unless the read's own set keeps it) ──
  const rows = [...cast.map((r) => ({ ...r, standing: r.standing ?? "referent" })), ...heard.map((r) => ({ ...r, standing: r.standing ?? "heard" }))];
  const cand = [];
  rows.forEach((row, ri) => {
    for (const [a0, b0] of row.mentionSpans ?? []) {
      let b = b0;
      if (b - a0 > 1 && str[b - 1] === "." && !abbreviated(str.slice(a0, b).split(/\s+/).pop(), abbreviations)) b -= 1;
      if (b > a0) cand.push({ a: a0, b, ri });
    }
  });
  // EVERY span the plain index claims is a mention (a name nested in a longer name is a mention of its own being, and two rows may claim crossing spans): the ledger projects the
  // reader's reading and does not drop what the reader found. Two rows claiming the very same span: the first row keeps it. The reading of an edge needs a set of spans that do not
  // overlap, so the OUTERMOST of them (a being's cast row before a heard row, then the longer, then the earlier) is kept apart for that.
  cand.sort((x, y) => x.a - y.a || (y.b - y.a) - (x.b - x.a) || x.ri - y.ri);
  const mentions = []; let overlaps = 0;
  for (const c of cand) { const last = mentions.at(-1); if (last && last.a === c.a && last.b === c.b) { if (last.ri !== c.ri) overlaps++; continue; } mentions.push(c); }
  const rank = (c) => (rows[c.ri].standing === "referent" ? 0 : 1);
  const adj = [], inAdj = new Set();   // adj: non-overlapping, sorted by start
  const clash = (c) => { let lo = 0, hi = adj.length - 1; while (lo <= hi) { const m = (lo + hi) >> 1; if (adj[m].b <= c.a) lo = m + 1; else if (adj[m].a >= c.b) hi = m - 1; else return adj[m]; } return null; };
  const slot = (c) => { let lo = 0, hi = adj.length; while (lo < hi) { const m = (lo + hi) >> 1; if (adj[m].a < c.a) lo = m + 1; else hi = m; } return lo; };
  for (const c of [...mentions].sort((x, y) => rank(x) - rank(y) || (y.b - y.a) - (x.b - x.a) || x.a - y.a)) {
    const w = clash(c);
    if (w) { if (w.ri !== c.ri) overlaps++; continue; }
    adj.splice(slot(c), 0, c); inAdj.add(c);
  }
  if (overlaps) gaps.push({ gap: "mention_overlap", count: overlaps, detail: "spans of different rows of the plain index overlap (one nested in the other, or crossing): every one is kept as a mention of its own referent, and the reading of an edge takes the outermost, a cast row before a heard row, then the longer" });
  // the cues read whitespace-separated, cased text: a count of cased letters against a count of caseless ones decides whether they are read at all
  const letters = str.match(/\p{L}/gu)?.length ?? 0, casedLetters = str.match(/[\p{Lu}\p{Ll}\p{Lt}]/gu)?.length ?? 0, caselessLetters = letters - casedLetters;
  const casedScript = casedLetters >= caselessLetters;
  if (!casedScript) gaps.push({ gap: "ledger_script_unread", cased: casedLetters, caseless: caselessLetters, detail: "most of the text's letters are in a script with no case: the reader's capital tier names few or no beings there and its mention search is word-bounded, so the ledger holds what the plain rows hold and the title and numeral cues are not read" });
  for (const m of mentions) Object.assign(m, casedScript ? modifiersOf(str, m.a, m.b, abbreviations) : { left: null, right: null, leftStart: m.a, end: m.b });

  // ── 2. split a row's mentions where the text around them says two bearers: a numeral, or two titles in one sentence ──
  const parts = [];   // one per referent to be inserted: { row, key, mentions }
  const unboundNames = [];   // mentions a split left between candidates
  const splitOf = new Map();   // plain ref -> { parts: [...], by }
  const byRow = new Map(); for (const m of mentions) (byRow.get(m.ri) ?? byRow.set(m.ri, []).get(m.ri)).push(m);
  rows.forEach((row, ri) => {
    const ms = byRow.get(ri) ?? [];
    if (!ms.length) {
      gaps.push({ gap: "referent_without_span", plain: row.ref, detail: "the plain index holds a being no span of the text could be bound to; it is not inserted (a referent with no span is empty)" });
      return;
    }
    const numerals = new Set(ms.map((m) => m.right).filter(Boolean));
    const titles = new Set(ms.map((m) => m.left).filter(Boolean));
    let by = null;
    if (numerals.size >= 2) by = "numeral";
    else if (titles.size >= 2) {
      const bySentence = new Map();
      for (const m of ms) if (m.left) { const s = sentenceAt(m.a); (bySentence.get(s) ?? bySentence.set(s, new Set()).get(s)).add(m.left); }
      if ([...bySentence.values()].some((set) => set.size >= 2)) by = "title";
      else gaps.push({ gap: "referent_merge_unearned", plain: row.ref, face: row.surface, modifiers: [...titles], detail: "the plain index merged these mentions on a shared core; they carry different titles and no sentence holds two of them, so position does not decide (Kant, A 263: different places at the same time) and no giver says whether the titles name one bearer" });
    }
    if (!by) { parts.push({ row, ri, key: "", mentions: ms }); return; }
    const keyOf = (m) => (by === "numeral" ? `${m.left ?? ""}|${m.right ?? ""}` : m.left ?? "");
    const groups = new Map(); const bare = [];
    for (const m of ms) { const k = keyOf(m); if (k === "" || k === "|") bare.push(m); else (groups.get(k) ?? groups.set(k, []).get(k)).push(m); }
    const made = [...groups].map(([key, gm]) => ({ row, ri, key, mentions: gm, splitBy: by }));
    parts.push(...made);
    splitOf.set(row.ref, { parts: made, by });
    for (const m of bare) unboundNames.push({ m, plain: row.ref });
  });

  // ── 3. INS of each referent once (its address is its event's hash), INS of each mention span, CON of each binding ──
  const referents = [], spans = new Map(), bound = [];   // bound: { a, b, ref, span, sign }
  const insSpan = (a, b, kind, text0) => {
    const id = spanId(a, b);
    if (!spans.has(id)) { spans.set(id, { id, unit: UNIT, at: [a, b], text: text0, kind }); emit({ op: "INS", ...LEDGER_CELLS.INS, kind: "mention", span: id, unit: UNIT, at: [a, b], text: text0, mentionKind: kind, giver: "reader" }); }
    return id;
  };
  const refOfPlain = new Map();   // plain ref -> ledger id (an unsplit row only)
  for (const p of parts) p.first = p.mentions.reduce((x, y) => (y.a < x.a ? y : x));
  parts.sort((x, y) => x.first.a - y.first.a);
  for (const p of parts) {
    const first = p.first;
    const seed = insSpan(first.a, first.b, "name", str.slice(first.a, first.b));
    const ins = emit({ op: "INS", ...LEDGER_CELLS.INS, kind: "referent", seed, giver: "reader/index", lens: "name-variant coreference over the reader's index", engine: p.row.ref, basis: "an INS made from the text alone: a nomination, no collateral acquaintance, no claim that it exists" });
    // the face is a view: the representative spelling of the plain index, or, for a split part, its first mention with the characters its sign carries
    const face = p.key ? str.slice(first.leftStart, first.end).replace(/\s+/g, " ").trim() : p.row.surface;
    const rec = { id: ins.ref, face, engine: p.row.ref, seed, standing: p.row.standing, forms: [], mentions: [], ...(p.splitBy ? { split: { from: p.row.ref, by: p.splitBy, key: p.key } } : {}) };
    referents.push(rec);
    if (!p.splitBy) refOfPlain.set(p.row.ref, ins.ref);
    for (const m of p.mentions) {
      const t = str.slice(m.a, m.b), span = insSpan(m.a, m.b, "name", t);
      const sameForm = fold(t) === fold(face) || fold(t) === fold(p.row.surface);
      emit({ op: "CON", ...LEDGER_CELLS.CON, span, ref: ins.ref, supersedes: null, giver: "reader/index", lens: "name-variant coreference over the reader's index", sign: "symbol", basis: sameForm ? "the same form as the referent's face" : "a form the reader's index clusters with the referent's face" });
      rec.mentions.push(span); bound.push({ a: m.a, b: m.b, ref: ins.ref, span, sign: "symbol", kind: "name", right: m.right ?? null, inAdj: inAdj.has(m) });
      const f = fold(t); if (f && !rec.forms.includes(f)) rec.forms.push(f);
    }
  }
  const claims = [];
  for (const r of referents) if (r.forms.length > 1) claims.push({ kind: "same", holder: "surfaces/discoverReferents", lens: "name-variant coreference", transitive: false, referent: r.id, among: [...r.forms], note: "the plain index's own claim that these forms are one being; non-transitive, so a reader never unions it into an id" });
  // the mentions a split left between candidates: unbound, with the candidates named
  const ambiguousNames = new Map();
  for (const { m, plain } of unboundNames) {
    const span = insSpan(m.a, m.b, "name", str.slice(m.a, m.b));
    emit({ op: "CON", ...LEDGER_CELLS.CON, span, ref: null, supersedes: null, giver: "reader/index", lens: "name-variant coreference over the reader's index", sign: "symbol", basis: "unbound: the reader's index clustered this form with more than one bearer of the name" });
    ambiguousNames.set(plain, (ambiguousNames.get(plain) ?? 0) + 1);
  }
  for (const [plain, sp] of splitOf) {
    const ids = sp.parts.map((x) => referents.find((r) => r.split?.from === plain && r.split.key === x.key)?.id).filter(Boolean);
    gaps.push({ gap: "referent_split", plain, by: sp.by, referents: ids, keys: sp.parts.map((x) => x.key), detail: sp.by === "numeral" ? "different Roman numerals on one core enumerate different bearers of a name; the plain index had merged them" : "two titles on one core stand in one sentence (different places at the same time, Kant A 263); the plain index had merged them. A structural cue filed as a split, not a certainty" });
    if (ambiguousNames.get(plain)) gaps.push({ gap: "mention_ambiguous", plain, count: ambiguousNames.get(plain), candidates: ids, detail: "bare mentions of a split core are bound to none of the candidates" });
  }

  const overlapsName = (a, b) => { let lo = 0, hi = adj.length - 1; while (lo <= hi) { const m = (lo + hi) >> 1; if (adj[m].b <= a) lo = m + 1; else if (adj[m].a >= b) hi = m - 1; else return true; } return false; };
  // ── 4. the pronoun bindings the reader made, bound as INDEX; a plain ref that was split makes the binding ambiguous ──
  const pronounAmbiguous = new Map();
  for (const p of pronouns) {
    const [a, b] = p.at ?? []; if (!(b > a)) continue;
    if (overlapsName(a, b)) continue;
    const span = insSpan(a, b, "pronoun", str.slice(a, b));
    const target = p.ref ? refOfPlain.get(p.ref) ?? null : null;
    if (target) {
      emit({ op: "CON", ...LEDGER_CELLS.CON, span, ref: target, supersedes: null, giver: "reader/pronouns", lens: "pronoun resolution over the reader's index", sign: "index", basis: "the pronoun resolver bound it to this being by recall of the discourse" });
      referents.find((r) => r.id === target).mentions.push(span); bound.push({ a, b, ref: target, span, sign: "index", kind: "pronoun" });
    } else {
      emit({ op: "CON", ...LEDGER_CELLS.CON, span, ref: null, supersedes: null, giver: "reader/pronouns", lens: "pronoun resolution over the reader's index", sign: "index", basis: p.ref ? "unbound: the being the resolver named was split into candidates" : "unbound: the resolver bound it to no being" });
      if (p.ref && splitOf.has(p.ref)) pronounAmbiguous.set(p.ref, (pronounAmbiguous.get(p.ref) ?? 0) + 1);
    }
  }
  for (const [plain, count] of pronounAmbiguous) gaps.push({ gap: "pronoun_ambiguous", plain, count, candidates: splitOf.get(plain).parts.map((x) => referents.find((r) => r.split?.from === plain && r.split.key === x.key)?.id).filter(Boolean), detail: "the pronoun resolver named a being the ledger split into candidates; the pronoun is bound to none" });
  bound.sort((x, y) => x.a - y.a);
  const adjBound = bound.filter((x) => x.inAdj !== false);   // the outermost, non-overlapping mentions: what an edge's ends are read against

  // ── 5. edges, per statement, between referents ──
  const GAP_TEXT = /^[\s,;:()"“”'’‘—–-]*$/u;
  const nearestBefore = (pos) => { let lo = 0, hi = adjBound.length - 1, best = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (adjBound[m].b <= pos) { best = m; lo = m + 1; } else hi = m - 1; } return best >= 0 && GAP_TEXT.test(str.slice(adjBound[best].b, pos)) ? adjBound[best] : null; };
  const nearestAfter = (pos) => { let lo = 0, hi = adjBound.length - 1, best = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (adjBound[m].a >= pos) { best = m; hi = m - 1; } else lo = m + 1; } return best >= 0 && GAP_TEXT.test(str.slice(pos, adjBound[best].a)) ? adjBound[best] : null; };
  const agrees = (endText, m, side) => {
    if (m.kind === "pronoun") return true;   // the end the extractor read was the pronoun's rewrite; the agreement is the binding's
    const e = fold(endText), mf = fold(str.slice(m.a, m.b));
    return !!mf && (e === mf || (side === "end1" ? e.endsWith(` ${mf}`) : e.startsWith(`${mf} `)));
  };
  const groups = new Map(); let unlocated = 0, unboundEnds = 0, selfLinks = 0;
  edges.forEach((e, ei) => {
    (e.spans ?? []).forEach((sp, si) => {
      const ci = chunks.findIndex((c) => c.ref === sp.ref);
      const n0 = ci >= 0 ? (bases[ci] ?? 0) + sp.start : -1;
      if (ci < 0 || !norm || norm.slice(n0, n0 + (sp.end - sp.start)) !== sp.text) { unlocated++; return; }
      const S0 = toRaw(n0), S1 = toRaw(n0 + (sp.end - sp.start)), win = str.slice(S0, S1);
      const label = String(e.label ?? "").trim();
      if (!label) { unlocated++; return; }
      const re = new RegExp(label.split(/\s+/).map(escapeRe).join("\\s+"), "giu");
      let hit = null;
      for (const mt of win.matchAll(re)) {
        const l = nearestBefore(S0 + mt.index), r = nearestAfter(S0 + mt.index + mt[0].length);
        if (l && r && l.a >= S0 && r.b <= S1) { hit = { l, r }; break; }
      }
      if (!hit) { unboundEnds++; return; }
      const { l, r } = hit;
      // a merged edge carries the end strings of its FIRST statement only (the plain reader folds the others in by a shared form), so the strings check the first statement; the others are read from their own sentence
      if (si === 0 && (!agrees(e.end1, l, "end1") || !agrees(e.end2, r, "end2"))) { unboundEnds++; return; }
      if (l.ref === r.ref && (l.kind === "pronoun" || r.kind === "pronoun")) { selfLinks++; gaps.push({ gap: "edge_self_link_by_rewrite", edge: ei, ref: l.ref, at: [S0, S1], detail: "both ends of this statement bind to one referent and one end is a pronoun: the pronoun pass rewrote the sentence to its antecedent's name before the edge was read, so the second end is the subject restated (\"his sister\" became the subject's name). Not an edge." }); return; }
      // a numeral the plain extractor left at the head of the label belongs to the end it follows ("Henry IV ruled in" is Henry IV, ruled in)
      let lbl = fold(label);
      if (l.right && lbl.startsWith(`${fold(l.right)} `)) lbl = lbl.slice(fold(l.right).length + 1);
      const key = `${l.ref}|${lbl}|${r.ref}`;
      const g = groups.get(key) ?? groups.set(key, { key, ends: [l, r], label: lbl, statements: new Map(), plain: new Set(), polarities: [], single: true }).get(key);
      g.statements.set(S0, { at: [S0, S1], sentence: sentenceAt(S0) });
      g.plain.add(ei);
      if ((e.spans ?? []).length > 1) g.single = false;
      g.polarities.push(e.polarity ?? null);
    });
  });
  const ledgerEdges = [...groups.values()].map((g) => {
    const pols = [...new Set(g.polarities)];
    const agreed = g.single && pols.length === 1 ? pols[0] : null;
    const st = [...g.statements.values()].sort((x, y) => x.at[0] - y.at[0]);
    return { id: `edg_${h16(g.key)}`, ends: g.ends.map((m) => ({ ref: m.ref, span: m.span, via: m.kind === "pronoun" ? "pronoun" : "name" })), label: g.label, statements: st, standing: st.length >= 2 ? "corroborated" : "single-witness", polarity: agreed, ...(agreed === null ? { polarityPlain: pols } : {}), plain: [...g.plain] };
  }).sort((x, y) => x.statements[0].at[0] - y.statements[0].at[0] || (x.id < y.id ? -1 : 1));
  if (unlocated) gaps.push({ gap: "edge_statement_unlocated", count: unlocated, detail: "statements of the plain edges whose sentence could not be placed in the text (the span's coordinates or text did not check out); they are not in the ledger's edges" });
  if (unboundEnds) gaps.push({ gap: "edge_ends_unbound", count: unboundEnds, detail: "statements of the plain edges with an end that is no bound mention next to the label (a common noun, a coordination, an end the adjacent mention does not agree with); they are not in the ledger's edges, and nothing here says they are not relations" });

  return {
    ledger: { schema: READING_REFERENTS_SCHEMA, source: sourceId, spans: [...spans.values()], referents, log, edges: ledgerEdges, claims, unbound: { names: unboundNames.length, edgeStatements: unboundEnds + unlocated + selfLinks } },
    gaps,
  };
}
