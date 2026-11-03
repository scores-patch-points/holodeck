# FRAMES-2 — measured reach and Same per use. Pre-registered 2026-11-03, after FRAMES-1's result, before any FRAMES-2 code runs.

**Why.** FRAMES-1 (reach 1 declared, one λ per type) found numbers and a single class of measure nouns, but no dimension (length vs
money vs weight vs time) and gave `feet` one meaning (it fell in with body parts). Both are terms of the Same formula FRAMES-1 did not
run: U's widening, and sameness of uses rather than types.

**Material.** As FRAMES-1: hyperlexicon v1 `fa9add32`, the 5,949 English documents, 236,712,726 tokens, read-only.

**Lens W (declared).** Substitution: a word's world is the positioned words around it, offsets ±1 … ±r.
**Capacity bounds (frequency rank only):** targets = top 15,000 English types; context words = top 4,000; r capped at 3.

**U(x), measured.** λ_r(x) = positive PMI of x's positioned context counts at offsets ≤ r, L2-normalised. Widening r→r+1 changes the
fold by 1 − cos(λ_r(x), λ_{r+1}(x)); chance at r+1 is 1 − self_{r+1}(x), self being cos between λ from even and odd documents. x's reach
r*(x) is the first r where widening's change ≤ chance; else 3.

**Same(a,b)** at reach max(r*(a), r*(b)): cos(λ(a), λ(b)) > null_r ∧ self_r(a) > null_r ∧ self_r(b) > null_r, null_r = the 99.9th
percentile of cos over 200,000 random target pairs within the same frequency decile at that reach. (U(a) ≈ U(b) beyond sharing a reach is
not tested; owed.)

**Same per use (senses).** A word's uses (up to 30,000, every k-th in document order) each carry their positioned context at the word's
reach. Split the uses in two (spherical 2-means, deterministic start). Keep the split only if the two parts are **Other**
(cos(λ(part1), λ(part2)) < null_r) and each part is the same as itself across even/odd documents (> null_r) and holds ≥ 300 uses; then
try to split each part again (depth cap 3). The number of senses is not chosen: the null decides. Each kept sense gets its own Same set.

**Gold (fixed now, used only to score):** LENGTH, NUMBER, MONEY, WEIGHT as FRAMES-1; TIME = seconds, minutes, hours, days, weeks,
months, years; BODY = hands, fingers, legs, arms, eyes, knees, shoulders, heels, toes, head, lips, ears.

**Bars (pass/fail, published either way):**
- C1 reach is measured, and measure nouns need it: r* ≥ 2 for at least 4 of inches, shillings, ounces, gallons, minutes.
- C2 dimension splits: in its top 20 Same at measured reach —
  `inches`: ≥ 3 LENGTH, ≤ 1 MONEY-only, ≤ 1 WEIGHT-only, ≤ 1 TIME;
  `shillings`: ≥ 3 MONEY, ≤ 1 WEIGHT-only, ≤ 1 LENGTH, ≤ 1 TIME;
  `ounces`: ≥ 3 WEIGHT, ≤ 1 MONEY-only, ≤ 1 LENGTH, ≤ 1 TIME;
  `minutes`: ≥ 3 TIME, ≤ 1 MONEY, ≤ 1 LENGTH, ≤ 1 WEIGHT. Pass if at least 3 of the 4 hold.
- C3 `feet` has senses: it splits into ≥ 2 kept senses, one whose top 20 holds ≥ 3 LENGTH and another whose top 20 holds ≥ 3 BODY.
- C4 numbers survive: `three`'s top 20 holds ≥ 8 NUMBER.
- C5 control (falsifier): with tokens shuffled within each document, C2 and C3 must both fail. If shuffled text also splits dimensions or
  senses, FRAMES-2 fails as a whole.
- One run each, scored once; nothing tuned on the seeds.
