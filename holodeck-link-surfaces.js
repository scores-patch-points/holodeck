// holodeck-link-surfaces.js — the link surfaces: Lanes, Margin, Seam, Orbit, Fields, Review, the Passage card, and
// the Reader's link gutter. One mount root, one link model (holodeck-relations.js), one grain control.
//
// DOM only — no data work lives here. Everything a surface draws comes from the relations module's functions
// (atGrain, fieldsOf, orbitOf, seamOf, marginOf) so a surface and its test can never disagree. The Orbit nests with
// the holons module's own functions (openAtLevel, repOf, rollUp, levelsOf).
//
// A surface cannot write a link by accident: `write` is handed to the Review surface alone (canWriteLinks), every
// other surface is given null and has nothing to call.

import {
  RELATIONS, RELATION_IDS, PROVENANCE, GRAINS, DIFFERS, atGrain, fieldsOf, orbitOf, seamOf, marginOf, buildIndex, hueMap,
  cuesOf, isTimed, fmtClock, onChars, admits, canWriteLinks, wholeSpan, makeLink,
} from './holodeck-relations.js';
import { openAtLevel, levelsOf, repOf, rollUp } from './holodeck-holons.js';

const NS = 'http://www.w3.org/2000/svg';
export const SURFACES = ['lanes', 'margin', 'seam', 'orbit', 'fields', 'review'];
export const SURFACE_TITLE = { lanes: 'Lanes', margin: 'Margin', seam: 'Seam', orbit: 'Orbit', fields: 'Fields', review: 'Review' };
const BLURB = {
  lanes: 'Media sources share one time axis; documents share document order. A line joins two passages and says how.',
  margin: 'Write or paste a draft. Each sentence shows what the sources say about it, and what nothing answers.',
  seam: 'Two sources aligned side by side. Pairs are proposed by wording; the label comes from comparing the figures. Nothing is merged.',
  orbit: 'Sources are planets and their linked passages are moons. Click any body to re-center; a ring is the number of link steps from the center.',
  fields: 'Where the sources are tied and where they touch nothing: every passage of every source, linked or void.',
  review: 'Inferred links wait here. Confirming turns a dotted line solid everywhere.',
};
const GRAIN_LABEL = { ground: 'Ground', figure: 'Figure', pattern: 'Pattern' };
const GRAIN_TITLE = {
  ground: 'The ambient field: which sources are tied, and how densely',
  figure: 'Each specific link between two passages',
  pattern: 'Recurring structure: the same relation joining the same two sources more than once',
};

// ── tiny DOM helpers ────────────────────────────────────────────────────────────────────────────────────────────
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const k in props || {}) {
    const v = props[k]; if (v == null || v === false) continue;
    if (k === 'class') el.className = v; else if (k === 'style') el.style.cssText = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'text') el.textContent = v; else el.setAttribute(k, v === true ? '' : v);
  }
  kids.flat(9).forEach(c => { if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c))); });
  return el;
}
function sv(tag, props, ...kids) {
  const el = document.createElementNS(NS, tag);
  for (const k in props || {}) { const v = props[k]; if (v == null || v === false) continue; if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else if (k === 'text') el.textContent = v; else el.setAttribute(k, v); }
  kids.flat(9).forEach(c => { if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c))); });
  return el;
}
const clip = (t, n) => { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; };
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

// ── style (the app's graphite tokens; nothing new but the source hues) ─────────────────────────────────────────
const CSS = `
.lk{font:400 14px/1.5 var(--sans);color:var(--ink);display:flex;flex-direction:column;gap:12px;min-width:0}
.lk *{box-sizing:border-box}
.lk-bar{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;justify-content:space-between}
.lk-h{font:600 15px var(--sans)}.lk-h small{font:400 11.5px var(--mono);color:var(--mut);margin-left:8px}
.lk-blurb{font:400 13.5px/1.5 var(--sans);color:var(--mut);max-width:70ch;text-wrap:pretty}
.lk-seg{display:flex;border:1px solid var(--line2);border-radius:8px;overflow:hidden}
.lk-seg button{all:unset;cursor:pointer;padding:4px 12px;font:500 13px var(--sans);color:var(--mut);white-space:nowrap}
.lk-seg button.on{background:var(--sel);color:var(--ink)}
.lk-seg button:focus-visible,.lk-chip:focus-visible,.lk-btn:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
.lk-lab{font:500 10.5px var(--mono);letter-spacing:.08em;color:var(--mut);text-transform:uppercase}
.lk-chips{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.lk-chip{all:unset;cursor:pointer;border:1px solid var(--line2);border-radius:8px;padding:3px 10px;font:500 12.5px var(--sans);color:var(--ink2);white-space:nowrap;display:inline-flex;gap:6px;align-items:baseline}
.lk-chip.on{border-color:var(--acc);background:var(--sel);color:var(--ink)}
.lk-chip i{font:normal 500 12px var(--mono);color:var(--mut)}
.lk-sel{background:var(--s2);border:1px solid var(--line2);border-radius:8px;color:var(--ink);font:500 13px var(--sans);padding:4px 8px;outline:none;max-width:100%}
.lk-btn{all:unset;cursor:pointer;border:1px solid var(--line2);border-radius:8px;padding:5px 12px;font:500 13px var(--sans);color:var(--ink);white-space:nowrap}
.lk-btn:hover{border-color:var(--acc)}
.lk-btn.pri{background:var(--acc2);border-color:var(--acc2);color:#fff;font-weight:600}
.lk-btn.bad:hover{border-color:var(--bad);color:var(--bad)}
.lk-panel{background:var(--s1);border:1px solid var(--line);border-radius:12px;padding:12px 14px;min-width:0}
.lk-svgwrap{background:var(--s1);border:1px solid var(--line);border-radius:12px;overflow:auto}
.lk-svgwrap svg{display:block;width:100%;height:auto;min-width:620px}
.lk-svgwrap text{font-family:var(--mono);font-size:10.5px;fill:var(--ink2)}
.lk-legend{display:flex;flex-wrap:wrap;gap:6px 16px;font:400 11.5px var(--mono);color:var(--mut)}
.lk-dot{display:inline-block;width:9px;height:9px;border-radius:3px;flex:none}
.lk-empty{padding:28px 12px;text-align:center;color:var(--mut);font:400 14px var(--sans)}
.lk-note{font:400 12.5px/1.45 var(--sans);color:var(--dim);text-wrap:pretty}
.lk-note b{color:var(--ink2);font-weight:600}
.lk-prov{font:500 10.5px var(--mono);letter-spacing:.04em;color:var(--mut);border:1px solid var(--line2);border-radius:4px;padding:0 5px;white-space:nowrap}
.lk-prov.inferred{border-style:dashed}.lk-prov.confirmed{color:var(--ok);border-color:var(--ok)}
.lk-weak{font:500 10.5px var(--mono);color:var(--amber);border:1px dashed var(--amber);border-radius:4px;padding:0 5px;white-space:nowrap}
/* seam */
.lk-seam{display:grid;grid-template-columns:minmax(0,1fr) 84px minmax(0,1fr);gap:8px 6px;align-items:stretch}
.lk-cell{background:var(--s1);border:1px solid var(--line);border-radius:10px;padding:8px 11px;font:400 14px/1.5 var(--serif);min-width:0;text-wrap:pretty}
.lk-cell.void{border-style:dashed;background:transparent;color:var(--dim);font:italic 400 13px var(--sans);display:flex;align-items:center}
.lk-mid{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font:600 11.5px var(--mono);text-align:center}
.lk-mid.differs{color:var(--bad)}.lk-mid.same{color:var(--ok)}.lk-mid.extends{color:var(--acc)}.lk-mid.related,.lk-mid.alone{color:var(--mut)}
.lk-cell button.src{all:unset;cursor:pointer;color:var(--acc);font:500 11px var(--mono);display:block;margin-top:4px}
.lk-fig{border-radius:3px;padding:0 3px;background:color-mix(in srgb,var(--bad) 22%,transparent);color:var(--ink);font-weight:600}
/* margin + reader gutter share one layout */
.lk-doc{display:grid;grid-template-columns:minmax(0,1fr) 250px;border:1px solid var(--line);border-radius:12px;background:var(--s1)}
.lk-text{padding:18px 22px;font:400 16px/1.75 var(--serif);display:flex;flex-direction:column;gap:10px;min-width:0}
.lk-gut{border-left:1px solid var(--line);padding:10px;display:flex;flex-direction:column;gap:8px;background:var(--s2);border-radius:0 12px 12px 0}
.lk-row{border:1px solid var(--line);background:var(--s1);border-radius:8px;padding:6px 8px;font:400 12.5px/1.4 var(--sans);cursor:pointer;display:flex;flex-direction:column;gap:2px}
.lk-row:hover{border-color:var(--line2)}
.lk-row .rel{font:600 11px var(--mono);color:var(--ink2);display:flex;gap:6px;align-items:center;justify-content:space-between}
.lk-row .rel.differs{color:var(--bad)}
.lk-row q{quotes:none;color:var(--ink2);text-wrap:pretty}
.lk-row .src{display:flex;gap:6px;align-items:center;color:var(--mut);font:500 11.5px var(--sans)}
.lk-ul{text-decoration-line:underline;text-decoration-color:var(--lk-c,var(--acc));text-underline-offset:4px;text-decoration-thickness:1.5px;cursor:pointer}
.lk-ul[data-rel="cites"]{text-decoration-style:solid}
.lk-ul[data-rel="same-value"]{text-decoration-style:dotted;text-decoration-thickness:2px}
.lk-ul[data-rel="form-of"]{text-decoration-style:double}
.lk-ul[data-rel="derived-from"]{text-decoration-style:dashed}
.lk-ul[data-rel="part-of"]{text-decoration-style:solid;text-decoration-thickness:1px}
.lk-ul[data-rel="says-about"]{text-decoration-style:wavy;text-decoration-thickness:1px}
.lk-ul[data-prov="inferred"]{text-decoration-style:dotted;text-decoration-thickness:1px;opacity:.9}
.lk-ul[data-v="differs"]{text-decoration-color:var(--bad);text-decoration-style:solid;background:color-mix(in srgb,var(--bad) 16%,transparent);border-radius:2px}
.lk-ul.on{background:color-mix(in srgb,var(--acc) 28%,transparent);border-radius:2px}
.lk-sent.un{border-left:3px dashed var(--line2);padding-left:10px;color:var(--ink2)}
/* review */
.lk-card{background:var(--s1);border:1px solid var(--line);border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:8px}
.lk-two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}
@container (max-width:640px){.lk-two{grid-template-columns:1fr}}
.lk-pass{border-left:3px solid var(--lk-c,var(--line2));padding:2px 0 2px 10px;font:400 14px/1.5 var(--serif);text-wrap:pretty}
.lk-pass small{display:block;font:500 11px var(--mono);color:var(--mut);margin-bottom:2px}
/* fields */
.lk-field{display:flex;flex-direction:column;gap:5px}
.lk-strip{display:flex;gap:2px;height:22px;align-items:stretch}
.lk-strip i{display:block;min-width:3px;border-radius:2px;border:1px solid var(--line2);background:repeating-linear-gradient(135deg,transparent 0 4px,var(--line) 4px 5px)}
.lk-strip i.on{border-color:transparent;background:var(--lk-c,var(--acc))}
.lk-strip i.bad{box-shadow:inset 0 0 0 2px var(--bad)}
.lk-strip i.inf{background:repeating-linear-gradient(90deg,var(--lk-c,var(--acc)) 0 3px,transparent 3px 5px);border-color:var(--lk-c,var(--acc))}
.lk-strip i.pk{background:var(--sel2);border-color:var(--acc)}
/* passage card */
.lk-pcard{position:fixed;top:0;right:0;bottom:0;z-index:70;width:min(380px,100%);overflow:auto;background:var(--s1);border-left:1px solid var(--line2);padding:16px 18px;display:flex;flex-direction:column;gap:12px;box-shadow:-8px 0 30px rgba(0,0,0,.3)}
.lk-x{all:unset;cursor:pointer;color:var(--mut);font:600 16px var(--sans);padding:0 4px;align-self:flex-end}
.lk-x:hover{color:var(--ink)}
@media (max-width:760px){.lk-doc{grid-template-columns:1fr}.lk-gut{border-left:0;border-top:1px solid var(--line);border-radius:0 0 12px 12px}.lk-seam{grid-template-columns:1fr}.lk-mid{flex-direction:row;justify-content:flex-start;padding:2px 0}}
`;
function ensureStyle(doc = document) {
  if (doc.getElementById('lk-style')) return;
  const st = doc.createElement('style'); st.id = 'lk-style'; st.textContent = CSS; doc.head.appendChild(st);
}

// ── shared reading of a link ────────────────────────────────────────────────────────────────────────────────────
function docOf(A, id) { return (A.docById && A.docById[id]) || (A.docs || []).find(d => d.id === id) || { id, title: id, text: '' }; }
function quoteOf(A, sp, max = 170) {
  const d = docOf(A, sp.doc);
  if (sp.kind === 'whole') return clip(d.title, max);
  if (sp.axis === 'time') {
    const c = cuesOf(d).filter(x => x.t0 < sp.t1 && sp.t0 < x.t1); const t = c.length ? (d.text || '').slice(c[0].s, c[c.length - 1].e) : '';
    return fmtClock(sp.t0) + '–' + fmtClock(sp.t1) + (t ? ' · ' + clip(t, max - 14) : '');
  }
  // the statement the span sits in, so a value span reads as its sentence
  const sts = (A.stsByDoc && A.stsByDoc[sp.doc]) || []; const st = sts.find(x => x.s <= sp.s && sp.s < x.e);
  return clip(st ? st.text : (d.text || '').slice(sp.s, sp.e), max);
}
const relLabel = L => RELATIONS[L.relation].label + (L.verdict === 'differs' ? ' · differs' : L.verdict === 'extends' ? ' · extends' : '');
const provChip = L => h('span', { class: 'lk-prov ' + L.provenance, text: PROVENANCE[L.provenance].label });
function dot(hue) { return h('span', { class: 'lk-dot', style: 'background:' + hue }); }

// ── the mount ───────────────────────────────────────────────────────────────────────────────────────────────────
// opts: {view, A, key, links (the resolved set), weak, rejected, unresolved, truncated, coverage, decisions,
//        grain, filter:{relations,minProvenance}, theme, workspace, pair, seamMode, centre, level,
//        draft, onGrain, onFilter, onPair, onSeamMode, onCentre, onLevel, onDraft, onOpen(docId, s), write}
export function mountLinks(root, opts) {
  ensureStyle(root.ownerDocument || document);
  let o = opts; let card = null; const memo = new Map(); const lastPos = new Map(); let anim = 0;
  const wrap = h('div', { class: 'lk' }); root.replaceChildren(wrap); root.style.containerType = 'inline-size';

  const hues = () => { const ids = new Set(); o.links.concat(o.weak || []).forEach(L => { ids.add(L.from.doc); ids.add(L.to.doc); }); (o.A.docs || []).forEach(d => ids.add(d.id)); return hueMap([...ids], o.theme); };
  const bad = () => DIFFERS[o.theme] || DIFFERS.dark;
  const shown = () => o.links.filter(admits(o.filter || { minProvenance: 'computed' }));
  const open = (doc, s) => o.onOpen && o.onOpen(doc, s);
  const set = (patch, cb) => { o = { ...o, ...patch }; if (cb) cb(); render(); };

  function toolbar(view, count) {
    const bar = h('div', { class: 'lk-bar' });
    const left = h('div', { class: 'lk-h' }, SURFACE_TITLE[view], h('small', {}, (o.workspace || '') + (o.workspace ? ' · ' : '') + plural((o.A.docs || []).length, 'source') + (count != null ? ' · ' + count : '')));
    const right = h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' });
    if (view !== 'fields' && view !== 'review' && view !== 'margin') {
      right.append(h('span', { class: 'lk-lab' }, 'Grain'));
      right.append(h('div', { class: 'lk-seg', role: 'group', 'aria-label': 'Grain' }, GRAINS.map(g => h('button', {
        class: o.grain === g ? 'on' : '', 'aria-pressed': String(o.grain === g), title: GRAIN_TITLE[g], onclick: () => { o.onGrain && o.onGrain(g); set({ grain: g }); } }, GRAIN_LABEL[g]))));
    }
    bar.append(left, right);
    const sub = h('div', { class: 'lk-blurb' }, BLURB[view]);
    const els = [bar, sub];
    if (view === 'lanes' || view === 'orbit' || view === 'margin' || view === 'fields') els.push(filterRow());
    return els;
  }
  function filterRow() {
    const f = o.filter || { minProvenance: 'computed' }; const on = f.relations ? new Set(f.relations) : null;
    const counts = {}; o.links.forEach(L => { counts[L.relation] = (counts[L.relation] || 0) + 1; });
    const row = h('div', { class: 'lk-chips' });
    row.append(h('span', { class: 'lk-lab' }, 'Links'));
    RELATION_IDS.forEach(r => row.append(h('button', {
      class: 'lk-chip' + (!on || on.has(r) ? ' on' : ''), 'aria-pressed': String(!on || on.has(r)), title: 'Show or hide “' + RELATIONS[r].label + '” links',
      onclick: () => { const cur = on ? new Set(on) : new Set(RELATION_IDS); if (cur.has(r)) cur.delete(r); else cur.add(r); const next = { ...f, relations: cur.size === RELATION_IDS.length ? null : [...cur] }; o.onFilter && o.onFilter(next); set({ filter: next }); } },
      RELATIONS[r].label, h('i', {}, String(counts[r] || 0)))));
    row.append(h('select', { class: 'lk-sel', 'aria-label': 'Provenance threshold', onchange: e => { const next = { ...f, minProvenance: e.target.value }; o.onFilter && o.onFilter(next); set({ filter: next }); } },
      h('option', { value: 'computed', selected: f.minProvenance !== 'inferred' }, 'confirmed + computed'),
      h('option', { value: 'inferred', selected: f.minProvenance === 'inferred' }, 'everything, with inferred')));
    return row;
  }
  const legend = () => h('div', { class: 'lk-legend' },
    ['form-of', 'cites', 'derived-from', 'same-value', 'part-of', 'says-about'].map(r => h('span', {}, RELATIONS[r].glyph + ' ' + RELATIONS[r].label)),
    h('span', { style: 'color:' + bad() }, '╱╲ differs'), h('span', {}, '┅ inferred'));

  // ── Lanes ──────────────────────────────────────────────────────────────────────────────────────────────────────
  function lanes() {
    const A = o.A, links = shown(), H = hues();
    const withLinks = new Set(); links.forEach(L => { withLinks.add(L.from.doc); withLinks.add(L.to.doc); });
    const docs = (A.docs || []).slice().sort((a, b) => (isTimed(b) - isTimed(a)) || (withLinks.has(b.id) - withLinks.has(a.id)) || String(a.title).localeCompare(String(b.title))).slice(0, 18);
    if (!docs.length) return h('div', { class: 'lk-empty' }, 'No sources in this workspace yet.');
    const timed = docs.filter(isTimed), plain = docs.filter(d => !isTimed(d));
    const W = 760, X0 = 134, X1 = 744, ROW = 36;
    const maxT = Math.max(1, ...timed.map(d => { const c = cuesOf(d); return c.length ? c[c.length - 1].t1 : 0; }));
    const lane = new Map(); let y = 14;
    const rows = [];
    if (timed.length) { rows.push({ head: 'MEDIA TIME', y }); y += 18; timed.forEach(d => { lane.set(d.id, y + 8); rows.push({ d, y: y + 8 }); y += ROW; }); y += 8; }
    if (plain.length) { rows.push({ head: 'DOCUMENT ORDER', y }); y += 18; plain.forEach(d => { lane.set(d.id, y + 8); rows.push({ d, y: y + 8 }); y += ROW; }); }
    const H_ = y + 14;
    const svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H_, role: 'img', 'aria-label': 'Sources as lanes, with links drawn between them' });
    svg.append(sv('defs', {},
      sv('marker', { id: 'lk-arr', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto' }, sv('path', { d: 'M0 1 L10 5 L0 9Z', fill: 'context-stroke' }))));
    const xOf = (d, sp) => {
      if (sp.kind === 'whole') return [X0, X1];
      if (isTimed(d)) {
        const c = cuesOf(d); let t0, t1;
        if (sp.axis === 'time') { t0 = sp.t0; t1 = sp.t1; }
        else { const a = c.find(x => x.e > sp.s) || c[c.length - 1], b = [...c].reverse().find(x => x.s < sp.e) || a; t0 = a.t0; t1 = b.t1; }
        return [X0 + t0 / maxT * (X1 - X0), X0 + t1 / maxT * (X1 - X0)];
      }
      const len = Math.max(1, (d.text || '').length); return [X0 + sp.s / len * (X1 - X0), X0 + sp.e / len * (X1 - X0)];
    };
    rows.forEach(r => {
      if (r.head) { svg.append(sv('text', { x: 14, y: r.y + 4, style: 'fill:var(--mut);letter-spacing:.1em;font-size:9.5px' }, r.head)); return; }
      const d = r.d; const hue = H.get(d.id);
      const endX = isTimed(d) ? X0 + (cuesOf(d).slice(-1)[0].t1) / maxT * (X1 - X0) : X1;
      svg.append(sv('text', { x: 14, y: r.y + 4, style: 'cursor:pointer', onclick: () => open(d.id, 0) }, clip(d.title, 17)));
      svg.append(sv('rect', { x: X0, y: r.y - 5, width: Math.max(2, endX - X0), height: 10, rx: 2, style: 'fill:var(--s2)' }));
      svg.append(sv('line', { x1: X0, x2: X1, y1: r.y, y2: r.y, style: 'stroke:var(--line)' }));
      const t = sv('title', {}, d.title); svg.lastChild.append(t);
    });
    const grain = o.grain; const G = atGrain(links, grain);
    // ambient washes: every passage a link touches, in its source's hue (the Ground field)
    const hit = new Map(); links.forEach(L => [L.from, L.to].forEach(sp => { if (lane.has(sp.doc)) (hit.get(sp.doc) || hit.set(sp.doc, []).get(sp.doc)).push({ sp, L }); }));
    hit.forEach((list, id) => {
      const d = docOf(A, id); const yy = lane.get(id);
      list.forEach(({ sp }) => { if (sp.kind === 'whole') return; const [a, b] = xOf(d, sp);
        svg.append(sv('rect', { x: a, y: yy - (grain === 'ground' ? 6 : 5), width: Math.max(3, b - a), height: grain === 'ground' ? 12 : 10, rx: 1.5, fill: H.get(id), opacity: grain === 'ground' ? .28 : .42 })); });
    });
    const stroke = L => L.verdict === 'differs' ? bad() : 'var(--ink)';
    const wide = L => ({ confirmed: 2.2, file: 1.9, computed: 1.5, inferred: 1.1 }[L.provenance]);
    const ends = (L) => {
      const da = docOf(A, L.from.doc), db = docOf(A, L.to.doc);
      const [a0, a1] = xOf(da, L.from), [b0, b1] = xOf(db, L.to);
      return { ya: lane.get(L.from.doc), yb: lane.get(L.to.doc), xa: (a0 + a1) / 2, xb: (b0 + b1) / 2, a: [a0, a1], b: [b0, b1] };
    };
    const ribbon = (L, e, n) => {
      const down = e.yb > e.ya; const y1 = e.ya + (down ? 6 : -6), y2 = e.yb + (down ? -6 : 6);
      const sameLane = e.ya === e.yb; const my = (y1 + y2) / 2; const bend = sameLane ? 16 : 0;
      const d = 'M' + e.xa + ' ' + y1 + ' C' + e.xa + ' ' + (my - bend) + ' ' + e.xb + ' ' + (my - bend) + ' ' + e.xb + ' ' + y2;
      const g = sv('g', { style: 'cursor:pointer', tabindex: 0, role: 'button', 'aria-label': relLabel(L) + ': ' + clip(quoteOf(A, L.from), 60) + ' to ' + clip(quoteOf(A, L.to), 60),
        onclick: () => showCard({ links: [L] }), onkeydown: ev => { if (ev.key === 'Enter') showCard({ links: [L] }); } });
      const st = stroke(L); const dash = L.provenance === 'inferred' ? '2 3' : (RELATIONS[L.relation].line === 'dashed' ? '5 4' : null);
      g.append(sv('path', { d, fill: 'none', stroke: 'transparent', 'stroke-width': 10 })); // a fat hit target
      if (L.verdict === 'differs') {
        const pts = []; const N = 10; for (let i = 0; i <= N; i++) { const t = i / N; const x = e.xa + (e.xb - e.xa) * t, yy = y1 + (y2 - y1) * t; const off = (i % 2 ? 4 : -4) * (i === 0 || i === N ? 0 : 1); pts.push((x + off) + ',' + yy); }
        g.append(sv('polyline', { points: pts.join(' '), fill: 'none', stroke: st, 'stroke-width': 1.8, 'stroke-dasharray': dash }));
      } else if (RELATIONS[L.relation].line === 'double') {
        g.append(sv('path', { d, fill: 'none', stroke: st, 'stroke-width': wide(L), transform: 'translate(-1.6,0)', 'stroke-dasharray': dash }));
        g.append(sv('path', { d, fill: 'none', stroke: st, 'stroke-width': wide(L), transform: 'translate(1.6,0)', 'stroke-dasharray': dash }));
      } else {
        const arrow = ['arrow', 'dashed'].includes(RELATIONS[L.relation].line);
        g.append(sv('path', { d, fill: 'none', stroke: st, 'stroke-width': RELATIONS[L.relation].line === 'thin' ? 1 : wide(L), 'stroke-dasharray': dash, 'marker-end': arrow ? 'url(#lk-arr)' : null, opacity: L.provenance === 'inferred' ? .8 : 1 }));
      }
      if (RELATIONS[L.relation].symmetric) { g.append(sv('circle', { cx: e.xa, cy: y1, r: 3.2, fill: st })); g.append(sv('circle', { cx: e.xb, cy: y2, r: 3.2, fill: st })); }
      g.append(sv('title', {}, relLabel(L) + ' · ' + PROVENANCE[L.provenance].label + ' — ' + L.why));
      if (n) g.append(sv('text', { x: (e.xa + e.xb) / 2 + 6, y: my, style: 'fill:' + st }, n));
      svg.append(g);
    };
    let drawn = 0; const CAP = 400;
    if (grain === 'ground') {
      // whole-source ties as brackets down the right edge, plus how densely each source is tied
      const done = new Set();
      G.ties.forEach((L, i) => { if (!lane.has(L.from.doc) || !lane.has(L.to.doc) || L.from.doc === L.to.doc) return; const ya = lane.get(L.from.doc), yb = lane.get(L.to.doc); const xx = X1 + 4 + (i % 4) * 4;
        svg.append(sv('path', { d: 'M' + X1 + ' ' + ya + ' H' + xx + ' V' + yb + ' H' + X1, fill: 'none', stroke: stroke(L), 'stroke-width': 1.2, 'stroke-dasharray': L.provenance === 'inferred' ? '2 3' : null, style: 'cursor:pointer', onclick: () => showCard({ links: [L] }) }, sv('title', {}, relLabel(L) + ' — ' + L.why))); drawn++; done.add(L.id); });
    } else if (grain === 'pattern') {
      G.bundles.forEach(P => { if (!lane.has(P.a) || !lane.has(P.b) || P.a === P.b) return;
        const e = { ya: lane.get(P.a), yb: lane.get(P.b), xa: (X0 + X1) / 2 - 40, xb: (X0 + X1) / 2 + 40 };
        const w = 1.5 + 2.2 * Math.log2(P.links.length + 1); const down = e.yb > e.ya; const y1 = e.ya + (down ? 6 : -6), y2 = e.yb + (down ? -6 : 6);
        const g = sv('g', { style: 'cursor:pointer', onclick: () => showCard({ links: P.links, title: plural(P.links.length, RELATIONS[P.relation].label + ' link') + ' between these two sources' }) });
        g.append(sv('path', { d: 'M' + e.xa + ' ' + y1 + ' C' + e.xa + ' ' + (y1 + y2) / 2 + ' ' + e.xb + ' ' + (y1 + y2) / 2 + ' ' + e.xb + ' ' + y2, fill: 'none', stroke: P.differs ? bad() : 'var(--ink)', 'stroke-width': w, opacity: .55 }));
        g.append(sv('text', { x: (e.xa + e.xb) / 2 + 8, y: (y1 + y2) / 2, style: 'fill:var(--ink)' }, '×' + P.links.length + ' ' + RELATIONS[P.relation].label + (P.differs ? ' · ' + P.differs + ' differ' : '')));
        svg.append(g); drawn += P.links.length; });
      G.singles.forEach(L => { if (drawn > CAP || L.from.axis === 'time' || L.to.axis === 'time' || !lane.has(L.from.doc) || !lane.has(L.to.doc)) return; ribbon(L, ends(L)); drawn++; });
    } else {
      links.forEach(L => { if (drawn >= CAP) return; if (L.from.axis === 'time' || L.to.axis === 'time') return; if (!lane.has(L.from.doc) || !lane.has(L.to.doc)) return; if (L.grain === 'ground') return; ribbon(L, ends(L)); drawn++; });
    }
    const caps = links.filter(L => L.from.axis === 'time' || L.to.axis === 'time').length;
    const box = h('div', { class: 'lk-svgwrap' }, svg);
    const bits = [];
    if (grain === 'ground') bits.push(plural(G.ties.length, 'whole-source tie') + '; the shading is every passage some link touches.');
    else bits.push(plural(links.filter(L => L.grain === 'figure' && L.from.axis !== 'time' && L.to.axis !== 'time').length, 'link') + (grain === 'pattern' ? ', bundled where the same relation joins the same two sources more than once.' : ' between passages.'));
    if (caps) bits.push(plural(caps, 'caption timecode') + ' place text on the media axis.');
    if (drawn >= CAP) bits.push('Drawing the first ' + CAP + '.');
    return h('div', { style: 'display:flex;flex-direction:column;gap:8px' }, box, legend(), h('div', { class: 'lk-note' }, bits.join(' ')), noteTruth());
  }
  function noteTruth() {
    const n = [];
    if (o.truncated) n.push('Proposals were cut at the work budget; coverage is partial.');
    const w = (o.weak || []).length;
    if (w && o.view !== 'review') n.push(plural(w, 'wording pair') + ' did not beat chance in this workspace and ' + (w === 1 ? 'is' : 'are') + ' not drawn. See Review.');
    return n.length ? h('div', { class: 'lk-note' }, n.join(' ')) : null;
  }

  // ── Seam ───────────────────────────────────────────────────────────────────────────────────────────────────────
  function seam() {
    const docs = (o.A.docs || []);
    if (docs.length < 2) return h('div', { class: 'lk-empty' }, 'A seam needs two sources. Add another and it will line up here.');
    let [a, b] = o.pair && o.pair[0] && o.pair[1] ? o.pair : [docs[0].id, docs[1].id];
    if (!docs.some(d => d.id === a)) a = docs[0].id; if (!docs.some(d => d.id === b) || b === a) b = (docs.find(d => d.id !== a) || docs[1]).id;
    const mk = (cur, other, who) => h('select', { class: 'lk-sel', 'aria-label': who, onchange: e => { const next = who === 'First source' ? [e.target.value, b] : [a, e.target.value]; o.onPair && o.onPair(next); set({ pair: next }); } },
      docs.map(d => h('option', { value: d.id, selected: d.id === cur, disabled: d.id === other }, clip(d.title, 48))));
    const key = (o.key || '') + '|' + a + '|' + b;
    let S = memo.get(key); if (!S) { S = seamOf(o.A, a, b, ix()); memo.set(key, S); }
    const mode = o.seamMode || 'seam'; const da = docOf(o.A, a), db = docOf(o.A, b);
    const H = hues();
    const head = h('div', { class: 'lk-bar' },
      h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, h('span', { class: 'lk-lab' }, 'Seam'), mk(a, b, 'First source'), h('span', { class: 'lk-lab' }, 'and'), mk(b, a, 'Second source')),
      h('div', { class: 'lk-seg', role: 'group', 'aria-label': 'Seam mode' }, [['seam', 'Seam'], ['overprint', 'Overprint'], ['differences', 'Differences only']].map(([m, l]) =>
        h('button', { class: mode === m ? 'on' : '', 'aria-pressed': String(mode === m), onclick: () => { o.onSeamMode && o.onSeamMode(m); set({ seamMode: m }); } }, l))));
    const c = S.counts;
    const summary = h('div', { class: 'lk-note' }, h('b', {}, [c.same + ' same', c.differs + ' differs', c.extends + ' extends', c.related + ' related', c.alone + ' alone'].join(' · ')),
      '. Pairs are proposed by wording; labels come from the figures. Nothing is merged.' + (S.rows.some(r => r.weak) ? ' Pairs marked weak do not beat chance in this workspace.' : ''));
    const figSpan = (txt, raw) => { const i = raw ? txt.indexOf(raw) : -1; if (i < 0) return [txt]; return [txt.slice(0, i), h('span', { class: 'lk-fig' }, raw), txt.slice(i + raw.length)]; };
    const cell = (st, doc, raw) => st ? h('div', { class: 'lk-cell', style: 'border-left:3px solid ' + H.get(doc.id) }, ...figSpan(st.text, raw), h('button', { class: 'src', onclick: () => open(doc.id, st.s) }, 'open in ' + clip(doc.title, 28) + ' →'))
      : h('div', { class: 'lk-cell void' }, doc.title + ' is silent');
    let body;
    if (mode === 'seam' || mode === 'differences') {
      const rows = mode === 'differences' ? S.rows.filter(r => ['differs', 'extends'].includes(r.verdict)) : S.rows;
      body = rows.length ? h('div', { class: 'lk-seam' }, rows.flatMap(r => {
        const q = r.link && r.link.quote;
        return [cell(r.a, da, q && q.from), h('div', { class: 'lk-mid ' + r.verdict, title: r.link ? r.link.why : '' }, r.verdict === 'alone' ? (r.a ? 'alone' : 'alone') : r.verdict, r.weak ? h('span', { class: 'lk-weak' }, 'weak') : null,
          r.link ? h('button', { class: 'lk-btn', style: 'padding:1px 7px;font-size:11px', onclick: () => showCard({ links: [r.link] }) }, 'why') : null), cell(r.b, db, q && q.to)];
      })) : h('div', { class: 'lk-empty' }, mode === 'differences' ? 'These two sources do not differ on any figure or date the wording paired.' : 'Nothing in these two sources reads alike.');
    } else {
      // overprint: one text — the first source in its order — with the second source's figure printed over where they differ
      const ps = S.rows.filter(r => r.a).map(r => {
        const q = r.link && r.link.quote; const t = r.a.text;
        if (r.verdict === 'differs' && q) { const i = t.indexOf(q.from); if (i >= 0) return h('p', { class: 'lk-cell', style: 'border-left:3px solid var(--bad)' }, t.slice(0, i), h('span', { class: 'lk-fig', title: 'The second source says ' + q.to }, h('s', {}, q.from), ' → ' + q.to), t.slice(i + q.from.length)); }
        return h('p', { class: 'lk-cell', style: r.b ? '' : 'opacity:.75' }, t, r.verdict === 'extends' && r.b ? h('span', { class: 'lk-note' }, '  + ' + clip(r.b.text, 90)) : null);
      });
      body = h('div', { style: 'display:flex;flex-direction:column;gap:8px' }, ps);
    }
    return h('div', { style: 'display:flex;flex-direction:column;gap:10px' }, head, summary, body);
  }
  const ix = () => { const k = (o.key || '') + '#ix'; let v = memo.get(k); if (!v) { v = buildIndex(o.A); memo.set(k, v); } return v; };

  // ── Margin ─────────────────────────────────────────────────────────────────────────────────────────────────────
  function margin() {
    const text = o.draft || '';
    const H = hues();
    const ta = h('textarea', { class: 'lk-sel', rows: 5, style: 'width:100%;font:400 15px/1.6 var(--serif);resize:vertical', placeholder: 'Write or paste a draft here. Each sentence will show what the sources say about it.', 'aria-label': 'Draft text' });
    ta.value = text;
    let t = 0; ta.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { o.onDraft && o.onDraft(ta.value); set({ draft: ta.value }); }, 450); });
    const load = h('select', { class: 'lk-sel', 'aria-label': 'Use a source as the text', onchange: e => { const d = docOf(o.A, e.target.value); if (d && d.text) { const v = clip(d.text, 4000).replace(/…$/, ''); o.onDraft && o.onDraft(v); set({ draft: v }); } } },
      h('option', { value: '' }, 'Or load a source’s text…'), (o.A.docs || []).map(d => h('option', { value: d.id }, clip(d.title, 52))));
    const top = h('div', { class: 'lk-panel', style: 'display:flex;flex-direction:column;gap:8px' }, ta, h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, load, h('span', { class: 'lk-note' }, 'The draft stays in this browser. Nothing here is sent or saved to a source.')));
    if (!text.trim()) return h('div', { style: 'display:flex;flex-direction:column;gap:10px' }, top, h('div', { class: 'lk-empty' }, 'Nothing to margin yet.'));
    const rows = marginOf(ix(), text);
    const answered = rows.filter(r => !r.unanswered).length;
    const left = h('div', { class: 'lk-text' }); const gut = h('div', { class: 'lk-gut' });
    rows.forEach((r, i) => {
      const dif = r.partners.some(p => p.verdict === 'differs');
      left.append(h('div', { class: 'lk-sent' + (r.unanswered ? ' un' : ''), 'data-i': i }, r.text));
      if (r.unanswered) gut.append(h('div', { class: 'lk-row', style: 'border-style:dashed;cursor:default' }, h('div', { class: 'rel' }, 'unanswered'), h('q', {}, 'Nothing in this workspace says anything about “' + clip(r.text, 52) + '”.')));
      r.partners.forEach(p => {
        const doc = docOf(o.A, p.doc); const L = { relation: p.verdict === 'same' || p.verdict === 'differs' ? 'same-value' : 'says-about', verdict: p.verdict === 'related' ? undefined : p.verdict, provenance: 'inferred', why: 'Wording match with the draft sentence.',
          from: { doc: '\u0000draft', kind: 'span', axis: 'chars', s: r.s, e: r.e }, to: { doc: p.doc, kind: 'span', axis: 'chars', s: p.st.s, e: p.st.e } };
        gut.append(h('div', { class: 'lk-row', onclick: () => open(p.doc, p.st.s) },
          h('div', { class: 'rel ' + (p.verdict === 'differs' ? 'differs' : '') }, h('span', {}, '#' + (i + 1) + ' · ' + RELATIONS[L.relation].label + (p.verdict !== 'related' ? ' · ' + p.verdict : '')), h('span', { class: 'lk-prov inferred' }, 'inferred')),
          h('div', { class: 'src' }, dot(H.get(p.doc)), clip(doc.title, 30)), h('q', {}, clip(p.st.text, 130))));
      });
    });
    return h('div', { style: 'display:flex;flex-direction:column;gap:10px' }, top,
      h('div', { class: 'lk-note' }, h('b', {}, answered + ' of ' + rows.length + ' sentences'), ' have a source that reads alike and beats chance here' + (rows.length - answered ? '; ' + (rows.length - answered) + ' stand alone.' : '.')),
      h('div', { class: 'lk-doc' }, left, gut));
  }

  // ── Orbit ──────────────────────────────────────────────────────────────────────────────────────────────────────
  function orbit() {
    const A = o.A, links = shown();
    const O = orbitOf(A, links, o.centre);
    if (!O.planets.size) return h('div', { class: 'lk-empty' }, 'No two sources are linked yet, so there is nothing to orbit.');
    const H = hues();
    const lv = levelsOf(O.nest); const level = Math.min(o.level === 'parts' ? Math.max(1, lv.max) : 0, lv.max);
    const open_ = openAtLevel(O.nest, level);
    const W = 760, Hh = 520, cx = W / 2, cy = Hh / 2;
    const ringStep = 108;
    const byRing = new Map(); const far = [];
    O.nest.roots.forEach(id => { if (id === O.centre) return; const d = O.dist.get(id); if (d == null) far.push(id); else (byRing.get(d) || byRing.set(d, []).get(d)).push(id); });
    const maxRing = Math.max(0, ...byRing.keys()) + (far.length ? 1 : 0);
    const scale = Math.min(1, (Math.min(cx, cy) - 56) / Math.max(1, maxRing * ringStep));
    const pos = new Map(); pos.set(O.centre, [cx, cy]);
    const place = (ids, ring) => ids.forEach((id, i) => { const a = -Math.PI / 2 + (2 * Math.PI * i) / ids.length + ring * 0.5; pos.set(id, [cx + Math.cos(a) * ringStep * ring * scale, cy + Math.sin(a) * ringStep * ring * scale]); });
    [...byRing.keys()].sort((a, b) => a - b).forEach(k => place(byRing.get(k), k));
    if (far.length) place(far, maxRing);
    const svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + Hh, role: 'img', 'aria-label': 'Orbit of sources around ' + clip(docOf(A, O.centre).title, 40) });
    for (let k = 1; k <= maxRing; k++) {
      svg.append(sv('circle', { cx, cy, r: ringStep * k * scale, fill: 'none', style: 'stroke:var(--line)', 'stroke-dasharray': far.length && k === maxRing ? '3 5' : null }));
      svg.append(sv('text', { x: cx + 6, y: cy - ringStep * k * scale - 4, style: 'fill:var(--dim);font-size:9.5px' }, far.length && k === maxRing ? 'no path' : k + (k === 1 ? ' step' : ' steps')));
    }
    // visible bodies: a planet, or — where its holon is open — its moons
    const rep = new Map(); const bodies = [];
    O.nest.parent.forEach((_, id) => rep.set(id, repOf(O.nest, id, open_)));
    const planetPos = id => pos.get(id) || [cx, cy];
    const moonPos = (planet, i, n) => { const [px, py] = planetPos(planet); const a = (2 * Math.PI * i) / Math.max(1, n) - Math.PI / 2; const r = 22 + Math.min(14, n); return [px + Math.cos(a) * r, py + Math.sin(a) * r]; };
    const where = id => { if (O.planets.has(id)) return planetPos(id); const m = O.moons.get(id); const sibs = O.nest.kids.get(m.doc); return moonPos(m.doc, sibs.indexOf(id), sibs.length); };
    const shownIds = []; O.nest.roots.forEach(id => { shownIds.push(id); if (open_.has(id)) O.nest.kids.get(id).forEach(k => shownIds.push(k)); });
    // ties between visible bodies, rolled up through the holons' own function
    const ties = rollUp(O.edges, rep);
    ties.forEach(t => { const [x1, y1] = where(t.a), [x2, y2] = where(t.b);
      svg.append(sv('line', { x1, y1, x2, y2, style: 'stroke:var(--ink2)', 'stroke-width': Math.min(4, 0.8 + 0.6 * Math.log2(1 + t.c)), opacity: .55 }, sv('title', {}, plural(t.c, 'link')))); });
    shownIds.forEach(id => {
      const isMoon = O.moons.has(id); const [x, y] = where(id); const prev = lastPos.get(id);
      const doc = isMoon ? O.moons.get(id).doc : id; const hue = H.get(doc);
      const c = isMoon ? O.moons.get(id).c : O.planets.get(id).c; const r = isMoon ? 5 + Math.min(4, c) : (id === O.centre ? 26 : 14 + Math.min(10, c));
      const from = prev || [x, y];
      const g = sv('g', { style: 'cursor:pointer;transform:translate(' + from[0] + 'px,' + from[1] + 'px)', tabindex: 0, role: 'button',
        'aria-label': isMoon ? clip(O.moons.get(id).st.text, 60) : docOf(A, id).title, onclick: () => { if (isMoon) showCard({ links: links.filter(L => L.id && O.edges.some(e => e.link === L.id && (e.a === id || e.b === id))), quote: O.moons.get(id).st }); else { o.onCentre && o.onCentre(id); set({ centre: id }); } },
        onkeydown: ev => { if (ev.key === 'Enter') ev.target.dispatchEvent(new MouseEvent('click')); } });
      g.append(sv('circle', { r, fill: hue, opacity: isMoon ? .85 : .22, stroke: hue, 'stroke-width': id === O.centre ? 2.5 : 1.2 }));
      if (!isMoon) { g.append(sv('text', { y: r + 12, 'text-anchor': 'middle', style: 'font-size:11px;fill:var(--ink)' }, clip(docOf(A, id).title, 22))); g.append(sv('text', { y: 4, 'text-anchor': 'middle', style: 'font-size:11px;font-weight:600;fill:var(--ink)' }, String(c))); }
      g.append(sv('title', {}, isMoon ? clip(O.moons.get(id).st.text, 160) : docOf(A, id).title + ' — ' + plural(c, 'link')));
      svg.append(g);
      if (prev) requestAnimationFrame(() => requestAnimationFrame(() => { g.style.transition = 'transform .55s ease'; g.style.transform = 'translate(' + x + 'px,' + y + 'px)'; }));
    });
    lastPos.clear(); shownIds.forEach(id => lastPos.set(id, where(id)));
    const none = (A.docs || []).filter(d => !O.planets.has(d.id)).length;
    const ctl = h('div', { class: 'lk-bar' },
      h('div', { class: 'lk-chips' }, h('span', { class: 'lk-lab' }, 'Center'), h('b', {}, clip(docOf(A, O.centre).title, 40))),
      h('div', { style: 'display:flex;gap:8px;align-items:center' }, h('span', { class: 'lk-lab' }, 'Level'), h('div', { class: 'lk-seg', role: 'group', 'aria-label': 'Level' },
        [['roots', 'Roots'], ['parts', 'Parts']].map(([k, l]) => h('button', { class: (level === 0 ? 'roots' : 'parts') === k ? 'on' : '', title: k === 'roots' ? 'Sources only' : 'Open every source into the passages that carry links',
          'aria-pressed': String((level === 0 ? 'roots' : 'parts') === k), onclick: () => { o.onLevel && o.onLevel(k); set({ level: k }); } }, l)))));
    return h('div', { style: 'display:flex;flex-direction:column;gap:8px' }, ctl, h('div', { class: 'lk-svgwrap' }, svg),
      h('div', { class: 'lk-note' }, 'Re-centering recomputes ring distance as link steps from the new center.' + (none ? ' ' + plural(none, 'source') + ' ' + (none === 1 ? 'has' : 'have') + ' no links and ' + (none === 1 ? 'is' : 'are') + ' not drawn.' : '')), noteTruth());
  }

  // ── Fields ─────────────────────────────────────────────────────────────────────────────────────────────────────
  function fields() {
    const A = o.A, links = shown(), H = hues();
    const F = fieldsOf(A, links);
    if (!F.length) return h('div', { class: 'lk-empty' }, 'No sources in this workspace yet.');
    const list = h('div', { class: 'lk-panel', style: 'display:flex;flex-direction:column;gap:14px' });
    F.sort((a, b) => b.void / Math.max(1, b.total) - a.void / Math.max(1, a.total) || a.title.localeCompare(b.title)).forEach(f => {
      const d = docOf(A, f.doc); const total = Math.max(1, (d.text || '').length);
      const strip = h('div', { class: 'lk-strip', style: '--lk-c:' + H.get(f.doc), role: 'img', 'aria-label': f.linked + ' of ' + f.total + ' passages linked' },
        f.cells.map(c => h('i', { class: (c.n ? 'on ' : '') + (c.differs ? 'bad ' : '') + (c.n && c.inferred === c.n ? 'inf' : ''), style: 'flex:' + Math.max(1, c.e - c.s) / total * 100 + ' 1 0', title: clip((A.byId && A.byId[c.st] ? A.byId[c.st].text : ''), 140) + (c.n ? ' — ' + plural(c.n, 'link') : ' — touches nothing'),
          onclick: () => open(f.doc, c.s) })));
      list.append(h('div', { class: 'lk-field' },
        h('div', { style: 'display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;justify-content:space-between' },
          h('span', { style: 'display:flex;gap:8px;align-items:center;font:500 14px var(--sans)' }, dot(H.get(f.doc)), clip(f.title, 64)),
          h('span', { class: 'lk-note' }, f.total ? h('span', {}, h('b', {}, f.linked + ' of ' + f.total), ' passages linked' + (f.void ? ' · ' + f.void + ' touch nothing' : '') + (f.whole ? ' · ' + plural(f.whole, 'whole-source tie') : '')) : 'no passages read')),
        f.total ? strip : null));
    });
    const gaps = (o.unresolved || []);
    const gp = gaps.length ? h('div', { class: 'lk-panel' }, h('div', { class: 'lk-lab', style: 'margin-bottom:6px' }, 'Pointers into nothing'),
      gaps.map(g => h('div', { class: 'lk-note', style: 'margin:2px 0' }, h('b', {}, clip(docOf(A, g.doc).title, 36)), ' says “' + g.raw + '” — ' + g.why + '.'))) : null;
    return h('div', { style: 'display:flex;flex-direction:column;gap:10px' }, list,
      h('div', { class: 'lk-legend' }, h('span', {}, h('span', { class: 'lk-dot', style: 'background:var(--acc)' }), ' linked'), h('span', {}, h('span', { class: 'lk-dot', style: 'border:1px solid var(--bad)' }), ' a link that differs'),
        h('span', {}, '┅ only inferred links'), h('span', {}, h('span', { class: 'lk-dot', style: 'border:1px dashed var(--line2)' }), ' touches nothing')), gp, noteTruth());
  }

  // ── Review ─────────────────────────────────────────────────────────────────────────────────────────────────────
  function review() {
    const A = o.A, H = hues();
    const inferred = o.links.filter(L => L.provenance === 'inferred');
    const confirmed = o.links.filter(L => L.provenance === 'confirmed');
    const today = new Date().toISOString().slice(0, 10);
    const todayN = (o.decisions || []).filter(e => e.action && e.at && String(e.at).slice(0, 10) === today).length;
    const tab = o.reviewTab || 'all';
    const tabs = [['all', 'All', inferred.length], ['differs', 'Differs', inferred.filter(L => L.verdict === 'differs').length], ['same', 'Same value', inferred.filter(L => L.relation === 'same-value' && L.verdict !== 'differs').length], ['other', 'Other', inferred.filter(L => L.relation !== 'same-value').length]];
    const keep = L => tab === 'all' || (tab === 'differs' && L.verdict === 'differs') || (tab === 'same' && L.relation === 'same-value' && L.verdict !== 'differs') || (tab === 'other' && L.relation !== 'same-value');
    const rows = inferred.filter(keep);
    const wr = o.write;
    const card = L => {
      const rel = h('select', { class: 'lk-sel', 'aria-label': 'Change relation', onchange: e => { if (e.target.value) wr && wr({ action: 'change', id: L.id, relation: e.target.value }); } },
        h('option', { value: '' }, 'Change relation…'), RELATION_IDS.filter(r => r !== L.relation).map(r => h('option', { value: r }, RELATIONS[r].label)));
      const pass = (sp) => h('div', { class: 'lk-pass', style: '--lk-c:' + H.get(sp.doc) }, h('small', {}, clip(docOf(A, sp.doc).title, 40) + (sp.axis === 'time' ? '' : '')), clip(quoteOf(A, sp, 200), 200));
      return h('div', { class: 'lk-card' },
        h('div', { style: 'display:flex;gap:8px;align-items:baseline;flex-wrap:wrap' },
          h('b', { style: 'font:600 13px var(--sans);' + (L.verdict === 'differs' ? 'color:var(--bad)' : '') }, 'proposed: ' + (L.verdict === 'differs' ? 'differs' : RELATIONS[L.relation].label)), L.weak ? h('span', { class: 'lk-weak', title: 'This pair does not beat chance in this workspace' }, 'below chance') : null, provChip(L),
          h('span', { class: 'lk-note' }, L.why)),
        h('div', { class: 'lk-two' }, pass(L.from), pass(L.to)),
        h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' },
          h('button', { class: 'lk-btn pri', disabled: !wr, onclick: () => wr && wr({ action: 'confirm', id: L.id }) }, 'Confirm'),
          h('button', { class: 'lk-btn bad', disabled: !wr, onclick: () => wr && wr({ action: 'reject', id: L.id }) }, 'Reject'), rel,
          h('button', { class: 'lk-btn', onclick: () => open(L.from.doc, L.from.s || 0) }, 'Open first'), h('button', { class: 'lk-btn', onclick: () => open(L.to.doc, L.to.s || 0) }, 'Open second')));
    };
    const weak = (o.weak || []).filter(L => !inferred.some(x => x.id === L.id));
    const head = h('div', { class: 'lk-bar' },
      h('div', { class: 'lk-h' }, 'Review', h('small', {}, inferred.length + ' inferred · ' + todayN + ' decided today · ' + confirmed.length + ' confirmed')),
      h('div', { class: 'lk-seg', role: 'group', 'aria-label': 'Filter' }, tabs.map(([k, l, n]) => h('button', { class: tab === k ? 'on' : '', 'aria-pressed': String(tab === k), onclick: () => set({ reviewTab: k }) }, l + ' ' + n))));
    const out = [head, h('div', { class: 'lk-blurb' }, BLURB.review + ' Confirm, Reject and Change relation are the only places a link is written; each records who decided and when.')];
    if (!rows.length) out.push(h('div', { class: 'lk-empty' }, inferred.length ? 'Nothing waiting under this filter.' : 'Nothing is waiting for review.'));
    rows.slice(0, 60).forEach(L => out.push(card(L)));
    if (rows.length > 60) out.push(h('div', { class: 'lk-note' }, rows.length - 60 + ' more waiting; decide these first.'));
    if (weak.length) {
      const det = h('details', { class: 'lk-panel' }, h('summary', { style: 'cursor:pointer;font:500 13px var(--sans)' }, plural(weak.length, 'wording pair') + ' did not beat chance here'),
        h('div', { class: 'lk-note', style: 'margin:6px 0' }, 'These are each other’s best partner but score no higher than a same-sized bag of this workspace’s own words would. With few sources and statements, almost nothing can. They are kept apart, never asserted; confirm one only if you can see it is real.'),
        weak.slice(0, 30).map(card));
      out.push(det);
    }
    if (o.truncated) out.push(noteTruth());
    return h('div', { style: 'display:flex;flex-direction:column;gap:10px' }, out);
  }

  // ── Passage card: one span and its links (read-only) ───────────────────────────────────────────────────────────
  function showCard(c) { card = c; renderCard(); }
  function renderCard() {
    wrap.querySelectorAll('.lk-pcard').forEach(n => n.remove());
    if (!card) return;
    wrap.append(passageCard({ ...card, A: o.A, hues: hues(), theme: o.theme, onOpen: open, onClose: () => { card = null; renderCard(); } }));
  }

  function render() {
    const view = SURFACES.includes(o.view) ? o.view : 'lanes';
    const parts = [];
    let count = null;
    const fn = { lanes, margin, seam, orbit, fields, review }[view];
    const body = fn();
    if (view !== 'review') parts.push(...toolbar(view, count));
    parts.push(body);
    wrap.replaceChildren(...parts.filter(Boolean));
    renderCard();
  }
  render();
  return {
    update(next) { const fresh = !next || (next.key !== o.key); if (fresh) memo.clear(); o = { ...o, ...next }; render(); },
    destroy() { root.replaceChildren(); },
    get view() { return o.view; },
  };
}

// ── the Passage card: one span and its links, read-only (a surface with NUL on links) ─────────────────────────────
export function passageCard({ links = [], title = '', quote = null, A, hues, theme = 'dark', onOpen, onClose }) {
  ensureStyle(); const bad = DIFFERS[theme] || DIFFERS.dark; void bad;
  const open = (doc, s) => onOpen && onOpen(doc, s);
  return h('aside', { class: 'lk lk-pcard', role: 'dialog', 'aria-label': 'Passage and its links' },
    h('button', { class: 'lk-x', title: 'Close', onclick: () => onClose && onClose() }, '✕'),
    title ? h('div', { class: 'lk-h' }, title) : null,
    quote ? h('div', { class: 'lk-pass', style: '--lk-c:' + (hues.get(quote.doc) || 'var(--acc)') }, h('small', {}, clip(docOf(A, quote.doc).title, 40)), quote.text) : null,
    links.length ? null : h('div', { class: 'lk-note' }, 'No links touch this passage at the current filter.'),
    links.slice(0, 40).map(L => h('div', { class: 'lk-card' },
      h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' },
        h('b', { style: 'font:600 12.5px var(--sans);' + (L.verdict === 'differs' ? 'color:var(--bad)' : '') }, RELATIONS[L.relation].glyph + ' ' + relLabel(L)), provChip(L), L.by ? h('span', { class: 'lk-note' }, 'by ' + L.by) : null),
      [L.from, L.to].map((sp, i) => h('div', { class: 'lk-pass', style: '--lk-c:' + (hues.get(sp.doc) || 'var(--acc)') },
        h('small', {}, (i ? 'to · ' : 'from · ') + clip(docOf(A, sp.doc).title, 36)), quoteOf(A, sp, 220),
        h('button', { class: 'lk-btn', style: 'margin-top:4px;padding:2px 8px;font-size:12px', onclick: () => open(sp.doc, onChars(sp) ? sp.s : 0) }, onChars(sp) ? 'Open in reader' : 'Open source'))),
      h('div', { class: 'lk-note' }, L.why))));
}

// ── the Reader's link gutter ────────────────────────────────────────────────────────────────────────────────────
// `nodes` is [[textNode, offset]] from the app's own walkText over the rendered text, so an offset here is an
// offset into d.text. Each link end that sits on characters of this source is underlined in its relation's style
// and the target source's hue; a gutter lists what each links to, stacked at the height of the passage.
export function paintLinks(el, nodes, { doc, links, A, hues, onOpen, theme = 'dark' }) {
  // the caller clears first (clearLinks) and then walks the text, so `nodes` are the live text nodes
  const items = [];
  links.forEach(L => [['from', L.from, L.to], ['to', L.to, L.from]].forEach(([side, mine, theirs]) => {
    if (mine.doc !== doc || !onChars(mine)) return;
    items.push({ L, s: mine.s, e: mine.e, other: theirs, side });
  }));
  if (!items.length) return { count: 0, destroy() {} };
  items.sort((a, b) => a.s - b.s || a.e - b.e);
  const bad = DIFFERS[theme] || DIFFERS.dark;
  for (const [node, o0] of nodes) {
    if (!node.isConnected) continue;
    const len = node.data.length; const o1 = o0 + len;
    const hit = items.filter(it => it.s < o1 && o0 < it.e); if (!hit.length) continue;
    const pts = new Set([0, len]); hit.forEach(it => { pts.add(Math.max(0, it.s - o0)); pts.add(Math.min(len, it.e - o0)); });
    const P = [...pts].sort((a, b) => a - b); const frag = document.createDocumentFragment();
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1]; if (b <= a) continue; const txt = node.data.slice(a, b);
      const on = hit.filter(it => it.s <= o0 + a && it.e >= o0 + b);
      if (!on.length) { frag.append(document.createTextNode(txt)); continue; }
      const top = on.slice().sort((x, y) => PROVENANCE[y.L.provenance].rank - PROVENANCE[x.L.provenance].rank)[0];
      const sp = document.createElement('span'); sp.className = 'lk-ul'; sp.textContent = txt;
      sp.setAttribute('data-lk', on.map(x => x.L.id).join(' ')); sp.setAttribute('data-rel', top.L.relation); sp.setAttribute('data-prov', top.L.provenance);
      if (on.some(x => x.L.verdict === 'differs')) sp.setAttribute('data-v', 'differs');
      sp.style.setProperty('--lk-c', top.L.verdict === 'differs' ? bad : (hues.get(top.other.doc) || 'var(--acc)'));
      sp.title = on.map(x => RELATIONS[x.L.relation].label + ' · ' + clip(quoteOf(A, x.other, 80), 80)).join('\n');
      sp.addEventListener('click', ev => { ev.stopPropagation(); ev.preventDefault(); onOpen && onOpen({ links: on.map(x => x.L), anchor: sp }); });
      frag.append(sp);
    }
    node.parentNode.replaceChild(frag, node);
  }
  // gutter: one row per link end, at the height of its first underlined span, pushed down where two would collide
  const host = el; const cs = getComputedStyle(host); if (cs.position === 'static') { host.style.position = 'relative'; host.dataset.lkPos = '1'; }
  host.dataset.lkPad = host.style.paddingRight || '0'; host.style.paddingRight = '262px';
  const gut = document.createElement('div'); gut.className = 'lk-gutter'; gut.style.cssText = 'position:absolute;top:0;right:0;width:248px;pointer-events:none';
  host.append(gut);
  const place = () => {
    gut.replaceChildren(); const hr = host.getBoundingClientRect(); let floor = 0; const seen = new Set();
    items.forEach(it => {
      if (seen.has(it.L.id)) return; seen.add(it.L.id);
      const anchor = host.querySelector('[data-lk~="' + CSS.escape(it.L.id) + '"]'); if (!anchor) return;
      const y = anchor.getBoundingClientRect().top - hr.top; const top = Math.max(y, floor);
      const row = document.createElement('div'); row.className = 'lk-row'; row.style.cssText = 'position:absolute;left:0;right:0;top:' + top + 'px;pointer-events:auto';
      const rel = document.createElement('div'); rel.className = 'rel' + (it.L.verdict === 'differs' ? ' differs' : '');
      rel.append(document.createTextNode(RELATIONS[it.L.relation].glyph + ' ' + relLabel(it.L)));
      const pv = document.createElement('span'); pv.className = 'lk-prov ' + it.L.provenance; pv.textContent = PROVENANCE[it.L.provenance].label; rel.append(pv);
      const src = document.createElement('div'); src.className = 'src';
      const dt = document.createElement('span'); dt.className = 'lk-dot'; dt.style.background = hues.get(it.other.doc) || 'var(--acc)'; src.append(dt, document.createTextNode(clip(docOf(A, it.other.doc).title, 30)));
      const q = document.createElement('q'); q.textContent = clip(quoteOf(A, it.other, 110), 110);
      row.append(rel, src, q); row.addEventListener('click', () => onOpen && onOpen({ links: [it.L] }));
      gut.append(row); floor = top + row.offsetHeight + 6;
    });
    gut.style.height = floor + 'px';
  };
  place(); const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => place()) : null; if (ro) ro.observe(host);
  const later = setTimeout(place, 250);
  return { count: new Set(items.map(i => i.L.id)).size, destroy() { clearTimeout(later); if (ro) ro.disconnect(); } };
}
export function clearLinks(el) {
  el.querySelectorAll('.lk-gutter').forEach(n => n.remove());
  el.querySelectorAll('.lk-ul').forEach(sp => { sp.replaceWith(document.createTextNode(sp.textContent)); });
  el.normalize();
  if (el.dataset && el.dataset.lkPad != null) { el.style.paddingRight = el.dataset.lkPad === '0' ? '' : el.dataset.lkPad; delete el.dataset.lkPad; }
  if (el.dataset && el.dataset.lkPos) { el.style.position = ''; delete el.dataset.lkPos; }
}

// ── "Link these…": declare a relation between two sources ──────────────────────────────────────────────────────
// Returns a link (not yet stored) from the form's values; the shelf's write handler logs it as a `declare` decision.
export function declaredLink({ A, from, to, relation, quoteFrom = '', quoteTo = '' }) {
  const span = (id, q) => {
    const d = docOf(A, id); const t = String(q || '').trim(); if (!t) return wholeSpan(id);
    const i = (d.text || '').toLowerCase().indexOf(t.toLowerCase()); if (i < 0) return null;
    return { doc: id, kind: 'span', axis: 'chars', s: i, e: i + t.length };
  };
  const a = span(from, quoteFrom), b = span(to, quoteTo);
  if (!a) return { error: 'The first passage was not found in “' + docOf(A, from).title + '”.' };
  if (!b) return { error: 'The second passage was not found in “' + docOf(A, to).title + '”.' };
  if (from === to && a.kind === 'whole' && b.kind === 'whole') return { error: 'Pick two different sources, or a passage in each.' };
  return { link: makeLink({ relation, from: a, to: b, provenance: 'confirmed', source: 'declared', why: 'Declared by a reader.' }) };
}
export { canWriteLinks };
