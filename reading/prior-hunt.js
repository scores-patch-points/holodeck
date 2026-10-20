// prior-hunt.js — when something is uploaded, HUNT for its prior. Teaching it to fish, not how to read one kind of form.
//
//   1  WHAT IS THIS?  the document's own most identifying text, measured: its largest type, its footers, the codes forms print about
//                     themselves ("Form 990 (2018)", "Cat. No. 11282Y", "OMB No. 1545-0047"), and who issued it
//   2  LOCAL FIRST    the library of priors shipped with the page (form-priors/index.json) and any this browser has already found
//   3  ELSE SEARCH    through the fold's no-record relay: a query made from the projection — mechanically, or, when that finds nothing, by a
//                     SMALL MODEL IN THE PAGE (WebLLM; never a frontier model) handed the projection only, never the document
//   4  MEASURE        a candidate PDF is measured in the browser (prior-measure.js) and kept only if it ALIGNS with the scan
//   5  REMEMBER       a prior that aligned is kept in this browser (IndexedDB) — next time it is local, and the hunt is offline
// Every step is disclosed: what was looked for, where, by what, and what was found.
import { measurePdf } from './prior-measure.js';
import { tiltOf } from './prior-tilt.js';
import { CODE } from './shapes.js';

const RELAY = 'https://holodeck-proxy.prometheoid.workers.dev';

/** 1 — what the document says about itself. */
export function identify(layout, text) {
  const p1 = layout.pages[0], med = (xs) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)] || 0; };
  const typeOf = (ln) => med(p1.words.slice(ln.words[0], ln.words[1]).map((w) => w.b[3] - w.b[1]));
  const lineText = (pg, ln) => pg.words.slice(ln.words[0], ln.words[1]).map((w) => w.t).join(' ');
  const wordy = (t) => { const ws = t.split(/\s+/); return ws.length >= 3 && ws.filter((w) => /^\p{L}{3,}[,.;:]?$/u.test(w) || /^\p{Lo}{2,}$/u.test(w)).length >= ws.length * 0.6; };
  const bigLines = p1.lines.filter((ln) => ln.words[1] - ln.words[0] >= 3).map((ln) => ({ t: lineText(p1, ln), h: typeOf(ln), y: ln.b[1] })).filter((x) => wordy(x.t)).sort((a, b) => b.h - a.h).slice(0, 3);
  const footers = layout.pages.flatMap((pg) => pg.lines.filter((ln) => ln.b[1] > pg.h * 0.9).map((ln) => lineText(pg, ln)));
  const codes = [];
  for (const m of (text.slice(0, 6000) + '\n' + footers.join('\n')).matchAll(CODE)) { const code = m[2].replace(/[.,]$/, ''); if (!/\p{Nd}/u.test(code)) continue; codes.push({ kind: m[1].replace(/\s+/g, ' '), code, year: m[3] ? +m[3] : null }); }
  // the document's own code: the one it prints most often (a form repeats its number in every footer), a printed year counting double
  const tally = new Map(); for (const c of codes) tally.set(c.code, (tally.get(c.code) || 0) + 1 + (c.year ? 1 : 0));
  codes.sort((x, y) => (tally.get(y.code) || 0) - (tally.get(x.code) || 0));
  // a form's year: printed with its code ("Form 990 (2018)"), else the most frequent four-digit year in its own text
  const yc = new Map(); for (const m of text.slice(0, 8000).matchAll(/\b(19[5-9]\d|20[0-4]\d)\b/g)) yc.set(+m[1], (yc.get(+m[1]) || 0) + 1);
  const yearGuess = [...yc.entries()].sort((a, b) => b[1] - a[1])[0];
  for (const c of codes) if (!c.year && yearGuess) c.year = yearGuess[0];
  const years = [...new Set(codes.map((c) => c.year).filter(Boolean))];
  const issuer = (p1.lines.map((ln) => lineText(p1, ln)).find((t) => /\b(department|service|agency|bureau|ministry|office)\b/i.test(t)) || '').slice(0, 80);
  return { title: bigLines[0] ? bigLines[0].t : '', titles: bigLines.map((x) => x.t), codes: codes.slice(0, 8), years, footers: footers.slice(0, 4), issuer };
}

/** The search a projection suggests, with no model: the form's own code and year, its title, "pdf". */
export function mechanicalQuery(pr) {
  const form = pr.codes[0];
  return [form ? `${form.kind} ${form.code}` : '', form && form.year ? form.year : pr.years[0] || '', pr.title.replace(/[^\w\s()'-]/g, ' ').split(/\s+/).slice(0, 8).join(' '), 'pdf'].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

/** 2 — the local library: shipped priors, then this browser's own. */
async function localPrior(pr, { base, fetchImpl }) {
  let idx = null; try { idx = await (await fetchImpl(new URL('form-priors/index.json', base))).json(); } catch (e) { idx = null; }
  const form = pr.codes.find((c) => idx && idx.forms.some((f) => f.form.toLowerCase() === String(c.code).toLowerCase())) || pr.codes[0];
  const cand = idx ? idx.forms.filter((f) => form && f.form.toLowerCase() === String(form.code).toLowerCase()) : [];
  const year = form && form.year ? form.year : pr.years[0];
  const hit = cand.find((f) => f.year === year) || null;
  if (hit) return { prior: await (await fetchImpl(new URL(`form-priors/${hit.file}`, base))).json(), where: 'the library shipped with this page', matched: `“${form.kind} ${form.code}${year ? ` (${year})` : ''}” on the document = ${hit.file}` };
  const mine = await idbGet(`${form ? form.code : pr.title}|${year || ''}`);
  if (mine) return { prior: mine, where: 'this browser’s own library (found on an earlier hunt)', matched: `${form ? form.code : pr.title} ${year || ''}` };
  return null;
}

/** 3 — a small model in the page, handed the projection only, asked for a search. */
async function modelQuery(pr, { onStatus }) {
  try {
    const W = await import('../vendor/fold-chat/fold-chat-webllm.js');
    const gpu = await W.gpuStatus(); if (!gpu || !gpu.available) return { query: null, why: `no WebGPU here (${gpu && gpu.reason || 'unknown'}), so no model in the page` };
    const engine = W.createPageEngine({ makeWorker: null, onProgress: (p) => onStatus && onStatus(`loading a small model in this browser · ${p && p.text ? p.text : ''}`) });
    const id = 'SmolLM2-360M-Instruct-q4f16_1-MLC';
    await engine.load(id);
    const ask = `These lines identify a document: TITLE: ${pr.titles.join(' | ')}. CODES: ${pr.codes.map((c) => `${c.kind} ${c.code}${c.year ? ' (' + c.year + ')' : ''}`).join('; ')}. ISSUER: ${pr.issuer}. Write ONE web search query (under 12 words) that finds the official blank PDF of this document. Answer with the query only.`;
    const out = await engine.chat([{ role: 'user', content: ask }], { temperature: 0, max_tokens: 40 });
    const q = String(out && (out.text || out.content || out) || '').split('\n')[0].replace(/^["'\s]+|["'\s]+$/g, '').slice(0, 140);
    return { query: q || null, by: `a small model in this browser (${id}, WebLLM), given the projection only`, why: q ? null : 'the model gave no query' };
  } catch (e) { return { query: null, why: `the model in the page could not run: ${e && e.message || e}` }; }
}

/** 3–5 — search, fetch, measure, keep what aligns. */
async function remotePrior(pr, layout, query, { pdfjs, fetchImpl, onStatus }) {
  onStatus && onStatus(`searching for “${query}”`);
  let res; try { res = await (await fetchImpl(`${RELAY}/search?scope=web&q=${encodeURIComponent(query)}`)).json(); } catch (e) { return { why: 'the search could not be reached (offline?)' }; }
  const pdfs = (res.results || []).filter((r) => /\.pdf(\?|$)/i.test(r.url)).slice(0, 3);
  if (!pdfs.length) return { why: `the search found no PDF (${res.engine || 'search'})` };
  for (const r of pdfs) {
    onStatus && onStatus(`measuring ${r.url}`);
    try { const bytes = new Uint8Array(await (await fetchImpl(`${RELAY}/raw?url=${encodeURIComponent(r.url)}`)).arrayBuffer());
      const pages = await measurePdf(pdfjs, bytes, { maxPages: 12 });
      const sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
      const prior = { schema: 'FormPrior@1', form: (pr.codes[0] || {}).code || null, year: pr.years[0] || null, title: r.title, source: r.url, sha256, giver: `${r.source || 'the web'} (found by search)`, pages };
      const t = tiltOf(prior, layout), ok = t.pages.filter((p) => p.matched && p.agreement >= 0.25).length;
      if (ok) { await idbPut(`${prior.form || pr.title}|${prior.year || ''}`, prior); return { prior, where: `searched “${query}” through the fold's relay (${res.engine || 'search'}); measured ${r.url}`, matched: `${ok} page${ok === 1 ? '' : 's'} aligned` }; }
    } catch (e) { /* try the next candidate */ }
  }
  return { why: 'no candidate PDF aligned with the scan' };
}

/** The hunt. Returns { prior, where, matched, query, by, steps } or { prior: null, steps }. */
export async function hunt(layout, text, { base, pdfjs, fetchImpl = (...a) => fetch(...a), onStatus = () => {}, online = typeof navigator !== 'undefined' ? navigator.onLine : true } = {}) {
  const steps = []; const pr = identify(layout, text); steps.push({ step: 'identified', what: pr });
  const local = await localPrior(pr, { base, fetchImpl }); if (local) { steps.push({ step: 'found locally', ...local }); return { ...local, projection: pr, steps }; }
  steps.push({ step: 'not in the local library' });
  if (!online) { steps.push({ step: 'offline — no search' }); return { prior: null, projection: pr, steps }; }
  const mq = mechanicalQuery(pr); let r = await remotePrior(pr, layout, mq, { pdfjs, fetchImpl, onStatus }); steps.push({ step: 'searched', query: mq, by: 'the document’s own codes and title (no model)', result: r.where || r.why });
  if (r.prior) return { ...r, query: mq, by: 'the document’s own codes and title (no model)', projection: pr, steps };
  const m = await modelQuery(pr, { onStatus }); steps.push({ step: 'asked a small model in this browser', query: m.query, why: m.why });
  if (m.query) { r = await remotePrior(pr, layout, m.query, { pdfjs, fetchImpl, onStatus }); steps.push({ step: 'searched', query: m.query, by: m.by, result: r.where || r.why }); if (r.prior) return { ...r, query: m.query, by: m.by, projection: pr, steps }; }
  return { prior: null, projection: pr, steps };
}

// this browser's own library of priors (IndexedDB) — a convenience; the shipped library is the record
const DB = 'fold-priors';
function idb() { return new Promise((res, rej) => { try { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore('priors'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } }); }
async function idbGet(k) { try { const db = await idb(); return await new Promise((res) => { const q = db.transaction('priors').objectStore('priors').get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); } catch (e) { return null; } }
async function idbPut(k, v) { try { const db = await idb(); await new Promise((res) => { const t = db.transaction('priors', 'readwrite'); t.objectStore('priors').put(v, k); t.oncomplete = res; t.onerror = res; }); } catch (e) {} }
