// page-views.js — the reading ON THE PAGE. When the text came from pixels (OCR), every word knows where it sits; these views use that.
//
//   fieldsOf      the label/value pairs a printed form carries — Alhazen's own field reader (extractFormFields, valueFormat) run on each
//                 printed line, then mapped back to the words (and so the boxes) the label and the value were read from
//   pageHTML      the scan itself, with every reading drawn on it in place
//   placeHTML     the page re-set as clean type: every word, and every field, where the page has it
//   structureOf   the whole reading as one nested object — document › pages › blocks › lines › words, and the fields, referents and claims
//                 that point into it by id — rendered as a tree that opens on demand
// Pure of the page: they take the reading and return data or HTML. Nothing here reads anything new.
import '../alhazen.js'; // UMD: sets self.Alhazen
const A = () => self.Alhazen;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const union = (bs) => bs.length ? [Math.min(...bs.map((b) => b[0])), Math.min(...bs.map((b) => b[1])), Math.max(...bs.map((b) => b[2])), Math.max(...bs.map((b) => b[3]))] : null;

/** Form fields: label → value, each with the words (and so the boxes) it was read from. */
export function fieldsOf(layout, text) {
  if (!layout || !A()) return [];
  const out = [];
  for (const pg of layout.pages) for (const ln of pg.lines) {
    if (ln.s >= text.length) continue;
    const line = text.slice(ln.s, Math.min(ln.e, text.length));
    const f = A().extractFormFields(line)[0]; if (!f) continue;
    const li = line.indexOf(f.label), vi = line.indexOf(f.value, li + f.label.length); if (li < 0 || vi < 0) continue;
    const ws = pg.words.slice(ln.words[0], ln.words[1]);
    const inR = (a, b) => ws.filter((w) => w.s >= ln.s + a && w.e <= ln.s + b + 1);
    const lw = inR(li, li + f.label.length), vw = inR(vi, vi + f.value.length); if (!lw.length || !vw.length) continue;
    out.push({ id: `fld_${out.length + 1}`, page: pg.n, label: f.label, value: f.value, format: A().valueFormat(f.value), lb: union(lw.map((w) => w.b)), vb: union(vw.map((w) => w.b)), s: ln.s + li, e: ln.s + vi + f.value.length, conf: Math.round(vw.reduce((n, w) => n + w.c, 0) / vw.length), words: [...lw, ...vw] });
  }
  return out;
}

/** What each word on a page was read as: field label/value, a referent's mention, part of a claim, a word not placed — or nothing. */
export function readingOfWords(page, { fields, mentions, claims, unplaced }) {
  const kind = new Map();
  for (const w of page.words) {
    const fv = fields.find((f) => f.page === page.n && f.words.includes(w));
    if (fv) { kind.set(w, { k: fv.words.indexOf(w) < fv.words.length && w.s >= fv.s + fv.label.length ? 'value' : 'label', field: fv }); continue; }
    const m = mentions.find((x) => x.s <= w.s && w.e <= x.e); if (m) { kind.set(w, { k: 'mention', ref: m.ref, rc: m.rc }); continue; }
    if (unplaced.has(w.s)) { kind.set(w, { k: 'unplaced' }); continue; }
    if (claims.some((c) => c.s <= w.s && w.e <= c.e)) kind.set(w, { k: 'claim' });
  }
  for (const f of fields) for (const w of f.words) if (w.s >= f.s + f.label.length || f.value.includes(w.t)) { const cur = kind.get(w); if (cur && cur.field === f) cur.k = f.words.indexOf(w) >= f.words.findIndex((x) => x.s >= f.s + (f.value ? f.label.length : 0)) && w.s > f.s + f.label.length - 1 ? 'value' : 'label'; }
  return kind;
}

const pct = (v, total) => `${((v / total) * 100).toFixed(3)}%`;
const COLORS = { value: '#6ee7a8', label: '#8ab4ff', claim: 'rgba(138,180,255,.55)', unplaced: '#f0b429' };

/** The scan, with every reading drawn on it. */
export function pageHTML(layout, R, { selected } = {}) {
  return layout.pages.map((pg) => {
    const kind = readingOfWords(pg, R);
    const boxes = [];
    for (const f of R.fields.filter((x) => x.page === pg.n)) {
      const sel = selected && selected.kind === 'field' && selected.id === f.id;
      boxes.push(`<div class="fb${sel ? ' on' : ''}" style="left:${pct(f.lb[0], pg.w)};top:${pct(Math.min(f.lb[1], f.vb[1]), pg.h)};width:${pct(f.vb[2] - f.lb[0], pg.w)};height:${pct(Math.max(f.lb[3], f.vb[3]) - Math.min(f.lb[1], f.vb[1]), pg.h)}" data-sel='${esc(JSON.stringify({ kind: 'field', id: f.id }))}' title="${esc(f.label)} → ${esc(f.value)} (${esc(f.format)})"></div>`);
    }
    for (const [w, r] of kind) {
      if (r.k === 'label' || r.k === 'value') continue;
      const c = r.k === 'mention' ? r.rc : COLORS[r.k];
      const sel = r.k === 'mention' ? JSON.stringify({ kind: 'ref', ref: r.ref }) : r.k === 'unplaced' ? JSON.stringify({ kind: 'word', w: w.t, s: w.s, e: w.e }) : '';
      const onW = selected && ((selected.kind === 'ref' && r.ref === selected.ref) || (selected.kind === 'word' && selected.s === w.s));
      boxes.push(`<div class="wb ${r.k}${onW ? ' on' : ''}" style="left:${pct(w.b[0], pg.w)};top:${pct(w.b[1], pg.h)};width:${pct(w.b[2] - w.b[0], pg.w)};height:${pct(w.b[3] - w.b[1], pg.h)};--c:${c}"${sel ? ` data-sel='${esc(sel)}'` : ''} title="${esc(w.t)} · ${esc(r.k)} · ${w.c}% confidence"></div>`);
    }
    return `<div class="pgh">page ${pg.n}</div><div class="pg" style="aspect-ratio:${pg.w}/${pg.h}"><img src="${pg.image}" alt="page ${pg.n} as scanned">${boxes.join('')}</div>`;
  }).join('');
}

/** The page re-set as clean type: each word where the page printed it, at the size the page printed it. */
export function placeHTML(layout, R, { selected } = {}) {
  return layout.pages.map((pg) => {
    const kind = readingOfWords(pg, R);
    const ws = pg.words.map((w) => {
      const r = kind.get(w), k = r ? r.k : 'plain', size = ((w.b[3] - w.b[1]) / pg.w) * 100 * 0.78;
      const c = r && r.k === 'mention' ? r.rc : COLORS[k] || 'var(--ink2)';
      const sel = r && r.k === 'mention' ? JSON.stringify({ kind: 'ref', ref: r.ref }) : r && r.field ? JSON.stringify({ kind: 'field', id: r.field.id }) : JSON.stringify({ kind: 'word', w: w.t, s: w.s, e: w.e });
      const on = selected && ((selected.kind === 'field' && r && r.field && r.field.id === selected.id) || (selected.kind === 'word' && selected.s === w.s));
      return `<span class="pw ${k}${on ? ' on' : ''}" style="left:${pct(w.b[0], pg.w)};top:${pct(w.b[1], pg.h)};font-size:${size.toFixed(3)}cqw;--c:${c}" data-sel='${esc(sel)}' title="${esc(k)}${w.c != null ? ' · ' + w.c + '% confidence' : ''}">${esc(w.t)}</span>`;
    }).join('');
    return `<div class="pgh">page ${pg.n} — re-set where the page has it</div><div class="pg place" style="aspect-ratio:${pg.w}/${pg.h}">${ws}</div>`;
  }).join('');
}

/** The whole reading as one nested object. Ids cross-link: a mention names the words it covers; a field names its words. */
export function structureOf(T, R, f) {
  const L = T.doc.layout, text = T.doc.analysis;
  const wid = (pg, i) => `w_${pg}_${i}`;
  const wordIdAt = new Map(); if (L) for (const pg of L.pages) pg.words.forEach((w, i) => wordIdAt.set(w.s, wid(pg.n, i)));
  const wordsIn = (s, e) => { const out = []; if (L) for (const pg of L.pages) pg.words.forEach((w, i) => { if (w.s >= s && w.e <= e) out.push(wid(pg.n, i)); }); return out; };
  const tok = R.tokens; const clsAt = new Map(tok.map((t) => [t.s, t.upos || null]));
  const doc = { title: R.title, bytes: T.nBytes, sha256: T.hash, source_id: T.srcId, text_from: R.extracted || 'the text as given', read_characters: text.length };
  if (L) doc.pages = L.pages.map((pg) => {
    const blocks = new Map();
    pg.lines.forEach((ln, li) => { const b = blocks.get(ln.block) || blocks.set(ln.block, { block: ln.block, lines: [] }).get(ln.block);
      b.lines.push({ line: li, text: text.slice(ln.s, ln.e), chars: [ln.s, ln.e], box: ln.b, words: pg.words.slice(ln.words[0], ln.words[1]).map((w, j) => ({ id: wid(pg.n, ln.words[0] + j), text: w.t, chars: [w.s, w.e], box: w.b, confidence: w.c, read_as: w.s < text.length ? (clsAt.get(w.s) ?? 'not placed') : 'beyond what was read' })) }); });
    return { page: pg.n, size: [pg.w, pg.h], blocks: [...blocks.values()] };
  });
  else doc.statements = (T.timeline && T.timeline.sentences || []).map((s) => ({ statement: s.n, text: s.text, chars: [s.offset, s.end], words: tok.filter((t) => t.s >= s.offset && t.e <= s.end).map((t) => ({ text: t.w, chars: [t.s, t.e], read_as: t.upos || 'not placed' })) }));
  const out = { reading: doc };
  if (R.fields.length) out.fields = R.fields.map((x) => ({ id: x.id, page: x.page, label: x.label, value: x.value, format: x.format, label_box: x.lb, value_box: x.vb, chars: [x.s, x.e], words: x.words.map((w) => wordIdAt.get(w.s)), read_by: 'Alhazen extractFormFields + valueFormat' }));
  if (f) out.referents = f.order.filter((r) => r.mentions.length).map((r) => ({ id: r.id, name: r.name, mentions: r.mentions.map((m) => ({ span: m.id, text: m.text, chars: [m.s, m.e], words: wordsIn(m.s, m.e) })) }));
  out.claims = T.claims.filter((c) => c.located).map((c, i) => ({ claim: i + 1, subject: c.end1, act: c.label, object: c.end2, polarity: c.polarity === '-' ? 'negated' : 'affirmed', chars: [c.s, c.e], words: wordsIn(c.s, c.e) }));
  return out;
}

/** A tree that renders its children only when opened (a page of words is thousands of nodes). */
export function treeHTML(value, path = '$', depth = 0) {
  if (value === null || typeof value !== 'object') return `<span class="jv ${typeof value}">${esc(JSON.stringify(value))}</span>`;
  const isArr = Array.isArray(value), keys = isArr ? value.map((_, i) => i) : Object.keys(value);
  const flat = isArr && value.every((x) => x === null || typeof x !== 'object') && value.length <= 8;
  if (flat) return `<span class="jv">[${value.map((x) => esc(JSON.stringify(x))).join(', ')}]</span>`;
  const head = isArr ? `[${value.length}]` : `{${keys.length}}`;
  return `<details class="jt" data-path="${esc(path)}"${depth < 2 ? ' open' : ''}><summary><span class="jh">${head}</span>${!isArr && value.text ? ` <span class="dim">${esc(String(value.text).slice(0, 60))}</span>` : !isArr && value.label ? ` <span class="dim">${esc(value.label)}</span>` : !isArr && value.name ? ` <span class="dim">${esc(value.name)}</span>` : ''}</summary>${depth < 2 ? childrenHTML(value, path, depth) : ''}</details>`;
}
export function childrenHTML(value, path, depth) {
  const isArr = Array.isArray(value), keys = isArr ? value.map((_, i) => i) : Object.keys(value);
  return `<div class="jc">${keys.map((k) => `<div class="jr"><span class="jk">${esc(k)}</span>: ${treeHTML(value[k], `${path}.${k}`, depth + 1)}</div>`).join('')}</div>`;
}
export const atPath = (root, path) => path.split('.').slice(1).reduce((o, k) => (o == null ? o : o[k]), root);

// ── THE DOCUMENT'S OWN STRUCTURE, as tuples all the way down ─────────────────────────────────────────────────────────────────────────
// Every node is a tuple [key, value, where?]. A value is a scalar or a list of tuples. `where` is the provenance: page, box, characters, by.
//   a page      ["page 1", [sections…], {page, size}]
//   a section   [heading, [items…], {page, box}] — a heading is read from the PAGE (type set larger than the page's own lines, or a printed
//               marker such as "Part I" / "Section 2" / "Schedule B"); what comes before the first heading is "(before any heading)"
//   a field     [label, value, {format, page, label_box, value_box, chars, by}] — Alhazen's own field reader
//   a table     ["table", [records…], {columns, page, box}]; a record is [first cell, [[column, cell]…]]
//   a line      ["text", line, {page, box, chars}]
const MARKER = /^(part|section|schedule|article|chapter|item)\s*([0-9]+|[ivxlc1|!]{1,5}|[a-z])\b/i;
export function semanticOf(layout, text, fields) {
  const pages = [];
  for (const pg of layout.pages) {
    const med = (xs) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)] || 1; };
    const typeOf = (ln) => med(pg.words.slice(ln.words[0], ln.words[1]).filter((w) => /[a-z]/i.test(w.t)).map((w) => w.b[3] - w.b[1]));
    const hMed = med(pg.lines.map(typeOf));
    const sections = [], cur = () => sections[sections.length - 1];
    sections.push(['(before any heading)', [], { page: pg.n }]);
    let table = null;
    const flush = () => { if (table && table.rows.length >= 2) { const [head, ...rows] = table.rows; cur()[1].push(['table', rows.map((r) => [r.cells[0], r.cells.slice(1).map((c, j) => [head.cells[j + 1] ?? `column ${j + 2}`, c]), { page: pg.n, box: r.b, chars: [r.s, r.e] }]), { page: pg.n, columns: head.cells, box: union(table.rows.map((r) => r.b)) }]); } else if (table) for (const r of table.rows) cur()[1].push(['text', text.slice(r.s, r.e), { page: pg.n, box: r.b, chars: [r.s, r.e] }]); table = null; };
    for (const ln of pg.lines) {
      if (ln.s >= text.length) break;
      const line = text.slice(ln.s, Math.min(ln.e, text.length)).trim(); if (!line) continue;
      const f = fields.find((x) => x.page === pg.n && x.s >= ln.s && x.e <= ln.e + 1);
      const h = typeOf(ln), words = line.split(/\s+/).length;
      const heading = !f && words <= 12 && (MARKER.test(line) || (h > hMed * 1.35 && /[a-z]{3}/i.test(line)));
      const cells = line.split(/\s{2,}/).filter(Boolean);
      if (heading) { flush(); sections.push([line, [], { page: pg.n, box: ln.b, chars: [ln.s, ln.e], by: MARKER.test(line) ? 'a printed section marker' : 'type set larger than the page’s own lines' }]); continue; }
      if (f) { flush(); cur()[1].push([f.label, f.value, { format: f.format, page: f.page, label_box: f.lb, value_box: f.vb, chars: [f.s, f.e], confidence: f.conf, by: 'Alhazen extractFormFields + valueFormat', id: f.id }]); continue; }
      if (cells.length >= 3) { (table ??= { rows: [] }).rows.push({ cells, b: ln.b, s: ln.s, e: ln.e }); continue; }
      flush(); cur()[1].push(['text', line, { page: pg.n, box: ln.b, chars: [ln.s, ln.e] }]);
    }
    flush();
    pages.push([`page ${pg.n}`, sections.filter((s) => s[1].length || s[0] !== '(before any heading)'), { page: pg.n, size: [pg.w, pg.h] }]);
  }
  return pages;
}

/** The tuple tree: [key, value, where] rows, each opening on demand. */
const isTuple = (x) => Array.isArray(x) && x.length >= 2 && x.length <= 3 && (typeof x[0] === 'string' || typeof x[0] === 'number') && (x.length < 3 || (x[2] && typeof x[2] === 'object' && !Array.isArray(x[2])));
const whereText = (w) => !w ? '' : [w.format, w.page != null ? `p${w.page}` : '', w.chars ? `chars ${w.chars[0]}–${w.chars[1]}` : '', w.confidence != null ? `${w.confidence}%` : '', w.by || ''].filter(Boolean).join(' · ');
export function tupleHTML(t, path = '$', depth = 0) {
  if (!isTuple(t)) return `<span class="jv">${esc(JSON.stringify(t))}</span>`;
  const [k, v, w] = t, kids = Array.isArray(v) && v.every(isTuple);
  const where = w ? `<span class="jw" title="${esc(JSON.stringify(w))}">${esc(whereText(w))}</span>` : '';
  const sel = w && w.id ? ` data-sel='${esc(JSON.stringify({ kind: 'field', id: w.id }))}'` : '';
  if (!kids) return `<div class="tp"${sel}><span class="jk">${esc(k)}</span> <span class="jv string">${esc(Array.isArray(v) ? v.join(' → ') : v)}</span> ${where}</div>`;
  return `<details class="jt" data-path="${esc(path)}"${depth < 3 ? ' open' : ''}><summary><span class="jk">${esc(k)}</span> <span class="jh">(${v.length})</span> ${where}</summary>${depth < 3 ? tupleChildren(v, path, depth) : ''}</details>`;
}
export function tupleChildren(v, path, depth) { return `<div class="jc">${v.map((c, i) => tupleHTML(c, `${path}.${i}`, depth + 1)).join('')}</div>`; }
export const tupleAt = (root, path) => path.split('.').slice(1).reduce((t, i) => (t && Array.isArray(t[1]) ? t[1][+i] : null), root);

/** The scan with the read text laid ON TOP of it, word by word, where the page has it. */
export function pdfHTML(layout, R, { selected } = {}) {
  return layout.pages.map((pg) => {
    const kind = readingOfWords(pg, R);
    const fb = R.fields.filter((x) => x.page === pg.n).map((f) => { const sel = selected && selected.kind === 'field' && selected.id === f.id; return `<div class="fb${sel ? ' on' : ''}" style="left:${pct(f.lb[0], pg.w)};top:${pct(Math.min(f.lb[1], f.vb[1]), pg.h)};width:${pct(f.vb[2] - f.lb[0], pg.w)};height:${pct(Math.max(f.lb[3], f.vb[3]) - Math.min(f.lb[1], f.vb[1]), pg.h)}" data-sel='${esc(JSON.stringify({ kind: 'field', id: f.id }))}' title="${esc(f.label)} → ${esc(f.value)} (${esc(f.format)})"></div>`; }).join('');
    const ws = pg.words.map((w) => {
      const r = kind.get(w), k = r ? r.k : 'plain', size = ((w.b[3] - w.b[1]) / pg.w) * 100 * 0.8;
      const c = r && r.k === 'mention' ? r.rc : COLORS[k] || '#1b1b1f';
      const sel = r && r.k === 'mention' ? JSON.stringify({ kind: 'ref', ref: r.ref }) : r && r.field ? JSON.stringify({ kind: 'field', id: r.field.id }) : JSON.stringify({ kind: 'word', w: w.t, s: w.s, e: w.e });
      const on = selected && ((selected.kind === 'field' && r && r.field && r.field.id === selected.id) || (selected.kind === 'word' && selected.s === w.s) || (selected.kind === 'ref' && r && r.ref === selected.ref));
      return `<span class="ow ${k}${on ? ' on' : ''}" style="left:${pct(w.b[0], pg.w)};top:${pct(w.b[1], pg.h)};width:${pct(w.b[2] - w.b[0], pg.w)};height:${pct(w.b[3] - w.b[1], pg.h)};font-size:${size.toFixed(3)}cqw;--c:${c}" data-sel='${esc(sel)}' title="${esc(w.t)} · ${esc(k)} · ${w.c}% confidence">${esc(w.t)}</span>`;
    }).join('');
    return `<div class="pgh">page ${pg.n} — the scan, with the text read from it laid on top</div><div class="pg pdf" style="aspect-ratio:${pg.w}/${pg.h}"><img src="${pg.image}" alt="page ${pg.n} as scanned">${ws}${fb}</div>`;
  }).join('');
}

// ── READING a form: each field is a statement the FILER makes about itself — (filer, label, value) ─────────────────────────────────
// A form is not prose: its sentences are its fields. Who says them is the filer (the party the form names), in the voice of whoever signs
// it. The value is TYPED by its shape (Alhazen's valueFormat) — an identifier, a date, money, a name — and so is the claim. A field the OCR
// garbled ("Department of → the") is not read as a claim: only a value with an informative shape, or a clear multi-word value read with
// high confidence, becomes one. Every claim keeps the boxes its label and value were read from.
const INFORMATIVE = new Set(['identifier', 'date', 'currency', 'phone', 'email', 'integer', 'decimal', 'name', 'choice', 'time']);
const tidy = (s) => String(s).replace(/[|_©®»«¥]+/g, ' ').replace(/\s+/g, ' ').trim();
export function readForm(fields, { referents = [], formWord = () => false } = {}) {
  const usable = fields.filter((f) => INFORMATIVE.has(f.format) || (f.value.trim().split(/\s+/).length >= 2 && f.conf >= 85 && /[a-z]{3}/i.test(f.value)));
  // the filer: the organisation the form names (a "name" field, else the most-mentioned multi-word referent)
  const named = fields.find((f) => /\bname\b/i.test(f.label) && /[a-z]{3}/i.test(f.value) && !/\bofficer|preparer|print/i.test(f.label));
  const org = referents.filter((r) => r.name && r.name.split(/\s+/).length >= 2 && r.mentions.length >= 2 && !formWord(r) && !/^(part|schedule|section|form|page|line)\b/i.test(r.name)).sort((a, b) => b.mentions.length - a.mentions.length)[0];
  const filer = named ? { name: tidy(named.value), basis: `the form's own “${tidy(named.label)}” field`, field: named.id } : org ? { name: org.name, ref: org.id, basis: 'the most-mentioned organisation the form names' } : { name: 'the filer', basis: 'the form names no filer the reader could find' };
  // the voice: whoever signs it
  const sig = fields.find((f) => /sign|officer|here/i.test(f.label) && (f.format === 'name' || /^[A-Z][a-z]+ [A-Z][a-z]+/.test(f.value.trim())) && !/signature|date|officer/i.test(f.value));
  const voice = sig ? { name: tidy(sig.value), basis: `the “${tidy(sig.label)}” field`, field: sig.id } : null;
  const claims = usable.map((f) => ({ id: `fc_${f.id}`, field: f.id, subject: filer.name, act: tidy(f.label).toLowerCase(), object: tidy(f.value), type: f.format, page: f.page, conf: f.conf, chars: [f.s, f.e], label_box: f.lb, value_box: f.vb }));
  return { filer, voice, claims, skipped: fields.length - usable.length };
}
