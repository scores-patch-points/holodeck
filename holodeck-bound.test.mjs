// holodeck-bound.test.mjs — LAYER 1: the figure a statement binds to the question's own word. No lexicon, no unit list.
//   node --test holodeck-bound.test.mjs
//
// The embarrassment: asked "How long is the Cumberland River?", the Ask offered "18,000 square" and "1758 named". The article's own
// sentence binds the answer to the question's word: "The 688-mile-long (1,107 km) river drains almost 18,000 square miles". A reader
// that knows no units can still see which number the text calls long.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const slice = (from, to) => { const a = src.indexOf(from), b = src.indexOf(to, a); assert.ok(a > 0 && b > a, from + ' is findable in index.html'); return src.slice(a, b); };
const code = slice('const qStem =', '\n') + '\n' + slice('const BIND_WORDS =', '\nfunction findDates(');
const { boundFigures, qStem } = await import('data:text/javascript,' + encodeURIComponent(code + '\nexport { boundFigures, qStem };'));
const ask = (text, q, names = []) => boundFigures(text, new Set(q.toLowerCase().split(/\s+/).map(qStem)), qStem, new Set(names));

const CUMBERLAND = 'The 688-mile-long (1,107 km) river drains almost 18,000 square miles (47,000 km2) of southern Kentucky and north-central Tennessee.';

test('the length is the number the sentence calls long, with its restatement kept', () => {
  const b = ask(CUMBERLAND, 'long', ['cumberland', 'river']);
  assert.deepEqual(b.map(x => x.raw), ['688-mile-long'], 'only the figure bound to "long"; the area is not');
});

test('a parenthetical restatement is stepped over: "330 metres (1,083 ft) tall"', () => {
  const b = ask('The tower is 330 metres (1,083 ft) tall, about the same height as an 81-storey building.', 'tall');
  assert.deepEqual(b.map(x => [x.value, x.raw]), [[330, '330 metres (1,083 ft) tall']]);
});

test('the word may stand before the number: "cost him 5 guineas"', () => {
  const b = ask('The horse cost him 5 guineas at the fair.', 'cost');
  assert.deepEqual(b.map(x => [x.value, x.side, x.raw]), [[5, 'before', 'cost him 5 guineas']]);
});

test('controls: no binding across a clause, another number, the name, or a wider window', () => {
  assert.equal(ask('The river is 688 miles. It is long and slow.', 'long').length, 0, 'a sentence end stops it');
  assert.equal(ask('In 1758 named by Thomas Walker, the river runs long.', 'long').length, 0, 'beyond the window');
  assert.equal(ask(CUMBERLAND, 'river', ['river']).length, 0, "the question's name words bind nothing");
  assert.equal(ask('Between 5 and 10 tall trees grow here.', 'tall').map(x => x.value).join(), '10', 'the nearer number binds, not one across it');
  assert.equal(ask('It is 330 metres tall.', 'cost').length, 0, 'a word the question did not use binds nothing');
  // found in the app (Cumberland, Eiffel): one occurrence of the word binds one number, and a citation marker binds nothing
  assert.deepEqual(ask('The lock is 15 m (49 ft) long and 6 m wide.', 'long').map(x => x.raw), ['15 m (49 ft) long'], '"long" is claimed once, by its own number');
  assert.equal(ask('The tower is very tall,[9] and white.', 'tall').length, 0, 'a citation marker after a comma is not a figure');
  // found in the app (Concorde): a number inside a name, or beside a date word, binds nothing; a function word is not carried as a unit
  assert.equal(ask('They began developing the RB.169 to power it.', 'developing').length, 0, 'a model number is not a figure');
  const months = new Set(['October']);
  assert.equal(boundFigures('retiring its fleet on 24 October 2003.', new Set(['fleet']), qStem, new Set(), new Set(), w => months.has(w)).length, 0, 'a day of a date is not a figure');
  const fw = new Set(['to', 'and']);
  assert.deepEqual(boundFigures('It would cost about £75 to £90 million.', new Set(['cost']), qStem, new Set(), fw).map(x => x.raw), ['cost about £75'], 'no "to" carried as a unit');
  // found in the app (Eiffel): a comma ends the forward search, and a year is not a figure
  assert.equal(ask('It was raised in 1957, increasing its height by 6 m.', 'height').map(x => x.raw).join(), 'height by 6 m', 'not "1957, increasing its height"');
  assert.deepEqual(boundFigures('Overruns brought costs to £1.5 billion.', new Set(['cost']), qStem, new Set(), fw).map(x => x.raw), ['costs to £1.5 billion'], 'the scale word is carried');
});

test('no unit word is written in the binding code', () => {
  const body = slice('const BIND_WORDS =', '\nfunction findDates(').replace(/^\s*\/\/.*$/gm, '');
  for (const w of ['mile', 'metre', 'meter', 'feet', 'foot', 'inch', 'yard', 'pound', 'ounce', 'ton', 'gallon', 'km', 'kg'])
    assert.ok(!new RegExp('\\b' + w).test(body), w + ' does not appear in boundFigures');
});

// ── LAYER 2: the usage substrate. The selections are read from the shipped record, never from code.
const l2 = slice('let USAGE = null,', "\n// ── A FIGURE BOUND TO THE QUESTION'S OWN WORD");
const { usageSelects, unitWordOf, bindableStems } = await import('data:text/javascript,' + encodeURIComponent(l2.replace(/^try \{ fetch.*$/m, '') + '\nexport { usageSelects, unitWordOf, bindableStems };'));
const U = JSON.parse(fs.readFileSync(new URL('./usage-substrate.json', import.meta.url), 'utf8'));

test('the substrate carries its provenance', () => {
  assert.equal(U.schema, 'UsageSubstrate@1'); assert.equal(U.prereg, 'SUBSTRATE-3');
  assert.match(U.head, /^[0-9a-f]{64}$/); assert.ok(U.selectionNull.includes('1e-5'));
});

test('a question word selects its dimension from use: long, length, cost, old', () => {
  const sel = q => [...usageSelects([q], U).keys()];
  for (const w of ['inches', 'feet', 'miles']) assert.ok(sel('long').includes(w), 'long selects ' + w);
  for (const w of ['inches', 'feet', 'miles']) assert.ok(sel('length').includes(w), 'length selects ' + w + ' (paraphrase, earned)');
  for (const w of ['shillings', 'pence', 'dollars']) assert.ok(sel('cost').includes(w), 'cost selects ' + w);
  assert.ok(sel('old').includes('years'));
  assert.ok(!sel('cost').includes('miles') && !sel('long').includes('shillings'), 'dimensions stay apart');
  assert.equal(usageSelects(['zzqx'], U).size, 0, 'an unheard word selects nothing');
  assert.equal(usageSelects(['long'], null).size, 0, 'no substrate loaded: nothing, never a guess');
});

test('a figure is counted in the last word of its own text', () => {
  assert.equal(unitWordOf({ raw: '688 miles' }), 'miles'); assert.equal(unitWordOf({ raw: '£90 million' }), 'million'); assert.equal(unitWordOf({ raw: '42' }), '');
});

test('no unit word is written in the layer 2 code', () => {
  const body = l2.replace(/^\s*\/\/.*$/gm, '').replace(/\/\/ .*$/gm, '');
  for (const w of ['mile', 'metre', 'feet', 'foot', 'inch', 'yard', 'pound', 'shilling', 'ounce', 'gallon', 'year', 'km'])
    assert.ok(!new RegExp('\\b' + w).test(body), w + ' does not appear in layer 2');
});

test('the gate: only a question word that takes measures in use may bind', () => {
  const g = bindableStems(qStem, U);
  for (const w of ['long', 'length', 'tall', 'height', 'cost', 'old', 'weighs']) assert.ok(g.has(qStem(w)), w + ' may bind');
  for (const w of ['fleet', 'developing', 'flying']) assert.ok(!g.has(qStem(w)), w + ' binds nothing');
  assert.equal(bindableStems(qStem, null), null, 'no substrate: no gate');
});
