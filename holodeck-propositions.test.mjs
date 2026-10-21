import test from 'node:test';
import assert from 'node:assert/strict';
import { propositionsOf, sentenceOf } from './holodeck-propositions.js';
import { disagreementsOf } from './holodeck-disagreements.js';

const mk = (id, doc, text, spans) => ({ id, doc, s: 0, e: text.length, text, spans: spans.map(([x, name]) => { const s = text.indexOf(x); return { name: name || x, s, e: s + x.length }; }) });
const A = () => {
  const a = mk('a:0', 'a', 'The owners are the White Star Line, the directors being Mr. J. Bruce Ismay (chairman), and others.', [['White Star Line'], ['J. Bruce Ismay']]);
  const b = mk('b:0', 'b', 'J. Bruce Ismay, managing director of the White Star Line.', [['J. Bruce Ismay'], ['White Star Line']]);
  const c = mk('c:0', 'c', 'J. Bruce Ismay, chairman of the White Star Line, sailed.', [['J. Bruce Ismay'], ['White Star Line']]);
  return { sts: [a, b, c], docs: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], docById: { a: { id: 'a', title: 'Report' }, b: { id: 'b', title: 'Marshall' }, c: { id: 'c', title: 'Other' } } };
};
import { rolesOf } from './holodeck-offices.js';

test('a statement\'s proposition is held against every other source: agrees with one, disagrees with another', () => {
  const W = A(); W.rolesOf = rolesOf;
  const p = propositionsOf(W, W.sts[0]);
  assert.equal(p.length, 1);
  assert.equal(p[0].value, 'chairman'); assert.equal(p[0].verdict, 'disagrees');
  assert.deepEqual(p[0].others.map(o => [o.doc, o.agrees]).sort(), [['b', false], ['c', true]]);
  assert.match(sentenceOf(p[0]), /J\. Bruce Ismay — chairman, White Star Line/);
});
test('a proposition no other source states is unmatched, not a disagreement', () => {
  const W = A(); W.rolesOf = rolesOf; W.sts = W.sts.slice(0, 1);
  assert.equal(propositionsOf(W, W.sts[0])[0].verdict, 'alone');
});
test('disagreements: two offices for one being at one body rank, one source alone does not', () => {
  const W = A(); W.rolesOf = rolesOf;
  const d = disagreementsOf(W);
  assert.equal(d.length, 1); assert.equal(d[0].kind, 'role'); assert.equal(d[0].values.length, 2);
  W.sts = W.sts.slice(0, 1); assert.equal(disagreementsOf(W).length, 0);
});
