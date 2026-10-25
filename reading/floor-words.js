// floor-words.js — the ladder's verdicts in a reader's words, shared by the
// floor page (reading/index.html) and the Floors view of the layered
// instrument (reading/demo.html). The scorer (vendor/khora/native/the-fold/
// mhc.js, applied to the floor table in reading/mhc-ladder.js) names a status
// and a reason; these say the same thing in a sentence, never more.

/** mhc.js's refusal reasons, as the page says them. */
export const REFUSAL_WORD = {
  organ_unreachable: 'unmeasured — could not run',
  unlicensed_perturbation: 'unmeasured — a control arm tested nothing',
  lower_order_suffices: 'refused — the floor below did it alone',
  arbitrary_coordination: 'refused — an arbitrary re-coordination did it too',
  indiscriminate: 'refused — it also succeeded on the control',
  constituent_missing: 'refused — axiom 1: constituent missing',
};

/** One item's verdict, in a phrase. An unreachable organ is told apart from a
 * material that offers no specimen: both are gaps, neither is a failure. */
export function statusWord(item) {
  if (!item) return 'no item declared';
  if (item.status === 'passed') return 'passed';
  if (item.status === 'failed') return 'failed — a real ceiling';
  const d = String(item.detail || '');
  if (item.reason === 'organ_unreachable' && /this material offers no/.test(d)) return 'unmeasured — no specimen in this material';
  if (item.reason === 'organ_unreachable' && /no organ on this page/.test(d)) return 'unmeasured — no organ on this page';
  return REFUSAL_WORD[item.reason] || item.status;
}

/** The scorer names the first arm it gated; what the reader needs is the gap itself. */
export const cleanDetail = (d) => String(d || '').replace(/^\w+ arm could not run: /, '');

/** The three control arms, in the order mhc.js runs them: what each withholds, and whose rule it is. */
export const ARM_ROWS = [
  ['lowerOrder', 'the floor below, alone', 'axiom 3 — Commons'],
  ['arbitrary', 'the same parts, arbitrarily re-coordinated', 'axiom 3 — Commons'],
  ['discrimination', 'material that does not support it', 'this battery’s control, not Commons'],
];

/** One arm's outcome → { res, cls, draws }: the phrase, a class the page colours
 * by (ok · bad · warn · ''), and the draw count where the arm was drawn. */
export function armOutcome(a) {
  if (!a) return { res: 'not run — stopped at an earlier arm', cls: '', draws: '' };
  const draws = a.draws > 1 ? ` · ${a.fired} of ${a.draws} draws` : '';
  if (a.unreachable) return { res: 'could not run', cls: 'warn', draws };
  if (!a.perturbed) return { res: 'tested nothing (A10)', cls: 'warn', draws };
  if (a.completed) return { res: 'accomplished it — the axiom fails', cls: 'bad', draws };
  return { res: 'did not — holds', cls: 'ok', draws };
}
