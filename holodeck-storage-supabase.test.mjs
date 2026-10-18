// holodeck-storage-supabase.test.mjs — the Supabase Storage provider against a fake project. No network: a fake
// fetch holds a path->bytes map, lists folder children, and drives create / read / nested list / delete / 401.
import test from 'node:test';
import assert from 'node:assert/strict';
import { supabaseStorage, SupabaseError } from './holodeck-storage-supabase.js';

function fakeSupabase() {
  const objects = new Map(); let unauthorizedOnce = 0;
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
  async function fetchImpl(url, opts = {}) {
    if (unauthorizedOnce > 0) { unauthorizedOnce--; return new Response('no', { status: 401 }); }
    const u = new URL(url); const method = opts.method || 'GET'; const p = u.pathname;
    let m;
    if (method === 'POST' && (m = p.match(/^\/storage\/v1\/object\/list\/([^/]+)$/))) {
      const prefix = (JSON.parse(opts.body || '{}').prefix) || '';
      const names = new Map();
      for (const k of objects.keys()) {
        if (!k.startsWith(prefix)) continue;
        const rest = k.slice(prefix.length); if (!rest) continue;
        const slash = rest.indexOf('/');
        if (slash < 0) names.set(rest, false); else names.set(rest.slice(0, slash), true);
      }
      return json([...names.entries()].map(([name, folder]) => folder ? { name, id: null, metadata: null } : { name, id: 'id-' + name, metadata: { size: objects.get(prefix + name).length } }));
    }
    if (method === 'GET' && (m = p.match(/^\/storage\/v1\/object\/authenticated\/([^/]+)\/(.+)$/))) {
      const key = decodeURIComponent(m[2]);
      return objects.has(key) ? new Response(objects.get(key), { status: 200 }) : new Response('', { status: 404 });
    }
    if (method === 'POST' && (m = p.match(/^\/storage\/v1\/object\/([^/]+)\/(.+)$/)) && m[1] !== 'list' && m[1] !== 'authenticated') {
      const key = decodeURIComponent(m[2]); objects.set(key, new Uint8Array(Buffer.from(opts.body))); return json({ Key: key });
    }
    if (method === 'DELETE' && (m = p.match(/^\/storage\/v1\/object\/([^/]+)\/(.+)$/))) { objects.delete(decodeURIComponent(m[2])); return json({}); }
    return new Response('not found', { status: 404 });
  }
  return { fetchImpl, objects, failNextAuth: () => { unauthorizedOnce = 1; } };
}

test('put creates, get reads, list walks nested folders', async () => {
  const d = fakeSupabase();
  const p = supabaseStorage({ url: 'https://x.supabase.co', anonKey: 'anon', bucket: 'holodeck', token: 'jwt', fetch: d.fetchImpl, requireSealed: false });
  await p.put('ws1/a', new Uint8Array([1, 2]));
  await p.put('ws1/sub/b', new Uint8Array([3]));
  assert.deepEqual([...(await p.get('ws1/a'))], [1, 2]);
  const rows = await p.list('ws1/');
  assert.deepEqual(rows.map((r) => r.key).sort(), ['ws1/a', 'ws1/sub/b']);
  assert.deepEqual(rows.map((r) => r.size).sort(), [1, 2]);
});

test('get of a missing key is null, not a throw', async () => {
  const d = fakeSupabase();
  const p = supabaseStorage({ url: 'https://x.supabase.co', anonKey: 'anon', token: 'jwt', fetch: d.fetchImpl, requireSealed: false });
  assert.equal(await p.get('nope'), null);
});

test('del removes the object', async () => {
  const d = fakeSupabase();
  const p = supabaseStorage({ url: 'https://x.supabase.co', anonKey: 'anon', token: 'jwt', fetch: d.fetchImpl, requireSealed: false });
  await p.put('a', new Uint8Array([9]));
  await p.del('a');
  assert.equal(await p.get('a'), null);
});

test('a 401 refreshes the token once and retries', async () => {
  const d = fakeSupabase();
  let calls = 0;
  const token = async ({ refresh }) => { calls++; return refresh ? 'fresh' : 'stale'; };
  const p = supabaseStorage({ url: 'https://x.supabase.co', anonKey: 'anon', token, fetch: d.fetchImpl, requireSealed: false });
  d.failNextAuth();
  await p.put('a', new Uint8Array([5]));
  assert.equal(calls, 2);
  assert.deepEqual([...(await p.get('a'))], [5]);
});

test('a key with a space or slash is encoded as a path, not a broken URL', async () => {
  const d = fakeSupabase();
  const p = supabaseStorage({ url: 'https://x.supabase.co', anonKey: 'anon', token: 'jwt', fetch: d.fetchImpl, requireSealed: false });
  await p.put('notes/a b/c?d', new Uint8Array([7]));
  assert.deepEqual([...(await p.get('notes/a b/c?d'))], [7]);
  await p.del('notes/a b/c?d');
  assert.equal(await p.get('notes/a b/c?d'), null);
});

test('by default plaintext is refused at the door (at rest = ciphertext)', async () => {
  const d = fakeSupabase();
  const p = supabaseStorage({ url: 'https://x.supabase.co', anonKey: 'anon', token: 'jwt', fetch: d.fetchImpl });
  await assert.rejects(() => p.put('a', new TextEncoder().encode('{"plain":"text"}')), (e) => e.supabase && e.code === 'plaintext-refused');
  assert.equal(d.objects.size, 0, 'nothing reached the store');
});

test('a non-HTTPS project URL is refused (transport = TLS)', () => {
  assert.throws(() => supabaseStorage({ url: 'http://x.supabase.co', anonKey: 'a', token: 't' }), (e) => e.supabase && e.code === 'insecure-transport');
  assert.doesNotThrow(() => supabaseStorage({ url: 'https://x.supabase.co', anonKey: 'a', token: 't' }));
  assert.doesNotThrow(() => supabaseStorage({ url: 'http://localhost:54321', anonKey: 'a', token: 't' })); // loopback dev
});

test('a provider without url, key or token is refused at construction', () => {
  assert.throws(() => supabaseStorage({ anonKey: 'a', token: 't' }), (e) => e.supabase && e.code === 'no-url');
  assert.throws(() => supabaseStorage({ url: 'https://x.supabase.co', token: 't' }), (e) => e.supabase && e.code === 'no-key');
  assert.throws(() => supabaseStorage({ url: 'https://x.supabase.co', anonKey: 'a' }), (e) => e.supabase && e.code === 'no-token');
});
