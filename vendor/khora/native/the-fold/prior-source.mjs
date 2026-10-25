// the-fold/prior-source.mjs — THE ONE DOOR THE READER'S PRIORS COME THROUGH (2026-10-24).
//
// Every prior is data in one home, <workspace root>/janus/priors (priors-home.js). Before this door, six reading modules each
// opened that directory with node:fs (language-grammar, langid, priors-home, read-quality, reading-rules, reader-bundle), so the
// reader could not load in a page and every browser surface kept its own port of the loader (the Holodeck's holodeck-reader.js,
// its reading-rules.js shim). Now every one of them asks this door for a prior BY NAME, and the door is the only code that knows
// where the bytes are:
//   · under Node it reads the home directory (KHORA_PRIORS_DIR overrides; a vendored tree with no janus beside it reads its own
//     native/priors copy, and one with both reads janus first, then its own copy for a name janus lacks);
//   · in a page there is no file system, so the door fetches from the vendored native/priors beside this file. A read is
//     synchronous (the organs read priors inside synchronous calls), so a page names the files it will read and awaits
//     `preloadPriors(names)` once, before reading. reading-rules.json is preloaded here, because three modules read it at their own
//     top level.
// An absent prior is null, never a throw and never a guessed table: the caller keeps its typed gap. A name a page asked for without
// preloading it is recorded (priorMisses) so the page can see what it forgot rather than read bare in silence.
//
//   priorJson(name)              → the parsed prior, or null
//   priorNames()                 → the prior file names this door can serve
//   priorsHome()                 → { dir, base, kind }: where the door reads (dir under Node, base URL in a page)
//   readJsonAt(dir, name)        → a prior from an explicit directory (Node only; tests and eval scripts that pass a dir)
//   preloadPriors(names)         → (page) fetch these names once; resolves to { loaded, missing }
//   setPriorSource(src | null)   → replace the door ({ read(name) → json|null, list() → names }); null restores the default
//   priorMisses()                → names read but never preloaded (page), for the caller's own gap report
//   priorGeneration()            → bumps whenever the door's contents change, so a module that builds from priors can rebuild

export const IS_NODE = typeof process !== "undefined" && !!process.versions?.node && typeof window === "undefined";
const fs = IS_NODE ? (await import("node:fs")).default : null;
const path = IS_NODE ? (await import("node:path")).default : null;
const url = IS_NODE ? await import("node:url") : null;

function nodeHome() {
  const here = path.dirname(url.fileURLToPath(import.meta.url));
  const root = path.join(here, "..", "..", "..");
  const janus = path.join(root, "janus", "priors");
  const vendored = path.join(here, "..", "priors");
  const dir = process.env.KHORA_PRIORS_DIR || (fs.existsSync(janus) || !fs.existsSync(vendored) ? janus : vendored);
  // a vendored tree may carry some priors beside janus and others in its own native/priors (EO-terminal does): a name the home
  // lacks is read from there. In khora itself native/priors is the janus home, so the two are one directory.
  const also = !process.env.KHORA_PRIORS_DIR && dir !== vendored && fs.existsSync(vendored) && fs.realpathSync(vendored) !== fs.realpathSync(dir) ? vendored : null;
  return { kind: "fs", dir, also, base: null, root, janus: path.join(root, "janus") };
}

const HOME = IS_NODE ? nodeHome() : { kind: "fetch", dir: null, base: new URL("../priors/", import.meta.url).href, root: null, janus: null };

export function readJsonAt(dir, name) {
  if (!fs || !dir) return null;
  try { return JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")); } catch { return null; }
}

const listAt = (dir) => { try { return dir ? fs.readdirSync(dir) : []; } catch { return []; } };
const fsSource = () => ({
  read: (name) => readJsonAt(HOME.dir, name) ?? (HOME.also ? readJsonAt(HOME.also, name) : null),
  list: () => [...new Set([...listAt(HOME.dir), ...listAt(HOME.also)])],
});

// the page's source: what was fetched, by name; a read of anything else is a recorded miss
const fetched = new Map();
const misses = new Set();
const fetchSource = () => ({
  read: (name) => { if (fetched.has(name)) return fetched.get(name); misses.add(name); return null; },
  list: () => [...fetched.keys()].filter((n) => fetched.get(n) != null),
});

let source = IS_NODE ? fsSource() : fetchSource();
const cache = new Map();
let generation = 0;
export const priorGeneration = () => generation;

export function priorJson(name) {
  if (!cache.has(name)) cache.set(name, source.read(name) ?? null);
  return cache.get(name);
}
export const priorNames = () => { try { return source.list() ?? []; } catch { return []; } };
export const priorsHome = () => ({ kind: HOME.kind, dir: HOME.dir, base: HOME.base });
export const PRIORS_HOME = HOME;
export const priorMisses = () => [...misses];

export function setPriorSource(src = null) {
  source = src ?? (IS_NODE ? fsSource() : fetchSource());
  cache.clear(); generation++;
}

export async function preloadPriors(names = [], { base = HOME.base } = {}) {
  if (IS_NODE) return { loaded: names.filter((n) => priorJson(n) != null), missing: names.filter((n) => priorJson(n) == null) };
  const loaded = [], missing = [];
  await Promise.all([...new Set(names)].map(async (name) => {
    if (fetched.has(name)) { (fetched.get(name) != null ? loaded : missing).push(name); return; }
    let json = null;
    try { const r = await fetch(new URL(name, base)); if (r.ok) json = await r.json(); } catch { json = null; }
    fetched.set(name, json); cache.delete(name); misses.delete(name); generation++;
    (json != null ? loaded : missing).push(name);
  }));
  return { loaded, missing };
}

// three modules read the reading rules at their own top level (grain-typing, medium, surprise-gate), so a page has them first
if (!IS_NODE) await preloadPriors(["reading-rules.json"]);
