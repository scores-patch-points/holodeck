// holodeck-lookup.js — THE CROSSING for the dictionary, Wikipedia and Wikidata.
//
// external-evidence.js (vendored from khora) owns the SHAPE of these three sources and is pure: no
// fetch anywhere in it. This file is the crossing it leaves to the page — and the only place in the
// reading stack that reaches the network for a word. Three rules govern it:
//
//   1. NOTHING GOES OUT UNASKED. A lookup happens only when something calls look(); the reading never
//      does it on its own, and the page's switch for it starts OFF.
//   2. EVERY REQUEST IS DISCLOSED. Each is logged here (source, address, status, time) and, because it
//      goes through the page's own fetch, counted in the same network tally the page already shows.
//   3. WHAT COMES BACK IS A WITNESS, NEVER A GIVER. Each result is cached under the form, nominated to
//      the hyperlexicon as a candidate with its giver, license, address and retrieval time, and
//      licenses nothing (external-evidence.js, kernel/hyperlexicon.js).
//
// Wikidata goes through holodeck-links.js's searchWikidata (same retry, same CORS parameter); no new
// Wikidata client is written. fetch is injected, so the whole thing is falsified deterministically in
// holodeck-lookup.test.mjs.
import { searchWikidata } from './holodeck-links.js';
import { createHyperlexicon } from './vendor/khora/native/kernel/hyperlexicon.js';
import { parseWiktionary, parseWikipediaSummary, parseWikidataSearch, admitLookup, evidenceRows, nominations, keyOf, SOURCES } from './vendor/khora/native/adapters/text/external-evidence.js';

export const LOOKUP_SOURCES = Object.freeze(['dictionary', 'wikipedia', 'wikidata']);
const enc = encodeURIComponent;

export function makeLookup({ fetchImpl = (...a) => fetch(...a), now = () => new Date().toISOString(), timeoutMs = 9000, sources = LOOKUP_SOURCES } = {}) {
  const cache = new Map();   // key -> { form, retrievedAt, dictionary, wikipedia, wikidata, rows }
  const log = [];            // every request, disclosed
  let hl = createHyperlexicon();

  // one GET: a miss (404) is a result, a failure is a result, neither throws
  async function getJSON(source, url) {
    const entry = { source, url, at: now() }; const t0 = Date.now();
    try {
      const ctl = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
      const r = await fetchImpl(url, ctl ? { signal: ctl.signal } : undefined);
      if (timer) clearTimeout(timer);
      entry.status = r.status; entry.ms = Date.now() - t0; log.push(entry);
      if (r.status === 404) return { missing: true };
      if (r.status >= 400) return { error: `HTTP ${r.status}` };
      return { json: await r.json() };
    } catch (e) { entry.error = String((e && e.message) || e); entry.ms = Date.now() - t0; log.push(entry); return { error: entry.error }; }
  }

  async function dictionary(form) {
    // Wiktionary titles are case-sensitive: try the form as written, then lower-cased if it was capitalised
    const tries = [String(form)]; const low = String(form).toLowerCase(); if (low !== tries[0]) tries.push(low);
    for (const w of tries) {
      const r = await getJSON('dictionary', `https://en.wiktionary.org/api/rest_v1/page/definition/${enc(w)}`);
      if (r.error) return { found: false, error: r.error };
      if (r.json) { const p = parseWiktionary(r.json, w); if (p.found) return p; }
    }
    return { found: false };
  }
  async function wikipedia(form) {
    const r = await getJSON('wikipedia', `https://en.wikipedia.org/api/rest_v1/page/summary/${enc(String(form).trim().replace(/\s+/g, '_'))}`);
    if (r.error) return { found: false, error: r.error };
    return r.json ? parseWikipediaSummary(r.json) : { found: false };
  }
  async function wikidata(form) {
    // holodeck-links.js owns this crossing; its own request is logged through the same door
    const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${enc(form)}&language=en&uselang=en&format=json&limit=5&origin=*`;
    const entry = { source: 'wikidata', url, at: now() }; const t0 = Date.now();
    try {
      let seen = 0;
      const counting = async (u, o) => { seen++; const r = await fetchImpl(u, o); entry.status = r.status; return r; };
      const list = await searchWikidata(form, { fetchImpl: counting, limit: 5 });
      entry.ms = Date.now() - t0; log.push(entry);
      return parseWikidataSearch({ search: list.map((c) => ({ id: c.qid, label: c.label, description: c.description, aliases: c.aliases })) }, form);
    } catch (e) { entry.error = String((e && e.message) || e); entry.ms = Date.now() - t0; log.push(entry); return { found: false, error: entry.error }; }
  }
  const DO = { dictionary, wikipedia, wikidata };

  /** Look a form up in the chosen sources; cached, so asking twice costs nothing. */
  async function look(form, { only = sources, force = false } = {}) {
    const key = keyOf(form); if (!key) return null;
    const have = cache.get(key);
    const want = only.filter((s) => sources.includes(s) && (force || !have || have[s] === undefined));
    if (have && !want.length) return have;
    const got = await Promise.all(want.map(async (s) => [s, await DO[s](String(form).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))]));
    const rec = { ...(have || {}), form: have?.form ?? form, retrievedAt: now() };
    for (const [s, v] of got) rec[s] = v;
    rec.rows = evidenceRows(form, rec, { retrievedAt: rec.retrievedAt });
    cache.set(key, rec);
    hl = admitLookup(hl, form, rec, { retrievedAt: rec.retrievedAt });
    return rec;
  }
  return {
    look, cache, log, sources,
    get: (form) => cache.get(keyOf(form)) ?? null,
    hyperlexicon: () => hl,
    nominations: (form) => { const r = cache.get(keyOf(form)); return r ? nominations(form, r, { retrievedAt: r.retrievedAt }) : []; },
    count: () => cache.size,
    reset: () => { cache.clear(); log.length = 0; hl = createHyperlexicon(); },
  };
}
export { SOURCES };
