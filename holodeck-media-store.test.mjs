// holodeck-media-store.test.mjs — the backup leg. Every falsifier has a control: a probe that could not see the
// thing it says is absent would pass for the wrong reason.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeKeyring, VaultError, CODE } from './holodeck-vault.js';
import { pushWorkspace, pullWorkspace, storeStatus, StoreError, STORE_CODE, sha256Hex, textToBytes, bytesToText } from './holodeck-media-store.js';

const SECRET = 'the landlord’s unit-7 inspection report';
const mem = () => { const m = new Map(); return { get: async (k) => (m.has(k) ? JSON.parse(m.get(k)) : null), set: async (k, v) => { m.set(k, JSON.stringify(v)); } }; };

// An in-memory homeserver: media + one pointer slot. `uploads` is every byte string it was ever sent.
function homeserver({ limit = null } = {}) {
  const media = new Map(); const uploads = []; let n = 0; let pointer = null; const sent = [];
  return {
    media, uploads, sent, get pointer() { return pointer; },
    net: {
      upload: async (u8) => { if (limit && u8.length > limit) throw new Error('M_TOO_LARGE'); const mxc = 'mxc://store.test/m' + (n++); media.set(mxc, new Uint8Array(u8)); uploads.push(new Uint8Array(u8)); sent.push(u8.length); return mxc; },
      download: async (mxc) => { const b = media.get(mxc); if (!b) throw new Error('404'); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); },
      loadPointer: async () => pointer,
      savePointer: async (p) => { pointer = JSON.parse(JSON.stringify(p)); },
      ensureKey: async () => {},
      limit: limit ? async () => limit : undefined,
    },
  };
}

// This browser's stores, as the page adapter exposes them.
function device(docs = []) {
  const recs = new Map(docs.map((d) => [d.rec.id, d]));
  const removedIds = new Set();
  return {
    recs, removedIds,
    api: {
      docs: async () => [...recs.values()].map((d) => d.rec),
      has: async (id) => recs.has(id),
      bytesOf: async (rec) => (recs.get(rec.id) || { blobs: [] }).blobs,
      restore: async (rec, blobs) => { recs.set(rec.id, { rec, blobs }); },
      removed: async () => [...removedIds],
    },
  };
}
const doc = (id, title, ...blobs) => ({ rec: { id, title, year: 2026, type: 'Report' }, blobs });
const blob = (kind, text, enc = 'utf8', mime = 'text/plain') => ({ kind, mime, enc, bytes: textToBytes(text) });
const bin = (kind, n, seed = 7) => { const b = new Uint8Array(n); let x = seed; for (let i = 0; i < n; i++) { x = (x * 1103515245 + 12345) & 0x7fffffff; b[i] = x >>> 16; } return { kind, mime: 'application/pdf', enc: 'bin', bytes: b }; };

async function owner(scope = '!room:store.test') {
  const ring = makeKeyring(mem(), { account: '@o:store.test' });
  await ring.ensure(scope);
  return { ring, scope };
}
const code = async (p) => { try { await p; } catch (e) { return e.code; } assert.fail('expected a refusal'); };

test('S1 — push then pull restores every record and every byte, identical; control: an empty device really is empty', async () => {
  const hs = homeserver(); const { ring, scope } = await owner();
  const a = device([doc('d1', 'Lease', blob('html', '<p>' + SECRET + '</p>'), bin('pdf', 40000, 3)), doc('d2', 'Recording', bin('media', 90000, 9))]);
  const r = await pushWorkspace({ scope, ring, net: hs.net, local: a.api });
  assert.equal(r.docs, 2); assert.equal(r.uploaded, 3);
  const b = device();
  assert.equal((await b.api.docs()).length, 0, 'control: the second device starts empty');
  const p = await pullWorkspace({ scope, ring, net: hs.net, local: b.api });
  assert.equal(p.restored, 2); assert.deepEqual(p.missing, []);
  for (const id of ['d1', 'd2']) {
    const x = a.recs.get(id), y = b.recs.get(id);
    assert.deepEqual(y.rec, x.rec);
    assert.equal(y.blobs.length, x.blobs.length);
    for (let i = 0; i < x.blobs.length; i++) {
      assert.equal(y.blobs[i].kind, x.blobs[i].kind);
      assert.equal(await sha256Hex(y.blobs[i].bytes), await sha256Hex(x.blobs[i].bytes));
    }
  }
});

test('S2 — nothing the server was sent or holds contains the plaintext; control: the scan finds it in an unsealed upload', async () => {
  const hs = homeserver(); const { ring, scope } = await owner();
  const a = device([doc('unit7-inspection-doc', SECRET, blob('html', '<p>' + SECRET + '</p>'))]);
  await pushWorkspace({ scope, ring, net: hs.net, local: a.api });
  const hay = () => hs.uploads.map((u) => Buffer.from(u).toString('latin1')).join('\n') + JSON.stringify(hs.pointer);
  assert.equal(hay().includes('inspection'), false, 'no word of it');
  assert.equal(hay().includes('Lease'), false);
  assert.equal(hay().includes('unit7-inspection-doc'), false, 'not even the document id');
  // control
  const naive = homeserver();
  await naive.net.upload(textToBytes('<p>' + SECRET + '</p>'));
  assert.equal(naive.uploads.map((u) => Buffer.from(u).toString('latin1')).join('').includes('inspection'), true, 'the probe can see plaintext');
});

test('S3 — a second push with nothing changed uploads only the manifest; one new document uploads only its own bytes', async () => {
  const hs = homeserver(); const { ring, scope } = await owner();
  const a = device([doc('d1', 'A', bin('pdf', 30000, 1)), doc('d2', 'B', bin('pdf', 30000, 2))]);
  await pushWorkspace({ scope, ring, net: hs.net, local: a.api });
  const before = hs.uploads.length;
  const again = await pushWorkspace({ scope, ring, net: hs.net, local: a.api });
  assert.equal(again.uploaded, 0); assert.equal(again.reused, 2);
  assert.equal(hs.uploads.length - before, 1, 'only the manifest');
  a.recs.set('d3', doc('d3', 'C', bin('pdf', 30000, 3)));
  const third = await pushWorkspace({ scope, ring, net: hs.net, local: a.api });
  assert.equal(third.uploaded, 1);
  // two documents with identical bytes share one stored blob
  a.recs.set('d4', doc('d4', 'C copy', bin('pdf', 30000, 3)));
  const fourth = await pushWorkspace({ scope, ring, net: hs.net, local: a.api });
  assert.equal(fourth.uploaded, 0);
});

test('S4 — a large file is chunked, no upload exceeds the server limit, and it reads back whole', async () => {
  const hs = homeserver({ limit: 200 * 1024 }); const { ring, scope } = await owner();
  const big = bin('media', 1_000_000, 5);
  const a = device([doc('d1', 'Long recording', big)]);
  await pushWorkspace({ scope, ring, net: hs.net, local: a.api, chunk: 8 * 1024 * 1024 });
  assert.ok(Math.max(...hs.sent) <= 200 * 1024, 'every upload fits the limit');
  assert.ok(hs.sent.filter((s) => s > 100000).length >= 4, 'it was split');
  const b = device();
  await pullWorkspace({ scope, ring, net: hs.net, local: b.api });
  assert.equal(await sha256Hex(b.recs.get('d1').blobs[0].bytes), await sha256Hex(big.bytes));
});

test('S5 — a changed byte is caught and that document is not half-restored; the others still arrive', async () => {
  const hs = homeserver(); const { ring, scope } = await owner();
  const a = device([doc('d1', 'Good', blob('html', '<p>fine</p>')), doc('d2', 'Hit', bin('pdf', 20000, 2))]);
  await pushWorkspace({ scope, ring, net: hs.net, local: a.api });
  // flip a byte in the pdf's stored blob (the largest upload that is not the manifest)
  const target = [...hs.media.entries()].sort((x, y) => y[1].length - x[1].length)[0];
  const copy = new Uint8Array(target[1]); copy[copy.length - 5] ^= 0xff; hs.media.set(target[0], copy);
  const b = device();
  const p = await pullWorkspace({ scope, ring, net: hs.net, local: b.api });
  assert.equal(p.restored, 1);
  assert.equal(p.missing.length, 1);
  assert.match(p.missing[0].why, /authenticate|changed/);
  assert.equal(b.recs.has('d2'), false, 'no half-restored document');
  assert.equal(b.recs.has('d1'), true);
});

test('S6 — a blob moved to another document is refused (it is bound to its hash and place)', async () => {
  const hs = homeserver(); const { ring, scope } = await owner();
  const a = device([doc('d1', 'One', bin('pdf', 20000, 1)), doc('d2', 'Two', bin('pdf', 20000, 2))]);
  await pushWorkspace({ scope, ring, net: hs.net, local: a.api });
  const [m1, m2] = [...hs.media.entries()].filter((e) => e[1].length > 15000);
  hs.media.set(m1[0], m2[1]);                         // d1's address now returns d2's sealed bytes
  const b = device();
  const p = await pullWorkspace({ scope, ring, net: hs.net, local: b.api });
  assert.equal(p.restored, 1);
  assert.equal(p.missing.length, 1);
});

test('S7 — a device without the key is locked, restores nothing, and the same blobs do not open under another workspace', async () => {
  const hs = homeserver(); const { ring, scope } = await owner();
  const a = device([doc('d1', 'One', blob('html', 'x'))]);
  await pushWorkspace({ scope, ring, net: hs.net, local: a.api });
  const stranger = makeKeyring(mem(), { account: '@x:store.test' });
  const b = device();
  assert.equal(await code(pullWorkspace({ scope, ring: stranger, net: hs.net, local: b.api })), CODE.Locked);
  assert.equal(b.recs.size, 0);
  // the same key offered for a different workspace id: the sealed manifest does not open (it is bound to its room)
  const other = '!other:store.test';
  const sameKeyElsewhere = { ...ring, keyFn: () => ring.keyFn(scope) };
  assert.equal(await code(pullWorkspace({ scope: other, ring: sameKeyElsewhere, net: hs.net, local: device().api })), STORE_CODE.Tampered);
});

test('S8 — a device that already has a document is never overwritten', async () => {
  const hs = homeserver(); const { ring, scope } = await owner();
  const a = device([doc('d1', 'Server copy', blob('html', 'server'))]);
  await pushWorkspace({ scope, ring, net: hs.net, local: a.api });
  const b = device([doc('d1', 'My newer edit', blob('html', 'mine'))]);
  const p = await pullWorkspace({ scope, ring, net: hs.net, local: b.api });
  assert.equal(p.skipped, 1); assert.equal(p.restored, 0);
  assert.equal(b.recs.get('d1').rec.title, 'My newer edit');
});

test('S9 — a non-owner with no key cannot start one: nothing is uploaded', async () => {
  const hs = homeserver();
  const ring = makeKeyring(mem(), { account: '@guest:store.test' });
  const net = { ...hs.net, ensureKey: async () => { throw new VaultError(CODE.NotOwner, 'only the owner starts the key'); } };
  const a = device([doc('d1', 'One', blob('html', 'x'))]);
  assert.equal(await code(pushWorkspace({ scope: '!r:store.test', ring, net, local: a.api })), CODE.NotOwner);
  assert.equal(hs.uploads.length, 0);
});

test('S10 — status reads the pointer only; nothing backed up reports so; a failed upload leaves the old pointer', async () => {
  const hs = homeserver(); const { ring, scope } = await owner();
  assert.equal((await storeStatus({ scope, ring, net: hs.net })).has, false);
  const a = device([doc('d1', 'One', bin('pdf', 20000, 1))]);
  await pushWorkspace({ scope, ring, net: hs.net, local: a.api });
  const st = await storeStatus({ scope, ring, net: hs.net });
  assert.equal(st.has, true); assert.equal(st.docs, 1); assert.equal(st.held, true);
  const good = JSON.stringify(hs.pointer);
  a.recs.set('d2', doc('d2', 'Two', bin('pdf', 20000, 2)));
  let k = 0;
  const flaky = { ...hs.net, upload: async (u8) => { if (k++ >= 1) throw new Error('503'); return hs.net.upload(u8); } };
  assert.equal(await code(pushWorkspace({ scope, ring, net: flaky, local: a.api })), STORE_CODE.Unreachable);
  assert.equal(JSON.stringify(hs.pointer), good, 'the earlier backup is still the one the room points at');
});

test('S11 — text sources round-trip through bytesToText', async () => {
  assert.equal(bytesToText(textToBytes('<p>naïve — café</p>')), '<p>naïve — café</p>');
});

test('S12 — two devices: a device that has only some documents never drops the rest, and both converge', async () => {
  const hs = homeserver(); const { ring, scope } = await owner();
  const a = device([doc('d1', 'From A', blob('html', 'a'))]);
  await pushWorkspace({ scope, ring, net: hs.net, local: a.api });
  const b = device([doc('d2', 'From B', blob('html', 'b'))]);          // B has not pulled yet, and pushes first
  const r = await pushWorkspace({ scope, ring, net: hs.net, local: b.api });
  assert.equal(r.docs, 2); assert.equal(r.carried, 1);
  await pullWorkspace({ scope, ring, net: hs.net, local: a.api });
  await pullWorkspace({ scope, ring, net: hs.net, local: b.api });
  assert.deepEqual([...a.recs.keys()].sort(), ['d1', 'd2']);
  assert.deepEqual([...b.recs.keys()].sort(), ['d1', 'd2']);
});

test('S13 — a removed source stays removed: it is not restored by a later pull, and a push does not carry it', async () => {
  const hs = homeserver(); const { ring, scope } = await owner();
  const a = device([doc('d1', 'Keep', blob('html', 'k')), doc('d2', 'Remove', blob('html', 'r'))]);
  await pushWorkspace({ scope, ring, net: hs.net, local: a.api });
  const b = device();
  await pullWorkspace({ scope, ring, net: hs.net, local: b.api });
  assert.equal(b.recs.size, 2);
  // B removes d2 and backs up again
  b.recs.delete('d2'); b.removedIds.add('d2');
  const r = await pushWorkspace({ scope, ring, net: hs.net, local: b.api });
  assert.equal(r.docs, 1); assert.equal(r.gone, 1);
  // A still has d2 locally, then pulls: the tombstone does not delete it from A (a pull only adds)
  await pullWorkspace({ scope, ring, net: hs.net, local: a.api });
  assert.equal(a.recs.has('d2'), true, 'a pull never deletes');
  // a brand-new device does not get d2
  const c = device();
  await pullWorkspace({ scope, ring, net: hs.net, local: c.api });
  assert.deepEqual([...c.recs.keys()], ['d1']);
  // and putting it back clears the tombstone
  b.recs.set('d2', doc('d2', 'Remove', blob('html', 'r')));
  b.removedIds.delete('d2');
  const r2 = await pushWorkspace({ scope, ring, net: hs.net, local: b.api });
  assert.equal(r2.gone, 0);
});
