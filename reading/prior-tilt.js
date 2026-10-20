// prior-tilt.js — a PRIOR TILTS a reading; it never stands in for one.
//
// The reading comes from the page: every label, value and heading is the OCR's own text, with the OCR's own spelling. A prior (a blank form
// the publisher printed, measured by prior-measure.js) only moves WEIGHTS:
//   · a word on the scan that the blank form also prints, in the same place, is more likely PRINTED (the form talking, a label)
//   · a word inside a box the blank form leaves for filling in is more likely FILLED IN (the filer talking, a value)
//   · a box the blank form leaves, with words in it on the scan, is evidence of a field even where the page's own rules were not found
// What the prior says is kept as attributed evidence (the form, its source and hash, the field's name, what the form prints beside it) for
// the provenance panel. It is never copied into the reading.
const norm = (s) => String(s || '').normalize('NFKD').replace(/\p{M}+/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''); // any script, accents folded
function lev(a, b) { if (a === b) return 0; const m = a.length, n = b.length; if (!m || !n) return Math.max(m, n); let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; } return prev[n]; }
export const similarity = (a, b) => { const x = norm(a), y = norm(b); if (!x || !y) return 0; return 1 - lev(x, y) / Math.max(x.length, y.length); };

/** Which page of the prior this scanned page is: the most shared words (length ≥ 4). */
export function choosePage(prior, page) {
  const bag = (ws) => new Set(ws.map((w) => norm(w)).filter((w) => w.length >= 4));
  const mine = bag(page.words.map((w) => w.t)); let best = null;
  for (const tp of prior.pages) { const theirs = bag(tp.words.map((w) => w[0])); let k = 0; for (const w of mine) if (theirs.has(w)) k++; const j = k / Math.max(1, Math.min(mine.size, theirs.size)); if (!best || j > best.j) best = { tp, j }; }
  return best;
}

/** LOCAL ALIGNMENT, IGNORING WHITESPACE THAT MEANS NOTHING. A filed form is often a re-rendering of the blank one (rows move), and OCR splits
 *  and joins words at will ("fromline12" for "from line 12", "Partil" for "Part II"). So:
 *   · a space INSIDE a run of text carries nothing — each run is compared as one stream of letters and digits (any script), whitespace and
 *     punctuation (leader dots) dropped;
 *   · a WIDE gap carries meaning — it separates a label from its value, one column from the next — so lines are cut into SEGMENTS there;
 *   · segments are matched in reading order by shared character trigrams, and inside each matched pair the characters that agree (their
 *     longest common subsequence) become ANCHORS, each at its own position inside its word's box;
 *   · any point of the blank form is carried onto the scan by its nearest anchors: in y from those nearest in y, in x from those on its row. */
const isCh = (c) => /[\p{L}\p{N}]/u.test(c);
function segmentsOf(words, gapK) {
  const rows = [];
  for (const w of words.slice().sort((p, q) => (p.b[1] + p.b[3]) / 2 - (q.b[1] + q.b[3]) / 2 || p.b[0] - q.b[0])) { const cy = (w.b[1] + w.b[3]) / 2, h = w.b[3] - w.b[1]; const r = rows.find((x) => Math.abs(x.cy - cy) < Math.max(2.5, h * 0.45)); if (r) r.ws.push(w); else rows.push({ cy, ws: [w] }); }
  const segs = [];
  for (const r of rows) { r.ws.sort((p, q) => p.b[0] - q.b[0]); const cw = r.ws.reduce((t, w) => t + (w.b[2] - w.b[0]) / Math.max(1, w.t.length), 0) / r.ws.length; let cur = null;
    for (const w of r.ws) { if (!cur || w.b[0] - cur.x1 > cw * gapK) { cur = { cy: r.cy, x0: w.b[0], x1: w.b[2], ws: [] }; segs.push(cur); } cur.ws.push(w); cur.x1 = Math.max(cur.x1, w.b[2]); } }
  for (const g of segs) { g.ch = []; for (const w of g.ws) { const cs = [...w.t]; cs.forEach((c, i) => { if (isCh(c)) g.ch.push({ c: c.toLowerCase(), x: w.b[0] + ((i + 0.5) / cs.length) * (w.b[2] - w.b[0]), y: (w.b[1] + w.b[3]) / 2 }); }); }
    g.s = g.ch.map((x) => x.c).join(''); g.tri = new Set(); for (let i = 0; i + 3 <= g.s.length; i++) g.tri.add(g.s.slice(i, i + 3)); }
  return segs.filter((g) => g.s.length >= 3).sort((p, q) => p.cy - q.cy || p.x0 - q.x0);
}
const dice = (A, B) => { if (!A.size || !B.size) return 0; let k = 0; for (const t of A) if (B.has(t)) k++; return (2 * k) / (A.size + B.size); };
function lcsPairs(a, b) { const n = a.length, m = b.length, D = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) D[i][j] = a[i - 1].c === b[j - 1].c ? D[i - 1][j - 1] + 1 : Math.max(D[i - 1][j], D[i][j - 1]);
  const out = []; for (let i = n, j = m; i > 0 && j > 0;) { if (a[i - 1].c === b[j - 1].c) { out.push([a[i - 1], b[j - 1]]); i--; j--; } else if (D[i - 1][j] >= D[i][j - 1]) i--; else j--; } return out; }
export function align(tp, page) {
  const T = segmentsOf(tp.words.map((w) => ({ t: w[0], b: [w[1], w[2], w[3], w[4]] })), 3), S = segmentsOf(page.words.map((w) => ({ t: w.t, b: w.b })), 2.5), n = T.length, m = S.length;
  if (n < 3 || m < 3) return null;
  const sim = (i, j) => { const v = dice(T[i].tri, S[j].tri); return v >= 0.45 ? v : 0; };
  const D = Array.from({ length: n + 1 }, () => new Float32Array(m + 1));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) { const v = sim(i - 1, j - 1); D[i][j] = Math.max(D[i - 1][j], D[i][j - 1], v ? D[i - 1][j - 1] + v : 0); }
  const pairs = []; for (let i = n, j = m; i > 0 && j > 0;) { const v = sim(i - 1, j - 1); if (v && Math.abs(D[i][j] - (D[i - 1][j - 1] + v)) < 1e-6) { pairs.push([T[i - 1], S[j - 1]]); i--; j--; } else if (D[i - 1][j] >= D[i][j - 1]) i--; else j--; }
  const anchors = [];
  for (const [tg, sg] of pairs) { const cp = lcsPairs(tg.ch, sg.ch); if (cp.length < Math.min(tg.ch.length, sg.ch.length) * 0.6) continue; cp.forEach(([p, q], k) => { if (k % 2 === 0) anchors.push({ px: p.x, py: p.y, sx: q.x, sy: q.y }); }); }
  if (anchors.length < 12) return null;
  const slope = (kp, ks) => { const r = []; for (let t = 0; t < Math.min(6000, anchors.length * 8); t++) { const p = anchors[(t * 7919) % anchors.length], q = anchors[(t * 104729 + 3) % anchors.length]; const d = q[kp] - p[kp]; if (Math.abs(d) > 30) r.push((q[ks] - p[ks]) / d); } r.sort((x, y) => x - y); return r[Math.floor(r.length / 2)] || 1; };
  const ax = slope('px', 'sx'), ay = slope('py', 'sy');
  const med = (xs) => { const v = xs.slice().sort((p, q) => p - q); return v[Math.floor(v.length / 2)]; };
  const byYsorted = anchors.slice().sort((p, q) => p.py - q.py);
  const nearY = (py, k) => { let lo = 0, hi = byYsorted.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (byYsorted[mid].py < py) lo = mid + 1; else hi = mid; } return byYsorted.slice(Math.max(0, lo - k), lo + k).sort((p, q) => Math.abs(p.py - py) - Math.abs(q.py - py)).slice(0, k); };
  const map = (px, py) => {
    const ys = nearY(py, 6), by = med(ys.map((a) => a.sy - ay * a.py));
    const row = nearY(py, 40).filter((a) => Math.abs(a.py - py) < 10).sort((p, q) => Math.abs(p.px - px) - Math.abs(q.px - px)).slice(0, 4);
    const bx = med((row.length ? row : ys).map((a) => a.sx - ax * a.px));
    return [ax * px + bx, ay * py + by];
  };
  const res = anchors.map((a) => { const [x, y] = map(a.px, a.py); return Math.hypot(x - a.sx, y - a.sy); }).sort((p, q) => p - q);
  return { map, ax, ay, lines: pairs.length, of: n, pairs: anchors.length, rms: Math.round(res[Math.floor(res.length / 2)] * 10) / 10 };
}

/** The tilt for each scanned page: per OCR word, is the blank form printing it here, and does a fill-in box hold it. */
export function tiltOf(prior, layout) {
  const pages = [];
  for (const pg of layout.pages) {
    const ch = choosePage(prior, pg); if (!ch || ch.j < 0.2) { pages.push({ n: pg.n, matched: false, why: 'no page of the prior shares enough of its words' }); continue; }
    const A = align(ch.tp, pg); if (!A) { pages.push({ n: pg.n, matched: false, tn: ch.tp.n, why: 'too few words to align on' }); continue; }
    const box = (r) => { const [x0, y0] = A.map(r[0], r[1]), [x1, y1] = A.map(r[2], r[3]); return [x0, y0, x1, y1]; };
    const tw = ch.tp.words.map((w) => ({ t: w[0], b: box([w[1], w[2], w[3], w[4]]) }));
    const fields = ch.tp.fields.filter((f) => f.type === 'text').map((f) => ({ name: f.name, label: f.label, heading: f.heading || null, line: f.line || null, b: box(f.rect) }));
    const per = new Map(); let printedN = 0, found = 0;
    for (const w of pg.words) {
      const cx = (w.b[0] + w.b[2]) / 2, cy = (w.b[1] + w.b[3]) / 2, h = w.b[3] - w.b[1], tol = Math.max(10, h * 0.9);
      let best = null; for (const t of tw) { const d = Math.hypot((t.b[0] + t.b[2]) / 2 - cx, (t.b[1] + t.b[3]) / 2 - cy); if (d < tol) { const s = similarity(w.t, t.t); if (!best || s > best.s) best = { s, t }; } }
      const printed = !!best && best.s >= 0.66;
      const field = fields.find((f) => cx >= f.b[0] - 2 && cx <= f.b[2] + 2 && cy >= f.b[1] - 3 && cy <= f.b[3] + 3) || null;
      per.set(w.s, { printed, sim: best ? Math.round(best.s * 100) / 100 : 0, field });
      if (printed) printedN++;
    }
    for (const t of tw) if (pg.words.some((w) => similarity(w.t, t.t) >= 0.66 && Math.hypot((w.b[0] + w.b[2] - t.b[0] - t.b[2]) / 2, (w.b[1] + w.b[3] - t.b[1] - t.b[3]) / 2) < 14)) found++;
    pages.push({ n: pg.n, matched: true, tn: ch.tp.n, shared: Math.round(ch.j * 100) / 100, align: { pairs: A.pairs, lines: A.lines, of: A.of, rms: A.rms }, agreement: Math.round((found / Math.max(1, tw.length)) * 100) / 100, printed: printedN, per, fields });
  }
  return { form: prior.form, year: prior.year, title: prior.title, source: prior.source, sha256: prior.sha256, giver: prior.giver, pages };
}

/** Weight a field read from the page: values the form PRINTS are the form talking (down); values in a fill-in box are the filer (up). */
export function weighField(f, tilt) {
  const T = tilt && tilt.pages.find((p) => p.n === f.page && p.matched); if (!T) return { amp: 1, evidence: null };
  const vw = f.vwords || [], lw = f.lwords || [];
  const at = (w) => T.per.get(w.s) || { printed: false, field: null };
  const filled = vw.filter((w) => at(w).field && !at(w).printed).length / Math.max(1, vw.length), printedV = vw.filter((w) => at(w).printed).length / Math.max(1, vw.length), printedL = lw.filter((w) => at(w).printed).length / Math.max(1, lw.length);
  const box = vw.map((w) => at(w).field).find(Boolean) || null;
  const amp = Math.max(0, 1 + 0.8 * filled + 0.4 * printedL - 0.9 * printedV);
  return { amp, evidence: { form: tilt.title, year: tilt.year, source: tilt.source, sha256: tilt.sha256, page: T.tn, box: box && box.name, printed_beside_it: box && box.label, column_on_form: box && box.heading, filled: Math.round(filled * 100), value_printed: Math.round(printedV * 100), label_printed: Math.round(printedL * 100) } };
}
