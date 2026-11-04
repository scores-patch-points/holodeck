// canon-check.mjs — preflight for every registered run: is this the real reading pipeline? Usage: node canon-check.mjs <khora dir> ; exit 1 when degraded.
// Read-only: it writes nothing. It prints the checkout, the priors home and each pinned prior's identity, and the reader's own gaps on a fixed probe text.
import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto"; import { execFileSync } from "node:child_process";
const K = path.resolve(process.argv[2] || "."); const here = path.dirname(new URL(import.meta.url).pathname);
const man = JSON.parse(fs.readFileSync(path.join(here, "canon-manifest.json"), "utf8"));
const git = (...a) => { try { return execFileSync("git", ["-C", K, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return null; } };
const out = { checkout: K, head: git("rev-parse", "--short", "HEAD"), branch: git("branch", "--show-current"), dirty_files: Number(git("status", "--porcelain")?.split("\n").filter(Boolean).length ?? -1) };
const mainSha = man.khora_main.split(" ")[0]; const rel = git("rev-list", "--left-right", "--count", `${mainSha}...HEAD`); out.vs_canon_main = rel ? { main: mainSha, behind_ahead: rel.replace("\t", "/") } : { main: mainSha, note: "not in this checkout" };
const door = await import(path.join(K, "native/the-fold/prior-source.mjs")); const home = door.priorsHome(); out.priors_home = { dir: home.dir, env_KHORA_PRIORS_DIR: process.env.KHORA_PRIORS_DIR || null };
const blob = f => { const b = fs.readFileSync(f); return crypto.createHash("sha1").update(Buffer.concat([Buffer.from(`blob ${b.length}\0`), b])).digest("hex"); };
out.priors = {}; let priorsOk = true;
for (const [n, m] of Object.entries(man.priors_required_for_an_english_read)) {
  const f = path.join(home.dir, n); let st; try { st = fs.existsSync(f) ? (blob(f) === m.git_blob_sha ? "identical" : "DIFFERENT") : "MISSING"; } catch { st = "UNREADABLE"; } out.priors[n] = st; if (st !== "identical") priorsOk = false;
}
const { readDocument } = await import(path.join(K, "native/reading.js")); const { localLexicon } = await import(path.join(K, "native/adapters/text/wiktionary-pack.js"));
const probe = "Machu Picchu is a 15th-century Inca citadel in southern Peru. It was built around 1450. The site was abandoned a century later.";
const r = await readDocument(probe, { language: "en", minCharacters: 0, lexicon: localLexicon("en") });
out.probe = { gaps: (r.gaps || []).map(g => g.gap), clauses_present: Array.isArray(r.clauses), cast: r.cast.length, mentions_with_trailing_punctuation: r.cast.flatMap(c => (c.mentionSpans || []).map(([a, b]) => probe.slice(a, b))).filter(t => /[.,;:!?]$/.test(t)).length };
const why = []; if (!priorsOk) why.push("a pinned prior is missing or differs"); if (out.probe.gaps.length) why.push("the reader reports gaps: " + out.probe.gaps.join(", ")); if (!out.probe.clauses_present) why.push("no clauses (no parser prior)");
out.verdict = why.length ? "DEGRADED" : "CANON-OK"; out.why = why; out.manifest = { source: man.source, written: man.written };
const body = JSON.stringify(out, null, 1); console.log(body); console.log("preflight sha256:", crypto.createHash("sha256").update(body).digest("hex")); process.exit(why.length ? 1 : 0);
