// holodeck-topic-referents.test.mjs — A BEING IS NEVER A TOPIC.
// A referent (a proper noun) is Figure grain and belongs to the referent surface; a topic is a
// thing the SOURCES SHARE (a bond, a measure, a restated claim — Pattern grain). The holograph's
// entity elements therefore ride in `entities`, beside the topics, never in the rail. The
// functions live in index.html's inline script; the slice from mergeTopicGroups to topicSubtitle
// is evaluated here with the holograph kit stubbed (no measures; names are the statement's own).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const a = src.indexOf('function mergeTopicGroups('), b = src.indexOf('const QW = new Set(');
assert.ok(a > 0 && b > a, 'the topic slice is findable');

const ctx = {
  clean: s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim(),
  short: (t, n) => { const s = String(t == null ? '' : t); return s.length > n ? s.slice(0, n - 1) + '\u2026' : s; },
  plural: (n, w) => n + ' ' + w + (n === 1 ? '' : 's'),
  holoName: () => true,
  holoKit: () => ({ figsOf: st => st.figs || [], namesOf: st => st.names || [] }),
};
const { holoTopics } = vm.runInNewContext(src.slice(a, b) + '\n;({ holoTopics })', ctx);

// synthetic corpus: three sources; two share a being and a bond; one names a being alone.
const mk = () => {
  const docs = [
    { id: 'd1', title: 'Source One', year: 2020 },
    { id: 'd2', title: 'Source Two', year: 2021 },
    { id: 'd3', title: 'Source Three', year: 2022 },
  ];
  const byId = {}, sts = []; let k = 0;
  const st = (doc, text, names) => { const s = { id: 's' + (++k), doc, text, names, figs: [], dates: [], topics: [], frame: 'fact', s: 0, e: text.length, claimy: true }; sts.push(s); byId[s.id] = s; return s.id; };
  const s1 = st('d1', 'J. Bruce Ismay was aboard the RMS Titanic.', ['J. Bruce Ismay', 'RMS Titanic']);
  const s2 = st('d2', 'The RMS Titanic struck an iceberg; J. Bruce Ismay survived.', ['RMS Titanic', 'J. Bruce Ismay']);
  const s3 = st('d3', 'The Californian stood still that night.', ['Californian']);
  const names = {
    'J. Bruce Ismay': { name: 'J. Bruce Ismay', type: 'person', sts: [s1, s2], docs: new Set(['d1', 'd2']) },
    'RMS Titanic': { name: 'RMS Titanic', type: 'place', sts: [s1, s2], docs: new Set(['d1', 'd2']) },
    'Californian': { name: 'Californian', type: 'other', sts: [s3], docs: new Set(['d3']) },
  };
  return { docs, docById: Object.fromEntries(docs.map(d => [d.id, d])), sts, byId, names };
};

test('a being is never a topic: entity elements ride in `entities`, not in the rail', () => {
  const P = holoTopics(mk());
  assert.ok(!P.groups.some(g => g.kind === 'entity'), 'no entity in the topics');
  assert.deepEqual([...P.entities].map(g => g.name).sort(), ['Californian', 'J. Bruce Ismay', 'RMS Titanic']);
  assert.ok(P.entities.every(g => (g.forWhom || []).length), 'every entity element carries its for-whom');
});

// a corpus whose three sources each state the SAME figure-slot of the SAME being with a different
// value — the measure topic, with whatever words the sources themselves share in the text.
const measureCorpus = texts => {
  const vals = ['46,328 tons', '45,328 tons', '60,000 tons'];
  const docs = texts.map((_, i) => ({ id: 'd' + (i + 1), title: 'Source ' + (i + 1), year: 2020 + i }));
  const byId = {}, sts = []; let k = 0;
  texts.forEach((t, i) => { const s = { id: 's' + (++k), doc: docs[i].id, text: t, names: ['RMS Titanic'], figs: [{ measure: 'tonnage', anchor: 'RMS Titanic', raw: vals[i] }], dates: [], topics: [], frame: 'fact', s: 0, e: t.length, claimy: true }; sts.push(s); byId[s.id] = s; });
  return { docs, docById: Object.fromEntries(docs.map(d => [d.id, d])), sts, byId, names: { 'RMS Titanic': { name: 'RMS Titanic', type: 'place', sts: sts.map(s => s.id), docs: new Set(docs.map(d => d.id)) } } };
};

test('a measure name carries a marker ONLY when the sources themselves share it (falsifiable)', () => {
  // arm 1 — the sources state different tonnages and share NO word for the disagreement:
  // the plain name stands and the badge carries the disagreement. A typed-in marker would show
  // here, and that is the falsifier: an unsupported word in the name breaks the rule.
  const plain = holoTopics(measureCorpus([
    'RMS Titanic displaced 46,328 tons.',
    'Her displacement of 45,328 tons is recorded.',
    'The figure 60,000 tons is also given.',
  ])).groups.find(g => g.kind === 'measure');
  assert.ok(plain, 'the shared figure-slot is a topic');
  assert.equal(plain.differs, true, 'the values disagree');
  assert.match(plain.label, /tonnage$/);
  assert.ok(!/discrepancy/.test(plain.label), 'no word may be typed into the name');

  // arm 2 — the sources' own statements carry the word: it emerges into the name.
  const earned = holoTopics(measureCorpus([
    'There is a discrepancy in the tonnage of RMS Titanic: 46,328 tons.',
    'The Board records a discrepancy: 45,328 tons.',
    'A third source gives 60,000 tons.',
  ])).groups.find(g => g.kind === 'measure');
  assert.ok(earned, 'the figure-slot is a topic');
  assert.match(earned.label, /discrepancy/, 'the shared word the sources use emerges into the name');
});

test('the shared bond is a topic; the lone being is a referent, not a topic', () => {
  const P = holoTopics(mk());
  const bond = P.groups.find(g => g.kind === 'bond');
  assert.ok(bond, 'the bond the two sources share is a topic');
  assert.deepEqual([...bond.pair], ['J. Bruce Ismay', 'RMS Titanic']);
  assert.ok(!P.groups.some(g => g.label === 'Californian'), 'a being named once is not a topic');
  assert.ok(P.entities.some(g => g.name === 'Californian'), 'but it is still a referent element');
});
