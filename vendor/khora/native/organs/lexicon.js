// organs/lexicon.js — THE HYPERLEXICON, OPEN TO EVERY ORGAN THAT READS (2026-10-24; moved here from the Holodeck's reading/lexicon.js).
//
// An organ asks only about a form it is unsure of: a form the language's own priors cannot settle. It never pre-loads. Every answer
// is cached and kept as a WITNESS under its giver, never as a licence (janus's hyperlexicon ledger is where a licence is decided).
// Two shapes, one interface: makeHyperlexicon asks janus's hyperlexicon through its door (the reader's default under Node,
// native/reading.js), where every giver's claims sit beside the concordance; makeLexicon reads one giver handed in (a page's server,
// or adapters/text/wiktionary-pack.js, a giver read on its own). Nothing here reaches the network; the ask it is handed may.
//
//   makeLexicon({ ask, lang })    ask(forms, lang) → Promise<{ giver, results: { [form]: null | [{ w, pos, senses: [{ of, tags, gloss }] }] } }>
//     .want(forms)                ask once for every form not yet asked; resolves when the answers are cached
//     .get(form)                  the cached entries, null when the giver does not list the form, undefined when never asked
//     .aliasOf(form)              the forms this one is listed as a form of ("Messrs." → ["Mr.", "M."]), [] when none
//     .giver · .log               who answered, and every call made (forms, answered, ms, gap)
//
//   aliasJunctions(text, known)   the places a sentence could be cut after "<letters>." before a capital, where the token is not
//                                 already known: the forms the splitter is unsure of, written with their period
//   aliasTokens(lexicon, forms)   of those, the tokens (without the period) the giver lists as a form of another word, or lists
//                                 as a headword with its period ("U.S.", "e.g.") — an ALIAS
//   dottedIn(text, words, known)  the hyperlexicon's dotted words READ AHEAD (a DottedWords@1 prior, janus priors/dotted-<stem>.json,
//                                 built from the giver): the listed forms this text uses at a place the splitter cuts and never
//                                 writes without the period — synchronous, so a cut with no giver in reach still knows "etc."
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
  // A form another call is already asking is waited on, not asked again. Before 2026-10-25 only an ANSWER was remembered, so a
  // caller cutting many texts at once — the Holodeck re-cutting every source when one answer lands — asked the same forms again
  // and again before the first answer came back (231 requests for the Titanic sample's eleven sources), and the giver's queue
  // held up every reading that waited on it.
  const inFlight = new Map();   // form -> the ask carrying it
  async function want(forms) {
    const all = [...new Set([...forms].map(key))].filter((f) => f && !cache.has(f));
    if (!all.length || typeof ask !== "function") return;
    const waits = new Set(all.filter((f) => inFlight.has(f)).map((f) => inFlight.get(f)));
    const todo = all.filter((f) => !inFlight.has(f));
    if (todo.length) {
      const run = askAll(todo);
      for (const f of todo) inFlight.set(f, run);
      waits.add(run.finally(() => { for (const f of todo) if (inFlight.get(f) === run) inFlight.delete(f); }));
    }
    await Promise.all(waits);
  }
  async function askAll(todo) {
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

/** THE HYPERLEXICON, asked through its door (janus native/organs/hyperlexicon/door.mjs) — janus's ledger, where every giver's claims sit
 *  as unlicensed candidates beside the concordance of every use. The reader asks it, never a giver's pack: `names` for the dotted forms
 *  at its junctions, each answer read AS WRITTEN (the nodes whose own names write the form exactly, case included — the givers' word,
 *  janus DOTTED-PREREG-4.md). The same interface the consult reads as makeLexicon's (want, get, aliasOf, giver, log): a form is asked
 *  once while in flight; the giver is the ledger (its head), learnt from the first answer.
 *  .context(words, { ground, lang }) asks the ledger what it holds of each word (the door's `context`): its uses and documents under
 *  a ground, the dated span, and the givers' candidates in `lang` (kind, pos, of, gloss), each undecided. A word the log never heard
 *  answers with no candidates: experience nominates.
 *  ask(body) posts the door's batch body ({ asks: [...] }) and resolves to its JSON ({ head, answers }); `door` names it in a gap. */
export function makeHyperlexicon({ ask, lang = "en", door = null } = {}) {
  const cache = new Map();
  const log = [];
  let giver = null;
  const inFlight = new Map();
  const noAnswer = () => `the hyperlexicon's door${door ? ` (${door})` : ""} did not answer`;
  async function want(forms) {
    const all = [...new Set([...forms].map(String))].filter((f) => f && !cache.has(f));
    if (!all.length || typeof ask !== "function") return;
    const waits = new Set(all.filter((f) => inFlight.has(f)).map((f) => inFlight.get(f)));
    const todo = all.filter((f) => !inFlight.has(f));
    if (todo.length) {
      const run = askAll(todo);
      for (const f of todo) inFlight.set(f, run);
      waits.add(run.finally(() => { for (const f of todo) if (inFlight.get(f) === run) inFlight.delete(f); }));
    }
    await Promise.all(waits);
  }
  async function askAll(todo) {
    const t0 = Date.now();
    for (let i = 0; i < todo.length; i += 400) {
      const batch = todo.slice(i, i + 400);
      let res = null;
      try { res = await ask({ asks: [{ op: "names", surfaces: batch, lang }] }); } catch { res = null; }
      const a = res?.answers?.[0];
      if (!a || !a.surfaces) { log.push({ forms: batch.length, answered: 0, ms: Date.now() - t0, gap: a?.gap ?? res?.gap ?? noAnswer() }); return; }
      giver = giver ?? { name: "janus hyperlexicon", head: a.head ?? res.head ?? null, standing: a.standing ?? null };
      let answered = 0;
      for (const f of batch) {
        const w = a.surfaces[f]?.written ?? [];
        cache.set(f, w.length ? w.map((x) => ({ w: f, node: x.node, kind: x.kind, pos: x.pos ?? [], senses: (x.of ?? []).map((o) => ({ of: o })) })) : null);
        if (w.length) answered++;
      }
      log.push({ forms: batch.length, answered, ms: Date.now() - t0 });
    }
  }
  const contexts = new Map();
  async function context(words, { ground = {}, lang: l = lang } = {}) {
    const key = (w) => `${l}|${JSON.stringify(ground)}|${w}`;
    const list = [...new Set([...words].map(String))].filter(Boolean);
    const todo = typeof ask === "function" ? list.filter((w) => !contexts.has(key(w))) : [];
    for (let i = 0; i < todo.length; i += 200) {
      const batch = todo.slice(i, i + 200), t0 = Date.now();
      let res = null;
      try { res = await ask({ asks: [{ op: "context", words: batch, ground, lang: l }] }); } catch { res = null; }
      const a = res?.answers?.[0];
      if (!a || !a.words) { log.push({ op: "context", words: batch.length, answered: 0, ms: Date.now() - t0, gap: a?.gap ?? res?.gap ?? noAnswer() }); break; }
      giver = giver ?? { name: "janus hyperlexicon", head: a.head ?? res.head ?? null, standing: null };
      for (const w of batch) contexts.set(key(w), a.words[w] ?? null);
      log.push({ op: "context", words: batch.length, answered: batch.filter((w) => a.words[w]?.candidatesTotal).length, ms: Date.now() - t0 });
    }
    return new Map(list.map((w) => [w, contexts.get(key(w))]));
  }
  const get = (form) => cache.get(String(form));
  const aliasOf = (form) => {
    const e = get(form);
    if (!e) return [];
    return [...new Set(e.flatMap((x) => (x.senses ?? []).map((s) => s.of).filter(Boolean)))];
  };
  return { want, get, aliasOf, context, get giver() { return giver; }, log, cache, lang, kind: "hyperlexicon" };
}

// "<letters>." followed by white space and more text: a place the splitter cuts (spans.js cuts after any terminator it is not told
// is a word's), so a place a sentence could end or an alias could continue. A dotted initialism ("U.S.") is one form; the splitter
// sees only its last letter run, which is what aliasTokens hands back. Before 2026-10-24 only a following capital counted, and
// "Co. at", "No. 5", "U.S. for" were cut without the giver being asked.
const JUNCTION = /(?<![\p{L}\p{N}.])((?:\p{L}+\.)*\p{L}+)\.(?=\s+\S)/gu;
const escapeRe = (x) => String(x).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The forms (with their period) at which the splitter is unsure: the token is not in `known` (lower case, no period). */
export function aliasJunctions(text, known = new Set()) {
  const out = new Map();
  for (const m of String(text ?? "").matchAll(JUNCTION)) {
    const tok = m[1];
    if (known.has(tok.toLowerCase()) || known.has(tok.split(".").pop().toLowerCase())) continue;
    const form = `${tok}.`;
    out.set(form, (out.get(form) ?? 0) + 1);
  }
  return out; // form → how many junctions it stands at
}

/** The tokens (no final period; "U.S" for "U.S.") whose dotted form the giver lists as a form of another word, or as a headword. */
export function aliasTokens(lexicon, forms) {
  const out = new Map();
  for (const form of forms) {
    const of = lexicon.aliasOf(form);
    // the giver lists the form WITH its period as a headword ("U.S.", "e.g.") — the period is part of the word even where no
    // form-of relation is given
    const dotted = (lexicon.get(form) ?? []).some((e) => e.w === form);
    if (of.length || dotted) out.set(form.slice(0, -1), of.length ? of : [form]);
  }
  return out; // token → the forms it is an alias of
}

/** The dotted words a prior lists that this text uses as words: the forms at a junction that the prior lists (as written, or
 *  lower-cased) and that the text never writes without their period (the same bare-use test resolveAliases applies). */
export function dottedIn(text, words, known = new Set()) {
  const set = words instanceof Set ? words : new Set(words || []);
  if (!set.size) return [];
  const t = String(text ?? "");
  const out = [];
  for (const form of aliasJunctions(t, known).keys()) {
    if (!set.has(form) && !set.has(form.toLowerCase())) continue;
    const tok = form.slice(0, -1);
    if (!new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(tok)}(?![\\p{L}\\p{N}.])`, "u").test(t)) out.push(form);
  }
  return out;
}

/** The alias decision for one text. A dotted form is kept as one word when the giver lists it as a form of another word AND the
 *  text never writes the token without its period — the text's own evidence that the token is not an ordinary word here ("in." is
 *  listed as a form of "inch", but "He came in." ends a sentence in a text that writes "in" everywhere else).
 *  junctions: aliasJunctions(text, known). Returns one row per listed form: { form, of, n, kept, why }. */
export function resolveAliases(lexicon, junctions, text) {
  const t = String(text ?? "");
  return [...aliasTokens(lexicon, junctions.keys())].map(([tok, of]) => {
    const n = junctions.get(`${tok}.`) ?? 0;
    const bare = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(tok)}(?![\\p{L}\\p{N}.])`, "u").test(t);
    return bare ? { form: `${tok}.`, of, n, kept: false, why: `“${tok}” also stands without its period in this text` } : { form: `${tok}.`, of, n, kept: true };
  });
}
