// Khora owns the address: witnessed source positions, not model-provided offsets.
// Exact text is the instrument. A sentence that cannot be located inside the
// declared reading extent creates a gap, never a best-guess citation.
export const SOURCE_ADDRESS_SCHEMA = 'SourceAddress@1';

export function locateSentences(source, startChar, sentences = [], { endChar = source?.length } = {}) {
  if (typeof source !== 'string' || !Number.isSafeInteger(startChar) || !Number.isSafeInteger(endChar) ||
      startChar < 0 || endChar < startChar || endChar > source.length || !Array.isArray(sentences))
    throw new RangeError('locateSentences: invalid source or extent');
  const found = new Map(), gaps = [];
  let cursor = startChar;
  let cursorByte = Buffer.byteLength(source.slice(0, cursor), 'utf8');
  for (const s of sentences) {
    const order = s?.order;
    if (!Number.isSafeInteger(order) || order < 0 || found.has(order)) {
      gaps.push({ order: order ?? null, reason: 'missing_or_duplicate_sentence_order' }); continue;
    }
    const text = String(s?.text ?? '');
    const at = text ? source.indexOf(text, cursor) : -1;
    if (at < 0) { gaps.push({ order, reason: 'sentence_not_at_source' }); continue; }
    if (at + text.length > endChar) { gaps.push({ order, reason: 'sentence_outside_read_extent' }); continue; }
    cursorByte += Buffer.byteLength(source.slice(cursor, at), 'utf8');
    const byteAt = cursorByte;
    cursorByte += Buffer.byteLength(text, 'utf8');
    const byteEnd = cursorByte;
    found.set(order, Object.freeze({ schema: SOURCE_ADDRESS_SCHEMA, charAt: at, charEnd: at + text.length, byteAt, byteEnd }));
    cursor = at + text.length;
  }
  return { found, gaps };
}
