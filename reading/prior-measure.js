// prior-measure.js — measure a published blank document (a form, a template) into a PRIOR: what its publisher printed, and where it leaves
// room to fill in. Pure functions over word and field boxes, shared by the page (pdf.js, any PDF found while hunting) and the build tool
// (pdftotext + MuPDF, the seeded library). Nothing here knows any particular form: a label is whatever is printed beside or above a box.
//
// A word is [text, x0, y0, x1, y1] in the page's own units, origin top-left. A field is { name, type, rect:[x0,y0,x1,y1] }.
const LEADER = /^[.·…\s]+$/;

/** The printed text a fill-in box belongs to: on its row to its left (back to the margin, or to another box), else the line just above it. */
export function labelOf(f, words, fields) {
  const [x0, y0, x1, y1] = f.rect;
  const between = (a, b) => fields.some((g) => g !== f && g.rect[0] >= a && g.rect[2] <= b && g.rect[1] < y1 && g.rect[3] > y0);
  const row = words.filter((w) => w[3] <= x0 + 2 && (w[2] + w[4]) / 2 > y0 - 3 && (w[2] + w[4]) / 2 < y1 + 3 && !LEADER.test(w[0])).sort((a, b) => b[3] - a[3]);
  const left = []; let edge = x0;
  for (const w of row) { if (between(w[3], edge)) break; left.unshift(w); edge = w[1]; }
  let ws = left;
  // two printed columns on one row: the label starts at the last line letter or line number
  const k = ws.map((w, i) => (i > 0 && /^([A-Z]|\d{1,2}[a-z]?)$/.test(w[0]) ? i : -1)).filter((i) => i > 0).pop(); if (k > 0) ws = ws.slice(k);
  let label = ws.map((w) => w[0]).join(' ');
  if (!label) { const above = words.filter((w) => w[4] <= y0 + 1 && w[4] >= y0 - 14 && w[3] > x0 - 6 && w[1] < x1 && !LEADER.test(w[0])); if (above.length) { const yb = Math.max(...above.map((w) => w[2])); label = above.filter((w) => Math.abs(w[2] - yb) < 3).sort((a, b) => a[1] - b[1]).map((w) => w[0]).join(' '); } }
  return label.replace(/\s*[.·…]{2,}.*$/, '').replace(/\s+/g, ' ').trim();
}

/** A column's heading over a box: title-case printed words directly above it. */
export function headingOf(f, words) {
  const [x0, y0, x1] = f.rect;
  const over = words.filter((w) => w[4] <= y0 && w[4] >= y0 - 80 && Math.min(w[3], x1) - Math.max(w[1], x0) > (w[3] - w[1]) * 0.5 && /^\p{Lu}\p{Ll}+$|^\p{Lo}{2,}$|^\p{Ll}{2,3}$|^\(?\p{Lu}\)?$/u.test(w[0]));
  if (!over.length) return null;
  const yb = Math.max(...over.map((w) => w[2]));
  return over.filter((w) => Math.abs(w[2] - yb) < 10).sort((a, b) => a[2] - b[2] || a[1] - b[1]).map((w) => w[0]).join(' ') || null;
}

/** Fill in a page's field labels and headings; a box with no label of its own shares its row's (Current Year beside Prior Year). */
export function labelPage(page) {
  for (const f of page.fields) { f.label = labelOf(f, page.words, page.fields); if (f.type === 'text') f.heading = headingOf(f, page.words); }
  for (const f of page.fields) if (!f.label) { const twin = page.fields.find((g) => g !== f && g.label && g.rect[2] <= f.rect[0] + 1 && Math.abs((g.rect[1] + g.rect[3]) / 2 - (f.rect[1] + f.rect[3]) / 2) < 3); if (twin) { f.label = twin.label; f.sharedLabel = true; } }
  return page;
}

/** Measure a PDF in the browser with pdf.js: printed words with boxes, and the fill-in fields its author left. */
export async function measurePdf(pdfjs, bytes, { maxPages = 12 } = {}) {
  const pdf = await pdfjs.getDocument({ data: bytes.slice() }).promise, pages = [];
  for (let n = 1; n <= Math.min(pdf.numPages, maxPages); n++) {
    const p = await pdf.getPage(n), vp = p.getViewport({ scale: 1 }), H = vp.height, words = [];
    const tc = await p.getTextContent();
    for (const it of tc.items) { const s = it.str || ''; if (!s.trim()) continue; const [a, b, c, d, e, f] = it.transform, h = Math.hypot(c, d) || it.height || 8, x = e, yTop = H - f - h, wAll = it.width || s.length * h * 0.5;
      // split a run into its words, in proportion to their characters
      let cx = 0; for (const m of s.matchAll(/\S+/g)) { const w0 = x + (m.index / s.length) * wAll, w1 = x + ((m.index + m[0].length) / s.length) * wAll; words.push([m[0], +w0.toFixed(1), +yTop.toFixed(1), +w1.toFixed(1), +(yTop + h).toFixed(1)]); cx++; } }
    const anns = await p.getAnnotations(), fields = [];
    for (const an of anns) { if (an.subtype !== 'Widget' || !an.rect) continue; const [x0, y0, x1, y1] = an.rect; fields.push({ name: an.fieldName || '', type: an.checkBox ? 'checkbox' : an.radioButton ? 'radio' : an.fieldType === 'Tx' ? 'text' : (an.fieldType || 'field').toLowerCase(), rect: [+x0.toFixed(1), +(H - y1).toFixed(1), +x1.toFixed(1), +(H - y0).toFixed(1)], tip: an.alternativeText || null }); }
    pages.push(labelPage({ n, w: +vp.width.toFixed(1), h: +H.toFixed(1), words, fields }));
  }
  return pages;
}
