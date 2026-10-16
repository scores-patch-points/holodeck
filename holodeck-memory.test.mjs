import test from "node:test";
import assert from "node:assert/strict";
import { memoryEntry, current, supersede, query, typedGap, toMarkdown, parseMarkdown, TAGS } from "./holodeck-memory.js";

const e = (claim, tag, extra = {}) => memoryEntry({ claim, tag, ...extra });

test("a memory entry is content-addressed and normalized", () => {
  const a = e("khora is canonical", TAGS.repos);
  const b = e("  khora   is canonical ", TAGS.repos);
  assert.equal(a.id, b.id, "same claim and tag, same address — whitespace folded");
  assert.equal(a.status, "current");
  assert.equal(a.tag, TAGS.repos);
  assert.deepEqual(a.provenance, []);
});

test("a claim without a claim or tag is a typed gap, never a half entry", () => {
  assert.ok(e("", TAGS.repos).gap);
  assert.ok(e("khora is canonical", "").gap);
});

test("current returns only the entries still in force", () => {
  const entries = [e("a is canonical", TAGS.repos), e("b is canonical", TAGS.repos)];
  entries[0].status = "superseded";
  assert.deepEqual(current(entries).map((x) => x.claim), ["b is canonical"]);
});

test("supersede flips the matching current entry and keeps it below", () => {
  const entries = [e("eoreader7 is canonical", TAGS.repos)];
  const r = supersede(entries, { claim: "eoreader7 is canonical", by: "khora is canonical" });
  assert.equal(r.ok, true);
  assert.equal(r.superseded, 1);
  assert.equal(r.entries[0].status, "superseded");
  assert.equal(r.entries[0].supersedes, "khora is canonical");
  // append-only: the old claim text is retained, the row is not removed
  assert.equal(r.entries[0].claim, "eoreader7 is canonical");
  // nothing matched: a typed result, not a silent no-op
  assert.equal(supersede(entries, { claim: "nope", by: "x" }).ok, false);
});

test("query recalls a claim whose words appear in the ask, mechanically", () => {
  const entries = [
    e("khora is the canonical perceiver repo", TAGS.repos),
    e("scores-patch-points is the publishing account", TAGS.accounts),
    e("unrelated fact about music", TAGS.preferences),
  ];
  const hits = query(entries, "which repo is canonical, and which account publishes vs drafts?");
  assert.ok(hits.some((x) => x.tag === TAGS.repos));
  assert.ok(hits.some((x) => x.tag === TAGS.accounts));
  assert.ok(!hits.some((x) => x.tag === TAGS.preferences), "an unrelated fact never rides");
});

test("a stopword alone never recalls anything", () => {
  const entries = [e("khora is the canonical perceiver repo", TAGS.repos)];
  assert.deepEqual(query(entries, "the and for are"), [], "stopwords name no memory");
});

test("a superseded claim is never recalled", () => {
  const entries = [e("eoreader7 is canonical", TAGS.repos)];
  const { entries: next } = supersede(entries, { claim: "eoreader7 is canonical", by: "khora is canonical" });
  assert.deepEqual(query(next, "is eoreader7 the canonical repo?"), []);
});

test("an unknown tag is a typed gap", () => {
  const entries = [e("khora is canonical", TAGS.repos)];
  assert.ok(typedGap(entries, TAGS.accounts).gap);
  assert.equal(typedGap(entries, TAGS.repos).entries[0].claim, "khora is canonical");
});

test("markdown round-trips: parseMarkdown(toMarkdown(entries)) is the same entries", () => {
  const entries = [
    e("khora is the canonical perceiver repo; eoreader7 is legacy", TAGS.repos, { falsifying: "a repo whose package.json name contradicts this", provenance: ["ses_a.turns.md#1"] }),
    e("scores-patch-points publishes; clovenbradshaw-ctrl drafts", TAGS.accounts, { falsifying: "gh auth status shows the opposite" }),
  ];
  const parsed = parseMarkdown(toMarkdown(entries));
  assert.deepEqual(parsed.map((x) => x.claim), entries.map((x) => x.claim));
  assert.deepEqual(parsed.map((x) => x.tag), entries.map((x) => x.tag));
  assert.equal(parsed[0].falsifying, entries[0].falsifying);
  assert.deepEqual(parsed[0].provenance, entries[0].provenance);
});

test("parseMarkdown reads status and supersedes off the fields", () => {
  const md = [
    "## about:user:repos",
    "- eoreader7 is canonical",
    "  status: superseded",
    "  supersedes: khora is canonical",
  ].join("\n");
  const parsed = parseMarkdown(md);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].status, "superseded");
  assert.equal(parsed[0].supersedes, "khora is canonical");
});

test("parseMarkdown ignores preamble and blank lines", () => {
  const md = ["# user-memory", "", "some prose the parser skips", "", "## about:user:repos", "", "- khora is canonical"].join("\n");
  const parsed = parseMarkdown(md);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].claim, "khora is canonical");
});
