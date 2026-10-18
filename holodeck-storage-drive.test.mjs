// holodeck-storage-drive.test.mjs — the Drive app-folder provider against a fake Drive. No network, no token:
// a fake fetch holds a name->file map, and the test drives create / read / update / list / delete and a 401 refresh.
import test from 'node:test';
import assert from 'node:assert/strict';
import { driveAppData, DriveError } from './holodeck-storage-drive.js';

function fakeDrive() {
  const files = new Map();   // name -> { id, bytes }
  let n = 0, unauthorizedOnce = 0;
  const seen = [];
  async function fetchImpl(url, opts = {}) {
    seen.push({ url: String(url), method: opts.method || 'GET' });
    if (unauthorizedOnce > 0) { unauthorizedOnce--; return new Response('nope', { status: 401, headers: { 'content-type': 'application/json' } }); }
    const u = new URL(url);
    const method = opts.method || 'GET';
    if (method === 'GET' && u.pathname.endsWith('/files')) {
      const list = [...files.entries()].map(([name, f]) => ({ id: f.id, name, size: String(f.bytes.length) }));
      return json({ files: list });
    }
    if (method === 'POST' && /\/files$/.test(u.pathname)) {
      const body = Buffer.from(opts.body);
      const meta = JSON.parse(/(\{[^}]*"name"[^}]*\})/.exec(body.toString('latin1'))[1]);
      const start = body.indexOf('\r\n\r\n', body.indexOf('\r\n\r\n') + 4) + 4;
      const end = body.lastIndexOf('\r\n--');
      const bytes = new Uint8Array(body.subarray(start, end));
      const id = 'id' + (++n);
      files.set(meta.name, { id, bytes });
      return json({ id, name: meta.name, size: String(bytes.length) });
    }
    if (method === 'PATCH' && /\/files\/[^/]+$/.test(u.pathname)) {
      const id = u.pathname.split('/').pop();
      const entry = [...files.entries()].find(([, f]) => f.id === id);
      const bytes = new Uint8Array(Buffer.from(opts.body));
      entry[1].bytes = bytes;
      return json({ id, name: entry[0], size: String(bytes.length) });
    }
    if (method === 'GET' && /\/files\/[^/]+$/.test(u.pathname) && u.searchParams.get('alt') === 'media') {
      const id = u.pathname.split('/').pop();
      const entry = [...files.values()].find((f) => f.id === id);
      if (!entry) return new Response('', { status: 404 });
      return new Response(entry.bytes, { status: 200, headers: { 'content-type': 'application/octet-stream' } });
    }
    if (method === 'DELETE' && /\/files\/[^/]+$/.test(u.pathname)) {
      const id = u.pathname.split('/').pop();
      for (const [k, f] of files) if (f.id === id) files.delete(k);
      return new Response(null, { status: 204 });
    }
    return new Response('not found', { status: 404 });
  }
  const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'content-type': 'application/json' } });
  return { fetchImpl, files, seen, failNextAuth: () => { unauthorizedOnce = 1; } };
}

test('put creates, get reads, put again updates in place', async () => {
  const d = fakeDrive();
  const p = driveAppData({ token: 'tok', fetch: d.fetchImpl });
  const a = new Uint8Array([1, 2, 3, 4]);
  const r1 = await p.put('a', a);
  assert.equal(r1.size, 4);
  assert.deepEqual([...(await p.get('a'))], [1, 2, 3, 4]);
  const b = new Uint8Array([9, 9]);
  await p.put('a', b);
  assert.deepEqual([...(await p.get('a'))], [9, 9]);
  assert.equal(d.files.size, 1, 'the update did not create a second file');
});

test('list filters by prefix and reports sizes', async () => {
  const d = fakeDrive();
  const p = driveAppData({ token: 'tok', fetch: d.fetchImpl });
  await p.put('ws1/a', new Uint8Array([1]));
  await p.put('ws1/b', new Uint8Array([1, 2]));
  await p.put('ws2/c', new Uint8Array([1, 2, 3]));
  const rows = await p.list('ws1/');
  assert.deepEqual(rows.map((x) => x.key).sort(), ['ws1/a', 'ws1/b']);
  assert.deepEqual(rows.map((x) => x.size).sort(), [1, 2]);
});

test('del removes the file', async () => {
  const d = fakeDrive();
  const p = driveAppData({ token: 'tok', fetch: d.fetchImpl });
  await p.put('a', new Uint8Array([7]));
  await p.del('a');
  assert.equal(await p.get('a'), null);
  assert.equal(d.files.size, 0);
});

test('a 401 refreshes the token once and retries', async () => {
  const d = fakeDrive();
  let calls = 0;
  const token = async ({ refresh }) => { calls++; return refresh ? 'fresh' : 'stale'; };
  const p = driveAppData({ token, fetch: d.fetchImpl });
  d.failNextAuth();
  await p.put('a', new Uint8Array([5]));      // first list 401s, the token is refreshed, the put succeeds
  assert.equal(calls, 2, 'the token source was asked for a refresh');
  assert.deepEqual([...(await p.get('a'))], [5]);
});

test('a stale cache does not create a second file with the same name', async () => {
  const d = fakeDrive();
  const a = driveAppData({ token: 'tok', fetch: d.fetchImpl });
  const b = driveAppData({ token: 'tok', fetch: d.fetchImpl });
  await b.list();                                   // b lists first: its cache is now populated and stale
  await a.put('k', new Uint8Array([1]));            // a writes the key b has never seen
  await b.put('k', new Uint8Array([2, 2]));         // b must refresh before creating, and UPDATE instead
  assert.equal(d.files.size, 1, 'no duplicate file was created');
  assert.deepEqual([...(await a.get('k'))], [2, 2], 'a reads what b wrote');
});

test('a missing token source is refused at construction', () => {
  assert.throws(() => driveAppData({ fetch: () => {} }), (e) => e.drive && e.code === 'no-token');
});
