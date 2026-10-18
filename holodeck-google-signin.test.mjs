// holodeck-google-signin.test.mjs — the GIS clients against a fake google.accounts. No network, no Google:
// the fake fires the same callbacks the real library does, and the test checks the ID token, the token client,
// the cache, the error path, and the script loader.
import test from 'node:test';
import assert from 'node:assert/strict';
import { idClient, tokenClient, tokenSource, decodeJwtPayload, identityOf, loadGis, GoogleError } from './holodeck-google-signin.js';

const jwt = (claims) => 'h.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.s';

function fakeGis(initial = {}) {
  const state = { credential: jwt({ sub: '123', email: 'a@b.c', name: 'Ada' }), token: { access_token: 'at1', expires_in: 3600 }, ...initial };
  let idCb = null, tokCb = null, tokErr = null, prompted = 0, requests = 0;
  const gsi = {
    id: { initialize(o) { idCb = o.callback; }, prompt() { prompted++; idCb({ credential: state.credential }); }, disableAutoSelect() {}, renderButton() { return 'btn'; } },
    oauth2: { initTokenClient(o) { tokCb = o.callback; tokErr = o.error_callback; return { requestAccessToken() { requests++; queueMicrotask(() => tokCb(state.token)); } }; } },
  };
  return { gsi, prompted: () => prompted, requests: () => requests, fail: (e) => tokErr(e), setToken: (t) => { state.token = t; } };
}

test('the ID client resolves the ID token, and identityOf reads it', async () => {
  const f = fakeGis();
  const id = idClient(f.gsi, { clientId: 'cid' });
  const cred = await id.prompt();
  assert.equal(cred, f.gsi && jwt({ sub: '123', email: 'a@b.c', name: 'Ada' }));
  assert.deepEqual(identityOf(cred), { sub: '123', email: 'a@b.c', name: 'Ada', picture: null });
  assert.equal(f.prompted(), 1);
});

test('decodeJwtPayload is null on rubbish, not a throw', () => {
  assert.equal(decodeJwtPayload('not-a-jwt'), null);
  assert.equal(identityOf(''), null);
  assert.equal(decodeJwtPayload('a.@@@.c'), null);
});

test('the token client resolves an access token', async () => {
  const f = fakeGis();
  const tc = tokenClient(f.gsi, { clientId: 'cid', scope: 'https://www.googleapis.com/auth/drive.appdata' });
  const r = await tc.request({ prompt: 'consent' });
  assert.equal(r.access_token, 'at1');
});

test('the token source caches until refresh is asked for', async () => {
  const f = fakeGis();
  const ts = tokenSource(tokenClient(f.gsi, { clientId: 'cid', scope: 's' }));
  assert.equal(await ts(), 'at1');
  assert.equal(await ts(), 'at1');
  assert.equal(f.requests(), 1, 'a second call inside the window did not re-request');
  f.setToken({ access_token: 'at2', expires_in: 3600 });
  assert.equal(await ts({ refresh: true }), 'at2');
  assert.equal(f.requests(), 2);
});

test('a Google refusal rejects the request with a typed error', async () => {
  const f = fakeGis();
  const tc = tokenClient(f.gsi, { clientId: 'cid', scope: 's' });
  const p = tc.request();
  f.fail({ type: 'popup_closed', message: 'the person closed the window' });
  await p.then(() => assert.fail('expected a refusal'), (e) => { assert.ok(e.google); assert.equal(e.code, 'popup_closed'); });
});

test('loadGis adds the script once and hands back google.accounts', async () => {
  const realGoogle = globalThis.google;
  delete globalThis.google;
  const head = { children: [], appendChild(s) { this.children.push(s); setTimeout(() => { globalThis.google = { accounts: { id: {}, oauth2: {} } }; s.onload(); }, 0); } };
  const doc = { head, querySelector: () => null, createElement: () => ({ set src(v) { this._src = v; }, get src() { return this._src; }, dataset: {}, addEventListener() {} }) };
  const accounts = await loadGis({ doc });
  assert.ok(accounts && accounts.id);
  assert.equal(head.children.length, 1);
  delete globalThis.google;
  if (realGoogle) globalThis.google = realGoogle;
});

test('loadGis without a document is refused, not hung', async () => {
  const realGoogle = globalThis.google;
  delete globalThis.google;
  await loadGis({ doc: null }).then(() => assert.fail('expected a refusal'), (e) => { assert.ok(e.google); assert.equal(e.code, 'no-document'); });
  if (realGoogle) globalThis.google = realGoogle;
});
