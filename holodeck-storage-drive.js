// holodeck-storage-drive.js — a storage provider over Google Drive's hidden app folder.
//
// A person brings their own storage by signing in with Google (holodeck-google-signin.js) and granting the
// `drive.appdata` scope. That scope is the whole point: the app sees only a hidden folder it owns
// (appDataFolder) — never the rest of the Drive, never the person's other files. This provider puts the
// holodeck's SEALED blobs there, one file per key, so Google holds ciphertext and a filename it cannot open.
//
// It is a provider in the sense holodeck-storage.js means: opaque bytes in, opaque bytes out, under string
// keys. It does no sealing and knows no key; wrap it with sealedStore() to make the bytes plaintext on the
// device and ciphertext everywhere else.
//
// PURE. `fetch` and the access token are injected; nothing here signs in, stores a token, or touches a page.
// The token may be a string or a function ({ refresh }) -> string, called again after a 401.

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const te = new TextEncoder();
const FIELDS = 'id,name,size,modifiedTime';

export class DriveError extends Error {
  constructor(code, why, status = 0, detail = {}) { super(`${code}: ${why}`); this.name = 'DriveError'; this.drive = true; this.code = code; this.why = why; this.status = status; this.detail = detail; }
}

const boundary = () => 'holodeck-' + Math.random().toString(36).slice(2) + Date.now().toString(36);

/**
 * create({ token, fetch?, base?, uploadBase?, name? })
 *   token      a bearer string, or ({ refresh }) -> string (refreshed once after a 401)
 * Returns a provider: { id, name, put, get, list, del, refresh }.
 */
export function driveAppData({ token, fetch: fetchImpl, base = API, uploadBase = UPLOAD, name = 'Google Drive (app folder)' } = {}) {
  const doFetch = fetchImpl || ((...a) => globalThis.fetch(...a));
  if (!token) throw new DriveError('no-token', 'a Drive provider needs an access token (string or function)');
  let cached = typeof token === 'string' ? token : null;
  let ids = null;   // name -> id, listed once and kept; refresh() rebuilds it

  async function bearer(refresh) {
    if (typeof token === 'string') return token;
    if (!cached || refresh) cached = await token({ refresh: !!refresh });
    if (!cached) throw new DriveError('no-token', 'the token source returned nothing');
    return cached;
  }
  async function call(method, url, { headers = {}, body, noAuth = false, refreshed = false } = {}) {
    const h = { ...headers };
    if (!noAuth) h.Authorization = 'Bearer ' + await bearer(false);
    const r = await doFetch(url, { method, headers: h, body });
    if (r.status === 401 && !noAuth && !refreshed && typeof token === 'function') {
      await bearer(true);
      return call(method, url, { headers, body, noAuth, refreshed: true });
    }
    if (!r.ok) {
      let msg = 'HTTP ' + r.status;
      try { const j = await r.json(); msg = (j && j.error && j.error.message) || msg; } catch { /* not JSON */ }
      throw new DriveError('drive-' + r.status, msg, r.status);
    }
    return r;
  }
  const json = async (method, url, o) => { const r = await call(method, url, o); const t = await r.text(); return t ? JSON.parse(t) : {}; };

  async function listAll() {
    const out = {}; let pageToken = null;
    do {
      const u = new URL(base + '/files');
      u.searchParams.set('spaces', 'appDataFolder');
      u.searchParams.set('pageSize', '1000');
      u.searchParams.set('fields', `nextPageToken,files(${FIELDS})`);
      if (pageToken) u.searchParams.set('pageToken', pageToken);
      const j = await json('GET', u.toString());
      for (const f of j.files || []) out[f.name] = f;
      pageToken = j.nextPageToken || null;
    } while (pageToken);
    return out;
  }
  async function idOf(key, { refresh = false } = {}) {
    if (!ids || refresh) ids = await listAll();
    return ids[key] || null;
  }

  async function create(key, bytes, contentType) {
    const b = boundary();
    const meta = JSON.stringify({ name: key, parents: ['appDataFolder'] });
    const head = te.encode(`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${b}\r\nContent-Type: ${contentType}\r\n\r\n`);
    const tail = te.encode(`\r\n--${b}--\r\n`);
    const body = new Uint8Array(head.length + bytes.length + tail.length);
    body.set(head, 0); body.set(bytes, head.length); body.set(tail, head.length + bytes.length);
    const u = new URL(uploadBase + '/files');
    u.searchParams.set('uploadType', 'multipart');
    u.searchParams.set('fields', FIELDS);
    const f = await json('POST', u.toString(), { headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body });
    if (ids) ids[key] = f;
    return f;
  }
  async function update(id, key, bytes, contentType) {
    const u = new URL(uploadBase + '/files/' + encodeURIComponent(id));
    u.searchParams.set('uploadType', 'media');
    u.searchParams.set('fields', FIELDS);
    const f = await json('PATCH', u.toString(), { headers: { 'Content-Type': contentType }, body: bytes });
    if (ids) ids[key] = f;
    return f;
  }

  const provider = {
    id: 'drive-appdata', name,
    /** List the app-folder files again (after another device wrote). */
    async refresh() { ids = await listAll(); return ids; },
    async put(key, bytes, { contentType = 'application/octet-stream' } = {}) {
      const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      let existing = await idOf(key);
      // The cache can be stale (another device wrote this key since we last listed), and the app folder
      // allows two files with one name. Refresh once before creating, so a put UPDATES in place instead.
      if (!existing && ids) existing = await idOf(key, { refresh: true });
      const f = existing ? await update(existing.id, key, b, contentType) : await create(key, b, contentType);
      return { key, id: f.id, size: b.length };
    },
    async get(key) {
      const f = await idOf(key);
      if (!f) return null;
      const u = new URL(base + '/files/' + encodeURIComponent(f.id));
      u.searchParams.set('alt', 'media');
      const r = await call('GET', u.toString());
      return new Uint8Array(await r.arrayBuffer());
    },
    async list(prefix = '') {
      if (!ids) ids = await listAll();
      return Object.values(ids).filter((f) => f.name.startsWith(prefix)).map((f) => ({ key: f.name, id: f.id, size: Number(f.size || 0), modifiedTime: f.modifiedTime }));
    },
    async del(key) {
      const f = await idOf(key);
      if (!f) return;
      await call('DELETE', base + '/files/' + encodeURIComponent(f.id));
      if (ids) delete ids[key];
    },
  };
  return provider;
}
