// holodeck-supabase.js — sign in with a Supabase project (email one-time code), and keep the workspace's
// sealed bytes in its Storage. The vendor path, with no Google app anywhere.
//
// Two halves, kept separate like the Google path:
//   * Supabase Auth proves WHO the person is — an email one-time code today (passkeys are the next step, via
//     Supabase's WebAuthn API). It is not the key.
//   * Supabase Storage holds the bytes, sealed on the device first (sealedStore over holodeck-storage-supabase.js).
//
// Because the project URL and the publishable `anon` key are public, this whole path ships in the repo: one
// Supabase project serves every holodeck, and a person signs into their own account there. RLS decides what
// each account may read or write.
//
// PURE. `fetch` is injected; nothing here stores a token or touches a page.

import { supabaseStorage, SupabaseError, httpsOk } from './holodeck-storage-supabase.js';
import { sealedStore, putManifest, getManifest } from './holodeck-storage.js';
import { deviceKeyring } from './holodeck-vault.js';

const AUTH = '/auth/v1';
const sess = (j) => ({ access_token: j.access_token, refresh_token: j.refresh_token || null, expires_in: Number(j.expires_in || 3600), expires_at: Date.now() + Number(j.expires_in || 3600) * 1000, user: j.user || null });

/** The Supabase Auth client: email one-time code in, a session out. */
export function supabaseAuth({ url, anonKey, fetch: fetchImpl } = {}) {
  const base = String(url || '').replace(/\/+$/, '');
  if (!base) throw new SupabaseError('no-url', 'Supabase Auth needs the project URL');
  if (!httpsOk(base)) throw new SupabaseError('insecure-transport', 'the Supabase URL must be HTTPS (loopback http is allowed for development)');
  if (!anonKey) throw new SupabaseError('no-key', 'Supabase Auth needs the publishable (anon) key');
  const doFetch = fetchImpl || ((...a) => globalThis.fetch(...a));
  async function post(path, body) {
    const r = await doFetch(base + path, { method: 'POST', headers: { apikey: anonKey, 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });
    let j = null; try { j = await r.json(); } catch { j = null; }
    if (!r.ok) throw new SupabaseError('auth-' + r.status, (j && (j.msg || j.error_description || j.error)) || ('HTTP ' + r.status), r.status);
    return j;
  }
  return {
    /** Email a one-time code (and a magic link) to this address. Creates the account if it is new. */
    async sendOtp(email) { await post(AUTH + '/otp', { email, create_user: true }); return { email }; },
    /** Exchange the code for a session. */
    async verifyOtp(email, token) { return sess(await post(AUTH + '/verify', { type: 'email', email, token })); },
    /** A fresh access token from a refresh token. */
    async refresh(refresh_token) { return sess(await post(AUTH + '/token?grant_type=refresh_token', { refresh_token })); },
  };
}

/**
 * The facade: sign in, then a sealed store over the person's Supabase Storage.
 *   { url, anonKey, bucket = 'holodeck', workspace, account, ring?, fetch? }
 * signIn({ email })  → sends the code;  verify({ email, code }) → session + { provider, store, identity }.
 */
export function supabaseStore({ url, anonKey, bucket = 'holodeck', workspace, account = '', ring = null, fetch: fetchImpl } = {}) {
  if (!workspace) throw new SupabaseError('no-workspace', 'supabaseStore needs a workspace (its private room id)');
  const keyring = () => ring || deviceKeyring(account);
  const auth = supabaseAuth({ url, anonKey, fetch: fetchImpl });
  let session = null, provider = null, store = null;

  async function accessToken({ refresh = false } = {}) {
    if (!session) throw new SupabaseError('no-session', 'sign in first');
    if (!refresh && session.access_token && Date.now() < session.expires_at - 60000) return session.access_token;
    if (session.refresh_token) session = { ...session, ...(await auth.refresh(session.refresh_token)) };
    return session.access_token;
  }
  function ensure() {
    if (!provider) provider = supabaseStorage({ url, anonKey, bucket, token: (o) => accessToken(o), fetch: fetchImpl });
    if (!store) store = sealedStore(provider, keyring(), workspace);
  }

  return {
    get provider() { return provider; },
    get store() { return store; },
    get session() { return session; },
    get identity() { return session && session.user ? { id: session.user.id, email: session.user.email } : null; },
    workspace, bucket,
    signIn: ({ email } = {}) => auth.sendOtp(email),
    async verify({ email, code } = {}) { session = await auth.verifyOtp(email, code); ensure(); return { identity: this.identity, provider, store }; },
    signOut() { session = null; provider = null; store = null; },
    /** The URL to send the browser to for "Continue with Google" (its secret lives in Supabase, not here). */
    authorizeUrl: ({ redirectTo, provider = 'google', scopes = '' } = {}) => oauthAuthorizeUrl({ url, provider, redirectTo, scopes }),
    /** Adopt a session directly (e.g. one already parsed from a redirect). */
    adopt(s) { session = s; ensure(); return { identity: this.identity, provider, store }; },
    /** After the OAuth round-trip: read the session Supabase left in `href` and connect. */
    resume(href) {
      const s = sessionFromRedirect(href);
      if (!s) return null;
      if (s.error) throw new SupabaseError('oauth-' + s.error, s.error_description || s.error);
      if (s.code) throw new SupabaseError('pkce-unsupported', 'this holodeck uses the implicit flow; configure the Supabase client for implicit or exchange the code server-side');
      return this.adopt(s);
    },
    writeManifest: (prefix = '') => putManifest(provider, keyring(), workspace, { provider: 'supabase', bucket, prefix }),
    readManifest: () => getManifest(provider, keyring(), workspace),
  };
}

/** Whether this browser can run a passkey ceremony (the next step; Supabase Auth has the WebAuthn endpoints). */
export function passkeySupported() { try { return !!(globalThis.navigator && globalThis.navigator.credentials && globalThis.navigator.credentials.get && globalThis.PublicKeyCredential); } catch { return false; } }

// ------------------------------------------------------------------ Sign in with Google, THROUGH Supabase
// One Google OAuth client (its secret lives in Supabase, never here) and one Supabase project serve every
// holodeck: each holodeck origin is allow-listed once in Supabase's Redirect URLs. The browser goes
//   app → {project}/auth/v1/authorize?provider=google → Google → {project}/auth/v1/callback → app#access_token=…
// (implicit flow), and the returned session's access token is also the Storage token — one login, both halves.

/** The URL to send the browser to for "Continue with Google". */
export function oauthAuthorizeUrl({ url, provider = 'google', redirectTo, scopes = '' } = {}) {
  const base = String(url || '').replace(/\/+$/, '');
  if (!base) throw new SupabaseError('no-url', 'a Supabase project URL is needed');
  if (!httpsOk(base)) throw new SupabaseError('insecure-transport', 'the Supabase URL must be HTTPS (loopback http is allowed for development)');
  const u = new URL(base + '/auth/v1/authorize');
  u.searchParams.set('provider', provider);
  if (scopes) u.searchParams.set('scopes', scopes);
  if (redirectTo) u.searchParams.set('redirect_to', redirectTo);
  return u.toString();
}

const decodeJwt = (jwt) => { try { const p = String(jwt).split('.')[1]; const b = atob(p.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (p.length % 4)) % 4)); return JSON.parse(new TextDecoder().decode(Uint8Array.from(b, (c) => c.charCodeAt(0)))); } catch { return null; } };

/**
 * The session Supabase left in the page after the OAuth round-trip.
 * Implicit flow puts { access_token, refresh_token, expires_in } in the fragment (and the identity in the JWT).
 * A PKCE flow leaves ?code= instead — returned as { code }, to be exchanged (not done here; disclosed).
 * Returns null when there is nothing to resume.
 */
export function sessionFromRedirect(href) {
  let u; try { u = new URL(href); } catch { return null; }
  const frag = new URLSearchParams(String(u.hash || '').replace(/^#/, ''));
  const get = (k) => frag.get(k) || u.searchParams.get(k);
  if (get('error')) return { error: get('error'), error_description: get('error_description') || '' };
  const at = frag.get('access_token');
  if (at) { const c = decodeJwt(at) || {}; return sess({ access_token: at, refresh_token: frag.get('refresh_token'), expires_in: frag.get('expires_in'), user: { id: c.sub, email: c.email } }); }
  const code = u.searchParams.get('code');
  return code ? { code } : null;
}
