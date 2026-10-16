// holodeck-memory.js — the memory surface: facts ABOUT THE OPERATOR(S), not about content.
//
// The fold already folds hard-meaning CONTENT types into standing rules
// (content-rules.md ↔ content-rules.json). This is the same append-only machine
// pointed at a different grain: facts about the user(s) and their world — which
// repo is canonical, which account publishes vs drafts, where a surface lives.
// The recurring pain this dissolves: "I keep having to tell opencode which repo
// is canonical." A canonical-repo/account registry is its first concrete content.
//
// The grain differs from content-rules in one way only: a claim is tagged
// `about:user:*` (or `about:world:*`) rather than a content type. Everything
// else is the same discipline:
//
//   append-only     an entry is never edited; it is superseded and kept below
//   superseded      the old fact stays, marked, with the claim that replaced it
//   typed gap       an unknown tag is a gap, never a silently wrong read
//   falsifying      every entry names what would prove it wrong
//   provenance      every entry names the addresses that earned it
//
// Pure: no DOM, no storage. Entries are passed in (from user-memory.json or the
// opencode-side user-memory.md), mutated only by supersede(), and rendered by
// toMarkdown() back into the markdown the doorway and the agent read.

import crypto from "node:crypto";

// The tag namespaces. `about:user:repos` and `about:user:accounts` are the first
// concrete ones (the canonical-repo/account registry); the `:*` families stay open.
export const TAGS = {
  repos: "about:user:repos",
  accounts: "about:user:accounts",
  preferences: "about:user:preferences",
  world: "about:world",
};

const field = (entry, key) => (entry && typeof entry[key] === "string" && entry[key] ? entry[key] : null);

// Normalize one claim into a memory entry. The id is content-addressed over
// (claim + tag) — same claim, same tag, same address; the act of admitting it is
// not the content. `supersedes`, when set, names the claim this entry replaces.
export function memoryEntry(input = {}) {
  const claim = String(input.claim ?? "").replace(/\s+/g, " ").trim();
  const tag = String(input.tag ?? "").replace(/\s+/g, " ").trim();
  if (!claim || !tag) return { gap: { kind: "no-claim-or-tag", why: "a memory entry needs a claim and a tag" } };
  const id = crypto.createHash("sha256").update(`${claim}\n${tag}`).digest("hex").slice(0, 16);
  const status = input.status === "superseded" ? "superseded" : "current";
  return {
    id,
    claim,
    tag,
    status,
    supersedes: field(input, "supersedes"),
    falsifying: field(input, "falsifying"),
    provenance: Array.isArray(input.provenance) ? input.provenance.map(String).filter(Boolean) : (field(input, "provenance") ? [field(input, "provenance")] : []),
    when: field(input, "when") ?? new Date().toISOString(),
  };
}

// The entries still in force. A superseded entry is history, kept below, never read.
export function current(entries) {
  return (entries ?? []).filter((e) => e && e.status !== "superseded");
}

// Mark every current entry whose claim matches `claim` as superseded by `by`.
// Append-only: the old rows stay, their status flips, and the new claim is what
// the surface offers next. Returns a fresh list; nothing is edited in place.
export function supersede(entries, { claim, by } = {}) {
  const target = String(claim ?? "").replace(/\s+/g, " ").trim();
  const successor = String(by ?? "").replace(/\s+/g, " ").trim();
  if (!target) return { ok: false, gap: "no-claim" };
  let n = 0;
  const out = (entries ?? []).map((e) => {
    if (!e || e.status === "superseded") return e;
    if (e.claim.replace(/\s+/g, " ").trim() !== target) return e;
    n++;
    return { ...e, status: "superseded", supersedes: successor || e.supersedes };
  });
  return { ok: n > 0, superseded: n, entries: out };
}

// Mechanical recall: the terms an ask shares with a claim, never a semantic
// guess. A claim whose words appear in the ask rides; everything else stays
// out. Same word fold the doorway uses (3+ unicode letters/numbers), and the
// same stopword fold — "the"/"is"/"and" never name a memory, so they are not
// counted. Mirrored with khora/opencode-doorway.mjs's MEMORY_STOP.
const MEMORY_STOP = new Set(["the", "and", "for", "are", "was", "were", "been", "being", "with", "this", "that", "these", "those", "from", "into", "onto", "about", "which", "whose", "does", "have", "has", "had", "having", "what", "when", "where", "who", "whom", "why", "how", "not", "nor", "its", "our", "your", "their", "there", "here", "then", "than", "will", "would", "could", "should", "can", "may", "might", "must", "shall", "they", "them", "you", "but", "also", "only", "very", "just", "some", "any", "each", "both", "other", "such"]);

export function query(entries, ask, { limit = 5, minTerms = 1 } = {}) {
  const terms = new Set((String(ask ?? "").toLowerCase().match(/[\p{L}\p{N}_]{3,}/gu) ?? []).filter((w) => !MEMORY_STOP.has(w)));
  const scored = current(entries).map((e) => {
    const hay = `${e.claim} ${e.tag}`.toLowerCase();
    const hits = (hay.match(/[\p{L}\p{N}_]{3,}/gu) ?? []).filter((w) => terms.has(w));
    const seen = new Set(hits);
    return { entry: e, score: seen.size };
  }).filter((s) => s.score >= minTerms).sort((a, b) => b.score - a.score || (a.entry.when ?? "").localeCompare(b.entry.when ?? ""));
  return scored.slice(0, limit).map((s) => s.entry);
}

// A typed gap, never a guess: when a tag is asked for that holds nothing, name
// the absence. `entries` may be the full list or the already-filtered current set.
export function typedGap(entries, tag) {
  const have = current(entries).filter((e) => e.tag === tag);
  return have.length ? { entries: have } : { gap: { kind: "no-memory", tag } };
}

// ── markdown round-trip ───────────────────────────────────────────────────
// The opencode-side store is user-memory.md; this module's own store is
// user-memory.json. They are the SAME protocol, mirrored by hand, exactly like
// content-rules.md ↔ content-rules.json. The grammar is mechanical so the
// doorway (khora/opencode-doorway.mjs) parses the same file without shared code:
//
//   ## <tag>        starts a tag section
//   - <claim>       an entry (status defaults to "current")
//     status: current | superseded
//     supersedes: <claim this replaces>
//     falsifying: <what would prove this wrong>
//     provenance: <address>, <address>
//
// Blank lines and any line outside the grammar are ignored.

const HEADER = [
  "# user-memory",
  "",
  "Append-only facts about the operator(s) and their world — folded from history",
  "and dropped explicitly. Same discipline as content-rules: append-only,",
  "superseded-not-edited, typed gap when unknown. This is the opencode-side store;",
  "the surface-side store is holodeck/user-memory.json.",
  "",
].join("\n");

export function toMarkdown(entries, { title = "# user-memory" } = {}) {
  const byTag = new Map();
  for (const e of entries ?? []) {
    if (!e || !e.claim || !e.tag) continue;
    if (!byTag.has(e.tag)) byTag.set(e.tag, []);
    byTag.get(e.tag).push(e);
  }
  const lines = [title, ""];
  for (const [tag, es] of byTag) {
    lines.push(`## ${tag}`, "");
    for (const e of es) {
      lines.push(`- ${e.claim}`);
      if (e.status === "superseded") lines.push(`  status: superseded`);
      if (e.supersedes) lines.push(`  supersedes: ${e.supersedes}`);
      if (e.falsifying) lines.push(`  falsifying: ${e.falsifying}`);
      if (e.provenance?.length) lines.push(`  provenance: ${e.provenance.join(", ")}`);
      lines.push("");
    }
  }
  return lines.join("\n");
}

export function parseMarkdown(md) {
  const entries = [];
  let tag = null;
  let cur = null;
  const push = () => { if (cur) { const e = memoryEntry(cur); if (!e.gap) entries.push(e); } cur = null; };
  for (const raw of String(md ?? "").split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (line.startsWith("## ")) { push(); tag = line.slice(3).trim(); continue; }
    if (line.startsWith("- ")) { push(); cur = { claim: line.slice(2).trim(), tag: tag ?? "" }; continue; }
    if (cur && /^\s{2}[a-z]+:/.test(line)) {
      const m = line.trim().match(/^([a-z]+):\s*(.*)$/);
      if (m) {
        const key = m[1], value = m[2].trim();
        if (key === "provenance") cur.provenance = value ? value.split(",").map((s) => s.trim()).filter(Boolean) : [];
        else cur[key] = value;
      }
      continue;
    }
    // blank or preamble: ignore
  }
  push();
  return entries;
}
