// holodeck-inquiry.test.mjs — the gate on the constitutive inquiry's first rung.
// A test that passes on empty evidence proves nothing (spec §14), so every
// positive here has a falsifying control beside it, and the controls must
// genuinely reject.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answerFromFold, renderInquiry, standingForDoor, detectContests, asksFreshness, INQUIRY_SCHEMA } from './holodeck-inquiry.js';

const PASSAGES = [
  { ref: 'doc#0-95', source: 'doc', start: 0, end: 95, text: 'France is a country in Europe. The capital of France is Paris. It has many museums.' },
];

test('a blank the material fills is answered from the Fold, with no model and no egress', () => {
  const q = 'Fill in the blank: "The capital of France is ______."';
  const inq = answerFromFold({ question: q, passages: PASSAGES });
  assert.equal(inq.schema, INQUIRY_SCHEMA);
  assert.equal(inq.disposition, 'answered-from-fold');
  assert.ok(inq.answer, 'an exact door fired');
  assert.equal(inq.answer.kind, 'cloze');
  assert.equal(inq.answer.standing, 'witnessed');
  assert.deepEqual([...inq.answer.addresses], ['doc#0-95']);
  assert.ok(inq.answer.text.includes('Paris'));
  assert.equal(inq.resources.modelCalls, 0);
  assert.equal(inq.resources.externalRequests, 0);
});

test('the frame is a declared RetrievalFrame@1, not a view from nowhere (§1.4)', () => {
  const inq = answerFromFold({ question: 'Fill in the blank: "The capital of France is ______."', passages: PASSAGES, cursor: 3 });
  assert.equal(inq.frame?.schema, 'RetrievalFrame@1');
  assert.equal(inq.frame.asking, 'Fill in the blank: "The capital of France is ______."');
  assert.equal(inq.frame.atSeq, 3);
  assert.deepEqual(inq.frameOf, { declared: inq.frame, cursor: 3, scoped: true });
});

test('FALSIFIER — a prose ask over the SAME passages is NOT answered (the door is not a rubber stamp)', () => {
  const q = 'Explain why the capital of France matters.';
  const inq = answerFromFold({ question: q, passages: PASSAGES });
  assert.equal(inq.answer, null, 'a prose ask must fall through, not be answered mechanically');
  assert.equal(inq.disposition, 'gap');
  assert.equal(inq.gaps[0].type, 'not_found_in_scope');
  assert.equal(inq.resources.modelCalls, 0);
  assert.equal(inq.resources.externalRequests, 0);
});

test('FALSIFIER — no evidence in scope is a typed gap (not_yet_read), never a guessed answer', () => {
  const inq = answerFromFold({ question: 'Fill in the blank: "The capital of France is ______."', passages: [] });
  assert.equal(inq.answer, null);
  assert.equal(inq.gaps[0].type, 'not_yet_read');
});

test('the record names what was deliberately ABSENT (janus ledger, web, model) — absence is disclosed', () => {
  const inq = answerFromFold({ question: 'Fill in the blank: "The capital of France is ______."', passages: PASSAGES });
  const ex = inq.priors.excluded.join(' | ');
  const un = inq.priors.applicableUnavailable.join(' | ');
  assert.match(un, /janus/);       // the ledger derivation is a named unported gap
  assert.match(un, /vendor-skips/);
  assert.match(ex, /web/);
  assert.match(ex, /model/);
  // the append-only transformation log is present and typed
  assert.ok(inq.events.length >= 3);
  assert.equal(inq.events[0].op, 'DEF');
});

test('an empty question is framed as a gap, not an answer', () => {
  const inq = answerFromFold({ question: '   ', passages: PASSAGES });
  assert.equal(inq.answer, null);
  assert.equal(inq.disposition, 'gap');
  assert.equal(inq.gaps[0].type, 'outside_scope');
});

const E = (id, rel, a, b, w) => ({ schema: 'EOHyperedge@1', id, relation: rel, witness: w, participants: [{ ref: a, standing: 'referent' }, { ref: b, standing: 'referent' }] });

test('Stage D — composition derives a candidate through an earned referent, without a model', () => {
  const edges = [E('e1', 'parent', 'A', 'B', 'doc#10-14'), E('e2', 'parent', 'B', 'C', 'doc#20-24')];
  const inq = answerFromFold({ question: 'Who is connected to whom?', passages: [], edges });
  assert.equal(inq.derivation.chains, 1);
  assert.equal(inq.derivations[0].bridge, 'B');
  assert.deepEqual([...inq.derivations[0].premises], ['e1', 'e2']);
  assert.deepEqual([...inq.derivations[0].witnesses], [], 'a derived candidate is never its own witness');
  assert.equal(inq.resources.modelCalls, 0);
});

test('FALSIFIER — Stage E withholds an unlicensed composition (a prior nominates, never establishes)', () => {
  const edges = [E('e1', 'parent', 'A', 'B', 'doc#10-14'), E('e2', 'parent', 'B', 'C', 'doc#20-24')];
  const inq = answerFromFold({ question: 'Who is connected to whom?', passages: [], edges });
  assert.equal(inq.derivation.licensed, 0);
  assert.equal(inq.derivation.withheld, 1);
  assert.match(inq.derivation.reason, /GIVEN Hyperlexicon affordance/);
  assert.equal(inq.derivations[0].standing, 'withheld');
});

test('no edges means no derivation — never a phantom composition', () => {
  const inq = answerFromFold({ question: 'Fill in the blank: "The capital of France is ______."', passages: PASSAGES });
  assert.equal(inq.derivation, null);
  assert.deepEqual([...inq.derivations], []);
});

test('Stage F — a gap yields a report-gap plan, never an undirected search', () => {
  const inq = answerFromFold({ question: 'Explain why the capital of France matters.', passages: PASSAGES });
  assert.equal(inq.inquiries.length, 1);
  const p = inq.inquiries[0];
  assert.equal(p.schema, 'InquiryPlan@1');
  assert.equal(p.method, 'report-gap');
  assert.equal(p.authorization, 'not-required');
  assert.equal(p.estimatedCost.externalRequests, 0);
  assert.equal(p.result.ran, false);
  assert.match(p.declined.detail, /undirected egress/);
});

test('FALSIFIER — offline-only forbids egress and names why', () => {
  const inq = answerFromFold({ question: 'Explain why the capital of France matters.', passages: [], privacy: 'offline-only' });
  assert.equal(inq.inquiries[0].declined.reason, 'offline_only');
  assert.equal(inq.inquiries[0].estimatedCost.externalRequests, 0);
  assert.equal(inq.resources.externalRequests, 0);
});

test('Stage F — a time-sensitive question requires current verification, not a stale answer (§9/§14)', () => {
  assert.equal(asksFreshness('Who is the current mayor of Nashville?'), true);
  assert.equal(asksFreshness('Explain the treaty of 1815.'), false);
  const inq = answerFromFold({ question: 'Who is the current mayor of Nashville?', passages: PASSAGES });
  const p = inq.inquiries[0];
  assert.equal(p.freshness, true);
  assert.equal(p.method, 'retrieve-primary-source');
  assert.equal(p.authorization, 'required');
  assert.equal(p.declined.reason, 'freshness_requires_current_source');
  assert.equal(p.result.ran, false);
  assert.equal(inq.resources.externalRequests, 0);
});

test('FALSIFIER — offline, a fresh question names the block and egress stays zero', () => {
  const inq = answerFromFold({ question: 'Who is the current mayor of Nashville?', passages: [], privacy: 'offline-only' });
  assert.equal(inq.inquiries[0].declined.reason, 'offline_only');
  assert.equal(inq.resources.externalRequests, 0);
});

test('a static question is NOT flagged fresh (no phantom currency demand)', () => {
  const inq = answerFromFold({ question: 'Explain why the capital of France matters.', passages: PASSAGES });
  assert.equal(inq.inquiries[0].freshness, false);
  assert.equal(inq.inquiries[0].method, 'report-gap');
});

test('an answered inquiry proposes nothing — no plan to search for what it already has', () => {
  const inq = answerFromFold({ question: 'Fill in the blank: "The capital of France is ______."', passages: PASSAGES });
  assert.deepEqual([...inq.inquiries], []);
});

const F = (id, a, l, b, pol, w) => ({ id, end1Face: a, end2Face: b, label: l, polarity: pol, refs: [w], spans: [{ ref: w.split('#')[0], start: 0, end: 1 }] });

test('Stage E — opposite polarity over the same pair is PRESERVED as a contest, not resolved', () => {
  const edges = [F('e1', 'Alice', 'supports', 'the treaty', '+', 'doc#10-20'), F('e2', 'Alice', 'supports', 'the treaty', '-', 'doc#40-50')];
  const inq = answerFromFold({ question: 'What did Alice do about the treaty?', passages: [], edges });
  assert.equal(inq.contests.length, 1);
  assert.equal(inq.contests[0].positive.length, 1);
  assert.equal(inq.contests[0].negative.length, 1);
  assert.match(inq.contests[0].basis, /neither is chosen/);
});

test('FALSIFIER — same pair, same polarity is NOT a contest (no phantom conflict)', () => {
  const edges = [F('e1', 'Alice', 'supports', 'the treaty', '+', 'doc#10-20'), F('e2', 'Alice', 'supports', 'the treaty', '+', 'doc#40-50')];
  assert.equal(detectContests(edges).length, 0);
  const inq = answerFromFold({ question: 'What did Alice do about the treaty?', passages: [], edges });
  assert.deepEqual([...inq.contests], []);
});

test('standing is typed by door, and renderInquiry says what happened in one line', () => {
  assert.equal(standingForDoor('comparison'), 'derived');
  assert.equal(standingForDoor('cloze'), 'witnessed');
  assert.equal(standingForDoor('prior-answer'), 'received');
  const inq = answerFromFold({ question: 'Fill in the blank: "The capital of France is ______."', passages: PASSAGES });
  const r = renderInquiry(inq);
  assert.match(r.line, /From the Fold/);
});
