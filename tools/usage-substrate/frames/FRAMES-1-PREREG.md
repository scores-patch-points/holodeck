# FRAMES-1 — do word classes emerge from Same vs Other, with nothing hand-picked? Pre-registered 2026-11-03, before any run.

**Question.** The unit test so far chose its frame (`NUMBER ___ long`), its adjectives and its number words. That is a typed list one
level up. Here nothing is chosen except the lens and capacity bounds: frames are the most frequent contexts, and classes are what the
Same formula (identity `src/same.mjs`) says is the same.

**Material.** hyperlexicon v1 head `fa9add32`, VM postings, read-only. Documents whose `lang` is `en` in `v1/docs.json`.

**Lens W (declared).** Paradigmatic substitution at reach 1: a word's world is the distribution of immediate frames `L ___ R` it fills.
Reach 1 is declared, not measured: U's widening test (does reach 2 change the fold beyond null?) is NOT run in FRAMES-1 and is
owed to FRAMES-2. A pass here licenses classes at reach 1 only.

**Capacity bounds (by frequency rank only, no word named):** targets = the 20,000 most frequent English types; frame words = the 2,000
most frequent; frames = the 3,000 most frequent `(L,R)` pairs over frame words.

**The formula, applied.**
- λ(x) = x's difference from the average word: positive PMI of its frame counts, L2-normalised.
- Δ(x) > null, operationalised as self-sameness: cos(λ_A(x), λ_B(x)) between even- and odd-numbered documents exceeds the null. A word
  that is not the same as itself across halves is not a concept and is refused.
- null = the 99.9th percentile of cos(λ(a), λ(b)) over 200,000 random target pairs drawn within the same frequency decile.
- Same(a,b) ⟺ cos(λ(a), λ(b)) > null ∧ self(a) > null ∧ self(b) > null. Other otherwise.

**Gold (fixed now, used only to score):**
- LENGTH = inches, inch, miles, mile, yards, yard, foot, metres, meters, fathoms, leagues, furlongs, paces, cubits, rods, kilometres
- NUMBER = one, two, three, four, five, six, seven, eight, nine, ten, eleven, twelve, twenty, thirty, forty, fifty, hundred, thousand
- MONEY = pounds, shillings, pence, guineas, francs, dollars, crowns, cents, sovereigns, marks
- WEIGHT = ounces, pounds, lbs, tons, grains, stone, hundredweight, drachms

**Bars (each pass/fail, published either way):**
- B1 units emerge: for each seed of `feet`, `miles`, `inches`, its Same set ranked by cos holds ≥ 5 LENGTH words in its top 20.
- B2 numbers emerge: `three`'s top 20 Same set holds ≥ 8 NUMBER words.
- B3 Other: Same(`feet`, `three`) is false, and no NUMBER word is in `feet`'s top 20.
- B4 money vs weight: `shillings`' top 20 holds ≥ 3 MONEY words and ≤ 1 WEIGHT-only word (ounces, lbs, tons, grains, stone,
  hundredweight, drachms); `ounces`' top 20 holds ≥ 3 WEIGHT words and ≤ 1 MONEY-only word (shillings, pence, guineas, francs, dollars,
  crowns, cents, sovereigns, marks).
- B5 control (falsifier): the same pipeline over the same documents with tokens shuffled within each document must fail B1 and B2.
  If the shuffled corpus also "finds" units, the method is finding topic, not class, and FRAMES-1 fails as a whole.
- B6 not overfit: seed words were not used to choose any parameter; the run is one pass, scored once.
