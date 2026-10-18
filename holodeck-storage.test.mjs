// holodeck-storage.test.mjs — the sealed store refuses what it must: plaintext where ciphertext belongs, a blob
// moved onto another key, and a tampered byte. Each refusal has a control (the same value read back where it belongs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeKeyring, isSealed } from './holodeck-vault.js';
import { memoryProvider, localStorageProvider, sealedStore, assertProvider, putManifest, getManifest, SCODE } from './holodeck-storage.js';

const memStore = () => { const m = new Map(); return { m, get: async (k) => (m.has(k) ? JSON.parse(m.get(k)) : null), set: async (k, v) => { m.set(k, JSON.stringify(v)); } }; };
const freshRing = async (scope) => { const r = makeKeyring(memStore(), { account: 'a@b.c' }); await r.ensure(scope); return r; };
const rejectCode = (p, code) => p.then(() => assert.fail('expected a refusal'), (e) => { assert.ok(e && (e.vault || e.store), 'typed error, got ' + (e && e.message)); assert.equal(e.code, code); });

test('a value round-trips through a sealed store', async () => {
  const ring = await freshRing('!room:x'); const store = sealedStore(memoryProvider(), ring, '!room:x');
  await store.put('notes/a', { text: 'the unit-7 report', n: 3 });
  assert.deepEqual(await store.get('notes/a'), { text: 'the unit-7 report', n: 3 });
  assert.equal(await store.get('notes/missing'), null);
});

test('the provider holds only ciphertext, and it is sealed', async () => {
  const ring = await freshRing('!room:x'); const provider = memoryProvider(); const store = sealedStore(provider, ring, '!room:x');
  await store.put('a', { secret: 'pineapple' });
  const raw = await provider.get('a');
  const obj = JSON.parse(new TextDecoder().decode(raw));
  assert.ok(isSealed(obj), 'what the provider holds is a sealed object');
  assert.ok(!new TextDecoder().decode(raw).includes('pineapple'), 'the plaintext is not in the stored bytes');
});

test('a tampered byte is refused (control: the untampered one opens)', async () => {
  const ring = await freshRing('!room:x'); const provider = memoryProvider(); const store = sealedStore(provider, ring, '!room:x');
  await store.put('a', { v: 1 });
  assert.deepEqual(await store.get('a'), { v: 1 });
  const raw = await provider.get('a'); const obj = JSON.parse(new TextDecoder().decode(raw));
  const ct = Buffer.from(obj.ct.replace(/-/g, '+').replace(/_/g, '/'), 'base64'); ct[0] ^= 0xff;
  obj.ct = ct.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  await provider.put('a', new TextEncoder().encode(JSON.stringify(obj)));
  await rejectCode(store.get('a'), 'vault-tampered');
});

test('a blob moved onto another key will not open there', async () => {
  const ring = await freshRing('!room:x'); const provider = memoryProvider(); const store = sealedStore(provider, ring, '!room:x');
  await store.put('a', { v: 'for a' });
  await provider.put('b', await provider.get('a'));           // the store moves the blob to key b
  await rejectCode(store.get('b'), 'vault-tampered');         // the AAD binds it to its own path
});

test('plaintext where ciphertext belongs is a downgrade, not a read', async () => {
  const ring = await freshRing('!room:x'); const provider = memoryProvider(); const store = sealedStore(provider, ring, '!room:x');
  await provider.put('a', new TextEncoder().encode(JSON.stringify({ not: 'sealed' })));
  await rejectCode(store.get('a'), 'vault-downgrade');
});

test('rotation: old blobs still open, new blobs use the new key', async () => {
  const ring = await freshRing('!room:x'); const provider = memoryProvider(); const store = sealedStore(provider, ring, '!room:x');
  await store.put('old', { v: 'before' });
  const before = JSON.parse(new TextDecoder().decode(await provider.get('old'))).kid;
  await ring.rotate('!room:x');
  assert.deepEqual(await store.get('old'), { v: 'before' });   // the old key is kept
  await store.put('new', { v: 'after' });
  const after = JSON.parse(new TextDecoder().decode(await provider.get('new'))).kid;
  assert.notEqual(after, before, 'a new write uses the new key');
});

test('the manifest is sealed and points a second device at the store', async () => {
  const ring = await freshRing('!room:x'); const provider = memoryProvider();
  await putManifest(provider, ring, '!room:x', { provider: 'drive-appdata', prefix: 'ws1/' });
  const raw = new TextDecoder().decode(await provider.get('.holodeck/manifest'));
  assert.ok(!raw.includes('drive-appdata'), 'the manifest does not name the store in the clear');
  assert.deepEqual(await getManifest(provider, ring, '!room:x'), { v: 1, provider: 'drive-appdata', prefix: 'ws1/' });
});

test('a prefix keeps two workspaces apart in one store', async () => {
  const provider = memoryProvider();
  const a = sealedStore(provider, await freshRing('!a:x'), '!a:x', { prefix: 'a/' });
  const b = sealedStore(provider, await freshRing('!b:x'), '!b:x', { prefix: 'b/' });
  await a.put('k', { who: 'a' }); await b.put('k', { who: 'b' });
  assert.deepEqual(await a.get('k'), { who: 'a' });
  assert.deepEqual(await b.get('k'), { who: 'b' });
  assert.deepEqual((await a.list()).map((r) => r.key), ['k']);
});

test('assertProvider refuses a thing that is not a provider', () => {
  assert.throws(() => assertProvider({ id: 'x' }), (e) => e.store && e.code === SCODE.BadProvider);
  assert.ok(assertProvider(memoryProvider()));
});

test('the localStorage provider stores bytes and lists by prefix', async () => {
  const ls = (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), key: (i) => [...m.keys()][i], get length() { return m.size; } }; })();
  const p = localStorageProvider(ls, { ns: 'hd:' });
  const bytes = new Uint8Array([1, 2, 3, 250]);
  await p.put('x/y', bytes);
  assert.deepEqual([...(await p.get('x/y'))], [1, 2, 3, 250]);
  assert.deepEqual((await p.list('x/')).map((r) => r.key), ['x/y']);
  await p.del('x/y');
  assert.equal(await p.get('x/y'), null);
});
