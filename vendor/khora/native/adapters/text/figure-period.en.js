// adapters/text/figure-period.en.js — THE PERIOD AND THE SIGN OF THE NUMBER, as an atom with an address (stage 2 of a prose-against-structured check).
//
// A prose sentence states a money figure ("Revenues were $153.4 million compared to $126.6 million") and a structured record holds a value for an
// entity, a measure and a PERIOD. Whether the two agree, differ in form, or contradict cannot be said until the prose figure has the period it is about:
// the first number is the release's current period, the second the comparative period, and neither is written next to the figure. This reads, for
// each money figure of a document, the period it is about and its sign, and says where it read them (the character span of the figure, of the
// period expression, or of the heading that set the frame), and says nothing when it cannot (a typed gap, never a guess).
//
//   figuresOf(text, { sentences, timePrior }) → { figures: [...], gaps: [...] }
//   a figure:  { value, scale, stated, text, span: [a, b], sentence: [a, b],
//                period: { kind: "duration" | "instant" | "unresolved", months?, end } | null,
//                basis: "sentence" | "comparative-shifted" | "frame" | "frame-comparative" | "ambiguous" | "none",
//                periodSpan: [a, b] | null, frameSpan: [a, b] | null, candidates?: [...],
//                comparative: boolean, polarity: "negative" | "positive" | null, polaritySpan: [a, b] | null, forwardLooking: boolean }
//
// HOW A FIGURE GETS ITS PERIOD (first that applies):
//   1. an explicit period expression in its own clause ("for the three months ended March 31, 2022"; "at June 30, 2023"; "in 2023"; "the second quarter
//      of 2021"); several figures and several expressions pair by order ("$24.0 million and $46.0 million for the three and six months ended ...");
//   2. a comparative clause (after "compared to", "compared with", "versus") with no period of its own takes the clause before it, one year earlier;
//   3. otherwise the FRAME: the last heading or lead line above it that names a period ("Consolidated Fourth Quarter 2017 Financial Results Compared
//      to Fourth Quarter 2016:", "... announced financial results for the first quarter ended March 31, 2018."). A frame naming two periods (a title
//      for the fourth quarter AND the full year) is ambiguous, and the figure then carries the candidates, not a choice.
//   A figure with none of these has period null.
// A duration with no stated verdict on stock or flow is not classified here: a balance-sheet figure at a frame is an instant at the same end date, and
// the consumer, which knows the record's kind, compares the end date (and the months only for a duration). No list of which measures are stocks.
//
// WHAT IS DECLARED (English closed class, said as such): the number words one..twelve, the ordinals first..fourth, calendar quarters (a fiscal year that is
// not the calendar year is not known here; quarter-derived ends are marked `calendar: "assumed"`), and the loss/income cue words for the sign. The month
// names are not typed: they come from TimePrior@1 (janus priors, found from Wiktionary and CLDR), and without it a period that needs a month name is a
// typed gap (`no_time_prior`). Another language needs its own codec; nothing here is the universal default.
// WINDOWS CHOSEN LOOKING AT DEVELOPMENT FILERS (dev-tuned, say so): the period words are searched up to 90 characters and nine tokens before "ended"; a heading is a
// line of at most 120 characters with no closing . , ; (or ending with a colon), a line over 220 characters is never a frame; "full year" is looked for in the 60
// characters before the figure. A filer the rules were not tuned on is the test of them (the held-out run), not these tests.
// Pure; deterministic; counts only; no model.

const NUMBER_WORDS = Object.freeze({ one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 });
const ORDINALS = Object.freeze({ first: 1, second: 2, third: 3, fourth: 4 });
const COMPARATIVE = /\b(?:as\s+)?compared\s+(?:to|with)\b|\bversus\b|\bvs\.?\s/gi;
const FORWARD = /\b(?:outlook|guidance|anticipate[sd]?|expects?|expected|forecast|to be|will\b|projected)/i;
// THE WRAP FIXES (each a flag, so each can be ablated; all on by default). Named from the held-out pass of PREREG-G2-4 (ladder-36), so they are FITTED to that filer's errors: a number they
// produce on that filer is a fit, not a rate.
//   wrap: a unit continues across a newline when the line before has no sentence-final mark and the next begins with a lowercase letter or a digit ("... ended December 31,\n2016, the Company ...")
//   yearless: "the six months ended June 30, ... for 2011 compared to ... for 2010": one duration, and the year of each "for <year>" that follows
//   ytd: "year to date ... the third quarter 2020" is three months per quarter so far
//   qnotation: "Q4 2011" and "2011 Q4" are quarters
//   fromComparative: "from $492 million in the prior year quarter" opens a comparative clause
//   ordinalDigits: "4th quarter 2013" (1st-4th) is an ordinal like "fourth"
//   fullYearClause: "full year" anywhere earlier in the clause makes a frameless figure twelve months (the window was 60 characters)
//   periodWords: when the frame names a quarter AND a full year, one of a closed pair of cue words (quarterly / <ordinal> quarter, versus full-year / annual / consecutive year / fiscal year) picks the 3- or 12-month candidate; both or neither leaves it ambiguous
//   continuation: a figure after the clause's last period phrase takes it when a preposition of the main clause attaches a measure ("... for the first quarter of 2011 on net sales of $222 million"); an appositive ("including a $60.0 million payment") stays a detail
export const FIXES = Object.freeze({ wrap: true, yearless: true, ytd: true, qnotation: true, fromComparative: true, continuation: true, ordinalDigits: true, fullYearClause: true, periodWords: true });
const FROM_PRIOR = /\bfrom\s+(?=\(?\$?\s?\d[\d,]*(?:\.\d+)?\)?\s*(?:million|billion)\b[^.;]{0,50}?\b(?:prior|previous|year[- ]ago|last\s+year|year\s+earlier|a\s+year\s+(?:ago|earlier)))/gi;
const Q_CUE = /\bquarterly\b|\b(?:first|second|third|fourth|[1-4](?:st|nd|rd|th))\s+quarter\b/i, Y_CUE = /\bfull[- ]year\b|\bannual(?:ly)?\b|\bconsecutive\s+year\b|\bfiscal\s+year\b/i;
const byWords = (text, set) => { const q = Q_CUE.test(text), y = Y_CUE.test(text); if (q === y) return null; const hits = set.filter((p) => p.months === (q ? 3 : 12)); return hits.length === 1 ? hits[0] : null; };
const CONTINUATION = /^[\s,]*(?:on|with)\s+(?:[A-Za-z-]+\s+){0,3}of\s*$/i;
const FINAL = /[.!?;:]["”’')\]]*\s*$/, CONTINUES = /^\s*[\p{Ll}\p{Nd}]/u;
const NEGATIVE_CUE = /\b(?:loss(?:es)?|deficit)\b|\bused\s+in\b/gi, POSITIVE_CUE = /\b(?:income|profit|earnings)\b|\bprovided\s+by\b/gi;

const pad = (n) => String(n).padStart(2, "0");
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();   // m is 1-based
const dateOf = (y, m, d) => `${y}-${pad(m)}-${pad(Math.min(d, lastDay(y, m)))}`;
const shiftYear = (iso, by) => { const [y, m, d] = iso.split("-").map(Number); const isEnd = d === lastDay(y, m); return dateOf(y + by, m, isEnd ? 31 : d); };
const quarterEnd = (year, q) => dateOf(year, q * 3, 31);

export function monthTable(timePrior) {
  const m = new Map();
  for (const c of Object.values(timePrior?.concepts ?? {})) if (c?.class === "month" && c.en && Number.isFinite(c.n)) m.set(String(c.en).toLowerCase(), c.n);
  const short = new Map(); for (const [name, n] of m) { const k = name.slice(0, 3); short.set(k, short.has(k) ? null : n); }   // an abbreviation only where the three letters name one month
  for (const [k, n] of short) if (n != null && !m.has(k)) m.set(k, n);
  return m;
}

/** The period expressions of one stretch of text, in order of position: [{ kind, months?, end, calendar?, a, b, text }] (offsets relative to `str`). */
export function periodsIn(str, months, { gaps = null, fixes = FIXES } = {}) {
  const out = [], taken = [];
  const free = (a, b) => !taken.some(([x, y]) => a < y && b > x);
  const take = (a, b) => taken.push([a, b]);
  if (months.size) {
    const MON = [...months.keys()].sort((x, y) => y.length - x.length).join("|"), DATE = String.raw`(?<mon>${MON})[\s,.]+(?<day>\d{1,2})(?:st|nd|rd|th)?,?\s+(?<year>\d{4})`;
    // 1. "<units> ended <date>": the units name one or several durations ("three and six months", "three months and year", "quarter and year")
    const durationsBefore = (endAt) => {
      const from = Math.max(0, endAt - 90), back = str.slice(from, endAt);
      // the tokens just before "ended", contiguous (only spaces and commas between them), at most nine
      const all = [...back.matchAll(/[A-Za-z0-9]+/g)].map((t) => ({ t: t[0].toLowerCase(), at: from + t.index, end: from + t.index + t[0].length }));
      const toks = []; for (let i = all.length - 1; i >= 0 && toks.length < 9; i--) { const gap = str.slice(all[i].end, i === all.length - 1 ? endAt : all[i + 1].at); if (!/^[\s,-]*$/.test(gap)) break; toks.unshift(all[i]); }
      const durations = []; let pending = [], first = null; const mark = (tk) => { if (first == null) first = tk.at; };
      for (const [ti, tk] of toks.entries()) {
        const t = tk.t;
        if (NUMBER_WORDS[t] != null) { pending.push(NUMBER_WORDS[t]); mark(tk); }
        else if (/^\d+$/.test(t) && /^months?$/.test(toks[ti + 1]?.t ?? "") && Number(t) > 0) { pending.push(Number(t)); mark(tk); }
        else if (t === "months" || t === "month") { if (pending.length) { durations.push(...pending); pending = []; } }
        else if (t === "quarter") { durations.push(3); mark(tk); } else if (t === "year") { durations.push(12); mark(tk); }
      }
      return { durations, first };
    };
    for (const m of str.matchAll(new RegExp(String.raw`\bended\s+${DATE}`, "gi"))) {
      const endAt = m.index, { durations, first } = durationsBefore(endAt);
      const end = dateOf(Number(m.groups.year), months.get(m.groups.mon.toLowerCase()), Number(m.groups.day));
      const a = first ?? endAt, b = endAt + m[0].length;
      if (durations.length && free(a, b)) { take(a, b); for (const d of durations) out.push({ kind: "duration", months: d, end, a, b, text: str.slice(a, b).trim() }); }
    }
    // 1b. (fixes.yearless) a date with no year: one duration, and each "for <year>" after it gives the year of one period; the period is placed at that year phrase, with `via` the words that gave the month and day
    if (fixes.yearless) for (const m of str.matchAll(new RegExp(String.raw`\bended\s+(?<mon>${MON})[\s.]+(?<day>\d{1,2})(?:st|nd|rd|th)?(?!\d)(?!,?\s*\d{4}\b)`, "gi"))) {
      const endAt = m.index, { durations, first } = durationsBefore(endAt); if (durations.length !== 1) continue;
      const mon = months.get(m.groups.mon.toLowerCase()), day = Number(m.groups.day), after = endAt + m[0].length, from = first ?? endAt;
      const years = [...str.slice(after).matchAll(/\b(?:for|in|during)\s+(?:the\s+(?:full[- ]year|year)\s+)?(?<year>(?:19|20)\d{2})\b/gi)].map((y) => ({ y: Number(y.groups.year), a: after + y.index, b: after + y.index + y[0].length })).filter((y) => free(y.a, y.b));
      if (!years.length || !free(from, after)) continue;
      take(from, after);
      for (const y of years) { take(y.a, y.b); out.push({ kind: "duration", months: durations[0], end: dateOf(y.y, mon, day), a: y.a, b: y.b, text: str.slice(y.a, y.b), via: [from, after] }); }
    }
    // 2. an instant: "at / as of <date>"
    for (const m of str.matchAll(new RegExp(String.raw`\b(?:at|as\s+of)\s+${DATE}`, "gi"))) { const a = m.index, b = a + m[0].length; if (free(a, b)) { take(a, b); out.push({ kind: "instant", end: dateOf(Number(m.groups.year), months.get(m.groups.mon.toLowerCase()), Number(m.groups.day)), a, b, text: m[0] }); } }
  } else if (gaps && /\b(?:ended|at|as\s+of)\s+\p{L}+\.?\s+\d{1,2},?\s+\d{4}/u.test(str)) gaps.push({ gap: "no_time_prior", detail: "a period needs a month name and TimePrior@1 is absent" });
  // 3. a quarter named by ordinal and year ("the second quarter of 2021", "2017 fourth quarter"), 3 months on a calendar quarter
  const ordTable = fixes.ordinalDigits ? { ...ORDINALS, "1st": 1, "2nd": 2, "3rd": 3, "4th": 4 } : ORDINALS, ORD = Object.keys(ordTable).join("|");
  // 3a. (fixes.ytd) "year to date ... the third quarter of 2020": the quarters so far, three months each
  if (fixes.ytd) for (const re of [new RegExp(String.raw`\byear[- ]to[- ]date\b[^.;]{0,60}?\b(?<ord>${ORD})\s+quarter(?:\s+of)?(?:\s+fiscal)?\s*,?\s*(?<year>\d{4})\b`, "gi"), new RegExp(String.raw`\b(?<ord>${ORD})\s+quarter(?:\s+of)?(?:\s+fiscal)?\s*,?\s*(?<year>\d{4})\b[^.;]{0,30}?\byear[- ]to[- ]date\b`, "gi")])
    for (const m of str.matchAll(re)) { const a = m.index, b = a + m[0].length; if (!free(a, b)) continue; take(a, b); const q = ordTable[m.groups.ord.toLowerCase()]; out.push({ kind: "duration", months: 3 * q, end: quarterEnd(Number(m.groups.year), q), calendar: "assumed", a, b, text: m[0] }); }
  // 3b. (fixes.qnotation) "Q4 2011", "Q4, 2011", "2011 Q4"
  if (fixes.qnotation) for (const re of [/\bQ(?<q>[1-4])\s*,?\s*(?:of\s+)?(?<year>(?:19|20)\d{2})\b/g, /\b(?<year>(?:19|20)\d{2})\s+Q(?<q>[1-4])\b/g])
    for (const m of str.matchAll(re)) { const a = m.index, b = a + m[0].length; if (!free(a, b)) continue; take(a, b); out.push({ kind: "duration", months: 3, end: quarterEnd(Number(m.groups.year), Number(m.groups.q)), calendar: "assumed", a, b, text: m[0] }); }
  for (const re of [new RegExp(String.raw`\b(?<ord>${ORD})\s+quarter(?:\s+of)?(?:\s+fiscal)?\s*,?\s*(?<year>\d{4})\b`, "gi"), new RegExp(String.raw`\b(?<year>\d{4})\s+(?<ord>${ORD})\s+quarter\b`, "gi")])
    for (const m of str.matchAll(re)) { const a = m.index, b = a + m[0].length; if (!free(a, b)) continue; take(a, b); out.push({ kind: "duration", months: 3, end: quarterEnd(Number(m.groups.year), ordTable[m.groups.ord.toLowerCase()]), calendar: "assumed", a, b, text: m[0] });
      const tail = str.slice(b, b + 20).match(/^\s+and\s+full[- ]year/i); if (tail) { out.push({ kind: "duration", months: 12, end: dateOf(Number(m.groups.year), 12, 31), calendar: "assumed", a, b: b + tail[0].length, text: m[0] + tail[0] }); take(b, b + tail[0].length); } }
  // 3b. "<ordinal> quarter and full year 2021": one year shared by a quarter and the year, so the expression names TWO periods
  for (const m of str.matchAll(new RegExp(String.raw`\b(?<ord>${ORD})\s+quarter\s+(?:and|&)\s+(?:full[- ]year|fiscal\s+year|year)\s+(?:of\s+)?(?<year>\d{4})\b`, "gi"))) {
    const a = m.index, b = a + m[0].length; if (!free(a, b)) continue; take(a, b);
    out.push({ kind: "duration", months: 3, end: quarterEnd(Number(m.groups.year), ordTable[m.groups.ord.toLowerCase()]), calendar: "assumed", a, b, text: m[0] }, { kind: "duration", months: 12, end: dateOf(Number(m.groups.year), 12, 31), calendar: "assumed", a, b, text: m[0] });
  }
  // 4. a year: "full year 2017", "fiscal year 2017", "for 2020", "in 2023"
  for (const re of [/\b(?:full[- ]year|fiscal\s+year|year)\s+(?:of\s+)?(?<year>\d{4})\b/gi, /\b(?:for|in|during)\s+(?:the\s+(?:full[- ]year|year)\s+)?(?<year>20\d{2}|19\d{2})\b(?!\s*(?:,|\.)?\s*(?:\d))/gi])
    for (const m of str.matchAll(re)) { const a = m.index, b = a + m[0].length; if (!free(a, b)) continue; take(a, b); out.push({ kind: "duration", months: 12, end: dateOf(Number(m.groups.year), 12, 31), calendar: "assumed", a, b, text: m[0] }); }
  return out.sort((x, y) => x.a - y.a);
}

const shiftPeriod = (p, by) => ({ ...p, end: shiftYear(p.end, by) });
const NUM = /(\(?)\$?\s?(\(?)(\d[\d,]*(?:\.\d+)?)\)?\s*(million|billion)\b/gi;

/** The units to read: the caller's sentences (offsets in `text`), cut again at newlines, or an internal cut; with `wrap`, adjacent pieces that are one sentence across a line wrap are joined again (the newline stays in the text, so offsets still index `text`). */
function unitsOf(text, sentences, wrap) {
  const base = Array.isArray(sentences) && sentences.length ? sentences.map((s) => ({ text: s.text, offset: s.offset })) : [...text.matchAll(/[^\n]+/g)].map((m) => ({ text: m[0], offset: m.index }));
  const out = [];
  for (const s of base) { let o = 0; for (const piece of s.text.split("\n")) { if (piece.trim()) out.push({ text: piece, offset: s.offset + o }); o += piece.length + 1; } }
  if (!wrap) return out;
  const merged = [];
  for (const u of out) {
    const prev = merged[merged.length - 1];
    if (prev && /^[ \t]*\n[ \t]*$/.test(text.slice(prev.offset + prev.text.length, u.offset)) && !FINAL.test(prev.text) && CONTINUES.test(u.text)) { prev.text = text.slice(prev.offset, u.offset + u.text.length); continue; }
    merged.push({ ...u });
  }
  return merged;
}

export function figuresOf(text, { sentences = null, timePrior = null, fixes = null } = {}) {
  const str = String(text ?? ""), gaps = [], months = monthTable(timePrior), fx = { ...FIXES, ...(fixes ?? {}) };
  if (!months.size) gaps.push({ gap: "no_time_prior", detail: "TimePrior@1 is absent: periods that need a month name are not read" });
  const units = unitsOf(str, sentences, fx.wrap);
  // FRAMES: lines that name a period and state no money figure and no forward-looking cue
  const frames = []; let lead = true;
  for (const u of units) {
    const hasFigure = (NUM.lastIndex = 0, NUM.test(u.text)); NUM.lastIndex = 0;
    if (hasFigure) lead = false;
    // the lead region (up to the first line that states a money figure) may set a frame by any line naming a period; after it only a heading may (short, no sentence punctuation at its end)
    const headingShaped = u.text.trim().length <= 120 && !/[.,;]\s*$/.test(u.text.trim()) || /:\s*$/.test(u.text.trim());
    if (hasFigure || u.text.length > 220 || FORWARD.test(u.text) || !(lead || headingShaped)) continue;
    const ps = periodsIn(u.text, months, { fixes: fx }); if (!ps.length) continue;
    const cut = [...u.text.matchAll(COMPARATIVE)][0]; const split = cut ? cut.index : u.text.length;
    const cur = ps.filter((p) => p.a < split), cmp = ps.filter((p) => p.a >= split);
    if (!cur.length) continue;
    frames.push({ at: u.offset, span: [u.offset, u.offset + u.text.length], current: cur.map((p) => ({ kind: p.kind, months: p.months, end: p.end, calendar: p.calendar })), comparative: (cmp.length ? cmp : cur).map((p) => ({ kind: p.kind, months: p.months, end: cmp.length ? p.end : shiftYear(p.end, -1), calendar: p.calendar })) });
  }
  const frameAt = (pos) => { let f = null; for (const fr of frames) if (fr.at <= pos) f = fr; else break; return f; };
  const figures = [];
  for (const u of units) {
    const forward = FORWARD.test(u.text);
    // the figures of this unit
    const figs = [];
    for (const m of u.text.matchAll(NUM)) { const raw = m[3], scale = m[4].toLowerCase() === "billion" ? 1e9 : 1e6, value = Number(raw.replace(/,/g, "")); const neg = m[1] === "(" || m[2] === "("; figs.push({ a: m.index, b: m.index + m[0].length, value, scale, stated: Number((value * scale).toPrecision(12)), text: m[0].trim(), parenNegative: neg }); }
    for (const m of u.text.matchAll(/(?:compared\s+(?:to|with)|versus|and)\s+(zero)\b|\b(zero)\s+and\b/gi)) { const a = m.index + m[0].toLowerCase().indexOf("zero"); figs.push({ a, b: a + 4, value: 0, scale: 1, stated: 0, text: "zero", parenNegative: false }); }
    if (!figs.length) continue; figs.sort((x, y) => x.a - y.a);
    // clauses: split at comparative markers
    const cutAt = [...u.text.matchAll(COMPARATIVE)].map((m) => m.index); if (fx.fromComparative) for (const m of u.text.matchAll(FROM_PRIOR)) cutAt.push(m.index);
    const cuts = [0, ...[...new Set(cutAt)].sort((x, y) => x - y), u.text.length];
    const clauses = []; for (let i = 0; i < cuts.length - 1; i++) clauses.push({ a: cuts[i], b: cuts[i + 1], comparative: i > 0 });
    const periods = periodsIn(u.text, months, { gaps, fixes: fx });
    // PAIRING in each clause. A phrase such as "for the three and six months ended ..." is a BLOCK of one or several durations. A block governs the figures just before it
    // (or, when none stands before it, those just after it up to the next block): as many figures as durations, by order, or all of them when it names one duration.
    // A figure no block governs is a detail of the sentence ("... and the $60.0 million amendment payment") and gets no period of its own.
    const inClauseOf = clauses.map((cl) => figs.filter((f) => f.a >= cl.a && f.a < cl.b)), assigns = [];
    for (const [ci, cl] of clauses.entries()) {
      const ps = periods.filter((p) => p.a >= cl.a && p.a < cl.b), blocks = [];
      for (const p of ps) { const last = blocks[blocks.length - 1]; if (last && last.a === p.a && last.b === p.b) last.items.push(p); else blocks.push({ a: p.a, b: p.b, items: [p] }); }
      const assign = new Map(); let prevEnd = cl.a;
      for (const [bi, bl] of blocks.entries()) {
        const next = blocks[bi + 1]; let cand = inClauseOf[ci].filter((f) => f.a >= prevEnd && f.a < bl.a && !assign.has(f));
        if (!cand.length) cand = inClauseOf[ci].filter((f) => f.a >= bl.b && f.a < (next ? next.a : cl.b) && !assign.has(f));
        if (cand.length === bl.items.length) cand.forEach((f, k) => assign.set(f, bl.items[k])); else if (bl.items.length === 1) cand.forEach((f) => assign.set(f, bl.items[0]));
        prevEnd = bl.b;
      }
      // (fixes.continuation) a figure after the last period phrase of the clause, attached by "on / with <up to three words> of", is covered by that phrase when it names one period
      if (fx.continuation) for (const f of inClauseOf[ci]) {
        if (assign.has(f)) continue;
        const bl = [...blocks].reverse().find((b) => b.b <= f.a);
        if (bl && bl.items.length === 1 && CONTINUATION.test(u.text.slice(bl.b, f.a))) assign.set(f, { ...bl.items[0], inherited: true });
      }
      assigns.push({ assign, hasPeriods: ps.length > 0 });
    }
    for (const [ci, cl] of clauses.entries()) {
      const inClause = inClauseOf[ci], { assign, hasPeriods } = assigns[ci];
      for (const [i, f] of inClause.entries()) {
        let period = null, basis = "none", periodSpan = null, frameSpan = null, candidates, viaWords = false;
        const own = assign.get(f) ?? null;
        if (own) { period = { kind: own.kind, months: own.months, end: own.end, ...(own.calendar ? { calendar: own.calendar } : {}) }; basis = "sentence"; periodSpan = [u.offset + own.a, u.offset + own.b]; }
        else if (!hasPeriods && cl.comparative && ci > 0) {
          // a comparative clause with no period of its own takes the periods of the clause before it, one year earlier, figure by figure
          const prevFigs = inClauseOf[ci - 1].filter((x) => assigns[ci - 1].assign.has(x)); const srcFig = prevFigs.length ? prevFigs[Math.min(i, prevFigs.length - 1)] : null, src = srcFig ? assigns[ci - 1].assign.get(srcFig) : null;
          if (src) { period = { kind: src.kind, months: src.months, end: shiftYear(src.end, -1), ...(src.calendar ? { calendar: src.calendar } : {}) }; basis = "comparative-shifted"; periodSpan = [u.offset + src.a, u.offset + src.b]; }
        }
        if (!period && hasPeriods) basis = "detail";
        if (!period && !hasPeriods) {
          const fr = frameAt(u.offset + f.a);
          if (fr) { const set = cl.comparative ? fr.comparative : fr.current; frameSpan = fr.span;
            // "full year revenues" with no year of its own: twelve months ending where the frame ends
            const fullYear = !cl.comparative && /\bfull[- ]year\b/i.test(u.text.slice(fx.fullYearClause ? cl.a : Math.max(cl.a, f.a - 60), f.a));
            if (fullYear && set.length) { const e = set[0].end; period = { kind: "duration", months: 12, end: e, calendar: "assumed" }; basis = "frame"; }
            else if (set.length === 1) { period = { ...set[0] }; basis = cl.comparative ? "frame-comparative" : "frame"; }
            else if (set.length > 1 && fx.periodWords && byWords(u.text.slice(cl.a, cl.b), set)) { period = { ...byWords(u.text.slice(cl.a, cl.b), set) }; basis = cl.comparative ? "frame-comparative" : "frame"; viaWords = true; }
            else if (set.length > 1) { basis = "ambiguous"; candidates = set.map((p) => ({ kind: p.kind, months: p.months, end: p.end })); } }
        }
        // sign: the last loss/income cue between the previous figure (or the clause start) and this one; parentheses are negative; a coordinated figure keeps the cue of the one before it
        const from = Math.max(cl.a, i > 0 ? inClause[i - 1].b : cl.a), win = u.text.slice(from, f.a); let polarity = null, polaritySpan = null;
        const cues = [...[...win.matchAll(NEGATIVE_CUE)].map((m) => ({ at: m.index, len: m[0].length, p: "negative" })), ...[...win.matchAll(POSITIVE_CUE)].map((m) => ({ at: m.index, len: m[0].length, p: "positive" }))].sort((x, y) => y.at - x.at);
        if (f.parenNegative) { polarity = "negative"; polaritySpan = [u.offset + f.a, u.offset + f.b]; } else if (cues.length) { polarity = cues[0].p; polaritySpan = [u.offset + from + cues[0].at, u.offset + from + cues[0].at + cues[0].len]; }
        else if (i > 0 && /^[\s,]*(?:and|or)?[\s,]*$/i.test(u.text.slice(inClause[i - 1].b, f.a).replace(/\s*(?:million|billion)\s*$/i, ""))) { const pf = figures[figures.length - 1]; if (pf) { polarity = pf.polarity; polaritySpan = pf.polaritySpan; } }
        figures.push({ value: f.value, scale: f.scale, stated: f.stated, text: f.text, span: [u.offset + f.a, u.offset + f.b], sentence: [u.offset, u.offset + u.text.length], period, basis, periodSpan, ...(own?.inherited ? { inherited: true } : {}), ...(viaWords ? { disambiguated: true } : {}), ...(own?.via ? { partSpan: [u.offset + own.via[0], u.offset + own.via[1]] } : {}), frameSpan, ...(candidates ? { candidates } : {}), comparative: cl.comparative, polarity, polaritySpan, forwardLooking: forward });
      }
    }
  }
  return { figures, gaps, frames: frames.map((f) => ({ span: f.span, current: f.current, comparative: f.comparative })) };
}
