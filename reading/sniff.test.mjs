import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sniffRegister, steerWithLocalModel } from './sniff.js';
const prior = JSON.parse(readFileSync(new URL('./register-prior.json', import.meta.url), 'utf8'));
const ALICE = 'Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do. “And what is the use of a book,” thought Alice, “without pictures or conversations?” So she was considering in her own mind whether the pleasure of making a daisy-chain would be worth the trouble, when suddenly a White Rabbit with pink eyes ran close by her. “Oh dear!” said the Rabbit. “I shall be late!”';

test('a short text is not sniffed — it says why', () => {
  const s = sniffRegister('A few words only.', prior);
  assert.equal(s.register, ''); assert.match(s.reason, /too short/);
});
test('narrated dialogue reads as fiction, with its reasons', () => {
  const s = sniffRegister(ALICE, prior);
  assert.equal(s.register, 'fiction'); assert.ok(s.p > 0.5); assert.ok(s.ranked[0].why.length > 0);
});
test('a dateline and attribution are the only evidence for journalism, and the gap is named', () => {
  const t = 'WASHINGTON (AP) — The Senate voted on Tuesday to extend the program, according to officials. ' + 'The measure passed after a long debate, according to aides who spoke on condition of anonymity. '.repeat(6);
  const s = sniffRegister(t, prior);
  assert.ok(s.ranked.find((r) => r.register === 'journalism').why.length > 0);
  assert.ok(s.gaps.some((g) => /news category holds 1 document/.test(g)));
});
test('a thin sniff asks a local model with the evidence projection only, and the answer is one disclosed amplitude', async () => {
  const thin = sniffRegister(ALICE, { ...prior, terms: {} });
  const sent = [];
  const fetchImpl = async (url, init) => {
    if (url.endsWith('/api/tags')) return { ok: true, json: async () => ({ models: [{ name: 'tiny:1b', size: 1 }, { name: 'big:70b', size: 99 }] }) };
    sent.push(JSON.parse(init.body)); return { ok: true, json: async () => ({ response: JSON.stringify({ register: 'fiction' }) }) };
  };
  const forced = { ...thin, thin: true };
  const r = await steerWithLocalModel(forced, { fetchImpl });
  assert.equal(r.model.used, true); assert.equal(sent[0].model, 'tiny:1b');
  assert.ok(!sent[0].prompt.includes('daisy'), 'the model is never handed the document');
});
test('no local model server: the sniff is returned unchanged with the reason', async () => {
  const forced = { ...sniffRegister(ALICE, prior), thin: true };
  const r = await steerWithLocalModel(forced, { fetchImpl: async () => { throw new Error('refused'); } });
  assert.equal(r.model.used, false); assert.equal(r.register, forced.register);
});
