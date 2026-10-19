// native/assemblies.js — the starting assembly registry
// (ASSEMBLIES-AND-ARTIFACTS.md §2's table, made a value; READING-SPEC S25).
//
// This file is the concrete half of kernel/assembly.js: which organs make up
// which assembly, at the adapter/host layer where assemblies live (A2.4 —
// the kernel is not an assembly, and kernel/assembly.js holds only the
// register mechanics). Organs are PATH STRINGS, never imports — declaring an
// assembly must not load one.
//
// The table is the starting registry, NOT a claim that these cuts are right:
// each boundary is a hypothesis, refutable per boundary by the severance
// test (A4.2 — spec step 6, not yet run; §9's P-a pre-registers that the
// dynamics row fails it, which is why that row is layer: "projection").
//
// CELLS ARE MEASURED, NOT ASSERTED. Each assembly's cells list the
// (operator, grain) pairs its organs' own eoOperation calls emit — read off
// the code (surfaces.js CELL = SIG·Ground; revision.js INS·Ground/Figure +
// CON·Figure; identity.js CON/SEG·Figure, DEF·Figure, REC·Figure) — and
// contract.ops/terrains/stances are derived from them by cellOf, never
// hand-typed (kernel/assembly.js's own rule).
//
// A FINDING, recorded here rather than silently edited away: the spec's §2
// table gives the entity assembly the terrains "Entity, (Void for its
// refusals)", but the identity organs it lists EMIT cells whose terrains the
// cube derives as Link (CON/SEG·Figure) and Lens (DEF/REC·Figure) — terrain
// is derived from an operator's domain, not from an assembly's subject. The
// contract below declares the measured union, and whether identity's
// CON/SEG/DEF/REC belong to entity or to link is exactly the kind of
// boundary question the severance test exists to settle (step 6, with
// predictions frozen first). Until it runs, the measured truth is declared
// and the table's narrower claim is kept visible in this comment.

import { assembly, createAssemblyRegistry, registerAssembly } from "./kernel/assembly.js";

export const ENTITY = assembly({
  id: "assembly:entity",
  version: 1,
  layer: "lattice",
  // surfaces SIG·Ground; occurrence/referent admission INS·Ground/Figure;
  // identity hypotheses + links CON·Figure; splits SEG·Figure; exclusions
  // DEF·Figure; recanonicalization REC·Figure (identity.js's own REC).
  cells: [["SIG", "Ground"], ["INS", "Ground"], ["INS", "Figure"], ["CON", "Figure"], ["SEG", "Figure"], ["DEF", "Figure"], ["REC", "Figure"]],
  terrains: ["Entity", "Void"],
  organs: [
    "native/adapters/text/surfaces.js (discoverReferents)",
    "native/kernel/identity.js",
    "native/adapters/text/anchoring.js",
    "native/adapters/text/pronouns.js",
    "native/kernel/contest.js",
    "native/adapters/text/revision.js (the delta assembly point it shares with link)",
  ],
  regimes: {
    minSentences: { value: "derived per material (deriveMinSentences)", giver: "native/adapters/text/surfaces.js", basis: "recurrence floor derived from the material's own candidate distribution; a declared override says why (S15/S16)" },
    descriptorAnchoring: { value: { minActivation: 0.05, minMargin: 0.2 }, giver: "legacy host/corpus.js's declared operating point", basis: "disclosed-as-unvalidated pair, reused with its giver named, never re-derived (understanding-scoreboard.mjs's own citation)" },
    canonicalizationFloor: { value: 2, giver: "emergence/binding.js structural minimum", basis: "one arrival has no co-arrival to test; every surviving false identity belief on the coref golden stood on exactly one support" },
  },
  consumes: [{ kind: "CastLedger@1", as: "prior" }],
  produces: ["CastLedger@1"],
  stagesNotRun: [],
  dynamics: ["surprise"],
  note: "strongest row: goldens exist, precision measured, floors declared (§2)",
});

export const LINK = assembly({
  id: "assembly:link",
  version: 1,
  layer: "lattice",
  cells: [["CON", "Figure"]],
  terrains: ["Link", "Field"],
  organs: [
    "native/adapters/text/relations.js",
    "native/kernel/hypergraph.js",
    "native/kernel/relation-composition.js",
  ],
  regimes: {
    minRelationSurfaces: { value: 2, giver: "native/adapters/text/recursive.js (createCausalTextPerceiver)", basis: "anchor evidence and fold-conditioned relation evidence counted at the same declared strength — no new number, neither path privileged" },
    refreshEvery: { value: 25, giver: "native/adapters/text/recursive.js (createCausalTextPerceiver)", basis: "projection cadence over accumulated evidence — a batching dial, not a statistics floor (S4: the fold is the activation; nothing is re-read)" },
  },
  consumes: [{ kind: "CastLedger@1", as: "witness" }],
  produces: [],
  stagesNotRun: ["RelationLedger@1 sealing (spec step 8, in declared order after CastLedger@1)"],
  dynamics: ["surprise"],
  note: "measured; the causal arm is honest about its lookahead bound (S2/S3)",
});

export const NETWORK = assembly({
  id: "assembly:network",
  version: 1,
  layer: "lattice",
  cells: [],
  terrains: ["Network"],
  organs: ["native/kernel/network-standing.js", "native/kernel/terrain-math.js"],
  regimes: {
    draws: { value: 199, giver: "legacy host/population.js LINK_SPEC", basis: "the certified consumer's cut, cited not re-derived (network-standing.js's own header)" },
    alpha: { value: 0.05, giver: "legacy host/population.js LINK_SPEC", basis: "which p admits an edge is the caller's to cite" },
    window: { value: "declared or measured (dmdWindow)", giver: "native/kernel/activation.js", basis: "the reach of the present is measured from material behavior, never from length (S5)" },
  },
  consumes: [],
  produces: [],
  stagesNotRun: ["native run on real material — the organ exists; P6 calls this layer the substantive product and the native reading has never run it (§2 state)", "StandingRecord@1 sealing — A1.2: a verdict record travels; standing is re-granted per material, never transferred"],
  dynamics: [],
});

export const KIND = assembly({
  id: "assembly:kind",
  version: 1,
  layer: "lattice",
  cells: [],
  terrains: ["Kind"],
  organs: ["native/kernel/terrain-induction.js", "native/kernel/entity-kind-induction.js"],
  regimes: {},
  consumes: [],
  produces: [],
  stagesNotRun: ["measurement on real material — organ exists, thin evidence (§2 state)"],
  dynamics: [],
});

export const LENS = assembly({
  id: "assembly:lens",
  version: 1,
  layer: "lattice",
  cells: [],
  terrains: ["Lens"],
  organs: [
    "native/kernel/perspective.js",
    // ToM is the fold at any for-whom: self/user/entity as frames, folded at
    // three altitudes (atmosphere/lens/paradigm), higher-order by depth,
    // adjudicated by the parliament. Its three legs ARE the lens gate's
    // three legs — material=atmosphere, relevance=lens, coherence=paradigm.
    "native/kernel/theory-of-mind.js",
  ],
  regimes: {},
  consumes: [],
  produces: [],
  stagesNotRun: ["measurement on real material — organ exists, unmeasured (§2 state); the FOR-THEM fold and the parliament have walls in native/tests/theory-of-mind.test.js, no live caller"],
  dynamics: [],
});

export const ATMOSPHERE = assembly({
  id: "assembly:atmosphere",
  version: 1,
  layer: "lattice",
  cells: [],
  terrains: ["Atmosphere", "Paradigm"],
  organs: ["native/kernel/experience-priors.js", "native/kernel/rhythm-priors.js", "native/kernel/emergent-terrain.js"],
  regimes: {
    minRelationWorkSupport: { value: 1, giver: "native/kernel/experience-priors.js", basis: "a single earlier work is enough to leave a memory; cross-work recurrence strengthens it, never decides whether it exists" },
    minNetworkWorkSupport: { value: 1, giver: "native/kernel/experience-priors.js", basis: "same rule as minRelationWorkSupport, for remembered network signatures" },
    maxRelationVocabulary: { value: 512, giver: "native/kernel/experience-priors.js", basis: "export bound on carried relation vocabulary — a pruning choice, never an evidence floor" },
    minWorkSupport: { value: 1, giver: "native/kernel/rhythm-priors.js", basis: "same one-work rule, for pooled gap buckets" },
  },
  consumes: [{ kind: "ExperiencePrior@1", as: "prior" }, { kind: "RhythmPrior@1", as: "prior" }],
  produces: ["ExperiencePrior@1", "RhythmPrior@1"],
  stagesNotRun: [],
  dynamics: [],
  note: "rhythm transfer measured (0.469/0.512 — narrative-rhythm-transfer.json)",
});

export const SEQUENCE = assembly({
  id: "assembly:sequence",
  version: 1,
  layer: "lattice",
  cells: [],
  terrains: ["Link"],
  organs: ["native/kernel/sequence.js", "native/kernel/refutation.js", "native/kernel/reaction.js", "native/kernel/hyperlexicon.js"],
  regimes: {},
  consumes: [],
  produces: [],
  stagesNotRun: ["SequenceRegister@1 / DeclarationRegister@1 sealing (spec step 8, in declared order)"],
  dynamics: [],
  note: "cross-cutting: Link at position grain (S21); admitted by measurement 2026-08-28",
});

export const DYNAMICS = assembly({
  id: "assembly:dynamics",
  version: 1,
  layer: "projection",
  cells: [],
  terrains: [],
  organs: ["native/kernel/dynamics.js"],
  regimes: {},
  consumes: [],
  produces: [],
  stagesNotRun: ["per-assembly split (§6, spec step 7)"],
  dynamics: ["surprise", "tension", "release"],
  note: "P-a pre-registers that this row is a projection over present assemblies, not an assembly — the severance test (step 6) is expected to refuse this boundary and force §6's per-assembly split; kept on the register so the prediction has an object",
});

export const CONSTITUTIONAL_HOST = assembly({
  id: "assembly:constitutional-host",
  version: 1,
  layer: "baseline",
  cells: [],
  terrains: ["Void", "Entity", "Link"],
  organs: [
    "native/legacy-ported/packages/host/corpus.js (createSession / admitChunked / sessionReferents / sessionRelations)",
  ],
  regimes: {},
  consumes: [],
  produces: [],
  stagesNotRun: [
    "5b binding layer (displacement null / transfer entropy / reversal null — emergence/binding.js; P6 calls THIS the substantive product; 6.1's own reference run drives it from a script, not the host)",
    "6 altitude (tiers)",
    "7 population (classifyIndividuation)",
    "8 kind (jati/induceKinds)",
  ],
  dynamics: [],
  note: "S1's baseline: the constitutional reader is runnable and it is the measuring stick — a native path is not \"the reader\" until it reaches stage parity under conformance",
});

const ROWS = Object.freeze([ENTITY, LINK, NETWORK, KIND, LENS, ATMOSPHERE, SEQUENCE, DYNAMICS, CONSTITUTIONAL_HOST]);

/** The populated starting registry — rebuilt fresh on every call, so no
 * caller can mutate a shared one (the register value itself is immutable
 * anyway; this keeps even accidental sharing out). */
export function nativeRegistry() {
  let registry = createAssemblyRegistry();
  for (const row of ROWS) registry = registerAssembly(registry, row);
  return registry;
}
