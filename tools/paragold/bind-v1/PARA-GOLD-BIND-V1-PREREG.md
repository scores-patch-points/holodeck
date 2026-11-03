# PARA-GOLD-BIND v1 — a held-out set for the attention binder, round 2. Frozen 2026-11-03, before the binder has seen any of it.

**Purpose.** Round 1 of the binder was scored on PARA-GOLD v0's 15 binding cases, which are now spent. Round 2 (fixing trap handling) is scored once on this set.

**Release protocol.** The binder session freezes its code and its round-2 pre-registration (bars) first, and reports the commit and the pre-registration hash to the parent session. Only then is the path to `PARA-GOLD-BIND-V1.json` released. It is scored once, failures published, and the set is never edited.

**Composition (30 cases, five English Wikipedia articles pinned by revision id: Brooklyn Bridge, Colosseum, Golden Gate Bridge, Panama Canal, Sydney Opera House).**
- 16 attended: 8 "it / its" and 8 definite descriptions (5 of them with a head noun different from any name of the topic: "The building", "The span", "The facility", "The expanded waterway"). Five of the pronoun cases have a competing candidate in the previous sentence.
- 14 traps: 6 "It" that refers to an entity or event the previous sentence introduces (a promenade, a commission, a concert hall, a lake, an area, a concert); 4 expletive "it" (extraposition and cleft); 4 definite descriptions that name something other than the topic (the path, the original locks, the railroad, the bonds).
- Note: this differs from the plan sent earlier ("event or clause anaphora, expletive, two competing candidates, a lone wrong-word candidate"): there is one event case (v22), competing candidates occur inside the attended cases, and no case was built to reproduce the exact b15 failure.

**How correctness is scored (fixed here; the binder declares only its thresholds).**
- *attended*: right if the bound referent is the topic in `attended_topic`; wrong if bound to anything else; a typed gap counts as a gap (not right, not wrong).
- *trap-new-entity* and *trap-definite-other*: right if a typed gap, or bound to the stated `referent` when that entity is in the cast; wrong if bound to the topic or to any other referent.
- *trap-expletive*: right if no binding (a gap or out of scope); wrong if any binding.

**Labelling.** By the parent session, by hand, from addressed text; not blind; no second reader. Part-whole and bridging cases (v11, v14, v27, v28, v30) are label-debatable; report them separately if the result turns on them.

**Limits.** 30 cases is small (14 traps: a rate of 3/14 wrong has a 95% interval of about 0.08 to 0.48). One genre (Wikipedia articles about structures), one topic per article. No quotations, dialogue or other languages.

**Addresses.** UTF-8 byte offsets into the frozen texts in `text/`, recomputed by `build_bind.py` (0 mismatches at freeze). Hashes in `PARA-GOLD-BIND-V1.sha256`, time in `PARA-GOLD-BIND-V1.time`.
