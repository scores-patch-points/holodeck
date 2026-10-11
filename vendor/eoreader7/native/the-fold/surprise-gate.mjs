// the-fold/surprise-gate.mjs — SEG·Figure + EVA·Ground: the surprise gate of
// the canonical reading sequence, called by the read that produces the weft.
//
// THE CANONICAL CYCLE ("the-canonical-cycle", content-rules) makes SURPRISE
// CONSTITUTIVE: SEG cuts the reading where its ground was most wrong and EVA
// corroborates the cut against the null. The kernel that does this is
// medium-blind (`kernel/surprise-segments.js`, Rubin) — it names no word,
// sentence or mark, and its null is built in (II.23), so a stream whose
// surprises never exceed what shuffling produces reports no figures rather
// than cutting anyway. The CALLER's instrument decides what an event is.
//
// HERE the caller's instrument is the material's own token stream: the
// reading's ground is the words it has heard, and a figure is a word the
// ground did not predict. This is the same instrument the surprise work
// validated (lowercase words → sentence ends, above chance, with no
// punctuation read). The gate is pure and synchronous; it calls no model.
//
// THE NUMBERS ARE RECEIVED, NOT CODIFIED (the receptacle rule, 2026-10-08):
// the gate's declared parameters are reading rules, so their ONE home is
// janus/priors/reading-rules.json and khora reads them here as data. An
// absent rule is a typed refusal on the record — the gate never supplies a
// number of its own (a missing rule is a gap, never a guess).
import { segmentBySurprise } from "../kernel/surprise-segments.js";
import { loadReadingRules } from "../kernel/reading-rules.js";

const _readRules = loadReadingRules();

// The caller's instrument: the material's own word tokens, in order. Unicode
// aware; digits and internal apostrophes kept (the shape the reader's own
// tokenizers use). Nothing named, nothing filtered — a punctuation mark is not
// an event because this instrument never reads one.
const TOKEN_RE = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;
export const tokenEvents = (text) => String(text ?? "").match(TOKEN_RE) ?? [];

// The received numbers, frozen; empty when Relate has not supplied them.
// `SURPRISE_DEFAULTS` is exported for callers that declare their own override
// — its value is what janus read, never a khora-authored constant.
export const SURPRISE_DEFAULTS = Object.freeze({ ...(_readRules?.rules?.surprise ?? {}) });

/**
 * surpriseCut(events, opts) — the SEG+EVA gate as one compact value.
 * Returns a frozen `SurpriseCut@1` carrying the cut, its null quantile, the
 * figure (boundary) count, the boundary indices and each segment's size. The
 * token arrays themselves are NOT carried — a segment's bytes are recovered
 * from the material by address, never duplicated onto the record. A stream
*  shorter than two events is a typed refusal, never a silent cut.
 *  `maxTokens` caps the stream at a DECLARED budget: the shuffled null is
 *  O(draws × stream) — unbounded it ran 60+ minutes-equivalents on a full
 *  document (measured 2026-10-08), so the gate reads the FIRST `maxTokens`
 *  events and says so (`streamCapped`) rather than pretending it read the
 *  whole (currently the received maxTokens=3000, which keeps the evaluated
 *  null's draws 20 at ~2s per document). This mirrors the surprise work's own
 *  stated instrument ("first 60000 chars" of Dracula). A missing rule set is a
 *  typed refusal (`no_reading_rule`), never a khora-supplied number.
 */
export function surpriseCut(events = [], { order = SURPRISE_DEFAULTS.order, alpha = SURPRISE_DEFAULTS.alpha, draws = SURPRISE_DEFAULTS.draws, seed = SURPRISE_DEFAULTS.seed, minLength = SURPRISE_DEFAULTS.minLength, maxTokens = SURPRISE_DEFAULTS.maxTokens } = {}) {
  if (![order, alpha, draws, seed, minLength, maxTokens].every((x) => Number.isFinite(x))) {
    // The rules were not received — a typed refusal, never a synthesized number.
    return Object.freeze({ schema: "SurpriseCut@1", stream: "tokens", events: (events ?? []).length, cut: 0, nullCut: 0, figures: 0, boundaries: Object.freeze([]), segmentSizes: Object.freeze([]), refused: "no_reading_rule", source: _readRules.source, detail: _readRules.gap?.detail ?? null });
  }
  const all = (events ?? []).map(String);
  const ev = Number.isFinite(maxTokens) && all.length > maxTokens ? all.slice(0, maxTokens) : all;
  const streamCapped = ev.length < all.length;
  if (ev.length < 2) {
    return Object.freeze({ schema: "SurpriseCut@1", stream: "tokens", events: ev.length, streamCapped, order, alpha, draws, seed, minLength, cut: 0, nullCut: 0, figures: 0, boundaries: Object.freeze([]), segmentSizes: Object.freeze(ev.length ? [ev.length] : []), refused: "too_short" });
  }
  // No fixed `alphabetSize`: the floor grows with the alphabet the ground has
  // HEARD so far (surprises()'s own growing-floor default). A fixed floor
  // counts a bootstrap first-sighting as a figure — measured (probe 2026-10-08):
  // the periodic-stream control that must cut nothing cuts one spurious
  // boundary at [3] with a fixed floor and none with the growing one.
  const seg = segmentBySurprise(ev, { order, alpha, draws, seed, minLength });
  return Object.freeze({
    schema: "SurpriseCut@1",
    stream: "tokens",
    events: ev.length,
    streamCapped,
    order, alpha, draws, seed, minLength, maxTokens,
    cut: seg.cut,
    nullCut: seg.nullCut,
    figures: seg.figures,
    boundaries: seg.boundaries,
    segmentSizes: Object.freeze(seg.segments.map((s) => s.length)),
    refused: seg.refused ?? null,
  });
}

/** The gate over a document's own bytes: tokens in, a `SurpriseCut@1` out. */
export const surpriseOfText = (text, opts) => surpriseCut(tokenEvents(text), opts);
