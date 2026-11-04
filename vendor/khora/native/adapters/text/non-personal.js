// adapters/text/non-personal.js — WHO IS NOT A PERSON, asked of the givers (2026-10-27).
//
// pronouns.js::resolvePronouns takes `nonPersonal`: the referent ids its CALLER knows are not persons, which a personal pronoun
// ("he", "she") then never binds. Its header says the resolver cannot know this from the text alone, and nothing supplied it: the
// production call (organs/hypergraph.js::pronounBindingsFor) passed only the two dials, so "March" and "the Home Office" were
// candidates for "he" and "she" wherever the activation favoured them. Measured on 90 GUM documents the shipped call bound 62
// pronouns and 44 of them went to a being the gold does not equate with the pronoun; with this ruling 49 are right and 29 wrong
// (eval/referents/pronoun-golden.mjs, eval/referents/README.md).
//
// The rule is a ruling of two givers, never a list typed here:
//   · TimePrior@1 (janus priors/time-prior.json, class month / weekday, field `en`): "March", "Tuesday" name a point in time;
//   · the lexicon giver (organs/lexicon.js; the English Wiktionary pack under Node): the head word of the surface is listed with a
//     common-noun entry and with no name entry ("office", "government", "river"; not "Paris", which is also a name).
// A referent is non-personal only when EVERY surface it carries is, so one name that might be a person keeps the referent a
// candidate; a word the giver does not list, or has not been asked, rules nothing (the giver may be silent, the reader is not
// told a thing is not a person for lack of an answer). The rule keeps no state and writes nothing.
//
//   timeNamesOf(timePrior)                  → Set of lower-cased month and weekday names, empty when the prior is absent
//   headOf(surface)                         → the surface's last token ("the Home Office" → "Office")
//   formsToAsk(text)                        → every distinct word of `text`, as written and in lower case: the head of any surface the
//                                           resolver is later shown (a cast being or a common-noun phrase) is one of them
//   surfaceIsNonPerson(surface, { timeNames, lexicon })
//   nonPersonalOf(surfaceToReferent, { timeNames, lexicon }) → the referent ids all of whose surfaces are non-personal
//   consultNonPersonal(text, lexicon, { timePrior, language }) → Promise<{ nonPersonalOf | null, report }>: asks the lexicon once,
//                                           then hands back the synchronous ruling the pronoun call reads (the reader is synchronous)

const TOKEN = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;
const NAME = /^(name|proper[ _-]?noun)$/;
const posOf = (entry) => (Array.isArray(entry?.pos) ? entry.pos : [entry?.pos]).filter((p) => typeof p === "string").map((p) => p.toLowerCase());

export function timeNamesOf(timePrior) {
  const names = new Set();
  for (const c of Object.values(timePrior?.concepts ?? {})) {
    if ((c?.class === "month" || c?.class === "weekday") && typeof c.en === "string") names.add(c.en.toLowerCase());
  }
  return names;
}

export function headOf(surface) {
  const toks = String(surface ?? "").match(TOKEN);
  return toks && toks.length ? toks[toks.length - 1] : null;
}

export function formsToAsk(text) {
  const out = new Set();
  for (const m of String(text ?? "").matchAll(TOKEN)) { out.add(m[0]); out.add(m[0].toLowerCase()); }
  return [...out];
}

// the entries the giver holds for the head as written, else for its lower case; null when it holds none (or was never asked)
function entriesOf(lexicon, head) {
  const asWritten = lexicon.get(head);
  if (Array.isArray(asWritten) && asWritten.length) return asWritten;
  const lower = head.toLowerCase();
  if (lower === head) return null;
  const folded = lexicon.get(lower);
  return Array.isArray(folded) && folded.length ? folded : null;
}

export function surfaceIsNonPerson(surface, { timeNames = new Set(), lexicon = null } = {}) {
  const head = headOf(surface);
  if (!head) return false;
  if (timeNames.has(head.toLowerCase())) return true;
  if (!lexicon || typeof lexicon.get !== "function") return false;
  const entries = entriesOf(lexicon, head);
  if (!entries) return false;
  const pos = entries.flatMap(posOf);
  return pos.includes("noun") && !pos.some((p) => NAME.test(p));
}

export function nonPersonalOf(surfaceToReferent, { timeNames = new Set(), lexicon = null } = {}) {
  const bySurfaces = new Map();
  const pairs = surfaceToReferent instanceof Map ? [...surfaceToReferent] : Object.entries(surfaceToReferent ?? {});
  for (const [surface, id] of pairs) {
    if (!bySurfaces.has(id)) bySurfaces.set(id, []);
    bySurfaces.get(id).push(surface);
  }
  return [...bySurfaces].filter(([, surfaces]) => surfaces.every((s) => surfaceIsNonPerson(s, { timeNames, lexicon }))).map(([id]) => id);
}

/** Ask the lexicon about the words of `text`, once; the result's `nonPersonalOf(surfaceToReferent)` is synchronous and reads
 *  only what came back. English only (the time names and the common/name split are English): any other language is a typed gap. */
export async function consultNonPersonal(text, lexicon, { timePrior = null, language = "eng" } = {}) {
  const report = { giver: lexicon?.giver ?? null, asked: 0, timeNames: 0, gap: null };
  if (!lexicon || typeof lexicon.want !== "function") return { nonPersonalOf: null, report: { ...report, gap: "no lexicon was handed to this read" } };
  if (language !== "eng") return { nonPersonalOf: null, report: { ...report, gap: `non-personal referents are ruled for English only, not ${language}` } };
  const timeNames = timeNamesOf(timePrior);
  report.timeNames = timeNames.size;
  const forms = formsToAsk(text);
  const asked = lexicon.log?.length ?? 0;
  await lexicon.want(forms);
  report.asked = forms.length;
  report.giver = lexicon.giver ?? report.giver;
  report.gap = (lexicon.log ?? []).slice(asked).find((x) => x.gap)?.gap ?? (timeNames.size ? null : "no TimePrior@1 is filed: month and weekday names are not ruled non-personal");
  return { nonPersonalOf: (surfaceToReferent) => nonPersonalOf(surfaceToReferent, { timeNames, lexicon }), report };
}
