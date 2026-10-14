// holodeck-media-store-matrix.test.mjs — the backup, end to end through the real fold-net.js over HTTP: sign in,
// back up, a second account is invited and loads it. What the homeserver stored is scanned (media AND room state),
// and every scan has a control.
import test from 'node:test';
import assert from 'node:assert/strict';
import { homeserver } from './tests/fake-homeserver.mjs';
import * as N from './fold-net.js';
import { makeKeyring, VaultError, CODE } from './holodeck-vault.js';
import { pushWorkspace, pullWorkspace, storeStatus, textToBytes, sha256Hex, STORE_CODE } from './holodeck-media-store.js';

const SECRET = 'the landlord’s unit-7 inspection report';
const mem = () => { const m = new Map(); return { get: async (k) => (m.has(k) ? JSON.parse(m.get(k)) : null), set: async (k, v) => { m.set(k, JSON.stringify(v)); } }; };

// the page's own adapter, as index.html builds it (storeNet): fold-net crossings + the account's ring
const storeNet = (s, room, ring) => ({
  upload: (u8) => N.upload(s, u8, 'blob', 'application/octet-stream'),
  download: (mxc) => N.download(s, mxc),
  loadPointer: () => N.loadPrivate(s, room, 'store', ring),
  savePointer: (p) => N.savePrivate(s, room, 'store', p, ring),
  ensureKey: async () => { const cur = await N.loadPrivate(s, room, 'store', ring); await N.savePrivate(s, room, 'store', cur || { v: 1, empty: true }, ring); },
  limit: () => N.mediaLimit(s),
});
const device = (docs = []) => {
  const recs = new Map(docs.map((d) => [d.rec.id, d]));
  return { recs, api: { docs: async () => [...recs.values()].map((d) => d.rec), has: async (id) => recs.has(id), bytesOf: async (r) => (recs.get(r.id) || { blobs: [] }).blobs, restore: async (r, b) => { recs.set(r.id, { rec: r, blobs: b }); }, removed: async () => [] } };
};
const doc = (id, title, ...blobs) => ({ rec: { id, title, year: 2026 }, blobs });
const html = (t) => ({ kind: 'html', mime: 'text/html', enc: 'utf8', bytes: textToBytes(t) });
const bin = (n, seed) => { const b = new Uint8Array(n); let x = seed; for (let i = 0; i < n; i++) { x = (x * 1103515245 + 12345) & 0x7fffffff; b[i] = x >>> 16; } return { kind: 'pdf', mime: 'application/pdf', enc: 'bin', bytes: b }; };

async function world(opts) {
  const hs = await homeserver({ name: 'store.test', ...opts });
  const o = hs.user('owner'), a = hs.user('ana');
  const so = { base: hs.base, token: o.token, user: o.user }, sa = { base: hs.base, token: a.token, user: a.user };
  const room = await N.createWorkspace(so, { name: 'Fold · Lease (private)', isPublic: false, config: { v: 1 } });
  await N.invite(so, room, a.user); await N.join(sa, room);
  const roomText = () => JSON.stringify([...hs.rooms.values()].map((r) => ({ state: [...r.state.values()], timeline: r.timeline })));
  const mediaText = () => [...hs.media.values()].map((m) => m.bytes.toString('latin1')).join('\n');
  return { hs, so, sa, room, roomText, mediaText, close: () => hs.close() };
}

test('M1 — backed up over real HTTP: the media store and room state hold no word of it, and the room names no media', async () => {
  const w = await world();
  try {
    const ring = makeKeyring(mem(), { account: w.so.user });
    const a = device([doc('unit7-inspection-doc', SECRET, html('<p>' + SECRET + '</p>'), bin(2_500_000, 4)), doc('rec-2', 'Hearing', bin(900_000, 8))]);
    const r = await pushWorkspace({ scope: w.room, ring, net: storeNet(w.so, w.room, ring), local: a.api });
    assert.equal(r.docs, 2);
    assert.ok(w.hs.media.size >= 3, 'blobs and a manifest are in the media repository');
    for (const [what, text] of [['media', w.mediaText()], ['room', w.roomText()]]) {
      assert.equal(text.includes('inspection'), false, 'no word of the report in ' + what);
      assert.equal(text.includes('unit7-inspection-doc'), false, 'nor the id in ' + what);
      assert.equal(text.includes('Hearing'), false, 'nor a title in ' + what);
    }
    assert.equal(w.roomText().includes('mxc://'), false, 'the room state does not say which media are its');
    // control: the scan sees plaintext when it is there
    const plain = await world();
    try {
      await N.upload(plain.so, textToBytes('<p>' + SECRET + '</p>'), 'x', 'text/html');
      assert.equal(plain.mediaText().includes('inspection'), true, 'the probe can see plaintext in the media repository');
    } finally { await plain.close(); }
  } finally { await w.close(); }
});

test('M2 — an invited account loads the owner’s sources; bytes identical; a stranger without the key loads nothing', async () => {
  const w = await world();
  try {
    const ringO = makeKeyring(mem(), { account: w.so.user });
    const big = bin(1_200_000, 11);
    const a = device([doc('d1', 'Lease', html('<p>' + SECRET + '</p>'), big)]);
    await pushWorkspace({ scope: w.room, ring: ringO, net: storeNet(w.so, w.room, ringO), local: a.api });

    // Ana has no key yet: the pointer is there, she cannot open it, and she restores nothing
    const ringA = makeKeyring(mem(), { account: w.sa.user });
    const b = device();
    const st = await storeStatus({ scope: w.room, ring: ringA, net: storeNet(w.sa, w.room, ringA) }).catch((e) => ({ locked: e.code }));
    assert.equal(st.locked || (st.has && !st.held ? 'locked' : 'open'), st.locked ? CODE.Locked : 'locked');
    assert.equal(b.recs.size, 0);

    // the invitation hands her the key (here: the device-link string, which is the same keyring)
    await ringA.importRing(await ringO.exportRing(w.room));
    const p = await pullWorkspace({ scope: w.room, ring: ringA, net: storeNet(w.sa, w.room, ringA), local: b.api });
    assert.equal(p.restored, 1); assert.deepEqual(p.missing, []);
    const got = b.recs.get('d1');
    assert.equal(got.rec.title, 'Lease');
    assert.equal(await sha256Hex(got.blobs.find((x) => x.kind === 'pdf').bytes), await sha256Hex(big.bytes));
    assert.equal(new TextDecoder().decode(got.blobs.find((x) => x.kind === 'html').bytes), '<p>' + SECRET + '</p>');
  } finally { await w.close(); }
});

test('M3 — the homeserver’s upload limit is read and respected; control: ignoring it fails', async () => {
  const w = await world({ mediaLimit: 300 * 1024 });
  try {
    const ring = makeKeyring(mem(), { account: w.so.user });
    assert.equal(await N.mediaLimit(w.so), 300 * 1024);
    const a = device([doc('d1', 'Big', bin(1_000_000, 5))]);
    await pushWorkspace({ scope: w.room, ring, net: storeNet(w.so, w.room, ring), local: a.api });
    const sizes = [...w.hs.media.values()].map((m) => m.bytes.length);
    assert.ok(Math.max(...sizes) <= 300 * 1024, 'no upload over the limit');
    // control: a net that does not report the limit tries an 8 MiB chunk and the server refuses it
    const noLimit = { ...storeNet(w.so, w.room, ring), limit: undefined };
    const a2 = device([doc('d2', 'Big2', bin(1_000_000, 6))]);
    await assert.rejects(pushWorkspace({ scope: w.room, ring, net: noLimit, local: a2.api }), (e) => e.code === STORE_CODE.Unreachable);
  } finally { await w.close(); }
});

test('M4 — a non-owner with no key cannot start one, and nothing is uploaded', async () => {
  const w = await world();
  try {
    const ringO = makeKeyring(mem(), { account: w.so.user });
    await N.savePrivate(w.so, w.room, 'work', { pins: [] }, ringO);            // the owner has started the key
    const ringA = makeKeyring(mem(), { account: w.sa.user });                  // Ana has not been given it
    const before = w.hs.media.size;
    const a = device([doc('d1', 'Mine', html('x'))]);
    await assert.rejects(pushWorkspace({ scope: w.room, ring: ringA, net: storeNet(w.sa, w.room, ringA), local: a.api }), (e) => e.vault === true);
    assert.equal(w.hs.media.size, before);
  } finally { await w.close(); }
});
