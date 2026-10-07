# The holodeck — framework plan

**Append-only.** The body below is the current fold of the plan. Every change
is recorded as a dated entry in the revision ledger at the end; the body is
edited only to sharpen what is already stated, never to erase a superseded
plan. A reader can always reconstruct what was planned, and when.

This is a plan for the reading/research surface — how it holds what it holds,
where the raw lives, how it searches, and what it will not claim. It is
deliberately **generic**: the surface is not built for one corpus, one file
type, or one archive. Treat `archive.org` anywhere below as *one* resolver
among many, never as the ground.

## 0. The one invariant

**Navigate from an index; never load the raw to navigate.** The surface reasons
over a small, addressable index of *impressions* — enough to name, relate, and
cluster — and reaches for the raw bytes only when a person goes deeper into a
single item. Loading a corpus to read it is the failure mode this plan exists
to prevent: it does not scale, it does not survive the browser's storage caps,
and it hides the difference between what is *held* and what is *known*.

## 1. The tiers

| Tier | Name | Owned by | Holds | Size |
|---|---|---|---|---|
| T0 | Raw / canonical | **elsewhere** | the bytes themselves (page images, PDFs, text, media) | unbounded |
| T1 | Impression index | the surface | per-item identity + typed, byte-addressed excerpts + pointers | bounded, small |
| T2 | Deep fetch | on demand | one item's raw, resolved and rendered, then released | transient |
| T3 | Derived folds | the surface | entities, flags, topics, connections — computed from T1 | bounded |
| T4 | Search index | the surface | embeddings over corpus text, for retrieval only | bounded |

The surface owns **T1, T3, T4**. It never owns T0. T2 is a doorway, not a store.

## 2. T0 — the raw, wherever it lives

The raw bytes live wherever they already live. The surface reaches them through
a **resolver**: a named thing that maps a stable pointer to bytes. An archive is
one resolver; so are a local directory, an object store, an HTTP API, a database,
a mounted disk. The framework gives every resolver equal standing and assumes
none.

A **pointer** is a small, stable reference:

```
{ resolver, id, url?, media?, sha256?, bytes? }
```

Rules:

- A pointer resolves to bytes; if it does not, the item is *pointer-only* and
  disclosed as such — never silently dropped.
- The surface never assumes a particular resolver is queryable. **Holding bytes
  is not the same as being searchable.** A resolver may expose a full-text or
  metadata query; where it does not, the surface does not pretend it can.
- Not everything will be in any one place. Coverage is a property of what has
  been ingested, and is always stated, never implied.

## 3. T1 — the impression index

The impression index is what the surface holds for every item, and it has two
parts:

- **Hot index** — identity, metadata, typed tags, and the pointer. Small enough
  to keep resident so navigation and reasoning are instant.
- **Cold impressions** — the typed, byte-addressed excerpts that give an item
  its texture: clauses, names, amounts, dates, terms, parties. Held in a packed
  cold store, read per item on demand.

An **impression** is produced *without a model in the loop* — a deterministic
extraction — so that an impression is **evidence**, not a proposal. Every
impression carries a byte span into the raw. A span that does not resolve is a
bug to fix, not noise to ignore.

The impression index is **sufficient to navigate semantically** (names,
relations, topics, positions) **and insufficient to read**: that is the point.
Depth is T2.

## 4. T2 — deep fetch

When a person opens an item, the surface resolves its pointer, fetches the raw,
and renders it. Nothing raw is retained in the workspace by default. A local
cache of fetched raw is a separate, disclosed store — a convenience, never the
source of truth, and always rebuildable.

## 5. T3 — derived folds

Entities, flags, topics, connections, and any registry the surface shows are
**folds**: computed views over T1, regenerated wholesale, clearly labelled as
derived, never the source of truth. A fold that cannot be recomputed from the
append-only records and the resolvers is not a fold — it is unrecorded state,
and does not belong.

## 6. T4 — search

Search is a *retrieval* concern, not a *standing*. It returns pointers and
spans; it decides nothing.

1. **Lexical baseline first.** Deterministic, typed, byte-addressed matches run
   before anything learned. A lexical hit is already a verified span.
2. **Embeddings as a proposer only.** Dense vectors exist to catch what lexical
   search cannot: paraphrase and synonymy ("facial recognition" for "automated
   biometric identification"), and neighbourhoods that share meaning without
   sharing a claim. An embedding hit is a **proposal** — a pointer plus a span
   to be confirmed by reading — never a finding.
3. **Corpus.** Embeddings are computed over the corpus text once, at build, then
   maintained incrementally as items are ingested. The corpus text is itself
   just another store (a cold store); it need not be resident.
4. **Null control, always.** Any embedding search ships with a control — a
   shuffled or random baseline of the same shape — so its lift over the lexical
   baseline is *measured*, not asserted. A similarity layer that does not
   falsify itself over-proposes, and an over-proposing search is a liability.
5. **Storage.** The vector index is a derived artifact held in the cold store or
   a service, never in the hot index.

## 7. Storage medium (the browser)

The browser's own caps set the medium:

- **localStorage** is small (~5 MB, UTF-16) and is not for anything large. It
  may hold the smallest hot state and nothing else.
- **The hot index** stays resident (memory, and at most localStorage).
- **The cold store** — impression text, corpus text, vectors, cached raw — is a
  packed store: **OPFS**, written UTF-8 as a packed blob plus an offset table,
  or IndexedDB where a key/value shape is simpler. UTF-8 packing roughly halves
  the footprint of UTF-16 localStorage and has no 5 MB ceiling.
- **Binaries** (PDFs, media, images) live in OPFS/IDB, addressed by the same
  pointer that T0 uses.
- **The cold store is a cache/index, not source of truth.** It is rebuilt from
  the append-only records plus the resolvers whenever it is lost.

Provenance of the mechanism: the surface already reads a packed binary index
out of OPFS for one corpus; this plan generalises that path to the impression
library and every corpus.

## 8. Standings and provenance

Everything the surface puts in front of a person is one of two kinds:

- **Grounded** — a resolvable byte span in a raw the surface actually read.
- **Proposed** — a model output (a classification, a similarity, a generated
  line), disclosed as a proposal and never rendered as a finding.

Similarity is not evidence. A search hit is not a finding until a span is read.
An embedding neighbour is not an assertion about the world.

## 9. What this plan does not claim

- That any source is queryable — a resolver may hold bytes and no searchable text.
- That any index is complete — coverage is what was ingested, and is stated.
- That embeddings are meaning — they are a retrieval aid with a measured lift.
- That the raw is held — it is not; it is resolved on demand.

## 10. Moving forward

Ingest **appends**: a hot entry, a cold impression, a pointer, and (later)
vectors. Nothing is rewritten; the index and every fold are rebuildable from the
append-only records and the resolvers. A new source is added by writing a
resolver, not by changing the framework.

---

## Appendix — append-only revision ledger

Each entry records a decision, dated, without erasing prior entries.

### 2026-10-07 — storage and search: the initial fold

- **The impression library leaves localStorage.** The full library exceeds the
  localStorage cap by a wide margin, so it is packed **UTF-8 in OPFS** (Packed
  blob + offset table), with only a small **hot index** resident. This
  generalises the surface's existing OPFS binary-index path to the impression
  library and to every corpus.
- **Embeddings are added, search-only (T4).** Computed **once over the fetched
  corpus**, then maintained on ingest. They **propose pointers and spans**;
  they never decide. A lexical baseline runs first and a null control measures
  their lift.
- **The surface holds an index of impressions; the raw lives elsewhere.** The
  raw is reached through **pluggable resolvers** of equal standing. An archive
  is one resolver; **not everything will be there**; the framework does not
  privilege any single store.
- **Provenance is preserved through search.** A hit is a byte span to confirm by
  reading, never a similarity score standing as evidence.
