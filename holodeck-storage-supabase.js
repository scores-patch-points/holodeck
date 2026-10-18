// holodeck-storage-supabase.js — a storage provider over Supabase Storage.
//
// The vendor path: no Google app to register, no per-origin OAuth client. A Supabase project's URL and
// publishable `anon` key are safe to ship in the repo (they are public; Row Level Security protects the rows),
// so ONE project serves EVERY holodeck — that is what makes "all holodecks" able to connect with no per-copy
// configuration. The person signs in with Supabase Auth (email one-time code; passkeys are the next step), and
// their session's access token authorizes Storage under RLS.
//
// It is a provider in the sense holodeck-storage.js means: opaque bytes in, opaque bytes out, under string keys.
// It does no sealing and knows no key; wrap it with sealedStore() and the bytes are plaintext only on the device.
//
// PURE. `fetch` and the access token are injected; nothing here signs in or stores a token. The token may be a
// string or a function ({ refresh }) -> string, called again after a 401.

import { isSealed } from './holodeck-vault.js';

const OBJECT = '/storage/v1/object';
const te = new TextEncoder();
const td = new TextDecoder();

// Two rules this provider enforces, because the person asked for them:
//   * TRANSPORT — the project URL must be HTTPS (loopback http is allowed for development, as Supabase allows).
//   * AT REST — every object written must be a SEALED envelope (holodeck-vault.js). Plaintext is refused at the
//     door, so what Supabase holds is ciphertext whether or not the platform's own at-rest encryption is on.
export const httpsOk = (u) => /^https:\/\//i.test(String(u)) || /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(String(u));

export class SupabaseError extends Error {
  constructor(code, why, status = 0, detail = {}) { super(`${code}: ${why}`); this.name = 'SupabaseError'; this.supabase = true; this.code = code; this.why = why; this.status = status; this.detail = detail; }
}

/**
 * create({ url, anonKey, bucket = 'holodeck', token, fetch?, requireSealed = true })
 *   url       the project URL, e.g. https://abcdefgh.supabase.co  (HTTPS required)
 *   anonKey   the publishable (anon) key — public by design
 *   token     the user's access token: a string, or ({ refresh }) -> string
 *   requireSealed  refuse to write anything that is not a sealed envelope (default true)
 * Returns a provider: { id, name, put, get, list, del }.
 */
export function supabaseStorage({ url, anonKey, bucket = 'holodeck', token, fetch: fetchImpl, requireSealed = true, name = 'Supabase Storage' } = {}) {
  const base = String(url || '').replace(/\/+$/, '');
  if (!base) throw new SupabaseError('no-url', 'a Supabase provider needs the project URL');
  if (!httpsOk(base)) throw new SupabaseError('insecure-transport', 'the Supabase URL must be HTTPS (loopback http is allowed for development)');
  if (!anonKey) throw new SupabaseError('no-key', 'a Supabase provider needs the publishable (anon) key');
  if (!token) throw new SupabaseError('no-token', 'a Supabase provider needs an access token (string or function)');
  const doFetch = fetchImpl || ((...a) => globalThis.fetch(...a));
  let cached = typeof token === 'string' ? token : null;
  const sealed = (b) => { try { return isSealed(JSON.parse(td.decode(b))); } catch { return false; } };
  // A key is a path: encode each segment (so a space or '?' in a name cannot break the URL) but keep the slashes.
  const keyPath = (key) => String(key).split('/').map(encodeURIComponent).join('/');

  async function bearer(refresh) {
    if (typeof token === 'string') return token;
    if (!cached || refresh) cached = await token({ refresh: !!refresh });
    if (!cached) throw new SupabaseError('no-token', 'the token source returned nothing');
    return cached;
  }
  async function call(method, path, { headers = {}, body, refreshed = false } = {}) {
    const h = { apikey: anonKey, ...headers, Authorization: 'Bearer ' + await bearer(false) };
    const r = await doFetch(base + path, { method, headers: h, body });
    if (r.status === 401 && !refreshed && typeof token === 'function') { await bearer(true); return call(method, path, { headers, body, refreshed: true }); }
    return r;
  }
  async function json(method, path, o) { const r = await call(method, path, o); const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch { j = null; } if (!r.ok) throw new SupabaseError('supabase-' + r.status, (j && (j.message || j.error)) || ('HTTP ' + r.status), r.status); return j; }

  // One folder's immediate children. A file has an id and metadata; a folder has neither, and is recursed into.
  async function listFolder(prefix) {
    const rows = await json('POST', `${OBJECT}/list/${encodeURIComponent(bucket)}`, {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prefix, limit: 1000, offset: 0, sortBy: { column: 'name', order: 'asc' } }),
    });
    const out = [];
    for (const r of Array.isArray(rows) ? rows : []) {
      if (!r || typeof r.name !== 'string') continue;
      const full = prefix + r.name;
      if (r.id && r.metadata) out.push({ key: full, size: Number((r.metadata && r.metadata.size) || 0), updatedTime: r.updated_at });
      else out.push(...await listFolder(full + '/'));
    }
    return out;
  }

  return {
    id: 'supabase', name, bucket,
    async put(key, bytes, { contentType = 'application/json' } = {}) {
      const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      if (requireSealed && !sealed(b)) throw new SupabaseError('plaintext-refused', 'this store holds only sealed content; seal on the device first', 0, { key });
      const r = await call('POST', `${OBJECT}/${encodeURIComponent(bucket)}/${keyPath(key)}`, { headers: { 'content-type': contentType, 'x-upsert': 'true' }, body: b });
      if (!r.ok) { const t = await r.text(); throw new SupabaseError('supabase-' + r.status, t.slice(0, 200) || ('HTTP ' + r.status), r.status); }
      return { key, size: b.length };
    },
    async get(key) {
      const r = await call('GET', `${OBJECT}/authenticated/${encodeURIComponent(bucket)}/${keyPath(key)}`);
      if (r.status === 404 || r.status === 400) return null;
      if (!r.ok) throw new SupabaseError('supabase-' + r.status, 'HTTP ' + r.status, r.status);
      return new Uint8Array(await r.arrayBuffer());
    },
    async list(prefix = '') {
      const all = await listFolder(prefix);
      return all.filter((x) => x.key.startsWith(prefix));
    },
    async del(key) {
      const r = await call('DELETE', `${OBJECT}/${encodeURIComponent(bucket)}/${keyPath(key)}`);
      if (!r.ok && r.status !== 404) throw new SupabaseError('supabase-' + r.status, 'HTTP ' + r.status, r.status);
    },
  };
}
