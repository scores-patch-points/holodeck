// sniff.js — WHAT KIND OF SOURCE IS THIS? Proposed from the bytes, never typed in.
//
// Evidence, in the order the stack reads (ingest and reason BEFORE any model — a model only ever sees this projection, never the text):
//   1. VOCABULARY — the words a document carries that dwell in one Zenodotus category beyond what their frequency elsewhere predicts
//      (reading/register-prior.json, built by tools/build-register-prior.mjs, Dunning G², no model, no hand-written list).
//   2. STRUCTURE — cues the form itself carries: quotation density, first-person rate, a transcript's Q./A. turns, a dateline or byline,
//      "according to". These are the only evidence for JOURNALISM: the Zenodotus news category has one document, a named gap, so no
//      journalism vocabulary is claimed.
//   3. (optional) A SMALL LOCAL MODEL — asked only when the sniff is thin, handed the evidence projection, answering with one of the
//      candidates. Its answer is one more amplitude, disclosed as such; it can never create a candidate the evidence did not name.
// The amplitudes become probabilities by the Born rule, p = a²/Σa². A genre is evidence for a register, not a verdict: the result says
// how sure it is, why, and what it could not know. A person's declaration always wins over a sniff.
const TOKEN = /\p{L}{4,}/gu;
const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’]*/gu;
// declared constants (structural; not tuned to any document)
const MIN_WORDS = 60, VOCAB_WEIGHT = 0.35, FLOOR = 0.2, CUE_WEIGHT = 0.5, MODEL_WEIGHT = 0.4, THIN_P = 0.55, THIN_MARGIN = 0.2;
const OLLAMA = 'http://localhost:11434';

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
  const sents = src.split(/(?<=[.!?”"])\s+/).filter((s) => s.trim().length > 3);
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
  const margin = ranked[0].p - ranked[1].p, thin = ranked[0].p < THIN_P || margin < THIN_MARGIN;
  return { register: ranked[0].register, p: ranked[0].p, ranked, thin, margin, evidence: { words: N, quoted, fp, qa, dateline, accord, vocab },
    gaps: ['journalism has no vocabulary prior (the Zenodotus news category holds 1 document — a named gap); only its structural cues count'] };
}

/**
 * Ask a small local model (Ollama) to choose among the candidates the evidence already named — only when the sniff is thin.
 * The model sees the evidence PROJECTION (numbers and matched words), never the document. Returns the sniff with the model's
 * choice added as one amplitude, disclosed; or the sniff unchanged, with the reason it was not used.
 */
export async function steerWithLocalModel(sn, { fetchImpl = globalThis.fetch, timeoutMs = 25000 } = {}) {
  if (!sn.thin || !sn.ranked.length) return sn;
  const note = (why) => ({ ...sn, model: { used: false, why } });
  const get = async (url, init, ms) => { const c = new AbortController(), t = setTimeout(() => c.abort(), ms); try { return await fetchImpl(url, { ...init, signal: c.signal }); } finally { clearTimeout(t); } };
  let tags; try { const r = await get(OLLAMA + '/api/tags', {}, 1200); if (!r.ok) return note('no local model server answered'); tags = (await r.json()).models || []; } catch { return note('no local model server reachable'); }
  const m = tags.filter((x) => !/embed/i.test(x.name)).sort((a, b) => (a.size || 1e15) - (b.size || 1e15))[0]; if (!m) return note('a local model server is running but holds no model');
  const cands = sn.ranked.filter((r) => r.p > 0.05).slice(0, 3).map((r) => r.register);
  const proj = sn.ranked.slice(0, 3).map((r) => `${r.register}: p=${r.p.toFixed(2)}; evidence: ${r.why.join('; ') || 'none'}`).join('\n');
  const prompt = `A reader measured a text but could not decide what kind of source it is. Evidence (numbers and matched words only, the text is not shown):\n${proj}\nStructure: first person ${(sn.evidence.fp * 100).toFixed(1)}% of words; dialogue in ${(sn.evidence.quoted * 100).toFixed(0)}% of sentences; dateline ${sn.evidence.dateline ? 'yes' : 'no'}.\nChoose exactly one of: ${cands.join(', ')}. Answer as JSON: {"register":"<one>"}`;
  try {
    const r = await get(OLLAMA + '/api/generate', { method: 'POST', body: JSON.stringify({ model: m.name, prompt, stream: false, format: 'json', options: { temperature: 0 } }) }, timeoutMs);
    if (!r.ok) return note(`the local model (${m.name}) refused the request`);
    const pick = JSON.parse((await r.json()).response || '{}').register;
    if (!cands.includes(pick)) return note(`the local model (${m.name}) answered outside the candidates, so it was ignored`);
    const amp = Object.fromEntries(sn.ranked.map((x) => [x.register, Math.sqrt(x.p)])); amp[pick] += MODEL_WEIGHT;
    const Z = Object.values(amp).reduce((a, v) => a + v * v, 0);
    const ranked = sn.ranked.map((x) => ({ ...x, p: amp[x.register] ** 2 / Z, why: x.register === pick ? [...x.why, `a small local model (${m.name}) chose it from the evidence`] : x.why })).sort((a, b) => b.p - a.p);
    return { ...sn, register: ranked[0].register, p: ranked[0].p, ranked, margin: ranked[0].p - ranked[1].p, model: { used: true, name: m.name, picked: pick } };
  } catch (e) { return note('the local model did not answer in time'); }
}
