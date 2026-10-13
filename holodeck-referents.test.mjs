// Tests for holodeck-referents.js on a hand-built analysis: statements with spans, the way analyze() leaves them.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from './holodeck-referents.js';

// sentences as [text, [[surface, canonical], ...]] — spans located by first occurrence of the surface
function world(rows, types = {}) {
  const sts = rows.map(([text, ns], i) => {
    const spans = ns.map(([surf, canon]) => { const s = text.indexOf(surf); assert.ok(s >= 0, surf); return { s, e: s + surf.length, name: canon || surf }; });
    return { id: 'd' + (i % 2) + ':' + i, doc: 'd' + (i % 2), text, spans, names: [...new Set(spans.map(x => x.name))] };
  });
  const names = {};
  sts.forEach(st => st.names.forEach(n => { const x = names[n] || (names[n] = { name: n, type: types[n] || 'person', aliases: [], sts: [], docs: new Set() }); x.sts.push(st.id); x.docs.add(st.doc); }));
  return { sts, names, byId: Object.fromEntries(sts.map(s => [s.id, s])), nameLinks: {} };
}
// filler names so the null has unrelated pairs to measure
const FILL = ['Margaret Okafor', 'Harbor Commission', 'Delacroix Partners', 'Nashville Metro', 'Wendell Pierce', 'Teodora Vance', 'Quincy Abernathy', 'Riverside Holdings', 'Lucinda Marsh', 'Bertrand Oyelaran', 'Gideon Strauss', 'Felicity Ngata'];
const base = () => [
  ...FILL.map(f => [f + ' spoke at the hearing.', [[f]]]),
  ['John Smith signed the lease.', [['John Smith']]],
  ['John Smith paid the deposit.', [['John Smith']]],
  ['John Smith left early.', [['John Smith']]],
  ['Jonh Smith returned the keys.', [['Jonh Smith']]],
  ['José Álvarez chaired.', [['José Álvarez']]],
  ['Jose Alvarez chaired again.', [['Jose Alvarez']]],
];

test('osa counts an adjacent swap as one edit', () => {
  assert.equal(R.osa('jonh', 'john'), 1);
  assert.equal(R.osa('kitten', 'sitting'), 3);
});

test('suggestions offer the typo toward the more-read spelling, and the accent-only variant', () => {
  const A = world(base());
  const { pairs, sample } = R.suggestions(A);
  assert.ok(sample > 0, 'the null is measured from the workspace');
  const js = pairs.find(p => p.from === 'Jonh Smith');
  assert.ok(js, 'typo offered'); assert.equal(js.to, 'John Smith'); assert.equal(js.kind, 'typo'); assert.equal(js.likely, true);
  const ja = pairs.find(p => p.kind === 'form');
  assert.ok(ja && [ja.from, ja.to].includes('José Álvarez'));
  assert.ok(!pairs.some(p => FILL.includes(p.from) || FILL.includes(p.to)), 'unrelated names are not offered');
});

test('two spellings read in one statement are marked together and ranked last', () => {
  const A = world([...base(), ['Jonh Smith met John Smith.', [['Jonh Smith'], ['John Smith']]]]);
  const { pairs } = R.suggestions(A);
  const js = pairs.find(p => p.from === 'Jonh Smith');
  assert.equal(js.together, 1); assert.equal(js.likely, false); assert.equal(pairs[pairs.length - 1], js);
});

test('SYN merges a typo into the kept name, keeping it as an alias', () => {
  const A = world(base());
  const r = R.applyEdits(A, [{ kind: 'syn', from: ['Jonh Smith'], to: 'John Smith' }]);
  assert.equal(r.applied.length, 1);
  assert.equal(A.names['Jonh Smith'], undefined);
  assert.equal(A.names['John Smith'].sts.length, 4);
  assert.deepEqual(A.names['John Smith'].aliases, ['Jonh Smith']);
});

test('SYN into a new name is a rename', () => {
  const A = world(base());
  R.applyEdits(A, [{ kind: 'syn', from: ['Jonh Smith', 'John Smith'], to: 'Jon Smith' }]);
  assert.deepEqual(Object.keys(A.names).filter(n => /Smith/.test(n)), ['Jon Smith']);
  assert.equal(A.names['Jon Smith'].type, 'person');
});

test('SEG cuts a spelling out of the referent it was folded into', () => {
  const A = world([...base(), ['Smith arrived.', [['Smith', 'John Smith']]]]);
  assert.equal(A.names['John Smith'].sts.length, 4);
  assert.deepEqual(R.surfacesOf(A, 'John Smith').map(s => s.surface), ['John Smith', 'Smith']);
  R.applyEdits(A, [{ kind: 'seg', target: 'Smith', of: 'John Smith' }]);
  assert.equal(A.names['John Smith'].sts.length, 3);
  assert.equal(A.names['Smith'].sts.length, 1);
});

test('CON declares a tie between two live referents; a later merge carries it', () => {
  const A = world(base());
  R.applyEdits(A, [{ kind: 'con', a: 'John Smith', b: 'Harbor Commission', rel: 'works for' }, { kind: 'con', a: 'Nobody', b: 'John Smith' }]);
  assert.equal(A.declaredTies.length, 1); assert.equal(A.declaredTies[0].rel, 'works for');
  assert.equal(A.referentEdits.skipped.length, 1);
});

test('an edit whose names are gone is skipped with a reason, never applied blind', () => {
  const A = world(base());
  const r = R.applyEdits(A, [{ kind: 'syn', from: ['Nobody Here'], to: 'John Smith' }]);
  assert.equal(r.applied.length, 0); assert.match(r.skipped[0].why, /no longer/);
});

test('search finds by alias and by near spelling', () => {
  const A = world(base());
  R.applyEdits(A, [{ kind: 'syn', from: ['Jonh Smith'], to: 'John Smith' }]);
  assert.equal(R.search(A, 'jonh')[0].name, 'John Smith');
  assert.ok(R.search(A, 'Margret Okafor').some(r => r.name === 'Margaret Okafor' && r.near));
});

test('edit shapes: swap, doubled letter, same sound, scanning, vowel; an unrelated letter is silent', () => {
  assert.equal(R.editShape('jonh', 'john'), 'two letters swapped');
  assert.equal(R.editShape('comission', 'commission'), 'a doubled letter');
  assert.equal(R.editShape('vanse', 'vance'), 'sounds the same');
  assert.equal(R.editShape('rnartin', 'martin'), 'a scanning confusion (rn/m, l/1, 0/o)');
  assert.equal(R.editShape('margret', 'margaret'), 'only a vowel differs');
  assert.equal(R.editShape('abernaty', 'abernathy'), 'a letter dropped (h)');
  assert.equal(R.editShape('iran', 'iraq'), null);
});

test('two established names one letter apart are not pre-ticked (Iran / Iraq)', () => {
  const rows = [...base(),
    ['Iran signed the accord.', [['Iran']]], ['Iran objected.', [['Iran']]], ['Iran and Iraq met.', [['Iran'], ['Iraq']]],
    ['Iraq declined.', [['Iraq']]], ['Iraq said no.', [['Iraq']]]];
  const { pairs } = R.suggestions(world(rows, { Iran: 'place', Iraq: 'place' }));
  const ii = pairs.find(p => [p.from, p.to].includes('Iran'));
  assert.ok(ii); assert.equal(ii.likely, false); assert.notEqual(ii.verdict, 'likely');
  assert.ok(ii.witnesses.some(w => w.says === 'against'));
});

test('rarity sets the direction even against mention counts', () => {
  const rows = [...base(), ['Teodora Vance spoke.', [['Teodora Vance']]], ['Teodora Vance left.', [['Teodora Vance']]], ['Teodora Vanse objected.', [['Teodora Vanse']]]];
  const { pairs } = R.suggestions(world(rows));
  const tv = pairs.find(p => p.from === 'Teodora Vanse');
  assert.ok(tv); assert.equal(tv.to, 'Teodora Vance'); assert.equal(tv.verdict, 'likely');
  assert.deepEqual(tv.witnesses.map(w => w.who).sort(), ['rarity', 'shape']);
});
