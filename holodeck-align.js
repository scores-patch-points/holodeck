// holodeck-align.js — merge a transcript someone already has with a recording, and check it against what the
// recording says. Pure functions, no DOM: the app hands in the supplied transcript and a fresh machine pass over the
// audio (segments of { start, end, text }), and gets back the supplied words, kept verbatim, carrying times and a
// per-segment verdict measured from how well the two readings agree.
//
// The supplied transcript is the authority on WORDS; the recording is the authority on TIME. Where the recognizer hears
// something the transcript does not say, that is reported as a gap, never written into the transcript.

// ---------- tokens ----------
const norm = w => w.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, '');
export function tokens(text) { return String(text || '').split(/\s+/).map(norm).filter(Boolean); }

// "[00:12] Chair: Good evening" -> the words said, without the clock and the speaker label (they are not in the audio)
const LEAD_CLOCK = /^\s*[\[(]?\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?[\])]?\s*[-–—]?\s*/;
const LEAD_LABEL = /^\s*(?:[A-Z][\w.'’-]*(?: [A-Z][\w.'’-]*){0,3}|SPEAKER \d+|Speaker \d+|[A-Z]{2,}):\s+/;
export function spoken(text) { return String(text || '').replace(LEAD_CLOCK, '').replace(LEAD_LABEL, ''); }

// Plain text -> segments with no times. A leading clock ([0:12], 00:12:03) is read as that segment's start.
export function parsePlain(raw) {
  const out = [];
  String(raw || '').replace(/\r/g, '').split(/\n\s*\n|\n(?=\s*[\[(]?\d{1,2}:\d{2})/).forEach(block => {
    const t = block.replace(/\s+/g, ' ').trim(); if (!t) return;
    const m = t.match(LEAD_CLOCK); let start = null;
    if (m && /\d:\d/.test(m[0])) { const p = m[0].match(/(\d{1,2}):(\d{2})(?::(\d{2}))?(?:[.,](\d{1,3}))?/); start = p[3] != null ? +p[1] * 3600 + +p[2] * 60 + +p[3] : +p[1] * 60 + +p[2]; if (p[4]) start += +('0.' + p[4]); }
    out.push({ text: t, start, end: null });
  });
  return out;
}

// ---------- the heard side: words with times (spread across each segment by length) ----------
export function heardWords(segs) {
  const out = [];
  (segs || []).forEach(g => {
    const ws = String(g.text || '').split(/\s+/).map(w => [w, norm(w)]).filter(x => x[1]); if (!ws.length) return;
    const total = ws.reduce((n, x) => n + x[1].length + 1, 0), span = Math.max(0, (g.end != null ? g.end : g.start) - g.start);
    let at = 0; ws.forEach(([raw, n]) => { const len = n.length + 1; out.push({ raw, n, t0: g.start + span * at / total, t1: g.start + span * (at + len) / total }); at += len; });
  });
  return out;
}

// ---------- alignment ----------
// Two words agree when equal, or when one typo apart in a long word (recognizers spell names their own way).
function near(a, b) {
  if (a === b) return true;
  if (a.length < 5 || b.length < 5 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  const [s, l] = a.length < b.length ? [a, b] : [b, a]; return s.slice(i) === l.slice(i + 1);
}

// Longest common subsequence under `near`, for the stretches between anchors (bounded: a stretch too large for the
// table is left unmatched rather than guessed at).
const MAX_CELLS = 6e6;
function lcs(a, b, a0, a1, b0, b1, out) {
  while (a0 < a1 && b0 < b1 && near(a[a0], b[b0])) { out.push([a0++, b0++]); }
  const tail = []; while (a0 < a1 && b0 < b1 && near(a[a1 - 1], b[b1 - 1])) { a1--; b1--; tail.push([a1, b1]); }
  const n = a1 - a0, m = b1 - b0;
  if (n > 0 && m > 0 && n * m <= MAX_CELLS) {
    const W = m + 1, t = new Uint16Array((n + 1) * W);
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) t[i * W + j] = near(a[a0 + i], b[b0 + j]) ? t[(i + 1) * W + j + 1] + 1 : Math.max(t[(i + 1) * W + j], t[i * W + j + 1]);
    let i = 0, j = 0;
    while (i < n && j < m) { if (near(a[a0 + i], b[b0 + j])) { out.push([a0 + i, b0 + j]); i++; j++; } else if (t[(i + 1) * W + j] >= t[i * W + j + 1]) i++; else j++; }
  }
  for (let k = tail.length - 1; k >= 0; k--) out.push(tail[k]);
}

// Patience-style: words (3-grams) that occur exactly once on each side pin the two texts together; the longest
// increasing run of those pins is kept, and the stretches between them are matched by LCS.
export function matchWords(a, b) {
  const K = 3, key = (arr, i) => arr[i] + ' ' + arr[i + 1] + ' ' + arr[i + 2];
  const count = (arr) => { const m = new Map(); for (let i = 0; i + K <= arr.length; i++) { const k = key(arr, i); m.set(k, m.has(k) ? -1 : i); } return m; };
  const ma = count(a), mb = count(b), pins = [];
  for (const [k, i] of ma) { if (i >= 0 && mb.has(k) && mb.get(k) >= 0) pins.push([i, mb.get(k)]); }
  pins.sort((x, y) => x[0] - y[0]);
  // longest increasing subsequence on the b index
  const tails = [], prev = new Array(pins.length).fill(-1), idx = [];
  pins.forEach((p, i) => { let lo = 0, hi = tails.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (pins[tails[mid]][1] < p[1]) lo = mid + 1; else hi = mid; } if (lo > 0) prev[i] = tails[lo - 1]; tails[lo] = i; });
  for (let i = tails.length ? tails[tails.length - 1] : -1; i >= 0; i = prev[i]) idx.push(i);
  idx.reverse();
  const out = []; let ai = 0, bi = 0;
  for (const pi of idx) {
    const [pa, pb] = pins[pi]; if (pa < ai || pb < bi) continue;
    lcs(a, b, ai, pa, bi, pb, out);
    for (let k = 0; k < K; k++) out.push([pa + k, pb + k]);
    ai = pa + K; bi = pb + K;
  }
  lcs(a, b, ai, a.length, bi, b.length, out);
  return out;
}

const median = xs => { if (!xs.length) return 0; const s = [...xs].sort((p, q) => p - q), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };

// ---------- the merge ----------
// given: [{ text, start?, end? }]   heard: [{ start, end, text }]   opts: { duration, okScore, weakScore }
// Returns { segments, summary }. Every segment keeps its supplied text verbatim; `check` says how it measured:
//   status 'ok'    — the recording says (nearly) the same words there; timed from the recording.
//   status 'weak'  — only some of the words were heard; timed from what matched, the rest interpolated.
//   status 'none'  — nothing of it was heard in the recording (or no words to compare): its time is interpolated
//                    from the segments around it and it is flagged for a person to look at.
// A supplied time that the recording contradicts by more than `tolerance` seconds is replaced by the heard time and
// the supplied one is kept in check.was.
export function merge(given, heard, opts = {}) {
  const okScore = opts.okScore != null ? opts.okScore : 0.7, weakScore = opts.weakScore != null ? opts.weakScore : 0.25, tol = opts.tolerance != null ? opts.tolerance : 2;
  const hw = heardWords(heard), hn = hw.map(w => w.n);
  const gw = []; // every spoken word of the supplied transcript, with its segment
  const segs = (given || []).map((g, si) => { const ws = tokens(spoken(g.text)); ws.forEach(n => gw.push({ n, si })); return { g, si, nw: ws.length }; });
  const pairs = matchWords(gw.map(w => w.n), hn);

  const hit = segs.map(() => ({ n: 0, t0: Infinity, t1: -Infinity, heard: [] }));
  const hitH = new Set();
  pairs.forEach(([gi, hi]) => { const s = hit[gw[gi].si], w = hw[hi]; s.n++; s.t0 = Math.min(s.t0, w.t0); s.t1 = Math.max(s.t1, w.t1); hitH.add(hi); });

  const out = segs.map(({ g, si, nw }) => {
    const h = hit[si], score = nw ? h.n / nw : 0;
    const timed = h.n > 0 && (nw < 4 ? h.n === nw : true);
    const status = !nw || !timed ? 'none' : score >= okScore ? 'ok' : score >= weakScore ? 'weak' : 'none';
    const seg = { text: g.text, start: status === 'none' ? null : h.t0, end: status === 'none' ? null : h.t1, check: { status, score: +score.toFixed(2), words: nw, matched: h.n } };
    if (g.start != null) seg.check.given = g.start;
    return seg;
  });

  // supplied times vs heard: a consistent offset (the transcript was cut from a different edit) is a finding, not noise
  const offs = out.filter(s => s.check.status === 'ok' && s.check.given != null).map(s => s.check.given - s.start);
  const offset = median(offs);
  out.forEach(s => { if (s.check.given != null && s.start != null) { s.check.offset = +(s.check.given - s.start).toFixed(2); if (Math.abs(s.check.offset) > tol) s.check.retimed = true; } });

  // segments that were not heard: time them from their neighbours, in proportion to their length
  const dur = opts.duration != null ? opts.duration : (hw.length ? hw[hw.length - 1].t1 : 0);
  for (let i = 0; i < out.length; i++) {
    if (out[i].start != null) continue;
    let j = i; while (j < out.length && out[j].start == null) j++;
    const lo = i > 0 ? out[i - 1].end : 0, hi = j < out.length ? out[j].start : Math.max(dur, lo);
    const lens = []; for (let k = i; k < j; k++) lens.push(Math.max(1, out[k].check.words || tokens(out[k].text).length)); const tot = lens.reduce((x, y) => x + y, 0);
    let at = lo; for (let k = i; k < j; k++) { const d = Math.max(0, hi - lo) * lens[k - i] / tot; out[k].start = at; out[k].end = at + d; out[k].check.timed = 'interpolated'; at += d; }
    i = j - 1;
  }
  // timing must not run backwards (a mis-pinned segment would otherwise tangle the playhead)
  let last = 0; out.forEach(s => { if (s.start < last) { s.start = last; s.check.clamped = true; } if (s.end < s.start) s.end = s.start; last = s.start; });

  // what the recording says that the transcript does not: runs of heard words no segment claimed
  const gaps = []; let run = null;
  hw.forEach((w, i) => { if (hitH.has(i)) { run = null; return; } if (!run) { run = { start: w.t0, end: w.t1, words: [] }; gaps.push(run); } run.end = w.t1; run.words.push(w.raw); });
  const unheard = gaps.filter(r => r.words.length >= 8).map(r => ({ start: +r.start.toFixed(1), end: +r.end.toFixed(1), words: r.words.length, text: r.words.join(' ').slice(0, 240) }));

  const total = out.reduce((n, s) => n + s.check.words, 0), matched = out.reduce((n, s) => n + s.check.matched, 0);
  const by = { ok: 0, weak: 0, none: 0 }; out.forEach(s => by[s.check.status]++);
  const coverage = total ? matched / total : 0, heardCover = hw.length ? hitH.size / hw.length : 0;
  const lines = coverage >= 0.85 && heardCover >= 0.8 ? 'lines up' : coverage >= 0.5 ? 'partly lines up' : 'does not line up';
  return { segments: out, summary: { verdict: lines, coverage: +coverage.toFixed(3), heardCoverage: +heardCover.toFixed(3), segments: out.length, ...by, offset: +offset.toFixed(2), retimed: out.filter(s => s.check.retimed).length, unheard, givenWords: total, heardWords: hw.length } };
}

export const verdictText = s => 'The transcript ' + s.verdict + ' with the recording: ' + Math.round(s.coverage * 100) + '% of its words were heard in the audio (' + s.ok + ' of ' + s.segments + ' passages match, ' + s.weak + ' partly, ' + s.none + ' not found)'
  + (s.heardCoverage < 0.8 ? '; ' + Math.round((1 - s.heardCoverage) * 100) + '% of what the recognizer heard is not in the transcript' : '')
  + (Math.abs(s.offset) > 2 ? '; its own timecodes ran ' + Math.abs(s.offset) + 's ' + (s.offset > 0 ? 'late' : 'early') + ' against the audio' : '') + '.';
