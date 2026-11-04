# PREREG-E2E-0 — do khora's layers 3 and 4 help the Holodeck Ask, end to end?

Written 2026-11-04, before any scored run. The bars come first; everything after them is the means. Hash of this file: in `PREREG-E2E-0.sha256` and in the commit that adds it.

## 1. The bars (declared first)

Unit: a question. A question is **right** (SF) when the Ask's *first answer statement* (the first passage of the Ask's answer) is a gold sentence **and**, where the question has a gold figure, the Ask's *first figure candidate* equals the gold figure. Questions whose gold has no figure (n11, n13) are scored on the statement alone. Rules for "is a gold sentence" and "equals the gold figure" are in `GOLD-E2E-0.json` (`rules`), applied by `score.mjs`, both hashed below.

Arms (each one fresh page load, one pass, same 21 frozen texts, same 27 questions):
`base` both switches off · `cast` `?castIdentity=1` · `binder` `?binder=1` · `both` `?castIdentity=1&binder=1`; plus the control `shuffle` = `both` with `&binderShuffle=1` (the same bindings, their referents permuted among them, seed 1; typed gaps untouched), and the gate arm `ref` (see U5).

- **B1, no regression.** Among the questions `base` got right, `both` loses **none**. Pass = 0 lost.
- **B2, gain where the answer sentence names the subject only by "it" or a description.** The PD stratum is the 9 questions labelled `PD` in the gold file (n01 n02 n04 n05 n07 n09 n11 x01 x02; the rule is in the gold file, labelled before any run). Pass = `both` is right on at least **2 more** PD questions than `base`.
- **B3, shuffled-binding control.** The real binding must beat the shuffled one: `both` is right on at least **2 more** PD questions than `shuffle`.
- The result is called a **success only if B1, B2 and B3 all pass.** If B1 fails, the wiring does harm and that is reported first. `cast` and `binder` alone carry no bar; they are reported to say which layer did what.

**Untestable (the run says nothing, and is reported as such, not as a pass or a fail):**
- U1 a page's masters did not all read (`masterReads.pending ≠ 0` or `read < 21`), or the canon preflight is not CANON-OK, or an arm's `switches` record does not match its URL.
- U2 the binder bound no statement in the `both` arm (the switch was never exercised) — B2 and B3 are untestable.
- U3 `base` fails fewer than 2 PD questions (no room to gain) — B2 and B3 are untestable.
- U4 an arm's raw file is missing, or was written twice.
- U5 **the off-switch test.** The `ref` arm is the unmodified `origin/main` `index.html` and `master-reading-worker.js` (53cdbad) on the same vendored khora and the same harness. `base` must produce a byte-identical `results` array. If it does not, the "both off changes nothing" claim fails and every other number is void until fixed (a fix needs a new registration).

## 2. What is wired (and what is not)

Files: `holodeck-layers34.js` (new), `master-reading-worker.js` and `index.html` (small, guarded edits), `vendor/khora/**` (re-vendored by `tools/vendor-khora.mjs --write --all`; `--check` passes).
1. `castIdentity`: the master reading worker passes `castIdentity: true` to `readDocument` (khora option, default off). Nothing else in the page changes; the repaired cast flows into the page's names as before.
2. `binder`: the worker also calls `attendedBindingsFor(entry,{enabled:true,…dials})`; the page keeps bindings and typed gaps per statement (`st.attended`, `st.attendedGaps`). In the Ask a bound referent counts once in `nh` when it is one of the question's names; a bound referent is never added to `others` (it is not a mention). `holoKit.namesOf` returns the statement's names plus its bound referents, so a pronoun-only statement yields a delta. A typed gap (`description_off_topic`, `pronoun_no_margin`, `center_elsewhere`, …) is kept under its reason and never becomes a name.
3. Dials: the binder scorer's declared ones (khora `eval/attention/score5.mjs` DECLARED at a8302ab), unchanged, in `BINDER_DIALS`. `nonPersonal` is **not** passed (no lexicon giver on this machine): the binder rules by the text's own evidence and says so (`ruling`).
Not wired: the Ask's figure binding (`boundFigures`) is untouched; `st.pron` (he/she, `HD_ENGINE.resolvePronouns`) is untouched; the binder serves sentence-initial neuter pronouns and definite descriptions only, so any other "it" stays as it was.

## 3. Inputs, with hashes

- khora: assembled local commit `a47d23c4fba0fca16d39ea308e4f6c07272f4c0b` = cast-identity `29cfe25108a363304ae4f19957ef665edca72cb0` (branch `cast-identity`) + the four binder files (`attention-binder.js`, `attention-binder.test.mjs`, `attention-switch.js`, `priors.js`) byte-for-byte from `a8302aba99722f6cb489f437278c36db2b793316` (branch `attention-binder`, khora PR 95). Neither branch is merged into khora main (15f82fcd). The assembled commit is a scratch clone, not pushed; the vendored copy is `vendor/khora/` with `KHORA-VENDOR.json`.
- Canon preflight, run on the assembled clone with `KHORA_PRIORS_DIR=$HOME/Downloads/workspace/janus/priors`: verdict CANON-OK, no reader gaps; output kept in `eval/e2e/preflight-assembled.txt`, **preflight sha256 `562b5430185ee91657210abe0f9ead7982b84b25095c74b60779c7edc183f8e7`** (the hash the tool prints over its own report; the file's own sha256 is `f41978966d7004e80bbde88f61675038f2327c798b13f110a4ecb34cf46f23a0`). In a browser the prior door fetches `vendor/khora/native/priors`: it carries all ten English priors the manifest requires (checked), carried over from janus 6a19908 (the previous record); the page is not reading degraded. Not re-verified byte-for-byte against the manifest's blob hashes (the vendored priors are the earlier janus copy).
- holodeck base: `origin/main` 53cdbad93487809b80af2a39705d32c96fc67c8d. Code under test: commit `6ca1a2e` on branch `layers-3-4-e2e`.
- Texts: the 21 frozen PARA-GOLD v0 texts, `tools/paragold/v0/text/` (byte-identical to the originals); gold spans `PARA-GOLD.json` sha256 `1f7541487e02175d9cb6c9f498f66bde38c2e802277122a5eb32aeb20ee3354f`.
- Questions: `QSET-1.json` sha256 `4b49b60e3384f3cf2d64999d8bdc19b793853e64b2b5073dc416e7b8333ff727` (24 questions; its v0 gold is the whole `same` class of the listed pairs; its `new` gold is the sentence beginning with `gold_start`) plus three known Ask failures, **labelled by me from the texts before any run**: x01 Cumberland River length (same wording as v02, narrower gold), x02 Eiffel Tower height (same wording as n01), x03 Concorde programme cost (the £70 million estimate and the £1.5–2.1 billion outturn both count). So 27 items, 25 distinct questions.
- `GOLD-E2E-0.json` sha256 `54c6b4a1c4f71649250580d44d2cf279923b14629da5fa96ef86583fdb197a46` (gold strings, gold figures, strata). `score.mjs` sha256 `c2bc70e7cfd6e2f530e2ec2e765b5bf25406773951601d8cc98e846368e1cf98`. `drive.js` sha256 `e5d6a9604352141c1cc29ce777589598ddd85e41da637edb302b0b3be3d39d94`.
- Worker/page files under test: `index.html` `550ea48856ebc5c97cc9c08d6b3225a6ac2158ba5d75c3a3f3e59038e2cbb32a`, `master-reading-worker.js` `a0d976d9f597de65c88b1ea25b916f9e794d0dfff474377dc9f270a69251d390`, `holodeck-layers34.js` `4aaf273f2074733ce5ca67500802ff557b9574d09f329578dea71f29e2f0b479`.

## 4. How it is run

The Ask runs through its own code, in a browser: the repo's static server (`node tools/serve.mjs`) serves the page; the in-app browser loads `index.html` with the arm's switches in the URL; `drive.js` puts the 21 texts into the page's workspace, waits until the page's master readers (workers running khora `readDocument` through `holodeck-reader.js`) have read every text, calls the page's own `analysis()` and `qaVals(A, F, question, 'search')` for each question, and posts the raw answer (answer passages, figure candidates) to `collector.mjs`, which writes `raw/<arm>.json` and refuses a second write. The reader is the real pipeline; no splitter or matcher of mine sits between the page and the answer. Only the *scoring* reads raw files (`score.mjs`). The Ask cannot be driven headlessly from node here (no Playwright is installed and nothing may be downloaded); the browser pane is what was used. Statements are the page's own (`splitSentences`).
Development used only a made-up two-sentence toy document ("Zorn Bridge") and a timing pass over the 21 texts with no questions; no question of the set was asked of the Ask before this file was hashed. Run order: `ref`, `base`, `cast`, `binder`, `both`, `shuffle`; each once. Nothing is re-run after seeing a score; a failed load before a post counts as U1 and is re-run only with a new registration.

## 5. Limits

- 27 items (25 distinct questions); the PD stratum has 9. One question moves a percentage by 4 points; B2/B3's margin of 2 is a small number. A pass would be a small-sample result, not a rate.
- Labels are one labeller's (a model session), not blind; the strata and the figure alternatives are my judgments.
- The question set was written by the parent session with the gold sentences in view, and QSET-1 was already used in a retrieval pilot that was withdrawn; it is "frozen", not unseen.
- One dial setting, one shuffle seed, one reading per arm; the readers are deterministic but the shuffle is a single draw.
- The binder runs here without the lexicon giver (`ruling: text_evidence`), unlike its own measurements; castIdentity was measured on entity inventories, not on the Ask.
- Gold matching is by text containment in the right document, so a duplicated sentence in another document counts as a miss.
- The Ask's first answer statement is not the only thing a user sees; this scores the top of the answer only.
- The assembled khora commit is a scratch combination of two unmerged branches; the vendored result is only as good as that combination.
