# Topic-profile consolidation — two agents, one page (2026-10-15)

Two **opencode** sessions converged on the same artifact from opposite sides:

- **khora** (the other session) built the **profile page for a thing** —
  `native/kernel/profile-page.js` (`profileCard` / `profileIndex` / `LEGEND` /
  `REALITY_BADGE`), `native/kernel/reality-register.js` (the register/reality
  fold, the Wikipedia "what is it" anchor, for-whom disambiguation),
  `native/kernel/level-profile.js` (the 3×3 terrain occupancy), and the spec
  `native/docs/REALITY-LEVELS-SPEC.md` (§13 is the page). All new, uncommitted
  in the khora working tree at `df116d57`.
- **holodeck** (this session) built the **topic extraction** (`holoTopics`) and
  a first topic profile drawn from the holograph (entities · measures · bonds,
  each with a **for whom** and a 1–2 word name).

They are the same page. This note fixes the seam so we ship **one** design.

## The seam (ownership, per VENDORING.md + SPEC §11.4)

**One owner per capability.** The khora owns the profile-page renderer and the
reality/register/level logic; the surface **vendors** it and **adds no ontology
logic**. So:

| capability | owner | files |
|---|---|---|
| profile page renderer | **khora** | `native/kernel/profile-page.js` |
| register / reality / anchor | **khora** | `native/kernel/reality-register.js` |
| terrain occupancy | **khora** | `native/kernel/level-profile.js` |
| vocabulary + badges + legend | **khora** | SPEC §12–13 |
| topic extraction (holograph elements) | **holodeck** | `index.html` `holoTopics` |
| surface wiring + vendoring | **holodeck** | `index.html`, `vendor-sync.mjs` |

The holodeck side **defers** to the khora renderer: `topicProfileVals` calls
`window.__hdRealityProfileCard(thing, A)` when the surface has vendored and
wired it (see the seam in `index.html`), and falls back to the holograph blocks
only until then. No ontology logic is duplicated.

## The vocabulary is one (adopted)

The holistic page's blocks, taken from SPEC §13, are the shared house style —
the holodeck fallback already speaks it, so the two never diverge:

- `● real / ◐ fictionalized-real / ✕ fictional / ? unexamined` (REALITY_BADGE)
- **WHAT IT IS** — the Wikipedia lead (external, fenced apart), or *examined,
  not convicted* when there is no anchor
- **TOLD BY** — the sources with their DECLARED register (fiction marked *NOT
  evidence* — nesting's wall, rendered)
- **WHAT THE SOURCES SAY** — claims with their standing (`● agree ◐ contested ✕ unsupported ▪ single`)
- **DISAGREEMENTS** — a first-class row (the "differences that make a difference")
- **FOR WHOM** — the stake (required: no for whom, no topic)
- one muted **engine** line — the terrain occupancy, a stack trace, never the page

## The blocker to full wiring

`reality-register.js` imports `node:fs` / `node:path` (it is a Node organ) and
`profile-page.js` imports it for `REGISTER_TRAITS`, so the browser surface
cannot load either as-is. This is the **same seam** as the earlier
`reading-rules.js`:

> khora's `reading-rules.js` imports `node:fs` and cannot load in a page … the
> shim keeps upstream's exports and data-gated semantics (VENDORING.md,
> 2026-10-15).

So the surface needs a **browser shim** for `reality-register.js` (keep
`REGISTERS` / `REGISTER_TRAITS` / `realityRegister` / `registerNotes` /
`registerProfileLines`; drop the resolver's `fs` cache in the page), then
`profile-page.js` loads clean. That shim is **unowned** — the one open wiring
task.

## Merge order (when the user asks us to land it)

1. **khora session** commits its organs (`profile-page.js`, `reality-register.js`,
   `level-profile.js`, the `hyperlexicon-abstraction.js` W2 edit, tests, spec).
2. **surface** adds the three kernels to `vendor-sync.mjs` `FILES`, runs
   `node vendor-sync.mjs` (byte-identical + recorded commit), and writes the
   `reality-register` browser shim.
3. **surface** sets `window.__hdRealityProfileCard` from the vendored
   `profileCard`; the topic profile's entity branch lights up and the fallback
   is deleted.
4. `node vendor-sync.mjs --check` green.

## What each side changed (inventory)

**holodeck / `index.html` (this session):** `holoTopics` (topics are the
holograph's shared entities · measures · bonds, each with a **for whom**);
`TOPIC_KIND`, `TOPIC_JUNK`, `topicSubtitle`; `paradigmGroups` prefers the
holograph; `openTopic` + `topicProfileVals` + the `details`/`profileVals` topic
branches; the profile card's subtitle line; `backLabel` for `sel.type==='topic'`.

**khora (the other session):** `native/kernel/profile-page.js`,
`native/kernel/reality-register.js`, `native/kernel/level-profile.js`,
`native/kernel/hyperlexicon-abstraction.js` (W2 universe coordinate),
`native/tests/{profile-page,reality-register,level-profile,hyperlexicon-abstraction}.test.js`,
`native/docs/REALITY-LEVELS-SPEC.md`.
