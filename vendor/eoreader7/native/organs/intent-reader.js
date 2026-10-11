// native/organs/intent-reader.js — read an ask's INTENT from its grammatical
// structure, omnilingually, never from its lexicon. The reason-gate's doors
// (register / mechanical / context / grounded / reasoning / refuse) are the
// few places an ask can go; WHICH door is read here from Universal
// Dependencies structure — the same labels every UD-annotated language uses,
// so the reading is language-neutral by construction, exactly as
// mouth-intent.js reads prohibition from structure ("no regex, if we're doing
// that it's the wrong shape" — the Fold's own law, stance.js).
//
// THE SHAPE OF AN ASK, READ STRUCTURALLY:
//
//   phatic    — the ask makes no content claim: its root is an interjection
//               (INTJ), a social noun ("thanks", "goodbye"), or a bare
//               addressee ("you") with no propositional verb. This is
//               REGISTER: the mouth may phrase it, never reason about it.
//   question  — the root carries an interrogative (PronType=Int, an nsubj
//               "what"/"who", an aux in interrogative mood) OR the sentence
//               ends in a question mark with a copular/relational root.
//               WHICH door a question goes down depends on what it asks about
//               (arithmetic → mechanical, the conversation → context, the
//               world → grounded or reasoning).
//   imperative — the root is a verb with NO subject (English's elided "you")
//               — a demand: "prove P != NP", "tell me a story". A demand that
//               the machine cannot settle is REFUSED, never obeyed by
//               reasoning.
//   statement — the root is a verb or copula WITH a subject: a claim about
//               something. Route by what the claim is about.
//
// THE READ IS A STRUCTURE, NOT A CLASSIFIER. No word lists, no English-only
// surfaces. A lens-free structural reader: mood, clause type, subject
// presence, root upos — the same in every UD-annotated language. The
// arithmetic/context/world discrimination that follows is the mechanical
// organs' own (the quantity detector, the record, the surfaced ground) — the
// reader only opens the right door.
//
// FALSIFYING CONTROL: a turn the reader types `phatic` that any caller
// answers by asking the model to reason; an imperative the reader lets fall
// through to reasoning instead of refusing; or a structural reading that
// differs across two languages for the same ask shape — any concedes.

const CONLLU_ROW = /^\d+\t/;

// The trailing ASK mark, script-neutral (ASCII ?, Arabic ؟, fullwidth ？,
// Armenian ՞, small ﹖, ‽, ⁇, ⸮) — a structural punctuation class, never a
// word list. FALSIFIED 2026-10-09: this was written `[?…]?\s*$` — the
// optional mark made the test TRUE FOR EVERY SENTENCE, so every statement
// parsed as a question and the speaker model could never hold a claim.
const QUESTION_MARK = /[\u003F\u061F\uFF1F\u055E\uFE56\u2E2E\u203D\u2047\u2048\u2049]+[\s]*$/u;

function parseConlluLines(lines) {
  const rows = [];
  for (const line of lines ?? []) {
    if (!CONLLU_ROW.test(line)) continue;
    const cols = line.split("\t");
    if (cols.length < 8) continue;
    const [id, form, lemma, upos, xpos, feats, head, deprel] = cols;
    rows.push({
      id: Number(id),
      form, lemma, upos,
      feats: feats === "_" ? {} : Object.fromEntries(feats.split("|").map((kv) => kv.split("="))),
      head: Number(head),
      deprel,
    });
  }
  return rows;
}

const hasDep = (rows, headId, dep) => rows.some((r) => r.head === headId && (r.deprel === dep || r.deprel?.startsWith(`${dep}:`)));
// NO WORD LISTS. The signal is the parser's computed fields — `upos`,
// `feats`, `deprel`, `head` — which are language-neutral UD labels computed
// on the fly per token. An interrogative is PronType=Int (computed); an
// addressee is Person=2 (computed); a greeting is INTJ (computed). Nothing
// here is a vocabulary table: a word list is a finite guess, and the world
// has more words than the list (kleenUp's law — the same reason stance.js
// refuses a lexicon).
const isInterrogativePron = (r) => r.upos === "PRON" && (r.feats.PronType === "Int" || r.feats.PronType === "Int,Tot" || r.feats.PronType === "Int,Rel");

/**
 * readIntent(records) → { intents, doors, sentences }
 * records: the shape loadEotParser().parse(text) returns (one per sentence).
 * A PROMPT CAN TRIGGER MULTIPLE DOORS: every sentence is read, and the union
 * of the doors they open is returned ("hello! what is 12 times 8?" opens
 * phatic AND mechanical). `doors` is a Set in array form, in the order the
 * sentences opened them; `intents` is the per-sentence intent list.
 */
export function readIntent(records) {
  const sentences = (records ?? []).filter(Boolean);
  if (!sentences.length) return { intents: [], doors: [], sentences: [] };
  const perSentence = [];
  const doors = new Set();
  for (const rec of sentences) {
    const s = readOne(rec);
    perSentence.push(s);
    for (const d of s.doors ?? []) doors.add(d);
  }
  return { intents: perSentence.map((s) => s.intent), doors: [...doors], sentences: perSentence, texts: sentences.map((s) => String(s?.surface?.text ?? "")).filter(Boolean) };
}

function readOne(rec) {
  const rows = parseConlluLines(rec?.surface?.lines ?? []);
  if (!rows.length) return { intent: "unreadable", doors: [], root: null, structure: { lines: (rec?.surface?.lines ?? []).length } };
  const root = rows.find((r) => r.head === 0) ?? rows[0];
  const text = String(rec?.surface?.text ?? "").trim();
  const structure = {
    lines: rows.length,
    rootUpos: root.upos,
    hasSubject: hasDep(rows, root.id, "nsubj") || hasDep(rows, root.id, "csubj"),
    hasNumbers: rows.some((r) => r.upos === "NUM" || r.upos === "NUM_"),
    pronTypeInt: rows.some((r) => r.feats.PronType === "Int"),
    endsQuestion: QUESTION_MARK.test(text),
  };

  // QUESTION — computed from the parser's fields: an interrogative pronoun
  // (PronType=Int), an interrogative mood on an aux, or a question mark with
  // a relational root. No word list.
// THE PHATIC EXCEPTION (structural): when the only interrogative signal
  //   is an ADVERB (advmod "how") on a verb whose SUBJECT is the addressee
  //   (Person=2) — "how are you doing?" — the question is about the
  //   addressee's wellbeing, a greeting, never a content request. Computed:
  //   how-advmod + nsubj Person=2 + VERB root → phatic.
  const howAreYou = rows.some((r) => r.upos === "ADV" && r.deprel === "advmod" && r.feats.PronType === "Int") &&
    rows.some((r) => r.upos === "PRON" && r.feats.Person === "2" && (r.deprel === "nsubj" || r.deprel?.startsWith("nsubj:"))) &&
    root.upos === "VERB";
  const hasQuestionWord = rows.some((r) => isInterrogativePron(r) && (r.deprel === "nsubj" || r.deprel === "root" || r.deprel === "obj" || r.head === root.id || r.id === root.id));
  const endsQuestion = QUESTION_MARK.test(text) && (root.upos === "AUX" || root.upos === "VERB" || root.upos === "NOUN" || root.upos === "ADJ");
  // The interrogative mood is the AUX's own computed feature; ANY finite
  // auxiliary or copula is NOT an interrogative signal (that made "I think
  // the mayor is corrupt" a question — every copular clause fired it,
  // falsified 2026-10-09). EndsQuestion and the question word carry the real
  // weight; this is the residual mood path.
  const auxInterrogative = rows.some((r) => r.upos === "AUX" && r.feats.Mood === "Int" && (r.deprel === "aux" || r.deprel === "cop" || r.head === root.id));
  const interrogative = !howAreYou && (hasQuestionWord || endsQuestion || auxInterrogative);

  // PHATIC — the parser's fields, computed: an interjection root (INTJ), a
  // noun root with no propositional argument and no subject (a social noun,
  // whatever language), a discourse-particle root carrying an interjection,
  // or a bare addressee (PRON, Person=2) with no verb. No word list.
  const phaticInterjection = root.upos === "INTJ";
  const phaticDiscourseRoot = (root.upos === "ADV" || (root.upos === "PRON" && root.feats.Person === "2")) && rows.some((r) => r.deprel === "discourse" && r.upos === "INTJ") && rows.length <= 4;
  const phaticNoun = root.upos === "NOUN" && !hasDep(rows, root.id, "nsubj") && !hasDep(rows, root.id, "advcl") && !hasDep(rows, root.id, "obj") && rows.length <= 6;
  const bareYou = root.upos === "PRON" && root.feats.Person === "2" && !hasDep(rows, root.id, "acl") && !hasDep(rows, root.id, "cop");

  // IMPERATIVE — a verb root with no subject (computed): a demand, not a
  // claim. Mood is a computed field where the parser carries it; the
  // subject-absence is the structural read, language-neutral.
  const imperative = root.upos === "VERB" && !hasDep(rows, root.id, "nsubj") && !hasDep(rows, root.id, "csubj") && root.feats.Mood !== "Ind" && !(root.form && /\?$/.test(root.form));

  let intent;
  if (phaticInterjection || phaticDiscourseRoot || phaticNoun || bareYou || howAreYou) intent = "phatic";
  else if (interrogative) intent = "question";
  else if (imperative) intent = "imperative";
  else intent = "statement";

  // THE DOORS A SENTENCE OPENS — simple, composable. A prompt may trigger
  // several ("hello! what is 12 times 8?" opens phatic AND mechanical). Each
  // door is ONE shape the ask's structure declares; the reason-gate tries
  // them in priority order and the first that settles owns the turn. Doors
  // are never mutually exclusive by construction: a question can also carry
  // a number (mechanical), reference the conversation (context), or name a
  // thing the world must answer for (world).
  const doors = new Set();
  if (intent === "phatic") doors.add("phatic");
  if (intent === "imperative") doors.add("imperative");
  if (intent === "question") doors.add("question");
  if (intent === "statement") doors.add("statement");
  // a question or imperative that carries numbers opens the mechanical door
  // (the quantity organ may settle it: "so what is 12 times 8?")
  if ((intent === "question" || intent === "imperative") && structure.hasNumbers) doors.add("mechanical");
  // CONTEXT is the HOLOGRAPH's door, not a word list: a question that
  // resolves to referents the record holds (the conversation, the material)
  // is context — the reason-gate's activation decides it. No vocabulary
  // table here.
  // a question or statement naming the world opens the world door (grounded
  // narration or a derivation — the machine decides which).
  if (intent === "question" || intent === "statement") doors.add("world");

  return {
    intent,
    doors: [...doors],
    root: { upos: root.upos, lemma: root.lemma, form: root.form },
    structure,
  };
}