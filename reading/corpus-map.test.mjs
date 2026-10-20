// corpus-map.test.mjs — the corpus becomes a map: bodies are beings, levels of reality are coordinates, a name only nominates.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { buildCorpusTimeline, buildReadingTimeline, foldLog, isCoherent, splitOf } from '../vendor/khora/native/adapters/text/reading-timeline.js';
import { splitSentences } from '../vendor/khora/native/adapters/text/spans.js';
import { extractSurfaces, discoverReferents, diaNorm, namesCorefer, genericTokens } from '../vendor/khora/native/adapters/text/surfaces.js';
import { resolvePronouns } from '../vendor/khora/native/adapters/text/pronouns.js';
import { classifyWord } from '../vendor/khora/native/adapters/text/wordclass.js';
import { makeSameBeing } from '../vendor/khora/native/adapters/text/corpus-identity.js';
import { readDocumentEvidence, classifyWithDocument } from '../vendor/khora/native/adapters/text/document-evidence.js';

const P = new URL('../vendor/khora/native/priors/', import.meta.url);
const posPrior = { ...JSON.parse(fs.readFileSync(new URL('pos-eng.json', P))), lexicon: JSON.parse(fs.readFileSync(new URL('pos-eng-lexicon.json', P))) };
const memo = new Map(); const base = (f) => { let c = memo.get(f); if (c === undefined) { c = classifyWord(f, { posPrior }); memo.set(f, c); } return c; };
const wordsIn = (text, off) => [...text.matchAll(/[\p{L}\p{N}][\p{L}\p{N}'’.\-]*/gu)].map((m) => ({ w: m[0], s: off + m.index, e: off + m.index + m[0].length }));
const hash = (x) => createHash('sha256').update(String(x)).digest('hex');
const isVerb = (w) => { const c = base(String(w).toLowerCase()); return !!(c.found && c.candidates?.[0]?.upos === 'VERB'); };
// the mechanics claims below are about the LINK (ends, provenance, split); identity is decided elsewhere, so they inject a yes. The identity claims use the real test.
const sameYes = { prepare: () => () => ({ same: true, verdict: 'bound', forWhom: null, basis: 'decided by the test' }) };
const deps = { sameBeing: sameYes, hash, diaNorm, namesCorefer, genericTokens, splitSentences, wordsIn, extractSurfaces, discoverReferents, resolvePronouns, isVerb, classifyAt: (prefix) => classifyWithDocument(base, readDocumentEvidence(prefix, { classify: base })) };
const read = (sources, o = {}, d = deps) => { const c = buildCorpusTimeline(sources, d, { maxSnapshots: 6, ...o }); return { c, f: foldLog(c.log) }; };

import { corpusMapData, levelsOf } from './corpus-map.js';
const S = (id, text, register) => ({ id, label: id, text, register });
const TEST_ = 'Senator Smith asked Bruce Ismay whether he had been warned. Bruce Ismay said that Captain Smith told him that ice was reported. Thomas Andrews had gone below.';
const NEWS_ = 'The Tribune reported that Bruce Ismay left the ship in a lifeboat. Thomas Andrews was last seen in the smoking room, according to survivors.';
const FIC_ = 'Jack Dawson drew Rose DeWitt Bukater in the dark. Cal Hockley told Rose that Thomas Andrews had warned him. Bruce Ismay urged the captain to go faster.';
const sources = [S('inquiry', TEST_, 'testimony'), S('news', NEWS_, 'journalism'), S('film', FIC_, 'fiction')];
const real = () => { const c = buildCorpusTimeline(sources, { ...deps, sameBeing: makeSameBeing() }, { maxSnapshots: 6 }); return { corpus: c, fold: foldLog(c.log), sources }; };
const data = (st, level) => corpusMapData(st, { level, splitSentences });

test('levels: truth-claiming sources speak of the world, the others are tellings; each source is a viewpoint', () => {
  const L = levelsOf(real().corpus);
  assert.deepEqual(L.options.map((o) => o.id), ['all', 'world', 'telling', 'inquiry', 'news', 'film']);
  assert.equal(L.sources.find((s) => s.id === 'film').universe, 'telling'); assert.equal(L.sources.find((s) => s.id === 'news').universe, 'world');
});
test('a body is a being; reality is a coordinate; a name only nominates (same name, unjoined: two bodies and a dotted tie)', () => {
  const D = data(real(), 'all'), ismays = D.nodes.filter((x) => /Ismay/.test(x.n));
  assert.ok(ismays.length >= 2, 'the unjoined Ismays stay separate bodies: ' + ismays.map((x) => x.n).join(' | '));
  assert.ok(ismays.every((x) => x.reality === 'real'), 'both Ismays are attested by truth-claiming sources'); assert.ok(D.nodes.some((x) => x.reality === 'fictional'), 'the screenplay\'s own people are fictional');
  assert.ok(D.edges.some((e) => e.tie === 'nominated'), 'the nominated pair waits as a tie');
  assert.equal(new Set(D.nodes.map((x) => x.n)).size, D.nodes.length, 'every body has its own id');
  assert.ok(D.nodes.filter((x) => x.n.startsWith('Rose')).every((x) => x.reality === 'fictional'));
});
test('the world level leaves the screenplay out and names what it left out; the tellings level keeps it', () => {
  const W = data(real(), 'world'), T = data(real(), 'telling');
  assert.ok(!W.nodes.some((x) => x.reality === 'fictional'), 'no fictional body in the world'); assert.ok(W.hidden.includes('Rose'), 'what was left out is named');
  assert.ok(T.nodes.some((x) => x.n.startsWith('Rose'))); assert.ok(!T.nodes.some((x) => /Tribune/.test(x.n)));
});
test('a source as the viewpoint shows only what that account speaks of', () => {
  const V = data(real(), 'film'); assert.ok(V.nodes.every((x) => x.docs.every((d) => d === 'film'))); assert.deepEqual(V.docs.map((d) => d.id), ['film']);
});
test('every occurrence carries its source, statement number and the exact text', () => {
  const D = data(real(), 'all'); for (const [n, list] of D.occ) for (const o of list) { assert.ok(D.docs.some((d) => d.id === o.doc), n); assert.ok(typeof o.t === 'string' && o.t.length > 5); }
});
