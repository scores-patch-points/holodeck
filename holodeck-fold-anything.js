// holodeck-fold-anything.js — THE MECHANICAL FOLD OF ANY SCOPE. No model.
//
// holodeck-summary.js folds ONE document into one line, five, three paragraphs, from the
// document's own sentences. This module folds ANYTHING the app can scope: a workspace, a
// folder, a topic, everything said about a name, the filtered view, one source. It is the
// same fold — the same worth(), the same MMR — run over the scope's statements as one
// virtual document, and then held by two gates before a line may stand:
//
//   · HOUDINI (khora/native/the-fold/archon-rules.js::houdiniExclusivity, through its own
//     check, referent-verify.js::isMetaSentence): a line that talks about its own telling
//     (the article, the chapter, the reader, "this section") is folded out; and where the
//     scope carries beings, a line that names none is folded out — "the effect is ordinary
//     means, and a line dressed as content with no mechanism behind it does not survive".
//     Per grain (the-mechanical-fold.md, line 4): where the scope carries almost no beings
//     (a paper, a dataset) the being test is not applied — the ledger says which first.
//   · GRAMMAR: every line is a WHOLE sentence of the source — it opens on a capital, a digit
//     or an opening quote, closes on terminal punctuation, and its quotes and brackets
//     balance. The only repair is trimming what a sentence splitter left on the edge (a
//     closing quote or dash from the sentence before); nothing is ever reworded. A line
//     that fails is not fixed, it is passed over for the next one.
//
// Grammar is therefore the source's own: no line has a word the source did not write in
// that order. Lines are put back in the order the sources hold them (source, then byte).
// Every line keeps its source id and byte span.
//
//   import { foldAnything } from './holodeck-fold-anything.js';
//   const F = foldAnything(A, statements, { size: 5 });   // A = the page's analyze()
//
//   node --test holodeck-fold-anything.test.mjs

import { worth, vectors, cosine } from './holodeck-summary.js';

const META_MOD = await import('./vendor/eoreader7/native/the-fold/referent-verify.js').catch(() => null);
const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

// What a sentence splitter leaves on the front edge: the closing quote of the sentence before, a dash, a comma.
const EDGE = /^[\s”’"')\]}\-–—,;:·•*]+/;
const OPENS = /^[“"‘'(\[]?[\p{Lu}\p{N}]/u;
const CLOSES = /[.!?…][”’"')\]]*$/;
// The text talking about itself, beyond the khora check: navigation and furniture.
const FURNITURE = /\b(click here|see (also|below|above)|table of contents|this (article|page|section|chapter|document|paper|report)|in this (article|section|chapter|paper|report)|the following (section|table|figure)|figure \d|table \d|et al\.?$)\b/i;

/** wholeSentence(text) -> { ok, line, why } — the grammar gate. Trims only edge debris. */
export function wholeSentence(text) {
  let line = clean(text);
  // a leading closing quote from the sentence before is debris; a leading OPENING quote is the sentence's own
  const trimmed = line.replace(EDGE, (m) => (/[“‘]/.test(m) ? m : ''));
  line = trimmed.trim();
  if (!line) return { ok: false, line, why: 'empty' };
  const words = line.split(' ').length;
  if (words < 5) return { ok: false, line, why: 'too short to be a sentence' };
  if (words > 70) return { ok: false, line, why: 'a run-on the splitter did not break' };
  if (!OPENS.test(line)) return { ok: false, line, why: 'does not open a sentence' };
  if (!CLOSES.test(line)) return { ok: false, line, why: 'does not close a sentence' };
  const count = (re) => (line.match(re) || []).length;
  if (count(/“/g) !== count(/”/g)) return { ok: false, line, why: 'its quotation marks do not balance' };
  if (count(/"/g) % 2) return { ok: false, line, why: 'its quotation marks do not balance' };
  if (count(/\(/g) !== count(/\)/g) || count(/\[/g) !== count(/\]/g)) return { ok: false, line, why: 'its brackets do not balance' };
  if (/\|/.test(line) || /\t/.test(text || '')) return { ok: false, line, why: 'a table row, not a sentence' };
  const caps = line.split(' ').filter((w) => /^[\p{Lu}]{2,}[\p{Lu}\d]*$/u.test(w)).length;
  if (caps / words > 0.5) return { ok: false, line, why: 'a heading, not a sentence' };
  return { ok: true, line };
}

// Speech debris a transcript carries that no edited sentence does: fillers, a word said twice
// in a row (the speaker's own repair), a bare number the splitter left from "No. 2" or "1.28".
// "had had" is English's one common legitimate doubling; every other immediate repeat is a repair.
const FILLER = /(^|[\s,])(um+|uh+|erm|er|hmm+|uh-huh)([\s,.!?]|$)|,\s*you know,|,\s*i mean,|,\s*(excuse me|sorry|i'm sorry),\s*\p{Ll}/iu;
export function speechDebris(line) {
  const s = String(line || '');
  if (FILLER.test(s)) return 'a filler or self-correction from speech';
  const rep = s.match(/\b([\p{L}']+)\b[\s,]+\1\b/iu);
  if (rep && rep[1].toLowerCase() !== 'had') return 'a word said twice in a row';
  if (/^\d[\d,.]*\s+\p{Ll}/u.test(s)) return 'a fragment starting on a bare number';
  return null;
}

// THE CLAUSE CHECK (Chomsky — adapters/text/english-parser.js, trained on UD_English-EWT, no
// model): a line stands only if its root is a predicate with a finite verb and its own subject,
// it does not end on a word that needs a complement, and its parse carries none of the
// relations UD reserves for broken speech (reparandum, discourse, dep, orphan, goeswith, list)
// or for noun phrases run together with nothing joining them (nmod:unmarked, obl:unmarked).
// Measured 2026-10-13: on 400 War and Peace sentences it keeps 62% (it is strict — parser
// errors cost recall, and a summary needs a handful of lines from thousands); every War and
// Peace line it kept was grammatical. On a council transcript the parse alone kept fillers,
// repairs and fragments — speechDebris() is what catches those.
const BROKEN = new Set(['nmod:unmarked', 'obl:unmarked', 'reparandum', 'discourse', 'list', 'dep', 'goeswith', 'orphan']);
let _grammar = null;
/** loadGrammar() -> { model, P } | null — the English parser, loaded once, only when a fold asks. */
export function loadGrammar() {
  if (_grammar) return _grammar;
  _grammar = (async () => {
    try {
      const P = await import('./vendor/eoreader7/native/adapters/text/english-parser.js');
      const url = new URL('./vendor/eoreader7/native/priors/parser-eng-ewt.json', import.meta.url);
      let json;
      if (url.protocol === 'file:') { const fs = await import('node:fs'); json = JSON.parse(fs.readFileSync(url, 'utf8')); }
      else json = await (await fetch(url)).json();
      return { P, model: P.loadModel(json) };
    } catch { return null; }
  })();
  return _grammar;
}
export function clauseCheck(G, line) {
  if (!G) return { ok: true, checked: false };
  const rows = G.P.analyse(G.model, G.P.tokenize(line).map((t) => t.form));
  if (!rows.length) return { ok: false, why: 'no words' };
  const root = rows.find((r) => r.head === 0) || rows[0];
  const rk = rows.filter((x) => x.head === root.id);
  const fin = (r) => /VerbForm=Fin/.test(r.feats) || (r.upos === 'VERB' && /Mood=Ind|Tense=(Past|Pres)/.test(r.feats));
  const words = rows.filter((r) => r.upos !== 'PUNCT');
  if (!(root.upos === 'VERB' || root.upos === 'AUX' || rk.some((k) => k.deprel === 'cop'))) return { ok: false, why: 'no verb at its root' };
  if (!(fin(root) || rk.some((k) => /^(aux|aux:pass|cop)$/.test(k.deprel) && fin(k)))) return { ok: false, why: 'no finite verb' };
  if (!(rk.some((k) => /^(nsubj|csubj|expl)/.test(k.deprel)) || (root.upos === 'VERB' && /Mood=Imp/.test(root.feats)))) return { ok: false, why: 'no subject' };
  if (['CCONJ', 'ADP', 'DET', 'AUX', 'SCONJ'].includes(words[words.length - 1].upos)) return { ok: false, why: 'ends on a word that needs more' };
  if (words[0].upos === 'INTJ') return { ok: false, why: 'opens on an interjection' };
  const bad = rows.find((r) => BROKEN.has(r.deprel));
  if (bad) return { ok: false, why: 'broken structure (' + bad.deprel + ')' };
  return { ok: true, checked: true };
}

/** isTellingItself(line) — Houdini's own check (khora isMetaSentence) plus the page's furniture. */
export function isTellingItself(line) {
  const s = String(line || '');
  if (FURNITURE.test(s)) return true;
  try { return !!(META_MOD && META_MOD.isMetaSentence && META_MOD.isMetaSentence(s)); } catch { return false; }
}

/** houdini(st, { beings }) -> { ok, why } — the exclusivity cut over one candidate. */
export function houdini(st, line, { beings = true } = {}) {
  if (isTellingItself(line)) return { ok: false, why: 'talks about its own telling' };
  if (beings && !((st.names && st.names.length) || (st.figs && st.figs.length))) return { ok: false, why: 'names no one and states no measure' };
  return { ok: true };
}

/** A stable order for a scope: the sources in the order given, then bytes. */
function orderOf(sts, docOrder) {
  const rank = new Map(docOrder.map((d, i) => [d, i]));
  return sts.slice().sort((a, b) => ((rank.get(a.doc) ?? 1e9) - (rank.get(b.doc) ?? 1e9)) || ((a.s || 0) - (b.s || 0)));
}

/**
 * foldAnything(A, sts, { size, lambda, forWhom, docOrder }) ->
 *   { ok, one, lines: [{ text, doc, s, e, id }], paragraphs, folded: [{ text, why }], scope, note }
 * `sts` is any set of the analysis' statements. Zero model calls.
 */
export function foldAnything(A, sts, { size = 5, lambda = 0.6, forWhom = null, docOrder = null, grammar = null } = {}) {
  const docs = docOrder || [...new Set((sts || []).map((s) => s.doc))];
  const claims = orderOf((sts || []).filter((s) => s && !s.ref && s.claimy !== false && clean(s.text).split(' ').length >= 4), docs);
  const scope = { statements: claims.length, sources: new Set(claims.map((s) => s.doc)).size };
  if (claims.length < 3) return { ok: false, one: '', lines: [], paragraphs: [], folded: [], scope, note: claims.length ? 'Too little here to fold: ' + claims.length + (claims.length === 1 ? ' statement.' : ' statements.') : 'Nothing here to fold yet.' };

  const VID = '\u0000scope';
  const V = { ...A, stsByDoc: { ...(A.stsByDoc || {}), [VID]: claims } };
  const { score } = worth(V, VID, { forWhom });
  const vec = vectors(claims, { namesOf: (st) => st.names || [] });
  // Per grain: does this scope carry beings at all? (the ledger states which before any arm runs)
  const named = claims.filter((s) => s.names && s.names.length).length;
  const beings = named / claims.length >= 0.15;

  const ranked = claims.slice().sort((a, b) => (score.get(b.id)?.s || 0) - (score.get(a.id)?.s || 0));
  const picked = [], folded = [], seen = new Set();
  const gate = new Map();
  for (const st of ranked) {
    const g = wholeSentence(st.text);
    if (!g.ok) { gate.set(st.id, g.why); continue; }
    const h = houdini(st, g.line, { beings });
    if (!h.ok) { gate.set(st.id, h.why); continue; }
    const d = speechDebris(g.line);
    if (d) { gate.set(st.id, d); continue; }
    gate.set(st.id, g.line);
  }
  const parsed = new Set();
  while (picked.length < size) {
    let best = null;
    for (const st of ranked) {
      if (seen.has(st.id)) continue;
      const g = gate.get(st.id);
      if (typeof g !== 'string' || !wholeSentence(g).ok) continue;
      const overlap = picked.length ? Math.max(...picked.map((p) => cosine(vec.get(st.id) || new Map(), vec.get(p.st.id) || new Map()))) : 0;
      const s = (score.get(st.id)?.s || 0) - lambda * overlap;
      if (!best || s > best.s) best = { st, s, line: g };
    }
    if (!best) break;
    seen.add(best.st.id);
    if (!parsed.has(best.st.id)) {                     // the parse runs only on a line about to stand
      parsed.add(best.st.id);
      const c = clauseCheck(grammar, best.line);
      if (!c.ok) { gate.set(best.st.id, c.why); continue; }
    }
    picked.push(best);
  }
  // what the gates folded out, in rank order, each with the gate's own reason (shown, never hidden)
  for (const st of ranked) {
    const g = gate.get(st.id);
    if (typeof g === 'string' && wholeSentence(g).ok) continue;
    folded.push({ text: clean(st.text), why: g, doc: st.doc, id: st.id });
  }
  const at = new Map(claims.map((s, i) => [s.id, i]));
  const one = picked[0] ? picked[0].line : '';
  const lines = picked.slice().sort((a, b) => at.get(a.st.id) - at.get(b.st.id)).map((p) => ({ text: p.line, doc: p.st.doc, s: p.st.s, e: p.st.e, id: p.st.id }));
  const per = Math.ceil(lines.length / 3);
  const paragraphs = lines.length <= 3 ? lines.map((l) => l.text) : [0, 1, 2].map((i) => lines.slice(i * per, (i + 1) * per).map((l) => l.text).join(' ')).filter(Boolean);
  return { ok: lines.length > 0, one, lines, paragraphs, folded, scope: { ...scope, beings }, grammarChecked: !!grammar, note: lines.length ? '' : 'Every candidate line failed a gate, so nothing is stated.' };
}

/** foldAnythingChecked(A, sts, opts) — the same fold with the clause check loaded first. */
export async function foldAnythingChecked(A, sts, opts = {}) {
  const grammar = await loadGrammar();
  return foldAnything(A, sts, { ...opts, grammar });
}

/** splitSentences(text) — sentences with byte spans, for text the reader has not read. */
export function splitSentences(text) {
  const out = []; const re = /[^.!?]+(?:[.!?]+[”’"')\]]*|$)/g; let m;
  const src = String(text || '');
  while ((m = re.exec(src))) { const t = m[0]; const s = m.index + (t.length - t.trimStart().length); const body = t.trim(); if (body) out.push({ text: body, s, e: s + body.length }); if (!t.length) break; }
  return out;
}
