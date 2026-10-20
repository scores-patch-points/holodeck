// layout-rules.js — what a GOOD, meaningful page layout is, so the Text view is the scan's own words set the way the page means them,
// not OCR's boxes 1:1. Every rule is a measurement over the page itself (its own median type, its own margins), script-neutral, and drops
// nothing but marks that are not words. Word identity (`s`,`e`, text) is never changed — only where and how big it is set.
//
//   1 NOISE      a mark with no letter or digit, or read below the confidence floor, is not a word
//   2 ROWS       words whose vertical centres agree (within half the page's type) are ONE row, even if OCR split them into lines
//   3 TYPE       one size and one baseline per row; the size is the row's median, clamped to the page's own range
//   4 COLLISIONS two words may not overlap: the lower-confidence one is dropped, else the later one is nudged to the earlier one's end
//   5 MARGINS    row starts that fall within a tolerance of a common left edge snap to it (a column of labels reads as a column)
//   6 RHYTHM     a gap is kept only if it is meaningful (wider than a few spaces of the row's type); smaller gaps are one space
export function setPage(pg, { floor = 45 } = {}) {
  const med = (xs) => { const v = xs.slice().sort((a, b) => a - b); return v[Math.floor(v.length / 2)] || 0; };
  const real = pg.words.filter((w) => /[\p{L}\p{N}\p{Sc}%]/u.test(w.t) && (w.c == null || w.c >= floor));
  const hs = real.map((w) => w.b[3] - w.b[1]).filter((h) => h > 0), pageH = med(hs) || 10;
  const cy = (w) => (w.b[1] + w.b[3]) / 2;
  // 2 rows
  const rows = []; for (const w of real.slice().sort((a, b) => cy(a) - cy(b) || a.b[0] - b.b[0])) {
    const r = rows.find((q) => Math.abs(q.cy - cy(w)) < Math.max(pageH * 0.5, Math.min(q.h, w.b[3] - w.b[1]) * 0.5));
    if (r) { r.words.push(w); r.cy = med(r.words.map(cy)); } else rows.push({ cy: cy(w), h: w.b[3] - w.b[1], words: [w] }); }
  for (const r of rows) {
    r.words.sort((a, b) => a.b[0] - b.b[0]);
    // 3 type + baseline
    r.h = Math.min(pageH * 1.7, Math.max(pageH * 0.75, med(r.words.map((w) => w.b[3] - w.b[1]))));
    r.base = med(r.words.map((w) => w.b[3]));
    // 4 collisions
    const kept = []; for (const w of r.words) { const p = kept[kept.length - 1];
      if (p && w.b[0] < p.b[2] - (p.b[2] - p.b[0]) * 0.3 && w.b[0] < p.b[2] - (w.b[2] - w.b[0]) * 0.3) { if ((w.c ?? 0) > (p.c ?? 0)) kept[kept.length - 1] = w; continue; } kept.push(w); }
    r.words = kept;
  }
  rows.sort((a, b) => a.base - b.base);
  // 5 margins: common left edges, tolerance one type-height
  const lefts = rows.map((r) => r.words[0].b[0]).sort((a, b) => a - b), edges = [];
  for (const x of lefts) { const e = edges[edges.length - 1]; if (e && x - e.max < pageH * 0.6) { e.xs.push(x); e.max = x; } else edges.push({ xs: [x], max: x }); }
  const edgeOf = edges.filter((e) => e.xs.length >= 3).map((e) => med(e.xs));
  for (const r of rows) { const x0 = r.words[0].b[0], e = edgeOf.find((v) => Math.abs(v - x0) < pageH * 0.9); r.shift = e == null ? 0 : e - x0; }
  // 6 rhythm
  for (const r of rows) { const sp = r.h * 0.3; r.set = [];
    for (const [i, w] of r.words.entries()) { const x0 = w.b[0] + r.shift, bw = w.b[2] - w.b[0], prev = r.set[i - 1]; let x = x0;
      if (prev) { const gap = x0 - prev.x1; if (gap < 0) x = prev.x1 + sp * 0.6; else if (gap < sp * 3) x = Math.max(x0, prev.x1 + sp); }
      r.set.push({ w, x, x1: x + bw }); } }
  return { rows, pageH };
}
