# Reading as a holarchy of cube cells — plan and pre-registration

**Frozen 2026-10-24**, before any finder code exists, with the seven changes argued for in the essay *How it reads: a holarchy of nine moves* (https://claude.ai/artifact/ED7yr87YUyy78Nv9M5SJ2k) applied. Nothing in it has been measured. The material is hashed in the appendix; M4 waits on your yes to download it. Once frozen, a bar is not lowered: a failed bar is reported with its number, and the next move is a named new frame (a REC), never a re-run.

---

## 1. What this replaces, and why

The floor ladder (`reading/mhc-ladder.js`, PR scores-patch-points/holodeck#21) scored a reading as seven floors, F0 units to F6 premises, each with the MHC's discipline: a task declared before it runs, three control arms that must fail, and refused, unmeasured and failed kept apart. That discipline stays. The floors do not.

Placed in the cube with canon's own table (`kernel/cube.js::cellOf`; the grain in each row is a placement, the terrain and stance follow from it):

| floor | act | site | stance |
|---|---|---|---|
| blank furniture | NUL · Ground | Void | Clearing |
| F0 cut units | SEG · Ground | Field | Clearing |
| F1 admit a being | INS · Figure | Entity | Making |
| F1 merge its names | DEF · Figure | Lens | Dissecting |
| F2 bind a relation | CON · Figure | Link | Binding |
| F3 judge a claim | EVA · Figure | Lens | Binding |
| F4 nest who says what | CON · Pattern | Network | Tracing |
| F5 corroborate across sources | SYN · Pattern | Network | Composing |
| F6 derive from premises | REC · Pattern | Paradigm | Composing |

What that shows:

- **The floors were terrains.** The ladder is a walk across the Site face, from Void and Field to Paradigm, with each terrain labelled as a stage. Each floor is one operator applied to one kind of unit.
- **Each level is a whole cycle, not one step.** Every unit the reader meets, a word, a sentence, a paragraph, a section, a document, can go through all nine operators. The floor ladder recorded one operator per unit and could not see the rest.
- **Nesting was hidden in "a unit".** F0 cut sentences and nothing else, so a lease's numbered clauses, an email's header and signature, a recipe's steps, a table's rows and a program's blocks were all flattened to sentences.
- **Two terrains are never reached.** No act lands on Kind or Atmosphere: the reader never forms its own class of beings and never reads the register of the whole.
- **Revisions run between units.** The 21 "F2 revises F1" records on the 1912 Board of Trade report are the clause level changing what the name level admitted.
- **The priors added nothing for the specimens tested.** With each of part of speech, morphology and stance withheld, F2 and F3 still passed on the news sample and the report. One specimen per floor is too little to say more.

Canon already holds the model this plan uses: `organs/void-holarchy.js` defines every level of a piece by the same nine operators, medium-blind, and states the law of holons (a lower level sets what is possible for the higher, the higher sets what is probable for the lower). `kernel/gfp-claim.js` gives every unit a nested address. Canon uses the holarchy organ only on the writing side: `the-fold/void-spec.js` declares a piece's voids level by level before it is written, `organs/hora.js` walks them while building, and `organs/void-satisfaction.js` checks them after. Nothing uses it to read a piece, and it names levels from a fixed list per medium. This plan finds the levels from the material instead. (An earlier draft said nothing imports the organ; that was wrong.)

## 2. The model

**Unit.** A span of the material's bytes found by the unit-tree finder (§3). A material carries several **trees** of units at once: the logical one (sections, paragraphs, sentences), the physical one (pages and lines, where a layout exists), the voices (quotations and what they nest in), and others the finder admits. Each tree is a chain of break types that nest inside each other; a type that crosses another belongs to another tree. Inside a tree, units tile their parent and never cross a sibling. All trees share the root `/`. An address names its tree and its path in canon's form: `T1:/2/3` (`gfp-claim.js::holon` on the path). Trees are numbered by the finder, T1 the tree with the most units, never named by hand.

**Act.** One thing the reader did, recorded once, with every coordinate:
- `units` — one address per tree: in each tree, the smallest unit containing all of its operand (`gfp-claim.js::lca`); an act whose operand crosses a tree's units is addressed to their common parent in that tree,
- `op` — one of the nine operators, declared per organ in advance (§2.2),
- `grain` — Ground, Figure or Pattern, relative to the unit, per tree (§2.1),
- `at` — the moment: the pass (1 for the first reading, 2 and up for each reopening pass) and the act's order within it,
- `reader` — the reader configuration that made it (R0 to R7, §7),
- `source` — the source its operand lies in, when the material has more than one,
- `forWhom` — for an EVA or REC act that settles an open question for someone, that for-whom (`kernel/for-whom.js`); none is landed in this plan's runs, so it is recorded as null and the field exists,
- `operand` — the byte ranges it produced, bound or judged; `read` — the byte ranges it consulted,
- `standing` — done, refused (an arm fired), or a typed gap: **not wired** (canon names an organ for this move at this grain in `organs/capacities.js`, and this reader does not run it), **nothing to act on** (the reader ran an organ for this move here and it found no operand), or **no organ** (canon names none),
- `revises` — the id of the earlier act whose operand it changes, when it does.

A face cell with no done act is never blank: it shows the gap type of the acts addressed there, or *not wired* when none were made.

Terrain and stance are never stored. They are computed from `op` and `grain` by `cellOf`, so they cannot drift from the cube.

**Face.** The acts addressed to one unit, projected onto two cube axes: the **Act face** (mode × domain: the nine operators), the **Site face** (domain × grain: Void, Entity, Kind; Field, Link, Network; Atmosphere, Lens, Paradigm) and the **Stance face** (mode × grain: Clearing, Dissecting, Unraveling; Tending, Binding, Tracing; Cultivating, Making, Composing). Each is a 3 × 3 per unit. A face describes the reader's acts on a unit, never the unit's content: canon forbids asking the cube what a piece of text is, because its cell labels survived word shuffling.

### 2.1 Grain, relative to the unit

For an act addressed to unit *u*:

- **Ground** — the act works on *u* as the surround and singles out no particular inside it: it cuts *u* into children, blanks furniture in *u*, or marks an absence in *u*.
- **Figure** — the act's operand is one particular inside *u*, once: a name admitted, a relation bound, a claim judged. A particular may span several words or bind several spans; it occurs once.
- **Pattern** — the act's operand is a recurrence: the same form, being or relation occurring in two or more different children of *u* (a name across sentences, a claim across sources, a class across words).

The rule is computed from the act's operand ranges and *u*'s children, never from what the words say, and is recomputable from the record. Canon's holarchy organ instead fixes grain by depth (whole Ground, part Figure, sub-part Pattern, then Figure again). If relative grain fails B5, the depth rule is the named REC.

### 2.2a The hyperlexicon, open to every organ

Every organ may consult the hyperlexicon when the language's own priors cannot settle a form. It is never a batch pre-load: an organ asks only about the form it is unsure of, and every answer is cached and recorded as a witness under its giver, never as a licence (`kernel/hyperlexicon.js`). On this Mac the giver is the English Wiktionary pack (2026-10-01 dump, 10.41 million entries, `~/.cache/live_priors/wiktionary/`), read through the Holodeck's local server; the live Wiktionary API is used only for what the pack lacks, and only behind the page's network switch. The full hyperlexicon (concordance, candidate nodes, traversal) lives on hyphae and is not used by this plan's runs.

An abbreviation is not a category of its own. It is an **alias**: a form the hyperlexicon lists as a form of another word ("Messrs." is listed as a formal form of "Mr."). When the word level resolves such a form, the period belongs to the word, and the sentence level cannot cut inside it. That is the law of holons in the right direction: the lower level sets what is possible for the one above.

### 2.2 Which operator each organ performs — declared now

So that no face can be tuned after the fact, each organ's operator is fixed here. Its grain then falls out of §2.1.

| organ (as it runs today, or new) | operator | what it asks |
|---|---|---|
| extraction gate: which reading of a container is the text | NUL | what is not text in the source |
| furniture blanking | NUL | what is not the material's own words |
| unit-tree finder, each cut (new) | SEG | the extent and its units |
| expectation from a parent's shape: a numbered run, a column count (new) | SIG | what must resolve in the next child |
| sentence mood (`reading/punctuation.js`) | INS | what kind of unit stands here: statement, question, exclamation |
| part-of-speech class | INS | what kind of form stands here |
| name rule, admit a being (`organs/cast.js`) | INS | what kind of thing: a being |
| morphology: forms joined into one act | SYN | how forms compose |
| noun-phrase subjects, phrasal predicates | SYN | how words compose into one end or one act |
| name rule, merge variants | DEF | these surfaces are one |
| hyperlexicon: a form resolved as an alias of another ("Messrs." of "Mr.") | DEF | this form and that one are one word |
| hyperlexicon: a class attested for a form the prior lacks | INS | what kind of form stands here |
| relation reader, bind (`organs/hypergraph.js`) | CON | what binds a filler to an anchor |
| pronoun resolver, bind; its refused regime | CON; gap | what a pronoun binds to, or why it is left |
| merging testimony across sources | SYN | how readings compose into one note |
| judge, a verdict against the material; a note admitted by several sources | EVA | the admission test |
| reopen, revise | REC | what reopens a declaration |
| render into word orders; the ledger | not acts | output and the record itself |

### 2.3 The law of holons, as checks on the record

- **Low sets possibility for high.** A Pattern act at *u* must cite two or more children of *u* that each carry a Figure act on the same key. A Pattern act without them is refused, typed, and counted. This is an invariant of the record, tested in code, not a bar.
- **High sets probability for low.** A parent's shape is recorded as a SIG act at the parent (what its next child is expected to be), and each child's fit or misfit as an EVA act at the child.
- **Revision.** An act that changes an earlier act's operand at another unit carries `revises`. Revisions are appended, never written over, and are drawn as arrows between units.

### 2.4 Nine operators per unit — decided 2026-10-24

Every unit carries its own NUL: what it lacks or marks off, recorded as typed gaps at that unit (the unread, the blanked, an expected child that never came). A complete cycle at a unit is all nine. The parent's SEG that cut the unit's slot is recorded at the parent, not counted as the child's NUL.

The alternative, eight per unit with NUL inherited from the parent's cut, is not used. Its count is still reported beside the nine, for comparison only; no bar reads it.

### 2.5 Which moves apply where — measured, never listed

A move **applies** at a level when at least one reader configuration, R0 to R7, completes it at some unit of that level in M1 or M2. A unit's **ceiling** is the share of the moves that apply at its level that this reader completed there. Which moves apply at which level is reported, with the readers that completed them. A level is identified by its break type in the finder's evidence, never by a name such as "sentence".

## 3. The unit-tree finder

Input: the material's bytes after extraction, with no medium label and no language label. Output: a tree of units with addresses, the evidence for each admitted level, and the overlays.

**Candidate break types**, each defined over Unicode character classes, none over words:

1. runs of line breaks, by length: one newline, two or more, a page break
2. line-start shape: indentation width; a short leading token of digits or one letter followed by punctuation (an enumerator, matched by shape, not from a list); a leading symbol or dash followed by a space (a bullet)
3. a short line set apart between longer blocks (a heading shape, by length contrast and isolation, never by letter case)
4. sentence terminals: canon `adapters/text/spans.js::splitSentences`, with its abbreviation prior derived from the material
5. clause marks: canon `adapters/text/clause-spans.js::clauseSpans`
6. paired containers, quotes and brackets: `reading/punctuation.js`
7. field delimiters with a constant count per line: tab, comma, pipe, semicolon (table rows and cells)
8. bracket depth and indentation blocks: canon `adapters/text/code-structure.js::braceExtent`, `indentExtent` (to be vendored)
9. layout cues, only where a PDF layout exists: `reading/punctuation.js::cuesFromLayout`
10. words: runs of Unicode letters and digits; in scripts written without spaces, single characters. No segmenter is assumed; that is a stated limit.

**Admission.** A break type is a candidate level when it cuts some parent into two or more units.

- **(a) Nesting, per tree.** A type joins a tree when at most 2% of its units cross a boundary of a coarser type already in that tree. A type that crosses every existing tree beyond 2% starts a new tree under the root; quotations running across sentences are the expected case. Nothing is demoted to an overlay: every admitted type stands in some tree, and an act is addressed in every tree.
- **(b) Non-arbitrary, against a level-preserving null.** Its cuts must separate the finer units it contains better than the same number of cuts placed at random among that finer level's boundaries. Three signals, each tested on its own, the measured one first:
  - *surprise*: `reading/sections.js::gainsAt`, already used by the reader view — the bits per token a cut saves when the text after it is read against the register prime (`primeFor`) instead of against everything before it; the type's statistic is the mean gain of its cuts;
  - *lexical*: mean Jaccard similarity of the case-folded letter-and-digit runs of adjacent finer units on the same side of a cut, minus across a cut (character bigrams for scripts written without spaces);
  - *shape*: the same contrast over a declared shape vector per unit: Unicode category of its first non-space character, indentation bucket, length band (log2 of its character count), category of its last character; similarity is the fraction of equal components.
  Null: 1,000 seeded random placements; one-sided permutation p. A type is admitted if any signal passes at Holm-corrected α = 0.05 across all candidate types × 3 signals in that material. Each signal's p is reported, so it is visible whether the surprise test or a cohesion test carried the admission.
- **(c) Order** is by containment, never by type name. Two types that cut identically are one level, with the evidence of both kept.
- **Declared norms.** Types 4, 5, 6 and 10 come from declared script norms and are admitted on (a) alone; (b) is reported for them. Types 1, 2, 3, 7, 8 and 9 need (a) and (b).
- **Too small to tell.** When the null has fewer than 20 distinct placements, (b) is *unmeasured — too few units*: neither admitted nor rejected, and reported.
- **The finer level for (b)** is the finest admitted level the candidate contains: usually sentences, or lines where there are no sentence terminals (tables, code).

Children are numbered from 1 in order. Every unit keeps its byte range: address to range is a lookup, range to address is containment.

## 4. Recording

- Each organ's output is turned into acts by a small adapter, with the operator declared in §2.2.
- Acts are appended to the reading's EOT ledger (`vendor/fold-chat/fold-chat-eot.js::EotLedger`, the one store) as `stage: 'act'` events carrying `units, op, grain, at, reader, source, forWhom, operand, read, standing, revises`. The index, the faces, the timeline and the Floors view are projections of those events.
- The Site face per unit is built with canon `kernel/level-profile.js::buildLevelProfiles` keyed by unit address (`typedAct` takes the address as its referent), and controlled with its `permutationControl`. Its `classifyIndividuation` is never called: grain dominance read as emanon, protogon or holon is the triholon typing, which is parked.

## 5. The view — changed only after the bars

- **Index:** the unit tree, collapsible per level, each unit with a small 3 × 3 for the selected face.
- **Timeline:** lanes are the nine operators, or the nine terrains or nine stances when that face is selected; the playhead as now.
- **Selecting a unit:** its three 3 × 3s, each cell typed done, refused, not wired, nothing to act on, or no organ; and its acts in order, with their moments and readers.
- **Trees:** the index shows one tree at a time, with a switch between the trees the finder found.
- **Revisions:** arrows between units.
- The floor ladder stays as one projection, a walk across the Site face, until the bars say whether to retire it.

## 6. Material — hashed at freeze

- **M1** — the ten genre samples in `~/Downloads/reading-samples/`: news, biography, science, lease, fiction, email, history, recipe, opinion, ambiguous pronouns.
- **M2** — the eight Titanic 1912 readings in the Holodeck's public sample set (`holodeck-samples/titanic-1912/readings.json`, sha256 prefix `f9deeb622dd454a4` as of this draft). Their HTML is the reference tree. The finder reads them with the tags stripped by one declared rule (`reading/eval/holarchy/m25-build.mjs`): every block element (`h2`, `h3`, `p`, `table`) becomes one block, blocks are separated by a blank line, a `<br>` is a line break, a table row is a line and its cells are separated by tabs, inline tags are dropped and entities decoded. References: **heading** (the starts of `h2` and `h3`), **paragraph** (the start of every block: `p`, `h2`, `h3`, `table`), **row** and **cell** (the table), and **line** (each `<br>` line, reported only). In the report, the section titles such as THE STEAMSHIP "TITANIC." are `p` elements in the HTML, so they count as paragraphs, not headings; the reference is used as given.
- **M3** — synthetic known-truth documents, made by a seeded generator from M1's own sentences: 60 documents nesting known units (sections of paragraphs of sentences; numbered and bulleted lists; one table; one quoted block; one code block from the Holodeck's own source), with every boundary recorded at generation. Plus 20 negative controls: the same sentences run together as one block with single spaces. Every true boundary is recorded at generation.
- **M4** — two public-domain documents in other scripts, fetched on this Mac from Project Gutenberg's HTML editions: one in Cyrillic (a Russian punctuation prior exists) and one in a script written without spaces. Their `p` tags are the reference for paragraphs. If none can be found before freezing, B4's cross-script part is declared not run, never passed.
- **M5** — three source files of the Holodeck repository as code (`reading/floor-words.js`, `holodeck-lookup.js`, `reading/look-joins.js`, copied at commit c62d0bf), and the Titanic data table as CSV. Code references come from acorn 8.13.0, used only as the reference and never as a candidate break type: **statement** (every statement start in the program body and in every block or function body) and **block** (every block's opening brace, reported only). CSV references: **row** and **cell**.
- Nothing runs on hyphae.

## 7. Bars — declared before any run

A boundary found matches a reference boundary when only whitespace lies between them; each boundary matches at most one other. Offset 0 is excluded from every set, because every level starts there. Per document, reference levels with identical boundary sets are one level, and each reference level is matched to one found level, in any tree, by repeatedly taking the pair with the highest boundary F1 and removing both; a reference level left without a partner scores 0. For M3 the reference levels are: **section** (each heading's start), **paragraph** (the start of every blank-line block, headings included), **sentence**, **item**, **row**, **cell**, **quote line** and **code line**.

**B1 — Tree recovery on known truth (M3).** Boundary F1 ≥ 0.90 for each level present in a document, macro-averaged over levels and documents.
*Fails:* the candidate types or the cohesion test are wrong. REC the finder; nothing later reads the tree.

**B2 — No invented levels (M3 controls).** In at least 19 of the 20 run-together controls, no level is admitted above the sentence.
*Fails:* the null is miscalibrated. Stop; nothing else in this plan is read until it is fixed.

**B3 — Tree recovery on real structure (M2).** Heading and paragraph boundaries F1 ≥ 0.85 at each of those two levels, macro-averaged over the eight readings; the data table's rows and cells F1 ≥ 0.90.

**B4 — Other media and scripts (M4, M5).** On each code file, statement boundaries F1 ≥ 0.85 against acorn's statements; on the CSV, rows and cells F1 ≥ 0.90. On each M4 document, paragraph boundaries F1 ≥ 0.85, and at least one level above the word is admitted. A script in which no break type is admitted is a failure, not a gap.

**B5 — Levels respond to the structure they claim (level-preserving surrogates).** For each admitted level *d* of each M1 and M2 document, surrogate *S_d* shuffles the order of words inside every level-*d* unit: it keeps level *d* and everything coarser, and destroys what is finer. Measured: Δdeep, the relative drop in done Figure and Pattern acts addressed below *d*; Δshallow, the relative change in done Ground acts addressed at *d* or above. Bar: Δdeep > |Δshallow| in at least 80% of (document, level) pairs, with a sign test p < 0.01.
Also: per document with at least 20 units, the Site face's mean within-unit concentration exceeds its own `permutationControl` null (1,000 reseeds) at p < 0.01 in at least 80% of M1 and M2 documents.
*Fails, first part:* the levels are a taxonomy, not a hierarchy; REC to the depth-fixed grain rule and re-declare. *Fails, second part:* the Site face is the pipeline's signature, not the unit's; it is not shown per unit.

**B6 — Test-retest.** Two builds per M1 and M2 document: the material as given, and the same material through a second path (CRLF line endings, Unicode NFD, and for M2 a different HTML stripper), with every seeded arm redrawn. Units are matched across builds by byte overlap ≥ 90%. Each unit gets a ceiling label: the share of the moves that apply at its level that it completed (§2.5), binned none, up to a third, up to two thirds, short of all, all. Bar: Cohen's κ ≥ 0.80, and above the 99th percentile of 1,000 label permutations; tree boundary F1 between builds ≥ 0.98.

**B7 — Guttman scales across readers.** Reader configurations declared now: R0 the full assembled reader; R1 without the part-of-speech prior; R2 without morphology; R3 without stance; R4 without noun-phrase subjects; R5 without phrasal predicates; R6 without the pronoun resolver; R7 without the name rule (beings by bare token containment); R8 without the hyperlexicon. No model reader is included (§10).
- **B7a, the helix.** Within a unit, the operators performed form a cumulative scale in canon's helix order, NUL to REC, pooled over readers and M1 and M2 units: coefficient of reproducibility ≥ 0.90 and Loevinger's H ≥ 0.40. *Fails:* canon's "each operator contains all those below it" does not hold for this reader; the helix is a list here, and the ceiling is a set of cells, not a count.
- **B7b, the levels.** Across readers and documents, completing the cycle at a coarser level implies completing it at the finer levels it contains: coefficient of reproducibility ≥ 0.90. *Fails:* coarse levels do not depend on fine ones; the levels are parallel, and the ladder view is retired.

**B9 — Aliases reach the cut, and revisions are on the record.** (a) On M1 and M2, with the hyperlexicon open (R0), no sentence cut falls inside a form the hyperlexicon lists with its final period as a form of another word. Reported beside it: how many such cuts R8 (the same reader without the hyperlexicon) makes, and how many beings and relations change between R8 and R0 because of them. The five "Messrs." cuts in the 1912 report are among them; that case was found before this bar was set, so it is reported, not counted. (b) Invariant, tested in code, not a bar: every revision the reader makes (a later sentence changing an earlier class, binding or being; a relation's end admitted as a being; a reopened claim) is an act with its unit, moment and `revises`, and replaying the record in order reproduces the final reading.
*Fails, (a):* the hyperlexicon is not reaching the organ that cuts. *Fails, (b):* the record's arrows are decoration.

**B10 — A check from outside the reader (reported, not a bar).** (a) The reader's bound relations against the dependency parser's subject, act and object tuples (`reading/propositions.js::tuplesOf` over `english-parser.js`), as precision and recall of edges whose two ends match a tuple's subject and object heads, per M1 and M2 document. (b) 60 bound relations drawn at random (seeded) from M1 and M2, written to a file for you to mark right or wrong; precision with a 95% Wilson interval is reported once marked. It is not a bar because nothing here says what a reader should score; the next pre-registration sets one from these numbers.

**B8 — A level earns its keep.** Collapsing an admitted level, merging its units into their parent, must change the done acts at that level and above more than collapsing the same number of boundaries drawn at random from the next finer level: permutation p < 0.05, for at least 70% of admitted levels across M1 and M2. A level that does not is reported as not earning its keep, and drawn so. The predictive form, held-out gain on a named target, is not in this plan; it needs its target named first.

## 8. Order of work and stopping rules

1. You make the §10 decisions and read the bars. I freeze this file by committing it to the Holodeck PR branch, with M1 to M5 hashed in an appendix, before any finder code exists.
2. Build the finder (`reading/unit-tree.js`) with unit tests on tiny cases. Vendor `code-structure.js` and `void-holarchy.js` byte-identical from khora origin/main.
3. Run B1 to B4. If B2 fails, stop. If B1 or B3 fails, REC the finder before anything reads the tree.
4. Build the act adapters and append acts to the ledger. Unit-test the address rule, the grain rule and the law-of-holons invariant.
5. Build the document-level reopening pass and the outside check. Run B5 to B10. Write a results file beside this plan with every number, pass or fail.
6. Only then change the view (§5).
7. Then the essay: "how does it read", level by level, from the act record and the results, failures included. This is the fold suite's open `how-it-reads-essay` goal; it is written from this record and revises `HOW-IT-READS-FOR-LISTENING.txt` where the record disagrees with it.

## 9. What this plan does not do

- It does not build the organs it will expose as missing: nesting who-says-what, forming a Kind, reading the Atmosphere. Their cells show as gaps with no organ.
- It does not type units as emanon, protogon or holon.
- It does not ask the cube what a unit is. Every face is of the reader's acts.
- It uses no frontier model.
- Nothing runs on hyphae.

## 10. Decisions before freezing

1. **Eight or nine** operators per unit: **nine** (decided 2026-10-24; §2.4).
2. **A small local model reader**: **not included** (decided 2026-10-24, when the go-ahead came without a yes for it). It can be added only by a REC that declares its own bars. R8 is the reader without the hyperlexicon.
4. **Aliases, not abbreviations** (2026-10-24, from you): an abbreviation is an alias the hyperlexicon resolves; the invented-token abbreviation documents and the document-level abbreviation test are dropped; every organ may consult the hyperlexicon (§2.2a).
3. **M4**: the bar is fixed now (B4); the two texts wait on your yes to download them on this Mac. Until they are fetched and hashed, B4's cross-script part is reported as not run, never as passed.


## Appendix — material and code at the freeze (sha256)

| what | sha256 |
| --- | --- |
| M1 01-news-council-vote.txt | bd83fe8b7b425fcbb612b3f638aa62ac36101a23966fc861daf344166bee86ef |
| M1 02-biography-ada-lovelace.txt | ad687108f246f77d1e6f50fe68ac4c627c932833ebd0e3bd6c4674adddc4954d |
| M1 03-science-photosynthesis.txt | 8cb30bf326fc5ec7e97db6150f5534dbdc41a3be3e7d988c2f2ed31dd0149104 |
| M1 04-contract-lease.txt | ef35dafccaec037c137230236f58533ca7a18d605639698e8666d75fc5561169 |
| M1 05-fiction-lighthouse.txt | c4c8bf5e516700c8f599292d1629308474d809ffa23153e0553a79bbb60be9aa |
| M1 06-email-project-update.txt | 8b4b1353f7ad4637618963e15bcae2cb5e5568ede9dbd6b208b09b4088efdb5a |
| M1 07-history-printing-press.txt | 2256346814b9adae5ba340eb73eba7a5c6971aae9165451802e97c0092caf26e |
| M1 08-recipe-flatbread.txt | 69582500ef4cbadef899bec825abbfa399a0e25a1ca6a0a7acf7c8e1f94200c7 |
| M1 09-opinion-city-parks.txt | 9017431a721b7cd0aee6b5556abfe4c00ed6963adaac2fd8779df4fac4a394b4 |
| M1 10-ambiguous-pronouns.txt | 1493ee7844068842d4b725f227708131cd40bec6d905cb3270213db26fc0079e |
| M2 source: holodeck-samples/titanic-1912/readings.json | f9deeb622dd454a42ea1892ff8d74e0a8b26a108e7140d383f0683c6e7d56f17 |
| M2 and M5, as built (holarchy-material/manifest.json, per-file hashes inside) | 1e56c13b094200b096420b4542d9d6ecba8b8dc0d9fb89e9e2672e55d281646c |
| M3, as built, seed 20261024 (holarchy-material/m3/manifest.json, per-file hashes inside) | 009e88d9eda1af944e5cd4ffb15d0b96a24a68cee9d00aa492cb22b7503b4fbb |
| generator reading/eval/holarchy/m3-build.mjs | 703d31ce5abd3f1b34fbbcf1f1d4a6e218edec96680d05e411cf003a7170c470 |
| generator reading/eval/holarchy/m25-build.mjs | 55da726e0036700d8f4ea64661db0a6b0ad7cab35a11b3b9bfb8f4c417ce4943 |
| the hyperlexicon's local giver: wiktionary-slim-2026-10-01-v3.pack | 6eba1b056a00193440ce1130cbb709916e7ec82a4175ac7f37019a59d6d18a61 |

The built material lives outside the public repository, in `holarchy-material/` beside it, because M3 reuses your sample sentences; the generators and these hashes are committed. The reader at the freeze is the Holodeck at commit c62d0bf.
