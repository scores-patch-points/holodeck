# Drive-style Sources view — pre-registered acceptance record

Branch `holodeck-drive-sources`. Written **before any code**. Predictions below
are never edited after the fact; results are appended under "Results" with the
commit they were measured at. If a prediction fails, the failure is recorded
next to it, not rewritten.

The page is a thin client. Everything that can be decided mechanically lives in
pure modules with `node --test` tests; the DOM module only draws and forwards.
No model is called anywhere in this feature.

## What would embarrass it

Each line is an embarrassment, the measurement that would expose it, and the
**control built to fail** — a deliberately wrong implementation the same
measurement must catch. A measurement that cannot catch its own control proves
nothing and is reported as such.

| # | Embarrassment | Measurement | Control that must fail |
|---|---|---|---|
| E1 | A drag, a click or a context menu moves the page (scroll jumps, focus steals the viewport). | Live, in the browser pane: scrollY of the window and scrollTop of the sources scroller are equal before and after drag-drop, click-select, shift-click, and context-menu open. | A handler that calls `scrollIntoView` on the dropped tile. |
| E2 | A thumbnail shows content from the wrong source. | Pure: the cache key is the SHA-256 of the content the thumbnail was made from; looking up a source whose content changed (same id, new bytes) misses; two sources with the same bytes share one entry; the snippet shown is a verbatim prefix of the source's own text. | A cache keyed by source id: it must serve the stale thumbnail after the content is swapped. |
| E3 | Migration loses a folder or a source's membership. | Pure property test over randomized legacy `fold-explorer-folders` stores (empty, malformed, duplicate ids, a source in two folders, a folder referencing a source that is gone): every legacy folder id survives with its name; every legacy (source, folder) membership is either adopted or itemised in the migration record; the legacy key is byte-identical afterwards. | A migration that copies only the first folder. |
| E4 | Undo does not restore. | Pure property test: for random sequences of operations (bulk move, trash, restore, rename, star, folder create/move/trash with contents), applying the operation and then its undo yields a state deep-equal to the state before. | An undo that reverses only the last item of a bulk move. |
| E5 | 2,000 sources freezes the page. | Pure: deriving the rows (filter, sort, window) for 500 and 2,000 synthetic sources, timed, medians of repeated runs. Live: scrolling and sorting a 2,000-source workspace in the browser pane, with long tasks counted by `PerformanceObserver`. DOM node count stays bounded by the window, not by N. | A renderer that mounts every row: its node count and render time must visibly scale with N. |
| E6 | A preview is fabricated. | Pure: a source with no bytes and no text yields the type icon and never an image; a PDF whose first page cannot be rendered yields the icon, not a placeholder page; the preview record says what it was made from. | A generator that returns a stock image when generation fails. |
| E7 | "Last modified" shows the published date instead of when the source was added, or invents an added time for a source this view never saw arrive. | Pure: a source published in 1999 and first seen today shows today; a source present before the view existed shows "Earlier" with no time; the added time never changes after first sight. | A column that reads `published`. |
| E8 | Trash is not a safety net: a trashed source still counts in the reading, or restore puts it somewhere else, or Discard is still one click. | Pure: trashed ids are excluded from the analysed set and listed in Trash; restore returns it to the folder it left (or to the top level, said plainly, if that folder is itself in Trash); the page no longer exposes a one-click permanent delete on a card. | A trash that only hides the tile. |
| E9 | A folder is moved into itself or its own descendant. | Pure: the move is refused at write time and ignored at fold time (a log written elsewhere cannot create a cycle). | A move without the ancestor check: it must produce a cycle that the fold would loop on. |
| E10 | Keyboard or screen-reader users cannot operate it. | Pure: roving-tabindex model has exactly one tab stop; arrow/Home/End/PageUp/PageDown/Space/Enter/Delete/F2/Escape map to the right actions; roles are `grid`/`row`/`gridcell` (list) and `listbox`/`option` (grid), `menu`/`menuitem` for the context menu. Live: Tab order walked in the browser pane. | A model that gives every tile `tabindex=0`. |
| E11 | Multi-select is wrong (a range across a sorted order, selection lost on sort, select-all counting hidden sources). | Pure property test of the selection state machine. | A range computed over insertion order instead of the displayed order. |
| E12 | Analytic or canon vocabulary fronts the surface. | Pure: a lint over every user-visible string the modules can emit against a forbidden-word list (terrain/EO terms). | A string table containing "ground" or "holon". |
| E13 | The three branches stop merging. | `git merge-tree` of this branch against `holodeck-matrix-invites` and `claude/holodeck-research-assistant-babe7f`: no conflict in `index.html`; the number of changed `index.html` lines is reported. | n/a (reported as measured). |
| E14 | The surface breaks at the narrow width (horizontal page scroll, controls off-screen, grid tiles overlapping). | Live: `document.documentElement.scrollWidth <= innerWidth` at the operator's ~1134 px and at 375 px, screenshots shared. | A fixed 960 px table. |
| E15 | The page is no longer plain-language. | The status chips, empty states, menus and toasts are read in the live page and in the string table; no chip is a raw status code. | n/a (reviewed; listed under what is not established if only reviewed). |

## Predictions about the numbers

* **P-scale.** Row derivation for 2,000 sources is within the same order of
  magnitude per source as for 500 (it is O(n log n) for sorting only, nothing
  quadratic); the DOM node count in the viewport is independent of N (window
  size ± one overscan page).
* **P-budget.** One interaction (select, sort change, folder open) over 2,000
  sources finishes derivation inside a single frame budget of the display
  (declared once in `DECLARED`, with its reason). I expect this to hold for the
  pure derivation and to be at risk for first paint of thumbnails (images
  decode off the main thread; PDF page render does not and is queued).
* **P-thumb.** For a mixed workspace the preview coverage is: image sources
  100% when bytes exist; PDFs when pdf.js loads (the page already loads it
  from its existing CDN import; offline it is the honest icon); text-bearing
  sources 100% (a verbatim snippet); audio/video: YouTube thumbnail when the
  id is known, otherwise icon. Nothing else gets an image.

## Declared constants (the only ones; each with its reason)

Recorded in `holodeck-drive-view.js` as `DECLARED`, nowhere else:

* `FRAME_MS` — the display's frame period at 60 Hz (16.7 ms). A physical
  property of the display, used only as the budget a single interaction's
  derivation must fit in.
* `OVERSCAN_ROWS` — the number of extra rows rendered beyond the viewport on
  each side, so a fast scroll does not show blank space. Chosen as the
  viewport row count itself (one page each side); not a free parameter — it is
  derived from the measured container height.
* Tile and row sizes are **measured** from the container width/height and a
  declared minimum tile width (`MIN_TILE_PX`, the narrowest at which a
  two-line title is still legible at 14 px).

## Results

(appended below, never edited above)
