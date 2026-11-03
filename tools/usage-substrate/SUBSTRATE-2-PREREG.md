# SUBSTRATE-2 — selections against a per-pair order null. Pre-registered 2026-11-03, after SUBSTRATE-1's result, before any code runs.

**What SUBSTRATE-1 found.** S1, S2, S4, S5 passed; S3 failed: the selection null was one global ceiling (99.9th percentile of PMI over the
shuffled run, per count band, ≈ 6.5). Shuffling within a document keeps each document's vocabulary together, so topical pairs keep high
PMI shuffled, and that ceiling is out of reach for ordinary order-made pairs.

**The change (only this).** Licensing and measure nouns exactly as SUBSTRATE-1. A question word Q selects a measure noun w at an offset
when the order made a difference to that pair: c_real(w, Q@offset) ≥ 5 and c_real exceeds the 99.9th percentile of Poisson(λ = max(c_shuf,
0.5)), c_shuf being the same cell's count over the same documents with tokens shuffled within each document. Strength = log((c_real+0.5)
/ (c_shuf+0.5)); the best offset is kept.

**Control (falsifier, replaces S4's selection half).** A second shuffle (another seed) is treated as "real" and compared against the first
by the same rule. It must select fewer than 1% as many (Q, w) pairs as the real run, and fail S3.

**Bars.** S3 as SUBSTRATE-1 (`long` ≥ 3 LENGTH ∧ ≤ 1 MONEY-only; `cost` ≥ 2 MONEY ∧ ≤ 1 LENGTH; `distant` ≥ 2 LENGTH; `old` ≥ 2 TIME;
pass if ≥ 3 of 4). S4′ the control above. S1, S2, S5 re-reported. One run, scored once.
