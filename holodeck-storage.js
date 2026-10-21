// holodeck-storage.js — a workspace's bytes, wherever the person keeps them, sealed.
//
// The holodeck is a client: identity is the person's own Matrix account, and the bytes live in
// whatever store they bring — their own
// homeserver, or just this browser. This module is the seam.
//
// A PROVIDER is anything that can put/get/list/del OPAQUE BYTES under string keys. It never sees a
// key and never sees plaintext: it is handed ciphertext and hands ciphertext back. A SEALED STORE
// wraps a provider with the workspace keyring (holodeck-vault.js): every put is sealed on the device
// first, every get is opened here, and a provider that hands back content that is not sealed is
// REFUSED with a typed downgrade — a forged "blob" cannot become plaintext. The AAD binds each blob
// to the workspace and its own path, so a store cannot move one blob onto another key and still open it.
//
// The MANIFEST is how a second device learns where a workspace's bytes live. It is itself sealed and
// small — { v, provider, prefix } — and its address is a pointer the caller chooses (a Matrix state
// slot, or a well-known path in the same store). The store is untrusted; the manifest only says where
// to look, never what is there.
//
// PURE: nothing here fetches, and no store, token or page is touched. The provider is injected.

import { isSealed, VaultError, CODE } from './holodeck-vault.js';

const te = new TextEncoder();
const td = new TextDecoder();

export const BLOB = 'io.holodeck.blob';           // the AAD type every sealed blob carries
export const MANIFEST_KEY = '.holodeck/manifest'; // where a store's own pointer lives, unless the caller says otherwise
export const MANIFEST_V = 1;

export class StoreError extends Error {
  constructor(code, why, detail = {}) { super(`${code}: ${why}`); this.name = 'StoreError'; this.store = true; this.code = code; this.why = why; this.detail = detail; }
}
export const SCODE = Object.freeze({
  BadProvider: 'store-bad-provider',   // the thing handed in is not a provider
  NoBytes: 'store-no-bytes',           // a provider returned something that is not bytes
});

/** A provider is { id, name, put(key, bytes, opts?), get(key), list(prefix?), del(key) }. Throws if it is not one. */
export function assertProvider(p) {
  if (!p || typeof p !== 'object') throw new StoreError(SCODE.BadProvider, 'a storage provider is an object');
  for (const m of ['put', 'get', 'list', 'del']) if (typeof p[m] !== 'function') throw new StoreError(SCODE.BadProvider, `a storage provider must have ${m}()`, { missing: m });
  return p;
}

const asBytes = (b, what) => {
  if (b == null) return null;
  if (b instanceof Uint8Array) return b;
  if (b instanceof ArrayBuffer) return new Uint8Array(b);
  if (typeof b === 'string') return te.encode(b);
  throw new StoreError(SCODE.NoBytes, `the provider's ${what} is not bytes`, { what });
};

/**
 * Wrap a provider so everything written is sealed and everything read is opened.
 *   provider  an opaque-bytes store (assertProvider'd)
 *   ring      a keyring from makeKeyring()/deviceKeyring() — only sealFor/openFor are used
 *   scope     the workspace name (the private room id, as everywhere else)
 *   type      the AAD type; default BLOB
 *   prefix    a path prefix inside the provider, so one store can hold several workspaces
 * Returns { provider, scope, put, get, has, list, del } over plaintext VALUES (anything JSON).
 */
export function sealedStore(provider, ring, scope, { type = BLOB, prefix = '' } = {}) {
  assertProvider(provider);
  if (!ring || typeof ring.sealFor !== 'function' || typeof ring.openFor !== 'function') throw new StoreError(SCODE.BadProvider, 'sealedStore needs a keyring (makeKeyring/deviceKeyring)');
  const path = (key) => String(prefix) + key;
  const ctx = (key) => ({ type, key: path(key) });

  return {
    provider, scope, prefix, type,
    /** Seal `value` and write it at `key`. Returns the provider's own result. */
    async put(key, value) {
      const sealed = await ring.sealFor(scope, value, ctx(key));
      return provider.put(path(key), te.encode(JSON.stringify(sealed)), { contentType: 'application/json' });
    },
    /** Read and open `key`, or null if it is not there. Refuses content that is not sealed. */
    async get(key) {
      const bytes = asBytes(await provider.get(path(key)), 'get');
      if (bytes == null) return null;
      let sealed;
      try { sealed = JSON.parse(td.decode(bytes)); } catch { throw new VaultError(CODE.NotSealed, 'the store returned something that is not sealed content', { key: path(key) }); }
      if (!isSealed(sealed)) throw new VaultError(CODE.Downgrade, 'the store returned unsealed content where sealed content is required', { key: path(key) });
      return ring.openFor(scope, sealed, ctx(key));
    },
    async has(key) { const r = await provider.list(path(key)); return !!(r && r.some((x) => x.key === path(key))); },
    /** List this store's own entries under `p` (paths come back with the prefix stripped). */
    async list(p = '') {
      const rows = (await provider.list(path(p))) || [];
      return rows.map((r) => ({ ...r, key: String(r.key).slice(String(prefix).length) }));
    },
    async del(key) { return provider.del(path(key)); },
  };
}

/** Seal the pointer a second device reads to find this workspace: { v, provider, prefix, ... }. */
export async function sealManifest(ring, scope, info = {}) {
  return ring.sealFor(scope, { ...info, v: MANIFEST_V }, { type: MANIFEST_KEY, key: '' });
}
export async function putManifest(provider, ring, scope, info, { at = MANIFEST_KEY } = {}) {
  assertProvider(provider);
  const sealed = await sealManifest(ring, scope, info);
  return provider.put(at, te.encode(JSON.stringify(sealed)), { contentType: 'application/json' });
}
export async function getManifest(provider, ring, scope, { at = MANIFEST_KEY } = {}) {
  assertProvider(provider);
  const bytes = asBytes(await provider.get(at), 'get');
  if (bytes == null) return null;
  let sealed; try { sealed = JSON.parse(td.decode(bytes)); } catch { throw new VaultError(CODE.NotSealed, 'the manifest is not sealed content'); }
  if (!isSealed(sealed)) throw new VaultError(CODE.Downgrade, 'the manifest is not sealed content');
  return ring.openFor(scope, sealed, { type: MANIFEST_KEY, key: '' });
}

// ------------------------------------------------------------------ two providers to develop and test against
/** Bytes in memory, for tests and for a session that never leaves the page. */
export function memoryProvider({ id = 'memory', name = 'This session' } = {}) {
  const m = new Map();
  return {
    id, name,
    async put(key, bytes) { const b = asBytes(bytes, 'put'); m.set(key, b.slice()); return { key, size: b.length }; },
    async get(key) { return m.has(key) ? m.get(key).slice() : null; },
    async list(prefix = '') { return [...m.entries()].filter(([k]) => k.startsWith(prefix)).map(([key, b]) => ({ key, size: b.length })); },
    async del(key) { m.delete(key); },
  };
}

/** Bytes in this browser's localStorage, base64url, under a namespace. Small values only. */
export function localStorageProvider(ls, { id = 'local', name = 'This browser', ns = 'hd:blob:' } = {}) {
  const L = () => (ls || globalThis.localStorage);
  return {
    id, name,
    async put(key, bytes) {
      const b = asBytes(bytes, 'put');
      let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
      L().setItem(ns + key, btoa(s));
      return { key, size: b.length };
    },
    async get(key) { const t = L().getItem(ns + key); if (t == null) return null; const bin = atob(t); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; },
    async list(prefix = '') { const out = []; for (let i = 0; i < L().length; i++) { const k = L().key(i); if (k && k.startsWith(ns + prefix)) out.push({ key: k.slice(ns.length), size: 0 }); } return out; },
    async del(key) { L().removeItem(ns + key); },
  };
}
