// solon.js — Solon, the Integrity archon. DEF → EVA → REC over the record.
//
// Handle: Solon — the Athenian lawgiver. Asked for the best constitution,
// he gave one that binds the rulers to the laws exactly as the laws bind
// the citizens. Here the rulers are the mechanisms that CLAIM to enforce
// the constitution, and Solon's job is to check that every claim is read
// by a test, that the record replays, that the results are enforced, and
// that the failure set stays the same by name — and to re-zero (REC) a
// standing only on evidence. THE REGISTER — the one authoritative list of
// the instrument's watchers; an archon's own header cites it, never
// restates it:
//
//   heimdall   the bridge — every surface, the steering, the admission,
//              the re-forging, the outward flows. Boss of the triad. (live)
//   ranke      the chase — a claim chased to the document its account
//              cites; in charge of the citation policy (P182). (live)
//   lavar      the grader — grades the reader itself, keeps its own
//              mistakes (the book test, II.6). (live)
//   wilson     the swarm — an evolutionary swarm of reading variants at
//              holonic levels, under the received hierarchy and the cube.
//              (live)
//   solon      the integrity — the record's honesty, the keeper. (live)
//   huginn     thought — which model answers which job, room mouths
//              first-class, hopped on typed failure. (live)
//   muninn     memory — what is recalled into the turn, what earns
//              standing; the conversation's own record encoded and
//              recalled, cut at the declared budget. (live)
//   kairos     the pattern — whether the turn's difference made a
//              difference; the sign over every exchange, on the record and
//              the summary gate's decision. (live)
//   kelsen     the adjudicator — claims as norms in a hierarchy, conflicts
//              resolved by precedence (lex specialis, lex posterior); every
//              verdict is his. (live)
//   clippy      the clip — what is IN THE PRESENT (born + DMD + activation + discourse), under heimdall
//   parmenides the Way — SAME vs OTHER, identity by the equivalence organs,
//              never by appearance (II.7, P11, P79). Under kelsen.
//   chomsky    the universal grammar — the arrangement is universal and
//              medium-blind; a language's role grammar (SVO or any
//              positional grammar) is DECLARED via a measured RoleConfig@1,
//              never the default. Watches the language dispatch
//              (relations-language.js): all cognition reads GFP-shaped;
//              English-SVO comes online only when declared. (live)
//   panini     the pronunciation — the sound a REFERENT carries, never a
//              surface string (P11/P38). Watches the heard stratum
//              (PronunciationPrior@1, live_priors): homophones flagged
//              (two distinct referents, near-identical sound — measured
//              one/was at 0.014), heteronyms refused unless the reading
//              names which referent it heard (READ present /ɹiːd/ vs past
//              /ɹɛd/ — the engine holds one sense, the dictionary holds
//              both). Under chomsky, beside him. (live)
//   gary       the prompt — what the mouth is handed, in what order, and
//              what never goes in: no address, no apparatus vocabulary, no
//              JSON asked for in prose, a fact rather than a prohibition, a
//              prompt that fits the window it will run in, the person's own
//              message last. Keeps the mouth's door; changes only the input
//              and never a word of what comes back (P186). KONDO is his.
//              (live)
//   kondo      the tidy prompt — what the mouth is handed, once: a line
//              carried twice, a block resent where the cache cannot reuse
//              it, address residue no writer wrote, and whether the whole
//              fits the window heimdall says the model is loaded at. Names
//              the OWNER of every finding and never cuts a prompt herself
//              (P186). Under heimdall. (live)
//   wald       the pull — what must be pulled before a prompt can be
//              answered (nothing, the thread, what the fold holds, a
//              structured source, the web), each witness's vote one
//              observation of a sequential test; possible at one vote,
//              probable past log A, refused past log B, the cheapest
//              further pull between. Prices are measured ms; consent is
//              never priced. Under heimdall, beside huginn (who picks the
//              model once the pull is decided). Ratified by the person
//              2026-10-14. (shadow — records every turn, gates nothing yet)
//   elenchus   Socrates — the standing question: every non-AGREE crown
//              carries one closed-bank question (elenchus.js), and no live
//              claim in view refuses the oracle default (gary.js's
//              no-oracle-mode). Keeps the mouth from being an oracle. (live)
//   nagarjuna  the four corners — one lattice for every mechanical verdict
//              (is/is-not/both/neither, hl.js's own Belnap-Dunn FDE), never
//              a second one under a different name; a name reused across
//              files for a different meaning must have each file's own
//              header say so. Checked mechanically against hl.js's real
//              values and involution, never asserted. (live)
//   grasse     the stigmergic log — indirect coordination through the work
//              itself: `opencode-worknotes.mjs`'s medium of append-only
//              per-agent marks, atomic O_EXCL claims (TTL decay, done final),
//              one writer per file, the merged view injected as a note. No
//              agent messages another; the environment is the message. After
//              Pierre-Paul Grassé, who coined stigmergy (1959). Beside
//              wilson (kernel/stigmergy.js, the pheromone routes) and atta
//              (kernel/activation.js, decay): those are the kernel trails,
//              this is the opencode medium. Ratified by the person
//              2026-10-16. (built — the medium is tested; no live colony yet)
//
// Amendment: an archon is added or removed by proposal — ratified by the
// person, checked by the chorus — never by a session alone.
//
// Solon is the one that keeps the instrument's own record
// honest while it runs for months.
//
// A LIBRARY, not a daemon: this organ knows nothing of any one repository.
// The repo it keeps is handed in (`root`, and the constitution's enforcement
// map); the surface that runs a keeper — the-fold's solon-run.mjs — supplies
// them, and its port probe. `createKeeper` / `startServer` / `runLiveSweep`
// are the same machinery whoever wires them.
//
// THE HEARTBEAT — why it is legitimate, not decoration:
//   A dead watcher is the one failure the watcher cannot report itself.
//   Each beat is cheap, monotonic (seq), and appended to the same
//   append-only log; ASHBY reads the FILE, never this process's memory,
//   so a lying or buggy Solon cannot vouch for itself. The heartbeat's
//   absence is the signal: stale beats mean the instrument is running
//   unguarded. It also carries a surface probe — typed, never convicting
//   (a probe that cannot reach its real check reports "unknown", never
//   "down", heimdall's own research rule).
//
// The walls, this project's own law applied to the regulator:
//   - EVA probes before it convicts; every verdict names its evidence.
//   - A standing (the failure set, the unenforced-results count) re-zeros
//     only on evidence — REC, never a silent tune.
//   - II.23 applies to the regulator: Solon's own controls must be able to
//     fail (the planted deviations in solon.test.mjs), and Ashby checks
//     they exist.
//   - The regulator is part of the regulated: Solon's log is on the same
//     append-only record it audits.

import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { checkAppendOnly, verifyWatcher } from "./ashby.js";

/** Where a keeper appends its heartbeat log, for the repo at `root`. */
export const solonLogPath = (root) => path.join(root, "record", "solon-log.jsonl");
export const KEEPER_MARKER = "PLANTED-CONTROL";

// ─────────────────────────── pure sensors ───────────────────────────

/** The constitution's enforcement map, held against what tests actually
 *  read. VI.3's mirror: an article CLAIMS enforcement by a file no test
 *  reads is the same class of drift P94/P95 name for eval results — a
 *  claim that is a report, not an enforcement. Unwired rows stay visible
 *  and are never a failure (they are the honest list). */
export function auditEnforcementMap(rows, sourceNames, testBodies) {
  const sources = new Set(sourceNames);
  const failures = [];
  for (const row of rows) {
    if (row.enforced === null) continue;
    // The where field carries real file names, document references
    // ("CLAUDE.md (open debt)"), and function names in parens
    // ("fold.js (buildSummarySystemMessage, …)"). Only code-file tokens are
    // enforcement claims; the rest are addresses of the debt, not files.
    const whereFiles = [...String(row.where ?? "").matchAll(/[\w.-]+\.(?:js|mjs|html)\b/g)].map((m) => m[0]);
    for (const wf of whereFiles) {
      if (!sources.has(wf)) {
        failures.push({ article: row.article, where: wf, why: "enforcing file absent from sourceNames" });
        continue;
      }
      const re = new RegExp("[./\"'`]" + wf.replace(/\./g, "\\."));
      if (!testBodies.some((t) => re.test(t.body))) {
        failures.push({ article: row.article, where: wf, why: "no test body strongly references the enforcing file" });
      }
    }
  }
  const unwired = rows.filter((r) => r.enforced === null);
  return {
    verdict: failures.length ? "map_stale" : "map_honest",
    failures,
    rows: rows.length,
    enforcedRows: rows.length - unwired.length,
    unwiredVisible: unwired.length > 0,
    unwiredCount: unwired.length,
  };
}

/** Reference docs (HANDOFF / PROPOSAL / next-steps / PROMPT / transcript /
 *  data) are not transcriptions and are never held to the reader bar. A
 *  transcription is a doc whose stem matches a real driver, or that ends
 *  in -RESULTS. Returns null for json/jsonl (data, self-describing).
 *  REFERENCE_RE is a disclosed name-pattern heuristic; its errors are
 *  conservative — a reference doc it misses is classified data, never a
 *  transcription held to the reader bar. */
const REFERENCE_RE = /HANDOFF|PROPOSAL|next-steps|PROMPT|transcript|watch-log|passage|claude-like-probe/i;
export function classifyResultsDoc(name, driverNames) {
  if (!/\.(md|txt)$/.test(name)) return null;
  if (REFERENCE_RE.test(name)) return { kind: "reference", base: null };
  const base = name
    .replace(/\.(md|txt)$/, "")
    .replace(/-RESULTS$/, "")
    .replace(/-\d{4}-\d{2}-\d{2}(-pass\d+)?$/, "")
    .replace(/-v\d+$/, "");
  const isTranscription = driverNames.has(base) || /-RESULTS/.test(name);
  return { kind: isTranscription ? "transcription" : "data", base };
}

/** A transcription is enforced when a test references its driver as a
 *  strong path token — a separator then the stem then a file extension or a
 *  slash (`"worker.mjs"`, `./worker.js`, `lib/worker/`). A bare prose
 *  mention is never enforcement: the calibration that named this is the
 *  P94 residue — most transcription docs are unenforced, and a word-boundary
 *  fallback would paper that over with mentions. No length floor: the strong
 *  token itself is precise, and a floor is an unearned constant that would
 *  silently pardon a short stem (`mhc`) whose driver is named differently. */
export function referencedBy(base, testBodies) {
  if (!base) return [];
  const re = new RegExp("[./\"'`]" + base.replace(/-/g, "\\-") + "(?:\\.(?:mjs|js|json)|/)");
  return testBodies.filter((t) => re.test(t.body)).map((t) => t.name);
}

/** P94/P95's rule as a verdict: a committed transcription is enforcement
 *  only when a test reads it. The absolute count is the standing; what the
 *  homeostat regulates is its DELTA across sweeps. */
export function auditResults(rows, cap = 40) {
  const trans = rows.filter((r) => r.kind === "transcription");
  const unenforced = trans.filter((r) => r.readers.length === 0).sort((a, b) => a.doc.localeCompare(b.doc));
  return {
    verdict: unenforced.length ? "unenforced" : "all_enforced",
    transcriptionCount: trans.length,
    enforcedCount: trans.length - unenforced.length,
    unenforcedCount: unenforced.length,
    unenforced: unenforced.slice(0, cap).map((r) => r.doc),
    unenforcedAll: unenforced.map((r) => r.doc),
    referencesCount: rows.filter((r) => r.kind === "reference").length,
    dataCount: rows.filter((r) => r.kind === "data").length,
  };
}

/** The failure set diffed BY NAME, never by count — a new name is a
 *  deviation, a vanished name is a REC candidate (the standing re-zeros on
 *  evidence), and an identical set is clean even when the count is high. */
export function diffFailures(baseline, current) {
  const b = new Set(baseline || []);
  const c = new Set(current || []);
  const added = [...c].filter((x) => !b.has(x)).sort();
  const fixed = [...b].filter((x) => !c.has(x)).sort();
  return { clean: added.length === 0 && fixed.length === 0, added, fixed, addedCount: added.length, fixedCount: fixed.length };
}

/** Replay the last N events of a JSONL as the surface's tail. */
export function readTail(lines, n = 12) {
  const out = [];
  for (let i = lines.length - 1; i >= 0 && out.length < n; i--) {
    if (!lines[i].trim()) continue;
    try {
      out.push(JSON.parse(lines[i]));
    } catch {
      out.push({ event: "corrupt", line: i + 1 });
    }
  }
  return out.reverse();
}

// ─────────────────────────── IO (scan + live sweep) ───────────────────────────

/** Scan a results directory against its drivers and reader tests, emitting
 *  classified rows ready for auditResults. Deterministic; a missing tree is
 *  an empty scan, never an error. */
export function scanResultsDir(resultsDir, driverDir, testDirs) {
  const rows = [];
  if (!fs.existsSync(resultsDir)) return rows;
  const drivers = new Set(
    fs.existsSync(driverDir) ? fs.readdirSync(driverDir).filter((f) => f.endsWith(".mjs")).map((f) => f.replace(/\.mjs$/, "")) : [],
  );
  const testBodies = [];
  for (const td of testDirs) {
    if (!fs.existsSync(td)) continue;
    for (const t of fs.readdirSync(td)) {
      if (/\.test\.(mjs|js)$/.test(t)) {
        testBodies.push({ name: t, body: fs.readFileSync(path.join(td, t), "utf8") });
      }
    }
  }
  for (const f of fs.readdirSync(resultsDir)) {
    const cls = classifyResultsDoc(f, drivers);
    if (!cls) continue;
    rows.push({
      doc: f,
      kind: cls.kind,
      base: cls.base,
      readers: cls.kind === "transcription" ? referencedBy(cls.base, testBodies) : [],
    });
  }
  return rows;
}

/** Run the fold's own suite and return the failing test NAMES. `ok` is
 *  decided by the failure names, never by the process exit code alone.
 *
 *  LOAD GATE (heimdall's self-defense, applied to the suite sensor): the
 *  watcher will not create the load it measures. When the 1-minute load
 *  average already exceeds the machine's own parallelism the sweep is
 *  DEFERRED — a typed refusal naming the load, never a false "clean" and
 *  never an added burden. A concurrent session running the same suite is
 *  the exact case: two `node --test` runs collide on bound ports
 *  (matrix-fake-homeserver) and hang each other. `force` is the declared
 *  override for a quiet box.
 *
 *  A per-test timeout turns a hanging test into a FAILING test — a hang is
 *  a deviation to report, never a sweep that never returns — and a hard
 *  deadline on the whole child reports `suite_hung` instead of hanging
 *  the keeper. */
export async function runSuite({ root, perTestMs = 30000, deadlineMs = 150000, files, force = false } = {}) {
  if (!root) throw new TypeError("runSuite: root (the repo to keep) is required");
  const list = files ?? fs.readdirSync(root).filter((f) => f.endsWith(".test.mjs"));
  const load = os.loadavg()[0];
  const parallelism = os.availableParallelism();
  if (!force && load > parallelism) {
    return {
      ok: null,
      deferred: true,
      reason: "high_load",
      loadavg: load,
      parallelism,
      failures: [],
      files: list.length,
    };
  }
  return new Promise((resolve) => {
    let done = false;
    const finish = (obj) => {
      if (done) return;
      done = true;
      resolve(obj);
    };
    const timer = setTimeout(() => finish({ ok: false, failures: ["suite_hung"], hung: true }), deadlineMs);
    execFile(
      "node",
      ["--test", `--test-timeout=${perTestMs}`, ...list],
      { cwd: root, maxBuffer: 128 * 1024 * 1024 },
      (err, stdout, stderr) => {
        clearTimeout(timer);
        const out = (stdout || "") + (stderr || "");
        const fails = [...out.matchAll(/^✖ (.+)$/gm)]
          .map((m) => m[1].trim().replace(/\s*\([^)]*\)$/, ""))
          .filter(Boolean);
        finish({ ok: fails.length === 0, failures: [...new Set(fails)].sort() });
      },
    );
  });
}

export function rootFiles(root) {
  return fs.readdirSync(root).filter((f) => !fs.statSync(path.join(root, f)).isDirectory());
}

export function foldTestBodies(root) {
  return fs
    .readdirSync(root)
    .filter((f) => f.endsWith(".test.mjs"))
    .map((f) => ({ name: f, body: fs.readFileSync(path.join(root, f), "utf8") }));
}

/** Every JSONL record in the record dir (FOLD-CONSTITUTION I.5 — "the
 *  record is not a standing; it is the floor under all four", append-only),
 *  replayed. A corrupt row is a typed failure naming the file — the record
 *  is the object (the holograph), and a record that does not replay has
 *  changed behind its own addresses. */
export function auditRecordDir(recordDir) {
  const verdicts = [];
  if (!fs.existsSync(recordDir)) return { verdict: "record_dir_absent", files: 0, verdicts, bad: 0 };
  for (const f of fs.readdirSync(recordDir).filter((x) => x.endsWith(".jsonl"))) {
    const lines = fs.readFileSync(path.join(recordDir, f), "utf8").split("\n");
    const r = checkAppendOnly(lines);
    verdicts.push({ file: f, verdict: r.verdict, firstBad: r.firstBad, lines: r.lines });
  }
  const bad = verdicts.filter((v) => v.verdict !== "append_only_holds");
  return { verdict: bad.length ? "replay_failed" : "append_only_holds", files: verdicts.length, bad: bad.length, verdicts };
}

/** The live sweep: suite, map, results, record. Standing is the previous
 *  sweep's verdicts (or null on the first run, which ESTABLISHES the
 *  standing and says so). */
export async function runLiveSweep(standing, { root, enforcement, resultsRoots = [], force = false } = {}) {
  if (!root) throw new TypeError("runLiveSweep: root (the repo to keep) is required");
  if (!Array.isArray(enforcement)) throw new TypeError("runLiveSweep: enforcement (the constitution's map rows) is required");
  const t0 = Date.now();
  // Cheap sensors first, so a sweep always lands its verdicts fast; the
  // suite is the one expensive sensor and belongs to its own cadence (and
  // to the load gate) — never the reason a sweep returns nothing.
  const map = auditEnforcementMap(enforcement, rootFiles(root), foldTestBodies(root));
  // Each results root is { resultsDir, driverDir, testDirs } — the caller names
  // where its transcriptions, their drivers and their reader tests live.
  const resultsRows = resultsRoots.flatMap((r) => scanResultsDir(r.resultsDir, r.driverDir, r.testDirs));
  const results = auditResults(resultsRows);
  const record = auditRecordDir(path.join(root, "record"));
  const suite = await runSuite({ root, force: force || process.env.ER7_SOLON_FORCE_SUITE === "1" });
  return {
    durationMs: Date.now() - t0,
    suite: {
      ...suite,
      diff: suite.deferred ? null : diffFailures(standing?.suite?.failures ?? [], suite.failures),
    },
    map,
    results: {
      ...results,
      delta:
        standing?.results?.unenforcedCount == null
          ? "standing_established"
          : results.unenforcedCount - standing.results.unenforcedCount,
    },
    record,
  };
}

// ─────────────────────────── the keeper ───────────────────────────

/** The homeostatic loop. A cheap heartbeat at heartbeatMs; a full sweep at
 *  sweepMs (single-flight; a still-running sweep is skipped and noted, and
 *  a restart storm is itself a finding — never a silent skip). Standing is
 *  read from the log's own last sweep, so the regulator re-zeros only on
 *  its own record. */
export function createKeeper({
  root,
  logFile = root ? solonLogPath(root) : null,
  heartbeatMs = Number(process.env.ER7_SOLON_HEARTBEAT_MS ?? 60000),
  sweepMs = Number(process.env.ER7_SOLON_SWEEP_MS ?? 6 * 60 * 60 * 1000),
  now = Date.now,
  append = (line) => fs.appendFileSync(logFile, line + "\n", "utf8"),
  readLog = () => (fs.existsSync(logFile) ? fs.readFileSync(logFile, "utf8").split("\n") : []),
  onSweep = null,
  testBodies = () => (root ? foldTestBodies(root) : []),
  probe = async () => ({ surface: "unprobed" }),
  log = (msg) => process.stderr.write(`[${new Date().toISOString()}] [solon] ${msg}\n`),
}) {
  if (!logFile && !(append && readLog)) throw new TypeError("createKeeper: a root, a logFile, or an injected append/readLog is required");
  if (typeof onSweep !== "function") throw new TypeError("createKeeper: onSweep is required (the caller's runLiveSweep wiring)");
  const state = { seq: 0, startedAt: now(), lastBeatAt: null, sweep: null, heartbeatSkipped: 0, sweepSkipped: 0 };
  let beatTimer = null;
  let sweepTimer = null;
  let sweepInFlight = false;
  let stopped = false;

  function nextSeq() {
    state.seq += 1;
    return state.seq;
  }

  async function beat() {
    const at = now();
    const probeResult = await probe();
    const lastSweepAt = state.sweep?.at ?? null;
    const entry = {
      event: "heartbeat",
      seq: nextSeq(),
      at,
      sweepAgeMs: lastSweepAt == null ? null : at - lastSweepAt,
      probe: probeResult,
    };
    append(JSON.stringify(entry));
    state.lastBeatAt = at;
  }

  async function sweep() {
    if (sweepInFlight) {
      state.sweepSkipped += 1;
      log(`sweep skipped — previous still running (${state.sweepSkipped} skips)`);
      return;
    }
    sweepInFlight = true;
    const at = now();
    try {
      const standing = state.sweep?.verdicts ?? null;
      log(standing ? "sweep (against standing)" : "sweep (first — standing established)");
      const verdicts = await onSweep(standing);
      const entry = { event: "sweep", seq: nextSeq(), at, durationMs: verdicts.durationMs, verdicts };
      append(JSON.stringify(entry));
      state.sweep = { at, verdicts };
      const sv = verdicts.suite;
      const suiteWord = sv?.deferred
        ? `suite deferred (load ${sv?.loadavg?.toFixed(1) ?? "?"} > ${sv?.parallelism ?? "?"} parallel)`
        : `suite ${sv?.ok ? "clean" : `${sv?.failures?.length ?? "?"} failing`}`;
      log(`sweep done in ${verdicts.durationMs}ms — ${suiteWord} · map ${verdicts.map?.verdict ?? "?"} · results ${verdicts.results?.unenforcedCount ?? "?"} unenforced · record ${verdicts.record?.verdict ?? "?"}`);
    } catch (e) {
      const entry = { event: "sweep", seq: nextSeq(), at, durationMs: Date.now() - at, verdicts: null, error: String(e?.message ?? e) };
      append(JSON.stringify(entry));
      log(`sweep failed: ${e?.message ?? e}`);
    } finally {
      sweepInFlight = false;
    }
  }

  async function status() {
    const lines = readLog();
    const ashby = verifyWatcher({
      lines,
      heartbeatIntervalMs: heartbeatMs,
      nowMs: now(),
      testBodies: testBodies(),
      requiredMarkers: [KEEPER_MARKER],
    });
    return {
      archon: "solon",
      at: now(),
      startedAt: state.startedAt,
      seq: state.seq,
      heartbeat: {
        lastBeatAt: state.lastBeatAt,
        ageMs: state.lastBeatAt == null ? null : now() - state.lastBeatAt,
        intervalMs: heartbeatMs,
        sweepAgeMs: state.sweep ? now() - state.sweep.at : null,
        sweepSkipped: state.sweepSkipped,
      },
      sweep: state.sweep
        ? { at: state.sweep.at, ageMs: now() - state.sweep.at, verdicts: state.sweep.verdicts }
        : null,
      ashby,
      tail: readTail(lines),
    };
  }

  return {
    start() {
      state.startedAt = now();
      const lines = readLog();
      let maxSeq = 0;
      for (const ln of lines) {
        if (!ln.trim()) continue;
        try {
          const o = JSON.parse(ln);
          if (o.seq != null && Number(o.seq) > maxSeq) maxSeq = Number(o.seq);
        } catch {
          /* the first sweep's record audit reports it */
        }
      }
      state.seq = maxSeq;
      beat(); // a beat immediately, so the surface is alive before the first sweep
      sweep(); // the first sweep immediately — the proof a beat alone cannot be
      beatTimer = setInterval(beat, heartbeatMs);
      sweepTimer = setInterval(sweep, sweepMs);
      if (beatTimer.unref) beatTimer.unref();
      if (sweepTimer.unref) sweepTimer.unref();
      log(`keeper up — heartbeat ${heartbeatMs}ms, sweep ${sweepMs}ms, log ${logFile}`);
      return status();
    },
    stop() {
      stopped = true;
      clearInterval(beatTimer);
      clearInterval(sweepTimer);
    },
    status,
    // Exposed for the controls: start() wires these onto the timers; the
    // tests drive them directly with injected now/append/readLog/onSweep so
    // the loop is pinned without a clock.
    beat,
    sweep,
  };
}

// ─────────────────────────── server ──────────────────────────────────

export function startServer(keeper, port = Number(process.argv[2] ?? process.env.ER7_SOLON_PORT ?? 11438)) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    if (req.method === "GET" && url.pathname === "/solon") {
      const body = JSON.stringify(await keeper.status());
      res.writeHead(200, { "content-type": "application/json", "x-archon": "solon" });
      return res.end(body);
    }
    if (req.method === "GET" && url.pathname === "/health") {
      const st = await keeper.status();
      res.writeHead(st.ashby.watcher === "watcher_alive" ? 200 : 503, { "content-type": "application/json" });
      return res.end(JSON.stringify({ ok: st.ashby.watcher === "watcher_alive", watcher: st.ashby.watcher }));
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "solon serves /solon and /health" }));
  });
  server.listen(port, "127.0.0.1", () => process.stderr.write(`[solon] status on http://127.0.0.1:${port}/solon\n`));
  return server;
}
