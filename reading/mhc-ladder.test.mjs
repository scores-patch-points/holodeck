// mhc-ladder.test.mjs — the floor ladder's machinery, driven by a stub reader.
//
// The reader is stubbed so these walls hold wherever the repo is checked out
// (the real reader needs its priors fetched by the page): a sentence
// "Name verb Name." is one edge, and read(claim) binds a claim the edges
// state. The organs the items drive (surfaces, pronouns, cast, verification,
// testimony) are the vendored khora ones. What is pinned is the ladder, not
// the reader: the canon floor table, axiom 1 one floor down, F4½ typed as an
// absent organ, the stage walk, a floor reusing its Commons run, and F0's
// byte re-open.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { materialOf, runLadder, FLOORS } from './mhc-ladder.js';

const SENT = /([A-Z][a-z]+) (praised|opposed|met|joined) ([A-Z][a-z]+)\./g;
function stubReader(passages) {
  const byKey = new Map();
  for (const p of passages ?? []) {
    for (const m of String(p.text).matchAll(SENT)) {
      const k = `${m[1]}|${m[2]}|${m[3]}`;
      if (!byKey.has(k)) byKey.set(k, { end1: m[1], label: m[2], end2: m[3], refs: [], statements: 0 });
      const e = byKey.get(k);
      if (!e.refs.includes(p.ref)) e.refs.push(p.ref);
      e.statements += 1;
    }
  }
  const edges = [...byKey.values()].map((e) => ({ ...e, assertion: { statements: e.statements, standing: e.statements >= 2 ? 'corroborated' : 'single-witness' } }));
  return {
    edges,
    read(text) {
      const claims = [...String(text).matchAll(SENT)].map((m) => {
        const e = byKey.get(`${m[1]}|${m[2]}|${m[3]}`);
        const sources = new Set((e?.refs ?? []).map((r) => r.split('#')[0])).size;
        return { end1: m[1], label: m[2], end2: m[3], verdict: e ? 'bound' : 'unbound', refs: e ? [...e.refs] : [],
          spans: [{ text: m[0] }], corroboration: e ? { passages: e.refs.length, sources } : null };
      });
      return { claims, edges: [], vocabulary: {} };
    },
  };
}

const NAMES = ['Ada', 'Byron', 'Clara', 'Dora', 'Edwin', 'Flora'];
const VERBS = ['praised', 'opposed', 'met', 'joined'];
const prose = (n, shift = 0) => Array.from({ length: n }, (_, i) => `${NAMES[(i + shift) % 6]} ${VERBS[i % 4]} ${NAMES[(i + shift + 1) % 6]}.`).join(' ');
const control = materialOf([{ key: 'control', text: 'Napoleon opposed the treaty, and Wellington supported it. Lincoln condemned the raid.' }]);
const run = (sources) => runLadder({ material: materialOf(sources), control, READER: stubReader, priors: ['stub reader — no priors'] });

test('materialOf: passages tile each source, refs are source#start-end, keys stay distinct', () => {
  const m = materialOf([{ key: 'a b#c', text: prose(60) }, { key: 'a b#c', text: prose(5) }]);
  assert.equal(new Set(m.sources.map((s) => s.key)).size, 2);
  for (const s of m.sources) {
    const mine = m.passages.filter((p) => p.source === s.key);
    assert.equal(mine.map((p) => p.text).join(''), s.text, 'the passages re-assemble the source byte for byte');
    for (const p of mine) {
      assert.match(p.ref, /^[^#\s]+#\d+-\d+$/);
      const [, a, b] = p.ref.match(/#(\d+)-(\d+)$/);
      assert.equal(s.text.slice(Number(a), Number(b)), p.text);
    }
  }
});

test('the ladder is canon’s floor table, in order, with axiom 1 held one floor down', async () => {
  const L = await run([{ key: 'one', text: prose(40) }, { key: 'two', text: prose(40, 2) }]);
  assert.deepEqual(L.floors.floors.map((f) => f.floor), ['F0', 'F1', 'F2', 'F3', 'F4½', 'F5', 'F6']);
  assert.deepEqual(FLOORS.map((f) => f.floor), ['F0', 'F1', 'F2', 'F3', 'F4½', 'F5', 'F6']);
  assert.equal(L.floors.axiom1.held, true, JSON.stringify(L.floors.axiom1.findings));
  const at = new Map(L.floors.declared.map((d) => [d.id, d.floor]));
  for (const d of L.floors.declared) {
    const i = FLOORS.findIndex((f) => f.floor === d.floor);
    if (i === 0) { assert.deepEqual(d.definedInTermsOf, []); continue; }
    for (const c of d.definedInTermsOf) assert.equal(at.get(c), FLOORS[i - 1].floor, `${d.id} is defined over the floor directly below`);
  }
});

test('F4½ is a typed gap — no organ on this page — and no stage is read across it', async () => {
  const L = await run([{ key: 'one', text: prose(40) }, { key: 'two', text: prose(40, 2) }]);
  const f4h = L.floors.floors.find((f) => f.floor === 'F4½');
  assert.equal(f4h.status, 'unmeasured');
  assert.equal(f4h.items[0].reason, 'organ_unreachable');
  assert.match(f4h.items[0].detail, /no organ on this page nests a claim/);
  const order = FLOORS.map((f) => f.floor);
  if (L.floors.stage.stage) assert.ok(order.indexOf(L.floors.stage.stage) < order.indexOf('F4½'));
});

test('the stage walk: every floor up to the stage passed, the cap is the first that did not, isolated passes sit above it', async () => {
  const L = await run([{ key: 'one', text: prose(40) }, { key: 'two', text: prose(40, 2) }]);
  const order = FLOORS.map((f) => f.floor);
  const { stage, cappedBy, isolated } = L.floors.stage;
  const upTo = stage ? order.indexOf(stage) : -1;
  L.floors.floors.slice(0, upTo + 1).forEach((f) => assert.equal(f.status, 'passed', f.floor));
  assert.ok(cappedBy, 'F4½ guarantees a cap on this page');
  assert.equal(order.indexOf(cappedBy.floor), upTo + 1);
  assert.notEqual(L.floors.floors[upTo + 1].status, 'passed');
  for (const f of isolated) {
    assert.ok(order.indexOf(f.floor) > upTo + 1);
    assert.equal(L.floors.floors.find((x) => x.floor === f.floor).status, 'passed');
  }
});

test('a floor whose task is a Commons item reuses that run — same task, same arms, one verdict', async () => {
  const L = await run([{ key: 'one', text: prose(40) }, { key: 'two', text: prose(40, 2) }]);
  for (const [floor, cid] of [['F1', 'o5-nominal'], ['F2', 'o6-sentential'], ['F3', 'o8-primary'], ['F5', 'o9-concrete']]) {
    const mine = L.floors.floors.find((f) => f.floor === floor).items[0];
    const theirs = L.report.items.find((i) => i.id === cid);
    assert.equal(mine.status, theirs.status, floor);
    assert.equal(mine.arms, theirs.arms, `${floor} carries the Commons run's own arms`);
  }
});

test('F0: units at sentence breaks re-open by byte address; a unit holding a lone surrogate cannot', async () => {
  const clean = await run([{ key: 'one', text: prose(40) }]);
  const f0 = clean.floors.floors[0].items[0];
  assert.equal(f0.status, 'passed', f0.detail);
  assert.equal(clean.views.units.reopen, clean.views.units.n);
  assert.equal(clean.views.units.inWord, 0);
  const multi = await run([{ key: 'one', text: `${prose(20)} Zoë met Ada. The 🚢 joined Byron. ${prose(20, 3)}` }]);
  assert.equal(multi.views.units.reopen, multi.views.units.n, 'accents and astral characters re-open');
  const broken = await run([{ key: 'one', text: `${prose(20)} A lone \uD800 mark stayed. ${prose(20, 3)}` }]);
  assert.equal(broken.views.units.reopen, broken.views.units.n - 1, 'exactly the unit with the lone surrogate does not re-open');
});

test('one sentence offers F0 no second unit: a gap about the material, never a failure', async () => {
  const L = await run([{ key: 'one', text: 'Ada praised Byron.' }]);
  const f0 = L.floors.floors[0].items[0];
  assert.equal(f0.status, 'unmeasured');
  assert.match(f0.detail, /this material offers no second unit/);
  assert.equal(L.floors.stage.stage, null);
});
