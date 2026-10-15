// holodeck-referent-kind.test.mjs — THE KIND IS FALSIFIABLE.
// The reader types a referent from the corpus alone, and the corpus mistypes (a ship reads as a
// person). The Wikipedia anchor's own lead names the class — "RMS Titanic was a British passenger
// liner" — and the surface's kind is that EARNED head noun, or the reading's type when no anchor
// answers. The head noun is the lead's, never the first class word: "a British passenger liner"
// is a liner, not a passenger. The falsifier: a kind whose word is not the lead's own head noun.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const a = src.indexOf('const KIND_CLASS = {'), b = src.indexOf('// Universal Dependencies parts of speech');
assert.ok(a > 0 && b > a, 'the kind slice is findable');
const { anchorKindOf } = vm.runInNewContext(src.slice(a, b) + '\n;({ anchorKindOf })', {});

test('a ship cannot read as a person: the lead earns its own kind', () => {
  assert.deepEqual({ ...anchorKindOf('RMS Titanic was a British passenger liner that sank in the North Atlantic Ocean in 1912.') }, { type: null, word: 'liner' });
  assert.deepEqual({ ...anchorKindOf('J. Bruce Ismay was a British businessman who was chairman of the White Star Line.') }, { type: 'person', word: 'businessman' });
});

test('organisation and place earn theirs; a plural head is singularised', () => {
  assert.deepEqual({ ...anchorKindOf('The White Star Line was a British shipping company founded in 1845.', { isStop: w => w === 'founded' }) }, { type: 'organisation', word: 'company' });
  assert.deepEqual({ ...anchorKindOf('Cherbourg is a city in Normandy, France.') }, { type: 'place', word: 'city' });
  assert.deepEqual({ ...anchorKindOf('The Titanic was one of the largest ships of her day.') }, { type: null, word: 'ship' });
});

test('with the POS prior the head is the last noun before the clause turns; no copula → no claim', () => {
  const isNoun = w => ['film', 'liner'].includes(w);
  const isStop = w => w === 'directed';
  assert.deepEqual({ ...anchorKindOf('Titanic is a 1997 American epic romantic disaster film directed by James Cameron.', { isNoun, isStop }) }, { type: null, word: 'film' });
  assert.equal(anchorKindOf(''), null);
  assert.equal(anchorKindOf('No copular clause here.'), null);
});
