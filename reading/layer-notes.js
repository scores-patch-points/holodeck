// layer-notes.js — EVERY SECTION SAYS WHAT IT IS DOING.
//
// One source of plain-language notes for the layered instrument: each layer in the rail, and each tab, says what it does, what it rests on, and what it
// cannot decide. The numbers about THIS text (how many words, how many gaps) are the page's own live counters, shown beside the note; these notes are
// the words around them. Written for a reader who has never seen the pipeline. Nothing here is computed: where a note names a prior, the page
// still names that prior's giver in the provenance.
//
//   what    what the layer does, in a sentence or two
//   rests   what it stands on (a prior, a rule, a declared list) — so the reader knows what to doubt
//   cannot  what it does not decide, and what it does instead (a typed gap, a refusal), never a guess
export const LAYER_NOTES = {
  extract:   { what: 'Gets the text out of what you gave it: a PDF’s own text layer, the readable part of a web page, or — for a scan — OCR of the pixels.',
               rests: 'The extraction gate keeps every reading it can make and lets the one that reads as the most known words stand; the others are kept, so the choice can be revised.',
               cannot: 'A scan whose ink cannot be read gives little to work with. It says so instead of guessing.' },
  bytes:     { what: 'Fixes the material as bytes with an address and a hash. Everything the reading says later points back to a byte range, so nothing can be paraphrased away from its source.',
               rests: 'The SHA-256 of the bytes.', cannot: 'Nothing is decided here.' },
  decode:    { what: 'Turns bytes into characters (UTF-8). Offsets stay in bytes, so a claim still lands on exactly the bytes it came from.',
               rests: 'The UTF-8 standard.', cannot: 'A file that is not text is refused, not decoded into noise.' },
  furniture: { what: 'Blanks markup, style rules and web addresses to spaces — the same length, so no offset moves — so they are not read as words.',
               rests: 'Rules about the shape of characters; no list of words.', cannot: 'Markup written out as ordinary prose looks like prose and stays.' },
  lexicon:   { what: 'Asks the hyperlexicon about the forms the language’s own priors cannot settle — never a pre-load. A dotted form it lists as a form of another word (“Messrs.” of “Mr.”) is one word, so no sentence ends inside it; a form the class prior lacks gets the classes the dictionary gives it.',
               rests: 'The hyperlexicon’s local giver: the English Wiktionary pack on this machine (the 2026-10-01 dump), read by the Holodeck’s own server. Nothing leaves the machine; the live dictionary is asked only for what the pack lacks, and only with the network switch on.',
               cannot: 'A dotted form that also ends a sentence (“Co.” at the end of one) stays one word: the rule reads a form, not a sentence. A form the pack does not list stays a gap.' },
  punct:     { what: 'Keeps every mark and says what it does: where a sentence ends, whether it asks or exclaims, what opens and closes a quotation or a bracket, what separates one part from the next. Marks never go to part of speech; they decide where sentences end, the mood of what is said, and what a proposition is nested in.',
               rests: 'The language’s own punctuation conventions (declared), its abbreviations (measured from its own texts) and this text’s abbreviations (found in it).',
               cannot: 'A language with no declared conventions is read with the default and says so. A quotation that never closes is reported, not guessed at.' },
  statement: { what: 'Splits the text into the statements it makes — its sentences — using the sentence ends the punctuation layer found, so “Dr.” does not end one.',
               rests: 'The sentence splitter and the abbreviations it knows.', cannot: 'A long run with no marks stays one statement.' },
  token:     { what: 'Splits each statement into the word forms it is made of, with their byte positions. Marks are separate tokens (see Punctuation); only words go on to the layers below.',
               rests: 'Unicode letters and numbers — any script.', cannot: 'A script written without spaces needs a segmenter; where there is none, the run stays whole.' },
  grammar:   { what: 'Looks each word up in a part-of-speech prior and reports the classes it is attested as — noun, verb, and so on. “Attested” means annotated text has shown the word so; nothing is predicted.',
               rests: 'A part-of-speech prior for this language, built from annotated treebanks (its giver is named under “What it read with”).',
               cannot: 'A word the prior has never seen stays a typed gap. A word with several classes keeps all of them: it is ambiguous, not decided.' },
  morph:     { what: 'Looks each form up for the act it belongs to, so “condemned” and “condemn” count as one act. The lemma is a set, never reduced to a single answer.',
               rests: 'A morphology prior (UniMorph forms) plus spelling rules.', cannot: 'A form with several possible lemmas keeps every one.' },
  stance:    { what: 'Reads a position as a class: “is pro”, “in support of” and “backs” are one stance, so a claim and a source that say the same thing in different words can still meet.',
               rests: 'A small declared set of stance classes (support, oppose).', cannot: 'A stance outside those classes is not read.' },
  referent:  { what: 'Finds the participants the text names — people, groups, places, things — and follows each one through the text, even when it is named in different ways.',
               rests: 'Names the text itself introduces (capitalised runs, repeated names) and a closed set of pronouns.',
               cannot: 'A bare surname can name two people. It stays ambiguous until the text, or you, decide.' },
  relation:  { what: 'Reads propositions: the smallest meaningful tuple the text asserts, subject —act→ object. Each carries a verdict (read, unbound, contradicted, beyond reach) and, when its sentence is a question or an exclamation, it is marked asked or exclaimed rather than asserted.',
               rests: 'A clause-aware reading of the names and the act between them, and the mood the punctuation layer found.',
               cannot: 'A sentence that names no act the reader can bind gives no proposition. A refusal is a result, not an error.' },
  np:        { what: 'Lets a subject be a whole noun phrase (“the Palestinian Authority”), not just the one word before the verb.', rests: 'Word classes and the clause around the verb.', cannot: 'A subject it cannot bound is left unbound.' },
  phrasal:   { what: 'Reads a verb with its particle as one act (“gave up”, not “gave”).', rests: 'Word classes.', cannot: 'A particle it cannot attach is left alone.' },
  render:    { what: 'Writes each proposition back out in different word orders (subject–verb–object, SOV, VSO), to show the tuple itself is the same whatever order a language says it in.',
               rests: 'The proposition, not the sentence.', cannot: 'It does not translate; it reorders.' },
  ledger:    { what: 'Records every step as an event that cannot be changed, each with an id anyone can recompute, so the whole reading can be checked step by step.',
               rests: 'SHA-256 of each event.', cannot: 'It records; it does not judge.' },
};

export const TAB_NOTES = {
  source:  { what: 'The original text with the reading’s own marks on it. Colour shows what each stretch was read as. Nothing is changed or removed.', how: 'Select a stretch of text to see what the reading made of it.' },
  floors:  { what: 'The reading scored as a ladder of floors — units, referents, arrangements, claims, nesting, corroborated notes, premises — each made from the one below. A floor passes only when its declared task is done and three control arms fail: the floor below alone, an arbitrary re-coordination, and a text that does not support it. The stage is the highest floor passed with no gap below it, and it is this reader’s ceiling on this material, not a property of the text.', how: '“Refused” means a control arm did the task too; “unmeasured” means this text offers no specimen or this page has no organ for the floor — both are gaps, not failures. “Failed” is a real ceiling.' },
  words:   { what: 'Every word form the text uses, how often, and what class it was read as. This is the vocabulary the later layers work from.', how: 'Click a heading to sort; a form with no class is a gap, not an error.' },
  pos:     { what: 'Which part-of-speech classes each form is attested as. “Attested” means annotated text has shown it so — the counts are observed, not predicted.', how: 'Several classes on one form means it is ambiguous, and the reading keeps all of them.' },
  morph:   { what: 'Each form joined to the act it belongs to, so the different forms of one act count together.', how: 'The lemma column is a set; an empty rule-stem means the prior already knew the form.' },
  refs:    { what: 'The participants the reading has established — people, groups, places, things — found by name and followed through the text.', how: 'Click a name to see it in the Graph; click a heading to sort. A name that never takes part in a proposition is not invented here.' },
  props:   { what: 'Each statement as a card: its words, then its structure (the smallest subject —act→ object tuples the parser read, nested where one sits inside another, numbered in the order the text makes them), then its ties (referents the statement binds to each other, with confidence, standing and tense). A question is marked asked, not asserted.', how: 'Underlined words carried a tie. Hover a confidence bar to see what it rests on; “revisit” holds a tie open.' },
  render:  { what: 'The same propositions written back out in several word orders, and the text with each sentence diagrammed.', how: 'This is output, not input: nothing here feeds back into the reading.' },
  eot:     { what: 'The ledger: every step of this reading as an unchangeable event, in order, each with an id anyone can recompute.', how: 'Use it to check the reading, or to see exactly which step produced a claim.' },
  json:    { what: 'The whole reading as one structured object, every part addressed by byte range — what you would download or hand to another program.', how: 'Open any part to see where in the text it came from.' },
  graph:   { what: 'The referents as a solar system: how near a referent sits to the centre is how closely it is tied — by sharing statements — to the referent in the middle. The centre is whatever you select, otherwise the best-connected referent.', how: 'A line is drawn only for the relation the replay is on, or for the referent you have selected; otherwise the orbits themselves say how near two referents are. A body can hold more referents: click it to open it.' },
};

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/** The note for a layer, as HTML: the sentence always, the “rests on / cannot” lines for the layer being shown. */
export const layerNoteHTML = (id, { full = false } = {}) => { const n = LAYER_NOTES[id]; if (!n) return ''; return `<span class="why">${esc(n.what)}</span>${full ? `<span class="how"><b>Rests on</b> ${esc(n.rests)} <b>Cannot decide</b> ${esc(n.cannot)}</span>` : ''}`; };
/** The note at the top of a tab, as HTML. */
export const tabNoteHTML = (tab, { collapsed = false } = {}) => { const t = TAB_NOTES[tab]; if (!t) return ''; return collapsed ? `<details class="pnote"><summary><b>What this is doing</b></summary>${esc(t.what)} <span class="dim">${esc(t.how)}</span></details>` : `<div class="pnote"><b>What this is doing.</b> ${esc(t.what)} <span class="dim">${esc(t.how)}</span></div>`; };
