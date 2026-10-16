// holodeck-contradiction.test.mjs — when two sources state the same referent two ways.
//   node --test holodeck-contradiction.test.mjs
//
// The embarrassments and their controls are the ones registered in docs/SOURCE-CONTRADICTION-PREREG.md
// (written before this module existed). Each control is a deliberately wrong implementation the same
// measurement must catch — a gate verified only against material it accepts is unmeasured (II.10).
import test from 'node:test';
import assert from 'node:assert/strict';
import { contradictionsOf, observerFrame, referentVocabulary, referentOf, referentParts, contradictionForField, contradictionForTopic, SCHEMA, GAP, MEET_SCHEMA, VERDICTS } from './holodeck-contradiction.js';
import { WITNESS_FLOOR } from './vendor/eoreader7/native/organs/asserted.js';

// The Titanic's own numbers, as the eight sources state them. `referent` is the measure phrase the figure stands
// under — the column head or the verb beside it, which is what the observer's question reads the referent off (a
// figure's referent is not read off its neighbours: the British table states 2201 aboard AND 711 saved in one row).
// `window` is the words around the figure, the fallback when no measure phrase is declared. The Senate's
// "nearly 500 … needlessly sacrificed" is the decoy the whole design exists to catch: same unit, a different referent.
const TITANIC = [
  { id: 'brit-saved', doc: 'british', s: 100, e: 103, raw: '711', value: 711, unit: 'count', year: 1912, referent: 'saved', window: 'Total on board saved 2201 711' },
  { id: 'brit-aboard', doc: 'british', s: 104, e: 108, raw: '2201', value: 2201, unit: 'count', year: 1912, referent: 'on board', window: 'Total on board saved 2201 711' },
  { id: 'mar-saved', doc: 'marshall', s: 200, e: 203, raw: '705', value: 705, unit: 'count', year: 1912, referent: 'saved', window: 'Total number saved, 705' },
  { id: 'mar-lost', doc: 'marshall', s: 210, e: 214, raw: '1635', value: 1635, unit: 'count', year: 1912, referent: 'lost', window: "Total number of Titanic's company lost, 1635" },
  { id: 'bee-rescued', doc: 'beesley', s: 300, e: 303, raw: '705', value: 705, unit: 'count', year: 1912, referent: 'rescued', window: '705 rescued by the Carpathia' },
  { id: 'bee-drowned', doc: 'beesley', s: 310, e: 314, raw: '1503', value: 1503, unit: 'count', year: 1912, referent: 'drowned', window: '815 of her passengers and 688 of her crew were drowned' },
  { id: 'sen-sacrificed', doc: 'senate', s: 400, e: 410, raw: 'nearly 500', value: 500, unit: 'count', year: 1912, referent: 'needlessly sacrificed', window: 'nearly 500 people were needlessly sacrificed to want of orderly discipline' },
];

const SAVED = observerFrame('How many lives were saved?');
const LOST = observerFrame('How many lives were lost?');
const SYN = { saved: ['rescued'], lost: ['drowned', 'perished'] };
const saved = () => contradictionsOf(TITANIC, { forWhom: SAVED, synonyms: SYN });
const lost = () => contradictionsOf(TITANIC, { forWhom: LOST, synonyms: SYN });
const has = (list, a, b) => list.some((p) => [p[0], p[1]].map((x) => String(x).toLowerCase()).sort().join('|') === [a, b].map((x) => String(x).toLowerCase()).sort().join('|'));

test('the record is the module\'s own schema, carries the observer, and reports the meet the vendored law built', () => {
  const r = saved();
  assert.equal(r.schema, SCHEMA);
  assert.equal(r.forWhom.question, 'How many lives were saved?');
  assert.equal(r.forWhom.giver, 'the reader');
  assert.equal(r.meet.schema, MEET_SCHEMA);
  assert.deepEqual(r.meet.forms.frames, [SAVED.id], 'the meet ran the observer\'s own frame');
  assert.equal(r.floor, WITNESS_FLOOR);
});

test('E1 — two values of different referents are never called a contradiction (1490 lost vs 705 saved)', () => {
  const r = saved();
  // 1635 (lost) is a different referent for this observer: refused or a typed gap, never a contradiction.
  assert.ok(!r.contradictions.some((c) => c.values.some((v) => v.raw === '1635')), 'the lost figure rode into the saved contradiction');
  assert.ok(r.gaps.some((g) => g.kind === 'off-referent' && g.raw === '1635'));
  assert.ok(has(r.refusals.map((x) => x.pair), '1635', '705'), 'the refused pair is disclosed, not silently dropped');
});

test('E1 control — the unit-string match DOES fold them, so the measurement is falsifiable', () => {
  // The old move: any two differing figures sharing a unit string. It flags the whole unit group.
  const group = TITANIC.filter((v) => v.unit === 'count');
  const naiveDiffers = new Set(group.map((v) => v.raw)).size > 1;   // what u.differs computes
  assert.equal(naiveDiffers, true);
  // the module, on the same group, calls exactly ONE pair a contradiction.
  const r = saved();
  assert.equal(r.contradictions.length, 1);
  assert.deepEqual(r.contradictions[0].pairs_held, [['705', '711']]);
  assert.ok(r.refusals.length >= 1, 'the module refuses where the string match folds');
});

test('E2 — a frameless read is refused as a typed gap, never emitted bare', () => {
  const bare = contradictionsOf(TITANIC, {});
  assert.equal(bare.forWhom, null);
  assert.equal(bare.contradictions.length, 0);
  assert.ok(bare.gaps.some((g) => g.schema === GAP && g.kind === 'frameless'));
});

test('E3 — a for-whom-local reading is disclosed as a split, and the pair no frame touches is unstable', () => {
  // The saved observer and the lost observer are two frames over the same values; the meet intersects them.
  const both = contradictionsOf(TITANIC, { forWhom: SAVED, synonyms: SYN, frames: [LOST] });
  assert.equal(both.meet.forms.frames.length, 2);
  assert.ok(both.refusals.length > 0, 'a frame that divides a pair the unit string joined lands in splits');
  // P-meet: the lost observer splits the Senate's "nearly 500 needlessly sacrificed" from the total — a different
  // referent, disclosed as a refusal, never a contradiction.
  assert.ok(has(both.refusals.map((x) => x.pair), '1635', 'nearly 500'), JSON.stringify(both.refusals.map((x) => x.pair)));
  // (2201 aboard, nearly 500 sacrificed): no frame's question joins or divides them — the honest middle.
  assert.ok(both.unstable.some((u) => has([u.values], '2201', 'nearly 500')), JSON.stringify(both.unstable));
  assert.deepEqual([...VERDICTS], ['same', 'distinct', 'unstable']);
});

test('E4 — a contradiction below the witness floor is single-witness, and the floor is the engine\'s own', () => {
  const onePair = contradictionsOf([
    { id: 'x', doc: 'a', s: 0, e: 3, raw: '711', value: 711, unit: 'count', referent: 'saved', window: 'lives saved 711' },
    { id: 'y', doc: 'b', s: 0, e: 3, raw: '705', value: 705, unit: 'count', referent: 'saved', window: 'lives saved 705' },
  ], { forWhom: SAVED, synonyms: SYN });
  assert.equal(onePair.contradictions[0].standing, 'single-witness', 'one source-pair is below the floor');
  assert.equal(onePair.contradictions[0].statements, 1);
  // the saved contradiction over the full set recurs (705 is stated in two sources against 711) → corroborated.
  assert.equal(saved().contradictions[0].standing, 'corroborated');
  assert.equal(saved().contradictions[0].statements, 2);
});

test('E5 — the identity is opened from the question\'s terms, so "rescued" is the same referent as "saved"', () => {
  const r = saved();
  const row = r.referents.find((x) => x.referent === 'saved');
  assert.ok(row.values.some((v) => v.raw === '705' && v.sources.length === 2), 'both "705 saved" and "705 rescued" fold into one value');
  // without the injected synonym prior, "rescued" is a different referent (a typed gap, never a wrong fold).
  const noPrior = contradictionsOf(TITANIC, { forWhom: SAVED });
  assert.ok(noPrior.gaps.some((g) => g.kind === 'off-referent' && g.raw === '705'), 'the missing prior is a gap, not a silent merge');
});

test('E6 — a source that cannot have known the fact is a typed gap, never an assertion', () => {
  const r = contradictionsOf([
    { id: 'a', doc: 'book1912', s: 0, e: 4, raw: '1985', value: 1985, unit: 'count', year: 1912, ofYear: 1985, window: 'the wreck was found in 1985' },
    { id: 'b', doc: 'script1997', s: 0, e: 4, raw: '1985', value: 1985, unit: 'count', year: 1997, window: 'the wreck was found in 1985' },
  ], { forWhom: observerFrame('When was the wreck discovered?') });
  assert.ok(r.gaps.some((g) => g.kind === 'anachronism' && g.doc === 'book1912'));
});

test('E7 — every contested value is carried with its byte span; nothing is collapsed to one picked total', () => {
  const r = saved();
  const c = r.contradictions[0];
  assert.equal(c.values.length, 2);
  for (const v of c.values) for (const a of v.at) assert.ok(Number.isFinite(a.s) && Number.isFinite(a.e) && a.e > a.s && a.doc, JSON.stringify(a));
  assert.ok(!('total' in c) && !('winner' in c), 'the record discloses the values in parallel; it does not adjudicate');
});

test('E8 — the observer can see WHY the two are one referent: the question and the held pair ride on the record', () => {
  const r = saved();
  assert.equal(r.forWhom.question, 'How many lives were saved?');
  assert.deepEqual(r.forWhom.vocabulary.includes('saved'), true);
  assert.deepEqual(r.contradictions[0].pairs_held, [['705', '711']]);
});

test('the same values, read by two questions, give two different records — identity is relative to the observer', () => {
  const s = saved(), l = lost();
  assert.equal(s.contradictions[0].referent, 'saved');
  assert.deepEqual(s.contradictions[0].pairs_held, [['705', '711']]);
  assert.equal(l.contradictions[0].referent, 'lost');
  assert.deepEqual(l.contradictions[0].pairs_held, [['1503', '1635']]);
  // each observer's contradiction excludes the other's figures: they are different referents.
  assert.ok(!s.contradictions[0].values.some((v) => v.raw === '1635'));
  assert.ok(!l.contradictions[0].values.some((v) => v.raw === '711'));
});

test('a value with no unit still nominates within its own group; a single source is a typed gap', () => {
  const r = contradictionsOf([
    { id: 'a', doc: 'a', s: 0, e: 3, raw: '711', value: 711, referent: 'saved', window: 'lives saved 711' },
    { id: 'b', doc: 'b', s: 0, e: 3, raw: '705', value: 705, referent: 'saved', window: 'lives saved 705' },
  ], { forWhom: SAVED });
  assert.equal(r.contradictions.length, 1);
  const one = contradictionsOf([{ id: 'a', doc: 'a', s: 0, e: 3, raw: '711', value: 711, unit: 'count', referent: 'saved', window: 'lives saved 711' }], { forWhom: SAVED });
  assert.ok(one.gaps.some((g) => g.kind === 'single-source'));
});

test('pure: the same values and the same frame give the same record, whatever order they arrive in', () => {
  const a = saved();
  const b = contradictionsOf([...TITANIC].reverse(), { forWhom: SAVED, synonyms: SYN });
  assert.deepEqual(a.contradictions, b.contradictions);
  assert.deepEqual(a.refusals.map((x) => x.pair).sort(), b.refusals.map((x) => x.pair).sort());
  assert.deepEqual(a.gaps.map((g) => g.kind).sort(), b.gaps.map((g) => g.kind).sort());
});

test('the terrain adapter reads the field register\'s own row shape, byte-addressed', () => {
  const row = { unit: 'count', values: [
    { raw: '711', value: 711, sources: ['british'], referent: 'saved', window: 'Total on board saved 2201 711', at: [{ doc: 'british', s: 100, e: 103, raw: '711' }] },
    { raw: '705', value: 705, sources: ['marshall', 'beesley'], referent: 'saved', window: 'Total number saved, 705', at: [{ doc: 'marshall', s: 200, e: 203, raw: '705' }, { doc: 'beesley', s: 300, e: 303, raw: '705' }] },
  ] };
  const r = contradictionForField(row, { forWhom: SAVED, synonyms: SYN });
  assert.equal(r.schema, SCHEMA);
  assert.equal(r.contradictions.length, 1);
  assert.equal(r.contradictions[0].values.find((v) => v.raw === '705').sources.length, 2);
});

test('referentVocabulary: the declared forms come first, so "saved" beats the generic "lives"', () => {
  const voc = referentVocabulary(SAVED, SYN);
  assert.deepEqual(voc.vocab, ['saved', 'rescued', 'lives']);
  assert.equal(referentOf({ referent: 'saved', window: 'lives saved 711' }, voc), 'saved');
  assert.equal(referentOf({ referent: 'lost', window: 'lives lost 1635' }, voc), null, 'a measure the frame does not ask about is a different referent — a gap, never the generic "lives"');
});

test('the referent is the holograph\'s, never a span: "ship" is not a referent, and a being qualifies the measure', () => {
  // The instrument: a question that names a SPAN ("ship") never folds figures by that word. A window word is
  // not a referent. (This is the measured failure the first build had: "ship" folded the engine revolutions.)
  const BAND = observerFrame('What did the band play as the ship sank?');
  const bvoc = referentVocabulary(BAND);
  assert.equal(referentOf({ window: '60 revolutions', text: 'the ship ran at 60 revolutions' }, bvoc), null, 'a window span is never a referent');
  // With the holograph's own declared tuple, the referent is the MEASURE, qualified by the BEING — never "ship".
  const TON = observerFrame("What was the Titanic's tonnage?");
  const tvoc = referentVocabulary(TON);
  const a = referentOf({ anchor: 'R.M.S. Titanic', measure: 'tonnage', window: 'of 46,328 tons gross' }, tvoc);
  const b = referentOf({ anchor: 'R.M.S. Titanic', measure: 'tonnage', window: '45,328 tons' }, tvoc);
  assert.ok(a && a === b, 'two sources stating the same being and measure are one referent');
  assert.ok(/tonnage/.test(a) && /Titanic/.test(a), JSON.stringify(a));
  // A different being with the same measure word is a DIFFERENT referent: it never folds onto the Titanic's.
  const other = referentOf({ anchor: 'Carpathia', measure: 'tonnage', window: '13,555 tons' }, tvoc);
  assert.ok(other && other !== a, 'the being qualifies the measure, so two beings never fold');
});

test('identity is read at the POINT grain — the being+measure, not the spelling — for the observer', () => {
  // Two sources name the same being+measure with DIFFERENT spellings ("saved"/"rescued"). The identity the record
  // asserts is at the point (the being the record carries the forms on), so the pair holds; the form grain would
  // see two different spellings and refuse it. This is the seam docs/SOURCE-CONTRADICTION-PREREG.md left open.
  const values = [
    { id: 'a', doc: 'a', s: 0, e: 3, raw: '711', value: 711, unit: 'count', anchor: 'R.M.S. Titanic', measure: 'saved', window: 'total saved 711' },
    { id: 'b', doc: 'b', s: 0, e: 3, raw: '705', value: 705, unit: 'count', anchor: 'R.M.S. Titanic', measure: 'rescued', window: '705 rescued' },
  ];
  const r = contradictionsOf(values, { forWhom: SAVED, synonyms: SYN });
  assert.equal(r.identityGrain, 'point');
  assert.equal(r.contradictions.length, 1, JSON.stringify(r.gaps));
  const [v1, v2] = r.contradictions[0].values;
  assert.notEqual(v1.raw, v2.raw, 'the two spellings differ');
  assert.equal(v1.point, v2.point, 'but they are one point — the being+measure — so the identity holds');
  assert.deepEqual(referentParts(v1.point), { measure: 'saved', being: 'R.M.S. Titanic' });
  // a DIFFERENT being with the same measure word is a different point: never the same referent.
  const other = contradictionsOf([
    values[0],
    { id: 'c', doc: 'c', s: 0, e: 3, raw: '705', value: 705, unit: 'count', anchor: 'Carpathia', measure: 'saved', window: '705 saved' },
  ], { forWhom: SAVED, synonyms: SYN });
  assert.equal(other.contradictions.length, 0, 'the being qualifies the measure — a different point, never a contradiction');
  const beings = other.referents.map((x) => referentParts(x.referent).being).sort();
  assert.deepEqual(beings, ['Carpathia', 'R.M.S. Titanic']);
});

test('contradictionForTopic: the holograph\'s own measure topic is the contradiction, with the being as the identity', () => {
  // The exact shape holoTopics emits for a measure group: the shared figure-slot FOR ONE BEING, with `differs`.
  const topic = {
    kind: 'measure', label: 'Titanic · tonnage', n: 3, differs: true, forWhom: ['R.M.S. Titanic'],
    tuple: { anchor: 'R.M.S. Titanic', measure: 'tonnage', unit: 'ton' },
    findings: [
      { text: '46,328 tons', doc: 'a', sources: ['a'], at: [{ doc: 'a', s: 10, e: 20, raw: '46,328 tons' }] },
      { text: '45,328 tons', doc: 'b', sources: ['b'], at: [{ doc: 'b', s: 30, e: 40, raw: '45,328 tons' }] },
      { text: '60,000 tons', doc: 'c', sources: ['c'], at: [{ doc: 'c', s: 50, e: 60, raw: '60,000 tons' }] },
    ],
    docs: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
  };
  const r = contradictionForTopic(topic, { forWhom: observerFrame("What was the Titanic's tonnage?") });
  assert.equal(r.contradictions.length, 1, JSON.stringify(r.gaps));
  const c = r.contradictions[0];
  assert.equal(c.values.length, 3);
  assert.ok(/Titanic/.test(c.referent) && /tonnage/.test(c.referent), c.referent);
  for (const v of c.values) for (const at of v.at) assert.ok(Number.isFinite(at.s) && at.e > at.s && at.doc);
  assert.deepEqual(referentParts(c.referent), { measure: 'tonnage', being: 'R.M.S. Titanic' });
});
