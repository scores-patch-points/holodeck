// build-register-prior.mjs — a SNIFFING prior for "what kind of source is this?", measured from the Zenodotus corpus.
//
// For each Zenodotus category with enough documents, the words that DWELL there beyond what their frequency elsewhere predicts
// (Dunning G², one genre against all the others, the same test the corpus's own genre-priors use). No model, no hand-written word list:
// the vocabulary is what the bytes carry. A category with too few documents is a NAMED GAP, never approximated from a sibling —
// today that is the news category (one file), so journalism is not sniffed from vocabulary at all (see reading/sniff.js: structural cues only).
//
//   node tools/build-register-prior.mjs [--zen ../Zenodotus]      writes reading/register-prior.json
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ZEN = resolve(HERE, process.argv.includes('--zen') ? process.argv[process.argv.indexOf('--zen') + 1] : '../../Zenodotus');
const OUT = resolve(HERE, '../reading/register-prior.json');

// declared, structural, never tuned
const MIN_LEN = 4, MIN_COUNT = 12, MIN_DOCS = 8, PER_DOC_BYTES = 120_000, TOP = 260, G2_5PCT = 3.841;
// which Zenodotus category stands for which kind of thing, and which register that kind is evidence for — DECLARED here, the giver of the mapping
const GENRES = {
  literature:   { dir: '01-literature-books',    evidenceFor: 'fiction',   note: 'books: mostly told, though some are not — this is evidence, not a verdict' },
  encyclopedic: { dir: '02-encyclopedic',        evidenceFor: 'reference', note: 'encyclopedic entries' },
  academic:     { dir: '05-academic-papers',     evidenceFor: 'report',    note: 'papers report findings' },
  legal:        { dir: '06-government-legal',    evidenceFor: 'report',    note: 'statutes, rulings, filings' },
  firstperson:  { dir: '20-first-person-voices', evidenceFor: null, note: 'a voice speaking for itself — but this category is one topical slice (narratives of enslavement), so its vocabulary measures topic, not register; kept in the prior, not used as evidence' },
  news:         { dir: '08-news-current',        evidenceFor: 'journalism', note: 'news' },
};
const TEXT = /\.(txt|md)$/i;
const files = (dir) => { const out = []; const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); const s = statSync(p); if (s.isDirectory()) walk(p); else if (TEXT.test(n) && s.size > 2000 && n.toLowerCase() !== 'readme.md') out.push(p); } }; if (existsSync(dir)) walk(dir); return out; };
// English prose only: the sniffer reads English, so a document counts when "the" is at least 2% of its words (declared)
const MIN_THE = 0.02;
// a term must be SPECIFIC (at least this many times its rate elsewhere) and SPREAD (in this share of the genre's documents, min 4) — not a character in one book, not a word everyone uses
const MIN_RATIO = 4, MIN_SPREAD = 0.1;
const isEnglish = (t) => { const w = t.toLowerCase().match(/\p{L}+/gu) ?? []; if (w.length < 200) return false; let n = 0; for (const x of w) if (x === 'the') n++; return n / w.length >= MIN_THE; };
const tokens = (t) => t.toLowerCase().match(/\p{L}{4,}/gu) ?? [];

const counts = {}, totals = {}, meta = {}, gaps = [], dfs = {};
for (const [g, spec] of Object.entries(GENRES)) {
  const fs = files(join(ZEN, spec.dir)).filter((f) => isEnglish(readFileSync(f, 'utf8').slice(0, PER_DOC_BYTES)));
  if (fs.length < MIN_DOCS) { gaps.push({ genre: g, dir: spec.dir, docs: fs.length, reason: `fewer than ${MIN_DOCS} documents — a named gap, not approximated from a sibling` }); continue; }
  const c = new Map(), df = new Map(); let n = 0;
  for (const f of fs) { const t = readFileSync(f, 'utf8').slice(0, PER_DOC_BYTES); const seen = new Set(); for (const w of tokens(t)) { c.set(w, (c.get(w) || 0) + 1); n++; seen.add(w); } for (const w of seen) df.set(w, (df.get(w) || 0) + 1); }
  counts[g] = c; dfs[g] = df; totals[g] = n; meta[g] = { dir: spec.dir, docs: fs.length, tokens: n, evidenceFor: spec.evidenceFor, note: spec.note };
}
const genres = Object.keys(counts), N = genres.reduce((a, g) => a + totals[g], 0);
const prior = {};
for (const g of genres) {
  const rows = [];
  for (const [w, a] of counts[g]) {
    if (a < MIN_COUNT) continue;
    let b = 0; for (const h of genres) if (h !== g) b += counts[h].get(w) || 0;
    const c = totals[g] - a, d = (N - totals[g]) - b, n = a + b + c + d;
    const e1 = (a + b) * totals[g] / n, e2 = (a + b) * (N - totals[g]) / n;
    if (a <= e1) continue; // dwells here, not elsewhere
    if ((dfs[g].get(w) || 0) < Math.max(4, MIN_SPREAD * meta[g].docs)) continue;
    if ((a / totals[g]) / ((b + 1) / (N - totals[g])) < MIN_RATIO) continue;
    const g2 = 2 * (a * Math.log(a / e1) + (b > 0 ? b * Math.log(b / e2) : 0));
    if (g2 >= G2_5PCT) rows.push([w, Math.round(g2 * 10) / 10]);
  }
  rows.sort((x, y) => y[1] - x[1]);
  prior[g] = rows.slice(0, TOP);
}
writeFileSync(OUT, JSON.stringify({
  schema: 'RegisterPrior@1', giver: 'measured from the Zenodotus numbered categories; no model, no word list written by hand',
  test: 'Dunning G², one genre against all the others, 5% (3.841); only terms over-represented in the genre are kept',
  declared: { minRatio: MIN_RATIO, minSpread: MIN_SPREAD, minTheShare: MIN_THE, minLen: MIN_LEN, minCount: MIN_COUNT, minDocs: MIN_DOCS, perDocBytes: PER_DOC_BYTES, top: TOP },
  genres: meta, gaps, terms: prior,
}));
console.log(`wrote reading/register-prior.json · ${genres.map((g) => `${g} ${meta[g].docs} docs → ${prior[g].length} terms`).join(' · ')} · gaps: ${gaps.map((x) => x.genre + '(' + x.docs + ' docs)').join(', ') || 'none'}`);
