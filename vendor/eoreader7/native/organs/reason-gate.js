// native/organs/reason-gate.js — the constitution's II.9 boundary, enforced.
//
// A model may phrase, order, narrate, translate a register, and propose; it
// may never reason, originate a fact, or derive a conclusion. This organ is
// the gate that decides which of those a turn is asking for, BEFORE any model
// draw. It composes the machinery that already exists — it builds no new
// reasoning; it routes to the reasoning that exists.
//
// THE LANES (each names who may speak and what the model, if it speaks, is
// allowed to do — the II.9 line is the same in every lane):
//
//   register  — a greeting, thanks, small talk, a status/help command. NOT
//               reasoning: the mouth may phrase it (Halliday register, the
//               small-talk fast path). The model is never asked to reason.
//   mechanical — arithmetic, quantity, a logic/preference puzzle, a discrete
//               build. The organ settles it; zero model tokens are spent.
//   swarm     — material whose meaning is hard (garble, truncation, a
//               pointed-at void). The swarm answers; zero model tokens.
//   grounded  — the mechanical read surfaced byte-addressed spans. The mouth
//               may NARRATE those spans and nothing past them: every [S#]
//               must descend to a span the read actually produced. The model
//               never reasons from the spans to a conclusion it wasn't given.
//   reasoning — a question that needs a derivation no organ has yet claimed.
//               The mouth writes NOTES (premises, relations, what would
//               settle it — "the model supplies the premises"), and the
//               kernel (notes.js → reaction.js → talk-reason.js) derives.
//               The ANSWER is the derivation + the disclosed notes, never the
//               model's own conclusion. If the kernel cannot settle it, the
//               gate returns the typed refusal lane.
//   refuse    — the machine tried (organs, swarm, derivation) and cannot
//               settle the turn without asking the model to reason. It says
//               so plainly and cites the rule; it never lets the model reason
//               to fill the gap.
//
// THE ONE INJECTED THING. The gate is given `mechanisms` (the same
// precision-race mechanisms the doors already run) and `swarm` (the same
// runSwarmTurn), so a caller's existing wiring IS the gate's wiring — never a
// second list that drifts from the doors' own. What the gate adds is the
// ORDER and the REFUSAL: mechanisms run first, and a turn no mechanism and no
// derivation settles is refused as a type, never handed to the mouth as a
// reasoning task.
//
// PURE. No model call, no IO. `derive` is injected by the caller (the real
// notes→reaction→talk-reason pipeline); absent, the reasoning lane reports
// `derive: false` and routes to refusal rather than pretending to derive.
//
// FALSIFYING CONTROL: a turn the gate routes to `refuse` that any caller
// still answers by asking the model to reason; a `grounded` answer whose
// narration asserts a value no surfaced span carries; or a `reasoning` lane
// whose answer is the model's own conclusion rather than a kernel derivation
// with disclosed notes — any of these concedes the gate.

import { CONCLUSION } from "./precision-race.js";

export const LANES = Object.freeze(["register", "mechanical", "context", "swarm", "grounded", "reasoning", "refuse"]);

// The parser, loaded once (cached) — the gate reads the ask's STRUCTURE, not
// its lexicon. Unavailable parser → the gate still runs the mechanical organs
// (they get first crack); only the structural door SET is then empty.
let _parser = null;
let _parserState = "unloaded";
export async function intentParser() {
  if (_parserState === "ready") return _parser;
  if (_parserState === "failed") return null;
  try {
    const { loadEotParser } = await import("../the-fold/eot-notation.js");
    const p = await loadEotParser();
    if (!p?.ok) { _parserState = "failed"; return null; }
    _parser = p;
    _parserState = "ready";
    return _parser;
  } catch (e) {
    _parserState = "failed";
    return null;
  }
}

// CONVERSATIONAL NORMALIZATION — STRUCTURAL, NEVER A WORD LIST (kleenUp's
// law: the signal is the parser's computed `deprel`, not a vocabulary table).
// A real chat fronts a question with a discourse filler ("ok so what is 12
// times 8?") or a follow-up frame ("so earlier we said… what is 96 divided by
// 3?"). The parser already tags the leading fillers: `discourse` (ok) and
// `advmod` (so, then) at the sentence head, and a follow-up's frame is a
// clause whose root carries the prior turn's words. The organs' structural
// detectors read the BARE question; the gate strips the parsed leading
// discourse/advmod head mechanically — the same word-class normalization the
// organs already do, computed, never guessed. The substance is untouched.
export function normalizeTask(task, records = null) {
  let t = String(task ?? "").trim();
  // no parser → fall back to a purely mechanical trim (the organs still get
  // first crack on the raw text); the structural strip needs the parse.
  if (!records) return t;
  // Use only the records whose text matches the task being normalized — a
  // compound "hello! so what is 12 times 8?" parses to two sentences, and
  // each must be normalized against its OWN rows, never the whole parse.
  const recs = (Array.isArray(records) ? records : [records]).filter(
    (rec) => String(rec?.surface?.text ?? "").trim() === t || t.includes(String(rec?.surface?.text ?? "").trim()),
  );
  const rows = [];
  for (const rec of recs) {
    for (const line of rec?.surface?.lines ?? []) {
      const c = /^(\d+)\t/.exec(line); if (!c) continue;
      const cols = line.split("\t");
      rows.push({ id: Number(cols[0]), form: cols[1], upos: cols[3], head: Number(cols[6]), deprel: cols[7] });
    }
  }
  rows.sort((a, b) => a.id - b.id);
  if (!rows.length) return t;
  // SEG, structural (kleenUp: regex is for splitting, never a word list):
  // drop the LEADING discourse/advmod tokens in sentence order — "ok"
  // (discourse), "so"/"then" (advmod) at the head — so the organs read the
  // bare question. The first token that is neither is where the question
  // actually begins; the parser's tags decide, never a vocabulary table.
  let firstKept = null;
  for (const r of rows) {
    if (r.deprel === "discourse" || r.deprel === "advmod") continue;
    firstKept = r;
    break;
  }
  if (!firstKept) return t;
  const idx = t.indexOf(firstKept.form);
  return idx >= 0 ? t.slice(idx).trim() : t;
}

/**
 * classifyTurn({ task, mechanisms, swarm, history, surfaced, derive, records })
 * → { lane, reason, observation?, swarmTurn?, derive?, doors }
 *
 * THE FEW DOORS, read from the ask's structure (intent-reader), tried in
 * priority order. A prompt may trigger several doors; the first that SETTLES
 * owns the turn, and the rest are disclosed on `doors`:
 *
 *   mechanical — the organs settle it, zero model (arithmetic, logic, quantity)
 *   context    — the conversation holds the answer; the mouth phrases the record
 *   phatic     — register; the mouth phrases it, never reasons
 *   world      — a grounded narration (surfaced spans) or a kernel derivation;
 *                if neither settles, the turn is refused — never the model's
 *                own reasoning.
 *
 * The order is the enforcement: a settled organ owns the turn before any mouth
 * could; a conversation-held answer is phrased before a world ask is refused.
 */
export async function classifyTurn({ task, mechanisms = [], swarm = null, history = [], surfaced = null, derive = null, records = null, activation = null } = {}) {
  const t = String(task ?? "").trim();
  if (!t) return { lane: "refuse", reason: "empty task — nothing to reason about or phrase", doors: [] };

  // 1. SETTLE — the organs compute. This is how mechanical turns work: the
  //    organ settles, never a classifier. A compound task ("hello! what is 12
  //    times 8?") is SEGMENTED into sentences (regex = SEG, on the fly) and
  //    each is tried; a sentence the organ can't claim is left alone, never
  //    forced. Zero model tokens when a mechanism settles.
  if (mechanisms?.length) {
    const observation = await runMechanicalSafe(t, mechanisms);
    if (observation?.concluded && String(observation.kind) !== String(CONCLUSION.BEYOND_REACH)) {
      return { lane: "mechanical", reason: `${observation.mechanism} settled it — computed, never generated`, observation, doors: [] };
    }
  }

  // 2. THE RECORD — the holograph's activation. Does the turn resolve to
  //    referents the record holds? If so, the mouth phrases the record.
  let activationSignal = null;
  if (activation && typeof activation === "function") {
    const transcript = (history ?? []).map((m) => String(m?.content ?? ""));
    activationSignal = await activation({ question: t, transcript });
  }
  if (activationSignal?.available && activationSignal.door === "context") {
    return { lane: "context", reason: `the holograph resolves the turn to ${activationSignal.active.join(", ")} — the record holds the answer; the mouth phrases it, never reasons past it`, doors: [], activation: activationSignal.activation };
  }

  // 3. SEGMENT — regex as SEG (on the fly, for splitting a compound task so
  //    the organs can claim the part they compute). The only regex use here
  //    is splitting into sentences and stripping the parsed leading discourse
  //    head — search/filter/split, never a stored vocabulary.
  const parseP = records ? Promise.resolve(records) : intentParser().then((p) => (p ? p.parse(t) : null));
  const recs = await parseP;
  if (recs && mechanisms?.length) {
    // SEG: the normalized whole task (leading discourse head stripped by the
    // parser's own tags) AND each sentence of a compound — regex as SEG,
    // splitting so the organ can claim the part it computes. Each candidate
    // is normalized against its OWN record before the organ runs.
    const sents = readSentences(recs);
    const candidates = [...new Set([normalizeTask(t, recs), ...sents.map((s) => normalizeTask(s, recs))].filter((c) => c !== t))];
    for (const cand of candidates) {
      const observation = await runMechanicalSafe(cand, mechanisms);
      if (observation?.concluded && String(observation.kind) !== String(CONCLUSION.BEYOND_REACH)) {
        return { lane: "mechanical", reason: `${observation.mechanism} settled the part "${cand.slice(0, 50)}" — computed, never generated`, observation, normalized: cand !== t ? cand : null, doors: [] };
      }
    }
  }

  // 4. SWARM — hard meaning answers itself (model-free).
  if (swarm && typeof swarm === "function") {
    const turn = await swarm();
    if (turn?.routed) return { lane: "swarm", reason: turn.meaning?.hard ? "hard meaning — the swarm reads it, no model" : "swarm routed by name", swarmTurn: turn, doors: [] };
  }

  // 5. THE GROUND — surfaced spans: the mouth narrates them, never past them.
  if (surfaced?.length) return { lane: "grounded", reason: `${surfaced.length} surfaced span(s) — narration only, never reasoning past them`, doors: [] };

  // 6. THE KERNEL — the machine may yet derive from notes.
  if (typeof derive === "function") {
    const d = await derive(task);
    if (d?.settled) return { lane: "reasoning", reason: d.reason ?? "derived from notes by the kernel", derivation: d, doors: [] };
  }

  // 7. THE MOUTH PHRASES — the default. Nothing was computable, nothing the
  //    record holds, nothing surfaced, nothing derived — so the mouth may
  //    phrase it (register: a greeting, thanks, a question the mouth can
  //    answer conversationally). The mouth phrases; it never reasons. This is
  //    the default, not a classification: register is what's LEFT when the
  //    machine cannot compute — not a vocabulary lookup.
  return { lane: "register", reason: "nothing the organs can settle, nothing the record holds, nothing surfaced, nothing the kernel can derive — the mouth phrases what it can (II.9: a model may phrase, order, narrate; it never reasons to a conclusion). A conversational answer, never a reasoned one.", doors: [] };
}

async function runMechanicalSafe(task, mechanisms) {
  try {
    const { runMechanical } = await import("./precision-race.js");
    return await runMechanical(task, mechanisms);
  } catch (e) {
    return { concluded: false, gaps: [{ mechanism: "reason-gate", detail: `mechanical pipeline failed: ${e.message}` }] };
  }
}

let _intentRecs = null;
async function intentRecs(t) {
  if (_intentRecs) return _intentRecs;
  const p = await intentParser();
  _intentRecs = p ? p.parse(t) : null;
  return _intentRecs;
}
function doorWantsMechanical(doors) {
  return (doors ?? []).includes("mechanical");
}
function readSentences(records) {
  return (records ?? []).filter(Boolean).map((s) => String(s?.surface?.text ?? "")).filter(Boolean);
}