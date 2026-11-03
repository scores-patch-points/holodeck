# The usage substrate (`usage-substrate.json`)

The Ask's layer 2 reads this file to learn which measure nouns a question's word takes in use ("long" → inches, feet, miles; "cost" →
shillings, pence, dollars). Nothing in the code names a unit. The units come from counting use, and the numerals come from a giver whose
nominations use then licenses.

**Material.** hyperlexicon v1 head `fa9add32`, the 5,949 English documents (236,712,726 tokens), read-only on the machine that holds the
postings. **Giver.** Wiktionary as held in hyperlexicon v2 (`names`, part of speech `num`): 74 nominations in `giver-num.json`.

**Rebuild.**
```
node --max-old-space-size=8000 build.mjs <hyperlexicon-v1-dir> giver-num.json out.json   # about 4 minutes, about 7 GB of memory
node export.mjs out.json ../../usage-substrate.json                                       # reproduces the shipped file exactly
```

## How it was reached (each step pre-registered before it ran, scored once)

| run | question | result |
|---|---|---|
| FRAMES-1 (`frames/`) | Do classes emerge from Same vs Other (identity `same.mjs`) at reach 1, with nothing hand-picked? | Numbers emerged (15/15). Units came out as one class of *measure nouns* with no dimension. `feet` fell in with body parts. 3 pass, 2 fail. |
| FRAMES-2 (`frames/`) | With measured reach (U's widening) and Same per use? | `feet` split into a unit sense and a body sense, and the null refused any further split. Money separated cleanly. `pounds` stayed as one money-and-weight sense. 3 pass, 2 fail. |
| (unregistered probe) | Anchor the number class on digit tokens? | Failed. In this corpus digits are Same as footnotes (ibid, pp, roman numerals), not as "five". That failure is why a giver is used. |
| SUBSTRATE-1 | Giver-nominated numerals licensed by use; measure nouns; selections against a global shuffled ceiling. | S1 licensing passed: 29 licensed, all real numerals, with noise such as *a, i, free, tree, google* refused. S2 passed: 26 gold units among 276 measure nouns. **S3 failed**: the ceiling was too strict and almost nothing was selected. |
| SUBSTRATE-2 | Per-pair null: c_real > Poisson(c_shuf). | S3 passed, but **the control failed**: shuffle against shuffle selected 13,933 pairs, 34% of the real run. The null treated a random count as a known mean. |
| SUBSTRATE-3 | Paired test: given n = c_real + c_shuf, c_real ~ Binomial(n, ½), α = 1e-5. | **All bars pass.** S3 4/4 (long, cost, distant, old). Control: 2 pairs against 16,088. This is the shipped file. |

## Known limits
- The corpus is mostly older print, so modern units (km, kg, tonnes) are thin. Layer 1, which binds to the question's own words, covers
  them when a page writes the figure next to the question's word.
- Some selections are real usage but not the sense a question wants: "long lashes" (the word before, offset −1) next to "39 lashes" (a
  measure). The offset sign is kept in the file.
- English only: the giver was asked in `en`, and the documents are the English ground.
- Where this builder should live long term is open: it reads janus's hyperlexicon, so `janus/scripts/hyperlexicon/` may be its home.
