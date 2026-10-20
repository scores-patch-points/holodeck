// corpus-map.js — SEVERAL ACCOUNTS, ONE SOLAR SYSTEM, MANY LEVELS OF REALITY.
//
// What the corpus reader knows (corpus.js over reading-timeline.js) becomes the data holodeck-map.js draws. The questions this settles:
//
//   BODY      a body is a BEING (a meta-node: the fold over severable correspondence links between per-source ends). A name only nominates:
//             two ends with the same name in different sources are TWO bodies until a link joins them, and the pair waits as a dotted TIE.
//   LEVEL     reality is a coordinate of the body, not a separate map. realityKind is the fold's own record — real · fictionalized-real ·
//             fictional · unexamined — and a source's UNIVERSE follows its declared register: truth-claiming registers speak of the WORLD,
//             the others are TELLINGS. "The world" shows beings with a world-end; "The tellings" shows what the non-truth-claiming sources
//             speak of; a being that has both ends (Tolstoy's Kutuzov, the Titanic's Ismay once someone says "same") sits in both.
//   VIEWPOINT any one source can be the viewpoint: the system is re-ringed around that account's own most-bonded being; what it does not
//             speak of is absent, not dimmed into a guess.
//   SUN       not an entity: a role. The selected body, else the most-bonded in what is showing (holodeck-map.js mapOrigin).
//   BONDS     names sharing a statement in the SAME source. Weight counts distinct sources first, statements second, so one account repeating
//             itself does not pull harder than two independent accounts agreeing.
//
// Pure: no DOM. The caller supplies the sentence splitter.
import { isTruthClaiming } from '../vendor/khora/native/kernel/reality-register.js';

const kindOf = (r) => (r === 'real' || r === 'fictional' || r === 'fictionalized-real' ? r : 'unexamined');
/** The levels a corpus offers: everything, the world, the tellings, and each source as a viewpoint. */
export function levelsOf(corpus) {
  const srcs = corpus.sources.map((s) => ({ id: s.id, label: s.label, register: s.register || '', universe: s.register && isTruthClaiming(s.register) ? 'world' : s.register ? 'telling' : 'undeclared' }));
  const world = srcs.filter((s) => s.universe === 'world').length, telling = srcs.filter((s) => s.universe === 'telling').length;
  return { sources: srcs, options: [{ id: 'all', label: 'Everything' }, ...(world && telling ? [{ id: 'world', label: 'The world' }, { id: 'telling', label: 'The tellings' }] : []), ...srcs.map((s) => ({ id: s.id, label: s.label, source: true }))] };
}

/**
 * corpusMapData({ corpus, fold, sources }, { level, splitSentences }) → the object holodeck-map.js takes ({nodes, edges, docs, occ, odd, hot, hotPairs, cursor, sig}),
 * plus `levels`, `shown` and `hidden` (what the level leaves out, named, never silently dropped).
 */
export function corpusMapData({ corpus, fold, sources }, { level = 'all', splitSentences }) {
  const L = levelsOf(corpus), uni = new Map(L.sources.map((s) => [s.id, s.universe])), title = new Map(L.sources.map((s) => [s.id, s.label]));
  const text = new Map(sources.map((s) => [s.id, s.text || '']));
  const sents = new Map(); for (const [id, t] of text) sents.set(id, (splitSentences ? splitSentences(t) : [{ offset: 0, end: t.length, text: t }]).map((x, i) => ({ i, s: x.offset ?? x.start ?? 0, e: x.end, t: x.text })));
  const sentenceAt = (src, at) => (sents.get(src) || []).find((x) => at >= x.s && at < x.e) || null;
  const refEnds = (b) => b.ends.map((e) => ({ ...e, ref: e.ref }));

  // one body per being; the name on the body is its label, and two bodies that would carry the same label are told apart by their source
  const beings = fold.beings.filter((b) => b.name && b.ends.length);
  const labelCount = new Map(); beings.forEach((b) => labelCount.set(b.name, (labelCount.get(b.name) || 0) + 1));
  const idOf = new Map(), nodes = [], occ = new Map(), docsOf = new Map(), refBeing = new Map();
  const inLevel = (b) => {
    const srcs = [...new Set(b.ends.map((e) => e.source))];
    if (level === 'all') return true;
    if (level === 'world') return srcs.some((s) => uni.get(s) === 'world');
    if (level === 'telling') return srcs.some((s) => uni.get(s) === 'telling');
    return srcs.includes(level);          // a source as the viewpoint
  };
  const hidden = [];
  for (const b of beings) {
    if (!inLevel(b)) { hidden.push(b.name); continue; }
    const srcs = [...new Set(b.ends.map((e) => e.source))].filter((s) => level === 'all' || level === 'world' || level === 'telling' || s === level);
    const dup = labelCount.get(b.name) > 1, id = dup ? `${b.name} · ${title.get(srcs[0]) || srcs[0]}` : b.name;
    idOf.set(b.id, id); b.members.forEach((m) => refBeing.set(m, b.id)); b.ends.forEach((e) => refBeing.set(e.ref, b.id));
    docsOf.set(id, new Set(srcs));
    nodes.push({ n: id, c: b.ends.reduce((a, e) => a + (e.mentions || 1), 0), reality: kindOf(b.reality), mine: false, st: 'fold', docs: srcs, being: b.id, links: b.links ? b.links.length : 0 });
  }
  // occurrences: the statements a body is read in, per source (a statement = a sentence)
  for (const r of fold.referents.values()) {
    const bid = refBeing.get(r.id); const id = bid && idOf.get(bid); if (!id) continue;
    for (const m of r.mentions || []) {
      if (!docsOf.get(id).has(m.source)) continue;
      const s = sentenceAt(m.source, m.s); if (!s) continue;
      const list = occ.get(id) || (occ.set(id, []), occ.get(id));
      if (!list.some((o) => o.doc === m.source && o.id === s.i)) list.push({ doc: m.source, id: s.i, s: s.s, e: s.e, t: s.t });
    }
  }
  // bonds: bodies sharing a statement in one source. c = distinct sources first, then statements
  const pair = new Map();
  const bySt = new Map(); occ.forEach((list, n) => list.forEach((o) => { const k = o.doc + ':' + o.id; (bySt.get(k) || bySt.set(k, new Set()).get(k)).add(n); }));
  bySt.forEach((set, k) => { const src = k.slice(0, k.lastIndexOf(':')), arr = [...set]; for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) { const [a, b] = arr[i] < arr[j] ? [arr[i], arr[j]] : [arr[j], arr[i]], key = a + '\u0001' + b, e = pair.get(key) || pair.set(key, { a, b, sts: 0, docs: new Set() }).get(key); e.sts++; e.docs.add(src); } });
  const edges = [...pair.values()].map((e) => ({ a: e.a, b: e.b, c: e.docs.size * 4 + e.sts, docs: [...e.docs], sts: e.sts }));
  // ties: the same name in two sources that no link joins — a name only nominates. Drawn dotted, never part of the rings.
  const ties = [];
  const nodeOfRef = (ref) => { const bid = refBeing.get(ref); return bid && idOf.get(bid); };
  for (const k of corpus.candidates || []) { const a = nodeOfRef(k.from.ref), b = nodeOfRef(k.to.ref); if (!a || !b || a === b) continue; ties.push({ a, b, c: 1, tie: 'nominated', why: k.identity && k.identity.reason || 'a shared name', from: k.from.source, to: k.to.source }); }
  // joined beings: a being whose ends sit in a world source and a telling is a FICTIONALIZED-REAL body — the correspondence is its own tie
  const bridges = [];
  for (const n of nodes) { const u = new Set([...docsOf.get(n.n)].map((s) => uni.get(s))); if (u.has('world') && u.has('telling')) { n.bridge = true; bridges.push(n.n); } }

  return { nodes, edges: edges.concat(ties), docs: L.sources.filter((s) => level === 'all' || level === 'world' || level === 'telling' || s.id === level).map((s) => ({ id: s.id, title: s.label, universe: s.universe })), occ, odd: new Map(), hot: new Set(), hotPairs: [], cursor: null,
    sig: `${level}:${nodes.length}:${edges.length}:${ties.length}:${(corpus.log || []).length}`, level, levels: L, shown: nodes.length, hidden, ties, bridges };
}
