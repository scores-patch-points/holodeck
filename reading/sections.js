// sections.js — what makes a SECTION make sense: it reduces surprise. A boundary is justified where what came before STOPS PREDICTING what
// comes after — the ground the reader built from the text so far no longer helps, and the material is better read against the prior alone.
//
// Measured with the suite's own instrument (khora kernel/surprise-segments.js `surprises`, the gate of the-fold/surprise-gate.mjs), in bits,
// prequential, medium-blind:
//   continued   the next W tokens read against PRIME + everything before the cut        (one pass over the document, shared by every cut)
//   fresh       the same W tokens read against PRIME alone, as if a new section began here
//   gain        (continued − fresh) / W — bits per token the cut saves. Positive: the cut reduces surprise. Negative: the earlier text was helping,
//               so the cut is arbitrary there.
// A gain means nothing alone, so each cut is RANKED against the same measure at randomly placed cuts in the same document (a seeded null,
// kernel-style): rank 0.9 = this cut helps more than 90% of random cuts do. The PRIME is the ground a reader brings: a register's own text from
// Zenodotus (tools/build-surprise-priors.mjs), chosen by the register sniffer, else "general". Nothing here names a word.
import { surprises } from '../vendor/khora/native/kernel/surprise-segments.js';
import { sniffRegister } from './sniff.js';

const RE = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;
// declared, structural: the order the kernel's own rules use, the window a section is judged over, the random cuts in the null
const ORDER = 3, WINDOW = 300, NULL_CUTS = 40, MIN_SIDE = 25, SEED = 1;
// a cut with no heading earns a section of its own only when it REDUCES surprise (gain > 0) and helps more than this share of random cuts (declared; the page shows the rank, so it can be moved)
export const SECTION_RANK = 0.9, UNSUPPORTED_RANK = 0.5;

const cache = new Map();
const getJSON = (u) => (cache.has(u) ? cache.get(u) : cache.set(u, fetch(u).then((r) => (r.ok ? r.json() : null)).catch(() => null)).get(u));

/** The prime for this text: the register's own, else general. Returns { prime, genre, giver, register, why }. */
export async function primeFor(text, { base }) {
  const [idx, reg] = await Promise.all([getJSON(new URL('surprise-priors/index.json', base)), getJSON(new URL('register-prior.json', base))]);
  if (!idx) return { prime: null, genre: null, why: 'no surprise priors shipped' };
  let register = '', why = 'general (the register could not be sniffed)';
  try { const s = reg ? sniffRegister(text, reg) : null; if (s && s.register && !s.thin) register = s.register; } catch (e) { /* sniffing is optional */ }
  const genre = (register && Object.entries(idx.registers).map(([g, r]) => [g, r]).find(([g, r]) => r === register && idx.primes.some((p) => p.genre === g && p.file))?.[0]) || 'general';
  if (genre !== 'general') why = `the text sniffs as ${register}; the ${genre} prime is that register's ground`;
  else if (register) why = `the text sniffs as ${register}, which has no prime of its own (a named gap): general`;
  const p = await getJSON(new URL(`surprise-priors/${genre}.json`, base));
  return p ? { prime: p.prime, genre, giver: p.giver, register: register || null, why } : { prime: null, genre, why: 'the prime could not be read' };
}

const lcg = (seed) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; }; };
const sum = (a, i, j) => { let x = 0; for (let k = i; k < j; k++) x += a[k]; return x; };

/** Gain and rank of a cut at each candidate char offset. `offsets` are character positions in `text`. */
export function gainsAt(text, offsets, { prime }) {
  const toks = [], offs = []; for (const m of String(text).matchAll(RE)) { toks.push(m[0].toLowerCase()); offs.push(m.index); }
  const N = toks.length; if (N < 2 * MIN_SIDE || !prime) return { gains: new Map(), tokens: N, refused: !prime ? 'no prime' : `too short (${N} tokens)` };
  const continued = surprises(toks, { order: ORDER, prime });
  const gainOf = (t) => { const hi = Math.min(N, t + WINDOW), fresh = surprises(toks.slice(t, hi), { order: ORDER, prime }); return (sum(continued, t, hi) - sum(fresh, 0, hi - t)) / (hi - t); };
  const rnd = lcg(SEED), nul = [];
  for (let i = 0; i < NULL_CUTS; i++) nul.push(gainOf(MIN_SIDE + Math.floor(rnd() * (N - 2 * MIN_SIDE))));
  nul.sort((a, b) => a - b);
  const rankOf = (g) => { let k = 0; while (k < nul.length && nul[k] < g) k++; return k / nul.length; };
  const gains = new Map(); let ti = 0;
  for (const at of [...new Set(offsets)].sort((a, b) => a - b)) {
    while (ti < N && offs[ti] < at) ti++;
    if (ti < MIN_SIDE || ti > N - MIN_SIDE) continue;
    const g = gainOf(ti); gains.set(at, { gain: +g.toFixed(3), rank: +rankOf(g).toFixed(2), token: ti });
  }
  return { gains, tokens: N, nullMedian: +nul[Math.floor(nul.length / 2)].toFixed(3), nullCuts: nul.length };
}
