// node --test holodeck-workspaces-core.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { sortWorkspaces, summarizeWorkspace, shareLine, totals, headerLine, initials, hueOf, expiresIn, pool } from './holodeck-workspaces-core.js';

const L = [
  { id: 'custom', name: 'Your content', n: 3, at: 10 },
  { id: 'ws-a', name: 'Lease dispute', n: 12, at: 30 },
  { id: 'ws-b', name: 'Budget hearings', n: 40, at: 20 },
];
const people = [
  { user: '@me:x', name: '', owner: true, joined: true, self: true },
  { user: '@ana:x', name: 'Ana Smith', owner: false, joined: true, self: false },
  { user: '@bob:x', name: '', owner: false, joined: true, self: false },
  { user: '@cy:x', name: 'Cy', owner: false, joined: false, self: false },
];

test('sorts by recent, name, size, and filters by name', () => {
  assert.deepEqual(sortWorkspaces(L).map((w) => w.id), ['ws-a', 'ws-b', 'custom']);
  assert.deepEqual(sortWorkspaces(L, { sort: 'name' }).map((w) => w.id), ['ws-b', 'ws-a', 'custom']);
  assert.deepEqual(sortWorkspaces(L, { sort: 'size' }).map((w) => w.id), ['ws-b', 'ws-a', 'custom']);
  assert.deepEqual(sortWorkspaces(L, { q: 'LEASE' }).map((w) => w.id), ['ws-a']);
});

test('people sort puts read, crowded workspaces first and unread ones last', () => {
  const summaries = { 'ws-b': summarizeWorkspace({ people }), custom: summarizeWorkspace({ people: people.slice(0, 1) }) };
  assert.deepEqual(sortWorkspaces(L, { sort: 'people', summaries }).map((w) => w.id), ['ws-b', 'custom', 'ws-a']);
});

test('a summary counts joined members, open invitations, and who else is here', () => {
  const s = summarizeWorkspace({ people, outstanding: [{ state: 'sent' }, { state: 'expired' }, { state: 'sent' }], online: [{ user: '@ana:x' }, { user: '@me:x' }], owner: true });
  assert.equal(s.members, 3); assert.equal(s.others, 2); assert.equal(s.invitedNotJoined, 1);
  assert.equal(s.waiting, 2); assert.equal(s.expired, 1);
  assert.deepEqual(s.here, ['Ana Smith']);                       // never "you are here"
  assert.equal(s.faces.find((f) => f.user === '@bob:x').name, 'bob'); // no given name: the account's local part
});

test('the share line says it in plain words', () => {
  assert.equal(shareLine({ rooms: {} }), 'Only on this device');
  assert.equal(shareLine({ rooms: { priv: '!p' }, signedIn: false }), 'Shared · sign in to see who is in it');
  assert.equal(shareLine({ rooms: { priv: '!p' } }), 'Shared · reading who is in it…');
  assert.equal(shareLine({ rooms: { priv: '!p' }, summary: summarizeWorkspace({ people: people.slice(0, 1) }) }), 'Just you');
  const s = summarizeWorkspace({ people, outstanding: [{ state: 'sent' }], online: [{ user: '@ana:x' }] });
  assert.equal(shareLine({ rooms: { priv: '!p' }, summary: s }), 'You and 2 others · 1 invitation waiting · Ana Smith is here');
  assert.match(shareLine({ rooms: { priv: '!p' }, summary: summarizeWorkspace({ vault: 'locked' }) }), /cannot read/);
});

test('totals count a person once across workspaces', () => {
  const sum = { 'ws-a': summarizeWorkspace({ people, online: [{ user: '@ana:x' }] }), 'ws-b': summarizeWorkspace({ people: people.slice(0, 2), outstanding: [{ state: 'sent' }] }) };
  const t = totals(L, sum, (id) => (id === 'custom' ? {} : { priv: '!' + id }));
  assert.deepEqual(t, { workspaces: 3, shared: 2, people: 2, waiting: 1, here: 1 });
  assert.equal(headerLine(t), '3 workspaces · 2 shared · 2 people invited in · 1 invitation waiting · 1 here now');
});

test('initials, hue and expiry are stable', () => {
  assert.equal(initials('Lease dispute'), 'LD'); assert.equal(initials('Budget'), 'BU'); assert.equal(initials(''), '·');
  assert.equal(hueOf('ws-a'), hueOf('ws-a')); assert.ok(hueOf('ws-a') >= 0 && hueOf('ws-a') < 360);
  assert.equal(expiresIn(0, 1), 'expired'); assert.equal(expiresIn(5 * 86400000, 0), 'expires in 5 days');
});

test('pool keeps order and never lets one failure stop the rest', async () => {
  const r = await pool([1, 2, 3, 4], 2, async (x) => { if (x === 2) throw new Error('no'); return x * 10; });
  assert.deepEqual(r.map((x) => (x.ok ? x.value : 'err')), [10, 'err', 30, 40]);
});
