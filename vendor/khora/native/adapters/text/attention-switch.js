// adapters/text/attention-switch.js — THE SWITCH for the attention binder: a separate, optional input, OFF unless asked.
//
// Nothing in the reader, the pronoun organ or the fold calls attention-binder.js. A caller that wants the "it" / "The tower" bindings asks here,
// with `enabled: true`; with it absent or false the answer is null and no existing output moves (byte-identical, nothing was wired in).
//
//   attendedBindingsFor(entry, { enabled, ...dials }) → null when off · { bindings, gaps, ruling } when on
//     entry   a readDocument entry (its `sentences` and `cast[].mentionSpans`)
import { bindAttended } from "./attention-binder.js";

export function attendedBindingsFor(entry, { enabled = false, ...dials } = {}) {
  if (enabled !== true) return null;
  const mentions = [];
  for (const c of entry?.cast ?? []) for (const [start, end] of c.mentionSpans ?? []) mentions.push({ ref: c.ref, start, end });
  return bindAttended(entry?.sentences ?? [], mentions, dials);
}
