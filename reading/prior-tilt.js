// prior-tilt.js — a PRIOR TILTS a reading; it never stands in for one.
//
// The reading comes from the page: every label, value and heading is the OCR's own text, with the OCR's own spelling. A prior (a blank form
// the publisher printed, measured by prior-measure.js) only moves WEIGHTS:
//   · a word on the scan that the blank form also prints, in the same place, is more likely PRINTED (the form talking, a label)
//   · a word inside a box the blank form leaves for filling in is more likely FILLED IN (the filer talking, a value)
//   · a box the blank form leaves, with words in it on the scan, is evidence of a field even where the page's own rules were not found
// What the prior says is kept as attributed evidence (the form, its source and hash, the field's name, what the form prints beside it) for
// the provenance panel. It is never copied into the reading.
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
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

/** Scale and offset that carry the prior's page onto the scan, fitted on words that occur once on both and agree in text. */
export function align(tp, page) {
  const once = (arr, key) => { const c = new Map(); for (const x of arr) { const k = key(x); if (k.length >= 4) c.set(k, (c.get(k) || 0) + 1); } return c; };
  const ca = once(tp.words, (w) => norm(w[0])), cb = once(page.words, (w) => norm(w.t));
  const byA = new Map(tp.words.filter((w) => ca.get(norm(w[0])) === 1).map((w) => [norm(w[0]), w]));
  let pairs = page.words.filter((w) => cb.get(norm(w.t)) === 1 && byA.has(norm(w.t))).map((w) => { const t = byA.get(norm(w.t)); return { px: (t[1] + t[3]) / 2, py: (t[2] + t[4]) / 2, sx: (w.b[0] + w.b[2]) / 2, sy: (w.b[1] + w.b[3]) / 2 }; });
  if (pairs.length < 8) return null;
  const fit = (P, k1, k2) => { const n = P.length, mx = P.reduce((s, p) => s + p[k1], 0) / n, my = P.reduce((s, p) => s + p[k2], 0) / n; let sxy = 0, sxx = 0; for (const p of P) { sxy += (p[k1] - mx) * (p[k2] - my); sxx += (p[k1] - mx) ** 2; } const a = sxx ? sxy / sxx : 1; return [a, my - a * mx]; };
  let ax, bx, ay, by;
  for (let it = 0; it < 3; it++) {
    [ax, bx] = fit(pairs, 'px', 'sx'); [ay, by] = fit(pairs, 'py', 'sy');
    const res = pairs.map((p) => Math.hypot(ax * p.px + bx - p.sx, ay * p.py + by - p.sy)), med = res.slice().sort((a, b) => a - b)[Math.floor(res.length / 2)] || 1;
    const keep = pairs.filter((_, i) => res[i] <= Math.max(6, med * 3)); if (keep.length === pairs.length || keep.length < 8) break; pairs = keep;
  }
  const rms = Math.sqrt(pairs.reduce((s, p) => s + (ax * p.px + bx - p.sx) ** 2 + (ay * p.py + by - p.sy) ** 2, 0) / pairs.length);
  return { ax, bx, ay, by, pairs: pairs.length, rms: Math.round(rms * 10) / 10 };
}

/** The tilt for each scanned page: per OCR word, is the blank form printing it here, and does a fill-in box hold it. */
export function tiltOf(prior, layout) {
  const pages = [];
  for (const pg of layout.pages) {
    const ch = choosePage(prior, pg); if (!ch || ch.j < 0.2) { pages.push({ n: pg.n, matched: false, why: 'no page of the prior shares enough of its words' }); continue; }
    const A = align(ch.tp, pg); if (!A) { pages.push({ n: pg.n, matched: false, tn: ch.tp.n, why: 'too few words to align on' }); continue; }
    const X = (x) => A.ax * x + A.bx, Y = (y) => A.ay * y + A.by;
    const tw = ch.tp.words.map((w) => ({ t: w[0], b: [X(w[1]), Y(w[2]), X(w[3]), Y(w[4])] }));
    const fields = ch.tp.fields.filter((f) => f.type === 'text').map((f) => ({ name: f.name, label: f.label, heading: f.heading || null, line: f.line || null, b: [X(f.rect[0]), Y(f.rect[1]), X(f.rect[2]), Y(f.rect[3])] }));
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
    pages.push({ n: pg.n, matched: true, tn: ch.tp.n, shared: Math.round(ch.j * 100) / 100, align: A, agreement: Math.round((found / Math.max(1, tw.length)) * 100) / 100, printed: printedN, per, fields });
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
