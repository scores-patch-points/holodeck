// organs/barker.js — BARKER, the arch: kinds of measured systems, candidate arches across them, and the
// instruments that decide whether either may be believed. Pure (no fs, no fetch, no model); profiles are injected.
// Handle: Barker — after Cory David Barker (Archdisciplinary Research Center), who compares unification metatheories for what persists across them; here the same question put to measured systems, and to this map itself: coordinated, never outside. Amendment XVII.
//
// ═══ PRE-REGISTRATION (FOLD-CONSTITUTION II.5) ═════════════════════════════════
// Written BEFORE the first run of any line below. Nothing here is tuned after a result; a prediction that
// fails is reported as failed; a bug found later is fixed in code, listed in the report that accompanies the
// run, and NO declared constant, rule or prediction below is changed after a result is seen. The sha256 of
// this leading comment block (eval/competence/lib.mjs::headerDigest) is what a card stamps as prereg_sha256.
// Consistent with docs/BARKER.md (revised 2026-10-05, sections 3-8 and 11); where they differ, THE CODE AND
// THIS HEADER WIN and the difference is listed under LIMITS.
//
// DISCLOSURE. Before this header was written the author read docs/BARKER.md in full and the source of
// kernel/{kind-induction, entity-kind-induction, kind-functional-induction, rng, nullcheck}.js and
// organs/{kind-standing, signal, frame}.js and the earned-cast ban lists. Nothing in this file had been run.
// Numbers about the inducer's behaviour on structureless input (BARKER.md 2.4) are the architect's and are
// NOT reproduced or relied on here. The booklet (FoA) was not re-read for this module; nothing from it is
// reproduced; page numbers live in BARKER.md Appendix A.
//
// WHAT THIS MODULE CLAIMS (and what it does not).
//   It claims to be a CALIBRATED INSTRUMENT, not a finding. Concretely, on PLANTED worlds built here:
//   (C1) the kind pipeline (Kanada, characteristic sets, a spectral splitter, under ONE search-aware
//        ceiling over several block-preserving nulls, then a unimodality discriminator) detects a planted
//        discrete kind that spans lineages when the planting is strong and wide, returns nothing on a
//        block-permuted copy of the same matrix, and does NOT call a planted correlated CONTINUUM a CLUSTER
//        more often than the exact binomial bound allows (it calls it GRADIENT, or nothing);
//   (C2) the arch engine (the persistence rule of BARKER.md 4.6) labels a planted cross-lineage regularity
//        PERSISTENT when the layout can support it, labels a regularity carried by one lineage FAMILY-BOUND,
//        labels nothing on shuffled data, and says UNDERPOWERED BY REACHABILITY when too few lineages can
//        vote (which, on the real 33-system layout of 9 lineages, 8 of them single systems, is expected);
//   (C3) every verdict function (minimumEffectVerdict, persistence, powerTrio) can pass AND fail on planted
//        effects of known size in its own units, and an unlicensed bridge can never return REFUTED.
//   It claims NOTHING about languages, code or notation, and nothing about EO. It is the thing eval/barker/*
//   points at those with. A result produced by it is a claim about the systems measured, in the units of the
//   statistic, relative to a registered smallest effect of interest, and never "a universal".
//
// DEFINITIONS.
//   system      one measured symbolic system; the unit of induction. LINEAGE (answer key; 9 for the real
//               layout) is the unit of INDEPENDENCE; BRANCH (13) is the unit of BLOCKING. Neither is ever a feature.
//   profile     SystemProfile@1 (BARKER.md 3.1): cells {id, group, channel, value, n, ci95, resamples,
//               definitionId, builder, giver, floor}; EO-free (assertEoFree); frozen; content-hashed.
//   block matrix  n systems x F features. Each feature is ONE BLOCK: a bin label per system (cut at the median
//               of the reference systems, tercile for 3 bins; ties go to the lower bin) plus the stability
//               weight c = number of the cell's resamples that fall in the system's own bin (1 when none).
//               The signature `feature=bin` has evidence count c, so activity = 1 + ln c, as the inducer reads
//               it. Every null moves WHOLE BLOCKS (bin and weight together); a redeal that gives one system two
//               bins of one feature, or none, is a bug and is unit-tested against.
//   instruments  I1 Kanada (kernel/entity-kind-induction.js::induceEntityKindCandidates): T_K = largest margin
//               (observed binding energy minus the (1-alpha) quantile of random subsets of ITS OWN size) over
//               candidates the inducer itself marks stable, never over a fallback nomination, with at most
//               floor(n/2) members (a larger basin is judged as its complement), 0 when there is none.
//               I2 characteristic sets (kernel/kind-functional-induction.js::characteristicSetKinds, inner
//               draws declared): T_C = largest lift over licensed kinds with 4..floor(n/2) members, 0 if none.
//               I3 spectral splitter (Barker-owned): T_S = sigma_1^2 / sum sigma_k^2 of the column-centred,
//               column-standardised dense 0/1 matrix; kind = the smaller side of the sign split of the first
//               left singular vector.
//   nulls       N-feat  every block permuted across systems independently (marginals and one-hot kept).
//               N-cov   Gaussian copula: real marginals, real correlation (normal scores, Ledoit-Wolf analytic
//                       shrinkage toward identity), n iid rows, mapped back through the empirical quantiles,
//                       binned with the SAME cuts (weights borrowed from the nearest real value).
//               N-cov1  one-factor model (principal factor + independent residual variances), unshrunk.
//               N-fam   blocks permuted only within the branch stratum; every single-system branch is pooled
//                       into ONE stratum "singletons"; informative for a kind only if >= 4 of its members sit
//                       in multi-system branches, else typed fam_uninformative.
//               N-curve Curveball trades on a presence matrix (row and column sums kept; within strata when
//                       strata are given); defined ONLY for presence matrices, never for one-hot blocks.
//   ceiling     for each null v and draw d: M_v(d) = max over instruments of z_i(d) = (T_i(d) - mu_iv)/sigma_iv
//               (mu, sigma over that null's draws; sigma floored at 1e-9). Ceiling_v = (1-alpha) quantile of M_v.
//               A candidate with statistic T found by instrument i has z = (T - mu_iv)/sigma_iv and
//               p_v = (1 + #{d: M_v(d) >= z})/(D+1). It is ABOVE THE CEILING iff, for every null that was run
//               except N-fam, z > Ceiling_v and p_v <= alpha. Adding an instrument or a null can only raise
//               the bar; there is no switch to opt out.
//   gap test    separating coordinate u (contrast axis for Kanada and characteristic-set kinds; first left
//               singular vector for spectral); Hartigan dip of u (the minimum over unimodal CDFs, with an atom
//               allowed at the mode, of the sup-norm distance to the empirical CDF; no tuning parameter);
//               p_dip = (1 + #{N-cov draws whose top-ranked candidate of the SAME instrument has dip >= observed})
//               /(D+1), the axis re-derived inside each draw (draws with no candidate use the first spectral axis).
//   labels      REFUSED (a control survived; the copula calibration was rejected; the basin is the whole
//               population; no N-cov null was run) > not above the ceiling (not reported as a kind) >
//               GRADIENT (above the ceiling, p_dip > alpha) > FAMILY-BOUND (smaller side spans < 3 lineages after
//               its largest branch is dropped, or the kind loses to an INFORMATIVE N-fam) > CLUSTER (cross-lineage).
//   coupling    the organ's own generic arch family (the per-card arches A01-A13 live in eval/barker/induce.mjs):
//               for two features in DIFFERENT feature groups, the nested (system -> branch -> lineage) mean of
//               the product of their normal scores; oriented by the sign of the pooled mean. The scan is
//               search-aware: the ceiling is the (1-alpha) quantile of the MAXIMUM |pooled mean| over all
//               cross-group pairs under the null; the nulls move whole GROUPS (N-grp over all systems, N-fam within
//               branch strata), so within-group structure (compositional shares, Zipf/Heaps) cannot manufacture a pair.
//   persistence BARKER.md 4.6 exactly as implemented in persistence(): h_l = 1 iff theta_l - median(null_l) > 0
//               on a lineage whose planted power at 2*SESOI (at ITS OWN composition) is >= 0.8; undefined
//               lineages leave the denominator; the sign gate is reachability(n_l); the pooled interval is a
//               lineage-cluster bootstrap whose LOWER bound must exceed SESOI; PERSISTENT needs every gate;
//               PERSISTENT-OUTSIDE-IE is the same over the non-Indo-European lineages alone.
//   verdicts    minimumEffectVerdict implements BARKER.md 6.0 (and review amendment F5: an unlicensed bridge
//               can pass as SURVIVES with bridge:"unlicensed" and leaves the headline, and a failure becomes
//               WEAKENED with bridge:"failed", never REFUTED).
//
// CONTROLS BUILT TO FAIL (II.23).
//   K1  the whole kind pipeline on `controlReps` (3) block-permuted copies of the same matrix: INSTRUMENT_FAILED
//       iff the number of copies with a surviving kind is rejected as <= alpha by the exact one-sided binomial
//       test (2 of 3 rejects; 1 of 1 would). No kind is reported from a failed instrument.
//   K2  copulaCalibration: the whole pipeline on W-copula worlds carrying the real correlation and marginals and
//       no cluster; INSTRUMENT_FAILED iff the any-kind rate is rejected as <= alpha (16 of 200).
//   K3  W-continuum: one latent coordinate, no gap, correlation matched to the planted kind world in closed form
//       (matchedLoading); the call must be GRADIENT or nothing.
//   K4  coupling scan on `controlReps` N-grp-permuted copies: same binomial rule.
//   K5  the sample-level self-tests of BARKER.md 7 exist as hooks on every result (resample, permute, rerun).
//
// POWER CHECKS.
//   powerGrid plants W-kind and W-continuum on the supplied layout over strength x signatureCount; a cell is
//   ADMISSIBLE iff W-kind power >= 0.8 AND the continuum false-CLUSTER rate is not rejected as <= alpha AND the
//   continuum call is GRADIENT or nothing. A statement of absence is licensed only if the SESOI cell (a kind of
//   >= 4 systems in >= 3 lineages carried by >= 12 signatures at strength >= 0.5) is admissible; otherwise it is
//   UNDERPOWERED, never "not found". powerTrio plants 2s, 0.5s, s and 0.1s at ten times n for every verdict
//   function: SURVIVES >= 0.8 at 2s; REFUTED >= 0.8 at 0.5s; neither more often than alpha at exactly s; not
//   SURVIVES at 0.1s with huge n. archPowerCard plants a coupling at 2s and 0.5s on the layout; lineageSignPower
//   decides, BEFORE any real data, which lineages can vote at all.
//
// PASS RULES (implemented as written in the functions named).
//   reachability(U): the smallest attainable sign p is 2^-U; alpha is reachable only for U >= 5; passing counts
//   U = 9: 8, 8: 7, 7: 7, 6: 6, 5: 5, 4 or fewer: unreachable.
//   Holm applies to pooled-effect tests only; the sign test is a replication GATE at alpha, not a significance claim.
//   A kind is SESOI-sized iff >= 4 systems, >= 3 lineages, >= 12 signature features with member-vs-rest prevalence
//   contrast >= 0.5 (contrast rule PROVISIONAL).
//
// TYPED NUMBERS (P4: a bare integer is provisional; each says what would derive it).
//   ALPHA 0.05 (repo-declared, equal to adapters/text/keyness.js KEY_ALPHA, asserted by test); SEED 20261005; DRAWS 999.
//   bins 2 (median split; 3 = terciles as sensitivity) PROVISIONAL: the bin count maximising held-out kind stability.
//   minKindSize 4 (the registered smallest kind). Kanada `permutations` 64 and `neighborCount` the organ's own
//   ceil(sqrt n), sweep 2..6 reported as sensitivity (a count that moves with the knob is an artifact); characteristic-set
//   inner draws 19 (the smallest declared count whose p floor 1/20 can reach alpha); controlReps 3.
//   core-signature contrast 0.5 PROVISIONAL. Planted worlds: 10 common features (one shared factor, loading 0.5),
//   60 noise features, kind size max(4, round(n/4)), in-branch kind size 4, branch-genealogy share of the
//   branch-variant continuum 0.6, all PROVISIONAL (BARKER.md 4.4 states the others). Coupling SESOI 0.30
//   (Cohen medium; PROVISIONAL until signed; the per-card SESOIs of BARKER.md 4.7a are registered in induce.mjs).
//   bootstrap B 2000; lineage power reps 200; feature coverage floor 0.5 of the systems (a feature defined in fewer
//   is dropped and typed; PROVISIONAL: the smallest coverage at which the bin cut is stable). N-fam is informative for
//   a kind at >= 4 members in multi-system branches (the registered smallest kind). Numerical constants
//   (power-iteration 300 steps, 1e-10; jitter 1e-6) are not statistical choices.
//
// RECORDED PREDICTIONS (before any run; the architect's guesses, so that surprise is measurable).
//   P1 block integrity holds under every redeal (feat, fam, cov, cov1, curve): 1.00 (deterministic; a failure is a bug).
//   P2 dipStatistic: 1/(2n) on an equally spaced sample, 0.25 on two equal atoms, both within 1e-6: 0.90.
//   P3 planted W-kind at strength 0.8 with 24 signatures on the real 33-system layout, D = 39: CLUSTER with F1 >= 0.9
//      against the cross-lineage kind in at least 2 of 3 replicates: 0.60. At strength 0.3 with 6 signatures: in at most 1 of 3: 0.90.
//   P4 the matched W-continuum at (0.8, 24): CLUSTER false-call rate <= 2 of 12 worlds: 0.75; at least one GRADIENT call in 12: 0.50.
//   P5 block-permuted copies of the strong kind world yield no surviving kind in at least 5 of 6: 0.85.
//   P6 coupling arch, toy layout 8 lineages x 5 systems, planted correlation 0.8 between two features of different
//      groups: standing PERSISTENT: 0.60. The same coupling carried by one lineage only: not PERSISTENT: 0.95.
//      Shuffled data: no PERSISTENT: 0.95.
//   P7 coupling arches on the REAL layout (branch sizes 9,7,4,3,2,1x8; lineages as in BARKER.md 2.1): every one
//      UNDERPOWERED by reachability (fewer than 5 lineages can vote at 2*SESOI): 0.95.
//   P8 minimumEffectVerdict: an unlicensed bridge never returns REFUTED: 1.00. powerTrio on a normal-mean world:
//      P_up, P_down hold; tiny and exactly-s rates not rejected as <= alpha: 0.90.
//
// ADDENDUM A1 (2026-10-05). Written AFTER the first exploratory smoke on PLANTED worlds, BEFORE tests/barker-organ.test.js existed, and before any real data.
//   SEEN (scratch scripts, not kept): (a) on the real layout (33 systems; 118 features, 48 of them signature, 60 noise) the three-instrument menu found NO planted kind,
//   not even at strength 0.8 with 24 signatures per kind. Kanada at its own defaults returned ONE basin holding the whole population (neighborCount ceil(sqrt n) = 6), so it
//   was inert there (and slow: the kernel's standardParameters is quadratic in the basin). The spectral share T_S is second order and cannot exceed the one-factor null N-cov1,
//   which reproduces the first factor, noise-inflated when n << p. (b) A greedy affinity-growth search localised the planted kind (F1 0.9 to 1.0) and cleared N-feat and N-cov;
//   it cleared N-cov1 only at n = 100 with strength 0.95 and a kind holding 40 percent of the systems; at n = 33 and n = 60 it did not clear N-cov1. (c) The dip of a contrast axis
//   is bimodal by selection; its null (which pays for the selection) is the right comparison, and a planted 26-percent kind did NOT beat it while a 40-percent kind did.
//   CHANGED: I4 `grow` (greedy affinity growth, defined at its function) joins the menu, default menu [kanada, charset, spectral, grow]; it is judged under the SAME ceiling, so it can
//   only raise the bar. A2 (made while writing the arch engine, same day): persistence() treats a control that was not run as UNDERPOWERED, never as passed, and tries the
//   non-Indo-European reading for every outcome except INSTRUMENT_FAILED, TRIVIAL and CHANNEL-BOUND. A3 (same day, after the first test run): candidates from different instruments whose
//   member sets overlap with Jaccard >= 0.8 are ONE kind (typed, PROVISIONAL; the instrument with the larger standardised statistic names it, and foundBy lists them).
//   NOT CHANGED: the nulls, the ceiling, alpha, the labels, the dip, SESOIs, N-cov1 (unshrunk, as BARKER.md specifies). PREDICTION P3 above is FALSE for the three-instrument menu at the
//   real layout and is reported so; for the four-instrument menu it is to be measured by powerGrid, not asserted. Proposal for the architect: at n = 33 the unshrunk N-cov1 is the
//   binding constraint on every kind (its first factor is noise-inflated); a bias-corrected one-factor variant (random-matrix inverse of the eigenvalue inflation) is a candidate
//   sensitivity, NOT implemented, because it would change the registered null.
//   TEST WORLDS (chosen after the exploration above, so they test the MACHINERY, not power at the real layout; the real-layout power is for powerGrid to report):
//     TOY-K100  4 branches x 25, one lineage each; strength 0.95; 24 signatures per kind; 10 noise, 4 common; planted kind of 40 systems; instruments spectral and grow; nulls feat, cov, cov1, fam; D = 39.
//     TOY-C60   the matched continuum on 4 x 15 (both variants, 2 seeds each); same menu and nulls; D = 39.     TOY-NULL  block-permuted copies of TOY-K100.
//     TOY-ARCH  8 lineages x 5 systems, two feature groups of 9, a planted correlation of 0.8 between one feature of each (and the same carried by one lineage only; and shuffled data).
//   RECORDED PREDICTIONS for them (before they were run): A1.P1 TOY-K100 is called CLUSTER with F1 >= 0.9 against the planted kind in at least 2 of seeds {1,2,3}: 0.80.
//   A1.P2 TOY-C60 yields no CLUSTER and no FAMILY-BOUND in any of its 4 worlds: 0.85. A1.P3 at least 2 of 3 block-permuted copies yield no kind: 0.90. A1.P4 every pure-function test
//   (dip, binomial rules, reachability, nested means, bootstrap, ARI, agglomeration, verdict table, persistence table, audit, EO-free scan) passes at the FIRST run: 0.70.
//   A1.P5 TOY-ARCH: planted coupling PERSISTENT: 0.60 (P6 above); carried by one lineage: not PERSISTENT: 0.95; shuffled: no PERSISTENT: 0.95.
//
// SOURCE RULES (scanned by tests/barker-organ.test.js).
//   No LLM, embedding, network, fs or process access anywhere in this file. No EO module is imported and no EO
//   vocabulary appears in any profile it accepts. The only kernel organs imported are kernel/rng.js,
//   kernel/nullcheck.js, kernel/entity-kind-induction.js, kernel/kind-induction.js,
//   kernel/kind-functional-induction.js and organs/kind-standing.js. A candidate the inducer flags as a
//   fallback nomination is excluded wherever candidates are read. No description-length or parameter-count
//   penalty and no MDE-as-threshold appears: SESOIs are registered, never read off the instrument.
//
// LIMITS stated before any run.
//   N-cov and N-cov1 model dependence as Gaussian/one-factor; the t-copula (df 4) is a printed sensitivity only.
//   Charset kinds on one-hot data license nothing unless rows repeat (reported, not hidden). Kanada's own
//   internal null makes T_K censored at 0 on most draws; the p-value is rank-based so this costs power, not validity.
//   The dip null uses the top-ranked candidate of the same instrument. 9 lineages (8 single systems) make the
//   sign gate nearly unreachable for per-lineage regularities: UNDERPOWERED is the expected common result.
//   The notion of "arch" implemented here is cross-lineage persistence of a statistic; FoA's arches are claims
//   about frameworks, and an operationalisation can be a strawman (BARKER.md R9). The map is itself coordinated:
//   every output carries its own frame declaration and self-test hooks and claims no standpoint outside.
// ═══════════════════════════════════════════════════════════════════════════════

import { createSeededRng, shuffled, stableHash } from "../kernel/rng.js";
import { permutationCount } from "../kernel/nullcheck.js";
import { induceEntityKindCandidates } from "../kernel/entity-kind-induction.js";
import { kindEvidence, createKindInductionIndex, snapshotKindState } from "../kernel/kind-induction.js";
import { characteristicSetKinds, induceKindsAndFunctions } from "../kernel/kind-functional-induction.js";
import { kindMembership } from "./kind-standing.js";

const freeze = Object.freeze;

export const BARKER_VERSION = "1";
export const SEED = 20261005;
export const ALPHA = 0.05;
export const DRAWS = 999;

/** Tokens that may not appear in any profile identifier, group, channel, bin label, signature, definition or builder (BARKER.md 3.4). */
export const EO_BAN = freeze([
  "nul", "sig", "ins", "seg", "con", "syn", "def", "eva", "rec",
  "ground", "figure", "pattern", "existence", "structure", "interpretation",
  "differentiate", "relate", "generate", "void", "beings", "fold",
  "phasepost", "byface", "cell", "operator", "stance", "terrain", "grain",
]);
/** Path fragments of inputs that are EO-shaped by construction (BARKER.md 2.2 EXCLUDED list). `eo_` (Esperanto) is NOT among them. */
const EO_PATHS = freeze([/case-priors?\b/i, /act-priors?\b/i, /\.eot\.json$/i, /phasepost/i, /relation-kinds/i, /hyperlexicon/i, /(^|\/)cube\.js$/i, /byface/i]);

export const VERDICTS = freeze(["INSTRUMENT_FAILED", "UNDERPOWERED", "REFUTED", "WEAKENED", "SURVIVES", "NOT_TESTABLE_NOW"]);
export const ARCH_STATUS = freeze(["PERSISTENT", "PERSISTENT-OUTSIDE-IE", "FAMILY-BOUND", "CHANNEL-BOUND", "TRIVIAL", "ABSENT", "UNDERPOWERED", "INSTRUMENT_FAILED"]);
export const KIND_LABELS = freeze(["CLUSTER", "FAMILY-BOUND", "GRADIENT", "REFUSED"]);
export const NULL_KINDS = freeze(["feat", "cov", "cov1", "fam", "curve"]);
export const INSTRUMENTS = freeze(["kanada", "charset", "spectral", "grow"]);

/** Typed numbers (header: TYPED NUMBERS). Frozen so a caller cannot move them silently; options override per call and are recorded in provenance. */
export const DEFAULTS = freeze({
  bins: 2, minKindSize: 4, permutations: 64, csDraws: 19, controlReps: 3, coreContrast: 0.5, bootstrapB: 2000,
  couplingSesoi: 0.3, lineagePowerReps: 200, lineagePowerFloor: 0.8, commonLoading: 0.5, genealogyShare: 0.6, inBranchKindSize: 4,
  sigFloor: 1e-9,
});

/** The measured layout of BARKER.md 2.1 (33 natural languages: 13 branches, 9 lineages). The manifest written by eval/barker/profiles.mjs is authoritative; this is the design-time copy used by planted worlds and tests. */
export const REAL_LAYOUT = freeze({
  branchSizes: freeze([9, 7, 4, 3, 1, 2, 1, 1, 1, 1, 1, 1, 1]),
  branchNames: freeze(["Slavic", "Romance", "Germanic", "Indo-Iranian", "Hellenic", "Semitic", "Sinitic", "Japonic", "Koreanic", "Turkic", "Uralic", "Austronesian", "Austroasiatic"]),
  lineageOf: (b) => (b <= 4 ? 0 : b - 4),
  lineageNames: freeze(["Indo-European", "Afro-Asiatic", "Sino-Tibetan", "Japonic", "Koreanic", "Turkic", "Uralic", "Austronesian", "Austroasiatic"]),
});

const sorted = (xs) => [...xs].sort((a, b) => a - b);
const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);
const sumOf = (xs) => xs.reduce((s, x) => s + x, 0);
function sd(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) * (x - m), 0) / (xs.length - 1));
}
/** Type-7 quantile of an ALREADY SORTED array. */
function quantileSorted(s, q) {
  if (!s.length) return NaN;
  const pos = Math.min(1, Math.max(0, q)) * (s.length - 1);
  const lo = Math.floor(pos), hi = Math.min(s.length - 1, lo + 1);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}
const quantile = (xs, q) => quantileSorted(sorted(xs), q);
const median = (xs) => quantile(xs, 0.5);

/** A seeded generator keyed by any compound value, with a short burn-in (xorshift32 seeded from a hash needs it). */
export function makeRng(key) {
  const r = createSeededRng(key);
  for (let i = 0; i < 8; i += 1) r();
  return r;
}
function normalSampler(rng) {
  let spare = null;
  return () => {
    if (spare !== null) { const s = spare; spare = null; return s; }
    const u1 = Math.max(rng(), 1e-12), u2 = rng();
    const r = Math.sqrt(-2 * Math.log(u1)), th = 2 * Math.PI * u2;
    spare = r * Math.sin(th);
    return r * Math.cos(th);
  };
}

// ── normal and t distributions ─────────────────────────────────────────────
function erfc(x) {
  // Numerical Recipes erfcc, fractional error < 1.2e-7 everywhere; refined by one Newton step on the CDF is not needed here.
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}
export const normalCdf = (x) => 0.5 * erfc(-x / Math.SQRT2);
/** Acklam's rational approximation of the normal quantile (relative error about 1e-9). */
export function normalQuantile(p) {
  if (!(p > 0 && p < 1)) return p <= 0 ? -Infinity : Infinity;
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
  const lo = 0.02425, hi = 1 - lo;
  let q, r;
  if (p < lo) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (p > hi) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  q = p - 0.5; r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}
function lnGamma(x) {
  const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i += 1) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
function betacf(a, b, x) {
  const FPMIN = 1e-300;
  let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m += 1) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 3e-12) break;
  }
  return h;
}
function betaI(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
}
/** Student-t CDF with df degrees of freedom (regularised incomplete beta). */
export function tCdf(x, df) {
  const xx = df / (df + x * x);
  const ib = betaI(xx, df / 2, 0.5);
  return x >= 0 ? 1 - 0.5 * ib : 0.5 * ib;
}

// ── exact binomial machinery (sign tests, calibration rules) ───────────────
/** Exact P(X >= k) for X ~ Binomial(n, p0). */
export function signTestP(k, n, p0 = 0.5) {
  if (!Number.isInteger(n) || n < 0) throw new TypeError("signTestP: n must be a non-negative integer");
  if (k <= 0) return 1;
  if (k > n) return 0;
  if (p0 <= 0) return 0;
  if (p0 >= 1) return 1;
  let logp = n * Math.log(1 - p0);       // log pmf(0)
  const ratio = Math.log(p0) - Math.log(1 - p0);
  let acc = 0;
  for (let x = 0; x <= n; x += 1) {
    if (x > 0) logp += Math.log((n - x + 1) / x) + ratio;
    if (x >= k) acc += Math.exp(logp);
  }
  return Math.min(1, acc);
}
/** Smallest k with P(X >= k | n, p0) <= alpha (the count at which "the rate is at most p0" is rejected), or n + 1 when none exists. */
export function binomialRejectCount(n, p0 = ALPHA, alpha = ALPHA) {
  for (let k = 0; k <= n; k += 1) if (signTestP(k, n, p0) <= alpha) return k;
  return n + 1;
}
/** True iff k of n rejects the hypothesis that the true rate is at most p0 (exact one-sided binomial test at alpha). */
export const rateExceeds = (k, n, p0 = ALPHA, alpha = ALPHA) => signTestP(k, n, p0) <= alpha;
/** Power of that rejection rule against a true rate q. */
export function rejectionPower(n, q, p0 = ALPHA, alpha = ALPHA) { return signTestP(binomialRejectCount(n, p0, alpha), n, q); }
/** Wilson 95 percent interval for k of n. */
export function wilson(k, n, z = 1.959964) {
  if (!n) return [0, 1];
  const p = k / n, z2 = z * z, den = 1 + z2 / n, centre = (p + z2 / (2 * n)) / den;
  const half = z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n)) / den;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}
/** Holm step-down over p-values: boolean[] reject flags aligned with the input. */
export function holm(ps, alpha = ALPHA) {
  const order = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]);
  const reject = new Array(ps.length).fill(false);
  const m = ps.length;
  for (let r = 0; r < m; r += 1) {
    if (order[r][0] <= alpha / (m - r)) reject[order[r][1]] = true;
    else break;
  }
  return reject;
}
/** { minP, kNeeded } for a sign test over U independent lineages, or { unreachable: true } (BARKER.md 4.6). */
export function reachability(nLineages, alpha = ALPHA) {
  const n = nLineages;
  if (!Number.isInteger(n) || n < 1) return { unreachable: true, minP: 1, n };
  const minP = Math.pow(0.5, n);
  if (minP > alpha) return { unreachable: true, minP, n };
  for (let k = 0; k <= n; k += 1) {
    const p = signTestP(k, n, 0.5);
    if (p <= alpha) return { minP, kNeeded: k, p, n };
  }
  return { unreachable: true, minP, n };
}

// ── sample structure: nested means, cluster bootstrap, partitions ───────────
const entriesOf = (x) => (x instanceof Map ? [...x.entries()] : Array.isArray(x) ? x.map((v, i) => (Array.isArray(v) && v.length === 2 && typeof v[0] === "string" ? v : [String(i), v])) : Object.entries(x));
const lookup = (f, k) => (typeof f === "function" ? f(k) : f instanceof Map ? f.get(k) : f?.[k]);

/**
 * systems -> branches -> lineages. A branch's value is the mean of its systems, a lineage's the mean of its branches, and the
 * pooled value the mean of the lineages, so nine Slavic languages never outvote a singleton and Indo-European counts once.
 * Non-finite values are left out and counted. `lineageOf` is called with the SYSTEM id.
 */
export function nestedMean(valuesBySystem, branchOf, lineageOf) {
  const byLin = new Map();
  let skipped = 0;
  for (const [id, v] of entriesOf(valuesBySystem)) {
    if (!Number.isFinite(v)) { skipped += 1; continue; }
    const b = lookup(branchOf, id), l = lookup(lineageOf, id) ?? b;
    if (!byLin.has(l)) byLin.set(l, new Map());
    const br = byLin.get(l);
    if (!br.has(b)) br.set(b, []);
    br.get(b).push(v);
  }
  const perLineage = new Map(), perBranch = new Map();
  for (const [l, br] of byLin) {
    const bm = [];
    for (const [b, vs] of br) { const m = mean(vs); perBranch.set(`${l}|${b}`, m); bm.push(m); }
    perLineage.set(l, mean(bm));
  }
  return { perLineage, perBranch, mean: perLineage.size ? mean([...perLineage.values()]) : NaN, lineages: [...perLineage.keys()], skipped };
}

/** Percentile cluster bootstrap: clusters are resampled whole, with replacement; `stat` maps a values array to a number (default mean). */
export function clusterBootstrap(values, clusters, stat = mean, { B = DEFAULTS.bootstrapB, seed = SEED, level = 0.95 } = {}) {
  if (values.length !== clusters.length) throw new TypeError("clusterBootstrap: values and clusters must align");
  const groups = new Map();
  values.forEach((v, i) => { if (!groups.has(clusters[i])) groups.set(clusters[i], []); groups.get(clusters[i]).push(v); });
  const keys = [...groups.keys()];
  const est = stat(values);
  if (keys.length < 2) return { est, ci95: [NaN, NaN], B: 0, clusters: keys.length };
  const rng = makeRng({ seed, purpose: "cluster-bootstrap", n: values.length });
  const stats = [];
  for (let b = 0; b < B; b += 1) {
    const pick = [];
    for (let j = 0; j < keys.length; j += 1) pick.push(...groups.get(keys[Math.floor(rng() * keys.length)]));
    stats.push(stat(pick));
  }
  const s = sorted(stats.filter(Number.isFinite));
  const a = (1 - level) / 2;
  return { est, ci95: [quantileSorted(s, a), quantileSorted(s, 1 - a)], B, clusters: keys.length };
}

/** Adjusted Rand index between two label vectors. */
export function adjustedRand(a, b) {
  if (a.length !== b.length) throw new TypeError("adjustedRand: partitions must align");
  const n = a.length;
  if (n < 2) return 1;
  const ca = new Map(), cb = new Map(), cab = new Map();
  for (let i = 0; i < n; i += 1) {
    ca.set(a[i], (ca.get(a[i]) ?? 0) + 1);
    cb.set(b[i], (cb.get(b[i]) ?? 0) + 1);
    const k = `${a[i]}\u0001${b[i]}`;
    cab.set(k, (cab.get(k) ?? 0) + 1);
  }
  const c2 = (x) => x * (x - 1) / 2;
  const sab = sumOf([...cab.values()].map(c2)), sa = sumOf([...ca.values()].map(c2)), sb = sumOf([...cb.values()].map(c2));
  const expected = sa * sb / c2(n), maxIdx = (sa + sb) / 2;
  return maxIdx === expected ? 1 : (sab - expected) / (maxIdx - expected);
}

/**
 * Train-only agglomeration to exactly k groups (BARKER.md 6.0): repeatedly merge the pair of groups whose merger raises the TRAIN
 * cross-entropy least. No parameter-count penalty exists anywhere (held-out cross-entropy already pays for over-fitting).
 * `partition`: unit -> group label (Map, object or array); `trainStats`: unit -> count vector over outcome categories (same keying).
 * Returns { assignment: Map unit -> group, groups: Map group -> count vector, steps, ceTrain } with the cross-entropy in nats per observation.
 */
export function coarsenToK(partition, k, trainStats) {
  const part = new Map(entriesOf(partition)), stats = new Map(entriesOf(trainStats));
  if (!Number.isInteger(k) || k < 1) throw new TypeError("coarsenToK: k must be a positive integer");
  const groups = new Map();
  for (const [u, g] of part) {
    const v = stats.get(u);
    if (!v) continue;
    if (!groups.has(g)) groups.set(g, { id: g, units: [], counts: new Array(v.length).fill(0) });
    const G = groups.get(g);
    G.units.push(u);
    v.forEach((c, j) => { G.counts[j] += c; });
  }
  const ent = (counts) => { const n = sumOf(counts); let h = 0; for (const c of counts) if (c > 0) h -= c * Math.log(c / n); return h; };
  const steps = [];
  const live = [...groups.values()];
  while (live.length > k) {
    let best = null;
    for (let i = 0; i < live.length; i += 1) for (let j = i + 1; j < live.length; j += 1) {
      const merged = live[i].counts.map((c, t) => c + live[j].counts[t]);
      const delta = ent(merged) - ent(live[i].counts) - ent(live[j].counts);
      if (!best || delta < best.delta - 1e-12) best = { i, j, delta, merged };
    }
    const A = live[best.i], Bg = live[best.j];
    steps.push({ merged: [String(A.id), String(Bg.id)], delta: best.delta });
    live[best.i] = { id: A.id, units: [...A.units, ...Bg.units], counts: best.merged };
    live.splice(best.j, 1);
  }
  const assignment = new Map();
  for (const G of live) for (const u of G.units) assignment.set(u, G.id);
  const total = sumOf(live.map((G) => sumOf(G.counts)));
  return { assignment, groups: new Map(live.map((G) => [G.id, G.counts])), steps, ceTrain: total ? sumOf(live.map((G) => ent(G.counts))) / total : NaN };
}

// ── EO-free scan and the profile contract ──────────────────────────────────
const tokensOf = (s) => String(s ?? "").split(/[^A-Za-z0-9]+/).filter(Boolean).map((t) => t.toLowerCase());

/** { ok, offenders: [{ path, token }] } — EO vocabulary in identifiers, groups, channels, bins, signatures, definitions, builders, and EO-shaped input paths. */
export function assertEoFree(profileOrCells, { extraBan = [] } = {}) {
  const ban = new Set([...EO_BAN, ...extraBan.map((t) => String(t).toLowerCase())]);
  const offenders = [];
  const check = (path, text) => {
    const raw = String(text ?? "");
    if (/kind:basin/i.test(raw)) offenders.push({ path, token: "kind:basin" });
    for (const t of tokensOf(raw)) if (ban.has(t)) offenders.push({ path, token: t });
  };
  const cells = profileOrCells?.cells ?? profileOrCells ?? {};
  if (profileOrCells?.id) check("id", profileOrCells.id);
  for (const [key, cell] of Object.entries(cells)) {
    check(`cells.${key}`, key);
    if (cell && typeof cell === "object") {
      for (const f of ["id", "group", "channel", "definitionId", "builder", "giver", "bin", "signature"]) if (cell[f] !== undefined) check(`cells.${key}.${f}`, cell[f]);
    }
  }
  for (const [i, g] of (profileOrCells?.gaps ?? []).entries()) check(`gaps[${i}].feature`, g?.feature);
  for (const [i, inp] of (profileOrCells?.inputs ?? []).entries()) {
    const p = String(inp?.path ?? "");
    for (const re of EO_PATHS) if (re.test(p)) offenders.push({ path: `inputs[${i}].path`, token: re.source });
  }
  return { ok: offenders.length === 0, offenders };
}

const deepFreeze = (o) => {
  if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); }
  return o;
};
const wide = (text) => { const s = String(text); return `${stableHash(s)}${stableHash(`\u0001${s}`)}${stableHash(s.split("").reverse().join(""))}`; };
const stableText = (v) => (v === undefined ? "u" : v === null || typeof v !== "object" ? JSON.stringify(v) : Array.isArray(v) ? `[${v.map(stableText).join(",")}]` : `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stableText(v[k])}`).join(",")}}`);
/** Content hash (three FNV-1a lanes; an identifier, not a cryptographic digest — eval/barker re-hashes with sha256). */
export const contentHashOf = (v) => wide(stableText(v));

/**
 * Validates and freezes a SystemProfile@1 (BARKER.md 3.1). A cell that cannot state its giver, channel, n, definition, builder and a
 * ci95 POLICY (an interval, or an explicit null) is a gap, not a feature: it throws, and the caller records it in `gaps`.
 * Throws TypeError on an EO token and on a target cell that shares channel AND half with a predictor cell.
 */
export function makeSystemProfile({ id, kind, inputs = [], labels = {}, budget = {}, cells = {}, gaps = [], provenance = {} } = {}) {
  if (!id || typeof id !== "string") throw new TypeError("makeSystemProfile: id required");
  if (!["nl", "code", "notation"].includes(kind)) throw new TypeError(`makeSystemProfile: kind must be nl|code|notation, got ${kind}`);
  for (const [i, inp] of inputs.entries()) if (!inp?.path || !inp?.sha256 || !inp?.role) throw new TypeError(`makeSystemProfile: inputs[${i}] needs path, sha256, role`);
  const out = {};
  for (const [key, c] of Object.entries(cells)) {
    const miss = ["id", "group", "channel", "giver", "builder", "definitionId"].filter((f) => !(typeof c?.[f] === "string" && c[f].length));
    if (miss.length) throw new TypeError(`makeSystemProfile: cell ${key} lacks ${miss.join(", ")} (a cell that cannot state them is a gap, not a feature)`);
    if (!Number.isFinite(c.value)) throw new TypeError(`makeSystemProfile: cell ${key} has no finite value (record it in gaps)`);
    if (!Number.isInteger(c.n) || c.n < 0) throw new TypeError(`makeSystemProfile: cell ${key} needs an integer denominator n`);
    if (!("ci95" in c) || !(c.ci95 === null || (Array.isArray(c.ci95) && c.ci95.length === 2 && c.ci95.every(Number.isFinite)))) throw new TypeError(`makeSystemProfile: cell ${key} needs ci95 as [lo, hi] or an explicit null`);
    if (c.resamples !== undefined && !(Array.isArray(c.resamples) && c.resamples.every(Number.isFinite))) throw new TypeError(`makeSystemProfile: cell ${key} resamples must be finite numbers`);
    out[key] = { ...c, resamples: c.resamples ? [...c.resamples] : [], floor: c.floor ?? null };
  }
  const scan = assertEoFree({ id, cells: out, gaps, inputs });
  if (!scan.ok) throw new TypeError(`makeSystemProfile: EO vocabulary in profile ${id}: ${scan.offenders.map((o) => `${o.path}:${o.token}`).join("; ")}`);
  const predictors = Object.values(out).filter((c) => c.group !== "T");
  for (const t of Object.values(out).filter((c) => c.group === "T")) {
    if (t.half !== undefined && predictors.some((p) => p.channel === t.channel && p.half !== undefined && p.half === t.half)) throw new TypeError(`makeSystemProfile: train/target channel overlap on ${t.id} (channel ${t.channel}, half ${t.half})`);
  }
  const body = { schema: "SystemProfile@1", id, kind, inputs: inputs.map((x) => ({ ...x })), labels: { ...labels }, budget: { ...budget }, cells: out, gaps: gaps.map((g) => ({ ...g })), provenance: { ...provenance } };
  return deepFreeze({ ...body, eoFree: true, contentHash: contentHashOf({ cells: body.cells, inputs: body.inputs }) });
}

// ── the block matrix: one BLOCK per feature (bin + stability weight + continuous value) ──────
const binNames = (nBins) => (nBins === 2 ? ["lo", "hi"] : nBins === 3 ? ["lo", "mid", "hi"] : Array.from({ length: nBins }, (_, b) => `b${b}`));
const binOfValue = (cuts, v) => { let b = 0; for (const c of cuts) if (v > c) b += 1; return b; };

/**
 * Bins a rows-by-features table of CONTINUOUS values into a block matrix. Cuts come from the `reference` systems only (default all):
 * the median for 2 bins, the terciles for 3; a value equal to a cut goes to the lower bin. A feature with fewer than 2 reference values,
 * or whose reference values are all equal, or that ends up in one bin, is DROPPED and typed in `gaps` with its denominator.
 * `weights`: optional rows-by-features table of stability weights c >= 1 (default 1); `resamples`: optional rows-by-features table of
 * arrays, from which c = the number of resamples that fall in the system's own bin.
 * The matrix is stored column-major: bins[j], weights[j], values[j] are length-n typed arrays.
 */
export function blockMatrixFromValues(rows, { ids, featureKeys, bins = DEFAULTS.bins, reference = null, weights = null, resamples = null, groupOf = null, branches = null, lineages = null } = {}) {
  const n = rows.length;
  if (!ids || ids.length !== n) throw new TypeError("blockMatrixFromValues: ids must align with rows");
  const F0 = featureKeys.length;
  const ref = reference ? reference.map((r) => (typeof r === "number" ? r : ids.indexOf(r))).filter((i) => i >= 0) : Array.from({ length: n }, (_, i) => i);
  const kept = { keys: [], group: [], nBins: [], cuts: [], bins: [], weights: [], values: [] };
  const gaps = [];
  for (let j = 0; j < F0; j += 1) {
    const refVals = ref.map((i) => rows[i][j]).filter(Number.isFinite);
    if (refVals.length < 2) { gaps.push({ type: "feature_dropped", feature: featureKeys[j], reason: "too_few_reference_values", denominator: { have: refVals.length, need: 2 } }); continue; }
    const s = sorted(refVals);
    let cuts = bins === 3 ? [quantileSorted(s, 1 / 3), quantileSorted(s, 2 / 3)] : [quantileSorted(s, 0.5)];
    cuts = [...new Set(cuts)];
    if (s[0] === s[s.length - 1]) { gaps.push({ type: "feature_dropped", feature: featureKeys[j], reason: "constant", denominator: { have: refVals.length, need: 2 } }); continue; }
    const col = new Int8Array(n), w = new Float64Array(n), v = new Float64Array(n);
    const used = new Set();
    for (let i = 0; i < n; i += 1) {
      const x = rows[i][j];
      if (!Number.isFinite(x)) { col[i] = -1; w[i] = 0; v[i] = NaN; continue; }
      const b = binOfValue(cuts, x);
      col[i] = b; v[i] = x; used.add(b);
      let c = weights ? weights[i][j] : 1;
      if (resamples && Array.isArray(resamples[i]?.[j]) && resamples[i][j].length) c = Math.max(1, resamples[i][j].filter((r) => Number.isFinite(r) && binOfValue(cuts, r) === b).length);
      w[i] = Math.max(1, c);
    }
    if (used.size < 2) { gaps.push({ type: "feature_dropped", feature: featureKeys[j], reason: "one_bin", denominator: { have: used.size, need: 2 } }); continue; }
    kept.keys.push(featureKeys[j]); kept.group.push(groupOf ? groupOf[j] ?? null : null); kept.nBins.push(cuts.length + 1); kept.cuts.push(cuts); kept.bins.push(col); kept.weights.push(w); kept.values.push(v);
  }
  return { kind: "blocks", ids: [...ids], featureKeys: kept.keys, groupOf: kept.group, nBins: kept.nBins, cuts: kept.cuts, bins: kept.bins, weights: kept.weights, values: kept.values, branches: branches ? [...branches] : null, lineages: lineages ? [...lineages] : null, gaps, n };
}

/** Rows-by-features view of a block matrix's continuous values (NaN where undefined). */
export const valueRows = (bm) => Array.from({ length: bm.n }, (_, i) => bm.values.map((col) => col[i]));

/**
 * Block matrix from SystemProfile@1 objects. `groups`: feature groups to include (default every group except T, the targets, which are
 * never predictors). A feature defined in fewer than `minCoverage` of the systems is dropped and typed. Genealogy is read from
 * labels.branch / labels.lineage (falling back to labels.family) or from the `branchOf` / `lineageOf` overrides; it is an answer key and never a feature.
 */
export function blockMatrixOf(profiles, { groups = null, reference = null, bins = DEFAULTS.bins, minCoverage = 0.5, branchOf = null, lineageOf = null, includeTargets = false } = {}) {
  const ids = profiles.map((p) => p.id);
  if (new Set(ids).size !== ids.length) throw new TypeError("blockMatrixOf: duplicate system ids");
  const want = groups ? new Set(groups) : null;
  const seen = new Map();
  for (const p of profiles) for (const [key, c] of Object.entries(p.cells ?? {})) {
    if (c.group === "T" && !includeTargets) continue;
    if (want && !want.has(c.group)) continue;
    if (!seen.has(key)) seen.set(key, c.group);
  }
  const keys = [...seen.keys()].sort();
  const rows = profiles.map((p) => keys.map((k) => (Number.isFinite(p.cells?.[k]?.value) ? p.cells[k].value : NaN)));
  const res = profiles.map((p) => keys.map((k) => p.cells?.[k]?.resamples ?? null));
  const gaps = [];
  const keep = [];
  keys.forEach((k, j) => {
    const have = rows.filter((r) => Number.isFinite(r[j])).length;
    if (have < Math.ceil(minCoverage * profiles.length)) gaps.push({ type: "feature_dropped", feature: k, reason: "coverage", denominator: { have, need: Math.ceil(minCoverage * profiles.length) } });
    else keep.push(j);
  });
  const sel = (arr) => keep.map((j) => arr[j]);
  const bm = blockMatrixFromValues(rows.map(sel), { ids, featureKeys: sel(keys), bins, reference, resamples: res.map(sel), groupOf: sel(keys.map((k) => seen.get(k))) });
  const metaOf = new Map();
  for (const p of profiles) for (const [key, c] of Object.entries(p.cells ?? {})) if (!metaOf.has(key)) metaOf.set(key, { channel: c.channel, giver: c.giver, builder: c.builder, ancestors: c.ancestors ?? [] });
  bm.featureMeta = bm.featureKeys.map((k) => metaOf.get(k) ?? null);
  const branch = profiles.map((p) => String(branchOf ? lookup(branchOf, p.id) : (p.labels?.branch ?? p.labels?.family ?? "")));
  const lineage = profiles.map((p) => String(lineageOf ? lookup(lineageOf, p.id) : (p.labels?.lineage ?? p.labels?.family ?? p.labels?.branch ?? "")));
  bm.branches = branch.some((b) => b !== "") ? branch : null;
  bm.lineages = lineage.some((b) => b !== "") ? lineage : null;
  if (!lineageOf && profiles.some((p) => p.labels?.lineage === undefined)) gaps.push({ type: "lineage_label_fallback", detail: "labels.lineage is absent on some profiles: the family (or branch) label is read as the lineage. If those are branches of one lineage (Slavic and Romance are both Indo-European) the span and sign tests count them as independent and overstate replication; pass lineageOf or labels.lineage", denominator: { have: profiles.filter((p) => p.labels?.lineage !== undefined).length, need: profiles.length } });
  if (!branchOf && profiles.some((p) => p.labels?.branch === undefined)) gaps.push({ type: "branch_label_fallback", detail: "labels.branch is absent on some profiles: the family label is read as the branch (the blocking stratum of N-fam)", denominator: { have: profiles.filter((p) => p.labels?.branch !== undefined).length, need: profiles.length } });
  bm.gaps = [...gaps, ...bm.gaps];
  for (const p of profiles) for (const g of p.gaps ?? []) bm.gaps.push({ type: "profile_gap", system: p.id, ...g });
  return bm;
}

/** Presence matrix (Levels R, W, K and code inventories): rows are entities, columns are signatures; no one-hot blocks, so N-curve is defined. */
export function presenceMatrix({ ids, signatures, rows, strata = null, branches = null, lineages = null }) {
  if (rows.length !== ids.length) throw new TypeError("presenceMatrix: rows must align with ids");
  const index = new Map(signatures.map((s, k) => [s, k]));
  const R = rows.map((r) => Int32Array.from([...new Set([...r].map((s) => (typeof s === "number" ? s : index.get(s))))].filter((k) => k !== undefined).sort((a, b) => a - b)));
  return { kind: "presence", ids: [...ids], signatures: [...signatures], rows: R, strata: strata ? [...strata] : null, branches: branches ? [...branches] : null, lineages: lineages ? [...lineages] : null, n: ids.length, gaps: [] };
}

const isBlocks = (m) => m?.kind === "blocks";
const isPresence = (m) => m?.kind === "presence";

/** The inducer's own input: Map<systemId, Map<signature, record>>. Signatures are `feature=bin` (BARKER.md 4.1). */
export function entityFeaturesOf(m) {
  const out = new Map();
  if (isBlocks(m)) {
    for (let i = 0; i < m.n; i += 1) {
      const rec = new Map();
      for (let j = 0; j < m.featureKeys.length; j += 1) {
        const b = m.bins[j][i];
        if (b < 0) continue;
        const label = binNames(m.nBins[j])[b], sig = `${m.featureKeys[j]}=${label}`, c = Math.max(1, Math.round(m.weights[j][i]));
        const ev = new Set();
        for (let t = 0; t < c; t += 1) ev.add(`${m.ids[i]}:${sig}:${t}`);
        rec.set(sig, { signature: sig, featureKey: m.featureKeys[j], featureValue: label, firstAt: 0, lastAt: 0, evidenceIds: ev, witnessRefs: new Set() });
      }
      if (rec.size) out.set(m.ids[i], rec);
    }
    return out;
  }
  if (isPresence(m)) {
    for (let i = 0; i < m.n; i += 1) {
      const rec = new Map();
      for (const k of m.rows[i]) { const sig = m.signatures[k]; rec.set(sig, { signature: sig, featureKey: sig, featureValue: true, firstAt: 0, lastAt: 0, evidenceIds: new Set([`${m.ids[i]}:${sig}`]), witnessRefs: new Set() }); }
      if (rec.size) out.set(m.ids[i], rec);
    }
    return out;
  }
  throw new TypeError("entityFeaturesOf: expected a block or presence matrix");
}

/** Signature index for the inducers (BARKER.md 8.1). The block matrix is attached (non-enumerably) as `.matrix`. */
export function featureIndexOf(profiles, { groups = null, reference = null, bins = DEFAULTS.bins } = {}) {
  const bm = blockMatrixOf(profiles, { groups, reference, bins });
  const index = entityFeaturesOf(bm);
  if (index.size !== bm.ids.length) bm.gaps.push({ type: "entity_dropped", reason: "no_signature", denominator: { have: index.size, need: bm.ids.length } });
  Object.defineProperty(index, "matrix", { value: bm, enumerable: false });
  return index;
}

const denseCache = new WeakMap();
/** Dense 0/1 columns (column-major Float64Array(n)) and their signatures. */
export function denseColumns(m) {
  if (denseCache.has(m)) return denseCache.get(m);
  const cols = [], names = [];
  if (isBlocks(m)) {
    for (let j = 0; j < m.featureKeys.length; j += 1) {
      const labels = binNames(m.nBins[j]);
      for (let b = 0; b < m.nBins[j]; b += 1) {
        const c = new Float64Array(m.n);
        let any = false;
        for (let i = 0; i < m.n; i += 1) if (m.bins[j][i] === b) { c[i] = 1; any = true; }
        if (any) { cols.push(c); names.push({ feature: j, bin: b, signature: `${m.featureKeys[j]}=${labels[b]}` }); }
      }
    }
  } else if (isPresence(m)) {
    const cs = m.signatures.map(() => new Float64Array(m.n));
    for (let i = 0; i < m.n; i += 1) for (const k of m.rows[i]) cs[k][i] = 1;
    cs.forEach((c, k) => { if (c.some((x) => x)) { cols.push(c); names.push({ feature: k, bin: 0, signature: m.signatures[k] }); } });
  } else throw new TypeError("denseColumns: expected a block or presence matrix");
  const out = { cols, names };
  denseCache.set(m, out);
  return out;
}

/** The branch stratum of every system for N-fam: every single-system branch is pooled into ONE stratum "singletons" (derived, not typed). */
export function famStrata(branches) {
  const size = new Map();
  for (const b of branches) size.set(b, (size.get(b) ?? 0) + 1);
  return branches.map((b) => (size.get(b) >= 2 ? `b:${b}` : "singletons"));
}
/** N-fam is informative for a kind only when at least 4 of its members sit in multi-system branches (BARKER.md 4.3). */
export function famInformativeFor(memberIdx, strata, minMembers = 4) {
  if (!strata) return false;
  return memberIdx.filter((i) => strata[i] !== "singletons").length >= minMembers;
}

// ── correlation structure: copula models, effective dimension ───────────────
/** Pearson correlation matrix (array of arrays, pairwise-complete) of equal-length numeric columns; NaN marks missing. */
export function correlationMatrix(columns) {
  const F = columns.length, out = Array.from({ length: F }, () => new Array(F).fill(0));
  for (let a = 0; a < F; a += 1) {
    out[a][a] = 1;
    for (let b = a + 1; b < F; b += 1) {
      let n = 0, sa = 0, sb = 0;
      const A = columns[a], B = columns[b];
      for (let i = 0; i < A.length; i += 1) if (Number.isFinite(A[i]) && Number.isFinite(B[i])) { n += 1; sa += A[i]; sb += B[i]; }
      if (n < 3) continue;
      const ma = sa / n, mb = sb / n;
      let sxx = 0, syy = 0, sxy = 0;
      for (let i = 0; i < A.length; i += 1) if (Number.isFinite(A[i]) && Number.isFinite(B[i])) { const x = A[i] - ma, y = B[i] - mb; sxx += x * x; syy += y * y; sxy += x * y; }
      const r = sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
      out[a][b] = out[b][a] = r;
    }
  }
  return out;
}
/** Effective feature dimension (sum lambda)^2 / sum lambda^2 of a correlation matrix = trace^2 / squared Frobenius norm (no eigendecomposition needed). */
export function participationRatio(corr) {
  const F = corr.length;
  if (!F) return NaN;
  let tr = 0, fro = 0;
  for (let a = 0; a < F; a += 1) { tr += corr[a][a]; for (let b = 0; b < F; b += 1) fro += corr[a][b] * corr[a][b]; }
  return fro > 0 ? (tr * tr) / fro : NaN;
}

function cholesky(R, F) {
  // R flat F*F symmetric; returns lower-triangular flat L, adding a growing ridge until it factorises.
  for (let ridge = 0, attempt = 0; attempt < 8; attempt += 1, ridge = ridge === 0 ? 1e-6 : ridge * 10) {
    const L = new Float64Array(F * F);
    let ok = true;
    for (let i = 0; i < F && ok; i += 1) {
      for (let j = 0; j <= i; j += 1) {
        let s = R[i * F + j] + (i === j ? ridge : 0);
        for (let k = 0; k < j; k += 1) s -= L[i * F + k] * L[j * F + k];
        if (i === j) { if (s <= 1e-12) { ok = false; break; } L[i * F + i] = Math.sqrt(s); } else L[i * F + j] = s / L[j * F + j];
      }
    }
    if (ok) return L;
  }
  throw new Error("barker: correlation matrix could not be factorised");
}
function topEigen(S, F, iters = 300, tol = 1e-10) {
  let v = new Float64Array(F), w = new Float64Array(F);
  let nv = 0;
  for (let i = 0; i < F; i += 1) { v[i] = 1 + 0.5 * Math.sin(i + 1); nv += v[i] * v[i]; }
  nv = Math.sqrt(nv);
  for (let i = 0; i < F; i += 1) v[i] /= nv;
  let lambda = 0;
  for (let it = 0; it < iters; it += 1) {
    let norm = 0;
    for (let i = 0; i < F; i += 1) { let s = 0; const row = i * F; for (let k = 0; k < F; k += 1) s += S[row + k] * v[k]; w[i] = s; norm += s * s; }
    norm = Math.sqrt(norm);
    if (norm < 1e-300) break;
    let diff = 0;
    for (let i = 0; i < F; i += 1) { const x = w[i] / norm; diff += Math.abs(x - v[i]); w[i] = x; }
    const t = v; v = w; w = t;
    lambda = norm;
    if (diff < tol) break;
  }
  return { lambda, v };
}

/**
 * A copula model: correlation (shrunk or one-factor), the empirical marginals (sorted values and the weights aligned to them) and the
 * cuts the real matrix was binned with. `sampleCopula` draws n iid rows from it and bins them with the SAME cuts.
 */
function copulaModelOf({ F, corr, loadings = null, psi = null, tables, cuts, nBins }) {
  return { F, L: loadings ? null : cholesky(corr, F), loadings, psi, tables, cuts, nBins };
}
function sampleCopula(model, n, rng, { df = null, mask = null } = {}) {
  const normal = normalSampler(rng), { F, L, loadings, psi, tables, cuts } = model;
  const bins = Array.from({ length: F }, () => new Int8Array(n)), weights = Array.from({ length: F }, () => new Float64Array(n)), values = Array.from({ length: F }, () => new Float64Array(n));
  const eps = new Float64Array(F), z = new Float64Array(F);
  for (let i = 0; i < n; i += 1) {
    if (L) { for (let k = 0; k < F; k += 1) eps[k] = normal(); for (let j = 0; j < F; j += 1) { let s = 0; for (let k = 0; k <= j; k += 1) s += L[j * F + k] * eps[k]; z[j] = s; } }
    else { const f = normal(); for (let j = 0; j < F; j += 1) z[j] = loadings[j] * f + Math.sqrt(psi[j]) * normal(); }
    let scale = 1;
    if (df) { let chi = 0; for (let t = 0; t < df; t += 1) { const g = normal(); chi += g * g; } scale = Math.sqrt(df / Math.max(chi, 1e-12)); }
    for (let j = 0; j < F; j += 1) {
      if (mask && mask[j][i]) { bins[j][i] = -1; weights[j][i] = 0; values[j][i] = NaN; continue; }
      const u = df ? tCdf(z[j] * scale, df) : normalCdf(z[j]);
      const T = tables[j], m = T.sortedVals.length, pos = Math.min(1, Math.max(0, u)) * (m - 1), lo = Math.floor(pos), hi = Math.min(m - 1, lo + 1);
      const val = T.sortedVals[lo] + (T.sortedVals[hi] - T.sortedVals[lo]) * (pos - lo);
      values[j][i] = val; weights[j][i] = T.sortedW[Math.round(pos)]; bins[j][i] = binOfValue(cuts[j], val);
    }
  }
  return { bins, weights, values };
}

const copulaCache = new WeakMap();
/** Fits (once per matrix) the Gaussian-copula (Ledoit-Wolf shrunk) and one-factor models of a block matrix's continuous values. */
function copulaStateOf(bm) {
  if (copulaCache.has(bm)) return copulaCache.get(bm);
  const F = bm.featureKeys.length, n = bm.n;
  if (!F) throw new Error("barker: no features to build a copula from");
  const Z = [], tables = [], mask = [];
  for (let j = 0; j < F; j += 1) {
    const col = bm.values[j], idx = [];
    for (let i = 0; i < n; i += 1) if (Number.isFinite(col[i])) idx.push(i);
    idx.sort((a, b) => col[a] - col[b] || a - b);
    const m = idx.length, z = new Float64Array(n);
    for (let s = 0; s < m;) {
      let t = s;
      while (t + 1 < m && col[idx[t + 1]] === col[idx[s]]) t += 1;
      const r = (s + t) / 2 + 1;
      const score = normalQuantile((r - 0.5) / m);
      for (let q = s; q <= t; q += 1) z[idx[q]] = score;
      s = t + 1;
    }
    let ss = 0;
    for (const i of idx) ss += z[i] * z[i];
    const scale = ss > 0 ? Math.sqrt(m / ss) : 1;
    for (const i of idx) z[i] *= scale;
    Z.push(z);
    tables.push({ sortedVals: Float64Array.from(idx, (i) => col[i]), sortedW: Float64Array.from(idx, (i) => bm.weights[j][i]) });
    mask.push(Uint8Array.from({ length: n }, (_, i) => (Number.isFinite(col[i]) ? 0 : 1)));
  }
  const S = new Float64Array(F * F);
  for (let a = 0; a < F; a += 1) for (let b = a; b < F; b += 1) { let s = 0; for (let i = 0; i < n; i += 1) s += Z[a][i] * Z[b][i]; S[a * F + b] = S[b * F + a] = s / n; }
  for (let a = 0; a < F; a += 1) S[a * F + a] = 1;
  // Ledoit-Wolf analytic shrinkage toward the identity (parameter-free)
  let fro = 0;
  for (let a = 0; a < F * F; a += 1) fro += S[a] * S[a];
  let d2 = 0;
  for (let a = 0; a < F; a += 1) for (let b = 0; b < F; b += 1) { const x = S[a * F + b] - (a === b ? 1 : 0); d2 += x * x; }
  d2 /= F;
  let b2 = 0;
  for (let i = 0; i < n; i += 1) {
    let q4 = 0, xsx = 0;
    for (let a = 0; a < F; a += 1) q4 += Z[a][i] * Z[a][i];
    q4 *= q4;
    for (let a = 0; a < F; a += 1) { let s = 0; for (let b = 0; b < F; b += 1) s += S[a * F + b] * Z[b][i]; xsx += Z[a][i] * s; }
    b2 += (q4 - 2 * xsx + fro) / F;
  }
  b2 /= n * n;
  const delta = d2 > 0 ? Math.min(1, Math.max(0, Math.min(b2, d2) / d2)) : 1;
  const R = new Float64Array(F * F);
  for (let a = 0; a < F; a += 1) for (let b = 0; b < F; b += 1) R[a * F + b] = (1 - delta) * S[a * F + b] + (a === b ? delta : 0);
  const { lambda, v } = topEigen(S, F);
  const loadings = Float64Array.from(v, (x) => Math.max(-0.99, Math.min(0.99, Math.sqrt(Math.max(lambda, 0)) * x)));
  const psi = Float64Array.from(loadings, (l) => Math.max(1 - l * l, 0.01));
  const base = { F, tables, cuts: bm.cuts, nBins: bm.nBins };
  const state = { delta, mask, S, R, topLambda: lambda, cov: copulaModelOf({ ...base, corr: R }), cov1: copulaModelOf({ ...base, loadings, psi }), prObserved: participationRatio(Array.from({ length: F }, (_, a) => Array.from({ length: F }, (_, b) => S[a * F + b]))) };
  copulaCache.set(bm, state);
  return state;
}

// ── nulls: redeal whole blocks ───────────────────────────────────────────────
const blocksOrSingletons = (F, blocks) => (blocks ?? Array.from({ length: F }, (_, j) => [j]));

function curveball(rows, m, rng, strata = null) {
  const R = rows.map((r) => Array.from(r));
  const groups = new Map();
  R.forEach((_, i) => { const s = strata ? strata[i] : "all"; if (!groups.has(s)) groups.set(s, []); groups.get(s).push(i); });
  const eligible = [...groups.values()].filter((g) => g.length >= 2);
  if (!eligible.length) return R.map((r) => Int32Array.from(r));
  const mark = new Int8Array(m);
  const trades = R.length * 5;
  for (let t = 0; t < trades; t += 1) {
    const g = eligible[Math.floor(rng() * eligible.length)];
    const i = g[Math.floor(rng() * g.length)];
    let j = g[Math.floor(rng() * g.length)];
    if (i === j) continue;
    const A = R[i], B = R[j];
    for (const x of A) mark[x] = 1;
    for (const x of B) mark[x] += 2;
    const onlyA = [], onlyB = [], common = [];
    for (const x of A) if (mark[x] === 1) onlyA.push(x); else common.push(x);
    for (const x of B) if (mark[x] === 2) onlyB.push(x);
    for (const x of A) mark[x] = 0;
    for (const x of B) mark[x] = 0;
    if (!onlyA.length || !onlyB.length) continue;
    const pool = shuffled([...onlyA, ...onlyB], rng);
    R[i] = [...common, ...pool.slice(0, onlyA.length)];
    R[j] = [...common, ...pool.slice(onlyA.length)];
  }
  return R.map((r) => Int32Array.from(r.sort((a, b) => a - b)));
}

/**
 * Redeal under a null, MOVING WHOLE FEATURE BLOCKS (bin, weight and value together). kind: "feat" (every block permuted across systems),
 * "fam" (within the branch stratum; single-system branches pooled), "cov" (Gaussian copula with the observed marginals and correlation,
 * Ledoit-Wolf shrunk), "cov1" (one-factor, unshrunk) — all four on a block matrix — and "curve" (Curveball, within strata when given) on a
 * PRESENCE matrix only. `blocks` groups feature indices that must move together (default: each feature is its own block).
 * Pure and seeded: the caller supplies `rng`. Returns a new matrix; for "fam" it carries the strata used.
 */
export function redeal(matrix, { kind, blocks = null, continuous = null, branches = null, strata = null, rng, df = null } = {}) {
  if (typeof rng !== "function") throw new TypeError("redeal: rng must be supplied");
  if (kind === "curve") {
    if (!isPresence(matrix)) throw new TypeError("redeal: N-curve is defined only for presence matrices without one-hot blocks");
    return { ...matrix, rows: curveball(matrix.rows, matrix.signatures.length, rng, strata ?? matrix.strata), redealt: "curve" };
  }
  if (!isBlocks(matrix)) throw new TypeError(`redeal: ${kind} needs a block matrix`);
  const n = matrix.n, F = matrix.featureKeys.length;
  if (kind === "cov" || kind === "cov1") {
    if (continuous && continuous !== matrix.values) throw new TypeError("redeal: pass `continuous` by building the matrix from it (blockMatrixFromValues); the copula reads matrix.values");
    const state = copulaStateOf(matrix);
    const drawn = sampleCopula(kind === "cov" ? state.cov : state.cov1, n, rng, { df, mask: state.mask });
    return { ...matrix, bins: drawn.bins, weights: drawn.weights, values: drawn.values, redealt: kind };
  }
  if (kind !== "feat" && kind !== "fam") throw new TypeError(`redeal: unknown null ${kind}`);
  let groupsOf = null;
  if (kind === "fam") {
    const st = strata ?? (branches ? famStrata(branches) : matrix.branches ? famStrata(matrix.branches) : null);
    if (!st) throw new TypeError("redeal: N-fam needs strata or branches");
    const by = new Map();
    st.forEach((s, i) => { if (!by.has(s)) by.set(s, []); by.get(s).push(i); });
    groupsOf = [...by.values()];
  } else groupsOf = [Array.from({ length: n }, (_, i) => i)];
  const bins = matrix.bins.map((c) => c.slice()), weights = matrix.weights.map((c) => c.slice()), values = matrix.values.map((c) => c.slice());
  for (const block of blocksOrSingletons(F, blocks)) {
    const perm = new Int32Array(n);
    for (const g of groupsOf) { const sh = shuffled(g, rng); g.forEach((src, k) => { perm[src] = sh[k]; }); }
    for (const j of block) for (let i = 0; i < n; i += 1) { const s = perm[i]; bins[j][i] = matrix.bins[j][s]; weights[j][i] = matrix.weights[j][s]; values[j][i] = matrix.values[j][s]; }
  }
  return { ...matrix, bins, weights, values, redealt: kind, ...(kind === "fam" ? { famStrata: strata ?? famStrata(branches ?? matrix.branches) } : {}) };
}

// ── Hartigan dip: the distance from an empirical CDF to the nearest unimodal CDF ──────────
//
// The dip of a sample is the minimum over unimodal CDFs G of sup|F_n - G| (a unimodal G is convex up to its mode and concave after it,
// with an atom allowed AT the mode). Computed by bisection on d: for a given d every constraint on G is a band at the sample's distinct
// values, so for each candidate mode the left piece (convex, nondecreasing, anchored at 0) and the right piece (concave, nondecreasing,
// anchored at 1; handled by reflection) are each feasible iff the largest convex minorant of the nondecreasing envelope of the upper
// bounds clears the lower bounds, and the two pieces meet at the mode through the junction value g*. No tuning parameter.
const DIP_EPS = 1e-12;
let scratchU = new Float64Array(256), scratchSt = new Int32Array(256);
function convexBandFeasible(xs, lo, up, len) {
  if (len === 0) return true;
  if (scratchU.length < len) { scratchU = new Float64Array(len * 2); scratchSt = new Int32Array(len * 2); }
  const u = scratchU, st = scratchSt;
  let run = Infinity;
  for (let k = len - 1; k >= 0; k -= 1) { if (up[k] < run) run = up[k]; u[k] = run; }
  for (let k = 0; k < len; k += 1) if (lo[k] > u[k] + DIP_EPS) return false;
  if (len === 1) return true;
  let top = 0;
  for (let k = 0; k < len; k += 1) {
    while (top >= 2) {
      const a = st[top - 2], b = st[top - 1];
      if ((u[b] - u[a]) * (xs[k] - xs[b]) >= (u[k] - u[b]) * (xs[b] - xs[a])) top -= 1; else break;
    }
    st[top] = k; top += 1;
  }
  let s = 0;
  for (let k = 0; k < len; k += 1) {
    while (s + 1 < top - 1 && xs[st[s + 1]] <= xs[k]) s += 1;
    const a = st[s], b = st[Math.min(s + 1, top - 1)];
    const h = a === b ? u[a] : u[a] + (u[b] - u[a]) * (xs[k] - xs[a]) / (xs[b] - xs[a]);
    if (h < lo[k] - DIP_EPS) return false;
  }
  return true;
}

let dipXs = new Float64Array(256), dipLo = new Float64Array(256), dipUp = new Float64Array(256);
const Fprev = (Fc, k) => (k < 0 ? 0 : Fc[k]);
function fillRightPiece(v, Fc, d, j, gstar) {
  // right piece, mirrored (G' = 1 - G, x' = -x): points k = m-1 .. j with the junction value at v[j] LAST
  const m = v.length, rlen = m - j, xs = dipXs, lo = dipLo, up = dipUp;
  for (let t = 0; t < rlen; t += 1) {
    const k = m - 1 - t;
    xs[t] = -v[k];
    const loG = Math.max(0, Fc[k] - d);
    let upG = Math.min(1, Fprev(Fc, k - 1) + d), loGeff = loG;
    if (k === j) { upG = Math.min(1, Fc[j] + d); loGeff = Math.max(loG, gstar); }
    lo[t] = 1 - upG; up[t] = 1 - loGeff;
  }
  return rlen;
}
function fillLeftPiece(v, Fc, d, j, cap) {
  // left piece: points k = 0 .. j-1, then the left limit at v[j] (ghost) capped by the junction value
  const xs = dipXs, lo = dipLo, up = dipUp;
  for (let k = 0; k < j; k += 1) { xs[k] = v[k]; lo[k] = Math.max(0, Fprev(Fc, k) - d); up[k] = Math.min(1, Fprev(Fc, k - 1) + d); }
  xs[j] = v[j]; lo[j] = Math.max(0, Fprev(Fc, j - 1) - d); up[j] = Math.min(1, Fprev(Fc, j - 1) + d, cap);
  return j + 1;
}
const rightFeasible = (v, Fc, d, j, g) => { const len = fillRightPiece(v, Fc, d, j, g); return convexBandFeasible(dipXs, dipLo, dipUp, len); };
const leftFeasible = (v, Fc, d, j, cap) => { const len = fillLeftPiece(v, Fc, d, j, cap); return convexBandFeasible(dipXs, dipLo, dipUp, len); };

function dipFeasible(v, Fc, d, order) {
  const m = v.length;
  if (dipXs.length < m + 1) { dipXs = new Float64Array(2 * m + 2); dipLo = new Float64Array(2 * m + 2); dipUp = new Float64Array(2 * m + 2); }
  for (const j of order) {
    const gmin = Math.max(0, Fc[j] - d), gmax = Math.min(1, Fc[j] + d);
    if (!leftFeasible(v, Fc, d, j, 1)) continue;          // even the most generous junction cannot save the left piece
    if (!rightFeasible(v, Fc, d, j, gmin)) continue;      // nor the right piece
    if (rightFeasible(v, Fc, d, j, gmax)) return true;    // the most generous junction on both sides
    if (leftFeasible(v, Fc, d, j, gmin)) return true;     // left needs no more than the smallest junction value
    let gl = gmin, gh = gmax;                             // otherwise: the largest junction the right piece tolerates
    for (let it = 0; it < 16; it += 1) {
      const mid = (gl + gh) / 2;
      if (rightFeasible(v, Fc, d, j, mid)) gl = mid; else gh = mid;
    }
    if (leftFeasible(v, Fc, d, j, gl)) return true;
  }
  return false;
}

/**
 * Hartigan dip of a numeric sample: min over unimodal CDFs of the sup-norm distance to the empirical CDF. Always at least 1/(2n);
 * 1/(2n) for equally spaced points; 0.25 for two equal atoms; 0 for a single value.
 */
export function dipStatistic(u) {
  const xs = sorted(Array.from(u).filter(Number.isFinite));
  const n = xs.length;
  if (n < 2) return 0;
  const v = [], cnt = [];
  for (const x of xs) { if (v.length && x === v[v.length - 1]) cnt[cnt.length - 1] += 1; else { v.push(x); cnt.push(1); } }
  if (v.length < 2) return 0;
  const Fc = new Float64Array(v.length);
  let acc = 0;
  cnt.forEach((c, k) => { acc += c / n; Fc[k] = acc; });
  Fc[v.length - 1] = 1;
  const order = Array.from({ length: v.length }, (_, j) => j).sort((a, b) => Math.abs(Fc[a] - 0.5) - Math.abs(Fc[b] - 0.5));
  let lo = 1 / (2 * n) - 1e-9, hi = 0.5;
  for (let it = 0; it < 22; it += 1) {
    const mid = (lo + hi) / 2;
    if (dipFeasible(v, Fc, mid, order)) hi = mid; else lo = mid;
  }
  return hi;
}

// ── the instruments ───────────────────────────────────────────────────
function gramTop(cols, n) {
  const Xs = [];
  for (const c of cols) {
    let mu = 0;
    for (let i = 0; i < n; i += 1) mu += c[i];
    mu /= n;
    let v = 0;
    for (let i = 0; i < n; i += 1) v += (c[i] - mu) * (c[i] - mu);
    v /= n;
    if (v < 1e-12) continue;
    const s = Math.sqrt(v), x = new Float64Array(n);
    for (let i = 0; i < n; i += 1) x[i] = (c[i] - mu) / s;
    Xs.push(x);
  }
  if (!Xs.length) return null;
  const G = new Float64Array(n * n);
  for (const x of Xs) for (let i = 0; i < n; i += 1) { const xi = x[i]; if (xi === 0) continue; for (let k = i; k < n; k += 1) G[i * n + k] += xi * x[k]; }
  for (let i = 0; i < n; i += 1) for (let k = 0; k < i; k += 1) G[i * n + k] = G[k * n + i];
  let trace = 0;
  for (let i = 0; i < n; i += 1) trace += G[i * n + i];
  const { lambda, v } = topEigen(G, n);
  return { T: trace > 0 ? lambda / trace : 0, vec: v, lambda, trace };
}
function spectralTop(m, minKind) {
  const { cols } = denseColumns(m), n = m.n;
  const top = gramTop(cols, n);
  if (!top) return { T: 0, candidates: [], axis: null };
  const neg = [], pos = [];
  for (let i = 0; i < n; i += 1) (top.vec[i] < 0 ? neg : pos).push(i);
  const members = neg.length <= pos.length ? neg : pos;
  const candidates = members.length >= minKind && members.length <= Math.floor(n / 2) ? [{ instrument: "spectral", members, T: top.T }] : [];
  return { T: candidates.length ? top.T : 0, candidates, axis: Float64Array.from(top.vec), topT: top.T };
}
/** Axis of a member/complement contrast in signature space: u_i = x_i . (mean over members - mean over the rest). */
function contrastAxis(m, members) {
  const n = m.n, { cols } = denseColumns(m);
  if (!members.length || members.length >= n) return null;
  const inM = new Uint8Array(n);
  for (const i of members) inM[i] = 1;
  const u = new Float64Array(n), k = members.length, r = n - k;
  for (const c of cols) {
    let a = 0, b = 0;
    for (let i = 0; i < n; i += 1) { if (inM[i]) a += c[i]; else b += c[i]; }
    const w = a / k - b / r;
    if (w !== 0) for (let i = 0; i < n; i += 1) u[i] += c[i] * w;
  }
  return u;
}
/** The signatures that carry a kind: member-vs-rest prevalence contrast at least `contrast` (PROVISIONAL), strongest first. */
function coreSignaturesOf(m, members, contrast = DEFAULTS.coreContrast) {
  const n = m.n, { cols, names } = denseColumns(m), inM = new Uint8Array(n);
  for (const i of members) inM[i] = 1;
  const k = members.length, r = n - k, out = [];
  if (!k || !r) return out;
  cols.forEach((c, t) => {
    let a = 0, b = 0;
    for (let i = 0; i < n; i += 1) { if (inM[i]) a += c[i]; else b += c[i]; }
    const diff = a / k - b / r;
    if (diff >= contrast) out.push({ signature: names[t].signature, feature: names[t].feature, contrast: diff });
  });
  return out.sort((x, y) => y.contrast - x.contrast || x.signature.localeCompare(y.signature));
}

/**
 * I4 greedy affinity growth (added by addendum A1 of the header; Kanada-like: a kind is what its instances share, nothing declared in advance).
 * Pairwise agreement A_ij = sum over blocks of [same bin] - (chance agreement of that block), so a block's imbalance cannot manufacture it.
 * From every seed system a set grows by adding the system with the largest summed agreement to the set; at each size k in [minKind, floor(n/2)] the set
 * scores z_k = (mean pairwise agreement - mean over all pairs) / (pair SD / sqrt(C(k,2))). T_G = the best z over seeds and sizes; the kind is that set.
 * Up to `maxKinds` disjoint sets are returned (the observed run only); the null draws use only the best, which is the max statistic.
 */
function agreementMatrix(m) {
  const n = m.n, A = new Float64Array(n * n);
  for (let f = 0; f < m.featureKeys.length; f += 1) {
    const b = m.bins[f], nb = m.nBins[f], prev = new Float64Array(nb);
    let c = 0;
    for (let i = 0; i < n; i += 1) if (b[i] >= 0) { prev[b[i]] += 1; c += 1; }
    if (c < 2) continue;
    let chance = 0;
    for (let k = 0; k < nb; k += 1) chance += (prev[k] / c) * (prev[k] / c);
    for (let i = 0; i < n; i += 1) {
      if (b[i] < 0) continue;
      for (let j = i + 1; j < n; j += 1) if (b[j] >= 0) A[i * n + j] += (b[i] === b[j] ? 1 : 0) - chance;
    }
  }
  for (let i = 0; i < n; i += 1) for (let j = 0; j < i; j += 1) A[i * n + j] = A[j * n + i];
  return A;
}
function growBest(A, n, active, minK, half) {
  let tot = 0, tot2 = 0, cnt = 0;
  for (let i = 0; i < n; i += 1) if (active[i]) for (let j = i + 1; j < n; j += 1) if (active[j]) { const a = A[i * n + j]; tot += a; tot2 += a * a; cnt += 1; }
  if (cnt < 2) return null;
  const mu = tot / cnt, sdp = Math.sqrt(Math.max(tot2 / cnt - mu * mu, 0));
  if (sdp < 1e-12) return null;
  const cap = Math.min(half, active.reduce((s, x) => s + (x ? 1 : 0), 0));
  let best = null;
  for (let s = 0; s < n; s += 1) {
    if (!active[s]) continue;
    const inS = new Uint8Array(n), sums = new Float64Array(n);
    inS[s] = 1;
    for (let j = 0; j < n; j += 1) sums[j] = A[s * n + j];
    const set = [s];
    let W = 0;
    while (set.length < cap) {
      let bj = -1, bv = -Infinity;
      for (let j = 0; j < n; j += 1) if (active[j] && !inS[j] && sums[j] > bv) { bv = sums[j]; bj = j; }
      if (bj < 0) break;
      W += bv; set.push(bj); inS[bj] = 1;
      for (let j = 0; j < n; j += 1) sums[j] += A[bj * n + j];
      const k = set.length;
      if (k >= minK) {
        const pairs = k * (k - 1) / 2, z = (W / pairs - mu) / (sdp / Math.sqrt(pairs));
        if (!best || z > best.T) best = { T: z, members: [...set] };
      }
    }
  }
  return best;
}
function growTop(m, minK, { maxKinds = 1 } = {}) {
  const n = m.n, A = agreementMatrix(m), half = Math.floor(n / 2), active = new Uint8Array(n).fill(1);
  const candidates = [];
  for (let r = 0; r < maxKinds; r += 1) {
    const b = growBest(A, n, active, minK, half);
    if (!b) break;
    candidates.push({ instrument: "grow", members: b.members.slice().sort((x, y) => x - y), T: b.T });
    for (const i of b.members) active[i] = 0;
  }
  return { T: candidates.length ? candidates[0].T : 0, candidates, top: candidates[0]?.members ?? null };
}

/**
 * Runs one instrument on a matrix. `light` (null-draw mode) returns only the statistic and the top-ranked candidate's members for the
 * gap test; the observed run returns every ELIGIBLE candidate with its own statistic. A candidate the inducer flags as a fallback
 * nomination, or that is not stable, or is larger than its complement, is never eligible and is reported as ineligible, never as a kind.
 */
function runInstrument(name, m, ctx, { light = false } = {}) {
  const n = m.n, half = Math.floor(n / 2);
  if (name === "kanada") {
    const feats = entityFeaturesOf(m);
    if (feats.size < 2 * ctx.minKindSize) return { T: 0, candidates: [], top: null, ineligible: [{ reason: "population_too_small" }] };
    const res = induceEntityKindCandidates(feats, { permutations: ctx.permutations, quantile: 1 - ctx.alpha, population: `barker:${ctx.population}:${ctx.seed}`, minKindSize: ctx.minKindSize, ...(ctx.neighborCount ? { neighborCount: ctx.neighborCount } : {}) });
    const idx = new Map(m.ids.map((id, i) => [id, i]));
    const candidates = [], ineligible = [];
    for (const c of res.candidates) {
      if (c.fallbackNomination === true) { ineligible.push({ reason: "not_validated" }); continue; }
      if (c.field?.stable !== true) { ineligible.push({ reason: "not_stable" }); continue; }
      const members = c.memberRefs.map((id) => idx.get(id)).filter((i) => i !== undefined);
      if (members.length >= n) { ineligible.push({ reason: "no_boundary", members: members.length }); continue; }
      if (members.length > half) { ineligible.push({ reason: "larger_than_complement", members: members.length }); continue; }
      candidates.push({ instrument: "kanada", members, T: c.cohesionNull.observed - c.cohesionNull.threshold, bindingEnergy: c.field.bindingEnergy });
    }
    const first = res.candidates[0];
    const top = first ? first.memberRefs.map((id) => idx.get(id)).filter((i) => i !== undefined) : null;
    return { T: candidates.length ? Math.max(...candidates.map((c) => c.T)) : 0, candidates, top: top && top.length && top.length < n ? top : null, ineligible, diagnostics: light ? null : res.diagnostics };
  }
  if (name === "charset") {
    const feats = entityFeaturesOf(m);
    const res = characteristicSetKinds(feats, { draws: ctx.csDraws, alpha: ctx.alpha, seed: ctx.seed, population: `barker:cs:${ctx.population}` });
    const idx = new Map(m.ids.map((id, i) => [id, i]));
    const candidates = [];
    for (const c of res.candidates) {
      const members = c.memberRefs.map((id) => idx.get(id)).filter((i) => i !== undefined);
      if (members.length < ctx.minKindSize || members.length > half) continue;
      candidates.push({ instrument: "charset", members, T: c.lift, p: c.p });
    }
    const best = candidates.slice().sort((a, b) => b.T - a.T)[0];
    return { T: best ? best.T : 0, candidates, top: best ? best.members : null, ineligible: [], diagnostics: light ? null : res.diagnostics };
  }
  if (name === "spectral") {
    const r = spectralTop(m, ctx.minKindSize);
    return { T: r.T, candidates: r.candidates, top: r.candidates[0]?.members ?? null, axis: r.axis, ineligible: [] };
  }
  if (name === "grow") {
    if (!isBlocks(m)) throw new TypeError("barker: the growth instrument reads block matrices");
    const r = growTop(m, ctx.minKindSize, { maxKinds: light ? 1 : 3 });
    return { T: r.T, candidates: r.candidates, top: r.top, ineligible: [] };
  }
  throw new TypeError(`barker: unknown instrument ${name}`);
}

// ── the ceiling, the gap test, and the kind pipeline ─────────────────────────────
/**
 * The array form of BARKER.md 8.1: `rows` is the n-by-m binary signature matrix, `opts.blocks` the column indices of each feature's one-hot signatures, `opts.continuous`
 * (optional, n-by-F) the continuous values behind them, `opts.population` or `opts.ids` the system ids. Bin t of a block is the column that holds the 1 (bin order is read as
 * value order); the cuts the continuous draws are binned with are the midpoints between adjacent bins' value ranges, and when the bins are NOT value-ordered the
 * continuous values are dropped (typed) and the covariance nulls cannot run. Without continuous values the nulls are N-feat and N-fam only and no kind can be called.
 */
function matrixFromContract(rows, o) {
  const n = rows.length, blocks = o.blocks;
  if (!blocks?.length) throw new TypeError("induceSystemKinds: the array form needs opts.blocks (the column indices of each feature's one-hot signatures)");
  const ids = Array.isArray(o.ids) && o.ids.length === n ? o.ids.map(String) : Array.isArray(o.population) && o.population.length === n ? o.population.map(String) : Array.from({ length: n }, (_, i) => `s${i}`);
  const F = blocks.length, keys = Array.from({ length: F }, (_, j) => `f${String(j).padStart(3, "0")}`), gaps = [];
  let cont = o.continuous && o.continuous.length === n && o.continuous[0]?.length === F ? o.continuous : null;
  const bins = [], weights = [], nBins = [], cuts = [];
  for (let j = 0; j < F; j += 1) {
    const cols = blocks[j], k = cols.length, col = new Int8Array(n), w = new Float64Array(n);
    for (let i = 0; i < n; i += 1) {
      let t = -1;
      for (let q = 0; q < k; q += 1) if (rows[i][cols[q]] > 0) { t = q; break; }
      col[i] = t; w[i] = t >= 0 ? Math.max(1, Math.round(rows[i][cols[t]])) : 0;
    }
    bins.push(col); weights.push(w); nBins.push(k);
    cuts.push([]);
    if (cont) {
      const ranges = Array.from({ length: k }, () => ({ lo: Infinity, hi: -Infinity }));
      for (let i = 0; i < n; i += 1) if (col[i] >= 0 && Number.isFinite(cont[i][j])) { ranges[col[i]].lo = Math.min(ranges[col[i]].lo, cont[i][j]); ranges[col[i]].hi = Math.max(ranges[col[i]].hi, cont[i][j]); }
      let ok = k >= 2 && k <= 3;
      for (let q = 0; q + 1 < k && ok; q += 1) {
        if (ranges[q].hi === -Infinity || ranges[q + 1].lo === Infinity || ranges[q].hi > ranges[q + 1].lo) ok = false;
        else cuts[j].push((ranges[q].hi + ranges[q + 1].lo) / 2);
      }
      if (!ok) { gaps.push({ type: "bins_not_value_ordered", feature: keys[j], detail: "the continuous values do not reproduce the binary blocks as ordered bins; the copula nulls cannot run" }); cont = null; }
    }
  }
  const values = bins.map((_, j) => Float64Array.from({ length: n }, (__, i) => (cont ? cont[i][j] : NaN)));
  return { kind: "blocks", ids, featureKeys: keys, groupOf: keys.map(() => null), nBins, cuts: cont ? cuts : cuts.map(() => []), bins, weights, values, branches: o.branches ? [...o.branches] : null, lineages: o.lineages ? [...o.lineages] : null, gaps, n, noContinuous: !cont };
}

function resolveKindOpts(matrix, o) {
  const instruments = o.instruments ?? INSTRUMENTS;
  for (const i of instruments) if (!INSTRUMENTS.includes(i)) throw new TypeError(`induceSystemKinds: unknown instrument ${i}`);
  const branches = o.branches ?? matrix.branches ?? null, lineages = o.lineages ?? matrix.lineages ?? null;
  const strata = branches ? famStrata(branches) : null;
  const hasFam = !!strata && new Set(strata).size > 1 && strata.some((s) => s !== "singletons");
  const defaultNulls = isBlocks(matrix) ? ["feat", ...(matrix.noContinuous ? [] : ["cov", "cov1"]), ...(hasFam ? ["fam"] : [])] : ["curve"];
  return {
    instruments, draws: o.draws ?? DRAWS, alpha: o.alpha ?? ALPHA, seed: o.seed ?? SEED, population: Array.isArray(o.population) ? `n${o.population.length}` : String(o.population ?? "S"),
    nulls: o.nulls ?? defaultNulls, minKindSize: o.minKindSize ?? DEFAULTS.minKindSize, permutations: o.permutations ?? DEFAULTS.permutations, csDraws: o.csDraws ?? DEFAULTS.csDraws,
    controlReps: o.controlReps ?? DEFAULTS.controlReps, controlDraws: o.controlDraws ?? null, branches, lineages, strata, blocks: o.blocks ?? null,
    calibration: o.calibration ?? null, grid: o.grid ?? null, sweep: o.neighborSweep ?? true, group: o.group ?? null, allowUnlabelled: o.allowUnlabelled === true, onProgress: o.onProgress ?? null,
  };
}

const memberKey = (idx) => [...idx].sort((a, b) => a - b).join(",");
function lineageSpanOf(members, branches, lineages) {
  if (!lineages) return { span: null, afterDrop: null, branches: null };
  const bySize = new Map();
  for (const i of members) { const b = branches ? branches[i] : lineages[i]; bySize.set(b, (bySize.get(b) ?? 0) + 1); }
  let big = null, bigN = -1;
  for (const [b, c] of bySize) if (c > bigN) { big = b; bigN = c; }
  const all = new Set(members.map((i) => lineages[i]));
  const rest = new Set(members.filter((i) => (branches ? branches[i] : lineages[i]) !== big).map((i) => lineages[i]));
  return { span: all.size, afterDrop: rest.size, branches: bySize.size };
}

/** Spectral first axis of a matrix (always defined when any column varies): the fallback axis for a draw in which an instrument produced no candidate. */
const spectralAxisOf = (m) => { const { cols } = denseColumns(m); const t = gramTop(cols, m.n); return t ? Float64Array.from(t.vec) : null; };
const axisForTop = (instrument, X, run) => {
  if (instrument === "spectral") return run.axis ?? spectralAxisOf(X);
  const a = run.top ? contrastAxis(X, run.top) : null;
  return a ?? spectralAxisOf(X);
};

/**
 * Kind-versus-gradient (BARKER.md 4.3): the Hartigan dip of the separating coordinate against the dips the SAME instrument's top-ranked
 * candidate gives inside N-cov draws (its axis re-derived in every draw, so the choice of axis is paid for). Passing the ceiling says there is
 * structure beyond the nulls; this says whether the structure is a gap. `kind` carries { instrument, members } (indices or ids).
 * Pass `nullAxes` (one axis per draw) when the draws already exist; otherwise they are run here.
 */
export function kindOrGradient(kind, matrix, { draws = DRAWS, alpha = ALPHA, seed = SEED, branches = matrix.branches ?? null, lineages = matrix.lineages ?? null, nullAxes = null, ...rest } = {}) {
  const idx = new Map(matrix.ids.map((id, i) => [id, i]));
  const members = (kind.members ?? kind.memberRefs).map((m) => (typeof m === "number" ? m : idx.get(m)));
  const instrument = kind.instrument ?? "spectral";
  if (members.length >= matrix.n) return { label: "REFUSED", reason: "no_boundary", u: null, dip: null, pDip: null, lineageSpan: null, pr: null };
  const u = instrument === "spectral" && kind.axis ? Float64Array.from(kind.axis) : contrastAxis(matrix, members);
  const dip = dipStatistic(u);
  let axes = nullAxes;
  if (!axes) {
    const o = resolveKindOpts(matrix, { ...rest, draws, alpha, seed, branches, lineages });
    const ctx = { alpha, seed, population: o.population, permutations: o.permutations, csDraws: o.csDraws, minKindSize: o.minKindSize };
    axes = [];
    for (let d = 0; d < draws; d += 1) {
      const X = redeal(matrix, { kind: "cov", rng: makeRng({ seed, population: o.population, test: "cov", purpose: "redeal", d }) });
      axes.push(axisForTop(instrument, X, runInstrument(instrument, X, ctx, { light: true })));
    }
  }
  const nullDips = axes.map((a) => (a ? dipStatistic(a) : 0));
  const pDip = (1 + nullDips.filter((x) => x >= dip - 1e-12).length) / (nullDips.length + 1);
  const span = lineageSpanOf(members, branches, lineages);
  const pr = participationRatio(correlationMatrix(matrix.values));
  let label;
  if (pDip > alpha) label = "GRADIENT";
  else if (span.afterDrop !== null && span.afterDrop < 3) label = "FAMILY-BOUND";
  else label = span.afterDrop === null ? "REFUSED" : "CLUSTER";
  return { label, u, dip, pDip, lineageSpan: span, pr, ...(label === "REFUSED" ? { reason: "no_lineage_labels" } : {}) };
}

/**
 * THE kind pipeline. Runs the instrument menu once on the matrix and once inside every redeal of every null, forms ONE search-aware
 * ceiling (the largest over the nulls of the (1-alpha) quantile of the maximum standardised statistic over the menu), judges every eligible
 * candidate against it, runs the dip discriminator on the survivors, and labels them CLUSTER, FAMILY-BOUND, GRADIENT or REFUSED.
 * Controls: `controlReps` block-permuted copies must yield no kind (exact binomial rule); `calibration` (from copulaCalibration) is honoured.
 * Returns { kinds, refused, ceiling, diagnostics, gaps }. Never reads a fallback nomination; a failed control reports no kind.
 */
export function induceSystemKinds(matrixIn, opts = {}) {
  const matrix = Array.isArray(matrixIn) ? matrixFromContract(matrixIn, opts) : matrixIn;
  if (!isBlocks(matrix) && !isPresence(matrix)) throw new TypeError("induceSystemKinds: expected a block matrix, a presence matrix, or the array form (binary rows with opts.blocks)");
  if (isBlocks(matrix) && matrix.noContinuous && (opts.nulls ?? []).some((x) => x === "cov" || x === "cov1")) throw new TypeError("induceSystemKinds: N-cov and N-cov1 need the continuous values (opts.continuous in the array form)");
  const o = resolveKindOpts(matrix, opts);
  const { instruments, draws, alpha, seed, nulls } = o;
  const n = matrix.n, gaps = [...(matrix.gaps ?? [])], refused = [];
  const ctx = { alpha, seed, population: o.population, permutations: o.permutations, csDraws: o.csDraws, minKindSize: o.minKindSize };
  const diagnostics = { n, features: isBlocks(matrix) ? matrix.featureKeys.length : matrix.signatures.length, instruments: [...instruments], nulls: [...nulls], draws, alpha, seed, minKindSize: o.minKindSize, permutations: o.permutations, csDraws: o.csDraws, group: o.group, tried: 0, ineligible: [] };
  if (n < 2 * o.minKindSize) {
    refused.push({ type: "population_too_small", detail: { n, need: 2 * o.minKindSize } });
    return { kinds: [], refused, ceiling: null, diagnostics, gaps };
  }
  if (isBlocks(matrix) && !matrix.featureKeys.length) { refused.push({ type: "no_features" }); return { kinds: [], refused, ceiling: null, diagnostics, gaps }; }
  for (const nu of nulls) if (!NULL_KINDS.includes(nu)) throw new TypeError(`induceSystemKinds: unknown null ${nu}`);
  if (isBlocks(matrix) && nulls.includes("curve")) throw new TypeError("induceSystemKinds: N-curve is defined only for presence matrices");
  if (isPresence(matrix) && nulls.some((x) => x !== "curve")) throw new TypeError("induceSystemKinds: a presence matrix takes N-curve only");
  if (nulls.includes("fam") && !o.strata) throw new TypeError("induceSystemKinds: N-fam needs branches");

  const pr = isBlocks(matrix) ? { group: participationRatio(correlationMatrix(matrix.values)) } : { group: null };
  diagnostics.effectiveDimension = pr.group;
  const progress = (what, d) => { if (o.onProgress) o.onProgress({ what, d, of: draws }); };

  // ---- observed
  const obs = {};
  for (const i of instruments) obs[i] = runInstrument(i, matrix, ctx);
  const spectralObs = obs.spectral?.axis ?? (isBlocks(matrix) || isPresence(matrix) ? spectralAxisOf(matrix) : null);
  for (const i of instruments) diagnostics.ineligible.push(...(obs[i].ineligible ?? []).map((x) => ({ instrument: i, ...x })));
  for (const x of diagnostics.ineligible) if (x.reason === "no_boundary") refused.push({ type: "no_boundary", detail: x });
  const observed = instruments.flatMap((i) => obs[i].candidates.map((c) => ({ ...c })));
  diagnostics.tried = observed.length;

  // ---- nulls
  const nullState = {};
  for (const nu of nulls) {
    const T = Object.fromEntries(instruments.map((i) => [i, new Float64Array(draws)]));
    const axes = nu === "cov" ? Object.fromEntries(instruments.map((i) => [i, new Array(draws).fill(null)])) : null;
    for (let d = 0; d < draws; d += 1) {
      const rng = makeRng({ seed, population: o.population, test: nu, purpose: "redeal", d });
      const X = redeal(matrix, { kind: nu, rng, strata: o.strata, blocks: o.blocks });
      for (const i of instruments) {
        const r = runInstrument(i, X, ctx, { light: true });
        T[i][d] = r.T;
        if (axes) axes[i][d] = axisForTop(i, X, r);
      }
      if (d % 25 === 0) progress(nu, d);
    }
    const mu = {}, sg = {};
    for (const i of instruments) { mu[i] = mean(T[i]); sg[i] = Math.max(sd(T[i]), DEFAULTS.sigFloor); }
    const M = new Float64Array(draws);
    for (let d = 0; d < draws; d += 1) { let best = -Infinity; for (const i of instruments) best = Math.max(best, (T[i][d] - mu[i]) / sg[i]); M[d] = best; }
    nullState[nu] = { T, axes, mu, sg, M, ceiling: quantile(Array.from(M), 1 - alpha) };
  }
  const ceilings = Object.fromEntries(nulls.map((nu) => [nu, nullState[nu].ceiling]));
  const ceiling = { value: nulls.length ? Math.max(...Object.values(ceilings)) : null, perNull: ceilings, nulls: [...nulls], D: draws, alpha, instruments: [...instruments], mu: Object.fromEntries(nulls.map((nu) => [nu, nullState[nu].mu])), sigma: Object.fromEntries(nulls.map((nu) => [nu, nullState[nu].sg])) };

  // ---- controls built to fail, and the copula calibration
  let control = null;
  const wantControl = o.controlReps > 0 && !opts._inControl;
  if (wantControl) {
    let survivors = 0;
    const reps = [];
    for (let r = 0; r < o.controlReps; r += 1) {
      const permuted = redeal(matrix, { kind: isBlocks(matrix) ? "feat" : "curve", rng: makeRng({ seed, purpose: "control", population: o.population, rep: r }), strata: o.strata, blocks: o.blocks });
      const rep = induceSystemKinds(permuted, { ...opts, _inControl: true, controlReps: 0, draws: o.controlDraws ?? draws, seed: seed + 1000 + r, neighborSweep: false });
      const bad = rep.kinds.length;
      reps.push({ rep: r, kinds: bad });
      if (bad) survivors += 1;
    }
    const failed = rateExceeds(survivors, o.controlReps, alpha, alpha);
    control = { name: "block-permuted copy", reps: o.controlReps, survivors, failed, passed: !failed, perRep: reps, rule: "INSTRUMENT_FAILED iff the survivor count is rejected as <= alpha by the exact one-sided binomial test" };
  }
  const calibration = o.calibration ?? null;
  const instrumentFailed = (control && control.failed) ? "control_survived" : calibration?.rejected ? "copula_calibration_failed" : null;
  if (instrumentFailed) refused.push({ type: instrumentFailed, detail: control?.failed ? control : calibration });

  // ---- judge every candidate against the ceiling, then the gap test
  const dipCache = new Map();
  const nullDipsFor = (inst) => {
    if (!dipCache.has(inst)) dipCache.set(inst, nullState.cov.axes[inst].map((a) => (a ? dipStatistic(a) : 0)));
    return dipCache.get(inst);
  };
  // candidates that are the same kind found by different instruments (member sets with Jaccard >= 0.8) are ONE kind; the instrument with the larger standardised statistic names it
  const groupsOfCandidates = [];
  for (const c of observed) {
    const set = new Set(c.members);
    const hit = groupsOfCandidates.find((g) => { let inter = 0; for (const i of set) if (g.set.has(i)) inter += 1; return inter / (set.size + g.set.size - inter) >= 0.8; });
    if (hit) hit.found.push(c); else groupsOfCandidates.push({ set, found: [c] });
  }
  const kinds = [], candidateTable = [];
  for (const grp of groupsOfCandidates) {
    const zMinOf = (c) => Math.min(...nulls.filter((nu) => nu !== "fam").map((nu) => (c.T - nullState[nu].mu[c.instrument]) / nullState[nu].sg[c.instrument]));
    const best = grp.found.slice().sort((a, b) => zMinOf(b) - zMinOf(a))[0];
    const rec = { members: [...best.members].sort((a, b) => a - b), found: grp.found };
    const stat = {}, survives = {};
    let above = true, pMax = 0, zMin = Infinity;
    for (const nu of nulls) {
      const S = nullState[nu], inst = best.instrument;
      const z = (best.T - S.mu[inst]) / S.sg[inst];
      let ge = 0;
      for (let d = 0; d < draws; d += 1) if (S.M[d] >= z) ge += 1;
      const p = (1 + ge) / (draws + 1);
      stat[nu] = { z, p, ceiling: S.ceiling };
      const pass = z > S.ceiling && p <= alpha;
      if (nu === "fam") { survives.fam = famInformativeFor(rec.members, o.strata) ? pass : "fam_uninformative"; }
      else { survives[nu] = pass; if (!pass) above = false; pMax = Math.max(pMax, p); zMin = Math.min(zMin, z); }
    }
    if (!nulls.length) above = false;
    for (const nu of NULL_KINDS) if (!(nu in survives)) survives[nu] = null;
    candidateTable.push({ instrument: best.instrument, members: rec.members.length, T: best.T, z: stat, survives: { ...survives }, aboveCeiling: above });
    if (!above) continue;
    const signatures = coreSignaturesOf(matrix, rec.members);
    const base = {
      level: "S", group: o.group, instrument: best.instrument, foundBy: [...new Set(rec.found.map((c) => c.instrument))], memberRefs: rec.members.map((i) => matrix.ids[i]), smallerSide: rec.members.map((i) => matrix.ids[i]),
      coreSignatures: signatures.map((s) => s.signature), signatureCount: signatures.length,
      statistic: { T: best.T, mu: Object.fromEntries(nulls.map((nu) => [nu, nullState[nu].mu[best.instrument]])), sigma: Object.fromEntries(nulls.map((nu) => [nu, nullState[nu].sg[best.instrument]])), z: zMin },
      ceiling: { value: ceiling.value, nulls: [...nulls], D: draws, alpha }, p: pMax, nullDetail: stat, survives,
    };
    base.id = `kind:${wide(`${o.group ?? ""}|${best.instrument}|${base.memberRefs.join(",")}`)}`;
    if (instrumentFailed) { kinds.push({ ...base, status: "REFUSED", refusal: instrumentFailed }); continue; }
    if (!nulls.includes("cov")) { kinds.push({ ...base, status: "REFUSED", refusal: "no_cov_null" }); continue; }
    const u = best.instrument === "spectral" ? spectralObs : contrastAxis(matrix, rec.members);
    const dip = dipStatistic(u);
    const nd = nullDipsFor(best.instrument);
    const pDip = (1 + nd.filter((x) => x >= dip - 1e-12).length) / (draws + 1);
    const span = lineageSpanOf(rec.members, o.branches, o.lineages);
    const coreFeatures = [...new Set(signatures.map((s) => s.feature))];
    const kindPr = isBlocks(matrix) && coreFeatures.length >= 2 ? participationRatio(correlationMatrix(coreFeatures.map((j) => matrix.values[j]))) : null;
    let status;
    if (pDip > alpha) status = "GRADIENT";
    else if (!o.lineages && !o.allowUnlabelled) status = "REFUSED";
    else if (span.afterDrop !== null && span.afterDrop < 3) status = "FAMILY-BOUND";
    else if (survives.fam === false) status = "FAMILY-BOUND";
    else status = "CLUSTER";
    const gradientAxis = status === "GRADIENT" ? Array.from(u, (v, i) => ({ id: matrix.ids[i], score: v })) : null;
    kinds.push({ ...base, gap: { u: Array.from(u), dip, pDip, nullDips: { median: median(nd), q95: quantile(nd, 0.95) } }, effectiveDimension: { group: pr.group, kind: kindPr }, status, ...(status === "REFUSED" ? { refusal: "no_lineage_labels" } : {}), lineageSpan: span.span, lineageSpanAfterDrop: span.afterDrop, branchSpan: span.branches, famInformative: survives.fam !== "fam_uninformative", gradientAxis, detectability: o.grid ? detectability({ memberCount: rec.members.length, lineageSpan: span.span, signatureCount: signatures.length }, o.grid) : null, stability: null, frame: null, giver: "kernel/kind-induction via organs/barker" });
  }

  // ---- sensitivity of Kanada to its own knob (a kind count that moves with neighborCount is an artifact)
  if (o.sweep && instruments.includes("kanada") && isBlocks(matrix) && !opts._inControl) {
    diagnostics.neighborSweep = [2, 3, 4, 5, 6].map((nc) => {
      const r = runInstrument("kanada", matrix, { ...ctx, neighborCount: nc });
      return { neighborCount: nc, eligible: r.candidates.length, sets: r.candidates.map((c) => memberKey(c.members)).sort() };
    });
    const sig = diagnostics.neighborSweep.map((s) => s.sets.join("|"));
    diagnostics.knobStable = new Set(sig).size === 1;
  }
  diagnostics.candidateTable = candidateTable;
  diagnostics.candidates = groupsOfCandidates.map((g) => {
    const c = g.found.slice().sort((a, b) => b.T - a.T)[0];
    const ax = c.instrument === "spectral" ? spectralObs : contrastAxis(matrix, c.members);
    return { instrument: c.instrument, foundBy: [...new Set(g.found.map((x) => x.instrument))], memberRefs: c.members.map((i) => matrix.ids[i]), smallerSide: c.members.map((i) => matrix.ids[i]), u: ax ? Array.from(ax) : null, score: nulls.length ? Math.min(...nulls.filter((nu) => nu !== "fam").map((nu) => (c.T - nullState[nu].mu[c.instrument]) / nullState[nu].sg[c.instrument])) : null, T: c.T };
  });
  diagnostics.control = control;
  diagnostics.calibration = calibration;
  diagnostics.statisticsCensoredAtZero = Object.fromEntries(instruments.map((i) => [i, mean(nulls.map((nu) => nullState[nu].T[i].filter((x) => x === 0).length / draws))]));
  if (!o.lineages) gaps.push({ type: "no_lineage_labels", detail: "CLUSTER cannot be called without lineage labels; kinds that pass the ceiling and the gap test are REFUSED" });
  if (!o.strata) gaps.push({ type: "fam_not_run", detail: "no branch labels: N-fam not run; no kind is labelled by genealogy" });
  return { kinds, refused, ceiling, diagnostics, gaps };
}

const subMatrix = (m, idx) => (isBlocks(m)
  ? { ...m, ids: idx.map((i) => m.ids[i]), n: idx.length, bins: m.bins.map((c) => Int8Array.from(idx, (i) => c[i])), weights: m.weights.map((c) => Float64Array.from(idx, (i) => c[i])), values: m.values.map((c) => Float64Array.from(idx, (i) => c[i])), branches: m.branches ? idx.map((i) => m.branches[i]) : null, lineages: m.lineages ? idx.map((i) => m.lineages[i]) : null }
  : { ...m, ids: idx.map((i) => m.ids[i]), n: idx.length, rows: idx.map((i) => m.rows[i]), strata: m.strata ? idx.map((i) => m.strata[i]) : null, branches: m.branches ? idx.map((i) => m.branches[i]) : null, lineages: m.lineages ? idx.map((i) => m.lineages[i]) : null });

/**
 * I3 as a divisive splitter (BARKER.md 4.3): at each node the first left singular vector of the column-standardised dense matrix splits the systems by sign; the kind is the smaller
 * side; T = sigma_1^2 / sum sigma_k^2; p comes from `draws` redeals of that node's own sub-matrix (N-feat for blocks, N-curve for presence). A side is split again while it holds at
 * least twice the minimum kind size and the node's p is at most alpha divided by the number of splits tested so far (Holm over depth).
 * Returns [{ members, other, memberIdx, T, depth, p, alphaAdj, size, split }] in breadth-first order; members are system ids.
 */
export function spectralSplits(matrix, { draws = DRAWS, alpha = ALPHA, seed = SEED, minKindSize = DEFAULTS.minKindSize, maxDepth = 6 } = {}) {
  const m = Array.isArray(matrix) ? matrixFromContract(matrix, arguments[1] ?? {}) : matrix;
  if (!isBlocks(m) && !isPresence(m)) throw new TypeError("spectralSplits: expected a block or presence matrix");
  const out = [], queue = [{ idx: Array.from({ length: m.n }, (_, i) => i), depth: 1 }];
  let tested = 0;
  while (queue.length) {
    const { idx, depth } = queue.shift();
    if (idx.length < 2 * minKindSize || depth > maxDepth) continue;
    const sub = idx.length === m.n ? m : subMatrix(m, idx), top = spectralTop(sub, minKindSize);
    if (!top.axis) continue;
    const { cols } = denseColumns(sub), t = gramTop(cols, sub.n);
    const neg = [], pos = [];
    for (let i = 0; i < sub.n; i += 1) (t.vec[i] < 0 ? neg : pos).push(i);
    const mem = neg.length <= pos.length ? neg : pos, oth = neg.length <= pos.length ? pos : neg;
    tested += 1;
    const alphaAdj = alpha / tested;
    let ge = 0;
    for (let d = 0; d < draws; d += 1) {
      const X = redeal(sub, { kind: isBlocks(sub) ? "feat" : "curve", rng: makeRng({ seed, purpose: "spectral-split", depth, size: idx.length, first: idx[0], d }) });
      const { cols: c2 } = denseColumns(X), t2 = gramTop(c2, X.n);
      if (t2 && t2.T >= t.T) ge += 1;
    }
    const p = (1 + ge) / (draws + 1), split = p <= alphaAdj && mem.length >= minKindSize;
    out.push({ members: mem.map((i) => sub.ids[i]), other: oth.map((i) => sub.ids[i]), memberIdx: mem.map((i) => idx[i]), T: t.T, depth, p, alphaAdj, size: idx.length, split });
    if (split) for (const side of [mem, oth]) queue.push({ idx: side.map((i) => idx[i]).sort((a, b) => a - b), depth: depth + 1 });
  }
  return out;
}

/**
 * The ONE ceiling over the whole menu and the nulls that apply (BARKER.md 4.3), with its control built to fail. A thin view of induceSystemKinds: the candidates are
 * judged there; this returns the ceiling and what set it. { ceiling, nulls: { feat, cov, cov1, fam, curve }, mu, sigma, tried, control }.
 */
export function searchAwareCeiling(matrix, opts = {}) {
  const res = induceSystemKinds(matrix, { controlReps: DEFAULTS.controlReps, neighborSweep: false, ...opts });
  return { ceiling: res.ceiling?.value ?? null, nulls: res.ceiling?.perNull ?? {}, mu: res.ceiling?.mu ?? null, sigma: res.ceiling?.sigma ?? null, tried: res.diagnostics.tried, control: res.diagnostics.control, candidates: res.diagnostics.candidateTable, refused: res.refused, gaps: res.gaps };
}

/** Re-exported from the kernel so a caller reaches the one-valuedness ledger through the organ (BARKER.md A11). */
export { induceKindsAndFunctions };

// ── planted worlds: a kind with a gap, a continuum without one, the real covariance with neither ──────
/** Pairwise |correlation| among a kind world's signature features at this strength and member share (closed form). */
export function kindPairwiseCorrelation({ strength, memberShare }) {
  const delta = normalQuantile((1 + strength) / 2), pq = memberShare * (1 - memberShare), v = delta * delta * pq;
  return v / (1 + v);
}
/** Loading of ONE latent coordinate that gives the continuum world the same pairwise signature correlation as the kind world at the same cell (closed form). */
export function matchedLoading({ strength, signatureCount, memberShare }) {
  void signatureCount; // the pairwise correlation among signature features does not depend on how many there are
  return Math.sqrt(kindPairwiseCorrelation({ strength, memberShare }));
}

function chooseKinds(branchSizes, lineageOfBranch, kindSize, inBranchSize) {
  const starts = [];
  let acc = 0;
  for (const b of branchSizes) { starts.push(acc); acc += b; }
  const next = new Array(branchSizes.length).fill(0), A = [];
  for (let guard = 0; A.length < kindSize && guard < kindSize * branchSizes.length + 5; guard += 1) {
    const b = guard % branchSizes.length;
    if (next[b] < branchSizes[b]) { A.push(starts[b] + next[b]); next[b] += 1; }
  }
  let big = 0;
  branchSizes.forEach((s, b) => { if (s > branchSizes[big]) big = b; });
  const B = [];
  for (let k = next[big]; k < branchSizes[big] && B.length < inBranchSize; k += 1) B.push(starts[big] + k);
  const lineages = new Set(A.map((i) => lineageOfBranch[branchOfIndex(i, starts)]));
  return { A, B, spanLineages: lineages.size, spanBranches: new Set(A.map((i) => branchOfIndex(i, starts))).size };
}
const branchOfIndex = (i, starts) => { let b = 0; for (let k = 0; k < starts.length; k += 1) if (i >= starts[k]) b = k; return b; };

/**
 * A planted CONTINUOUS n-by-F profile matrix on a real layout, binned through the SAME pipeline as real data (cuts at the median, one-hot blocks).
 * world "kind": one kind that spans branches and lineages and one inside the largest branch, each shifted by delta = Phi^-1((1+strength)/2) SD
 *   (random sign per feature) on `signatureCount` signature features; `commonCount` features share one nuisance factor (loading 0.5); `noiseCount` are noise.
 * world "continuum": the SAME layout of features, but each signature set loads on ONE latent coordinate (loading matched in closed form to the kind
 *   world's pairwise correlation); variant "free" (independent of branch) or "branch" (genealogy-correlated). No kind exists.
 * world "copula": rows drawn from a Gaussian (or Student-t, `df`) copula with the supplied correlation and marginals. No cluster exists.
 */
export function plantSystems({ world, branchSizes, lineageOf = null, strength = 0.8, signatureCount = 12, noiseCount = 60, commonCount = 10, correlation = null, marginals = null, df = null, variant = "free", seed = SEED, kindSize = null, featureKeys = null, groupOf = null, bins = DEFAULTS.bins } = {}) {
  const n = sumOf(branchSizes);
  const branches = [], lineageOfBranch = branchSizes.map((_, b) => String(typeof lineageOf === "function" ? lineageOf(b) : Array.isArray(lineageOf) ? lineageOf[b] : b));
  const starts = [];
  { let a = 0; for (const s of branchSizes) { starts.push(a); a += s; } }
  branchSizes.forEach((s, b) => { for (let k = 0; k < s; k += 1) branches.push(`b${b}`); });
  const lineages = branches.map((_, i) => lineageOfBranch[branchOfIndex(i, starts)]);
  const ids = Array.from({ length: n }, (_, i) => `s${String(i).padStart(2, "0")}`);
  const rng = makeRng({ seed, world, strength, signatureCount, variant, purpose: "plant" });
  const normal = normalSampler(rng);
  const kSize = kindSize ?? Math.max(4, Math.round(n / 4));
  const pick = chooseKinds(branchSizes, lineageOfBranch, kSize, DEFAULTS.inBranchKindSize);
  const memberShareA = pick.A.length / n, memberShareB = pick.B.length / n;
  const delta = normalQuantile((1 + strength) / 2);

  let F, cols, keys, grp, truth = { kinds: null };
  if (world === "copula") {
    if (!correlation || !marginals) throw new TypeError("plantSystems: the copula world needs correlation and marginals");
    F = correlation.length;
    const flat = new Float64Array(F * F);
    for (let a = 0; a < F; a += 1) for (let b = 0; b < F; b += 1) flat[a * F + b] = correlation[a][b];
    const tables = marginals.map((m) => { const s = sorted(m.filter(Number.isFinite)); return { sortedVals: Float64Array.from(s), sortedW: new Float64Array(s.length).fill(1) }; });
    const cuts = tables.map((t) => [quantileSorted(Array.from(t.sortedVals), bins === 3 ? 1 / 3 : 0.5), ...(bins === 3 ? [quantileSorted(Array.from(t.sortedVals), 2 / 3)] : [])]);
    const model = copulaModelOf({ F, corr: flat, tables, cuts, nBins: cuts.map((c) => c.length + 1) });
    const drawn = sampleCopula(model, n, rng, { df });
    cols = drawn.values.map((c) => Array.from(c));
    keys = featureKeys ?? Array.from({ length: F }, (_, j) => `x${String(j).padStart(3, "0")}`);
    grp = groupOf ?? keys.map(() => "A");
  } else {
    F = 2 * signatureCount + commonCount + noiseCount;
    keys = Array.from({ length: F }, (_, j) => `x${String(j).padStart(3, "0")}`);
    grp = keys.map((_, j) => (j < signatureCount ? "A" : j < 2 * signatureCount ? "B" : j < 2 * signatureCount + commonCount ? "C" : "D"));
    const sign = Array.from({ length: F }, () => (rng() < 0.5 ? -1 : 1));
    const inA = new Uint8Array(n), inB = new Uint8Array(n);
    pick.A.forEach((i) => { inA[i] = 1; });
    pick.B.forEach((i) => { inB[i] = 1; });
    const common = Float64Array.from({ length: n }, () => normal());
    const loadA = matchedLoading({ strength, signatureCount, memberShare: memberShareA }), loadB = matchedLoading({ strength, signatureCount, memberShare: memberShareB });
    let tA, tB;
    if (world === "continuum") {
      const h = DEFAULTS.genealogyShare, off = new Map();
      const latent = () => Float64Array.from({ length: n }, (_, i) => {
        if (variant !== "branch") return normal();
        if (!off.has(`${branches[i]}`)) off.set(`${branches[i]}`, normal());
        return Math.sqrt(h) * off.get(`${branches[i]}`) + Math.sqrt(1 - h) * normal();
      });
      tA = latent(); off.clear(); tB = latent();
    }
    cols = [];
    for (let j = 0; j < F; j += 1) {
      const col = new Array(n);
      for (let i = 0; i < n; i += 1) {
        const z = normal();
        if (j < signatureCount) col[i] = world === "kind" ? z + sign[j] * delta * inA[i] : loadA * sign[j] * tA[i] + Math.sqrt(1 - loadA * loadA) * z;
        else if (j < 2 * signatureCount) col[i] = world === "kind" ? z + sign[j] * delta * inB[i] : loadB * sign[j] * tB[i] + Math.sqrt(1 - loadB * loadB) * z;
        else if (j < 2 * signatureCount + commonCount) col[i] = DEFAULTS.commonLoading * common[i] + Math.sqrt(1 - DEFAULTS.commonLoading * DEFAULTS.commonLoading) * z;
        else col[i] = z;
      }
      cols.push(col);
    }
    if (world === "kind") {
      const mk = (idx, scope) => ({ members: idx.map((i) => ids[i]), memberIdx: idx, scope, lineageSpan: new Set(idx.map((i) => lineages[i])).size, branchSpan: new Set(idx.map((i) => branches[i])).size });
      truth = { kinds: [mk(pick.A, "cross-lineage"), mk(pick.B, "in-branch")], delta, memberShare: memberShareA, pairwiseCorrelation: kindPairwiseCorrelation({ strength, memberShare: memberShareA }), spanOk: pick.spanLineages >= 3 && pick.spanBranches >= 4 };
    } else truth = { kinds: null, loadingA: loadA, loadingB: loadB, variant };
  }
  const rows = Array.from({ length: n }, (_, i) => cols.map((c) => c[i]));
  const matrix = blockMatrixFromValues(rows, { ids, featureKeys: keys, groupOf: grp, bins, branches, lineages });
  return { world, continuous: rows, matrix, blocks: keys.map((_, j) => [j]), truth, ids, branches, lineages, pr: participationRatio(correlationMatrix(cols)) };
}

const f1Of = (found, planted) => {
  const a = new Set(found), b = new Set(planted);
  let tp = 0;
  for (const x of a) if (b.has(x)) tp += 1;
  return tp === 0 ? 0 : 2 * tp / (a.size + b.size);
};

/**
 * SystemProfile@1 objects for a planted world (tests and power cards): one cell per feature, each with the world's own value, resamples drawn around it, and a giver
 * and channel named for its feature group, so groups are independent channels. Genealogy is carried as labels (answer keys), never as a cell.
 */
export function plantProfiles(world, { resamples = 10, noise = 0.1, seed = SEED } = {}) {
  const rng = makeRng({ seed, purpose: "plant-profiles" }), normal = normalSampler(rng), m = world.matrix;
  return world.ids.map((id, i) => {
    const cells = {};
    m.featureKeys.forEach((key, j) => {
      const v = world.continuous[i][j], g = m.groupOf[j] ?? "A";
      cells[key] = { id: key, group: g, channel: `planted:${g}`, value: v, n: 1000, ci95: [v - 2 * noise, v + 2 * noise], resamples: Array.from({ length: resamples }, () => v + noise * normal()), definitionId: `planted-${key}`, builder: "plantProfiles", giver: `planted-${g}`, floor: null };
    });
    return makeSystemProfile({ id, kind: "nl", inputs: [{ path: "planted", sha256: "0", role: "train" }], labels: { branch: world.branches[i], lineage: world.lineages[i], family: world.lineages[i] }, budget: { N: 1000, halves: 2, seeds: [1, 2, 3, 4, 5], unit: "word" }, cells });
  });
}

/** Weakest admissible planted cell at which a kind of this signature count would be detected at power 0.8 (BARKER.md 4.4), or null. */
export function detectability(kind, grid) {
  const cells = (grid?.cells ?? []).filter((c) => c.admissible && c.power >= 0.8 && c.signatureCount <= (kind.signatureCount ?? Infinity));
  if (!cells.length) return { admissible: false, class: "below_grid", note: "no admissible planted cell is as weak as this kind; its detectability class is unknown" };
  cells.sort((a, b) => a.strength - b.strength || a.signatureCount - b.signatureCount);
  const c = cells[0];
  return { admissible: true, strength: c.strength, signatureCount: c.signatureCount, power: c.power, smallerThanPlanted: grid.kindSize ? kind.memberCount < grid.kindSize : null };
}

/**
 * The power grid (BARKER.md 4.4): W-kind and W-continuum planted on `branchSizes` over strength x signatureCount. A cell is ADMISSIBLE iff
 * W-kind power >= 0.8 (detected = CLUSTER with F1 >= 0.9 against the cross-lineage kind), the continuum false-CLUSTER rate is not rejected as
 * <= alpha for BOTH variants, and no continuum draw is called a discrete kind (CLUSTER or FAMILY-BOUND) more often than the same bound allows.
 * `kindSize`/`lineageOf` follow plantSystems. Heavy by design (declared in BARKER.md 9): pass small reps and draws in tests.
 */
export function powerGrid({ branchSizes, lineageOf = null, strengths = [0.3, 0.5, 0.8], signatureCounts = [6, 12, 24], reps = 30, continuumReps = 100, draws = 99, continuumDraws = 49, alpha = ALPHA, seed = SEED, variants = ["free", "branch"], instruments = INSTRUMENTS, nulls = null, noiseCount = 60, onProgress = null } = {}) {
  const cells = [];
  const run = (world, extra) => {
    const w = plantSystems({ world, branchSizes, lineageOf, noiseCount, ...extra });
    const nl = nulls ?? (new Set(famStrata(w.branches)).size > 1 ? ["feat", "cov", "cov1", "fam"] : ["feat", "cov", "cov1"]);
    return { w, res: induceSystemKinds(w.matrix, { draws: world === "kind" ? draws : continuumDraws, alpha, seed: (extra.seed ?? seed) + 77, controlReps: 0, neighborSweep: false, instruments, nulls: nl, population: `grid:${world}`, branches: w.branches, lineages: w.lineages }) };
  };
  let sizeA = 0;
  for (const strength of strengths) for (const signatureCount of signatureCounts) {
    let hit = 0, hitB = 0;
    for (let r = 0; r < reps; r += 1) {
      const { w, res } = run("kind", { strength, signatureCount, seed: seed + r });
      sizeA = w.truth.kinds[0].members.length;
      const A = w.truth.kinds[0].members, B = w.truth.kinds[1].members;
      if (res.kinds.some((k) => k.status === "CLUSTER" && f1Of(k.memberRefs, A) >= 0.9)) hit += 1;
      if (res.kinds.some((k) => (k.status === "CLUSTER" || k.status === "FAMILY-BOUND") && f1Of(k.memberRefs, B) >= 0.9)) hitB += 1;
      if (onProgress) onProgress({ cell: [strength, signatureCount], world: "kind", rep: r });
    }
    const cont = {};
    for (const variant of variants) {
      let cluster = 0, discrete = 0, gradient = 0;
      for (let r = 0; r < continuumReps; r += 1) {
        const { res } = run("continuum", { strength, signatureCount, variant, seed: seed + 5000 + r });
        if (res.kinds.some((k) => k.status === "CLUSTER")) cluster += 1;
        if (res.kinds.some((k) => k.status === "CLUSTER" || k.status === "FAMILY-BOUND")) discrete += 1;
        if (res.kinds.some((k) => k.status === "GRADIENT")) gradient += 1;
        if (onProgress) onProgress({ cell: [strength, signatureCount], world: `continuum:${variant}`, rep: r });
      }
      cont[variant] = { reps: continuumReps, falseCluster: cluster, falseDiscrete: discrete, gradientCalls: gradient, clusterRejected: rateExceeds(cluster, continuumReps, alpha, alpha), discreteRejected: rateExceeds(discrete, continuumReps, alpha, alpha) };
    }
    const power = hit / reps;
    const reasons = [];
    if (power < 0.8) reasons.push("kind_power_below_0.8");
    for (const v of variants) { if (cont[v].clusterRejected) reasons.push(`continuum_${v}_false_cluster`); if (cont[v].discreteRejected) reasons.push(`continuum_${v}_false_discrete`); }
    cells.push({ strength, signatureCount, reps, power, powerCi: wilson(hit, reps), powerInBranch: hitB / reps, continuum: cont, admissible: reasons.length === 0, reasons });
  }
  const admissible = cells.filter((c) => c.admissible);
  const mde = admissible.length ? admissible.slice().sort((a, b) => a.strength - b.strength || a.signatureCount - b.signatureCount)[0] : null;
  const sesoiCell = cells.find((c) => c.strength >= 0.5 && c.signatureCount >= 12 && c.admissible) ?? null;
  return { cells, mde, sesoiCell: sesoiCell ? { strength: sesoiCell.strength, signatureCount: sesoiCell.signatureCount, admissible: true } : { admissible: false }, absenceLicensed: !!sesoiCell, kindSize: sizeA, config: { branchSizes, strengths, signatureCounts, reps, continuumReps, draws, continuumDraws, alpha, seed, variants, instruments: [...instruments] } };
}

/**
 * The covariance calibration (BARKER.md 4.4, review F1): the whole kind pipeline on W-copula worlds that carry the group's real correlation and marginals
 * and no cluster. INSTRUMENT_FAILED for the group iff the any-kind rate is rejected as <= alpha by the exact binomial test (16 of 200). It reads the real
 * correlation and marginals and computes NO kind statistic on the real data. `df` runs the Student-t copula as a printed sensitivity.
 */
export function copulaCalibration(group, { worlds = 200, draws = 99, alpha = ALPHA, seed = SEED, df = null, instruments = INSTRUMENTS, nulls = null, onProgress = null } = {}) {
  const bm = isBlocks(group) ? group : blockMatrixFromValues(group.rows ?? group.values, { ids: group.ids, featureKeys: group.featureKeys, groupOf: group.groupOf, branches: group.branches ?? null, lineages: group.lineages ?? null });
  const state = copulaStateOf(bm);
  let any = 0, cluster = 0;
  for (let w = 0; w < worlds; w += 1) {
    const drawn = sampleCopula(state.cov, bm.n, makeRng({ seed, purpose: "calibration", df, w }), { df, mask: state.mask });
    const world = { ...bm, bins: drawn.bins, weights: drawn.weights, values: drawn.values };
    const nl = nulls ?? (bm.branches && new Set(famStrata(bm.branches)).size > 1 ? ["feat", "cov", "cov1", "fam"] : ["feat", "cov", "cov1"]);
    const res = induceSystemKinds(world, { draws, alpha, seed: seed + 31 + w, controlReps: 0, neighborSweep: false, instruments, nulls: nl, population: "calibration", branches: bm.branches, lineages: bm.lineages, group: bm.group ?? null });
    if (res.kinds.length) any += 1;
    if (res.kinds.some((k) => k.status === "CLUSTER")) cluster += 1;
    if (onProgress) onProgress({ world: w });
  }
  return { rate: any / worlds, clusterRate: cluster / worlds, ci95: wilson(any, worlds), worlds, any, cluster, rejected: rateExceeds(any, worlds, alpha, alpha), rejectionPowerAt10pc: rejectionPower(worlds, 0.1, alpha, alpha), df, effectiveDimension: state.prObserved, shrinkage: state.delta };
}

/** Held-out assignment by cosine with the population null (kind-standing's own rule): { verdict: "member"|"not_member"|"unknown", kind, fit, p }. */
export function assignSystem(kindSet, signatures, { alpha = ALPHA } = {}) {
  const vecs = new Map(kindSet.vectors instanceof Map ? kindSet.vectors : Object.entries(kindSet.vectors));
  const x = signatures instanceof Map ? signatures : new Map([...signatures].map((s) => [s, 1]));
  const HELD = "\u0000held-out";
  vecs.set(HELD, x);
  const per = [];
  for (const k of kindSet.kinds) {
    const members = (k.memberRefs ?? k.members).filter((m) => vecs.has(m));
    const r = kindMembership(HELD, members, vecs, { alpha });
    per.push({ kind: k.id ?? k.kindKey, ...r });
  }
  const members = per.filter((r) => r.verdict === "member").sort((a, b) => b.fit - a.fit);
  if (members.length) return { verdict: "member", kind: members[0].kind, fit: members[0].fit, p: members[0].p, perKind: per };
  if (per.length && per.every((r) => r.verdict === "unknown")) return { verdict: "unknown", kind: null, fit: null, p: null, perKind: per };
  const best = per.filter((r) => r.fit !== null).sort((a, b) => b.fit - a.fit)[0];
  return { verdict: "not_member", kind: null, fit: best?.fit ?? null, p: best?.p ?? null, perKind: per };
}
/** Signature vectors of a matrix's systems (id -> signature -> weight 1 + ln c), the shape assignSystem and kindMembership read. */
export function signatureVectorsOf(matrix) {
  const out = new Map();
  for (const [id, rec] of entityFeaturesOf(matrix)) out.set(id, new Map([...rec].map(([sig, r]) => [sig, 1 + Math.log(Math.max(1, r.evidenceIds.size))])));
  return out;
}

// ── the verdict functions: one for the EO battery, one for arches, and the power trio that tests both ──────
/**
 * The pre-registered verdict function (BARKER.md 6.0, amended by F5). Inputs are components, all decided BEFORE this call except theta and ci95:
 *   theta, ci95 [lo, hi]   the statistic in its own units and its 95 percent interval; sesoi the registered smallest effect of interest (same units)
 *   powerUp / powerDown    the planted 2s world reaches lower bound > s at >= 0.8 / the planted 0.5s world reaches upper bound < s at >= 0.8 (decided before real data; null or false = not established)
 *   controlsOk (C)  nullOk (N)  mustBeatOk (A)  signGate (F: true | false | "unreachable")  channelsOk (I)
 *   bridge          "licensed" (an EO defender's sentence is registered) or "unlicensed"
 *   consumed        false | true | "near" — a consumed row is not out-of-sample and cannot be a headline SURVIVES
 * Order: INSTRUMENT_FAILED, UNDERPOWERED, REFUTED, WEAKENED, SURVIVES. An unlicensed bridge can never return REFUTED (a failure is WEAKENED, bridge "failed");
 * an unlicensed pass is SURVIVES with bridge "unlicensed" and leaves the headline. Survival is not confirmation: it is one test passed that could have been failed.
 */
export function minimumEffectVerdict({ theta = null, ci95, sesoi, powerUp = null, powerDown = null, bridge = "licensed", consumed = false, controlsOk = true, nullOk = true, mustBeatOk = true, signGate = true, channelsOk = true } = {}) {
  if (!Array.isArray(ci95) || ci95.length !== 2 || !(Number.isFinite(sesoi))) throw new TypeError("minimumEffectVerdict: ci95 [lo, hi] and a registered sesoi are required");
  const [lo, hi] = ci95, reasons = [];
  const components = { Pup: powerUp === true, Pdown: powerDown === true, C: controlsOk === true, N: nullOk === true, M: lo > sesoi, A: mustBeatOk === true, F: signGate === true, I: channelsOk === true, B: bridge === "licensed", K: consumed === false };
  const out = (verdict, extra = {}) => ({ verdict, reasons, theta, ci95: [lo, hi], sesoi, components, bridge: extra.bridge ?? bridge, headline: false, ...extra });
  if (!components.C) { reasons.push("a control built to fail survived (II.23)"); return out("INSTRUMENT_FAILED"); }
  if (signGate === "unreachable") { reasons.push("the sign gate is unreachable at this number of lineages"); return out("UNDERPOWERED"); }
  if (lo <= sesoi && hi >= sesoi) { reasons.push("the interval straddles the registered smallest effect of interest"); return out("UNDERPOWERED"); }
  if (hi < sesoi) {
    if (!components.Pdown) { reasons.push("the planted 0.5s world was not called below s at power 0.8, so a refutation would mean nothing"); return out("UNDERPOWERED"); }
    if (bridge !== "licensed") { reasons.push("no licensing sentence from the claim's defender: a failure refutes Barker's auxiliary hypothesis, not the claim"); return out("WEAKENED", { bridge: "failed" }); }
    reasons.push(components.N ? "an effect exists and is smaller than the registered smallest effect of interest" : "no effect distinguishable from the null and the upper bound is below s");
    return out("REFUTED");
  }
  // lo > sesoi: an effect clearly above s
  if (!components.Pup) { reasons.push("the planted 2s world was not recovered at power 0.8, so a pass would mean nothing"); return out("UNDERPOWERED"); }
  const failed = [];
  if (!components.N) failed.push("N: the observed effect does not beat its null");
  if (!components.A) failed.push("A: a must-beat rival is not beaten by the registered margin");
  if (!components.F) failed.push("F: the lineage sign gate failed");
  if (!components.I) failed.push("I: fewer than two independent channels agree");
  if (!components.K) failed.push("K: the rows are consumed or near-consumed (not out-of-sample)");
  if (failed.length) { reasons.push(...failed); return out("WEAKENED"); }
  reasons.push("the claim passed this test; survival is not confirmation");
  return out("SURVIVES", { headline: components.B && components.K });
}

/**
 * The power trio (BARKER.md 6.0): `runWorld(effect, { nScale, rep, seed })` returns { ci95: [lo, hi] } for a world whose true effect is `effect` in theta's units.
 * Plants 2s (P_up: lower bound > s at rate >= 0.8), 0.5s (P_down: upper bound < s at rate >= 0.8), s exactly (neither SURVIVES-capable nor REFUTED-capable
 * more often than alpha by the exact binomial rule) and 0.1s at ten times n (never SURVIVES-capable more often than alpha).
 */
export function powerTrio(runWorld, { sesoi, worlds = 40, seed = SEED, alpha = ALPHA } = {}) {
  const rates = (effect, nScale, test) => {
    let k = 0;
    for (let r = 0; r < worlds; r += 1) { const res = runWorld(effect, { nScale, rep: r, seed: seed + r }); if (test(res.ci95)) k += 1; }
    return { k, n: worlds, rate: k / worlds, ci: wilson(k, worlds) };
  };
  const above = ([lo]) => lo > sesoi, below = ([, hi]) => hi < sesoi;
  const up = rates(2 * sesoi, 1, above), down = rates(0.5 * sesoi, 1, below);
  const tiny = rates(0.1 * sesoi, 10, above);
  const atS = { survives: rates(sesoi, 1, above), refuted: rates(sesoi, 1, below) };
  return {
    up, down, tiny, atS,
    pUp: up.rate >= 0.8, pDown: down.rate >= 0.8,
    tinyOk: !rateExceeds(tiny.k, worlds, alpha, alpha),
    atSOk: !rateExceeds(atS.survives.k, worlds, alpha, alpha) && !rateExceeds(atS.refuted.k, worlds, alpha, alpha),
    sesoi, worlds, alpha,
  };
}

/**
 * The persistence rule (BARKER.md 4.6). `perLineage`: [{ lineage, theta, nullMedian = 0, defined = true, ie = false }] with theta the lineage's nested mean in the
 * statistic's own units (larger = more arch-like). h_l = 1 iff theta - nullMedian > 0; undefined lineages (planted power below 0.8 at 2*SESOI, or a failed
 * denominator floor) leave the denominator. `channels` is the number of INDEPENDENT channels (independenceAudit) that show the regularity; at least 2 are needed.
 * `nullOk` (beats the branch-blocked null, Holm over the cards), `controlOk`, `powerUp`/`powerDown` (the card's planted 2s/0.5s worlds; null = the power card was not run),
 * `trivialNull` ({ reached } or { nullQ95 }: a registered trivial null reaches theta - s). PERSISTENT-OUTSIDE-IE repeats the gates over the non-Indo-European lineages.
 * Holm applies to the pooled-effect test only; the sign test is a replication gate at alpha, not a significance claim.
 */
export function persistence(args = {}) {
  if (!Number.isFinite(args.sesoi)) throw new TypeError("persistence: a registered sesoi is required");
  const all = args.perLineage.map((l) => ({ ...l, lineage: String(l.lineage), nullMedian: l.nullMedian ?? 0 }));
  const full = persistenceCore(args, all);
  if (full.status === "PERSISTENT" || !all.some((l) => l.ie) || ["INSTRUMENT_FAILED", "TRIVIAL", "CHANNEL-BOUND"].includes(full.status)) return full;
  const outside = persistenceCore(args, all.filter((l) => !l.ie));
  if (outside.status === "PERSISTENT") return { ...outside, status: "PERSISTENT-OUTSIDE-IE", reasons: [...full.reasons, ...outside.reasons], allLineages: { status: full.status, k: full.k, nLineages: full.nLineages } };
  return { ...full, outsideIE: { status: outside.status, k: outside.k, nLineages: outside.nLineages } };
}

function persistenceCore({ sesoi, channels = null, nullOk = true, controlOk = null, powerUp = null, powerDown = null, trivialNull = null, alpha = ALPHA, B = DEFAULTS.bootstrapB, seed = SEED }, rows) {
  const defined = rows.filter((l) => l.defined !== false && Number.isFinite(l.theta));
  const undefinedIn = rows.filter((l) => !(l.defined !== false && Number.isFinite(l.theta))).map((l) => l.lineage);
  const d = defined.map((l) => l.theta - l.nullMedian);
  const holdsIn = defined.filter((_, i) => d[i] > 0).map((l) => l.lineage), failsIn = defined.filter((_, i) => !(d[i] > 0)).map((l) => l.lineage);
  const nL = defined.length, k = holdsIn.length;
  const reach = reachability(nL, alpha);
  const signP = nL ? signTestP(k, nL, 0.5) : 1;
  const signGate = reach.unreachable ? "unreachable" : k >= reach.kNeeded;
  const base = { k, nLineages: nL, signP, reachability: reach, holdsIn, failsIn, undefinedIn, sesoi };
  const reasons = [];
  const done = (status, extra = {}) => ({ status, ...base, reasons, pooled: extra.pooled ?? null, ...extra });
  if (controlOk === false) { reasons.push("a control built to fail survived"); return done("INSTRUMENT_FAILED"); }
  const under = [];
  if (controlOk !== true) under.push("the control built to fail was not run: no verdict either way");
  if (nL < 5 || reach.unreachable) under.push(`UNDERPOWERED BY REACHABILITY: ${nL} lineage(s) can vote; alpha is reachable only for 5 or more`);
  if (powerUp !== true) under.push(powerUp === null ? "power card not run: no verdict either way" : "the planted 2*SESOI regularity was not recovered at power 0.8");
  if (under.length) { reasons.push(...under); return done("UNDERPOWERED"); }
  const pooledEst = mean(d);
  const pooled = clusterBootstrap(d, defined.map((l) => l.lineage), mean, { B, seed });
  const [lo, hi] = pooled.ci95;
  const pooledOut = { est: pooledEst, ci95: pooled.ci95, B };
  if (hi < sesoi) {
    if (powerDown === true) { reasons.push("the interval's upper bound is below the registered smallest effect"); return done("ABSENT", { pooled: pooledOut }); }
    reasons.push("the interval lies below s but the planted 0.5*SESOI world was not called below s at power 0.8"); return done("UNDERPOWERED", { pooled: pooledOut });
  }
  if (!(lo > sesoi)) { reasons.push("the pooled interval straddles the registered smallest effect"); return done("UNDERPOWERED", { pooled: pooledOut }); }
  const trivial = trivialNull ? (trivialNull.reached === true || (Number.isFinite(trivialNull.nullQ95) && !(pooledEst - trivialNull.nullQ95 >= sesoi))) : false;
  if (trivial) { reasons.push("a registered trivial null reaches theta - s: recovered prior art, not an arch"); return done("TRIVIAL", { pooled: pooledOut }); }
  const nCh = Array.isArray(channels) ? channels.length : channels;
  if (!(nCh >= 2)) { reasons.push(`only ${nCh ?? 0} independent channel(s) show it: a property of the annotation or instrument`); return done("CHANNEL-BOUND", { pooled: pooledOut }); }
  if (nullOk === false) { reasons.push("the branch-blocked null explains the pooled effect"); return done("FAMILY-BOUND", { pooled: pooledOut }); }
  if (signGate !== true) { reasons.push(`the lineage sign gate failed (${k} of ${nL}; needs ${reach.kNeeded})`); return done("FAMILY-BOUND", { pooled: pooledOut }); }
  if (defined.length >= 3) {
    for (let i = 0; i < defined.length; i += 1) {
      const rest = d.filter((_, j) => j !== i), ci = clusterBootstrap(rest, defined.filter((_, j) => j !== i).map((l) => l.lineage), mean, { B: Math.min(B, 500), seed }).ci95;
      if (!(ci[0] > sesoi)) { reasons.push(`carried by one lineage (${defined[i].lineage}): leaving it out drops the lower bound to s or below`); return done("FAMILY-BOUND", { pooled: pooledOut, carriedBy: defined[i].lineage }); }
    }
  }
  reasons.push("every gate held");
  return done("PERSISTENT", { pooled: pooledOut });
}

/**
 * S7 independence audit: channels are joined when they share an ancestor (treebank, builder, prior file, kernel organ, annotator pool); the effective
 * number of independent channels is the number of connected components. `channels`: [{ id, ancestors: [...] }].
 */
export function independenceAudit(channels) {
  const parent = new Map(channels.map((c) => [c.id, c.id]));
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const owner = new Map();
  for (const c of channels) for (const a of c.ancestors ?? []) {
    if (owner.has(a)) parent.set(find(c.id), find(owner.get(a))); else owner.set(a, c.id);
  }
  const comps = new Map();
  for (const c of channels) { const r = find(c.id); if (!comps.has(r)) comps.set(r, []); comps.get(r).push(c.id); }
  const components = [...comps.values()];
  return { components, effectiveN: components.length, collapsed: components.filter((c) => c.length > 1) };
}

/** Barker's own standing: `checked` (may be consulted, may not speak unprompted) until all eight self-tests of BARKER.md 7 pass and S6's false-arch bound holds. */
export function archonStanding(selfCards = null) {
  const need = ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"];
  const have = new Map((selfCards ?? []).map((c) => [c.id, c.pass]));
  const missing = need.filter((id) => !have.has(id)), failing = need.filter((id) => have.has(id) && have.get(id) !== true);
  if (!missing.length && !failing.length) return { trust: "cleared", reason: "S1-S8 passed and the false-arch bound held", missing, failing };
  return { trust: "checked", reason: "Barker's own tests (S1-S8) have not all passed: it may be consulted, it may not speak unprompted", missing, failing };
}

/**
 * The earned-cast seam (the-fold/earned-cast.js: state.mapLines). Plain prose, no apparatus nouns, no covert vocabulary, never a cast name, and every line says what
 * was NOT shown. Returns [] unless the standing is "cleared". `banned` is the caller's list (the cast's own ban lists are imported by the TEST, not by this organ).
 */
export function mapLines(report, { maxLines = 3, banned = [], standing = null } = {}) {
  const st = standing ?? archonStanding(report?.selfCards ?? null);
  if (st.trust !== "cleared") return [];
  const lineages = report?.lineages ?? null, bits = [];
  const kinds = (report?.kinds ?? []).filter((k) => k.status === "CLUSTER");
  const arches = (report?.arches ?? []).filter((a) => a.standing === "PERSISTENT" || a.standing === "PERSISTENT-OUTSIDE-IE");
  const scope = lineages ? `as far as ${lineages} independent families can say` : "as far as the families measured can say";
  if (kinds.length) bits.push(`${kinds.length === 1 ? "one grouping of languages" : `${kinds.length} groupings of languages`} held across families, ${scope}; nothing was shown about families not measured, and this reading is itself one of the pieces`);
  if (arches.length) bits.push(`${arches.length === 1 ? "one pattern" : `${arches.length} patterns`} recurred in every family that could be checked, ${scope}; the others could not be checked, and this reading is itself one of the pieces`);
  const ban = [...APPARATUS_NOUNS_GUARD, ...banned, "barker"].map((t) => String(t).toLowerCase());
  return bits.filter((l) => !ban.some((t) => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(l))).slice(0, maxLines);
}
const APPARATUS_NOUNS_GUARD = freeze(["prompt", "passage", "material", "document", "source material", "search result", "retrieved", "retrieval", "extractable relation", "chunk", "citation", "this turn", "the record", "mechanically confirmed", "phase", "cube", "operator", "grain", "cell", "trajectory", "canonical order"]);

// ── arches: a regularity, its per-lineage standing, and the scan that finds the ones worth testing ─────────
/** Nested lineage means of a per-system statistic: systems -> branches -> lineages (layout: { branches, lineages } aligned with the values). */
export function lineageMeans(values, layout) {
  const ids = values.map((_, i) => String(i));
  return nestedMean(Object.fromEntries(ids.map((id, i) => [id, values[i]])), (id) => layout.branches[+id], (id) => layout.lineages[+id]).perLineage;
}

/**
 * Which lineages can vote at all (BARKER.md 4.6, h_l): the planted sign statistic, simulated at THAT lineage's own composition. A regularity of strength `effect`
 * (a correlation, in normal-score units; use 2*SESOI) is planted between two features of every system; lineage l votes iff the nested mean product exceeds 0 in at
 * least `floor` (0.8) of `reps` worlds. A single-system lineage cannot vote at an effect of 0.6: its sign is the sign of one product of two normals.
 * The null median of that mean is 0 by symmetry, which is why the comparison is with 0 here.
 */
export function lineageSignPower(layout, { effect, reps = DEFAULTS.lineagePowerReps, seed = SEED, floor = DEFAULTS.lineagePowerFloor } = {}) {
  const n = layout.branches.length, rng = makeRng({ seed, purpose: "lineage-sign-power", effect, n }), normal = normalSampler(rng);
  const lins = [...new Set(layout.lineages)], hits = new Map(lins.map((l) => [l, 0]));
  const sdv = Math.sqrt(Math.max(0, 1 - effect * effect));
  for (let r = 0; r < reps; r += 1) {
    const prod = new Array(n);
    for (let i = 0; i < n; i += 1) { const a = normal(); const b = effect * a + sdv * normal(); prod[i] = a * b; }
    const lm = lineageMeans(prod, layout);
    for (const [l, v] of lm) if (v > 0) hits.set(l, hits.get(l) + 1);
  }
  const power = new Map([...hits].map(([l, h]) => [l, h / reps]));
  return { power, defined: new Set([...power].filter(([, p]) => p >= floor).map(([l]) => l)), effect, reps, floor };
}

/**
 * The arch engine: a regularity R with a per-system statistic `theta` (oriented, larger = more arch-like), judged by the persistence rule.
 * `layout`: { branches, lineages } per system (+ optional `ids`); `nullThetas`: optional draws-by-systems array of theta under a branch-blocked null (gives each lineage's
 * null median and the pooled null); `definedLineages`: which lineages can vote (default: all with a finite theta; use lineageSignPower); `control`: { passed } from the control
 * built to fail; `powerUp`/`powerDown` from the card's planted worlds; `channels`: independent channels showing it; `ieLineages`: lineage labels that are Indo-European.
 * Returns { id, operationalisation, holdsIn, failsIn, undefinedIn, control, standing, ... }; the full persistence record rides along.
 */
export function archOf({ id, operationalisation, layout, theta, nullThetas = null, sesoi, control = null, powerUp = null, powerDown = null, channels = null, trivialNull = null, nullOk = null, definedLineages = null, ieLineages = null, alpha = ALPHA, B = DEFAULTS.bootstrapB, seed = SEED } = {}) {
  if (!layout?.branches || !layout?.lineages) throw new TypeError("archOf: layout needs branches and lineages per system");
  const obs = lineageMeans(theta, layout);
  const med = new Map();
  let nullPooled = null;
  const defSet = definedLineages ? new Set([...definedLineages].map(String)) : null;
  const isDef = (l) => (defSet ? defSet.has(String(l)) : true) && Number.isFinite(obs.get(l));
  if (nullThetas?.length) {
    const per = new Map([...obs.keys()].map((l) => [l, []]));
    const drawMeans = nullThetas.map((row) => lineageMeans(row, layout));
    for (const dm of drawMeans) for (const [l, v] of dm) if (per.has(l)) per.get(l).push(v);
    for (const [l, vs] of per) med.set(l, median(vs.filter(Number.isFinite)));
    const defined = [...obs.keys()].filter(isDef);
    const dObs = mean(defined.map((l) => obs.get(l) - med.get(l)));
    nullPooled = drawMeans.map((dm) => mean(defined.map((l) => dm.get(l) - med.get(l))));
    const p = (1 + nullPooled.filter((x) => x >= dObs - 1e-12).length) / (nullPooled.length + 1);
    if (nullOk === null) nullOk = p <= alpha;
    var nullP = p;
  }
  const perLineage = [...obs.keys()].map((l) => ({ lineage: l, theta: obs.get(l), nullMedian: med.get(l) ?? 0, defined: isDef(l), ie: ieLineages ? new Set(ieLineages.map(String)).has(String(l)) : false }));
  const pr = persistence({ perLineage, sesoi, channels, nullOk: nullOk === null ? true : nullOk, controlOk: control ? control.passed === true : null, powerUp, powerDown, trivialNull, alpha, B, seed });
  const descriptive = { concordant: perLineage.filter((l) => Number.isFinite(l.theta) && l.theta - l.nullMedian > 0).map((l) => l.lineage), discordant: perLineage.filter((l) => Number.isFinite(l.theta) && !(l.theta - l.nullMedian > 0)).map((l) => l.lineage) };
  return { id, operationalisation, holdsIn: pr.holdsIn, failsIn: pr.failsIn, undefinedIn: pr.undefinedIn, control: control ?? { name: null, passed: null, note: "control not run" }, standing: pr.status, pooled: pr.pooled, persistence: pr, perLineage, descriptive, nullP: nullP ?? null, nullOk };
}

const normalScoreColumn = (col, n) => {
  const idx = [];
  for (let i = 0; i < n; i += 1) if (Number.isFinite(col[i])) idx.push(i);
  idx.sort((a, b) => col[a] - col[b] || a - b);
  const m = idx.length, z = new Float64Array(n);
  for (let s = 0; s < m;) {
    let t = s;
    while (t + 1 < m && col[idx[t + 1]] === col[idx[s]]) t += 1;
    const score = normalQuantile(((s + t) / 2 + 0.5) / m);
    for (let q = s; q <= t; q += 1) z[idx[q]] = score;
    s = t + 1;
  }
  let ss = 0;
  for (const i of idx) ss += z[i] * z[i];
  const sc = ss > 0 ? Math.sqrt(m / ss) : 1;
  for (const i of idx) z[i] *= sc;
  return z;
};
function nestedWeights(layout) {
  const n = layout.branches.length, bsize = new Map(), lb = new Map();
  for (let i = 0; i < n; i += 1) {
    bsize.set(`${layout.lineages[i]}|${layout.branches[i]}`, (bsize.get(`${layout.lineages[i]}|${layout.branches[i]}`) ?? 0) + 1);
    if (!lb.has(layout.lineages[i])) lb.set(layout.lineages[i], new Set());
    lb.get(layout.lineages[i]).add(layout.branches[i]);
  }
  const L = lb.size;
  return Float64Array.from({ length: n }, (_, i) => 1 / (bsize.get(`${layout.lineages[i]}|${layout.branches[i]}`) * lb.get(layout.lineages[i]).size * L));
}

/**
 * The coupling scan (the organ's generic arch family): for every pair of features in DIFFERENT blocks (default: different feature groups), the nested
 * (system -> branch -> lineage) mean of the product of their normal scores, oriented by the sign of the pooled mean. SEARCH-AWARE: the ceiling is the (1-alpha)
 * quantile of the maximum |pooled mean| over all cross-block pairs under each null; the nulls move whole BLOCKS (N-grp over all systems, N-fam within branch strata),
 * so structure inside a group (shares that sum to one, Zipf with Heaps) cannot manufacture a pair. Each candidate that clears every null goes through archOf.
 * The control built to fail: `controlReps` block-permuted copies must yield no candidate (exact binomial rule). Power cards decide which lineages vote
 * (lineageSignPower at 2*SESOI) and are supplied as `archPower` ({ powerUp, powerDown }); without them standing is UNDERPOWERED, never "not found".
 */
export function scanCouplings(bm, { layout = null, blocksBy = "group", nulls = null, draws = DRAWS, alpha = ALPHA, seed = SEED, sesoi = DEFAULTS.couplingSesoi, maxCandidates = 25, controlReps = DEFAULTS.controlReps, controlDraws = null, archPower = null, channelsOf = null, ieLineages = null, B = DEFAULTS.bootstrapB, lineagePowerReps = DEFAULTS.lineagePowerReps, _inControl = false } = {}) {
  if (!isBlocks(bm)) throw new TypeError("scanCouplings: expected a block matrix");
  const lay = layout ?? (bm.branches && bm.lineages ? { branches: bm.branches, lineages: bm.lineages } : null);
  const gaps = [];
  if (!lay) return { candidates: [], gaps: [{ type: "no_layout", detail: "couplings are judged per lineage: branch and lineage labels are required" }], top: [], ceiling: null };
  const n = bm.n, F = bm.featureKeys.length;
  const nl = nulls ?? (new Set(famStrata(lay.branches)).size > 1 && famStrata(lay.branches).some((s) => s !== "singletons") ? ["feat", "fam"] : ["feat"]);
  const strata = famStrata(lay.branches);
  const blockOf = new Int32Array(F);
  const blocks = [];
  if (blocksBy === "group") {
    const byGroup = new Map();
    for (let j = 0; j < F; j += 1) { const g = bm.groupOf?.[j] ?? `~${j}`; if (!byGroup.has(g)) byGroup.set(g, []); byGroup.get(g).push(j); }
    for (const idx of byGroup.values()) { idx.forEach((j) => { blockOf[j] = blocks.length; }); blocks.push(idx); }
  } else for (let j = 0; j < F; j += 1) { blockOf[j] = j; blocks.push([j]); }
  const pairs = [];
  for (let f = 0; f < F; f += 1) for (let g = f + 1; g < F; g += 1) if (blockOf[f] !== blockOf[g]) pairs.push([f, g]);
  if (!pairs.length) return { candidates: [], gaps: [{ type: "no_cross_block_pairs", detail: "couplings need at least two feature groups" }], top: [], ceiling: null, nPairs: 0 };
  const Z = bm.values.map((c) => normalScoreColumn(c, n));
  const w = nestedWeights(lay);
  const stat = (Zs, f, g) => { let s = 0; const a = Zs[f], b = Zs[g]; for (let i = 0; i < n; i += 1) s += w[i] * a[i] * b[i]; return s; };
  const observed = pairs.map(([f, g]) => stat(Z, f, g));
  const permuted = (rng, kind) => {
    const out = Z.map((c) => c.slice());
    const groups = kind === "fam" ? (() => { const by = new Map(); strata.forEach((s, i) => { if (!by.has(s)) by.set(s, []); by.get(s).push(i); }); return [...by.values()]; })() : [Array.from({ length: n }, (_, i) => i)];
    for (const block of blocks) {
      const perm = new Int32Array(n);
      for (const gset of groups) { const sh = shuffled(gset, rng); gset.forEach((src, k) => { perm[src] = sh[k]; }); }
      for (const j of block) for (let i = 0; i < n; i += 1) out[j][i] = Z[j][perm[i]];
    }
    return out;
  };
  const nullState = {};
  for (const nu of nl) {
    const M = new Float64Array(draws);
    for (let d = 0; d < draws; d += 1) {
      const Zs = permuted(makeRng({ seed, purpose: "coupling-null", test: nu, d }), nu);
      let best = 0;
      for (const [f, g] of pairs) { const v = Math.abs(stat(Zs, f, g)); if (v > best) best = v; }
      M[d] = best;
    }
    nullState[nu] = { M, ceiling: quantile(Array.from(M), 1 - alpha) };
  }
  const ceilingValue = Math.max(...Object.values(nullState).map((s) => s.ceiling));
  const ceiling = { value: ceilingValue, perNull: Object.fromEntries(nl.map((nu) => [nu, nullState[nu].ceiling])), nulls: nl, D: draws, alpha };
  const table = pairs.map(([f, g], k) => {
    const T = Math.abs(observed[k]);
    const p = Object.fromEntries(nl.map((nu) => { let ge = 0; for (let d = 0; d < draws; d += 1) if (nullState[nu].M[d] >= T) ge += 1; return [nu, (1 + ge) / (draws + 1)]; }));
    return { f, g, T, signed: observed[k], p, pass: nl.every((nu) => T > nullState[nu].ceiling && p[nu] <= alpha) };
  }).sort((a, b) => b.T - a.T);
  const top = table.slice(0, 10).map((r) => ({ pair: [bm.featureKeys[r.f], bm.featureKeys[r.g]], T: r.T, p: r.p, pass: r.pass }));
  let passing = table.filter((r) => r.pass);
  if (passing.length > maxCandidates) { gaps.push({ type: "candidates_truncated", detail: { kept: maxCandidates, passing: passing.length } }); passing = passing.slice(0, maxCandidates); }

  // ---- control built to fail
  let control = null;
  if (controlReps > 0 && !_inControl) {
    let survivors = 0;
    for (let r = 0; r < controlReps; r += 1) {
      const perm = redeal(bm, { kind: "feat", blocks, rng: makeRng({ seed, purpose: "coupling-control", rep: r }) });
      const res = scanCouplings(perm, { layout: lay, blocksBy, nulls: nl, draws: controlDraws ?? Math.min(draws, 99), alpha, seed: seed + 500 + r, sesoi, controlReps: 0, archPower, channelsOf, ieLineages, B, _inControl: true, maxCandidates: 1 });
      if (res.candidates.length || res.passing > 0) survivors += 1;
    }
    const failed = rateExceeds(survivors, controlReps, alpha, alpha);
    control = { name: "block-permuted copy", reps: controlReps, survivors, failed, passed: !failed };
  }
  if (_inControl) return { candidates: passing.length ? [{ id: "control-survivor" }] : [], passing: passing.length, gaps, top, ceiling };

  // ---- per-lineage power, then archOf for every candidate
  const lp = lineageSignPower(lay, { effect: 2 * sesoi, reps: lineagePowerReps, seed });
  const replayNull = nl.includes("fam") ? "fam" : nl[0];
  const candidates = passing.map((r) => {
    const sigma = Math.sign(r.signed) || 1, f = r.f, g = r.g;
    const theta = Array.from({ length: n }, (_, i) => (Number.isFinite(bm.values[f][i]) && Number.isFinite(bm.values[g][i]) ? sigma * Z[f][i] * Z[g][i] : NaN));
    const nullThetas = [];
    for (let d = 0; d < draws; d += 1) {
      const Zs = permuted(makeRng({ seed, purpose: "coupling-null", test: replayNull, d }), replayNull);
      nullThetas.push(Array.from({ length: n }, (_, i) => sigma * Zs[f][i] * Zs[g][i]));
    }
    const meta = bm.featureMeta ?? null;
    const channels = channelsOf ? channelsOf(f, g, bm) : (meta && meta[f] && meta[g] ? independenceAudit([f, g].map((j) => ({ id: `${meta[j].channel}|${meta[j].giver}`, ancestors: [meta[j].giver, ...(meta[j].ancestors ?? [])] }))).effectiveN : null);
    const a = archOf({ id: `coupling:${bm.groupOf?.[f] ?? "?"}.${bm.featureKeys[f]}~${bm.groupOf?.[g] ?? "?"}.${bm.featureKeys[g]}`, operationalisation: `nested (system, branch, lineage) mean of the product of the normal scores of ${bm.featureKeys[f]} and ${bm.featureKeys[g]}, oriented by the sign of the pooled mean (${sigma > 0 ? "positive" : "negative"}); a cross-group pair under the ${nl.join(" and ")} null(s)`, layout: lay, theta, nullThetas, sesoi, control, powerUp: archPower?.powerUp ?? null, powerDown: archPower?.powerDown ?? null, channels, definedLineages: lp.defined, ieLineages, alpha, B, seed });
    return { ...a, features: [bm.featureKeys[f], bm.featureKeys[g]], groups: [bm.groupOf?.[f] ?? null, bm.groupOf?.[g] ?? null], statistic: { T: r.T, p: r.p, signed: r.signed, ceiling: ceilingValue }, signP: a.persistence.signP };
  });
  if (!archPower) gaps.push({ type: "power_card_missing", detail: "archPower not supplied: no coupling can exceed UNDERPOWERED (a test whose power card did not run is not read)" });
  return { candidates, ceiling, top, nPairs: pairs.length, blocks: blocks.length, control, lineagePower: Object.fromEntries(lp.power), definedLineages: [...lp.defined], gaps, nulls: nl, draws };
}

/**
 * The coupling card's own power (BARKER.md 4.6 condition 5) on a layout: a correlation of 2*SESOI and of 0.5*SESOI is planted between one feature of each of two
 * groups (the rest independent noise) and put through the whole scan. powerUp := the planted pair is called PERSISTENT at rate >= 0.8; powerDown := its pooled interval's
 * upper bound is below SESOI at rate >= 0.8 at 0.5*SESOI. On a layout where fewer than 5 lineages can vote, powerUp is false by construction and says why.
 */
export function archPowerCard({ branchSizes, lineageOf = null, sesoi = DEFAULTS.couplingSesoi, reps = 20, draws = 49, noisePerGroup = 8, seed = SEED, alpha = ALPHA, channels = 2, B = 400 } = {}) {
  const sizes = branchSizes, n = sumOf(sizes), starts = [];
  { let a = 0; for (const s of sizes) { starts.push(a); a += s; } }
  const lineageOfBranch = sizes.map((_, b) => String(typeof lineageOf === "function" ? lineageOf(b) : Array.isArray(lineageOf) ? lineageOf[b] : b));
  const branches = [], lineages = [];
  sizes.forEach((s, b) => { for (let k = 0; k < s; k += 1) { branches.push(`b${b}`); lineages.push(lineageOfBranch[b]); } });
  const ids = Array.from({ length: n }, (_, i) => `s${String(i).padStart(2, "0")}`);
  const keys = ["a0", ...Array.from({ length: noisePerGroup }, (_, k) => `a${k + 1}`), "b0", ...Array.from({ length: noisePerGroup }, (_, k) => `b${k + 1}`)];
  const groupOf = keys.map((k) => k[0].toUpperCase());
  const out = { effects: {} };
  const lay = { branches, lineages };
  const lp = lineageSignPower(lay, { effect: 2 * sesoi, reps: DEFAULTS.lineagePowerReps, seed });
  for (const [name, effect] of [["up", 2 * sesoi], ["down", 0.5 * sesoi]]) {
    let persistent = 0, below = 0;
    for (let r = 0; r < reps; r += 1) {
      const rng = makeRng({ seed, purpose: "arch-power", name, r }), normal = normalSampler(rng);
      const rows = Array.from({ length: n }, () => {
        const row = keys.map(() => normal());
        row[keys.indexOf("b0")] = effect * row[0] + Math.sqrt(1 - effect * effect) * row[keys.indexOf("b0")];
        return row;
      });
      const bm = blockMatrixFromValues(rows, { ids, featureKeys: keys, groupOf, branches, lineages, bins: 2 });
      const res = scanCouplings(bm, { layout: lay, draws, alpha, seed: seed + r, sesoi, controlReps: 0, archPower: { powerUp: true, powerDown: true }, channelsOf: () => channels, B, lineagePowerReps: 100 });
      const planted = res.candidates.find((c) => c.features.includes("a0") && c.features.includes("b0"));
      if (planted && (planted.standing === "PERSISTENT" || planted.standing === "PERSISTENT-OUTSIDE-IE")) persistent += 1;
      // pooled interval of the planted pair irrespective of the ceiling
      const j0 = keys.indexOf("a0"), j1 = keys.indexOf("b0");
      const Zf = normalScoreColumn(bm.values[j0], n), Zg = normalScoreColumn(bm.values[j1], n);
      const prod = Array.from({ length: n }, (_, i) => Math.sign(Zf.reduce((s, x, i2) => s + x * Zg[i2], 0)) * Zf[i] * Zg[i]);
      const lm = lineageMeans(prod, lay), def = [...lm.keys()].filter((l) => lp.defined.has(l));
      if (def.length >= 2) { const ci = clusterBootstrap(def.map((l) => lm.get(l)), def, mean, { B, seed: seed + r }).ci95; if (ci[1] < sesoi) below += 1; }
    }
    out.effects[name] = { effect, reps, persistent, below, persistentRate: persistent / reps, belowRate: below / reps };
  }
  out.definedLineages = [...lp.defined];
  out.lineagePower = Object.fromEntries(lp.power);
  out.powerUp = out.effects.up.persistentRate >= 0.8;
  out.powerDown = out.effects.down.belowRate >= 0.8;
  out.reasons = [];
  if (lp.defined.size < 5) out.reasons.push(`UNDERPOWERED BY REACHABILITY: ${lp.defined.size} lineage(s) can vote at ${2 * sesoi}; the sign gate needs 5 or more`);
  out.sesoi = sesoi; out.draws = draws; out.reps = reps;
  return out;
}

// ── rivals and ledgers the kernel already knows how to hold ─────────────────────
/**
 * Registers rival partitions (family, script, a data-driven grouping, Barker's own) as EXPLICIT classifications beside the induced kinds:
 * `partitions` is { name: { systemId: label } }; each is projected by kernel/kind-induction.js as received_explicit_classification, witnessed: false.
 * Declared and induced kinds are never merged; they are compared (held-out cross-entropy at equal k, BARKER.md 6.0).
 */
export function registerRivals(partitions, { giver } = {}) {
  if (!giver) throw new TypeError("registerRivals: every received partition names its giver");
  const entries = [];
  for (const [name, assignment] of Object.entries(partitions)) {
    for (const [sys, label] of Object.entries(assignment)) {
      entries.push(kindEvidence({ id: `rival:${name}:${sys}`, entityRef: sys, evidenceType: "explicit_classification", kindKey: `${name}:${label}`, kindSurface: String(label), witness: `${giver}/${name}` }));
    }
  }
  return { entries, projections: snapshotKindState(createKindInductionIndex(entries)) };
}

/**
 * The functional-determination ledger (A11): through the kernel's induceKindsAndFunctions each induced relation kind gets, per relation, one of unexposed / refuted /
 * candidate (fixed or one-at-a-time), read off the member systems under the grain theorem: a corpus can refute a single-valued claim and can never establish one.
 * A thin wrapper that refuses to default any declared number (draws, alpha, seed, exposureFloor).
 */
export function functionalLedger(referents, { assertionsOf, sameValue, exposureFloor, draws, alpha = ALPHA, seed = SEED, witnessed = null, inProfile = null } = {}) {
  return induceKindsAndFunctions(referents, { assertionsOf, sameValue, exposureFloor, kindMethod: "characteristic-sets", kindOptions: { draws, alpha, seed }, witnessed, inProfile });
}

// ── the metastructure: groups of features, kinds, couplings, agreement, and the hooks that test the map itself ──────
const spectralPartition = (bm, minKind) => {
  const { cols } = denseColumns(bm), t = gramTop(cols, bm.n);
  return t ? Array.from(t.vec, (v) => (v < 0 ? 0 : 1)) : new Array(bm.n).fill(0);
};
const labelOf = (p, key) => p.labels?.[key] ?? null;

function resampleProfile(p, rng) {
  const cells = {};
  for (const [k, c] of Object.entries(p.cells)) {
    const r = c.resamples;
    cells[k] = r && r.length >= 2 ? { ...c, value: mean(Array.from({ length: r.length }, () => r[Math.floor(rng() * r.length)])), resamples: [...r] } : { ...c };
  }
  return { ...p, cells };
}
function permuteProfiles(profiles, kind, rng) {
  const n = profiles.length;
  if (kind === "columns") {
    // every feature's values permuted across systems independently (N-feat at the profile level): the control built to fail
    const keys = new Set(profiles.flatMap((p) => Object.keys(p.cells)));
    const out = profiles.map((p) => ({ ...p, cells: {} }));
    for (const k of keys) {
      const have = profiles.map((p, i) => [i, p.cells[k]]).filter(([, c]) => c);
      const perm = shuffled(have.map(([, c]) => c), rng);
      have.forEach(([i], j) => { out[i].cells[k] = { ...perm[j] }; });
    }
    return out;
  }
  if (kind === "labels") {
    const idx = shuffled(Array.from({ length: n }, (_, i) => i), rng);
    return profiles.map((p, i) => ({ ...p, labels: { ...profiles[idx[i]].labels } }));
  }
  if (kind === "systems") {
    const idx = shuffled(Array.from({ length: n }, (_, i) => i), rng);
    return profiles.map((p, i) => ({ ...p, cells: profiles[idx[i]].cells }));
  }
  throw new TypeError(`permuteProfiles: unknown kind ${kind}`);
}

/**
 * Induces the metastructure of a set of measured systems (BARKER.md 4): per feature group (A..I; targets T are never predictors) and once on the concatenation,
 * the kinds of systems under the search-aware ceiling, then the cross-group couplings through the persistence rule, then the agreement between the groups' own
 * partitions. Everything is typed: a group too small, a feature without coverage, a power card not supplied, a lineage that cannot vote are GAPS, never guesses.
 * Returns { kinds, kindOfSystem, arches, groups, agreement, gaps, provenance, selfTest, standing }. Pure; profiles are injected; nothing is read from disk.
 *
 * `opts`: groups, bins, draws, alpha, seed, instruments, nulls, minKindSize, controlReps, branchOf, lineageOf (answer keys; default labels.branch/lineage), ieLineages,
 * powerGrid (from powerGrid()), calibrations ({ group: copulaCalibration() }), archPower (from archPowerCard()), arches (default true), concatenated (default true),
 * agreementDraws (199), reference (training system ids for the bin cuts). The map is itself coordinated: the result carries its own frame declaration and self-test hooks.
 */
export function induceMetastructure(profiles, opts = {}) {
  if (!Array.isArray(profiles) || profiles.length < 4) throw new TypeError("induceMetastructure: profiles must be an array of at least 4 SystemProfile@1");
  for (const p of profiles) {
    const scan = assertEoFree(p, { extraBan: opts.extraBan ?? [] });
    if (!scan.ok) throw new TypeError(`induceMetastructure: profile ${p.id} is not EO-free: ${scan.offenders.map((o) => `${o.path}:${o.token}`).join("; ")}`);
  }
  const o = {
    bins: opts.bins ?? DEFAULTS.bins, draws: opts.draws ?? DRAWS, alpha: opts.alpha ?? ALPHA, seed: opts.seed ?? SEED, instruments: opts.instruments ?? INSTRUMENTS, minKindSize: opts.minKindSize ?? DEFAULTS.minKindSize,
    controlReps: opts.controlReps ?? DEFAULTS.controlReps, powerGrid: opts.powerGrid ?? null, calibrations: opts.calibrations ?? {}, archPower: opts.archPower ?? null, agreementDraws: opts.agreementDraws ?? 199,
    arches: opts.arches !== false, concatenated: opts.concatenated !== false, reference: opts.reference ?? null, nulls: opts.nulls ?? null, sesoi: opts.couplingSesoi ?? DEFAULTS.couplingSesoi,
  };
  const groups = opts.groups ?? [...new Set(profiles.flatMap((p) => Object.values(p.cells ?? {}).map((c) => c.group)))].filter((g) => g !== "T").sort();
  const gaps = [], kinds = [], refused = [], groupRecords = [];
  const common = { branchOf: opts.branchOf ?? null, lineageOf: opts.lineageOf ?? null, bins: o.bins, reference: o.reference };
  const runs = groups.map((g) => ({ group: g, groups: [g] }));
  if (o.concatenated && groups.length > 1) runs.push({ group: "ALL", groups });
  const partitions = {};
  let concatBm = null;
  for (const run of runs) {
    const bm = blockMatrixOf(profiles, { ...common, groups: run.groups });
    bm.group = run.group;
    if (run.group === "ALL") concatBm = bm;
    for (const g of bm.gaps) gaps.push({ group: run.group, ...g });
    if (bm.featureKeys.length < 2) { gaps.push({ type: "group_too_small", group: run.group, detail: { features: bm.featureKeys.length, need: 2 } }); groupRecords.push({ group: run.group, n: bm.n, features: bm.featureKeys.length, status: "skipped" }); continue; }
    if (bm.n < 2 * o.minKindSize) { gaps.push({ type: "population_too_small", group: run.group, detail: { n: bm.n, need: 2 * o.minKindSize } }); groupRecords.push({ group: run.group, n: bm.n, features: bm.featureKeys.length, status: "skipped" }); continue; }
    const res = induceSystemKinds(bm, { draws: o.draws, alpha: o.alpha, seed: o.seed, instruments: o.instruments, nulls: o.nulls ?? undefined, minKindSize: o.minKindSize, controlReps: o.controlReps, group: run.group, population: `S:${run.group}`, grid: o.powerGrid, calibration: o.calibrations[run.group] ?? null, neighborSweep: opts.neighborSweep ?? true, onProgress: opts.onProgress });
    kinds.push(...res.kinds);
    refused.push(...res.refused.map((r) => ({ group: run.group, ...r })));
    for (const g of res.gaps) gaps.push({ group: run.group, ...g });
    partitions[run.group] = spectralPartition(bm, o.minKindSize);
    const absenceLicensed = o.powerGrid ? o.powerGrid.absenceLicensed === true : false;
    groupRecords.push({ group: run.group, n: bm.n, features: bm.featureKeys.length, status: "run", effectiveDimension: res.diagnostics.effectiveDimension, ceiling: res.ceiling, control: res.diagnostics.control, calibration: res.diagnostics.calibration, tried: res.diagnostics.tried, candidateTable: res.diagnostics.candidateTable, neighborSweep: res.diagnostics.neighborSweep ?? null, knobStable: res.diagnostics.knobStable ?? null, censoredAtZero: res.diagnostics.statisticsCensoredAtZero, absence: absenceLicensed ? "LICENSED" : "UNDERPOWERED", absenceNote: absenceLicensed ? "the SESOI cell is admissible on the supplied power grid" : "a statement that no kind exists here is not licensed: no admissible SESOI cell was supplied" });
  }
  // ---- cross-group agreement of the groups' own dominant partitions (one consensus, or several stable incompatible ones)
  const agreement = { pairs: [], draws: o.agreementDraws, note: "dominant (first-axis sign-split) partition of each group; ARI against a permutation null within branch strata" };
  const gnames = Object.keys(partitions);
  const firstBm = blockMatrixOf(profiles, { ...common, groups: groups.slice(0, 1) });
  const strata = firstBm.branches ? famStrata(firstBm.branches) : null;
  for (let a = 0; a < gnames.length; a += 1) for (let b = a + 1; b < gnames.length; b += 1) {
    if (gnames[a] === "ALL" || gnames[b] === "ALL") continue;
    const A = partitions[gnames[a]], Bp = partitions[gnames[b]];
    const ari = adjustedRand(A, Bp);
    const rng = makeRng({ seed: o.seed, purpose: "agreement", a: gnames[a], b: gnames[b] });
    const by = new Map();
    (strata ?? A.map(() => "all")).forEach((s, i) => { if (!by.has(s)) by.set(s, []); by.get(s).push(i); });
    const { ge } = permutationCount(o.agreementDraws, () => {
      const perm = new Array(A.length);
      for (const idx of by.values()) { const sh = shuffled(idx, rng); idx.forEach((src, k) => { perm[src] = Bp[sh[k]]; }); }
      return adjustedRand(A, perm);
    }, (x) => x >= ari - 1e-12);
    agreement.pairs.push({ groups: [gnames[a], gnames[b]], ari, p: (1 + ge) / (o.agreementDraws + 1) });
  }
  // ---- cross-group couplings through the persistence rule
  let arches = [], archDetail = null;
  if (o.arches && concatBm && groups.length > 1) {
    const ie = opts.ieLineages ?? [...new Set(concatBm.lineages ?? [])].filter((l) => /indo-?european/i.test(l));
    const scan = scanCouplings(concatBm, { draws: o.draws, alpha: o.alpha, seed: o.seed, sesoi: o.sesoi, controlReps: o.controlReps, archPower: o.archPower, ieLineages: ie, channelsOf: opts.channelsOf ?? null, B: opts.bootstrapB ?? DEFAULTS.bootstrapB });
    arches = scan.candidates;
    archDetail = { ceiling: scan.ceiling, top: scan.top, nPairs: scan.nPairs, blocks: scan.blocks ?? null, control: scan.control ?? null, definedLineages: scan.definedLineages ?? null, lineagePower: scan.lineagePower ?? null, nulls: scan.nulls ?? null };
    for (const g of scan.gaps) gaps.push({ group: "ALL", ...g });
    if (scan.definedLineages && scan.definedLineages.length < 5) gaps.push({ type: "arch_underpowered_by_reachability", detail: { definedLineages: scan.definedLineages.length, need: 5, note: "per-lineage regularities cannot reach alpha: fewer than 5 lineages can vote at 2*SESOI on this layout" } });
  } else if (o.arches) gaps.push({ type: "arches_not_run", detail: "needs at least two feature groups" });
  // ---- who is in which kind
  const kindOfSystem = {};
  for (const p of profiles) kindOfSystem[p.id] = { clusters: [], familyBound: [], gradients: [] };
  for (const k of kinds) {
    if (k.status === "CLUSTER") for (const id of k.memberRefs) kindOfSystem[id].clusters.push(k.id);
    else if (k.status === "FAMILY-BOUND") for (const id of k.memberRefs) kindOfSystem[id].familyBound.push(k.id);
    else if (k.status === "GRADIENT" && k.gradientAxis) for (const { id, score } of k.gradientAxis) kindOfSystem[id].gradients.push({ kind: k.id, score });
  }
  if (!kinds.length) gaps.push({ type: "no_kind_found", detail: "no kind cleared the ceiling; absence is licensed only where the SESOI cell is admissible (see groups[].absence)" });
  const givers = [...new Set(profiles.flatMap((p) => Object.values(p.cells ?? {}).map((c) => c.giver)))].sort();
  const provenance = {
    organ: "organs/barker.js", version: BARKER_VERSION, seed: o.seed, alpha: o.alpha, draws: o.draws, instruments: [...o.instruments], bins: o.bins, minKindSize: o.minKindSize, groups, systems: profiles.map((p) => ({ id: p.id, contentHash: p.contentHash ?? null })),
    givers, kernel: ["kernel/entity-kind-induction.js", "kernel/kind-functional-induction.js", "kernel/kind-induction.js", "kernel/rng.js", "organs/kind-standing.js"],
    typedNumbers: { ...DEFAULTS }, powerGridSupplied: !!o.powerGrid, calibrationsSupplied: Object.keys(o.calibrations), archPowerSupplied: !!o.archPower,
    frameDeclaration: { organs: { barker: `organs/barker.js@${BARKER_VERSION}`, kanada: "kernel/entity-kind-induction.js", characteristicSets: "kernel/kind-functional-induction.js", ledger: "kernel/kind-functional-induction.js", membership: "organs/kind-standing.js" }, givers: Object.fromEntries(givers.map((g) => [g, g])), numbers: { alpha: o.alpha, draws: o.draws, seed: o.seed, bins: o.bins, minKindSize: o.minKindSize, controlReps: o.controlReps, couplingSesoi: o.sesoi } },
    lens: "UD annotation conventions and khora's own instruments, as measured by the profile builders; one author's choice of nulls and instruments. The map is itself coordinated and claims no standpoint outside.",
  };
  const rerun = (p2, over = {}) => induceMetastructure(p2, { ...opts, ...over });
  const selfTest = {
    resample: (seed = o.seed) => { const rng = makeRng({ seed, purpose: "resample" }); return profiles.map((p) => resampleProfile(p, rng)); },
    permute: (kind, seed = o.seed) => permuteProfiles(profiles, kind, makeRng({ seed, purpose: "permute", kind })),
    rerun, ari: adjustedRand,
    partitionOf: (result, group = "ALL") => profiles.map((p) => { const k = result.kinds.find((x) => x.group === group && (x.status === "CLUSTER" || x.status === "GRADIENT") && x.memberRefs.includes(p.id)); return k ? k.id : "none"; }),
    /** S1, partition level: ARI of each group's dominant partition between the original and `B` bootstrap resamples of the profiles' own resamples, against the ARI between two independent column-permuted copies. */
    stability: ({ B = 20, seed = o.seed } = {}) => {
      const out = {};
      for (const g of groups) {
        const base = spectralPartition(blockMatrixOf(profiles, { ...common, groups: [g] }), o.minKindSize);
        const ari = [];
        for (let b = 0; b < B; b += 1) ari.push(adjustedRand(base, spectralPartition(blockMatrixOf(selfTest.resample(seed + b), { ...common, groups: [g] }), o.minKindSize)));
        const nullAri = [];
        for (let b = 0; b < B; b += 1) {
          const p1 = spectralPartition(blockMatrixOf(selfTest.permute("columns", seed + 1000 + 2 * b), { ...common, groups: [g] }), o.minKindSize), p2 = spectralPartition(blockMatrixOf(selfTest.permute("columns", seed + 1001 + 2 * b), { ...common, groups: [g] }), o.minKindSize);
          nullAri.push(Math.abs(adjustedRand(p1, p2)));
        }
        out[g] = { ariP05: quantile(ari, 0.05), ariMedian: median(ari), nullBarP95: quantile(nullAri, 0.95), stable: quantile(ari, 0.05) > quantile(nullAri, 0.95), B };
      }
      return out;
    },
    /** S4: recompute with each branch (or lineage) removed; the flip table is returned whole. */
    leaveOut: ({ by = "branch", overrides = {} } = {}) => {
      const key = by === "lineage" ? "lineage" : "branch";
      const labelFor = (p) => String(key === "lineage" ? (common.lineageOf ? lookup(common.lineageOf, p.id) : (labelOf(p, "lineage") ?? labelOf(p, "family"))) : (common.branchOf ? lookup(common.branchOf, p.id) : (labelOf(p, "branch") ?? labelOf(p, "family"))));
      const folds = [...new Set(profiles.map(labelFor))].sort();
      return folds.map((f) => { const rest = profiles.filter((p) => labelFor(p) !== f); return { heldOut: f, n: rest.length, result: rest.length >= 4 ? rerun(rest, overrides) : null }; });
    },
  };
  return { schema: "BarkerMetastructure@1", kinds, refused, kindOfSystem, arches, archDetail, groups: groupRecords, agreement, gaps, provenance, selfTest, standing: "nomination", trust: archonStanding().trust };
}

/** The handle table row (README "Handles", Amendment XVII) and a description of what this organ is and is not. */
export const HANDLE = freeze({
  file: "organs/barker.js", handle: "Barker", amendment: "XVII", trust: "checked",
  after: "Cory David Barker (Archdisciplinary Research Center): what persists across unification metatheories, here put to measured systems and to the map itself",
  oneLine: "The arch: induces kinds of systems and candidate arches from measured profiles, tests them on held-out systems and families, and applies the same test to its own map. Coordinated, never outside.",
  readmeRow: "| `organs/barker.js` | Barker | The arch: induces kinds of systems and candidate arches from measured profiles, tests them on held-out systems and families, and applies the same test to its own map. Coordinated, never outside. |",
  is: "a calibrated instrument: block-preserving nulls, a search-aware ceiling over a menu of inducers, a kind-versus-gradient test, a persistence rule over lineages, and verdict functions that can fail",
  isNot: "a finding about languages, code or notation, a source of universals, or a judge of EO: its outputs are claims about the systems measured, in the units of the statistic, relative to a registered smallest effect of interest",
  standing: "nomination (checked): it may be consulted and may not speak unprompted until its own eight tests pass",
});
