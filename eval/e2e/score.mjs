// score.mjs — scores the RAW arm outputs (eval/e2e/raw/<arm>.json) against GOLD-E2E-0.json by the rules of PREREG-E2E-0.md. Writes nothing but stdout
// (RESULT-E2E-0.md is written from that output). Usage: node eval/e2e/score.mjs [--json]
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const gold = JSON.parse(fs.readFileSync(path.join(here, 'GOLD-E2E-0.json'), 'utf8'));
const ARMS = ['ref', 'base', 'cast', 'binder', 'both', 'shuffle'];
const raw = {}; for (const a of ARMS) { const f = path.join(here, 'raw', a + '.json'); raw[a] = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; }
const norm = (t) => String(t).replace(/\s+/g, ' ').trim();
const toks = (s) => String(s).toLowerCase().replace(/(\d),(?=\d)/g, '$1').match(/\d+(?:\.\d+)?|[a-z]+/g) || [];
const isGoldStatement = (it, p) => { if (!p) return false; const t = norm(p.text); return it.gold.some((g) => (p.docs || []).includes(g.doc) && (t.includes(norm(g.contains)) || (t.length >= 20 && norm(g.contains).includes(t)))); };
const isGoldFigure = (it, c) => { if (!it.figs.length) return null; if (!c) return false; const T = new Set(toks(c.label)); return it.figs.some((alt) => alt.every((x) => T.has(x))); };
const score = (arm) => { const R = raw[arm]; if (!R) return null; const by = {}; R.results.forEach((r) => { by[r.id] = r; });
  return gold.items.map((it) => { const r = by[it.id]; const p = r && r.passages[0], c = r && r.cands[0]; const S = isGoldStatement(it, p), F = isGoldFigure(it, c); return { id: it.id, stratum: it.stratum, S, F, SF: S && (F === null ? true : F), top: p ? norm(p.text).slice(0, 110) : null, fig: c ? c.label : null, figMode: r ? r.candTitle.slice(0, 22) : null }; }); };
const sc = {}; for (const a of ARMS) sc[a] = score(a);
const count = (arm, f) => (sc[arm] ? sc[arm].filter(f).length : null);
const sum = {}; for (const a of ARMS) if (sc[a]) sum[a] = { all_SF: count(a, (x) => x.SF), all_S: count(a, (x) => x.S), PD_SF: count(a, (x) => x.stratum === 'PD' && x.SF), N_SF: count(a, (x) => x.stratum === 'N' && x.SF), n: sc[a].length, PD_n: sc[a].filter((x) => x.stratum === 'PD').length };
const verdict = {};
if (sc.base && sc.both) {
  const lost = sc.base.filter((x, i) => x.SF && !sc.both[i].SF).map((x) => x.id), won = sc.base.filter((x, i) => !x.SF && sc.both[i].SF).map((x) => x.id);
  verdict.B1_no_regression = { lost, pass: lost.length === 0 }; verdict.won = won;
  const baseFailPD = sc.base.filter((x) => x.stratum === 'PD' && !x.SF).length, bindings = raw.both.statementsWithBinding;
  const untest = []; if (bindings === 0) untest.push('U2: the binder bound no statement in any document'); if (baseFailPD < 2) untest.push('U3: base fails fewer than 2 PD questions (ceiling)');
  const gain = sum.both.PD_SF - sum.base.PD_SF; verdict.B2_gain = { base_PD: sum.base.PD_SF, both_PD: sum.both.PD_SF, gain, pass: gain >= 2, untestable: untest };
  if (sc.shuffle) { const g2 = sum.both.PD_SF - sum.shuffle.PD_SF; verdict.B3_control = { both_PD: sum.both.PD_SF, shuffle_PD: sum.shuffle.PD_SF, margin: g2, pass: g2 >= 2 }; } else verdict.B3_control = { missing: true };
}
if (raw.ref && raw.base) { const a = JSON.stringify(raw.ref.results), b = JSON.stringify(raw.base.results); verdict.U5_off_unchanged = { identical: a === b, statements_ref: raw.ref.statements, statements_base: raw.base.statements }; }
const out = { summary: sum, verdict, rawFacts: Object.fromEntries(ARMS.filter((a) => raw[a]).map((a) => [a, { switches: raw[a].switches, statements: raw[a].statements, masterReads: raw[a].masterReads, statementsWithBinding: raw[a].statementsWithBinding, statementsWithTypedGap: raw[a].statementsWithTypedGap, gapsByReason: raw[a].gapsByReason, ms: raw[a].ms }])), perQuestion: sc };
if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 1));
else { console.log(JSON.stringify({ summary: sum, verdict, rawFacts: out.rawFacts }, null, 1)); for (const it of gold.items) { const row = ARMS.filter((a) => sc[a]).map((a) => { const x = sc[a].find((y) => y.id === it.id); return a + ':' + (x.SF ? 'SF' : x.S ? 'S-' : '--'); }).join(' '); console.log(it.id.padEnd(4), it.stratum, row, '|', it.q); } }
