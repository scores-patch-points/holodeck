import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { normsFor, scanPunctuation, containersAt, sentenceAt, moodAt, cuesFromBlankLines, cuesFromLayout, cuesFromTimings, cuesFromBlocks } from './punctuation.js';
const ALL = JSON.parse(fs.readFileSync(new URL('./punctuation-norms.json', import.meta.url)));
const en = JSON.parse(fs.readFileSync(new URL('../vendor/khora/native/priors/punctuation-eng.json', import.meta.url))).abbreviations;
const scan = (t, lang, abbr = en) => scanPunctuation(t, { norms: normsFor(ALL, lang), abbreviations: new Set(abbr) });
const roles = (r) => r.punct.map((p) => p.w + ':' + p.role).join(' ');

test('every mark is kept, with a role, and word offsets still address the original text', () => {
  const t = 'Dr. Smith said, "We shall not give up Moscow!" Then he left.', r = scan(t, 'en');
  for (const k of r.tokens) assert.equal(t.slice(k.s, k.e), k.w);
  assert.ok(r.punct.length >= 5 && r.punct.every((p) => p.upos === 'PUNCT' && p.role));
});
test('"Dr." is an abbreviation by the language\'s measured prior, so the dot is part of the word and does not end the sentence', () => {
  const r = scan('Dr. Smith arrived. Mr. Jones left.', 'en');
  assert.deepEqual(r.words.map((w) => w.w), ['Dr.', 'Smith', 'arrived', 'Mr.', 'Jones', 'left']);
  assert.equal(r.structure.sentences.length, 2); assert.equal(r.structure.sentences[0].terminator, '.');
  const none = scan('Dr. Smith arrived.', 'en', []);                     // no prior: the reader says what it does not know
  assert.equal(none.structure.sentences.length, 2, 'without the prior the dot ends a sentence — the norm says so, not a guess');
});
test('initials, dotted initialisms, decimals and ellipsis', () => {
  const r = scan('J. R. Smith of the U.S. paid 3.5 million... then left.', 'en', []);
  assert.deepEqual(r.words.map((w) => w.w), ['J.', 'R.', 'Smith', 'of', 'the', 'U.S.', 'paid', '3.5', 'million', 'then', 'left']);
  assert.ok(r.punct.some((p) => p.role === 'ellipsis'));
});
test('mood: a question asks, an exclamation exclaims, no terminator is a fragment; a quoted question inside a statement keeps its own mood', () => {
  const r = scan('Did Israel strike first? It did! "Why?" he asked. Section 4', 'en');
  assert.deepEqual(r.structure.sentences.map((s) => s.mood), ['interrogative', 'exclamative', 'declarative', 'fragment']);
  const q = r.structure.containers.find((c) => c.kind === 'quote'); assert.equal(q.mood, 'interrogative');
  assert.equal(moodAt(r.structure, q.s + 2), 'interrogative'); assert.equal(moodAt(r.structure, 5), 'interrogative');
});
test('containers nest to any depth and know where a proposition at an offset sits', () => {
  const t = 'He said, “She told me (quietly) that ‘we leave’ at dawn.”', r = scan(t, 'en'); const at = t.indexOf('we leave');
  const chain = containersAt(r.structure, at); assert.deepEqual(chain.map((c) => c.mark), ['“”', '‘’']);
  assert.equal(containersAt(r.structure, t.indexOf('quietly')).map((c) => c.mark).join(' '), '“” ()');
});
test('German: „…“ pairs, "3." is an ordinal before a lowercase word, the comma is a decimal', () => {
  const r = scan('Er sagte: „Wir gehen“. Am 3. mal kostete es 3,5 Euro.', 'de', []);
  assert.ok(r.structure.containers.some((c) => c.mark === '„“')); assert.ok(r.words.some((w) => w.w === '3.' && w.attached === 'ordinal')); assert.ok(r.words.some((w) => w.w === '3,5'));
});
test('French « … » and Spanish ¿…? and ¡…!', () => {
  const f = scan('Il dit : « Nous partons ! » Puis il partit.', 'fr', []); assert.ok(f.structure.containers.some((c) => c.mark === '«»'));
  const e = scan('¿Quién llegó primero? ¡Nadie lo sabe!', 'es', []); assert.deepEqual(e.structure.sentences.map((s) => s.mood), ['interrogative', 'exclamative']);
  assert.ok(e.punct.some((p) => p.role === 'open-question'));
});
test('CJK, Arabic and Devanagari marks are marks by their own norms, not English ones', () => {
  const z = scan('他说：「我们走。」你呢？', 'zh', []); assert.ok(z.structure.containers.some((c) => c.mark === '「」')); assert.deepEqual(z.structure.sentences.map((s) => s.mood).slice(-1), ['interrogative']);
  const a = scan('هل ذهب أحمد؟ نعم، ذهب.', 'ar', []); assert.deepEqual(a.structure.sentences.map((s) => s.mood), ['interrogative', 'declarative']); assert.ok(a.punct.some((p) => p.w === '،' && p.role === 'separator'));
  const h = scan('वह गया। क्या तुम आओगे?', 'hi', []); assert.equal(h.structure.sentences.length, 2); assert.equal(h.words[0].w, 'वह');
});
test('a language with no norms is read with the default and the structure says so; an unclosed mark is a typed gap, not a guessed container', () => {
  const r = scan('She said “we leave and then', 'xx', []); assert.equal(r.structure.notes.normsKnown, false); assert.equal(r.structure.notes.unclosed.length, 1); assert.equal(r.structure.containers.length, 0);
});
test('other modalities supply the same boundaries: blank lines, an OCR layout, markup blocks, a transcript\'s pauses', () => {
  const t = 'First part\n\nSecond part\nthird line', c = cuesFromBlankLines(t); assert.deepEqual(c.map((x) => x.kind), ['paragraph', 'line']);
  const layout = { pages: [{ lines: [{ s: 0, e: 10, b: [0, 0, 100, 10] }, { s: 12, e: 30, b: [0, 40, 100, 50] }] }] }; assert.ok(cuesFromLayout(layout, t).some((x) => x.kind === 'paragraph' && x.source === 'ocr-layout'));
  const tm = cuesFromTimings([{ start: 0, end: 1, text: 'hello there' }, { start: 1.1, end: 2, text: 'how are you' }, { start: 3.2, end: 4, text: 'fine' }], 'hello there how are you fine'); assert.deepEqual(tm.map((x) => x.kind), ['sentence']);
  assert.equal(cuesFromBlocks([{ at: 0 }, { at: 9, kind: 'cell' }]).length, 2);
  const r = scanPunctuation('One. Two.', { norms: normsFor(ALL, 'en'), cues: [{ at: 4, kind: 'pause', strength: 4, source: 'prosody' }] }); assert.ok(r.structure.boundaries.some((b) => b.source === 'prosody'));
});
