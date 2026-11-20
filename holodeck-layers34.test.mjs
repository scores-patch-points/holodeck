// holodeck-layers34.test.mjs — the switches are OFF by default, and with both off nothing of layers 3 and 4 reaches the page.
//   node --test holodeck-layers34.test.mjs
import { test } from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { layerSwitches, attendedOf, attachAttended, boundNames, BINDER_DIALS } from './holodeck-layers34.js';
const none = { getItem: () => null };
test('both switches are off unless asked', () => {
  assert.deepEqual(layerSwitches({ search: '' }, none), { castIdentity: false, binder: false, shuffle: null });
  assert.deepEqual(layerSwitches({ search: '?castIdentity=0&binder=0' }, none), { castIdentity: false, binder: false, shuffle: null });
  assert.deepEqual(layerSwitches({ search: '?castIdentity=1&binder=1&binderShuffle=7' }, none), { castIdentity: true, binder: true, shuffle: 7 });
  assert.equal(layerSwitches({ search: '' }, { getItem: (k) => (k === 'hd:binder' ? '1' : null) }).binder, true);
});
test('the binder answers null when it is not asked', () => { assert.equal(attendedOf({ sentences: [], cast: [] }, false), null); assert.equal(attendedOf({ sentences: [], cast: [] }, undefined), null); });
test('a binding names a referent; a typed gap stays a gap and names nothing', () => {
  const eng = { attended: { bindings: [{ at: [10, 12], kind: 'pronoun', referent: 'Eiffel Tower', margin: 0.5 }], gaps: [{ at: [30, 33], reason: 'pronoun_no_margin', surface: 'It' }] } };
  const a = { s: 0, e: 20 }, b = { s: 25, e: 60 };
  attachAttended(a, eng, (x) => x); attachAttended(b, eng, (x) => x);
  assert.deepEqual(boundNames(a), ['Eiffel Tower']); assert.equal(a.attendedGaps, undefined);
  assert.deepEqual(boundNames(b), []); assert.equal(b.attendedGaps[0].reason, 'pronoun_no_margin'); assert.equal(b.attended, undefined);
});
test('a reading without the binder leaves a statement untouched', () => { const st = { s: 0, e: 9 }; attachAttended(st, { referents: [] }, (x) => x); assert.deepEqual(Object.keys(st), ['s', 'e']); });
test('the control permutes referents among the bindings and keeps count and places', () => {
  const att = { bindings: ['A', 'B', 'C', 'D', 'E', 'F'].map((r, i) => ({ at: [i * 10, i * 10 + 2], referent: r })), gaps: [] };
  const sts = att.bindings.map((b) => ({ s: b.at[0], e: b.at[0] + 5 })); sts.forEach((st) => attachAttended(st, { attended: att }, (x) => x, { shuffle: 3 }));
  const got = sts.map((s) => s.attended[0].name); assert.deepEqual([...got].sort(), ['A', 'B', 'C', 'D', 'E', 'F']); assert.notDeepEqual(got, ['A', 'B', 'C', 'D', 'E', 'F']);
});
test('the dials are the binder scorer\'s declared ones, and no word list is written in the file', () => {
  assert.equal(BINDER_DIALS.minMargin, 0.2); const src = fs.readFileSync(new URL('./holodeck-layers34.js', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/\[\s*['"](it|its|the|this|tower)['"]/.test(src));
});
test('index.html: the page code of the layers runs only behind the switches', () => {
  const src = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  assert.match(src, /\.\.\.\(HD_L34\.castIdentity \? \{ castIdentity: true \} : \{\}\)/); assert.match(src, /\.\.\.\(HD_L34\.binder \? \{ binder: true \} : \{\}\)/);
  assert.match(src, /if \(HD_L34\.binder && _hdL34 && d\.hasCase\) _hdL34\.attachAttended/);
  assert.match(src, /window\.__hdL34Ready = \(HD_L34\.binder \? import\(/, 'the module is imported only with the binder on');
  const w = fs.readFileSync(new URL('./master-reading-worker.js', import.meta.url), 'utf8'); assert.match(w, /binder \? \(await layers\(\)\)/);
});
