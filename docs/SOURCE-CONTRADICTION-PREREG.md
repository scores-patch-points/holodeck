# Source contradiction — when two sources state the same referent two ways

Pre-registered design record. Written **before any code**. Predictions below are
never edited after the fact; results are appended under "Results" with the
commit they were measured at. If a prediction fails, the failure is recorded
next to it, not rewritten.

The goal, in the operator's own words: to be able to say **"these two sources
are contradicting each other"** — and to have the *identity assertion of the two
values* really make sense, and to be *relative to the observer*.

## The seam

The holodeck already detects disagreement, and already owns the identity law.
They have never been joined.

* `holodeck-relations.js` — `verdictOf` (line 405) compares value tokens across
  statements and returns `differs` when two statements share a value *key* but
  carry different values; `findingFor` (line 453) renders it as *"Different
  figures for the same thing: '711' here, '705' there."* This is the mechanical
  contradiction detector. Its identity assertion is `x.key === y.key` — a
  unit-string match ("dollars", "saved"). That is a **name-string identity**,
  the exact move the nameless-referent principle forbids: the unit word stands
  in for the referent, when the referent is *the number of lives lost*.
* `vendor/eoreader7/native/kernel/identity.js` — the identity law, vendored.
  `deriveIdentityRevisionForWhom(forWhom, { supports, attacks })`: identity
  exists only for-whom (S113); support opens/strengthens an
  `EOIdentityAlternative@1` (CON), **attack is "constitutive contradiction"** —
  SEG splits the forms, DEF records `identity_reading_refused`. A frameless
  identity decision is a view from nowhere.
* `vendor/eoreader7/native/kernel/identity-meet.js` — `survivingIdentityAtPoints`
  (the **meet over for-whoms** at the referent/point level) and
  `survivingIdentity` (the meet at the form level). A pair is the same being iff
  some admissible frame holds it and none splits it. A pair one frame joins and
  another divides is a **for-whom-local reading** — the falsifier.
* `vendor/eoreader7/native/organs/asserted.js` — the assertion tier for relation
  edges: `standingOf` (witness floor = 2) and `orderArm` (word-salad null), so an
  edge carries *counted* support rather than a bare string match.
* `vendor/eoreader7/native/kernel/for-whom.js` — `createForWhom({ id, giver,
  question, … })` and `gateForWhom(forWhom, entries, opts)` (coherence +
  material + question relevance). The observer's question is a first-class
  field on the frame.

The identity events are already folded into the reading surface (`reading-index.js`
tracks `EOIdentityAlternative@1`, `identity_split`, `identity_reading_refused`),
and every cast referent is already for-whom-framed (`holodeck-reading.js` →
`readerFrame`; frameless → `EOReferentGap@1`). **But `identity-meet.js` and
`asserted.js` are vendored dead code — nothing non-vendor imports them — and
`verdictOf` never asks the identity question at all.**

The work is: route `verdictOf`'s "differs" through the identity law, so a
contradiction is an **identity assertion decided for-whom and survived by the
meet**, not a unit-string collision.

## The semantic model (the crux)

Two questions must never be conflated:

1. **Referent identity** — are "1490" and "1635" both *the number of lives
   lost*? This is what makes them comparable at all. It is decided **for-whom**
   (the observer's question is what names the referent) and survives the
   **meet** over admissible for-whoms.
2. **Value agreement** — "1490" vs "1635": do they agree? This is the
   contradiction itself.

A contradiction is **identity-HOLD + value-SPLIT**:

* identity-HOLD — both values denote the same referent *for this frame* (the
  `EOIdentityAlternative` survives: every admissible for-whom identifies them,
  none splits them).
* value-SPLIT — the values differ (1490 ≠ 1635).

`verdictOf` today does the second half and *guesses* the first half from the unit
string. The improvement makes the first half a real assertion and makes it
for-whom-relative:

* For the observer asking **"How many lives were lost?"**, "1490" (British
  table, 2201−711) and "1635" (Logan Marshall) and "1503" (Beesley, 815+688)
  are the *same referent* — three answers to one question — and they differ →
  **a contradiction**.
* For a different observer asking **"How many were saved?"**, "711" and "705"
  are the same referent; "1490" and "1635" are *different referents* (lost, not
  saved) → **not a contradiction between those two**, whatever the strings say.

The identity is relative to the observer because the observer's question is
what constitutes the referent; a bare "saved" vs "lost" string match would miss
exactly this. This is S113 made mechanical over values, not only over beings.

## The Titanic contradiction record (what the demo would surface)

The demo's own "try" questions are built for this. The 8 sources genuinely
disagree:

| referent (for the observer's question) | values, byte-addressed to their sources |
|---|---|
| lives lost | 1490 (British report table: aboard 2201 − saved 711) · 1635 (Logan Marshall, "Total number of Titanic's company lost") · 1503 (Beesley: "815 of her passengers and 688 of her crew were drowned") · "nearly 500 … needlessly sacrificed" (Senate speech — a *different* referent: needless loss, not total loss) |
| lives saved | 711 (British table) · 705 (Marshall) · 705 (Beesley) |
| the band's last music | "ragtime and 'Autumn'" (Marshall) · the hymn tradition implied across the 1912 accounts |
| the wreck's discovery | silent in every 1912 source — only the 1997 screenplay can speak (1985). A typed gap, never a contradiction. |

The Senate speech's "nearly 500 … needlessly sacrificed" is the demonstration of
the whole point: it is *not* a contradiction of "1490/1635/1503" — it is a
*different referent* (needless loss, a moral claim) that a unit-string match
("lost") would wrongly fold into the same contradiction.

## What would embarrass it

Each line is an embarrassment, the measurement that would expose it, and the
**control built to fail** — a deliberately wrong implementation the same
measurement must catch.

| # | Embarrassment | Measurement | Control that must fail |
|---|---|---|---|
| E1 | Two values are called "a contradiction" when they are different referents (e.g. "1490 lost" vs "705 saved"). | Pure: given two value statements and a for-whom, the contradiction record is emitted only when the identity alternative survives the meet **and** the values differ. | A detector that flags any two differing figures sharing a unit string ("lost"/"saved" both carry "dollars" or a shared noun). |
| E2 | The identity is asserted from nowhere (frameless), so the surface claims a global "these disagree" when it is only one frame's reading. | Pure: a contradiction record carries its for-whom (id, giver, question); with no for-whom the record is refused (typed gap), never emitted bare. | A `verdictOf` that compares values without receiving a for-whom. |
| E3 | A for-whom-local split is reported as a global contradiction (one frame identifies the two values as the same referent, another divides them). | Pure: `survivingIdentityAtPoints` over two frames that disagree on identity yields a **survivor** only when none splits; a joined-then-divided pair lands in `splits`, disclosed as for-whom-local. | A meet that unions the frames' relations instead of intersecting them. |
| E4 | The contradiction is a single-witness wording match ("saved" appears once in each), asserted as a fact. | Pure: the contradiction edge carries `standingOf` — below the witness floor (= 2) it is `single-witness` and disclosed as such; the orderArm count is reported, never a verdict. | A string-match that sets `standing: corroborated` on one occurrence. |
| E5 | A genuine disagreement is hidden because the values carry different units or the referent is phrased differently. | Pure: the identity alternative is opened from the for-whom's question terms, not from the unit string, so "711 saved" and "705 rescued" and "705 saved" are the same referent. | A match that requires byte-equal unit strings. |
| E6 | The 1997 screenplay (1997) is treated as a 1912 source, or a 1912 source is cited for 1985. | Pure: the contradiction record carries each value's year; a value the source cannot have known (wreck discovery, 1985, cited to a 1912 book) is a typed gap, not an assertion. | A record that ignores the source's year when binding a value. |
| E7 | The surface renders a contradiction as one resolved number instead of disclosing the contested values. | Pure: the record carries every value with its byte span; the panel shows them side by side (the `holodeck-ambiguity.js` "disclose contested, don't collapse" contract), never a single picked total. | A renderer that prints only the largest figure. |
| E8 | The observer cannot see *why* they are the same referent. | Pure: the contradiction record carries the for-whom's question and the identity's support (which statements fold into it); the panel shows the question the observer asked. | A record that drops the frame and shows only "1490 ≠ 1635". |

## Predictions about the numbers

* **P-identity.** The identity of two value statements is decided by the
  for-whom's gate (`gateForWhom`): coherence + material + question relevance.
  A value pair the observer's question does not touch is refused *before* any
  value comparison (zero false contradictions from off-topic figures).
* **P-meet.** `survivingIdentityAtPoints` over the Titanic "lives lost" frames
  (observer's question = "how many lives were lost") holds the referent for
  {1490, 1635, 1503} and **splits** the Senate speech's "nearly 500 needlessly
  sacrificed" — the speech's value is a for-whom-local reading, disclosed, not
  a contradiction.
* **P-floor.** The "saved" contradiction (711 vs 705) clears the witness floor
  (each value is stated once independently, and the pair recurs); the "band
  played" question stays contested (Marshall says "ragtime and 'Autumn'"; the
  hymn tradition is implied, not a stated figure) and is disclosed as
  *contested*, never as a settled contradiction.

## Declared constants

* `WITNESS_FLOOR = 2` — reused from `organs/asserted.js` (`standingOf`), the
  recurrence floor the engine already holds ("came round again" is 2 by the
  meaning of the word). Never walked against a golden.
* The for-whom gate's own numbers (`nullDraws`, `nullSeed`, `minRelevance`, …)
  are `gateForWhom`'s, declared in `for-whom.js`, not re-declared here.

## What is out of scope, and why

* **Reading *into* a resolved answer.** The contradiction record is disclosure,
  not adjudication. The observer holds the values together; the surface does not
  pick a winner. (The `holodeck-ambiguity.js` contract, unchanged.)
* **Cross-language value identity.** The 8 Titanic sources are English. The
  value-referent identity rests on the for-whom's question terms in one script;
  cross-script value identity is a named gap, not assumed.
* **The ask door.** The "try" questions currently route to ask; surfacing the
  contradiction record there is a *later* step. This record is the pure
  module + the Seam/Statements panel first.

## Falsifying controls (the doubt section)

A contradiction record is the kind of claim that can be silently wrong in one of
three ways, and each has a control that would prove it wrong:

1. **False same-referent** — two values folded into one contradiction that are
   really different facts. Control: the Senate speech's "nearly 500 needlessly
   sacrificed" must land in `splits` (a different referent), never in the "lives
   lost" contradiction. If it is folded in, the identity assertion is weaker
   than the nameless-referent principle requires.
2. **False contradiction from a unit-string match** — E1's control. If the
   detector flags "1490 lost" against "705 saved" because both are "people
   figures", the seam has not actually wired identity; it has relabelled the old
   `x.key === y.key`.
3. **Frameless assertion** — E2's control. If a contradiction can be emitted
   without a for-whom, the "relative to the observer" requirement is decorative.

Not established until the build, and reported as such if it cannot be: whether
the identity-meet over the *point* level (not the form level) is what the demo
needs, or whether the form-level `survivingIdentity` is enough when the values
are the surfaces themselves. This is the one open seam; the build decides it by
which meet puts the Senate speech in `splits` and the three "lives lost" figures
in `survivors`.

## Results

(appended below, never edited above)

### R1 — the fixture passed; the demo did not (2026-10-16, `topics-holograph-profile`)

**The pre-registered fixture is not the live corpus.** The predictions above are
written over an idealised eight-source table (1490 / 1635 / 1503 lost, 711 / 705
saved). The sample the demo actually loads
(`holodeck-samples/titanic-1912/readings.json`) does not state those numbers. Its
"lives" figures are **capacity and loss** mixed: "nearly 500 people were
needlessly sacrificed" (Senate speech), "106 people" (third-class berths), "1,178
persons" (lifeboat capacity), "1,200 persons", "3,100 people" (lifeboat
capacity). E1–E8 pass on the fixture; the fixture was never the demo. This is
recorded as a **misprediction of the corpus**, not of the law.

**The seam was wired but the identity was still by appearance.** The first build
read a figure's referent off the words *around* it: the observer's question terms
were matched against a window of prose. Measured on the live corpus:

* "What did the band play as **the ship** sank?" folded the ship's engine
  **revolutions** (60, 70, 75, 78, 165) into one referent — the span `"ship"` —
  and called them a contradiction.
* "How many lives were lost?" matched **nothing** and found **no** contradiction
  at all, because the declared measure was the unit word (`people`, `feet`,
  `ton`), which the question's terms do not touch.

Both are the same failure II.7 names: a **span is not a referent**. "The ship" and
"13 ships" and "a ship of the desert" are not one thing.

### R2 — the fix: the referent is the holograph's (the being + the measure)

`referentOf` now reads the referent from the value's **declared** holograph fields
— the being (`anchor`, a canonical admitted referent) and the measure the figure
stands under — and **never** from the window. A value declaring neither is a typed
gap. The key qualifies the measure with the being, so two beings never fold onto
one referent even where the measure word agrees. The wiring
(`contradictionForUnits`) now rides the holograph's own **measure topics**
(`holoTopics`), which are already the discrepancy register: one figure-slot the
sources share *for one being*.

**Measured on the live corpus** (`?ws=titanic-1912`, 11 docs, 3,561 statements):

| question | result |
|---|---|
| "What did the band play as the ship sank?" | **no contradiction** — the span "ship" is not a referent (the revolutions are not folded) |
| "How many lives were lost?" | **no contradiction** — no measure topic holds that referent in this corpus (honest gap) |
| "What was the Titanic's tonnage?" | **one contradiction**: `R.M.S. Titanic · tonnage` — **45,328 · 46,328 · 60,000 tons**, standing **corroborated** (3 independent source-pairs), each value byte-addressed |

The one live disagreement is `R.M.S. Titanic · tonnage`, exactly as the topics
predict. The referent the record carries is
`tonnage\u0001R.M.S. Titanic` — the measure qualified by the being. P-meet and
P-floor are **not established**: the corpus holds no "lives lost" measure topic,
so the predicted {1490, 1635, 1503} survivor set cannot be measured here. That is
a gap in the corpus, and it is named, not guessed.

### R3 — what is left open, and why

* **The measure must come from the relation, not the unit.** The holograph's
  measure for "106 people" (berths) and "500 people … sacrificed" (loss) is the
  same unit word today, so the two are not yet distinguished as referents. The
  fix is to read the measure from the statement's own relation (the verb / the
  tuple), which the `eot` triples do not yet carry on this corpus (measured: 0
  triples on the figure-bearing statements). Named, not guessed.
* **Pronominal beings.** Most "lives" figures sit in statements with `names: []`
  ("she", "the ship", "the vessel"); the holograph's anchor must reach them by
  coreference (the document's own referent), not by their own surface. The measure
  topics currently drop an anchorless figure ("a figure with no anchor is about no
  one"). This is the next step, and it is where "ship" must resolve to the being
  through the source's own reading — never through the span.
* **The demo's try questions.** The sample's three try questions were built for
  the idealised table. "What was the Titanic's tonnage?" is added so the demo can
  show the one contradiction the corpus actually holds.
