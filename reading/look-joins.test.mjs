import test from 'node:test'; import assert from 'node:assert/strict';
import { joinItems, decideJunctions, applyJunctions } from './look-joins.js';
// pdf.js items as the Mayor PDF sets them: a 46.3pt initial on baseline 462.1, the PDF's own space after it, then 14.2pt text on 484.5
const I = (str, x, y, w, h, eol = false) => ({ str, transform: [h || 10, 0, 0, h || 10, x, y], width: w, height: h, hasEOL: eol });
const dropCap = (cap, rest) => [I('', 43.7, 462.1, 0, 0, true), I(cap, 43.7, 462.1, 35, 46.3), I(' ', 78.7, 462.1, 15, 0), I(rest, 90, 484.5, 91.1, 14.2), I(' ', 181, 484.5, 4.7, 0), I('Mayor O’Connell’s Chief', 184.6, 484.5, 150, 14.2)];
const plain = [I('The roof', 40, 700, 60, 12), I(' ', 100, 700, 3, 0), I('fell in.', 103, 700, 40, 12, true), I('Then it rained.', 40, 685, 90, 12)];

test('the plain join is unchanged, and ordinary lines do not startle', () => {
  const r = joinItems(plain); assert.equal(r.text, 'The roof fell in.\nThen it rained.'); assert.equal(r.startles.length, 0);
});
test('two baselines on one row startle, with no glyph or word named', () => {
  const r = joinItems(dropCap('K', 'ristin Wilson,'));
  assert.equal(r.startles.length, 1); const s = r.startles[0];
  assert.equal(r.text.slice(0, s.at).trim(), 'K'); assert.ok(r.text.slice(s.end).startsWith('ristin')); assert.match(s.why, /another baseline/);
});
const ctx = (lex, names = ['Wilson']) => ({ known: (w) => lex.has(w), docCount: () => 0, names, corefer: (a, b) => a.endsWith(' ' + b) });
test('the later layers pick the joined reading when it extends an established name', () => {
  const r = joinItems(dropCap('K', 'ristin Wilson,')), [d] = decideJunctions(r.text, r.startles, ctx(new Set(['mayor', 'chief'])));
  assert.equal(d.decision, 'join', d.by); assert.equal(d.joined, 'Kristin'); assert.match(applyJunctions(r.text, [d]), /Kristin Wilson/);
});
test('a tie keeps the PDF’s spacing: “A new” and “Anew” are both words', () => {
  const r = joinItems(dropCap('A', 'new study')), [d] = decideJunctions(r.text, r.startles, ctx(new Set(['a', 'new', 'anew', 'study'])));
  assert.equal(d.decision, 'space', d.by); assert.match(d.by, /tie/); assert.equal(applyJunctions(r.text, [d]), r.text);
});
test('nothing usable on either side keeps the spacing', () => {
  const r = joinItems(dropCap('Q', 'zzx qqq')), [d] = decideJunctions(r.text, r.startles, ctx(new Set(), []));
  assert.equal(d.decision, 'space');
});
