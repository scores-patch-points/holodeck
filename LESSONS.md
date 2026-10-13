# Lessons

General lessons for the Holodeck, written down so the next change starts from them. Each is something that
went wrong or was measured, with the rule it earned. Pipeline specifics (the Metro contract archive) stay with
the pipeline; only what applies to the Holodeck in general is here.

## 1. A panel narrows by its own width, not the window's

A `@media (max-width)` rule keys on the window. With the sidebar open the list can be a few hundred pixels wide
inside a wide window, so the one-fraction Name column collapsed to zero and the Kind column printed over it.
Use a container query on the panel (`container-type:inline-size` on its box, `@container (max-width:...)`).
Keep the media query only as a fallback.

## 2. Never use native drag-and-drop for in-page gestures

This page treats anything dropped on it as new content ("links and text can be dropped anywhere"). A native drag
of a table header was read as a text drop, and native drag on a header is unreliable anyway. Drag with pointer
events instead: `pointerdown` on the handle, `pointermove` past a few pixels, `pointerup` over the target, and
swallow the click that follows. Nothing starts a native drag, so the page's drop handler never sees one, and
the gesture can be tested with synthetic mouse input. Row drag to a folder still uses native drag on purpose.

## 3. Name the fields the extraction states; discover the rest

Department and expiration come from the extraction as named fields, so they are explicit columns: always
present, always sortable, leading. Everything else is discovered as a recurring label. Do not leave an
explicit field to be found as one recurring label among seventy.

## 4. Rank discovered fields by what they tell sources apart, with no constant

Importance = (sources carrying the field / all sources) x (normalised Shannon entropy of its values). A field
every source has and that differs between sources outranks a rare one and a constant one. Type is read off the
values by plurality; a plain-number field whose values are mostly distinct is an identifier.

## 5. Every sort puts "no value" last, whichever way it runs

Compare with an explicit null branch; do not let `undefined < x` decide. And choosing a sort on a field that is
not a column yet should add the column, so the order can be seen.

## 6. A scrolling panel should take the space it has

A fixed `max-height:72vh` leaves a gap that varies by window. Measure the panel's own top edge and give it the
rest of the window (`innerHeight - top - margin`), refit on render, resize and scroll, and let it scroll inside
itself.

## 7. A deployment adds screens; it does not edit the app

`screens.json` lists whole pages (`id`, `label`, `src`); they join the sidebar and open full height with a
Back button. Purpose-specific pages (the pipeline sync board) are declared there and live beside the app.
A missing or invalid file changes nothing.

## 8. A claim of "works" needs the real input, or it says what it used

Column drag passed with synthetic `DragEvent`s and failed for the user. Say which kind of input a check used,
and prefer an input the user's own gesture produces.

## 9. Dev servers started for previews may be killed after about five minutes

Restart the preview server before a long check; "Failed to fetch" on `/epav/...` can simply be a dead server.

## 10. A header that means nothing needs its key in the value

The "Date" column, the tile subtitle and the date sort all showed a year that was, in all 359 dated contracts,
exactly the expiry year. "Date" said nothing; "2007" said nothing. Name a date by the field it equals when it
is loaded (`withDateKey`: "Expires 2007"), so every place that prints it carries the key. A bare "Date" is
only honest if it is the file's own creation date, and that has to come from the file, not from a field.

## 11. Evidence for a group must be independent of how the group was formed

Topics are groups of sources that share a stated field value (department, the head of an `about`, a vendor or
subject word), kept only when their body text is more alike than any of 500 fixed-seed random same-size sets. A
group formed from phrases lifted out of the text and then checked against that text passes by construction and
labels itself with boilerplate. Candidates come only from fields the source itself states. Run the same
function on those fields shuffled across sources: real 37 topics placing 388; shuffled 0 to 2 placing 0 to 43.

## 12. Assign to the most specific group, name it by what its members state

A z-score grows with group size, so the largest department swallowed everything (10 topics). Each source goes
to the passing group whose members' text it reads most like (mean cosine): 37 topics, Tier I and Tier II
Contractor apart. Name a group by the phrase most of its own members state, never the bare token. Make labels
unique, because the topic toggle is keyed on the label and two equal labels flip together.

## 13. A name match is not corroboration

Legislation that names the contracting party is a match on a name. It is "corroborated" only when the title also
names the contract's own subject or department. Measure boilerplate within the pool a title is compared
inside (contract-type titles: "between" was in 77%, not under half of everything), drop the words that admitted
the title ("lease"), and treat the party's own words, initials and stems as the match itself. Say plainly what
could not be separated: a party's alias (MNAA) can still pass as a subject word.

## 14. Data the app depends on must be committed, or the fallback must be visible

Topics, department and vendor columns exist only in a seed that was never committed; the committed seed has
none of them, so a clean checkout silently falls back to the older method. Commit the data, or make the page
say which method it is using. Check by loading the committed tree, not the working one.

## 15. An open menu is a sheet over the page, not content pushed down

At narrow widths the open menu put five rows of controls in the page flow and moved every tile about 450px
down. A menu is a fixed sheet that scrolls on its own and closes when a choice is made; closed, the chrome is
one slim bar and one row of tabs, and exactly one Add button shows at a time.

## 16. Do not kill a server the user is looking at, and say which origin a failure is on

"Failed to fetch" on a PDF, blank thumbnails and "could not reach the VM" were all the page's own origin being
dead: a test server stopped while the shared pane still pointed at it. Leave the pane on a live origin before
stopping a test server, and attribute a failed fetch to the page's origin first, the VM second.

## 17. Commit from an isolated worktree, and only your own hunks

The shared checkout carries other people's uncommitted work and `main` moves under you. Build the commit in a
worktree off `main` containing only your hunks, fast-forward `main` only if it is still an ancestor (else
rebase), and never move the branch ref without making the working tree match. Check the staged diff before
committing, and leave uncommitted data files (the seed) out of the commit.

## 18. When the positions are known, set the text back where it was

A reflowed "clean" version of a scan (paragraphs, headings guessed from capitals) mangled amendments, tables and
justified blocks. OCR gives every word's box, so the extracted view puts each word at its recorded position and
size, aligned on the line's baseline (the lower-valued bottoms; descenders do not share it), as real selectable
text, a page at a time as it scrolls into view. Layout is data; do not infer structure that was measured.

## 19. Fold a scan against what the rest of the sample established, and refuse ties

A "best guess" at a misread word is not the most likely next word. The engine's own discipline applies: a form
another contract reads stands as read; a near-miss (one edit, four letters or more, or a visual confusable) is a
last resort; the neighbours are witnesses that narrow candidates and never choose between them; more than one fit
is refused, not guessed. A form is established by document frequency with the page's own document subtracted, so
its misreads cannot vouch for themselves. Held out on 3,068 deliberately corrupted words: 77.5% put back, 1
wrong, 14.7% refused. Names are not respelled.

## 20. This page strips native tooltips, and the engine's addresses are in its own buffer

Every `title` attribute is removed by a document-wide observer, so a hover explanation is `data-why` plus a tip
the component draws. And `mentionsAt` from `/v1/read` are offsets into the engine's normalised text, not the text
sent: use the engine for which referents exist and under which surfaces, then find those surfaces on the words.

## 21. A fold slider is a level, and a scan's justification gaps are not layout

A divider drawn across the page answers "where", not "how much", and it cut words in half. The slider is a fold
LEVEL: 0 is the OCR as read; moving right applies, in thirds, the repairs (most-vouched first), the engine's reading
of what the words are, then the cleanup of stray glyphs and what stays unsure. The page tints subtly with it. And the
wide gaps in a justified scan line are the printer's, not the document's: set the words at ordinary spacing, keep
what the layout actually says (centring, indents, relative size, blank space between blocks), and run the pages
together as one continuous scroll. A glyph like ¢ or ⌟ inside a date or an amount is cleaned off it, not the token
deleted; only what has no word or number left is dropped.

## 18. A wording link is kept only when it beats a null drawn from the workspace minus its partner

Statements are paired across sources by shared tokens (idf in bits, adjacent-word pairs, normalised dates and figures),
mutual best and strictly best. Whether a pair is *more than chance* is asked of a resampling null: replace the
statement with as many tokens drawn from the workspace's own token distribution (fixed seed) and take that
replacement's best partner score; the real pair must beat every draw, on both sides. Three things were tried and
measured before this one. Drawing from the whole workspace is wrong: the bag pulls in the partner's own distinctive
words at its share of the corpus, which is the very dependence under test (lease 5.1 against act §14: observed 31.5,
null 31.7). Drawing from statements of *other* sources is wrong the other way: a third source that says something
closer penalises a genuine pair. Excluding the partner source from the draw gives numbers that read as a null
(genuine pairs 19–39 against 16–20; loose ones lose). A workspace of eleven statements cannot beat chance with
anything, and says so: those pairs go to a "below chance" list in Review, never asserted and never dropped. A
tie is not a best, and a decision a reader made is an event in an append-only log, so recomputing never loses it.

## 19. A default that adds a feature can break the main path: test the default, with a real file

Transcription listened with a vocabulary prior by default (the workspace's names fed to Whisper as
`decoder_input_ids`). On the WebGPU path that threw ("Cannot convert [object Object] to a BigInt"; in the app,
"Session mismatch"), so every automatic transcription died in the decoder while the manual one with "no prior"
worked. The prior was removed, not repaired: plain transcription is what transformers.js supports, and it was
verified over one, two and three 30-second windows and then on a two-hour file that began by itself. A feature
that changes what the recognizer is *given* needs its own check against the recognizer, not against the page.

## 20. Do not write a waveform down as sentences

Reading a recording used to produce "Section 3 is heard from 1:14 to 1:35 at an average level of -17 decibels":
forty-odd statements per file, each true and none of them said by anyone. They became the source's statements, so
every summary of a recording summarised its loudness. A recording is listed with its length, rate and channels
from its container, and gets words only from a transcript and kinds of sound only from the sound map.

## 21. Queue the model jobs a recording starts; do not start them together

The sound classifier (YAMNet, onnxruntime-web) and the recognizer (transformers.js) are two runtimes in one tab.
A recording now transcribes first and is classified after it, one file at a time (`soundWork`); a failure in
either is its own and stops nothing else.

## 22. A shared preview is somebody's page: test in a copy, or ask

The preview pane is a real browser the user also uses. A two-hour transcription was started in it by hand while
this was being built, and a reload would have lost it. Do not reload, click or script a tab that has a job
running; open a second tab on a separate workspace, and never edit the user's sources to make a test pass.

## 23. One style attribute per element

`'<p ' + P + ' style="…">'` where `P` is itself ` style="…"` gives the element two `style` attributes, and the
browser keeps the first. The note that said the words were a machine reading came out in the transcript's own serif
and read as the next line of what was said, and the live words never got their accent border. Merge declarations
into one attribute, and set a note that is not content in the interface's own type, boxed, above the words.
