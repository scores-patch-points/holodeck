// build-surprise-priors.mjs — a GROUND for the surprise gate. The reader has "no view from nowhere": a document's surprise is measured against
// what a reader already knew of its register, not against an empty head, or every first sentence of every page would be a figure.
//
// For each Zenodotus category the register sniffer already uses (reading/register-prior.json), a PRIME: slices of the category's own English
// documents, lowercased word tokens in order (the gate's own instrument, the-fold/surprise-gate.mjs `tokenEvents`), taken evenly across the
// documents so no one book is the ground. The gate sediments the prime first and then reads the material; nothing here names a word.
// A category too thin to prime (news: one document) is a named gap and gets no prime of its own; the "general" prime mixes every category.
//
//   node tools/build-surprise-priors.mjs [--zen ../Zenodotus]      writes reading/surprise-priors/{index,<genre>}.json
import { readdirSync, readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ZEN = resolve(HERE, process.argv.includes('--zen') ? process.argv[process.argv.indexOf('--zen') + 1] : '../../Zenodotus');
const OUT = resolve(HERE, '../reading/surprise-priors');
const REG = JSON.parse(readFileSync(resolve(HERE, '../reading/register-prior.json'), 'utf8'));
// declared, structural: slice length, tokens per prime, the English test the sniffer uses
const SLICE = 300, PRIME_TOKENS = 12000, MIN_DOCS = 8, MIN_THE = 0.02;
const TOKEN_RE = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;
const TEXT = /\.(txt|md)$/i;
const files = (dir) => { const out = []; const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); const s = statSync(p); if (s.isDirectory()) walk(p); else if (TEXT.test(n) && s.size > 4000) out.push(p); } }; walk(dir); return out.sort(); };
const toks = (t) => t.toLowerCase().match(TOKEN_RE) ?? [];
const english = (w) => w.length >= 200 && w.filter((x) => x === 'the').length / w.length >= MIN_THE;

mkdirSync(OUT, { recursive: true });
const made = [], pools = {};
for (const [genre, g] of Object.entries(REG.genres)) {
  const docs = files(join(ZEN, g.dir)).map((f) => toks(readFileSync(f, 'utf8').slice(0, 400_000))).filter(english);
  if (docs.length < MIN_DOCS) { made.push({ genre, gap: `${docs.length} English documents (< ${MIN_DOCS}) — no prime of its own` }); continue; }
  const per = Math.max(1, Math.floor(PRIME_TOKENS / SLICE / docs.length)), slices = [];
  // evenly across documents: slices spaced through each document, then documents in turn until the budget is met
  for (let round = 0; slices.length * SLICE < PRIME_TOKENS; round++) { let any = false; for (const d of docs) { if (slices.length * SLICE >= PRIME_TOKENS) break; const at = Math.floor(((round + 0.5) / Math.max(per, 1 + round)) * Math.max(0, d.length - SLICE)); if (at + SLICE <= d.length && round < 8) { slices.push(d.slice(at, at + SLICE)); any = true; } } if (!any) break; }
  const prime = slices.flat().slice(0, PRIME_TOKENS); pools[genre] = prime;
  writeFileSync(join(OUT, `${genre}.json`), JSON.stringify({ schema: 'SurprisePrime@1', genre, giver: `Zenodotus ${g.dir} (${docs.length} English documents), slices of ${SLICE} lowercased word tokens taken evenly`, instrument: 'the-fold/surprise-gate.mjs tokenEvents, lowercased', tokens: prime.length, prime }));
  made.push({ genre, file: `${genre}.json`, tokens: prime.length, docs: docs.length, evidenceFor: g.evidenceFor });
}
// general: an even mixture of every category that has a prime
const gs = Object.keys(pools), each = Math.floor(PRIME_TOKENS / Math.max(1, gs.length)), mix = [];
for (const k of gs) { const p = pools[k]; for (let at = 0; at < each; at += SLICE) mix.push(...p.slice((at * 7) % Math.max(1, p.length - SLICE), (at * 7) % Math.max(1, p.length - SLICE) + SLICE)); }
writeFileSync(join(OUT, 'general.json'), JSON.stringify({ schema: 'SurprisePrime@1', genre: 'general', giver: `an even mixture of ${gs.join(', ')} primes`, instrument: 'the-fold/surprise-gate.mjs tokenEvents, lowercased', tokens: mix.length, prime: mix }));
made.push({ genre: 'general', file: 'general.json', tokens: mix.length });
writeFileSync(join(OUT, 'index.json'), JSON.stringify({ schema: 'SurprisePriorIndex@1', note: 'a register with no prime of its own (a named gap) is read with general', registers: Object.fromEntries(Object.entries(REG.genres).map(([k, v]) => [k, v.evidenceFor || null])), primes: made }, null, 1));
console.log(made.map((m) => m.gap ? `${m.genre}: GAP ${m.gap}` : `${m.genre}: ${m.tokens} tokens${m.docs ? ` from ${m.docs} docs` : ''}`).join('\n'));
