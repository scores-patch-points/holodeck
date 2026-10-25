// lexicon.test.mjs — the hyperlexicon client: asked once per form, aliases read from the giver, and the text's own guard.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeLexicon, aliasJunctions, aliasTokens, resolveAliases } from './lexicon.js';

// a stub giver shaped like the server's answer: "Messrs." and "in." are listed as forms of other words, "night." is not listed
const PACK = {
  'Messrs.': [{ w: 'Messrs.', pos: 'noun', senses: [{ of: 'Mr.', tags: ['formal'], gloss: null }] }],
  'in.': [{ w: 'in.', pos: 'noun', senses: [{ of: 'inch', tags: [], gloss: null }] }],
  'Co.': [{ w: 'Co.', pos: 'noun', senses: [{ of: 'company', tags: [], gloss: null }, { of: 'county', tags: [], gloss: null }] }],
  abaft: [{ w: 'abaft', pos: 'adv', senses: [{ of: null, tags: [], gloss: 'toward the stern' }] }],
};
function stub() {
  const calls = [];
  const ask = async (forms) => { calls.push([...forms]); return { giver: { name: 'stub' }, results: Object.fromEntries(forms.map((f) => [f, PACK[f] ?? null])) }; };
  return { lexicon: makeLexicon({ ask }), calls };
}

test('makeLexicon asks once per form, caches a miss as null, and never asks again', async () => {
  const { lexicon, calls } = stub();
  await lexicon.want(['Messrs.', 'night.', 'Messrs.']);
  await lexicon.want(['Messrs.', 'night.', 'abaft']);
  assert.deepEqual(calls, [['Messrs.', 'night.'], ['abaft']]);
  assert.equal(lexicon.get('night.'), null);
  assert.equal(lexicon.get('never asked'), undefined);
  assert.deepEqual(lexicon.aliasOf('Messrs.'), ['Mr.']);
  assert.deepEqual(lexicon.aliasOf('abaft'), [], 'a sense with a gloss and no "of" is not an alias');
  assert.equal(lexicon.giver.name, 'stub');
});

test('makeLexicon with no giver answering records a gap and caches nothing', async () => {
  const lexicon = makeLexicon({ ask: async () => null });
  await lexicon.want(['Messrs.']);
  assert.equal(lexicon.get('Messrs.'), undefined);
  assert.equal(lexicon.log.at(-1).gap, 'no local lexicon answered');
});

test('aliasJunctions finds dotted tokens before a capital that the priors do not know, counted', () => {
  const t = 'Built by Messrs. Harland and by Messrs. Ward. He came in. Mr. Smith left. Grand Co. Ltd. was named. The end.';
  const j = aliasJunctions(t, new Set(['mr']));
  assert.equal(j.get('Messrs.'), 2);
  assert.equal(j.get('in.'), 1);
  assert.equal(j.get('Ward.'), 1);
  assert.equal(j.has('Mr.'), false, 'a token the priors know is not asked about');
  assert.equal(j.has('end.'), false, 'nothing follows: no junction');
  assert.equal(j.get('Co.'), 1);
});

test('resolveAliases keeps a listed alias only where the text never writes the token without its period', async () => {
  const { lexicon } = stub();
  const t = 'It was built by Messrs. Harland. He walked in. The door shut. Messrs. Ward agreed. It came in the night.';
  const j = aliasJunctions(t, new Set());
  await lexicon.want(j.keys());
  const rows = Object.fromEntries(resolveAliases(lexicon, j, t).map((r) => [r.form, r]));
  assert.equal(rows['Messrs.'].kept, true);
  assert.deepEqual(rows['Messrs.'].of, ['Mr.']);
  assert.equal(rows['Messrs.'].n, 2);
  assert.equal(rows['in.'].kept, false, '"in" stands without its period elsewhere in this text, so "in." may end a sentence');
  assert.match(rows['in.'].why, /without its period/);
  assert.equal(rows['Harland.'], undefined, 'a form the giver does not list is not an alias');
});

test('aliasTokens maps tokens without the period to what they are forms of', async () => {
  const { lexicon } = stub();
  await lexicon.want(['Co.', 'night.']);
  assert.deepEqual([...aliasTokens(lexicon, ['Co.', 'night.'])], [['Co', ['company', 'county']]]);
});
