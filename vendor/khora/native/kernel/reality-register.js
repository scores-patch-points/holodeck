// native/kernel/reality-register.js — FICTION vs JOURNALISM, and the other
// registers, put on the PROFILE OF A THING.
//
// Standing: nomination. Spec: native/docs/REALITY-LEVELS-SPEC.md §3, §11.3.
// The code wins any disagreement with this header.
//
// THE TWO AXES, KEPT APART (the whole point):
//
//   REGISTER is a property of the SOURCE, declared by a giver, never induced.
//   A report, a news article and a memoir make truth-claims; a novel, a film
//   and a play tell a story. A source carries ONE register; the taxonomy is
//   small, closed, and named (the priors.js discipline: a narrow closed class
//   with its reason stated, never a discovered list). Genre is DECLARED, never
//   guessed (reality-kind.js:64) — a source with no register is refused.
//
//   REALITY is a property of the THING, read from WHERE IT IS ATTESTED and
//   from an EXTERNAL WORLD ANCHOR. A name attested only by fiction is
//   fictional; a name a Wikipedia/Wikidata anchor places in the world is real;
//   a real name a work fictionalizes is fictionalized-real. This is exactly
//   reality-kind.js's real/fictionalized-real/fictional, one ground further
//   out: the world anchor is a RECEIVED nonfiction source outside the corpus.
//
// WHY WIKIPEDIA/WIKIDATA IS THE ANCHOR. The khora already reaches both
// (adapters/sources/wiki-summary.js; organs/current-holder.js), and Wikidata
// carries the decisive signal for this exact question: an item's description
// and instance-of (P31) name what it IS — "fictional character", "film",
// "video game" for a story's people; "human", "steamship", "organization" for
// the world's. So `world` is false when the anchor says a thing is a fiction,
// true when it says a real-world class, null when the name is ambiguous or
// absent — the disambiguation noise ("Titanic" is a ship Q25173 but "RMS
// Titanic" resolves to a 1986 video game) is DISCLOSED, not smoothed, and the
// bare-name correspondence is the same weak primitive reality-kind.js already
// names as its own limit. Wikipedia is the best friend here, not an oracle.
//
// THE HYPERLEXICON IS WHERE THIS BECOMES CASE-LAW. realityRegister produces
// notes (a referent's reality-kind, its attesting registers, its world anchor)
// that ride the hyperlexicon exactly as discovered kinds do
// (hyperlexicon-routes.js's noteId discipline): `(referent, is-reality-kind,
// real)`, `(referent, attested-by, journalism)`, `(referent, corresponds-to,
// wikidata:Q25173)`. A later reading CONSULTS the anchor instead of re-hitting
// Wikidata, and a later finding that contradicts it is a recorded revision,
// never a silent flip (the abstraction ladder, hyperlexicon-abstraction.js).
//
// WHAT IT REFUSES. Not "does this exist" — "attested by these registers, and
// anchored (or not) in the world, examined against what ran." A thing called
// fictional today could be anchored tomorrow; `checkedAgainst` names exactly
// what was consulted. The model decides nothing; the register is a giver and
// the anchor is a lookup.

// BROWSER SHIM (holodeck only; NOT byte-identical — see VENDORING.md). Upstream khora's
// reality-register.js imports node:fs / node:path for its on-disk resolver cache, which a
// page cannot load (the same seam as reading-rules.js). The resolver is called with
// cacheDir=null in the surface, so neither module is ever used; they are replaced with
// inert stubs so the file loads and every export's semantics are unchanged.
const fs = { existsSync: () => false, readFileSync: () => "", mkdirSync: () => {}, writeFileSync: () => {} };
const path = { join: (...a) => a.join("/") };
import { questionTerms } from "./for-whom.js";

export const REALITY_REGISTER_SCHEMA = "EORealityRegister@1";
export const REALITY_REGISTERS_SCHEMA = "EORealityRegisters@1";

// The closed register taxonomy. `truthClaiming` is the axis the whole file
// turns on: a source that makes truth-claims can anchor a thing in the world;
// a source that tells a story cannot. Each names what it is.
export const REGISTERS = Object.freeze({
  JOURNALISM: "journalism",
  REPORT: "report",
  TESTIMONY: "testimony",
  REFERENCE: "reference",
  DATA: "data",
  COMMENT: "comment",
  FICTION: "fiction",
  UNKNOWN: "unknown",
});

export const REGISTER_TRAITS = Object.freeze({
  [REGISTERS.JOURNALISM]: Object.freeze({ truthClaiming: true, label: "Reporting", note: "news writing that makes truth-claims; check whether it quotes the record or only characterises it" }),
  [REGISTERS.REPORT]: Object.freeze({ truthClaiming: true, label: "Report", note: "official or institutional findings" }),
  [REGISTERS.TESTIMONY]: Object.freeze({ truthClaiming: true, label: "Testimony", note: "a first-person account, memoir or interview" }),
  [REGISTERS.REFERENCE]: Object.freeze({ truthClaiming: true, label: "Reference", note: "an encyclopedia or reference work" }),
  [REGISTERS.DATA]: Object.freeze({ truthClaiming: true, label: "Data", note: "a table or record; figures without a voice" }),
  [REGISTERS.COMMENT]: Object.freeze({ truthClaiming: false, label: "Commentary", note: "opinion and argument ABOUT the record" }),
  [REGISTERS.FICTION]: Object.freeze({ truthClaiming: false, label: "Fiction", note: "a novel, film or play — a telling, not a report" }),
  [REGISTERS.UNKNOWN]: Object.freeze({ truthClaiming: false, label: "Source", note: "register not declared — refused, never guessed" }),
});

const REGISTER_ALIASES = Object.freeze({
  news: REGISTERS.JOURNALISM, reporting: REGISTERS.JOURNALISM, article: REGISTERS.JOURNALISM, newspaper: REGISTERS.JOURNALISM,
  official: REGISTERS.REPORT, inquiry: REGISTERS.REPORT, audit: REGISTERS.REPORT, government: REGISTERS.REPORT,
  memoir: REGISTERS.TESTIMONY, interview: REGISTERS.TESTIMONY, account: REGISTERS.TESTIMONY, speech: REGISTERS.TESTIMONY, testimony: REGISTERS.TESTIMONY,
  encyclopedia: REGISTERS.REFERENCE, encyclopedic: REGISTERS.REFERENCE, wiki: REGISTERS.REFERENCE, wikipedia: REGISTERS.REFERENCE,
  table: REGISTERS.DATA, record: REGISTERS.DATA, dataset: REGISTERS.DATA,
  opinion: REGISTERS.COMMENT, editorial: REGISTERS.COMMENT, commentary: REGISTERS.COMMENT, blog: REGISTERS.COMMENT, argument: REGISTERS.COMMENT,
  novel: REGISTERS.FICTION, film: REGISTERS.FICTION, screenplay: REGISTERS.FICTION, script: REGISTERS.FICTION, play: REGISTERS.FICTION, story: REGISTERS.FICTION, fiction: REGISTERS.FICTION,
});

/** normalizeRegister(x) -> a REGISTERS value, or null when undeclared. */
export function normalizeRegister(x) {
  const s = String(x ?? "").trim().toLowerCase();
  if (!s) return null;
  if (Object.values(REGISTERS).includes(s)) return s;
  return REGISTER_ALIASES[s] ?? null;
}

export const isTruthClaiming = (register) => REGISTER_TRAITS[register]?.truthClaiming === true;

// ── the world anchor ────────────────────────────────────────────────────────
// The two marker sets are narrow and DISCLOSED (the priors.js precedent): the
// fiction markers are the decisive signal — a positive claim that a name
// denotes a made thing — and a name with no marker is NOT thereby declared
// real, only not-shown-fictional (examined, not convicted). The fiction set
// matches organs/current-holder.js's own guard (`/fiction|video game|character/i`).
const FICTION_MARKERS = /(fictional|fiction|film|movie|novel|novella|video ?game|character|tv series|television series|play|musical|opera|comic|manga|anime|mytholog|legendary|superhero|sitcom|screenplay)/i;
const WORLD_MARKERS = /(human|person|man|woman|sailor|sea captain|captain|politician|businessman|ship|steamship|liner|vessel|boat|shipwreck|organization|organisation|company|business|country|city|town|place|region|mountain|island|municipality|airline|band|newspaper|agency|building)/i;

/** classifyAnchor({ description, instanceOf }) -> "world" | "fiction" | null.
 *  A fiction marker wins (a made thing named as such); then a world marker;
 *  else null (unknown / ambiguous / absent). */
export function classifyAnchor({ description = "", instanceOf = [] } = {}) {
  const text = [description, ...(instanceOf ?? [])].join(" · ");
  if (FICTION_MARKERS.test(text)) return "fiction";
  if (WORLD_MARKERS.test(text)) return "world";
  return null;
}

const anchorWorld = (cls) => (cls === "fiction" ? false : cls === "world" ? true : null);

// ── the resolver (network, injectable, cached, polite, FOR-WHOM-SCOPED) ──────
// Wikipedia's ACTION API, not the REST summary endpoint: the REST summary
// answered 429 on every term here while the action API answered 200 with the
// same lead, so the working door is the one used. The lead sentence is the
// answer to "what is this?" — "SS Great Eastern was an iron-hulled steamship
// designed by Isambard Kingdom Brunel" — and the same call tells world from
// story (classifyAnchor over the lead).
//
// DISAMBIGUATION IS A FOR-WHOM QUESTION (S113: identity exists only for-whom).
// A bare name lands on a disambiguation page ("Great Eastern may refer to:";
// "Carpathia" -> the Roman province). The sense is NOT chosen by a raw string
// heuristic (a first cut fed the resolver "a magnificent ship" and got RMS
// Titanic back). It is chosen by the FRAME the reading is for: the for-whom's
// QUESTION supplies the disambiguating terms (questionTerms), and the
// for-whom's UNIVERSE decides which families of sense are admissible — a world
// for-whom prefers a world anchor (a ship), a stipulated/counterfactual
// for-whom prefers the story's. `lexicon` is the for-whom's GROUND — the
// hyperlexicon's already-earned correspondences, consulted BEFORE the network,
// so a later for-whom resolves an established name without guessing.
const WIKI_API = "https://en.wikipedia.org/w/api.php";

// The for-whom's `universe` is the referents/relations it can hold (an array);
// the world/fiction coordinate is a SEPARATE fact (universeOf, organs/universe.js).
// Read the coordinate when given (`universeKind`), never the array spread.
const worldPref = (forWhom) => {
  const u = forWhom?.universeKind ?? (typeof forWhom?.universe === "string" ? forWhom.universe : "");
  return !/stipulated|counterfactual|fiction|score/i.test(String(u ?? ""));
};

/** makeWikipediaResolver({ fetch, cacheDir, timeoutMs, forWhom, lexicon })
 *  -> async resolve(term) -> { found, title?, extract?, url?, world,
 *  ambiguous?, missing?, chose?, giver }.
 *  `forWhom` scopes disambiguation (question terms + universe); `lexicon`
 *  (a Map or plain object of surface -> anchor) is the earned ground,
 *  consulted first. Missing page or no network is an answer (found:false);
 *  a throttle retries with backoff. */
export function makeWikipediaResolver({ fetch: doFetch = globalThis.fetch, cacheDir = null, timeoutMs = 9000, backoffMs = 2000, attempts = 3, forWhom = null, lexicon = null } = {}) {
  const memo = new Map();
  const qTerms = forWhom ? questionTerms(forWhom.question) : [];
  const preferWorld = worldPref(forWhom);
  const fromLexicon = (term) => {
    if (!lexicon) return null;
    const hit = lexicon instanceof Map ? lexicon.get(term) : lexicon[term];
    return hit ? { ...hit, chose: "lexicon" } : null;
  };
  const fileOf = (key) => (cacheDir ? path.join(cacheDir, `${key.replace(/[^A-Za-z0-9]+/g, "_").slice(0, 80) || "_"}.json`) : null);
  const getJson = async (params) => {
    for (let a = 0; a < attempts; a += 1) {
      const res = await doFetch(`${WIKI_API}?${new URLSearchParams({ format: "json", origin: "*", ...params })}`, { headers: { "user-agent": "khora-reality-register/0.1 (local instrument; one lookup per explicit ask)" }, signal: AbortSignal.timeout(timeoutMs) });
      const body = await res.text();
      try { return JSON.parse(body); } catch { await new Promise((r) => setTimeout(r, backoffMs * (a + 1))); } // a throttle answers HTML/plaintext, not JSON
    }
    throw new Error("wikipedia throttled");
  };
  const pageOf = async (title) => Object.values((await getJson({ action: "query", prop: "extracts|pageprops", exintro: "1", explaintext: "1", redirects: "1", titles: title }))?.query?.pages ?? {})[0] ?? null;
  const isDab = (page, extract) => Boolean(page?.pageprops?.disambiguation) || /may refer to:?\s*$/i.test(String(extract ?? "").trim()) || /\bmay refer to\b/i.test(String(extract ?? ""));
  // The candidate list for a disambiguation, each classified world/fiction from
  // its own snippet — so the for-whom's universe can pick the admissible sense
  // WITHOUT a fetch per candidate.
  const senses = async (q) => (await getJson({ action: "query", list: "search", srsearch: q, srlimit: "5", srprop: "snippet" }))?.query?.search?.map((s) => ({ title: s.title, world: anchorWorld(classifyAnchor({ description: s.title + " " + String(s.snippet ?? "").replace(/<[^>]+>/g, ""), instanceOf: [] })) })) ?? [];

  const norm = (s) => String(s ?? "").toLowerCase();

  return async function resolve(term) {
    const t = String(term ?? "").trim();
    if (!t) return { found: false, world: null, giver: "wikipedia" };
    const lex = fromLexicon(t); // the for-whom's ground DECIDES an earned name
    if (lex) { memo.set(t, lex); return lex; }
    if (memo.has(t)) return memo.get(t);
    const file = fileOf(t);
    if (file && fs.existsSync(file)) { try { const kept = JSON.parse(fs.readFileSync(file, "utf8")); memo.set(t, kept); return kept; } catch {} }
    let out = { found: false, term: t, world: null, giver: "wikipedia", transient: true };
    try {
      // Wikipedia PROPOSES senses (it does not decide). The for-whom's universe
      // picks the admissible family and its question biases the search; when no
      // single sense wins, the result is a TYPED AMBIGUITY with its candidates,
      // for a giver (the hyperlexicon) to earn — never a silent wrong pick.
      const cands = await senses([t, ...qTerms].join(" "));
      const named = cands.filter((c) => norm(c.title).includes(norm(t)));
      const pool = named.length ? named : cands;
      const admissible = pool.filter((c) => c.world === preferWorld);
      const pick = admissible.length === 1 ? admissible[0] : admissible[0] ?? pool[0] ?? null;
      const distinct = new Set(pool.map((c) => c.title)).size;
      const ambiguous = !pick || (distinct > 1 && admissible.length !== 1);
      if (pick) {
        const page = await pageOf(pick.title);
        const extract = page?.missing === undefined ? page?.extract ?? "" : "";
        const cls = classifyAnchor({ description: `${page?.title ?? pick.title}. ${extract}`, instanceOf: [] });
        const decided = Boolean(extract) && !isDab(page, extract) && !ambiguous;
        out = {
          found: decided, term: t, title: page?.title ?? pick.title, extract: extract || null,
          world: decided ? anchorWorld(cls) : null, ambiguous,
          candidates: pool.map((c) => ({ title: c.title, world: c.world })),
          url: decided ? `https://en.wikipedia.org/wiki/${encodeURIComponent(String(page.title).replace(/ /g, "_"))}` : null,
          chose: `for-whom:${(qTerms.slice(0, 2).join("+") || "universe")}`, giver: "wikipedia", transient: false,
        };
      } else {
        out = { found: false, term: t, world: null, ambiguous: true, candidates: [], chose: "none", giver: "wikipedia", transient: false };
      }
    } catch (err) {
      out = { found: false, term: t, world: null, giver: "wikipedia", why: String(err?.message ?? err), transient: true };
    }
    if (file && !out.transient) { try { fs.mkdirSync(cacheDir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(out)); } catch {} }
    memo.set(t, out);
    return out;
  };
}

// ── the fold: a thing's reality-register profile ────────────────────────────
/**
 * realityRegister(thing, { sources, anchor }) -> EORealityRegister@1
 *
 * `thing` = { id, surfaces: [..] }. `sources` = [{ id, register, referents:[ids]
 * or surfaces:[..] }] — the sources that attest it, each with its DECLARED
 * register (normalized here; an undeclared register is a refusal, kept).
 * `anchor` = a resolve() result (or null). Pure: no network here.
 */
export function realityRegister(thing, { sources = [], anchor = null, resolveGiver = "wikidata" } = {}) {
  const id = String(thing?.id ?? thing ?? "");
  const attested = [];
  const refusals = [];
  for (const s of sources) {
    const reg = normalizeRegister(s.register);
    const attests = (s.referents ?? []).map(String).includes(id);
    if (!attests) continue;
    if (!reg) { refusals.push(Object.freeze({ source: s.id, register: s.register ?? null, reason: "no_declared_register" })); continue; }
    attested.push(Object.freeze({ source: s.id, register: reg, truthClaiming: isTruthClaiming(reg) }));
  }
  const truthClaiming = attested.some((a) => a.truthClaiming);
  const fictionOnly = attested.length > 0 && attested.every((a) => a.register === REGISTERS.FICTION);

  let realityKind;
  if (anchor && anchor.world === false) realityKind = "fictional";
  else if (anchor && anchor.world === true) realityKind = attested.some((a) => a.register === REGISTERS.FICTION) ? "fictionalized-real" : "real";
  else if (fictionOnly) realityKind = "fictional";
  else if (attested.some((a) => a.register === REGISTERS.FICTION) && truthClaiming) realityKind = "fictionalized-real";
  else if (truthClaiming) realityKind = "real";
  else realityKind = "unexamined";

  return Object.freeze({
    schema: REALITY_REGISTER_SCHEMA,
    id,
    attested: Object.freeze(attested),
    registers: Object.freeze([...new Set(attested.map((a) => a.register))]),
    // The anchor answers "what is this?": the lead sentence, and whether it is
    // world or story. `ambiguous` marks a disambiguation page the material's
    // own context could not settle — examined, not convicted.
    anchor: anchor ? Object.freeze({ found: !!anchor.found, title: anchor.title ?? null, extract: anchor.extract ?? null, url: anchor.url ?? null, world: anchor.world ?? null, ambiguous: !!anchor.ambiguous, missing: !!anchor.missing, chose: anchor.chose ?? null, candidates: Object.freeze([...(anchor.candidates ?? [])]) }) : null,
    realityKind,
    refused: Object.freeze(refusals),
    basis: Object.freeze({
      giver: resolveGiver,
      truthClaiming,
      fictionOnly,
      checkedAgainst: anchor?.found ? [anchor.url ?? anchor.title ?? "anchor"] : [],
      note: realityKind === "fictional"
        ? "attested only where no source makes truth-claims, and no world anchor places it — fictional, examined not convicted"
        : realityKind === "fictionalized-real"
          ? "a name with a world anchor that a fiction also tells — fictionalized-real"
          : realityKind === "real"
            ? "attested by a truth-claiming source and/or anchored in the world"
            : "register undeclared or no truth-claiming attestation — unexamined, nothing claimed",
    }),
  });
}

/** buildRealityRegisters({ things, sources, resolve, cache }) -> { schema, byId, ... }.
 *  `resolve(term)` is optional (a Wikidata resolver or a stub); when absent, the
 *  fold uses only the declared registers. One anchor per thing, cached. */
export async function buildRealityRegisters({ things = [], sources = [], resolve = null } = {}) {
  const byId = new Map();
  const anchors = new Map();
  for (const thing of things) {
    const id = String(thing?.id ?? thing);
    const surfaces = thing?.surfaces ?? [id];
    let anchor = null;
    if (resolve) {
      for (const surf of surfaces) {
        if (anchors.has(surf)) { anchor = anchors.get(surf); if (anchor?.found) break; continue; }
        const a = await resolve(surf); anchors.set(surf, a);
        if (a?.found) { anchor = a; break; }
      }
    }
    byId.set(id, realityRegister(thing, { sources, anchor }));
  }
  return Object.freeze({
    schema: REALITY_REGISTERS_SCHEMA,
    byId,
    diagnostics: Object.freeze({
      things: byId.size,
      real: [...byId.values()].filter((r) => r.realityKind === "real").length,
      fictional: [...byId.values()].filter((r) => r.realityKind === "fictional").length,
      fictionalizedReal: [...byId.values()].filter((r) => r.realityKind === "fictionalized-real").length,
      refused: [...byId.values()].reduce((n, r) => n + r.refused.length, 0),
    }),
  });
}

// ── the hyperlexicon bridge (case-law) ──────────────────────────────────────
/** registerNotes(profile, { noteId }) -> [{ subject, verb, object }] — the
 *  notes this read would land on the hyperlexicon, in the shape
 *  hyperlexicon-routes.js already mints (noteId(subject, verb, object)). A
 *  later reading resolves through these instead of re-hitting the network. */
export function registerNotes(profile) {
  const notes = [];
  if (profile.realityKind && profile.realityKind !== "unexamined") notes.push({ subject: profile.id, verb: "is-reality-kind", object: profile.realityKind });
  for (const r of profile.registers) notes.push({ subject: profile.id, verb: "attested-by", object: r });
  if (profile.anchor?.found && profile.anchor.title) notes.push({ subject: profile.id, verb: "corresponds-to", object: `wikipedia:${profile.anchor.title.replace(/ /g, "_")}` });
  return notes;
}

/** registerProfileLines(profile) -> string[] — the SURFACE face, in a person's
 *  terms: WHAT IT IS (the lead sentence), who says so, whether world or story. */
export function registerProfileLines(profile) {
  const byReg = new Map();
  for (const a of profile.attested) byReg.set(a.register, (byReg.get(a.register) ?? 0) + 1);
  const who = [...byReg.entries()].map(([r, n]) => `${REGISTER_TRAITS[r]?.label ?? r}${n > 1 ? ` ×${n}` : ""}`).join(", ") || "no source attests it";
  const lines = [`${profile.id} — ${profile.realityKind}`];
  lines.push(`   told by:   ${who}`);
  if (profile.anchor?.found) lines.push(`   what it is: ${String(profile.anchor.extract ?? "").slice(0, 200)}${profile.anchor.url ? `\n               (${profile.anchor.url})` : ""}`);
  else if (profile.anchor?.ambiguous) {
    const cands = (profile.anchor.candidates ?? []).map((c) => `${c.title}${c.world === false ? " (fiction)" : ""}`).join("; ");
    lines.push(`   what it is: ambiguous — the for-whom must earn the sense (examined, not convicted)${cands ? `\n               candidates: ${cands.slice(0, 200)}` : ""}`);
  } else if (profile.anchor) lines.push(`   what it is: none found on Wikipedia (examined, not convicted)`);
  if (profile.refused.length) lines.push(`   refused:   ${profile.refused.map((r) => `${r.source} (${r.reason})`).join(", ")}`);
  return lines;
}
