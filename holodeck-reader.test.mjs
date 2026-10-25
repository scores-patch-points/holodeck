// holodeck-reader.test.mjs — the page's reader is khora's one core (read-core.mjs, vendored from a commit), with the page's own
// organs passed in. Falsifiers: the stance passes are the page's and switch off; the abbreviations reach the cut; the vendored
// tree matches the commit it records.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { makeEngineRelationReader, loadPriors } from './holodeck-reader.js';

const T = 'The Federal Reserve raised rates in March. Higher rates made credit expensive for small firms. The Federal Reserve is pro growth. In 1850 Messrs. Smith and Jones supported the Federal Reserve, and small firms paid more.';

test('the priors arrive through the core: the class prior with its lexicon, morphology, the attested verbs', async () => {
  const p = await loadPriors();
  assert.ok(p.posPrior?.forms && p.posPrior.lexicon, 'pos-eng with its class lexicon');
  assert.ok(p.lemmatizer && p.verbForms?.size > 1000);
});

test('the page’s abbreviations reach every cut the core makes', async () => {
  const bare = (await makeEngineRelationReader())([{ ref: 'c', text: T }]);
  const kept = (await makeEngineRelationReader({ abbreviations: new Set(['Messrs']) }))([{ ref: 'c', text: T }]);
  assert.ok(bare.sentences[0].some((s) => s.text === 'In 1850 Messrs.'), 'FALSIFIER: without them the cut falls after Messrs.');
  assert.ok(!kept.sentences[0].some((s) => s.text === 'In 1850 Messrs.'));
});

test('the stance passes are the page’s own organ, and the layer toggle removes them', async () => {
  const on = (await makeEngineRelationReader())([{ ref: 'c', text: T }]).edges.map((e) => e.label);
  const off = (await makeEngineRelationReader({ features: { stance: false } }))([{ ref: 'c', text: T }]).edges.map((e) => e.label);
  assert.ok(on.includes('is pro'), 'the copula stance the base reader cannot hear');
  assert.ok(!off.includes('is pro'));
});

test('the vendored khora matches the commit it records', () => {
  const out = execFileSync('node', ['tools/vendor-khora.mjs', '--check'], { cwd: new URL('.', import.meta.url).pathname, encoding: 'utf8' });
  assert.match(out, /all \d+ files match khora [0-9a-f]+/);
});
