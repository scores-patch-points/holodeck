import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRows, sortRows, nextSort, columnsFor, tableHTML } from './referent-table.js';

const refs = [
  { id: 'r1', name: 'Ada', mentions: [1, 2, 3], born: 2, dot: '#111' },
  { id: 'r2', name: 'bob', mentions: 5, born: 1 },
  { id: 'r3', name: 'Cy', mentions: [1, 2, 3], born: null },
  { id: 'r4', name: 'Dee', mentions: 1, born: 0 },
];
const beings = [
  { reality: 'real', ends: [{ ref: 'r1', source: 'a' }, { ref: 'x', source: 'b' }] },
  { reality: 'fictional', ends: [{ ref: 'r2', source: 'a' }] },
];
const sources = [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }];

test('rows: counts, born, sources and reality from beings', () => {
  const rows = buildRows(refs, { beings, sources, selectedId: 'r2' });
  assert.deepEqual(rows.map((r) => r.mentions), [3, 5, 3, 1]);
  assert.equal(rows[2].first, null);
  assert.equal(rows[3].first, 0);
  assert.deepEqual(rows[0].sources.map((s) => s.label), ['Alpha', 'Beta']);
  assert.equal(rows[0].reality, 'real');
  assert.equal(rows[2].reality, null);
  assert.equal(rows[1].selected, true);
});

test('single source: no beings, no reality', () => {
  const rows = buildRows(refs);
  assert.ok(rows.every((r) => r.reality === null && r.sources.length === 0));
  assert.deepEqual(columnsFor(1, rows), ['name', 'mentions', 'first']);
});

test('columns for several sources', () => {
  assert.deepEqual(columnsFor(2, []), ['name', 'mentions', 'sources', 'reality', 'first']);
});

test('sort: stable, both directions, empties sink, names case-insensitive', () => {
  const rows = buildRows(refs, { beings, sources });
  assert.deepEqual(sortRows(rows, 'mentions', 'desc').map((r) => r.id), ['r2', 'r1', 'r3', 'r4']);
  assert.deepEqual(sortRows(rows, 'mentions', 'asc').map((r) => r.id), ['r4', 'r1', 'r3', 'r2']);
  assert.deepEqual(sortRows(rows, 'name', 'asc').map((r) => r.id), ['r1', 'r2', 'r3', 'r4']);
  assert.deepEqual(sortRows(rows, 'first', 'asc').map((r) => r.id), ['r4', 'r2', 'r1', 'r3']);
  assert.deepEqual(sortRows(rows, 'first', 'desc').map((r) => r.id), ['r1', 'r2', 'r4', 'r3']);
  assert.deepEqual(sortRows(rows, 'reality', 'asc').map((r) => r.id), ['r1', 'r2', 'r3', 'r4']);
});

test('nextSort flips or starts', () => {
  assert.deepEqual(nextSort({ key: 'name', dir: 'asc' }, 'name'), { key: 'name', dir: 'desc' });
  assert.deepEqual(nextSort({ key: 'name', dir: 'asc' }, 'mentions'), { key: 'mentions', dir: 'desc' });
});

test('html: escapes names, carries data-sel and aria-sort', () => {
  const rows = buildRows([{ id: 'r"9', name: '<b>"A&B"</b>', mentions: 2, born: 4 }]);
  const h = tableHTML(rows, { sort: { key: 'name', dir: 'asc' } });
  assert.ok(!h.includes('<b>'));
  assert.ok(h.includes('&lt;b&gt;&quot;A&amp;B&quot;&lt;/b&gt;'));
  assert.ok(h.includes('aria-sort="ascending"') && h.includes('aria-sort="none"'));
  assert.ok(h.includes('<th scope="col"') && h.includes('<th scope="row"'));
  assert.ok(h.includes("data-sel='{&quot;kind&quot;:&quot;ref&quot;,&quot;ref&quot;:&quot;r\\&quot;9&quot;}'"));
  assert.ok(!h.includes('c-sources'));
});

test('html: several sources show marks and reality glyph with title', () => {
  const h = tableHTML(buildRows(refs, { beings, sources }), { nSources: 2 });
  assert.equal((h.match(/class="sm"/g) || []).length, 3);
  assert.ok(h.includes('title="Beta"') && h.includes('fictional: only in the story'));
});
