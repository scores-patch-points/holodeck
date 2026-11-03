# SUBSTRATE-1 — giver-nominated numbers, licensed by use; measure nouns and question-word selections. Pre-registered 2026-11-03,
# after the digit-anchored attempt failed (digits are Same as footnotes here, not as "five"), before any SUBSTRATE-1 code runs.

**Material.** hyperlexicon v1 `fa9add32`: the 5,949 English documents, 236,712,726 tokens, read-only. Giver: Wiktionary as held in
hyperlexicon v2 (`names`, part of speech `num`), asked for the 14,219 alphabetic targets: 74 candidates (`giver-num.json`), noise included
(i, a, do, free, tree, google …). A candidate licenses nothing until use does.

**Licensing (Same vs Other).** λ = positive PMI over ±1 positioned context (top 4,000 context words), L2-normalised. A candidate is
licensed when cos(λ(c), centroid of the other licensed candidates) > null, null = 99.9th percentile of cos over 100,000 random target
pairs. Start with all candidates licensed; drop those below null; recompute the centroid from the survivors; repeat until no change
(cap 10 rounds). Digit tokens join the class structurally.

**Measure nouns.** share(w) = uses of w written straight after the licensed class ÷ uses of w. The null is the same share computed with
the SAME class over the same documents with each document's tokens shuffled; a measure noun has share above the shuffled 99.9th
percentile and ≥ 20 such uses.

**Selections.** For a context word Q, PMI(w, Q at offset ±1..±3) over cells with ≥ 5 co-occurrences; the null is the shuffled run's
99.9th percentile within the same count band (5–9, 10–19, 20–49, 50–99, ≥ 100). Q selects w when w is a measure noun and PMI beats null.

**Gold (fixed, scoring only):** LENGTH, MONEY, WEIGHT, TIME, NUMBER as FRAMES-1/2.

**Bars:**
- S1 licensing works: ≥ 80% of the candidates that are in NUMBER are licensed, and ≤ 20% of the licensed are outside NUMBER ∪
  {millions, million, dozen, zero, aught, naught, sixty, seventy, eighty, ninety, thirteen, fourteen, fifteen, sixteen, seventeen,
  eighteen, nineteen} (numerals the gold list omits).
- S2 measure nouns emerge: the measure set holds ≥ 15 words of LENGTH ∪ MONEY ∪ WEIGHT ∪ TIME.
- S3 the question word selects its dimension: `long` selects ≥ 3 LENGTH and ≤ 1 MONEY-only; `cost` selects ≥ 2 MONEY and ≤ 1 LENGTH;
  `distant` selects ≥ 2 LENGTH; `old` selects ≥ 2 TIME. Pass if ≥ 3 of 4.
- S4 control: the shuffled run's own measure set is < 10% the size of the real one, and S3 fails on it.
- S5 no unit word in the code that builds or reads the substrate.
One run each, scored once.
