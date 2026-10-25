// run-units.mjs — B1 to B4 of the reading-holarchy pre-registration (PLAN.md §7): the unit-tree finder against the references.
//
//   node reading/eval/holarchy/run-units.mjs <holarchy-material dir> <out.json> [--draws 1000]
//
// Every document is read with the same organs the page hands the finder: the sentence splitter with the page's abbreviation
// knowledge (the language's measured prior, the text's own, and the aliases the hyperlexicon's local giver resolves), the
// punctuation scan with its declared norms, clause spans, and the surprise test against the register prime. Scoring follows §7:
// a found boundary matches a reference boundary when only white space lies between them, each at most once; offset 0 is left out;
// reference levels with identical sets are one; each reference level is matched to one found level, best F1 first.

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { homedir } from 'node:os';

// file: URLs for the organs that read their priors by URL (punctuation norms, surprise primes, register prior)
const realFetch = globalThis.fetch;
globalThis.fetch = async (u, o) => {
  const url = String(u);
  if (!url.startsWith('file:')) return realFetch(u, o);
  try { const body = readFileSync(fileURLToPath(url)); return new Response(body, { status: 200 }); } catch { return new Response('', { status: 404 }); }
};

const here = dirname(fileURLToPath(import.meta.url)), repo = join(here, '..', '..', '..');
const imp = (p) => import(pathToFileURL(join(repo, p)).href);
const { findUnits } = await imp('reading/unit-tree.js');
const { splitSentences, deriveAbbreviations } = await imp('vendor/khora/native/adapters/text/spans.js');
const { clauseSpans } = await imp('vendor/khora/native/adapters/text/clause-spans.js');
const { scanPunctuation, loadPunctuation } = await imp('reading/punctuation.js');
const { primeFor, gainsAt } = await imp('reading/sections.js');
const { makeLexicon, aliasJunctions, resolveAliases } = await imp('reading/lexicon.js');

const [, , matDir, outPath, ...rest] = process.argv;
if (!matDir || !outPath) { console.error('usage: node run-units.mjs <holarchy-material dir> <out.json> [--draws N]'); process.exit(2); }
const draws = Number(rest[rest.indexOf('--draws') + 1]) || 1000;

// the hyperlexicon's local giver, read directly (the page reads the same pack through the server)
const PACK = process.env.WIKTIONARY_PACK || join(homedir(), '.cache/live_priors/wiktionary/wiktionary-slim-2026-10-01-v3.pack');
const READER = process.env.WIKTIONARY_READER || [join(repo, '..', 'Zenodotus/scripts/wiktionary/lookup.mjs'), join(homedir(), 'Downloads/workspace/Zenodotus/scripts/wiktionary/lookup.mjs')].find((p) => existsSync(p)) || '';
let dict = null;
if (existsSync(PACK) && existsSync(READER)) { const { Dictionary } = await import(pathToFileURL(READER).href); dict = new Dictionary({ pack: PACK, learned: '/dev/null', changed: '/dev/null', delta: '/dev/null' }); }
const lexicon = makeLexicon({ ask: async (forms) => (dict ? { giver: { name: 'English Wiktionary', pack: PACK.split('/').pop() }, results: Object.fromEntries(forms.map((f) => { const r = dict.resolve(f, { learn: false }); const en = r?.found ? (r.entries || []).filter((e) => e.c === 'en') : []; return [f, en.length ? en.map((e) => ({ w: e.w, pos: e.p, senses: (e.s || []).map((x) => ({ of: x.of ?? null, tags: x.tags ?? [], gloss: null })) })) : null]; })) } : null) });

const base = pathToFileURL(join(repo, 'reading') + '/');
const P = await loadPunctuation(base, 'en');

async function depsFor(text) {
  const known = new Set([...P.abbreviations, ...deriveAbbreviations(text)].map((a) => String(a).toLowerCase()));
  const junc = aliasJunctions(text, known);
  await lexicon.want(junc.keys());
  const aliases = resolveAliases(lexicon, junc, text).filter((a) => a.kept);
  for (const a of aliases) known.add(a.form.slice(0, -1).toLowerCase());
  const abbreviations = new Set([...known].flatMap((a) => [a, a.charAt(0).toUpperCase() + a.slice(1), a.toUpperCase()]));
  let prime = null; try { prime = (await primeFor(text, { base })).prime; } catch { prime = null; }
  return { deps: { splitSentences, abbreviations, scanPunctuation, norms: P.norms, clauseSpans, gainsAt, prime }, aliases: aliases.map((a) => a.form), prime: !!prime };
}

// ── scoring ──
const onlyWs = (t, a, b) => /^\s*$/u.test(t.slice(Math.min(a, b), Math.max(a, b)));
function f1(text, ref, found) {
  const R = [...new Set(ref)].filter((b) => b > 0 && !onlyWs(text, 0, b)).sort((a, b) => a - b);
  const F = [...new Set(found)].filter((b) => b > 0 && !onlyWs(text, 0, b)).sort((a, b) => a - b);
  let i = 0, j = 0, hit = 0;
  while (i < R.length && j < F.length) { if (onlyWs(text, R[i], F[j])) { hit++; i++; j++; } else if (R[i] < F[j]) i++; else j++; }
  const p = F.length ? hit / F.length : 0, r = R.length ? hit / R.length : 0;
  return { f1: p + r ? (2 * p * r) / (p + r) : 0, p, r, ref: R.length, found: F.length, hit };
}
function matchLevels(text, refs, levels) {
  // identical reference sets are one level
  const seen = new Map(); const R = [];
  for (const [name, set] of Object.entries(refs)) { const k = [...set].sort((a, b) => a - b).join(','); if (seen.has(k)) { seen.get(k).names.push(name); continue; } const x = { names: [name], set }; seen.set(k, x); R.push(x); }
  const pairs = [];
  R.forEach((r, ri) => levels.forEach((l, li) => pairs.push({ ri, li, ...f1(text, r.set, l.boundaries) })));
  pairs.sort((a, b) => b.f1 - a.f1);
  const usedR = new Set(), usedL = new Set(), out = {};
  for (const p of pairs) { if (usedR.has(p.ri) || usedL.has(p.li)) continue; usedR.add(p.ri); usedL.add(p.li); for (const n of R[p.ri].names) out[n] = { ...p, found: levels[p.li].type, tree: levels[p.li].tree }; }
  R.forEach((r, ri) => { if (!usedR.has(ri)) for (const n of r.names) out[n] = { f1: 0, found: null }; });
  return out;
}
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

const read = (dir, id) => ({ text: readFileSync(join(dir, `${id}.txt`), 'utf8'), truth: JSON.parse(readFileSync(join(dir, `${id}.truth.json`), 'utf8')) });
const ids = (dir) => readdirSync(dir).filter((f) => f.endsWith('.txt')).map((f) => f.slice(0, -4)).sort();
const out = { schema: 'HolarchyUnitsRun@1', at: new Date().toISOString(), draws, hyperlexicon: dict ? PACK.split('/').pop() : null, docs: {} };

async function run(set, dir, refOf) {
  for (const id of ids(dir)) {
    const { text, truth } = read(dir, id);
    const t0 = Date.now();
    const { deps, aliases, prime } = await depsFor(text);
    const r = findUnits(text, deps, { draws });
    const refs = refOf(truth);
    const scored = matchLevels(text, refs, r.levels);
    out.docs[id] = { set, ms: Date.now() - t0, aliases, prime, levels: r.levels.map((l) => ({ type: l.type, norm: l.norm, units: l.units, tree: l.tree })), tests: r.evidence.tests, placement: r.evidence.placement, scored };
    process.stdout.write(`${id} ${Date.now() - t0}ms  ${Object.entries(scored).map(([k, v]) => `${k}=${v.f1.toFixed(2)}${v.found ? `(${v.found})` : ''}`).join(' ')}\n`);
  }
}
const union = (...xs) => [...new Set(xs.flat().filter((x) => x != null))];
await run('M3-known', join(matDir, 'm3/known'), (t) => Object.fromEntries(Object.entries({
  section: t.section, paragraph: union(t.paragraph, t.heading), sentence: t.sentence, item: t.item, row: t.row, cell: t.cell, 'quote line': t.qline, 'code line': t.cline,
}).filter(([, v]) => v && v.length)));
await run('M3-flat', join(matDir, 'm3/flat'), (t) => ({ sentence: t.sentence }));
await run('M2', join(matDir, 'm2'), (t) => Object.fromEntries(Object.entries({ heading: t.heading, paragraph: t.block, row: t.row, cell: t.cell, line: t.line }).filter(([, v]) => v && v.length)));
await run('M5', join(matDir, 'm5'), (t) => Object.fromEntries(Object.entries({ statement: t.stmt, block: t.block, row: t.row, cell: t.cell }).filter(([, v]) => v && v.length)));

// ── the bars ──
const docs = Object.entries(out.docs);
const of = (set) => docs.filter(([, d]) => d.set === set);
const B1levels = of('M3-known').flatMap(([, d]) => Object.values(d.scored).map((v) => v.f1));
const B1perLevel = {};
for (const [, d] of of('M3-known')) for (const [k, v] of Object.entries(d.scored)) (B1perLevel[k] ??= []).push(v.f1);
const invented = of('M3-flat').filter(([, d]) => d.levels.some((l) => !l.norm));
const m2 = of('M2'), b3 = (lvl) => mean(m2.filter(([, d]) => d.scored[lvl]).map(([, d]) => d.scored[lvl].f1));
const table = out.docs['m2-06-data-table'];
const code = of('M5').filter(([id]) => id.startsWith('m5-code'));
const csv = out.docs['m5-csv-numbers-saved'];
const fx = (v) => (v == null ? null : +v.toFixed(4));
out.bars = {
  B1: { bar: 'macro F1 >= 0.90 over levels and documents', value: fx(mean(B1levels)), pass: (mean(B1levels) ?? 0) >= 0.9, perLevel: Object.fromEntries(Object.entries(B1perLevel).map(([k, v]) => [k, { n: v.length, meanF1: fx(mean(v)) }])) },
  B2: { bar: 'at least 19 of 20 run-together controls admit no level above the sentence', value: `${20 - invented.length} of 20`, pass: invented.length <= 1, invented: invented.map(([id, d]) => [id, d.levels.filter((l) => !l.norm).map((l) => l.type)]) },
  B3: { bar: 'heading and paragraph F1 >= 0.85 each (macro over readings); table rows and cells >= 0.90', heading: fx(b3('heading')), paragraph: fx(b3('paragraph')), tableRow: table?.scored.row?.f1 ?? null, tableCell: table?.scored.cell?.f1 ?? null, line: fx(b3('line')) },
  B4: { bar: 'statement F1 >= 0.85 on each code file; CSV rows and cells >= 0.90; M4 not run', statements: Object.fromEntries(code.map(([id, d]) => [id, +(d.scored.statement?.f1 ?? 0).toFixed(4)])), csvRow: csv?.scored.row?.f1 ?? null, csvCell: csv?.scored.cell?.f1 ?? null, crossScript: 'not run — M4 waits on the user’s yes to download' },
};
out.bars.B3.pass = (out.bars.B3.heading ?? 0) >= 0.85 && (out.bars.B3.paragraph ?? 0) >= 0.85 && (out.bars.B3.tableRow ?? 0) >= 0.9 && (out.bars.B3.tableCell ?? 0) >= 0.9;
out.bars.B4.pass = Object.values(out.bars.B4.statements).every((v) => v >= 0.85) && (out.bars.B4.csvRow ?? 0) >= 0.9 && (out.bars.B4.csvCell ?? 0) >= 0.9;
writeFileSync(outPath, JSON.stringify(out, null, 1));
console.log('\n' + JSON.stringify(out.bars, null, 1));
