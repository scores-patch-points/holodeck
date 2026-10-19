// holodeck-surface.js — the one hop the vendored classifyWord does not take: a form missing from the
// class prior whose ACT is in it ("condemned" → "condemn"). The written-form normalisation (curly
// apostrophe, the sentence's own punctuation) lives upstream in khora's wordclass.js and arrives
// through the vendored copy, so every consumer inherits it. This wrapper adds the lemma hop, which
// is an inference rather than a typing difference — it is carried as `inferred` with the act named,
// so no one reads it as attested for the form.
import { classifyWord, normalizeForm } from './vendor/eoreader7/native/adapters/text/wordclass.js';
import { stemsOf } from './vendor/eoreader7/native/adapters/text/morphology.js';

export const normalizeSurface = normalizeForm;

/** classifyWord, then — only on a miss, only with the act in the prior — the lemma hop. */
export function classifyForm(surface, opts = {}) {
  const { lemmatizer = null, ...cls } = opts;
  const c = classifyWord(surface, cls);
  if (c.found) return { ...c, form: c.form ?? surface, via: c.via ?? [] };
  const { form, steps } = normalizeForm(surface);
  const lower = form.toLowerCase();
  const acts = new Set([...(lemmatizer ? lemmatizer.lemmasOf(lower) : []), ...stemsOf(lower)]);
  acts.delete(lower);
  for (const act of acts) {
    const a = classifyWord(act, cls);
    if (a.found) return { ...a, surface, form, via: [...steps, { step: 'lemma', note: `“${form}” is not in the class prior; its act “${act}” is — the class is the act’s, not the form’s` }], inferred: true, act };
  }
  return { ...c, form: surface, via: [] };
}

/** The form to hand a lemmatizer / stemmer: punctuation-free, straight apostrophe. */
export const lookupForm = surface => normalizeForm(surface).form;
