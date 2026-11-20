// adapters/text/conventions.js — THE CAPITAL'S CONVENTIONS, READ FROM THEIR ONE HOME (2026-10-27).
//
// A capital is a CONVENTION, not a rule. Writers of a cased script keep it more or less: a name is capitalised in the middle of a sentence 97 times in
// 100, a word that is not a name 3 times in 100, and a heading or a byline may end with no mark at all, so the next sentence's capital stands where the
// cut cannot see that it opens one. The reader reads a capital by four conventions (surfaces.js, read-core.mjs); this module reads them as DATA.
//
// THEIR HOME IS JANUS: priors/conventions-eng.json (Conventions@1), built by janus scripts/build-conventions-prior.mjs, folded by janus
// native/organs/nomos.js into one NomosRule@1 per convention, each with the standing of its OWN giver or builder (given, extracted, never revealed).
// Here there is no second copy: no row, no figure, no standing is held in this file. A prior is data and khora's reader loads it by name
// (prior-source.mjs::priorJson, "conventions-<stem>.json"); an absent file is a typed gap, never an invented row, and the cast reads as it did.
//
//   conventionOf(prior, stem)  → { stem, says, scope, site, giver, builder, source } | null     the convention the reader stands on, by its stem
//   conventionsGap(prior)      → string | null                                                   why the ledger is not in reach, when it is not

/** The convention of `stem` in a Conventions@1 prior, as the reader cites it (the standing is the nomos's to derive, not khora's). */
export function conventionOf(prior, stem) {
  const c = Array.isArray(prior?.conventions) ? prior.conventions.find((x) => x?.stem === stem) : null;
  if (!c) return null;
  return { stem: c.stem, says: c.says ?? null, scope: c.scope ?? null, site: c.address ?? null, giver: c.giver ?? null, builder: c.builder ?? prior.provenance?.builder ?? null, source: prior.provenance?.source ?? null };
}

export const conventionsGap = (prior) =>
  prior && prior.schema === "Conventions@1" && Array.isArray(prior.conventions) ? null : "no Conventions@1 prior (janus priors/conventions-eng.json) is in reach: the capital's conventions are not cited, and the cast reads as it did";
