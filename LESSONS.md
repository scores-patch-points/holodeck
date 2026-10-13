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
