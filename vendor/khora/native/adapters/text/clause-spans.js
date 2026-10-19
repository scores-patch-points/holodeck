// adapters/text/clause-spans.js — CLAUSE-LEVEL SEGMENTATION (2026-09-23).
//
// SCOPED TO ENGLISH, DISCLOSED, NOT SILENT. Neither `clauseSpans` nor
// `propositionSpans` takes a `language` parameter — both default to the
// closed grammatical classes priors.js declares `giver: "lang/en"`
// (CLAUSE_COORDINATORS, SUBORDINATING_CONJUNCTIONS, INTERROGATIVE_PRONOUNS,
// SUBJECT_PRONOUNS). This is a stated scope, not an implied universal: a
// caller reading a different language passes its own closed classes via
// `opts.coordinators`/`subordinators`/`relativizers`/`subjectPronouns`
// rather than getting a silently-wrong English segmentation. relations-
// gfp.js's own figure-finding stays language-neutral (recurrence + company,
// no vocabulary); THIS module — the clause-boundary layer sitting above
// it — is where the language-specific grammar actually lives, and it says
// so here rather than smuggling it in as if clause structure were
// universal.
//
// Built to answer a specific, disclosed gap: extractGfpRelations
// (relations-gfp.js) reads figure-connector-figure arrangements from
// whatever text sits within MAX_ADJACENCY=200 bytes of two figure
// mentions, with zero awareness of clause or sentence boundaries. Measured
// live against a real Wikipedia paragraph (Marie Curie, 2026-09-23): edges
// like `Pierre Curie —entered→ her life: it was their mutual interest in
// natural sciences that drew them together` bundle two independent
// propositions into one un-nested span, because nothing stops a
// figure-connector-figure match at a colon or a subordinate clause.
//
// THE USER'S OWN FRAMING (2026-09-23, verbatim, why this file exists):
// "human language is a series of nested propositions of increasing
// abstraction — clause, sentence, paragraph, section, etc. — each itself a
// GFP, each drillable and collapsible." This module is the clause-level
// floor of that stack: it turns one sentence into a small TREE of clause
// spans (not a flat list) so a caller can run extractGfpRelations PER
// CLAUSE instead of per byte-window, and so each clause's own arrangement
// can point at its parent clause — collapsible up, drillable down — rather
// than a single flat span swallowing everything between two figures.
//
// WHAT COUNTS AS A BOUNDARY, AND WHY EACH ONE IS TRUSTED:
//   - `;` — a semicolon joins two independent clauses in nearly all
//     standard English usage; split unconditionally, relation "coordinate".
//   - `:` — a colon most often introduces material that ELABORATES the
//     clause before it (an explanation, a list, an appositive clause) —
//     not a sibling proposition but a CHILD of the one before the colon.
//     Split, relation "elaborates", parent = the clause before the colon.
//   - a CLAUSE_COORDINATOR (and/but/or/nor/so/yet/for, priors.js) —
//     split ONLY when the very next token is a SUBJECT_PRONOUN (priors.js:
//     i/you/he/she/it/we/they/this/that/these/those/who/what/which/
//     whoever/whatever). This is not a new threshold: it is the EXACT
//     discriminator priors.js's own CLAUSE_COORDINATORS comment already
//     names as the measured real shape ("and it", "but he", "battle
//     that") — reused here, not reinvented. Anything else after the
//     coordinator ("bread and butter") is NP-coordination, left alone.
//     relation "coordinate".
//   - a SUBORDINATING_CONJUNCTION (priors.js — because/although/while/
//     since/if/after/before/unless/until/though, each independently
//     measured SCONJ-dominant against the received POS prior) — split,
//     relation "subordinate", ONLY when at least one token already
//     precedes it in the current clause (a sentence OPENING with "Because
//     it rained…" is one clause, not a fragment before nothing).
//   - a WH-relative opener (priors.js INTERROGATIVE_PRONOUNS' own keys:
//     who/whom/whose/what/which/where/when) — same rule, relation
//     "relative".
//
// DISCLOSED, NOT SOLVED (three known gaps, measured live against this
// module's own smoke test, kept narrow rather than guessed wide):
//   1. "that" is deliberately excluded from the subordinator/relativizer
//      triggers (see priors.js's own note on SUBORDINATING_CONJUNCTIONS) —
//      pos-eng.json measures it too close to a three-way split
//      (SCONJ/PRON/DET) to trust as a closed-class boundary signal alone.
//      MEASURED 2026-10-14 (CALLIMACHUS.md §11.3): adding it costs witness
//      agreement in English, and Spanish "que" as a boundary is no better
//      than a random re-dealing (p = 0.52). With `opts.rows` (a UD parse)
//      "that" is decided per token instead.
//      "the theory that Curie discovered" will NOT be split at "that".
//   2. CLOSED 2026-10-14 (clauseSpans below; native/docs/CALLIMACHUS.md
//      §11): a fronted subordinate clause now ends at its comma, and with a
//      POS prior or a parse a fronted adjunct does too. The original note:
//      FRONTED subordinate clauses ("Because it rained, the match was
//      postponed") are NOT split — the subordinator-as-first-token guard
//      (below) exists to avoid a zero-length clause before it, but this
//      module does not yet detect the comma that should close a fronted
//      subordinate clause and open the main one. Only TRAILING subordinate/
//      relative clauses (main clause first) are split today.
//   3. Pied-piped relatives ("…Pierre, with whom she…") split AT the
//      relative pronoun, leaving its governing preposition ("with")
//      stranded at the end of the parent clause rather than carried into
//      the child. Correct content, imprecise boundary.
// Each is a real, present gap, not a hidden one — narrower and true beats
// wider and guessed, the same rule relations-gfp.js's own header states
// for figures.
//
// PURE. No model call, no IO, no network. Operates on one sentence's text
// at a time (a caller running this per-sentence, after splitSentences).

import { CLAUSE_COORDINATORS, SUBORDINATING_CONJUNCTIONS, SUBJECT_PRONOUNS, INTERROGATIVE_PRONOUNS } from "./priors.js";

const WORD = /[\p{L}\p{N}']+/gu;
const RELATIVIZERS = new Set(INTERROGATIVE_PRONOUNS.keys());

/**
 * clauseSpans(text, opts) → [{ start, end, text, parentIndex, relation, fronted? }]
 *
 * `parentIndex` — the index (into the returned array) of this clause's
 * parent, or `null` for the root (main) clause. `relation` — how this
 * clause relates to its parent: "root" | "coordinate" | "elaborates" |
 * "subordinate" | "relative" | "adjunct". A FRONTED clause or adjunct (gap
 * 2, closed 2026-10-14) comes first in the text and carries `fronted: true`;
 * its parent is the main clause after it, which is the root.
 *
 * `opts.coordinators`/`subordinators`/`relativizers`/`subjectPronouns` let
 * a caller override the received defaults (testing, a different register,
 * ANOTHER LANGUAGE: `closedClassesFromPrior(posPrior)` below derives them
 * from a received UD POS prior); omitted, the priors.js closed classes above
 * are used as-is — never re-derived, never guessed.
 *
 * Optional, each additive (absent, the module behaves as before, except
 * that a subordinator-opened FRONTED clause is now closed at its comma):
 *   `opts.posPrior` — a received POS prior (POSPrior@1). With it, a token
 *       counts as a PREDICATE when its dominant tag is VERB or AUX, which
 *       licenses (a) a fronted ADJUNCT: a sentence-initial comma segment
 *       with no predicate, opened by an ADP-, ADV- or NUM-dominant token
 *       (or a digit), while the rest of the sentence holds a predicate
 *       ("On July 14, 2026, the House…"); and (b) a COORDINATE clause after
 *       a comma + coordinator when the stretch after it holds a predicate
 *       (needed in pro-drop languages, where no subject pronoun follows).
 *   `opts.rows` — a UD parse of `text` ({ id, form, upos, feats, head,
 *       deprel, at } with `at` the UTF-16 offset in `text`). With it, each
 *       cut needs the parse's agreement as well as the closed class (two
 *       witnesses for a cut): a subordinator splits only when the parse
 *       tags it SCONJ, marks it `mark`, or gives it PronType=Rel|Int; a
 *       subordinator whose clause is a COMPLEMENT (ccomp, csubj, xcomp) is
 *       an argument and never cut; "that" (gap 1) splits when the parse
 *       makes it the mark of an adverbial/adnominal clause or a relative
 *       pronoun; a coordinator cuts after a comma or as the cc of a
 *       conjoined predicate, when both sides hold a predicate.
 *   `opts.opaqueQuotes` — no cut inside paired quotation marks (a quotation
 *       is one argument of its reporting verb).
 */
export function clauseSpans(text, opts = {}) {
  const s = String(text ?? "");
  const coordinators = opts.coordinators ?? CLAUSE_COORDINATORS;
  const subordinators = opts.subordinators ?? SUBORDINATING_CONJUNCTIONS;
  const relativizers = opts.relativizers ?? RELATIVIZERS;
  const subjectPronouns = opts.subjectPronouns ?? SUBJECT_PRONOUNS;
  const posPrior = opts.posPrior ?? null;
  const rows = opts.rows ?? null;

  if (!s.trim()) return [];

  const tokens = [...s.matchAll(WORD)].map((m) => ({ tok: m[0], lower: m[0].toLowerCase(), start: m.index, end: m.index + m[0].length }));
  if (!tokens.length) return [{ start: 0, end: s.length, text: s, parentIndex: null, relation: "root" }];

  // The parse row at a token, if a parse was given (by offset; the parser's tokens may split a WORD token, e.g. "Rubio's").
  const byId = rows ? new Map(rows.map((r) => [r.id, r])) : null;
  const rowAt = (t) => (rows ? rows.find((r) => r.at >= t.start && r.at < t.end) ?? null : null);
  const tagOf = (t) => { const e = posPrior?.forms?.[t.lower]; return e ? dominant(e) : null; };
  // PREDICATE: by the parse when there is one, else by the prior's dominant tag, else unknown (null).
  const isPred = (t) => {
    if (rows) { const r = rowAt(t); return !!r && (r.upos === "VERB" || r.upos === "AUX"); }
    if (posPrior) { const d = tagOf(t); return d === "VERB" || d === "AUX"; }
    return null;
  };
  const known = !!(rows || posPrior);
  const anyPred = (ts) => (known ? ts.some((t) => isPred(t)) : true);
  const quoted = [];
  if (opts.opaqueQuotes) for (const m of s.matchAll(/“[^”]*”|"[^"]*"|«[^»]*»/g)) quoted.push([m.index, m.index + m[0].length]);
  const inQuote = (at) => quoted.some(([a, b]) => at > a && at < b - 1);
  const clausal = (deprel) => /^(advcl|acl)/.test(deprel ?? "");
  const COMPLEMENT = /^(ccomp|csubj|xcomp)/;
  // Is this token a subordinator (or relativizer) here? The closed class proposes; a parse, when given, must agree.
  const subordinatorHere = (t) => {
    const listed = subordinators.has(t.lower) || relativizers.has(t.lower);
    if (!rows) return listed;
    const r = rowAt(t);
    if (!r) return false;
    const head = byId.get(r.head);
    if (head && COMPLEMENT.test(head.deprel)) return false; // a complement clause is an argument
    const parseSays = r.upos === "SCONJ" || /PronType=(Rel|Int)/.test(r.feats ?? "") || (r.deprel === "mark" && head && clausal(head.deprel));
    if (t.lower === "that") return (r.deprel === "mark" && !!head && clausal(head.deprel)) || /PronType=Rel/.test(r.feats ?? "");
    return listed ? parseSays && r.upos !== "ADP" : parseSays && (r.upos === "SCONJ" || r.deprel === "mark");
  };

  // FRONTED (gap 2): comma-delimited segments at the head of the sentence, while the rest still holds a predicate.
  const fronted = [];
  let segStart = 0;
  for (;;) {
    let comma = -1;
    for (let k = segStart; k < s.length; k += 1) if (s[k] === "," && !inQuote(k)) { comma = k; break; }
    if (comma < 0) break;
    const seg = tokens.filter((t) => t.start >= segStart && t.start < comma);
    const rest = tokens.filter((t) => t.start > comma);
    if (!seg.length || !rest.length || !anyPred(rest)) break;
    const opener = fronted.length && coordinators.has(seg[0].lower) && seg[1] ? seg[1] : seg[0];
    let kind = null;
    if (subordinatorHere(opener) || (rows && subordinators.has(opener.lower) && rowAt(opener)?.deprel === "mark")) kind = "subordinate";
    else if (known && !seg.some((t) => isPred(t))) {
      // An ADJUNCT, not the sentence's subject: by the parse, nothing in it is a subject of the rest; by the prior, it opens with an
      // adposition, adverb or numeral (UD v2: obl and advmod are what front; a subject NP opens with DET/NOUN/PROPN/PRON).
      const subjOfRest = rows && seg.some((t) => { const r = rowAt(t); return r && /^(nsubj|csubj|expl)/.test(r.deprel) && rest.some((x) => rowAt(x)?.id === r.head); });
      const d = rows ? rowAt(opener)?.upos : tagOf(opener);
      const adjunctOpener = d === "ADP" || d === "ADV" || d === "NUM" || d === "SCONJ" || /^\d/.test(opener.tok);
      if (rows ? !subjOfRest : adjunctOpener) kind = "adjunct";
    }
    if (!kind) break;
    const last = fronted[fronted.length - 1];
    const from = (fronted.length && coordinators.has(seg[0].lower) ? seg[1] ?? seg[0] : seg[0]).start;
    if (last && last.relation === "adjunct" && kind === "adjunct") last.end = comma;
    else fronted.push({ start: from, end: comma, relation: kind });
    segStart = comma + 1;
  }
  const mainFrom = segStart;
  const mainTokens = tokens.filter((t) => t.start >= mainFrom);
  if (!mainTokens.length) return [{ start: 0, end: s.length, text: s, parentIndex: null, relation: "root" }];

  // BOUNDARY CANDIDATES inside the main stretch: each is { at (char offset a split happens BEFORE), relation }.
  const boundaries = [];

  // `;` and `:` — scanned over the raw string, not the token list, since
  // they are not themselves words.
  for (let i = mainFrom; i < s.length; i += 1) {
    if (inQuote(i)) continue;
    if (s[i] === ";") boundaries.push({ at: i + 1, relation: "coordinate" });
    else if (s[i] === ":") boundaries.push({ at: i + 1, relation: "elaborates" });
  }

  // Coordinators / subordinators / relativizers — scanned over tokens so
  // "next token" and "at least one prior token in this clause" are cheap
  // lookups, not string arithmetic.
  for (let i = 0; i < mainTokens.length; i += 1) {
    const t = mainTokens[i];
    if (inQuote(t.start)) continue;
    const before = s.slice(mainFrom, t.start);
    const afterComma = /,\s*$/.test(before);
    if (coordinators.has(t.lower) && i + 1 < mainTokens.length && subjectPronouns.has(mainTokens[i + 1].lower) && (!rows || /^(nsubj|expl)/.test(rowAt(mainTokens[i + 1])?.deprel ?? ""))) {
      boundaries.push({ at: t.start, relation: "coordinate" });
    } else if (coordinators.has(t.lower) && known && i > 0) {
      // A coordinator between two stretches that each hold a predicate: after a comma, or (with a parse) as the cc of a conjoined predicate.
      const nextComma = mainTokens.findIndex((x, k) => k > i && /,\s*$/.test(s.slice(mainFrom, x.start)) && x.start > t.end);
      const right = mainTokens.slice(i + 1, nextComma < 0 ? mainTokens.length : nextComma);
      const lastCut = boundaries.length ? boundaries[boundaries.length - 1].at : mainFrom;
      const left = mainTokens.slice(0, i).filter((x) => x.start >= lastCut);
      const r = rowAt(t), head = r && byId.get(r.head);
      const ccOfPred = !!(head && (head.upos === "VERB" || head.upos === "AUX") && /^conj/.test(head.deprel));
      if ((afterComma || ccOfPred) && anyPred(left) && anyPred(right)) boundaries.push({ at: t.start, relation: "coordinate" });
    } else if (i > 0 && (subordinatorHere(t) || (afterComma && rows && /PronType=Rel/.test(rowAt(t)?.feats ?? "")))) {
      const r = rowAt(t);
      const rel = relativizers.has(t.lower) || /PronType=Rel/.test(r?.feats ?? "") ? "relative" : "subordinate";
      // Without a parse the old rule stands (a listed subordinator splits); with one, a non-comma cut needs the parse's mark of an
      // adverbial/adnominal clause, and a relative needs its comma or its relative pronoun.
      if (!rows || afterComma || (r?.deprel === "mark" && clausal(byId.get(r.head)?.deprel)) || /PronType=Rel/.test(r?.feats ?? "")) boundaries.push({ at: t.start, relation: rel });
    }
  }

  // Sort, de-duplicate by offset (a ";"-adjacent coordinator etc.), and
  // drop any boundary at the main stretch's own start.
  boundaries.sort((a, b) => a.at - b.at);
  const cuts = [];
  for (const b of boundaries) {
    if (b.at <= mainFrom) continue;
    if (cuts.length && cuts[cuts.length - 1].at === b.at) continue;
    cuts.push(b);
  }

  // Build spans: fronted segments first, then the main stretch cut at its boundaries. The main clause is the ROOT. "elaborates" nests
  // under the clause immediately before it; every other relation (fronted ones included) nests under the root — a coordinate or
  // subordinate clause is scoped by the sentence's own main clause, not by whatever clause happened to sit textually before it.
  const trimmed = (rawStart, rawEnd) => {
    const raw = s.slice(rawStart, rawEnd);
    const clauseText = raw.trim();
    if (!clauseText) return null;
    // start/end bound the TRIMMED text exactly, so start+offset math downstream is exact, never off by a trimmed separator.
    return { start: rawStart + (raw.length - raw.trimStart().length), end: rawEnd - (raw.length - raw.trimEnd().length), text: clauseText };
  };
  const out = [];
  for (const f of fronted) { const sp = trimmed(f.start, f.end); if (sp) out.push({ ...sp, parentIndex: null, relation: f.relation, fronted: true }); }
  const rootIndex = out.length;
  const bounds = [mainFrom, ...cuts.map((c) => c.at), s.length];
  for (let i = 0; i < bounds.length - 1; i += 1) {
    const sp = trimmed(bounds[i], bounds[i + 1]);
    if (!sp) continue;
    const isRoot = out.length === rootIndex;
    const relation = isRoot ? "root" : cuts[i - 1].relation;
    const parentIndex = isRoot ? null : (relation === "elaborates" ? out.length - 1 : rootIndex);
    out.push({ ...sp, parentIndex, relation });
  }
  for (const o of out) if (o.fronted) o.parentIndex = out.length > rootIndex ? rootIndex : null;
  return out.length ? out : [{ start: 0, end: s.length, text: s, parentIndex: null, relation: "root" }];
}

/**
 * closedClassesFromPrior(posPrior) — a language's clause-boundary closed classes, DERIVED from a received UD POS prior
 * (priors/pos-<iso639-3>.json, POSPrior@1: every UPOS the treebank gave each form, with counts), never hand-typed:
 *   coordinators  = forms whose dominant tag is CCONJ;
 *   subordinators = forms whose dominant tag is SCONJ.
 * A POS prior carries no PronType, so it cannot tell a relative pronoun from a personal one: `relativizers` and `subjectPronouns`
 * come back EMPTY, and the result says so. A form split between tags is decided by its dominant tag (the same `dominant()` the rest
 * of this module uses): Spanish "que" (PRON 6,859 / SCONJ 6,348 in AnCora) is not a subordinator by that rule, as English "that" is
 * not one in priors.js — the same gap 1, measured in another language.
 */
export function closedClassesFromPrior(posPrior) {
  const coordinators = new Set(), subordinators = new Set();
  for (const [form, tags] of Object.entries(posPrior?.forms ?? {})) {
    const d = dominant(tags);
    if (d === "CCONJ") coordinators.add(form);
    else if (d === "SCONJ") subordinators.add(form);
  }
  return {
    coordinators, subordinators, relativizers: new Set(), subjectPronouns: new Set(),
    giver: posPrior?.provenance?.giver ?? null, language: posPrior?.language ?? null,
    disclosed: "relativizers and subject pronouns are not derivable from a POS prior (no PronType): empty, not guessed",
  };
}

const dominant = (tags) => {
  const entries = Object.entries(tags ?? {});
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0]?.[0];
};

/**
 * propositionSpans(text, opts) → [{ start, end, text, parentIndex, relation, sharesSubjectWith }]
 *
 * A CLAUSE is a syntactic container; a PROPOSITION is one predicate holding
 * over its arguments — this codebase's own GFP triple, {end1, label, end2}.
 * They are not the same thing: "she was awarded a degree and began work"
 * is ONE clause (one subject, no second subject anywhere) but TWO
 * propositions (`awarded`, `began`), each licensed by its own verb, both
 * taking the same unstated subject. clauseSpans alone cannot see this — it
 * only splits where a NEW subject appears. This function runs clauseSpans
 * first, then looks INSIDE each clause for a compound predicate: a
 * CLAUSE_COORDINATOR whose next token is measured VERB/AUX-dominant in the
 * received POS prior (the same `dominant()` a caller already trusts
 * elsewhere in this codebase — never a new hand list), rather than a
 * subject (clauseSpans already split there if it was one).
 *
 * `sharesSubjectWith` — the index (into the returned array) of the sibling
 * proposition this one's subject is elided from, or `null`. Deliberately a
 * POINTER, never a copied/guessed subject string: this codebase already
 * has a measured, disclosed reason the positional/SVO reader that would
 * try to actually EXTRACT "she" as a subject phrase fails on real prose
 * (reader-bundle.js's own header, the 2026-09-20 Grant-sentence finding) —
 * asserting a subject this function did not measure would be exactly that
 * mistake again. A caller wanting the real subject text follows the
 * pointer to the sibling proposition's own span instead.
 *
 * REQUIRES `opts.posPrior` — without a received tag distribution to check
 * VERB/AUX-dominance against, no predicate-split can be measured, so
 * clause spans pass through unchanged (kept, never guessed) rather than
 * splitting on a guess about what looks verb-shaped.
 */
export function propositionSpans(text, opts = {}) {
  const clauses = clauseSpans(text, opts);
  const posPrior = opts.posPrior ?? null;
  if (!posPrior) return clauses.map((c) => ({ ...c, sharesSubjectWith: null, verbStart: null, verbEnd: null }));

  const coordinators = opts.coordinators ?? CLAUSE_COORDINATORS;
  const isVerbDominant = (tok) => {
    const e = posPrior.forms?.[tok.toLowerCase()];
    if (!e) return false;
    const d = dominant(e);
    return d === "VERB" || d === "AUX";
  };

  const out = [];
  for (const clause of clauses) {
    const tokens = [...clause.text.matchAll(WORD)].map((m) => ({ tok: m[0], start: m.index, end: m.index + m[0].length }));
    let cut = null, verbTok = null;
    for (let i = 0; i < tokens.length; i += 1) {
      const t = tokens[i];
      if (i > 0 && coordinators.has(t.tok.toLowerCase()) && i + 1 < tokens.length && isVerbDominant(tokens[i + 1].tok)) {
        cut = t.start;
        verbTok = tokens[i + 1];
        break; // narrowest true split first; a caller re-running on the remainder finds any further ones
      }
    }
    if (cut === null) {
      out.push({ ...clause, sharesSubjectWith: null, verbStart: null, verbEnd: null });
      continue;
    }
    const firstText = clause.text.slice(0, cut).trim();
    const secondText = clause.text.slice(cut).trim();
    const firstIndex = out.length;
    // clause.start is exact (clauseSpans now bounds trimmed text precisely,
    // see its own fix above) so clause.start + a clause.text offset is a
    // true global offset — this is what makes verbStart/verbEnd trustworthy
    // for a caller to slice the ORIGINAL text with, not just clause.text.
    out.push({ start: clause.start, end: clause.start + cut, text: firstText, parentIndex: clause.parentIndex, relation: clause.relation, sharesSubjectWith: null, verbStart: null, verbEnd: null });
    out.push({ start: clause.start + cut, end: clause.end, text: secondText, parentIndex: clause.parentIndex, relation: "coordinate-predicate", sharesSubjectWith: firstIndex, verbStart: clause.start + verbTok.start, verbEnd: clause.start + verbTok.end });
  }
  return out;
}
