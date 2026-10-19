// organs/hard-read.js — WHAT HAPPENS WHEN SOMETHING WON'T READ, in every reading, learned on the fly.
//
// Fold invariant: A READING IS ACCEPTED ONLY WHEN TWO DIFFERENT SENSES AGREE.
// A region the ordinary adapter saw and could not read (the silence report,
// origins.mjs::unreadMentions) escalates on its own — no one asks:
//
//   1. THE SWARM. Ants try reading routes, each ant one route, chosen by the
//      colony's own pheromone trails (kernel/stigmergy.js: deposits, evaporation,
//      learned order, a scout's epsilon). The environment is the memory: no ant
//      plans. Two senses, ranked separately —
//         text   routes read the region's characters (sign-scan, tex-order)
//         image  routes TYPESET the region as a person sees it, then LOOK
//                (OpenCV finds a stacked pair by geometry) and READ (Tesseract):
//                ocr-line, cv-stack:<gap>. The CV gap is itself a route, so the
//                colony learns which glyph-scale setting works by what agrees.
//   2. AGREEMENT. Accepted when a text reading and an image reading are equal.
//      Only routes that produced the accepted reading deposit a trail; a route
//      that failed deposits nothing and evaporates. Unagreed regions stay
//      unresolved, with every reading disclosed — never a guess.
//   3. RULES. When >= RULE_FLOOR regions of one character-class SKELETON were
//      settled by the same (text route, image route) pair, that pair is REC'd as
//      a rule (append-only). The next region of that skeleton is read
//      mechanically by the learned text route — disclosed as `by-rule`, and
//      still checked against its own bytes. A rule can be conceded; it is never
//      silently edited.
//
// The skeleton (a region's characters collapsed to classes) is the ants' HEAD:
// it names a shape without knowing what the shape is about.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deposit, routeOrderFor } from "../kernel/stigmergy.js";
import { unreadMentions } from "./silence.js";
import { readQuantities, ANCHOR_GENERIC } from "./quantities.js";

export const HARDREAD_SCHEMA = "EOHardRead@1";
export const RULE_FLOOR = 2; // the structural minimum for recurrence (binding.js / WITNESS_FLOOR): one instance is not a pattern
export const MAX_ANTS = 8;   // declared ceiling per region
export const MAX_REGIONS = 24; // declared ceiling per source: more unread regions than this are listed, not chased
export const CV_GAPS = [12, 16, 20, 24]; // glyph-merge gaps (px at 300 dpi) the colony may try. Ascending — the structural default carries NO knowledge of which one works; the trails learn that.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const VISION = path.join(HERE, "vision.py");

// ── the region and its skeleton ───────────────────────────────────────────
const EXPR = /^(?:\\pm|\(stat\)|\(sys\)|[\d.\s+\-±=^_{}$()\\/]|[A-Za-z](?![A-Za-z]))*/;

/** bearsError(expr) — does the notation state an UNCERTAINTY at all (± , \\pm, +-, +/-, or a signed stacked pair)?
 *  A bare `p=0.13` or `h=0.7` states none, so there is nothing to read the hard way: not chased, listed. */
export const bearsError = (expr) => /±|\\pm|\+\/?-|[_^]\s*\{?\s*[+-]\s*\d/.test(String(expr));

/** The expression a mention introduces: the anchor through its notation, up to prose. */
export function expressionOf(quote, anchorLen = 0) {
  const head = String(quote).slice(0, anchorLen);
  const m = String(quote).slice(anchorLen).match(EXPR);
  return (head + (m?.[0] ?? "")).replace(/[\s$,;.]+$/, "").trimEnd();
}

/** skeleton(expr) — characters collapsed to classes: digits 9, letters a, runs merged. */
export function skeleton(expr) {
  return String(expr).replace(/\\pm/g, "±").replace(/[0-9]+/g, "9").replace(/[A-Za-z]+/g, "a").replace(/\s+/g, " ");
}

// ── readings ──────────────────────────────────────────────────────────────
const num = /-?\d+(?:\.\d+)?/g;
const same = (a, b) => a && b && ["value", "up", "down"].every((k) => Math.abs(a[k] - b[k]) < 1e-9);

/** readingFromText(s) — value, up, down from the characters of a notation. */
export function readingFromText(s) {
  const t = String(s).replace(/\\pm/g, "±").replace(/[$\\{}()^_]/g, " ").replace(/\+\s*\/\s*-|\+-/g, "±").replace(/\((?:stat|sys)\)/g, " ").replace(/[−–]/g, "-");
  const eq = t.indexOf("="); const body = eq >= 0 ? t.slice(eq + 1) : t;
  const vm = body.match(/-?\d+(?:\.\d+)?/); if (!vm) return null;
  const value = Number(vm[0]); const rest = body.slice(vm.index + vm[0].length);
  if (rest.includes("±")) {
    const errs = [...rest.replace(/±/g, " ").matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
    if (!errs.length) return null;
    const e = Math.sqrt(errs.reduce((a, x) => a + x * x, 0));
    return { value, up: round(e), down: round(e), sym: true, parts: errs };
  }
  const signed = [...rest.matchAll(/([+-])\s*(\d+(?:\.\d+)?)/g)].map((m) => [m[1], Number(m[2])]);
  const up = signed.find((s) => s[0] === "+"); const down = signed.find((s) => s[0] === "-");
  if (!up || !down) return null;
  return { value, up: up[1], down: down[1], sym: up[1] === down[1] };
}
const round = (x) => Math.round(x * 1e6) / 1e6;

// TEXT routes -----------------------------------------------------------------
const TEXT = {
  "sign-scan": (r) => readingFromText(r.expr),
  "tex-order": (r) => {
    const m = r.expr.match(/(\d+(?:\.\d+)?)\s*(?:_\{?\s*-\s*(\d+(?:\.\d+)?)\}?\s*\^\{?\s*\+\s*(\d+(?:\.\d+)?)\}?|\^\{?\s*\+\s*(\d+(?:\.\d+)?)\}?\s*_\{?\s*-\s*(\d+(?:\.\d+)?)\}?)/);
    if (!m) return null;
    const down = Number(m[2] ?? m[5]), up = Number(m[3] ?? m[4]);
    return { value: Number(m[1]), up, down, sym: up === down };
  },
};

// IMAGE routes ----------------------------------------------------------------
function vision(req) {
  const p = spawnSync("python3", [VISION], { input: JSON.stringify(req), encoding: "utf8", maxBuffer: 1 << 24 });
  if (p.status !== 0) return { error: (p.stderr || "vision failed").trim().split("\n").pop() };
  try { return JSON.parse(p.stdout); } catch { return { error: "vision returned no JSON" }; }
}

/** Typeset a region once; every image route reads the same picture. */
function pictureOf(region, dir) {
  if (region._pic) return region._pic;
  const out = path.join(dir, `region-${Math.abs(hash(region.expr))}.png`);
  const r = vision({ mode: "render", text: region.expr, out });
  region._pic = r.error ? { error: r.error } : { png: r.png, typeset: r.typeset };
  return region._pic;
}
const hash = (s) => { let h = 0; for (const c of s) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0; return h; };

const imageRoutes = () => ["ocr-line", ...CV_GAPS.map((g) => `cv-stack:${g}`)];
export const TEXT_ROUTES = Object.keys(TEXT);

function runImage(route, region, dir) {
  const pic = pictureOf(region, dir);
  if (pic.error) return { reading: null, note: pic.error };
  if (route === "ocr-line") {
    const o = vision({ mode: "ocr", png: pic.png });
    return { reading: o.error ? null : readingFromText(o.text), seen: o.text };
  }
  const gap = Number(route.split(":")[1]);
  const s = vision({ mode: "stacked", png: pic.png, gap });
  if (s.error) return { reading: null, note: s.error };
  for (const st of s.stacks ?? []) {
    const value = Number(String(st.base).match(/\d+(?:\.\d+)?/)?.[0]);
    const up = String(st.upper).match(/\+\s*(\d+(?:\.\d+)?)/), dn = String(st.lower).match(/-\s*(\d+(?:\.\d+)?)/);
    if (Number.isFinite(value) && up && dn) return { reading: { value, up: Number(up[1]), down: Number(dn[1]), sym: up[1] === dn[1] }, seen: `${st.base} | ${st.upper} | ${st.lower}` };
  }
  return { reading: null, seen: JSON.stringify(s.stacks ?? []) };
}

// ── the swarm ─────────────────────────────────────────────────────────────
function lcg(seed) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

/** swarmRegion(region, { trails, dir, rng, now }) -> { outcome, trails }
 *  Each ant tries one route per sense, chosen by the colony's learned order,
 *  until a text reading and an image reading agree or MAX_ANTS are spent. */
export function swarmRegion(region, { trails, dir, rng, now, image = runImage }) {
  const head = skeleton(region.expr);
  // TEXT routes depend on the notation, so their trails are keyed by its skeleton. IMAGE routes depend on the
  // picture (glyph scale, typesetter), not on what is written — so they share one head and learn across notations.
  const headOf = (sense) => (sense === "text" ? `${head}|text` : "picture|image");
  const tried = { text: new Set(), image: new Set() };
  const readings = [];
  let accepted = null, ants = 0;
  while (!accepted && ants < MAX_ANTS) {
    let moved = false;
    for (const [sense, routes] of [["text", TEXT_ROUTES], ["image", imageRoutes()]]) {
      const order = routeOrderFor(trails, headOf(sense), { now, routes, rng }).filter((r) => !tried[sense].has(r));
      const route = order[0]; if (!route) continue;
      tried[sense].add(route); moved = true;
      const t0 = Date.now();
      const r = sense === "text" ? { reading: TEXT[route](region) } : image(route, region, dir);
      readings.push({ sense, route, reading: r.reading, seen: r.seen, ms: Date.now() - t0 });
    }
    ants++;
    const texts = readings.filter((x) => x.sense === "text" && x.reading), images = readings.filter((x) => x.sense === "image" && x.reading);
    for (const t of texts) for (const i of images) if (same(t.reading, i.reading)) { accepted = { reading: t.reading, text: t.route, image: i.route }; }
    if (!moved) break;
  }
  let next = trails;
  if (accepted) for (const r of readings) if (r.reading && same(r.reading, accepted.reading)) next = deposit(next, { head: headOf(r.sense), route: r.route, ok: true, ms: r.ms, at: now });
  return { outcome: { head, ants, accepted, readings, resolved: Boolean(accepted), png: region._pic?.png ?? null }, trails: next };
}

// ── rules ─────────────────────────────────────────────────────────────────
export const emptyRules = () => ({ schema: HARDREAD_SCHEMA, rules: [] });

/** learnRules(rules, outcomes) -> { rules, added } — append a rule when RULE_FLOOR
 *  settled regions of one skeleton were settled by the same route pair. */
export function learnRules(rules, outcomes, { now = Date.now() } = {}) {
  const tally = new Map();
  for (const o of outcomes) if (o.accepted && !o.byRule) { const k = `${o.head}||${o.accepted.text}||${o.accepted.image}`; tally.set(k, (tally.get(k) ?? 0) + 1); }
  const added = [];
  let out = rules;
  for (const [k, n] of tally) {
    const [head, textRoute, imageRoute] = k.split("||");
    if (n < RULE_FLOOR || out.rules.some((r) => r.head === head && !r.conceded)) continue;
    const rule = { name: `hard-${out.rules.length + 1}`, head, textRoute, imageRoute, evidence: { regions: n }, foundVia: "cv-ocr-agreed", at: now };
    out = { ...out, rules: [...out.rules, rule] }; added.push(rule);
  }
  return { rules: out, added };
}
export const concedeRule = (rules, name, because, now = Date.now()) => ({ ...rules, rules: rules.rules.map((r) => (r.name === name ? { ...r, conceded: { because, at: now } } : r)) });

function applyRule(region, rules) {
  const head = skeleton(region.expr);
  const rule = rules.rules.find((r) => r.head === head && !r.conceded);
  if (!rule) return null;
  const reading = TEXT[rule.textRoute](region);
  return reading ? { head, ants: 0, byRule: rule.name, accepted: { reading, text: rule.textRoute, image: null }, readings: [{ sense: "text", route: rule.textRoute, reading }], resolved: true } : null;
}

// ── the automatic door ────────────────────────────────────────────────────
/** autoHardRead({ texts, anchor, items, trails, rules, dir, seed, now })
 *  Finds what the ordinary adapter saw and did not read, and reads it the hard
 *  way. Returns readings (each with its address and how it was read), what is
 *  STILL unread, the outcomes, and the updated trails and rules. */
export function autoHardRead({ texts, anchor, items = [], trails = {}, rules = emptyRules(), dir = fs.mkdtempSync(path.join(os.tmpdir(), "hardread-")), seed = 1, now = Date.now(), image = runImage, swarm = true }) {
  const rng = lcg(seed);
  const allUnread = unreadMentions({ texts, anchor, items });
  const unread = allUnread.slice(0, MAX_REGIONS);
  const outcomes = []; const readings = []; const still = [];
  let t = trails, r = rules;
  for (const u of unread) {
    const doc = texts.find((x) => x.name === u.doc);
    const expr = expressionOf(doc.text.slice(u.at[0], u.at[0] + 160), u.at[1] - u.at[0]);
    const region = { doc: u.doc, at: [u.at[0], u.at[0] + expr.length], expr };
    if (doc.text.slice(region.at[0], region.at[1]) !== expr) { still.push({ ...u, why: "the region's text did not read back from its address" }); continue; }
    if (!bearsError(expr)) { still.push({ ...u, why: "states no uncertainty — not a measurement with an error to read; not chased", quote: expr }); continue; }
    let o = applyRule(region, r);
    if (!o && !swarm) { still.push({ ...u, why: "no learned rule applies and no image sense is available to learn one" }); continue; }
    if (!o) { const s = swarmRegion(region, { trails: t, dir, rng, now, image }); o = s.outcome; t = s.trails; }
    o.doc = region.doc; o.at = region.at; o.expr = expr; outcomes.push(o);
    if (o.resolved) readings.push({ doc: region.doc, at: region.at, verbatim: expr, ...o.accepted.reading, byRule: o.byRule ?? null, routes: { text: o.accepted.text, image: o.accepted.image }, ants: o.ants });
    else still.push({ ...u, expr, span: region.at, ants: o.ants, why: `no text reading and image reading agreed after ${o.ants} ant(s)`, readings: o.readings.map((x) => ({ sense: x.sense, route: x.route, reading: x.reading })) });
    const learned = learnRules(r, outcomes, { now }); r = learned.rules;
  }
  for (const u of allUnread.slice(MAX_REGIONS)) still.push({ ...u, why: `past the ${MAX_REGIONS}-region ceiling for one source — listed, not chased` });
  return { readings, still, outcomes, trails: t, rules: r };
}

// ── learning that persists: the colony's memory outlives the run ─────────────
export const learnedDir = (env = process.env) => env.ER7_LEARNED_DIR ?? path.join(os.homedir(), ".er7", "learned");
const FILE = "hard-read.json";

/** loadLearned(dir) -> { trails, rules, note } — a missing or corrupt file is an EMPTY colony, said, never a crash. */
export function loadLearned(dir = learnedDir()) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(dir, FILE), "utf8"));
    if (j.schema !== HARDREAD_SCHEMA) return { trails: {}, rules: emptyRules(), note: "unrecognised learned file — starting empty" };
    return { trails: j.trails ?? {}, rules: j.rules ?? emptyRules(), note: null };
  } catch (e) { return { trails: {}, rules: emptyRules(), note: e.code === "ENOENT" ? "nothing learned yet" : `learned file unreadable (${e.code ?? e.name}) — starting empty` }; }
}

/** saveLearned(dir, learned) — rules are APPEND-ONLY across writers: a rule already on disk is never dropped
 *  (a concession is a flag on it, kept), whichever process saves last. Written atomically. */
export function saveLearned(dir, learned) {
  fs.mkdirSync(dir, { recursive: true });
  const disk = loadLearned(dir).rules.rules;
  const byName = new Map(disk.map((r) => [r.name, r]));
  for (const r of learned.rules.rules) { const d = byName.get(r.name); byName.set(r.name, d ? { ...d, ...(r.conceded ? { conceded: r.conceded } : {}) } : r); }
  // a rule learned in another process under the same name for a DIFFERENT head must not be overwritten
  const rules = { schema: HARDREAD_SCHEMA, rules: [...byName.values()] };
  const tmp = path.join(dir, `${FILE}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify({ schema: HARDREAD_SCHEMA, trails: learned.trails, rules }, null, 1));
  fs.renameSync(tmp, path.join(dir, FILE));
  return rules;
}

// ── the trigger, generic: notation the plain reader cannot be trusted with ───
/** hardSignals(text) — characters that mean typeset notation reached a plain-text reader.
 *  Same spirit as look.js's weirdFormattingScore (page shape); this is the notation side. */
export function hardSignals(text) {
  const t = String(text ?? ""); const sig = [];
  if (/[_^]\{[^}]*\}/.test(t)) sig.push("tex_sub_sup");
  if (/\\pm|\\mp|\\times|\\frac/.test(t)) sig.push("tex_operator");
  if ((t.match(/\$/g) ?? []).length >= 2) sig.push("math_dollars");
  return sig;
}

let SENSES = null;
/** senses() — is the image sense installed here? Checked once. Absent = the two-sense rule cannot be met,
 *  so nothing NEW is learned or accepted; already-learned rules still apply. Disclosed, never an error. */
export function senses() {
  if (SENSES) return SENSES;
  const py = spawnSync("python3", ["-c", "import cv2, matplotlib, numpy"], { encoding: "utf8" });
  const te = spawnSync("tesseract", ["--version"], { encoding: "utf8" });
  return (SENSES = { image: py.status === 0 && te.status === 0, why: py.status !== 0 ? "python3 with opencv+matplotlib is not installed" : te.status !== 0 ? "tesseract is not installed" : null });
}

/** hardReadSource({ name, text, learned, dir, image, now, seed }) — the pipeline's door.
 *  Runs the ordinary quantity reader, finds what it saw and did not read (generic anchor), escalates it.
 *  Returns the readings as plain, ADDRESSED lines ready to be admitted as a source of their own. */
export function hardReadSource({ name, text, learned, dir = fs.mkdtempSync(path.join(os.tmpdir(), "hardread-")), image = null, now = Date.now(), seed = 1 }) {
  const texts = [{ name, text }];
  const signals = hardSignals(text);
  const have = image ? { image: true } : senses();
  const items = readQuantities(texts);
  const r = autoHardRead({ texts, anchor: new RegExp(ANCHOR_GENERIC.source, "g"), items, trails: learned.trails, rules: learned.rules, dir, seed, now, ...(image ? { image } : {}), swarm: have.image });
  const lines = linesFor(text, r.readings);
  return { readings: r.readings, still: r.still, outcomes: r.outcomes, lines, signals, senses: have, learned: { trails: r.trails, rules: r.rules }, rulesAdded: r.rules.rules.length - learned.rules.rules.length };
}

/** linesFor(text, readings) — each reading as one addressed line carrying the SENTENCE it sits in, verbatim:
 *  the words that make retrieval find it for a question ("the Hubble constant") and the provenance a reader
 *  can check. Without them the reading is an orphan number the surfacer has no reason to select. */
export function linesFor(text, readings) {
  const sentenceAround = (b0, b1) => {
    const from = Math.max(text.lastIndexOf(". ", b0) + 2, text.lastIndexOf("\n", b0) + 1, b0 - 240, 0);
    const toRel = text.slice(b1, b1 + 240).search(/\.\s|\n/);
    return text.slice(from, toRel < 0 ? b1 + 240 : b1 + toRel + 1).replace(/\s+/g, " ").trim();
  };
  return readings.map((h) => `[${h.doc}#${h.at[0]}-${h.at[1]}] «${sentenceAround(h.at[0], h.at[1])}» — the quantity ${h.verbatim} reads as ${h.value} ${h.sym ? `± ${h.up}` : `+${h.up} −${h.down}`} (${h.byRule ? `learned rule ${h.byRule}` : h.judged ? "judged by the small model between readings that disagreed" : `${h.routes.text} and ${h.routes.image}, which agreed`})`);
}

/** judgeStill({ text, still, ask }) — THE SMALL MODEL, AS NEEDED. Only for regions the swarm could not settle
 *  because two senses produced DIFFERENT readings. The model never writes a value: it POINTS at one of the
 *  candidates (or at none). Guards, all mechanical: a candidate is offered only if every number in it occurs
 *  literally in the region's own characters; the pick must be a listed candidate; a judged reading is marked
 *  `judged`, is never counted toward a learned rule, and carries no trail. `ask(prompt) -> Promise<string>`. */
export async function judgeStill({ text, still, ask, doc = still[0]?.doc }) {
  const readings = []; const left = [];
  for (const u of still) {
    const nums = new Set([...String(u.expr ?? "").matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0])));
    const cands = [];
    for (const c of u.readings ?? []) {
      if (!c.reading || !cands.every((k) => !same(k.reading, c.reading))) continue;
      if ([c.reading.value, c.reading.up, c.reading.down].every((v) => nums.has(Math.abs(v)) || u.readings.some((x) => x.reading?.parts?.includes(v)))) cands.push(c);
    }
    if (cands.length < 2 || !u.expr) { left.push(u); continue; }
    const prompt = `A passage states one measurement. Passage: «${u.expr}»\nWhich reading does the passage state?\n${cands.map((c, i) => `${i + 1}) ${c.reading.value} ${c.reading.sym ? `± ${c.reading.up}` : `+${c.reading.up} −${c.reading.down}`}`).join("\n")}\nAnswer with only the number of the reading, or 0 if none.`;
    let pick = 0; try { pick = Number(String(await ask(prompt)).match(/\d+/)?.[0] ?? 0); } catch { pick = 0; }
    if (pick >= 1 && pick <= cands.length) { const c = cands[pick - 1]; readings.push({ doc: u.doc, at: u.span, verbatim: u.expr, ...c.reading, byRule: null, judged: true, routes: { text: c.sense === "text" ? c.route : null, image: c.sense === "image" ? c.route : null }, ants: u.ants }); }
    else left.push({ ...u, why: `${u.why}; the small model chose none of the ${cands.length} candidates` });
  }
  return { readings, still: left, lines: linesFor(text, readings) };
}
