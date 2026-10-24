// unit-tree.js — the units of a material, found from how it breaks: several trees, every unit addressed.
//
// The rules are the frozen pre-registration's (reading/eval/holarchy/PLAN.md §3); this file is their code. Nothing here knows a
// medium or a language by name: a candidate break type is a shape of characters, and whether it is a LEVEL is decided by two
// tests on the material itself.
//
//   (a) nesting, per tree — a type joins a tree when at most 2% of its units cross a boundary of a coarser type already in that
//       tree; a type that crosses every tree starts a new one under the root. Nothing is demoted to an overlay.
//   (b) non-arbitrary — a type built from layout must separate the finer units it contains better than the same number of cuts
//       placed at random among that finer level's boundaries: three signals (surprise, lexical, shape), 1,000 seeded draws, a
//       one-sided permutation p, Holm across every type × signal in the material, admitted when any signal passes at 0.05.
//       Types read from declared script norms (sentences, clauses, paired marks, words) are admitted on (a) alone.
//
//   candidateTypes(text, deps)          every candidate break type with its units: [{ type, norm, units: [[s, e], …] }]
//   admitTypes(text, cands, deps, opts) (b): { admitted: Set<type>, tests: [{ type, finer, k, n, signals: { name: { stat, p } }, verdict }] }
//   buildTrees(text, cands, admitted)   (a): [{ id: 'T1', types: [coarse → fine], units: [{ addr, s, e, type, parent }] }]
//   findUnits(text, deps, opts)         all three, with the evidence
//
// deps (injected, so the page and a Node harness hand in the same organs):
//   splitSentences(text, { abbreviations })  canon spans.js     abbreviations  the page's set, hyperlexicon aliases included
//   scanPunctuation(text, { norms, abbreviations })              norms          the language's declared punctuation norms
//   clauseSpans(text)                                            canon clause-spans.js (optional)
//   gainsAt(text, offsets, { prime }), prime                     reading/sections.js and its register prime (optional: the
//                                                                surprise signal is unmeasured without them)
// Offsets are JavaScript string offsets. A unit is [start, end) with no leading or trailing white space.

const WS = /\s/u;
export const CROSS_MAX = 0.02, DRAWS = 1000, ALPHA = 0.05, MIN_PLACEMENTS = 20;
export const NORM_TYPES = Object.freeze(['sentence', 'clause', 'container', 'word']);

const trim = (text, s, e) => { while (s < e && WS.test(text[s])) s++; while (e > s && WS.test(text[e - 1])) e--; return [s, e]; };
const tidy = (text, spans) => spans.map(([s, e]) => trim(text, s, e)).filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0] || b[1] - a[1]);

// ── the material's lines and blocks ─────────────────────────────────────────────────────────────────────────────────────────────
export function linesOf(text) {
  const out = []; let s = 0;
  for (let i = 0; i <= text.length; i++) if (i === text.length || text[i] === '\n') { out.push({ s, e: i, t: text.slice(s, i) }); s = i + 1; }
  return out;
}
const blank = (l) => !/\S/u.test(l.t);
/** Blocks: runs of non-blank lines separated by one or more blank lines (a page break also separates). */
export function blocksOf(text) {
  const out = []; let cur = null;
  for (const l of linesOf(text)) {
    if (blank(l) || l.t.includes('\f')) { if (cur) { out.push(cur); cur = null; } continue; }
    if (!cur) cur = { s: l.s, e: l.e, lines: [] };
    cur.e = l.e; cur.lines.push(l);
  }
  if (cur) out.push(cur);
  return out;
}

// ── candidate break types ───────────────────────────────────────────────────────────────────────────────────────────────────────
const ENUM = /^\s*(?:\p{N}{1,3}|\p{L})[.)]\s+/u;                       // "1. ", "a) " — a short token of digits or one letter
const BULLET = /^\s*(?:[\p{Pd}\p{Sm}\p{So}]|[•‣◦⁃∙*·])\s+/u;           // a dash or symbol, then a space
const STERM = /[\p{Sentence_Terminal}:]$/u;                             // a line that ends a sentence (or introduces) is not a heading
const NOSPACE = /[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}\p{sc=Thai}\p{sc=Lao}\p{sc=Khmer}\p{sc=Myanmar}\p{sc=Tibetan}]/u;
const WORD = /[\p{L}\p{N}](?:[\p{L}\p{N}\p{M}'’-]*[\p{L}\p{N}\p{M}])?/gu;
const DELIMS = ['\t', '|', ';', ','];

/** Runs of ≥ 2 consecutive lines inside one block that match `re`; each matching line opens a unit that runs to the next one. */
function runsOf(blocks, re) {
  const units = [];
  for (const b of blocks) {
    const ls = b.lines; let i = 0;
    while (i < ls.length) {
      if (!re.test(ls[i].t)) { i++; continue; }
      let j = i; const starts = [];
      while (j < ls.length && (re.test(ls[j].t) || (starts.length && !re.test(ls[j].t) && /^\s+\S/u.test(ls[j].t)))) { if (re.test(ls[j].t)) starts.push(j); j++; }
      if (starts.length >= 2) starts.forEach((a, k) => units.push([ls[a].s, ls[(k + 1 < starts.length ? starts[k + 1] : j) - 1].e]));
      i = Math.max(j, i + 1);
    }
  }
  return units;
}

/** A delimiter count per line, constant and non-zero over a run of ≥ 2 lines of one block: table rows, and their cells. */
function tablesOf(blocks) {
  const rows = [], cells = [];
  const fields = (t, d) => (d === ',' ? splitCsv(t) : t.split(d));
  const count = (t, d) => { const f = fields(t, d); return f.filter((x) => x.trim()).length >= 2 ? f.length - 1 : 0; };
  for (const b of blocks) {
    const ls = b.lines; let i = 0;
    while (i < ls.length - 1) {
      let best = null;
      for (const d of DELIMS) { const c = count(ls[i].t, d); if (c > 0 && count(ls[i + 1].t, d) === c) { best = { d, c }; break; } }
      if (!best) { i++; continue; }
      let j = i; while (j < ls.length && count(ls[j].t, best.d) === best.c) j++;
      for (let k = i; k < j; k++) {
        const l = ls[k]; rows.push([l.s, l.e]);
        let at = l.s;
        for (const f of best.d === ',' ? splitCsv(l.t) : l.t.split(best.d)) { cells.push([at, at + f.length]); at += f.length + 1; }
      }
      i = j;
    }
  }
  return { rows, cells };
}
function splitCsv(line) {   // fields of one CSV line, quotes respected; each field returned as written
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) { const c = line[i]; if (c === '"') { q = !q; cur += c; } else if (c === ',' && !q) { out.push(cur); cur = ''; } else cur += c; }
  out.push(cur); return out;
}

/** Statements by brace depth: a line opens a statement when the previous non-blank line at its depth ended with ; { or }. */
function statementsOf(text) {
  const out = [];
  for (const b of blocksOf(text)) { const t = text.slice(b.s, b.e); if (/[{}]/u.test(t)) for (const [s, e] of statementsIn(t)) out.push([b.s + s, b.s + e]); }
  return out.length >= 2 ? out : [];
}
function statementsIn(text) {
  const strip = (t) => t.replace(/\/\/.*$/u, '').replace(/(["'`])(?:\\.|(?!\1).)*\1/gu, '""');
  const ls = linesOf(text); let depth = 0; const opens = [];
  let prevEnd = { 0: true }, inComment = false;
  ls.forEach((l, idx) => {
    let raw = l.t;
    if (inComment) { const k = raw.indexOf('*/'); if (k < 0) return; raw = raw.slice(k + 2); inComment = false; }
    raw = raw.replace(/\/\*.*?\*\//gu, '');
    const open = raw.indexOf('/*'); if (open >= 0) { raw = raw.slice(0, open); inComment = true; }
    const t = strip(raw), lead = t.trimStart();
    if (!lead) return;
    const d = depth - (lead.startsWith('}') ? 1 : 0);
    if (prevEnd[d] !== false && !lead.startsWith('}')) opens.push({ idx, d });
    for (const c of t) { if (c === '{') depth++; else if (c === '}') depth = Math.max(0, depth - 1); }
    const last = t.trimEnd().slice(-1);
    prevEnd[d] = /[;{}]/u.test(last);
    if (last === '{') prevEnd[depth] = true;
  });
  const units = [];
  opens.forEach((o, k) => {
    let end = ls.length - 1;
    for (let m = k + 1; m < opens.length; m++) if (opens[m].d <= o.d) { end = opens[m].idx - 1; break; }
    units.push([ls[o.idx].s, ls[end].e]);
  });
  return units;
}

function wordsOf(text) {
  const out = [];
  for (const m of text.matchAll(WORD)) {
    if (!NOSPACE.test(m[0])) { out.push([m.index, m.index + m[0].length]); continue; }
    let i = m.index;
    for (const ch of m[0]) { out.push([i, i + ch.length]); i += ch.length; }
  }
  return out;
}

export function candidateTypes(text, deps = {}) {
  const t = String(text ?? ''), blocks = blocksOf(t), C = [];
  const add = (type, norm, units) => { const u = tidy(t, units); if (u.length >= 2) C.push({ type, norm, units: u }); };
  if (t.includes('\f')) { const pages = []; let at = 0; for (const p of t.split('\f')) { pages.push([at, at + p.length]); at += p.length + 1; } add('page', false, pages); }
  // a heading: a one-line block that does not end a sentence, followed by another block; its section runs to the next heading
  const heads = blocks.map((b, i) => (b.lines.length === 1 && i + 1 < blocks.length && !STERM.test(b.lines[0].t.trimEnd()) ? i : -1)).filter((i) => i >= 0);
  if (heads.length >= 2) add('heading', false, heads.map((h, k) => [blocks[h].s, k + 1 < heads.length ? blocks[heads[k + 1]].s - 1 : t.length]));
  add('block', false, blocks.map((b) => [b.s, b.e]));
  add('line', false, blocks.filter((b) => b.lines.length >= 2).flatMap((b) => b.lines.filter((l) => !blank(l)).map((l) => [l.s, l.e])));
  add('enumerated', false, runsOf(blocks, ENUM));
  add('bulleted', false, runsOf(blocks, BULLET));
  add('indented', false, blocks.flatMap((b) => { const out = []; let run = null; for (const l of b.lines) { if (/^[ \t]+\S/u.test(l.t)) { run = run ?? [l.s, l.e]; run[1] = l.e; } else if (run) { out.push(run); run = null; } } if (run) out.push(run); return out; }));
  const tb = tablesOf(blocks); add('row', false, tb.rows); add('cell', false, tb.cells);
  add('statement', false, statementsOf(t));
  if (deps.splitSentences) {
    const sents = deps.splitSentences(t, deps.abbreviations ? { abbreviations: deps.abbreviations } : {}).map((x) => (typeof x === 'string' ? { text: x, offset: t.indexOf(x) } : x));
    add('sentence', true, sents.map((x) => [x.offset, x.offset + x.text.length]));
    if (deps.clauseSpans) add('clause', true, sents.flatMap((x) => { try { return deps.clauseSpans(x.text).map((c) => [x.offset + c.start, x.offset + c.end]); } catch { return []; } }));
  }
  if (deps.scanPunctuation) {
    try { const sc = deps.scanPunctuation(t, { norms: deps.norms, abbreviations: deps.abbreviations }); add('container', true, (sc.structure?.containers ?? []).map((c) => [c.s, c.e])); } catch { /* no punctuation norms: no container type */ }
  }
  add('word', true, wordsOf(t));
  return C;
}

// ── (b) non-arbitrary, against a level-preserving null ──────────────────────────────────────────────────────────────────────────
const startsOf = (units) => units.map((u) => u[0]);
/** Internal boundaries of a type within its own extent: every unit start that another of its units precedes in the same run. */
function internalCuts(text, units) {
  const cuts = [];
  for (let i = 1; i < units.length; i++) if (/^\s*$/u.test(text.slice(units[i - 1][1], units[i][0]))) cuts.push(units[i][0]);
  return cuts;
}
const near = (text, a, b) => a === b || (a < b ? /^\s*$/u.test(text.slice(a, b)) : /^\s*$/u.test(text.slice(b, a)));
function includesAll(text, sorted, cuts) {   // every cut matches some boundary in `sorted`, white space apart
  let j = 0;
  for (const c of cuts) { while (j < sorted.length && sorted[j] < c && !near(text, sorted[j], c)) j++; if (j >= sorted.length || !near(text, sorted[j], c)) return false; }
  return true;
}
function extentOf(text, units) {   // the runs a type covers: consecutive units with only white space between them
  const runs = []; let cur = null;
  for (const u of units) { if (cur && /^\s*$/u.test(text.slice(cur[1], u[0]))) cur[1] = u[1]; else { if (cur) runs.push(cur); cur = [u[0], u[1]]; } }
  if (cur) runs.push(cur);
  return runs;
}
const choose = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) { r = (r * (n - k + i)) / i; if (r > 1e9) return Infinity; } return Math.round(r); };
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const tokensIn = (text, s, e) => { const w = text.slice(s, e).toLowerCase(); if (NOSPACE.test(w)) { const cs = [...w.replace(/\s+/gu, '')]; return new Set(cs.slice(1).map((c, i) => cs[i] + c)); } return new Set(w.match(WORD) ?? []); };
const jaccard = (a, b) => { if (!a.size && !b.size) return 1; let n = 0; for (const x of a) if (b.has(x)) n++; return n / (a.size + b.size - n); };
const catOf = (ch) => (!ch ? 'none' : /\p{Lu}/u.test(ch) ? 'Lu' : /\p{Ll}/u.test(ch) ? 'Ll' : /\p{L}/u.test(ch) ? 'L' : /\p{N}/u.test(ch) ? 'N' : /\p{P}/u.test(ch) ? 'P' : /\p{S}/u.test(ch) ? 'S' : 'other');
function shapeOf(text, s, e) {
  const lineStart = text.lastIndexOf('\n', s - 1) + 1, indent = text.slice(lineStart, s).match(/^[ \t]*/u)[0].length + (text.slice(s, e).match(/^[ \t]*/u)[0].length);
  const body = text.slice(s, e).trim();
  return [catOf(body[0]), indent === 0 ? 0 : indent < 4 ? 1 : indent < 8 ? 2 : 3, Math.floor(Math.log2(Math.max(1, body.length))), catOf(body.at(-1))];
}
const shapeSim = (a, b) => a.reduce((n, x, i) => n + (x === b[i] ? 1 : 0), 0) / a.length;

/** For one candidate, the finer level its cuts are drawn against: the coarsest admitted type, other than it, whose boundaries inside
 *  the candidate's extent include every one of the candidate's cuts and are more numerous. */
function finerFor(text, cand, cuts, admittedTypes) {
  const ext = extentOf(text, cand.units);
  const inExt = (b) => ext.some(([s, e]) => b > s && b < e);
  let best = null;
  for (const f of admittedTypes) {
    if (f.type === cand.type) continue;
    const fb = startsOf(f.units).filter(inExt);
    if (fb.length <= cuts.length || !includesAll(text, fb, cuts)) continue;
    if (!best || fb.length < best.bounds.length) best = { type: f.type, units: f.units, bounds: fb };
  }
  return best;
}

export function admitTypes(text, cands, deps = {}, { draws = DRAWS, alpha = ALPHA, seed = 20261024 } = {}) {
  const t = String(text ?? '');
  const admitted = new Set(cands.filter((c) => c.norm).map((c) => c.type));
  const tests = [];
  // layout types, finest first, each against the admitted types finer than it
  const layout = cands.filter((c) => !c.norm).sort((a, b) => b.units.length - a.units.length);
  // the finer level is drawn from the declared-norm levels (sentences, clauses, paired marks, words): a layout type's own
  // admission is settled only after the Holm step across all of them, so none can serve as another's finer level
  const norms = cands.filter((c) => c.norm);
  for (const cand of layout) {
    const cuts = internalCuts(t, cand.units);
    const fin = finerFor(t, cand, cuts, norms);
    const row = { type: cand.type, finer: fin?.type ?? null, k: cuts.length, n: fin?.bounds.length ?? 0, signals: {}, verdict: null };
    tests.push(row);
    if (!cuts.length) { row.verdict = 'unmeasured — no internal cut'; continue; }
    if (!fin) { row.verdict = 'unmeasured — no finer admitted level contains its cuts'; continue; }
    if (choose(fin.bounds.length, cuts.length) < MIN_PLACEMENTS) { row.verdict = 'unmeasured — too few units'; continue; }
    // per finer boundary: the finer unit before it and after it
    const fu = fin.units, at = new Map(fu.map((u, i) => [u[0], i]));
    const pairs = fin.bounds.map((b) => { const i = at.get(b); return i > 0 ? [fu[i - 1], fu[i]] : null; });
    const isCut = fin.bounds.map((b) => cuts.some((c) => near(t, b, c)));
    const scores = {};
    scores.lexical = pairs.map((p) => (p ? -jaccard(tokensIn(t, p[0][0], p[0][1]), tokensIn(t, p[1][0], p[1][1])) : null));   // higher = more separated
    scores.shape = pairs.map((p) => (p ? -shapeSim(shapeOf(t, p[0][0], p[0][1]), shapeOf(t, p[1][0], p[1][1])) : null));
    if (deps.gainsAt && deps.prime) {
      const g = deps.gainsAt(t, fin.bounds, { prime: deps.prime }).gains;
      scores.surprise = fin.bounds.map((b) => (g.has(b) ? g.get(b).gain : null));
    }
    const R = rng(seed);
    for (const [name, sc] of Object.entries(scores)) {
      const idx = sc.map((v, i) => (v == null ? -1 : i)).filter((i) => i >= 0);
      const cutIdx = idx.filter((i) => isCut[i]), k = cutIdx.length;
      if (!k || k === idx.length || choose(idx.length, k) < MIN_PLACEMENTS) { row.signals[name] = { stat: null, p: null, why: 'too few scored boundaries' }; continue; }
      const total = idx.reduce((a, i) => a + sc[i], 0);
      const stat = (sel) => { const s = sel.reduce((a, i) => a + sc[i], 0); return s / sel.length - (total - s) / (idx.length - sel.length); };
      const obs = stat(cutIdx);
      let ge = 0;
      for (let d = 0; d < draws; d++) {
        const pool = idx.slice();
        for (let i = 0; i < k; i++) { const j = i + Math.floor(R() * (pool.length - i)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
        if (stat(pool.slice(0, k)) >= obs) ge++;
      }
      row.signals[name] = { stat: +obs.toFixed(4), p: (1 + ge) / (1 + draws) };
    }
  }
  // Holm across every measured type × signal in this material
  const ps = tests.flatMap((r) => Object.entries(r.signals).filter(([, v]) => v.p != null).map(([s, v]) => ({ r, s, p: v.p })));
  ps.sort((a, b) => a.p - b.p);
  let stop = false;
  ps.forEach((x, i) => { const bar = alpha / (ps.length - i); x.r.signals[x.s].holm = +bar.toFixed(5); if (!stop && x.p <= bar) x.r.signals[x.s].pass = true; else stop = true; });
  for (const r of tests) if (!r.verdict) { const pass = Object.values(r.signals).some((v) => v.pass); r.verdict = pass ? 'admitted' : Object.values(r.signals).some((v) => v.p != null) ? 'rejected — no signal beat the null' : 'unmeasured — too few scored boundaries'; if (pass) admitted.add(r.type); }
  return { admitted, tests };
}

// ── (a) nesting, per tree; addresses ────────────────────────────────────────────────────────────────────────────────────────────
function crossShare(text, units, coarser) {
  const bounds = []; for (const [s, e] of coarser) bounds.push(s, e);
  bounds.sort((a, b) => a - b);
  let crossing = 0;
  for (const [s, e] of units) {
    let lo = 0, hi = bounds.length; while (lo < hi) { const m = (lo + hi) >> 1; if (bounds[m] <= s) lo = m + 1; else hi = m; }
    for (let j = lo; j < bounds.length && bounds[j] < e; j++) { const b = bounds[j]; if (b > s && b < e && !/^\s*$/u.test(text.slice(s, b)) && !/^\s*$/u.test(text.slice(b, e))) { crossing++; break; } }
  }
  return units.length ? crossing / units.length : 0;
}

export function buildTrees(text, cands, admitted) {
  const t = String(text ?? '');
  const types = cands.filter((c) => admitted.has(c.type));
  // two types that cut identically are one level: the first keeps the units, the other is named beside it
  const same = new Map();
  const key = (c) => c.units.map((u) => `${u[0]}-${u[1]}`).join(',');
  const kept = [];
  for (const c of types) { const k = key(c); if (same.has(k)) { same.get(k).also.push(c.type); continue; } const x = { ...c, also: [] }; same.set(k, x); kept.push(x); }
  // order of joining: types that cover the material (≥ 90% of its non-space characters) first, then partial ones; coarse before fine
  const solid = t.replace(/\s/gu, '').length || 1;
  const covers = (c) => extentOf(t, c.units).reduce((n, [s, e]) => n + t.slice(s, e).replace(/\s/gu, '').length, 0) / solid >= 0.9;
  for (const c of kept) c.full = covers(c);
  kept.sort((a, b) => (b.full - a.full) || a.units.length - b.units.length);
  const trees = [];
  const placement = [];
  for (const c of kept) {
    let tree = trees.find((tr) => tr.types.every((x) => crossShare(t, c.units, x.units) <= CROSS_MAX));
    const shares = trees.map((tr) => Math.max(0, ...tr.types.map((x) => crossShare(t, c.units, x.units))));
    if (!tree) { tree = { id: `T${trees.length + 1}`, types: [] }; trees.push(tree); }
    tree.types.push(c);
    placement.push({ type: c.type, also: c.also, tree: tree.id, crossShares: shares.map((v) => +v.toFixed(3)) });
  }
  // renumber trees by size: T1 the tree with the most units
  trees.sort((a, b) => b.types.reduce((n, x) => n + x.units.length, 0) - a.types.reduce((n, x) => n + x.units.length, 0));
  const rename = new Map(trees.map((tr, i) => [tr.id, `T${i + 1}`]));
  for (const tr of trees) tr.id = rename.get(tr.id);
  for (const p of placement) p.tree = rename.get(p.tree);
  // address every unit: its parent is the smallest unit of a coarser type in the same tree that contains it
  for (const tr of trees) {
    const all = [];
    tr.types.forEach((x, depth) => x.units.forEach(([s, e]) => all.push({ s, e, type: x.type, also: x.also, rank: depth })));
    all.sort((a, b) => a.s - b.s || a.rank - b.rank);
    const stack = [];
    const kids = new Map([['/', 0]]);
    for (const u of all) {
      while (stack.length && !(stack.at(-1).s <= u.s && u.e <= stack.at(-1).e && stack.at(-1).rank < u.rank)) stack.pop();
      const parent = stack.at(-1) ?? null, pa = parent ? parent.path : '/';
      const n = (kids.get(pa) ?? 0) + 1; kids.set(pa, n);
      u.path = pa === '/' ? `/${n}` : `${pa}/${n}`; kids.set(u.path, 0);
      u.addr = `${tr.id}:${u.path}`; u.parent = parent ? parent.addr : `${tr.id}:/`;
      stack.push(u);
    }
    tr.units = all.map(({ s, e, type, also, addr, parent }) => ({ addr, s, e, type, ...(also.length ? { also } : {}), parent }));
  }
  return { trees: trees.map((tr) => ({ id: tr.id, types: tr.types.map((x) => x.type), units: tr.units })), placement };
}

export function findUnits(text, deps = {}, opts = {}) {
  const cands = candidateTypes(text, deps);
  const { admitted, tests } = admitTypes(text, cands, deps, opts);
  const { trees, placement } = buildTrees(text, cands, admitted);
  const levels = cands.filter((c) => admitted.has(c.type)).map((c) => ({ type: c.type, norm: c.norm, units: c.units.length, boundaries: c.units.map((u) => u[0]).filter((b) => b > 0), tree: placement.find((p) => p.type === c.type || p.also.includes(c.type))?.tree ?? null }));
  return { trees, levels, evidence: { candidates: cands.map((c) => ({ type: c.type, norm: c.norm, units: c.units.length })), tests, placement } };
}
