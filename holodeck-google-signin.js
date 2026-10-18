// holodeck-google-signin.js — "Sign in with Google", and the token the Drive store needs.
//
// Google Identity Services (GIS) does this with no backend of ours: the page loads
// accounts.google.com/gsi/client and two clients come out of it —
//   * the ID client (google.accounts.id): yields an OpenID Connect ID token, a signed JWT. That is the
//     IDENTITY — what a Matrix homeserver (or holodeck-gate) verifies to sign the person in. Not a password,
//     not a key.
//   * the token client (google.accounts.oauth2): yields an ACCESS TOKEN for a scope — here `drive.appdata`,
//     the hidden app folder the storage provider (holodeck-storage-drive.js) writes sealed blobs to.
//
// WHAT THIS IS NOT. It never yields the encryption key. Google proves WHO someone is; the workspace keyring
// (holodeck-vault.js) proves they can READ their content. They stay separate on purpose: a Google sign-in must
// never be a way to decrypt, and losing the keyring loses the content, Google or not.
//
// PURE except loadGis(). Every client takes the `google.accounts` object in; only loadGis() touches a document,
// and it does nothing but add a script tag.

export const GIS_SRC = 'https://accounts.google.com/gsi/client';

export class GoogleError extends Error {
  constructor(code, why, detail = {}) { super(`${code}: ${why}`); this.name = 'GoogleError'; this.google = true; this.code = code; this.why = why; this.detail = detail; }
}

/** Load GIS once and hand back `google.accounts`. The only function here that touches a document. */
export function loadGis({ doc = globalThis.document, src = GIS_SRC, timeout = 15000 } = {}) {
  if (globalThis.google && globalThis.google.accounts) return Promise.resolve(globalThis.google.accounts);
  if (!doc) return Promise.reject(new GoogleError('no-document', 'there is no document to load the Google client into'));
  return new Promise((resolve, reject) => {
    const existing = doc.querySelector && doc.querySelector('script[data-gis]');
    const done = () => (globalThis.google && globalThis.google.accounts) ? resolve(globalThis.google.accounts) : reject(new GoogleError('gis-missing', 'the Google client loaded but google.accounts is not there'));
    const t = setTimeout(() => reject(new GoogleError('gis-timeout', 'the Google client did not load in time')), timeout);
    if (existing) { existing.addEventListener('load', () => { clearTimeout(t); done(); }); existing.addEventListener('error', () => { clearTimeout(t); reject(new GoogleError('gis-blocked', 'the Google client could not be loaded')); }); return; }
    const s = doc.createElement('script');
    s.src = src; s.async = true; s.defer = true;
    if (s.dataset) s.dataset.gis = '1';
    s.onload = () => { clearTimeout(t); done(); };
    s.onerror = () => { clearTimeout(t); reject(new GoogleError('gis-blocked', 'the Google client could not be loaded (a blocker, an offline browser, or a CSP)')); };
    (doc.head || doc.documentElement).appendChild(s);
  });
}

/** The payload of a JWT, decoded and NOT verified. Display/claims only — the homeserver verifies the signature. */
export function decodeJwtPayload(jwt) {
  const parts = String(jwt || '').split('.');
  if (parts.length < 2) return null;
  const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  try {
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch { return null; }
}
/** The few claims the holodeck names: { sub, email, name, picture }. Null if the token is not readable. */
export function identityOf(jwt) {
  const c = decodeJwtPayload(jwt);
  return c ? { sub: c.sub || null, email: c.email || null, name: c.name || null, picture: c.picture || null } : null;
}

/**
 * The ID-token client. `prompt()` shows Google's chooser and resolves the ID token (a JWT) or null.
 * `onCredential(fn)` also hands every later credential to `fn` (for a silent re-prompt on page load).
 */
export function idClient(gsi, { clientId, autoSelect = false, uxMode } = {}) {
  if (!gsi || !gsi.id || typeof gsi.id.initialize !== 'function') throw new GoogleError('no-id-client', 'this Google client has no id module');
  let pending = null, kept = null;
  gsi.id.initialize({
    client_id: clientId, auto_select: autoSelect, ...(uxMode ? { ux_mode: uxMode } : {}),
    callback: (r) => { const cred = r && r.credential ? r.credential : null; if (pending) { const p = pending; pending = null; p(cred); } if (kept) kept(cred); },
  });
  return {
    onCredential(fn) { kept = fn; },
    prompt({ momentNotification } = {}) { return new Promise((resolve) => { pending = resolve; gsi.id.prompt(momentNotification); }); },
    renderButton(el, opts) { return gsi.id.renderButton(el, opts); },
    disableAutoSelect() { if (gsi.id.disableAutoSelect) gsi.id.disableAutoSelect(); },
  };
}

/** The access-token client for a scope (drive.appdata). request() resolves Google's token response. */
export function tokenClient(gsi, { clientId, scope, prompt = '' } = {}) {
  if (!gsi || !gsi.oauth2 || typeof gsi.oauth2.initTokenClient !== 'function') throw new GoogleError('no-token-client', 'this Google client has no oauth2 module');
  let pending = null;
  const client = gsi.oauth2.initTokenClient({
    client_id: clientId, scope, prompt,
    callback: (resp) => { const p = pending; pending = null; if (p) (resp && resp.error ? p.reject(new GoogleError(resp.error, resp.error_description || 'Google refused the sign-in', resp)) : p.resolve(resp)); },
    error_callback: (err) => { const p = pending; pending = null; if (p) p.reject(new GoogleError((err && err.type) || 'auth', (err && err.message) || 'Google sign-in failed', err || {})); },
  });
  return {
    request(o = {}) {
      if (pending) return Promise.reject(new GoogleError('busy', 'a Google sign-in is already in progress'));
      return new Promise((resolve, reject) => { pending = { resolve, reject }; try { client.requestAccessToken(o); } catch (e) { pending = null; reject(e); } });
    },
  };
}

/**
 * Turn a token client into a token source for holodeck-storage-drive.js: cached until it is near expiry, and
 * re-requested (silently, `prompt: ''`) when the provider calls it with { refresh: true } after a 401.
 */
export function tokenSource(tc, { skewMs = 60000 } = {}) {
  let tok = null, exp = 0;
  return async ({ refresh = false, prompt = '' } = {}) => {
    const now = Date.now();
    if (!refresh && tok && now < exp - skewMs) return tok;
    const r = await tc.request(refresh ? {} : { prompt });
    tok = r && r.access_token;
    exp = now + Number((r && r.expires_in) || 3600) * 1000;
    if (!tok) throw new GoogleError('no-token', 'Google returned no access token');
    return tok;
  };
}
