# What the runs taught — folded from six ants

Runs: 24 drawn documents (known truth), FUNSD (50 noisy scanned forms, 823 linked label/answer pairs), CORD (30 photographed receipts, 72 menu items), and the real 990s and a memo (no truth). Six independent read-only ants each took one lens (binding, headings, OCR, tables, referee, language) and left marks; this is the fold. The marks themselves live beside the run files in `.scratch-datasets/runs/marks/` (untracked: they quote FUNSD/CORD text, which carry their own licences).

## Where it stands, in numbers

| Run | What was measured | Result |
|---|---|---|
| Drawn, clean (24) | tables / headings found | invoices and statements 4/4 tables; memo headings 12/12; receipts 0/4 at default rules |
| FUNSD (50) | OCR after 2× enlarge | mean confidence 74, word recall 0.87, true value present in OCR text for 512 of 823 pairs |
| FUNSD | pairs bound | 146 by a value-only match; **about 67 with the right label too** |
| FUNSD | headings | about 480 titles asserted for 119 true headers; about 57 of those hit (12% precision) |
| FUNSD | tables | 48 asserted; about 43 false |
| CORD (30) | OCR | mean confidence 46; 12 of 30 read as noise |
| CORD | menu items as table rows | 5 of 72 (ceiling from the OCR text alone is about 61% of 72) |

## Lessons, ranked by how much they move the next result

1. **Most of the loss is before the reader.** On FUNSD 283 of 677 unbound pairs (42%) have a value that never appears in the OCR text (handwriting, number grids). On CORD the loss is bimodal: receipts that OCR reads (conf ≥ 60) come out near exact; 12 of 30 are noise. Structure rules cannot recover what OCR never read. *(binding, ocr, tables ants agree.)* → Preprocess pixels before tuning rules.
2. **OCR loss is per document, not per token.** FUNSD field recall is 0.35 on the 6 documents under confidence 60 and 0.75 at 75+. Missing tokens are symbols and digits (digits 19% on FUNSD, 48% on CORD), not short words. Underlines read as `_` fuse words; two-column forms merge into one line; separators drop (`5 455`, `96 ,000`). → The ranked candidates (from the OCR ant; unverified, because the runs hold text, not pixels): adaptive binarise and illumination normalise, 3–4× upscale, rule-line removal, re-OCR of low-confidence boxes, a numeric whitelist for number fields, deskew last.
3. **My enlarge cap under-serves small images.** `holodeck-ocr.js` stops at 2× (a speed choice) while its own target width is 1400 px, so CORD (432 px) reaches only 864 px. A bug of mine, found by an ant.
4. **Binding fails on plain lines.** 240 pairs (35%) have the value in the text and no field made for that segment; 107 unbound pairs across 31 forms have label, colon and value on one OCR line. → Emit a field for every `LABEL: value` line and for a label with its value on the next line (about 100 pairs); split at the printed colon, not the wide gap (40–60); bind number-grid pages as table cells by column header (30–50). Ceiling near 540 of 823; the ant expects 250–300 after the three.
5. **Headings: precision, not recall, is the problem.** 313 all-caps titles gave 51 hits; the "word + 1–3 digits" marker gave 23 titles and 0 hits (dates, addresses); larger type gave 144 and 6. 42% of true headings never appear as titles at all, because they were consumed as label/value fields. The best cheap cues are position (26% precision in the top 15% of the page against 3% in the bottom 40%), at most 6 words, and word quality ≥ 0.75; combined: precision 12% → 20%, keeping 39 of 57 hits. Fit on FUNSD alone, whose heading labels are themselves inconsistent.
6. **Tables: the 2-cell path and the header test.** A two-cell table needs `tableMinCells` 2 (default is 3), which is why receipts score 0 at defaults; with the adopted-learned setting my own test finds a headerless receipt table. Remaining receipt losses: a first real item taken as the header (cord-17, 28, 29), wrapped item names breaking a run, quantity glued to the name, thousand-style prices such as `25,000` / `60.000` rejected by `dataRow`. About 85–90% of the tables asserted on FUNSD are false (label/value rows, OCR noise, checkboxes). Cell splitting uses 2+ spaces of text, not word geometry.
7. **The learning evidence is much weaker than I reported** (referee). The synthetic corpus has only 6 layout templates (language only swaps strings), so "held-out" shares every template with training; the whole structure gain is about two template effects (receipts become detectable, an invoice's second table is dropped), p ≈ 0.45 on 4/6 vs 6/6; the "F" is a sum of two F1s; the best setting sits on the edge of the search grid. The 28 FUNSD key rules are label memorisation (to→name, name_of_account→name) with zero held-out gain. Real OCR confusions exist in FUNSD (n→u, 8/B, 6/5, 1/3), but none repeats twice, so no repair rule was learnable, and FUNSD's own truth is noisy.
8. **Language: the result I could not see is accents.** Truth words with non-ASCII letters that survive exactly: fr 12/16, de 1/4, es 1/12 (`Lucía`→`Lucia`, `Fällig`→`Fallig`, `Handbücher`→`Handbiicher`); Spanish `ó` becomes `ö` in three documents (the German model leaking). My metrics fold accents, so they report 20/20. Number and date formats for the Latin locales are fine. The reader's per-language edge in fr/es is page skew on ruled forms, not language, and each language cell is n=1.
9. **Scripts not yet tested will break in known places** (language ant, by line): Alhazen rejects any label with no ASCII letter (Cyrillic, Greek, Arabic, CJK labels never become fields on the primary path); case-dependent rules (`allCaps`, the name shape) misfire on caseless scripts; `hasWord` ignores combining marks, which shatters Devanagari and Thai; `layoutText` sorts left to right so RTL rows reverse; a one-letter label is dropped (`À:`); no `年月日` date; Arabic `٫` is not an amount separator; `canon()` mishandles `ß`/`œ` and strips Devanagari/Thai vowel signs.

## Corrections to what I claimed earlier in this session

- "**146 of 823 pairs bound**" was value-only. With the label right it is about 67.
- "**Learned structure rules raise held-out F 1.21 → 1.63**" is not a trustworthy magnitude (item 7). The program is now marked provisional and is no longer applied by default.
- "**Rule learning from known truth works**": on this evidence it found structure thresholds that fit 6 templates and label rules that do not transfer. It found no repair or alias rules. What was demonstrated is the harness and the log, not a learning gain.
- A mark I checked rather than took on trust: the tables ant called the 2-cell branch unreachable. True at the default of 3 cells, not under the learned setting. Both statements are recorded here.

## Metric flaws to fix before trusting the next number

Letters score word recall 0 (their truth is empty); receipt recall under 1 comes from column headers never drawn; heading truth exists only for memos, so heading precision's denominator is wrong; `tableOk` accepts any fuzzy column match and counts a second table as a false positive; the table-row metric compares only the first cell (a nine-row table scored 0); binding greedily ignores labels and the substring rule binds header-fused blobs (`Fax` → a long header); key rules are hard-coded `falsified: false`; CORD's "5 of 72" mixes OCR loss with rule loss (use about 16–21 recoverable items as the denominator); every per-language cell is n=1.

## Next experiments, in order

1. A pre-OCR hook with a switchable step list (binarise, normalise, enlarge to 1400+, rule-line removal, numeric whitelist), re-run on the original FUNSD and CORD images, comparing mean confidence, field and digit recall, and documents hurt.
2. The three binding changes in item 4, scored on the cached runs with the label-and-value metric.
3. The heading precision filter in item 5, validated on the drawn memos and the real memo so it is not fit on FUNSD alone.
4. Hand-label tables on about 30 real pages (the 990s, the memo, CORD) so default and learned structure rules can be compared by a paired bootstrap; add template jitter, 10 seeds and a leave-one-family-out check to the drawn corpus; require a gain of at least +0.10 table-F1 with the interval above zero.
5. Accent-exact recall next to the folded metric, and a small corpus for ru, el, ar, hi and zh/ja that targets the lines in item 9.
