# PARA-GOLD v0 — a frozen set of equivalence pairs and binding cases. Pre-registered 2026-11-03, before any system is scored on it.

**What it is for.** Step 1 of the approved plan. Every later step (binding "it" and "the tower", standing, the same-delta test, the hyperlexicon's
`describers` ask) is scored against this set. No step may be scored until this file's hash is recorded, and none may edit it afterwards.

**Lens (declared).** A statement is *equivalent* to another when it answers the same question with the same quantity, the same standing and
the same referent. Equivalence is always for a purpose; a pair with no question is not in this set.

**What is in it** (`PARA-GOLD.json`):
- 22 pairs, each with the question it is read against. 9 *same* (equal on the asked quantity, from independent publishers), 12 *other* (8 same
  referent with a different figure, quantity or standing; 4 different referent), 1 *contained* (the first entails the second, not the reverse).
- 15 binding cases: a sentence whose subject is a pronoun or a definite description, with the referent a reader attending to the text would give
  it: 10 pronouns, 5 definite descriptions. One case is a trap (an "It" that refers to the preceding debate, not the attended tower) and one is a
  shift of the attended referent (the tower to its engineer).
- 21 frozen source texts: 12 US government pages (public domain; a thirteenth planned page could not be fetched and was dropped) and 9
  English Wikipedia articles (CC BY-SA 4.0, pinned by revision id).
  Their raw hashes, text hashes and URLs or revision ids are in the `sources` list of the JSON.

**Addresses.** Each statement is `{doc, start, end, text}`: UTF-8 byte offsets into the frozen text file `text/<doc>.txt`, which is
`extract.py`'s deterministic output for the raw page. `build_gold.py` recomputes every span from the text and checks the stored text equals it
(0 mismatches at freeze). Table rows are two or three lines (a label and its value).

**How it was made, and what that does and does not claim.**
- Written by hand from the addressed text. Not mined from any Fold output, not selected by running a system, and none of the labels was
  changed after any system saw it.
- Labelled by one author (the model that built it). The labels have **not** been checked by a second reader. A blind review of a random
  sample of 10 pairs and 6 binding cases by the user is requested before the first scoring; agreement is to be reported with the results.
- *Independent* here means a different publishing organisation (a US agency against Wikipedia, or two agencies). Wikipedia articles may cite
  the agency pages, so this is independence of describers, not of provenance.

**What it cannot show.** It is small: with 15 binding cases a pass rate of 12/15 has a 95% Wilson interval of about 0.55 to 0.93, and with 9
*same* pairs 8/9 gives about 0.57 to 0.98, so any bar scored on it can only detect large differences. It covers figure claims about named
physical things in English; it has no negation, no reported speech, no abstract claims, no roles swapped between sentences, and no images. Those
need their own sets.

**Rules for use.**
1. A step registers its bars (and hashes them) before it is scored on this set, as FRAMES, SUBSTRATE and PARA-0 did.
2. Each step is scored once. Failures are published.
3. Controls come with the step (for example shuffled referents for binding), not from this set.
4. New material goes in a new file, `PARA-GOLD@1`, with its own hash. Version 0 is never edited after its first scoring.

**Hashes.** The SHA-256 of `PARA-GOLD.json`, `build_gold.py`, `extract.py`, `urls.tsv` and every text file are in `PARA-GOLD.sha256`; the time of
freezing is in `PARA-GOLD.time`.
