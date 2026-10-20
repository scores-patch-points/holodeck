import test from 'node:test'; import assert from 'node:assert/strict';
import { tokensIn, wordsIn, punctIn, punctClass } from './tokenize.js';

const ws = (t, o) => wordsIn(t, 0, o).map((x) => x.w), ps = (t) => punctIn(t).map((x) => x.w + ':' + x.upos);
// offsets address the original text exactly
const exact = (t, base = 0) => { for (const k of tokensIn(t, base)) assert.equal(t.slice(k.s - base, k.e - base), k.w); };

test('punctuation after a word is its own token; the word is clean', () => {
  assert.deepEqual(ws('He left, then it ended.'), ['He', 'left', 'then', 'it', 'ended']);
  assert.deepEqual(ps('He left, then it ended.'), [',:PUNCT', '.:PUNCT']);
  exact('He left, then it ended.'); exact('He left, then it ended.', 40);
});
test('quotes, brackets, em-dash, ellipsis', () => {
  const t = '“Yes,” she said (quietly)—then… [gone]';
  assert.deepEqual(ws(t), ['Yes', 'she', 'said', 'quietly', 'then', 'gone']);
  assert.deepEqual(ps(t), ['“:PUNCT', ',:PUNCT', '”:PUNCT', '(:PUNCT', '):PUNCT', '—:PUNCT', '…:PUNCT', '[:PUNCT', ']:PUNCT']);
  exact(t);
});
test('currency and math are SYM by category; percent is PUNCT', () => {
  assert.deepEqual(ps('$5 + €3 = 8%'), ['$:SYM', '+:SYM', '€:SYM', '=:SYM', '%:PUNCT']);
  assert.deepEqual(ws('$5 + €3 = 8%'), ['5', '3', '8']);
  assert.equal(punctClass('a'), null);
});
test('internal apostrophe, hyphen and dot stay inside the word; edge ones do not', () => {
  assert.deepEqual(ws('don’t well-known 3.14 it\'s'), ['don’t', 'well-known', '3.14', 'it\'s']);
  assert.deepEqual(ws('-dash- \'quoted\' end.'), ['dash', 'quoted', 'end']);
});
test('abbreviations come from the splitter’s knowledge, not from POS', () => {
  assert.deepEqual(ws('Dr. Who and Mr. Smith left.', { abbreviations: new Set(['Dr', 'Mr']) }), ['Dr.', 'Who', 'and', 'Mr.', 'Smith', 'left']);
  assert.deepEqual(ws('Dr. Who left.'), ['Dr', 'Who', 'left']);
  assert.deepEqual(ws('the U.S. army, the U.S.'), ['the', 'U.S.', 'army', 'the', 'U.S.']);
});
test('a CJK sentence with ，。', () => {
  const t = '我喜欢你，他也是。';
  assert.deepEqual(ws(t), ['我喜欢你', '他也是']);
  assert.deepEqual(ps(t), ['，:PUNCT', '。:PUNCT']); exact(t);
});
test('an Arabic sentence with ، ؟', () => {
  const t = 'هل ذهبت، يا أحمد؟';
  assert.deepEqual(ws(t), ['هل', 'ذهبت', 'يا', 'أحمد']);
  assert.deepEqual(ps(t), ['،:PUNCT', '؟:PUNCT']); exact(t);
});
test('Devanagari with । keeps vowel signs inside the word', () => {
  const t = 'मैं घर जाता हूँ। वह कौन है?';
  assert.deepEqual(ws(t), ['मैं', 'घर', 'जाता', 'हूँ', 'वह', 'कौन', 'है']);
  assert.deepEqual(ps(t), ['।:PUNCT', '?:PUNCT']); exact(t);
});
test('astral punctuation keeps UTF-16 offsets exact', () => {
  const t = 'ok 𝄞 go'; exact(t, 7);
  assert.deepEqual(ps(t), ['𝄞:SYM']);
});
