// reading/look-joins.js — WHERE ONE TEXT ITEM ENDS AND THE NEXT BEGINS, and what to do when the geometry contradicts itself.
//
// A PDF's text layer is a list of items, each a string with a box. Joining them is geometry: a space goes between two items on one baseline
// when the gap is a word gap, and a new baseline means a new line. Most junctions are settled by that. A junction STARTLES when its geometry
// says two things at once: the next item is on a different baseline (a new line, by the baseline) yet it sits to the right of the previous
// item and their boxes overlap vertically (the same row, by the boxes). A new line has neither property. No glyph, size or word is named
// here; whatever makes a row hold two baselines — a large initial letter, a raised mark, an inline figure — startles the same way.
//
// A startled junction is not decided by geometry, because geometry is what contradicted itself: both readings are HELD (the items spaced,
// as the PDF set them, and the items joined), and the later layers pick the reading they can use (decideJunctions). A tie keeps the PDF's
// own spacing. The decision is recorded with its evidence and can be flipped; the text the PDF gave is kept beside it.
//
//   joinItems(items, { base })            → { text, startles }   one page; reproduces the plain geometric join exactly, and marks startles
//   decideJunctions(text, startles, ctx)  → startles with { spaced, joined, scores, decision, why }
//   applyJunctions(text, startles)        → the text with every 'join' decision applied (the gap removed)

const ws = (s) => !String(s).trim();

/** Join one page's pdf.js text items. `items` are pdf.js TextItems ({ str, transform, width, height, hasEOL }). */
export function joinItems(items, { base = 0 } = {}) {
  // the text is built exactly as the plain join builds it (prev = the last item with any string, blank or not); `ink` is the last item
  // with letters on it, and the startle compares the two items that carry ink across whatever blank items the PDF set between them
  let raw = '', prev = null, ink = null, afterInk = 0; const startles = [];
  for (const it of items || []) {
    const str = it.str || '', t = it.transform || [], x = t[4], y = t[5], h = it.height || Math.abs(t[3]) || 10;
    if (prev && str){
      const sameLine = Math.abs(y - prev.y) < h * 0.5, gap = x - prev.end;
      if (!sameLine) { if (!/\s$/.test(raw)) raw += ' '; }
      else if (gap > h * 0.22 && !/\s$/.test(raw) && !/^\s/.test(str)) raw += ' ';
    }
    if (ink && str && !ws(str)) {
      const otherBaseline = Math.abs(y - ink.y) >= Math.min(h, ink.h) * 0.5;
      // the same row by the boxes: their vertical extents overlap, and the item does not return to the left
      const rowOverlap = Math.min(y + h, ink.y + ink.h) - Math.max(y, ink.y) > 0, forward = x >= ink.end - Math.min(h, ink.h) * 0.5;
      if (otherBaseline && rowOverlap && forward && afterInk < raw.length)
        startles.push({ at: base + afterInk, end: base + raw.length, gap: raw.slice(afterInk),
          a: { str: ink.str, x: +ink.x.toFixed(1), y: +ink.y.toFixed(1), h: +ink.h.toFixed(1), end: +ink.end.toFixed(1) },
          b: { str, x: +x.toFixed(1), y: +y.toFixed(1), h: +h.toFixed(1) },
          why: `the next item is on another baseline (${ink.y.toFixed(1)} → ${y.toFixed(1)}) yet on the same row: its box overlaps the previous one's and it does not return left` });
    }
    raw += str;
    if (str && !ws(str)) { ink = { str, x, y, h, end: x + (it.width || 0) }; afterInk = raw.length; }
    if (it.hasEOL) raw += '\n';
    if (str) prev = { y, end: x + (it.width || 0) };
  }
  return { text: raw, startles };
}

/** the word touching position `at` from the left, and the word starting at `end` (with the token after it, for name context) */
function sides(text, at, end) {
  const left = (text.slice(Math.max(0, at - 60), at).match(/[\p{L}\p{N}'’-]+$/u) || [''])[0];
  const after = text.slice(end, end + 80), right = (after.match(/^[\p{L}\p{N}'’-]+/u) || [''])[0];
  const next = (after.slice(right.length).match(/^\s*([\p{L}\p{N}'’-]+)/u) || [, ''])[1];
  return { left, right, next };
}

/**
 * Each reading is scored by the share of its tokens the later layers can USE: a token is usable when the lexicon knows it, when the
 * document uses the same form elsewhere, or when, capitalised, it extends a name the referent layer has already established
 * (`corefer(fuller, name)` — the referent layer's own test). The higher share wins; a tie keeps the PDF's spacing.
 * ctx = { known(w), docCount(w) → occurrences in the document, names: [established names], corefer(a, b) }
 */
export function decideJunctions(text, startles, { known = () => false, docCount = () => 0, names = [], corefer = () => false } = {}) {
  return (startles || []).map((s) => {
    const { left, right, next } = sides(text, s.at, s.end);
    if (!left || !right) return { ...s, spaced: null, joined: null, decision: 'space', why: s.why, by: 'no word on one side of the junction: nothing to join' };
    const joined = left + right;
    const nameOf = (tok) => /^\p{Lu}/u.test(tok) && next && names.find((n) => corefer(`${tok} ${next}`, n));
    const use = (tok, own) => { const lc = tok.toLowerCase();
      if (known(lc)) return 'the lexicon knows it';
      if (docCount(lc) > own) return 'the document uses it elsewhere';
      const n = nameOf(tok); if (n) return `it extends the established name “${n}” (“${tok} ${next}”)`;
      return null; };
    const sp = [[left, use(left, 1)], [right, use(right, 1)]], jo = [[joined, use(joined, 0)]];
    const share = (l) => l.filter(([, u]) => u).length / l.length, a = share(sp), b = share(jo);
    const decision = b > a ? 'join' : 'space';
    const say = (l) => l.map(([t, u]) => `“${t}” ${u ? '— ' + u : '— no layer can use it'}`).join('; ');
    return { ...s, spaced: `${left}${s.gap.replace(/\s+/g, ' ')}${right}`, joined, scores: { spaced: +a.toFixed(2), joined: +b.toFixed(2) }, decision,
      by: b > a ? `joined reads better: ${say(jo)}; spaced: ${say(sp)}` : a > b ? `spaced reads better: ${say(sp)}; joined: ${say(jo)}` : `a tie (${a.toFixed(2)}): the PDF's own spacing is kept. spaced: ${say(sp)}; joined: ${say(jo)}` };
  });
}

/** Apply the 'join' decisions: remove each joined junction's gap. Later offsets shift; the caller keeps the PDF's own text beside it. */
export function applyJunctions(text, startles) {
  let out = '', cur = 0;
  for (const s of (startles || []).filter((x) => x.decision === 'join').sort((x, y) => x.at - y.at)) { if (s.at < cur) continue; out += text.slice(cur, s.at); cur = s.end; }
  return out + text.slice(cur);
}
