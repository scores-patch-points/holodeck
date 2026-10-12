# Research assistant — pre-registered falsification record

Written **before the first run against the real web**, on 2026-10-12. The instrument is the code at commit
`33a870a` on branch `claude/holodeck-research-assistant-babe7f` (pure modules `holodeck-research-null.js`,
`holodeck-research-read.js`, `holodeck-research.js`, `holodeck-research-terrain.js`, `holodeck-research-lanes.js`;
the page wiring in `index.html` comes after this file and may not change any of the rules below).

**The predictions in Part 2 are never edited.** Results go in Part 3, appended below the line, with the run's own
record attached. What failed goes in Part 4. Anything that is not established goes in Part 5.

## Part 1 — What is being tested, and by what rule

The assistant takes a topic or question, searches the lanes the fold already has, reads what clears a relevance null,
stops when reading more stops teaching it more than chance, and lays the corpus out by terrain. Three decisions are
statistical, and each is "outside every one of 199 draws" (`holodeck-region.js`'s convention, 1/200 resolution):

| Decision | Statistic | Null |
|---|---|---|
| Is this candidate / page about the question? | G² keyness of the question's terms against General English (the `live_priors` prior the Holodeck already loads) | the same-length stretch of ordinary English, 199 draws, each term's count ~ Poisson(L·p) |
| Has reading more stopped teaching it anything? | *(superseded — see Amendment 1)* referents carried across the earned line by the latest batch of 3 | *(superseded)* a popularity-weighted re-draw of the corpus, 199 draws |
| Is a tie / echo / source grouping real? | shared statements / shared wording / shared earned referents | same-size random overlap (uniform for statements, popularity-weighted for referents), 199 draws |

Constants that are not statistical, declared: **199** draws; **3** pages fetched at once (a memory limit — each read
parses a document in the tab; also the unit of the stopping test). There is **no** source cap, page cap, time cap or
"top N". The person's own Stop is the only other way a run ends.

## Amendment 1 — the stopping rule, changed after a shakedown and BEFORE any registered run

Recorded 2026-10-12. The instrument named at the top (`33a870a`) stopped on *corroboration gain against a re-sampling
null*. A shakedown run on a question that is **not** one of the three registered topics (`Who built the Eiffel Tower
and why?`, the browser pane, Wikipedia + Crossref lanes) showed that rule to be biased: it read 6 sources, stopped
with 33 admitted candidates unread ("the last batch carried 20 referents across the earned line; re-sampling carried
up to 26"). In a heavy-tailed corpus ~90 % of names are heard once, so a popularity-weighted redraw lands mostly on
that tail, while real on-topic sources hit the core — so "inside the null" was the answer almost by construction.

Replaced by **saturation**: with f1 = the names and 4+-letter words said by exactly one source and n = sources read, one
more source is expected to bring about f1/n items nobody has said (Good–Turing); the run stops only when the largest of
the n leave-one-out estimates is **below one item** (the floor of a count), and is untestable below three sources. This is
a one-unit floor, not a drawn null — said so plainly in the README. A corpus of mirrors saturates at once; a diverse one
essentially never does, and the run then ends where the relevance null ends the pool, listing every cleared-but-unread
candidate as `held`.

Nothing in Part 2 is edited. What changes in how it is read: P6's `inside-the-null` is now the reason `saturated`;
P7 (batches before the stop) and P10 (stop not premature) apply only to runs where the stop fires, and I predict it will
fire for **none** of the three (a diverse corpus does not saturate) — so P6 is expected to **fail**, and that is the
honest outcome the record should show. The registered runs use the commit that follows this amendment.

## Part 2 — Predictions (frozen)

Three questions of different shapes, run through the real UI in the browser pane, one run each, nothing re-run to improve
a number:

* **T1 (a contested factual question):** `Who first proved the Pythagorean theorem?`
* **T2 (a bare entity):** `Tennessee Valley Authority`
* **T3 (a technical how-question, JS-heavy web):** `How does WebGPU let a browser run a language model locally?`

Off-topic nulls: the other two topics' questions, and a fixed control, **C0** `How do I feed a sourdough starter?`.

For each topic, before seeing anything:

| # | Quantity | Prediction |
|---|---|---|
| P1 | candidates found (all lanes, deduplicated) | 25–90 |
| P2 | share of candidates that clear the snippet null | 25–75 % |
| P3 | kept sources (read, text clears the null, ingested) | T1 6–20, T2 6–25, T3 5–18 |
| P4 | read success (admitted candidates that returned text) | ≥ 60 % for T1 and T2; ≥ 40 % for T3 (JS-heavy docs, typed unread) |
| P5 | pages read but refused as not about the question | ≤ 15 % of read |
| P6 | stop reason | `inside-the-null` for at least two of the three (not exhaustion, not abort) |
| P7 | batches before the stop | 2–5 |
| P8 | **relevance precision** — kept sources I judge on-topic from title+URL alone, scores hidden, judged before the scores are opened | ≥ 85 % per topic |
| P9 | **off-topic null** — kept sources of topic A that also clear the relevance null for topic B's question or for C0, using their full text | ≤ 5 % per (A, other) pair |
| P10 | **stop is not premature** — a control run of the same question with the stop disabled (same seeds) ends with at most 10 % more earned referents than the corpus had when the null would have stopped it | holds for T1 and T2 |
| P11 | **terrain coverage** — SEEN registers (Sources, Names, Types, Figures, Statements, Connections) non-empty | ≥ 5 of 6 for every topic; Figures may be empty for T1 |
| P12 | earned referents (witnessed by ≥ 2 sources) | ≥ 10 per topic, and heard-once is the larger share (≥ 50 % of referents) |
| P13 | Connections: ties that beat the null | ≥ 1 per topic |
| P14 | Patterns: at least one group of ≥ 2 sources tied beyond chance | T2 yes; T1 and T3 not predicted |
| P15 | provenance — every entity, statement, figure and tie row carries a source id and a span that slices back out of that source's text | 100 % (a single exception falsifies) |
| P16 | typed gaps — every unread / turned-away / off-topic / lane-failed entry carries a non-empty `why` | 100 % |
| P17 | wall-clock from the click to the stop, in the pane | ≤ 150 s for each topic |
| P18 | consent — no search request leaves the page before the person clicks the one button that names the hosts | 0 requests before the click (checked in the network panel) |

### What would count as the assistant failing

Any one of: kept sources < 4 for a topic (it under-reads); P8 < 70 % for any topic; P9 > 15 % for any pair (the null
does not discriminate); P10 violated for T1 or T2 (the stop is premature); a run that ends `no-candidates` on a topic
whose lanes answered; a row with no address (P15) or a gap with no reason (P16); any request before consent (P18);
or a page that cannot be read being shown as read.

### Controls

* **Ordinary-English control** (offline, `holodeck-research-terrain.test.mjs`): ≤ 2 % of 300 stretches of ordinary
  English of every length clear the relevance null. Measured while building: 0.3–0.7 %.
* **C0** is run through the same gate against each topic's kept sources (P9).
* **Stop control** (P10) as above.

## Part 3 — Results

*(appended after the runs; the run records are attached under `docs/research-runs/`)*

## Part 4 — What failed

*(appended after the runs)*

## Part 5 — What is not established

*(appended after the runs; the standing list is kept in the README's "Research assistant" section)*
