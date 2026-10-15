// holodeck-atoms.js — the EOT atoms of a proposition, in the fold's own vocabulary
// (holon: / name: / fig: / term:), read by the vendored fold-chat assembler against the
// ground of the source the proposition sits in. This is the "under the hood" of a click on
// a word that is not an entity: the proposition it is part of, read as the minimal content
// units it makes a difference with. Nothing is re-implemented — consequenceOf is byte-vendored
// from fold-chat (see VENDORING.md).
import { consequenceOf } from './vendor/fold-chat/fold-chat-assemble.js';

// What each atom kind is, in a word — the under-the-hood note beside it.
const NOTE = {
  holon: 'the addressed sentence',
  name: 'a name it carries',
  fig: 'a quantity equal to the ground’s',
  term: 'a content word carrying it',
};
const COLOR = { holon: 'var(--acc2)', name: 'var(--acc)', fig: 'var(--amber)', term: 'var(--mut)' };
const kindOf = a => { const i = a.indexOf(':'); return i < 0 ? a : a.slice(0, i); };
const valOf = a => { const i = a.indexOf(':'); return i < 0 ? '' : a.slice(i + 1); };

/** atomsOf(st, A) -> { address, why, detail, atoms:[{kind, value, color, note}] }
 *  for one statement (a proposition). Empty `atoms` is typed in `why` by the assembler. */
export function atomsOf(st, A) {
  if (!st) return { address: '', why: 'no-proposition', detail: '', atoms: [] };
  const doc = (A && A.docById && A.docById[st.doc]) || ((A && A.docs) || []).find(d => d.id === st.doc);
  const text = doc && doc.text ? String(doc.text) : '';
  if (!text) return { address: '', why: 'no-material', detail: 'the source text is not loaded', atoms: [] };
  const page = { ref: doc.id, url: doc.url || '', source: doc.title || '', text };
  const c = consequenceOf(String(st.text || ''), [page]);
  const atoms = (c.atoms || []).map(a => ({ kind: kindOf(a), value: valOf(a), color: COLOR[kindOf(a)] || 'var(--mut)', note: NOTE[kindOf(a)] || '' }));
  return { address: c.address || '', why: c.why || '', detail: c.detail || '', atoms };
}

export default { atomsOf };
