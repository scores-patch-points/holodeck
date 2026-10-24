// floor-words.test.mjs — the verdict words say what the scorer said, and nothing it did not.
import test from 'node:test';
import assert from 'node:assert/strict';
import { statusWord, cleanDetail, armOutcome, ARM_ROWS, REFUSAL_WORD } from './floor-words.js';

test('statusWord: passed and failed are said plainly; a missing item is declared missing', () => {
  assert.equal(statusWord(null), 'no item declared');
  assert.equal(statusWord({ status: 'passed' }), 'passed');
  assert.equal(statusWord({ status: 'failed' }), 'failed — a real ceiling');
});

test('statusWord: an unreachable organ is told apart from a material with no specimen', () => {
  assert.equal(statusWord({ status: 'refused', reason: 'organ_unreachable', detail: 'this material offers no second name' }), 'unmeasured — no specimen in this material');
  assert.equal(statusWord({ status: 'refused', reason: 'organ_unreachable', detail: 'no organ on this page nests a claim' }), 'unmeasured — no organ on this page');
  assert.equal(statusWord({ status: 'refused', reason: 'organ_unreachable', detail: 'something else' }), REFUSAL_WORD.organ_unreachable);
});

test('statusWord: every refusal reason mhc.js names has a word, and an unknown one falls back to the status', () => {
  for (const reason of ['unlicensed_perturbation', 'lower_order_suffices', 'arbitrary_coordination', 'indiscriminate', 'constituent_missing']) {
    assert.equal(statusWord({ status: 'refused', reason }), REFUSAL_WORD[reason]);
    assert.match(REFUSAL_WORD[reason], /^(refused|unmeasured) — /);
  }
  assert.equal(statusWord({ status: 'refused', reason: 'never_heard_of' }), 'refused');
});

test('cleanDetail strips only the scorer’s arm prefix', () => {
  assert.equal(cleanDetail('arbitrary arm could not run: this material offers no pair'), 'this material offers no pair');
  assert.equal(cleanDetail('this material offers no pair'), 'this material offers no pair');
  assert.equal(cleanDetail(undefined), '');
});

test('armOutcome: each arm state maps to one phrase and one class', () => {
  assert.deepEqual(armOutcome(null), { res: 'not run — stopped at an earlier arm', cls: '', draws: '' });
  assert.deepEqual(armOutcome({ unreachable: true }), { res: 'could not run', cls: 'warn', draws: '' });
  assert.deepEqual(armOutcome({ perturbed: false }), { res: 'tested nothing (A10)', cls: 'warn', draws: '' });
  assert.deepEqual(armOutcome({ perturbed: true, completed: true }), { res: 'accomplished it — the axiom fails', cls: 'bad', draws: '' });
  assert.deepEqual(armOutcome({ perturbed: true, completed: false }), { res: 'did not — holds', cls: 'ok', draws: '' });
  assert.equal(armOutcome({ perturbed: true, completed: false, draws: 20, fired: 0 }).draws, ' · 0 of 20 draws');
  assert.equal(armOutcome({ perturbed: true, completed: true, draws: 1, fired: 1 }).draws, '');
});

test('ARM_ROWS run in the order mhc.js runs the arms', () => {
  assert.deepEqual(ARM_ROWS.map(r => r[0]), ['lowerOrder', 'arbitrary', 'discrimination']);
});
