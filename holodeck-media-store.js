// holodeck-media-store.js — a workspace's sources and records, kept in the Matrix media store, sealed on the device.
//
// WHAT THIS ADDS. Until now the only things a workspace sent to Matrix were its pins, filters and reading history (a
// sealed state event, fold-net.js savePrivate) and whatever a person explicitly published to the public room. The
// sources themselves — the PDFs, recordings, saved pages, and the document records read off them — lived only in this
// browser (IndexedDB / OPFS / localStorage). Sign in on another device and they were not there. This module is the
// missing leg: every source's bytes and the record list are sealed here and uploaded to the homeserver's MEDIA store,
// and a small pointer to them is kept in the workspace's private room.
//
// SAME STORE AS BEFORE, NOT A NEW ONE. Nothing here is a second repo. The data still lives in OPFS/IndexedDB locally
// and in Matrix (media + the private room) as the sync and backup. The key is the workspace key the vault already
// holds (holodeck-vault.js); no new key, no new room.
//
// LAYOUT.
//   media store     sealed blobs, one per chunk (<= 8 MiB, or the server's upload limit). A blob is anonymous:
//                   'HDM1' + 12-byte IV + AES-256-GCM ciphertext, uploaded as application/octet-stream named "blob".
//                   Its AAD binds the workspace, the role ('blob' | 'manifest'), the plaintext's SHA-256 and the chunk
//                   index, so a server cannot hand one document's blob to another or reorder a file's chunks.
//   manifest        one sealed JSON document (deflated): every doc record plus, per doc, its blobs
//                   { kind, mime, enc, size, sha256, kid, chunks:[{mxc,size}] }. Itself a sealed media blob.
//   private room    one state slot, key 'store' (sealed by savePrivate like the rest): the POINTER
//                   { v, kid, z, at, docs, bytes, manifest:{sha256,size,chunks} }. A state event is capped at 64 KB,
//                   so it holds a pointer, never the content.
//
// WHAT THE SERVER STILL SEES. That the account holds this many files, their sizes (chunk-sized except the last), when
// each was uploaded, and who the members are. Not names, types, text or which files are the same. Duplicate content
// is stored once per workspace because the plaintext hash is the dedupe key and it is never sent.
//
// WHAT IT DOES NOT DO. It does not delete: a source removed here stays in the manifest of earlier pushes and in the
// media store. It does not merge two diverged histories: a pull adds documents this device lacks and never overwrites
// one it has. It does not give a removed member back their access to what they already fetched.
//
// PURE. Every crossing is injected: `net` (Matrix), `ring` (the vault keyring), `local` (this browser's stores).
// Nothing here touches a page, a URL or storage.
//
//   net    { upload(u8) -> mxc, download(mxc) -> ArrayBuffer|Uint8Array, loadPointer() -> object|null,
//            savePointer(obj), ensureKey() -> void, limit?() -> bytes|null }
//   ring   makeKeyring(...)  — only has / current / keyFn are used
//   local  { docs() -> [record], has(id) -> bool, bytesOf(record) -> [{kind,mime,enc,bytes}],
//            restore(record, [{kind,mime,enc,bytes}]) -> void, removed?() -> [id] }
//
// TWO DEVICES. A push is a UNION: documents the manifest already holds and this device lacks are carried forward, so
// a device that has only some of the workspace never drops the rest. A removal is a TOMBSTONE: `removed()` ids go in
// the manifest's `gone` list, are dropped from it, and a pull does not bring them back. Without that, deleting a
// source and signing in again would restore it.

import { b64u, unb64u, VaultError, CODE } from './holodeck-vault.js';

const te = new TextEncoder();
const td = new TextDecoder();
const subtle = () => globalThis.crypto.subtle;
const rnd = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));

export const STORE_SLOT = 'store';
export const VERSION = 1;
export const DEFAULT_CHUNK = 8 * 1024 * 1024;
const MIN_CHUNK = 64 * 1024;
const MAGIC = [0x48, 0x44, 0x4d, 0x31];          // "HDM1"
const HEAD = 4 + 12;
const MAX_MANIFEST = 256 * 1024 * 1024;

export const STORE_CODE = Object.freeze({
  Tampered: 'store-tampered',      // a blob did not authenticate or did not hash to what the manifest said
  Missing: 'store-missing',        // the media store would not give a blob back
  NoStore: 'store-none',           // nothing has been backed up for this workspace
  Aborted: 'store-aborted',
  Unreachable: 'store-unreachable',
});

export class StoreError extends Error {
  constructor(code, why, detail = {}) { super(`${code}: ${why}`); this.name = 'StoreError'; this.store = true; this.code = code; this.why = why; this.detail = detail; }
}

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
export const sha256Hex = async (u8) => hex(await subtle().digest('SHA-256', u8));
const u8of = (x) => (x instanceof Uint8Array ? x : x instanceof ArrayBuffer ? new Uint8Array(x) : ArrayBuffer.isView(x) ? new Uint8Array(x.buffer, x.byteOffset, x.byteLength) : te.encode(String(x)));
const aadOf = (scope, role, sha, idx) => te.encode(['holodeck/media/v1', scope, role, sha, String(idx)].join('\u0000'));
const aesKey = (key) => subtle().importKey('raw', unb64u(key), 'AES-GCM', false, ['encrypt', 'decrypt']);

async function sealChunk(key, scope, role, sha, idx, bytes) {
  const iv = rnd(12);
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: aadOf(scope, role, sha, idx) }, await aesKey(key), bytes));
  const out = new Uint8Array(HEAD + ct.length);
  out.set(MAGIC, 0); out.set(iv, 4); out.set(ct, HEAD);
  return out;
}
async function openChunk(key, scope, role, sha, idx, blob) {
  const b = u8of(blob);
  if (b.length <= HEAD || MAGIC.some((m, i) => b[i] !== m)) throw new StoreError(STORE_CODE.Tampered, 'a stored file is not one of this workspace’s sealed files');
  try {
    return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: b.subarray(4, HEAD), additionalData: aadOf(scope, role, sha, idx) }, await aesKey(key), b.subarray(HEAD)));
  } catch { throw new StoreError(STORE_CODE.Tampered, 'a stored file did not authenticate: it was changed, or it was moved from where it was sealed'); }
}

const CAN_Z = typeof CompressionStream === 'function' && typeof DecompressionStream === 'function' && typeof Blob === 'function';
async function pipe(bytes, transform, cap = 0) {
  const reader = new Blob([bytes]).stream().pipeThrough(transform).getReader();
  const parts = []; let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.length;
    if (cap && n > cap) { try { await reader.cancel(); } catch { /* closed */ } throw new StoreError(STORE_CODE.Tampered, 'a stored manifest inflated past its limit'); }
    parts.push(value);
  }
  const out = new Uint8Array(n); let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

const concat = (parts, total) => { const out = new Uint8Array(total); let at = 0; for (const p of parts) { out.set(p, at); at += p.length; } return out; };
const checkAbort = (signal) => { if (signal && signal.aborted) throw new StoreError(STORE_CODE.Aborted, 'stopped'); };

function need(o, names) {
  for (const n of names) if (!o[n]) throw new Error('holodeck-media-store: missing ' + n);
}

/** Seal `bytes` under { kid, key } for `scope`, upload each chunk, return { sha256, size, kid, chunks }. */
async function putBytes({ scope, role, cur, net, signal, size }, bytes, sha) {
  const chunks = [];
  const n = Math.max(1, Math.ceil(bytes.length / size));
  for (let i = 0; i < n; i++) {
    checkAbort(signal);
    const sealed = await sealChunk(cur.key, scope, role, sha, i, bytes.subarray(i * size, Math.min(bytes.length, (i + 1) * size)));
    let mxc;
    try { mxc = await net.upload(sealed); } catch (e) { throw new StoreError(STORE_CODE.Unreachable, 'the homeserver would not take the upload: ' + String((e && e.message) || e)); }
    if (!mxc || !/^mxc:\/\//.test(mxc)) throw new StoreError(STORE_CODE.Unreachable, 'the upload returned no address');
    chunks.push({ mxc, size: sealed.length });
  }
  return { sha256: sha, size: bytes.length, kid: cur.kid, chunks };
}

/** Fetch and open every chunk of one entry, check it hashes to what was recorded, and return the bytes. */
async function getBytes({ scope, role, ring, net, signal }, entry) {
  const keyOf = ring.keyFn(scope);
  const key = await keyOf(entry.kid);
  if (!key) throw new VaultError(CODE.Locked, 'this device does not hold the key that sealed this', { kid: entry.kid });
  const parts = []; let total = 0;
  for (let i = 0; i < entry.chunks.length; i++) {
    checkAbort(signal);
    let blob;
    try { blob = await net.download(entry.chunks[i].mxc); } catch (e) { throw new StoreError(STORE_CODE.Missing, 'the media store would not give a file back', { mxc: entry.chunks[i].mxc }); }
    const plain = await openChunk(key, scope, role, entry.sha256, i, blob);
    parts.push(plain); total += plain.length;
  }
  const out = concat(parts, total);
  if (out.length !== entry.size || (await sha256Hex(out)) !== entry.sha256) throw new StoreError(STORE_CODE.Tampered, 'a stored file does not hash to what the manifest recorded');
  return out;
}

async function openManifest({ scope, ring, net, signal }, pointer) {
  const bytes = await getBytes({ scope, role: 'manifest', ring, net, signal }, { ...pointer.manifest, kid: pointer.kid });
  const body = pointer.z ? await pipe(bytes, new DecompressionStream('deflate-raw'), MAX_MANIFEST) : bytes;
  let m; try { m = JSON.parse(td.decode(body)); } catch { throw new StoreError(STORE_CODE.Tampered, 'the stored manifest is malformed'); }
  if (!m || m.v !== VERSION || !Array.isArray(m.docs)) throw new StoreError(STORE_CODE.Tampered, 'the stored manifest is not one this page understands');
  return m;
}

const validPointer = (p) => !!p && typeof p === 'object' && !p.empty && p.manifest && Array.isArray(p.manifest.chunks) && typeof p.kid === 'string';

/** What has been backed up, without reading any of it. */
export async function storeStatus({ scope, ring, net }) {
  need({ scope, ring, net }, ['scope', 'ring', 'net']);
  const p = await net.loadPointer();
  if (!validPointer(p)) return { has: false };
  return { has: true, at: p.at || null, docs: p.docs || 0, bytes: p.bytes || 0, held: !!(await ring.keyFn(scope)(p.kid)) };
}

/**
 * Seal and upload every source's bytes and the record list; point the private room at the result. Safe to run
 * again: a blob whose plaintext hash is already in the last manifest is not uploaded twice.
 */
export async function pushWorkspace({ scope, ring, net, local, now = () => Date.now(), onProgress = () => {}, signal = null, chunk = DEFAULT_CHUNK } = {}) {
  need({ scope, ring, net, local }, ['scope', 'ring', 'net', 'local']);
  await net.ensureKey();                                                    // the owner starts the key; anyone else is told
  const cur = await ring.current(scope);
  if (!cur) throw new VaultError(CODE.Locked, 'this device does not hold the workspace key, so nothing was backed up');
  const limit = net.limit ? await net.limit() : null;
  const size = Math.max(MIN_CHUNK, Math.min(chunk, limit ? limit - 1024 : chunk));

  const known = new Map();                                                  // plaintext sha256 -> the blob already stored
  const keyOf = ring.keyFn(scope);
  let prevDocs = [], prevGone = [];
  try {
    const prev = await net.loadPointer();
    if (validPointer(prev)) {
      const pm = await openManifest({ scope, ring, net, signal }, prev);
      prevDocs = pm.docs; prevGone = Array.isArray(pm.gone) ? pm.gone : [];
      for (const d of pm.docs) for (const b of d.blobs || []) if (b && b.sha256 && Array.isArray(b.chunks) && (await keyOf(b.kid))) known.set(b.sha256, b);
    }
  } catch (e) { if (e && e.store && e.code === STORE_CODE.Aborted) throw e; /* an unreadable earlier manifest only means more uploads */ }

  const docs = await local.docs();
  const gone = new Set([...prevGone, ...(local.removed ? await local.removed() : [])]);
  for (const d of docs) gone.delete(d.id);                                   // a document put back is not gone
  const out = []; let uploaded = 0, reused = 0, bytesTotal = 0;
  for (let i = 0; i < docs.length; i++) {
    checkAbort(signal);
    const rec = docs[i];
    onProgress({ phase: 'push', i: i + 1, n: docs.length, label: String((rec && (rec.title || rec.id)) || '') });
    const items = await local.bytesOf(rec);
    const blobs = [];
    for (const it of items || []) {
      const bytes = u8of(it.bytes);
      const sha = await sha256Hex(bytes);
      bytesTotal += bytes.length;
      let entry = known.get(sha);
      if (entry) reused++;
      else { entry = await putBytes({ scope, role: 'blob', cur, net, signal, size }, bytes, sha); known.set(sha, entry); uploaded++; }
      blobs.push({ kind: it.kind, mime: it.mime || 'application/octet-stream', enc: it.enc || 'bin', size: entry.size, sha256: sha, kid: entry.kid, chunks: entry.chunks });
    }
    out.push({ id: rec.id, rec, blobs });
  }
  const have = new Set(out.map((d) => d.id));
  let carried = 0;
  for (const d of prevDocs) if (d && d.id && !have.has(d.id) && !gone.has(d.id)) { out.push(d); carried++; }

  const at = new Date(now()).toISOString();
  let body = te.encode(JSON.stringify({ v: VERSION, at, scope, docs: out, gone: [...gone] }));
  let z = 0;
  if (CAN_Z && body.length > 256) { try { const c = await pipe(body, new CompressionStream('deflate-raw')); if (c.length < body.length) { body = c; z = 1; } } catch { /* stored plain, still sealed */ } }
  const manifest = await putBytes({ scope, role: 'manifest', cur, net, signal, size }, body, await sha256Hex(body));
  const pointer = { v: VERSION, kid: cur.kid, z, at, docs: out.length, bytes: bytesTotal, manifest: { sha256: manifest.sha256, size: manifest.size, chunks: manifest.chunks } };
  await net.savePointer(pointer);
  onProgress({ phase: 'done', i: docs.length, n: docs.length, label: '' });
  return { docs: out.length, blobs: out.reduce((a, d) => a + d.blobs.length, 0), uploaded, reused, carried, gone: gone.size, bytes: bytesTotal, at };
}

/**
 * Bring this workspace's backed-up sources onto this device. Adds documents the device lacks; never overwrites one it
 * has. A document whose bytes cannot be fetched or do not authenticate is reported, not half-restored.
 */
export async function pullWorkspace({ scope, ring, net, local, onProgress = () => {}, signal = null } = {}) {
  need({ scope, ring, net, local }, ['scope', 'ring', 'net', 'local']);
  const pointer = await net.loadPointer();
  if (!validPointer(pointer)) return { has: false, docs: 0, restored: 0, skipped: 0, missing: [] };
  if (!(await ring.keyFn(scope)(pointer.kid))) throw new VaultError(CODE.Locked, 'this device does not hold the key that sealed this workspace’s backup', { kid: pointer.kid });
  const m = await openManifest({ scope, ring, net, signal }, pointer);
  let restored = 0, skipped = 0; const missing = [];
  const gone = new Set(Array.isArray(m.gone) ? m.gone : []);
  const mineGone = new Set(local.removed ? await local.removed() : []);
  for (let i = 0; i < m.docs.length; i++) {
    checkAbort(signal);
    const d = m.docs[i];
    onProgress({ phase: 'pull', i: i + 1, n: m.docs.length, label: String((d.rec && (d.rec.title || d.rec.id)) || d.id || '') });
    if (gone.has(d.id) || mineGone.has(d.id) || (await local.has(d.id))) { skipped++; continue; }
    try {
      const blobs = [];
      for (const b of d.blobs || []) blobs.push({ kind: b.kind, mime: b.mime, enc: b.enc, bytes: await getBytes({ scope, role: 'blob', ring, net, signal }, b) });
      await local.restore(d.rec, blobs);
      restored++;
    } catch (e) {
      if (e && e.vault && e.code === CODE.Locked) throw e;
      if (e && e.store && e.code === STORE_CODE.Aborted) throw e;
      missing.push({ id: d.id, why: (e && (e.why || e.message)) || 'unreadable' });
    }
  }
  onProgress({ phase: 'done', i: m.docs.length, n: m.docs.length, label: '' });
  return { has: true, docs: m.docs.length, restored, skipped, missing, at: pointer.at || null };
}

// Exposed for the page's adapter and the tests: how a string source (a saved page, an image data URL) becomes bytes.
export const textToBytes = (s) => te.encode(String(s));
export const bytesToText = (u8) => td.decode(u8of(u8));
export { b64u };
