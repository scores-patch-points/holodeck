# FRAMES-2 result — scored once against FRAMES-2-PREREG.md (2026-11-03)

Material as FRAMES-1 (5,949 English documents, 236,712,726 tokens). ~4 min per run on the VM. Nulls by reach: 0.458 / 0.416 / 0.401.

| bar | verdict | what happened |
|---|---|---|
| C1 measure nouns need reach | **FAIL** (3/5) | shillings r3, minutes r3, gallons r2; inches r1, ounces r1. 89% of targets stop at r1; 7% r2; 4% r3. |
| C2 dimension splits | **FAIL** (2/4) | inches → inch, leagues, feet, paces, miles (+ ounces, reams): passes. shillings → pence, guineas, sixpences, sovereigns, halfpence, florins, farthings, crowns, penny, 6d: passes, pure money. ounces → pounds, tons, grains, lbs, cwt, lb (weight) but also cents, francs, guineas, sovereigns: fails on money. minutes → hour, hours, quarter, o'clock, weeks: all time, but only 2 words of the gold TIME list (hours, weeks), so it fails as written. |
| C3 `feet` has senses | **PASS** | The null kept exactly one split and refused every deeper one. Sense 1 (11,215 uses), marked by +2 inches, height, +1 wide/high/deep/apart: Same as inches, yards, miles, foot. Sense 2 (9,812 uses), marked by sprang, beneath, rose, bare, jumped, +2 legs: Same as legs, head, knees, hands, shoulders. |
| C4 numbers survive | **PASS** | three → four, two, six, five, eight, nine, seven, twelve, ten, fourteen, twenty… (18 of 20 gold). |
| C5 shuffle control | **PASS** | Shuffled: no Same set for any seed, no sense split kept, reach ~1 everywhere. |

**Found, not a bar:** `pounds` was tried for a split (one part marked by +1 weight, the other by +2 shillings), but the parts were
not Other (0.599 > null 0.416), so it stays one sense of money and weight together, and `ounces` inherits money neighbours through it.
`long` was tried (parts Other at 0.142), but its smaller part was not the same as itself (0.38 < 0.416), so the split was refused; `long`
gets no Same set.

**Defect, disclosed:** a leaf sense's Same set is listed without checking that the leaf itself is self-same above null. It changes no
verdict: every real-run leaf scored is above null (0.62, 0.50, 0.65 …), and the only affected leaf is the shuffle run's `shillings`, whose
listed neighbours (q, prisoner, house …) should have been refused (self 0.33 < 0.537). C5 still passes.
