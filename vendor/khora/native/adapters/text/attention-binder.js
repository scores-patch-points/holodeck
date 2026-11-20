// adapters/text/attention-binder.js — BIND "IT" AND "THE TOWER" TO THE ATTENDED NON-PERSON REFERENT (2026-11-03).
//
// pronouns.js binds he/she over the cast. Nothing bound a sentence whose subject is "It" or "The tower", so a text about a tower left a
// quarter of its sentences about nothing. This organ reads what a sentence is ABOUT when its subject is the neuter pronoun (priors.js::
// NEUTER_THIRD_PERSON) or a sentence-initial definite description, and binds it to the referent the reader is attending to: the cast being
// whose decayed PRESENCE (kernel/activation.js, the same gradient the he/she rungs read) is highest over the sentences BEFORE this one.
//
// EARNED, NEVER TYPED. Candidates are cast referents; no noun, synonym or kind is typed here. A definite description reaches a referent
// through words the TEXT gave that referent, two ways, both recomputed from the bytes read so far:
//   · surface words  every word of a candidate's own cast surface ("Statue of Liberty" → statue; "Eiffel Tower" → tower);
//   · predicate kind the noun phrase the text predicates of the referent with a copula, up to the first determiner, clause opener or comma (capitalised words are names, left out)
//                    ("Concorde is a British-French supersonic airliner" → airliner). The classes that end the phrase are the
//                    received closed classes of priors.js (determiners, clause openers, copula forms), not lists of this file.
// WHO IS NOT A PERSON. `nonPersonal` is the caller's ruling (non-personal.js: time names + the lexicon giver, a referent is non-person only
// when every surface is). Given, candidates are exactly that set. Absent (no giver on the machine), candidates are every cast referent the
// text itself does not show to be a person (a gendered pronoun in the clause of its sole naming, pronouns.js's own evidence), and the
// result says `ruling: "text_evidence"` so a reader never mistakes the weaker ruling for the giver's.
//
// TYPED GAPS, NEVER GUESSES. A target is left unbound, with a reason, when no candidate is present (`below_floor`), when the lead over the
// runner-up is thin (`no_margin`), when the previous sentence's subject was another referent or a description the cast does not know
// (`center_elsewhere`: the pronoun most likely continues THAT), or when an earlier clause-mate of the pronoun is another candidate
// (`clause_mate`). `minActivation`, `minMargin` and `window` are declared by the caller; none is defaulted.
//
//   bindAttended(sentences, mentions, { window, minActivation, minMargin, boost, nonPersonal?, feed?, centerVeto?, clauseMateVeto? })
//     sentences  [{ text, offset, order }]            the entry's sentences, offsets in the space of `mentions`
//     mentions   [{ ref, start, end }]                every mention of every cast being (entry.cast[].mentionSpans)
//     → { bindings: [{ referentId, kind, surface, at: [start, end], sentenceOrder, activation, margin, via }], gaps: [...], ruling }
//
// This file does not touch pronouns.js: he/she resolve exactly as before. A "person" pronoun is never looked at here.

import { createActivation } from "../../kernel/activation.js";
import { sameClause, findThirdPersonSingular } from "./pronouns.js";
import {
  NEUTER_THIRD_PERSON, DEFINITE_DETERMINERS, INDEFINITE_DETERMINERS, ANAPHORIC_PRONOUNS, CLAUSE_OPENERS, CLAUSE_COORDINATORS, AUXILIARY_VERBS,
} from "./priors.js";
import { COPULA_FORMS } from "./phasepost.js";

export const CELL = Object.freeze({ op: "CON", grain: "Figure" });

const TOKEN = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;
const wordsOf = (text) => [...text.matchAll(TOKEN)].map((m) => ({ w: m[0], i: m.index, end: m.index + m[0].length }));
const bare = (w) => w.replace(/['’]s$/i, "");
const isCapital = (w) => /^\p{Lu}/u.test(w);
// "the", "a" … but not the demonstratives, which point at something nearer than the attended referent
const ARTICLE = (w) => DEFINITE_DETERMINERS.has(w.toLowerCase()) && !ANAPHORIC_PRONOUNS.has(w.toLowerCase());
const DETERMINER = (w) => DEFINITE_DETERMINERS.has(w.toLowerCase()) || INDEFINITE_DETERMINERS.has(w.toLowerCase());

/** The words the text gave a referent as a KIND: the noun phrase it predicates of the referent after a copula. [] when there is none. */
export function predicateKind(rest) {
  const toks = wordsOf(rest.replace(/\([^)]*\)/g, (m) => " ".repeat(m.length)));
  const cop = toks.findIndex((t, k) => k < 4 && COPULA_FORMS.has(t.w.toLowerCase()));
  if (cop < 0 || !toks[cop + 1] || !DETERMINER(toks[cop + 1].w)) return [];
  const out = [];
  for (let k = cop + 2; k < toks.length; k++) {
    const t = toks[k];
    const between = rest.slice(toks[k - 1].end, t.i);
    if (/[,;:.]/.test(between) || DETERMINER(t.w) || CLAUSE_OPENERS.has(t.w.toLowerCase()) || CLAUSE_COORDINATORS.has(t.w.toLowerCase())) break;
    if (!isCapital(t.w)) out.push(t.w.toLowerCase()); // a capitalised word is a name or a nationality, not the kind
  }
  return out;
}

export function bindAttended(sentences, mentions, options = {}) {
  const { window, minActivation, minMargin, boost, nonPersonal = null, feed, centerVeto, clauseMateVeto } = options;
  // ROUND-2 options (PREREG-ATTENTION-A2.md). Absent, each is off and the call is byte for byte the round-1 call.
  const { minWordShare = null, carryVeto = false, expletiveVeto = false, demonstrativeSubject = false, causalWords = false } = options;
  // ROUND-3 options (PREREG-ATTENTION-A3.md). Absent, each is off.
  const { lineStarts = false, npHead = false, tieResolve = false, foldPlural = false, neverSilent = false, contextMinUses = null } = options;
  // ROUND-4 options (PREREG-ATTENTION-A4.md). Absent, each is off and the call is the round-3 call, byte for byte.
  const { bearerShare = null, weakRouteCarry = false, centerRivalShare = null, openerReset = false } = options;
  // ROUND-5 option (PREREG-ATTENTION-A5.md). Absent, off: the call is the round-4 call, byte for byte.
  const { capitalTargets = false } = options;
  if (typeof capitalTargets !== "boolean") throw new TypeError("bindAttended: capitalTargets is true or false");
  for (const [k, v] of Object.entries({ bearerShare, centerRivalShare })) if (v !== null && (!Number.isFinite(v) || v <= 0 || v > 1)) throw new TypeError(`bindAttended: ${k} is null (off) or a declared share in (0, 1]`);
  for (const [k, v] of Object.entries({ weakRouteCarry, openerReset })) if (typeof v !== "boolean") throw new TypeError(`bindAttended: ${k} is true or false`);
  if (contextMinUses !== null && (!Number.isInteger(contextMinUses) || contextMinUses < 1)) throw new TypeError("bindAttended: contextMinUses is null (off) or a declared count of at least 1");
  for (const [k, v] of Object.entries({ lineStarts, npHead, tieResolve, foldPlural, neverSilent })) if (typeof v !== "boolean") throw new TypeError(`bindAttended: ${k} is true or false`);
  if (minWordShare !== null && (!Number.isFinite(minWordShare) || minWordShare < 0 || minWordShare > 1)) throw new TypeError("bindAttended: minWordShare is null (off) or a declared share in [0, 1]");
  for (const [k, v] of Object.entries({ carryVeto, expletiveVeto, demonstrativeSubject, causalWords })) if (typeof v !== "boolean") throw new TypeError(`bindAttended: ${k} is true or false`);
  if (window !== null && (!Number.isFinite(window) || window <= 1)) throw new TypeError("bindAttended: window is declared (a number above 1, or null for the undecayed control)");
  if (!Number.isFinite(minActivation) || minActivation < 0) throw new TypeError("bindAttended: minActivation is declared — how faint still binds is never a default");
  if (!Number.isFinite(minMargin) || minMargin < 0 || minMargin > 1) throw new TypeError("bindAttended: minMargin is declared — how far a candidate must lead is never a default");
  if (!Number.isFinite(boost) || boost < 1) throw new TypeError("bindAttended: boost is declared (1 weighs every mention alike; above 1 the sentence's first naming, the subject's position proxy, counts more)");
  if (typeof feed !== "boolean" || typeof centerVeto !== "boolean" || typeof clauseMateVeto !== "boolean")
    throw new TypeError("bindAttended: feed, centerVeto and clauseMateVeto are declared (true or false), never defaulted");

  let sents = [...(sentences ?? [])];
  // LINE STARTS: the extracted text keeps a section heading on the line before the sentence it heads ("== Description ==\nThe facility …"), and a table
  // row or list item is its own unit. Each line is a sentence of its own for the binder; a line that is only heading markup is not read at all.
  if (lineStarts) {
    const split = []; let order = 0; let afterHeading = false;
    for (const s of sents) {
      let at = 0;
      for (const line of s.text.split("\n")) {
        const off = at; at += line.length + 1;
        if (!/\S/.test(line)) continue;
        if (/^\s*=+[^=]*=+\s*$/.test(line)) { afterHeading = true; continue; }
        split.push({ ...s, text: line, offset: s.offset + off, order: order++, afterHeading });
        afterHeading = false;
      }
    }
    sents = split;
  }
  const F = (w) => (foldPlural && w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
  const norm = (w) => F(bare(w).toLowerCase());
  // LONGEST NAMING CLAIMS ITS BYTES, as pronouns.js's matcher does: a mention that overlaps a longer mention of another being ("Hoover" inside
  // "Hoover Dam", "The Gateway" across "Gateway Arch") is not a second firing of that other being.
  const all = [...(mentions ?? [])];
  const kept = all.filter((m) => !all.some((o) => o.ref !== m.ref && o.start < m.end && m.start < o.end && o.end - o.start > m.end - m.start));
  const allRefs = new Set(kept.map((m) => m.ref));
  const mentionsIn = (s) => kept.filter((m) => m.start >= s.offset && m.end <= s.offset + s.text.length).sort((a, b) => a.start - b.start);

  // WHO MAY BE "IT". With the giver's ruling: exactly the set. Without: every referent the text does not show to be a person.
  let candidates; let ruling;
  if (nonPersonal) { candidates = new Set([...nonPersonal].filter((r) => allRefs.has(r))); ruling = "giver"; }
  else {
    const person = new Set();
    for (const s of sents) {
      const ms = mentionsIn(s); const named = new Set(ms.map((m) => m.ref));
      const hits = findThirdPersonSingular(s.text, "en");
      if (named.size === 1) {
        const [only] = named;
        for (const hit of hits) if (ms.some((m) => sameClause(s.text, m.start - s.offset, hit.index))) person.add(only);
      }
    }
    candidates = new Set([...allRefs].filter((r) => !person.has(r)));
    ruling = "text_evidence";
  }

  const activation = createActivation({ window });
  const cum = createActivation({ window: null }); // the undecayed count: who the document has been about, read at a section opener (openerReset)
  const surfaceWords = new Map(); // ref → Set of lower-cased words of its own surfaces (filled from the mentions' bytes)
  const kindWords = new Map();    // ref → Set of predicate-kind words
  const mentionCount = new Map(); // ref → how many of its mentions were read so far
  const wordMentions = new Map(); // ref → Map word → how many of those mentions carried the word (its bytes or the noun phrase around them)
  const nameWords = new Map();    // ref → words of its own cast surfaces, determiners left out (for "a part of another's name")
  const ctxUses = new Map();      // word → { total, by: Map ref → uses in sentences that were about that being }
  const ctxOK = (w, r) => { const u = ctxUses.get(w); return contextMinUses !== null && !!u && (u.by.get(r) ?? 0) >= contextMinUses && (u.by.get(r) ?? 0) / u.total >= 0.5; };
  const wordsOfRef = (r) => new Set([...(surfaceWords.get(r) ?? []), ...(kindWords.get(r) ?? [])]);
  const viaOf = (r, w) => (surfaceWords.get(r)?.has(w) ? "surface-word" : kindWords.get(r)?.has(w) ? "predicate-kind" : "context-word");

  const bindings = []; const gaps = [];
  let prevCarried = new Set(); // the beings the previous sentence named or bound
  let prevSubject = null; // { kind: "ref", ref } | { kind: "unbound-description" } | null — what the previous sentence was about at its start

  const rank = (refs) => refs.map((r) => [r, activation.activationOf(r)]).sort((a, b) => b[1] - a[1]);
  const decide = (ranked) => {
    if (!ranked.length || ranked[0][1] <= 0) return { gap: "no_candidate" };
    const [top, score] = ranked[0];
    if (score < minActivation) return { gap: "below_floor", top, activation: score };
    const second = ranked[1]?.[1] ?? 0; const margin = score > 0 ? (score - second) / score : 0;
    if (margin < minMargin) return { gap: "no_margin", top, runnerUp: ranked[1]?.[0] ?? null, activation: score, margin };
    return { ref: top, activation: score, margin };
  };

  for (const s of sents) {
    const ms = mentionsIn(s);
    // SECTION OPENER (openerReset): the sentence right after a heading. Presence has faded across the break and the previous sentence belongs to another section, so
    // candidates are ranked by the undecayed count of the document and the centre and carry vetoes (which read the previous sentence) do not apply.
    const opener = openerReset && s.afterHeading === true;
    const actOf = (r) => (opener ? cum.activationOf(r) : activation.activationOf(r));
    const rk = (refs) => (opener ? refs.map((r) => [r, cum.activationOf(r)]).sort((a, b) => b[1] - a[1]) : rank(refs));
    const register = () => {
    // the surface words of everything named here (the words of the bytes, from the cast's own spans)
      for (const m of ms) {
        const set = surfaceWords.get(m.ref) ?? new Set();
        const here = new Set(); // the words THIS mention carries, for the word's share of the being's naming
        for (const t of wordsOf(s.text.slice(m.start - s.offset, m.end - s.offset))) { set.add(norm(t.w)); here.add(norm(t.w)); }
        // the noun phrase that CONTAINS the name: the words between its determiner and the name ("the Statue of | Liberty" → statue, of)
        const left = wordsOf(s.text.slice(Math.max(0, m.start - s.offset - 40), m.start - s.offset)).map((t) => ({ ...t, i: t.i + Math.max(0, m.start - s.offset - 40), end: t.end + Math.max(0, m.start - s.offset - 40) }));
        const np = [];
        for (let k = left.length - 1; k >= 0 && np.length < 3; k--) {
          const gap = s.text.slice(left[k].end, k + 1 < left.length ? left[k + 1].i : m.start - s.offset);
          if (/[^\s]/.test(gap)) break;
          if (DETERMINER(left[k].w)) { for (const t of np) { set.add(norm(t.w)); here.add(norm(t.w)); } break; }
          np.unshift(left[k]);
        }
        surfaceWords.set(m.ref, set);
        const nw = nameWords.get(m.ref) ?? new Set();
        for (const t of wordsOf(s.text.slice(m.start - s.offset, m.end - s.offset))) if (!DETERMINER(t.w)) nw.add(norm(t.w));
        nameWords.set(m.ref, nw);
        mentionCount.set(m.ref, (mentionCount.get(m.ref) ?? 0) + 1);
        const wm = wordMentions.get(m.ref) ?? new Map();
        for (const w of here) wm.set(w, (wm.get(w) ?? 0) + 1);
        wordMentions.set(m.ref, wm);
      }
    };
    if (!causalWords) register(); // round 1: the sentence's own namings are known before its targets are decided
    const toks = wordsOf(s.text);
    const inMention = (i) => ms.some((m) => i >= m.start - s.offset && i < m.end - s.offset);

    // TARGETS: the neuter pronouns, and a sentence-initial definite description "The <w>"
    const targets = [];
    for (const t of toks) if (NEUTER_THIRD_PERSON.has(t.w.toLowerCase())) {
      if (!inMention(t.i)) targets.push({ kind: "pronoun", w: t.w, i: t.i, end: t.end });
      else if (neverSilent) gaps.push({ sentenceOrder: s.order, surface: t.w, at: [s.offset + t.i, s.offset + t.end], kind: "pronoun", reason: "inside_cast_mention", detail: "the pronoun's bytes are inside a cast naming: nothing was decided" });
    }
    if (toks.length >= 2 && ARTICLE(toks[0].w) && !isCapital(toks[1].w) && s.text.slice(0, toks[0].i).replace(/[\s"“'‘(\[]/g, "") === "") {
      const heads = [toks[1]];
      // NP HEAD: the words after the article up to three, ended by a closed class (copula, auxiliary, determiner, clause opener, coordinator) or a capital
      if (npHead) for (let k = 2; k < Math.min(toks.length, 4); k++) {
        const w = toks[k].w.toLowerCase();
        if (isCapital(toks[k].w) || /[,;:.]/.test(s.text.slice(toks[k - 1].end, toks[k].i)) || COPULA_FORMS.has(w) || AUXILIARY_VERBS.has(w) || DETERMINER(w) || CLAUSE_OPENERS.has(w) || CLAUSE_COORDINATORS.has(w)) break;
        heads.push(toks[k]);
      }
      targets.push({ kind: "description", w: toks[1].w, heads, i: toks[0].i, end: toks[1].i + bare(toks[1].w).length });
    }

    // CAPITALISED TARGETS (capitalTargets): a sentence-initial article followed by a capitalised word is a name or an alias, not a lower-case description, and round 4 filed
    // nothing for it ("The ISS", "The LHC Computing Grid", "The Mayflower crew" were silent). Now every such article ends as a binding or a typed gap, by construction.
    if (capitalTargets && toks.length >= 1 && ARTICLE(toks[0].w) && s.text.slice(0, toks[0].i).replace(/[\s"“'‘(\[]/g, "") === "" && !(toks.length >= 2 && !isCapital(toks[1].w)))
      targets.push({ kind: "capital", w: toks[0].w, i: toks[0].i, end: toks[0].end });

    // causal: the ranking below reads only what sentences BEFORE this one fired
    for (const t of targets) {
      const abs = [s.offset + t.i, s.offset + t.end];
      let base = { sentenceOrder: s.order, surface: s.text.slice(t.i, t.end), at: abs, kind: t.kind };
      if (t.kind === "capital") {
        if (toks.length < 2) { gaps.push({ ...base, reason: "article_alone", detail: "a sentence-initial article with nothing after it" }); continue; }
        const nameAt = toks[1];
        // read as a being when a cast mention covers the capitalised word (longest naming); the name ends where a closed class, punctuation or the end of the line follows it
        const M = ms.filter((m) => m.start - s.offset <= nameAt.end && m.end - s.offset >= nameAt.i).sort((a, b) => (b.end - b.start) - (a.end - a.start))[0]; // the cast may begin the naming AT the article ("The ISS")
        const span = (to) => ({ ...base, surface: s.text.slice(t.i, to), at: [s.offset + t.i, s.offset + to] });
        if (!M) { gaps.push({ ...span(nameAt.end), reason: "capitalised_unknown_name", detail: `"${nameAt.w}" is capitalised and no cast being is named there` }); continue; }
        const mEnd = M.end - s.offset;
        const next = toks.find((x) => x.i >= mEnd);
        const lw = next?.w.toLowerCase();
        const closes = !next || /[,;:.)\]]/.test(s.text.slice(mEnd, next.i)) || COPULA_FORMS.has(lw) || AUXILIARY_VERBS.has(lw) || DETERMINER(lw) || CLAUSE_OPENERS.has(lw) || CLAUSE_COORDINATORS.has(lw);
        if (!closes) { gaps.push({ ...span(next.end), reason: "capitalised_name_open_word", top: M.ref, detail: `"${s.text.slice(nameAt.i, mEnd)}" is followed by "${next.w}": a part of the being, or a verb; the binder cannot tell` }); continue; }
        if (!candidates.has(M.ref)) { gaps.push({ ...span(mEnd), reason: "capitalised_name_not_candidate", top: M.ref, detail: "the name is a cast being the ruling does not allow for 'it'" }); continue; }
        bindings.push({ ...span(mEnd), kind: "name", referentId: M.ref, activation: activation.activationOf(M.ref), margin: null, via: "cast-name" });
        continue;
      }
      if (t.kind === "description") {
        let word = norm(t.w);
        const poolOf = (w) => [...candidates].filter((r) => wordsOfRef(r).has(w) || ctxOK(w, r));
        let pool = poolOf(word);
        if (npHead && t.heads.length > 1) { // the rightmost word of the noun phrase that some candidate owns is its head; the address ends there
          for (let k = t.heads.length - 1; k >= 0; k--) { const pk = poolOf(norm(t.heads[k].w)); if (pk.length) { word = norm(t.heads[k].w); pool = pk; base = { ...base, surface: s.text.slice(t.i, t.heads[k].i + bare(t.heads[k].w).length), at: [s.offset + t.i, s.offset + t.heads[k].i + bare(t.heads[k].w).length] }; break; } }
        }
        if (!pool.length) { gaps.push({ ...base, reason: "description_unbound", detail: `no candidate has "${word}" among the words the text gave it` }); continue; }
        const d = decide(rk(pool));
        if (d.gap) { gaps.push({ ...base, reason: `description_${d.gap}`, top: d.top ?? null, runnerUp: d.runnerUp ?? null, activation: d.activation ?? 0, margin: d.margin ?? null }); continue; }
        // THE OWNER OF THE WORD MUST BE A PLAUSIBLE BEARER (bearerShare): a description is judged against the topic as well as against the word. The topic is who the DOCUMENT
        // has been about so far (the undecayed count, which the cast's splits and a recent aside do not move); an owner of the word with less than a declared share of the
        // topic's weight most likely names something the owner is not ("The church" in a text about Hagia Sophia is not "Eastern Orthodox Church"): a typed gap.
        if (bearerShare !== null) {
          const topDoc = [...candidates].map((r) => [r, cum.activationOf(r)]).sort((a, b) => b[1] - a[1])[0];
          if (topDoc && topDoc[0] !== d.ref && cum.activationOf(d.ref) < bearerShare * topDoc[1]) {
            gaps.push({ ...base, reason: "description_off_topic", top: d.ref, topic: topDoc[0], weight: cum.activationOf(d.ref), topicWeight: topDoc[1], detail: "the owner of the word carries less than the declared share of what the document has been about" });
            continue;
          }
        }
        // THE WEAKER ROUTES NEED CONTINUITY (weakRouteCarry): a kind or a context word is evidence about the being, but not that THIS sentence continues it.
        if (weakRouteCarry && !opener && viaOf(d.ref, word) !== "surface-word" && !prevCarried.has(d.ref)) {
          gaps.push({ ...base, reason: "description_weak_route", top: d.ref, via: viaOf(d.ref, word), detail: "the word is the being's kind or a habit of its sentences, and the previous sentence did not carry it" });
          continue;
        }
        // A POOL OF ONE IS NOT CONFIDENCE. Alone, a candidate has margin 1 by default; judged instead against the being's own naming: the share of
        // its mentions that carried the word (1 when the text predicated the word of it as its kind). "Middle Tennessee" had "river" in 1 of 8 mentions.
        if (minWordShare !== null && wordsOfRef(d.ref).has(word)) {
          const share = kindWords.get(d.ref)?.has(word) ? 1 : (wordMentions.get(d.ref)?.get(word) ?? 0) / (mentionCount.get(d.ref) || 1);
          if (share < minWordShare) { gaps.push({ ...base, reason: "description_weak_word", top: d.ref, wordShare: share, activation: d.activation, margin: d.margin, detail: `"${word}" is in ${(share * 100).toFixed(0)}% of ${d.ref}'s mentions` }); continue; }
        }
        bindings.push({ ...base, referentId: d.ref, activation: d.activation, margin: d.margin, via: viaOf(d.ref, word) });
        continue;
      }
      // a pronoun
      if (expletiveVeto && t.w.toLowerCase() === "it") {
        // EXPLETIVE OR CLEFT "it": "It is said that…", "It was in 1889 that…": a copula or auxiliary follows and, in the same clause, the complementizer
        const after = wordsOf(s.text.slice(t.end)); let cut = s.text.length - t.end;
        const stop = /[,;:.]/.exec(s.text.slice(t.end)); if (stop) cut = stop.index;
        const clause = after.filter((a) => a.i < cut).slice(0, 10);
        const verbAt = clause.slice(0, 2).findIndex((a) => COPULA_FORMS.has(a.w.toLowerCase()) || AUXILIARY_VERBS.has(a.w.toLowerCase()));
        if (verbAt >= 0 && clause.some((a, k) => k > verbAt && a.w.toLowerCase() === "that")) { gaps.push({ ...base, reason: "expletive_or_cleft", detail: "a copula and a complementizer follow in the same clause: the pronoun has no referent" }); continue; }
      }
      const ranked = rk([...candidates]);
      let d = decide(ranked);
      if (tieResolve && d.gap === "no_margin") {
        // TIED CANDIDATES are decided from the text before they are refused: first by the fuller name (one candidate's name is a part of the other's: "Panama" and
        // "The Panama Canal" are one thing the cast split), then by which candidate the previous sentence made its subject or bound
        const topAct = ranked[0][1]; const T = ranked.filter(([, a]) => a >= topAct * (1 - minMargin)).map(([r]) => r);
        const nw = (r) => nameWords.get(r) ?? new Set();
        const full = T.filter((r) => nw(r).size && T.every((o) => o === r || [...nw(o)].every((w) => nw(r).has(w))));
        let pick = null;
        if (full.length >= 1) pick = full.sort((a, b) => (mentionCount.get(b) ?? 0) - (mentionCount.get(a) ?? 0))[0];
        else if (prevSubject?.kind === "ref" && T.includes(prevSubject.ref)) pick = prevSubject.ref;
        else { const carried = T.filter((r) => prevCarried.has(r)); if (carried.length === 1) pick = carried[0]; }
        if (pick) d = { ref: pick, activation: ranked.find(([r]) => r === pick)[1], margin: d.margin, via: "attended-tie" };
      }
      if (d.gap) { gaps.push({ ...base, reason: `pronoun_${d.gap}`, top: d.top ?? null, runnerUp: d.runnerUp ?? null, activation: d.activation ?? 0, margin: d.margin ?? null }); continue; }
      // CENTRE VETO, REVISITED (centerRivalShare): the previous sentence's subject is a rival only if it is itself present enough: its presence a declared share of the chosen being's.
      const rivalPresent = centerRivalShare === null || prevSubject?.kind !== "ref" || actOf(prevSubject.ref) >= centerRivalShare * d.activation;
      if (centerVeto && !opener && prevSubject && (prevSubject.kind === "unbound-description" || (prevSubject.kind === "ref" && prevSubject.ref !== d.ref && rivalPresent))) {
        gaps.push({ ...base, reason: "center_elsewhere", top: d.ref, detail: prevSubject.kind === "ref" ? `the previous sentence began with ${prevSubject.ref}` : "the previous sentence began with a description the cast does not know" });
        continue;
      }
      if (carryVeto && !opener && !prevCarried.has(d.ref)) {
        gaps.push({ ...base, reason: "center_not_carried", top: d.ref, detail: "the previous sentence neither named nor referred to the attended being: the pronoun most likely continues something else" });
        continue;
      }
      if (clauseMateVeto) {
        const mate = ms.find((m) => m.ref !== d.ref && candidates.has(m.ref) && m.end - s.offset <= t.i && sameClause(s.text, m.start - s.offset, t.i));
        if (mate) { gaps.push({ ...base, reason: "clause_mate", top: d.ref, detail: `${mate.ref} is named earlier in the pronoun's clause` }); continue; }
      }
      bindings.push({ ...base, referentId: d.ref, activation: d.activation, margin: d.margin, via: d.via ?? "attended" });
    }

    if (causalWords) register(); // round 2: a target sees only what sentences BEFORE its own named (the tail of its own sentence is not evidence)

    // what this sentence was about at its start, for the next sentence's pronoun
    const first = toks[0] && ms.find((m) => m.start - s.offset <= toks[0].i + 1 && candidates.has(m.ref)); // a person at the head of the sentence is not a rival for "it"
    const bound = bindings.find((b) => b.sentenceOrder === s.order && b.kind === "description");
    if (first) prevSubject = { kind: "ref", ref: first.ref };
    else if (targets.some((t) => t.kind === "description")) prevSubject = bound ? { kind: "ref", ref: bound.referentId } : { kind: "unbound-description" };
    else if (demonstrativeSubject && toks.length >= 2 && DETERMINER(toks[0].w) && !isCapital(toks[1].w) && s.text.slice(0, toks[0].i).replace(/[\s"“'‘(\[]/g, "") === "") {
      // a demonstrative or indefinite noun phrase opened the sentence ("These objections…"): about its own noun unless the cast gave a candidate that word
      const w1 = norm(toks[1].w); const pool1 = [...candidates].filter((r) => wordsOfRef(r).has(w1) || ctxOK(w1, r));
      prevSubject = pool1.length === 1 ? { kind: "ref", ref: pool1[0] } : { kind: "unbound-description" };
    } else prevSubject = null;
    prevCarried = new Set([...ms.filter((m) => candidates.has(m.ref)).map((m) => m.ref), ...bindings.filter((b) => b.sentenceOrder === s.order).map((b) => b.referentId)]);

    // predicate kinds, from the sentence just read (available to LATER sentences only)
    for (const m of ms) {
      const kind = predicateKind(s.text.slice(m.end - s.offset));
      if (kind.length) { const set = kindWords.get(m.ref) ?? new Set(); kind.forEach((k) => set.add(F(k))); kindWords.set(m.ref, set); }
      break; // the sentence's first naming only: its subject
    }

    // context words: the lower-case words of a sentence are attributed to the being the sentence was about (its first naming, else what it bound)
    if (contextMinUses !== null) {
      const subj = (ms.length && candidates.has(ms[0].ref) ? ms[0].ref : null) ?? bindings.find((b) => b.sentenceOrder === s.order)?.referentId ?? null;
      for (const w of new Set(toks.filter((t) => !isCapital(t.w) && !inMention(t.i)).map((t) => norm(t.w)))) {
        const u = ctxUses.get(w) ?? { total: 0, by: new Map() }; u.total++; if (subj) u.by.set(subj, (u.by.get(subj) ?? 0) + 1); ctxUses.set(w, u);
      }
    }
    // the sentence's FIRST naming counts `boost` times: a position proxy for the grammatical subject (pronouns.js's presence rung), not a parse
    const fired = ms.filter((m) => candidates.has(m.ref)).map((m) => m.ref);
    if (ms.length && candidates.has(ms[0].ref)) for (let k = 1; k < boost; k++) fired.push(ms[0].ref);
    if (feed) for (const b of bindings) if (b.sentenceOrder === s.order && b.kind !== "name") fired.push(b.referentId);
    activation.observe(fired);
    cum.observe(fired);
  }
  return { bindings, gaps, ruling };
}
