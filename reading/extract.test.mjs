// reading/extract.test.mjs — the extraction gate: parallel readings held, one collapsed, revisable.
// Falsifiable (II.10): a mangled extraction reads as unconfirmed, a clean one as confirmed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readsAsWords, sniffExtraction, extractReadings, READS_FLOOR } from './extract.js';

const P = new URL('../vendor/khora/native/priors/', import.meta.url);
const posRaw = JSON.parse(readFileSync(new URL('pos-eng.json', P), 'utf8'));
const morphRaw = JSON.parse(readFileSync(new URL('morphology-eng.json', P), 'utf8'));
const words = [...Object.keys(posRaw.forms), ...Object.keys(morphRaw.forms)];
const set = new Set(words.map(w => w.toLowerCase()));
const prior = { name: 'English vocabulary', giver: 'UD/Thrax + UniMorph', known: (w) => set.has(w), longest: Math.max(...words.map(w => w.length)) };

test('readsAsWords: prose reads high, a letterspaced title reads low', () => {
  assert.ok(readsAsWords('The Senate opposed the measure but the governor supported it.', prior).reads > 0.9);
  assert.ok(readsAsWords('F R O M   T H E   C R E A T O R S', prior).reads < 0.5);
});
test('sniff: prose is confirmed, a letterspaced page is unconfirmed', () => {
  assert.equal(sniffExtraction('The Senate opposed the measure.', { prior }).verdict, 'confirmed');
  assert.equal(sniffExtraction('F R O M   T H E   C R E A T O R S', { prior }).verdict, 'unconfirmed');
});
test('sniff: with no prior, the gate types a gap rather than judging (IV.3)', () => {
  assert.equal(sniffExtraction('F R O M   T H E', {}).verdict, 'gap');
});
test('the floor is declared and named on every reading (II.11)', () => {
  const s = sniffExtraction('The Senate opposed the measure.', { prior });
  assert.equal(s.floor, READS_FLOOR);
  assert.match(s.floorGiver, /extraction gate/);
});
test('gate: a confirmed first reading stops the chain — no converter is called', async () => {
  let converterRan = false;
  const E = await extractReadings({ prior, extractors: [
    { name: 'pdf.js', run: async () => 'The Senate opposed the measure but the governor supported it.' },
    { name: 'pdftotext', run: async () => { converterRan = true; return 'never'; } },
  ] });
  assert.equal(converterRan, false);
  assert.equal(E.held, 1);
  assert.equal(E.readings[E.collapsed].extractor, 'pdf.js');
});
test('gate: an unconfirmed first reading calls the converter; both readings are HELD; the better collapses', async () => {
  const E = await extractReadings({ prior, extractors: [
    { name: 'pdf.js', run: async () => 'T HE T HRO U GHLINE\nov e rs ight g ot b ypa ss ed' },
    { name: 'pdftotext (poppler)', run: async () => 'THE THROUGHLINE oversight got bypassed' },
  ] });
  assert.equal(E.held, 2);                                   // plural grounds stay parallel (III.4)
  assert.equal(E.readings.length, 2);
  assert.equal(E.readings[E.collapsed].extractor, 'pdftotext (poppler)');
  assert.equal(E.readings[0].sniff.verdict, 'unconfirmed');
  assert.ok(E.readings[1].sniff.reads > E.readings[0].sniff.reads);   // the collapse is by what reads as words
});
test('gate: a missing converter is held as a skipped reading, not fatal', async () => {
  const E = await extractReadings({ prior, extractors: [
    { name: 'pdf.js', run: async () => 'T HE T HRO U GHLINE' },
    { name: 'pdftotext', run: async () => null },
  ] });
  assert.equal(E.readings[1].ok, false);
  assert.match(E.readings[1].why, /not available/);
});
test('gate: an extractor that throws is held as a skipped reading, not fatal', async () => {
  const E = await extractReadings({ prior, extractors: [
    { name: 'broken', run: async () => { throw new Error('boom'); } },
    { name: 'pdftotext', run: async () => 'The Senate opposed the measure.' },
  ] });
  assert.equal(E.readings[0].ok, false);
  assert.match(E.readings[0].why, /boom/);
  assert.equal(E.readings[E.collapsed].extractor, 'pdftotext');
});
test('gate: with no prior it still runs, and records the gap', async () => {
  const E = await extractReadings({ extractors: [{ name: 'pdf.js', run: async () => 'T HE T HRO U GHLINE' }] });
  assert.match(E.gap, /no vocabulary prior/);
});
