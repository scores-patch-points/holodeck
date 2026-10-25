// sniff.js — WHAT KIND OF SOURCE IS THIS? Proposed from the bytes, never typed in.
//
// Evidence, in the order the stack reads (from the fold's own priors; no frontier model — a small local model could be added as one more witness, but the priors suffice here):
//   1. VOCABULARY — the words a document carries that dwell in one Zenodotus category beyond what their frequency elsewhere predicts
//      (reading/register-prior.json, built by tools/build-register-prior.mjs, Dunning G², no model, no hand-written list).
//   2. STRUCTURE — cues the form itself carries: quotation density, first-person rate, a transcript's Q./A. turns, a dateline or byline,
//      "according to". These are the only evidence for JOURNALISM: the Zenodotus news category has one document, a named gap, so no
//      journalism vocabulary is claimed.
//   3. (optional) A SMALL LOCAL MODEL — asked only when the sniff is thin, handed the evidence projection, answering with one of the
//      candidates. Its answer is one more amplitude, disclosed as such; it can never create a candidate the evidence did not name.
// The amplitudes become probabilities by the Born rule, p = a²/Σa². A genre is evidence for a register, not a verdict: the result says
// how sure it is, why, and what it could not know. A person's declaration always wins over a sniff.
import { cutLines } from '../holodeck-cut.js';
const TOKEN = /\p{L}{4,}/gu;
const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’]*/gu;
// declared constants (structural; not tuned to any document)
const MIN_WORDS = 60, VOCAB_WEIGHT = 0.35, FLOOR = 0.2, CUE_WEIGHT = 0.5, THIN_MARGIN = 0.1;

const REGISTERS = ['fiction', 'reference', 'report', 'testimony', 'journalism'];

export function sniffRegister(text, prior) {
  const src = String(text ?? '');
  const words = src.match(WORD) ?? [];
  if (words.length < MIN_WORDS) return { register: '', p: 0, ranked: [], thin: true, reason: `too short to sniff (${words.length} words; ${MIN_WORDS} needed)`, evidence: {}, gaps: [] };
  const N = words.length, why = Object.fromEntries(REGISTERS.map((r) => [r, []]));
  // 1. vocabulary
  const vocab = Object.fromEntries(REGISTERS.map((r) => [r, 0]));
  const tokens = src.toLowerCase().match(TOKEN) ?? [], tf = new Map(); for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  if (prior && prior.terms) for (const [g, rows] of Object.entries(prior.terms)) {
    const reg = prior.genres?.[g]?.evidenceFor; if (!reg || !(reg in vocab)) continue;
    let a = 0; const hits = [];
    for (const [w, g2] of rows) { const c = tf.get(w); if (c) { a += c * Math.log(1 + g2); if (hits.length < 5) hits.push(w); } }
    a /= tokens.length || 1;
    if (a > vocab[reg]) { vocab[reg] = a; why[reg].push(`vocabulary of ${prior.genres[g].dir.replace(/^\d+-/, '')} (${hits.join(', ')})`); }
  }
  const vsum = Object.values(vocab).reduce((x, y) => x + y, 0) || 1;
  // vocabulary is the weakest witness (a genre's words are not a register): it is damped, and a thin amount of it counts for less still
const strength = Math.min(1, vsum / 0.6);
  const amp = Object.fromEntries(REGISTERS.map((r) => [r, VOCAB_WEIGHT * strength * vocab[r] / vsum]));
  // 2. structure
  const sents = cutLines(src).map((x) => x.text).filter((s) => s.trim().length > 3);   // khora's cut (holodeck-cut.js)
  const quoted = sents.filter((s) => /[“”"]/.test(s)).length / Math.max(1, sents.length);
  const fp = (words.filter((w) => /^(i|me|my|mine|myself|i['’](?:m|ve|d|ll))$/i.test(w)).length) / N;
  const qa = (src.match(/^\s*(?:Q|A|MR\.?\s+[A-Z]+|SENATOR\s+[A-Z]+|THE WITNESS)\s*[.:]/gm) ?? []).length;
  const dateline = /^\s*(?:By\s+[A-Z][\p{L}.'’ -]{2,40}\n|[A-Z][A-Z ,.'’-]{2,30}\s*(?:\([A-Za-z ]+\)\s*)?[—–-]\s+[A-Z])/mu.test(src.slice(0, 600)) || /\b(?:Reuters|Associated Press|\(AP\)|Staff Writer)\b/.test(src.slice(0, 600));
  const accord = (src.match(/\baccording to\b/gi) ?? []).length / Math.max(1, sents.length);
  const cue = (r, v, label) => { if (v <= 0) return; const x = Math.min(1, v); amp[r] += CUE_WEIGHT * x; why[r].push(label); };
  cue('testimony', Math.min(1, fp / 0.025), `first person ${(fp * 100).toFixed(1)}% of words`);
  cue('testimony', Math.min(1, qa / 3), `${qa} Q./A. or speaker turns`);
  cue('fiction', quoted > 0.15 ? Math.min(1, quoted / 0.5) * (fp < 0.02 ? 1 : 0.5) : 0, `dialogue in ${(quoted * 100).toFixed(0)}% of sentences, narrated`);
  cue('journalism', dateline ? 1 : 0, 'a dateline or byline');
  cue('journalism', Math.min(1, accord / 0.08), `“according to” ×${Math.round(accord * sents.length)}`);
  // 3. Born rule
  // FLOOR: ignorance is an amplitude too — with no real evidence every candidate stands at the floor, so a weak cue cannot look certain
  const sq = Object.fromEntries(REGISTERS.map((r) => [r, (amp[r] + FLOOR) ** 2])), Z = Object.values(sq).reduce((x, y) => x + y, 0) || 1;
  const ranked = REGISTERS.map((r) => ({ register: r, p: sq[r] / Z, why: why[r] })).sort((a, b) => b.p - a.p);
  const margin = ranked[0].p - ranked[1].p, thin = margin < THIN_MARGIN; // unsure only when two kinds are nearly tied; the leader's p is reported either way
  return { register: ranked[0].register, p: ranked[0].p, ranked, thin, margin, evidence: { words: N, quoted, fp, qa, dateline, accord, vocab },
    gaps: ['journalism has no vocabulary prior (the Zenodotus news category holds 1 document — a named gap); only its structural cues count'] };
}
