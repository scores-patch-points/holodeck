// referent-table.js — the referents of a reading as a TABLE (pure: data in, HTML string out; no DOM, no state of its own).
// Columns: ● name · mentions · sources (one mark per source; only when 2+ sources are loaded) · reality · first statement.
// A row carries the same data-sel the old list item did, so the reader's one select path handles it. The reader keeps the sort state.
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const REALITY = {
  real: { glyph: '●', title: 'real: a thing in the world' },
  'fictionalized-real': { glyph: '◐', title: 'fictionalized real: a real thing as a story tells it' },
  fictional: { glyph: '○', title: 'fictional: only in the story' },
  unexamined: { glyph: '·', title: 'unexamined: no source has said' },
};
const realityOf = (k) => REALITY[k] || REALITY.unexamined;

const COLUMNS = {
  name: { label: 'Name', num: false },
  mentions: { label: 'Mentions', num: true },
  sources: { label: 'Sources', num: true },
  reality: { label: 'Reality', num: false },
  first: { label: 'First', num: true, title: 'first statement number' },
};
const REALITY_ORDER = ['real', 'fictionalized-real', 'fictional', 'unexamined'];

// Which columns to show: sources only with 2+ sources loaded; reality with 2+ sources or when some row has one (a single-source reading has none).
export function columnsFor(nSources, rows = []) {
  const cols = ['name', 'mentions'];
  if (nSources > 1) cols.push('sources');
  if (nSources > 1 || rows.some((r) => r.reality)) cols.push('reality');
  cols.push('first');
  return cols;
}

// referents: [{id, name, mentions (count or array), born, dot}]; beings: fold.beings [{reality, ends:[{ref, source}]}]; sources: [{id, label}].
export function buildRows(referents, { beings = [], sources = [], selectedId = null } = {}) {
  const byRef = new Map();
  for (const b of beings) for (const e of b.ends || []) if (!byRef.has(e.ref)) byRef.set(e.ref, b);
  const srcIx = new Map(sources.map((s, i) => [s.id, i]));
  return referents.map((r, i) => {
    const b = byRef.get(r.id), ids = b ? [...new Set(b.ends.map((e) => e.source))] : [];
    const born = r.born == null || r.born === '' || Number.isNaN(+r.born) ? null : +r.born;
    return {
      id: r.id, name: r.name || '', dot: r.dot || null, i,
      mentions: Array.isArray(r.mentions) ? r.mentions.length : (+r.mentions || 0),
      sources: ids.map((id) => ({ id, label: (sources.find((s) => s.id === id) || {}).label || id, ix: srcIx.has(id) ? srcIx.get(id) : 0 })),
      reality: b && b.reality ? b.reality : null,
      first: born, selected: r.id === selectedId,
    };
  });
}

// Stable sort: ties keep the incoming order (the reading's own order), whichever direction.
export function sortRows(rows, key, dir = 'asc') {
  const sgn = dir === 'desc' ? -1 : 1, nil = (v) => v == null || v === '';
  const val = (r) => key === 'name' ? r.name.toLowerCase() : key === 'sources' ? r.sources.length : key === 'reality' ? (r.reality ? REALITY_ORDER.indexOf(r.reality) : 99) : r[key];
  return rows.map((r, n) => [r, n]).sort(([a, ia], [b, ib]) => {
    const x = val(a), y = val(b);
    if (nil(x) !== nil(y)) return nil(x) ? 1 : -1; // empty values sink in both directions
    const c = typeof x === 'string' ? x.localeCompare(y) : (x > y) - (x < y);
    return c ? c * sgn : ia - ib;
  }).map(([r]) => r);
}

// The state after a header click: same column flips direction; a new one starts ascending (names, first) or descending (counts).
export function nextSort(cur, key) {
  if (cur && cur.key === key) return { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' };
  return { key, dir: key === 'name' || key === 'reality' || key === 'first' ? 'asc' : 'desc' };
}

export function tableHTML(rows, { nSources = 1, sort = null, selectKind = (r) => ({ kind: 'ref', ref: r.id }), palette = ['#5aa9ff', '#c68bff', '#ffb454', '#6ee7a8', '#ff8fa3', '#7fe0e0', '#d6e36b', '#f29de4'], caption = 'People & things' } = {}) {
  const cols = columnsFor(nSources, rows);
  const th = (k) => { const c = COLUMNS[k], on = sort && sort.key === k, dir = on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
    return `<th scope="col" class="c-${k}${c.num ? ' num' : ''}" aria-sort="${dir}"${c.title ? ` title="${esc(c.title)}"` : ''}><button type="button" data-rsort="${k}">${esc(c.label)}${on ? `<span class="ar" aria-hidden="true">${sort.dir === 'asc' ? '▲' : '▼'}</span>` : ''}</button></th>`; };
  const td = (r, k) => {
    if (k === 'name') return `<th scope="row" class="c-name">${r.dot ? `<span class="dot" style="background:${esc(r.dot)}"></span>` : ''}<span>${esc(r.name || '—')}</span></th>`;
    if (k === 'mentions') return `<td class="c-mentions num">${r.mentions}</td>`;
    if (k === 'sources') return `<td class="c-sources num">${r.sources.map((s) => `<span class="sm" style="background:${esc(palette[s.ix % palette.length])}" title="${esc(s.label)}"></span>`).join('') || '<span class="dim">·</span>'}</td>`;
    if (k === 'reality') { const g = realityOf(r.reality); return `<td class="c-reality" title="${esc(g.title)}"><span aria-hidden="true">${g.glyph}</span><span class="sr">${esc(r.reality || 'unexamined')}</span></td>`; }
    return `<td class="c-first num">${r.first ?? '—'}</td>`;
  };
  return `<table class="rt"><caption class="sr">${esc(caption)}</caption><thead><tr>${cols.map(th).join('')}</tr></thead><tbody>${rows.map((r) => `<tr class="${r.selected ? 'sel' : ''}" data-sel='${esc(JSON.stringify(selectKind(r)))}'${r.selected ? ' aria-selected="true"' : ''}>${cols.map((k) => td(r, k)).join('')}</tr>`).join('')}</tbody></table>`;
}
