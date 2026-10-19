// kernel/reading-rules.js — LOCAL SHIM (holodeck). Same exports and the same data-gated semantics as khora's
// native/kernel/reading-rules.js, which is Node-only (node:fs) and so cannot load in a browser. The rules stay
// received DATA: this file reads vendor/khora/native/priors/reading-rules.json (byte-identical to
// janus/priors/reading-rules.json) with a fetch in the browser, or with fs under Node, and never codifies a number.
// An absent or malformed file leaves the reader BARE, a typed gap, exactly as upstream.
//
// The three consumers call loadReadingRules() synchronously at module top level, so the file is read once with a
// top-level await here and every importer waits for it.

const FILE = new URL("../priors/reading-rules.json", import.meta.url);

export const READING_RULES_FILE = FILE.href;
export const resolveReadingRulesFile = () =>
  (typeof process !== "undefined" && process.env && process.env.ER7_READING_RULES_FILE) || READING_RULES_FILE;

async function receive(source) {
  const isNode = typeof process !== "undefined" && process.versions && process.versions.node && typeof window === "undefined";
  if (isNode) {
    const fs = await import(/* @vite-ignore */ "node:fs");
    const url = await import(/* @vite-ignore */ "node:url");
    const p = /^[a-z]+:\/\//i.test(source) ? url.fileURLToPath(source) : source;
    return JSON.parse(fs.readFileSync(p, "utf8"));
  }
  const r = await fetch(source);
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}

let _cache = null;
let _first = null;
try { _first = await receive(resolveReadingRulesFile()); } catch (e) { _first = e; }

/** loadReadingRules() → { schema, source, rules|null, gap|null } — frozen received data; a gap, never a guess. */
export function loadReadingRules() {
  if (_cache) return _cache;
  const source = resolveReadingRulesFile();
  let rules = null, gap = null;
  if (_first instanceof Error || _first == null) {
    gap = { refused: "absent", detail: `reading rules not found at ${source} — the reader is bare (a typed gap, never a guessed number)` };
  } else {
    rules = Object.freeze(_first?.rules ?? null);
    if (!rules || rules.surprise === undefined) gap = { refused: "no_reading_rule", detail: `reading rules at ${source} carry no rule object` };
  }
  _cache = Object.freeze({ schema: "ReadingRules@1", source, rules, gap });
  return _cache;
}

export function resetReadingRules() { _cache = null; }
