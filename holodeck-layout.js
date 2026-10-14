// holodeck-layout.js — the quick view of a contract page: its text laid out as the original has it,
// compacted so it reads at once while the PDF itself is still on its way.
//
// Input is the VM's layout (tools/contracts-api/build_layouts.py): per page, the page size in PDF
// points and text lines as [x, y, w, h, text]. planPage turns one page into positioned spans for a
// column W px wide:
//   · the page's outer margins are cropped, so the content fills the width;
//   · type size follows each line's own height but is clamped, so a tiny scan or a poster-sized heading
//     never produces absurd dimensions;
//   · vertical gaps are capped at about a line and a half: paragraph breaks survive, empty page does not;
//   · lines that share a row (columns, label/value pairs) keep sharing it.
// Pure: no DOM, so it is tested under node.

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

export function planPage(page, W, o = {}) {
  const pad = o.pad == null ? 14 : o.pad, minF = o.minFont || 11, maxF = o.maxFont || 17, headF = o.maxHeadFont || 24;
  const L = (page.lines || []).filter(l => l && l[4] && String(l[4]).trim() && l[3] > 0).slice().sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  if (!L.length) return { w: W, h: 0, spans: [], empty: true };
  const x0 = Math.min(...L.map(l => l[0])), x1 = Math.max(...L.map(l => l[0] + l[2]));
  const hs = L.map(l => l[3]).sort((a, b) => a - b), med = hs[hs.length >> 1] || 10;
  // one horizontal scale for the page, but never so large that body text would exceed maxF
  const k = Math.min((W - 2 * pad) / Math.max(1, x1 - x0), maxF / (med * 0.82));
  const fsOf = l => clamp(l[3] * k * 0.82, minF, l[3] > med * 1.35 ? headF : maxF);
  // rows: lines whose tops are within half a line of the row's first line
  const rows = [];
  for (const l of L) {
    const r = rows[rows.length - 1];
    if (r && Math.abs(l[1] - r.y) < Math.max(r.h, l[3]) * 0.5) { r.lines.push(l); r.h = Math.max(r.h, l[3]); r.bottom = Math.max(r.bottom, l[1] + l[3]); }
    else rows.push({ y: l[1], h: l[3], bottom: l[1] + l[3], lines: [l] });
  }
  const spans = []; let y = pad, prevBottom = null, prevPx = 0;
  for (const r of rows) {
    const fs = Math.max(...r.lines.map(fsOf)), lh = Math.round(fs * 1.28);
    const gap = prevBottom == null ? 0 : clamp((r.y - prevBottom) * k, 0, Math.max(prevPx, lh) * 1.5);
    y += prevBottom == null ? 0 : (r.lines.length ? gap : 0);
    for (const l of r.lines) spans.push({ x: Math.round(pad + (l[0] - x0) * k), y: Math.round(y), w: Math.max(4, Math.round(l[2] * k)), fs: Math.round(fs * 10) / 10, t: String(l[4]) });
    y += lh; prevBottom = r.bottom; prevPx = lh;
  }
  return { w: W, h: Math.round(y + pad), spans, empty: false };
}

export async function fetchLayout(pdfSrc, timeoutMs = 4000) {
  if (!/\/contract\/[A-Za-z0-9]+\/pdf$/.test(pdfSrc || '')) return null;
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(pdfSrc.replace(/\/pdf$/, '/layout'), { signal: ctl.signal });
    return r.ok ? await r.json() : null;
  } catch (e) { return null; } finally { clearTimeout(t); }
}
