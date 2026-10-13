// holodeck-referents.js — the person's hand on referent identity: SYN, SEG, CON.
//
// analyze() folds surfaces into referents from the source's own evidence (stated
// aliases, links, containment, declension). It never guesses from spelling, so a
// typo ("Jonh Smith") stays its own referent. This module is where a person says
// otherwise, and where the surface offers what to say:
//
//   SYN  these referents are one being — merge them under one name. A merge into
//        a name nobody uses yet is a rename, so a typo fix is a SYN.
//   SEG  this spelling is NOT the referent it was folded into — cut it out.
//   CON  these two referents are tied (a declared relation, not identity).
//
// Edits live in the workspace's corrections log (append-only, retract/restore),
// and are applied after every analysis, so they hold retroactively and forward.
//
// Suggestions are spelling variants: names within two edits of each other once
// case, accents and punctuation are folded (a one-deletion neighbourhood, so it
// stays fast on thousands of names). Each carries the workspace's own null — how
// many other pairs of names here sit closer — as evidence, not a gate. A pair is
// pre-ticked only on the typo signature: the rarer spelling folds into one read
// more often. Two
// spellings read together in one statement are a witness that they are two
// things, so such pairs are kept but marked and ranked last.
//
// Pure: no DOM, no storage. A is analyze()'s output, mutated in place by applyEdits.

export const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[.'’`,-]/g, '').replace(/\s+/g, ' ').trim();

// optimal-string-alignment distance (Damerau: adjacent swaps cost one)
export function osa(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let p2 = null, p1 = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const c = [i];
    for (let j = 1; j <= n; j++) {
      let v = Math.min(p1[j] + 1, c[j - 1] + 1, p1[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (p2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, p2[j - 2] + 1);
      c.push(v);
    }
    p2 = p1; p1 = c;
  }
  return p1[n];
}

const rel = (a, b) => osa(a, b) / Math.max(a.length, b.length, 1);

// deterministic PRNG so the null is the same on every render
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e9) / 1e9; }; }

/** The workspace's own null: relative distance between pairs of names of similar length,
 *  exhaustive when the workspace is small, sampled when large. Returns { ds (sorted), floor
 *  (1st percentile), sample, p(r) = share of pairs strictly closer than r }. */
export function nameNull(keys, { draws = 4000, seed = 7 } = {}) {
  const ds = []; const near = (a, b) => Math.abs(a.length - b.length) <= 1 && a !== b;
  const total = keys.length * (keys.length - 1) / 2;
  if (total <= draws) { for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) if (near(keys[i], keys[j])) ds.push(rel(keys[i], keys[j])); }
  else {
    const byLen = new Map(); keys.forEach(k => { const L = k.length; (byLen.get(L) || byLen.set(L, []).get(L)).push(k); });
    const R = rng(seed);
    for (let t = 0; t < draws * 3 && ds.length < draws; t++) {
      const a = keys[Math.floor(R() * keys.length)];
      const pool = [-1, 0, 1].flatMap(d => byLen.get(a.length + d) || []);
      const b = pool[Math.floor(R() * pool.length)]; if (b && near(a, b)) ds.push(rel(a, b));
    }
  }
  ds.sort((x, y) => x - y);
  const p = r => { let lo = 0, hi = ds.length; while (lo < hi) { const m = (lo + hi) >> 1; if (ds[m] < r) lo = m + 1; else hi = m; } return ds.length ? lo / ds.length : 1; };
  return { ds, floor: ds.length ? ds[Math.floor(ds.length * 0.01)] : 0, sample: ds.length, p };
}

function deletes(k) { const out = new Set([k]); for (let i = 0; i < k.length; i++) out.add(k.slice(0, i) + k.slice(i + 1)); return out; }

// ── WITNESSES ────────────────────────────────────────────────────────────────
// A near spelling is a question, not an answer: "Iran"/"Iraq" and "Jonh"/"John" are
// both one letter apart. Several small independent witnesses read each pair, and
// each says FOR (one name, misspelled), AGAINST (two names), or nothing:
//   shape     is the edit typo-shaped? swapped letters, a doubled or dropped
//             double, a dropped letter, a neighbouring key, the same sound, an OCR confusion, or
//             only a vowel — versus an unrelated letter swapped in (silent).
//   rarity    the odd word occurs nowhere else in the workspace's text while its
//             partner recurs (FOR, and it sets the direction); both recur (AGAINST:
//             two established spellings).
//   context   the two share company — other names and topic words in their
//             statements — more than the workspace's own null of name pairs gives.
//   kind      typed as different kinds of thing (person vs place) — AGAINST.
//   together  both spellings read in one statement — AGAINST: a writer rarely
//             puts a name beside its own misspelling.
//   case      differs only in case, accents or punctuation — FOR.
// SCOPE, declared: shape reads a QWERTY keyboard and English sound rules, and
// rarity counts Latin-letter words; on another script or keyboard they say
// nothing (a gap, never a guess), so such pairs rest on context, kind and together.
// Verdict: likely (FOR speaks, nothing AGAINST), contested (both), doubtful (only
// AGAINST), open (nobody FOR). Only "likely" is pre-ticked; every witness is shown.

const KEYS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const KPOS = {}; KEYS.forEach((r, y) => [...r].forEach((c, x) => { KPOS[c] = [x + y * 0.5, y]; }));
const adjacentKey = (c, d) => { const p = KPOS[c], q = KPOS[d]; return !!(p && q) && Math.abs(p[0] - q[0]) <= 1 && Math.abs(p[1] - q[1]) <= 1 && c !== d; };
// how a word sounds, crudely and for English-script names: soft c, ck, ph, y-as-i, z-as-s, doubled letters collapsed
const sound = w => w.replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/c(?=[eiy])/g, 's').replace(/c/g, 'k').replace(/q/g, 'k').replace(/z/g, 's').replace(/y/g, 'i').replace(/(.)\1+/g, '$1');
const ocr = w => w.replace(/rn/g, 'm').replace(/cl/g, 'd').replace(/vv/g, 'w').replace(/[1|!]/g, 'l').replace(/0/g, 'o').replace(/5/g, 's').replace(/8/g, 'b');
const skeleton = w => w[0] + w.slice(1).replace(/[aeiouy]/g, '');

/** What kind of edit turns one word into the other — typo-shaped, or not. Returns a phrase or null. */
export function editShape(x, y) {
  if (x === y) return null;
  if (x.length === y.length) {
    const diff = []; for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) diff.push(i);
    if (diff.length === 2 && diff[1] === diff[0] + 1 && x[diff[0]] === y[diff[1]] && x[diff[1]] === y[diff[0]]) return 'two letters swapped';
    if (diff.length === 1 && adjacentKey(x[diff[0]], y[diff[0]])) return 'a neighbouring key (' + x[diff[0]] + '/' + y[diff[0]] + ')';
  }
  if (x.replace(/(.)\1+/g, '$1') === y.replace(/(.)\1+/g, '$1')) return 'a doubled letter';
  if (sound(x) === sound(y)) return 'sounds the same';
  if (ocr(x) === ocr(y)) return 'a scanning confusion (rn/m, l/1, 0/o)';
  if (x.length > 2 && skeleton(x) === skeleton(y)) return 'only a vowel differs';
  // one letter dropped (or added) past the first: the other word with one letter left out
  { const [lo, hi] = x.length < y.length ? [x, y] : [y, x];
    if (hi.length === lo.length + 1 && hi[0] === lo[0]) for (let i = 1; i < hi.length; i++) if (hi.slice(0, i) + hi.slice(i + 1) === lo) return 'a letter dropped (' + hi[i] + ')'; }
  return null;
}

// the one differing word between two names of the same word count (null when more than one differs)
function oddWords(a, b) {
  const ta = a.split(' '), tb = b.split(' ');
  if (ta.length !== tb.length) return [a.replace(/ /g, ''), b.replace(/ /g, '')];
  const d = ta.map((t, i) => [t, tb[i]]).filter(([x, y]) => x !== y);
  return d.length === 1 ? d[0] : null;
}

const jac = (A, B) => { if (!A.size || !B.size) return 0; let i = 0; A.forEach(x => { if (B.has(x)) i++; }); return i / (A.size + B.size - i); };

/** suggestions(A) -> { pairs, sample, capped }. Each pair:
 *  { from, to, fromN, toN, d, kind, why, together, witnesses: [{ who, says: 'for'|'against', why }], verdict, likely }.
 *  `from` folds into `to`; the direction follows rarity when it speaks, else mentions. */
export function suggestions(A, { skip = new Set() } = {}) {
  const names = Object.values((A && A.names) || {});
  const N = n => (n.sts || []).length;
  const rows = names.map(n => ({ name: n.name, k: fold(n.name), n: N(n), type: n.type })).filter(r => r.k.length >= 2);
  const { sample, p } = nameNull(rows.map(r => r.k));
  const byId = (A && A.byId) || {};
  // the workspace's own word counts (folded), over every statement's text
  const wc = new Map(); (A.sts || []).forEach(st => fold(st.text).split(/[^a-z0-9]+/).forEach(w => { if (w) wc.set(w, (wc.get(w) || 0) + 1); }));
  // each name's company: the other names and topic words of its statements
  const ctx = new Map(names.map(n => { const c = new Set(); (n.sts || []).forEach(id => { const st = byId[id]; if (!st) return; (st.names || []).forEach(x => { if (x !== n.name) c.add('n:' + x); }); (st.topics || []).forEach(t => c.add('t:' + t)); }); return [n.name, c]; }));
  // the context null: how much company two names drawn at random from this workspace share
  const ctxNull = (() => { const R = rng(11); const live = names.filter(n => ctx.get(n.name).size); const ds = [];
    for (let t = 0; t < 2000 && live.length > 2; t++) { const x = live[Math.floor(R() * live.length)], y = live[Math.floor(R() * live.length)]; if (x !== y) ds.push(jac(ctx.get(x.name), ctx.get(y.name))); }
    ds.sort((x, y) => x - y); return { ds, top: ds.length ? ds[Math.floor(ds.length * 0.99)] : 1 }; })();
  const bucket = new Map();
  rows.forEach((r, i) => deletes(r.k).forEach(d => { (bucket.get(d) || bucket.set(d, []).get(d)).push(i); }));
  const seen = new Set(); const pairs = []; let capped = 0, kept = 0;
  const stsOf = new Map(names.map(n => [n.name, new Set(n.sts || [])]));
  bucket.forEach(ix => {
    if (ix.length < 2) return;
    if (ix.length > 40) { capped++; return; } // a stem dozens of names share is not a spelling variant; counted, disclosed
    for (let i = 0; i < ix.length; i++) for (let j = i + 1; j < ix.length; j++) {
      const a = rows[ix[i]], b = rows[ix[j]]; const key = a.name < b.name ? a.name + '\u0001' + b.name : b.name + '\u0001' + a.name;
      if (seen.has(key)) continue; seen.add(key);
      if (skip.has(key)) { kept++; continue; }
      const d = a.k === b.k ? 0 : osa(a.k, b.k); if (d > 2) continue;
      const W = []; const say = (who, says, why) => W.push({ who, says, why });
      let kind = 'typo', why;
      if (d === 0) { kind = 'form'; why = ''; say('case', 'for', 'differs only in case, accents or punctuation'); }
      else {
        const pr = p(d / Math.max(a.k.length, b.k.length));
        why = (d === 1 ? 'one letter' : d + ' letters') + ' apart' + (sample ? ' · closer than ' + (pr === 0 ? 'every other pair' : Math.round((1 - pr) * 100) + '% of other pairs') + ' of names here' : '');
        const odd = oddWords(a.k, b.k);
        if (odd) {
          const shape = editShape(odd[0], odd[1]); if (shape) say('shape', 'for', shape);
          const [ca, cb] = [wc.get(odd[0]) || 0, wc.get(odd[1]) || 0];
          // a word once named is counted once by its own name; "nowhere else" means no more than its own mentions
          const ownA = a.n, ownB = b.n; const restA = ca - ownA, restB = cb - ownB;
          if (ca <= 1 && cb > 1) say('rarity', 'for', '“' + odd[0] + '” occurs once in the whole workspace; “' + odd[1] + '” ' + cb + '×');
          else if (cb <= 1 && ca > 1) say('rarity', 'for', '“' + odd[1] + '” occurs once in the whole workspace; “' + odd[0] + '” ' + ca + '×');
          else if (restA > 0 && restB > 0 && ca > 1 && cb > 1) say('rarity', 'against', 'both “' + odd[0] + '” (' + ca + '×) and “' + odd[1] + '” (' + cb + '×) recur, beyond these names too');
        }
      }
      const sa = stsOf.get(a.name), sb = stsOf.get(b.name); let together = 0; sa.forEach(x => { if (sb.has(x)) together++; });
      if (together) say('together', 'against', 'both are read in ' + (together === 1 ? 'one statement' : together + ' statements') + ' together');
      if (a.type && b.type && a.type !== b.type && a.type !== 'other' && b.type !== 'other') say('kind', 'against', 'read as different kinds of thing (' + a.type + ' / ' + b.type + ')');
      const cj = jac(ctx.get(a.name), ctx.get(b.name));
      if (cj > 0 && cj > ctxNull.top) { const shared = [...ctx.get(a.name)].filter(x => ctx.get(b.name).has(x)).filter(x => x.startsWith('n:')).map(x => x.slice(2)).slice(0, 3);
        say('context', 'for', 'they keep the same company' + (shared.length ? ' (' + shared.join(', ') + ')' : '') + ', more than 99% of name pairs here'); }
      // direction: the rare word is the typo; else the spelling read less often; else the shorter (accents, full form kept)
      const rare = W.find(w => w.who === 'rarity' && w.says === 'for');
      let lo, hi;
      if (rare) { const typoWord = rare.why.match(/^“([^”]+)”/)[1]; const odd = oddWords(a.k, b.k); [lo, hi] = odd[0] === typoWord ? [a, b] : [b, a]; }
      else [lo, hi] = (a.n < b.n || (a.n === b.n && a.name.length < b.name.length)) ? [a, b] : [b, a];
      if (!rare && lo.n < hi.n && kind !== 'form') say('mentions', 'for', 'the rarer spelling (' + lo.n + ' vs ' + hi.n + ' mentions)');
      const f = W.filter(w => w.says === 'for').length, g = W.filter(w => w.says === 'against').length;
      const verdict = f && !g ? 'likely' : f && g ? 'contested' : g ? 'doubtful' : 'open';
      pairs.push({ from: lo.name, to: hi.name, fromN: lo.n, toN: hi.n, d, why, kind, together, witnesses: W, verdict, likely: verdict === 'likely', score: f - 2 * g });
    }
  });
  const VO = { likely: 0, contested: 1, open: 2, doubtful: 3 };
  pairs.sort((x, y) => VO[x.verdict] - VO[y.verdict] || y.score - x.score || x.d - y.d || (y.toN / (y.fromN || 1)) - (x.toN / (x.fromN || 1)) || x.from.localeCompare(y.from));
  return { pairs, sample, capped, kept };
}

/** Group suggestion pairs by the name they fold into, so one target gathers all its variants. */
export function groupByTarget(pairs) {
  const g = new Map(); pairs.forEach(p => { (g.get(p.to) || g.set(p.to, []).get(p.to)).push(p); });
  return [...g.entries()].map(([to, ps]) => ({ to, toN: ps[0].toN, variants: ps }));
}

/** Search referents by name or alias: exact > prefix > contains > near (osa ≤ 2 on the folded form). */
export function search(A, q, { limit = 60 } = {}) {
  const names = Object.values((A && A.names) || {}); const k = fold(q);
  const score = n => { const forms = [n.name, ...(n.aliases || [])].map(fold); let best = 9;
    for (const f of forms) { if (f === k) best = Math.min(best, 0); else if (f.startsWith(k)) best = Math.min(best, 1); else if (f.includes(k)) best = Math.min(best, 2); else if (k.length >= 4 && Math.abs(f.length - k.length) <= 2 && osa(f, k) <= 2) best = Math.min(best, 3); }
    return best; };
  const out = (k ? names.map(n => ({ n, s: score(n) })).filter(x => x.s < 9) : names.map(n => ({ n, s: 0 })))
    .sort((a, b) => a.s - b.s || (b.n.sts || []).length - (a.n.sts || []).length || a.n.name.localeCompare(b.n.name));
  return out.slice(0, limit).map(x => ({ name: x.n.name, type: x.n.type, n: (x.n.sts || []).length, docs: x.n.docs ? x.n.docs.size : 0, aliases: x.n.aliases || [], near: x.s === 3 }));
}

/** Surfaces (raw spellings) folded into one referent, with mention counts — what SEG can cut. */
export function surfacesOf(A, name) {
  const c = new Map(); const n = A && A.names && A.names[name]; if (!n) return [];
  (n.sts || []).forEach(id => { const st = A.byId && A.byId[id]; if (!st) return;
    (st.spans || []).forEach(sp => { if (sp.name !== name) return; const s = st.text.slice(sp.s, sp.e); c.set(s, (c.get(s) || 0) + 1); }); });
  return [...c.entries()].map(([surface, n]) => ({ surface, n })).sort((a, b) => b.n - a.n);
}

/** Plain-English line for an edit, for the log. */
export function sayEdit(e) {
  if (e.kind === 'syn') return e.from.length === 1 && !e.merge ? '“' + e.from[0] + '” is “' + e.to + '”' : e.from.map(x => '“' + x + '”').join(', ') + ' → one referent, “' + e.to + '”';
  if (e.kind === 'seg') return '“' + e.target + '” is not “' + e.of + '”' + (e.label && e.label !== e.target ? ' — it is “' + e.label + '”' : '');
  if (e.kind === 'con') return '“' + e.a + '” ' + (e.rel || 'is tied to') + ' “' + e.b + '”';
  if (e.kind === 'not-name') return '“' + e.target + '” is not a name';
  return e.text || '';
}

/** applyEdits(A, edits) — mutate A: spans, statement names, A.names, nameLinks, declared ties.
 *  Edits apply in log order. Returns { applied, skipped } (skipped carry a reason). */
export function applyEdits(A, edits) {
  const applied = [], skipped = []; A.declaredTies = [];
  if (!A || !A.names || !edits || !edits.length) return { applied, skipped };
  const old = A.names; const touched = new Set();
  const typeOf = new Map(Object.values(old).map(n => [n.name, n]));
  const aka = new Map(Object.values(old).map(n => [n.name, new Set(n.aliases || [])]));
  const present = () => { const s = new Set(); A.sts.forEach(st => (st.names || []).forEach(n => s.add(n))); return s; };
  let live = present();
  const relabel = (test, to) => { let hit = 0;
    A.sts.forEach(st => { let ch = false; (st.spans || []).forEach(sp => { if (test(sp, st)) { if (sp.name !== to) { sp.name = to; ch = true; } hit++; } });
      if (ch) { st.names = [...new Set(st.spans.map(sp => sp.name))]; touched.add(st.id); } });
    return hit; };
  for (const e of edits) {
    if (e.kind === 'syn') {
      const to = String(e.to || '').trim(); const from = (e.from || []).filter(x => x && x !== to);
      if (!to || !from.length) { skipped.push({ e, why: 'nothing to merge' }); continue; }
      const fs = new Set(from); const ff = new Set(from.map(fold));
      // a referent's name OR one of its raw spellings
      const hit = relabel((sp, st) => fs.has(sp.name) || ff.has(fold(st.text.slice(sp.s, sp.e))), to);
      if (!hit) { skipped.push({ e, why: 'no longer read in this workspace' }); continue; }
      const A2 = aka.get(to) || new Set(); from.forEach(x => { A2.add(x); (aka.get(x) || []).forEach(y => A2.add(y)); }); A2.delete(to); aka.set(to, A2);
      if (!typeOf.has(to)) typeOf.set(to, from.map(x => typeOf.get(x)).filter(Boolean).sort((a, b) => (b.sts || []).length - (a.sts || []).length)[0] || null);
      applied.push(e);
    } else if (e.kind === 'seg') {
      const t = fold(e.target); const label = String(e.label || e.target).trim();
      const hit = relabel((sp, st) => (!e.of || sp.name === e.of) && fold(st.text.slice(sp.s, sp.e)) === t, label);
      if (!hit) { skipped.push({ e, why: 'that spelling is not inside “' + e.of + '” any more' }); continue; }
      if (e.of && aka.has(e.of)) aka.get(e.of).delete(e.target);
      if (!typeOf.has(label)) typeOf.set(label, typeOf.get(e.of) || null);
      aka.set(label, aka.get(label) || new Set()); applied.push(e);
    } else if (e.kind === 'con') {
      live = present();
      if (!live.has(e.a) || !live.has(e.b) || e.a === e.b) { skipped.push({ e, why: 'one side is not a referent here' }); continue; }
      A.declaredTies.push({ a: e.a, b: e.b, rel: e.rel || 'is tied to', id: e.id }); applied.push(e);
    }
  }
  // rebuild A.names from the statements, keeping each referent's earlier facts
  const names = {};
  A.sts.forEach(st => (st.names || []).forEach(n => { const base = typeOf.get(n) || {};
    const x = names[n] || (names[n] = { ...base, name: n, type: base.type || 'other', sts: [], docs: new Set() }); x.sts.push(st.id); x.docs.add(st.doc); }));
  Object.values(names).forEach(n => { n.aliases = [...(aka.get(n.name) || [])].filter(a => a !== n.name); });
  A.names = names;
  // nameLinks follow their spans
  if (A.nameLinks) { const nl = {}; Object.entries(A.nameLinks).forEach(([k, L]) => { const owner = names[k] ? k : Object.values(names).find(n => n.aliases.includes(k)); const key = typeof owner === 'string' ? owner : owner && owner.name; if (key) (nl[key] = nl[key] || []).push(...L); }); A.nameLinks = nl; }
  // CONs whose ends were later merged away follow the merge
  A.declaredTies = A.declaredTies.filter(t => names[t.a] && names[t.b]);
  A.referentEdits = { applied, skipped, touched: touched.size };
  return { applied, skipped };
}
