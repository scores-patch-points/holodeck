// reading/propositions.js — PROPOSITIONS AS NESTED, ORDERED TUPLES, read from a dependency parse.
//
// A proposition is the smallest meaningful tuple, and it can be smaller than a clause: a clause gives (subject, act, object); a preposition
// inside it gives its own tuple (head, prep, ground) nested under the clause it modifies; a clause that is the content of another ("she said that
// the roof fell") is a tuple nested under the saying. ORDER is part of the record: `order` is the tuple's place among its siblings, in the
// order the text makes them, and `at` is where it begins. Nothing here parses: the rows come from the vendored English parser and the
// clause tree from nested-clauses.js; this only shapes them. A sentence the parser cannot make a clause of yields no tuple (a refusal, not a guess).
//
//   tuplesOf(rows, { mood, base }) → { tuples: [flat, in text order], tree: [roots with .children] }
//     rows   UD rows of ONE sentence: {id, form, lemma, upos, head, deprel, feats, start?, end?}
//     mood   'declarative' | 'interrogative' | 'exclamatory' from the punctuation layer (marks the root tuple; nested ones are held in it)
//     base   byte/char offset to add to row starts
import { clausesOf } from '../vendor/khora/native/adapters/text/nested-clauses.js';

const feat = (r, k) => { const m = String(r?.feats || '').match(new RegExp('(?:^|\\|)' + k + '=([^|]+)')); return m ? m[1] : null; };
const MODALS = new Set(['can', 'could', 'may', 'might', 'must', 'shall', 'should', 'will', 'would', 'ought']);

/** modality, tense and voice from the verb's own auxiliaries and features — read, never guessed */
function verbality(rows, headId) {
  const head = rows.find((r) => r.id === headId), kids = rows.filter((r) => r.head === headId);
  const aux = kids.filter((c) => /^(aux|cop)/.test(c.deprel)), pass = kids.some((c) => c.deprel === 'aux:pass' || c.deprel === 'nsubj:pass');
  const modal = aux.map((a) => String(a.lemma || a.form).toLowerCase()).find((l) => MODALS.has(l)) || null;
  const verbForm = feat(head, 'VerbForm'), tense = feat(head, 'Tense') || aux.map((a) => feat(a, 'Tense')).find(Boolean) || null;
  const perfect = aux.some((a) => /^(have|has|had)$/i.test(a.form)) && verbForm === 'Part';
  return { modal, voice: pass ? 'passive' : 'active', tense: modal ? (modal === 'will' || modal === 'shall' ? 'future' : 'irrealis') : tense === 'Past' ? 'past' : tense === 'Pres' ? 'present' : perfect ? 'perfect' : null };
}

export function tuplesOf(rows, { mood = 'declarative', base = 0 } = {}) {
  const clauses = clausesOf(rows), at = (x) => (x == null ? null : x + base);
  if (!clauses.length) return { tuples: [], tree: [] };
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out = [];
  const textOf = (ids) => ids.map((i) => byId.get(i)).sort((a, b) => a.id - b.id).filter((r) => r.upos !== 'PUNCT').map((r) => r.form).join(' ').replace(/\s+([,.;:!?)])/g, '$1');
  const sub = (id) => { const o = [], st = [id]; while (st.length) { const x = st.pop(); o.push(x); rows.forEach((r) => { if (r.head === x) st.push(r.id); }); } return o; };
  for (const c of clauses) {
    const v = verbality(rows, c.head), root = c.relation === 'root';
    out.push({ id: c.id, kind: 'clause', parent: c.parent, relation: c.relation, marker: c.marker, polarity: c.polarity,
      subject: c.subject && c.subject.text, act: c.predicate.lemma || c.predicate.head, lemma: c.predicate.lemma, object: c.object && c.object.text,
      modal: v.modal, tense: v.tense, voice: v.voice, mood: root ? mood : null, at: at(c.own.start), end: at(c.own.end), head: c.head, text: c.own.text });
    // a preposition inside this clause is its own, smaller proposition: (what it modifies, prep, its ground), nested under the clause
    const own = new Set(c.own.tokens);
    rows.filter((r) => own.has(r.id) && /^(obl|nmod)(:|$)/.test(r.deprel) && r.head).forEach((r) => {
      const cs = rows.find((k) => k.head === r.id && k.deprel === 'case'); if (!cs) return;
      const ground = textOf(sub(r.id).filter((i) => i !== cs.id && !rows.some((k) => k.id === i && k.deprel === 'case' && k.head === r.id)));
      const hd = byId.get(r.head);
      out.push({ id: `${c.id}.${r.id}`, kind: 'relation', parent: c.id, relation: cs.form.toLowerCase(), subject: hd ? hd.form : null, act: cs.form.toLowerCase(), object: ground,
        polarity: '+', at: at(cs.start ?? r.start), end: at(r.end), head: r.id, text: `${hd ? hd.form : ''} ${cs.form} ${ground}`.trim() });
    });
  }
  // order: siblings in the order the text makes them
  const kids = new Map(); out.forEach((t) => { const k = t.parent || ''; (kids.get(k) || kids.set(k, []).get(k)).push(t); });
  kids.forEach((l) => { l.sort((a, b) => (a.at ?? 0) - (b.at ?? 0) || a.head - b.head); l.forEach((t, i) => { t.order = i; }); });
  const node = new Map(out.map((t) => [t.id, { ...t, children: [] }])), tree = [];
  out.forEach((t) => (t.parent && node.get(t.parent) ? node.get(t.parent).children : tree).push(node.get(t.id)));
  const sortRec = (l) => { l.sort((a, b) => a.order - b.order); l.forEach((n) => sortRec(n.children)); }; sortRec(tree);
  const flat = []; const walk = (l) => l.forEach((n) => { flat.push(n); walk(n.children); }); walk(tree);
  return { tuples: flat, tree };
}

/** the text of a tuple as (a —act→ b), for display */
export const tupleLabel = (t) => `${t.subject ?? '·'} —${t.polarity === '-' ? 'not ' : ''}${t.modal ? t.modal + ' ' : ''}${t.act}→ ${t.object ?? '·'}`;
