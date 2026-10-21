import test from 'node:test';
import assert from 'node:assert/strict';
import { rolesOf } from './holodeck-offices.js';

// spans are placed by searching the text, the way the reading's name spans carry the canonical name.
const st = (text, names) => ({ text, spans: names.map(([surface, name]) => { const s = text.indexOf(surface); return { name: name || surface, s, e: s + surface.length }; }) });

test('role in brackets after a name, body is the nearest one named earlier', () => {
  const r = rolesOf(st('The owners are the Oceanic Steam Navigation Co. (Ltd.), usually known as the White Star Line, a British registered company, with a capital of £750,000, all paid up, the directors being Mr. J. Bruce Ismay (chairman), the Right Hon.',
    [['Oceanic Steam Navigation Co'], ['White Star Line'], ['J. Bruce Ismay']]));
  assert.equal(r.length, 1);
  assert.equal(r[0].role, 'chairman'); assert.equal(r[0].person, 'J. Bruce Ismay'); assert.equal(r[0].body, 'White Star Line');
  assert.equal(r[0].key, 'role|J. Bruce Ismay|white star line');
});
test('role after a comma with the body it is held at', () => {
  const t = "and J. Bruce Ismay, managing director of the White Star Line."; const r = rolesOf(st(t, [['J. Bruce Ismay'], ['White Star Line']]));
  assert.equal(r.length, 1); assert.equal(r[0].role, 'managing director'); assert.equal(r[0].key, 'role|J. Bruce Ismay|white star line');
  assert.equal(t.slice(0 + r[0].s, r[0].e).toLowerCase(), 'managing director');
});
test('role stated with "is"', () => {
  const r = rolesOf(st('Mr. Ismay is president and one of the founders of the International Mercantile Marine.', [['Ismay', 'J. Bruce Ismay'], ['International Mercantile Marine']]));
  assert.equal(r[0].role, 'president'); assert.equal(r[0].key, 'role|J. Bruce Ismay|international mercantile marine');
});
test('a name in a list with no role says nothing', () => {
  assert.deepEqual(rolesOf(st('including Major Archibald Butt, John Jacob Astor, J. Bruce Ismay, Geo.', [['Archibald Butt'], ['J. Bruce Ismay']])), []);
});

test('a role word later in the sentence is not the name\'s role', () => {
  const r = rolesOf(st('Lord Pirrie, have, since the year 1902, been held by the International Navigation Co. (Ltd.), the directors being Mr. J. Bruce Ismay (chairman).', [['Lord Pirrie'], ['International Navigation Co'], ['J. Bruce Ismay']]));
  assert.deepEqual(r.map(x => x.person), ['J. Bruce Ismay']);
  assert.equal(r[0].key, 'role|J. Bruce Ismay|international navigation');
});
