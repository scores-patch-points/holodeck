// corpus-identity.js — WHO IS THE SAME BEING ACROSS SOURCES: the holographic identity test, for a corpus of readings.
//
// A shared name only NOMINATES a pair. Whether two referents in two sources are one being is decided the way the fold decides identity
// everywhere (kernel/identity-induction.js, the user's definition): they are the same thing, FOR SOMEONE, if the universe folded on them
// is the same — bounded by a difference that makes a difference — and the impact on the nodes around them, counterfactually changed, is
// greater than the same perturbations of other things by chance. Four tests, each against a null the material itself supplies. A pair that
// is not read enough is a typed gap ("not enough reading yet"), never "different" and never "same". Exclusion (kernel/identity-exclusion.js)
// can only AGAINST; with no kind or functional relation declared it is reported as exactly that, never silently skipped.
//
// The record is built from the readings themselves, as the callimachus evals build it (native/eval/callimachus/identity-aliases-r8.mjs):
//   node        a referent (one per source: sources are not merged, so the same name in two sources is two nodes)
//   occurrence  one mention of it; its features are the sentence's other named referents (w:) and the sentence's verbs (v:), hop 1
//
// The numbers are DECLARED here, with their source (the same OPTS the registered identity evals ran under), never tuned to a document.
import { makeIdentityInduction } from "../../kernel/identity-induction.js";
import { identityVerdict } from "../../kernel/identity-verdict.js";
import { BOUND, CONTRADICTED, BEYOND_REACH } from "../../interpretation/hl.js";

export const IDENTITY_PARAMS = Object.freeze({ draws: 199, alpha: 0.05, seed: 20261014, minOccurrences: 3, resolution: 1, maxHop: 1, smooth: 1, minFeatureCount: 1 });
export const FOR_WHOM = Object.freeze({ question: "who is this?", universeKind: "world", giver: "the reader (a person looking at several sources)" });

/**
 * @param {{params?: object}} [o]
 * @returns {{prepare: (record: Map<string, Array<Array<{f:string,hop:number}>>>) => (a:string, b:string) => object}}
 *   prepare(record) once per corpus; judge(a, b) per nominated pair → { same, verdict, reason, basis, forWhom }
 */
export function makeSameBeing({ params = IDENTITY_PARAMS } = {}) {
  return Object.freeze({
    params,
    prepare(record) {
      const induction = makeIdentityInduction(record, { ...params, namesNode: (f) => (f.startsWith("w:") ? f.slice(2) : null) });
      return (a, b) => {
        let ind;
        try { ind = induction.judge(a, b); } catch (e) { ind = { a, b, verdict: BEYOND_REACH, reason: `induction_error:${e.message}` }; }
        // exclusion needs a declared kind and a given one-valued relation; none is declared here, and the verdict says so
        const exc = { a, b, verdict: BEYOND_REACH, reason: "no_functional_relation_declared" };
        const v = identityVerdict(ind, exc, { giver: "corpus-identity", forWhom: FOR_WHOM });
        const same = v.verdict === BOUND;
        const reason = ind.reason ?? v.verdict;
        return { same, against: v.verdict === CONTRADICTED, verdict: v.verdict, reason, induction: v.induction, exclusion: v.exclusion, forWhom: FOR_WHOM,
          basis: same ? "the universe folded on each matches, the counterfactual weight is real, and the consequence aligns beyond chance (identity-induction), nothing declared against"
            : `not joined: ${reason}${/min|occurrence|enough|typed_gap/i.test(String(reason)) ? " — not enough reading yet, which is a gap and never a verdict of difference" : ""}` };
      };
    },
  });
}
