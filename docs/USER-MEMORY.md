# USER-MEMORY — the memory surface

The fold already folds hard-meaning *content types* into standing rules
(`content-rules.md` ↔ `content-rules.json`). **USER-MEMORY** is the same
append-only machine pointed at a different grain: **facts about the operator(s)
and their world** — which repo is canonical, which account publishes vs drafts,
where a surface lives.

The pain it dissolves, stated in the session that designed it: *"I keep having
to tell opencode which repo is canonical."* Those facts are already in the
history, asserted again and again. They don't need to be re-typed each session;
they need the keeper to notice their recurrence and promote them to a surface
the agent reads and the doorway injects.

## The three stores, and which one this is

| Store | File | Job |
|---|---|---|
| Policy | `~/.config/opencode/AGENTS.md` | *how to read*, always on |
| Knowledge | `~/.config/opencode/content-rules.md` | standing rules for content *types* |
| **Memory** | `~/.config/opencode/user-memory.md` ↔ `holodeck/user-memory.json` | standing facts about the *user/world* |

Claude Code puts "memory" in a set file (`CLAUDE.md`). That is wrong *for us*
for a fold-specific reason: memory is not a file someone writes by hand, it is
what falls out after a **swarm converges** — the keeper compresses the record
into its stable residue. `content-rules` is not hand-written; it is the
promotion of a recurring hard-meaning event into a standing rule, with
provenance and a falsifying control. USER-MEMORY is the same promotion at the
grain of *facts about the operator*, tagged `about:user:*` instead of a content
type.

## Entry shape

```
{
  claim:      "khora is the canonical perceiver repo; eoreader7 is legacy",
  tag:        "about:user:repos",          // not about:content
  provenance: [address of the turns that earned it],
  status:     "current",                   // superseded → keep, mark stale
  supersedes: "eoreader7 is canonical",    // the old fact this replaces
  falsifying: "a repo whose package.json name or role contradicts this"
}
```

Everything else is the `content-rules` discipline, unchanged: append-only,
superseded-not-edited, typed gap when unknown, falsifying control carried.

## The fold/promote gate

Whether a fact is auto-folded from history or dropped explicitly is not
either/or; the tension is real and the fold already has an answer — the same
gate it uses for content rules:

1. **candidate** — a claim recurs (the same claim appears N times across
   sessions, never contradicted), or the operator drops it explicitly.
2. **stability test** — recurrence clears a threshold; contradiction (a
   later turn denying it) blocks promotion.
3. **promote + disclose** — it becomes a `current` entry with its provenance,
   and the promotion is disclosed (like a standing rule being written after
   convergence), never silent.

The **mechanical rung** (built now) is explicit drops plus exact-claim
recurrence counting — the doorway's record is address-keyed, so an exact
recurrence is cheap to count. The **model-assisted rung** (semantic recurrence
across different wordings) is a later pass and is disclosed as unbuilt; it
needs an authored falsifying control before a claim is promoted, exactly like
the content-rules swarm.

## Two mechanisms, one surface

- **The agent reads the store.** `AGENTS.md` §6 now points at `user-memory.md`
  instead of carrying the account prose; the account rules are entries, not
  narrative. (The naming block — what *The Fold* is — stays policy: it is the
  system's identity, not an operator fact.)
- **The doorway injects the store.** `khora/opencode-doorway.mjs` parses
  `~/.config/opencode/user-memory.md` and adds a `memory` field to the context
  answer — the entries an ask actually bears on (word-overlap, never a semantic
  guess), capped, `<fold-memory>`-tagged, and recorded on the turn like
  `system` / `look` / `project` / `archons`. Fails open: an unreadable store
  answers nothing and opencode runs as upstream.

The opencode-side store (`user-memory.md`) and the surface-side store
(`holodeck/user-memory.json`) are the **same protocol**, mirrored by hand,
exactly as `content-rules.md` ↔ `content-rules.json`. The grammar is
mechanical so the doorway parses the same file without shared code:

```
## about:user:repos
- khora (scores-patch-points/khora) is the canonical perceiver; eoreader7 is legacy
  status: current
  falsifying: a repo whose package.json name or role contradicts this
  provenance: ses_….turns.md#…
```

## First entries: the canonical-repo/account registry

Seeded in both stores now, replacing the prose that used to leak into
`AGENTS.md`:

- `about:user:repos` — khora, janus, penelope, the fold (holodeck),
  opencode-fold, and one satellites entry.
- `about:user:accounts` — scores-patch-points (publish only) and
  clovenbradshaw-ctrl (draft only).

## What is deliberately not built yet

- **Semantic recurrence** across wordings (needs the model-assisted rung).
- **Documents as memory** — the operator can drop facts; attaching whole
  documents ("add this PDF about me") is the surface's next surface and is not
  in this pass.
- **A holodeck view** — the fold-app side is the store (`user-memory.json`) and
  the model (`holodeck-memory.js`) now; a panel that lists/edits memory is a
  follow-on surface over the same module.
