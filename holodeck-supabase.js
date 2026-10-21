// holodeck-supabase.js — sign in with a Supabase project (email one-time code), and keep the workspace's
// sealed bytes in its Storage. The vendor path.
//
// Two halves, kept separate:
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
    /** Adopt a session directly (e.g. one already parsed from a redirect). */
    adopt(s) { session = s; ensure(); return { identity: this.identity, provider, store }; },
    writeManifest: (prefix = '') => putManifest(provider, keyring(), workspace, { provider: 'supabase', bucket, prefix }),
    readManifest: () => getManifest(provider, keyring(), workspace),
  };
}

/** Whether this browser can run a passkey ceremony (the next step; Supabase Auth has the WebAuthn endpoints). */
export function passkeySupported() { try { return !!(globalThis.navigator && globalThis.navigator.credentials && globalThis.navigator.credentials.get && globalThis.PublicKeyCredential); } catch { return false; } }

