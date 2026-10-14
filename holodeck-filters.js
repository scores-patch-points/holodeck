// holodeck-filters.js — Airtable-style filters for the Sources table: conditions
// ("Department is FINANCE") collected in groups that are ANDed or ORed, and groups
// that nest inside groups.
//
// Pure data in, pure data out — the reader holds the tree in state and passes a
// getter (row → field value), so the same filter runs over the grid, the table
// and the counts. A condition that is not finished (no field, or no value for
// an operator that needs one) is ignored, never "matches nothing": a half-built
// filter must not blank the list.
//
//   cond  { t:'c', k:<field key>, o:<operator>, v:<value> }
//   group { t:'g', op:'and'|'or', items:[cond|group…] }
//
// Edits are by PATH — the indices from the root group down — and return a new
// tree; the previous one is never mutated.

export const OPS = [
  ['is', 'is'], ['isnot', 'is not'], ['contains', 'contains'], ['notcontains', 'does not contain'],
  ['empty', 'is empty'], ['notempty', 'is not empty'],
];
const NEEDS_VALUE = new Set(['is', 'isnot', 'contains', 'notcontains']);
export const opNeedsValue = o => NEEDS_VALUE.has(o);

export const newCond = (k = '') => ({ t: 'c', k, o: 'is', v: '' });
export const newGroup = (op = 'and') => ({ t: 'g', op, items: [] });

const norm = s => String(s == null ? '' : s).trim().toLowerCase();

const isComplete = c => !!c.k && (!NEEDS_VALUE.has(c.o) || norm(c.v) !== '');

export function testCond(c, get) {
  const have = norm(get(c.k)), want = norm(c.v);
  switch (c.o) {
    case 'is': return have === want;
    case 'isnot': return have !== want;
    case 'contains': return have.includes(want);
    case 'notcontains': return !have.includes(want);
    case 'empty': return have === '';
    case 'notempty': return have !== '';
    default: return true;
  }
}

// A group with nothing finished in it passes every row.
export function evalGroup(g, get) {
  const live = (g.items || []).filter(x => x.t === 'g' ? activeCount(x) > 0 : isComplete(x));
  if (!live.length) return true;
  const hit = x => x.t === 'g' ? evalGroup(x, get) : testCond(x, get);
  return g.op === 'or' ? live.some(hit) : live.every(hit);
}

export function activeCount(g) {
  return (g.items || []).reduce((n, x) => n + (x.t === 'g' ? activeCount(x) : isComplete(x) ? 1 : 0), 0);
}

// ---- immutable edits by path ----
const clone = x => JSON.parse(JSON.stringify(x));
function groupAt(root, path) { let g = root; for (const i of path) g = g.items[i]; return g; }

export function addCond(root, path, k = '') { const r = clone(root); groupAt(r, path).items.push(newCond(k)); return r; }
export function addGroup(root, path) { const r = clone(root); groupAt(r, path).items.push(newGroup('and')); return r; }
export function setOp(root, path, op) { const r = clone(root); groupAt(r, path).op = op === 'or' ? 'or' : 'and'; return r; }
export function remove(root, path) {
  if (!path.length) return clone(root);
  const r = clone(root); const parent = groupAt(r, path.slice(0, -1)); parent.items.splice(path[path.length - 1], 1); return r;
}
// Changing the field resets the operator and value — a department's value means nothing under "Vendor".
export function patch(root, path, p) {
  const r = clone(root); const parent = groupAt(r, path.slice(0, -1)); const c = parent.items[path[path.length - 1]];
  Object.assign(c, p); if ('k' in p && !('v' in p)) { c.o = 'is'; c.v = ''; } return r;
}

// The same tree with one condition taken out — what the rest of the filter leaves, so a value
// picker can offer only values that still occur (and say how many rows each would give).
export function without(root, path) { return remove(root, path); }

// distinct values of a field over rows, most common first
export function facet(rows, key, get) {
  const m = new Map();
  for (const r of rows) { const v = String(get(r, key) == null ? '' : get(r, key)).trim(); if (v) m.set(v, (m.get(v) || 0) + 1); }
  return [...m].map(([v, n]) => ({ v, n })).sort((a, b) => b.n - a.n || a.v.localeCompare(b.v));
}

// Flatten the tree for a template that cannot recurse: one entry per condition, group head and "add" row.
export function flatten(root) {
  const out = [];
  const walk = (g, path, depth) => {
    g.items.forEach((x, i) => {
      const p = [...path, i];
      if (x.t === 'g') { out.push({ kind: 'group', path: p, depth, op: x.op, index: i }); walk(x, p, depth + 1); out.push({ kind: 'add', path: p, depth: depth + 1 }); }
      else out.push({ kind: 'cond', path: p, depth, index: i, op: g.op, cond: x });
    });
  };
  walk(root, [], 0);
  return out;
}
