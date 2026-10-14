import test from 'node:test';
import assert from 'node:assert/strict';
import { planPage } from './holodeck-layout.js';

const page = lines => ({ n: 1, w: 612, h: 792, lines });
test('empty page plans to nothing', () => {
  assert.equal(planPage(page([]), 760).empty, true);
});
test('margins are cropped and text fills the column', () => {
  const p = planPage(page([[100, 100, 400, 12, 'Hello world'], [100, 120, 400, 12, 'Second line']]), 760);
  assert.equal(p.spans[0].x, 14);                       // left margin gone: starts at the pad
  assert.ok(p.spans.every(s => s.x + s.w <= 760));
});
test('type size is clamped, however big or small the scan', () => {
  const tiny = planPage(page([[10, 10, 50, 3, 'tiny'], [10, 20, 50, 3, 'tiny two']]), 760);
  const huge = planPage(page([[0, 0, 600, 90, 'HUGE'], [0, 120, 600, 90, 'HUGE too']]), 760);
  for (const s of [...tiny.spans, ...huge.spans]) assert.ok(s.fs >= 11 && s.fs <= 24, 'fs ' + s.fs);
});
test('big empty gaps are capped; paragraph breaks survive', () => {
  const p = planPage(page([[50, 50, 400, 12, 'top'], [50, 700, 400, 12, 'bottom']]), 760);
  const dy = p.spans[1].y - p.spans[0].y;
  assert.ok(dy > 15 && dy < 60, 'dy ' + dy);            // not 650pt of white
});
test('columns that share a row keep sharing it', () => {
  const p = planPage(page([[50, 100, 100, 12, 'Name:'], [300, 101, 120, 12, 'ACME'], [50, 140, 100, 12, 'Date:']]), 760);
  assert.equal(p.spans[0].y, p.spans[1].y);
  assert.ok(p.spans[2].y > p.spans[0].y);
});
