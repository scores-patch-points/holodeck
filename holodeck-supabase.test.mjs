// holodeck-supabase.test.mjs — the whole Supabase path against fakes: email one-time code → session → a sealed
// store over the project's Storage. No network, no Supabase. The fake holds the bytes; the test checks they are
// ciphertext and that the round-trip is plaintext, with identity and key kept separate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeKeyring } from './holodeck-vault.js';
import { supabaseAuth, supabaseStore, passkeySupported } from './holodeck-supabase.js';

function fakeProject() {
  const objects = new Map();
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
  async function fetchImpl(url, opts = {}) {
    const u = new URL(url); const p = u.pathname; const method = opts.method || 'GET'; let m;
    if (method === 'POST' && p === '/auth/v1/otp') return json({});
    if (method === 'POST' && p === '/auth/v1/verify') {
      const b = JSON.parse(opts.body || '{}');
      if (b.token !== '123456') return json({ msg: 'invalid code' }, 400);
      return json({ access_token: 'jwt', refresh_token: 'r1', expires_in: 3600, user: { id: 'u1', email: b.email } });
    }
    if (method === 'POST' && p === '/auth/v1/token') return json({ access_token: 'jwt2', refresh_token: 'r2', expires_in: 3600, user: { id: 'u1' } });
    if (method === 'POST' && (m = p.match(/^\/storage\/v1\/object\/list\/([^/]+)$/))) {
      const prefix = (JSON.parse(opts.body || '{}').prefix) || ''; const names = new Map();
      for (const k of objects.keys()) { if (!k.startsWith(prefix)) continue; const rest = k.slice(prefix.length); if (!rest) continue; const s = rest.indexOf('/'); if (s < 0) names.set(rest, false); else names.set(rest.slice(0, s), true); }
      return json([...names.entries()].map(([name, folder]) => folder ? { name, id: null, metadata: null } : { name, id: 'id', metadata: { size: objects.get(prefix + name).length } }));
    }
    if (method === 'GET' && (m = p.match(/^\/storage\/v1\/object\/authenticated\/([^/]+)\/(.+)$/))) { const key = decodeURIComponent(m[2]); return objects.has(key) ? new Response(objects.get(key), { status: 200 }) : new Response('', { status: 404 }); }
    if (method === 'POST' && (m = p.match(/^\/storage\/v1\/object\/([^/]+)\/(.+)$/)) && m[1] !== 'list' && m[1] !== 'authenticated') { const key = decodeURIComponent(m[2]); objects.set(key, new Uint8Array(Buffer.from(opts.body))); return json({ Key: key }); }
    return new Response('', { status: 404 });
  }
  return { fetchImpl, objects };
}
const memStore = () => { const m = new Map(); return { get: async (k) => (m.has(k) ? JSON.parse(m.get(k)) : null), set: async (k, v) => { m.set(k, JSON.stringify(v)); } }; };

test('email one-time code signs in; a wrong code is refused', async () => {
  const d = fakeProject();
  const auth = supabaseAuth({ url: 'https://x.supabase.co', anonKey: 'anon', fetch: d.fetchImpl });
  await auth.sendOtp('a@b.c');
  const s = await auth.verifyOtp('a@b.c', '123456');
  assert.equal(s.access_token, 'jwt');
  await assert.rejects(() => auth.verifyOtp('a@b.c', '000000'), (e) => e.supabase && e.code === 'auth-400');
});

test('sign in, then seal a value into the project Storage', async () => {
  const d = fakeProject();
  const ring = makeKeyring(memStore(), { account: 'a@b.c' }); await ring.ensure('!ws:x');
  const supa = supabaseStore({ url: 'https://x.supabase.co', anonKey: 'anon', bucket: 'holodeck', workspace: '!ws:x', ring, fetch: d.fetchImpl });
  await supa.signIn({ email: 'a@b.c' });
  const { identity } = await supa.verify({ email: 'a@b.c', code: '123456' });
  assert.equal(identity.email, 'a@b.c');
  await supa.store.put('notes/a', { secret: 'the unit-7 report' });
  assert.deepEqual(await supa.store.get('notes/a'), { secret: 'the unit-7 report' });
  const raw = await supa.provider.get('notes/a');
  assert.ok(!new TextDecoder().decode(raw).includes('unit-7'), 'Supabase holds ciphertext, not the note');
});

test('the manifest points a second device at the bucket, sealed', async () => {
  const d = fakeProject();
  const ring = makeKeyring(memStore(), { account: 'a@b.c' }); await ring.ensure('!ws:x');
  const supa = supabaseStore({ url: 'https://x.supabase.co', anonKey: 'anon', bucket: 'holodeck', workspace: '!ws:x', ring, fetch: d.fetchImpl });
  await supa.signIn({ email: 'a@b.c' }); await supa.verify({ email: 'a@b.c', code: '123456' });
  await supa.writeManifest('ws1/');
  assert.deepEqual(await supa.readManifest(), { v: 1, provider: 'supabase', bucket: 'holodeck', prefix: 'ws1/' });
});

test('a facade without a workspace is refused; passkeySupport is a boolean', () => {
  assert.throws(() => supabaseStore({ url: 'https://x.supabase.co', anonKey: 'anon' }), (e) => e.supabase && e.code === 'no-workspace');
  assert.equal(typeof passkeySupported(), 'boolean');
});
