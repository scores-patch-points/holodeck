# canon preflight

Run before any registered run that reads text through khora:

    KHORA_PRIORS_DIR=<priors folder> node tools/canon/canon-check.mjs <khora checkout>

It writes nothing. It prints the checkout (commit, branch, dirty files, position against khora main 15f82fcd), the priors folder the reader's prior door will use, whether each pinned English prior is byte-identical to janus main (git blob sha, `canon-manifest.json`), and the reader's own `gaps` on a fixed probe text. It exits 1 and says why when the reader is degraded (a pinned prior missing or different, reader gaps, no clauses).

Why it exists. A khora clone with no `janus` folder beside it has a dangling `native/priors` symlink, and the reader then runs without its English dependency parser, part-of-speech, morphology, punctuation and dotted-abbreviation priors, silently except for the `gaps` list. Five attention-binder rounds and a first cast census ran that way. Point `KHORA_PRIORS_DIR` at a folder that holds the priors (a real janus checkout's `priors/`, or a folder of the ten pinned files) and record the preflight's output hash in every pre-registration.

The manifest pins ten English priors (contractions, dotted, frame, morphology, parser-eng-ewt, pos-eng-lexicon, pos-eng, punctuation, reading-rules, role-config) from janus main b1cc37f1 (2026-10-29). janus main holds about 1,950 prior files in all; which of the others the reader reads is not settled.
