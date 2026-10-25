import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeLookup } from './holodeck-lookup.js';
import { compositionAffordance, licenseStanding } from './vendor/khora/native/kernel/hyperlexicon.js';

const WIKT = { en: [{ partOfSpeech: 'Adverb', language: 'English', definitions: [{ definition: 'Under this.' }] }] };
const WIKI = { type: 'standard', title: 'Andrew Johnson', wikibase_item: 'Q8612', pageid: 1624, revision: '1', timestamp: 't', description: 'President', extract: 'x', content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Andrew_Johnson' } } };
const WD = { search: [{ id: 'Q8612', label: 'Andrew Johnson', description: 'President' }, { id: 'Q47182862', label: 'Andrew Johnson', description: 'American rower' }] };

function fakeFetch(calls) {
  return async (url) => {
    calls.push(String(url));
    const ok = (j) => ({ status: 200, json: async () => j });
    if (/wiktionary\.org.*\/hereunder$/.test(url)) return ok(WIKT);
    if (/wiktionary\.org/.test(url)) return { status: 404, json: async () => ({}) };
    if (/wikipedia\.org.*Andrew_Johnson/.test(url)) return ok(WIKI);
    if (/wikipedia\.org/.test(url)) return { status: 404, json: async () => ({}) };
    if (/wikidata\.org/.test(url)) return ok(/Andrew/.test(url) ? WD : { search: [] });
    return { status: 500, json: async () => ({}) };
  };
}

test('a lookup crosses to all three sources, is disclosed, cached, and nominated as candidates only', async () => {
  const calls = []; const L = makeLookup({ fetchImpl: fakeFetch(calls), now: () => '2026-10-19T12:00:00Z' });
  const r = await L.look('Andrew Johnson');
  assert.equal(r.wikipedia.qid, 'Q8612'); assert.equal(r.wikidata.candidates.length, 2); assert.equal(r.wikidata.exact, 2);
  assert.equal(L.log.length, 4, 'dictionary as written, dictionary lower-cased, wikipedia, wikidata — every one disclosed'); assert.ok(L.log.every((e) => e.at === '2026-10-19T12:00:00Z' && e.status != null));
  assert.equal(L.log.some((e) => e.url.includes('origin=*') && /wikidata/.test(e.url)), true);
  const aff = compositionAffordance(L.hyperlexicon(), 'form:andrew johnson', 'entity:Q47182862');
  assert.equal(aff.standing, 'candidate'); assert.equal(licenseStanding(aff).licensed, false);
  await L.look('Andrew Johnson'); assert.equal(calls.length, 4);
});

test('asking twice costs nothing, and a source not yet asked can be added later', async () => {
  const calls = []; const L = makeLookup({ fetchImpl: fakeFetch(calls) });
  await L.look('hereunder', { only: ['dictionary'] });
  const n = calls.length; await L.look('hereunder', { only: ['dictionary'] }); assert.equal(calls.length, n);
  await L.look('hereunder', { only: ['dictionary', 'wikidata'] }); assert.equal(calls.length, n + 1);
  assert.deepEqual(L.get('hereunder').dictionary.upos, ['ADV']);
});

test('a miss and a failure are results, never exceptions', async () => {
  const L = makeLookup({ fetchImpl: async (u) => { if (/wikidata/.test(u)) throw new Error('offline'); return { status: 404, json: async () => ({}) }; } });
  const r = await L.look('Zzxqy');
  assert.equal(r.dictionary.found, false); assert.equal(r.wikipedia.found, false); assert.equal(r.wikidata.found, false);
  assert.ok(L.log.some((e) => e.error === 'offline'));
});

test('a capitalised form is tried as written, then lower-cased, at the dictionary', async () => {
  const calls = []; const L = makeLookup({ fetchImpl: fakeFetch(calls) });
  await L.look('Hereunder', { only: ['dictionary'] });
  assert.equal(calls.length, 2); assert.match(calls[0], /Hereunder$/); assert.match(calls[1], /hereunder$/);
  assert.equal(L.get('Hereunder').dictionary.found, true);
});

test('nothing is requested for a source that is switched off', async () => {
  const calls = []; const L = makeLookup({ fetchImpl: fakeFetch(calls), sources: ['dictionary'] });
  await L.look('Andrew Johnson'); assert.ok(calls.every((u) => /wiktionary/.test(u)));
});

test('with the hyperlexicon handed in, the dictionary is the ledger: the givers\' candidates for the word, with its uses, and no network', async () => {
  const calls = [];
  const contexts = { ports: { uses: 2, documents: 2, dated: { uses: 2, earliest: 1912, latest: 1997, documents: 2 }, candidates: [{ kind: 'lemma', lang: 'en', node: 'n_p', givers: ['wiktionary-en'], pos: ['noun'], of: [], gloss: ['a harbour'] }], candidatesTotal: 1 }, qqq: { uses: 0, null: 'never-set', gap: 'unheard' } };
  const local = { giver: { name: 'janus hyperlexicon', head: 'h3' }, context: async (words) => new Map(words.map((w) => [w, contexts[w]])) };
  const L = makeLookup({ fetchImpl: async (u) => { calls.push(u); return { status: 404, json: async () => ({}) }; }, local });
  const r = await L.look('ports', { only: ['dictionary'], network: false });
  assert.equal(r.dictionary.found, true);
  assert.deepEqual(r.dictionary.upos, ['NOUN']);
  assert.equal(r.dictionary.context.dated.earliest, 1912);
  assert.match(r.rows.find((x) => x.source === 'dictionary').via, /janus hyperlexicon \(head h3\)/);
  const q = await L.look('qqq', { only: ['dictionary'], network: false });
  assert.equal(q.dictionary.found, false, 'a word the log never heard: no candidates, a result, not a guess');
  assert.equal(calls.length, 0, 'nothing left the machine');
  assert.equal(L.log.at(-1).url, 'hyperlexicon:h3#qqq');
  // the ledger folds case: "Polish" is read as the givers write it, "polish" as every candidate of the type
  contexts.Polish = contexts.polish = contexts.POLISH = { uses: 9, documents: 3, dated: { uses: 0 }, candidates: [{ kind: 'lemma', lang: 'en', node: 'n_a', lemma: 'Polish', pos: ['adj'], of: [], gloss: ['of Poland'] }, { kind: 'lemma', lang: 'en', node: 'n_b', lemma: 'polish', pos: ['verb'], of: [], gloss: ['to make smooth'] }], candidatesTotal: 2 };
  assert.deepEqual((await L.look('Polish', { only: ['dictionary'], network: false })).dictionary.upos, ['ADJ']);
  const L2 = makeLookup({ fetchImpl: async (u) => { calls.push(u); return { status: 404, json: async () => ({}) }; }, local });   // the lookup's own cache key folds case
  assert.deepEqual((await L2.look('polish', { only: ['dictionary'], network: false })).dictionary.upos, ['VERB'], 'as written: the headword "polish" answers alone');
  const L3 = makeLookup({ fetchImpl: async () => ({ status: 404, json: async () => ({}) }), local });
  assert.deepEqual((await L3.look('POLISH', { only: ['dictionary'], network: false })).dictionary.upos, ['ADJ', 'VERB'], 'no headword is written "POLISH", so every candidate of the type answers');
});
