// stage.js — Stage@1: a reading's atoms as a stage HL can judge, and a claim read against it (SPEC: the reader emits a stage, HL reasons over it).
//
// The slice built here (build order M1 to M3): arrangements from atoms, claim ends BOUND to source anchors before any verdict (INS), two licenses
// with named givers (a figure's measure is functional; a superlative has one holder per kind), and HL's own read() for the verdict. No model, no
// score, no threshold. A missing license degrades to "unbound", never to "bound".
//
//   stageFromAtoms(atoms, { doc }) → Stage@1 { schema, doc, anchors, arrangements, licenses, gaps, hl }
//   judgeClaim(stage, claimAtoms, { licenses }) → { verdict: "E"|"C"|"N", hl, proofs: [{ atom, binds, lic, verdict, cites }], gaps }
//
// "E" here is never produced by this module alone: the atoms arm (atom-support.js) decides supported; this module adds what a license licenses.
import { createStage, addAnchor, addEdge, declareFunctional, read, BOUND, CONTRADICTED, CONTESTED, UNBOUND, BEYOND_REACH } from "../interpretation/hl.js";
import { dmdWindow } from "./activation.js";
import { createHyperlexicon, giveHyperlexiconAffordance, compositionAffordance, licenseStanding } from "./hyperlexicon.js";
import { meeters, canonical, argText, low, otherYears } from "./atom-support.js";
import { createForWhom } from "./for-whom.js";

export const STAGE_SCHEMA = "Stage@1";
export const LICENSES = Object.freeze([
  { id: "measure", kind: "functional", on: "has_*", giver: "the figure's measure: one value of a measure per being (time-keyed when the text gives a time)" },
  { id: "holder", kind: "functional", on: "most:*", giver: "the language's Degree feature: a superlative over a kind has one holder" },
]);
// The license rows are Hyperlexicon rows (kernel/hyperlexicon.js), not a list this file owns: a row is read by compositionAffordance and admitted
// by licenseStanding. A candidate row nominates and licenses nothing; a given row with no chemistry stamp and no charter binding licenses nothing.
export function defaultHyperlexicon() {
  let hl = createHyperlexicon();
  for (const L of LICENSES) hl = giveHyperlexiconAffordance(hl, { left: "functional", right: L.on, giver: L.giver, meta: { chemistry: true, yields: "exclusion", basis: "a functional relation admits one value per key (hl.js R2)" } });
  return hl;
}
const FIG = (a) => (a && typeof a === "object" && a.measure && a.base != null ? a : null);
const isHas = (p) => /^has_/.test(p);
const isMost = (p) => /^most:/.test(p);

// The license row that speaks for a relation, and what the hyperlexicon says of it. A missing or only-nominated row licenses nothing.
export const licenseRowFor = (rel) => LICENSES.find((L) => (L.on === "has_*" ? isHas(rel) : isMost(rel))) ?? null;
export function licenseStandingOf(L, hyperlexicon = defaultHyperlexicon()) { const aff = compositionAffordance(hyperlexicon, "functional", L.on); return { aff, ls: licenseStanding(aff) }; }
// FUNCTIONAL REGISTER for the identity exclusion (kernel/identity-exclusion.js `functional`): of these relations, which are one-valued, by whose word.
// `licensed` is rel → { license, giver, key, tier } for every relation a GIVEN hyperlexicon row licenses; `unlicensed` names each relation a row exists
// for and does not license (candidate, or given with no chemistry stamp or charter binding), with why: it convicts nothing. A relation no row speaks
// for is in neither: it is simply not declared. `key` is what the row is one-valued PER: a measure is one-valued per being; a superlative's holder is
// one-valued per kind, so it is keyed on the kind and no referent pair is ever convicted by it (the kind is the slot, not a referent).
export function functionalRegister(rels, { hyperlexicon = defaultHyperlexicon() } = {}) {
  const licensed = new Map(), unlicensed = [];
  for (const rel of new Set(rels)) {
    const L = licenseRowFor(rel); if (!L) continue;
    // a figure whose attribute the reading did not name has no key, so the measure license does not apply to it (as in stageFromAtoms)
    if (L.id === "measure" && /^has_(count|value)$/.test(rel)) { unlicensed.push({ rel, license: L.id, giver: L.giver, standing: "unkeyed", why: "the attribute is not named" }); continue; }
    const { aff, ls } = licenseStandingOf(L, hyperlexicon);
    if (ls.licensed) licensed.set(rel, { license: L.id, giver: aff.giver, key: L.id === "measure" ? "being" : "kind", tier: ls.tier });
    else unlicensed.push({ rel, license: L.id, giver: aff.giver ?? null, standing: aff.standing === "given" ? "ungrounded" : aff.standing, why: ls.why });
  }
  return { licensed, unlicensed };
}
// two NAMED ends are the same only if their names share a capitalised word: the reader's coreference is lenient on kind (two persons "meet"),
// identity is not
const caps = (t) => new Set(String(t ?? "").match(/\b\p{Lu}[\p{L}\p{N}'-]*/gu)?.map((w) => w.toLowerCase()) ?? []);
const namesClash = (x, y) => { const a = caps(argText(x)), b = caps(argText(y)); if (!a.size || !b.size) return false; for (const w of a) if (b.has(w)) return false; return true; };
const nameOf = (a) => (a.entity != null ? `@${a.entity}` : `#${a.value}`);

// PERSPECTIVE. Nothing is true everywhere: an assertion is true in a SENSE, and two assertions can conflict, or agree, only in the SAME sense. A reading is
// one author's view (a for-whom frame, for-whom.js: "a claim without a frame is a view from nowhere"), and what it holds, it holds in a sense:
//   holder  asserted by the author, or only reported ("NASA says")  (the layer an arrangement is on)
//   time    the years the clause's own adjuncts name ("in 1900")
//   tense   the clause's, carried for the record and NOT used to decide: the reader's tense is a heuristic (it reads "paid", "bought", "sold" as present;
//           measured on the 108 pairs, 3 of the 4 tense clashes it raised were that), and "was named" / "is named" are one fact in two tenses
// Two senses CLASH only where both STATE years and the years share none. A clash is a DIFFERENT SENSE: the two neither contradict nor support each other,
// and that is a typed gap (different_sense), never a verdict. Where one side states no years the sense is "unstated": the verdict stands and says so.
// A verdict is always "by this reading, in the sense it states it", never "everywhere".
export const senseOf = (a) => ({ holder: a.hedged ? "reported" : "asserted", tense: a.tense ?? null, time: a.time?.length ? [...a.time] : null });
export function senseStanding(c, s) {
  if (otherYears(c, s)) return { standing: "differs", why: `time: the claim is of ${c.time.join("/")}, the source of ${s.time.join("/")}` };
  return c.time && s.time ? { standing: "shared" } : { standing: "unstated" };
}
const frameOf = (doc) => createForWhom({ id: `reading:${doc}`, giver: `the author of ${doc}, as the reader read it`, question: "does this reading hold the claim, in the sense it states it?", ground: doc, medium: "text", knowing: "the reading's atoms, each with its span" });

// the kind a referent belongs to in this reading: is_a(x, kind)
const kindOf = (atoms, x, M) => atoms.find((k) => k.pred === "is_a" && !k.neg && k.args?.[0] && M.refMeet(k.args[0], x))?.args?.[1] ?? null;

export function stageFromAtoms(atoms, { doc = "doc", hyperlexicon = defaultHyperlexicon() } = {}) {
  const C = canonical(atoms), M = meeters(C, C, {});
  const hl = createStage(), anchors = new Map(), arrangements = [], gaps = [];
  const anchor = (a, kind) => { const id = a.entity != null ? `${doc}:${a.entity}` : `${doc}:v:${low(a.value)}`; if (!anchors.has(id)) { anchors.set(id, { id, kind, label: argText(a), figure: FIG(a), arg: a }); addAnchor(hl, id, kind); } return id; };
  for (const [i, a] of C.entries()) {
    const as = a.args ?? [];
    if (as.length === 2 && !isHas(a.pred) && !a.pred.startsWith("most:") && a.pred !== "is_a" && a.pred !== "named") {
      const s = anchor(as[0], "referent"), o = anchor(as[1], as[1].entity != null ? "referent" : "value");
      arrangements.push({ id: `a${i}`, rel: a.pred, s, o, polarity: a.neg ? "-" : "+", layer: a.hedged ? "reported" : "asserted", sense: senseOf(a), span: [a.start, a.end] });
    } else if (isHas(a.pred) && as.length === 2 && FIG(as[1])) {
      const s = anchor(as[0], "referent"), o = anchor(as[1], "quantity");
      arrangements.push({ id: `a${i}`, rel: a.pred, s, o, polarity: a.neg ? "-" : "+", layer: a.hedged ? "reported" : "asserted", sense: senseOf(a), span: [a.start, a.end], measure: as[1].measure });
    } else if (isMost(a.pred) && as.length === 1) {
      const K = kindOf(C, as[0], M);
      if (!K) { gaps.push({ kind: "no_kind", atom: a.text }); continue; }       // a superlative without its kind cannot be read
      const k = anchor(K, "kind"), h = anchor(as[0], "referent");
      arrangements.push({ id: `a${i}`, rel: a.pred, s: k, o: h, polarity: a.neg ? "-" : "+", layer: a.hedged ? "reported" : "asserted", sense: senseOf(a), span: [a.start, a.end] });
    }
  }
  // READINGS: a functional arrangement (a measure, a superlative) has one reading, its ends are fixed by what they are. A binary relation
  // between two referents carries no voice in the atoms, so its end order is a candidate, not a fact: decided only when the language's own
  // marking decides it, which this slice cannot see. A verdict that rests on an undecided reading is never committed (law: undecided degrades
  // to unbound).
  for (const r of arrangements) r.reading = (isHas(r.rel) || isMost(r.rel)) ? { decided: true, by: "functional ends are typed" } : { decided: false, candidates: [[r.s, r.o], [r.o, r.s]], by: null };
  for (const r of arrangements) if (r.layer === "asserted") addEdge(hl, { rel: r.rel, s: r.s, o: r.o, polarity: r.polarity, source: [`${doc}:${r.span[0]}-${r.span[1]}`] });
  const rels = [...new Set(arrangements.map((r) => r.rel))];
  const licenses = [];
  for (const rel of rels) for (const L of LICENSES) if (L.on === "has_*" ? isHas(rel) : isMost(rel)) {
    const { aff, ls } = licenseStandingOf(L, hyperlexicon);
    if (!ls.licensed) { licenses.push({ id: L.id, rel, giver: aff.giver ?? null, standing: aff.standing === "given" ? "ungrounded" : aff.standing, why: ls.why }); gaps.push({ kind: "license_not_given", license: L.id, rel, standing: aff.standing }); continue; }
    // REFUTATION PATH: a license is a claim about the world and the source can refute it. If the source itself holds two different values for one
    // key (one subject, one relation, asserted positively), the license is refuted for this reading and nothing is judged under it.
    // the key of a measure license is (being, what is measured): a figure whose attribute the reading did not name ("has_count", "has_value") has
    // no key, so the license does not apply to it (a "$50 million milestone" is not the "total of $216 million")
    if (L.id === "measure" && /^has_(count|value)$/.test(rel)) { licenses.push({ id: L.id, rel, giver: L.giver, standing: "unkeyed" }); gaps.push({ kind: "unkeyed_measure", rel }); continue; }
    const held = arrangements.filter((r) => r.rel === rel && r.layer === "asserted" && r.polarity === "+"), bySubj = new Map();
    for (const r of held) { const k = r.s; (bySubj.get(k) ?? bySubj.set(k, []).get(k)).push(r); }
    const broken = [...bySubj.entries()].filter(([, rs]) => new Set(rs.map((r) => r.o)).size > 1);
    if (broken.length) { licenses.push({ id: L.id, rel, giver: L.giver, standing: "refuted", by: broken.map(([k, rs]) => ({ subject: k, values: rs.map((r) => ({ o: r.o, span: r.span })) })) }); gaps.push({ kind: "license_refuted", license: L.id, rel }); continue; }
    declareFunctional(hl, rel, { giver: aff.giver }); licenses.push({ id: L.id, rel, giver: aff.giver, standing: "given", tier: ls.tier });
  }
  return { schema: STAGE_SCHEMA, doc, forWhom: frameOf(doc), anchors: [...anchors.values()], arrangements, licenses, gaps, hl, _anchors: anchors, _M: M, _C: C };
}

// INS: bind one claim end to a source anchor of the stage, or say it binds to nothing. Identity is BOUNDED by DMD (activation.js dmdWindow): the
// anchors the end meets are derived from the first `depth` source anchors, and the binding is trusted at the shallowest depth whose conclusion equals
// the whole's. No candidate depth agreeing is a typed gap (reach_exceeds_candidates) and the end stays unbound. An end that meets two different
// anchors is ambiguous, never "the first one": it stays unbound too.
//
// HOLOGRAPHIC IDENTITY (adapters/text/atom-world.js, corpus-identity.js): a shared name only NOMINATES. When the caller injects `identity`, each
// nominated source anchor of a referent is asked whether it is the same being, FOR the reading that holds it, and the answer is one of four standings:
//   same                  bound, and said to be settled
//   against               the end is not that being: the candidate falls away (only a declared exclusion says this)
//   raised_difference     a difference of use was measured; it convicts nothing, so the bind stands and the standing travels with it
//   needs_deeper_reading  the reading is too thin to decide: not "same", not "different". The bind by name and DMD stands, marked provisional, and
//                         the proof says how much reading is missing. Nothing that rests on it is presented as settled.
// The claim's own relations are the QUESTION, not evidence of which being the claim speaks of: standing(end, anchorArg, { except }) is handed the set of
// relations the claim rests on, so a declared exclusion never reads them (a claim that Mercury's radius is 6,000 km must not argue that it is not the
// Mercury whose radius the source gives). With no `identity` injected, nothing changes.
function bindEnd(stage, end, kind, identity = null, except = null) {
  const M = stage._M, all = [...stage._anchors.values()];
  const stand = new Map(), fell = new Map();   // fell: the nominated anchors a declared exclusion says this end is not
  const standOf = (a) => { if (!identity || kind !== "referent" || end.entity == null || a.arg?.entity == null) return null; if (!stand.has(a.id)) stand.set(a.id, identity.standing(end, a.arg, { except })); return stand.get(a.id); };
  const meets = (a) => kind === "quantity"
    ? (a.kind === "quantity" && FIG(end) && a.figure?.measure === end.measure && M.figMeet(end, a.figure) ? `meets ${a.label} (${end.measure})` : null)
    : kind === "value" ? (a.kind === "value" && end.value != null && low(a.arg.value ?? "") === low(end.value) ? `is the value ${a.label}` : null)
    : ((a.kind === "referent" || a.kind === "kind") && M.refMeet(end, a.arg) && !namesClash(end, a.arg) ? (standOf(a)?.kind === "against" ? (fell.set(a.id, standOf(a)), null) : `is ${a.label}`) : null);
  const derive = (obs) => obs.map((a) => ({ id: a.id, how: meets(a) })).filter((x) => x.how);
  const whole = derive(all);
  if (!whole.length) return fell.size ? { fell: [...fell.values()].map((st) => ({ end: argText(end), ...st })) } : null;
  // DMD runs over SHELLS around the first anchor the end meets (graph distance over the stage's arrangements), not over insertion order: the
  // window is the shallowest number of nearest anchors whose met-set already equals the whole's. A position in the text is not evidence depth.
  const seed = whole[0].id, adj = new Map(); for (const r of stage.arrangements) { (adj.get(r.s) ?? adj.set(r.s, []).get(r.s)).push(r.o); (adj.get(r.o) ?? adj.set(r.o, []).get(r.o)).push(r.s); }
  const dist = new Map([[seed, 0]]); for (let q = [seed]; q.length;) { const x = q.shift(); for (const y of adj.get(x) ?? []) if (!dist.has(y)) { dist.set(y, dist.get(x) + 1); q.push(y); } }
  const near = [...all].sort((a, b) => (dist.get(a.id) ?? 1e9) - (dist.get(b.id) ?? 1e9) || (a.id < b.id ? -1 : 1));
  const candidates = []; for (let d = 1; d < near.length; d *= 2) candidates.push(d); candidates.push(near.length);
  const w = dmdWindow(near, derive, { candidates, restrict: (o, d) => o.slice(0, d) });
  if (w.gap) return { gap: w.gap };
  // several anchors nominated by name: an injected identity that can CHOOSE (cancellation, the-fold/cancel-identity.js) picks the one the end cancels with; else the end stays unbound
  if (whole.length > 1 && identity?.choose) {
    const pick = identity.choose(end, whole.map((x) => stage._anchors.get(x.id).arg)); const hit = pick ? whole.find((x) => stage._anchors.get(x.id).arg === pick) : null;
    if (hit) { const st = standOf(stage._anchors.get(hit.id)); return { id: hit.id, how: `${hit.how} [name nominated ${whole.length}; identity by cancellation chose it: ${st?.reason ?? ""}]`, identity: st ? { end: argText(end), ...st } : null, chosenAmong: whole.map((x) => x.id) }; }
  }
  if (whole.length > 1) return { gap: "ambiguous_binding", among: whole.map((x) => x.id) };
  const st = standOf(stage._anchors.get(whole[0].id)), said = !st ? "" : st.kind === "same" ? "; holographic identity: the same being"
    : st.kind === "raised_difference" ? "; holographic identity: a difference of use is raised, nothing is convicted"
    : `; holographic identity: needs deeper reading (${st.reason}; ${st.have[0]} and ${st.have[1]} occurrence(s), ${st.need} needed)`;
  const depth = `${w.window ?? all.length} of ${all.length}`;
  return { id: whole[0].id, how: `${whole[0].how} [${st ? `name nominated, DMD depth ${depth}${said}` : `identity settled by depth ${depth}`}]`, identity: st ? { end: argText(end), ...st } : null };
}

// judgeClaim(stage, claimAtoms, { licenses, identity }) → as judgeInner, plus `reach` on a committed verdict (E or C) when `identity` is injected:
//   { standing: "settled" }                  every referent the verdict rests on is holographically the same being as the source's
//   { standing: "needs_deeper_reading", ends } at least one is bound by name and DMD only, and the reading is too thin to say more: the verdict
//                                              stands, provisional, and `ends` names each end, the reason and how much reading is missing
//
// PERSPECTIVE: every result names the frame it was read FOR (`forWhom`, the stage's for-whom.js frame: whose reading, for what question). A committed
// verdict also says `sense`: "shared" when each atom it rests on is held by the source in the same stated years as the claim, else "unstated"
// (one side said nothing comparable; the verdict stands, said so). A source value in a DIFFERENT sense is a typed gap (different_sense), not a verdict.
export function judgeClaim(stage, claimAtoms, opts = {}) {
  const trace = { senses: [] }, r = judgeInner(stage, claimAtoms, opts, trace);
  r.forWhom = stage.forWhom;
  if (r.verdict === "E" || r.verdict === "C") { const ss = r.verdict === "C" ? r.proofs.filter((p) => p.verdict === "contradicted").map((p) => p.sense) : trace.senses; r.sense = ss.length && ss.every((x) => x === "shared") ? "shared" : "unstated"; }
  if (opts.identity && (r.verdict === "E" || r.verdict === "C")) {
    // a contradiction rests on the proofs that name it; a support rests on every end the claim bound
    const open = (r.verdict === "C" ? r.proofs.filter((p) => p.verdict === "contradicted").flatMap((p) => p.identity ?? []) : r.stands ?? []).filter((s) => s.kind !== "same");
    r.reach = open.length ? { standing: "needs_deeper_reading", ends: open } : { standing: "settled" };
  }
  r.standings = r.stands ?? []; delete r.stands;      // every holographic standing the claim's binds drew, whatever the verdict
  return r;
}
function judgeInner(stage, claimAtoms, { licenses = LICENSES.map((l) => l.id), identity = null } = {}, trace = { senses: [] }) {
  const C = canonical(claimAtoms), CM = meeters(C, C, {}), proofs = [], gaps = [], stands = [];
  const on = new Set(licenses), except = new Set(C.map((a) => a.pred));
  // a stage restricted to the licenses switched on (ablation): declarations are rebuilt, edges are shared
  const hl = createStage(); hl.anchors = new Set(stage.hl.anchors); hl.types = new Map(stage.hl.types); hl.edges = new Map(stage.hl.edges);
  for (const L of stage.licenses) if (on.has(L.id) && L.standing === "given") declareFunctional(hl, L.rel, { giver: L.giver });
  let verdict = UNBOUND, supported = 0;
  const hasEdge = (rel, s_, o_, pol = "+") => [...hl.edges.values()].some((e) => e.rel === rel && e.s === s_ && e.o === o_ && e.polarity === pol);
  // the senses the source holds a thing in: the arrangement behind an edge, or those at (rel, s, o). A conflict or a support counts only in a shared sense.
  const armOf = (e) => stage.arrangements.find((r) => r.layer === "asserted" && r.rel === e.rel && r.s === e.s && r.o === e.o && `${stage.doc}:${r.span[0]}-${r.span[1]}` === e.source[0]);
  const armsAt = (rel_, s_, o_) => stage.arrangements.filter((r) => r.layer === "asserted" && r.polarity === "+" && r.rel === rel_ && r.s === s_ && r.o === o_);
  const differs = (arms, cs_) => arms.length > 0 && arms.every((r) => senseStanding(cs_, r.sense ?? {}).standing === "differs");
  const senseGap = (a_, cs_, arms) => ({ kind: "different_sense", atom: a_.text, claim: cs_, source: arms.map((r) => r.sense), why: senseStanding(cs_, arms[0].sense ?? {}).why });
  const standingOf = (arms, cs_) => (arms.length && arms.every((r) => senseStanding(cs_, r.sense ?? {}).standing === "shared") ? "shared" : "unstated");
  for (const [i, a] of C.entries()) {
    const as = a.args ?? [], cs = senseOf(a);
    let rel = a.pred, s, o, binds = [], bs = null, bk = null;
    // the holographic standing of every referent this atom binds travels with its proof; one that is not "same" is also a typed gap
    const cur = [], bind = (end, kind) => { const b = bindEnd(stage, end, kind, identity, except), st = b?.identity;
      // a declared exclusion made every nominated anchor fall away: the end binds to nothing, and the gap says which relation convicted and where
      if (b?.fell) { for (const f of b.fell) { cur.push(f); stands.push(f); gaps.push({ kind: "against", end: f.end, reason: f.reason, proof: f.proof, atom: a.text }); } return null; }
      if (st) { cur.push(st); stands.push(st); if (st.kind !== "same") gaps.push({ kind: st.kind, end: st.end, reason: st.reason, have: st.have, need: st.need, atom: a.text }); } return b; };
    if (isHas(rel) && as.length === 2 && FIG(as[1]) && !a.neg && !a.hedged) {
      bs = bind(as[0], "referent"); if (!bs) continue; if (bs.gap) { gaps.push({ kind: bs.gap, atom: a.text }); continue; }
      binds.push(`${argText(as[0])} ${bs.how}`);
      const bq = bind(as[1], "quantity");
      let qid; if (bq?.gap) { gaps.push({ kind: bq.gap, atom: a.text }); continue; } if (bq) { qid = bq.id; binds.push(`${argText(as[1])} ${bq.how}`); }
      else { qid = `claim:q:${i}`; addAnchor(hl, qid, "quantity"); binds.push(`${argText(as[1])} meets no source ${as[1].measure}, enters as a fresh value`); }
      s = bs.id; o = qid;
    } else if (isMost(rel) && as.length === 1 && !a.neg && !a.hedged) {
      const K = kindOf(C, as[0], CM); if (!K) continue;
      bk = bind(K, "kind"); if (!bk) continue; if (bk.gap) { gaps.push({ kind: bk.gap, atom: a.text }); continue; }
      binds.push(`kind ${argText(K)} ${bk.how}`);
      const bh = bind(as[0], "referent");
      if (bh?.gap) { gaps.push({ kind: bh.gap, atom: a.text }); continue; }
      let hid; if (bh) { hid = bh.id; binds.push(`${argText(as[0])} ${bh.how}`); }
      else { hid = `claim:h:${i}`; addAnchor(hl, hid, "referent"); binds.push(`${argText(as[0])} is not in the source; it enters fresh because the slot it fills (${rel} of ${argText(K)}) is functional`); }
      s = bk.id; o = hid;
    } else if (as.length === 2 && !isHas(rel) && !isMost(rel) && rel !== "is_a" && rel !== "named" && !a.neg && !a.hedged) {
      // a binary relation: IDENTITY decides. Both ends bind to source anchors and the source holds the same relation between them, in the same
      // order, positively: that is a supported atom. The reverse order is a swap, never support. No contradiction is read from a relation.
      const b0 = bind(as[0], "referent"), b1 = as[1].entity != null ? bind(as[1], "referent") : bind(as[1], "value");
      if (b0?.gap || b1?.gap) { gaps.push({ kind: (b0?.gap ?? b1.gap), atom: a.text }); continue; }
      if (!b0 || !b1) continue;
      if (hasEdge(rel, b0.id, b1.id) && differs(armsAt(rel, b0.id, b1.id), cs)) gaps.push(senseGap(a, cs, armsAt(rel, b0.id, b1.id)));
      else if (hasEdge(rel, b0.id, b1.id)) { supported++; trace.senses.push(standingOf(armsAt(rel, b0.id, b1.id), cs)); proofs.push({ atom: a.text, rel, binds: [`${argText(as[0])} ${b0.how}`, `${argText(as[1])} ${b1.how}`], lic: [], verdict: "bound", cites: [], identity: cur, sense: standingOf(armsAt(rel, b0.id, b1.id), cs) }); }
      else if (hasEdge(rel, b1.id, b0.id)) gaps.push({ kind: "direction_swap", atom: a.text });
      continue;
    } else continue;
    if (!hl.functional.has(rel)) { if (hasEdge(rel, s, o)) { if (differs(armsAt(rel, s, o), cs)) gaps.push(senseGap(a, cs, armsAt(rel, s, o))); else { supported++; trace.senses.push(standingOf(armsAt(rel, s, o), cs)); } } continue; }   // no license: it can still be SAME, never different
    const v = read(hl, ["atom", rel, s, o]);
    const heldE = [...hl.edges.values()].filter((e) => e.rel === rel && e.s === s && e.o !== o);
    // HL reads a source's denial of this very arrangement ("Mercury is NOT the hottest planet") as contradicted. That needs no license and cites no held
    // value, so there is nothing for the independent checker to re-check: the license layer does not commit it (the atoms arm owns direct denial).
    if (v === CONTRADICTED && !heldE.length) { gaps.push({ kind: "denial_not_licensed", atom: a.text }); continue; }
    // a value the source holds in ANOTHER sense (another tense, other years) is not held against this claim: it neither contradicts nor supports it
    const heldSame = heldE.filter((e) => { const r = armOf(e); return !r || senseStanding(cs, r.sense ?? {}).standing !== "differs"; });
    if (v === CONTRADICTED && !heldSame.length) { gaps.push(senseGap(a, cs, heldE.map(armOf).filter(Boolean))); continue; }
    if (v === BOUND && differs(armsAt(rel, s, o), cs)) { gaps.push(senseGap(a, cs, armsAt(rel, s, o))); continue; }
    const sarms = v === CONTRADICTED ? heldSame.map(armOf).filter(Boolean) : armsAt(rel, s, o);
    const cites = heldSame.map((e) => e.source).flat();
    const lab = (id) => stage._anchors.get(id)?.label ?? null, fg = (id) => stage._anchors.get(id)?.figure ?? null;
    const claimEnd = isHas(rel) ? { label: argText(as[1]), measure: as[1].measure, base: as[1].base } : { label: argText(as[0]) };
    proofs.push({ atom: a.text, rel, binds, lic: [...hl.functional.entries()].filter(([r]) => r === rel).map(([r, d]) => `functional(${r}) giver "${d.giver}"`), verdict: v, cites, identity: cur, sense: standingOf(sarms, cs),
      record: { rel, subject: lab(s) ?? lab(bs?.id ?? bk?.id), giver: hl.functional.get(rel)?.giver ?? null, claim: claimEnd, sense: { claim: cs.time || cs.tense ? { tense: cs.tense, time: cs.time } : null },
        held: heldSame.map((e) => ({ span: String(e.source[0]).replace(/^[^:]*:/, "").split("-").map(Number), label: lab(e.o), measure: fg(e.o)?.measure ?? null, base: fg(e.o)?.base ?? null })) } });
    if (v === CONTRADICTED) verdict = CONTRADICTED; else if (v === BOUND) { supported++; trace.senses.push(standingOf(sarms, cs)); if (verdict !== CONTRADICTED) verdict = BOUND; }
  }
  // a contradiction is committed only if every source arrangement it cites has a decided reading
  if (verdict === CONTRADICTED) {
    const spans = new Set(proofs.flatMap((p) => p.cites));
    const undecided = stage.arrangements.filter((r) => spans.has(`${stage.doc}:${r.span[0]}-${r.span[1]}`) && !r.reading?.decided);
    if (undecided.length) { gaps.push({ kind: "undecided_reading", arrangements: undecided.map((r) => r.id) }); return { verdict: "N", hl: UNBOUND, proofs, gaps, stands }; }
  }
  // E: every atom of the claim is covered and SAME as the source holds it (identity, never a score); anything uncovered leaves it unknown
  // SCAFFOLD: "Mercury has a radius of 2,440 km" is read as have(Mercury, a radius), of(a radius, 2,440 km) AND has_radius(Mercury, 2,440 km).
  // The first two are the third taken apart; when the third is supported they say nothing more (same figure, same being, the attribute noun).
  const sup = new Set(proofs.filter((x) => x.verdict === "bound" || x.verdict === BOUND).map((x) => x.atom));
  let scaffold = 0;
  for (const a of C) {
    if (sup.has(a.text) || !a.args || a.args.length !== 2) continue;
    const owner = C.find((h) => isHas(h.pred) && sup.has(h.text) && FIG(h.args?.[1]));
    if (!owner) continue;
    const attr = owner.pred.replace(/^has_(number_of_)?/, "").replace(/_/g, " "), fig = owner.args[1];
    const isOf = (a.pred === "of" || a.pred === "with") && argText(a.args[1]) === argText(fig) && low(argText(a.args[0])).includes(attr);
    const isHave = /^(have|has|had)$/.test(a.pred) && low(argText(a.args[1])).includes(attr) && argText(a.args[0]) === argText(owner.args[0]);
    if (isOf || isHave) scaffold++;
  }
  if (verdict !== CONTRADICTED && C.length && supported + scaffold === C.length) return { verdict: "E", hl: BOUND, proofs, gaps, stands };
  return { verdict: verdict === CONTRADICTED ? "C" : "N", hl: verdict, proofs, gaps, stands };
}

// canonical text of a stage, for the determinism check (same bytes, same stage)
export function stageBytes(stage) { return JSON.stringify({ schema: stage.schema, doc: stage.doc, anchors: stage.anchors.map(({ arg, ...a }) => a), arrangements: stage.arrangements, licenses: stage.licenses, gaps: stage.gaps }); }
