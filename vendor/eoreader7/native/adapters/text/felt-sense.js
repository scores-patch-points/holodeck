// khora/native/adapters/text/felt-sense.js — FELT SENSE (a PERCEPTION, not a law).
//
// User, 2026-10-08: "this is how we have the felt sense of words. how something is, contextually, verby." and
// "this can be khora cuz its not laws, its more of a perception" and "we should do this for the entire text in
// question, i dont think it pays to have it precomputed, does it?"
//
// SO: for the WHOLE text being read — every token, no sampling — ablate each token (read the text with it, read
// it without), take the delta, and project the delta onto one axis per part of speech. The axes are built from the
// text's OWN deltas; the parts of speech are named by the language's received prior (the giver, janus) — a word is
// "verby" here in proportion to how much removing it moves the reading the way removing verbs moves it. Nothing is
// precomputed for a corpus: the map is a property of THIS read (a perception), recomputed per text. No model, no
// definition of any word; the label only selects the poles to name an axis, never enters a feature.
//
// The primitive (read a window, ablate a token, type the slot/span deltas) is eval/law/impact.mjs's, reused whole
// — one reader, no second implemention (THE-SPINE). This organ is the khora-side perception over it.
//
// SIBLING, NOT DUPLICATE (reconciled 2026-10-08, see eval/the-fold/scene/RECONCILE-FELT-SENSE.md): the same doctrine
// — khora, not janus; rebuilt at read time; anchors in janus — is also built as eval/the-fold/scene/sensefield.mjs,
// which ablates the NEGATIVE SPACE (PPMI: observed co-occurrence minus the corpus-wide expectation) and resolves an
// unknown word to an anchored head. This file ablates the WORD ITSELF (the reader's span delta) and reads a known
// word's felt gradient. The two compose: an unknown word resolves in the field, then is felt in the reader.

import { readWindow, makeSnapshot, impactOfToken, spanSignature } from "../../eval/law/impact.mjs";
import { splitSentences } from "./spans.js";
import { NEGATION_WORDS } from "./priors.js";
import { appendPass, emptyWeft } from "../../the-fold/weft.js";

// A WORD is a whole word (letters/numbers, with internal apostrophes) — never split further (no sub-word unit).
const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;
const splitChars = (t) => String(t ?? "").match(WORD)?.map((w) => w.toLowerCase()) ?? [];
const hasNeg = (words, a, b) => words.slice(a, b).some((w) => NEGATION_WORDS.has(w));

const classOf = (form, posPrior) => {
  const cell = posPrior?.forms?.[form];
  if (!cell) return null;
  let best = null, n = -1;
  for (const [p, c] of Object.entries(cell)) if (c > n) { n = c; best = p; }
  return best;
};
const cos = (a, b) => { let d = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; } return na && nb ? d / Math.sqrt(na * nb) : 0; };
const meanOf = (rows) => rows[0].map((_, c) => rows.reduce((s, r) => s + r[c], 0) / rows.length);

/**
 * feltSense(text, { posPrior, M }) — the whole text's felt sense.
 * Reads the text ONCE per sentence (a window of M causal sentences), ablates every token, and returns:
 *   { axes: {POS -> unit delta direction}, felt: [{s, i, form, pos, score}], byPos, n }
 * `score` is the token's projection on its own POS axis when it has one (how verby / nouny / ... it reads here);
 * `byPos[POS]` is the text's own mean projection (the text's felt centre per part of speech).
 */
export function feltSense(text, { posPrior = null, M = 8, source = null } = {}) {
  const parts = splitSentences(String(text ?? "")).map((s) => ({ text: String(s.text ?? s), offset: s.offset ?? 0 })).filter((p) => p.text);
  const stream = [], offsets = [];
  for (const p of parts) {
    const toks = [], offs = [];
    for (const m of p.text.matchAll(WORD)) { toks.push(m[0].toLowerCase()); offs.push(p.offset + Buffer.byteLength(p.text.slice(0, m.index), "utf8")); }
    if (toks.length) { stream.push(toks); offsets.push(offs); }
  }
  const sample = [];
  stream.forEach((w, s) => w.forEach((_, i) => sample.push({ s, i, id: stream[s][i] })));
  // one snapshot per sentence, ablate its tokens (the whole text, no sampling)
  const rows = [], meta = [];
  let snap = null;
  for (const { s, i } of sample) {
    if (!snap || snap.s !== s) snap = makeSnapshot(stream, s, { M, F: 0 });
    const rec = impactOfToken(snap, i, { mode: "delete", w: Infinity });
    if (!rec || rec.gap || !rec.span) { meta.push(null); continue; }
    rows.push(rec.span); meta.push({ s, i, form: stream[s][i], at: offsets[s][i], pos: classOf(stream[s][i], posPrior), negBefore: hasNeg(stream[s], 0, i), negAfter: hasNeg(stream[s], i + 1, stream[s].length) });
  }
  // one axis per POS: mean(delta of that POS) - mean(delta of the rest). POS names come from the prior (the giver).
  const byPos = new Map();
  meta.forEach((m, j) => { if (m && m.pos) { if (!byPos.has(m.pos)) byPos.set(m.pos, []); byPos.get(m.pos).push(rows[j]); } });
  const axes = {};
  for (const [p, group] of byPos) {
    if (group.length < 8 || group.length > rows.length - 8) continue;
    const rest = rows.filter((_, j) => meta[j]?.pos && meta[j].pos !== p);
    const mp = meanOf(group), mo = meanOf(rest);
    let d = mp.map((x, c) => x - mo[c]); const nrm = Math.hypot(...d) || 1;
    axes[p] = d.map((x) => x / nrm);
  }
  const felt = rows.map((r, j) => { const m = meta[j]; const dir = m.pos ? axes[m.pos] : null; return { ...m, neg: m.negBefore || m.negAfter ? 1 : 0, score: dir ? cos(r, dir) : null, verby: axes.VERB ? cos(r, axes.VERB) : null }; });
  // POLARITY: can the delta itself carry the negation? one axis = mean(delta of negated words) - mean(delta of the rest).
  const aucOf = (s, lab) => { const P = s.filter((_, j) => lab[j]), N = s.filter((_, j) => !lab[j]); if (!P.length || !N.length) return null; let w = 0; for (const p of P) for (const n of N) w += p > n ? 1 : p === n ? 0.5 : 0; return w / (P.length * N.length); };
  const negLab = meta.map((m) => (m && m.neg ? 1 : 0));
  const nNeg = negLab.reduce((a, b) => a + b, 0);
  let polarity = null;
  if (nNeg >= 8 && rows.length - nNeg >= 8) {
    const mn = meanOf(rows.filter((_, j) => negLab[j])), mp = meanOf(rows.filter((_, j) => !negLab[j]));
    let d = mn.map((x, c) => x - mp[c]); const nrm = Math.hypot(...d) || 1; d = d.map((x) => x / nrm);
    polarity = { nNeg, nAff: rows.length - nNeg, auc: aucOf(rows.map((r) => cos(r, d)), negLab), axis: d };
  }
  const centre = {}; for (const p of Object.keys(axes)) { const xs = felt.filter((f) => f.pos === p).map((f) => f.score); centre[p] = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; }
  // WORD-LEVEL vector: the mean delta over a word's occurrences (words are fine; the occurrence delta is noisy).
  const acc = new Map();
  rows.forEach((r, j) => { const f = meta[j]?.form; if (!f) return; let a = acc.get(f); if (!a) { a = { sum: new Array(r.length).fill(0), n: 0 }; acc.set(f, a); } for (let c = 0; c < r.length; c++) a.sum[c] += r[c]; a.n += 1; });
  const wordVec = new Map();
  for (const [f, a] of acc) { const m = a.sum.map((x) => x / a.n); const nrm = Math.hypot(...m) || 1; wordVec.set(f, m.map((x) => x / nrm)); }
  return { axes, felt, byPos: centre, polarity, wordVec, n: rows.length, sentences: stream.length };
}

// NOTE (2026-10-08, user: "go back to the embedded"): the model-free felt pressure that stood in for the
// embedding-backed grain pressure (ablation-grain-pressure.js, nomic-embed-text via scripts/build-ablation-grain-prior.mjs)
// is REMOVED. The embedded mode is the mechanism; it was never modified. What remains here is the additive perception
// (feltSense / feltAttestations / feltPass / pickPredicates), not a replacement for the embedder.

/**
 * feltAttestations(text, {source, posPrior, M}) — the felt sense AS WEFT ATTESTATIONS: one `feels-as` assertion per
 * word (type level; words are fine), the word's felt type = the POS axis it rides highest, witnessed at its first
 * mention's byte address `<source>#<byteOffset>`. Kind-free, same shape as the recurrence/positional relations
 * (weft.js), so it composes: `weftAttestations` yields it and `ruliad.fieldFromWeft` folds it into the field.
 */
export function feltAttestations(text, { source = "<text>", posPrior = null, M = 8 } = {}) {
  const fsx = feltSense(text, { posPrior, M });
  const byWord = new Map();
  for (const f of fsx.felt) {
    if (!byWord.has(f.form)) byWord.set(f.form, { form: f.form, at: f.at, sum: {}, n: 0 });
    const w = byWord.get(f.form);
    if (Number.isFinite(f.score) && f.pos) { w.sum[f.pos] = (w.sum[f.pos] ?? 0) + f.score; }
    w.n += 1; if (f.at < w.at) w.at = f.at;
  }
  const rels = [];
  for (const w of byWord.values()) {
    let best = null, bv = -Infinity;
    for (const [pos, s] of Object.entries(w.sum)) if (s / w.n > bv) { bv = s / w.n; best = pos; }
    if (!best) continue;
    rels.push({
      relation: "feels-as",
      participants: [
        { ref: null, surface: w.form, standing: "referent" },
        { surface: `felt:${best}`, standing: "kind" },
      ],
      at: w.at,
      scope: { byteOffset: w.at },
      extent: { mentions: w.n, feltType: best },
    });
  }
  return rels;
}

/** feltPass(text, {source, posPrior, M}) — the felt sense as ONE weft pass, addressed, ready to append beside the
 *  recurrence/positional pass. `source` is the permanent address of the text (e.g. the file path). */
export function feltPass(text, { source = "<text>", posPrior = null, M = 8 } = {}) {
  return appendPass(emptyWeft(), { address: source, relations: feltAttestations(text, { source, posPrior, M }) });
}

/**
 * pickPredicates(text, {posPrior, M}) — the USE: in each sentence, the word the felt sense reads most VERBY is the
 * predicate (the grammar pivot's own missing signal). Returns per-sentence `{sentence, predicate, verby, runnerUp}`.
 * Prior-free of any verb list — the axis is built from this text's own deltas.
 */
export function pickPredicates(text, { posPrior = null, M = 8 } = {}) {
  const fsx = feltSense(text, { posPrior, M });
  const byS = new Map();
  for (const f of fsx.felt) { if (!Number.isFinite(f.verby)) continue; if (!byS.has(f.s)) byS.set(f.s, []); byS.get(f.s).push(f); }
  const out = [];
  for (const [s, xs] of [...byS].sort((a, b) => a[0] - b[0])) {
    const ranked = xs.slice().sort((a, b) => b.verby - a.verby);
    out.push({ s, predicate: ranked[0]?.form ?? null, verby: ranked[0]?.verby ?? null, runnerUp: ranked[1]?.form ?? null, runnerUpVerby: ranked[1]?.verby ?? null });
  }
  return out;
}
