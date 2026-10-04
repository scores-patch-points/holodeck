#!/usr/bin/env node
// vendor-chat.mjs — copy the fold-chat surface's runtime files into
// vendor/fold-chat/ BYTE-IDENTICAL, from the sibling repo, and record where
// they came from. Never edit a file under vendor/ in place: change it in
// fold-chat, push, then run this.
//
//   node vendor-chat.mjs [--from ../fold-chat]          copy + write vendor/fold-chat/CHAT-VENDOR.json
//   node vendor-chat.mjs --check [--from ../fold-chat]  exit 1 if a vendored copy differs from the recorded hash or from upstream
//
// Same discipline as vendor-sync.mjs (the eoreader7 notebook pane): the chat
// surface is a standalone repo (scores-patch-points/fold-chat); this is the
// seam that pins it into the fold. It routes every inference through heimdall,
// so vendoring the UI does not vendor any model or key.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

export const FILES = ["fold-chat.js", "fold-chat-client.js", "fold-chat-artifacts.js", "index.html"];
const here = path.dirname(new URL(import.meta.url).pathname);
const rec = path.join(here, "vendor/fold-chat/CHAT-VENDOR.json");
const sha = (b) => createHash("sha256").update(b).digest("hex");
const args = process.argv.slice(2);
const from = path.resolve(here, args.includes("--from") ? args[args.indexOf("--from") + 1] : "../fold-chat");
const check = args.includes("--check");
let bad = 0;
const out = {};
for (const f of FILES) {
  const dst = path.join(here, "vendor/fold-chat", f);
  const src = path.join(from, f);
  if (check) {
    let want = null;
    try { want = JSON.parse(fs.readFileSync(rec, "utf8")).files[f] || null; } catch {}
    const have = fs.existsSync(dst) ? sha(fs.readFileSync(dst)) : null;
    if (!have || have !== want) { console.log(`DRIFT   ${f}: vendored copy ${have ? "does not match the recorded hash" : "is missing"}`); bad++; continue; }
    if (fs.existsSync(src) && sha(fs.readFileSync(src)) !== have) { console.log(`BEHIND  ${f}: upstream (${from}) changed since it was vendored`); bad++; continue; }
    console.log(`same    ${f}`);
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    out[f] = sha(fs.readFileSync(dst));
    console.log(`copied  ${f}`);
  }
}
if (!check) {
  let commit = null;
  try { commit = execFileSync("git", ["-C", from, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(); } catch {}
  let dirty = null;
  try { dirty = execFileSync("git", ["-C", from, "status", "--porcelain", "--", ...FILES], { encoding: "utf8" }).trim() || null; } catch {}
  fs.writeFileSync(rec, JSON.stringify({ repo: "scores-patch-points/fold-chat", commit, uncommittedAtSync: dirty, at: new Date().toISOString(), routesInferenceThrough: "heimdall bridge (localhost:8790)", files: out }, null, 1) + "\n");
}
process.exit(bad ? 1 : 0);