// document-evidence.js — what a document itself says about the capitalised forms the received priors
// do not know: its own DEFINITIONS (a referent binding) and its own CAPITALISATION WITNESSES.
//
// WHY THIS EXISTS. The treebank prior and the class lexicon are type-level: they know "licensee" in
// general. They cannot know that THIS contract's "Metro" is the Metropolitan Government, that "MNPS" is
// the school system its first page spells out, or that "Davidson" is always capitalised mid-sentence
// and never once lowercase. Only the document can say that, and the document says it in two ways it
// has already committed to: a definition ("… County (“Metro”)", "“Licensee” means …", "Metropolitan
// Nashville Public Schools (MNPS)") and the habit of its own typography. Both are evidence, neither
// is a giver — the corpus and the document can nominate and witness, never give. So every reading
// here is a CANDIDATE set with masses, never a settled fact asserted on its own authority.
//
// HOW IT RESOLVES. Each admitted kind of evidence votes with an AMPLITUDE per class; amplitudes add
// (agreeing evidence reinforces, which is what a Born mass rewards) and the class mass is
//     p_c = A_c² / Σ A²                        (the Born rule — anchoring.js's own map)
// The floors that decide whether a leader may settle are the document's OWN median leader mass and
// median margin over its forms — derived, never defaulted. The only declared constant is the Laplace
// smoothing of a witness proportion (alpha = 1, stated in every result), the same declaration
// bayes-surprise.js makes.
//
// THE DIFFERENCE THAT MAKES A DIFFERENCE. A piece of evidence is carried in a reading only if taking
// it away changes the verdict (the leader, or whether it settles). Evidence that moves nothing is
// not recorded as why — it is counted in `redundant` and left out, so the reading's `evidence` is
// exactly the set that earned its place.
//
// EVERY PART POINTS AT THE WHOLE. Each piece of evidence carries `at: [start, end]`, a range in the
// text this was given (UTF-16 code units, the same offsets splitSentences reports), so the record
// can re-expand any claim to the bytes it came from.
import { splitSentences } from "./spans.js";
import { createSurfaceEvidence, accumulateSurfaceEvidence, normaliseSurface, diaNorm, stripPossessive } from "./surfaces.js";
import { normalizeForm, THRAX_MAP } from "./wordclass.js";

export const DOCUMENT_EVIDENCE_SCHEMA = "EODocumentEvidence@1";
export const ALPHA = 1; // Laplace smoothing of a witness proportion — declared, stated in every result

const Q = "[“”\"‘’'`´]";
const LEAD_IN = /^(?:\s*(?:the|a|an|hereinafter|hereafter|referred to as|referred to|also known as|also called|collectively|each|individually|and|or|“|”|"|,)\s*)*$/i;
const SMALL = new Set("of and for the in on at de & to".split(" "));
const DETERMINERS = new Set("the this that such each any all a an its their his her our".split(" "));

const PAREN = new RegExp(`\\(([^()]{0,40}?)${Q}([A-Z][^“”"'‘’\`´()]{1,40}?)${Q}[^()]{0,40}\\)`, "gu");
const MEANS = new RegExp(`${Q}([A-Z][^“”"'‘’\`´]{1,40}?)${Q}\\s*(?:shall\\s+|will\\s+)?(?:mean|means|refers?\\s+to|is\\s+defined\\s+as|has\\s+the\\s+meaning)\\b`, "gu");
const ABBR = /((?:[A-Z][\p{L}&'’.\-]*\s+(?:(?:of|and|for|the|in|on|at|&)\s+)*){1,8}[A-Z][\p{L}&'’.\-]*)\s*\(([A-Z][A-Z0-9&.\-]{1,9})\)/gu;

// Closed classes the organ takes as DECLARED, not measured (English): the LEGAL-FORM designators and the
// HONORIFICS that make the token beside them a name. Deliberately narrow — 'Services', 'Group', 'Chief',
// 'Director' also stand in role phrases ('Chief Financial Officer'), where the next token is a title
// word, not a name; a measured control on Metro contracts showed exactly that failure. Callers may
// pass their own (`orgSuffixes`, `titles` — e.g. the name-parts prior's titles) to override.
const ORG_SUFFIXES = new Set("inc incorporated llc llp lp ltd limited corp corporation co company plc gmbh".split(" "));
const TITLES = new Set("mr mrs ms miss mx dr prof professor rev reverend sir madam madame judge mayor governor senator councilmember councilman councilwoman sheriff".split(" "));
const APPOSITION = new RegExp(`((?:[A-Z][\\p{L}&'’.\\-]*\\s+){0,3}[A-Z][\\p{L}&'’\\-]*),?\\s+(?:a|an)\\s+(?:[\\p{L}]+\\s+){0,3}?(?:corporation|company|partnership|nonprofit|non-profit|organization|agency|department|firm|entity|association|trust|authority|university)\\b`, "gu");

const isCapToken = (t) => /^\p{Lu}[\p{L}'’]*$/u.test(t) || /^\p{Lu}{2,}[\p{L}\p{N}&.\-]*$/u.test(t);

/** Letters of an acronym are an ordered subsequence of the initials of its long form. */
const initialsMatch = (long, acr) => {
  const initials = long.split(/\s+/).map((w) => w[0]?.toUpperCase()).filter(Boolean);
  const want = acr.replace(/[^\p{L}]/gu, "").toUpperCase();
  let k = 0;
  for (const ch of initials) if (ch === want[k]) k++;
  return want.length >= 2 && k === want.length;
};

/**
 * What a defined term stands for, from the run of text it abbreviates.
 *   'short-form' — the term is a word of its own definiens ("Executive Director" → "Director"): the
 *                  head noun again, a common noun used as a defined term, not a name;
 *   'name'       — the definiens is a named run (a capitalised, non-determiner token) the term is not
 *                  part of ("Metropolitan Government of Nashville … (“Metro”)"): an alias for a name;
 *   'role'       — the definiens names nothing ("the party that signs this Agreement").
 * The definiens run is the capitalised run (small connectors allowed) ENDING at the term's own
 * parenthesis, so a capitalised neighbour further back cannot leak in.
 */
const definiensKind = (window, term) => {
  const toks = window.split(/\s+/).map((t) => t.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "")).filter(Boolean);
  const run = [];
  for (let i = toks.length - 1; i >= 0; i--) {
    const t = toks[i];
    if (isCapToken(t) || (SMALL.has(t.toLowerCase()) && run.length)) run.unshift(t); else break;
  }
  while (run.length && SMALL.has(run[0].toLowerCase())) run.shift();
  const named = run.filter((t) => isCapToken(t) && !DETERMINERS.has(t.toLowerCase()));
  const termToks = new Set(String(term).split(/\s+/).map((t) => t.toLowerCase()));
  if (named.length && named.some((t) => termToks.has(t.toLowerCase()))) return "short-form";
  return named.length ? "name" : "role";
};

/** The document's own definitions: referent bindings, each with the range of the term and of its definiens. */
export function findDefinitions(text) {
  const out = [];
  const t = String(text ?? "");
  for (const m of t.matchAll(PAREN)) {
    if (!LEAD_IN.test(m[1])) continue;
    const term = m[2].trim().replace(/[,.;]+$/, "");
    const open = m.index;
    const before = t.slice(Math.max(0, open - 90), open);
    const win = before.split(/\s+/).slice(-8).join(" ");
    const tStart = open + m[0].indexOf(m[2]);
    out.push({ term, pattern: "parenthetical", kind: definiensKind(win, term), definiens: win.trim(), definiensAt: [open - win.length, open], at: [tStart, tStart + m[2].length] });
  }
  for (const m of t.matchAll(MEANS)) {
    const after = t.slice(m.index + m[0].length, m.index + m[0].length + 80);
    const win = after.split(/\s+/).filter(Boolean).slice(0, 4);
    const first = win.find((w) => !DETERMINERS.has(w.toLowerCase().replace(/[^\p{L}]/gu, "")));
    const tStart = m.index + m[0].indexOf(m[1]);
    out.push({ term: m[1].trim(), pattern: "means", kind: win.some((w) => new Set(m[1].toLowerCase().split(/\s+/)).has(w.toLowerCase().replace(/[^\p{L}]/gu, ""))) ? "short-form" : first && isCapToken(first.replace(/^[^\p{L}]+/u, "")) ? "name" : "role", definiens: win.join(" "), definiensAt: [m.index + m[0].length, m.index + m[0].length + win.join(" ").length + 1], at: [tStart, tStart + m[1].length] });
  }
  for (const m of t.matchAll(ABBR)) {
    const long = m[1].trim();
    if (!initialsMatch(long, m[2])) continue;
    const aStart = m.index + m[0].lastIndexOf(m[2]);
    out.push({ term: m[2], pattern: "abbreviation", kind: "name", definiens: long, definiensAt: [m.index, m.index + m[1].length], at: [aStart, aStart + m[2].length] });
  }
  return out;
}

/**
 * One pass over the text for the occurrences of target forms: at each MID-SENTENCE occurrence (a
 * sentence-initial capital is capitalised by position and says nothing), was the form bare or
 * after a determiner — names take none, role nouns do — and was it followed by an organisation
 * designator or preceded by an honorific. Instance-level facts, aggregated as witness proportions.
 */
const CONTENT = new Set(["NOUN", "ADJ", "VERB"]);
const scanOccurrences = (src, keys, { titles, orgSuffixes, classify }) => {
  const stats = new Map();
  const get = (k) => stats.get(k) ?? stats.set(k, { bare: 0, determined: 0, label: 0, org: null, title: null, firstAt: null }).get(k);
  const commonCache = new Map();
  // a capitalised neighbour that the prior places as an ordinary content word: Title Case, not a name
  const commonCap = (t) => {
    if (!t || !isCapToken(t.bare)) return false;
    const k = t.bare;
    if (!commonCache.has(k)) { const c = classify(k); const top = c?.found ? c.candidates?.[0]?.upos : null; commonCache.set(k, !!top && CONTENT.has(top) && c.candidates.length > 0 && !c.candidates.some((x) => x.upos === "PROPN" && (x.share ?? 0) >= 0.3)); }
    return commonCache.get(k);
  };
  const toks = [];
  for (const m of src.matchAll(/[\p{L}\p{N}][\p{L}\p{N}'’&.\-]*/gu)) toks.push({ raw: m[0], start: m.index, end: m.index + m[0].length, bare: normalizeForm(m[0]).form });
  const abbrev = (t) => titles.has(t.bare.toLowerCase()) || orgSuffixes.has(t.bare.toLowerCase()) || /^\p{Lu}$/u.test(t.bare);
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    const key = diaNorm(stripPossessive(t.bare));
    if (!keys.has(key) || !isCapToken(stripPossessive(t.bare))) continue; // the CAPITALISED occurrences only — a lowercase 'a zebra' is not evidence about 'Zebra'
    const st = get(key);
    if (!st.firstAt) st.firstAt = [t.start, t.end];
    const prev = toks[i - 1];
    const gap = prev ? src.slice(prev.end, t.start) : "\n";
    const initial = !prev || /\n/.test(gap) || (/[.!?:]["'”’)]*$/.test(prev.raw) && !abbrev(prev));
    if (!initial) {
      if (DETERMINERS.has(prev.bare.toLowerCase())) st.determined++; else st.bare++;
      const sameLine = (a, b2) => a && b2 && !/\n/.test(src.slice(a.end, b2.start)) && !/[,.;:]$/.test(a.raw);
      const nx = toks[i + 1];
      if ((sameLine(prev, t) && commonCap(prev)) || (sameLine(t, nx) && commonCap(nx))) st.label++;
    }
  }
  return stats;
};

/**
 * Occurrence-level NAME RUNS — referent bindings with a range: a legal-form designator closing a
 * capitalised run ("Rock Solid Security, Inc."), an honorific opening one ("Mayor Gentry"), or an
 * appositive ("…Public Education, a municipal corporation"). They say "THIS occurrence is part of a
 * name", which is not a claim about the form: "Security" is a common noun almost everywhere else.
 */
const findNameRuns = (src, { titles, orgSuffixes }) => {
  const toks = [];
  for (const m of src.matchAll(/[\p{L}\p{N}][\p{L}\p{N}'’&.\-]*/gu)) toks.push({ raw: m[0], start: m.index, end: m.index + m[0].length, bare: normalizeForm(m[0]).form });
  const sameLine = (a, b) => !/[()\[\]“”"‘;:\n]/.test(src.slice(a.end, b.start)) && !/[.!?]$/.test(a.raw.replace(/\b(?:Inc|Co|Corp|Ltd|LLC|LLP|LP|Mr|Mrs|Ms|Dr|Jr|Sr|St)\.$/i, ""));
  const runs = [];
  const capOrSmall = (t) => isCapToken(t.bare) || SMALL.has(t.bare.toLowerCase());
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i], low = t.bare.toLowerCase();
    if (orgSuffixes.has(low) && i > 0 && sameLine(toks[i - 1], t) && isCapToken(toks[i - 1].bare)) {
      let a = i - 1;
      while (a > 0 && i - a < 6 && capOrSmall(toks[a - 1]) && sameLine(toks[a - 1], toks[a])) a--;
      while (a < i && SMALL.has(toks[a].bare.toLowerCase())) a++;
      if (a < i) runs.push({ kind: "organisation", via: `designator “${t.bare}”`, at: [toks[a].start, t.end], text: src.slice(toks[a].start, t.end), members: toks.slice(a, i).map((x) => x.bare) });
    }
    if (titles.has(low) && i + 1 < toks.length && sameLine(t, toks[i + 1]) && isCapToken(toks[i + 1].bare) && !titles.has(toks[i + 1].bare.toLowerCase())) {
      let b = i + 1;
      const caps = (x) => /^\p{Lu}{2,}[\p{Lu}\p{N}'’&.\-]*$/u.test(x); // ALLCAPS vs Capitalised: a run keeps one style
      while (b + 1 < toks.length && b - i < 3 && isCapToken(toks[b + 1].bare) && caps(toks[b + 1].bare) === caps(toks[i + 1].bare) && sameLine(toks[b], toks[b + 1])) b++;
      runs.push({ kind: "person", via: `honorific “${t.bare}”`, at: [toks[i + 1].start, toks[b].end], text: src.slice(toks[i + 1].start, toks[b].end), members: toks.slice(i + 1, b + 1).map((x) => x.bare) });
    }
  }
  for (const m of src.matchAll(APPOSITION)) {
    const start = m.index, end = m.index + m[1].length;
    runs.push({ kind: "organisation", via: "apposition", at: [start, end], text: m[1], members: m[1].split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}'’&\-]/gu, "")).filter(Boolean) });
  }
  return runs;
};

const bornMasses = (amps) => {
  const sq = Object.fromEntries(Object.entries(amps).map(([c, a]) => [c, a * a]));
  const z = Object.values(sq).reduce((a, b) => a + b, 0) || 1;
  return Object.fromEntries(Object.entries(sq).map(([c, s]) => [c, s / z]));
};
const median = (xs) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const OTHER = "?"; // some reading the document does not name — kept as mass so a lowercase habit can block a settle

/** amplitudes per class from the evidence kinds present (a subset may be withheld to test the difference it makes) */
const amplitudes = (ev, without = null) => {
  const A = {};
  const add = (c, a) => { A[c] = (A[c] ?? 0) + a; };
  for (const e of ev) {
    if (e.kind === without) continue;
    for (const [c, a] of Object.entries(e.votes)) add(c, a);
  }
  return A;
};
const verdict = (A, floors) => {
  const m = bornMasses(A);
  const ranked = Object.entries(m).sort((a, b) => b[1] - a[1]);
  const [lead, leadMass] = ranked[0] ?? [null, 0];
  const margin = leadMass - (ranked[1]?.[1] ?? 0);
  return { masses: m, ranked, lead, leadMass, margin, settled: lead !== null && lead !== OTHER && leadMass >= floors.minMass && margin >= floors.minMargin };
};

/**
 * Read a document's own evidence about the capitalised forms `classify` cannot place.
 * @param {string} text
 * @param {{classify: (form: string) => {found: boolean, candidates?: Array<{upos: string}>}}} opts
 *   classify — the caller's class lookup (the full chain it already uses); a form it places is not a target.
 */
export function readDocumentEvidence(text, { classify, titles = TITLES, orgSuffixes = ORG_SUFFIXES, witnesses = [], use = null } = {}) {
  if (typeof classify !== "function") throw new TypeError("readDocumentEvidence: classify is injected — the organ owns no prior");
  const src = String(text ?? "");
  const sentences = splitSentences(src);
  const surf = createSurfaceEvidence();
  accumulateSurfaceEvidence(sentences, surf);
  const defs = findDefinitions(src);
  const defByKey = new Map();
  for (const d of defs) { const k = diaNorm(d.term); (defByKey.get(k) ?? defByKey.set(k, []).get(k)).push(d); }

  // targets: capitalised or ALLCAPS forms, edge-normalised, that classify() cannot place
  const variants = new Map(); // lower key -> Set(form as written)
  const firstAt = new Map();
  for (const m of src.matchAll(/[\p{L}][\p{L}\p{N}'’&.\-]*/gu)) {
    const raw = m[0];
    const form = stripPossessive(normalizeForm(raw).form);
    if (!form || !isCapToken(form) || form.length < 2) continue;
    const key = diaNorm(form);
    if (!variants.has(key)) { variants.set(key, new Set()); firstAt.set(key, m.index); }
    variants.get(key).add(form);
  }
  const targets = [];
  for (const [key, forms] of variants) {
    const placed = [...forms].some((f) => classify(f)?.found);
    if (!placed) targets.push([key, forms]);
  }

  // CALIBRATORS: capitalised forms the prior DOES place with a settled class (a name, or a common noun),
  // which are labelled examples inside this very document. How well each frame signal separates them
  // here is its reliability here — measured, so a signal that does not discriminate in this genre
  // (bare defined terms; Title-Case labels) is given no say.
  const calib = new Map();
  for (const [key, forms] of variants) {
    for (const f of forms) {
      const c = classify(f);
      const top = c?.found ? c.candidates?.[0] : null;
      if (top && (top.upos === "PROPN" || top.upos === "NOUN") && (top.share ?? 0) >= 0.8 && c.total >= 5 && !c.inferred) { calib.set(key, top.upos); break; }
    }
  }
  const occ = scanOccurrences(src, new Set([...targets.map(([k]) => k), ...calib.keys()]), { titles, orgSuffixes, classify });
  const rate = (sel) => { const r = { PROPN: [0, 0], NOUN: [0, 0] }; for (const [k, cls] of calib) { const o = occ.get(k); if (!o) continue; const n = o.bare + o.determined; r[cls][0] += sel(o); r[cls][1] += n; } return r; };
  const sep = (sel, toward) => { const r = rate(sel); if (r.PROPN[1] < 20 || r.NOUN[1] < 20) return 0; const rp = r.PROPN[0] / r.PROPN[1], rn = r.NOUN[0] / r.NOUN[1]; return Math.max(0, toward === "PROPN" ? rp - rn : rn - rp); };
  const reliability = { "determiner-frame": sep((o) => o.bare, "PROPN"), "label-company": sep((o) => o.label, "NOUN") };
  const nameRuns = findNameRuns(src, { titles, orgSuffixes });
  const inRun = new Map(); // key -> [{run}]
  for (const r of nameRuns) for (const mem of r.members) { const k = diaNorm(stripPossessive(mem)); (inRun.get(k) ?? inRun.set(k, []).get(k)).push(r); }

  const readings = [];
  for (const [key, forms] of targets) {
    let c = 0;
    for (const f of forms) c += surf.capCounts.get(normaliseSurface(f)) ?? 0;
    const l = surf.lowerCounts.get(key) ?? 0;
    const lowerClass = classify(key);
    const S = lowerClass?.found ? [...new Set(lowerClass.candidates.map((k) => k.upos))] : [];
    const ev = [];
    if (c + l > 0) {
      const pName = (c + ALPHA) / (c + l + 2 * ALPHA);
      // Capitalisation separates 'a name or a defined term' from 'an ordinary lowercase word' — it
      // cannot say which of the two a capitalised form is (a defined role noun is capitalised too).
      // So its mass goes to both, and the frame and the definition decide between them.
      const votes = { PROPN: Math.sqrt(pName / 2), NOUN: Math.sqrt(pName / 2) };
      if (S.length) for (const u of S) votes[u] = (votes[u] ?? 0) + Math.sqrt((1 - pName) / S.length); else votes[OTHER] = Math.sqrt(1 - pName);
      ev.push({ kind: "capitalisation", capitalisedMidSentence: c, lowercase: l, alpha: ALPHA, at: [firstAt.get(key), firstAt.get(key) + [...forms][0].length], votes });
    }
    const o = occ.get(key);
    if (o && o.bare + o.determined > 0) {
      const n = o.bare + o.determined;
      const rf = reliability["determiner-frame"], rl = reliability["label-company"];
      if (rf > 0) {
        const pBare = (o.bare + ALPHA) / (n + 2 * ALPHA);
        ev.push({ kind: "determiner-frame", bare: o.bare, determined: o.determined, reliability: rf, alpha: ALPHA, at: o.firstAt, votes: { PROPN: Math.sqrt(rf * pBare), NOUN: Math.sqrt(rf * (1 - pBare)) } });
      }
      if (rl > 0) {
        const pLabel = (o.label + ALPHA) / (n + 2 * ALPHA);
        ev.push({ kind: "label-company", label: o.label, of: n, reliability: rl, alpha: ALPHA, at: o.firstAt, votes: { [OTHER]: Math.sqrt(rl * pLabel), PROPN: Math.sqrt(rl * (1 - pLabel)) } });
      }
    }
    // Occurrence-level evidence speaks for the FORM only when the form is never written lowercase in
    // this document — "Security" in "Rock Solid Security, Inc." is a name part there and a common noun
    // elsewhere; "Fenner" in "Mr. Fenner", never lowercase, is a name.
    const runsHere = inRun.get(key) ?? [];
    if (runsHere.length && l === 0) {
      const kindOf = (r) => (r.via === "apposition" ? "apposition" : r.kind === "person" ? "honorific" : "organisation-designator");
      const seenKinds = new Set();
      for (const r of runsHere) { const k = kindOf(r); if (seenKinds.has(k)) continue; seenKinds.add(k); ev.push({ kind: k, via: r.via, run: r.text, at: r.at, votes: { PROPN: 1 } }); }
    }
    for (const w of witnesses) {
      const got = w.lookup?.(key, forms);
      if (got?.votes) ev.push({ kind: w.kind, ...(got.detail ? { detail: got.detail } : {}), at: got.at ?? null, votes: got.votes });
    }
    for (const d of defByKey.get(key) ?? []) {
      const votes = d.kind === "name" ? { PROPN: 1 } : { NOUN: 1 }; // a short form or a role is a common noun used as a defined term
      ev.push({ kind: "definition", pattern: d.pattern, definiensKind: d.kind, definiens: d.definiens, at: d.at, definiensAt: d.definiensAt, votes });
    }
    if (use) for (let i = ev.length - 1; i >= 0; i--) if (!use.has(ev[i].kind)) ev.splice(i, 1);
    if (!ev.length) continue;
    readings.push({ form: [...forms].sort()[0], key, forms: [...forms].sort(), ev });
  }

  // the document's own floors: median leader mass and median margin over its forms (all evidence in)
  const first = readings.map((r) => verdict(amplitudes(r.ev), { minMass: 0, minMargin: 0 }));
  // Derived from the document when it has enough forms to say what is typical; before that, the DECLARED
  // bootstrap floors (as anchoring.js declares its own for a session's first scenes) — stated, never silent.
  const BOOTSTRAP = { minForms: 5, minMass: 2 / 3, minMargin: 1 / 3 };
  const floors = readings.length >= BOOTSTRAP.minForms
    ? { minMass: median(first.map((v) => v.leadMass)), minMargin: median(first.map((v) => v.margin)), derivedFrom: `median over ${readings.length} forms of this document` }
    : { minMass: BOOTSTRAP.minMass, minMargin: BOOTSTRAP.minMargin, derivedFrom: `declared bootstrap (fewer than ${BOOTSTRAP.minForms} forms to derive from)` };

  const out = readings.map((r) => {
    const all = verdict(amplitudes(r.ev), floors);
    // The difference that makes a difference, taken as a MINIMAL SUFFICIENT set: start from every
    // kind of evidence and drop one at a time — weakest first — whenever the verdict (the leader, and
    // whether it settles) survives its loss. What remains is what the verdict stands on. (Leave-one-out
    // alone would call two agreeing signals each redundant and carry neither.)
    const kinds = [...new Set(r.ev.map((e) => e.kind))];
    const weight = (k) => Math.hypot(...r.ev.filter((e) => e.kind === k).flatMap((e) => Object.values(e.votes)));
    kinds.sort((a, b) => weight(a) - weight(b) || (a === "capitalisation" ? -1 : b === "capitalisation" ? 1 : 0));
    const keep = new Set(kinds);
    const redundant = [];
    for (const k of kinds) {
      const rest = r.ev.filter((e) => keep.has(e.kind) && e.kind !== k);
      if (!rest.length) continue;
      const w = verdict(amplitudes(rest), floors);
      if (w.lead === all.lead && w.settled === all.settled) { keep.delete(k); redundant.push(k); }
    }
    const carried = [...keep];
    return {
      form: r.form, key: r.key, forms: r.forms,
      candidates: all.ranked.map(([upos, mass]) => ({ upos, mass })),
      leader: all.lead === OTHER ? null : all.lead, leaderMass: all.leadMass, margin: all.margin,
      settled: all.settled, standing: "candidate",
      evidence: r.ev.filter((e) => carried.includes(e.kind)).map(({ votes, ...e }) => e),
      redundant,
    };
  });
  return { schema: DOCUMENT_EVIDENCE_SCHEMA, unit: "utf16", alpha: ALPHA, floors, reliability, calibrators: calib.size, bindings: defs, nameRuns, readings: out };
}

/**
 * A classify function that, for a form the base chain cannot place, answers from this document's
 * settled evidence — marked `attested: "document"`, with the evidence in `via`. A form the document
 * does not settle stays exactly as the base chain left it (a typed gap).
 */
export function classifyWithDocument(classify, doc) {
  const by = new Map();
  for (const r of doc.readings) if (r.settled && r.leader) for (const f of r.forms) by.set(f, r);
  return (surface, opts) => {
    const base = classify(surface, opts);
    if (base?.found) return base;
    const form = stripPossessive(normalizeForm(surface).form);
    const r = by.get(form);
    if (!r) return base;
    return {
      surface, found: true, total: 0, form, attested: "document",
      via: [{ step: "document-evidence", kinds: r.evidence.map((e) => e.kind), note: "a candidate drawn from this document's own definitions and capitalisation — settled against its own floors, not given" }],
      candidates: r.candidates.filter((k) => k.upos !== OTHER).map((k) => ({ upos: k.upos, count: 0, share: k.mass, thraxClass: THRAX_MAP[k.upos] ?? null, attested: "document" })),
      evidence: r.evidence,
    };
  };
}
