// holodeck-store.js — the two-tier corpus store for the holodeck.
//
// A corpus is packed (tools/pack-corpus.mjs) into:
//   hot.json         small: identity, metadata, pointers, byte offsets  -> resident
//   impressions.bin  large: concatenated UTF-8 impression text          -> cold (OPFS)
//
// The search layer (tools/build-embeddings.mjs) adds:
//   vectors.f32      one normalized vector per item (search-only)
//   null.f32         a random control of the same shape (so lift is measured)
//   vecmeta.json     { model, dim, count, ids[] }
//
// This module loads the hot index, keeps the cold blob in OPFS (written once
// from the served file, then read by byte offset on demand), never loads the
// whole cold blob into the workspace, and treats embeddings as a proposer only.

const DB = 'holodeck-store';

async function opfsDir(path, create = true) {
  const root = await navigator.storage.getDirectory();
  let d = root;
  for (const p of path.split('/').filter(Boolean)) d = await d.getDirectoryHandle(p, { create });
  return d;
}
async function opfsFile(path, create) {
  const parts = path.split('/');
  const name = parts.pop();
  const d = await opfsDir(parts.join('/'), create);
  return d.getFileHandle(name, { create });
}
async function opfsHas(path) { try { await opfsFile(path, false); return true; } catch { return false; } }
async function opfsWrite(path, buf) {
  const fh = await opfsFile(path, true);
  const w = await fh.createWritable();
  await w.write(buf);
  await w.close();
}
async function opfsSlice(path, start, end) {
  const fh = await opfsFile(path, false);
  const f = await fh.getFile();
  return new Uint8Array(await f.slice(start, end).arrayBuffer());
}

function norm(v) {
  let s = 0;
  for (const x of v) s += x * x;
  s = Math.sqrt(s) || 1;
  const o = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) o[i] = v[i] / s;
  return o;
}

export async function openStore({ base = '', corpus = 'nashville', fetchImpl = fetch } = {}) {
  const dir = `${base}/store/${corpus}`;
  const hot = await (await fetchImpl(`${dir}/hot.json`)).json();
  const coldPath = `${DB}/${corpus}/${hot.cold.file}`;

  if (!(await opfsHas(coldPath))) {
    const buf = await (await fetchImpl(`${dir}/${hot.cold.file}`)).arrayBuffer();
    await opfsWrite(coldPath, buf);
  }

  const byId = new Map(hot.items.map((it) => [it.id, it]));
  const dec = new TextDecoder();

  // Optional search layer (T4). Absent until build-embeddings has run.
  let vec = null, nul = null, vm = null;
  try {
    vm = await (await fetchImpl(`${dir}/vecmeta.json`)).json();
    vec = new Float32Array(await (await fetchImpl(`${dir}/vectors.f32`)).arrayBuffer());
    nul = new Float32Array(await (await fetchImpl(`${dir}/null.f32`)).arrayBuffer());
  } catch { /* no vectors yet — lexical only */ }

  const scoreAt = (mat, qv, i, dim) => { let s = 0; for (let j = 0; j < dim; j++) s += qv[j] * mat[i * dim + j]; return s; };
  const rank = (mat, qv, dim, n, k) => {
    const a = new Array(n);
    for (let i = 0; i < n; i++) a[i] = [i, scoreAt(mat, qv, i, dim)];
    a.sort((x, y) => y[1] - x[1]);
    return a.slice(0, k);
  };

  return {
    corpus,
    hot,
    count: () => hot.items.length,
    item: (id) => byId.get(id) || null,
    ids: () => hot.items.map((it) => it.id),
    hasVectors: () => !!vec,

    async impression(id) {
      const it = byId.get(id);
      if (!it) return null;
      return dec.decode(await opfsSlice(coldPath, it.off[0], it.off[1]));
    },

    // Lexical baseline: the deterministic first rung. Reads the cold blob once,
    // returns pointers + in-impression spans — never a decision.
    async searchLexical(q, { limit = 25 } = {}) {
      const needle = String(q).toLowerCase().trim();
      if (!needle) return [];
      const fh = await opfsFile(coldPath, false);
      const all = new Uint8Array(await (await fh.getFile()).arrayBuffer());
      const hits = [];
      for (const it of hot.items) {
        const seg = dec.decode(all.subarray(it.off[0], it.off[1]));
        const i = seg.toLowerCase().indexOf(needle);
        if (i < 0) continue;
        hits.push({
          id: it.id, title: it.title, pointer: it.pointer || null,
          start: i, end: i + needle.length,
          snippet: seg.slice(Math.max(0, i - 45), i + needle.length + 45).replace(/\s+/g, ' ').trim(),
        });
        if (hits.length >= limit) break;
      }
      return hits;
    },

    // Semantic search: embeddings as a PROPOSER. `embed(text) -> Float32Array`
    // is supplied by the caller (a local model). Returns the nearest items plus
    // the same query against the random null, so the lift is visible.
    async searchSemantic(q, { embed, limit = 15 } = {}) {
      if (!vec || !embed || !vm) return null;
      const dim = vm.dim, n = vm.count;
      const qv = norm(await embed(q));
      const hits = rank(vec, qv, dim, n, limit).map(([i, s]) => ({ id: vm.ids[i], title: byId.get(vm.ids[i])?.title || null, score: +s.toFixed(4) }));
      const nulh = rank(nul, qv, dim, n, limit).map(([i, s]) => ({ id: vm.ids[i], score: +s.toFixed(4) }));
      return {
        query: q,
        hits,
        null: nulh,
        topHit: hits[0]?.score ?? null,
        topNull: nulh[0]?.score ?? null,
        lift: hits[0] && nulh[0] ? +(hits[0].score - nulh[0].score).toFixed(4) : null,
      };
    },
  };
}
