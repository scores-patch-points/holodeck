// reading/extract.js — the extraction gate. A container (a PDF, an HTML page) is not text: an
// extractor turns it into text, and an extractor can quietly MANGLE it — a letterspaced PDF comes
// back from pdf.js as "F R O M" and from pdftotext as "FROM". So the gate does not trust one
// extractor, and it does not throw the others away: it holds every extraction as a PARALLEL READING
// (an eigenvalue), measures how much of each reads as words the received prior holds, and lets one
// COLLAPSE as the reading — always subject to revision, the others kept and shown.
//
// UNDER THE CONSTITUTION (docs/FOLD-CONSTITUTION.md):
//   · Plural grounds stay parallel and are never averaged (III.4): each extraction is a reading with
//     its own evidence; the collapsed one is a NOMINATION, and the rest stay on the record.
//   · The vocabulary is RECEIVED and names its giver; with no prior the gate types a GAP (I.2 / II.1
//     / IV.3) rather than guessing.
//   · The gate's FLOOR is a DECLARED, NAMED constant (II.11): READS_FLOOR, giver = this gate,
//     surfaced on every reading so a person can move it. The measure itself is the evidence.
//   · A collapse is REVISABLE (I.5): the caller may re-collapse to any held reading; the record keeps
//     every reading and every collapse, append-only.
//   · FALSIFIABLE (II.10): the tests show a mangled extraction read as unconfirmed and a clean one as
//     confirmed.


// RECEIVED, DECLARED, NAMED (II.11): below this share of letters sitting in known words of more than
// one letter, a reading does not "read as words". A person may move it; giver = this gate; reported
// on every reading. A single letter is not a word for this measure — a definition, not a threshold.
export const READS_FLOOR = 1 / 2;
export const READS_FLOOR_GIVER = 'the extraction gate (reading/extract.js) — a received setting, move it freely';

/** readsAsWords(text, prior) -> the share of TOKENS that are known words (len > 1), with the gap.
 *  Tokens, not letters: a mangled extraction shatters a word into many short tokens, so few of them
 *  are known words and the share is low — whereas letters would be fooled (a garbled run matches
 *  many short known forms). A single letter is not a word for this measure — a definition. */
export function readsAsWords(text, prior) {
  if (!prior || typeof prior.known !== 'function') return { reads: 0, tokens: 0, gap: 'no vocabulary prior was received (IV.3)' };
  const toks = (String(text).match(/[\p{L}]+/gu) || []);
  const total = toks.length || 1;
  let known = 0;
  for (const w of toks) if (w.length > 1 && prior.known(w.toLowerCase())) known++;
  return { reads: known / total, tokens: toks.length, gap: null };
}

/** sniffExtraction(text, { prior, floor }) -> a reading's measure and verdict. */
export function sniffExtraction(text, { prior = null, floor = READS_FLOOR } = {}) {
  const m = readsAsWords(text, prior);
  if (m.gap) return { verdict: 'gap', reads: 0, floor, floorGiver: READS_FLOOR_GIVER, gap: m.gap };
  return { verdict: m.reads >= floor ? 'confirmed' : 'unconfirmed', reads: +m.reads.toFixed(3), tokens: m.tokens, floor, floorGiver: READS_FLOOR_GIVER, gap: null };
}

/** extractReadings({ extractors, prior, floor }) -> the parallel readings and the collapsed one.
 *  Every extractor that yields text becomes a READING (never discarded). A CONFIRMED reading stops
 *  the chain — the converter is not called ("as needed"). The collapse is the reading that reads as
 *  words the MOST (ties → the earliest, the cheapest); `collapsed` indexes into `readings`, and the
 *  caller may re-collapse at any time. */
export async function extractReadings({ extractors = [], prior = null, floor = READS_FLOOR } = {}) {
  const readings = [];
  for (const ex of extractors) {
    let text = null, err = null;
    try { text = await ex.run(); } catch (e) { err = String((e && e.message) || e); }
    if (err) { readings.push({ extractor: ex.name, ok: false, why: err }); continue; }
    if (text == null) { readings.push({ extractor: ex.name, ok: false, why: 'not available' }); continue; }
    const sniff = sniffExtraction(text, { prior, floor });
    readings.push({ extractor: ex.name, ok: true, text, sniff });
    if (sniff.verdict === 'confirmed') break;               // reads as words — do not call more extractors
  }
  const held = readings.filter(r => r.ok);
  let collapsed = null;
  held.forEach((r, i) => { const idx = readings.indexOf(r); if (collapsed == null || r.sniff.reads > readings[collapsed].sniff.reads) collapsed = idx; });
  const gap = !prior ? 'no vocabulary prior was received — the gate cannot judge the extraction (IV.3)' : null;
  return { readings, collapsed, held: held.length, prior, floor, gap };
}
