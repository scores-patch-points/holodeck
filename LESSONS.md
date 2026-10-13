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
