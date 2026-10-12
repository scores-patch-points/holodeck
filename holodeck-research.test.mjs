// holodeck-research.test.mjs — the research assistant's decisions: the two nulls, the mechanical reading, and the
// acquisition loop driven against a fake web. No network, no model, no clock.
//   node --test holodeck-research.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DRAWS, makeBackground, termsOf, relevance, keyness, earnedGain, earnedGainTest, wordsOf, stemOf, rng } from './holodeck-research-null.js';
import { readSource, splitStatements, figuresIn, namesIn, referentKey } from './holodeck-research-read.js';
import { research, normUrl, frontier, CONCURRENCY } from './holodeck-research.js';

// ── a stand-in for "ordinary English": a Zipf-ish vocabulary, deterministic ─────────────────────────────────────────
const COMMON = ('the of and to in a is that for it as was with be by on not he this are or his from at which but have an had they you were their one all we can her has there been if more when will would who so no ' +
  'she other its may these two time first new some could them than only about into over after most also made many then such out year people city river house water work world part place system states ' +
  'history long great small old large national public well state because between through during before under while where each same another found called known used between against might under still ' +
  'told said says report reported during later early late much very back down just good great made like make way even take used long right left high found three four five several').split(/\s+/);
const bgEntries = []; COMMON.forEach((w, i) => bgEntries.push([w, Math.max(2, Math.round(40000 / (1 + i * 0.9)))]));
const BG = makeBackground(bgEntries);

const clean = s => s.replace(/\s+/g, ' ').trim();
const rep = (s, n) => Array.from({ length: n }, () => s).join(' ');

test('keyness: text that says the question’s rare words again and again is outside every one of 199 draws', () => {
  const terms = termsOf('history of the Zorblatt lighthouse');
  const text = rep('The Zorblatt lighthouse stands on the old headland, and the Zorblatt keepers lit the lighthouse every night.', 6) + ' ' + rep('The water was cold and the people were long gone from the place.', 10);
  const r = relevance(terms, text, BG, { key: 'k1' });
  assert.equal(r.ok, true); assert.equal(r.draws, DRAWS);
  assert.equal(r.outside, true, JSON.stringify(r));
  assert.ok(r.g > r.nullMax);
  assert.ok(r.matched.some(m => m.stem === stemOf('zorblatt')));
});

test('FALSIFIER — one stray mention of a common query word is inside the null', () => {
  const terms = termsOf('history of the lighthouse');
  const text = rep('The people were in the city for a long time and the water was very cold and the river was high.', 40) + ' Some history.';
  const r = relevance(terms, text, BG, { key: 'k2' });
  assert.equal(r.ok, true);
  assert.equal(r.outside, false, 'a single common word in a long off-topic text must not clear the null: ' + JSON.stringify({ g: r.g, nullMax: r.nullMax }));
});

// a stretch of ordinary English: words drawn at the background's own rates (what a null draw looks like)
function ordinary(L, seed) {
  const r = rng(seed), tot = bgEntries.reduce((a, [, c]) => a + c, 0), out = [];
  for (let i = 0; i < L; i++) { let x = r() * tot, k = 0; while (x > bgEntries[k][1]) { x -= bgEntries[k][1]; k++; } out.push(bgEntries[k][0]); }
  return out.join(' ');
}

test('FALSIFIER — a long stretch of ordinary English is inside the null for a question made of ordinary words', () => {
  const terms = termsOf('who was the first to prove the Pythagorean theorem');
  for (const seed of [1, 2, 3, 4, 5]) {
    const r = relevance(terms, ordinary(600, seed), BG, { key: 'k3-' + seed });
    assert.equal(r.ok, true);
    assert.equal(r.outside, false, 'seed ' + seed + ': ' + JSON.stringify({ g: r.g, nullMax: r.nullMax, matched: r.matched }));
  }
});

test('relevance is seeded from its key: same material, same verdict; the numbers are in range', () => {
  const terms = termsOf('Zorblatt lighthouse keepers');
  const text = rep('The Zorblatt lighthouse keepers lit the lamp.', 3) + ' ' + rep('The people were in the city.', 8);
  const a = relevance(terms, text, BG, { key: 'same' }), b = relevance(terms, text, BG, { key: 'same' });
  assert.deepEqual(a, b);
  assert.ok(a.nullMax >= a.nullMedian && a.nullMedian >= 0);
  assert.ok(a.p >= 1 / (DRAWS + 1) - 1e-12 && a.p <= 1);
});

test('without a background, relevance is typed undecided — never guessed', () => {
  const r = relevance(termsOf('Zorblatt lighthouse'), 'The Zorblatt lighthouse.', makeBackground([]), { key: 'x' });
  assert.equal(r.ok, false); assert.match(r.why, /background/);
  assert.equal(relevance([], 'text', BG).ok, false);
});

test('a word the prior has never seen is the rarest thing it can say (add-one smoothing)', () => {
  assert.ok(BG.p(stemOf('zorblatt')) < BG.p(stemOf('history')));
  assert.ok(BG.p(stemOf('zorblatt')) > 0);
});

test('property — G is non-decreasing in how many times a query term is said, for a fixed length', () => {
  const terms = termsOf('Zorblatt lighthouse');
  const r = rng(7);
  for (let trial = 0; trial < 40; trial++) {
    const L = 200 + Math.floor(r() * 800), c1 = Math.floor(r() * 6), c2 = c1 + 1 + Math.floor(r() * 6);
    const mk = c => { const m = new Map(); if (c) m.set(stemOf('zorblatt'), c); return keyness(terms, m, L, BG).g; };
    assert.ok(mk(c2) >= mk(c1), `L=${L} ${c1}->${c2}`);
  }
});

// ── corroboration gain ──────────────────────────────────────────────────────────────────────────────────────────────
const S = (...xs) => new Set(xs);
test('earnedGain counts only referents that cross support 2, via the corpus or via the batch itself', () => {
  const prior = new Map([['a', 1], ['b', 2], ['c', 1]]);
  const g = earnedGain(prior, [S('a', 'b', 'x'), S('x', 'y')]);
  assert.equal(g.delta, 2);            // a: 1->2 (via corpus), x: 0->2 (via the batch). b was already earned; y has one witness.
  assert.equal(g.viaCorpus, 1); assert.equal(g.viaBatch, 1);
});

test('no earlier sources, no null: the first batch is untestable, with the reason', () => {
  const t = earnedGainTest(new Map(), [S('a', 'b'), S('a')], { key: 'k' });
  assert.equal(t.testable, false); assert.match(t.why, /baseline/);
});

test('a batch that only re-witnesses already-earned referents is inside the null (the corpus has stopped learning)', () => {
  const prior = new Map(); for (const n of ['alpha', 'beta', 'gamma', 'delta', 'epsilon']) prior.set(n, 3);
  for (let i = 0; i < 8; i++) prior.set('single' + i, 1);
  const batch = [S('alpha', 'beta', 'gamma'), S('beta', 'delta'), S('alpha', 'epsilon', 'delta')];
  const t = earnedGainTest(prior, batch, { key: 'sat' });
  assert.equal(t.testable, true); assert.equal(t.observed, 0);
  assert.equal(t.outside, false);
});

test('a batch that carries what was heard once across the line beats re-sampling the corpus', () => {
  const prior = new Map(); for (const n of ['alpha', 'beta', 'gamma']) prior.set(n, 6);
  for (let i = 0; i < 10; i++) prior.set('rare' + i, 1);
  // each batch source says some of the once-heard names — a sub-region the corpus had barely touched
  const batch = [S('rare0', 'rare1', 'rare2', 'alpha'), S('rare3', 'rare4', 'rare5', 'beta'), S('rare6', 'rare7', 'rare8', 'gamma')];
  const t = earnedGainTest(prior, batch, { key: 'learn' });
  assert.equal(t.observed, 9);
  assert.equal(t.outside, true, JSON.stringify(t));
  assert.ok(t.p <= 1 / DRAWS + 1e-9 + 0.005);
});

test('the gain null is deterministic for its key', () => {
  const prior = new Map([['a', 2], ['b', 1], ['c', 1], ['d', 1], ['e', 4]]);
  const batch = [S('b', 'c', 'a'), S('d', 'e')];
  assert.deepEqual(earnedGainTest(prior, batch, { key: 'z' }), earnedGainTest(prior, batch, { key: 'z' }));
});

test('property — the gain does not depend on the order of the batch’s sources', () => {
  const r = rng(11);
  for (let t = 0; t < 30; t++) {
    const prior = new Map(); for (let i = 0; i < 12; i++) prior.set('p' + i, 1 + Math.floor(r() * 3));
    const batch = Array.from({ length: 3 }, () => new Set(Array.from({ length: 4 }, () => 'p' + Math.floor(r() * 16))));
    const a = earnedGain(prior, batch).delta, b = earnedGain(prior, [...batch].reverse()).delta;
    assert.equal(a, b);
  }
});

// ── the mechanical reading ──────────────────────────────────────────────────────────────────────────────────────────
test('every statement slices back out of its source by its own span', () => {
  const text = 'Dr. Mara Quill led the survey in 1904. It cost $5 million.\n\nThe Zorblatt lighthouse opened in 1911! Was it finished? Yes.';
  const { sts } = readSource(text);
  assert.ok(sts.length >= 3);
  for (const st of sts) assert.equal(text.slice(st.s, st.e), st.text);
});

test('a sentence-opening word is not a name unless the source writes it capitalised mid-sentence', () => {
  const a = readSource('Because the harbour froze, Mara Quill left. However the ice melted.');
  const refs = a.referents;
  assert.ok(refs.includes('mara quill'));
  assert.ok(!refs.includes('because') && !refs.includes('however'));
  const b = readSource('Yesterday we met Harbour. The harbour is old. We saw Harbour again.');
  assert.ok(b.referents.includes('harbour'));
});

test('a year is a date, not a figure; money and percent are figures with units', () => {
  assert.equal(figuresIn('Built in 1911.').length, 0);
  const f = figuresIn('It cost $5 million and 12 percent of it was lost.');
  assert.deepEqual(f.map(x => x.unit), ['dollars', 'percent']);
  assert.equal(f[0].value, 5e6);
});

test('a referent is its folded self: case, accents, a leading “the”', () => {
  assert.equal(referentKey('The Zürich Lighthouse'), referentKey('zurich lighthouse'));
});

// ── the acquisition loop against a fake web ─────────────────────────────────────────────────────────────────────────
const P = (title, body) => ({ title, text: body });
const onTopic = (extra = '', names = ['Mara Quill', 'Port Venn']) =>
  rep('The Zorblatt lighthouse at ' + names[1] + ' was kept by ' + names[0] + ' for many years and the Zorblatt lighthouse lamp was lit every night.', 3) + ' ' + extra + ' ' + rep('The water was cold and people came from the city to see it.', 4);

function fakeWeb(spec) {
  const calls = { search: [], read: [] };
  const web = {
    calls,
    search: async (scope, q) => {
      calls.search.push([scope, q]);
      const s = spec.lanes[scope]; if (!s) throw new Error(scope + ' did not answer.');
      if (s instanceof Error) throw s;
      return { results: s.map(u => ({ title: spec.pages[u].title, url: u, snippet: spec.pages[u].snippet || spec.pages[u].text.slice(0, 160), source: new URL(u).hostname })), engine: scope.toUpperCase() };
    },
    read: async url => {
      calls.read.push(url);
      const p = spec.pages[url];
      if (!p || p.unreadable) return { ok: false, error: p && p.unreadable, tried: ['direct', 'relay', 'public proxy', 'text reader'] };
      return { ok: true, text: p.text, title: p.title, via: p.via || 'direct', url };
    },
  };
  return web;
}
const events = [];
const base = (web, over = {}) => ({ search: web.search, read: web.read, background: BG, emit: e => events.push(e), route: () => ({ scopes: ['web', 'wikipedia'], why: { web: 'always', wikipedia: 'encyclopedic ask' }, rest: ['github', 'archive'] }), ...over });

test('it streams lanes, searches, candidates, reads, batches and one stop — in that order', async () => {
  events.length = 0;
  const pages = {}, urls = [];
  for (let i = 0; i < 6; i++) { const u = 'https://site' + i + '.example/zorblatt'; urls.push(u); pages[u] = P('Zorblatt lighthouse ' + i, onTopic(' ' + 'Extra detail ' + i + '.')); }
  const web = fakeWeb({ lanes: { web: urls, wikipedia: [] }, pages });
  const run = await research('history of the Zorblatt lighthouse', base(web));
  const kinds = events.map(e => e.t);
  assert.equal(kinds[0], 'lanes');
  assert.equal(kinds.at(-1), 'stop');
  assert.ok(kinds.indexOf('search') < kinds.indexOf('candidate'));
  assert.ok(kinds.indexOf('candidate') < kinds.indexOf('read'));
  assert.ok(kinds.indexOf('read') < kinds.indexOf('batch'));
  assert.equal(kinds.filter(k => k === 'stop').length, 1);
  assert.equal(run.schema, 'HolodeckResearchRun@1');
});

test('candidates the null turns away are listed with the numbers and are never read', async () => {
  const pages = {
    'https://a.example/zorblatt': P('Zorblatt lighthouse', onTopic()),
    'https://b.example/bread': P('How to bake sourdough bread', rep('Mix the flour and the water and let the dough rest in the warm place for a long time.', 6)),
  };
  const web = fakeWeb({ lanes: { web: Object.keys(pages), wikipedia: [] }, pages });
  const run = await research('history of the Zorblatt lighthouse', base(web));
  assert.ok(!web.calls.read.includes('https://b.example/bread'));
  const gap = run.gaps.find(g => g.kind === 'turned-away');
  assert.ok(gap && /ordinary English/.test(gap.why) && /vs the null/.test(gap.why));
  assert.equal(run.sources.length, 1);
});

test('an unreadable page is a typed gap with its reason, and the run goes on', async () => {
  const pages = {
    'https://a.example/zorblatt': P('Zorblatt lighthouse', onTopic()),
    'https://js.example/zorblatt': { title: 'Zorblatt lighthouse (app)', text: '', snippet: 'Zorblatt lighthouse history and the Zorblatt keepers', unreadable: 'the page has no text without running its scripts' },
  };
  const web = fakeWeb({ lanes: { web: Object.keys(pages), wikipedia: [] }, pages });
  const run = await research('history of the Zorblatt lighthouse', base(web));
  const g = run.gaps.find(x => x.kind === 'unread');
  assert.ok(g && /scripts/.test(g.why) && Array.isArray(g.tried));
  assert.equal(run.sources.length, 1);
});

test('a page that is read but is not about the question is refused with its numbers, and stays out of the corpus', async () => {
  const pages = {
    'https://a.example/zorblatt': P('Zorblatt lighthouse', onTopic()),
    // the snippet clears the gate; the page, once read, is mostly something else
    'https://c.example/tide': { title: 'Zorblatt lighthouse tide tables', snippet: 'Zorblatt lighthouse tide tables and the Zorblatt lamp', text: rep('Tide tables for the harbour list the high water and the low water at each hour of the day.', 20) },
  };
  const web = fakeWeb({ lanes: { web: Object.keys(pages), wikipedia: [] }, pages });
  const run = await research('history of the Zorblatt lighthouse', base(web));
  const g = run.gaps.find(x => x.kind === 'off-topic-when-read');
  assert.ok(g && /not about the question/.test(g.why));
  assert.deepEqual(run.sources.map(s => s.url), ['https://a.example/zorblatt']);
});

test('reading stops when a batch is inside the null, and the stop carries the numbers', async () => {
  const pages = {}, urls = [];
  // two batches of three on-topic pages that say the same thing: the second adds nothing the first did not earn
  for (let i = 0; i < 6; i++) { const u = 'https://s' + i + '.example/z'; urls.push(u); pages[u] = P('Zorblatt lighthouse ' + i, onTopic('', ['Mara Quill', 'Port Venn'])); }
  const web = fakeWeb({ lanes: { web: urls, wikipedia: [] }, pages });
  const run = await research('history of the Zorblatt lighthouse', base(web, { route: () => ({ scopes: ['web'], why: {}, rest: [] }) }));
  assert.equal(run.stop.reason, 'inside-the-null');
  assert.ok(run.stop.test && typeof run.stop.test.nullMax === 'number' && run.stop.test.observed <= run.stop.test.nullMax);
  assert.match(run.stop.detail, /across the earned line/);
  assert.equal(run.batches.length, 2);
  assert.equal(run.sources.length, CONCURRENCY * 2);
});

test('when the gated pool runs out while the corpus is still learning, it widens to the lanes the router held back', async () => {
  // batch 1 names once-heard people; the held-back lane's pages say them again (and more), so widening is what earns them
  const a = (i, who) => P('Zorblatt lighthouse ' + i, onTopic(who.join(' and ') + ' signed the Zorblatt lighthouse log.', ['Mara Quill', 'Port Venn']));
  const pages = {
    'https://w1.example/z': a(1, ['Ivo Harlow', 'Teodora Finch']), 'https://w2.example/z': a(2, ['Ruth Okafor', 'Silas Brandt']), 'https://w3.example/z': a(3, ['Anselm Vogt', 'Perpetua Lund']),
    'https://g1.example/z': a(4, ['Ivo Harlow', 'Ruth Okafor']), 'https://g2.example/z': a(5, ['Teodora Finch', 'Anselm Vogt']), 'https://g3.example/z': a(6, ['Silas Brandt', 'Perpetua Lund']),
  };
  const web = fakeWeb({ lanes: { web: ['https://w1.example/z', 'https://w2.example/z', 'https://w3.example/z'], github: ['https://g1.example/z', 'https://g2.example/z', 'https://g3.example/z'] }, pages });
  const run = await research('history of the Zorblatt lighthouse', base(web, { route: () => ({ scopes: ['web'], why: { web: 'always' }, rest: ['github'] }) }));
  assert.ok(run.rounds.some(r => r.kind === 'widened' && r.scopes.includes('github')), JSON.stringify(run.rounds));
  assert.ok(run.sources.length >= 6);
  assert.ok(web.calls.search.some(c => c[0] === 'github'));
});

test('a lane that throws is a typed gap; the other lanes still answer', async () => {
  const pages = { 'https://a.example/zorblatt': P('Zorblatt lighthouse', onTopic()) };
  const web = fakeWeb({ lanes: { web: Object.keys(pages), wikipedia: new Error('Wikipedia answered 503.') }, pages });
  const run = await research('history of the Zorblatt lighthouse', base(web));
  const g = run.gaps.find(x => x.kind === 'lane-failed');
  assert.ok(g && g.scope === 'wikipedia' && /503/.test(g.why));
  assert.equal(run.sources.length, 1);
});

test('the same address from two lanes is one candidate that remembers both', async () => {
  const u = 'https://en.wikipedia.org/wiki/Zorblatt_lighthouse';
  const pages = { [u]: P('Zorblatt lighthouse - Wikipedia', onTopic()) };
  const web = fakeWeb({ lanes: { web: [u], wikipedia: [u + '#History'] }, pages: { ...pages, [u + '#History']: pages[u] } });
  const run = await research('history of the Zorblatt lighthouse', base(web));
  assert.equal(run.candidates.length, 1);
  assert.deepEqual(run.candidates[0].found.map(f => f.scope).sort(), ['web', 'wikipedia']);
  assert.equal(normUrl('https://www.Example.com/a/?utm_source=x#frag'), 'example.com/a');
});

test('stopping it says so and keeps what was read', async () => {
  const ctl = new AbortController();
  const pages = {}, urls = [];
  for (let i = 0; i < 9; i++) { const u = 'https://s' + i + '.example/z'; urls.push(u); pages[u] = P('Zorblatt lighthouse ' + i, onTopic(' Detail ' + i + ' Person' + i + ' Harlow.')); }
  const web = fakeWeb({ lanes: { web: urls }, pages });
  const run = await research('history of the Zorblatt lighthouse', base(web, { signal: ctl.signal, route: () => ({ scopes: ['web'], why: {}, rest: [] }), emit: e => { if (e.t === 'batch') ctl.abort(); } }));
  assert.equal(run.stop.reason, 'aborted');
  assert.ok(run.sources.length >= 1 && run.sources.length <= CONCURRENCY);
});

test('with no background the run says relevance was not measured and reads in lane order', async () => {
  events.length = 0;
  const pages = { 'https://a.example/x': P('Anything', rep('Plain words about nothing in particular at all.', 4)), 'https://b.example/y': P('Else', onTopic()) };
  const web = fakeWeb({ lanes: { web: Object.keys(pages) }, pages });
  const run = await research('history of the Zorblatt lighthouse', base(web, { background: null, route: () => ({ scopes: ['web'], why: {}, rest: [] }) }));
  assert.ok(events.some(e => e.t === 'note' && /NOT measured/.test(e.why)));
  assert.ok(run.candidates.every(c => c.verdict === 'admitted'));
  assert.deepEqual(web.calls.read.slice(0, 2), Object.keys(pages));
});

test('no lane answers: the run ends with no-candidates and says how many searches failed', async () => {
  const web = fakeWeb({ lanes: { web: new Error('Web search answered 502'), wikipedia: new Error('Wikipedia did not answer.') }, pages: {} });
  const run = await research('history of the Zorblatt lighthouse', base(web));
  assert.equal(run.stop.reason, 'no-candidates');
  assert.match(run.stop.detail, /searches failed/);
});

test('frontier names the strongest earned referent that is not already in the question or followed', () => {
  const support = new Map([['mara quill', 4], ['zorblatt lighthouse', 6], ['port venn', 3], ['ivo harlow', 1]]);
  const surface = new Map([['mara quill', 'Mara Quill'], ['port venn', 'Port Venn'], ['zorblatt lighthouse', 'Zorblatt Lighthouse']]);
  const qs = wordsOf('history of the Zorblatt lighthouse').map(stemOf);
  assert.equal(frontier(support, surface, qs, new Set()).surface, 'Mara Quill');
  assert.equal(frontier(support, surface, qs, new Set(['mara quill'])).surface, 'Port Venn');
  assert.equal(frontier(support, surface, qs, new Set(['mara quill', 'port venn'])), null);
});

test('a control run that ignores the stop reads on, and still records where the null would have stopped it', async () => {
  const pages = {}, urls = [];
  for (let i = 0; i < 9; i++) { const u = 'https://s' + i + '.example/z'; urls.push(u); pages[u] = P('Zorblatt lighthouse ' + i, onTopic('', ['Mara Quill', 'Port Venn'])); }
  const mk = () => fakeWeb({ lanes: { web: urls }, pages });
  const route = () => ({ scopes: ['web'], why: {}, rest: [] });
  const stopped = await research('history of the Zorblatt lighthouse', base(mk(), { route }));
  const control = await research('history of the Zorblatt lighthouse', base(mk(), { route, noStop: true }));
  assert.equal(stopped.stop.reason, 'inside-the-null');
  assert.equal(control.sources.length, 9);
  assert.equal(control.wouldStopAt, stopped.batches.length);
  assert.ok(stopped.sources.length < control.sources.length);
});
