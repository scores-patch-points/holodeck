import test from 'node:test';
import assert from 'node:assert/strict';
import { newGroup, newCond, evalGroup, activeCount, addCond, addGroup, setOp, remove, patch, without, facet, flatten } from './holodeck-filters.js';

const rows = [
  { id: 1, dept: 'FINANCE', vendor: 'ACME', exp: '2026' },
  { id: 2, dept: 'FINANCE', vendor: 'BETA', exp: '' },
  { id: 3, dept: 'FIRE', vendor: 'ACME', exp: '2027' },
  { id: 4, dept: 'PARKS', vendor: 'GAMMA', exp: '2026' },
];
const get = r => k => r[k];
const run = g => rows.filter(r => evalGroup(g, get(r))).map(r => r.id);

test('an unfinished filter passes every row', () => {
  let g = addCond(newGroup(), [], 'dept');
  assert.deepEqual(run(g), [1, 2, 3, 4]);
  assert.equal(activeCount(g), 0);
});

test('department is X narrows; AND stacks vendor under it', () => {
  let g = addCond(newGroup(), [], 'dept');
  g = patch(g, [0], { v: 'finance' });
  assert.deepEqual(run(g), [1, 2]);
  g = addCond(g, [], 'vendor'); g = patch(g, [1], { v: 'ACME' });
  assert.deepEqual(run(g), [1]);
});

test('OR group nested inside AND', () => {
  let g = addCond(newGroup(), [], 'exp'); g = patch(g, [0], { v: '2026' });
  g = addGroup(g, []); g = setOp(g, [1], 'or');
  g = addCond(g, [1], 'dept'); g = patch(g, [1, 0], { v: 'FINANCE' });
  g = addCond(g, [1], 'dept'); g = patch(g, [1, 1], { v: 'PARKS' });
  assert.deepEqual(run(g), [1, 4]);
});

test('is empty / is not empty need no value', () => {
  let g = addCond(newGroup(), [], 'exp'); g = patch(g, [0], { o: 'empty' });
  assert.deepEqual(run(g), [2]);
  g = patch(g, [0], { o: 'notempty' });
  assert.deepEqual(run(g), [1, 3, 4]);
});

test('contains and does-not-contain', () => {
  let g = addCond(newGroup(), [], 'dept'); g = patch(g, [0], { o: 'contains', v: 'fi' });
  assert.deepEqual(run(g), [1, 2, 3]);
  g = patch(g, [0], { o: 'notcontains' });
  assert.deepEqual(run(g), [4]);
});

test('changing the field resets operator and value; edits never mutate', () => {
  const g0 = patch(addCond(newGroup(), [], 'dept'), [0], { v: 'FIRE', o: 'isnot' });
  const g1 = patch(g0, [0], { k: 'vendor' });
  assert.equal(g1.items[0].v, ''); assert.equal(g1.items[0].o, 'is');
  assert.equal(g0.items[0].k, 'dept'); assert.equal(g0.items[0].v, 'FIRE');
});

test('without() + facet() give the faceted count a picker should show', () => {
  let g = addCond(newGroup(), [], 'dept'); g = patch(g, [0], { v: 'FINANCE' });
  g = addCond(g, [], 'vendor');
  const rest = without(g, [1]);
  const left = rows.filter(r => evalGroup(rest, get(r)));
  assert.deepEqual(facet(left, 'vendor', (r, k) => r[k]), [{ v: 'ACME', n: 1 }, { v: 'BETA', n: 1 }]);
});

test('remove and flatten', () => {
  let g = addCond(newGroup(), [], 'dept'); g = addGroup(g, []); g = addCond(g, [1], 'vendor');
  assert.deepEqual(flatten(g).map(x => x.kind), ['cond', 'group', 'cond', 'add']);
  assert.equal(remove(g, [1, 0]).items[1].items.length, 0);
});
