// holodeck-tables.test.mjs — A TABLE'S OWN FIGURES: the column's own header word is the MEASURE.
//   node --test holodeck-tables.test.mjs
//
// The British report's own "Numbers saved" table states 2201 aboard AND 711 saved in one row — the two figures one
// prose sentence fuses. The reader binds each cell to the column it stands under, so each is a figure of its
// column's measure. The embarrassments and controls are docs/SOURCE-CONTRADICTION-PREREG.md's (R3); the same
// measurement must catch a deliberately wrong implementation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const a = src.indexOf('function tableRowsToFigures(');
const b = src.indexOf('\nfunction tableFiguresOf(');
assert.ok(a > 0 && b > a, 'tableRowsToFigures is findable in index.html');
const { tableRowsToFigures } = await import('data:text/javascript,' + encodeURIComponent(src.slice(a, b) + '\nexport { tableRowsToFigures };'));

// the British report's own table, header included — the shape the page's DOM walk yields (one array per row).
const BRITISH = [
  ['section', 'group', 'aboard', 'saved', 'percent_saved'],
  ['First class', 'Adult males', '175', '57', '32.57'],
  ['First class', 'Adult females', '144', '140', '97.22'],
  ['Second class', 'Total passengers', '285', '118', '41.40'],
  ['Crew', 'Total', '885', '212', '23.95'],
  ['Passengers and crew', 'Total on board saved', '2201', '711', '32.30'],
];

test('a row labelled "total" is the shared figure-slot; a subgroup is never emitted', () => {
  const figs = tableRowsToFigures(BRITISH);
  // the grand total row, one figure per count column, under the column's own header word.
  const aboard = figs.find((f) => f.measure === 'aboard');
  const saved = figs.find((f) => f.measure === 'saved');
  assert.equal(aboard.value, 2201, 'the largest total in the aboard column is the shared figure');
  assert.equal(saved.value, 711, 'the largest total in the saved column is the shared figure');
  // the subgroup rows (175 aboard, 57 saved; 144/140 …) are partials — a different referent, never emitted.
  assert.ok(!figs.some((f) => f.value === 175 || f.value === 57), 'a subgroup partial is not a figure of the total');
  // a rate column is not a count of lives.
  assert.ok(!figs.some((f) => f.measure === 'percent_saved'), 'a rate is not a measure of lives');
});

test('a table with no total row states no shared figure-slot (a named gap, never a guess)', () => {
  const figs = tableRowsToFigures([
    ['section', 'group', 'aboard', 'saved'],
    ['First class', 'Adult males', '175', '57'],
    ['First class', 'Adult females', '144', '140'],
  ]);
  assert.deepEqual(figs, [], 'no total row ⇒ no shared slot');
});

test('the same measurement catches the wrong reader: every number folded by its own row, never by its column', () => {
  // CONTROL (what the naive reader does): every numeric cell is a figure, so 175 and 2201 both read as ABOARD and
  // the grand total is indistinguishable from a subgroup. The measurement — "the shared slot is the largest total"
  // — must fail on that reader, which is what makes this one falsifiable.
  const naive = [];
  for (let r = 1; r < BRITISH.length; r++) for (let c = 1; c < BRITISH[r].length; c++) {
    const n = +BRITISH[r][c].replace(/,/g, ''); if (Number.isFinite(n)) naive.push({ measure: BRITISH[0][c], value: n });
  }
  const naiveAboard = naive.filter((f) => f.measure === 'aboard').map((f) => f.value);
  assert.ok(naiveAboard.includes(175) && naiveAboard.includes(2201), 'the naive reader folds the subgroup in');
  const figs = tableRowsToFigures(BRITISH);
  const aboard = figs.find((f) => f.measure === 'aboard');
  assert.equal(aboard.value, 2201);
  assert.ok(!figs.some((f) => f.value === 175), 'the reader under test does not');
});

test('a "total" spelled in any cell labels the row a total (the word is the table\'s own)', () => {
  const figs = tableRowsToFigures([
    ['section', 'group', 'aboard'],
    ['Crew', 'Total', '885'],
    ['Passengers and crew', 'Total on board', '2201'],
  ]);
  assert.equal(figs.find((f) => f.measure === 'aboard').value, 2201, 'the grand total leads the subtotal');
});
