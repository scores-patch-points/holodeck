// holodeck-contradiction.js — when two sources state the same referent two ways.
//
// The operator's ask, near-verbatim: to be able to say "these two sources are
// contradicting each other", and to have the IDENTITY ASSERTION of the two
// values really make sense, and be RELATIVE TO THE OBSERVER.
//
// THE SEAM. The surface already detects disagreement and already owns an
// identity law, and the two had never been joined. `holodeck-relations.js`'s
// `verdictOf` compares value tokens across statements and calls it `differs`
// when two statements share a value KEY — the unit string ("dollars", "saved").
// That is identity by appearance, the move FOLD-CONSTITUTION II.7 refuses:
// "Two records are the same iff they make the same difference — never by
// appearance… String distance, phonetic keys, and embedding similarity may
// NOMINATE a merge; none may decide one." The unit string may nominate; it may
// not decide. This module makes the decision the identity law's, read for-whom.
//
// THE MODEL, in two questions that are never conflated:
//   · REFERENT IDENTITY — are "711" and "705" both *the number of lives saved*?
//     That is what makes them comparable at all. It is decided FOR-WHOM: the
//     observer's question is what constitutes the referent (S113), and it
//     survives the MEET over admissible for-whoms (identity-meet.js).
//   · VALUE AGREEMENT — do "711" and "705" agree? That is the contradiction.
// A contradiction is IDENTITY-HOLD + VALUE-SPLIT.
//
// WHERE THE REFERENT COMES FROM (the holograph, never a span — 2026-10-16). The first build read a figure's
// referent off the words around it: the observer's question terms were matched against a window of prose. That is
// identity by appearance, and it fails exactly as II.7 says it must. Measured on the Titanic corpus, the question
// "what did the band play as the ship sank?" folded the ship's engine revolutions (60, 70, 75, 78, 165) into one
// referent — the span "ship" — and called them a contradiction; "how many lives were lost?" matched nothing and
// found no contradiction at all. The span "ship" means many things in context ("the ship", "13 ships", "a ship of
// the desert"), so a word cannot be the referent. The referent is the HOLOGRAPH'S: the BEING the source's own
// reading admitted (`anchor` — a canonical referent the source's own evidence folded the surfaces into) and the
// MEASURE the figure stands under (`measure`/`referent`). The holograph's own MEASURE TOPICS are already the
// discrepancy register: on the same corpus they yield exactly one shared figure-slot with a difference,
// "R.M.S. Titanic · tonnage" — 46,328 vs 45,328 vs 60,000 tons, for-whom R.M.S. Titanic. That is a contradiction;
// the revolutions are not, because "ship" is not a referent. `contradictionForTopic` reads that shape.
//
// THE THREE OUTCOMES (II.7 — "three outcomes, not two"):
//   · same     — the frame holds the two values one referent, and the values differ → a contradiction.
//   · distinct — the frame refuses the identity (a different referent for this question) → disclosed, never a contradiction.
//   · unstable — the frame's question does not touch the pair at all → the honest middle, neither joined nor divided.
//
// WHAT IS COMPOSED, NEVER RE-DERIVED (the vendored law):
//   · kernel/for-whom.js       — createForWhom / questionTerms: the observer's frame and its content terms.
//   · kernel/identity.js       — identityAlternative (the NOMINATION) and deriveIdentityRevisionForWhom (support opens,
//                                attack is constitutive contradiction: SEG splits, DEF refuses).
//   · kernel/identity-meet.js  — survivingIdentity (form level) and survivingIdentityAtPoints (referent level): the meet.
//   · organs/asserted.js       — standingOf / WITNESS_FLOOR: the recurrence floor, never a tuned threshold.
//
// PURE: no DOM, no network, no clock, no model. Same values + same frame ⇒ same record.
//
// Provenance: docs/SOURCE-CONTRADICTION-PREREG.md (predictions registered before this file existed).

import { createForWhom, questionTerms } from './vendor/eoreader7/native/kernel/for-whom.js';
import { identityAlternative } from './vendor/eoreader7/native/kernel/identity.js';
import { survivingIdentity, survivingIdentityAtPoints } from './vendor/eoreader7/native/kernel/identity-meet.js';
import { standingOf, WITNESS_FLOOR } from './vendor/eoreader7/native/organs/asserted.js';

export const SCHEMA = 'HolodeckContradiction@1';
export const MEET_SCHEMA = 'EOIdentityMeet@1';
export const GAP = 'EOContradictionGap@1';
export const VERDICTS = Object.freeze(['same', 'distinct', 'unstable']);

// The words a question uses to ask, not to name: a referent is named by the question's content terms.
const INTERROGATIVE = new Set([
  'how', 'many', 'much', 'what', 'when', 'where', 'who', 'whom', 'whose', 'which', 'why',
  'did', 'do', 'does', 'was', 'were', 'is', 'are', 'be', 'been', 'being', 'has', 'have', 'had',
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'by', 'for', 'from', 'with', 'about',
  'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them', 'their', 'he', 'she', 'his', 'her',
  'there', 'here', 'total', 'number', 'figure', 'value', 'count', 'much',
]);

const norm = (x) => String(x ?? '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const clip = (t, n) => { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; };

/** The observer's frame. The question is required (a for-whom reads FOR something, never from nowhere); the
 *  giver is the person whose authority the reading stands under, and it is never silently defaulted past them. */
export function observerFrame(question, { id = null, giver = 'the reader', ground = null, priors = [], universe = [], medium = 'text' } = {}) {
  if (!question || !String(question).trim()) throw new TypeError('observerFrame: a question is required — the observer\'s question is what constitutes the referent');
  return createForWhom({ id: id || 'q:' + norm(question).slice(0, 40), giver, question: String(question).trim(), ground, priors, universe, medium });
}

/** The referent vocabulary a frame asks with: the surface forms its question's referent may take, each mapped to
 *  a canonical key. `synonyms` maps a canonical key to the surface forms the sources may use for it
 *  ("saved" → ["rescued"]); synonymy is MODEL-tier witness knowledge, so it is INJECTED by the caller (a prior,
 *  with a giver) and never derived here (the nameless-referent principle: descriptor coref and synonymy are
 *  injected per-text priors). A synonym entry counts only when it answers the question; a question term with no
 *  entry is its own key. A missing prior is a typed gap, never a silently wrong fold.
 *
 *  ORDER MATTERS: the declared referent forms come FIRST, so a value carrying the question's distinguishing word
 *  ("saved", "rescued") reads as the referent the question asks, not as the generic noun it shares with another
 *  question ("lives"). The generic term is a fallback key, and a value that only reaches it is a DIFFERENT
 *  referent — which is exactly how "lives lost" is kept out of "lives saved". */
export function referentVocabulary(forWhom, synonyms = {}) {
  const base = questionTerms(forWhom.question).filter((t) => !INTERROGATIVE.has(t));
  const q = new Set(base);
  const canon = new Map(); const vocab = [];
  const add = (k, forms) => { const key = norm(k); if (canon.has(key) && canon.get(key) === key && vocab.includes(key)) return; canon.set(key, key); vocab.push(key); for (const f of forms) { const n = norm(f); if (!n) continue; canon.set(n, key); vocab.push(n); } };
  for (const [key, forms] of Object.entries(synonyms || {})) {
    const k = norm(key); const list = (forms || []).map(norm).filter(Boolean);
    if (![k, ...list].some((f) => q.has(f))) continue;   // the referent must answer THIS question
    add(k, list);
  }
  for (const t of base) if (!canon.has(t)) { canon.set(t, t); vocab.push(t); }
  return { base, canon, vocab: [...new Set(vocab)] };
}

/** The referent a value answers, for a frame. The referent is the HOLOGRAPH'S, never a span:
 *  the BEING the source's own reading admitted (`anchor` — a canonical referent, the one the source's own evidence
 *  folded the surfaces into) and the MEASURE the figure stands under (`referent`/`measure`). A word read off the
 *  prose cannot decide identity, because a span means many things in context — "the ship" and "13 ships" and "a
 *  ship of the desert" are not one referent, and "saved" is not "lost" because both sit near a number. So a value
 *  that declares NEITHER an anchor NOR a measure answers no referent this frame asks about: a typed gap, never a
 *  window guess. (The window is carried on the record for the reader to see, but it never decides identity.)
 *
 *  The observer's question SELECTS the referent: the first of the question's terms the declared MEASURE carries
 *  names what the figure measures; failing that, the first term the ANCHOR carries names the being the question
 *  asks about. The key qualifies the measure with the being, so two values about DIFFERENT beings never fold onto
 *  one referent even where the measure word agrees. */
export function referentOf(value, voc) {
  const anchorNorm = norm(value.anchor);
  const anchorName = String(value.anchor || '').trim();
  const measure = norm([value.referent, value.measure].filter(Boolean).join(' '));
  if (!anchorNorm && !measure) return null;
  const key = (t) => { const c = voc.canon.get(t) || t; return anchorName ? c + '\u0001' + anchorName : c; };
  for (const t of voc.vocab) if (measure.includes(t)) return key(t);
  for (const t of voc.vocab) if (anchorNorm.includes(t)) return key(t);
  return null;
}

// ── the POINT: the referent the whole record carries each form on, read frame-INDEPENDENTLY ────────────────────
// identity-meet.js's two levels: the FORM (a frame's own naming — "saved"/"rescued") and the POINT (the referent
// the record carries a form on — the being+measure). The being is INVARIANT; only the identification is relative
// (identity-at-a-point.md). So the point is read from the value's DECLARED measure canonicalised through the
// injected synonym prior — a prior names a form; it never depends on which observer is asking — and each frame's
// question then only decides whether that frame SPEAKS about the point. A point carries no frame, so every frame
// meets on the same points: the being, not the spelling.
function canonIndexOf(synonyms) {
  const canon = new Map(); const groups = [];
  for (const [key, forms] of Object.entries(synonyms || {})) {
    const k = norm(key); if (!k) continue;
    const list = [...new Set([k, ...(forms || []).map(norm)].filter(Boolean))];
    for (const f of list) canon.set(f, k);
    groups.push([k, list]);
  }
  return { canon, groups };
}
/** pointOfValue(value, canon) — the referent point a value is carried on: its declared MEASURE, canonicalised
 *  through the injected synonym prior, qualified by the BEING (`anchor`). No declared measure ⇒ no point (the
 *  value answers no referent this record can carry it on) — a typed gap, never the spelling. Frame-independent. */
function pointOfValue(value, canon) {
  const anchorName = String(value.anchor || '').trim();
  const text = norm([value.referent, value.measure].filter(Boolean).join(' '));
  if (!text) return null;
  let term = null;
  for (const [k, forms] of canon.groups) { if (forms.some((f) => f && text.includes(f))) { term = k; break; } }
  if (!term) term = text;
  return anchorName ? term + '\u0001' + anchorName : term;
}

// ── the frame's entries: every value as an edge the identity law can read at a point ──────────────────────────
// The participants carry the value's FORM (the raw string) and its REF — the frame-INDEPENDENT point above — so
// the meet at the point level translates a frame's reading of the forms onto the referent the record carries them
// on: the being, not the spelling (identity-meet.js's own two levels).
function entryFor(value, referentKey) {
  const s = Number.isFinite(value.s) ? value.s : 0;
  return Object.freeze({
    schema: 'EOHyperedge@1',
    id: 'value:' + (value.id != null ? value.id : value.doc + ':' + s),
    witness: String(value.doc),
    // the ENCOUNTER is the source's own reading (the witness), not each value's byte offset: the identity's
    // coherence is measured over the sources that state the values, so a topic many sources state is a real
    // trajectory, and one source's many values are one encounter (not a flat run the gate must refuse).
    scope: Object.freeze({ sourceRef: String(value.doc) }),
    relation: value.unit || null,
    referent: referentKey,
    participants: Object.freeze([
      Object.freeze({ surface: String(value.raw), ref: referentKey }),
      Object.freeze({ surface: referentKey, ref: referentKey }),
    ]),
  });
}

// The unit string's nomination (II.7): pairs in the same unit group with different values are proposed as
// alternatives. This is the appearance step — it opens the question, it never answers it. Deduplicated by the
// forms' own key, so a value stated twice in two sources is one candidate, not two.
function nominatedAlternatives(values, giver) {
  const out = []; const seen = new Set();
  for (let i = 0; i < values.length; i++) for (let j = i + 1; j < values.length; j++) {
    const a = values[i], b = values[j];
    if (norm(a.raw) === norm(b.raw)) continue;
    const k = [norm(a.raw), norm(b.raw)].sort().join('\u0000');
    if (seen.has(k)) continue; seen.add(k);
    try { out.push(identityAlternative({ left: String(a.raw), right: String(b.raw), giver: giver || 'the unit string' })); }
    catch (e) { /* two forms the law refuses as distinct — not a candidate */ }
  }
  return out;
}

// The frame's reading of each nominated pair: support when both answer the question, attack when only one does.
// A pair neither answers is left OUT of the frame's relation — the frame has no opinion, which is `unstable`.
function frameEvidence(nominated, refOf, frameName) {
  const supports = [], attacks = [];
  for (const alt of nominated) {
    const ka = refOf(alt.left), kb = refOf(alt.right);
    const witness = 'nomination:' + alt.left + '|' + alt.right;
    if (ka && kb && ka === kb) supports.push({ left: alt.left, right: alt.right, witness, giver: frameName });
    else if (ka && kb && ka !== kb) attacks.push({ left: alt.left, right: alt.right, witness, reason: 'different referents for this question: “' + ka + '” against “' + kb + '”', giver: frameName });
    else if (ka || kb) attacks.push({ left: alt.left, right: alt.right, witness, reason: 'only one answers this question, so the other names a different referent', giver: frameName });
  }
  return { supports, attacks };
}

// The point keys the meet carries a form on contain the referent's own control character (measure\u0001being), so
// they are compared by their normalised halves — the same normalisation identity-meet applies to a form's spelling.
const keyNorm = (k) => String(k).split('\u0000').map(norm).sort().join('\u0000');
const keySetOf = (list) => new Set((list || []).map(keyNorm));
const inKeySet = (set, a, b) => set.has([norm(a), norm(b)].sort().join('\u0000'));

/**
 * contradictionsOf(values, { forWhom, synonyms, frames }) — the contradiction records for a set of value
 * statements read by an observer's question.
 *
 * `values`: [{ id, doc, s, e, raw, value, unit, year?, text, window?, referent?, ofYear? }] — every value the
 * caller has, of any unit. The module groups by unit itself (the unit string is what nominates; it never decides).
 * `forWhom`: the observer's frame (observerFrame(...)) or a question string. Required — a frameless read is refused.
 * `synonyms`: { canonicalKey: [surfaceForm, …] } — an injected prior, named by its giver.
 * `frames`: additional questions/for-whoms to meet against (the falsifier: a second observer over the same values).
 *
 * @returns { schema, forWhom, vocabulary, referents, contradictions, refusals, unstable, meet, gaps }
 */
export function contradictionsOf(values = [], { forWhom = null, synonyms = {}, frames = [] } = {}) {
  const obs = typeof forWhom === 'string' ? observerFrame(forWhom) : forWhom;
  if (!obs || !obs.id) {
    return Object.freeze({
      schema: SCHEMA, forWhom: null, vocabulary: [], referents: [], contradictions: [], refusals: [], unstable: [],
      meet: { schema: MEET_SCHEMA, forms: null, points: null }, gaps: [Object.freeze({ schema: GAP, kind: 'frameless', why: 'a contradiction is an identity assertion, and identity exists only for-whom (S113) — with no observer\'s question there is nothing to assert' })],
    });
  }
  const voc = referentVocabulary(obs, synonyms);
  const canon = canonIndexOf(synonyms);   // the frame-independent canon: the point every frame meets on
  const vals = (values || []).filter((v) => v && v.doc != null && isFinite(+v.value) && v.raw != null && String(v.raw).trim());

  // ── group by unit (the nomination axis), then by referent (the frame's decision axis) ────────────────────────
  const byUnit = new Map();
  for (const v of vals) { const u = String(v.unit || '?'); (byUnit.get(u) || byUnit.set(u, []).get(u)).push(v); }

  const gaps = [];
  const referents = new Map();   // referentKey -> { values: Map(raw -> {value, docs:Set, at:[]}) }
  const offReferent = [];
  for (const v of vals) {
    const key = referentOf(v, voc);
    if (!key) { offReferent.push(v); continue; }
    const r = referents.get(key) || referents.set(key, { referent: key, values: new Map() }).get(key);
    const rk = norm(v.raw);
    const x = r.values.get(rk) || r.values.set(rk, { raw: String(v.raw), value: +v.value, docs: new Set(), at: [], point: pointOfValue(v, canon) || norm(v.raw) }).get(rk);
    x.docs.add(String(v.doc));
    if (x.at.length < 20) x.at.push(Object.freeze({ doc: String(v.doc), s: v.s, e: v.e, raw: String(v.raw), year: v.year != null ? +v.year : null }));
  }

  // ── the meet over the frames (the observer's own reading is the first) ──────────────────────────────────────
  const frameList = [obs, ...(frames || []).map((f) => (typeof f === 'string' ? observerFrame(f) : f))].filter((f) => f && f.id);
  const reads = [];
  for (const fr of frameList) {
    const fvoc = fr.id === obs.id ? voc : referentVocabulary(fr, synonyms);
    const refOf = (form) => {
      const hit = vals.find((v) => norm(v.raw) === norm(form));
      return hit ? referentOf(hit, fvoc) : null;
    };
    const nominated = [];
    for (const group of byUnit.values()) for (const alt of nominatedAlternatives(group, 'the unit string')) nominated.push(alt);
    // the entries carry the frame-INDEPENDENT point, so the point meet is the being every frame shares; the frame's
    // supports/attacks (below) are its own reading of the forms — the being is invariant, only the reading is relative.
    const entries = vals.map((v) => entryFor(v, pointOfValue(v, canon) || 'unknown')).filter((e) => e.referent !== 'unknown');
    const { supports, attacks } = frameEvidence(nominated, refOf, fr.id);
    reads.push({ forWhom: fr, ctx: { fold: { graphEntries: entries, unresolvedAlternatives: nominated }, supports, attacks } });
  }
  let forms = null, points = null;
  try { forms = survivingIdentity(reads); } catch (e) { forms = null; }
  try { points = survivingIdentityAtPoints(reads); } catch (e) { points = null; }
  // THE GRAIN (docs/SOURCE-CONTRADICTION-PREREG.md's one open seam): the identity the record ASSERTS is read at the
  // POINT level — the being the record carries the forms on, not the spelling — so a pair survives iff some
  // admissible frame holds its POINTS and none splits them. The form-level meet is kept beside it, because the
  // nomination and the disclosed refusals are the frames' own namings (their forms). Falls back to the form grain
  // when the point meet is unavailable (a typed gap, never a silent wrong grain).
  const survivors = forms ? forms.survivors : [];   // the frames' own namings (the forms)
  const splits = forms ? forms.splits : [];
  const pSurvivors = points ? points.survivors : survivors;   // the being the record carries the forms on
  const pSplits = points ? points.splits : splits;
  const pSurvSet = keySetOf(pSurvivors), pSplitSet = keySetOf(pSplits);
  const identityGrain = points ? 'point' : 'form';

  // ── the record: per referent, the values in parallel; a contradiction only where identity held and values split ─
  const outReferents = [];
  const contradictions = [];
  const refusals = [];
  const unstable = [];
  for (const r of [...referents.values()].sort((a, b) => b.values.size - a.values.size || (a.referent < b.referent ? -1 : 1))) {
    const valueRows = [...r.values.values()].map((x) => ({
      raw: x.raw, value: x.value, sources: [...x.docs].sort(),
      statements: x.docs.size, standing: standingOf(x.docs.size), point: x.point,
      at: x.at.slice().sort((a, b) => (a.doc < b.doc ? -1 : a.doc > b.doc ? 1 : (a.s - b.s))),
    })).sort((a, b) => b.sources.length - a.sources.length || a.value - b.value);
    const pairCount = valueRows.length < 2 ? 0 : valueRows.length * (valueRows.length - 1) / 2;
    // the pairs the meet held at the IDENTITY GRAIN, whose values differ: the contradiction.
    const heldPairs = [];
    for (let i = 0; i < valueRows.length; i++) for (let j = i + 1; j < valueRows.length; j++) {
      const a = valueRows[i], b = valueRows[j];
      if (inKeySet(pSurvSet, a.point, b.point)) heldPairs.push([a, b]);
    }
    const refPairs = [];
    for (let i = 0; i < valueRows.length; i++) for (let j = i + 1; j < valueRows.length; j++) if (inKeySet(pSplitSet, valueRows[i].point, valueRows[j].point)) refPairs.push([valueRows[i], valueRows[j]]);
    // the contradiction's support: how many independent source-pairs exhibit the split (the recurrence floor).
    let statements = 0;
    for (const [a, b] of heldPairs) statements += a.sources.length * b.sources.length;
    const record = {
      referent: r.referent,
      values: valueRows,
      pairs: pairCount,
      holds: heldPairs.length > 0,
      differs: heldPairs.length > 0,
      standing: heldPairs.length ? standingOf(statements) : null,
      statements,
      pairs_held: heldPairs.map(([a, b]) => [a.raw, b.raw]),
    };
    outReferents.push(record);
    if (heldPairs.length) contradictions.push(record);
    for (const [a, b] of refPairs) refusals.push(Object.freeze({ pair: [a.raw, b.raw], referent: r.referent, why: 'the observer\'s question refuses the identity the unit string nominated', at: [...a.at.slice(0, 1), ...b.at.slice(0, 1)] }));
    if (valueRows.length >= 2 && !heldPairs.length && !refPairs.length) unstable.push(Object.freeze({ referent: r.referent, values: valueRows.map((v) => v.raw), why: 'the observer\'s question does not touch this pair — neither joined nor divided' }));
  }
  // the meet's own splits: pairs a frame divides (the unit string nominated them; this frame refuses them).
  const seenPair = new Set();
  for (const key of (forms ? forms.splits : [])) {
    const parts = String(key).split('\u0000');
    if (parts.length !== 2) continue;
    const k = parts.slice().sort().join('\u0000');
    if (seenPair.has(k)) continue; seenPair.add(k);
    if (refusals.some((rr) => [rr.pair[0], rr.pair[1]].map(norm).sort().join('\u0000') === k)) continue;
    refusals.push(Object.freeze({ pair: parts, referent: null, why: 'the meet splits these forms — one frame joins what another divides (a for-whom-local reading)', at: [] }));
  }
  // the pair the frame has no opinion on: nominated by the unit, touched by no frame's question.
  const touched = new Set([...survivors, ...splits]);
  for (const group of byUnit.values()) for (const alt of nominatedAlternatives(group, 'the unit string')) {
    const k = [alt.left, alt.right].sort().join('\u0000');
    if (!touched.has(k)) unstable.push(Object.freeze({ referent: null, values: [alt.left, alt.right], why: 'nominated by the unit string, and no frame\'s question joins or divides them — the honest middle (II.7)' }));
  }

  // ── typed gaps (never a silently wrong number) ──────────────────────────────────────────────────────────────
  const seenUnstable = new Set();
  const unstableU = unstable.filter((u) => { const k = (u.values || []).map(norm).sort().join('\u0000') + '|' + (u.referent || ''); if (seenUnstable.has(k)) return false; seenUnstable.add(k); return true; });
  for (const v of offReferent) gaps.push(Object.freeze({ schema: GAP, kind: 'off-referent', raw: String(v.raw), doc: String(v.doc), s: v.s, e: v.e, why: 'the value answers none of the observer\'s question terms, so it is a different referent — not a contradiction' }));
  for (const v of vals) {
    if (v.ofYear != null && v.year != null && +v.year < +v.ofYear) gaps.push(Object.freeze({ schema: GAP, kind: 'anachronism', raw: String(v.raw), doc: String(v.doc), s: v.s, e: v.e, why: 'a source of ' + v.year + ' cannot know a fact of ' + v.ofYear + ' — a typed gap, never an assertion' }));
  }
  const docs = new Set(vals.map((v) => String(v.doc)));
  if (docs.size < 2 && vals.length) gaps.push(Object.freeze({ schema: GAP, kind: 'single-source', why: 'one source: two sources contradicting each other cannot be measured' }));

  return Object.freeze({
    schema: SCHEMA,
    forWhom: Object.freeze({ id: obs.id, giver: obs.giver, question: obs.question, referent: voc.base.join(' ') || null, vocabulary: Object.freeze(voc.vocab) }),
    vocabulary: voc,
    referents: outReferents,
    contradictions,
    refusals: Object.freeze(refusals),
    unstable: Object.freeze(unstableU),
    meet: Object.freeze({ schema: MEET_SCHEMA, forms, points }),
    identityGrain,
    gaps: Object.freeze(gaps),
    floor: WITNESS_FLOOR,
  });
}

/** contradictionForField(fieldRow, { forWhom, synonyms, frames }) — the adapter the terrain's field register uses.
 *  A field row is the shape holodeck-research-terrain.js already builds: { unit, values: [{ raw, value, sources, at }] }.
 *  Each value carries its byte-addressed `at`; the observer's question decides the referents. The referent is only
 *  the holograph's (a declared `anchor` being and/or a declared `measure`); the unit string nominates, it never
 *  decides, and a value carrying no declared referent is a typed gap. */
export function contradictionForField(fieldRow, opts = {}) {
  const values = [];
  for (const v of (fieldRow && fieldRow.values) || []) {
    const ats = (v.at && v.at.length) ? v.at : [{ doc: (v.sources && v.sources[0]) || '?', s: v.s, e: v.e }];
    for (const at of ats) {
      values.push({
        id: (at.doc || '?') + ':' + (at.s != null ? at.s : 0) + ':' + v.raw,
        doc: at.doc || (v.sources && v.sources[0]) || '?',
        s: at.s, e: at.e, raw: v.raw, value: v.value, unit: fieldRow.unit,
        year: at.year != null ? at.year : (v.year != null ? v.year : null),
        text: at.text || v.text || v.raw,
        anchor: v.anchor != null ? v.anchor : (at.anchor != null ? at.anchor : (fieldRow.anchor != null ? fieldRow.anchor : null)),
        referent: v.referent != null ? v.referent : (at.referent != null ? at.referent : null),
        measure: v.measure != null ? v.measure : (at.measure != null ? at.measure : (fieldRow.measure != null ? fieldRow.measure : null)),
        window: v.window || at.window || at.text || null,
      });
    }
  }
  return contradictionsOf(values, opts);
}

/** contradictionForTopic(topic, { forWhom, synonyms, frames }) — the adapter the holograph's own MEASURE topics
 *  use, so the contradiction rides the element the sources SHARE rather than a unit string.
 *
 *  A measure topic (holoTopics' kind 'measure') is the holograph's own statement that ≥2 sources carry one
 *  figure-slot FOR ONE BEING: { label, forWhom: [being], tuple: { anchor, measure, unit }, findings: [{ text,
 *  sources, at }], docs, n, differs }. The topic's for-whom IS the being (the admitted referent) and the tuple's
 *  measure IS what the figure measures — so the referent is the holograph's, never a span, and the identity is
 *  decided for-whom and survived by the meet as always. Two values of one topic are the same referent by
 *  construction; `differs` (≥2 values) is what makes them a contradiction.
 *
 *  A topic with no for-whom is refused (a measure of nobody is not a referent this can assert about), and a value
 *  the topic carries without a source is a typed gap, not a silent one. */
export function contradictionForTopic(topic, opts = {}) {
  const anchor = (topic && topic.tuple && topic.tuple.anchor) || (topic && (topic.forWhom || [])[0]) || null;
  const measure = (topic && topic.tuple && (topic.tuple.measure || topic.tuple.unit)) || (topic && topic.unit) || null;
  const unit = (topic && topic.tuple && topic.tuple.unit) || (topic && topic.unit) || '';
  const values = [];
  for (const f of (topic && topic.findings) || []) {
    const ats = (f.at && f.at.length) ? f.at : [{ doc: f.doc || (topic.docs && topic.docs[0] && topic.docs[0].id) || '?', s: f.s, e: f.e }];
    const m = /(-?\d[\d,]*(?:\.\d+)?)/.exec(String(f.text || ''));
    const value = Number.isFinite(f.value) ? f.value : (m ? +m[1].replace(/,/g, '') : NaN);
    for (const at of ats) values.push({
      id: (at.doc || '?') + ':' + (at.s != null ? at.s : 0) + ':' + f.text,
      doc: at.doc || '?', s: at.s, e: at.e, raw: f.text, value, unit,
      anchor, measure, window: f.text,
    });
  }
  return contradictionsOf(values, opts);
}

/** referentParts(key) — the measure and the being a referent key names, for display. The key is the vocabulary
 *  term the question asks (the MEASURE) qualified by the being's canonical name; a key with no being is a bare
 *  measure. The panel reads the parts, never the raw control character. */
export function referentParts(key) {
  const s = String(key == null ? '' : key); const i = s.indexOf('\u0001');
  return i < 0 ? { measure: s || null, being: null } : { measure: s.slice(0, i) || null, being: s.slice(i + 1) || null };
}

export default { SCHEMA, GAP, VERDICTS, observerFrame, referentVocabulary, referentOf, referentParts, contradictionsOf, contradictionForField, contradictionForTopic };
