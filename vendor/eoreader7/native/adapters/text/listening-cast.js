// listening-cast.js — beings found the way a person finds them: by LISTENING,
// one sentence at a time, with nothing from the future.
//
// The rules this obeys (READING-POLICY P1/P2/P4/P6.1/A11, READING-SPEC S3 S5 S9
// S10 S11 S15 S16 S81 S92 S137, LEVELS "heard rule"):
//
//  CAUSAL, STREAMING   `add(sentence)` folds ONE sentence into a ledger and
//                      never re-reads the past (A11). `beings()` is a pure
//                      function of the prefix read so far: the answer after k
//                      sentences equals the answer at step k of a longer read
//                      (S3 — a whole-text statistic is lookahead).
//  PER SENTENCE        the language of each sentence is whatever the injected
//                      `hear(sentence)` says it is NOW, from the prefix (S92).
//                      A sentence in a language with no received grammar is a
//                      typed gap (`language_unheard`), never a guess; a mixed
//                      document keeps one ledger per language.
//  IDENTITY ≠ PRESENCE The ledger (arrivals, per-occurrence evidence) is
//                      undecayed — identity does not fade (P1, S15). PRESENCE is
//                      the kernel's `createActivation`: every mention re-fires a
//                      decaying trace, and `presence` is how present a being is
//                      NOW. The window is MEASURED by `dmdWindow` at dyadic
//                      checkpoints (S5); the whole set is never a candidate
//                      depth, and when no shallower depth reproduces the
//                      conclusion the gap `reach_exceeds_candidates` is
//                      reported and the ladder's top is labelled a CEILING,
//                      never "measured" (S81). Presence never admits a being.
//  EVIDENCE PER        a being's evidence is a list of occurrences (sentence,
//   OCCURRENCE         class basis), not a `Map<surface,count>` (S11).
//  PRIORS REFUSE,      the POS prior (and, for an unseen word, the frame prior)
//   NEVER ADMIT        may REFUSE a form it SETTLES as unable to name a being
//                      (a verb, a particle); an unsettled form is KEPT and
//                      flagged `class_unsettled` (S6 S9 S95 S137).
//  STANDING IS EARNED  two arrivals is the structural minimum for nomination
//                      (S16: "one observation is not a distribution"). Standing
//                      is the exact one-sided binomial tail of the arrivals
//                      against the RECEIVED corpus's own rate for the word, at
//                      the declared 5% (keyness.js — the instrument the
//                      lowercase lane already uses). A language whose prior
//                      carries no token count has no baseline: that language
//                      admits nothing and says `no_baseline` (S137).
//  CAPITALS ARE ONE    this tier never reads case. The capital tier
//   WITNESS            (surfaces.js) is a separate, untouched witness; the two
//                      are unioned by the caller, counted once.
//
// PURE. Priors, ears and the language listener are the caller's.

import { createActivation, dmdWindow, gammaFor } from "../../kernel/activation.js";
import { isKeyInMaterial, receivedRate, logBinomialUpperTail, KEY_ALPHA } from "./keyness.js";
import { classAt } from "./heard-nominals.js";
import { wordFloor } from "./script-floor.js";

export const ARRIVALS_FLOOR = 2; // the structural minimum (S16), not a dial

const UNIT = /[\p{L}\p{M}\p{N}'’]+|[^\s\p{L}\p{M}\p{N}]/gu;
const WORDISH = /^[\p{L}\p{M}\p{N}'’]+$/u;
const NUMERIC = /^[\p{N}'’]+$/u;
const LOCATOR = /\b(?:https?|ftp):\/\/\S+|\bwww\.\S+|\S+@\S+\.\S+/giu;
const NAMING = new Set(["NOUN", "PROPN"]);
const MIN_SHARE = 0.5; // GRAMMAR_MIN_SHARE, the repo's one declared settledness cut
const isReduplication = (w) => { const cs = [...w]; return cs.length >= 4 && new Set(cs).size <= 2; };
const total = (m) => Object.values(m).reduce((a, b) => a + b, 0);
const namingMass = (dist) => (dist.NOUN ?? 0) + (dist.PROPN ?? 0);

/** The class a distribution SETTLES on, or null when no class reaches MIN_SHARE. */
const settledClass = (dist) => {
  if (!dist) return null;
  const [c, p] = Object.entries(dist).sort((a, b) => b[1] - a[1])[0] ?? [];
  return p >= MIN_SHARE ? c : null;
};

const dyadic = (n) => { const out = []; for (let d = 2; d < n; d *= 2) out.push(d); return out; };

/**
 * createListeningCast({ hear, rateOf, commonNouns })
 *
 * `hear(text)` → { language, grammar:{posPrior, framePrior}, ear:{segment,peel}, gap? } for
 *   THIS sentence (the language listener's current verdict from the prefix), or
 *   { language:null, gap } when it cannot yet say.
 * `rateOf(language, form)` — optional override of the received rate (a control:
 *   a deranged baseline must make the gate admit what it should refuse).
 * `commonNouns` — false where capitals already name the cast (cased scripts):
 *   settled common nouns are the descriptor tier's, not this one's.
 * DEFAULTS are the design the beings ladder measured best (eval/beings-ladder.mjs, DEV and a fresh 20% tail of the training treebanks, 25 stems:
 * mean PROPN F1 +0.077 over the original, 23 stems up, none down): standing "names-exempt", refusal "loss-bounded". The original design is ORIGINAL.
 * `standing` — what the keyness test is FOR.
 *     "gate"      (the original) a being exists only if its arrivals are key against the
 *                 received baseline. Measured to add nothing over the prior's own refusals
 *                 (eval/competence CARD RC1) and to drop true recurring names that the
 *                 language also says often.
 *     "salience"  EXISTENCE is nomination at the structural floor, not refused; the keyness
 *                 test is reported on each being (`standing`: "keyed" | "recurring", and
 *                 `salience`, the surprisal of its arrivals against the received rate) and
 *                 is never a membership test. A language with no baseline still has beings;
 *                 its salience is a typed gap.
 *     "descriptors" the keyness test keeps the job keyness.js was written for: a recurring
 *                 DESCRIPTOR (a word the prior settles as a common noun, "the maid") earns its
 *                 place by being said more here than the language says it; a name or an unseen
 *                 word exists at the structural floor and its salience is only reported. Measured:
 *                 as a test on names the gate ranks them near chance (a name the language also
 *                 says often is not less of a being), while on descriptors it is the only
 *                 separator a caseless script has between a character and the furniture.
 *     "names-exempt" the same idea, drawn where the prior's own evidence draws it: a word is
 *                 exempt from earning standing only if the prior NOMINATES it as a name — it has
 *                 never met the word, or its tally says PROPN (or X, a transliterated name) at
 *                 MIN_SHARE. Any other word the prior has met is a descriptor or furniture and
 *                 must be KEY against the received rate.
 * `refusal` — when the grammar may REFUSE a word it has not met.
 *     "plurality"    (the original) refuse when the class its frame implies is a
 *                    non-naming class holding at least MIN_SHARE.
 *     "loss-bounded" refuse an UNSEEN word only when the NAMING mass of its frame
 *                    distribution is below the language's REFUSAL FLOOR (RefusalFloor@1,
 *                    scripts/build-refusal-floor.mjs: the mass below which only KEY_ALPHA of the
 *                    true naming occurrences the prior had not met fall, measured on held-out
 *                    folds of its own treebank). A language with no floor file falls back to
 *                    KEY_ALPHA itself, which meets the bound by refusing almost nothing, and says
 *                    so (`no_refusal_calibration`). A word the prior HAS seen keeps the
 *                    type-level rule (its tally is evidence, not a frame).
 */
/** The design this tier was first built with, for instruments that measure THAT design (eval/competence r3 r5 run, reading-helps-falsify). */
export const ORIGINAL = Object.freeze({ standing: "gate", refusal: "plurality" });

export function createListeningCast({ hear, rateOf = null, commonNouns = true, standing = "names-exempt", refusal = "loss-bounded", graded: trackGraded = false } = {}) {
  if (!["gate", "salience", "descriptors", "names-exempt"].includes(standing)) throw new TypeError(`createListeningCast: standing must be "gate", "salience", "descriptors" or "names-exempt", got ${standing}`);
  if (refusal !== "plurality" && refusal !== "loss-bounded") throw new TypeError(`createListeningCast: refusal must be "plurality" or "loss-bounded", got ${refusal}`);
  if (typeof hear !== "function") throw new TypeError("createListeningCast: hear(sentence) is the language leg — required");
  const states = new Map(); // language -> state
  const gaps = { language_unheard: 0 };
  let read = 0;

  const stateFor = (language, grammar) => {
    let st = states.get(language);
    if (st) return st;
    const baseline = grammar.posPrior?.provenance?.tokens_read > 0 ? receivedRate(grammar.posPrior) : null;
    st = {
      language, grammar, tokens: 0, sentences: 0,
      counts: new Map(),       // every word unit above the length floor -> arrivals (the unfiltered control)
      forms: new Map(),        // form -> { arrivals, sents:Set, occ:[{si,basis}], unsettled, lastSeen, refires }
      refused: new Map(),      // reason -> count
      obs: [],                 // per-sentence arrays of admitted-candidate forms (the presence observations)
      activation: null, window: undefined, windowBasis: "unread_extent", windowGap: "unread_extent", checkpoint: 0,
      baseline,
    };
    states.set(language, st);
    return st;
  };

  const rebuildPresence = (st) => {
    const w = Number.isFinite(st.window) && st.window > 1 ? st.window : null;
    st.activation = createActivation({ window: w });
    for (const keys of st.obs) st.activation.observe(keys);
  };

  // The window is MEASURED at dyadic checkpoints, from the prefix only.
  const deriveCast = (obs) => {
    const c = new Map();
    for (const keys of obs) for (const k of new Set(keys)) c.set(k, (c.get(k) ?? 0) + 1);
    return [...c].filter(([, n]) => n >= ARRIVALS_FLOOR).map(([k]) => k).sort();
  };
  const measureWindow = (st) => {
    const n = st.obs.length;
    const candidates = dyadic(n);
    if (!candidates.length) { st.windowGap = "unread_extent"; return; }
    const m = dmdWindow(st.obs, deriveCast, { candidates });
    if (m.window != null) { st.window = m.window; st.windowBasis = "measured: difference-that-makes-a-difference"; st.windowGap = null; }
    else { st.window = candidates[candidates.length - 1]; st.windowBasis = "ceiling: reach_exceeds_candidates — the ladder's top, not a measurement"; st.windowGap = "reach_exceeds_candidates"; }
    rebuildPresence(st);
  };

  const add = (sentence) => {
    const si = read++;
    const text = String(sentence?.text ?? sentence ?? "").toLowerCase().replace(LOCATOR, " ");
    const ctx = hear(text, si);
    if (!ctx?.language || !ctx.grammar?.posPrior?.forms) { gaps.language_unheard += 1; return; }
    const st = stateFor(ctx.language, ctx.grammar);
    const { posPrior, framePrior } = ctx.grammar;
    let t = text;
    if (ctx.ear?.segment) t = ctx.ear.segment(t);
    if (ctx.ear?.peel) t = ctx.ear.peel(t);
    const units = t.match(UNIT) ?? [];
    st.sentences += 1;
    const here = [];
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (!WORDISH.test(u)) continue;
      st.tokens += 1; // the material's own size, for the baseline test
      if (u.length < wordFloor(u, 3) || NUMERIC.test(u)) continue;
      st.counts.set(u, (st.counts.get(u) ?? 0) + 1);
      if (isReduplication(u)) { st.refused.set("reduplication", (st.refused.get("reduplication") ?? 0) + 1); continue; }
      const { dist, basis } = classAt(u, units[i - 1], units[i + 1], { posPrior, framePrior, minShare: MIN_SHARE });
      if (trackGraded) {
        // GRADED mode keeps EVERY candidate with its evidence, refused or not: nothing is cut here, each rule's evidence is a number in [0, 1].
        st.cand ??= new Map();
        let c = st.cand.get(u);
        if (!c) { c = { n: 0, name: 0, proper: 0, blank: 0 }; st.cand.set(u, c); }
        c.n += 1;
        if (dist) { c.name += namingMass(dist); c.proper += (dist.PROPN ?? 0) + (dist.X ?? 0); } else c.blank += 1;
      }
      const settled = settledClass(dist);
      // a prior REFUSES a form it settles as unable to name a being — and only that
      const refuses = refusal === "loss-bounded" && basis.startsWith("unseen")
        ? dist != null && namingMass(dist) < (ctx.grammar.refusalFloor?.floor ?? KEY_ALPHA)
        : Boolean(settled) && !NAMING.has(settled);
      if (refuses) { st.refused.set("settled_non_nominal", (st.refused.get("settled_non_nominal") ?? 0) + 1); continue; }
      let f = st.forms.get(u);
      if (!f) { f = { arrivals: 0, sents: new Set(), occ: [], unsettled: 0, lastSeen: -1, refires: 0 }; st.forms.set(u, f); }
      f.arrivals += 1; f.sents.add(si);
      f.occ.push({ si, basis: basis.split("|")[0], settled: Boolean(settled) });
      if (!settled) f.unsettled += 1;
      // a RE-FIRE: the trace was still present when the word came again
      if (f.lastSeen >= 0 && Number.isFinite(st.window) && si - f.lastSeen <= st.window) f.refires += 1;
      f.lastSeen = si;
      here.push(u);
    }
    st.obs.push(here);
    if (!st.activation) rebuildPresence(st);
    st.activation.observe(here);
    // dyadic checkpoint: measure the reach of what has been read so far, from the prefix only
    if (st.obs.length >= 4 && (st.obs.length & (st.obs.length - 1)) === 0 && st.obs.length !== st.checkpoint) { st.checkpoint = st.obs.length; measureWindow(st); }
  };

  /** Does the prior itself nominate `w` as a name? It has never met it, or its tally is PROPN / X (a transliterated name) at MIN_SHARE. */
  const nominatedAsName = (posPrior, w) => { const c = posPrior.forms[w]; if (!c) return true; const t = total(c); return t > 0 && ((c.PROPN ?? 0) + (c.X ?? 0)) / t >= MIN_SHARE; };
  const isCommon = (posPrior, w) => { const c = posPrior.forms[w]; if (!c) return false; const t = total(c); return t >= 3 && (c.NOUN ?? 0) / t >= 0.7; };

  /** The beings the prefix has earned: nominated at the structural floor and not refused; whether each is KEY against the received baseline is its salience, and a membership test only under standing "gate". */
  const beings = () => {
    const out = [];
    for (const st of states.values()) {
      const rate = rateOf ? (f) => rateOf(st.language, f) : st.baseline;
      if (!rate && standing === "gate") continue; // no baseline: nothing to earn standing against — typed in gaps()
      for (const [form, f] of st.forms) {
        if (f.arrivals < ARRIVALS_FLOOR) continue;
        if (!commonNouns && isCommon(st.grammar.posPrior, form)) continue;
        const p0 = rate ? rate(form) : null;
        const keyed = rate ? isKeyInMaterial(f.arrivals, st.tokens, p0, { alpha: KEY_ALPHA }) : false;
        if (standing === "gate" && !keyed) continue;
        if (standing === "descriptors" && !keyed && isCommon(st.grammar.posPrior, form)) continue; // a descriptor earns its place; a name does not have to
        if (standing === "names-exempt" && !keyed && !nominatedAsName(st.grammar.posPrior, form)) continue;
        out.push({
          surface: form, mentions: f.arrivals, sentences: f.sents.size, language: st.language,
          lane: "heard-nominal", standing: keyed ? "keyed" : "recurring", alpha: KEY_ALPHA,
          salience: rate && p0 > 0 && f.arrivals > st.tokens * p0 ? Number((-logBinomialUpperTail(f.arrivals, st.tokens, p0)).toFixed(3)) : rate ? 0 : null,
          unseen: st.grammar.posPrior.forms[form] ? 0 : f.arrivals,
          presence: st.activation ? Number(st.activation.activationOf(form).toFixed(4)) : null,
          refires: f.refires,
          gaps: [...(f.unsettled ? ["class_unsettled"] : []), ...(rate ? [] : ["no_baseline"])],
          evidence: f.occ,
        });
      }
    }
    return out.sort((a, b) => b.mentions - a.mentions);
  };

  /**
   * GRADED READING (docs: eval/beings-graded.mjs pre-registration). Every rule is a number in [0, 1] per candidate instead of a cut, and each rule
   * is turned on to the degree that it makes a difference:
   *   evidence  class   mean NOUN+PROPN mass of the form's occurrences (the grammar says nominal)         — replaces refusal
   *             proper  mean PROPN+X mass (the grammar says name, not common noun)                           — replaces the names-exempt cut
   *             key     1 - the exact binomial tail of its arrivals against the received rate               — replaces the standing gate
   *             recur   its arrivals' mid-rank percentile among this material's candidates                   — replaces the 2-arrivals floor
   *   DMD of a rule  the conclusion is the set of candidates whose BORN mass (p = m^2 / sum m^2, m the equal-weight mean evidence) exceeds the
   *             uniform share 1/N; the rule's DMD is 1 - Jaccard(conclusion, conclusion with the rule's evidence dropped). Label-free, from the prefix.
   *   weights   w_k = D_k^2 / sum D^2 (the Born map over rules); all D_k = 0 falls back to equal weights (the declared bootstrap).
   *   mass      m_i = sum_k w_k e_ki. `weights`: "dmd" (default), "equal", "deranged" (the DMD weights rotated onto the wrong rules: a control built
   *             to fail), or an array of K weights. Returns candidates sorted by mass, per language.
   * Requires createListeningCast({ graded: true }). A pure function of the prefix; nothing is refused and no count is a floor.
   */
  const RULES = ["class", "proper", "key", "recur"];
  const graded = ({ weights = "dmd" } = {}) => {
    if (!trackGraded) throw new Error("graded(): create the cast with { graded: true }");
    const out = [];
    for (const st of states.values()) {
      if (!st.cand?.size) continue;
      const rate = rateOf ? (f) => rateOf(st.language, f) : st.baseline;
      const forms = [...st.cand.keys()], N = forms.length;
      const arr = forms.map((f) => st.cand.get(f).n);
      const sorted = arr.slice().sort((a, b) => a - b);
      const lower = (x) => { let lo = 0, hi = N; while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] < x) lo = m + 1; else hi = m; } return lo; };
      const upper = (x) => { let lo = 0, hi = N; while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] <= x) lo = m + 1; else hi = m; } return lo; };
      const E = RULES.map(() => new Float64Array(N));
      forms.forEach((f, i) => {
        const c = st.cand.get(f), seen = c.n - c.blank;
        E[0][i] = seen > 0 ? c.name / seen : 0.5;
        E[1][i] = seen > 0 ? c.proper / seen : 0.5;
        E[2][i] = rate ? 1 - Math.exp(logBinomialUpperTail(c.n, st.tokens, rate(f))) : 0.5;
        E[3][i] = (lower(c.n) + upper(c.n)) / 2 / N;
      });
      const K = RULES.length;
      const conclusion = (skip) => {
        const m = new Float64Array(N); let sq = 0;
        for (let i = 0; i < N; i++) { let v = 0, n = 0; for (let k = 0; k < K; k++) if (k !== skip) { v += E[k][i]; n += 1; } m[i] = v / n; sq += m[i] * m[i]; }
        const set = new Set(); for (let i = 0; i < N; i++) if (sq > 0 && (m[i] * m[i]) / sq > 1 / N) set.add(i);
        return set;
      };
      const ref = conclusion(-1);
      const dmd = RULES.map((_, k) => { const s2 = conclusion(k); let inter = 0; for (const i of ref) if (s2.has(i)) inter += 1; const uni = ref.size + s2.size - inter; return uni ? 1 - inter / uni : 0; });
      const sq = dmd.reduce((a, d) => a + d * d, 0);
      const born = dmd.map((d) => (sq > 0 ? (d * d) / sq : 1 / K));
      const w = Array.isArray(weights) ? weights : weights === "equal" ? born.map(() => 1 / K) : weights === "deranged" ? born.map((_, k) => born[(k + 1) % K]) : born;
      const res = forms.map((f, i) => { let m = 0; for (let k = 0; k < K; k++) m += w[k] * E[k][i]; return { surface: f, arrivals: arr[i], mass: m, evidence: RULES.map((_, k) => E[k][i]), language: st.language }; });
      res.sort((a, b) => b.mass - a.mass || b.arrivals - a.arrivals || (a.surface < b.surface ? -1 : 1));
      out.push({ language: st.language, candidates: res, rules: RULES, dmd, weights: w, bornWeights: born, tokens: st.tokens });
    }
    return out;
  };

  /** CONTROLS (not part of reading): every nominated form with its arrivals, standing NOT applied — isolates what the standing test adds. */
  const nominated = () => {
    const out = [];
    for (const st of states.values()) for (const [form, f] of st.forms) if (f.arrivals >= ARRIVALS_FLOOR) out.push({ surface: form, mentions: f.arrivals, language: st.language });
    return out.sort((a, b) => b.mentions - a.mentions);
  };
  /** CONTROLS: raw token frequency, no prior at all. */
  const rawTop = () => {
    const out = [];
    for (const st of states.values()) for (const [form, n] of st.counts) if (n >= ARRIVALS_FLOOR) out.push({ surface: form, mentions: n, language: st.language });
    return out.sort((a, b) => b.mentions - a.mentions);
  };

  /** Typed gaps with denominators: reached-and-undecided is not never-read (S22). */
  const report = () => ({
    sentencesRead: read,
    languageUnheard: gaps.language_unheard,
    languages: [...states.values()].map((st) => ({
      language: st.language, sentences: st.sentences, tokens: st.tokens, alpha: KEY_ALPHA, fold_unit: "sentence",
      window: st.window ?? null, windowBasis: st.windowBasis, windowGap: st.windowGap,
      standing, refusal,
      refusalFloor: refusal === "loss-bounded" ? (st.grammar.refusalFloor?.floor ?? null) : null,
      gaps: [...(st.baseline || rateOf ? [] : ["no_baseline"]), ...(refusal === "loss-bounded" && !st.grammar.refusalFloor ? ["no_refusal_calibration"] : [])],
      gap: st.baseline || rateOf ? null : "no_baseline", refused: Object.fromEntries(st.refused),
    })),
  });

  return { add, beings, graded, nominated, rawTop, report, get read() { return read; }, presenceOf: (language, form) => states.get(language)?.activation?.activationOf(form) ?? 0 };
}

export { gammaFor };
