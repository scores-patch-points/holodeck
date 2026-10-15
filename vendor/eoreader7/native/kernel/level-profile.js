// native/kernel/level-profile.js — THE LEVEL PROFILE: a thing's "level of
// reality" read as a FOLD OVER ITS OWN ADMITTED ACTS, never a label looked up.
//
// Standing: nomination. Spec: native/docs/REALITY-LEVELS-SPEC.md §3, §11.1.
// The code wins any disagreement with this header.
//
// THE ONE LAW IT OBEYS. The cube may NOT be asked what a piece of text IS —
// the-fold/moves.js records the refutation (95.7% of cell assignments survived
// shuffling the words inside 2,527 paragraphs; CUBE.md:10 promotes it out of
// the code). What the cube CAN classify is the MOVES: operator × grain is a
// closed, complete space of ACTS, and "which of them landed on this being" is
// a question about THIS codebase and the reading's own admissions, not about
// the material's content. So nothing here reads a byte: it counts, per
// referent, which of the nine terrains its own admitted acts landed on.
//
// THE NINE TERRAINS. Terrain = (domain, grain): Existence→Void/Entity/Kind,
// Structure→Field/Link/Network, Interpretation→Atmosphere/Lens/Paradigm
// (kernel/cube.js:40). An operator fixes its domain, so all three of a domain's
// modes land on one terrain at a given grain (NUL·Figure, SIG·Figure and
// INS·Figure are all Entity). The occupancy is therefore 3 domains × 3 grains,
// aggregated over modes.
//
// WHAT IT REPLACES (a nomination, disclosed). The legacy engine carried an
// INDIVIDUATION classifier for emanon / protogon / holon
// (legacy-ported/packages/host/corpus.js:844) whose MASS_FLOOR=15 and
// PROTOGON_COUPLING_FLOOR=1.0 were fitted to Frankenstein and Heart of
// Darkness; on a Titanic-sized text those thresholds do not transfer. Here the
// individuation FALLS OUT of the grain mix the referent's own acts produced:
//   emanon   — Ground-dominant ("the creature": real mass, no name-shaped acts)
//   protogon — Figure-dominant (a particular the discourse orbits)
//   holon    — Pattern-dominant (a recurring whole)
// This is a DIFFERENT signal from the legacy mass×coupling classifier, not a
// re-parameterization of it; the two are not claimed to agree.
//
// TYPED ABSENCES. An empty cell is a LEAD, never a verdict (CUBE.md:6; P64).
// Every terrain a referent's acts did not reach is reported, typed, so a
// reader can tell "no Kind act has been admitted for this being yet" from a
// missing mechanism.
//
// II.23 CONTROL. The class this organ can commit is reading a per-referent
// level off acts that carry no referent-specific signal. The control is the
// standard one: permute the act→referent pairing and re-read — the statistic
// (mean within-referent concentration) must exceed its own shuffled null for
// the pairing to be saying anything.

import { GRAINS, DOMAINS, TERRAIN_BY_DOMAIN, cellOf } from "./cube.js";
import { createSeededRng, shuffled } from "./rng.js";

export const LEVEL_PROFILE_SCHEMA = "EOLevelProfile@1";
export const LEVEL_PROFILES_SCHEMA = "EOLevelProfiles@1";

export const INDIVIDUATION = Object.freeze({
  EMANON: "emanon",
  PROTOGON: "protogon",
  HOLON: "holon",
  MIXED: "mixed",
  UNESTABLISHED: "unestablished",
});

// The grain→individuation nomination (§11.1). A nomination, not a finding.
export const GRAIN_INDIVIDUATION = Object.freeze({
  Ground: INDIVIDUATION.EMANON,
  Figure: INDIVIDUATION.PROTOGON,
  Pattern: INDIVIDUATION.HOLON,
});

const gap = (type, detail = {}) => Object.freeze({ gap: type, ...detail });

// The nine terrain cells, derived from the table so they cannot drift.
const TERRAIN_CELLS = Object.freeze(
  DOMAINS.flatMap((domain) => GRAINS.map((grain) => ({ domain, grain, terrain: TERRAIN_BY_DOMAIN[domain][grain], cell: `${domain}·${grain}` }))),
);

const emptyOccupancy = () => {
  const o = {};
  for (const domain of DOMAINS) { o[domain] = {}; for (const grain of GRAINS) o[domain][grain] = 0; }
  return o;
};

/**
 * typedAct(act) -> { referent, op, grain, cell, terrain, domain } | { refusal }
 *
 * An act is `{ referent, op, grain }`, `{ end1, label, end2 }`-shaped with an
 * `op`/`grain` stamp, or `{ referent, cell: "OP·Grain" }`. Anything that is not
 * a cube cell is a TYPED REFUSAL, never silently dropped: an unaddressed act
 * (no referent), an untyped act (no operator·grain), or a `not_a_cube_cell`.
 */
export function typedAct(act) {
  const referent = act?.referent ?? act?.id ?? act?.subject ?? act?.end1 ?? null;
  let op = act?.op ?? null;
  let grain = act?.grain ?? null;
  if ((op == null || grain == null) && typeof act?.cell === "string") {
    const [o, g] = act.cell.split(/[·.:]/);
    op = op ?? o;
    grain = grain ?? g;
  }
  if (referent == null || referent === "") return { refusal: gap("unaddressed_act", { reason: "an act with no referent cannot land on a thing", act }) };
  if (op == null || grain == null) return { refusal: gap("untyped_act", { reason: "an act with no operator·grain is not a cube move", referent, act }) };
  const c = cellOf(op, grain);
  if (c.gap) return { refusal: gap("not_a_cube_cell", { referent, offered: { op, grain }, reason: c.reason }) };
  return { referent: String(referent), op, grain, cell: `${op}·${grain}`, terrain: c.terrain, domain: c.domain };
}

/**
 * indexActs(acts) -> { byReferent: Map<string, act[]>, refusals: [] }
 * Group the acts that landed, keeping every refusal typed beside them.
 */
export function indexActs(acts) {
  const byReferent = new Map();
  const refusals = [];
  for (const act of acts ?? []) {
    const t = typedAct(act);
    if (t.refusal) { refusals.push(t.refusal); continue; }
    if (!byReferent.has(t.referent)) byReferent.set(t.referent, []);
    byReferent.get(t.referent).push(t);
  }
  return { byReferent, refusals };
}

/** The dominant grain of a mix — strictly greatest, or null on a tie. No
 *  fitted threshold: a tied mix is MIXED, an empty mix UNESTABLISHED. */
export function dominantGrain(mix) {
  let best = null;
  let bestN = 0;
  let tie = false;
  for (const grain of GRAINS) {
    const n = mix[grain] ?? 0;
    if (n > bestN) { best = grain; bestN = n; tie = false; }
    else if (n === bestN && n > 0) tie = true;
  }
  return bestN === 0 || tie ? null : best;
}

export function classifyIndividuation(mix) {
  const total = GRAINS.reduce((s, g) => s + (mix[g] ?? 0), 0);
  if (!total) return INDIVIDUATION.UNESTABLISHED;
  const d = dominantGrain(mix);
  return d ? GRAIN_INDIVIDUATION[d] : INDIVIDUATION.MIXED;
}

/**
 * levelProfile(id, referentActs) -> EOLevelProfile@1
 *
 * A READ, not a verdict: the 3×3 terrain occupancy the referent's own acts
 * earned, the terrains it did not reach (typed), the grain mix, and the
 * individuation that falls out of it.
 */
export function levelProfile(id, referentActs) {
  const occupancy = emptyOccupancy();
  const present = new Map();
  for (const a of referentActs ?? []) {
    occupancy[a.domain][a.grain] += 1;
    // Terrain cell = domain·grain; all three of a domain's modes share it, so
    // operations aggregate onto one terrain (NUL·Figure, SIG·Figure and
    // INS·Figure are all Entity). Never the operator·grain cell.
    const key = `${a.domain}·${a.grain}`;
    present.set(key, (present.get(key) ?? 0) + 1);
  }
  const earned = TERRAIN_CELLS.filter((t) => present.has(t.cell)).map((t) => ({ ...t, count: present.get(t.cell) }));
  const absent = TERRAIN_CELLS.filter((t) => !present.has(t.cell)).map((t) => gap("no_act_of_this_kind", { cell: t.cell, terrain: t.terrain, reason: `no ${t.terrain} act has been admitted for ${id}` }));
  const grainMix = {};
  for (const grain of GRAINS) grainMix[grain] = DOMAINS.reduce((s, d) => s + occupancy[d][grain], 0);
  const total = GRAINS.reduce((s, g) => s + grainMix[g], 0);
  return Object.freeze({
    schema: LEVEL_PROFILE_SCHEMA,
    id,
    occupancy: Object.freeze(occupancy),
    total,
    earned,
    absent,
    grainMix: Object.freeze(grainMix),
    dominantGrain: dominantGrain(grainMix),
    individuation: classifyIndividuation(grainMix),
    basis: Object.freeze({
      acts: total,
      terrainsReached: earned.length,
      terrainsAbsent: absent.length,
      note: total
        ? `${earned.length} of 9 terrains reached — individuation ${classifyIndividuation(grainMix)} from the grain mix (a nomination over admitted acts, never a lookup)`
        : "no act has been admitted for this being — every terrain is a typed absence, nothing is claimed",
    }),
  });
}

/**
 * buildLevelProfiles({ referents, acts }) -> { schema, byId, refusals, diagnostics }
 *
 * `referents` (optional) is the population to disclose — every member gets a
 * profile, INCLUDING members that admitted nothing, so their emptiness is
 * shown rather than hidden (entity-profile.js's own rule).
 */
export function buildLevelProfiles({ referents = null, acts = [] } = {}) {
  const { byReferent, refusals } = indexActs(acts);
  const ids = [...new Set([...(referents ?? []).map(String), ...byReferent.keys()])];
  const byId = new Map(ids.map((id) => [id, levelProfile(id, byReferent.get(id) ?? [])]));
  return Object.freeze({
    schema: LEVEL_PROFILES_SCHEMA,
    byId,
    refusals,
    diagnostics: Object.freeze({
      referents: ids.length,
      profiled: [...byId.values()].filter((p) => p.total > 0).length,
      unestablished: [...byId.values()].filter((p) => p.total === 0).length,
      acts: acts.length,
      refused: refusals.length,
    }),
  });
}

/** Mean of each referent's within-occupancy concentration: the largest single
 *  cell's share of that referent's acts. Referents with no acts do not enter
 *  (their absence is typed, not a zero to average). */
export function meanConcentration(profiles) {
  const vals = [];
  for (const p of profiles) {
    if (!p.total) continue;
    let max = 0;
    for (const domain of DOMAINS) for (const grain of GRAINS) max = Math.max(max, p.occupancy[domain][grain]);
    vals.push(max / p.total);
  }
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
}

/** The mean total-variation distance between each referent's OWN cell-mix and
 *  the population's — "does this being have a shape of its own?" A referent
 *  that just mirrors the population mix scores 0; one that lives mostly on
 *  cells few others use scores high. This is the statistic the permutation
 *  control measures, because concentration alone is blind when every referent
 *  happens to peak on the same cell. */
export function shapeDispersion(profiles) {
  const list = [...profiles];
  const pop = new Map();
  let total = 0;
  for (const p of list) for (const domain of DOMAINS) for (const grain of GRAINS) {
    const k = `${domain}·${grain}`;
    pop.set(k, (pop.get(k) ?? 0) + p.occupancy[domain][grain]);
    total += p.occupancy[domain][grain];
  }
  if (!total) return 0;
  const vals = [];
  for (const p of list) {
    if (!p.total) continue;
    let tv = 0;
    for (const domain of DOMAINS) for (const grain of GRAINS) {
      const k = `${domain}·${grain}`;
      tv += Math.abs(p.occupancy[domain][grain] / p.total - (pop.get(k) ?? 0) / total);
    }
    vals.push(tv / 2);
  }
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
}

/**
 * permutationControl({ referents, acts, reseeds, seed }) -> { statistic, null95, nullMean, lift, established }
 *
 * The II.23 control: permute the act→referent pairing `reseeds` times (the
 * multiset of cells is preserved; only WHICH referent each act lands on is
 * shuffled) and re-read the mean shape dispersion. If the real statistic does not
 * clear the shuffled 95th percentile, the per-referent reading is saying
 * nothing a random pairing would not — a typed non-finding, never a verdict.
 */
export function permutationControl({ referents = null, acts = [], reseeds = 64, seed = "level-profile" } = {}) {
  if (!Number.isInteger(reseeds) || reseeds < 2) return gap("undeclared", { what: "reseeds", why: "the resolution of the permutation null is never a default" });
  const { byReferent } = indexActs(acts);
  const ids = [...new Set([...(referents ?? []).map(String), ...byReferent.keys()])];
  const real = shapeDispersion(ids.map((id) => levelProfile(id, byReferent.get(id) ?? [])));
  // The landed acts, each carrying its referent — the shuffle moves only the label.
  const landed = [];
  for (const [ref, as] of byReferent) for (const a of as) landed.push({ ...a, referent: ref });
  if (landed.length < 2) return gap("empty_material", { reason: "fewer than two landed acts — nothing to permute", landed: landed.length });

  const labels = landed.map((a) => a.referent);
  const draws = [];
  for (let r = 0; r < reseeds; r++) {
    const rng = createSeededRng({ seed, purpose: "level-profile-permutation", r });
    const permuted = shuffled(labels, rng);
    const shuffledActs = landed.map((a, i) => ({ ...a, referent: permuted[i] }));
    const { byReferent: shuffledBy } = indexActs(shuffledActs);
    const pop = [...new Set([...ids, ...shuffledBy.keys()])];
    draws.push(shapeDispersion(pop.map((id) => levelProfile(id, shuffledBy.get(id) ?? []))));
  }
  draws.sort((a, b) => a - b);
  const null95 = draws[Math.min(draws.length - 1, Math.floor(draws.length * 0.95))];
  const nullMean = draws.reduce((s, v) => s + v, 0) / draws.length;
  return Object.freeze({
    statistic: real,
    null95,
    nullMean,
    lift: nullMean > 0 ? real / nullMean : Infinity,
    established: real > null95,
    reseeds,
  });
}

/** levelProfileLines(profile) -> string[] — a plain-text render, one line per
 *  earned terrain and a closing typed-absence count, surface-neutral. */
export function levelProfileLines(profile) {
  const lines = [`${profile.id} · ${profile.individuation} · ${profile.total} act${profile.total === 1 ? "" : "s"}`];
  for (const t of profile.earned) lines.push(`  ${t.terrain.padEnd(11)} ${t.cell} ×${t.count}`);
  lines.push(`  absent: ${profile.absent.length} of 9 terrains (typed)`);
  lines.push(`  basis: ${profile.basis.note}`);
  return lines;
}
