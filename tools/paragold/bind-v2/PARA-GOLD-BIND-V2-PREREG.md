# PARA-GOLD-BIND v2 — a held-out set for the attention binder, round 3. Frozen 2026-11-03, before the binder has seen any of it.

**Purpose.** Round 2 fixed the traps but failed coverage (5/16) and left three cases silent. Round 3 is scored once on this set. The v1 set and its results are spent.

**Release protocol.** The binder session freezes its code and its round-3 pre-registration first and reports the commit and the pre-registration hash to the parent. Only then is the path released. It scores once, publishes failures, and the set is never edited. This file is already in the binder's scorer schema (`PARA-GOLD-BIND-V2.binder.json`), so no loader change is needed.

**Composition (36 cases, six English Wikipedia articles pinned by revision id: Empire State Building, Hagia Sophia, Hubble Space Telescope, Suez Canal, Taj Mahal, Voyager 1).**
- 20 attended: 8 pronouns or possessives (every one has a competing candidate in the previous sentence, so ties are the point), and 8 definite descriptions (5 with a head noun different from any name of the topic: "The building complex", "The current structure", "The church", "The probe", "The complex"), and 4 more that open a section (the case round 2 missed silently; four of these are included among the definite descriptions' kinds, counted once each: w17 to w20).
- 16 traps: 8 "It" for an entity or event the previous sentence introduces (four of them are instruments of one telescope, with parallel wording), 4 expletive "it", 4 definite descriptions naming something other than the topic (a predecessor church, the spacecraft, the tomb, the site).
- Six cases open a section (w17 to w20, t13, t16).

**How correctness is scored (as in v1; the binder declares only its thresholds).**
- *attended*: right if the bound referent is the topic in `attended_topic`; wrong if bound to anything else; a typed gap is a gap.
- *trap-new-entity* and *trap-definite-other*: right if a typed gap, or bound to the stated referent when that entity is a named cast candidate; wrong if bound to the topic or to any other referent.
- *trap-expletive*: right if no binding; wrong if any binding.
- *Silent outcome*: a case with neither a binding nor a typed gap nor an out-of-scope marker. The binder's pre-registration is asked to carry a bar of zero silent outcomes.

**Labelling.** By the parent session, by hand, from addressed text; not blind; no second reader. Part-whole and bridging cases (w11, w16, w18, t14, t15) are label-debatable; report them separately.

**Limits.** 36 cases is small (16 traps: 3 wrong of 16 has a 95% interval of about 0.06 to 0.44). One genre (Wikipedia articles about structures, a probe and a telescope). The four Hubble instrument traps share a pattern, so a rule that learns "It was built by" would look better than it is. All eight pronoun cases are tie-prone by design, so this set is harder on coverage than a random sample of text. No quotations, dialogue or other languages.

**Addresses.** UTF-8 byte offsets into the frozen texts in `text/`, recomputed by `build_bind2.py` (0 mismatches at freeze). Hashes in `PARA-GOLD-BIND-V2.sha256`, time in `PARA-GOLD-BIND-V2.time`.
