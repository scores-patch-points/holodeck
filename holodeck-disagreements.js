// holodeck-disagreements.js — the places where sources that mean the same thing give different values, ranked.
//
// A disagreement needs two things at once, and never one without the other:
//   IDENTITY  the figures are keyed to the same measure and the same being (A.keyedFigs: the holograph's reading,
//             never the unit word beside the number), so they are about one thing;
//   SPLIT     they state different values, in different sources.
// A figure the holograph could not key is not here: it may nominate, it cannot decide (FOLD-CONSTITUTION II.7).
//
// What makes one worth a reader's time (all read off the record; no model, no clock):
//   · how many sources are on record about it (more independent voices, more weight),
//   · how far apart the values are, on a log scale (46,328 vs 45,328 is a 2% split of one tonnage; 705 vs 711
//     survivors is under 1% but it is a count of people),
//   · how firmly the being is established (named in the statement itself > read from the source's own referent),
//   · whether the figure is hedged ("about 1100", "estimated") — a hedged figure is a range, not a claim.
// Pure: the analysis in, a ranked list out. Every entry carries the byte span of every value it rests on.

// A role claim is a value of a slot (a being at a body), like a figure is a value of a measure.
function roleAt(groups, A, st, r) {
  let g = groups.get(r.key); if (!g) { g = { key: r.key, anchor: r.person, measure: 'role' + (r.body ? ' at ' + r.body : ''), kind: 'role', at: [] }; groups.set(r.key, g); }
  g.at.push({ doc: st.doc, st, value: r.role, raw: r.raw, s: (st.s || 0) + r.s, e: (st.s || 0) + r.e, via: 'name', hedged: false });
}
const HEDGE = /\b(about|around|nearly|almost|some|estimated|approximately|roughly|upwards? of|more than|over|fully|perhaps)\s*$/i;
// A bare dimension unit ("feet", "knots", "miles") is not a measure of anything in particular: two lengths of one ship are
// not one figure. Only a measure the holograph has earned, or a unit that itself names one, can be disagreed about.
const MEASURING_UNITS = new Set(['count', 'ton', 'passenger', 'person', 'people', 'dollar', 'pound', 'percent', 'compartment', 'lifeboat']);
const COUNT_MEASURES = new Set(['saved', 'lost', 'aboard']);

const log10 = Math.log10;

/** disagreementsOf(A) -> [{ key, anchor, measure, score, why, nDocs, spread, values:[{ value, raw, docs:[{doc,title,st,s,e,hedged,via}] }] }]
 *  Most worth reading first. Needs A.keyedFigs; without it there is nothing keyed to compare, so nothing is said. */
export function disagreementsOf(A, { min = 0, limit = 200 } = {}) {
  if (!A || (typeof A.keyedFigs !== 'function' && typeof A.rolesOf !== 'function')) return [];
  const groups = new Map();
  for (const st of A.sts || []) {
    if (!st || st.ref || !st.text) continue;
    let figs = []; try { if (A.keyedFigs) figs = A.keyedFigs(st) || []; } catch (e) { figs = []; }
    if (A.rolesOf) { try { for (const r of A.rolesOf(st) || []) roleAt(groups, A, st, r); } catch (e) { /* the figures stand */ } }
    for (const f of figs) {
      if (!f || !f.key || !isFinite(+f.v) || !MEASURING_UNITS.has(f.key.split('|')[0])) continue;
      const base = f.s != null ? f.s : 0; const before = st.text.slice(Math.max(0, base - 18), base);
      let g = groups.get(f.key); if (!g) { g = { key: f.key, anchor: f.anchor || '', measure: f.measure || '', at: [] }; groups.set(f.key, g); }
      g.at.push({ doc: st.doc, st, value: +f.v, raw: f.raw || String(f.v), s: (st.s || 0) + base, e: (st.s || 0) + (f.e != null ? f.e : base), via: f.via || null, hedged: HEDGE.test(before) });
    }
  }
  const out = [];
  for (const g of groups.values()) {
    const docs = new Set(g.at.map(x => x.doc)); if (docs.size < 2) continue;
    const byValue = new Map(); g.at.forEach(x => { let v = byValue.get(x.value); if (!v) byValue.set(x.value, v = { value: x.value, raw: x.raw, docs: [] }); v.docs.push({ ...x, title: ((A.docById || {})[x.doc] || {}).title || x.doc }); });
    if (byValue.size < 2) continue;                                   // every source agrees: nothing to say
    // the same source stating two values is that source's own wobble, not a disagreement between sources
    const values = [...byValue.values()].sort((a, b) => b.docs.length - a.docs.length || (typeof a.value === 'number' ? a.value - b.value : String(a.value).localeCompare(String(b.value))));
    const isRole = g.kind === 'role';
    const lo = isRole ? 0 : Math.min(...values.map(v => v.value)), hi = isRole ? 0 : Math.max(...values.map(v => v.value));
    const spread = isRole ? 1 : hi > 0 ? (hi - lo) / hi : 0;      // two different offices are as far apart as two values can be
    const spreadW = Math.min(1, log10(1 + 100 * spread) / 2);        // 1% → .15, 10% → .52, 50% → .85
    const named = g.at.filter(x => x.via === 'name').length / g.at.length;
    const idW = 0.6 + 0.4 * named;
    const hedged = g.at.filter(x => x.hedged).length / g.at.length;
    const hedgeW = 1 - 0.5 * hedged;
    const voices = 1 + Math.log2(docs.size);
    const countBoost = isRole ? 1.3 : COUNT_MEASURES.has(g.measure) ? 1.25 : 1;      // a count of people is what an account is read for
    const score = +(voices * (0.4 + spreadW) * idW * hedgeW * countBoost).toFixed(3);
    if (score < min) continue;
    const why = [docs.size + ' sources on record', values.length + (isRole ? ' different roles' : ' different values'), isRole ? null : (spread * 100 < 1 ? '<1' : Math.round(spread * 100)) + '% apart',
      named >= 0.5 ? 'being named in the text' : 'being read from the source', hedged ? 'some figures hedged' : null].filter(Boolean).join(' · ');
    out.push({ key: g.key, kind: g.kind || 'figure', anchor: g.anchor, measure: g.measure, score, why, nDocs: docs.size, spread, values });
  }
  return out.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key)).slice(0, limit);
}

export default { disagreementsOf };
