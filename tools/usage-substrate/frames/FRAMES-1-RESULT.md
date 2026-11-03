# FRAMES-1 result — scored once against FRAMES-1-PREREG.md (2026-11-03)

Material: hyperlexicon v1 `fa9add32`, 5,949 English documents, 236,712,726 tokens. One pass, ~46 s per run on the VM.

| bar | verdict | what happened |
|---|---|---|
| B1 units emerge | **FAIL** | `feet` is Same as body parts (fingers, hands, legs, eyes…): its body sense dominates. `miles` is Same only as `weeks`. `inches` holds 1 LENGTH word (yards). |
| B2 numbers emerge | **PASS** | `three` → four, five, six, two, eight, seven, ten, twelve, nine, fifteen, fourteen, eighteen, sixteen, thirteen, eleven (15/15 numbers). |
| B3 Other | **PASS** | cos(feet, three) = 0.013 against null 0.640; no number near `feet`. |
| B4 money vs weight | **FAIL** | `shillings` and `ounces` are Same as each other and as gallons, yards, minutes, months, years. |
| B5 shuffle control | **PASS** | shuffled tokens: 0.5% of words are self-same (real: 24.1%), no Same set at all for any seed. The real signal is order, not topic. |

**What emerged instead (not a bar, reported as found):** one class of *measure nouns*: inches, yards, guineas, pence, shillings,
sovereigns, ounces, pounds, tons, gallons, pints, quarts, bushels, minutes, months, years, weeks, hours, o'clock. At reach 1 the
material says "a thing counted after a number", not which dimension.

**Reading (inference, not a bar):** reach 1 separates numbers from units from everything else, but not one dimension from another, and
it gives a word one λ even where it has two senses (`feet` the body part vs the unit). Both are owed to the formula's terms FRAMES-1
did not run: U's widening (dimension lives one word further out: `___ long`, `cost ___`, `weigh ___`), and Same per use rather than
per type.
