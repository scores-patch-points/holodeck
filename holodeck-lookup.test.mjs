import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeLookup } from './holodeck-lookup.js';
import { compositionAffordance, licenseStanding } from './vendor/eoreader7/native/kernel/hyperlexicon.js';

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
