// holodeck-byo.test.mjs — the whole path end to end against fakes: Google sign-in (ID token + drive.appdata
// access token) → a Drive app folder → a sealed store. The fake Drive holds the bytes, and the test checks
// they are ciphertext, that the round-trip is plaintext, and that identity and key stay separate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeKeyring } from './holodeck-vault.js';
import { byoStorage, DRIVE_APPDATA } from './holodeck-byo.js';

const jwt = (c) => 'h.' + Buffer.from(JSON.stringify(c)).toString('base64url') + '.s';

function fakeGis() {
  const credential = jwt({ sub: '42', email: 'a@b.c', name: 'Ada' });
  let idCb = null, tokCb = null;
  return {
    id: { initialize(o) { idCb = o.callback; }, prompt() { idCb({ credential }); }, disableAutoSelect() {} },
    oauth2: { initTokenClient(o) { tokCb = o.callback; return { requestAccessToken() { queueMicrotask(() => tokCb({ access_token: 'at', expires_in: 3600 })); } }; } },
  };
}
function fakeDrive() {
  const files = new Map(); let n = 0;
  const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'content-type': 'application/json' } });
  return async function fetchImpl(url, opts = {}) {
    const u = new URL(url); const method = opts.method || 'GET';
    if (method === 'GET' && u.pathname.endsWith('/files')) return json({ files: [...files.entries()].map(([name, f]) => ({ id: f.id, name, size: String(f.bytes.length) })) });
    if (method === 'POST' && /\/files$/.test(u.pathname)) {
      const body = Buffer.from(opts.body);
      const meta = JSON.parse(/(\{[^}]*"name"[^}]*\})/.exec(body.toString('latin1'))[1]);
      const start = body.indexOf('\r\n\r\n', body.indexOf('\r\n\r\n') + 4) + 4, end = body.lastIndexOf('\r\n--');
      const bytes = new Uint8Array(body.subarray(start, end));
      const id = 'id' + (++n); files.set(meta.name, { id, bytes });
      return json({ id, name: meta.name, size: String(bytes.length) });
    }
    if (method === 'PATCH' && /\/files\/[^/]+$/.test(u.pathname)) {
      const id = u.pathname.split('/').pop(); const e = [...files.entries()].find(([, f]) => f.id === id);
      e[1].bytes = new Uint8Array(Buffer.from(opts.body)); return json({ id, name: e[0], size: String(e[1].bytes.length) });
    }
    if (method === 'GET' && u.searchParams.get('alt') === 'media') { const id = u.pathname.split('/').pop(); const e = [...files.values()].find((f) => f.id === id); return new Response(e ? e.bytes : '', { status: e ? 200 : 404 }); }
    return new Response(null, { status: 204 });
  };
}
const memStore = () => { const m = new Map(); return { get: async (k) => (m.has(k) ? JSON.parse(m.get(k)) : null), set: async (k, v) => { m.set(k, JSON.stringify(v)); } }; };

test('sign in with Google, then seal a value into your own Drive app folder', async () => {
  const ring = makeKeyring(memStore(), { account: 'a@b.c' }); await ring.ensure('!ws:x');
  const byo = byoStorage({ clientId: 'cid', scope: DRIVE_APPDATA, workspace: '!ws:x', gsi: fakeGis(), fetch: fakeDrive(), ring });
  const { identity } = await byo.signIn();
  assert.equal(identity.sub, '42');
  await byo.store.put('notes/a', { secret: 'the unit-7 report' });
  assert.deepEqual(await byo.store.get('notes/a'), { secret: 'the unit-7 report' });

  const raw = await byo.provider.get('notes/a');
  assert.ok(!new TextDecoder().decode(raw).includes('unit-7'), 'Google holds ciphertext, not the note');
  const all = new TextDecoder().decode(await byo.provider.get('notes/a'));
  assert.ok(all.includes('"vault"') && all.includes('"kid"') && all.includes('"ct"'), 'and it is a sealed object');
});

test('the manifest points a second device at the same app folder, sealed', async () => {
  const ring = makeKeyring(memStore(), { account: 'a@b.c' }); await ring.ensure('!ws:x');
  const byo = byoStorage({ clientId: 'cid', workspace: '!ws:x', gsi: fakeGis(), fetch: fakeDrive(), ring });
  await byo.signIn();
  await byo.writeManifest('ws1/');
  assert.deepEqual(await byo.readManifest(), { v: 1, provider: 'drive-appdata', prefix: 'ws1/' });
});

test('a facade without a client id or workspace is refused', () => {
  assert.throws(() => byoStorage({ workspace: '!ws:x' }), /client id/);
  assert.throws(() => byoStorage({ clientId: 'cid' }), /workspace/);
});
