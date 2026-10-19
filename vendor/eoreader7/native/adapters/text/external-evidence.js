// external-evidence.js — what a dictionary, Wikipedia and Wikidata say about a form, as WITNESSES.
//
// PURE. No fetch call anywhere in this file — the wall wikidata.js and web.js already stand behind
// (a server, or the page's own crossing, owns the network; this file owns the shape). It parses the
// three public payloads, turns each into evidence with its giver, license, address and retrieval
// time, and nominates it to the hyperlexicon.
//
// THE HYPERLEXICON WALL, kept. HL is a ledger of relation-composition affordances, not a vocabulary:
// experience may NOMINATE a candidate and witness it; only a GIVEN affordance — a named giver bound
// to a charter — licenses anything. A dictionary entry or a Wikidata item is a witness with a name
// and an address; it is never a giver here. So every row this file produces enters HL as
// `candidate`, licenseStanding says so, and the reading may use it as evidence (an attestation, with
// the source named) but never as permission.
//
// THREE SOURCES, THREE KINDS OF CLAIM — kept apart:
//   dictionary (Wiktionary) — a form is attested as a part of speech. Attestation, no frequency.
//   Wikipedia               — an article exists under a title; it may be a disambiguation page. Its
//                             short description is NOT read as an entity type (wikidata.js measured
//                             that refusal: the summary of Andrew Johnson says "President", the
//                             office he is most famous for, not the one being asked about).
//   Wikidata                — typed candidates for a name. AMBIGUITY KEPT: "Andrew Johnson" is three
//                             entities. Which one a text means is identity, which is settled by
//                             consequence (holodeck-links.js's gate), never by a name matching.
import { admitHyperlexiconCandidates, createHyperlexicon } from "../../kernel/hyperlexicon.js";
import { THRAX_MAP, normalizeForm } from "./wordclass.js";

export const EXTERNAL_EVIDENCE_SCHEMA = "EOExternalEvidence@1";
export const SOURCES = Object.freeze({
  dictionary: Object.freeze({ giver: "en.wiktionary.org", license: "CC BY-SA 4.0", via: "Wiktionary REST definition API" }),
  wikipedia: Object.freeze({ giver: "en.wikipedia.org", license: "CC BY-SA 4.0", via: "Wikipedia REST page summary" }),
  wikidata: Object.freeze({ giver: "wikidata.org", license: "CC0 1.0", via: "Wikidata wbsearchentities" }),
});
export const ALPHA = 1; // Laplace smoothing of a match proportion — declared, as document-evidence.js declares it

/** Wiktionary part-of-speech headings → UD UPOS. A heading that names no class (Phrase, Prefix, Contraction…) maps to null: kept as a heading, never forced. */
export const UPOS_OF_HEADING = Object.freeze({
  Noun: "NOUN", "Proper noun": "PROPN", Verb: "VERB", Adjective: "ADJ", Adverb: "ADV", Preposition: "ADP", Postposition: "ADP",
  Pronoun: "PRON", Determiner: "DET", Article: "DET", Conjunction: "CCONJ", Interjection: "INTJ", Numeral: "NUM", Particle: "PART", Symbol: "SYM",
});

const strip = (html) => String(html ?? "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
const gloss = (defs) => { const d = (defs ?? []).map((x) => strip(x?.definition)).find(Boolean) ?? ""; return d.length > 170 ? d.slice(0, 167) + "…" : d; };
export const keyOf = (form) => normalizeForm(form).form.toLowerCase();

/** Wiktionary /page/definition/<word> → the English entries, each with its heading, class (or null), first gloss */
export function parseWiktionary(json, word = null) {
  const en = json?.en;
  if (!Array.isArray(en) || !en.length) return { found: false, word };
  const entries = en.map((e) => ({ heading: e.partOfSpeech ?? null, upos: UPOS_OF_HEADING[e.partOfSpeech] ?? null, gloss: gloss(e.definitions), senses: (e.definitions ?? []).length }));
  return { found: true, word, entries, upos: [...new Set(entries.map((e) => e.upos).filter(Boolean))] };
}

/** Wikipedia /page/summary/<title> → an article, or not. `disambiguation` pages are flagged, never read as an entity. */
export function parseWikipediaSummary(json) {
  if (!json || typeof json !== "object" || !json.title || /not_found/.test(String(json.type ?? ""))) return { found: false };
  return {
    found: true, title: json.title, type: json.type ?? "standard", disambiguation: json.type === "disambiguation",
    description: json.description ?? null, extract: String(json.extract ?? "").slice(0, 320), qid: json.wikibase_item ?? null,
    pageid: json.pageid ?? null, revision: json.revision ?? null, timestamp: json.timestamp ?? null, url: json.content_urls?.desktop?.page ?? null,
  };
}

/** Wikidata wbsearchentities → candidates, ambiguity kept; `exact` = the label or an alias IS the form */
export function parseWikidataSearch(json, form = "") {
  const k = keyOf(form);
  const candidates = (json?.search ?? []).map((r) => ({
    qid: r.id, label: r.label ?? null, description: r.description ?? null, aliases: r.aliases ?? [],
    exact: [r.label, ...(r.aliases ?? [])].some((x) => x && String(x).toLowerCase() === k),
  }));
  return { found: candidates.length > 0, candidates, exact: candidates.filter((c) => c.exact).length };
}

const witnessOf = (source, form, extra, at) => ({ source, giver: SOURCES[source].giver, license: SOURCES[source].license, via: SOURCES[source].via, form, retrievedAt: at ?? null, ...extra });

/** Every piece of evidence the three lookups yielded, each with its giver, license, address and time. */
export function evidenceRows(form, results = {}, { retrievedAt = null } = {}) {
  const rows = [];
  const d = results.dictionary;
  if (d?.found) rows.push(witnessOf("dictionary", form, { url: `https://en.wiktionary.org/wiki/${encodeURIComponent(form)}`, entries: d.entries, upos: d.upos }, retrievedAt));
  const w = results.wikipedia;
  if (w?.found) rows.push(witnessOf("wikipedia", form, { url: w.url, title: w.title, qid: w.qid, disambiguation: w.disambiguation, pageid: w.pageid, revision: w.revision, articleTimestamp: w.timestamp, description: w.description }, retrievedAt));
  const k = results.wikidata;
  if (k?.found) rows.push(witnessOf("wikidata", form, { url: `https://www.wikidata.org/w/index.php?search=${encodeURIComponent(form)}`, candidates: k.candidates, exact: k.exact }, retrievedAt));
  return rows;
}

/** The candidate rows for the hyperlexicon: one pair per claim, a witness each. Standing is `candidate` — always. */
export function nominations(form, results = {}, { retrievedAt = null } = {}) {
  const left = `form:${keyOf(form)}`, out = [];
  const d = results.dictionary;
  if (d?.found) for (const e of d.entries) if (e.upos) out.push({ left, right: `class:${e.upos}`, giver: SOURCES.dictionary.giver, witnesses: [witnessOf("dictionary", form, { heading: e.heading, gloss: e.gloss, url: `https://en.wiktionary.org/wiki/${encodeURIComponent(form)}` }, retrievedAt)], meta: { lookup: "dictionary" } });
  const w = results.wikipedia;
  if (w?.found && !w.disambiguation) {
    out.push({ left, right: `article:${w.title}`, giver: SOURCES.wikipedia.giver, witnesses: [witnessOf("wikipedia", form, { url: w.url, title: w.title, revision: w.revision, pageid: w.pageid }, retrievedAt)], meta: { lookup: "wikipedia" } });
    if (w.qid) out.push({ left: `article:${w.title}`, right: `entity:${w.qid}`, giver: SOURCES.wikipedia.giver, witnesses: [witnessOf("wikipedia", form, { url: w.url, qid: w.qid, revision: w.revision }, retrievedAt)], meta: { lookup: "wikipedia→wikidata bridge" } });
  }
  const k = results.wikidata;
  if (k?.found) for (const c of k.candidates) out.push({ left, right: `entity:${c.qid}`, giver: SOURCES.wikidata.giver, witnesses: [witnessOf("wikidata", form, { qid: c.qid, label: c.label, description: c.description, exact: c.exact, url: `https://www.wikidata.org/wiki/${c.qid}` }, retrievedAt)], meta: { lookup: "wikidata", exact: c.exact } });
  return out;
}

/** Admit a lookup's nominations into a hyperlexicon (immutable: a new one is returned). Nothing here can GIVE. */
export const admitLookup = (hl, form, results, opts) => admitHyperlexiconCandidates(hl ?? createHyperlexicon(), nominations(form, results, opts));

/**
 * classify, extended: a form the base chain cannot place is answered from a lookup already made —
 * a dictionary's part of speech (attested, no frequency, source named) or, for a capitalised form,
 * the fact that a Wikidata entity bears that exact label. A form never looked up stays a typed gap:
 * this function never reaches the network.
 */
export function classifyWithLookups(classify, cache) {
  return (surface, opts) => {
    const base = classify(surface, opts);
    if (base?.found) return base;
    const key = keyOf(surface), r = cache?.get?.(key);
    if (!r) return base;
    const d = r.dictionary;
    if (d?.found && d.upos.length) {
      return { surface, found: true, total: 0, form: key, attested: "dictionary", via: [{ step: "dictionary", note: `attested in ${SOURCES.dictionary.giver} as ${d.entries.map((e) => e.heading).join(" / ")} — attestation, no frequency` }],
        candidates: d.upos.map((upos) => ({ upos, count: 0, share: null, thraxClass: THRAX_MAP[upos] ?? null, attested: "dictionary" })), lookup: { source: "dictionary", entries: d.entries } };
    }
    const k = r.wikidata;
    if (k?.exact && /^\p{Lu}/u.test(String(surface).replace(/^[^\p{L}]+/u, ""))) {
      return { surface, found: true, total: 0, form: key, attested: "wikidata", via: [{ step: "wikidata", note: `${k.exact} Wikidata entit${k.exact === 1 ? "y bears" : "ies bear"} exactly this name — a name exists; which entity this text means is identity, settled by consequence, not by the name` }],
        candidates: [{ upos: "PROPN", count: 0, share: null, thraxClass: THRAX_MAP.PROPN ?? null, attested: "wikidata" }], lookup: { source: "wikidata", candidates: k.candidates } };
    }
    return base;
  };
}

/** A document-evidence witness hook over a lookup cache: dictionary classes share the vote; a Wikidata name match leans PROPN by how unambiguous it is. */
export function lookupWitness(cache) {
  return {
    kind: "external-lookup",
    lookup: (key) => {
      const r = cache?.get?.(key); if (!r) return null;
      const votes = {}; const detail = {};
      const d = r.dictionary;
      if (d?.found && d.upos.length) { for (const u of d.upos) votes[u] = (votes[u] ?? 0) + Math.sqrt(1 / d.upos.length); detail.dictionary = d.upos; }
      const k = r.wikidata;
      if (k?.found && k.exact) { votes.PROPN = (votes.PROPN ?? 0) + Math.sqrt((k.exact + ALPHA) / (k.candidates.length + 2 * ALPHA)); detail.wikidata = { exact: k.exact, of: k.candidates.length }; }
      return Object.keys(votes).length ? { votes, detail, at: null } : null;
    },
  };
}
