import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { classifyForm, normalizeSurface, lookupForm } from './holodeck-surface.js';
import { createLemmatizer, morphologyFromPrior } from './vendor/eoreader7/native/adapters/text/morphology.js';

const posPrior = JSON.parse(fs.readFileSync(new URL('./vendor/eoreader7/native/priors/pos-eng.json', import.meta.url), 'utf8'));
const morph = morphologyFromPrior(JSON.parse(fs.readFileSync(new URL('./vendor/eoreader7/native/priors/morphology-eng.json', import.meta.url), 'utf8')));
const lemmatizer = createLemmatizer(morph.forms, { language: morph.language });

test('a curly apostrophe is a typing difference, not a gap', () => {
  const c = classifyForm('O’Connell', { posPrior });
  assert.equal(c.found, true);
  assert.deepEqual(c.via.map(v => v.step), ['apostrophe']);
});

test('the sentence’s own punctuation is not part of the form', () => {
  for (const w of ['Department.', 'Council,', '(Marie']) {
    const c = classifyForm(w, { posPrior });
    assert.equal(c.found, true, w);
    assert.deepEqual(c.via.map(v => v.step), ['edge-punctuation'], w);
  }
});

test('an exact entry is never second-guessed', () => {
  const c = classifyForm('the', { posPrior });
  assert.equal(c.found, true);
  assert.deepEqual(c.via, []);
});

test('an inflected form borrows its act’s class and says so', () => {
  const c = classifyForm('condemned', { posPrior, lemmatizer });
  assert.equal(c.found, true);
  assert.equal(c.inferred, true);
  assert.equal(c.act, 'condemn');
  assert.equal(c.via.at(-1).step, 'lemma');
});

test('a form the prior and the rule both lack stays a typed gap', () => {
  const c = classifyForm('Zzxqy.', { posPrior, lemmatizer });
  assert.equal(c.found, false);
  assert.deepEqual(c.via, []);
});

test('lookupForm hands a lemmatizer the same normalised form', () => {
  assert.equal(lookupForm('Department.'), 'Department');
  assert.equal(normalizeSurface('plain').steps.length, 0);
});
