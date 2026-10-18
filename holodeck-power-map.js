// holodeck-power-map.js — a directed map of who and what, and how they relate. Pure and model-free:
// plain data in, plain data out, so it runs under node with no DOM.
//
// The Holodeck already reads names and the ties between them (holodeck-map.js, holodeck-holons.js), but a
// tie there is only "these names share a statement" — symmetric and undirected. A power map is not that: it
// is a directed graph of entities (people, organizations, funds) joined by typed relations (position,
// ownership, donation, family), and it is drawn as a DAG — the weightiest holders at the top, what they hold
// below, so the shape of influence is readable at a glance.
//
//   const g = createGraph();
//   addEntity(g, { name: 'Jane Roe', kind: 'person' });
//   addEntity(g, { name: 'Acme PAC', kind: 'org' });
//   addRelation(g, { from: idOf(g, 'Jane Roe'), to: idOf(g, 'Acme PAC'), category: 'donation' });
//   const { graph, removed } = enforceDag(g);          // cycles broken, never silently
//   const layout = layoutGraph(graph, { width: 900 });
//   const svg = toSvg(layout, { title: 'Acme and its people' });
//
// Two ways in besides authoring by hand:
//   fromLittleSis(entities, relationships)  map LittleSis entities + relationships to a directed graph
//   fromTies(nodes, edges)                  the Holodeck's own names/ties, oriented by weight into a DAG
//
// Everything is pure: every mutator returns a NEW graph. Ids are stable strings; relations carry an
// `undirected` flag for ties that carry no claim of direction, and `derived` for anything the surface
// inferred rather than a person asserted.

export const ENTITY_KINDS = ['person', 'org', 'fund', 'other'];

// Relation categories, ordered loosely from the most structural (a seat on a board) to the most incidental.
// `tie` is the undirected fallback the reader's co-occurrence produces; it never claims control.
export const RELATION_CATEGORIES = [
  'position', 'membership', 'ownership', 'employment', 'donation',
  'transaction', 'lobbying', 'legal', 'family', 'social', 'tie', 'other',
];

export const KIND_LABEL = { person: 'Person', org: 'Organization', fund: 'Fund', other: 'Name' };

let _seq = 0;
const newId = (p) => p + '_' + (Date.now().toString(36)) + '_' + (++_seq).toString(36);
const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const lower = (s) => clean(s).toLowerCase();

// ── construction ────────────────────────────────────────────────────────────────────────────────────
export function createGraph(init = {}) {
  return { entities: [], relations: [], title: init.title || '', note: init.note || '' };
}

export function cloneGraph(g) {
  return {
    entities: (g.entities || []).map((e) => ({ ...e })),
    relations: (g.relations || []).map((r) => ({ ...r })),
    title: g.title || '', note: g.note || '',
  };
}

export const findEntity = (g, id) => (g.entities || []).find((e) => e.id === id) || null;
export const findRelation = (g, id) => (g.relations || []).find((r) => r.id === id) || null;
export const idOf = (g, name) => { const e = entityByName(g, name); return e ? e.id : null; };
export function entityByName(g, name) {
  const n = lower(name);
  return (g.entities || []).find((e) => lower(e.name) === n || (e.aliases || []).some((a) => lower(a) === n)) || null;
}

export function addEntity(g, ent = {}) {
  const out = cloneGraph(g);
  const name = clean(ent.name) || 'Untitled';
  const existing = entityByName(out, name);
  if (existing && !ent.allowDuplicate) return { graph: out, id: existing.id, existing: true };
  const id = ent.id || newId('e');
  out.entities.push({
    id, name, kind: ENTITY_KINDS.includes(ent.kind) ? ent.kind : 'other',
    note: clean(ent.note), aliases: (ent.aliases || []).map(clean).filter(Boolean),
    src: ent.src || null,
  });
  return { graph: out, id, existing: false };
}

export function updateEntity(g, id, patch = {}) {
  const out = cloneGraph(g);
  const e = findEntity(out, id); if (!e) return out;
  if (patch.name != null) e.name = clean(patch.name) || e.name;
  if (patch.kind != null && ENTITY_KINDS.includes(patch.kind)) e.kind = patch.kind;
  if (patch.note != null) e.note = clean(patch.note);
  if (patch.aliases != null) e.aliases = (patch.aliases || []).map(clean).filter(Boolean);
  return out;
}

// Removing an entity removes every relation that touches it: a graph never keeps a dangling edge.
export function removeEntity(g, id) {
  const out = cloneGraph(g);
  out.entities = out.entities.filter((e) => e.id !== id);
  out.relations = out.relations.filter((r) => r.from !== id && r.to !== id);
  return out;
}

export function addRelation(g, rel = {}) {
  const out = cloneGraph(g);
  if (!findEntity(out, rel.from) || !findEntity(out, rel.to)) return out; // both ends must exist
  if (rel.from === rel.to) return out;                                     // no self-loops: they are cycles
  const category = RELATION_CATEGORIES.includes(rel.category) ? rel.category : 'other';
  const dup = out.relations.find((r) => r.from === rel.from && r.to === rel.to && r.category === category);
  if (dup) return out;
  out.relations.push({
    id: rel.id || newId('r'), from: rel.from, to: rel.to, category,
    label: clean(rel.label), note: clean(rel.note),
    undirected: !!rel.undirected, derived: !!rel.derived, src: rel.src || null,
  });
  return out;
}

export function updateRelation(g, id, patch = {}) {
  const out = cloneGraph(g);
  const r = findRelation(out, id); if (!r) return out;
  if (patch.category != null && RELATION_CATEGORIES.includes(patch.category)) r.category = patch.category;
  if (patch.label != null) r.label = clean(patch.label);
  if (patch.note != null) r.note = clean(patch.note);
  if (patch.undirected != null) r.undirected = !!patch.undirected;
  return out;
}

export function removeRelation(g, id) {
  const out = cloneGraph(g);
  out.relations = out.relations.filter((r) => r.id !== id);
  return out;
}

// Merge another graph in, matching entities by name so an import lands on names already present.
export function mergeGraph(g, other) {
  let out = cloneGraph(g);
  const map = new Map();
  for (const e of (other.entities || [])) {
    const { graph, id } = addEntity(out, { name: e.name, kind: e.kind, note: e.note, aliases: e.aliases, src: e.src });
    out = graph; map.set(e.id, id);
  }
  for (const r of (other.relations || [])) {
    out = addRelation(out, { from: map.get(r.from), to: map.get(r.to), category: r.category, label: r.label, note: r.note, undirected: r.undirected, derived: r.derived, src: r.src });
  }
  return out;
}

// ── acyclicity ──────────────────────────────────────────────────────────────────────────────────────
// A power map is read top-down, so it must be a DAG. Cycles are found, reported and (on request) broken —
// never hidden. `undirected` relations are oriented from→to for this purpose, which is how they are drawn.
export function adjacency(g) {
  const ids = new Set((g.entities || []).map((e) => e.id));
  const out = new Map(), inn = new Map();
  ids.forEach((id) => { out.set(id, []); inn.set(id, []); });
  for (const r of (g.relations || [])) {
    if (!ids.has(r.from) || !ids.has(r.to)) continue;
    out.get(r.from).push(r);
    inn.get(r.to).push(r);
  }
  return { out, inn };
}

// DFS three-colour search. Returns one cycle as a list of entity ids (with the first repeated at the end),
// or null. Deterministic: entities and their edges are visited in insertion order.
export function findCycle(g) {
  const { out } = adjacency(g);
  const WHITE = 0, GREY = 1, BLACK = 2;
  const colour = new Map((g.entities || []).map((e) => [e.id, WHITE]));
  const stack = [], path = [];
  let cycle = null;
  const visit = (id) => {
    colour.set(id, GREY); path.push(id);
    for (const r of out.get(id) || []) {
      if (cycle) return;
      const c = colour.get(r.to);
      if (c === GREY) { cycle = path.slice(path.indexOf(r.to)).concat(r.to); return; }
      if (c === WHITE) visit(r.to);
    }
    path.pop(); colour.set(id, BLACK);
  };
  for (const e of (g.entities || [])) { if (colour.get(e.id) === WHITE) { visit(e.id); if (cycle) break; } }
  return cycle;
}

export const isDag = (g) => findCycle(g) === null;

// Kahn's algorithm. Returns entity ids in dependency order, or null if a cycle blocks it.
export function topoOrder(g) {
  const { out, inn } = adjacency(g);
  const indeg = new Map([...inn].map(([id, rs]) => [id, rs.length]));
  const queue = [...indeg].filter(([, d]) => d === 0).map(([id]) => id);
  const order = [];
  while (queue.length) {
    const id = queue.shift(); order.push(id);
    for (const r of out.get(id) || []) {
      indeg.set(r.to, indeg.get(r.to) - 1);
      if (indeg.get(r.to) === 0) queue.push(r.to);
    }
  }
  return order.length === (g.entities || []).length ? order : null;
}

// Break every cycle by removing one relation per cycle. The relation removed is the least load-bearing:
// a derived/undirected tie goes before an asserted one, then the weakest category, then the last added.
const CATEGORY_RANK = new Map(RELATION_CATEGORIES.map((c, i) => [c, RELATION_CATEGORIES.length - i]));
const weight = (r) => (r.derived ? 0 : 100) + (r.undirected ? 0 : 10) + (CATEGORY_RANK.get(r.category) || 0);
export function enforceDag(g) {
  let out = cloneGraph(g);
  const removed = [], cycles = [];
  let guard = 0;
  while (guard++ < 1000) {
    const cyc = findCycle(out);
    if (!cyc) break;
    cycles.push(cyc);
    const inCycle = new Set(cyc);
    const cands = out.relations.filter((r) => inCycle.has(r.from) && inCycle.has(r.to));
    cands.sort((a, b) => weight(a) - weight(b) || (a.id < b.id ? -1 : 1));
    const drop = cands[0]; if (!drop) break;
    removed.push(drop);
    out = removeRelation(out, drop.id);
  }
  return { graph: out, removed, cycles, wasDag: removed.length === 0 };
}

// ── ranking and layout ──────────────────────────────────────────────────────────────────────────────
// Longest-path ranking: a source sits at layer 0 and every entity one layer below its deepest parent.
// Cycles are broken first (for the ranking only) so the layout always terminates on a DAG.
export function layerGraph(g) {
  const { graph: dag, removed } = enforceDag(g);
  const { out, inn } = adjacency(dag);
  const order = topoOrder(dag) || (dag.entities || []).map((e) => e.id);
  const rank = new Map(order.map((id) => [id, 0]));
  for (const id of order) {
    for (const r of out.get(id) || []) {
      rank.set(r.to, Math.max(rank.get(r.to) || 0, (rank.get(id) || 0) + 1));
    }
  }
  const byRank = new Map();
  for (const id of order) { const k = rank.get(id); (byRank.get(k) || byRank.set(k, []).get(k)).push(id); }
  const layers = [...byRank.keys()].sort((a, b) => a - b).map((k) => byRank.get(k));
  return { graph: dag, rank, layers, removed, indeg: inn };
}

// One barycenter pass: order each layer by the mean position of its parents, which cuts edge crossings.
function orderLayers(layers, rank, inn) {
  const pos = new Map();
  layers[0].forEach((id, i) => pos.set(id, i));
  for (let L = 1; L < layers.length; L++) {
    const scored = layers[L].map((id) => {
      const ps = (inn.get(id) || []).map((r) => pos.get(r.from)).filter((x) => x != null);
      const b = ps.length ? ps.reduce((a, x) => a + x, 0) / ps.length : Infinity;
      return { id, b, i: layers[L].indexOf(id) };
    });
    scored.sort((a, b) => (a.b - b.b) || (a.i - b.i));
    scored.forEach((s, i) => pos.set(s.id, i));
    layers[L] = scored.map((s) => s.id);
  }
  return layers;
}

const measure = (label, fs) => Math.max(60, Math.min(240, Math.round(18 + String(label).length * fs * 0.58)));

// Turn a graph into positioned boxes and routed edges. Deterministic, no randomness, so a map is stable
// across renders and an exported SVG is reproducible.
export function layoutGraph(g, o = {}) {
  const L = layerGraph(g);
  const layers = orderLayers(L.layers, L.rank, L.indeg);
  const fs = o.fontSize || 12.5, nodeH = o.nodeH || 34, gapX = o.gapX || 22, gapY = o.gapY || 84;
  const padX = o.padX || 28, padTop = o.padTop || 46, padBottom = o.padBottom || 40;
  const nodes = [], byId = new Map();
  let maxRow = 0;
  const rowW = layers.map((ids) => {
    const widths = ids.map((id) => measure((findEntity(L.graph, id) || {}).name, fs));
    return widths.reduce((a, w) => a + w + gapX, -gapX);
  });
  maxRow = Math.max(0, ...rowW);
  const width = Math.max(o.width || 0, maxRow + padX * 2);
  layers.forEach((ids, r) => {
    const widths = ids.map((id) => measure((findEntity(L.graph, id) || {}).name, fs));
    let x = (width - rowW[r]) / 2 + padX;
    const y = padTop + r * (nodeH + gapY);
    ids.forEach((id, i) => {
      const ent = findEntity(L.graph, id) || { id, name: id, kind: 'other' };
      const w = widths[i];
      const box = { id, name: ent.name, kind: ent.kind, note: ent.note, rank: r, x: Math.round(x), y, w, h: nodeH, cx: Math.round(x + w / 2), cy: y + nodeH / 2 };
      nodes.push(box); byId.set(id, box);
      x += w + gapX;
    });
  });
  const edges = (L.graph.relations || []).filter((rel) => byId.has(rel.from) && byId.has(rel.to)).map((rel) => {
    const a = byId.get(rel.from), b = byId.get(rel.to);
    const forward = b.rank > a.rank;
    const y1 = forward ? a.y + a.h : a.y, y2 = forward ? b.y : b.y + b.h;
    const midY = (y1 + y2) / 2;
    const points = [
      { x: a.cx, y: y1 },
      { x: a.cx, y: Math.round(midY) },
      { x: b.cx, y: Math.round(midY) },
      { x: b.cx, y: y2 },
    ];
    return { id: rel.id, from: rel.from, to: rel.to, category: rel.category, label: rel.label, undirected: rel.undirected, derived: rel.derived, points, reversed: !forward };
  });
  const height = padTop + Math.max(1, layers.length) * (nodeH + gapY) - gapY + padBottom;
  return { nodes, edges, byId, layers, rank: L.rank, width, height, removed: L.removed, title: g.title || '', note: g.note || '' };
}

// ── SVG ─────────────────────────────────────────────────────────────────────────────────────────────
export const KIND_COLOR = { person: '#6fb0dc', org: '#e0a35c', fund: '#8ad3a0', other: '#9d9da8' };
const EDGE_COLOR = {
  position: '#8ab4ff', membership: '#8ab4ff', ownership: '#f0b429', employment: '#7fc8a9',
  donation: '#e08ac0', transaction: '#e0a35c', lobbying: '#c9a0e0', legal: '#d98a8a',
  family: '#a0c060', social: '#9d9da8', tie: '#6f6f7a', other: '#8a8a95',
};
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pathOf = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + p.x + ' ' + p.y).join(' ');

export function toSvg(layout, o = {}) {
  const pad = 20, titleH = o.title === '' ? 0 : 34, legendH = o.legend === false ? 0 : 26;
  const W = Math.round(layout.width + pad * 2), H = Math.round(layout.height + titleH + legendH + pad);
  const bg = o.background || '#17171a', ink = o.ink || '#f4f4f6', ink2 = o.ink2 || '#c9c9d2', dim = o.dim || '#9494a0', line = o.line || '#3f3f46';
  const offY = titleH + pad;
  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Inter, system-ui, sans-serif">`);
  parts.push(`<defs><marker id="pm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${line}"/></marker>`);
  for (const [cat, col] of Object.entries(EDGE_COLOR)) parts.push(`<marker id="pm-arrow-${cat}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${col}"/></marker>`);
  parts.push('</defs>');
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${bg}"/>`);
  const title = o.title != null ? o.title : layout.title;
  if (title) parts.push(`<text x="${pad}" y="${pad + 20}" fill="${ink}" font-size="16" font-weight="600">${esc(title)}</text>`);
  if (layout.note && o.legend !== false) parts.push(`<text x="${W - pad}" y="${pad + 20}" text-anchor="end" fill="${dim}" font-size="11">${esc(layout.note)}</text>`);
  for (const e of layout.edges) {
    const col = EDGE_COLOR[e.category] || EDGE_COLOR.other;
    const dash = e.undirected ? ' stroke-dasharray="5 4"' : '';
    parts.push(`<path d="${pathOf(e.points.map((p) => ({ x: p.x + pad, y: p.y + offY })))}" fill="none" stroke="${col}" stroke-width="${e.derived ? 1.2 : 1.8}" opacity="${e.derived ? 0.55 : 0.9}"${dash} marker-end="url(#pm-arrow-${EDGE_COLOR[e.category] ? e.category : 'other'})"/>`);
  }
  for (const n of layout.nodes) {
    const col = KIND_COLOR[n.kind] || KIND_COLOR.other;
    const x = n.x + pad, y = n.y + offY;
    parts.push(`<g class="pm-node" data-id="${esc(n.id)}"><rect x="${x}" y="${y}" width="${n.w}" height="${n.h}" rx="8" fill="#1c1c20" stroke="${col}" stroke-width="1.5"/>`);
    parts.push(`<text x="${x + n.w / 2}" y="${y + n.h / 2 + 4}" text-anchor="middle" fill="${ink}" font-size="${o.fontSize || 12.5}">${esc(n.name.length > 30 ? n.name.slice(0, 29) + '…' : n.name)}</text></g>`);
  }
  if (legendH) {
    const y = H - pad - 6; let x = pad;
    for (const [cat, col] of [['position', EDGE_COLOR.position], ['ownership', EDGE_COLOR.ownership], ['donation', EDGE_COLOR.donation], ['family', EDGE_COLOR.family], ['tie', EDGE_COLOR.tie]]) {
      parts.push(`<line x1="${x}" y1="${y - 4}" x2="${x + 18}" y2="${y - 4}" stroke="${col}" stroke-width="2"/><text x="${x + 24}" y="${y}" fill="${dim}" font-size="11">${cat}</text>`);
      x += 24 + cat.length * 7 + 22;
    }
  }
  parts.push('</svg>');
  return parts.join('\n');
}

// ── importers ───────────────────────────────────────────────────────────────────────────────────────
// LittleSis relationship category ids → our categories. LittleSis's own numbering is stable but only
// partly documented; anything unrecognised keeps the id in `label` and lands in `other`, never guessed.
const LS_CATEGORY = {
  1: 'position', 2: 'education', 3: 'membership', 4: 'family', 5: 'donation',
  6: 'transaction', 7: 'lobbying', 8: 'social', 9: 'professional', 10: 'ownership',
  11: 'legal', 12: 'other',
};
const lsEntity = (raw) => {
  const a = raw && raw.attributes ? raw.attributes : raw || {};
  const ext = a.primary_ext || a.type || '';
  return {
    id: String(a.id != null ? a.id : raw.id),
    name: clean(a.name) || 'Entity ' + (a.id != null ? a.id : ''),
    kind: /org/i.test(ext) ? 'org' : /person/i.test(ext) ? 'person' : 'other',
    note: clean(a.blurb || a.summary),
    src: a.updated_at || null,
  };
};
const lsRelation = (raw) => {
  const a = raw && raw.attributes ? raw.attributes : raw || {};
  const cid = a.category_id != null ? a.category_id : a.category;
  const cat = LS_CATEGORY[cid];
  return {
    from: String(a.entity1_id), to: String(a.entity2_id),
    category: cat || 'other', label: cat ? '' : ('category ' + cid),
    src: a.updated_at || null,
  };
};

// Accepts LittleSis bulk JSON (arrays of entities/relationships) or the API v2 shape ({data:[...]}).
export function fromLittleSis(entities, relationships, o = {}) {
  let g = createGraph({ title: o.title || 'LittleSis import', note: 'Source: LittleSis (CC BY-SA 4.0)' });
  const list = (x) => Array.isArray(x) ? x : (x && Array.isArray(x.data) ? x.data : []);
  const idMap = new Map();
  for (const raw of list(entities)) {
    const e = lsEntity(raw);
    const { graph, id } = addEntity(g, { name: e.name, kind: e.kind, note: e.note, src: e.src });
    g = graph; idMap.set(e.id, id);
  }
  for (const raw of list(relationships)) {
    const r = lsRelation(raw);
    const from = idMap.get(r.from), to = idMap.get(r.to);
    if (!from || !to) continue;
    g = addRelation(g, { from, to, category: r.category, label: r.label, src: r.src });
  }
  return g;
}

// The Holodeck's own names and ties (the shape holodeck-map.js feeds the map): nodes [{n, c, type}],
// edges [{a, b, c}]. A tie is symmetric, so it is oriented from the weightier name to the lighter one —
// the same outranks rule holodeck-holons.js uses — which makes the result a DAG by construction.
const outranks = (a, b) => a.c > b.c || (a.c === b.c && a.n < b.n);
const holonKind = (t) => (/person/i.test(t || '') ? 'person' : /org|organisation|company|institution/i.test(t || '') ? 'org' : 'other');
export function fromTies(nodes, edges, o = {}) {
  let g = createGraph({ title: o.title || 'Names and their ties', note: 'Ties are shared statements, not ownership or control' });
  const byN = new Map();
  for (const x of (nodes || [])) {
    const { graph, id } = addEntity(g, { name: x.n, kind: holonKind(x.type), src: x.doc || null });
    g = graph; byN.set(x.n, { id, c: x.c || 1, n: x.n });
  }
  for (const E of (edges || [])) {
    const A = byN.get(E.a), B = byN.get(E.b); if (!A || !B || A.id === B.id) continue;
    const [from, to] = outranks(A, B) ? [A.id, B.id] : [B.id, A.id];
    g = addRelation(g, { from, to, category: 'tie', undirected: true, derived: true, label: (E.c || 1) + ' shared' });
  }
  return g;
}

// ── serialization ───────────────────────────────────────────────────────────────────────────────────
export function toJSON(g) {
  return JSON.stringify({ v: 1, title: g.title || '', note: g.note || '', entities: g.entities || [], relations: g.relations || [] }, null, 2);
}
export function fromJSON(text) {
  const o = typeof text === 'string' ? JSON.parse(text) : text;
  const g = createGraph({ title: o.title, note: o.note });
  for (const e of (o.entities || [])) g.entities.push({ id: String(e.id), name: clean(e.name), kind: ENTITY_KINDS.includes(e.kind) ? e.kind : 'other', note: clean(e.note), aliases: e.aliases || [], src: e.src || null });
  const ids = new Set(g.entities.map((e) => e.id));
  for (const r of (o.relations || [])) {
    if (!ids.has(String(r.from)) || !ids.has(String(r.to)) || String(r.from) === String(r.to)) continue;
    g.relations.push({ id: String(r.id), from: String(r.from), to: String(r.to), category: RELATION_CATEGORIES.includes(r.category) ? r.category : 'other', label: clean(r.label), note: clean(r.note), undirected: !!r.undirected, derived: !!r.derived, src: r.src || null });
  }
  return g;
}

export function graphStats(g) {
  const kinds = {};
  for (const e of (g.entities || [])) kinds[e.kind] = (kinds[e.kind] || 0) + 1;
  const cats = {};
  for (const r of (g.relations || [])) cats[r.category] = (cats[r.category] || 0) + 1;
  const dag = isDag(g);
  return {
    entities: (g.entities || []).length, relations: (g.relations || []).length,
    kinds, categories: cats, dag,
    roots: [...adjacency(g).inn].filter(([, rs]) => rs.length === 0).length,
    summary: (g.entities || []).length + ' ' + ((g.entities || []).length === 1 ? 'entity' : 'entities') + ' · ' +
      (g.relations || []).length + ' ' + ((g.relations || []).length === 1 ? 'relation' : 'relations') +
      (dag ? ' · acyclic' : ' · contains a cycle'),
  };
}
