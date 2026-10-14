// holodeck-field-topics.test.mjs — fieldTopics (the Topics rail for a workspace whose sources carry stated fields).
// The function lives in index.html's inline script; the slice from FIELD_META_SKIP to loadAdded() is evaluated here
// on its own (it depends on nothing outside that slice). Fixtures are synthetic Metro-contract rows built by
// toDoc(), so the field names are the ones the VM workspace really carries.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { toDoc } from './holodeck-vm-contracts.js';

const src = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const a = src.indexOf('const FIELD_META_SKIP'), b = src.indexOf('function loadAdded()');
assert.ok(a > 0 && b > a, 'the field-topics slice is findable');
const { fieldCatalog, fieldTopics } = vm.runInNewContext(src.slice(a, b) + '\n;({ fieldCatalog, fieldTopics })', {});

// deterministic words: a per-subject vocabulary and a shared filler vocabulary
let seed = 7; const rnd = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const vocab = (tag, n) => Array.from({ length: n }, (_, i) => tag + String.fromCharCode(97 + (i % 26)) + String.fromCharCode(97 + (Math.floor(i / 26) % 26)) + 'xq');
const FILLER = vocab('fill', 400);
const gist = (subject, own = 14, fill = 26) => {
  const S = vocab(subject, 18), w = [];
  for (let i = 0; i < own; i++) w.push(S[Math.floor(rnd() * S.length)]);
  for (let i = 0; i < fill; i++) w.push(FILLER[Math.floor(rnd() * FILLER.length)]);
  return w.sort(() => rnd() - 0.5).join(' ');
};
let n = 0;
const row = (party, description, subject, read = 'text') => toDoc({ token: 'T' + (n++), number: 'L-' + n, party, description, department: 'TEST', expires: '6/30/2024', gist: subject ? gist(subject) : '', read: subject ? read : '', obs: subject ? 5 : 0 });
const topics = rows => { const docs = rows.map(r => r); return fieldTopics(docs, fieldCatalog(docs)); };
const labels = T => T.groups.map(g => g.label);

test('the reading lane\'s own state is not a topic ("Ledger", "Text")', () => {
  // every doc states something different; the reading lane's output happens to look alike per read state, which is
  // exactly why the state must not be offered as a field to group by
  const rows = [];
  for (let i = 0; i < 40; i++) rows.push(row(vocab('p', 40)[i].toUpperCase() + ' CO', vocab('s', 40)[i].toUpperCase() + ' ' + vocab('t', 40)[i].toUpperCase(), i % 2 ? 'ledgershape' : 'textshape', i % 2 ? 'ledger' : 'text'));
  const T = topics(rows);
  for (const l of labels(T)) assert.ok(!/^(ledger|text)$/i.test(l) && !/read state/i.test(l), 'no read-state topic, got ' + l);
});

test('a corporate-form word is not a topic when its members just sit inside a bigger subject', () => {
  const rows = [];
  for (let i = 0; i < 36; i++) rows.push(row(vocab('co', 60)[i].toUpperCase() + (i < 24 ? ' LLC' : ' CHURCH'), 'EXTRA DUTY SERVICE AGMT', 'duty'));
  for (let i = 0; i < 26; i++) rows.push(row(vocab('zz', 60)[i].toUpperCase() + ' INC', vocab('x', 60)[i].toUpperCase() + ' ' + vocab('y', 60)[i].toUpperCase(), 'u' + i));
  const T = topics(rows);
  assert.ok(labels(T).some(l => /extra duty/i.test(l)), 'the subject is a topic: ' + labels(T));
  assert.ok(!labels(T).some(l => /llc/i.test(l)), 'LLC is not: ' + labels(T));
  const duty = T.groups.find(g => /extra duty/i.test(g.label));
  assert.equal(duty.n, 36, 'every extra-duty agreement sits in the subject topic');
});

test('a subject word that names a sub-subject across differently-worded abouts stays, labelled by its own word', () => {
  const rows = [];
  const phr = ['FURNITURE', 'FURNITURE & FIXTURES', 'OFFICE FURNITURE PURCHASE', 'FURNITURE INSTALLATION', 'FURNITURE REPAIR', 'DESK AND FURNITURE', 'FURNITURE LEASE', 'FURNITURE SUPPLY'];
  phr.forEach((p, i) => rows.push(row(vocab('f', 20)[i].toUpperCase() + ' CO', p, 'furn')));
  for (let i = 0; i < 60; i++) rows.push(row(vocab('o', 60)[i].toUpperCase() + ' CO', vocab('d', 60)[i].toUpperCase() + ' ' + vocab('m', 60)[i].toUpperCase() + ' ' + vocab('k', 60)[i].toUpperCase(), 'misc' + i));
  const T = topics(rows);
  const g = T.groups.find(x => /furniture/i.test(x.label));
  assert.ok(g, 'furniture is a topic: ' + labels(T));
  assert.ok(!/ \/ /.test(g.label), 'its label is not a string of unrelated phrases joined with slashes: ' + g.label);
  assert.equal(g.n, phr.length);
});

test('a group of different phrases is never labelled by joining them', () => {
  const rows = [];
  const phr = ['ROOF REPLACEMENT', 'FIRE ALARM REPLACEMENT', 'BOILER REPLACEMENT', 'WINDOW REPLACEMENT', 'DOOR REPLACEMENT', 'PUMP REPLACEMENT'];
  phr.forEach((p, i) => rows.push(row(vocab('r', 20)[i].toUpperCase() + ' CO', p, 'repl')));
  for (let i = 0; i < 60; i++) rows.push(row(vocab('o', 60)[i].toUpperCase() + ' CO', vocab('d', 60)[i].toUpperCase() + ' ' + vocab('m', 60)[i].toUpperCase() + ' ' + vocab('k', 60)[i].toUpperCase(), 'misc' + i));
  for (const l of labels(topics(rows))) assert.ok(!/ \/ /.test(l), l);
});

test('values that differ only by a year, amount or number are one subject', () => {
  const rows = [];
  for (let i = 0; i < 12; i++) rows.push(row(vocab('g', 20)[i].toUpperCase() + ' CO', 'NON-PROFIT GRANT (' + (10 + i) + ') $' + (i + 1) * 1000 + ',000', 'grant'));
  for (let i = 0; i < 60; i++) rows.push(row(vocab('o', 60)[i].toUpperCase() + ' CO', vocab('d', 60)[i].toUpperCase() + ' ' + vocab('m', 60)[i].toUpperCase(), 'misc' + i));
  const g = topics(rows).groups.find(x => /non-profit grant/i.test(x.label));
  assert.ok(g, 'one grant topic');
  assert.equal(g.n, 12);
});

test('a word shared by more sources than sqrt(N)+1 does not name a topic', () => {
  const rows = [];
  for (let i = 0; i < 30; i++) rows.push(row('V' + vocab('v', 40)[i].toUpperCase(), 'SERVICES ' + vocab('q', 40)[i].toUpperCase(), 'svc'));   // 30 share SERVICES and a coherent text
  for (let i = 0; i < 40; i++) rows.push(row('W' + vocab('w', 60)[i].toUpperCase(), vocab('d', 60)[i].toUpperCase() + ' ' + vocab('m', 60)[i].toUpperCase(), 'misc' + i));
  for (const l of labels(topics(rows))) assert.ok(!/services/i.test(l), l);
});
