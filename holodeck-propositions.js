// holodeck-propositions.js — the meaningful propositions a statement carries, and where every other source stands on each.
//
// A proposition is a being, what is said of it, and the value: "R.M.S. Titanic · registered tonnage = 46,328 tons",
// "J. Bruce Ismay — chairman, at the White Star Line". It is read off the holograph (A.keyedFigs for what a figure
// measures and of whom; A.rolesOf for the office a source gives a being), never off the words around a number, so
// two sources that state one proposition in different words meet under one key.
//
// For each proposition of a statement the other sources are laid against it:
//   agrees      every other source that states this proposition states the same value
//   disagrees   some other source states it with a different value (the value is the split, the key is the identity)
//   alone       no other source states it: nothing to hold it against (never called a gap, only unmatched)
// Every proposition carries its byte span in the statement; every other voice carries its own.
// Pure: the analysis in, propositions out. The index over the whole workspace is built once per analysis.

const idxOf = new WeakMap();

function claimsOf(A, st) {
  const out = [];
  let figs = []; try { if (A.keyedFigs) figs = A.keyedFigs(st) || []; } catch (e) { figs = []; }
  for (const f of figs) {
    if (!f || !f.key || !isFinite(+f.v)) continue;
    out.push({ kind: 'figure', key: f.key, being: f.anchor || '', measure: f.measure || '', value: +f.v, raw: f.raw || String(f.v), s: f.s || 0, e: f.e != null ? f.e : (f.s || 0), via: f.via || null });
  }
  let roles = []; try { if (A.rolesOf) roles = A.rolesOf(st) || []; } catch (e) { roles = []; }
  for (const r of roles) out.push({ kind: 'role', key: r.key, being: r.person, measure: 'role' + (r.body ? ' at ' + r.body : ''), value: r.role, raw: r.raw, s: r.s, e: r.e, via: 'name', body: r.body });
  return out;
}

/** claimIndex(A) -> Map key -> [{ doc, st, kind, value, raw, s, e }] over every statement of every source (offsets absolute). */
export function claimIndex(A) {
  let ix = idxOf.get(A); if (ix) return ix; ix = new Map();
  for (const st of A.sts || []) {
    if (!st || st.ref || !st.text) continue;
    for (const c of claimsOf(A, st)) { let l = ix.get(c.key); if (!l) ix.set(c.key, l = []); l.push({ ...c, doc: st.doc, st, s: (st.s || 0) + c.s, e: (st.s || 0) + c.e }); }
  }
  idxOf.set(A, ix); return ix;
}

/** propositionsOf(A, st) -> [{ kind, key, being, measure, value, raw, s, e, verdict, others:[{ doc, title, st, value, raw, s, e, agrees }] }]
 *  s/e are relative to the statement. Disagreements first, then agreements, then what stands alone. */
export function propositionsOf(A, st) {
  if (!A || !st) return [];
  const ix = claimIndex(A); const title = d => ((A.docById || {})[d] || {}).title || d;
  const rank = { disagrees: 0, agrees: 1, alone: 2 };
  return claimsOf(A, st).map(c => {
    const others = (ix.get(c.key) || []).filter(o => o.doc !== st.doc)
      .map(o => ({ doc: o.doc, title: title(o.doc), st: o.st, value: o.value, raw: o.raw, s: o.s, e: o.e, agrees: o.value === c.value }));
    const verdict = !others.length ? 'alone' : others.some(o => !o.agrees) ? 'disagrees' : 'agrees';
    return { ...c, verdict, others };
  }).sort((a, b) => rank[a.verdict] - rank[b.verdict] || a.s - b.s);
}

/** the proposition as a sentence a reader can check against the passage */
export function sentenceOf(p) {
  return p.kind === 'role' ? p.being + ' — ' + p.value + (p.body ? ', ' + p.body : '') : (p.being ? p.being + ' · ' : '') + p.measure + ' = ' + p.raw;
}

/** eotOfStatement(A, st) -> { ground, figure, pattern, raw }  the statement as structured EOT, Ground · Figure · Pattern.
 *  ground   the beings the reading admitted in the statement (what is spoken of)
 *  figure   the claims on them: the engine's own relation triples (A.eotOf: end1 —label→ end2, with cell, grain and
 *           polarity), the keyed figures (being —measure→ value) and the offices (person —role→ body)
 *  pattern  for each figure claim, where every other source stands: agrees / disagrees / alone, with the voices
 *  raw      the engine's relation triples exactly as read, for a reader who wants the record itself */
export function eotOfStatement(A, st) {
  if (!A || !st) return { ground: [], figure: [], pattern: { agrees: 0, disagrees: 0, alone: 0 }, raw: [] };
  let raw = []; try { if (A.eotOf) raw = A.eotOf(st) || []; } catch (e) { raw = []; }
  const seen = new Set(); const ground = [];
  for (const sp of st.spans || []) { if (!sp || !sp.name || seen.has(sp.name)) continue; seen.add(sp.name); const n = (A.names || {})[sp.name]; ground.push({ name: sp.name, type: (n && n.type) || '', s: sp.s, e: sp.e }); }
  const figure = [];
  for (const t of raw) figure.push({ kind: 'relation', end1: t.end1, label: t.label, end2: t.end2, cell: t.cell || '', grain: t.grain || null, polarity: t.polarity || '+', verdict: 'alone', others: [], s: t.offset || 0, e: t.offset || 0 });
  for (const p of propositionsOf(A, st)) figure.push(p.kind === 'role'
    ? { kind: 'role', end1: p.being, label: p.value, end2: p.body || '', cell: 'DEF·Figure (Role)', polarity: '+', verdict: p.verdict, others: p.others, s: p.s, e: p.e, raw: p.raw }
    : { kind: 'figure', end1: p.being, label: p.measure, end2: p.raw, cell: 'EVA·Figure (Measure)', polarity: '+', verdict: p.verdict, others: p.others, s: p.s, e: p.e, raw: p.raw });
  const pattern = { agrees: 0, disagrees: 0, alone: 0 }; figure.forEach(f => { pattern[f.verdict === 'agrees' ? 'agrees' : f.verdict === 'disagrees' ? 'disagrees' : 'alone']++; });
  return { ground, figure, pattern, raw };
}

export default { claimIndex, propositionsOf, sentenceOf, eotOfStatement };
