## 2026-10-02 — the mechanical summary's real job is the VOID; wired as an additive fact (main, summary-ladder)
fast: 4 files · law: ok
| lens | citation | file:line | verdict | one line |
| Diaconis | the effect was measured on the wrong branch | holodeck-ask.js:181 | fixed | the earlier fold experiments measured a NO-MATERIAL turn (a contentless question retrieved 0 passages and fell to CHAT_PROMPT); the material-present run shows fold on/off a wash. Corrected in the header |
| Feynman | a verdict with no citation trail | holodeck-ask.js:342 | fixed | subjectSummary now returns a typed VOID (never null) with the closest grounded spans; the no-retrieval void is tested (holodeck-void.test.mjs) |
| Simon/Chekhov | a real mechanism shipped unwired | holodeck-ask.js:209 | fixed | hasMaterial now treats a void fold as material, so a research question the workspace is silent on gets the reporter prompt + void, not small talk (measured: "I'm ready to help!" → "The workspace is silent on this.") |
| Dijkstra | an absolute path / machine scope | holodeck-summary.js:545 | fixed | the stance re-export pointed at /Users/mlacy/.../eoreader7 (broke on any other machine) and left stanceOf in its temporal dead zone; vendored stance.js and imported it at the top |
clean: Holmes, Greenberg, Alexander, Ostrom

## 2026-10-02 — FALSIFIED: the "3/3 turn" was majority-echo; restated honestly (main, summary-ladder)
fast: 2 files · law: ok
| lens | citation | file:line | verdict | one line |
| Diaconis | the effect the test found is an artifact of the test | holodeck-ask.js:15 | fixed | the identity was set to -docStance, so the fold surfaced MAJORITY claims by construction and the metric rewarded echoing them (0/4 minority picks); a turn is a minority inversion the construction could not surface. Restated: held-identity fold carries the genuine turn 3/5 vs baseline 2/5, empty/null 0/5 on one specimen |
| Feynman | a verdict with no citation trail | holodeck-ask.js:17 | fixed | the 3/3 headline is retracted in the header with the actual measured numbers and the falsifier named (falsify-turn2.mjs) |
clean: Holmes, Frankfurt, Greenberg, Alexander, Ostrom

## 2026-10-02 — the subject fold improved to a decisive, grounded win; markup blanked (main, summary-ladder)
fast: 3 files · 24 tests pass · law: ok
| lens | citation | file:line | verdict | one line |
| Feynman | no constant tuned to a golden | holodeck-reader.js:120 | noted | blankMarkup is length-preserving and rule-based (CSS/tag/entity/URL), not tuned; the experiment's 3/3 vs 1/3 is reported as measured, not asserted |
| Greenberg | markup is not universal prose | holodeck-reader.js:112 | fixed | CSS/HTML is blanked before folding (a declared, script-agnostic rule); the reader never assumes markup is content |
| Alexander | composition seam | holodeck-ask.js:167 | fixed | the fold composes as a fact through Gary; subjectSummary and readCorpus both blank markup, so every reader path agrees |
| Simon/Chekhov | new/untested | holodeck-reader.test.mjs | fixed | blankMarkup pinned: length preserved, CSS/script gone, a prose sentence keeps its offset |
clean: Holmes, Frankfurt, Dijkstra, Ostrom

## 2026-10-02 — the mechanical summary folds the whole corpus instantly, wired into the chat and the reader (main, summary-ladder)
fast: 6 files · 30 tests pass · law: ok
| lens | citation | file:line | verdict | one line |
| Greenberg | capitalisation gate / script scope | holodeck-ask.js:275 | fixed | the question's named subject is read by `\p{Lu}` (any cased script, the engine's own name rule), never an English `[A-Z]`; a caseless script (Chinese, Arabic) offers no name and that absence is disclosed, never guessed |
| Dijkstra | locale/allowlist standing in for identity | holodeck-ask.js:274 | noted | `nameFold` is a NAMING CONVENTION (diacritic fold + case), declared, used only to pick which claims are about the question's subject — it never merges referents |
| Feynman | a numeric constant / swallowed error | holodeck-reader.js:152 | fixed | reader/read failures are no longer swallowed — each is pushed to `report.gaps` with a reason; the ladder's minimum is a NAMED constant (MIN_CLAIMS_FOR_LADDER), not a bare 4 |
| Alexander | composition seam | holodeck-reader.js:98 | fixed | the chunked corpus read discloses its gaps; chunking is measured not to lose claims (holodeck-reader.test.mjs: chunked ≥ single-pass) |
| Holmes | identity fold from surface | holodeck-ask.js:259 | clean | the fold selects the subject's claims, it does not fuse referents; identity stays the engine's |
| Simon/Chekhov | new/untested source | holodeck-reader.js | fixed | readCorpus has holodeck-reader.test.mjs (grounding by content, chunking does not lose the reading, a tiny source yields nothing) |
| Ostrom | scope of absence | holodeck-summary.test.mjs:32 | clean | scoping is per-doc via stsByDoc |
| Frankfurt | placeholder | index.html:664 | clean | hasSyn guards a real block |
clean: Diaconis, Pearl, Kondo

## 2026-10-02 — perspectives read the text's own words; the surface sheds its chrome, and an import opens its reading replay by itself (main, merge + kondo)
fast: 3 files · 14 tests pass · law: ok (WARN pre-existing S17/S96 duplicates in eoreader7/native/READING-SPEC.md, not this diff)
| lens | citation | file:line | verdict | one line |
| Feynman | a numeric constant in a comparison | holodeck-reader.js:277 | noted | the lemma pick is length ≥ 3 then shortest — a register rule, not a tuned threshold |
| Dijkstra | locale/script scope | holodeck-reader.js:284 | noted | the head is read through the English pos prior by design; it picks an act label, never merges referents |
| Greenberg | capitalisation gate / script scope | holodeck-reader.js:246 | fixed | the comment now declares the prior and register English: a script the prior cannot tag yields no act, shown as no chip; isNameWord only chooses "the" in an English label |
| Holmes | identity fold from surface | holodeck-reader.js:276 | noted | canonical() folds a verb's forms via the lemmatizer, not referents; nothing is fused |
| Ostrom | scope of the count | index.html:236 | noted | p.n counts the scoped statements the reading was derived from; the preview names "of N statements" |
| Frankfurt | placeholder | index.html:237 | noted | the rows are computed labels carrying the material's own hits |
| Simon/Chekhov | real mechanism shipped unwired | holodeck-ingest-player.js | noted | open() is hdFinish's dynamic import target; verified live (replay auto-opens, 33 events), chipFor retired by request |
clean: none

## 2026-10-02 — the summary function, over anything, grounded and clickable (main, summary-ladder)
fast: 3 files added · 16 tests pass · law: ok
| lens | citation | file:line | verdict | one line |
| Greenberg | language-specific mechanism disclosed | holodeck-eot.js:126 | fixed | the projection leg is declared English (EWT order/forms, verb-late head rule), not universal; GFP stays neutral |
| Feynman | no constant tuned to a golden | holodeck-summary.js:121 | noted | stemmer length rule is structural, tests assert the gap (R OPEN) rather than hide it |
| Diaconis | null touched | holodeck-summary.test.mjs | noted | resolver edges are null-controlled (word salad manufactures none) |
| Simon/Chekhov | new organs tested | holodeck-summary.test.mjs | noted | 16 pins; the engine path is a manual integration, not yet a test import |
clean: Dijkstra (identity is exact-string by design), Pearl, Ostrom, Frankfurt, Alexander, Kondo

## 2026-10-02 — local work swept in: topic scoping chips, conversation tabs, notes toggle, the pyodide fallback engine, the four summary-fold experiment drivers, and the holodeck-latest lineage merged (main, merge)
fast: 7 files · 59 tests pass (jupyter-runtime passes with ~/holodeck-notebook-venv on PATH; ipykernel/nbformat were missing from homebrew python3) · law: ok (WARN pre-existing cites P186 P199 P22 P232 P244 P32 P4 P55 P80 and dup S17/S96 — carried by earlier commits in range, not this one)
| lens | citation | file:line | verdict | one line |
| Simon/Chekhov | real mechanism shipped unwired | holodeck-pyodide.js | noted | wired: holodeck-notebook.js:135 browserEngine() is the no-server fallback; verified import path |
| Kondo | stray root drivers | experiment-codegen-summary.mjs | noted | the four summary-fold drivers are scratch nothing imports; committed per explicit user instruction, named in the commit message |
| Diaconis | merge resolution | index.html:7641 | fixed | the Summary mode (HEAD) and Regions mode (merged lineage) both kept, additive props, no shared state touched |
| Marshall | merge legality | — | noted | both lineages merged without amending either; holodeck-latest's branch and backup tag untouched |
clean: Holmes, Pearl, Ostrom, Frankfurt, Alexander, Greenberg (no new language-scoped or identity logic added; the merged screen-regions code was already linted in its own lineage)

## 2026-10-03 — the in-tab Pyodide runtime: no server, no install — the pane starts its own Python (main, pyodide-fallback)
fast: 5 files · 21 tests pass (incl. the real-browser pyodide-notebook.browser.mjs: cells, numpy, matplotlib inline, ledgers verified, reload, nbformat 4 export) · law: ok
| lens | citation | file:line | verdict | one line |
| Feynman | a swallowed error | holodeck-pyodide.js:327 | noted | the empty catch on URL parsing is best-effort: on failure the raw string is tried as the path, and the route checks simply miss — no wrong claim |
| Dijkstra | host allowlist | holodeck-notebook.test.mjs:71 | noted | hostsIn + BASELINE pin that the page adds NO new hosts; cdn.jsdelivr.net (Pyodide) is asserted already on the baseline, so the CDN is not a new dependency |
| Ostrom | scope of the absence | holodeck-notebook.test.mjs:78 | noted | "no new external hosts" is claimed against the pre-existing baseline, not an invented one |
| Frankfurt | placeholder | index.html:792 | noted | the hint-placeholder-val attributes are the standing dc-template pattern; the notes toggle they guard is real (notesOpen wired) |
| Alexander | composition seam | holodeck-notebook.js:239 | noted | the starting/connect empty states are mutually exclusive alternatives; retry only exists off the starting path, engine.fetch composes with the pane's F() |
| Simon/Chekhov | real mechanism shipped unwired | holodeck-notebook.js:135 | fixed | the pyodide fallback was already wired here; what was UNWIRED was the hang organ — holodeck-hang.js:275's ESM export broke the classic script parse on every page load since f7a3690, so hang decisions never ran in the browser; index.html now loads it type=module, verified live (HDHang on page, zero pageerrors) |
clean: Holmes, Pearl, Diaconis, Greenberg, Kondo, Marshall

## 2026-10-03 — the falsification record gains the dated Pyodide addendum (main, doc)
fast: 1 file · none affected (doc only) · law: WARN pre-existing S17/S96 in ../eoreader7/native/READING-SPEC.md
| lens | citation | file:line | verdict | one line |
| Alexander | composition seam | NOTEBOOK-FALSIFICATION.md:66 | noted | the addendum says the mode exists AND that run 7's F1–F9 results are not widened by it — the two claims compose without overclaiming |
clean: no other lens routed (doc change, no source touched)

## 2026-10-03 — the Overview page is the when + the cards/table of sources; the separate Sources view retires (main, kondo-simplify)
fast: 2 files · 1 browser test pass (unit hang/overview failures pre-existing on the base) · law: ok
| lens | citation | file:line | verdict | one line |
| Ostrom | absence assigned at the right scope | index.html:497 | clean | the sources gaps ("What to check") still say "Gaps in these sources, not proof that something is absent" on the merged page |
| Frankfurt | a number standing in for a missing prior | index.html:374 | noted | hasFacets stays hardcoded false on the merged page (pre-existing on gh), so the facets block renders nothing — noted, not re-wired, in this diff |
| Kondo | dead or cluttering | index.html:373 | fixed | the summary page's editorial stack (topic input, paradigms + forkParadigm, About This, Lead statements + headlines(), Worth checking, noGround, goal cards + the dead GOALS/goalNav/counts/heads/ex/readScore tree, goOverview button, seenLine/Review) is removed and stashed (STASH.md 2026-10-03); the Sources view body moved into v.summary, its nav item and view id retired, go('sources') call sites re-aimed at summary |
clean: LeviStrauss (nothing in the stash solves an open problem this diff names; nothing reclaimed)

## 2026-10-03 — merge PR #2 (Ask the Fold → Data notebook) against a moved main (merge/pr2)
fast: 2 files (plus the merge) · none affected (phone-fit is a person-run tool; the pane and its tests came from main) · law: WARN pre-existing S17/S96 in ../eoreader7/native/READING-SPEC.md
| lens | citation | file:line | verdict | one line |
| Feynman | a numeric constant in a comparison | tools/phone-fit.mjs:9 | noted | the W<700 is the CDP mobile-emulation profile, not a pass threshold; the fit check itself is scrollWidth <= visualViewport.width |
| Simon/Chekhov | new source no test imports | tools/phone-fit.mjs | noted | a person-run CDP driver (like tools/notebook-falsify.mjs); run live at 320/390/600 with no overflow and no console errors |
clean: no other lens routed (every conflicted file resolves to main)

## 2026-10-03 — topics are the holograph's paradigms, wired to filter; the read-as 3×3 retires and perspective names hold to 1–4 words; the shared module-cache that made heroBarBase read GENRES off the reader is fixed (_readerM) (main, the-fold)
fast: 2 files · 14 affected tests pass · law: WARN pre-existing S17/S96 in ../eoreader7/native/READING-SPEC.md
| lens | citation | file:line | verdict | one line |
| Feynman | a numeric constant in a comparison | index.html:6872 | false-positive-on-review | slice(0,4)/> 4 decide how many source titles one topic row previews; display truncation, unchanged from before the diff, not a threshold any test was tuned to |
| Dijkstra | allowlist / locale logic | holodeck-reader.js:316 | false-positive-on-review | the new 4-word cap splits on whitespace (language-agnostic); it gates the pre-existing English-register labeller, not a locale decision |
| Frankfurt | placeholder | index.html:223 | false-positive-on-review | hint-placeholder-* are the standing dc-template compile metadata, not a value standing in for missing data |
| Greenberg | capitalisation gate with no declared scope | holodeck-reader.js:316 | noted | isNameWord (/^[A-Z]/) and gerund order are English, and perspectivesOf's own comment declares it ("the prior and the register are English — a script it cannot tag yields no act, shown as no chip") |
clean: no other lens routed

## 2026-10-04 — the Kondo sweep of dead value keys after the one-filter strip (main, working)
fast: 2 files · 1 affected test pass · law: ok (WARN pre-existing dup eoreader7 READING-SPEC S17/S96, carried)
| lens | citation | file:line | verdict | one line |
| Feynman | — | index.html:7225 | false-positive-on-review | `sourceKindsUseful: tabs.length > 2` is a disclosure gate on the line we edited, not a tuned verdict; logic unchanged |
| Holmes | — | index.html:5590 | false-positive-on-review | `identitiesTotal`/`↔` display is pre-existing context on the same edited line; no merge added |
| Kondo | P10 | index.html (sweep) | fixed | removed `corrVals`, `rdPanel`/`rdReading`, `readerHint`, `isOriginal`/`faithOn`, `repo` modal, `openNewWs`/`openTask`, `just` panel, `svGroups`, `hasSrcRows`, `showLabels`, `setFw`, `_o`; all stashed with addresses; `S.just` state kept (NEW badge) |
| Lévi-Strauss | — | — | noted | no stashed piece matches this diff's open problems; 2 matches are pre-existing eoreader7/vendor |
clean: none further routed

## 2026-10-04 — constitutive ethos spec M7: situated view over FoldTrace@1 (the-fold, main)
fast: 2 files · 5 affected tests pass · law: ok
| lens | citation | file:line | verdict | one line |
| Dijkstra | holodeck-trace.js:41 | the-fold/holodeck-trace.js | fixed | refusal recognized only from explicit marker (refusal:true or exact literal "declined"), never inferred from prose |
| Holmes | holodeck-trace.js:32 | the-fold/holodeck-trace.js | fixed | observed vs withheld participants kept distinct; absent perspective rendered absent, never invented |
| Simon/Chekhov | holodeck-trace.js | the-fold/holodeck-trace.js | fixed | imported by holodeck-trace.test.mjs (5/5) |
clean: Feynman, Frankfurt, Kondo, Lévi-Strauss, Ostrom, Pearl, Greenberg, Alexander (routed, nothing to report)

## 2026-10-07 — extraction eyes: three witnesses, a per-page reconciliation, and the pixel layer stack (main, eyes)
fast: 5 files · 9 tests pass · law: ok
| lens | citation | file:line | verdict | one line |
| Dijkstra | coverage scored with a Latin range | holodeck-eyes.js:138 | fixed | `cov` now counts `\p{L}\p{N}` in any script, so a CJK/Arabic page is never scored empty; a CJK case pins it |
| Simon/Chekhov | a new module no test imports | holodeck-eyes.test.mjs | fixed | holodeck-eyes / screen-core / screen are now imported by a real test (9 pins: layers, reconciliation, sensing, trails, contentOf, dominant) |
| Feynman | declared thresholds, no measured golden | holodeck-eyes.js:103 | noted | RECONCILE_MARGIN, watermarkAlpha/Extent, foreground, sense bias 1.2 and the 40-char escalation floor are DECLARED initial settings with a stated basis, not calibrated against a corpus — disclosed here as such |
| Kondo | a stored detail nothing reads yet | index.html:4294 | noted | `eyes:<id>` (per-page witnesses, layer rows) is written to idb for the coming layers panel; nascent, not dead |
| Frankfurt | a duplicated eye registry | index.html:2904 | noted | HD_EYES mirrors holodeck-eyes.js so the card can name the eyes before the module loads; the module is the source of truth and hdEyesForPdf labels from it |
| Diaconis | a measurement was touched | index.html:6838 | clean | the normalized doc now carries the eyes summary (pages/chosen/watermark/disagreements); the counts are the reconciliation's own, no null invented |
| Alexander | the composition seam | holodeck-screen.js:61 | clean | contentOf → reconcile → overlay cohere; the overlay only carries pages the model won (one page in, one out), pinned by test |
clean: none (all seven routed lenses reported above; Marshall not routed — no law edited or cited)

## 2026-10-11 — audio reads itself: auto-transcribe on add, words stream into the reader, the sound map classifies (YAMNet, in-browser) at the change points, and the measured preamble moves behind a disclosure (working, sound-classify)
fast: 7 files · 5 tests pass · law: ok
| lens | citation | file:line | verdict | one line |
| Simon/Chekhov | new module with no test import | holodeck-classify.js | fixed | holodeck-classify.test.mjs imports it and proves the change-point merger (5 tests, two FALSIFIERs); the module is wired at both call sites (addDocs, componentDidUpdate) |
| Diaconis | a measurement whose test uses synthetic frames | holodeck-classify.test.mjs:5 | noted | the merger rule is proved on synthetic label streams; YAMNet's own label accuracy is a machine reading — disclosed in the reader and README, never re-claimed as checked |
| Feynman | a numeric constant in a comparison | holodeck-classify.js:75 | noted | k < 521 is the fixed AudioSet class count (a property of the model output), not tuned; the classify failure path is traced via hdT, not swallowed |
| Pearl | a corroboration / independence claim | yamnet-names.js:265 | noted | "Independent music" is a class label; frames inside a span are smoothed *because* they are correlated, never counted as independent evidence |
| Frankfurt | a placeholder value | index.html:2285 | false-positive-on-review | hint-placeholder-val="{{ false }}" is the surface's standing sc-if template syntax (dozens in the file), not a placeholder hack |
clean: Diaconis, Feynman, Pearl reported above; Marshall not routed — no law edited or cited

## 2026-10-13 — untranscribed audio cards show a waveform, not the measured preamble; a finished transcription lands in the workspace that holds it, not the one on screen (main, index.html)
fast: 1 file · 0 affected tests (none imports index.html) · law: ok
| lens | citation | file:line | verdict | one line |
| Dijkstra | encodeURIComponent in an identity-looking position | index.html:5806 | false-positive-on-review | URL-encodes an SVG the function built itself into a data: URI; no locale, script or identity comparison |
| Frankfurt | a placeholder value | index.html:616 | false-positive-on-review | hint-placeholder-val is the surface's standing sc-if template syntax, as logged 2026-10-11 |
clean: Dijkstra, Frankfurt reported above; Marshall not routed — no law edited or cited
checked live (not by a test): a mid-run workspace switch lost the transcript on the deployed page and lands it correctly with the fix; the same click with no switch transcribes in 13 s

## 2026-10-13 — a YouTube link says why its captions were not read, and no longer stalls on proxies that cannot answer (main, holodeck-yt.js + index.html)
fast: 3 files · 1 affected test file, 6 pass · law: ok
| lens | citation | file:line | verdict | one line |
| Simon/Chekhov | new mechanism with no test import | holodeck-yt.js | fixed | holodeck-yt.test.mjs imports transcriptOutcome/transcriptFor: captions, helper-unreachable, helper-error, no-track, the old null contract, and the proxy rung ending inside its one budget |
| Feynman | a numeric constant in a comparison | holodeck-yt.js:89 | noted | PROXY_BUDGET_MS and the 400 ms floor are operational deadlines, not a threshold tuned against a golden or a verdict; 6 s replaces the measured 15 s x 4 stall |
| Dijkstra | an allowlist | index.html:4229 | false-positive-on-review | one more field name in FIELD_META_SKIP so captionsWhy never becomes an emergent metadata column |
| Kondo | a rung nothing profits from | holodeck-yt.js:83 | noted | the public-proxy rung returned no caption body on 5 of 5 videos (timedtext now needs a proof-of-origin token; the watch page itself still arrives, also via the n8n feed proxy); kept and bounded rather than stashed, a candidate for STASH.md if it stays empty |
clean: Feynman, Dijkstra, Kondo reported above; Marshall not routed — no law edited or cited
checked live (not by a test): with no helper the link ingests in about 7 s, the card reads "no captions — helper not reachable" and a toast names the cause; with tools/ytdl-helper.py running, the same link comes back transcribed "via your yt-dlp helper". Innertube POSTs from a browser origin fail on CORS, so no browser-only route remains.

## 2026-10-13 — a Cloudflare Worker that answers the helper's /health and /captions, so a hosted page can read YouTube captions with nothing local (main, tools/cf-captions)
fast: 4 files · 1 affected test file, 8 pass · law: ok
| lens | citation | file:line | verdict | one line |
| Simon/Chekhov | new source with no test import | tools/cf-captions/worker.mjs | fixed | worker.test.mjs imports it: response shape, ANDROID→IOS fallback, 502 with the refusal reason, empty-body refusal, origin / id / method / path checks, and that fmt is replaced not appended (ANDROID tracks arrive with fmt=srv3) |
| Dijkstra | case-folding a language tag | tools/cf-captions/worker.mjs:26 | noted | BCP-47 tags are ASCII and case-insensitive, so lowercasing is the comparison, not an identity; pickTrack is a copy of holodeck-yt.js's (unexported there), so the two can drift — a candidate to export and import |
| Feynman | a skip / a "only" in prose | tools/cf-captions/README.md:25 | false-positive-on-review | the line states the worker's scope; no check is skipped |
clean: Feynman, Dijkstra, Simon/Chekhov reported above; Marshall not routed — no law edited or cited
checked live (not by a test): the worker's code run against real YouTube from an ordinary address returned captions for 4 of 4 videos (2, 6, 59 and 26 segments). The first run returned "empty" on all of them — the ANDROID client's track URL already carries fmt=srv3 and the appended fmt=json3 was ignored; fixed by replacing the parameter. NOT measured: YouTube's treatment of Cloudflare's egress addresses; nothing is deployed.

## 2026-10-13 — the user's own browser reads the captions: a capture-extension bridge and rung, with one shared reader the Cloudflare worker now imports (main, extension/ + holodeck-yt.js + tools/cf-captions)
fast: 12 files · 3 affected test files, 24 pass · law: ok
| lens | citation | file:line | verdict | one line |
| Simon/Chekhov | new source with no test import | extension/captions.js, extension/background.js | fixed | captions.test.mjs imports the reader, runs content.js in a stub window against it, and imports background.js with a stub chrome (id validation, async reply, other messages ignored) |
| Diaconis | Math.random | holodeck-yt.js:113 | false-positive-on-review | a request/reply correlation id, not a sample or a null |
| Feynman | numeric constants | extension/captions.js:32 | noted | 1.2 s and 520 characters decide only how closely-following caption lines are joined for display (copied from holodeck-yt.js parseJson3); they are presentation, tuned against nothing, and bear on no verdict |
| Dijkstra | case-folding a language tag | extension/captions.js:41 | noted | BCP-47 tags are ASCII; also changed here: language now outranks manual-vs-auto (the copied scoring put a German typed track above English auto-captions) |
clean: Diaconis, Feynman, Dijkstra, Simon/Chekhov reported above; Marshall not routed — no law edited or cited
bug found only by the integration chain, not the unit tests: window.postMessage to oneself is delivered to the sender's own listener, so the page took its ping for the extension's answer and reported "not installed"; fixed by matching the reply type, and the test stub now echoes like a browser.
checked live (not by a test): real content.js + real reader + real network + the page's transcriptOutcome, in one process: 4 of 4 videos through rung=extension in ~0.5 s each. NOT checked: the extension loaded unpacked in a real Chrome (no way to do that from here).

## 2026-10-13 — Fix names: bulk typo renames + hand SYN/SEG/CON over referents, full-screen activity (main, staged)
fast: 4 files · 1 affected test file (12) pass · law: ok (no citations)
| lens | citation | file:line | verdict | one line |
| Dijkstra/Greenberg | — | holodeck-referents.js shape/rarity witnesses | fixed | QWERTY + English sound + Latin tokenizer scope now declared; other scripts go silent, not guessed |
| Pearl | — | holodeck-referents.js mentions vs rarity | noted | mentions witness speaks only when rarity is silent, so frequency is not counted twice |
| Simon/Chekhov | — | holodeck-referents-panel.js | noted | DOM panel has no unit test; verified live (fold, SEG, CON, undo, wide + 375px) |
| Frankfurt | — | holodeck-referents-panel.js:147 | false-positive-on-review | HTML placeholder attribute, not a stand-in value |
clean: Diaconis, Feynman, Holmes, Ostrom

## 2026-10-14 — the demo guides itself: samples.json carries the sample's try-questions and intro card (read generically), share meta on both addresses, and a one-page guide for the shared link (main, demo)
fast: 4 files · none affected (no test imports index.html or samples.json; demo-guide.html is static) · law: ok
| lens | citation | file:line | verdict | one line |
| Feynman | a swallowed error | index.html:10433 | false-positive-on-review | the pointer-fetch catch is the pattern the old inline fetch carried — a failed fetch degrades to no sample, exactly as before; the forceUpdate try/catch only guards an unmount race |
| Frankfurt | a placeholder value | index.html:636 | false-positive-on-review | hint-placeholder-val is the surface's standing sc-if template syntax (logged 2026-10-11, 2026-10-13) |
clean: Lévi-Strauss (stash × open problems ran; none of its pieces meets this diff — no join earned)
checked live (not by a test): index.html?ws=titanic-1912 in Chromium — the intro card, its three chips and the composer chips all render from samples.json; a chip lands on the question's record answer ("How many lives were lost?" leads with the report's "1,490 lives"; the band question leads with Beesley's passage); the dismissal (hd:intro:titanic-1912) survives a reload. Carried into this commit, found live: the chips route through askQuestion (the hero/omni front door — Ask when a model is ready, the record's own answer otherwise) because holodeck-ask.js cannot be imported at all: vendor/eoreader7/native/kernel/reading-rules.js is missing in this repo and 404 on the deployed site (pre-existing, not this diff).

## 2026-10-14 — The demo sheds the Ask door: no rail entry, no ask buttons or try-chips, the `?work=` entries do not open it; a typed question lands on the record's own answer in search, and the ask code stays in place, unwired (main, demo; entry written just after the commit, which landed with holodeck-map.js's own commit in the same push)
fast: 4 files (index.html 41/−, samples.json, demo-guide.html, holodeck-map.js) · no test imports a changed file; the 49 standing workspaces/share tests re-run green · law: ok
| lens | citation | file:line | verdict | one line |
| Kondo | dead or unplugged code | index.html:7790 | noted | the ask view, composer and askSend stay in the file, deliberately unwired: the rail entry, both "Ask the Fold" buttons, the cfold Ask/Build pair, the try-chips, the ask badge, askFold and the `?work=` view entry are gone; the comment names it ("the ask view stays unreachable, not a dead end") and README says off-in-preview |
| Feynman | a swallowed error | index.html:5939 | false-positive-on-review | the componentDidUpdate try/catch is the standing pattern; this diff only stopped calling akAutoLoad, with the door |
| Ostrom | scope of absence | index.html:2206 | noted | the record's "Best answer" card no longer offers the Ask link; its claim is unchanged and now reads exactly as far as the record answers |
| Simon/Chekhov | new or untested source | holodeck-map.js | noted | carried in the same push by its own commit; a canvas/DOM panel with no unit test, matching the referents-panel precedent — verified only to load without error (below) |
checked live (not by a test): the deployed index.html?ws=titanic-1912, via Playwright/Chromium — the rail has no Ask, "Ask the Fold" and the try-chips appear nowhere in the body, the intro card renders its lead and its "Look at the death toll" hint, and the sample's readings list. The only failing requests are the standing ones (the missing vendored reading-rules.js, two cross-project stubs, three literal template-placeholder URLs the browser fetches pre-hydration) — same class the previous entry logged; no new error. NOT checked live: the Connections map's new detail card beyond a clean load.

## 2026-10-14 — README carries the Ask door's preview state, and CHORUS-LOG gains the ask-removal entry (main, doc)
fast: 2 files (README.md, CHORUS-LOG.md) · none affected · law: ok (no citations)
| lens | citation | file:line | verdict | one line |
| Kondo | dead or unplugged code | README.md:189 | noted | the note names the unplugged door so the doc stops promising an entry the surface no longer offers; the machinery paragraph stays, marked for its return |

## 2026-10-15 — The rail finds its way home, and a source finds its words: a navigation bar in the rail (back step by step, Sources, the header's own breadcrumb trail) and find-in-source with Ctrl/⌘+F over the rendered document, highlighted with the CSS Custom Highlight API so the page's own marking is never touched (main, surface)
fast: 1 file (index.html, +122/−4) · 49 standing workspaces/share tests re-run green · no test imports index.html · law: ok
| lens | citation | file:line | verdict | one line |
| Feynman | a swallowed error | index.html:6005 | false-positive-on-review | the find-paint guard matches the component's standing guarded-paint pattern (paintExtracted and neighbors); a failed paint leaves the last highlights and no crash |
| Dijkstra | locale/script in a fold | index.html:8674 | noted | the fold is the locale-independent toLowerCase on BOTH haystack and needle, so it cannot mismatch itself; it can only miss exotic case pairs, the disclosed limit of substring find |
| Frankfurt | a placeholder value | index.html:224 | false-positive-on-review | hint-placeholder-val is the surface's standing sc-if template syntax (logged 2026-10-11, 2026-10-13, 2026-10-14) |
checked live (not by a test): local server + Chromium — the rail navbar renders ("▤ Sources"; back disabled on Sources); the Senate speech opens from the sample; the reader's Find button opens the bar, "Titanic" reports "1 of 18" with live CSS Custom Highlight ranges, Enter/Escape step and close; after opening a source the rail's back reads "← sources" and returns to Sources. Zero page errors. NOT checked live: the 375px rail layout with the navbar stacked, PDF/faithful-page hosts, and find while the reader re-renders mid-scroll.

## 2026-10-15 — The Titanic table reads as a table: the "Numbers saved" reading drops the 24-line flattening of its own rows that rendered under the table (holodeck-samples main, samples)
fast: 1 file (titanic-1912/readings.json) · no test imports a changed file · law: ok (no citations)
| lens | citation | file:line | verdict | one line |
| Feynman | a numeric constant / a skip | titanic-1912/readings.json:76 | false-positive-on-review | the routed pattern is the reading's own numeric table cells; this diff removes the display paragraphs the generator appended, adding no claim, threshold, or skipped check |
checked (not by a test): the reading's `html` now ends at `</table>` (14316 → 11670 bytes; 0 stray `<p>`), and the surface injects a reading's own bytes verbatim (`index.html:8649`), so nothing else changes. Pairs with the `samples.json` → v4 bump (so returning visitors reinstall). NOT checked on the deployed page (Pages rebuild lands with the push).

## 2026-10-16 — a figure's relation is read from its own clause, not a corpus word list: the POS prior nominates a verb and cross-source recurrence decides whether it names the referent — the Titanic's contradictions unchanged, an unseen San Francisco corpus's death toll surfaced (topics-holograph-profile, surface)
fast: 3 files (index.html, docs/SOURCE-CONTRADICTION-PREREG.md, holodeck-relation.test.mjs new) · 520 standing root tests pass; 27 pure (contradiction + relation + tables) · law: ok (no citations)
| lens | citation | file:line | verdict | one line |
| Feynman | a numeric constant in a comparison | index.html:5028 | noted | the `>= 2` is the recurrence floor (a relation ≥2 sources share), the same "came round again is 2" as WITNESS_FLOOR, documented in the block comment; not tuned against a golden |
| Dijkstra | locale/case fold standing in for identity | index.html:4938 | noted | the verb token is lowercased and plural-stripped only to NOMINATE a relation (English-scoped, the pos-eng prior), and recurrence decides — a fold cannot stand in for identity |
| Pearl | a corroboration / independence claim | docs/SOURCE-CONTRADICTION-PREREG.md:352 | noted | the SF distance pair's independence rests on USGS; en/simple Wikipedia share a common cause, disclosed here so the label is read with that share |
| Ostrom | scope of credit / absence | docs/SOURCE-CONTRADICTION-PREREG.md:358 | false-positive-on-review | the claim is a measured comparison against the committed baseline (probe-titanic: identical four topics), not a pooled attribution |
| Frankfurt | a placeholder / hardcoded value | docs/SOURCE-CONTRADICTION-PREREG.md:384 | false-positive-on-review | the witness list is real witness knowledge that only NOMINATES (recurrence decides), and the limit is disclosed in the same line |
checked live (not by a test): the fold opened BARE (no sample) + the three unseen 1906 San Francisco sources ingested through addDocs, via Playwright/Chromium — before the change: `San Andreas Fault · distance` 296/310 corroborated (already not Titanic-only); after: that preserved AND `San Francisco · killed people` 300/3,000 single-witness surfaced from the corpus's own verb, with no Titanic vocabulary. The Titanic (?ws=titanic-1912) measures identical to the committed baseline: tonnage 45,328/46,328/60,000 corroborated; aboard 2201/2340 and saved 705/711 single-witness; "lives lost" still the named gap. NOT checked live: a corpus whose disagreement is stated only through a noun head ("700 deaths" vs "3,000 deaths") stays a named gap — disclosed, not fixed.

## 2026-10-16 — the reading's output is an artifact: the layer-by-layer page now emits the source with each sentence's proposition diagrammed, and the whole reading (propositions, referents, Provenance@2 ledger) as one JSON — and a proposition the reader stated with no span is no longer pinned to sentence 1 (topics-holograph-profile, surface)
fast: 10 files (reading/index.html, reading/generate.mjs, 6 examples, README.md, index.html) · no test imports a changed file · law: ok (the lone "S0" the scanner flags is a local variable in the page's own row renderer, `const e = ev[i], S0 = L[e.stage]`, not a rule citation)
| lens | citation | file:line | verdict | one line |
| Feynman | a swallowed error | reading/generate.mjs:32 | false-positive-on-review | the `catch {}` is `server.kill()` on process exit, the same cleanup the repo's probe drivers use; no try/catch was added to the reading itself |
| Dijkstra | a locale fold standing in for identity | reading/generate.mjs:22 | false-positive-on-review | the toLowerCase builds only the output FILENAME slug, never an identity, hash, or allowlist decision |
| Greenberg | a Latin-only split / an SVO field name | reading/index.html:505 | noted | the reading is English, Latin script, subject–act–object; the output now SAYS so (a `scope` line, and each prior named with its giver). Another language or word order stays a typed gap |
| Holmes | identity or coreference touched | reading/examples/metro-code-13-08-080-surveillance-technology.json:90 | false-positive-on-review | the diff reads T.refs and prints it; the referent rule is unchanged — the cited line is definitional text inside an example source |
| Simon/Chekhov | a real mechanism shipped untested | reading/generate.mjs | noted | the page is verified live, not by a unit test: generate.mjs drives it in headless Chromium and fails loudly if `window.__reading` is absent |
| Ostrom | scope of credit / absence | reading/examples/rs2026-2264-resolution-and-certification.txt:496 | false-positive-on-review | the 3 "unlocated" propositions are the reader's own no-span claims, shown as such (never attributed) — absence named, not credited |
checked live (not by a test): two show-stopping defects were found only by running it on real material, and both are now fixed. (1) An unlocated proposition — the reader returned `Darwin ──opposed──▶ the standard` with no span — was attributed to sentence 1 because `buildTrace` falls back to `s = 0`; it is now flagged `located: false` and shown under **unlocated propositions** in the page's Props tab, the text, and the JSON (`json.unlocated = [2]`). (2) Three propositions sharing one span made a sentence print three times under `«…»`; overlapping marks now merge (council record statement 1: one mark, three drawn propositions). Measured over three real municipal records driven through headless Chromium: `demo-motorola` Council debate 81 statements / 19 propositions (19 read) / 2,853 steps / 0 model calls; Metro Code 13.08.080 37 / 16 (16 read) / 2,795 steps; RS2026-2264 resolution 134 / 55 (52 read, 3 unheard, 3 unlocated) / 3,010 steps. Outputs in `reading/examples/` (text + JSON). Zero page errors. NOT fixed, disclosed: the reader emits DUPLICATE claims (Metro Code: 16 propositions, 11 distinct — `Metropolitan Government —of→ Nashville` three times on one span); the export prints each claim as the reading made it rather than de-duplicating, because the page's Props tab shows the same rows. The reading also reads a title line as relations (`Motorola ──/──▶ CAD`), an SVO reading of a header.

