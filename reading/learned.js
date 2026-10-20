// learned.js — LITTLE PROGRAMS OF RULES, learned from measurement and kept as priors. A program is data: a short list of typed rules, each with
// the number of observations behind it and whether it survived a held-out test. Like every prior here it TILTS a reading and never writes it:
// a rule retypes a field it recognises (and says which rule did), and offers a repair for a value the recogniser garbled (the value stays as read).
//
//   key     a label (canonical, any script) → the format its value takes                       Alhazen learnFrom's own rule type
//   alias   how a label comes out of the recogniser ("Facture n°" → "facture n"), → its canonical label
//   repair  within one value format, a character the recogniser confuses for another (O→0 in an amount), with the count
// The machinery is the suite's: Alhazen's learnFrom/createRuleLedger (rules, falsification), valueFormat; the similarity is prior-tilt's.
import { similarity } from './prior-tilt.js';
import { shapeOf } from './shapes.js';

/** A label's canonical form: letters and digits in any script, accents folded, lowercase, one underscore between runs. */
export const canon = (s) => String(s ?? '').normalize('NFKD').replace(/\p{M}+/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '');
const alnum = (s) => String(s ?? '').normalize('NFKD').replace(/\p{M}+/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

/** One document's observation: each truth field, and the read field that holds its value (if any). */
export function observe(readFields, truthFields, { page = null } = {}) {
  const pool = readFields.filter((f) => page == null || f.page === page), used = new Set(), bound = [];
  for (const tf of truthFields) {
    let best = null, bs = 0;
    for (const f of pool) { if (used.has(f)) continue; const s = Math.max(similarity(alnum(f.value), alnum(tf.value)), alnum(f.value).includes(alnum(tf.value)) && alnum(tf.value).length >= 4 ? 0.85 : 0); if (s > bs) { bs = s; best = f; } }
    if (best && bs >= 0.6) { used.add(best); bound.push({ truth: tf, read: best, valueSim: +bs.toFixed(2), labelSim: +similarity(canon(best.label), canon(tf.label)).toFixed(2) }); } else bound.push({ truth: tf, read: null });
  }
  return { bound, readFields: pool.length };
}

/** Learn a program from observations. minSupport: how many times a rule must be seen. */
export function learn(observations, { minSupport = 2 } = {}) {
  const key = new Map(), alias = new Map(), repair = new Map();
  for (const ob of observations) for (const b of ob.bound) {
    const c = canon(b.truth.label), fmt = shapeOf(b.truth.value);
    const k = key.get(c) || key.set(c, { canonical: c, formats: new Map(), n: 0 }).get(c); k.n++; k.formats.set(fmt, (k.formats.get(fmt) || 0) + 1);
    if (!b.read) continue;
    const rl = canon(b.read.label); if (rl && rl !== c && b.labelSim >= 0.5) { const a = alias.get(rl + '>' + c) || alias.set(rl + '>' + c, { from: rl, to: c, n: 0 }).get(rl + '>' + c); a.n++; }
    // character repairs: same length, exact positions that differ, in a value whose TRUTH is amount/date/id/phone
    const rv = alnum(b.read.value), tv = alnum(b.truth.value);
    if (rv !== tv && rv.length === tv.length && /^(amount|date|id-number|phone)$/.test(fmt)) for (let i = 0; i < rv.length; i++) if (rv[i] !== tv[i]) { const r = fmt + ':' + rv[i] + '>' + tv[i], e = repair.get(r) || repair.set(r, { format: fmt, from: rv[i], to: tv[i], n: 0 }).get(r); e.n++; }
  }
  const rules = [];
  for (const k of key.values()) { const [format, c] = [...k.formats.entries()].sort((a, b) => b[1] - a[1])[0]; if (k.n >= minSupport && c / k.n >= 0.6) rules.push({ type: 'key', canonical: k.canonical, valueType: format, n: k.n }); }
  for (const a of alias.values()) if (a.n >= minSupport) rules.push({ type: 'alias', from: a.from, to: a.to, n: a.n });
  for (const e of repair.values()) if (e.n >= minSupport) rules.push({ type: 'repair', format: e.format, from: e.from, to: e.to, n: e.n });
  return rules;
}

/** Apply a program to read fields: retype, and offer repairs. Returns new fields; values are never changed. */
export function apply(fields, rules) {
  const keys = new Map(rules.filter((r) => r.type === 'key' && !r.falsified).map((r) => [r.canonical, r])), al = new Map(rules.filter((r) => r.type === 'alias' && !r.falsified).map((r) => [r.from, r.to]));
  const reps = rules.filter((r) => r.type === 'repair' && !r.falsified);
  return fields.map((f) => {
    let c = canon(f.label), via = null; if (al.has(c)) { via = { type: 'alias', from: c, to: al.get(c) }; c = al.get(c); }
    const k = keys.get(c), out = { ...f }; if (via || k) out.learned = { canonical: c, ...(via ? { alias: via } : {}) };
    if (k && (f.format === 'text' || !f.format || f.format === 'free-text')) { out.format = k.valueType; out.learned.retyped = { from: f.format || 'text', to: k.valueType, n: k.n }; }
    const fmt = k ? k.valueType : f.format, offers = [];
    for (const r of reps) if (r.format === fmt) { const v = alnum(f.value); if (v.includes(r.from)) { const fixed = f.value.replace(new RegExp(r.from, 'i'), r.to); if (fixed !== f.value) offers.push({ value: fixed, rule: `${r.from}→${r.to} in ${r.format}`, n: r.n }); } }
    if (offers.length) out.learned = { ...(out.learned || { canonical: c }), repairs: offers.slice(0, 3) };
    return out;
  });
}

/** How well a program does on observations: bound-with-right-label, format right, repairs that would make the value exact. */
export function score(rules, observations, readOf) {
  let n = 0, labelOk = 0, fmtOk = 0, fixes = 0, wrongFixes = 0;
  for (const ob of observations) { const applied = apply(ob.bound.filter((b) => b.read).map((b) => b.read), rules); ob.bound.filter((b) => b.read).forEach((b, i) => { const f = applied[i]; n++; const c = f.learned ? f.learned.canonical : canon(f.label); if (c === canon(b.truth.label)) labelOk++; if (f.format === shapeOf(b.truth.value)) fmtOk++; if (f.learned && f.learned.repairs) { if (f.learned.repairs.some((o) => alnum(o.value) === alnum(b.truth.value))) fixes++; else wrongFixes++; } }); }
  return { bound: n, labelOk, fmtOk, labelAcc: n ? +(labelOk / n).toFixed(3) : null, fmtAcc: n ? +(fmtOk / n).toFixed(3) : null, fixes, wrongFixes };
}

/** The programs shipped with the page (learned-priors/index.json). Returns { programs, structure, rules } — structure only when a program adopted it. */
export async function loadPrograms(base, fetchImpl = (...a) => fetch(...a)) {
  let idx = null; try { idx = await (await fetchImpl(new URL('learned-priors/index.json', base))).json(); } catch (e) { return { programs: [], structure: null, rules: [] }; }
  const programs = []; for (const f of idx.programs || []) { try { programs.push({ file: f, ...(await (await fetchImpl(new URL(`learned-priors/${f}`, base))).json()) }); } catch (e) { /* a program that cannot be read is skipped, never guessed */ } }
  const adopted = programs.find((p) => p.structure && p.structure.adopted);
  return { programs, structure: adopted ? { ...adopted.structure.learned.rules, from: adopted.file, heldOut: adopted.structure.learned.heldOut, default: adopted.structure.default.heldOut } : null, rules: programs.flatMap((p) => (p.rules || []).filter((r) => !r.falsified)) };
}
