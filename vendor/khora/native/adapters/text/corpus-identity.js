// corpus-identity.js — WHO IS THE SAME BEING ACROSS SOURCES: the holographic identity test, for a corpus of readings.
//
// A shared name only NOMINATES a pair. Whether two referents in two sources are one being is decided the way the fold decides identity
// everywhere (kernel/identity-induction.js, the user's definition): they are the same thing, FOR SOMEONE, if the universe folded on them
// is the same — bounded by a difference that makes a difference — and the impact on the nodes around them, counterfactually changed, is
// greater than the same perturbations of other things by chance. Four tests, each against a null the material itself supplies. A pair that
// is not read enough is a typed gap ("not enough reading yet"), never "different" and never "same". Exclusion (kernel/identity-exclusion.js)
// can only AGAINST, and only from a GIVEN one-valued relation on witnessed assertions of both referents. The relations come from Stage@1's license rows
// (kernel/stage.js functionalRegister: Hyperlexicon rows with named givers, a missing or only-nominated row licenses nothing); the assertions come from
// the readings (atom-world.js factsFromReadings). With no facts handed to prepare(), or no licensed relation among them, exclusion is reported as exactly
// that ("no_functional_relation_declared"), never silently skipped.
//
// The record is built from the readings themselves, as the callimachus evals build it (native/eval/callimachus/identity-aliases-r8.mjs):
//   node        a referent (one per source: sources are not merged, so the same name in two sources is two nodes)
//   occurrence  one mention of it; its features are the sentence's other named referents (w:) and the sentence's verbs (v:), hop 1
//
// The numbers are DECLARED here, with their source (the same OPTS the registered identity evals ran under), never tuned to a document.
import { makeIdentityInduction } from "../../kernel/identity-induction.js";
import { makeIdentityExclusion } from "../../kernel/identity-exclusion.js";
import { identityVerdict } from "../../kernel/identity-verdict.js";
import { functionalRegister } from "../../kernel/stage.js";
import { BOUND, CONTRADICTED, BEYOND_REACH } from "../../interpretation/hl.js";

export const IDENTITY_PARAMS = Object.freeze({ draws: 199, alpha: 0.05, seed: 20261014, minOccurrences: 3, resolution: 1, maxHop: 1, smooth: 1, minFeatureCount: 1 });
export const FOR_WHOM = Object.freeze({ question: "who is this?", universeKind: "world", giver: "the reader (a person looking at several sources)" });

// A measure is one-valued per BEING (the license row's own giver: "one value of a measure per being"), so the kind the register is keyed on is the
// universal one, and every referent is one. No kind is invented beyond what the row says; a superlative's holder is keyed on a kind (see stage.js).
export const BEING = "being";

/**
 * @param {{params?: object, hyperlexicon?: object}} [o]  hyperlexicon: the one the license rows are read from (stage.js defaultHyperlexicon when omitted)
 * @returns {{prepare: (record: Map<string, Array<Array<{f:string,hop:number}>>>, facts?: object) => (a:string, b:string, o?: {except?: Set<string>}) => object}}
 *   prepare(record, facts?) once per corpus; judge(a, b, { except }?) per nominated pair → { same, against, verdict, reason, basis, forWhom, exclusion: { …, proof } }
 *   facts (atom-world.js factsFromReadings): { rels, kindsOf(x), assertionsOf(x), sameValue(u, v, rel), witnessed(assertion) } — what exclusion reads.
 *   except: relations the QUESTION rests on (a claim's own predicates): not evidence of which being the claim speaks of, so exclusion does not read them.
 */
export function makeSameBeing({ params = IDENTITY_PARAMS, hyperlexicon = undefined } = {}) {
  return Object.freeze({
    params,
    prepare(record, facts = null) {
      const induction = makeIdentityInduction(record, { ...params, namesNode: (f) => (f.startsWith("w:") ? f.slice(2) : null) });
      const register = facts ? functionalRegister(facts.rels ?? [], { hyperlexicon }) : null;
      // a licensed relation keyed on the being binds every referent; one keyed on a kind binds a slot, never a referent, and convicts none
      const functional = new Map(), perBeing = register ? [...register.licensed].filter(([, d]) => d.key === BEING) : [];
      if (perBeing.length) functional.set(BEING, new Map(perBeing.map(([rel, d]) => [rel, { giver: d.giver }])));
      const exclusion = functional.size ? makeIdentityExclusion({ kindsOf: facts.kindsOf, assertionsOf: facts.assertionsOf, functional, sameValue: facts.sameValue, witnessed: facts.witnessed }) : null;
      const judge = (a, b, { except = null } = {}) => {
        let ind;
        try { ind = induction.judge(a, b); } catch (e) { ind = { a, b, verdict: BEYOND_REACH, reason: `induction_error:${e.message}` }; }
        // exclusion needs a declared kind and a given one-valued relation; with none, the verdict says so
        const exc = exclusion ? exclusion.judge(a, b, { relevant: except?.size ? (rel) => !except.has(rel) : null }) : { a, b, verdict: BEYOND_REACH, reason: "no_functional_relation_declared" };
        const v = identityVerdict(ind, exc, { giver: "corpus-identity", forWhom: FOR_WHOM });
        const same = v.verdict === BOUND, against = v.against, proof = against ? exc.proof : null;
        const reason = against ? `exclusion:${proof?.[0]?.rel ?? exc.by}` : ind.reason ?? v.verdict;
        return { same, against, contested: against && v.for, verdict: v.verdict, reason, induction: v.induction, exclusion: { ...v.exclusion, proof, raised: exc.raised ?? [] }, forWhom: FOR_WHOM,
          basis: against ? `a declared one-valued relation conflicts on witnessed assertions: ${proof.map((c) => `${c.rel} (giver: ${c.giver})`).join("; ")}${v.for ? " — the fold alone would have joined them, and no amount of co-presence outvotes a counterexample" : ""}`
            : same ? "the universe folded on each matches, the counterfactual weight is real, and the consequence aligns beyond chance (identity-induction), nothing declared against"
            : `not joined: ${reason}${/min|occurrence|enough|typed_gap/i.test(String(reason)) ? " — not enough reading yet, which is a gap and never a verdict of difference" : ""}` };
      };
      return judge;
    },
  });
}
