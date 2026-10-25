// punctuation.js — PUNCTUATION IS READ, NOT THROWN AWAY.
//
// Where it sits in the pipeline: BETWEEN the bytes and everything that reads them.
//
//   text ─▶ scan ─▶ tokens (words and marks, in order, every mark kept with a ROLE) ─▶ structure ─▶ …
//                                                                                      ├─▶ POS: only words are asked; a mark's class is its Unicode category
//                                                                                      ├─▶ sentences: where a thought ends, and HOW (it asks, it exclaims, it trails off)
//                                                                                      ├─▶ worlds: a quotation or a bracket is a container; speech, thought, aside
//                                                                                      └─▶ propositions: each lives inside its containers, in order, with the mood of its sentence
//
// What a mark changes about a proposition (the point of keeping it):
//   · MOOD — a sentence that ends in "?" asks; it does not assert. A proposition read from it is a question about (subject, relation, object), never
//     the claim itself. "!" exclaims, "…" trails off (the thought is not closed), no terminator is a fragment (a heading, a label, a field).
//   · CONTAINERS — “…” (any language's own pair), (…), [ … ], and a pair of dashes put words inside someone's saying or an aside. A proposition inside
//     one is NESTED in it: its tuple has a parent, and the parent knows what holds it (speech, aside). Depth is however deep the marks nest.
//   · BOUNDARIES — ";" and ":" end a clause more firmly than ","; a dash opens an aside. They are the cuts clause-level propositions are made between.
//   · ORDER — marks are tokens with positions, so every container, boundary and proposition is addressed by offsets in the original text. Nothing here
//     reorders anything: the first proposition in the text is first in its sibling list, and a nested one comes where it sits.
//
// Norms are DECLARED per language (punctuation-norms.json: terminators, pairs, decimal and grouping marks, whether a dot can be an ordinal or an
// abbreviation). Which words are abbreviations is MEASURED per language (janus priors/punctuation-<stem>.json, vendored with khora; its index names each language's file) and added to from the document itself (the
// sentence splitter's deriveAbbreviations). A language with no norms is read with the default and says so.
//
// Not only text: other modalities carry the same information by other means. `cues` are boundaries a modality supplies — an OCR page's line breaks
// and wide gaps, a markup page's block edges, a transcript's pauses — and they join the structure as boundaries of their own, with their source named.
// So an image of a page, a web page and a spoken word each arrive at the same record.
//
// Pure: no DOM, no network. Offsets s/e are UTF-16 indices into the text given, plus `base`.
const WORD = /[\p{L}\p{N}\p{M}]+(?:['’\-][\p{L}\p{N}\p{M}]+)*/uy;
const PUNCT_OR_SYM = /[\p{P}\p{S}]/u;
export const punctClass = (ch) => (/^\p{P}$/u.test(ch) ? 'PUNCT' : /^\p{S}$/u.test(ch) ? 'SYM' : null);
const isLetter = (c) => !!c && /\p{L}/u.test(c), isUpper = (c) => !!c && /\p{Lu}/u.test(c), isLower = (c) => !!c && /\p{Ll}/u.test(c), isDigit = (c) => !!c && /\p{Nd}/u.test(c);
const lastRun = (w) => { let j = w.length; while (j > 0 && /[\p{L}\p{M}]/u.test(w[j - 1])) j--; return w.slice(j); };

/** The norms for a language: the default, with the language's own entries over it. */
export function normsFor(all, lang) {
  const d = all.default, l = (all.langs && lang && (all.langs[lang] || all.langs[String(lang).split('-')[0]])) || null;
  const m = { ...d, ...(l || {}), pairs: { ...d.pairs, ...((l && l.pairs) || {}) }, separators: { ...d.separators, ...((l && l.separators) || {}) } };
  return { ...m, lang: lang || null, known: !!l };
}

/** Everything the scanner reads for a language, fetched once. */
const CACHE = new Map();
export async function loadPunctuation(base, lang, fetchImpl = (...a) => fetch(...a)) {
  const key = `${base}|${lang}`; if (CACHE.has(key)) return CACHE.get(key);
  const p = (async () => {
    const get = async (u) => { try { const r = await fetchImpl(new URL(u, base)); return r.ok ? await r.json() : null; } catch (e) { return null; } };
    // the measured prior's one home is janus (priors/punctuation-<stem>.json); the page reads the copy vendored with khora, through its index
    const PRIORS = '../vendor/khora/native/priors/';
    const [all, index] = await Promise.all([get('punctuation-norms.json'), lang ? get(PRIORS + 'punctuation-index.json') : null]);
    const entry = index && index.langs ? index.langs[String(lang).split('-')[0]] : null;
    const prior = entry ? await get(PRIORS + entry.file) : null;
    const norms = normsFor(all || { default: { terminators: ['.', '!', '?'], pairs: { quote: [['“', '”']], bracket: [['(', ')']] }, separators: { weak: [','], strong: [';', ':'] }, toggle: ['"'], dashes: ['—'], abbreviationDot: true } }, lang);
    return { norms, abbreviations: new Set((prior && prior.abbreviations) || []), prior: prior ? { giver: prior.giver, thin: !!prior.thin, n: (prior.abbreviations || []).length } : null };
  })();
  CACHE.set(key, p); return p;
}

/**
 * scanPunctuation(text, { norms, abbreviations, base, cues }) →
 *   { tokens, words, punct, structure }
 *   token  { w, s, e, kind:'word'|'punct', upos?, role?, pair?, depth?, attached? }   (a word's trailing abbreviation/ordinal dot is part of the word)
 *   structure { sentences, containers, boundaries, notes }
 */
export function scanPunctuation(text, { norms, abbreviations = null, base = 0, cues = [] } = {}) {
  const src = String(text ?? ''), N = norms || normsFor({ default: { terminators: ['.', '!', '?'], questions: ['?'], exclamations: ['!'], pairs: { quote: [['“', '”']], bracket: [['(', ')']] }, separators: { weak: [','], strong: [';', ':'] }, toggle: ['"'], dashes: ['—'], abbreviationDot: true, decimal: ['.'] } }, null);
  const abbr = abbreviations instanceof Set ? abbreviations : new Set(abbreviations || []);
  const term = new Set(N.terminators), ques = new Set(N.questions || []), exc = new Set(N.exclamations || []), weak = new Set((N.separators || {}).weak || []), strong = new Set((N.separators || {}).strong || []), dashes = new Set(N.dashes || []), ell = new Set(N.ellipsis || []);
  const openOf = new Map(), closeOf = new Map(), kindOf = new Map();
  for (const kind of ['quote', 'bracket']) for (const [o, c] of (N.pairs && N.pairs[kind]) || []) { if (!openOf.has(o)) openOf.set(o, { c, kind }); if (!closeOf.has(c)) closeOf.set(c, { o, kind }); kindOf.set(o, kind); kindOf.set(c, kind); }
  const toggle = new Set(N.toggle || []), inverted = N.inverted || {};
  const decimal = new Set(N.decimal || ['.']), tokens = [];
  const paraEndAfter = (i) => /^[ \t]*(\n[ \t]*\n|$)/.test(src.slice(i, i + 12));
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    WORD.lastIndex = i; const m = WORD.exec(src);
    if (m) {
      let w = m[0], j = i + w.length;
      // a number keeps its decimal mark and a dotted/comma'd group between digits ("3.5", "3,5", "1.234,56")
      if (/^\p{N}+$/u.test(w) || /\p{N}$/u.test(w)) { while ((decimal.has(src[j]) || (N.grouping || []).includes(src[j])) && isDigit(src[j + 1]) && isDigit(src[j - 1])) { const nx = (() => { WORD.lastIndex = j + 1; return WORD.exec(src); })(); if (!nx || nx.index !== j + 1) break; w = src.slice(i, j + 1 + nx[0].length); j += 1 + nx[0].length; } }
      // a dotted initialism ("U.S", "e.g") continues over a letter-dot-letter chain
      while (src[j] === '.' && isLetter(src[j + 1]) && /^\p{L}$/u.test(lastRun(w).slice(-1)) && (lastRun(w).length === 1)) { WORD.lastIndex = j + 1; const nx = WORD.exec(src); if (!nx || nx.index !== j + 1 || nx[0].length > 2) break; w += '.' + nx[0]; j += 1 + nx[0].length; }
      let role = null;
      if (src[j] === '.' && N.abbreviationDot !== false) {
        const run = lastRun(w), lower = run.toLowerCase(), single = run.length === 1 && isUpper(run), nextCh = src.slice(j + 1).match(/^[ \t]*\n?[ \t]*(\p{L}|\p{N})?/u), next = nextCh && nextCh[1];
        if (/^\p{Nd}{1,2}$/u.test(w) && N.ordinalDot && isLower(next)) role = 'ordinal';                                     // de: "3. mal"
        else if (/^(?:\p{L}\.)+\p{L}$/u.test(w)) role = 'initialism';                                                      // U.S.  e.g.
        else if (single && next && isUpper(next)) role = 'initial';                                                         // J. Smith
        else if (run && abbr.has(lower) && !paraEndAfter(j + 1)) role = 'abbreviation';                                     // Dr. Mr. etc. — by the language's measured prior
      }
      if (role) { w += '.'; j += 1; }
      tokens.push({ w, s: base + i, e: base + j, kind: 'word', ...(role ? { attached: role } : {}) });
      i = j; continue;
    }
    const cp = String.fromCodePoint(src.codePointAt(i)), n = cp.length;
    if (PUNCT_OR_SYM.test(cp)) {
      // "..." is one mark, an ellipsis
      if (cp === '.' && src.startsWith('...', i)) { tokens.push({ w: '...', s: base + i, e: base + i + 3, kind: 'punct', upos: 'PUNCT', role: 'ellipsis' }); i += 3; continue; }
      tokens.push({ w: cp, s: base + i, e: base + i + n, kind: 'punct', upos: punctClass(cp) });
    }
    i += n;
  }
  // roles for marks (words are done): terminators, separators, dashes, pairs
  const stack = [], containers = [], punct = tokens.filter((t) => t.kind === 'punct');
  tokens.forEach((t, k) => {
    if (t.kind !== 'punct' || t.role === 'ellipsis') { if (t.role === 'ellipsis') t.mood = 'trailing'; return; }
    const c = t.w, prev = tokens[k - 1], next = tokens[k + 1], gapBefore = prev ? t.s - prev.e : 1, gapAfter = next ? next.s - t.e : 1;
    const closing = closeOf.get(c), opening = openOf.get(c);
    if (inverted[c]) t.role = 'open-' + (inverted[c] === '?' ? 'question' : 'exclamation');
    else if (ell.has(c)) { t.role = 'ellipsis'; t.mood = 'trailing'; }
    else if (term.has(c)) { t.role = 'terminator'; t.mood = ques.has(c) ? 'interrogative' : exc.has(c) ? 'exclamative' : 'declarative'; }
    else if (strong.has(c)) t.role = 'separator-strong';
    else if (weak.has(c)) t.role = 'separator';
    else if (dashes.has(c)) t.role = 'dash';
    else if (c === '-' && gapBefore > 0 && gapAfter > 0) t.role = 'dash';
    else if (toggle.has(c)) { const top = stack.length && stack[stack.length - 1]; if (top && top.c === c) { t.role = 'close-' + 'quote'; } else t.role = 'open-quote'; }
    else if (opening && (!closing || !stack.some((x) => x.close === c))) t.role = 'open-' + opening.kind;
    else if (closing) t.role = 'close-' + closing.kind;
    else if (t.upos === 'SYM') t.role = 'symbol';
    else t.role = 'mark';
    // pair bookkeeping
    if (/^open-(quote|bracket)$/.test(t.role)) { const o = openOf.get(c); stack.push({ idx: k, c, close: o ? o.c : c, kind: /quote/.test(t.role) ? 'quote' : 'bracket' }); t.depth = stack.length; }
    else if (/^close-(quote|bracket)$/.test(t.role)) {
      let at = -1; for (let q = stack.length - 1; q >= 0; q--) if (stack[q].close === c) { at = q; break; }
      if (at >= 0) { const o = stack[at]; stack.length = at; const open = tokens[o.idx]; t.pair = o.idx; open.pair = k; t.depth = stack.length + 1; containers.push({ kind: o.kind, open: o.idx, close: k, s: open.s, e: t.e, depth: stack.length + 1, mark: open.w + t.w }); }
      else t.role = 'mark';
    }
  });
  // an open mark with no close is kept as a typed gap, never a guessed container
  const unclosed = tokens.filter((t) => /^open-(quote|bracket)$/.test(t.role || '') && t.pair == null).map((t) => ({ s: t.s, w: t.w }));
  // dashes that pair up (— … —) are an aside
  const dashIdx = tokens.map((t, k) => (t.role === 'dash' && t.w !== '-' ? k : -1)).filter((k) => k >= 0);
  for (let q = 0; q + 1 < dashIdx.length; q += 2) { const a = tokens[dashIdx[q]], b = tokens[dashIdx[q + 1]]; if (!tokens.slice(dashIdx[q], dashIdx[q + 1]).some((t) => t.role === 'terminator')) containers.push({ kind: 'aside', open: dashIdx[q], close: dashIdx[q + 1], s: a.s, e: b.e, depth: 1, mark: a.w + b.w }); }
  // sentences: a terminator (with any closing marks that follow it) ends one; the last may be unterminated (a fragment)
  const sentences = []; let from = 0, start = null;
  tokens.forEach((t, k) => {
    if (start == null && (t.kind === 'word' || /^open-/.test(t.role || ''))) start = k;
    if (t.role === 'terminator' || (t.role === 'ellipsis' && /^\s*\n|^\s*\p{Lu}/u.test(src.slice(t.e - base, t.e - base + 4)))) {
      let endTok = k; while (tokens[endTok + 1] && /^close-/.test(tokens[endTok + 1].role || '') && tokens[endTok + 1].s - tokens[endTok].e <= 1) endTok++;
      // a terminator INSIDE a quotation does not end the sentence the quotation sits in when the sentence goes on after the closing mark in lower
      // case — “Why?” he asked. — but it does when what follows begins a new sentence or there is nothing left
      const holder = containers.filter((c) => c.kind === 'quote' && c.open < k && c.close > k).sort((x, y) => x.close - y.close)[0];
      const after = holder && tokens.slice(holder.close + 1).find((x) => x.kind === 'word'), inside = !!(holder && after && isLower(after.w[0]) && after.s - tokens[holder.close].e <= 2);
      if (!inside) { if (start != null) sentences.push({ s: tokens[start].s, e: tokens[endTok].e, from: start, to: endTok, terminator: t.w, mood: t.mood || (t.role === 'ellipsis' ? 'trailing' : 'declarative') }); start = null; from = endTok + 1; }
    }
  });
  if (start != null) { const last = tokens.length - 1; sentences.push({ s: tokens[start].s, e: tokens[last].e, from: start, to: last, terminator: null, mood: 'fragment' }); }
  // each container knows its own mood (a quoted question) and what it holds
  for (const c of containers) { const inner = tokens.slice(c.open + 1, c.close).filter((t) => t.role === 'terminator' || t.role === 'ellipsis'); c.mood = inner.length ? inner[inner.length - 1].mood : null; }
  containers.sort((a, b) => a.s - b.s || b.e - a.e);
  // boundaries: every mark that closes or cuts, in order, with its strength and where it came from (a modality's cues join them)
  const boundaries = [];
  for (const t of tokens) { if (t.role === 'terminator') boundaries.push({ at: t.s, kind: 'sentence', strength: 4, source: 'mark', w: t.w }); else if (t.role === 'separator-strong') boundaries.push({ at: t.s, kind: 'clause', strength: 3, source: 'mark', w: t.w }); else if (t.role === 'separator') boundaries.push({ at: t.s, kind: 'phrase', strength: 1, source: 'mark', w: t.w }); else if (t.role === 'dash') boundaries.push({ at: t.s, kind: 'aside', strength: 2, source: 'mark', w: t.w }); }
  for (const c of cues) boundaries.push({ at: c.at, kind: c.kind || 'break', strength: c.strength ?? 1, source: c.source || 'cue', ...(c.w ? { w: c.w } : {}) });
  boundaries.sort((a, b) => a.at - b.at || b.strength - a.strength);
  const words = tokens.filter((t) => t.kind === 'word');
  const structure = { sentences, containers, boundaries, notes: { lang: N.lang, normsKnown: N.known !== false, unclosed, abbreviations: tokens.filter((t) => t.attached === 'abbreviation').length } };
  return { tokens, words, punct, structure };
}

/** The chain of containers around an offset, outermost first — where a proposition at this offset is NESTED. */
export function containersAt(structure, offset) { return structure.containers.filter((c) => c.s <= offset && offset < c.e).sort((a, b) => b.e - b.s - (a.e - a.s)); }
/** The sentence an offset sits in (its mood is the mood of every proposition read from it, unless a container says otherwise). */
export function sentenceAt(structure, offset) { return structure.sentences.find((x) => x.s <= offset && offset < x.e) || null; }
/** The mood a proposition at `offset` is held in: the innermost container that has its own mood, else its sentence's. */
export function moodAt(structure, offset) { const cs = containersAt(structure, offset).filter((c) => c.mood); if (cs.length) return cs[cs.length - 1].mood; const s = sentenceAt(structure, offset); return s ? s.mood : 'fragment'; }

// ── OTHER MODALITIES: the same boundaries, carried by other means ───────────────────────────────────────────────────────────────────────
/** Plain text: a blank line is a paragraph break (strength 5); a single newline is a soft break (1). */
export function cuesFromBlankLines(text) { const out = []; for (const m of String(text).matchAll(/\n[ \t]*\n+|\n/g)) out.push({ at: m.index, kind: m[0].length > 1 ? 'paragraph' : 'line', strength: m[0].length > 1 ? 5 : 1, source: 'text-layout' }); return out; }
/** An OCR page: where each line starts, where the page leaves a vertical gap (a paragraph), and where a wide gap splits a line into cells (a field or column). */
export function cuesFromLayout(layout, text) {
  const out = [];
  for (const pg of layout.pages) { const lines = pg.lines.filter((l) => l.s < text.length).slice().sort((a, b) => a.b[1] - b.b[1] || a.b[0] - b.b[0]); const hs = lines.map((l) => l.b[3] - l.b[1]).sort((a, b) => a - b), h = hs[Math.floor(hs.length / 2)] || 10;
    lines.forEach((l, i) => { const prev = lines[i - 1], gap = prev ? l.b[1] - prev.b[3] : Infinity; out.push({ at: l.s, kind: gap > h * 0.9 ? 'paragraph' : 'line', strength: gap > h * 0.9 ? 5 : 1, source: 'ocr-layout' });
      const t = text.slice(l.s, l.e); for (const m of t.matchAll(/ {2,}/g)) out.push({ at: l.s + m.index, kind: 'cell', strength: 2, source: 'ocr-gap' }); }); }
  return out;
}
/** A transcript with times ({start,end,text} in seconds): a pause between segments is a boundary, longer pauses stronger. */
export function cuesFromTimings(segments, text = '', { weak = 0.25, strong = 0.7 } = {}) {
  const out = []; let at = 0;
  segments.forEach((sg, i) => { const found = text ? text.indexOf(sg.text, at) : -1; const pos = found >= 0 ? found : at; if (found >= 0) at = found + sg.text.length; const prev = segments[i - 1]; if (prev) { const pause = sg.start - prev.end; if (pause >= weak) out.push({ at: pos, kind: pause >= strong ? 'sentence' : 'phrase', strength: pause >= strong ? 4 : 1, source: 'prosody', pause: +pause.toFixed(2) }); } });
  return out;
}
/** A marked-up page: the edges of block elements (paragraphs, list items, headings, table cells) in the text they were flattened to — given as offsets by the caller. */
export function cuesFromBlocks(blocks) { return blocks.map((b) => ({ at: b.at, kind: b.kind || 'block', strength: b.kind === 'cell' ? 2 : 5, source: 'markup' })); }
