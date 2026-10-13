// holodeck-invites.test.mjs — I1–I7 of docs/MATRIX-INVITES-PREREG.md, Part II.
//
// An invitation is only an invitation: a magic link that lets an ENROLLED account ask to be let into the
// workspace's existing rooms. The link carries a private signing key; room state carries the public half; any
// browser signed in as the owner can verify. Pure module against the fake homeserver; the gate is an injected
// crossing here (the gate itself is tools/login-gate/gate.test.mjs, and the two are exercised together in the REST
// test). Every falsifier is paired with a control built to fail.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeServer } from './holodeck-fake-matrix.js';
import { makeInvites, EVT, STATE, REFUSE, workspaceInviteLink, parseWorkspaceInvite } from './holodeck-invites.js';
import { newInviteKey, signInvite, verifyInvite, newDoorAlias, ONLINE_MS } from './holodeck-invite-core.js';

const HS = 'test.local';
const BASE = 'https://example.test/holodeck/';
const U = { owner: '@owner:' + HS, ana: '@ana:' + HS, bob: '@bob:' + HS, cy: '@cy:' + HS, eve: '@eve:' + HS };
const CANARY = 'Ana-Q7-the-accountant-canary';
const LINKS = (u) => 'hd:invite-links:v1:' + u;

function world({ enrolled = new Set(Object.values(U)), gate = 'on' } = {}) {
  let tick = 1_700_000_000_000;
  const server = createFakeServer({ name: HS, now: () => (tick += 10) });
  const now = () => tick;
  const asked = [];
  const gateObj = gate === 'off' ? null : gate === 'down'
    ? { enrolled: async () => { throw new Error('gate unreachable'); } }
    : { enrolled: async (u) => { asked.push(u); return enrolled.has(u); } };
  const mxs = {}, I = {}, stores = {};
  const mkStore = (k) => { stores[k] = stores[k] || new Map(); return { get: async (key) => stores[k].get(key) ?? null, set: async (key, v) => { stores[k].set(key, JSON.parse(JSON.stringify(v))); } }; };
  for (const [k, u] of Object.entries(U)) {
    mxs[k] = server.client(u);
    I[k] = makeInvites({ mx: mxs[k], gate: k === 'owner' ? gateObj : null, store: mkStore(k), now });
  }
  return { server, mxs, I, stores, now, enrolled, asked, gateObj, mkStore, advance: (ms) => { tick += ms; } };
}
async function workspace(w) {
  const priv = await w.mxs.owner.createRoom({ name: 'Fold · Case (private)', preset: 'private_chat', visibility: 'private' });
  const pub = await w.mxs.owner.createRoom({ name: 'Fold · Case', preset: 'public_chat', visibility: 'public', initial_state: [{ type: 'm.room.join_rules', state_key: '', content: { join_rule: 'public' } }] });
  return { priv, pub };
}
const make = (w, rooms, name = 'Ana') => w.I.owner.invite({ name, rooms, base: BASE });
const memberOf = async (w, room, who) => (await w.mxs.owner.roomState(room)).members[U[who]];

// ---------------------------------------------------------------- link

test('the link is all fragment; it names the inviter and carries a key; old shapes are not mistaken for it', async () => {
  const a = newDoorAlias(), k = await newInviteKey();
  const link = workspaceInviteLink({ base: BASE + '?x=1#old', alias: a, secret: k.seed, from: U.owner, server: HS });
  assert.equal(link, `${BASE}#join=${a}&k=${k.seed}&from=${encodeURIComponent(U.owner)}&hs=${HS}`);
  assert.deepEqual(parseWorkspaceInvite(link), { alias: a, secret: k.seed, from: U.owner, server: HS });
  assert.equal(parseWorkspaceInvite('#join=abcde'), null);
  assert.equal(parseWorkspaceInvite(BASE + '#fx-share=eyJ2IjoxfQ'), null);
  assert.deepEqual(parseWorkspaceInvite(`#join=${a}`), { alias: a, secret: null, from: null, server: null });
  assert.throws(() => workspaceInviteLink({ base: BASE, alias: a, secret: 'short', from: U.owner }));
  assert.throws(() => workspaceInviteLink({ base: BASE, alias: a, secret: k.seed, from: 'not-an-mxid' }));
});

// ---------------------------------------------------------------- the flow

test('a name in, a link out; an enrolled account opens it; the owner’s device lets exactly that account into the workspace’s own rooms', async () => {
  const w = world();
  const rooms = await workspace(w);
  const before = w.server.requestLog.length;
  const inv = await make(w, rooms, CANARY);
  assert.deepEqual([...new Set(w.server.requestLog.slice(before).map((r) => r.op))].sort(), ['createRoom', 'setState'], 'a door and a line of room state; nothing was sent to anyone');
  assert.match(inv.link, /#join=[a-z0-9]{16}&k=/);

  const acc = await w.I.ana.open({ input: inv.link });
  assert.equal(acc.owner, U.owner);
  assert.equal(await memberOf(w, rooms.priv, 'ana'), undefined, 'opening is not being let in');
  await assert.rejects(() => w.I.ana.claim({ door: acc.door }), (e) => e.code === REFUSE.NoGrantYet);
  assert.equal((await w.I.owner.sweep({ rooms }))[0].state, 'admitted');
  assert.deepEqual(w.asked, [U.ana], 'the gate was asked about exactly that account');
  assert.equal(await memberOf(w, rooms.priv, 'ana'), 'invite');
  const got = await w.I.ana.claim({ door: acc.door });
  assert.deepEqual(got.rooms, rooms);
  assert.equal(await memberOf(w, rooms.priv, 'ana'), 'join');
  assert.equal(await memberOf(w, rooms.pub, 'ana'), 'join');
  await w.mxs.ana.sendEvent(rooms.priv, 'io.holodeck.note', { text: 'hello' });
  const ana = (await w.I.owner.people({ rooms })).find((p) => p.user === U.ana);
  assert.equal(ana.name, CANARY); assert.equal(ana.joined, true);
  assert.deepEqual(await w.I.owner.outstanding({ rooms }), [], 'no longer outstanding');
  assert.deepEqual(w.stores.owner.get(LINKS(U.owner)), {}, 'the device dropped the link once it had done its job');
  await assert.rejects(() => w.I.bob.open({ input: inv.link }), (e) => e.code === REFUSE.InviteNotFound, 'the link is dead once used');
});

test('any browser signed in as the owner can let people in: a second device with an EMPTY store admits the person, because nothing secret was ever stored', async () => {
  const w = world();
  const rooms = await workspace(w);
  const inv = await make(w, rooms, 'Ana');
  const acc = await w.I.ana.open({ input: inv.link });
  const elsewhere = makeInvites({ mx: w.mxs.owner, gate: w.gateObj, store: { get: async () => null, set: async () => {} }, now: w.now });   // another browser, same account, nothing stored
  assert.equal((await elsewhere.outstanding({ rooms }))[0].name, 'Ana', 'it can see who is pending');
  assert.equal((await elsewhere.sweep({ rooms }))[0].state, 'admitted');
  assert.equal(await memberOf(w, rooms.priv, 'ana'), 'invite');
  await w.I.ana.claim({ door: acc.door });
  // the device that made the invitation still has its convenience copy of the link, but it is no longer listed: pending
  // invitations are room state, so what the first device shows follows what the second one did
  assert.deepEqual(await w.I.owner.outstanding({ rooms }), []);
  assert.deepEqual(await w.I.owner.sweep({ rooms }), []);
});

test('I1 — an invitation is not a credential: the owner holds no password or authenticator, and the server holds the PUBLIC key only', async () => {
  const w = world();
  const rooms = await workspace(w);
  const inv = await make(w, rooms, CANARY);
  const seed = parseWorkspaceInvite(inv.link).secret;
  const reg = await w.mxs.owner.getState(rooms.priv, STATE.invites, '');
  const pubKey = reg.invites[inv.door].pub;
  assert.notEqual(pubKey, seed, 'room state carries the public half, not the link’s key');
  const acc = await w.I.ana.open({ input: inv.link });
  await w.I.owner.sweep({ rooms });
  await w.I.ana.claim({ door: acc.door });
  await w.I.ana.announce({ rooms, viewing: 'doc:1', title: 'Lease.pdf' });
  const ownerKeep = JSON.stringify([...w.stores.owner.entries()]);
  for (const bad of ['password', 'totp', 'otpauth', 'authenticator']) assert.ok(!ownerKeep.toLowerCase().includes(bad), 'the owner’s store holds no ' + bad);
  assert.ok(!ownerKeep.includes(seed), 'and the link’s key is dropped once the person is in');
  const dump = w.server.storedJSON();
  assert.equal(dump.split(seed).length - 1, 0, 'the server never held the link’s private key');
  assert.ok(!/password|otpauth|totp/i.test(dump.replace(/Fold · Case/g, '')), 'no password or authenticator material anywhere on the server');
  assert.ok(dump.split(CANARY).length - 1 >= 1, 'the name IS in room state — the scan is not blind');
  // control: a build that kept the link's private key in room state is caught by the same scan
  await w.mxs.owner.setState(rooms.priv, 'io.holodeck.leak', '', { k: seed });
  assert.ok(w.server.storedJSON().includes(seed), 'control: the scanner sees a secret when one is there');
});

test('I2 — admission needs an enrolled account: the gate says no and nobody is admitted and the invitation stays open; a gate that cannot be reached admits nobody; with no gate configured it is the owner’s stated choice', async () => {
  const w = world({ enrolled: new Set([U.owner]) });
  const rooms = await workspace(w);
  const inv = await make(w, rooms);
  await w.I.eve.open({ input: inv.link });                                    // someone with the link and no authenticator
  const r = (await w.I.owner.sweep({ rooms }))[0];
  assert.equal(r.state, 'blocked'); assert.deepEqual(r.blocked, { user: U.eve, why: 'not-enrolled' });
  assert.equal(await memberOf(w, rooms.priv, 'eve'), undefined);
  assert.equal((await w.I.owner.outstanding({ rooms }))[0].state, 'sent', 'the invitation is still open');
  w.enrolled.add(U.ana);                                                      // the person who should have it enrols and opens the link
  await w.I.ana.open({ input: inv.link });
  assert.equal((await w.I.owner.sweep({ rooms }))[0].state, 'admitted');
  assert.equal(await memberOf(w, rooms.priv, 'ana'), 'invite');
  assert.equal(await memberOf(w, rooms.priv, 'eve'), undefined);

  const down = world({ gate: 'down' });
  const r2 = await workspace(down);
  const i2 = await make(down, r2);
  await down.I.ana.open({ input: i2.link });
  const s2 = (await down.I.owner.sweep({ rooms: r2 }))[0];
  assert.equal(s2.state, 'blocked'); assert.equal(s2.blocked.why, 'gate-unreachable');
  assert.equal(await memberOf(down, r2.priv, 'ana'), undefined, 'fail closed');

  const off = world({ gate: 'off' });
  const r3 = await workspace(off);
  const i3 = await make(off, r3);
  await off.I.ana.open({ input: i3.link });
  assert.equal((await off.I.owner.sweep({ rooms: r3 }))[0].state, 'admitted', 'no gate configured: password-only accounts are admitted, and the panel says so');
});

// ---------------------------------------------------------------- I3 / I4

test('I3 — a signature cannot be replayed for another account or in another invitation’s door, and one that does not bind the account is not accepted either', async () => {
  const w = world();
  const rooms = await workspace(w);
  const a = await make(w, rooms, 'A'), b = await make(w, rooms, 'B');
  const seedA = parseWorkspaceInvite(a.link).secret;
  const reg = await w.mxs.owner.getState(rooms.priv, STATE.invites, '');
  const good = await signInvite(seedA, { door: a.door, user: U.ana });
  await w.mxs.eve.join(a.door);
  await w.mxs.eve.sendEvent(a.door, EVT.request, { v: 1, sig: good });             // (1) another account, same door
  await w.mxs.ana.join(b.door);
  await w.mxs.ana.sendEvent(b.door, EVT.request, { v: 1, sig: good });             // (2) the right account, another door
  const weak = await signInvite(seedA, { door: a.door, user: '' });                // (3) a signature that does not name an account
  await w.mxs.bob.join(a.door);
  await w.mxs.bob.sendEvent(a.door, EVT.request, { v: 1, sig: weak });
  assert.ok((await w.I.owner.sweep({ rooms })).every((r) => r.state !== 'admitted'));
  for (const who of ['eve', 'ana', 'bob']) assert.equal(await memberOf(w, rooms.priv, who), undefined);
  // control: the weak signature DOES verify when the account is left out of the message — so a scheme that omitted it would admit anyone
  assert.equal(await verifyInvite(reg.invites[a.door].pub, { door: a.door, user: '' }, weak), true, 'control: the weak signature is genuine; only binding the account stops it');
});

test('I3 — the first valid signature wins and closes the door; a second holder of the same link is told it is closed', async () => {
  const w = world();
  const rooms = await workspace(w);
  const inv = await make(w, rooms);
  await w.I.ana.open({ input: inv.link });
  const second = await w.I.bob.open({ input: inv.link });                          // a forwarded link, a second person
  const r = (await w.I.owner.sweep({ rooms }))[0];
  assert.equal(r.state, 'admitted'); assert.equal(r.user, U.ana, 'the earlier signature');
  await assert.rejects(() => w.I.bob.claim({ door: second.door }), (e) => e.code === REFUSE.InviteClosed);
  assert.equal(await memberOf(w, rooms.priv, 'bob'), undefined);
});

test('I4 — a door not made by the inviter named in the link is refused before anything is sent; control: a client that does not check sends the hello', async () => {
  const w = world();
  const rooms = await workspace(w);
  const real = await make(w, rooms);
  const p = parseWorkspaceInvite(real.link);
  const alias = newDoorAlias();
  const trap = await w.mxs.eve.createRoom({ name: 'x', preset: 'public_chat', room_alias_name: alias, initial_state: [{ type: 'm.room.join_rules', state_key: '', content: { join_rule: 'public' } }], power_level_content_override: { events_default: 0 } });
  const link = workspaceInviteLink({ base: BASE, alias, secret: p.secret, from: U.owner, server: HS });   // claims the owner invited you
  await assert.rejects(() => w.I.ana.open({ input: link }), (e) => e.code === REFUSE.OwnerMismatch);
  assert.equal((await w.mxs.eve.readEvents(trap)).filter((e) => e.sender === U.ana).length, 0, 'nothing was sent into the attacker’s door');
  await w.mxs.ana.join(trap);
  await w.mxs.ana.sendEvent(trap, EVT.hello, { v: 1 });
  assert.equal((await w.mxs.eve.readEvents(trap)).filter((e) => e.sender === U.ana && e.type === EVT.hello).length, 1, 'control: without the check the attacker receives it');
});

test('an incomplete link and the wrong server are refused up front; expired and cancelled invitations are gone', async () => {
  const w = world();
  const rooms = await workspace(w);
  const inv = await make(w, rooms, 'A');
  await assert.rejects(() => w.I.bob.open({ input: inv.link.replace(/&k=[^&]*/, '') }), (e) => e.code === REFUSE.LinkIncomplete);
  await assert.rejects(() => w.I.bob.open({ input: inv.link.replace(/&hs=.*$/, '&hs=other.example') }), (e) => e.code === REFUSE.WrongServer);
  w.advance(8 * 24 * 3600 * 1000);
  assert.equal((await w.I.owner.sweep({ rooms }))[0].state, 'expired');
  await assert.rejects(() => w.I.ana.open({ input: inv.link }), (e) => e.code === REFUSE.InviteNotFound);
  const b = await make(w, rooms, 'B');
  await w.I.owner.revoke({ rooms, door: b.door });
  await assert.rejects(() => w.I.ana.open({ input: b.link }), (e) => e.code === REFUSE.InviteNotFound);
  assert.deepEqual(await w.I.owner.outstanding({ rooms }), []);
  await assert.rejects(() => w.I.owner.invite({ name: '  ', rooms, base: BASE }), (e) => e.code === REFUSE.NameNeeded);
  await assert.rejects(() => w.I.owner.invite({ name: 'A', rooms: {}, base: BASE }), (e) => e.code === REFUSE.NoRoom);
});

// ---------------------------------------------------------------- I6 presence

async function join(w, rooms, who, name) {
  const inv = await make(w, rooms, name);
  const acc = await w.I[who].open({ input: inv.link });
  await w.I.owner.sweep({ rooms });
  await w.I[who].claim({ door: acc.door });
}

test('I6 — who is here, under the names the owner gave: from room state by authenticated sender, never from the heartbeat; removed, stale and spoofed are not shown', async () => {
  const w = world();
  const rooms = await workspace(w);
  await join(w, rooms, 'ana', 'Ana (accountant)');
  await join(w, rooms, 'bob', 'Bob from the bank');
  await w.I.owner.announce({ rooms, viewing: 'doc:lease', title: 'Lease 2024.pdf' });
  await w.I.ana.announce({ rooms, viewing: 'doc:thread', title: 'Thread with landlord' });
  await w.I.bob.announce({ rooms, viewing: 'doc:lease', title: 'Lease 2024.pdf' });
  const here = await w.I.owner.presence({ rooms });
  assert.deepEqual(here.map((p) => [p.name, p.viewing, p.title]).sort(), [
    ['Ana (accountant)', 'doc:thread', 'Thread with landlord'],
    ['Bob from the bank', 'doc:lease', 'Lease 2024.pdf'],
    [U.owner, 'doc:lease', 'Lease 2024.pdf'],
  ].sort());
  assert.ok((await w.I.ana.presence({ rooms })).some((p) => p.name === 'Bob from the bank'));
  await w.I.owner.setName({ rooms, user: U.owner, name: 'Michael (owner)' });
  assert.ok((await w.I.bob.presence({ rooms })).some((p) => p.name === 'Michael (owner)'));

  await w.mxs.bob.sendEvent(rooms.priv, EVT.presence, { v: 1, viewing: 'doc:secret', title: 'x', name: 'Michael (owner)', user: U.owner });
  const afterSpoof = await w.I.owner.presence({ rooms });
  assert.equal(afterSpoof.find((p) => p.user === U.bob).name, 'Bob from the bank');
  assert.equal(afterSpoof.filter((p) => p.name === 'Michael (owner)').length, 1);
  const naive = (evs) => evs.filter((e) => e.type === EVT.presence).map((e) => ({ user: e.sender, name: e.content.name || e.sender }));
  assert.ok(naive(await w.mxs.owner.readEvents(rooms.priv)).some((p) => p.user === U.bob && p.name === 'Michael (owner)'), 'control: the naive reading attributes Bob’s heartbeat to the owner');

  w.advance(ONLINE_MS + 10_000);
  assert.deepEqual(await w.I.owner.presence({ rooms }), []);
  await w.I.ana.announce({ rooms, viewing: 'doc:lease', title: 'Lease 2024.pdf' });
  assert.deepEqual((await w.I.owner.presence({ rooms })).map((p) => p.name), ['Ana (accountant)']);

  await w.I.owner.remove({ rooms, user: U.ana });
  await w.mxs.ana.sendEvent(rooms.priv, EVT.presence, { v: 1, viewing: 'doc:lease', title: '' }).catch(() => {});
  assert.deepEqual(await w.I.owner.presence({ rooms }), []);
  assert.equal((await w.I.owner.people({ rooms })).some((p) => p.user === U.ana), false);
});

test('I6 — heartbeats replace each other, carry no name, and a viewer whose clock is an hour off or a day behind still sees the right people', async () => {
  const w = world();
  const rooms = await workspace(w);
  await join(w, rooms, 'ana', CANARY);
  for (let i = 0; i < 60; i++) await w.I.ana.announce({ rooms, viewing: 'doc:' + i, title: 'item ' + i });
  const live = (await w.mxs.owner.readEvents(rooms.priv)).filter((e) => e.type === EVT.presence && e.sender === U.ana && e.decrypted);
  assert.ok(live.length <= 2, 'at most 2 live heartbeats from one member, got ' + live.length);
  assert.equal(live[live.length - 1].content.viewing, 'doc:59');
  assert.ok(!JSON.stringify(live).includes(CANARY));
  for (const skew of [3_600_000, -86_400_000]) {
    const skewed = makeInvites({ mx: w.mxs.owner, store: null, now: () => w.now() + skew });
    await skewed.announce({ rooms, viewing: 'view:summary', title: 'Summary' });
    assert.ok((await skewed.presence({ rooms })).some((p) => p.name === CANARY), 'shown despite a ' + skew + ' ms clock error');
  }
  w.advance(ONLINE_MS + 30_000);
  await w.I.owner.announce({ rooms, viewing: 'view:summary', title: 'Summary' });
  assert.ok(!(await w.I.owner.presence({ rooms })).some((p) => p.name === CANARY), 'a genuinely old heartbeat is not shown');
});

// ---------------------------------------------------------------- I7

test('I7 — three enrolled people join by link and appear online under the names typed at invite time; a fourth with the link and no enrolment never appears', async () => {
  const w = world({ enrolled: new Set([U.owner, U.ana, U.bob, U.cy]) });
  const rooms = await workspace(w);
  const inv = { ana: await make(w, rooms, 'Ana (accountant)'), bob: await make(w, rooms, 'Bob (lawyer)'), cy: await make(w, rooms, 'Cy (cousin)') };
  const acc = {};
  for (const who of ['ana', 'bob', 'cy']) acc[who] = await w.I[who].open({ input: inv[who].link });
  await w.I.eve.open({ input: inv.ana.link }).catch(() => {});                       // eve has ana's link, no authenticator
  const out = await w.I.owner.sweep({ rooms });
  assert.deepEqual(out.map((o) => o.state).sort(), ['admitted', 'admitted', 'admitted']);
  for (const who of ['ana', 'bob', 'cy']) { await w.I[who].claim({ door: acc[who].door }); await w.I[who].announce({ rooms, viewing: 'doc:' + who, title: 'what ' + who + ' reads' }); }
  const here = await w.I.owner.presence({ rooms });
  assert.deepEqual(here.map((p) => p.name), ['Ana (accountant)', 'Bob (lawyer)', 'Cy (cousin)']);
  assert.ok(!here.some((p) => p.user === U.eve));
  assert.equal(await memberOf(w, rooms.priv, 'eve'), undefined);
});

test('the convenience copy of links is per account: a second person on the same browser neither sees nor shows the first person’s', async () => {
  const w = world();
  const rooms = await workspace(w);
  const shared = new Map();
  const mk = (who) => makeInvites({ mx: w.mxs[who], store: { get: async (k) => shared.get(k) ?? null, set: async (k, v) => { shared.set(k, JSON.parse(JSON.stringify(v))); } }, now: w.now });
  const owner = mk('owner'), other = mk('bob');
  const inv = await owner.invite({ name: 'Z', rooms, base: BASE });
  assert.equal((await owner.outstanding({ rooms }))[0].link, inv.link);
  assert.equal((await other.outstanding({ rooms }))[0].link, '', 'the other account sees the pending name (room state) but not the link');
  assert.ok([...shared.keys()].every((k) => k.endsWith(':' + U.owner)));
});
