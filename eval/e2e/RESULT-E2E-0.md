# RESULT-E2E-0 — layers 3 and 4 in the Holodeck Ask, end to end

Run 2026-11-04, once, against `PREREG-E2E-0.md` (sha256 `bf93d579d16bcea153ff4fe6abcfd3a5eac1037d32bf8a48da713936ea4e422a`, commit b07abaa). Numbers below are from `score.mjs` over the raw files in `raw/` (their sha256 are in `raw/SHA256.txt`; the scorer's output is `score-output.txt` / `.json`). Nothing was re-scored or tuned.

## Verdict

**The pre-registered bars are not met. B1 passed, B2 failed, B3 failed. The wiring is correct as far as measured, and it does not help the Ask's first answer on this set.**

| bar | result |
|---|---|
| B1 no regression (base-right questions lost by `both`) | **pass**: 0 lost |
| B2 gain in the PD stratum (`both` ≥ `base` + 2 of 9) | **fail**: base 3, both 3, gain 0 |
| B3 real binding beats shuffled by ≥ 2 | **fail**: both 3, shuffle 3, margin 0 |
| U5 both-off equals unmodified main | **pass**: `ref` and `base` `results` byte-identical (5472 statements each) |
| U1–U4 untestable conditions | none triggered (21/21 masters read in every arm, 0 pending; binder bound 442 statements in `both`; base fails 6 PD questions; all six raw files present once) |

## Numbers (27 items; right = first answer statement is gold AND first figure candidate matches; figure-less golds scored on the statement)

| arm | all right (SF) | first statement gold (S) | PD right (of 9) | N right (of 18) |
|---|---|---|---|---|
| ref (main, unmodified) | 8 | 10 | 3 | 5 |
| base (both off) | 8 | 10 | 3 | 5 |
| cast (`castIdentity`) | 8 | 10 | 3 | 5 |
| binder | 8 | 11 | 3 | 5 |
| both | 8 | 11 | 3 | 5 |
| shuffle (control) | 8 | 10 | 3 | 5 |

Right in every arm (8): n01, n15, v01, v02, v08, x01, x02, x03. No question changed SF in any arm. The Cumberland (v02, x01), Eiffel (n01, x02) and Concorde cost (x03) questions, the three known failures, are all answered correctly by **base** already: the figure binding (PR 29) fixed them, and the layers add nothing there.
Binder stats (`both`): 442 of 5472 statements carry a binding, 1079 carry a typed gap (binder alone: 394 / 1122). Gap reasons in the binder-alone arm: center_not_carried 227, center_elsewhere 147, description_unbound 333, capitalised_name_open_word 121, description_below_floor 104, pronoun_no_margin 85, description_off_topic 72, capitalised_unknown_name 58, description_weak_word 53, expletive_or_cleft 24, description_no_margin 12, inside_cast_mention 4, pronoun_no_candidate 1. All stayed gaps; none became a name.

## What moved, not counted by a bar (post hoc, from the raw files; one labeller)

- n05 "When was the Statue of Liberty dedicated?": the gold sentence ("The statue was dedicated on …") is the **first** answer statement in `binder` and `both` and **second** in base, cast and shuffle. The figure test still fails (the first candidate is "October", the date's tokens are split), so it is not an SF gain. This is the one case where a sentence-initial description ("The statue") was bound and it changed the top of the answer, and the shuffle did not do it.
- n07 "When did the Gateway Arch open?": gold sentence ("The monument opened …") goes from absent to second in `both`; the first statement is unchanged.
- By S alone (not the bar): base 10, both 11. I did not register S as a bar; this is one question.
- Most PD failures are not about a missing binding at all: the gold sentence is outside the Ask's top 5 in base and both (n02, n04, n09, n11), because the Ask's lexical ranking prefers a statement that names the subject, or the figure test favours a different statement. A binder cannot move a statement the Ask never scores highly.
- 23 of 27 answers differ between base and both in some candidate or passage below the top; the top answer almost never moves.

## What went wrong in the run (published)

- The first `base` attempt was cut by the tool's 45 s timeout and my navigating away before it posted; no output existed and no score was seen. `base` was run again, once, with a fire-and-poll call. (The pre-registration said a failed load before a post is U1 and re-runs need a new registration. This failure was in the driver call, not in a page load, and no result had been seen, so I treated it as a harness error and say so here.)
- The drive-time numbers (`ms` in the raw files: ref 29 s, base 72 s, cast 284 s, binder 322 s) are not a cost measurement: the browser pane was hidden and the master readers run in workers; they are in the raw files and should not be read as the cost of the layers.
- The binder arms need `window.__hdL34Ready` before the page analyses; the driver waits for it.

## What is wired and what is not

Wired, opt-in, off by default, `ref` = `base` proves nothing leaks when off: `?castIdentity=1` (reader option), `?binder=1` (bindings and typed gaps per statement; `nh` counts a bound referent that is one of the question's names once; `holoKit.namesOf` adds bound referents; gaps stay typed on the statement), `?binderShuffle=N` (control). Tests: `holodeck-layers34.test.mjs` (7), `holodeck-bound.test.mjs`, `holodeck-reader.test.mjs` pass (25/25); `tools/vendor-khora.mjs --check` passes (221 files).
Not wired, and why:
- "A bound referent is skipped in `others`": by construction there is nothing to skip, because a bound referent is not in `st.names`; `others` is unchanged. I did not add a filter that would also drop real mentions.
- The binder runs without the lexicon giver (`nonPersonal` not passed; ruling `text_evidence`), because the page has none on this machine. Whether the giver would change the 1079 gaps is not measured.
- A source whose reading was already saved on the document (`d.eng`, from an earlier read) bypasses the worker, so neither switch applies to it until it is read again; the test corpus is read fresh. There is no cache key that includes the switches.
- The binder only serves sentence-initial neuter pronouns and definite descriptions; he/she (`st.pron`) and any other "it" stay as they were.
- The Ask cannot be driven headlessly from node here (no Playwright installed, no downloads allowed): the in-app browser was used, with the page's own `analysis()` and `qaVals()`.
- Vendored priors were carried over from the previous record (janus 6a19908); no janus checkout was available to re-vendor them, and `KHORA-VENDOR.json` says so.

## Limits (as registered, plus what the run showed)

27 items, 25 distinct questions, 9 in the PD stratum, so the bars were coarse and a null here does not show the layers cannot help; it shows they do not move the first answer on this set. One labeller; set written with the sentences in view; QSET-1 had a withdrawn earlier use. The figure rule is strict for dates (n05, n07, n12, v05 need all of month, day and year in the first candidate). The stratum labels were mine and PD has three questions that are the same two questions repeated (n01/x02, v02/x01), so PD base 3 is really two distinct questions plus a repeat. The commit under test is an assembled combination of two unmerged khora branches.

## Reproduce

`node tools/serve.mjs 8814`, `node eval/e2e/collector.mjs 8815`, load `index.html` with the arm's switches, run `drive.js`; the `ref` arm is `origin/main`'s `index.html` and `master-reading-worker.js` over this branch's tree. Raw files must not exist beforehand (the collector refuses a second write).

## Addendum (2026-11-04, after the run): trailing punctuation in cast surfaces

A peer session reported that cast-identity 29cfe25 can leave a trailing apostrophe in a being's surface after a possessive ("Sydney Harbour Bridge'"), which would break any match by name. I checked after the run, read-only, by reading the 21 texts through khora `readDocument` with `castIdentity: true` (assembled commit a47d23c, same priors) and scanning every cast surface and alias for a leading or trailing character that is not a letter, digit, space, closing bracket or quote: **none found in these 21 texts.** This does not cover the page's worker path byte for byte, only the same reader; no arm was changed or re-run. The peer also reports the repair was neutral for the binder on its own exam and that it bound one expletive "It" and some name fragments; on this set the `cast` arm changed no answer (8/27 as base) and the binder-alone and both arms bound 394 and 442 statements, so I cannot say whether any of those were such cases.
