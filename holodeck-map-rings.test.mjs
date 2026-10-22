import test from 'node:test';
import assert from 'node:assert/strict';
import { ringBins } from './holodeck-map.js';

const cover = (bins, max) => { for (let d = 1; d <= max; d++) assert.equal(bins.filter(b => d >= b.lo && d <= b.hi).length, 1, 'strength ' + d + ' falls in exactly one ring'); };

test('rings halve from the strongest tie and cover every strength once', () => {
  assert.deepEqual(ringBins(14), [{ lo: 8, hi: 14 }, { lo: 4, hi: 7 }, { lo: 1, hi: 3 }]);
  for (const m of [1, 2, 3, 5, 9, 14, 40, 200]) { const b = ringBins(m); cover(b, m); assert.ok(b.length >= 1 && b.length <= 3); assert.equal(b[b.length - 1].lo, 1); assert.equal(b[0].hi, m); }
});

test('a single strength gives a single ring', () => { assert.deepEqual(ringBins(1), [{ lo: 1, hi: 1 }]); });

test('rings are ordered strongest first and never overlap', () => {
  const b = ringBins(37); for (let i = 1; i < b.length; i++) assert.equal(b[i].hi, b[i - 1].lo - 1);
});
