import test from 'node:test'; import assert from 'node:assert/strict';
import { setPage } from './layout-rules.js';
const w = (t, x0, y0, x1, y1, c = 90) => ({ t, b: [x0, y0, x1, y1], c, s: x0, e: x1 });
test('words split across OCR lines join one row; collisions keep the surer word; marks are dropped', () => {
  const pg = { words: [w('Total', 10, 100, 50, 111), w('revenue', 60, 103, 120, 114), w('——', 130, 100, 140, 102), w('lines', 125, 101, 170, 112), w('lines', 130, 101, 175, 112, 50), w('noise', 200, 100, 240, 111, 20)], lines: [] };
  const { rows } = setPage(pg);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].set.map((s) => s.w.t), ['Total', 'revenue', 'lines']);
  assert.ok(rows[0].set.every((s, i, a) => i === 0 || s.x >= a[i - 1].x1), 'no overlaps');
});
test('row starts near a common edge snap to it', () => {
  const pg = { words: [w('a', 10, 100, 20, 110), w('b', 12, 130, 22, 140), w('c', 9, 160, 19, 170), w('d', 11, 190, 21, 200)], lines: [] };
  const xs = setPage(pg).rows.map((r) => r.set[0].x); assert.ok(Math.max(...xs) - Math.min(...xs) < 0.01);
});
