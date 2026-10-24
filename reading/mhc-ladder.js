// mhc-ladder.js — the reading microscope, layered by the Model of Hierarchical
// Complexity (Commons). One item per order, bound to whatever material a
// visitor brings, run and scored by khora's own mhc.js.
//
// WHAT IS CANON AND WHAT IS THIS PAGE'S. The scorer, the sixteen orders, the
// symbolic floor, the three axioms and the stage rule are scores-patch-points/
// khora's `native/the-fold/mhc.js`, vendored byte-identical (as is
// `verification.js`, order 12's organ). Nothing here re-implements a scorer, an
// order table or an axiom. What this file contributes is the BINDINGS — the
// part mhc.js's own header assigns to "eval/mhc-battery.mjs ... where the items
// are bound to real organs". The item declarations (task, constituents,
// coordination, organ, arms) are the lineage's reading battery (the-fold
// P44/P70), which lives in eoreader7 and was not carried into khora; they are
// carried here as declared, re-bound to the Holodeck's assembled reader and the
// vendored khora organs. Where a binding had to change it says so in place.
//
// THE ORDER OF AN ITEM IS DECLARED, NEVER READ OFF THE MATERIAL (mhc.js's own
// rule). A visitor's text changes what each item finds, never which order the
// item is at: a material that offers no specimen lands a typed gap at that
// order ("this material offers no …"), a fact about the material, not about
// the item or the reader.
//
// PURE, ORGANS AND READER INJECTED: no DOM, no fetch. The page hands in the
// relation reader it already assembled (holodeck-reader.js) and the material.

import { runBattery, runItem, stageFrom, ORDERS, orderOf, SYMBOLIC_FLOOR, AXIOMS } from '../vendor/khora/native/the-fold/mhc.js';
import { verificationTasksFor, verificationSummary } from '../vendor/khora/native/the-fold/verification.js';
import { queryEdges, queryFillers } from '../vendor/khora/native/organs/hypergraph.js';
import { premisesOf } from '../vendor/khora/native/organs/derivation.js';
import { isClaimRef } from '../vendor/khora/native/organs/nesting.js';
import { makeReferentIndex } from '../vendor/khora/native/organs/cast.js';
import { seededShuffle, shuffleSentenceWords, WITNESS_FLOOR } from '../vendor/khora/native/organs/asserted.js';
import { mergeTestimony } from '../vendor/khora/native/organs/capacity-runner.js';
import { splitSentences } from '../vendor/khora/native/adapters/text/spans.js';
import { extractSurfaces, discoverReferents, namesCorefer, diaNorm, genericTokens } from '../vendor/khora/native/adapters/text/surfaces.js';
import { resolvePronouns } from '../vendor/khora/native/adapters/text/pronouns.js';

export { ORDERS, orderOf, SYMBOLIC_FLOOR, AXIOMS, WITNESS_FLOOR };

const DRAWS = 20; // seeded re-coordinations per arbitrary arm — A9: one null is not a null
const HEAVY_DRAWS = 5; // for arms that must re-read the material per draw (declared apart)
const SEED = 0; // the fold's standing seed for null arms
const PASSAGE_CHARS = 1200; // the chunk a passage is cut at — at a sentence boundary here, never mid-word
const HEAVY_PASSAGES = 10; // the slice an arm re-reads per draw
const PER_SOURCE_PASSAGES = 10; // passages read as their own systems when the material is one source
const CLAIM_SCAN = 14;
const ABSENT_NAME = 'Zzyrflax Quenbourne'; // checked to be absent, never assumed
const ARBITRARY_ALPHA = 0.05; // network-standing.js's LINK_SPEC precedent, cited by the lineage battery

// ── THE FLOORS — our own ladder, the one the stage is read on ──────────────
//
// Canon's operand ladder (khora native/docs/LEVELS.md; WHERE-WE-ARE.md):
// "F0 units → F1 referents → F2 arrangements → F3 claims → F4 nesting →
// F5 corroborated notes → F6 premises", and "every floor promotes the
// previous floor's FINDING into an OPERAND" (organs/derivation.js). That is
// Commons's axioms 1 and 2 in our own terms, so the MHC discipline carries
// over whole: each rung is a task declared before it runs, defined in terms
// of the rung one floor down, run through mhc.js's own `runItem` (three
// control arms that must fail, then the task, quantal), and the stage is the
// highest floor passed with no gap below it. Canon's LEVELS.md names no F4
// and calls this rung F4½; here it is F4, the next floor down from F5.
//
// What mhc.js cannot do here is score the ladder itself: `declareItem`,
// `checkAxiom1` and `stageFrom` are bound to Commons's sixteen orders. The
// three short functions that apply the same rules to this table live below,
// until they move to khora as a ladder-general form of mhc.js.
//
// Commons's orders stay as a CROSS-REFERENCE: `commons` is the order whose
// declared task a floor's rung is, and `probes` are the Commons orders whose
// items read this floor's operand — run and shown, never folded into the
// floor stage.
export const FLOORS = Object.freeze([
  Object.freeze({ floor: 'F0', name: 'units', operand: 'the material cut where it breaks, each unit with its byte address', commons: null, probes: [] }),
  Object.freeze({ floor: 'F1', name: 'referents', operand: 'Beings — a name admitted as one being the material establishes', commons: 5, probes: [] }),
  Object.freeze({ floor: 'F2', name: 'arrangements', operand: 'referents arranged around a connector: who did what to whom', commons: 6, probes: [7] }),
  Object.freeze({ floor: 'F3', name: 'claims', operand: 'an arrangement as a claim a judge can check against the material', commons: 8, probes: [10, 12] }),
  Object.freeze({ floor: 'F4', name: 'nesting', operand: 'a claim in an end slot: who says what, apart from what is so', commons: null, probes: [] }),
  Object.freeze({ floor: 'F5', name: 'corroborated notes', operand: 'a claim become a note — a variable over its own restatements', commons: 9, probes: [11, 13] }),
  Object.freeze({ floor: 'F6', name: 'premises', operand: 'notes that survived corroboration, standing as premises for composition', commons: null, probes: [] }),
]);
const FLOOR_INDEX = new Map(FLOORS.map((f, i) => [f.floor, i]));
export const floorOf = (handle) => FLOORS[FLOOR_INDEX.get(handle)] ?? null;

// F6's premise floor, declared (derivation.js refuses a defaulted one): a note
// stands as a premise at WITNESS_FLOOR distinct sources; instrument
// independence is not required here, and that is said (instruments: 0).
const PREMISE_FLOOR = Object.freeze({ sources: WITNESS_FLOOR, instruments: 0 });

const ASSEMBLY =
  "EXPERIMENT — the Holodeck's assembled relation reader (holodeck-reader.js::makeEngineRelationReader over vendor/khora organs), " +
  "with cast.js / verification.js / capacity-runner.js hand-chained in the browser. Not khora's packages/host reader. READING-POLICY P0.";

// ── material ──────────────────────────────────────────────────────────────

/** Cut one source into passages at sentence boundaries, each at most
 * PASSAGE_CHARS (a single longer sentence stands alone). The passages tile the
 * source: every byte belongs to exactly one, so a passage's ref is an address. */
function cutPassages(text) {
  const sents = splitSentences(text).map((s) => (typeof s === 'string' ? { text: s, offset: text.indexOf(s) } : s));
  const starts = [];
  let open = 0;
  for (const s of sents) {
    if (s.offset > open && s.offset + s.text.length - open > PASSAGE_CHARS) { starts.push(open); open = s.offset; }
  }
  starts.push(open);
  return starts.map((start, i) => ({ start, end: i + 1 < starts.length ? starts[i + 1] : text.length }))
    .map((p) => ({ ...p, text: text.slice(p.start, p.end) }))
    .filter((p) => p.text.trim());
}

const keyOf = (s) => String(s || 'source').replace(/[#\s]+/g, '-').replace(/[^\p{L}\p{N}._-]/gu, '').slice(0, 48) || 'source';

/** sources: [{ key, text }] → { sources, passages, text }. A passage's ref is
 * `<source>#<start>-<end>`; hypergraph.js counts sources by the part before
 * `#`, so two passages of one source stay one source (order 9's distinction). */
export function materialOf(sources) {
  const seen = new Set();
  const srcs = sources.map((s, i) => {
    let key = keyOf(s.key);
    while (seen.has(key)) key = `${key}-${i}`;
    seen.add(key);
    return { key, label: s.label ?? s.key, text: String(s.text ?? '') };
  });
  const passages = srcs.flatMap((s) => cutPassages(s.text).map((p) => ({ ref: `${s.key}#${p.start}-${p.end}`, source: s.key, text: p.text })));
  return { sources: srcs, passages, text: srcs.map((s) => s.text).join('\n\n') };
}

// ── edges, under the driver's vocabulary, the earned names kept ───────────
// hypergraph.js's edges carry only end1 / label / end2. The lineage battery
// reads subject / verb / object; `sae` lays those over the earned names and
// keeps them, so the same objects satisfy queryEdges / queryFillers. Memoised
// per reader: arms locate a specimen inside the list by reference.
const sae = (e) => ({ ...e, subject: e.end1 ?? e.subject, verb: e.label ?? e.verb, object: e.end2 ?? e.object });
const edgeMemo = new WeakMap();
const edgesOf = (reader) => {
  if (!reader) return [];
  if (!edgeMemo.has(reader)) {
    const list = reader.edges ?? [];
    if (list.length && list[0].end1 === undefined && list[0].subject === undefined) {
      throw new Error('mhc-ladder: the reader\'s edges carry neither end1/label/end2 nor subject/verb/object — a driver defect, not a material one');
    }
    edgeMemo.set(reader, list.map(sae));
  }
  return edgeMemo.get(reader);
};

const indexFor = makeReferentIndex({ splitSentences, extractSurfaces, discoverReferents, namesCorefer, diaNorm });

// ── arm helpers: every arm must SHOW its perturbation landed (A10) ────────

/** lowerOrder: the constituent withheld. Licensed only if it contributed. */
const withheld = (contributed, detail, attempt) => ({
  completed: contributed ? attempt() : false,
  perturbed: !!contributed,
  detail: contributed ? detail : `nothing was withheld: ${detail} — the organ produced no output in the real run, so removing it perturbs nothing`,
});

/** arbitrary: the coordination re-done at N seeds, constituents held fixed.
 * Licensed only if at least one draw changed the input. Natural frequency. */
const shuffled = (draws, makeDraw, attempt) => {
  let fired = 0;
  let anyChanged = false;
  for (let d = 0; d < draws; d += 1) {
    const drawn = makeDraw(SEED + d);
    if (drawn.changed) anyChanged = true;
    if (drawn.changed && attempt(drawn.value)) fired += 1;
  }
  return {
    completed: fired > 0,
    perturbed: anyChanged,
    draws,
    fired,
    detail: anyChanged ? `accomplished the task in ${fired} of ${draws} seeded re-coordinations` : 'no draw changed the input — the shuffle was a no-op and tested nothing',
  };
};

/** discrimination: the same task on material that does not support it.
 * Licensed only if the other material genuinely lacks the specimen. */
const against = (lacks, detail, attempt) => ({
  completed: lacks ? attempt() : false,
  perturbed: !!lacks,
  detail: lacks ? detail : `the control material was not confirmed to lack the specimen — ${detail}`,
});

const GAP = (detail) => ({ unreachable: true, detail });

const logFactorial = (n) => { let s = 0; for (let i = 2; i <= n; i += 1) s += Math.log(i); return s; };
const logChoose = (n, k) => (k < 0 || k > n ? -Infinity : logFactorial(n) - logFactorial(k) - logFactorial(n - k));

/** Exact P(a uniform permutation places at least one of K labels on m fixed
 * targets) — the hypergeometric tail, so the arm has no simulation variance. */
const hyperAtLeastOne = (n, K, m) => {
  if (n <= 0 || K <= 0 || m <= 0) return 0;
  if (m > n - K) return 1;
  return 1 - Math.exp(logChoose(n - K, m) - logChoose(n, m));
};

const redealAgainstExactNull = (edges, e) => {
  const n = edges.length;
  const K = edges.filter((x) => x.subject === e.subject).length;
  const m = edges.filter((x) => x.verb === e.verb && x.object === e.object).length;
  if (!(K < n)) return { completed: false, perturbed: false, draws: 1, fired: 0, detail: "every edge shares the specimen's own subject — a redeal is a no-op and tested nothing" };
  const pHit = hyperAtLeastOne(n, K, m);
  const completed = pHit >= ARBITRARY_ALPHA;
  return {
    completed, perturbed: true, draws: 1, fired: completed ? 1 : 0,
    detail: `exact P(a uniform redeal reproduces this triple) = ${pHit.toFixed(4)} over n=${n} edges, K=${K} sharing the subject, m=${m} sharing the verb+object — ${completed ? `at or above alpha ${ARBITRARY_ALPHA}, so a random re-coordination is not rare here` : `below alpha ${ARBITRARY_ALPHA}, so the true match is not explained by chance alone`}`,
  };
};

const redealCountAgainstExactNull = (edges, specimen, floor) => {
  if (edges.indexOf(specimen) < 0) return { completed: false, perturbed: false, draws: 1, fired: 0, detail: "the specimen is not among this reading's own edges" };
  const counts = edges.map((x) => x.refs?.length ?? 0);
  if (new Set(counts).size <= 1) return { completed: false, perturbed: false, draws: 1, fired: 0, detail: 'every edge in this reading carries the same ref-count — a redeal is a no-op and tested nothing' };
  const clearing = counts.filter((c) => c >= floor).length;
  const pHit = clearing / counts.length;
  const completed = pHit >= ARBITRARY_ALPHA;
  return {
    completed, perturbed: true, draws: 1, fired: completed ? 1 : 0,
    detail: `exact P(an arbitrary redeal hands this specimen a count clearing the witness floor) = ${pHit.toFixed(4)} (${clearing} of ${counts.length} edges already clear it) — ${completed ? `at or above alpha ${ARBITRARY_ALPHA}, so the floor is not rare here` : `below alpha ${ARBITRARY_ALPHA}, so clearing it is not explained by chance alone`}`,
  };
};

/** Does an arbitrary fold gather every pair the individuation rule calls one
 * being and keep apart every pair it withholds on? (order 5's arbitrary arm) */
function foldReproducesRule(agreement, groupOf) {
  const { regime1 = [], regime2 = [] } = agreement;
  if (!regime1.length) return false;
  for (const p of regime1) { const g = groupOf(p.a); if (g == null || g !== groupOf(p.b)) return false; }
  for (const p of regime2) { const g = groupOf(p.a); if (g == null || g === groupOf(p.b)) return false; }
  return true;
}

// ── F0's audit: units at the material's own boundaries, re-opened by address ─
const enc = new TextEncoder();
const dec = new TextDecoder();
const isWordChar = (c) => !!c && /[\p{L}\p{N}]/u.test(c);
const unitsOf = (t) => splitSentences(t).map((s) => (typeof s === 'string' ? { text: s, offset: t.indexOf(s) } : s));
/** Every unit re-opens, by its UTF-8 byte range, to exactly its own text; no
 * cut falls between two letters or digits; units never overlap. A set of cuts
 * passes only with at least two units. */
let lastText = null, lastBytes = null, lastAt = null;
/** UTF-8 bytes of `t` and the byte offset of every char offset, in one pass
 * (kept for the last text: the arms audit many cuttings of the same text). */
function bytesOf(t) {
  if (t === lastText) return { bytes: lastBytes, at: lastAt };
  const at = new Uint32Array(t.length + 1);
  // a surrogate pair is 4 bytes (all on its high half); a lone surrogate is
  // U+FFFD, 3 bytes — exactly as TextEncoder writes them
  const hi = (i) => { const c = t.charCodeAt(i); return c >= 0xd800 && c < 0xdc00; };
  const lo = (i) => { const c = t.charCodeAt(i); return c >= 0xdc00 && c < 0xe000; };
  for (let i = 0, b = 0; i < t.length; i += 1) {
    at[i] = b;
    const c = t.charCodeAt(i);
    b += c < 0x80 ? 1 : c < 0x800 ? 2 : hi(i) && lo(i + 1) ? 4 : lo(i) && i > 0 && hi(i - 1) ? 0 : 3;
    at[i + 1] = b;
  }
  lastText = t; lastBytes = enc.encode(t); lastAt = at;
  return { bytes: lastBytes, at };
}
function auditUnits(t, units) {
  const { bytes, at } = bytesOf(t);
  let reopen = 0, inWord = 0, overlap = 0, prevEnd = 0;
  const rows = [];
  for (const u of units) {
    const b0 = at[u.offset];
    const b1 = at[u.offset + u.text.length];
    const back = dec.decode(bytes.slice(b0, b1)) === u.text;
    const splits = u.offset > 0 && isWordChar(t[u.offset - 1]) && isWordChar(t[u.offset]);
    if (back) reopen += 1;
    if (splits) inWord += 1;
    if (u.offset < prevEnd) overlap += 1;
    prevEnd = Math.max(prevEnd, u.offset + u.text.length);
    rows.push({ text: u.text, b0, b1, back, splits });
  }
  return { n: units.length, reopen, inWord, overlap, rows, ok: units.length >= 2 && reopen === units.length && inWord === 0 && overlap === 0 };
}
/** Units from cut positions (char offsets), tiling `t`. */
const unitsAt = (t, cuts) => [0, ...cuts].map((start, i, all) => ({ offset: start, text: t.slice(start, i + 1 < all.length ? all[i + 1] : t.length) }));

/** An item may declare the specimen it needs; where the material offers none
 * the honest report is a gap about the MATERIAL, kept out of every arm. */
function guardItems(items) {
  return items.map((item) => {
    if (typeof item.requires !== 'function') return item;
    const gate = () => { const missing = item.requires(); return missing ? { unreachable: true, detail: `this material offers no ${missing}` } : null; };
    const wrap = (fn) => async (ctx) => gate() ?? fn(ctx);
    return { ...item, task: wrap(item.task), arms: Object.fromEntries(Object.entries(item.arms).map(([k, fn]) => [k, wrap(fn)])) };
  });
}

// ── the specimen set, read OUT of the material ────────────────────────────
function deriveSpec(material, reader, index, control, READER) {
  const edges = edgesOf(reader);
  // A specimen's ends must both be referents the reading ADMITTED, neither may
  // span a line break (A19's capture artefact), and the two ends must differ.
  // Changed from the lineage battery: it also required a one-word verb. This
  // reader binds phrasal predicates ("condemned the raid on"), so that filter
  // would refuse nearly every edge it reads; it is dropped here and said so.
  const clean = (x) => typeof x === 'string' && x.trim() && !/[\n\r]/.test(x);
  const isReferent = (x) => { try { return index.resolve(x).size > 0; } catch { return false; } };
  const candidates = edges
    .filter((e) => clean(e.subject) && clean(e.object) && clean(e.verb) && e.subject.toLowerCase() !== e.object.toLowerCase() && isReferent(e.subject) && isReferent(e.object))
    .sort((a, b) => (b.refs?.length ?? 0) - (a.refs?.length ?? 0));

  // Prefer a specimen the control material does NOT state, so the arms that
  // ask "does this hold against different content" mean something.
  const statedInControl = (e) => { try { return queryEdges(edgesOf(control.reader), { subject: e.subject, verb: e.verb, object: e.object }).length > 0; } catch { return false; } };
  const distinctive = candidates.filter((e) => !statedInControl(e));
  const specimen = distinctive[0] ?? candidates[0] ?? null;
  const recurring = distinctive.find((e) => (e.refs?.length ?? 0) >= WITNESS_FLOOR) ?? candidates.find((e) => (e.refs?.length ?? 0) >= WITNESS_FLOOR) ?? null;

  let slot = null;
  for (const e of [...distinctive, ...candidates]) {
    const fillers = queryFillers(edges, { subject: e.subject, verb: e.verb });
    if (fillers && fillers.length >= 2) { slot = { subject: e.subject, verb: e.verb, fillers }; break; }
  }

  // The principal: a clean one-word name THIS material establishes and the
  // control does not (otherwise order 5's discrimination arm is unlicensed).
  const named = [...(index.referents ?? [])]
    .map((id) => ({ id, name: index.represent(id) }))
    .filter((r) => r.name && clean(r.name) && !/\s/.test(r.name) && /^[\p{L}][\p{L}\p{M}'-]+$/u.test(r.name));
  const principal = named.find((r) => { try { return control.index.resolve(r.name).size === 0; } catch { return false; } }) ?? null;

  // THE TWO NOMINAL QUESTIONS, posed with the fold's own individuation rule
  // (genericTokens stripped, remainders compared with namesCorefer) — the
  // probe and the organ on one footing. Regime 1: pairs the rule calls one
  // being. Regime 2: near misses that share a raw token but individuate apart.
  // One-side-bare pairs are the singleton-partner rescue; abstained, counted.
  const sentences = splitSentences(material.text);
  const entries = extractSurfaces(sentences, {});
  let generic;
  try { generic = genericTokens(entries, {}); } catch { generic = new Set(); }
  const individuating = (surface) => diaNorm(surface).split(/\s+/).filter((t) => t.length > 2 && !generic.has(t));
  const eventId = new Map();
  let establishedEvents = [];
  try { establishedEvents = discoverReferents(entries, {}).events ?? []; } catch { establishedEvents = []; }
  for (const ev of establishedEvents) if (!eventId.has(ev.surface)) eventId.set(ev.surface, ev.referent_id);
  const allSurfaces = [...eventId.keys()].filter((f) => clean(f));
  const regime1 = [], regime2 = [];
  let abstained = 0;
  const rawShare = (a, b) => { const ta = new Set(diaNorm(a).split(/\s+/).filter((t) => t.length > 2)); return diaNorm(b).split(/\s+/).some((t) => t.length > 2 && ta.has(t)); };
  for (let i = 0; i < allSurfaces.length; i += 1) {
    for (let j = i + 1; j < allSurfaces.length; j += 1) {
      const a = allSurfaces[i], b = allSurfaces[j];
      const ia = individuating(a), ib = individuating(b);
      if (!(ia.length && ib.length)) { let raw = false; try { raw = !!namesCorefer(a, b); } catch { raw = false; } if (raw) abstained += 1; continue; }
      let remaindersCorefer = false;
      try { remaindersCorefer = !!namesCorefer(ia.join(' '), ib.join(' ')); } catch { remaindersCorefer = false; }
      const merged = eventId.get(a) === eventId.get(b);
      if (remaindersCorefer) regime1.push({ a, b, merged });
      else if (rawShare(a, b)) regime2.push({ a, b, merged });
    }
  }
  const corefAgreement = {
    regime1, regime2, abstained,
    shouldMerge: regime1.length, didMerge: regime1.filter((r) => r.merged).length, missed: regime1.filter((r) => !r.merged),
    shouldWithhold: regime2.length, wronglyMerged: regime2.filter((r) => r.merged),
  };

  // A word the material certainly contains and that names no admitted being
  // (order 5's lower-order arm), from this material's own frequency table.
  const counts = new Map();
  for (const t of material.text.match(/[\p{L}]{3,}/gu) ?? []) { const k = t.toLowerCase(); counts.set(k, (counts.get(k) ?? 0) + 1); }
  const presentNonReferent = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([w]) => w)
    .find((w) => { try { return index.resolve(w).size === 0; } catch { return false; } }) ?? null;

  // ORDER 13's SYSTEMS. Where the material is several sources, each SOURCE is
  // read as its own system — the real metasystematic case. Where it is one
  // source, its passages stand as systems, as the lineage battery read one
  // article; that is disclosed on the page, never dressed up as independence.
  const bySource = material.sources.length >= 2;
  const systems = bySource
    ? material.sources.map((s) => ({ ref: s.key, passages: material.passages.filter((p) => p.source === s.key) }))
    : material.passages.slice(0, PER_SOURCE_PASSAGES).map((p) => ({ ref: p.ref, passages: [p] }));
  let sourceReaders = [];
  try { sourceReaders = systems.map((s) => ({ ref: s.ref, reader: READER(s.passages, { pool: material.passages }) })); } catch { sourceReaders = []; }
  const readAcross = (edge) => {
    const claim = `${edge.subject} ${edge.verb} ${edge.object}.`;
    return sourceReaders.map((s) => {
      let c = null, v = null;
      try { c = (s.reader.read(claim).claims ?? [])[0] ?? null; v = c?.verdict ?? null; } catch { v = null; }
      const bound = v === 'bound';
      // A hold carries the address it read (mergeTestimony's readsNothing wall).
      return { claim_id: `mhc:${edge.subject}|${edge.verb}|${edge.object}`, who: s.ref, verdict: bound ? 'holds' : v === 'contradicted' ? 'refused' : 'undetermined', read: bound ? (c?.refs?.length ? c.refs : [s.ref]) : [], edges: [], grammar: [], corroboration: null };
    });
  };
  const holdsIn = (readings) => readings.filter((r) => r.verdict === 'holds').length;
  let corroboratedClaim = null, singleClaim = null;
  if (sourceReaders.length >= 2) {
    for (const e of candidates.slice(0, CLAIM_SCAN)) {
      if (corroboratedClaim && singleClaim) break;
      const readings = readAcross(e);
      const h = holdsIn(readings);
      if (h >= 2 && !corroboratedClaim) corroboratedClaim = { edge: e, readings, holds: h };
      else if (h === 1 && !singleClaim) singleClaim = { edge: e, readings, holds: h };
    }
  }

  // F0: the units every floor above cites. F6: which notes stand as premises,
  // by derivation.js's own counter over each edge's witness passages.
  const units = unitsOf(material.text);
  const notes = edges.map((e) => ({ id: `${e.subject}|${e.verb}|${e.object}`.toLowerCase(), subject: e.subject, verb: e.verb, object: e.object, witnesses: [...(e.refs ?? [])] }));
  const premises = premisesOf(notes, { floor: PREMISE_FLOOR, carry: false });

  return {
    edges, candidates, specimen, recurring, slot, principal, presentNonReferent, corefAgreement,
    variantPair: regime1[0] ?? null, nearMissPair: regime2[0] ?? null, eventId, generic,
    bySource, sourceReaders, readAcross, corroboratedClaim, singleClaim, units, premises,
  };
}

// ── the floor ladder's own rungs: F0, and the two canon floors this page cannot reach ──
function floorOnlyItems({ material, spec }) {
  const text = material.text;
  const nested = spec.edges.filter((e) => isClaimRef(e.end1) || isClaimRef(e.end2)).length;
  const NO_NESTING = `no organ on this page nests a claim: ${nested} of ${spec.edges.length} edges hold claim:<id> in an end slot — the assembled reader puts surfaces there — and canon's one producer of nested notes, organs/ranke.js, nests from a page's citations, which this page does not fetch`;
  const NO_REGISTER = 'no organ on this page composes premises: derivation.js derives only from chemistry a giver declared in the declarations register (interpretation/declarations.js, GIVEN tier), and this page holds no register — without a giver the derivation is canon’s own measured zero';
  const gapped = (detail) => async () => GAP(detail);
  return guardItems([
    {
      id: 'f0-units', floor: 'F0',
      requires: () => (spec.units.length < 2 ? 'second unit: it reads as a single sentence' : null),
      name: 'the material is cut where it breaks, into units that tile it, and every unit re-opens by its byte address to exactly its own text',
      organ: 'adapters/text/spans.js::splitSentences, addressed in UTF-8 bytes',
      assembly: ASSEMBLY, stages: ['perception'], definedInTermsOf: [],
      organizes: 'the byte stream (S0) is cut at the material’s own boundaries into units that tile it and re-open by address, so every floor above cites a unit instead of a guess',
      task: async () => {
        const a = auditUnits(text, spec.units);
        return { completed: a.ok, detail: `${a.n} sentence units; ${a.reopen} of ${a.n} re-open by byte address to exactly their text; ${a.inWord} cuts fall inside a word; ${a.overlap} overlap` };
      },
      arms: {
        // S0 alone: the same number of units cut at a fixed width, no boundary rule.
        lowerOrder: async () => withheld(spec.units.length >= 2, 'the cut rule withheld; only fixed-width cuts over the byte stream (S0 alone)', () => {
          const n = spec.units.length, w = Math.max(1, Math.round(text.length / n));
          return auditUnits(text, unitsAt(text, Array.from({ length: n - 1 }, (_, i) => (i + 1) * w).filter((c) => c < text.length))).ok;
        }),
        // The same number of cuts, placed at seeded random positions.
        arbitrary: async () => shuffled(DRAWS, (seed) => {
          const real = spec.units.slice(1).map((u) => u.offset);
          const cuts = seededShuffle(Array.from({ length: Math.max(0, text.length - 1) }, (_, i) => i + 1), seed).slice(0, real.length).sort((a, b) => a - b);
          return { changed: cuts.join(',') !== real.join(','), value: cuts };
        }, (cuts) => auditUnits(text, unitsAt(text, cuts)).ok),
        discrimination: async () => against(true, 'the same letters run together, every space and mark removed, must not cut into units at its own boundaries', () => {
          const run = text.replace(/[^\p{L}\p{N}]+/gu, '');
          return auditUnits(run, unitsOf(run)).ok;
        }),
      },
    },
    {
      id: 'f4-nesting', floor: 'F4',
      name: 'a claim in an end slot: who says what, kept apart from what is so',
      organ: 'organs/nesting.js (corroborationOf · leakCheck); in canon only organs/ranke.js writes nested notes',
      assembly: ASSEMBLY, stages: ['typed, directional relation'], definedInTermsOf: ['f3-claims'],
      organizes: 'an end slot may hold claim:<id>, so “X states P” is an ordinary note — and the wall: witnesses of the outer note never corroborate P',
      task: gapped(NO_NESTING),
      arms: { lowerOrder: gapped(NO_NESTING), arbitrary: gapped(NO_NESTING), discrimination: gapped(NO_NESTING) },
    },
    {
      id: 'f6-premises', floor: 'F6',
      requires: () => (spec.premises.premises.length ? null : `note stated by ${PREMISE_FLOOR.sources} distinct sources — the premise floor`),
      name: 'a corroborated note stands as a premise, and licensed composition derives from premises a fact the material never stated',
      organ: 'organs/derivation.js (premisesOf · derive), over the declarations register',
      assembly: ASSEMBLY, stages: ['typed, directional relation', 'population'], definedInTermsOf: ['f5-notes'],
      organizes: 'a note that survived corroboration becomes a premise, and composition licensed by a giver derives facts the material never stated, with provenance to the premises and through them to bytes',
      task: gapped(NO_REGISTER),
      arms: { lowerOrder: gapped(NO_REGISTER), arbitrary: gapped(NO_REGISTER), discrimination: gapped(NO_REGISTER) },
    },
  ]);
}

/** A floor rung whose task IS a Commons item's: the same task and arms (so the
 * Commons run's result is the floor's), re-declared on the floor ladder. */
const FLOOR_WRAP = [
  ['f1-referents', 'F1', 'o5-nominal', ['f0-units']],
  ['f2-arrangements', 'F2', 'o6-sentential', ['f1-referents']],
  ['f3-claims', 'F3', 'o8-primary', ['f2-arrangements']],
  ['f5-notes', 'F5', 'o9-concrete', ['f4-nesting']],
];
function floorItemsOf(commonsItems, own) {
  const byId = new Map(commonsItems.map((i) => [i.id, i]));
  const wrapped = FLOOR_WRAP.map(([id, floor, cid, under]) => ({ ...byId.get(cid), id, floor, commonsId: cid, definedInTermsOf: under }));
  return [...own, ...wrapped].sort((a, b) => FLOOR_INDEX.get(a.floor) - FLOOR_INDEX.get(b.floor));
}

/** The floor ladder, scored by mhc.js's rules applied to FLOORS: axiom 1
 * battery-wide (a constituent must be an item exactly one floor down), each
 * item through `runItem` (a wrapped item reuses its Commons run, which is the
 * same task under the same arms), a floor passed only if every item at it
 * passed, and the stage walked up from F0 to the first floor not passed. */
async function runFloors(items, commonsReport) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const findings = [];
  for (const it of items) {
    const r = FLOOR_INDEX.get(it.floor);
    if (r === 0) continue;
    if (!it.definedInTermsOf?.length) findings.push({ id: it.id, detail: `${it.floor} is above the floor and must name its constituents` });
    for (const cid of it.definedInTermsOf ?? []) {
      const c = byId.get(cid);
      if (!c) findings.push({ id: it.id, detail: `no item "${cid}" on this ladder` });
      else if (FLOOR_INDEX.get(c.floor) !== r - 1) findings.push({ id: it.id, detail: `"${cid}" is at ${c.floor}; axiom 1 requires the next floor down (${FLOORS[r - 1].floor})` });
    }
  }
  const blocked = new Map(findings.map((f) => [f.id, f]));
  const ranCommons = new Map((commonsReport?.items ?? []).map((i) => [i.id, i]));
  const results = [];
  for (const it of items) {
    const base = { id: it.id, floor: it.floor, name: it.name, organ: it.organ, stages: it.stages, commonsId: it.commonsId ?? null };
    if (blocked.has(it.id)) { results.push({ ...base, status: 'refused', reason: 'constituent_missing', detail: `axiom 1: ${blocked.get(it.id).detail}. Unmeasured here, not failing.` }); continue; }
    const prior = it.commonsId ? ranCommons.get(it.commonsId) : null;
    const r = prior?.arms ? prior : await runItem(it, {});
    results.push({ ...r, ...base });
  }
  const floors = FLOORS.map((f) => {
    const rows = results.filter((r) => r.floor === f.floor);
    const status = !rows.length ? 'no_item_declared' : rows.some((r) => r.status === 'failed') ? 'failed' : rows.every((r) => r.status === 'passed') ? 'passed' : 'unmeasured';
    return { ...f, status, items: rows };
  });
  let stage = null, cappedBy = null;
  for (const f of floors) {
    if (f.status === 'passed') { stage = f.floor; continue; }
    cappedBy = {
      floor: f.floor, status: f.status,
      detail: f.status === 'failed'
        ? `${f.floor} (${f.name}) was measured and the reader did not complete it — a real ceiling`
        : f.status === 'no_item_declared' ? `no item is declared at ${f.floor}`
        : `${f.floor} (${f.name}) is UNMEASURED (${f.items.map((i) => i.reason).filter(Boolean).join(', ') || 'no reason given'}) — no stage may be read across it`,
    };
    break;
  }
  const isolated = cappedBy ? floors.slice(FLOOR_INDEX.get(cappedBy.floor) + 1).filter((f) => f.status === 'passed').map((f) => ({ floor: f.floor, name: f.name })) : [];
  return { axiom1: { held: findings.length === 0, findings }, results, floors, stage: { stage, stageName: stage ? floorOf(stage).name : null, cappedBy, ceilingIsReal: cappedBy?.status === 'failed', isolated } };
}

// ── the ladder ────────────────────────────────────────────────────────────
function buildItems({ material, reader, index, spec, control, READER }) {
  const edges = spec.edges;
  const text = material.text;
  const heavyText = material.passages.slice(0, HEAVY_PASSAGES).map((p) => p.text).join('');
  const readSalad = (seed) => splitSentences(heavyText).map((s, i) => shuffleSentenceWords(typeof s === 'string' ? s : s.text, seed * 1000 + i)).join(' ');
  // ENGLISH SCOPE, declared: resolvePronouns runs on its default register (English
  // third person) — no pronounClass is threaded here — and the arms below strip
  // and match the English closed set. Another language's pronouns are not looked
  // for, so order 7 on such a material is a gap, never a measured ceiling.
  const pronounsOf = (t) => {
    const sentences = splitSentences(t);
    const disc = discoverReferents(extractSurfaces(sentences, {}), {});
    const map = new Map(disc.events.map((e) => [e.surface, e.referent_id]));
    return { sentences, disc, map, res: resolvePronouns(sentences, map, { minActivation: 0.05, minMargin: 0.2 }) };
  };
  let realMemo = null;
  const real = () => (realMemo ??= pronounsOf(text));

  return guardItems([
    // ── 5 · Nominal ─────────────────────────────────────────────────────
    {
      id: 'o5-nominal', order: 5,
      requires: () => (!spec.principal ? 'being it establishes that the control material does not'
        : !spec.variantPair ? 'pair its own individuation rule says is one being'
        : !spec.nearMissPair ? 'pair its own individuation rule withholds on' : null),
      name: 'a name denotes a being the material establishes',
      organ: 'organs/cast.js::makeReferentIndex (extractSurfaces → discoverReferents)',
      assembly: ASSEMBLY, stages: ['perception', 'witnessed admission', 'alias resolution'], definedInTermsOf: [],
      organizes: "raw capitalised runs (order 4's symbols, out of scope by construction) are folded into admitted referent identities, so a name points at a being rather than at a byte string",
      task: async () => {
        const resolved = index.resolve(spec.principal.name);
        const absent = index.resolve(ABSENT_NAME);
        const c = spec.corefAgreement;
        const missed = c.missed.map((m) => `"${m.a}" | "${m.b}"`).join('; ');
        return {
          completed: resolved.size > 0 && absent.size === 0 && c.shouldMerge > 0 && c.missed.length === 0 && c.wronglyMerged.length === 0,
          detail: `"${spec.principal.name}" resolves (${resolved.size}); "${ABSENT_NAME}" does not (${absent.size}); gathered ${c.didMerge}/${c.shouldMerge} pairs its own individuation rule calls one being${missed ? ` (stranded: ${missed})` : ''}; kept apart ${c.shouldWithhold - c.wronglyMerged.length}/${c.shouldWithhold} it withholds on`,
        };
      },
      arms: {
        // Raw byte containment stands in for order 4: it finds the token but has
        // no notion of a being, so it cannot refuse a word that names nobody.
        lowerOrder: async () => withheld(index.referents.size > 0, 'referent admission withheld; only raw token containment available', () => {
          const has = (n) => !!n && text.toLowerCase().includes(String(n).toLowerCase());
          return has(spec.principal?.name) && !has(ABSENT_NAME) && !has(spec.presentNonReferent);
        }),
        // Marginals kept (same surfaces, same number of groups), membership dealt.
        arbitrary: async () => shuffled(DRAWS, (seed) => {
          const events = index.events ?? [];
          const surfaces = events.map((e) => e.surface);
          const groupsN = new Set(events.map((e) => e.referent_id)).size;
          const dealt = seededShuffle(surfaces, seed);
          const groups = new Map();
          dealt.forEach((surface, i) => groups.set(surface, `rand:${i % Math.max(1, groupsN)}`));
          return { changed: dealt.join('|') !== surfaces.join('|'), value: groups };
        }, (groups) => foldReproducesRule(spec.corefAgreement, (n) => groups.get(n) ?? null)),
        discrimination: async () => against(!!control && !control.index.resolve(spec.principal?.name ?? '').size,
          `the control material (${control?.key}) does not establish "${spec.principal?.name}"`,
          () => control.index.resolve(spec.principal.name).size > 0),
      },
    },

    // ── 6 · Sentential ──────────────────────────────────────────────────
    {
      id: 'o6-sentential', order: 6,
      requires: () => (!spec.specimen ? 'edge whose two ends are both admitted referents' : null),
      name: 'a directed relation inside one sentence: who did what to whom, in order',
      organ: 'organs/hypergraph.js::makeRelationReader (discoverRelationVocab → extractRelations)',
      assembly: ASSEMBLY, stages: ['perception', 'alias resolution', 'typed, directional relation'], definedInTermsOf: ['o5-nominal'],
      organizes: 'admitted referents are ordered around a measured connector, so the pair carries a direction the referent set alone does not have',
      task: async () => {
        const e = spec.specimen;
        const forward = queryEdges(edges, { subject: e.subject, verb: e.verb, object: e.object });
        const reverse = queryEdges(edges, { subject: e.object, verb: e.verb, object: e.subject });
        return { completed: forward.length > 0 && reverse.length === 0, detail: `"${e.subject} —${e.verb}→ ${e.object}" is stated (${forward.length}); its reverse is not (${reverse.length})` };
      },
      arms: {
        // Referents alone give a bag; first-mention order ranks a pair either way
        // and so cannot refuse the reverse.
        lowerOrder: async () => withheld(index.referents.size > 0, 'the connector withheld; only the unordered referent set available', () => false),
        // asserted.js's own order arm: each sentence's words shuffled in place,
        // vocabulary and sentence boundaries held fixed.
        arbitrary: async () => shuffled(HEAVY_DRAWS, (seed) => { const salad = readSalad(seed); return { changed: salad !== heavyText, value: salad }; }, (salad) => {
          const e = spec.specimen;
          const r = READER([{ ref: 'salad#0', text: salad }], { pool: material.passages });
          return queryEdges(edgesOf(r), { subject: e.subject, verb: e.verb, object: e.object }).length > 0;
        }),
        discrimination: async () => against(!!control, `the control material (${control?.key}) is different content`, () => {
          const e = spec.specimen;
          return queryEdges(edgesOf(control.reader), { subject: e.subject, verb: e.verb, object: e.object }).length > 0;
        }),
      },
    },

    // ── 7 · Preoperational ──────────────────────────────────────────────
    {
      id: 'o7-preoperational', order: 7,
      // Added here, not in the lineage battery (its fixtures always had
      // pronouns): when the resolver itself finds no pronoun to bind or refuse,
      // the material offers no specimen — a gap, never a measured ceiling.
      requires: () => { const r = real().res; return (r?.bindings?.length ?? 0) + (r?.gaps?.length ?? 0) === 0 ? 'pronoun the resolver finds, to bind or to refuse' : null; },
      name: 'a sequence coordinated across sentences: a pronoun bound to what was read before it',
      organ: 'adapters/text/pronouns.js::resolvePronouns',
      assembly: ASSEMBLY, stages: ['perception', 'witnessed admission', 'alias resolution', 'pronoun binding'], definedInTermsOf: ['o6-sentential'],
      organizes: "sentence-local relations are carried forward as an activation trace, so a later sentence's pronoun reaches an antecedent no single sentence contains",
      task: async () => {
        const { disc, res } = real();
        const bindings = res?.bindings ?? [], gaps = res?.gaps ?? [];
        // A refusal is a correct result: the task is to bind at least one pronoun
        // to an admitted referent and never bind one to a referent not admitted.
        const admitted = new Set(disc.events.map((e) => e.referent_id));
        const fabricated = bindings.filter((b) => !admitted.has(b.referentId));
        return {
          completed: bindings.length > 0 && fabricated.length === 0,
          detail: `${bindings.length} pronoun(s) bound, ${gaps.length} refused (${[...new Set(gaps.map((g) => g.reason))].join(', ') || 'none'}), ${fabricated.length} bound to an unadmitted referent`,
        };
      },
      arms: {
        // The same task with only within-sentence information: bind each pronoun
        // to a name in its own sentence. Accomplishes it only by REPRODUCING the
        // real bindings — which would mean the cross-sentence trace did nothing.
        lowerOrder: async () => withheld(true, 'the activation trace withheld; only within-sentence extraction available', () => {
          const { sentences, map, res } = real();
          const realKeys = new Set((res?.bindings ?? []).map((b) => `${b.offset}:${b.referentId}`));
          if (!realKeys.size) return false;
          const localKeys = new Set();
          for (const sent of sentences) {
            const body = typeof sent === 'string' ? sent : sent.text;
            const base = typeof sent === 'string' ? 0 : (sent.offset ?? 0);
            const names = [...map.keys()].filter((n) => body.includes(n));
            if (!names.length) continue;
            for (const m of body.matchAll(/\b(he|she|his|her|him|they|them|their)\b/gi)) localKeys.add(`${base + m.index}:${map.get(names[0])}`);
          }
          return [...realKeys].every((k) => localKeys.has(k));
        }),
        // The coordination is SEQUENCE: sentences re-ordered, each kept intact.
        arbitrary: async () => shuffled(HEAVY_DRAWS, (seed) => {
          const texts = splitSentences(text).map((s) => (typeof s === 'string' ? s : s.text));
          const permuted = seededShuffle(texts, seed);
          return { changed: permuted.join(' ') !== texts.join(' '), value: permuted.join(' ') };
        }, (scrambled) => {
          const key = (b) => `${String(b.pronoun).toLowerCase()}:${b.referentId}`;
          const want = new Set((real().res?.bindings ?? []).map(key));
          const got = new Set((pronounsOf(scrambled).res?.bindings ?? []).map(key));
          return want.size > 0 && got.size === want.size && [...want].every((k) => got.has(k));
        }),
        discrimination: async () => against(true, 'text with no pronoun at all must yield no binding', () => {
          const stripped = text.replace(/(?<![\p{L}\p{N}_])(?:their|they|them|hers|her|him|his|she|he)(?![\p{L}\p{N}_])/giu, 'someone');
          return (pronounsOf(stripped).res?.bindings ?? []).length > 0;
        }),
      },
    },

    // ── 8 · Primary ─────────────────────────────────────────────────────
    {
      id: 'o8-primary', order: 8,
      requires: () => (!spec.specimen ? 'edge whose two ends are both admitted referents' : null),
      name: "an empirical rule applied: a claim checked against the material's own edges",
      organ: 'organs/hypergraph.js::judge (reader.read)',
      assembly: ASSEMBLY, stages: ['typed, directional relation'], definedInTermsOf: ['o7-preoperational'],
      organizes: "the material's whole edge set becomes a rule a claim is measured against, so a sentence that was never read still gets a verdict",
      task: async () => {
        const e = spec.specimen;
        const stated = reader.read(`${e.subject} ${e.verb} ${e.object}.`);
        const reversed = reader.read(`${e.object} ${e.verb} ${e.subject}.`);
        const boundStated = (stated.claims ?? []).some((c) => c.verdict === 'bound');
        const boundReverse = (reversed.claims ?? []).some((c) => c.verdict === 'bound');
        return {
          completed: boundStated && !boundReverse,
          detail: `stated claim -> ${(stated.claims ?? []).map((c) => c.verdict).join(',') || 'no claim'}; reversed claim -> ${(reversed.claims ?? []).map((c) => c.verdict).join(',') || 'no claim'}`,
        };
      },
      arms: {
        // Bag-of-words containment cannot refuse the reversed claim (P31).
        lowerOrder: async () => withheld(edges.length > 0, 'the edge set withheld; only word containment available', () => {
          const e = spec.specimen;
          const has = (s) => text.toLowerCase().includes(String(s).toLowerCase());
          return has(e.subject) && has(e.verb) && has(e.object) && !(has(e.object) && has(e.verb) && has(e.subject));
        }),
        arbitrary: async () => redealAgainstExactNull(edges, spec.specimen),
        discrimination: async () => against(!!control, `the same claim checked against different content (${control?.key}) must not bind`, () => {
          const e = spec.specimen;
          return (control.reader.read(`${e.subject} ${e.verb} ${e.object}.`).claims ?? []).some((c) => c.verdict === 'bound');
        }),
      },
    },

    // ── 9 · Concrete ────────────────────────────────────────────────────
    {
      id: 'o9-concrete', order: 9,
      requires: () => (!spec.recurring ? `edge stated at the witness floor (${WITNESS_FLOOR}) whose ends are both admitted referents` : null),
      name: 'multiple concrete instances coordinated: corroboration counted by perspective, not by mention',
      organ: "organs/hypergraph.js::judge's refs/sources on a bound claim",
      assembly: ASSEMBLY, stages: ['typed, directional relation'], definedInTermsOf: ['o8-primary'],
      organizes: 'separate statements of one claim are folded into a corroboration count that distinguishes two passages of one source from two sources — a distinction no single verdict carries',
      task: async () => {
        const e = spec.recurring;
        const claim = (reader.read(`${e.subject} ${e.verb} ${e.object}.`).claims ?? []).find((c) => c.verdict === 'bound');
        if (!claim) return { completed: false, detail: "the recurring edge's own claim did not bind" };
        const corr = claim.corroboration ?? {};
        return { completed: Number(corr.passages ?? 0) >= WITNESS_FLOOR && corr.sources != null, detail: `passages=${corr.passages}, sources=${corr.sources} — counted apart` };
      },
      arms: {
        // A verdict is one bit; it cannot say how many perspectives stand behind it.
        lowerOrder: async () => withheld(!!spec.recurring, 'the per-passage provenance withheld; only the bare verdict available', () => false),
        arbitrary: async () => redealCountAgainstExactNull(edges, spec.recurring, WITNESS_FLOOR),
        discrimination: async () => against(!!spec.specimen, 'a claim the material states once must not report corroboration at the witness floor', () => {
          const single = edges.find((x) => (x.refs?.length ?? 0) === 1);
          if (!single) return false;
          const claim = (reader.read(`${single.subject} ${single.verb} ${single.object}.`).claims ?? []).find((c) => c.verdict === 'bound');
          return Number(claim?.corroboration?.passages ?? 0) >= WITNESS_FLOOR;
        }),
      },
    },

    // ── 10 · Abstract ───────────────────────────────────────────────────
    {
      id: 'o10-abstract', order: 10,
      requires: () => (!spec.slot ? 'subject+verb slot with two or more distinct fillers' : null),
      name: 'a variable quantified over a category: the whole filler set of an open slot',
      organ: 'organs/hypergraph.js::queryFillers',
      assembly: ASSEMBLY, stages: ['typed, directional relation'], definedInTermsOf: ['o9-concrete'],
      organizes: "instance-level verdicts are generalised into a slot with a range, so the question 'who are ALL the X that Y' has an answer no single instance carries",
      task: async () => {
        const fillers = queryFillers(edges, { subject: spec.slot.subject, verb: spec.slot.verb });
        const empty = queryFillers(edges, { subject: ABSENT_NAME, verb: spec.slot.verb });
        return {
          completed: (fillers?.length ?? 0) >= 2 && (empty?.length ?? 0) === 0,
          detail: `"${spec.slot.subject} ${spec.slot.verb} __" ranges over ${fillers?.length ?? 0} filler(s); an absent subject ranges over ${empty?.length ?? 0}`,
        };
      },
      arms: {
        // Checking one instance can never return a SET.
        lowerOrder: async () => withheld(!!spec.slot, 'the open slot withheld; only instance-level claim checking available', () => false),
        // Same objects, same group sizes; which subject+verb each is filed under, dealt.
        arbitrary: async () => shuffled(DRAWS, (seed) => {
          const objects = seededShuffle(edges.map((x) => x.object), seed);
          const redealt = edges.map((x, i) => ({ ...x, object: objects[i], end2: objects[i] }));
          return { changed: redealt.some((x, i) => x.object !== edges[i].object), value: redealt };
        }, (redealt) => {
          const want = new Set((spec.slot.fillers ?? []).map((f) => String(f.object ?? f.end2 ?? f).toLowerCase()));
          const got = new Set((queryFillers(redealt, { subject: spec.slot.subject, verb: spec.slot.verb }) ?? []).map((f) => String(f.object ?? f.end2 ?? f).toLowerCase()));
          return got.size === want.size && [...want].every((v) => got.has(v));
        }),
        discrimination: async () => against(!!control, `the same slot queried against different content (${control?.key}) must not return the same range`,
          () => (queryFillers(edgesOf(control.reader), { subject: spec.slot.subject, verb: spec.slot.verb })?.length ?? 0) >= 2),
      },
    },

    // ── 11 · Formal ─────────────────────────────────────────────────────
    {
      id: 'o11-formal', order: 11,
      name: "one hypothesis tested against a constructed null: is this edge's connector asserted, or an artefact",
      organ: "organs/asserted.js (the assertion tier), read off hypergraph.js's own edge.assertion",
      assembly: ASSEMBLY, stages: ['typed, directional relation'], definedInTermsOf: ['o10-abstract'],
      organizes: "a slot's contents stop being taken as recovered fact and become a hypothesis with a support count and a null it has to clear — a relation among variables, not a report about instances",
      task: async () => {
        const withAssertion = edges.filter((e) => e.assertion);
        if (!withAssertion.length) return GAP('no edge carried an assertion record');
        const corroborated = withAssertion.filter((e) => e.assertion.standing === 'corroborated');
        const single = withAssertion.filter((e) => e.assertion.standing === 'single-witness');
        // Coverage alone is not enough (asserted.js types every edge); the
        // reading must exhibit BOTH standings or it discriminates nothing.
        return {
          completed: withAssertion.length === edges.length && corroborated.length + single.length === withAssertion.length && corroborated.length > 0 && single.length > 0,
          detail: `${withAssertion.length}/${edges.length} edges carry a standing — ${corroborated.length} corroborated, ${single.length} single-witness`,
        };
      },
      arms: {
        lowerOrder: async () => withheld(edges.length > 0, "the null withheld; only the edge's own existence available", () => false),
        // Redeal the LABEL, not the counts: the exact chance an arbitrary
        // same-size draw of "corroborated" lands entirely on the edges that
        // genuinely clear the witness floor.
        arbitrary: async () => {
          const n = edges.length;
          const K = edges.filter((e) => (e.assertion?.statements ?? e.statements ?? 0) >= WITNESS_FLOOR).length;
          const k = edges.filter((e) => e.assertion?.standing === 'corroborated').length;
          if (!(k > 0 && k < n)) return { completed: false, perturbed: false, draws: 1, fired: 0, detail: 'no corroborated edges, or every edge is — a redeal of which edges carry the label has nothing to vary' };
          const pHit = Math.exp(logChoose(K, k) - logChoose(n, k));
          const completed = pHit >= ARBITRARY_ALPHA;
          return {
            completed, perturbed: true, draws: 1, fired: completed ? 1 : 0,
            detail: `exact P(an arbitrary same-size redeal of the "corroborated" label lands entirely on genuine floor-clearers) = ${pHit < 1e-6 ? pHit.toExponential(2) : pHit.toFixed(4)} (${K} of ${n} edges clear the floor; ${k} carry the label) — ${completed ? `at or above alpha ${ARBITRARY_ALPHA}, so the labelling is not doing real work` : `below alpha ${ARBITRARY_ALPHA}, so the real derivation is not explained by chance`}`,
          };
        },
        discrimination: async () => against(true, "a word-salad copy must not yield corroborated standings at the real material's rate", () => {
          const r = READER([{ ref: 'salad#0', text: readSalad(0) }], { pool: material.passages });
          const corr = edgesOf(r).filter((e) => e.assertion?.standing === 'corroborated').length;
          const realCorr = edges.filter((e) => e.assertion?.standing === 'corroborated').length;
          return corr >= realCorr && realCorr > 0;
        }),
      },
    },

    // ── 12 · Systematic ─────────────────────────────────────────────────
    {
      id: 'o12-systematic', order: 12,
      requires: () => (!spec.specimen ? 'edge whose two ends are both admitted referents' : null),
      name: 'many formal relations coordinated into one system, ordered by presupposition',
      organ: 'the-fold/verification.js::verificationTasksFor (the nine-cell grid)',
      assembly: ASSEMBLY, stages: ['typed, directional relation', 'altitude'], definedInTermsOf: ['o11-formal'],
      organizes: 'separate checks are ordered so Existence gates Structure gates Interpretation — a referent that fails to exist makes downstream cells typed GAPS rather than falses, which no single check can produce',
      task: async () => {
        const e = spec.specimen;
        const rep = reader.read(`${e.subject} ${e.verb} ${e.object}.`);
        const tasks = verificationTasksFor({ hgReport: rep, hgClaim: (rep.claims ?? [])[0] ?? null, cursor: 'mhc' });
        const absentRep = reader.read(`${ABSENT_NAME} ${e.verb} ${e.object}.`);
        const absentTasks = verificationTasksFor({ hgReport: absentRep, hgClaim: (absentRep.claims ?? [])[0] ?? null, cursor: 'mhc' });
        const downstream = absentTasks.filter((t) => ['Link', 'Network', 'Lens', 'Paradigm'].includes(t.terrain));
        return {
          completed: tasks.length === 9 && downstream.every((t) => t.verdict !== 'fails'),
          detail: `${tasks.length} cells (${verificationSummary(tasks)}); with a non-existent subject, downstream cells are ${[...new Set(downstream.map((t) => t.verdict))].join(', ') || 'absent'}`,
        };
      },
      arms: {
        // One verdict has one axis; it cannot tell "checked and false" from
        // "could not be checked because its presupposition failed".
        lowerOrder: async () => withheld(edges.length > 0, 'the grid withheld; only a single claim verdict available', () => false),
        // The grid's coordination is that all nine cells describe THE SAME claim
        // against THE SAME report; re-pair the report with a claim of another verdict.
        arbitrary: async () => shuffled(DRAWS, (seed) => {
          const e = spec.specimen;
          const mineRep = reader.read(`${e.subject} ${e.verb} ${e.object}.`);
          const mineClaim = (mineRep.claims ?? [])[0] ?? null;
          const theirsClaim = (reader.read(`${e.object} ${e.verb} ${e.subject}.`).claims ?? [])[0] ?? null;
          if (!mineClaim || !theirsClaim || mineClaim.verdict === theirsClaim.verdict) return { changed: false, value: null };
          const pick = seededShuffle([mineClaim, theirsClaim], seed)[0];
          return { changed: pick !== mineClaim, value: { rep: mineRep, claim: pick, mineClaim } };
        }, (mixed) => {
          if (!mixed) return false;
          const grid = (claim) => verificationTasksFor({ hgReport: mixed.rep, hgClaim: claim, cursor: 'mhc' }).map((t) => `${t.terrain}=${t.verdict}`).join('|');
          return grid(mixed.mineClaim) === grid(mixed.claim);
        }),
        discrimination: async () => against(true, 'a claim with no material at all must produce gaps, not a full grid of holds', () => {
          const rep = READER([], {}).read('anything happened somewhere.');
          return verificationTasksFor({ hgReport: rep, hgClaim: null, cursor: 'mhc' }).filter((t) => t.verdict === 'holds').length >= 4;
        }),
      },
    },

    // ── 13 · Metasystematic ─────────────────────────────────────────────
    {
      id: 'o13-metasystematic', order: 13,
      requires: () => (spec.sourceReaders.length < 2 ? 'two or more sources or passages that can each be read as their own system'
        : !spec.corroboratedClaim ? 'claim two or more of its systems independently bind'
        : !spec.singleClaim ? 'claim exactly one of its systems binds' : null),
      name: 'several whole systems compared: a standing no single system carries',
      organ: 'organs/capacity-runner.js::mergeTestimony over per-system hypergraph readings',
      assembly: ASSEMBLY, stages: ['typed, directional relation', 'population'], definedInTermsOf: ['o12-systematic'],
      organizes: "each source's whole verdict-system is treated as one witness, and the STANDING of a claim across those witnesses — corroborated, or a lone voice — becomes the finding: a property of the set that no member of it carries",
      task: async () => {
        const corr = mergeTestimony(spec.corroboratedClaim.readings);
        const lone = mergeTestimony(spec.singleClaim.readings);
        // Below the merge the two claims read identically (a system saying
        // "holds"); only the comparison across systems separates them.
        const a = spec.corroboratedClaim.readings.find((r) => r.verdict === 'holds');
        const b = spec.singleClaim.readings.find((r) => r.verdict === 'holds');
        const noMemberCarriesStanding = [...spec.corroboratedClaim.readings, ...spec.singleClaim.readings].every((r) => r.standing === undefined);
        const ce = spec.corroboratedClaim.edge, se = spec.singleClaim.edge;
        return {
          completed: corr.case === 'AGREE' && corr.standing === 'corroborated' && lone.case === 'SINGLE' && lone.standing === 'single' && !!a && !!b && a.verdict === b.verdict && noMemberCarriesStanding,
          detail: `${spec.sourceReaders.length} ${spec.bySource ? 'sources' : 'passages'} read as systems. "${ce.subject} ${ce.verb} ${ce.object}" bound by ${spec.corroboratedClaim.holds} -> ${corr.case}/${corr.standing}; "${se.subject} ${se.verb} ${se.object}" bound by ${spec.singleClaim.holds} -> ${lone.case}/${lone.standing}. Below the merge both read identically (a system saying "${a?.verdict}").`,
        };
      },
      arms: {
        lowerOrder: async () => {
          const corr = mergeTestimony(spec.corroboratedClaim.readings);
          const lone = mergeTestimony(spec.singleClaim.readings);
          const differ = corr.standing !== lone.standing;
          const a = spec.corroboratedClaim.readings.find((r) => r.verdict === 'holds');
          const b = spec.singleClaim.readings.find((r) => r.verdict === 'holds');
          return {
            completed: differ && !!a && !!b && a.verdict !== b.verdict,
            perturbed: differ,
            detail: differ ? `one system says "${a?.verdict}" for both claims; the merges say ${corr.standing} and ${lone.standing}` : "the two claims' merges do not differ, so there is no cross-system finding for a single system to fail to reach",
          };
        },
        // Destroy the claim-GROUPING (mergeTestimony is invariant to source
        // identity by construction, so shuffling who-said-what is unlicensed).
        arbitrary: async () => shuffled(DRAWS, (seed) => {
          const clean = spec.singleClaim.readings;
          const mixed = seededShuffle([...clean, ...spec.corroboratedClaim.readings], seed);
          const counts = (rs) => `${rs.filter((r) => r.verdict === 'holds').length}/${rs.filter((r) => r.verdict === 'refused').length}`;
          return { changed: counts(mixed) !== counts(clean), value: mixed };
        }, (mixed) => {
          const clean = mergeTestimony(spec.singleClaim.readings);
          const got = mergeTestimony(mixed);
          return got.case === clean.case && got.standing === clean.standing;
        }),
        discrimination: async () => {
          const e = spec.corroboratedClaim.edge;
          const readings = spec.readAcross({ subject: e.object, verb: e.verb, object: e.subject });
          const holds = readings.filter((r) => r.verdict === 'holds').length;
          const merged = mergeTestimony(readings);
          return { completed: merged.standing === 'corroborated', perturbed: holds < spec.corroboratedClaim.holds, detail: `reversed claim bound by ${holds} of ${readings.length} systems -> ${merged.case}/${merged.standing}` };
        },
      },
    },
  ]);
}

// ── run ───────────────────────────────────────────────────────────────────

/** Read a material and its control, derive the specimens, run the battery
 * through khora's mhc.js, and read the stage off it with mhc.js's own rule.
 * `priors` is the list the assembled reader was handed (READING-POLICY P3). */
export async function runLadder({ material, control: controlMaterial, READER, priors, reader: prebuilt = null }) {
  const reader = prebuilt ?? READER(material.passages);
  const index = indexFor(material.passages);
  const control = controlMaterial
    ? { key: controlMaterial.sources.map((s) => s.label ?? s.key).join(' + '), reader: READER(controlMaterial.passages), index: indexFor(controlMaterial.passages) }
    : null;
  const spec = deriveSpec(material, reader, index, control, READER);
  const items = buildItems({ material, reader, index, spec, control, READER });
  // Commons's scale first (the cross-reference, and the runs the floors reuse),
  // then the floor ladder the stage is read on.
  const report = await runBattery(items, {}, { assembly: ASSEMBLY, priors, material: material.sources.map((s) => s.label ?? s.key).join(' + ') });
  const stage = stageFrom(report);
  const floorItems = floorItemsOf(items, floorOnlyItems({ material, spec }));
  const floors = await runFloors(floorItems, report);
  // The declarations themselves (what each item organizes, and over what), so
  // the page can print an item's axioms-1-and-2 claims beside its verdict.
  const declare = ({ id, order, floor, commonsId, name, organ, stages, organizes, definedInTermsOf }) => ({ id, order, floor, commonsId, name, organ, stages, organizes, definedInTermsOf: definedInTermsOf ?? [] });
  const declared = items.map(declare);
  floors.declared = floorItems.map(declare);
  return { report, stage, floors, declared, spec, reader, index, control, views: viewsOf({ material, reader, index, spec }) };
}

/** What each layer READ, for the page to show beside the item's verdict —
 * computed from the same reader, index and specimens the items ran on. */
function viewsOf({ material, reader, index, spec }) {
  const edges = spec.edges;
  // 5 — referents and the surfaces each gathered
  const groups = new Map();
  for (const ev of index.events ?? []) {
    if (!groups.has(ev.referent_id)) groups.set(ev.referent_id, new Set());
    groups.get(ev.referent_id).add(ev.surface);
  }
  const referents = [...groups.entries()].map(([id, s]) => ({ id, name: index.represent(id), surfaces: [...s] }))
    .sort((a, b) => b.surfaces.length - a.surfaces.length || String(a.name).localeCompare(String(b.name)));
  // 7 — pronoun bindings and refusals
  const sentences = splitSentences(material.text);
  const disc = discoverReferents(extractSurfaces(sentences, {}), {});
  const map = new Map(disc.events.map((e) => [e.surface, e.referent_id]));
  const pron = resolvePronouns(sentences, map, { minActivation: 0.05, minMargin: 0.2 }) ?? {};
  const nameOfRef = new Map();
  for (const ev of disc.events) { const prev = nameOfRef.get(ev.referent_id); if (!prev || ev.surface.length > prev.length) nameOfRef.set(ev.referent_id, ev.surface); }
  // 10 — every open slot the reading fills, largest range first
  const slotMap = new Map();
  for (const e of edges) {
    const k = `${e.subject}\u0000${e.verb}`;
    if (!slotMap.has(k)) slotMap.set(k, { subject: e.subject, verb: e.verb });
  }
  const slots = [...slotMap.values()].map((s) => ({ ...s, fillers: (queryFillers(edges, { subject: s.subject, verb: s.verb }) ?? []).map((f) => f.object ?? f.end2 ?? f) }))
    .sort((a, b) => b.fillers.length - a.fillers.length);
  // 12 — the grid for the specimen and for the same claim with a subject nobody is
  let grid = null;
  if (spec.specimen) {
    const e = spec.specimen;
    const rep = reader.read(`${e.subject} ${e.verb} ${e.object}.`);
    const absentRep = reader.read(`${ABSENT_NAME} ${e.verb} ${e.object}.`);
    grid = {
      claim: `${e.subject} ${e.verb} ${e.object}.`, absentClaim: `${ABSENT_NAME} ${e.verb} ${e.object}.`,
      tasks: verificationTasksFor({ hgReport: rep, hgClaim: (rep.claims ?? [])[0] ?? null, cursor: 'mhc' }),
      absentTasks: verificationTasksFor({ hgReport: absentRep, hgClaim: (absentRep.claims ?? [])[0] ?? null, cursor: 'mhc' }),
    };
  }
  // 13 — the systems and, where measured, the two claims' merges
  const merges = [spec.corroboratedClaim, spec.singleClaim].filter(Boolean).map((c) => ({ edge: c.edge, readings: c.readings, holds: c.holds, merged: mergeTestimony(c.readings) }));
  return {
    units: auditUnits(material.text, spec.units), premiseFloor: PREMISE_FLOOR, premises: spec.premises,
    absentName: ABSENT_NAME, referents, corefAgreement: spec.corefAgreement,
    // `regime` is the organ's own denominator: in the refused regime a frame that
    // carries a name is skipped without adjudication and files no gap, so the
    // page can say how many pronouns were never read rather than imply none.
    pronouns: { bindings: (pron.bindings ?? []).map((b) => ({ ...b, name: nameOfRef.get(b.referentId) ?? b.referentId })), gaps: pron.gaps ?? [], regime: pron.regime ?? null },
    edges, slots, grid, systems: spec.sourceReaders.map((s) => s.ref), bySource: spec.bySource, merges,
  };
}

// ── the priors each floor consumes, and the arm that withholds them ───────
// A floor is defined in terms of the floor below AND the priors its organ is
// handed. The three MHC arms never touch a prior; this arm does: the floor's
// task is run again with one prior withheld, and the prior is said to have
// EARNED ITS KEEP at that floor when the task no longer completes without it,
// or to have ADDED NOTHING on this material when it still does. It changes no
// floor's verdict — it is a finding about the prior, not about the floor.
//
// What each floor's organ is handed on this page (the ASSEMBLY above):
//   F0  spans.js::splitSentences derives the material's own abbreviations, so
//       "Mr." stays whole — a prior measured from the material, withholdable
//       by cutting with none
//   F1  cast.js::makeReferentIndex reads the script's capitalisation and the
//       material's own recurrence; no shipped prior is threaded into it here
//   F2, F3, F5  the relation reader (holodeck-reader.js) is built over the
//       part-of-speech prior, the morphology prior (same-act widened by the
//       lemmatizer) and the stance class; each has a switch, so the page can
//       hand this arm a reader built without one (`withhold(key)`)
//   F4, F6  no organ on this page, nothing consumed
export const PRIORS_OF = Object.freeze({
  F0: [{ key: 'abbreviations', what: 'abbreviations derived from the material itself (spans.js::deriveAbbreviations)' }],
  F1: [],
  F2: [{ key: 'posPrior', what: 'part of speech' }, { key: 'morphology', what: 'morphology — same-act widened by the lemmatizer' }, { key: 'stance', what: 'stance class — same-act widened by stance' }],
  F3: [{ key: 'posPrior', what: 'part of speech' }, { key: 'morphology', what: 'morphology — same-act widened by the lemmatizer' }, { key: 'stance', what: 'stance class — same-act widened by stance' }],
  F4: [],
  F5: [{ key: 'posPrior', what: 'part of speech' }, { key: 'morphology', what: 'morphology — same-act widened by the lemmatizer' }, { key: 'stance', what: 'stance class — same-act widened by stance' }],
  F6: [],
});
export const PRIOR_NOTE = Object.freeze({
  F1: 'no shipped prior: the name rule reads the script’s capitalisation and the material’s own recurrence',
  F4: 'no organ on this page, nothing consumed',
  F6: 'no organ on this page, nothing consumed',
});
const priorWord = (a) => (!a.withheld ? 'could not withhold' : a.completed ? 'added nothing here — the floor completed without it' : 'needed — the floor did not complete without it');

/** Run the prior-withheld arm on a ladder already scored (`L` from runLadder),
 * for every floor whose task ran. `withhold(key)` is the page's: it returns a
 * READER built without that prior (async), or null where it has no switch.
 * Writes `L.priorArms[floor] = [{ key, what, withheld, completed, detail, word }]`. */
export async function runPriorArms(L, { material, withhold = null } = {}) {
  const out = {};
  const spec = L.spec, text = material.text;
  const variants = new Map();
  const readerWithout = async (key) => {
    if (variants.has(key)) return variants.get(key);
    let r = null;
    try { const RV = withhold ? await withhold(key) : null; r = RV ? RV(material.passages) : null; } catch { r = null; }
    variants.set(key, r);
    return r;
  };
  for (const f of L.floors.floors) {
    const declared = PRIORS_OF[f.floor] ?? [];
    const item = f.items[0];
    const ran = item && item.status === 'passed';   // runItem runs the task only when the arms hold
    const rows = [];
    for (const pr of declared) {
      if (!ran) { rows.push({ ...pr, withheld: false, completed: null, detail: `the floor’s task did not run (${item?.status ?? 'no item'}), so nothing can be withheld from it` }); continue; }
      if (f.floor === 'F0') {
        const a = auditUnits(text, splitSentences(text, { abbreviations: [] }).map((u) => (typeof u === 'string' ? { text: u, offset: text.indexOf(u) } : u)));
        rows.push({ ...pr, withheld: true, completed: a.ok, detail: `cut with no abbreviation knowledge: ${a.n} units, ${a.reopen} re-open by byte address, ${a.inWord} cuts inside a word — the F0 task cannot tell a sentence from a fragment, only an address from a guess` });
        continue;
      }
      if (f.floor === 'F5') { rows.push({ ...pr, withheld: false, completed: null, detail: 'F5 reads across source systems; this arm does not re-run that read here' }); continue; }
      const rv = await readerWithout(pr.key);
      if (!rv) { rows.push({ ...pr, withheld: false, completed: null, detail: 'the page handed no reader built without it' }); continue; }
      const e = spec.specimen;
      if (!e) { rows.push({ ...pr, withheld: false, completed: null, detail: 'no specimen edge to re-run' }); continue; }
      if (f.floor === 'F2') {
        const ev = edgesOf(rv);
        const fwd = queryEdges(ev, { subject: e.subject, verb: e.verb, object: e.object }) ?? [], rev = queryEdges(ev, { subject: e.object, verb: e.verb, object: e.subject }) ?? [];
        rows.push({ ...pr, withheld: true, completed: fwd.length > 0 && rev.length === 0, detail: `without it: "${e.subject} —${e.verb}→ ${e.object}" stated ${fwd.length}, its reverse ${rev.length}; ${ev.length} edges read (${spec.edges.length} with it)` });
      } else if (f.floor === 'F3') {
        const st = rv.read(`${e.subject} ${e.verb} ${e.object}.`), rs = rv.read(`${e.object} ${e.verb} ${e.subject}.`);
        const b1 = (st.claims ?? []).some((c) => c.verdict === 'bound'), b2 = (rs.claims ?? []).some((c) => c.verdict === 'bound');
        rows.push({ ...pr, withheld: true, completed: b1 && !b2, detail: `without it: stated → ${(st.claims ?? []).map((c) => c.verdict).join(',') || 'no claim'}; reversed → ${(rs.claims ?? []).map((c) => c.verdict).join(',') || 'no claim'}` });
      }
    }
    out[f.floor] = rows.map((r) => ({ ...r, word: priorWord(r) }));
  }
  L.priorArms = out;
  return out;
}

/** Check one claim against the material's own edges (order 8's judge), for the
 * page's claim box. */
export function judge(reader, claim) {
  const rep = reader.read(String(claim ?? ''));
  return (rep.claims ?? []).map((c) => ({ end1: c.end1, label: c.label, end2: c.end2, verdict: c.verdict, polarity: c.polarity, refs: c.refs ?? [], corroboration: c.corroboration ?? null }));
}
