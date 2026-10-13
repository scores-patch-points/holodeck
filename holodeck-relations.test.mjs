// Tests for holodeck-relations.js on a hand-built fixture: the spec's Harbor hearing — a lease, the act it cites,
// a promotional spot, the hearing transcript, and a caption file of the same recording.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from './holodeck-relations.js';

// A statement list the way the app's analyze() would make one: sentence spans over the doc text, figures found by
// the same kind of pattern (value, unit, raw, s, e relative to the statement).
function figs(t) {
  const out = []; const re = /\$(\d[\d,]*(?:\.\d+)?)/g; let m;
  while ((m = re.exec(t))) out.push({ raw: m[0], value: +m[1].replace(/,/g, ''), unit: 'dollars', label: 'dollars', s: m.index, e: m.index + m[0].length });
  return out;
}
function mkDoc(id, title, sentences, extra = {}) {
  let text = ''; const sts = [];
  sentences.forEach((t, i) => { const s = text.length; text += t; const e = text.length; text += '\n'; sts.push({ id: id + ':' + i, doc: id, s, e, text: t, figs: figs(t), names: [] }); });
  return { doc: { id, title, text, ...extra }, sts };
}
function world(parts) {
  const docs = parts.map(p => p.doc); const stsByDoc = {}; const sts = [];
  parts.forEach(p => { stsByDoc[p.doc.id] = p.sts; sts.push(...p.sts); });
  return { docs, sts, stsByDoc, docById: Object.fromEntries(docs.map(d => [d.id, d])) };
}
// Unrelated municipal sources, so the workspace has a vocabulary the null can speak for.
const filler = () => [
  mkDoc('f1', 'Parks minutes', ['The parks board approved new playground equipment for the riverside field.', 'Volunteers will plant native trees along the greenway this autumn.', 'A resident asked about the dog park hours and the lighting.', 'The board adjourned after reviewing the summer concert schedule.']),
  mkDoc('f2', 'Transit report', ['Bus ridership increased on the northern corridor after the schedule change.', 'The agency will purchase six electric buses with state capital funding.', 'Operators reported delays at the downtown transfer station during construction.', 'A rider survey found most passengers wanted more frequent evening service.']),
  mkDoc('f3', 'School board', ['The superintendent presented enrollment projections for the coming academic year.', 'Teachers requested smaller classes in the elementary grades.', 'Members voted to extend the contract for the cafeteria vendor.', 'The athletic fields will close for resurfacing during the break.']),
  mkDoc('f4', 'Water authority', ['The treatment plant completed its filter replacement ahead of schedule.', 'Customers in the eastern district may see a temporary pressure drop.', 'Engineers measured corrosion in the older cast iron mains beneath the avenue.', 'The utility will notify neighborhoods before any planned shutoff.']),
  mkDoc('f5', 'Library notes', ['The branch library extended weekend hours for the exam season.', 'A grant will fund digital literacy classes for older adults.', 'The children’s section received a donation of picture books.', 'Staff catalogued the local history archive over the winter.']),
];
const lease = () => mkDoc('lease', 'Quay lease agreement', [
  '4.2 Term. This lease takes effect on May 3, 2026 and runs to May 3, 2031, renewable at the Authority’s option.',
  '5.1 Rate. The Lessee shall pay $12 per linear foot per month, adjusted annually under §14 of the Harbor Development Act.',
  '5.2 Deposit. A deposit equal to two months of the rate in 5.1 is due at signing.',
  '9.4 Insurance. The Lessee shall maintain liability coverage for every vessel at the quay.',
]);
const act = () => mkDoc('act', 'Harbor Development Act', [
  '§14. The Authority may lease quays at a fee not to exceed $15 per linear foot, adjusted annually.',
  '§22. This Act is effective on May 3.',
  '§30. Vessels at any quay shall carry liability insurance in an amount set by the Authority.',
]);
const spot = () => mkDoc('spot', '“Docks for Everyone” spot', [
  'Docks leased through 2031 from the Authority, berths from just $9 a foot per month.',
  'Rates are fixed for five years at every quay.',
]);
const hearing = () => mkDoc('hearing', 'Hearing transcript', [
  'The chair’s resignation takes effect May 3, one week after this hearing.',
  'Members asked whether the lease rate of $12 per linear foot per month was reasonable for a working quay.',
]);

test('values: dates and figures are normalised to tokens with absolute offsets', () => {
  const W = world([lease()]);
  const v = R.valuesOf(W.stsByDoc.lease[0]);
  const dates = v.filter(x => x.kind === 'date');
  assert.equal(dates.length, 2);
  assert.equal(dates[0].token, 'd:5-3');
  assert.equal(dates[0].year, 2026);
  assert.equal(W.docs[0].text.slice(dates[0].s, dates[0].e), 'May 3, 2026');
  const f = R.valuesOf(W.stsByDoc.lease[1]).find(x => x.kind === 'fig');
  assert.equal(f.value, 12);
  assert.equal(W.docs[0].text.slice(f.s, f.e), '$12');
});

test('model: ids are stable, symmetric relations are direction-free, a bad relation throws', () => {
  const a = R.wholeSpan('x'), b = R.wholeSpan('y');
  assert.equal(R.linkId('same-value', a, b), R.linkId('same-value', b, a));
  assert.notEqual(R.linkId('cites', a, b), R.linkId('cites', b, a));
  assert.throws(() => R.makeLink({ relation: 'nope', from: a, to: b, provenance: 'file' }));
  assert.throws(() => R.makeLink({ relation: 'cites', from: a, to: b, provenance: 'maybe' }));
  assert.equal(R.makeLink({ relation: 'cites', from: a, to: b, provenance: 'file' }).grain, 'ground');
  assert.equal(R.makeLink({ relation: 'cites', from: R.charSpan('x', 0, 4), to: b, provenance: 'file' }).grain, 'figure');
  assert.deepEqual(R.RELATION_IDS.length, 6);
  assert.deepEqual(Object.keys(R.PROVENANCE).sort(), ['computed', 'confirmed', 'file', 'inferred']);
});

test('cues: a timed source states its own form-of links, in the file', () => {
  const t = mkDoc('cap', 'Hearing captions', ['Order of business.', 'The chair opens the hearing.', 'Public comment begins.'],
    { tmarks: [{ o: 0, t: 0 }, { o: 19, t: 12 }, { o: 48, t: 30 }], media: { kind: 'youtube', id: 'abc' } });
  const W = world([t]); const L = R.importCues(W);
  assert.equal(L.length, 3);
  assert.ok(L.every(x => x.relation === 'form-of' && x.provenance === 'file' && x.to.axis === 'time'));
  assert.equal(L[1].to.t0, 12); assert.equal(L[1].to.t1, 30);
  assert.equal(R.timeAt(W.docs[0], 25), 12);
  assert.equal(R.charsAt(W.docs[0], 31), 48);
});

test('alignment: two timed sources of the same media id align where their cues overlap', () => {
  const a = mkDoc('capA', 'Captions', ['One.', 'Two.'], { tmarks: [{ o: 0, t: 0 }, { o: 5, t: 10 }], media: { id: 'm1' } });
  const b = mkDoc('trB', 'Transcript', ['Uno.', 'Dos.'], { tmarks: [{ o: 0, t: 0 }, { o: 5, t: 10 }], media: { id: 'm1' } });
  const c = mkDoc('trC', 'Other recording', ['Tres.'], { tmarks: [{ o: 0, t: 0 }], media: { id: 'm2' } });
  const L = R.importAlignment(world([a, b, c]));
  assert.equal(L.length, 2);
  assert.ok(L.every(x => x.provenance === 'computed' && new Set([x.from.doc, x.to.doc]).size === 2 && ![x.from.doc, x.to.doc].includes('trC')));
});

test('citations: a stated section resolves to the cited source; an unheld one is returned, not dropped', () => {
  const W = world([lease(), act(), mkDoc('memo', 'Memo', ['See Section 40 of the Marina Code for berthing limits.'])]);
  const { links, unresolved } = R.importCitations(W);
  const c = links.find(x => x.from.doc === 'lease');
  assert.ok(c, 'the lease cites §14');
  assert.equal(c.relation, 'cites'); assert.equal(c.provenance, 'file'); assert.equal(c.to.doc, 'act');
  const target = W.stsByDoc.act[0];
  assert.equal(c.to.s, target.s);
  assert.equal(W.docs[0].text.slice(c.from.s, c.from.e).startsWith('§14'), true);
  assert.equal(unresolved.length, 1);
  assert.equal(unresolved[0].doc, 'memo');
});

test('parts: a title that contains another source’s whole title is inferred part-of, never in the file', () => {
  const W = world([mkDoc('act', 'Harbor Development Act', ['x is here and long enough.']), mkDoc('s14', 'Harbor Development Act section 14', ['y is here and long enough.'])]);
  const L = R.importParts(W);
  assert.equal(L.length, 1);
  assert.equal(L[0].from.doc, 's14'); assert.equal(L[0].to.doc, 'act'); assert.equal(L[0].provenance, 'inferred');
});

test('wording: the lease rate and the spot rate pair up, and the verdict comes from the figures', () => {
  const W = world([lease(), act(), spot(), hearing(), ...filler()]);
  const S = R.seamOf(W, 'lease', 'spot');
  const row = S.rows.find(r => r.a && r.a.id === 'lease:1');
  assert.ok(row && row.b && row.b.id === 'spot:0', 'lease 5.1 is paired with the spot’s rate line');
  assert.equal(row.verdict, 'differs');
  assert.equal(row.link.relation, 'same-value');
  assert.equal(row.link.provenance, 'inferred', 'a disagreement rests on wording, so it waits for a reader');
  assert.deepEqual([row.link.quote.from, row.link.quote.to], ['$12', '$9']);
  // nothing is merged: every statement of both appears exactly once
  const seenA = S.rows.filter(r => r.a).length, seenB = S.rows.filter(r => r.b).length;
  assert.equal(seenA, 4); assert.equal(seenB, 2);
  assert.ok(S.counts.alone >= 1, 'the clauses with no partner are shown alone');
});

test('wording: an equal value in the best-matching pair is computed, not inferred', () => {
  const W = world([lease(), hearing()]);
  const S = R.seamOf(W, 'lease', 'hearing');
  const row = S.rows.find(r => r.a && r.a.id === 'lease:1');
  assert.ok(row.b && row.b.id === 'hearing:1');
  assert.equal(row.verdict, 'same');
  assert.equal(row.link.provenance, 'computed');
});

test('null: unrelated statements do not pair, and the run is deterministic', () => {
  const x = mkDoc('x', 'X', ['The committee reviewed zoning variances for the river district parcels.', 'Gardening volunteers planted tulips along the median.']);
  const y = mkDoc('y', 'Y', ['Quarterly freight volumes rose at the inland terminal.', 'Choir rehearsal moved to Thursday evening in the annex.']);
  const W = world([x, y, lease(), act()]);
  const one = R.seamOf(W, 'x', 'y'), two = R.seamOf(W, 'x', 'y');
  assert.equal(one.rows.filter(r => r.a && r.b).length, 0);
  assert.deepEqual(one.rows.map(r => r.verdict), two.rows.map(r => r.verdict));
  const P1 = R.proposeAll(W), P2 = R.proposeAll(W);
  assert.deepEqual(P1.links.map(l => l.id), P2.links.map(l => l.id));
});

test('collect: everything a file states, plus proposals, deduplicated by id; coverage is stated', () => {
  const W = world([lease(), act(), spot(), hearing(), ...filler()]);
  const C = R.collect(W, {});
  assert.ok(C.links.some(l => l.relation === 'cites' && l.provenance === 'file'));
  assert.ok(C.links.some(l => l.verdict === 'differs'), 'the lease and the spot disagree on the rate, and that beats chance here');
  assert.equal(new Set(C.links.map(l => l.id)).size, C.links.length);
  assert.equal(C.coverage.sources, 9);
  assert.equal(typeof C.truncated, 'boolean');
  const starved = R.proposeAll(W, { budget: 1 });
  assert.equal(starved.truncated, true, 'a budget that runs out says so');
});

test('small workspace: nothing beats chance, so the pairs are disclosed as weak, not dropped and not asserted', () => {
  const W = world([lease(), spot()]);
  const C = R.collect(W, {});
  assert.equal(C.links.filter(l => l.source === 'wording').length, 0);
  assert.ok(C.weak.length >= 1, 'the mutual best pairs are kept apart');
  assert.ok(C.weak.every(l => l.weak === true));
  const S = R.seamOf(W, 'lease', 'spot');
  assert.ok(S.rows.some(r => r.a && r.b && r.weak), 'the seam still shows the pair, marked weak');
});

test('margin: each sentence of a draft shows what answers it, how, and what nothing answers', () => {
  const W = world([lease(), act(), spot(), hearing(), ...filler()]);
  const ix = R.buildIndex(W);
  const draft = 'The lease charges $12 per linear foot per month. The Authority lets quays be leased under section 14. Tulips will bloom in the north meadow by April.';
  assert.equal(R.sentencesOf(draft).length, 3);
  const rows = R.marginOf(ix, draft);
  assert.equal(rows.length, 3);
  assert.ok(rows[0].partners.some(p => p.doc === 'lease' || p.doc === 'hearing'), 'the rate sentence is answered by a source that states it');
  assert.ok(rows[0].partners.some(p => p.verdict === 'same'), 'and its figure matches');
  assert.equal(rows[2].unanswered, true, 'nothing in the workspace says anything about tulips in a meadow');
  assert.deepEqual(R.marginOf(ix, draft).map(r => r.partners.map(p => p.st.id)), rows.map(r => r.partners.map(p => p.st.id)), 'deterministic');
});

test('contract-links.json: legislation that names a party and replacement chains import with their stated basis', () => {
  const W = world([mkDoc('c1', 'Contract 1', ['aaaa bbbb cccc dddd.']), mkDoc('c0', 'Contract 0', ['aaaa bbbb cccc dddd.']), mkDoc('leg', 'Resolution', ['aaaa bbbb cccc dddd.'])]);
  const json = { links: { c1: { legislation: [{ id: 'leg', basis: 'inferred', why: 'name match' }], replaces: [{ id: 'c0', basis: 'inferred', why: 'successive terms' }] }, gone: { replaces: [{ id: 'c0' }] } } };
  const L = R.importContractLinks(json, W);
  assert.equal(L.length, 2);
  assert.ok(L.find(x => x.relation === 'says-about' && x.from.doc === 'leg' && x.to.doc === 'c1' && x.provenance === 'inferred'));
  assert.ok(L.find(x => x.relation === 'derived-from' && x.from.doc === 'c1' && x.to.doc === 'c0'));
});

test('decisions: confirm, change and reject are an append-only log; a later confirm restores', () => {
  const W = world([lease(), spot()]);
  const S = R.seamOf(W, 'lease', 'spot'); const L = S.rows.find(r => r.link && r.link.verdict === 'differs').link;
  const log = [{ id: L.id, action: 'confirm', by: 'reader', at: '2026-10-13T00:00:00Z' }];
  let r = R.resolveLinks([L], log);
  assert.equal(r.links[0].provenance, 'confirmed'); assert.equal(r.links[0].by, 'reader');
  r = R.resolveLinks([L], log.concat([{ id: L.id, action: 'change', relation: 'says-about', by: 'reader', at: 't2' }]));
  assert.equal(r.links[0].relation, 'says-about'); assert.equal(r.links[0].was, 'same-value');
  r = R.resolveLinks([L], log.concat([{ id: L.id, action: 'reject', by: 'reader', at: 't3' }]));
  assert.equal(r.links.length, 0); assert.equal(r.rejected.length, 1);
  r = R.resolveLinks([L], log.concat([{ id: L.id, action: 'reject', at: 't3' }, { id: L.id, action: 'confirm', at: 't4' }]));
  assert.equal(r.links.length, 1);
  assert.equal(log.length, 1, 'the log itself is never edited');
  const decl = R.makeLink({ relation: 'cites', from: R.wholeSpan('lease'), to: R.wholeSpan('act'), provenance: 'inferred' });
  r = R.resolveLinks([], [{ action: 'declare', link: decl, by: 'reader', at: 't5' }]);
  assert.equal(r.links[0].provenance, 'confirmed'); assert.equal(r.links[0].source, 'declared');
});

test('grain: ground draws whole-source ties, figure draws each link, pattern draws recurring structure only', () => {
  const g = R.makeLink({ relation: 'derived-from', from: R.wholeSpan('a'), to: R.wholeSpan('b'), provenance: 'inferred' });
  const f1 = R.makeLink({ relation: 'cites', from: R.charSpan('a', 0, 3), to: R.charSpan('b', 0, 3), provenance: 'file' });
  const f2 = R.makeLink({ relation: 'cites', from: R.charSpan('a', 10, 13), to: R.charSpan('b', 20, 23), provenance: 'file' });
  const f3 = R.makeLink({ relation: 'cites', from: R.charSpan('a', 0, 3), to: R.charSpan('c', 0, 3), provenance: 'file' });
  const all = [g, f1, f2, f3];
  assert.deepEqual(R.atGrain(all, 'ground').ties.map(l => l.id), [g.id]);
  assert.equal(R.atGrain(all, 'figure').singles.length, 4);
  const P = R.atGrain(all, 'pattern');
  assert.equal(P.bundles.length, 1); assert.equal(P.bundles[0].links.length, 2);
  assert.deepEqual(P.singles.map(l => l.id).sort(), [g.id, f3.id].sort());
});

test('fields: the void is the statements no link touches', () => {
  const W = world([lease(), act(), spot(), hearing(), ...filler()]);
  const links = R.collect(W, {}).links;
  const F = R.fieldsOf(W, links).find(f => f.doc === 'lease');
  assert.equal(F.total, 4);
  assert.ok(F.linked >= 1 && F.void >= 1, 'some clauses are linked and some touch nothing');
  assert.equal(F.linked + F.void, F.total);
});

test('orbit: sources are planets, linked passages their moons, rings are link steps from the centre', () => {
  const W = world([lease(), act(), spot(), hearing(), ...filler()]);
  const links = R.collect(W, {}).links;
  const O = R.orbitOf(W, links, 'lease');
  assert.equal(O.centre, 'lease');
  assert.equal(O.dist.get('lease'), 0);
  assert.ok(O.dist.get('act') === 1, 'the act is one step from the lease because the lease cites it');
  // the nest has holodeck-holons.js's shape: a moon's parent is its planet, roots are planets only
  O.nest.roots.forEach(r => assert.equal(O.nest.parent.get(r), null));
  O.moons.forEach((m, id) => assert.equal(O.nest.parent.get(id), m.doc));
  const re = R.orbitOf(W, links, 'spot'); assert.equal(re.dist.get('spot'), 0);
});

test('tally: tiles show how connected a source is and how many links differ', () => {
  const W = world([lease(), act(), spot(), hearing(), ...filler()]);
  const links = R.collect(W, {}).links; const T = R.tallyByDoc(links);
  assert.ok(T.get('lease').links >= 2);
  assert.ok(T.get('spot').differs >= 1);
});

test('hues: a source keeps one hue across surfaces, six distinct before any repeat, light has its own set', () => {
  const ids = ['lease', 'act', 'spot', 'hearing', 'cap', 'memo'];
  const d = R.hueMap(ids, 'dark'), d2 = R.hueMap([...ids].reverse(), 'dark'), l = R.hueMap(ids, 'light');
  assert.equal(new Set(d.values()).size, 6);
  ids.forEach(i => assert.equal(d.get(i), d2.get(i)));
  assert.notEqual(d.get('act'), l.get('act'));
});

test('contracts: only Review and the Sources shelf may write links; every other surface declares NUL or no write op', () => {
  assert.equal(R.SURFACE_CONTRACTS.length, 10);
  const writers = R.SURFACE_CONTRACTS.map(c => c.surface).filter(R.canWriteLinks).sort();
  assert.deepEqual(writers, ['Review', 'Sources shelf']);
  ['Lanes', 'Margin', 'Seam', 'Fields', 'Passage', 'Reader', 'Graph', 'Player'].forEach(s => assert.equal(R.canWriteLinks(s), false, s));
  for (const c of R.SURFACE_CONTRACTS) if (!R.canWriteLinks(c.surface)) assert.ok(!c.ops.includes('INS') && !c.ops.includes('SEG') && !c.ops.includes('REC'), c.surface);
});

// ── findings: what a pair establishes, said plainly ────────────────────────────────────────────────────────────────
// A workspace with a real vocabulary behind it: fifty short municipal sources of generated sentences, so a chance bag of
// words has somewhere else to land and the null speaks for what chance would find.
function bulk(n = 50) {
  const W = ('budget council library bridge pavement transit riverside greenway playground cemetery harbor ferry dredging permit zoning '
    + 'variance appeal hearing minutes agenda quorum motion amendment ordinance clerk treasurer assessor millage levy bond reserve audit '
    + 'payroll pension grant stormwater sewer culvert hydrant inspector violation citation fine lien deed easement survey parcel '
    + 'orchard festival concert marathon parade volunteer mulch seedling bench fountain pier boardwalk canoe shelter pavilion '
    + 'snowplow salt asphalt crosswalk signal bicycle sidewalk lighting curb median roundabout viaduct tunnel depot platform').split(' ');
  let x = 12345; const r = () => (x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296;
  return Array.from({ length: n }, (_, i) => mkDoc('bulk' + i, 'Source ' + i, Array.from({ length: 4 }, () =>
    'The ' + Array.from({ length: 7 }, () => W[Math.floor(r() * W.length)]).join(' ') + ' was discussed at the meeting.')));
}
const packet = () => mkDoc('packet', 'RS2026-2264 resolution and certification', [
  'A resolution accepting the terms of a cooperative purchasing master agreement with Motorola Solutions for public safety software.',
  'Does the contract contain any video surveillance or drone software as described in MCL 13.08.080? No.',
  'The anticipated project value is $3,946,041.00 and council approval of the master agreement is required.',
  'This cooperative request is recommended for approval by the Purchasing Agent.',
]);
const agreement = () => mkDoc('agree', 'Sourcewell master agreement 030425 with Motorola Solutions', [
  'Category one covers public safety video surveillance solutions with related equipment, software and accessories.',
  'Category two covers drone software and hardware and unmanned vehicle systems with related technology.',
  'The anticipated project value is $3,946,041.00 under this master agreement.',
  'Payment terms are net forty five days from the date of each invoice.',
]);
const ordinance = () => mkDoc('code', 'Metro Code 13.08.080', [
  '"Surveillance technology" includes: automatic license plate readers, closed-circuit television cameras, drone software, video monitoring and recording technology, and biometric systems.',
  '"Public right-of-way" shall mean any street, avenue, sidewalk or public outdoor space.',
  'A public hearing and a civil rights review are required before the council approves surveillance technology.',
]);

test('finding: a denial against a statement over the same terms is flagged as a denial, with both quotes', () => {
  const W = world([packet(), agreement(), ...filler(), ...bulk()]);
  const S = R.seamOf(W, 'packet', 'agree');
  const row = S.rows.find((r) => r.a && r.a.id === 'packet:1');
  assert.ok(row && row.link, 'the certification pairs with something');
  assert.equal(row.link.finding.kind, 'polarity');
  assert.match(row.link.finding.headline, /denies what the other states/);
  assert.match(row.link.finding.headline, /video|surveillance|drone/);
  assert.equal(row.link.verdict, 'differs', 'a denial is a difference, not a resemblance');
  // marks are absolute offsets onto the words themselves
  const st = W.stsByDoc.packet[1]; const m = row.link.finding.marks.from[0];
  assert.match(W.docs[0].text.slice(m[0], m[1]).toLowerCase(), /video|surveillance|drone/);
});

test('finding: the same figure in both is "both state", with the figure marked', () => {
  const W = world([packet(), agreement(), ...filler()]);
  const row = R.seamOf(W, 'packet', 'agree').rows.find((r) => r.a && r.a.id === 'packet:2');
  assert.ok(row.link);
  assert.equal(row.link.finding.kind, 'same');
  assert.match(row.link.finding.headline, /\$3,946,041/);
});

test('finding: a phrase one source writes into a definition is a computed link to that definition', () => {
  const W = world([agreement(), ordinance(), ...filler()]);
  const ix = R.buildIndex(W);
  const L = R.definedLinks(W, ix);
  const drone = L.find((l) => l.from.doc === 'agree' && /drone/i.test(l.finding.terms[0]));
  assert.ok(drone, 'the agreement names drone software, which the ordinance lists');
  assert.equal(drone.to.doc, 'code');
  assert.equal(drone.provenance, 'computed');
  assert.equal(drone.finding.kind, 'defined');
  assert.match(drone.finding.headline, /definition of “Surveillance technology”/);
  const m = drone.finding.marks.from[0]; assert.match(W.docs.find((d) => d.id === 'agree').text.slice(m[0], m[1]).toLowerCase(), /^drone/);
  // a source does not define itself
  assert.equal(L.filter((l) => l.from.doc === l.to.doc).length, 0);
});

test('finding: a citation says which passage it lands on', () => {
  const W = world([lease(), act()]);
  const c = R.importCitations(W).links[0];
  assert.equal(c.finding.kind, 'cite');
  assert.match(c.finding.headline, /^Cites “§14/);
  assert.match(c.finding.headline, /not to exceed \$15/);
});

test('collect: every link a reader is shown carries a finding or says why not', () => {
  const W = world([packet(), agreement(), ordinance(), ...filler()]);
  const C = R.collect(W, {});
  const shown = C.links.filter((l) => l.source !== 'captions' && l.source !== 'title' && l.from.doc !== l.to.doc);
  assert.ok(shown.length > 0);
  shown.forEach((l) => assert.ok(l.finding && l.finding.headline, l.source + ' ' + l.relation + ' has no finding'));
});

// ── scope and absence: the two things the Motorola record turns on ──────────────────────────────────────────────────
// Lines of a source are its statements; blank lines stay in the text, so paragraphs can be told apart.
function mkLines(id, title, text) {
  const sts = []; let off = 0;
  text.split('\n').forEach((line, i) => {
    const t = line.trim();
    if (t.length) { const s = off + line.indexOf(t); sts.push({ id: id + ':' + i, doc: id, s, e: s + t.length, text: t, figs: [], names: [] }); }
    off += line.length + 1;
  });
  return { doc: { id, title, text }, sts };
}
const resolution = () => mkLines('res', 'RS2026-2264 resolution and certification', [
  'WHEREAS, the Purchasing Agent desires to participate in the master agreement between Sourcewell, a governmental agency,',
  'and Motorola Solutions, Inc., a copy of which is attached hereto and incorporated herein; and,',
  '',
  'WHEREAS, this agreement was requested by the Department of Emergency Communications for computer aided dispatch;',
  '',
  'Section 1. That the master agreement between Sourcewell and Motorola Solutions, a copy of which is attached hereto, is hereby approved.',
].join('\n'));
const exhibit = () => mkLines('exh', 'Sourcewell master agreement 030425 with Motorola Solutions', [
  'Computer Aided Dispatch',
  'Records Management System',
  'Drone Software and Hardware',
  'Public Safety Video Surveillance Solutions',
  'Data Migration Services',
  'Fleet Telematics Platform',
  'Payment is due within forty five days of each invoice.',
].join('\n'));
const debate = () => mkLines('deb', 'Council debate on RS2026-2264', [
  'I am worried about how long the vote will take tonight.',
  'In this exhibit, there are drones that may be purchased with this.',
  'Why is the existing contract not on a government website?',
  'The meeting was adjourned after the vote.',
].join('\n'));

test('scope: what the resolution approves against what the exhibit lists, led by what another source raised', () => {
  const W = world([resolution(), exhibit(), debate(), ...filler()]);
  const ix = R.buildIndex(W);
  const L = R.scopeLinks(W, ix);
  const main = L.find((l) => l.from.doc === 'res' && l.to.doc === 'exh' && l.to.kind === 'whole');
  assert.ok(main, 'the resolution is linked to the exhibit it attaches');
  assert.equal(main.finding.kind, 'scope');
  assert.match(main.finding.headline, /Drone Software and Hardware/);
  assert.match(main.finding.headline, /resolution never names/);
  const raised = L.find((l) => l.from.doc === 'deb' && l.to.doc === 'exh');
  assert.ok(raised, 'the statement that points at the exhibit is linked to the heading it names');
  assert.match(W.docs.find((d) => d.id === 'exh').text.slice(raised.to.s, raised.to.e), /^Drone Software/);
  assert.match(W.docs.find((d) => d.id === 'deb').text.slice(raised.from.s, raised.from.e).toLowerCase(), /^drone/);
  // an entry the resolution does name is not omitted
  assert.ok(!L.some((l) => l.finding && /Computer Aided Dispatch/.test(l.finding.headline) && /never names it/.test(l.finding.headline)));
  assert.ok(L.every((l) => l.finding && l.finding.marks), 'every one marks the words');
});

test('scope: a statement that only shares a word with a heading, without pointing at the exhibit, raises nothing', () => {
  const quiet = mkLines('deb', 'Council debate', ['Drones were discussed for an hour.', 'The vote was held after the meeting.'].join('\n'));
  const L = R.scopeLinks(world([resolution(), exhibit(), quiet, ...filler()]), R.buildIndex(world([resolution(), exhibit(), quiet, ...filler()])));
  assert.ok(!L.some((l) => l.from.doc === 'deb'));
  assert.doesNotMatch(L.find((l) => l.from.doc === 'res').finding.headline, /raised elsewhere/);
});

test('absent: a source says the existing contract is not available; the link says nothing here is that contract', () => {
  const W = world([resolution(), exhibit(), debate(), ...filler()]);
  const L = R.absentLinks(W, R.buildIndex(W));
  assert.equal(L.length, 1);
  assert.equal(L[0].finding.kind, 'absent');
  assert.equal(L[0].to.doc, 'exh');
  assert.match(L[0].finding.headline, /existing contract is not available/);
  const m = L[0].finding.marks.from; const t = W.docs.find((d) => d.id === 'deb').text;
  assert.deepEqual(m.map(([a, b]) => t.slice(a, b).toLowerCase()), ['existing contract', 'not on']);
});

test('absent: an ordinary reference to "the contract" is not a claim that one is missing', () => {
  const quiet = mkLines('deb', 'Debate', ['The contract is on the agenda tonight.', 'The existing contract expired in June.'].join('\n'));
  const W = world([resolution(), exhibit(), quiet, ...filler()]);
  assert.equal(R.absentLinks(W, R.buildIndex(W)).length, 0);
});

test('definitions: a lone generic word in a definition is not an example', () => {
  const D = mkDoc('code', 'Code', ['"Surveillance technology" shall mean any electronic surveillance device, hardware, or software that records location.']);
  const S = mkDoc('agree', 'Agreement', ['The hardware is delivered to the location named in the order.']);
  const W = world([D, S, ...filler()]);
  assert.equal(R.definedLinks(W, R.buildIndex(W)).length, 0);
});
