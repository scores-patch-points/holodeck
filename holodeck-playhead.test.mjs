import test from 'node:test';
import assert from 'node:assert/strict';
import { cuesOf, wordsOf, indexAt, timeAtChar, laneLayout } from './holodeck-playhead.js';

const lines = [{ t: 10, text: 'second line here' }, { t: 0, text: 'aa bb' }, { t: 20, text: '   ' }];

test('cuesOf: sorted, blank lines dropped, a line ends where the next begins, the last at the duration', () => {
  const c = cuesOf(lines, 30);
  assert.deepEqual(c.map(x => [x.t, x.end]), [[0, 10], [10, 30]]);
  assert.deepEqual(c[0].words.map(w => w.w), ['aa', 'bb']);
  assert.equal(c[0].words[0].t, 0);
  assert.equal(c[0].words[1].t, 6);            // 'bb' starts at char 3 of 5 → 3/5 of 10 s
  assert.equal(c[0].words[1].end, 10);
  assert.deepEqual(wordsOf(c).map(w => w.i), [0, 1, 2, 3, 4]);
});

test('cuesOf: without a duration the last line still gets a positive span', () => {
  const c = cuesOf([{ t: 5, text: 'x' }]);
  assert.ok(c[0].end > 5);
});

test('indexAt: the last item at or before t', () => {
  const a = [{ t: 0 }, { t: 2 }, { t: 5 }];
  assert.equal(indexAt(a, -1), -1); assert.equal(indexAt(a, 0), 0); assert.equal(indexAt(a, 4.9), 1); assert.equal(indexAt(a, 99), 2); assert.equal(indexAt([], 1), -1);
});

test('timeAtChar: a click inside a word jumps to that word, not the line start', () => {
  const [, c] = cuesOf(lines, 30);
  assert.equal(timeAtChar(c, 0), 10);
  assert.equal(timeAtChar(c, 8), c.words[1].t);  // inside 'line'
  assert.ok(timeAtChar(c, 8) > 10);
  assert.equal(timeAtChar(c, 999), c.words[2].t);
});

test('laneLayout: words keep their moment, stack into rows, and never overlap on a row', () => {
  const ws = wordsOf(cuesOf([{ t: 0, text: 'one two three four five six seven eight' }], 4));
  const L = laneLayout(ws, 2, 4, 400, () => 60, 2, 4);
  L.forEach(x => assert.equal(Math.round(x.x), Math.round((x.word.t - 0) * 100)));
  for (const r of [0, 1]) { const row = L.filter(x => x.row === r); for (let i = 1; i < row.length; i++) assert.ok(row[i].x >= row[i - 1].x + row[i - 1].w + 4); }
  assert.ok(L.some(x => x.row === 1));
});
