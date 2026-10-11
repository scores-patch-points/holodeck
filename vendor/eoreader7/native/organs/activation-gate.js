// native/organs/activation-gate.js — read a turn's DOOR from the holograph's
// own activation, not from a hand-built classifier. The pipeline had the
// activation and kept losing it: the session builds the referent index and
// the reading log, but `activate` (activation-wiring.js) and the mention book
// (mentionBookFromLog) were never wired into the turn. This organ composes
// them and answers the reason-gate's door question from the record itself.
//
// THE ACTIVATION IS THE DOOR (THE-HOLOGRAPH.md §6): "a question activates
// referents — its own, resolved through the index, or the last answer's when
// it names none." The gate reads THAT:
//
//   active.size > 0  → the turn resolves to referents the record holds —
//                      CONTEXT: the conversation/material holds the answer.
//   basis "surface", active 0 → the turn resolves to nothing held — it is
//                      either mechanical (an organ settles it), phatic
//                      (register), or world (the material grounds a
//                      narration, or the kernel derives, or it is refused).
//
// The gate does not classify words; it reads what the reading already holds.
// The mechanical and phatic fast lanes stay in the reason-gate (they are
// separate doors, settled by organs and the small-talk shape); this organ
// decides whether the HOLOGRAPH has anything to answer with.
//
// PURE. Everything is injected (the session's log, the index, the wiring):
// the organs never import a surface. Absent a log/index, it reports
// `unavailable` and the reason-gate falls back to its other lanes.
//
// FALSIFYING CONTROL: a turn the activation resolves to a held referent that
// the gate does NOT route to context (the record could have answered); or a
// turn resolving to nothing that the gate claims the record holds — either
// concedes this gate.

/**
 * activationFor({ log, index, question, transcript, notes }) → the door
 * signal from the holograph's activation.
 *   log        — the session's reading log (EOMention@1 + Encounter@1 entries)
 *   index      — readingIndexFromLog's projection (the referent index)
 *   question   — the turn's text
 *   transcript — the conversation's prior turns
 *   notes      — the ledger's notes (optional; adds act-level reach)
 * Returns { available, active, basis, why, door } where door ∈
 * "context" | "world" | "surface" | "unavailable".
 */
export async function activationFor({ log = [], index = null, question = "", transcript = [], notes = [] } = {}) {
  if (!index || !log?.length) return { available: false, active: [], basis: "unavailable", why: "no reading log or referent index on the session", door: "unavailable" };
  try {
    const { mentionBookFromLog } = await import("../the-fold/reading-log.js");
    const { activate } = await import("../the-fold/activation-wiring.js");
    const book = mentionBookFromLog(log, { reconstruct, diaNorm, namesCorefer, surfaceIndex, surfacesIn });
    if (!book?.byId?.size) return { available: false, active: [], basis: "no-mentions", why: "the reading established no referents the book can walk", door: "unavailable" };
    const r = activate({ question: String(question ?? ""), transcript, index, book, notes, resolutions: 0 });
    const active = r?.active ?? [];
    const door = active.length > 0 && r?.basis !== "surface" ? "context" : "world";
    return { available: true, active, basis: r?.basis ?? "surface", why: r?.why ?? null, door, activation: { active, hop1: r?.hop1 ?? [], window: r?.window ?? 0, actsOnLog: r?.actsOnLog ?? 0, basis: r?.basis } };
  } catch (e) {
    return { available: false, active: [], basis: "error", why: `activation failed: ${e.message}`, door: "unavailable" };
  }
}

// Re-export the injected organs' names so a caller can pass them; the wiring
// imports them from reading-log.js / activation-wiring.js, which bind the
// session's own projections. If any is missing the catch reports unavailable.
import { reconstruct, diaNorm, namesCorefer, surfaceIndex, surfacesIn } from "../the-fold/reading-log.js";