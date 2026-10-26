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

// THE ISTHMUS (khora native/docs/THE-ISTHMUS.md): the material chooses the codec. A read the page did not declare a language
// for is HEARD or the core's disclosed DEFAULT, never "declared" English on the document's behalf (it was: `foreign?.iso3 || 'eng'`
// was passed as the declared language on every master read, so a Spanish source was read with English priors and labelled
// declared).
const ES = 'El Banco Central subió las tasas en marzo. Las tasas más altas encarecieron el crédito para las pequeñas empresas. ' +
  'En 1850 los señores Smith y Jones apoyaron al Banco Central, y las pequeñas empresas pagaron más. ' +
  'El gobierno anunció nuevas medidas para la economía del país durante el año siguiente.';

test('Isthmus: an undeclared read is never labelled declared', async () => {
  const { readDocument } = await import('./holodeck-reader.js');
  const W = await readDocument(T + ' ' + T, { quality: false, selfRead: false, lexicon: null });
  assert.notEqual(W.language.source, 'declared', 'FALSIFIER: the page declared English for a document nobody declared');
  assert.equal(W.language.declared, null);
  if (W.language.source === 'default') assert.ok(W.gaps.some((g) => g.gap === 'language_default'), 'a default is disclosed as a typed gap');
});

test('Isthmus: an undeclared Spanish read is heard or defaulted, and its priors are the stem it reports', async () => {
  const { readDocument } = await import('./holodeck-reader.js');
  const W = await readDocument(ES, { quality: false, selfRead: false, lexicon: null });
  assert.notEqual(W.language.source, 'declared');
  if (W.language.source === 'heard') assert.equal(W.language.stem, 'spa');
});

test('Isthmus: a declared language stays declared', async () => {
  const { readDocument } = await import('./holodeck-reader.js');
  const W = await readDocument(ES, { foreign: { iso3: 'spa' }, quality: false, selfRead: false, lexicon: null });
  assert.equal(W.language.source, 'declared');
  assert.equal(W.language.stem, 'spa');
});

test('Isthmus: the English stance passes do not run on a declared non-English read', async () => {
  const { pageReaderOptions } = await import('./holodeck-reader.js');
  const es = await pageReaderOptions({ foreign: { iso3: 'spa' } });
  const en = await pageReaderOptions({});
  assert.equal(es.sameAct, null, 'FALSIFIER: English stance classes widened a Spanish read');
  assert.equal(es.extendRelations, null, 'FALSIFIER: English copula-stance triples added to a Spanish read');
  assert.equal(typeof en.extendRelations, 'function');
});
