// reading-timeline.js — a text is read in order, and what has been read keeps changing what was thought.
//
// The layered pipeline reads the whole text once per layer. A reader does not: it meets a sentence,
// forms a reading, and the NEXT sentence can overturn it — a name it could not place is defined two
// sentences on; "Curie" turns out to be "Marie Curie"; "she" was nobody until a name arrived; a
// relation it bound to the wrong endpoint is rebound. This organ replays that. It reads the text as
// of the end of each sentence (the reading of a PREFIX, never a reading that has seen the future),
// then diffs consecutive prefixes: every difference is a REVISION, and a revision names what
// changed, what it was, what it became, and the sentence whose arrival changed it.
//
// Nothing here owns a prior or a parser: the classifier, the sentence splitter and the engine's own
// surface/referent/pronoun organs are injected. A snapshot is a candidate reading — as revisable as
// the next sentence — never a settled fact.
export const READING_TIMELINE_SCHEMA = "EOReadingTimeline@2";

// ── THE MODEL: spans are not referents; the link between them is an event ───────────────────────────────────
//   · every asserted token has an id for ITS OWN span: spn_<hash(source, start, end)> — content-addressed, and
//     independent of whatever it is later taken to be;
//   · a referent is INSTANTIATED (INS) once, as an event, and its id is the hash of that event: ref_<hash> —
//     never a slug of a spelling, so a being whose name grows or whose mentions move keeps the one address;
//   · a mention is CONNECTED (CON) to a referent by an event that names both. Reassigning appends another CON
//     that supersedes the first; severing is a CON to nothing; two beings found to be one is a SYN of their ids.
//     Nothing is edited. The current state is a FOLD over the log at a cursor (foldLog), exactly as the log-is-
//     memory canon has it — and a person's own CON / SYN rides on top the same way, attributed to them.
// Each event names its cell — operator(Site, Stance) — and isCoherent() is the canon's grain check, run in the tests.
export const CELLS = Object.freeze({
  INS: Object.freeze({ site: "Entity", stance: "Making" }),
  CON: Object.freeze({ site: "Link", stance: "Binding" }),
  SYN: Object.freeze({ site: "Link", stance: "Making" }),
  SEG: Object.freeze({ site: "Link", stance: "Dissecting" }),
});
const OP = { NUL: ["Differentiate", "Existence"], SIG: ["Relate", "Existence"], INS: ["Generate", "Existence"], SEG: ["Differentiate", "Structure"], CON: ["Relate", "Structure"], SYN: ["Generate", "Structure"], DEF: ["Differentiate", "Significance"], EVA: ["Relate", "Significance"], REC: ["Generate", "Significance"] };
const SITE = { Void: ["Existence", "Ground"], Entity: ["Existence", "Figure"], Kind: ["Existence", "Pattern"], Field: ["Structure", "Ground"], Link: ["Structure", "Figure"], Network: ["Structure", "Pattern"], Atmosphere: ["Significance", "Ground"], Lens: ["Significance", "Figure"], Paradigm: ["Significance", "Pattern"] };
const STANCE = { Clearing: ["Differentiate", "Ground"], Dissecting: ["Differentiate", "Figure"], Unraveling: ["Differentiate", "Pattern"], Tending: ["Relate", "Ground"], Binding: ["Relate", "Figure"], Tracing: ["Relate", "Pattern"], Cultivating: ["Generate", "Ground"], Making: ["Generate", "Figure"], Composing: ["Generate", "Pattern"] };
/** the canon's coherence guard: Act and Site share Domain, Act and Stance share Mode, Site and Stance share grain — and no desert cell (SYN at Ground) */
export function isCoherent(ev) {
  const o = OP[ev?.op], si = SITE[ev?.site], st = STANCE[ev?.stance];
  if (!o || !si || !st) return false;
  if (ev.op === "SYN" && si[1] === "Ground") return false;
  return o[1] === si[0] && o[0] === st[0] && si[1] === st[1];
}
const canon = (x) => JSON.stringify(x, (_k, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v));

/**
 * The state at a cursor, folded from the log (and, on top, a person's own events). Pure.
 * @returns {{mentions: Map, referents: Map, assign: Map<string,string|null>, history: Map<string,Array>, alias: Map}}
 *   `referents` holds only referents that have not been folded into another; each lists its current mentions.
 */
export function foldLog(log = [], { overlay = [] } = {}) {
  const mentions = new Map(), all = new Map(), assign = new Map(), history = new Map(), alias = new Map(), cons = new Map();
  const resolve = (r) => { let g = 0; while (r && alias.has(r) && g++ < 64) r = alias.get(r); return r; };
  for (const ev of [...log, ...overlay]) {
    if (ev.op === "INS" && ev.kind === "mention") mentions.set(ev.span, { id: ev.span, s: ev.at[0], e: ev.at[1], text: ev.text, kind: ev.mentionKind ?? "name" });
    else if (ev.op === "INS" && ev.kind === "referent") all.set(ev.ref, { id: ev.ref, engine: ev.engine ?? null, born: ev.frontier ?? null, giver: ev.giver ?? "reader", seed: ev.seed ?? null });
    else if (ev.op === "CON") { assign.set(ev.span, ev.ref ?? null); cons.set(ev.span, ev.id); (history.get(ev.span) ?? history.set(ev.span, []).get(ev.span)).push(ev); }
    else if (ev.op === "SYN") for (const f of ev.from ?? []) if (f !== ev.into) alias.set(f, ev.into);
  }
  const referents = new Map();
  for (const [id, r] of all) if (!alias.has(id)) referents.set(id, { ...r, mentions: [], absorbed: [] });
  for (const [from, to] of alias) { const root = resolve(from); if (referents.has(root)) referents.get(root).absorbed.push(from); }
  for (const [span, ref] of assign) { const root = resolve(ref); const m = mentions.get(span); if (root && referents.has(root) && m) referents.get(root).mentions.push(m); }
  for (const r of referents.values()) {
    r.mentions.sort((a, b) => a.s - b.s);
    const names = r.mentions.filter((m) => m.kind === "name").map((m) => m.text);
    r.name = names.sort((a, b) => b.length - a.length)[0] ?? null;
    r.surfaces = [...new Set(r.mentions.map((m) => m.text))];
  }
  return { mentions, referents, assign, history, alias, resolve, cons };
}

const topUpos = (c) => (c?.found && c.candidates?.length ? c.candidates[0].upos : null);
const labelOf = (c) => {
  if (!c?.found) return { upos: null, ambiguous: false, attested: null, via: [] };
  const via = (c.via ?? []).map((v) => v.step).filter((x) => x !== "edge-punctuation" && x !== "apostrophe" && x !== "unicode");
  return { upos: topUpos(c), ambiguous: c.candidates.length > 1, attested: c.attested ?? (c.inferred ? "act" : "treebank"), via, evidence: c.evidence ?? null };
};
const sameLabel = (a, b) => a.upos === b.upos && a.attested === b.attested;

/** every occurrence of `surface` (whole-word) in `text`, as [start, end] */
const occurrences = (text, surface) => {
  const out = [];
  if (!surface) return out;
  const esc = surface.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, "gu");
  for (const m of text.matchAll(re)) out.push([m.index, m.index + surface.length]);
  return out;
};

/** names and pronouns of one prefix, each bound to the referent it currently belongs to */
function corefOf(prefixSents, prefixText, deps, { minActivation, minMargin, prior = null }) {
  const { extractSurfaces, discoverReferents, resolvePronouns } = deps;
  const out = { referents: [], mentions: [], addresses: prior, merges: [] };
  if (!extractSurfaces || !discoverReferents || !prefixSents.length) return out;
  let discovery;
  // AN ADDRESS IS GIVEN AT BIRTH AND KEPT (surfaces.js `prior`): the previous prefix's addresses are handed to this one, so a
  // being keeps one id while its best surface grows, and two beings folding into one is reported as a merge — never a silent rename.
  try { discovery = discoverReferents(extractSurfaces(prefixSents, {}), { prior }); } catch { return out; }
  out.merges = discovery?.merges ?? [];
  const events = discovery?.events ?? [];
  // the engine hands back {born, next}; the caller keeps `refs` (each surface → the address it was given) — so the next prefix's prior is rebuilt here
  const norm = deps.diaNorm ?? ((x) => String(x ?? "").toLowerCase().trim());
  out.addresses = discovery?.addresses ? { born: discovery.addresses.born, next: discovery.addresses.next, refs: new Map([...(prior?.refs ?? []), ...events.map((e) => [norm(e.surface), e.referent_id])]) } : prior;
  if (!events.length) return out;
  const surfaceToRef = new Map(events.map((e) => [e.surface, e.referent_id]));
  const best = new Map();
  const members = new Map();
  for (const e of events) {
    const p = best.get(e.referent_id);
    if (!p || e.surface.length > p.length) best.set(e.referent_id, e.surface);
    (members.get(e.referent_id) ?? members.set(e.referent_id, new Set()).get(e.referent_id)).add(e.surface);
  }
  // the longest surface wins an overlap: "Marie Curie" is one mention, not "Marie" + "Curie" + "Marie Curie"
  const cands = [];
  for (const [surface, id] of surfaceToRef) for (const [s, e] of occurrences(prefixText, surface)) cands.push({ s, e, id });
  cands.sort((a, b) => (b.e - b.s) - (a.e - a.s) || a.s - b.s);
  for (const c of cands) {
    if (out.mentions.some((m) => m.s < c.e && c.s < m.e)) continue;
    out.mentions.push({ kind: "name", s: c.s, e: c.e, text: prefixText.slice(c.s, c.e), ref: c.id });
  }
  if (resolvePronouns) {
    try {
      const r = resolvePronouns(prefixSents, surfaceToRef, { minActivation, minMargin });
      for (const b of r?.bindings ?? []) out.mentions.push({ kind: "pronoun", s: b.offset, e: b.offset + b.pronoun.length, text: b.pronoun, ref: b.referentId });
      for (const g of r?.gaps ?? []) if (g?.offset != null && g.pronoun) out.mentions.push({ kind: "pronoun", s: g.offset, e: g.offset + g.pronoun.length, text: g.pronoun, ref: null });
    } catch { /* a reader that cannot bind pronouns still reads names */ }
  }
  out.mentions.sort((a, b) => a.s - b.s);
  for (const m of out.mentions) m.name = m.ref != null ? best.get(m.ref) ?? null : null;
  out.referents = [...best].map(([id, name]) => ({ id, name, born: out.addresses?.born?.get?.(id) ?? null, surfaces: [...members.get(id)].sort(), mentions: out.mentions.filter((m) => m.ref === id).length }));
  return out;
}

/**
 * @param {string} text
 * @param {{splitSentences: Function, wordsIn: (text:string, base:number)=>Array<{w:string,s:number,e:number}>,
 *   classifyAt: (prefixText:string)=>((form:string)=>object), extractSurfaces?: Function, discoverReferents?: Function,
 *   resolvePronouns?: Function, readClaims?: (prefixText:string)=>Array<object>}} deps
 * @param {{maxSnapshots?: number, minActivation?: number, minMargin?: number}} [opts]
 */
export function buildReadingTimeline(text, deps, opts = {}) {
  const { splitSentences, wordsIn, classifyAt, readClaims = null, hash } = deps;
  if (typeof splitSentences !== "function" || typeof wordsIn !== "function" || typeof classifyAt !== "function")
    throw new TypeError("buildReadingTimeline: splitSentences, wordsIn and classifyAt are injected — the organ owns no parser and no prior");
  if (typeof hash !== "function") throw new TypeError("buildReadingTimeline: hash is injected — an id is content-addressed, and the organ invents none");
  const { maxSnapshots = 40, minActivation = 0.05, minMargin = 0.2 } = opts;
  const src = String(text ?? "");
  const sents = splitSentences(src).map((s, i) => ({ n: i + 1, offset: s.offset, end: s.offset + s.text.length, text: s.text }));
  const n = sents.length;
  const words = [];
  sents.forEach((s, si) => { for (const w of wordsIn(s.text, s.offset)) words.push({ w: w.w, s: w.s, e: w.e, si }); });
  const stride = Math.max(1, Math.ceil(n / maxSnapshots));
  const fronts = [];
  for (let j = stride; j < n; j += stride) fronts.push(j);
  if (n) fronts.push(n);

  // ── identity: ids for spans, INS for referents, CON for the links, SYN for merges ──
  const sourceId = deps.sourceId ?? `src_${hash(src).slice(0, 16)}`;
  const spanId = (s0, e0) => `spn_${hash(`${sourceId}|${s0}|${e0}`).slice(0, 16)}`;
  const log = [];
  const emit = (body) => { const h = hash(canon(body)).slice(0, 16); const ev = { id: `evt_${h}`, ...body }; if (body.op === "INS" && body.kind === "referent") ev.ref = `ref_${h}`; log.push(ev); return ev; };
  const engineRef = new Map(), alias = new Map(), curCon = new Map(), seenMention = new Set();
  const resolve = (r) => { let g = 0; while (r && alias.has(r) && g++ < 64) r = alias.get(r); return r; };

  const snaps = [];
  // the engine only keeps an address when it is HANDED a prior — so the first prefix gets an empty one, and every later prefix the last one's
  let prior = { refs: new Map(), born: new Map(), next: 0 }; const bornAt = new Map();
  for (const f of fronts) {
    const prefixText = src.slice(0, sents[f - 1].end);
    const classify = classifyAt(prefixText);
    const tokens = new Map();
    for (const w of words) if (w.si < f) tokens.set(w.s, { w: w.w, s: w.s, e: w.e, ...labelOf(classify(w.w)) });
    const coref = corefOf(sents.slice(0, f).map((s) => ({ text: s.text, offset: s.offset, order: s.n - 1 })), prefixText, deps, { minActivation, minMargin, prior });
    prior = coref.addresses ?? prior;
    for (const r of coref.referents) { if (!bornAt.has(r.id)) bornAt.set(r.id, f); r.bornAt = bornAt.get(r.id); }
    let claims = [];
    if (readClaims) { try { claims = readClaims(prefixText).map((c) => ({ key: `${c.label}|${c.span ?? ""}|${c.s ?? ""}`, end1: c.end1, label: c.label, end2: c.end2, polarity: c.polarity ?? "+", located: c.located !== false, s: c.located === false ? null : (c.s ?? null), e: c.located === false ? null : (c.e ?? null), verdict: c.verdict ?? null, raw: c })); } catch { claims = []; } }
    // the identity layer for this prefix, in the helix's order: INS (referents), SYN (merges), then INS (mentions) and CON (their links)
    const merged = new Map();
    const insRef = (addr) => {
      if (!engineRef.has(addr)) {
        const seed = coref.mentions.filter((m) => m.ref === addr).sort((x, y) => x.s - y.s)[0];
        const ev = emit({ op: "INS", ...CELLS.INS, kind: "referent", frontier: f, engine: addr, seed: seed ? spanId(seed.s, seed.e) : null, giver: "reader", basis: "DEF.admit · name-variant coreference (surfaces/discoverReferents)" });
        engineRef.set(addr, ev.ref);
      }
      return engineRef.get(addr);
    };
    for (const r of [...coref.referents].sort((x, y) => (x.id < y.id ? -1 : 1))) insRef(r.id);
    for (const m of coref.merges ?? []) {
      const into = insRef(m.kept), from = (m.folded ?? []).map((a0) => insRef(a0)).filter((x) => x !== into);
      if (from.length) { emit({ op: "SYN", ...CELLS.SYN, frontier: f, from, into, witness: m.witness ?? null, giver: "reader", basis: m.basis ?? "two addresses' bearers cluster as one being under this reading's own evidence" }); for (const x of from) { alias.set(x, into); merged.set(x, into); } }
    }
    const present = new Set();
    for (const m of coref.mentions) {
      const id = spanId(m.s, m.e); present.add(id);
      if (!seenMention.has(id)) { seenMention.add(id); emit({ op: "INS", ...CELLS.INS, kind: "mention", span: id, at: [m.s, m.e], text: m.text, mentionKind: m.kind, frontier: f, giver: "reader" }); }
      const want = m.ref != null ? resolve(insRef(m.ref)) : null;
      const have = curCon.get(id);
      if (!have || resolve(have.ref) !== want) {
        if (!have && want == null) { curCon.set(id, { ref: null, con: null }); continue; }   // never bound, still not bound: nothing to say
        const ev = emit({ op: "CON", ...CELLS.CON, span: id, ref: want, supersedes: have?.con ?? null, frontier: f, giver: "reader", basis: want == null ? "unbound — the reader can no longer bind this mention" : have?.ref ? "reassigned by what was just read" : "bound by the reader" });
        curCon.set(id, { ref: want, con: ev.id });
      }
      m.id = id; m.engine = m.ref; m.ref = want;
    }
    for (const [id, have] of curCon) if (!present.has(id) && have.ref) { const ev = emit({ op: "CON", ...CELLS.CON, span: id, ref: null, supersedes: have.con, frontier: f, giver: "reader", basis: "severed — nothing the reading now admits is mentioned here" }); curCon.set(id, { ref: null, con: ev.id }); }
    for (const w of tokens.values()) w.id = spanId(w.s, w.e);
    for (const r of coref.referents) { r.engine = r.id; r.id = engineRef.get(r.engine); r.name = r.name; }
    snaps.push({ frontier: f, tokens, mentions: coref.mentions, referents: coref.referents, merged, claims, logTo: log.length });
  }

  // revisions: what the sentences just read changed about what had already been read
  const revisions = snaps.map(() => []);
  for (let i = 1; i < snaps.length; i++) {
    const a = snaps[i - 1], b = snaps[i], newFrom = sents[a.frontier]?.offset ?? Infinity;
    const cause = (at) => ({ sentence: sents.findIndex((s) => s.offset <= at && at < s.end) + 1 });
    for (const [s, tb] of b.tokens) {
      const ta = a.tokens.get(s); if (!ta || sameLabel(ta, tb)) continue;
      const ev = (tb.evidence ?? []).filter((x) => x.at && x.at[0] >= newFrom);
      revisions[i].push({ kind: "pos", s: tb.s, e: tb.e, text: tb.w, from: ta.upos ?? "no entry", to: tb.upos ?? "no entry", fromBy: ta.attested, toBy: tb.attested, evidence: tb.evidence ?? null,
        because: ev.length ? { ...cause(ev[0].at[0]), kinds: [...new Set(ev.map((x) => x.kind))], at: ev[0].at } : { sentence: b.frontier } });
    }
    const nameAt = (snap) => new Map(snap.mentions.map((m) => [m.s, m]));
    const ma = nameAt(a);
    for (const m of b.mentions) {
      const p = ma.get(m.s); if (!p) continue;
      if (p.kind !== m.kind || p.name === m.name) continue;
      revisions[i].push({ kind: m.kind === "pronoun" ? "pronoun" : "referent", ref: m.ref ?? null, s: m.s, e: m.e, text: m.text, from: p.name ?? (p.kind === "pronoun" ? "unresolved" : "—"), to: m.name ?? "unresolved", because: { sentence: b.frontier } });
    }
    // a name that grew: a mention that was "Curie" and is now inside the longer "Marie Curie"
    for (const m of b.mentions) {
      if (m.kind !== "name" || ma.has(m.s)) continue;
      const inner = a.mentions.filter((p) => p.kind === "name" && p.s >= m.s && p.e <= m.e && p.text !== m.text);
      if (inner.length) revisions[i].push({ kind: "referent", s: m.s, e: m.e, text: m.text, from: inner.map((p) => p.text).join(" + "), to: m.text, because: { sentence: b.frontier } });
    }
    // BEINGS, not spellings: the same address with a new best surface is one being whose name grew; two addresses folding into one is a merge;
    // an address that is neither carried on nor folded away is retracted.
    const refB = new Map(b.referents.map((r) => [r.id, r]));
    const folded = b.merged ?? new Map();
    for (const r of a.referents) {
      const nb = refB.get(r.id);
      if (nb && nb.name !== r.name) revisions[i].push({ kind: "referent-renamed", s: null, e: null, ref: r.id, text: r.id, from: r.name, to: nb.name, because: { sentence: b.frontier, why: "the same address — the being's best surface grew; the id was given at birth and kept" } });
      else if (!nb && folded.has(r.id)) { revisions[i].push({ kind: "referent-merged", s: null, e: null, ref: folded.get(r.id), text: r.id, from: `${r.id} (${r.name})`, to: folded.get(r.id), because: { sentence: b.frontier, why: "two addresses' bearers cluster as one being under this reading's own evidence — a SYN of the two ids" } }); }
      else if (!nb) revisions[i].push({ kind: "referent-retracted", s: null, e: null, ref: r.id, text: r.name, from: `${r.name} ×${r.mentions}`, to: "no longer established", because: { sentence: b.frontier, why: "no longer admitted by the engine at this length — its admission floor is derived from the text read so far, so a longer text can drop a referent a shorter one admitted" } });
    }
    const ca = new Map(a.claims.map((c) => [c.key, c]));
    for (const c of b.claims) {
      const p = ca.get(c.key); if (!p) continue;
      if (p.end1 !== c.end1 || p.end2 !== c.end2) revisions[i].push({ kind: "claim", s: c.s, e: c.e, text: c.label, from: `${p.end1} → ${p.end2}`, to: `${c.end1} → ${c.end2}`, because: { sentence: b.frontier } });
    }
    const cb = new Set(b.claims.map((c) => c.key));
    for (const p of a.claims) if (!cb.has(p.key)) revisions[i].push({ kind: "claim-retracted", s: p.s, e: p.e, text: p.label, from: `${p.end1} —${p.label}→ ${p.end2}`, to: "no longer bound", because: { sentence: b.frontier } });
  }
  return {
    schema: READING_TIMELINE_SCHEMA, unit: "utf16", stride, sentences: sents, words,
    sourceId, log,
    snapshots: snaps.map((sn, i) => ({ frontier: sn.frontier, logTo: sn.logTo, tokens: [...sn.tokens.values()], mentions: sn.mentions, referents: sn.referents, claims: sn.claims, revisions: revisions[i] })),
    revisions: revisions.flat(),
  };
}
