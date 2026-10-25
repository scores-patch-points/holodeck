// organs/lexicon.js — THE HYPERLEXICON, OPEN TO EVERY ORGAN THAT READS (2026-10-24; moved here from the Holodeck's reading/lexicon.js).
//
// An organ asks only about a form it is unsure of: a form the language's own priors cannot settle. It never pre-loads. Every answer
// is cached and kept as a WITNESS under its giver, never as a licence (janus's hyperlexicon ledger is where a licence is decided).
// The giver is handed in: under Node, adapters/text/wiktionary-pack.js reads the local English Wiktionary pack; a page asks its own
// server for the same pack. Nothing here reaches the network.
//
//   makeLexicon({ ask, lang })    ask(forms, lang) → Promise<{ giver, results: { [form]: null | [{ w, pos, senses: [{ of, tags, gloss }] }] } }>
//     .want(forms)                ask once for every form not yet asked; resolves when the answers are cached
//     .get(form)                  the cached entries, null when the giver does not list the form, undefined when never asked
//     .aliasOf(form)              the forms this one is listed as a form of ("Messrs." → ["Mr.", "M."]), [] when none
//     .giver · .log               who answered, and every call made (forms, answered, ms, gap)
//
//   aliasJunctions(text, known)   the places a sentence could be cut after "<letters>." before a capital, where the token is not
//                                 already known: the forms the splitter is unsure of, written with their period
//   aliasTokens(lexicon, forms)   of those, the tokens (without the period) the giver lists as a form of another word — an ALIAS
//   resolveAliases(lexicon, junctions, text)
//                                 the decision per listed form: kept when the text never writes the token without its period
//
// An abbreviation is not a category here. It is an alias the hyperlexicon resolves, the same relation as any other form-of: the
// period then belongs to the word, so no sentence ends inside it.

export function makeLexicon({ ask, lang = "en" } = {}) {
  const cache = new Map();
  const log = [];
  let giver = null;
  const key = (f) => String(f ?? "").normalize("NFC");
  async function want(forms) {
    const todo = [...new Set([...forms].map(key))].filter((f) => f && !cache.has(f));
    if (!todo.length || typeof ask !== "function") return;
    const t0 = Date.now();
    for (let i = 0; i < todo.length; i += 400) {
      const batch = todo.slice(i, i + 400);
      let res = null;
      try { res = await ask(batch, lang); } catch { res = null; }
      if (!res || !res.results) { log.push({ forms: batch.length, answered: 0, ms: Date.now() - t0, gap: res?.gap ?? "no local lexicon answered" }); return; }
      giver = giver ?? res.giver ?? null;
      let answered = 0;
      for (const f of batch) { const v = res.results[f]; cache.set(f, Array.isArray(v) && v.length ? v : null); if (Array.isArray(v) && v.length) answered++; }
      log.push({ forms: batch.length, answered, ms: Date.now() - t0 });
    }
  }
  const get = (form) => cache.get(key(form));
  const aliasOf = (form) => {
    const e = get(form);
    if (!e) return [];
    return [...new Set(e.flatMap((x) => (x.senses ?? []).map((s) => s.of).filter(Boolean)))];
  };
  return { want, get, aliasOf, get giver() { return giver; }, log, cache, lang };
}

// "<letters>." followed by white space and a capital: a place a sentence could end, or an alias could continue.
const JUNCTION = /(?<![\p{L}\p{N}.])(\p{L}+)\.(?=\s+\p{Lu})/gu;

/** The forms (with their period) at which the splitter is unsure: the token is not in `known` (lower case, no period). */
export function aliasJunctions(text, known = new Set()) {
  const out = new Map();
  for (const m of String(text ?? "").matchAll(JUNCTION)) {
    const tok = m[1];
    if (known.has(tok.toLowerCase())) continue;
    const form = `${tok}.`;
    out.set(form, (out.get(form) ?? 0) + 1);
  }
  return out; // form → how many junctions it stands at
}

/** The tokens (no period) whose dotted form the giver lists as a form of another word. */
export function aliasTokens(lexicon, forms) {
  const out = new Map();
  for (const form of forms) {
    const of = lexicon.aliasOf(form);
    if (of.length) out.set(form.slice(0, -1), of);
  }
  return out; // token → the forms it is an alias of
}

/** The alias decision for one text. A dotted form is kept as one word when the giver lists it as a form of another word AND the
 *  text never writes the token without its period — the text's own evidence that the token is not an ordinary word here ("in." is
 *  listed as a form of "inch", but "He came in." ends a sentence in a text that writes "in" everywhere else).
 *  junctions: aliasJunctions(text, known). Returns one row per listed form: { form, of, n, kept, why }. */
export function resolveAliases(lexicon, junctions, text) {
  const t = String(text ?? "");
  return [...aliasTokens(lexicon, junctions.keys())].map(([tok, of]) => {
    const n = junctions.get(`${tok}.`) ?? 0;
    const bare = new RegExp(`(?<![\\p{L}\\p{N}])${tok}(?![\\p{L}\\p{N}.])`, "u").test(t);
    return bare ? { form: `${tok}.`, of, n, kept: false, why: `“${tok}” also stands without its period in this text` } : { form: `${tok}.`, of, n, kept: true };
  });
}
