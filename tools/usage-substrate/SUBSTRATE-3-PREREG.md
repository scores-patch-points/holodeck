# SUBSTRATE-3 — the paired order test. Pre-registered 2026-11-03, after SUBSTRATE-2's result, before any SUBSTRATE-3 code runs.

**What SUBSTRATE-2 found.** S3 passed (3/4: long, distant, old) but the control failed: one shuffle against another "selected" 13,933
pairs, 34% of the real run's 41,322. The rule c_real > Poisson(c_shuf) treats the shuffled count as a known mean, but it is itself a draw;
two draws of one mean differ by more than Poisson(one of them) allows.

**The change (only this).** Under the null (order made no difference) the real and shuffled counts of a cell are two draws of one mean, so
given their sum n, c_real ~ Binomial(n, ½). Q selects w at an offset when c_real ≥ 5 and the one-sided tail P(X ≥ c_real | n, ½) < 1e-5
(about a million cells are tested; 1e-5 expects about ten false selections). Strength = log((c_real+0.5)/(c_shuf+0.5)). Everything else as
SUBSTRATE-2, same seeds.

**Bars unchanged.** S3 (pass if ≥ 3 of 4). S4′: the control (second shuffle against the first, same rule) selects fewer than 1% as many
pairs as the real run, and fails S3. One run, scored once. If S4′ passes, this substrate is the one wired into the Ask.
