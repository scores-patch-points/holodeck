// holodeck-referent-for-whom.test.mjs — EVERY REFERENT HAS A FOR-WHOM, on the fold surface.
// S113/S42: a referent is a referent only for-whom. The reading admits every cast row
// FOR a frame (the reader's, or one the caller declares); a frameless read is gated
// into a typed gap, never admitted as a bare referent, and never silently dropped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readDoc, readSighted, mergeReadings, readerFrame } from './holodeck-reading.js';

const edges = [{ end1: 'Alice', end2: 'A.', label: 'wrote' }];

test('a reader read frames every cast row — no bare referent', () => {
  const r = readDoc('d1', 'Alice wrote A.', { edges });
  assert.ok(r.cast.length >= 1);
  assert.ok(r.cast.every(c => c.forWhom && c.frame), 'every admitted referent carries its for-whom');
  assert.equal(r.cast[0].frame.giver, 'the reader');
  assert.equal(r.cast[0].frame.ground, 'd1');
});

test('a sighted referent is framed too', () => {
  const r = readSighted('img1', [{ id: 'x', role: 'header', region: [0, 0, 10, 10], text: 'Margaret Okafor' }]);
  assert.ok(r.cast.length >= 1);
  assert.ok(r.cast.every(c => c.forWhom && c.frame));
});

test('mergeReadings keeps the frame and gates a frameless referent into a typed gap', () => {
  const framed = readDoc('d1', 'Alice wrote A.', { edges });
  const bare = readDoc('d2', 'Zed met Q.', { edges: [{ end1: 'Zed', end2: 'Q.', label: 'met' }] }, { forWhom: false });
  assert.ok(bare.cast.every(c => !c.forWhom), 'the frameless read produced unframed rows');
  const rix = mergeReadings([{ name: 'd1', ...framed }, { name: 'd2', ...bare }], { from: 'test' });
  assert.ok(rix.cast.every(c => c.forWhom), 'every cast row is framed');
  assert.ok(rix.castTotal >= 1);
  assert.equal(rix.castGapsTotal, bare.cast.length, 'the frameless read\'s referents are typed gaps, not silently dropped');
  assert.ok(rix.castGaps.every(g => g.schema === 'EOReferentGap@1' && g.reason === 'no_for_whom'));
  assert.ok(!rix.cast.some(c => /zed|q\b/i.test(c.id)), 'no frameless referent rides in the cast');
});

test('a caller may declare its own frame; question and ground ride through to the referent', () => {
  const r = readDoc('d1', 'Alice wrote A.', { edges }, { forWhom: { forWhom: 'q-alice', giver: 'the reader', question: 'who is Alice', ground: 'corpus' } });
  assert.equal(r.cast[0].forWhom, 'q-alice');
  assert.equal(r.cast[0].frame.question, 'who is Alice');
  assert.equal(r.cast[0].frame.ground, 'corpus');
});

test('readerFrame: default is the reader; false asks for the frameless read', () => {
  assert.equal(readerFrame('d1').giver, 'the reader');
  assert.equal(readerFrame('d1', false), null);
  assert.equal(readerFrame('d1', { giver: 'the auditor', question: 'who signed' }).giver, 'the auditor');
});
