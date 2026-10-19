// sw.js — makes the reading demo work with the network off.
//
// It sits at the site root so its scope covers /reading/ and the /vendor/ modules the page imports. What to keep is not listed here: it is
// read from reading/offline-manifest.json (computed from the page's own import graph by tools/build-offline-manifest.mjs), so the cache
// can never drift from what the page needs. Third-party assets (pdf.js, tesseract) are pinned to exact versions in that manifest.
//
// Policy: pinned third-party files are cache-first (the bytes never change); local files are network-first with the cache as the fallback
// (a developer's edit shows at once, an offline visitor still gets the page). Anything not in the manifest is never cached.
// `cache-only` is a TEST mode: every request not already cached fails as it would with no connection, so the offline path can be exercised
// on a machine that is online.
const CACHE = 'holodeck-offline';
const BASE = self.registration.scope;
const MANIFEST_URL = new URL('reading/offline-manifest.json', BASE).href;
const META = new URL('__offline-meta', BASE).href;
const abs = (f) => (/^https?:/.test(f.url) ? f.url : new URL('.' + f.url, BASE).href);
let known = null; // Set of absolute urls in the manifest

const readMeta = async () => { try { const c = await caches.open(CACHE); const r = await c.match(META); return r ? await r.json() : {}; } catch { return {}; } };
const writeMeta = async (patch) => { const c = await caches.open(CACHE); const m = { ...(await readMeta()), ...patch }; await c.put(META, new Response(JSON.stringify(m), { headers: { 'content-type': 'application/json' } })); return m; };
const knownUrls = async () => {
  if (known) return known;
  const m = await readMeta();
  known = new Set((m.urls || []));
  return known;
};
const say = async (msg) => { for (const c of await self.clients.matchAll({ includeUncontrolled: true })) c.postMessage(msg); };

self.addEventListener('install', (e) => e.waitUntil(self.skipWaiting()));
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.type === 'download') e.waitUntil(download(d.groups || ['core', 'data'], d.force));
  else if (d.type === 'cache-only') e.waitUntil(writeMeta({ cacheOnly: !!d.on }).then(() => say({ type: 'mode', cacheOnly: !!d.on })));
  else if (d.type === 'status') e.waitUntil(status());
  else if (d.type === 'forget') e.waitUntil(caches.delete(CACHE).then(() => { known = null; return say({ type: 'status', have: 0, total: 0, version: null, groups: {} }); }));
});

async function manifest() {
  const r = await fetch(MANIFEST_URL, { cache: 'no-cache' });
  if (!r.ok) throw new Error('manifest ' + r.status);
  return r.json();
}

async function status() {
  const c = await caches.open(CACHE);
  const meta = await readMeta();
  const groups = {};
  for (const [g, urls] of Object.entries(meta.byGroup || {})) {
    let have = 0;
    for (const u of urls) if (await c.match(u)) have++;
    groups[g] = { have, total: urls.length };
  }
  await say({ type: 'status', version: meta.version || null, groups, cacheOnly: !!meta.cacheOnly, bytes: meta.bytes || 0 });
}

async function download(wanted, force) {
  let m;
  try { m = await manifest(); } catch (err) { return say({ type: 'error', error: 'could not read the offline manifest: ' + err.message }); }
  const c = await caches.open(CACHE);
  const prev = await readMeta();
  const files = m.files.filter((f) => wanted.includes(f.group));
  const all = m.files.map(abs);
  const byGroup = {}; for (const f of m.files) (byGroup[f.group] ||= []).push(abs(f));
  // a new manifest version drops what it no longer lists
  if (prev.version && prev.version !== m.version) for (const k of await c.keys()) if (k.url !== META && !all.includes(k.url)) await c.delete(k);
  await writeMeta({ version: m.version, urls: all, byGroup }); known = new Set(all);
  const todo = [];
  for (const f of files) { const u = abs(f); if (force || prev.version !== m.version || !(await c.match(u))) todo.push({ f, u }); }
  let done = files.length - todo.length, bytes = prev.bytes || 0; const total = files.length;
  await say({ type: 'progress', done, total, bytes, current: null });
  const queue = todo.slice();
  const worker = async () => {
    for (let item; (item = queue.shift()); ) {
      try {
        const r = await fetch(item.u, { cache: 'reload', mode: /^https?:\/\/[^/]*/.test(item.u) && new URL(item.u).origin !== new URL(BASE).origin ? 'cors' : 'same-origin' });
        if (!r.ok) throw new Error(r.status + '');
        const len = +(r.headers.get('content-length') || 0);
        await c.put(item.u, r.clone());
        if (!len) bytes += (await r.clone().arrayBuffer()).byteLength; else bytes += len;
      } catch (err) { await say({ type: 'warn', url: item.u, error: String(err.message || err) }); }
      done++;
      await say({ type: 'progress', done, total, bytes, current: item.f.role || item.f.url });
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  await writeMeta({ bytes });
  await say({ type: 'done', version: m.version, bytes, groups: wanted });
  await status();
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(handle(req));
});

async function handle(req) {
  const meta = await readMeta();
  const urls = await knownUrls();
  const c = await caches.open(CACHE);
  const inManifest = urls.has(req.url) || urls.has(req.url.split('?')[0]);
  const hit = async () => (await c.match(req)) || (await c.match(req, { ignoreSearch: true }));
  if (meta.cacheOnly) {
    const h = inManifest ? await hit() : null;
    return h || new Response('offline (cache-only test mode): not cached', { status: 503, statusText: 'Offline' });
  }
  if (!inManifest) return fetch(req);
  const origin = new URL(req.url).origin;
  if (origin !== new URL(BASE).origin) { // pinned third party: cache-first
    const h = await hit(); if (h) return h;
    const r = await fetch(req); if (r.ok) c.put(req.url, r.clone()); return r;
  }
  try { // local: network-first so edits show; refresh the cache on success
    const r = await fetch(req);
    if (r.ok && r.type !== 'opaque') c.put(req.url.split('?')[0], r.clone());
    return r;
  } catch {
    const h = await hit();
    return h || new Response('offline and not cached', { status: 503 });
  }
}
