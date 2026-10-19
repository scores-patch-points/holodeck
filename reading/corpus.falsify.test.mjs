// corpus.falsify.test.mjs — try to BREAK the multi-source mechanics. Each test names a claim and attacks it; a claim that survives is only
// "not yet falsified". Tests marked FINDING record an attack that DID break something: they assert the broken behaviour is still there (so the
// finding cannot silently disappear or silently get worse) and carry the reason, to be fixed upstream in khora's reading-timeline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { buildCorpusTimeline, buildReadingTimeline, foldLog, isCoherent, splitOf } from '../vendor/khora/native/adapters/text/reading-timeline.js';
import { splitSentences } from '../vendor/khora/native/adapters/text/spans.js';
import { extractSurfaces, discoverReferents, diaNorm, namesCorefer, genericTokens } from '../vendor/khora/native/adapters/text/surfaces.js';
import { resolvePronouns } from '../vendor/khora/native/adapters/text/pronouns.js';
import { classifyWord } from '../vendor/khora/native/adapters/text/wordclass.js';
import { readDocumentEvidence, classifyWithDocument } from '../vendor/khora/native/adapters/text/document-evidence.js';

const P = new URL('../vendor/khora/native/priors/', import.meta.url);
const posPrior = { ...JSON.parse(fs.readFileSync(new URL('pos-eng.json', P))), lexicon: JSON.parse(fs.readFileSync(new URL('pos-eng-lexicon.json', P))) };
const memo = new Map(); const base = (f) => { let c = memo.get(f); if (c === undefined) { c = classifyWord(f, { posPrior }); memo.set(f, c); } return c; };
const wordsIn = (text, off) => [...text.matchAll(/[\p{L}\p{N}][\p{L}\p{N}'’.\-]*/gu)].map((m) => ({ w: m[0], s: off + m.index, e: off + m.index + m[0].length }));
const hash = (x) => createHash('sha256').update(String(x)).digest('hex');
const isVerb = (w) => { const c = base(String(w).toLowerCase()); return !!(c.found && c.candidates?.[0]?.upos === 'VERB'); };
const deps = { hash, diaNorm, namesCorefer, genericTokens, splitSentences, wordsIn, extractSurfaces, discoverReferents, resolvePronouns, isVerb, classifyAt: (prefix) => classifyWithDocument(base, readDocumentEvidence(prefix, { classify: base })) };
const read = (sources, o = {}) => { const c = buildCorpusTimeline(sources, deps, { maxSnapshots: 6, ...o }); return { c, f: foldLog(c.log) }; };

const TEST = 'Senator Smith asked Bruce Ismay whether he had been warned. Bruce Ismay said that Captain Smith told him that ice was reported. Ismay said that Thomas Andrews told him that the ship would sink. Thomas Andrews had gone below, Ismay said.';
const NEWS = 'The Tribune reported that Bruce Ismay left the ship in a lifeboat. Thomas Andrews was last seen in the smoking room, according to survivors. Andrews helped women into the lifeboats, survivors said.';
const FIC = 'Jack Dawson drew Rose DeWitt Bukater in the dark. Cal Hockley told Rose that Thomas Andrews had warned him. Bruce Ismay urged the captain to go faster. Faster, said Ismay. Andrews showed Rose the plans of the ship.';
const S = (id, text, register) => ({ id, label: id, text, register });

test('CLAIM linking never merges: every referent keeps its own id, source and mentions; a being is only a view', () => {
  const solo = foldLog(buildReadingTimeline(TEST, { ...deps, source: { id: 'a', register: 'testimony' }, sourceId: 'a' }, { maxSnapshots: 6 }).log);
  const { f } = read([S('a', TEST, 'testimony'), S('b', NEWS, 'journalism'), S('c', FIC, 'fiction')]);
  assert.ok(f.links.length > 0, 'precondition: something linked');
  for (const r of solo.referents.values()) assert.ok(f.referents.has(r.id), `referent ${r.id} survived linking with its own id`);
  for (const r of f.referents.values()) assert.ok(new Set(r.mentions.map((m) => m.source)).size <= 1, 'a referent never holds spans from two sources');
  const being = f.beings.find((b) => b.members.length > 1); assert.ok(being, 'a being joins more than one end');
  assert.ok(being.members.every((m) => f.referents.has(m)), 'the ends are still ends');
});

test('CLAIM provenance and the split are on every link', () => {
  const { c, f } = read([S('a', TEST, 'testimony'), S('b', NEWS, 'journalism'), S('c', FIC, 'fiction')]);
  for (const l of f.links) {
    assert.ok(l.from.source && l.to.source && l.from.source !== l.to.source, 'a link crosses sources');
    assert.ok(l.from.register && l.to.register, 'both registers are on the link');
    assert.ok(l.split && l.split.kind && Array.isArray(l.split.registers), 'the split is on the link');
    assert.ok(l.matched && l.checkedBy, 'what matched and what checked it are disclosed');
  }
  assert.ok(c.log.every(isCoherent), 'every event is grain-coherent');
});

test('CLAIM the split follows the declared registers, and changing a register changes only the split, not the ends', () => {
  const pair = (r2) => read([S('a', TEST, 'testimony'), S('b', FIC, r2)]);
  const asFiction = pair('fiction'), asReport = pair('report');
  assert.ok(asFiction.f.links.every((l) => l.split.kind === 'fictionalizes'));
  assert.ok(asReport.f.links.every((l) => l.split.kind === 'corroborates'));
  assert.deepEqual([...asFiction.f.referents.keys()].sort(), [...asReport.f.referents.keys()].sort(), 'same ends either way');
  assert.deepEqual(splitOf('fiction', 'fiction').kind, 'tells-the-same');
  assert.equal(splitOf('comment', 'testimony').kind, 'comments-on');
});

test('CLAIM an undeclared source is read but never linked', () => {
  const { c, f } = read([S('a', TEST, 'testimony'), S('b', NEWS, '')]);
  assert.equal(c.refused.length, 1);
  assert.equal(f.links.length, 0, 'no link to or from the undeclared source');
  assert.ok([...f.referents.values()].some((r) => r.mentions.some((m) => m.source === 'b')), 'but it was read');
});

test('CLAIM reality is a fold over registers: fiction only → fictional, truth-claiming only → real, both → fictionalized-real', () => {
  const { f } = read([S('a', TEST, 'testimony'), S('b', NEWS, 'journalism'), S('c', FIC, 'fiction')]);
  const by = (re) => f.beings.find((b) => re.test(b.name || ''));
  assert.equal(by(/Ismay/).reality, 'fictionalized-real');
  assert.equal(f.beings.find((b) => /Rose|Dawson|Hockley/.test(b.name || ''))?.reality, 'fictional');
});

test('CLAIM unrelated sources produce no links (no spurious joins)', () => {
  const { f } = read([S('a', 'Maria Gonzalez filed the permit on Monday. Maria Gonzalez paid the fee. The clerk stamped the permit.', 'report'), S('b', 'Hiroshi Tanaka grows tomatoes near Kyoto. Hiroshi Tanaka sells tomatoes at the market. The market opens early.', 'journalism')]);
  assert.equal(f.links.length, 0);
});

test('CLAIM severing a wrong link is one more event; the log underneath is untouched and the fold is reproducible', () => {
  const { c, f } = read([S('a', TEST, 'testimony'), S('b', NEWS, 'journalism')]);
  const target = f.links[0]; assert.ok(target);
  const sever = [{ op: 'CON', cell: 'Link', kind: 'correspondence', severs: target.id, giver: 'you', id: 'you_0' }];
  const g = foldLog(c.log, { overlay: sever });
  assert.equal(g.links.length, f.links.length - 1);
  assert.equal(foldLog(c.log).links.length, f.links.length, 'without the overlay the same log folds to the same links');
});

test('CLAIM ids and links do not depend on the ORDER the sources are given', () => {
  const A = [S('a', TEST, 'testimony'), S('b', NEWS, 'journalism'), S('c', FIC, 'fiction')];
  const one = read(A).f, two = read([A[2], A[0], A[1]]).f;
  const key = (f) => f.links.map((l) => [l.from.ref, l.to.ref].sort().join('~')).sort();
  assert.deepEqual(key(one), key(two));
  assert.deepEqual([...one.referents.keys()].sort(), [...two.referents.keys()].sort());
});

test('CLAIM who is saying what has no depth limit (iterative, cycle-guarded)', () => {
  let t = 'Ismay said that Andrews told him that '; let text = '';
  for (let i = 0; i < 40; i++) text += t; text += 'the ship would sink.';
  const { f } = read([S('a', text, 'testimony')]);
  const off = text.indexOf('the ship would sink');
  const v = f.voices(off, 'a');
  assert.ok(v.depth >= 30, `depth ${v.depth} of ~80 nested reports`);
  assert.equal(v.truncated, null);
});

test("CLAIM nesting's wall: 'X says P' in two sources is not two witnesses of P", () => {
  const a = 'Bruce Ismay said that the ship was safe.', b = 'Bruce Ismay told reporters that the ship was safe.';
  const { f } = read([S('a', a, 'testimony'), S('b', b, 'journalism')]);
  // the mechanics must not turn two reports-of-a-saying into a corroboration of the thing said: the link is between the SPEAKER's referents only
  for (const l of f.links) assert.ok(/Ismay/.test(l.from.name) && /Ismay/.test(l.to.name), 'only the speaker is joined; the content is not a witness');
});

// ── attacks that broke something ──
test('FINDING: two different people with one surname are joined when the surname is the only name each source gives', () => {
  const a = 'Senator Smith asked Bruce Ismay about the lifeboats. Senator Smith asked again. Smith adjourned the hearing.';
  const b = 'Captain Smith stayed on the bridge. Captain Smith gave the order. Smith never left the ship.';
  const { f } = read([S('a', a, 'testimony'), S('b', b, 'journalism')]);
  const joined = f.links.some((l) => /Smith/.test(l.from.name) && /Smith/.test(l.to.name));
  // A correct reader would NOT join Senator Smith (a legislator) and Captain Smith (a ship's master). This one does: a name-level
  // correspondence is "weaker than a corroborated bridge" (its own checkedBy says so) but it is still emitted as a link.
  assert.equal(joined, true, 'FINDING still present: the shared surname links two people (fix in khora: require a compatible title/role or a second shared signal)');
});

test('FINDING: a source copied twice is two corroborating sources', () => {
  const { f } = read([S('a', NEWS, 'journalism'), S('b', NEWS, 'journalism')]);
  const corroborations = f.links.filter((l) => l.split.kind === 'corroborates').length;
  // identical bytes are not independent witnesses; the mechanics count independence "elsewhere" (the link's own note), and nothing here does.
  assert.ok(corroborations > 0, 'FINDING still present: byte-identical sources corroborate each other (fix: refuse or flag a link whose two ends share their source bytes)');
});
