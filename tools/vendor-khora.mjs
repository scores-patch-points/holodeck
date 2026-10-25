// vendor-khora.mjs — vendor the reading organs from the CANONICAL khora (scores-patch-points/khora) into vendor/khora/, FROM A
// COMMIT, and say honestly which files differ from khora (browser shims).
//
//   node tools/vendor-khora.mjs --plan  --commit <sha> [--from <khora repo>]            list the closure, per file identical / shimmed / missing
//   node tools/vendor-khora.mjs --write --commit <sha> [--from <khora repo>] [--janus <janus repo> --janus-commit <sha>] [--all]
//   node tools/vendor-khora.mjs --check                                                 exit 1 if a vendored file differs from its record
//
// Files are read from the commit's objects (`git show <sha>:<path>`), never from a working tree, so another session's uncommitted
// edits in a checkout can never reach the page. The closure is every file reachable from the entry modules through relative
// imports under vendor/khora/, walked on the UPSTREAM text of each file (a new import upstream is followed). A local shim is kept
// only while upstream still imports node: statically; once upstream loads in a page (2026-10-24: the reader core and its prior
// door, kernel/reading-rules.js), the shim is replaced by the upstream file. The priors a page reads are copied from janus at its
// commit. vendor/khora/KHORA-VENDOR.json records both commits and the sha256 of every file written.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d = null) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const KHORA = resolve(arg('--from', process.env.KHORA || resolve(ROOT, '../khora')));
const COMMIT = arg('--commit');
const JANUS = resolve(arg('--janus', process.env.JANUS || resolve(ROOT, '../janus')));
const JANUS_COMMIT = arg('--janus-commit');
const OLD = resolve(ROOT, 'vendor/khora');
const RECORD = resolve(OLD, 'KHORA-VENDOR.json');
// priors are DATA the page fetches by name through the prior door (native/the-fold/prior-source.mjs); their home is janus/priors
const PRIORS = ['pos-eng.json', 'pos-eng-lexicon.json', 'morphology-eng.json', 'reading-rules.json', 'punctuation-eng.json', 'dotted-eng.json', 'frame-eng.json', 'role-config-eng.json', 'contractions-eng.json', 'morph-cues-en.json', 'parser-eng-ewt.json',
  'punctuation-index.json', ...['fra', 'deu', 'spa', 'por', 'ita', 'rus'].map((s) => `punctuation-${s}.json`)];
const ENTRIES = ['reading/demo.html', 'reading/how-it-reads.html', 'holodeck-reader.js'];
const IMPORT = /(?:from\s*|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g;
const NODE_IMPORT = /^\s*import\s+[^;]*?from\s*['"]node:/m;
const sha = (b) => createHash('sha256').update(b).digest('hex');

const cache = new Map();
const show = (repo, commit, rel) => {
  const k = `${repo}|${commit}|${rel}`;
  if (!cache.has(k)) { let b = null; try { b = execFileSync('git', ['-C', repo, 'show', `${commit}:${rel}`], { maxBuffer: 1 << 28 }); } catch { b = null; } cache.set(k, b); }
  return cache.get(k);
};
const upstream = (rel) => (COMMIT ? show(KHORA, COMMIT, rel) : null);

if (process.argv.includes('--check')) {
  if (!existsSync(RECORD)) { console.log('no KHORA-VENDOR.json: nothing vendored from a commit yet'); process.exit(1); }
  const rec = JSON.parse(readFileSync(RECORD, 'utf8')); let bad = 0;
  for (const [rel, want] of Object.entries(rec.files)) { const p = resolve(OLD, rel); const have = existsSync(p) ? sha(readFileSync(p)) : null; if (have !== want) { console.log(`DRIFT ${rel}`); bad++; } }
  console.log(bad ? `${bad} files drifted from khora ${rec.commit}` : `all ${Object.keys(rec.files).length} files match khora ${rec.commit}`);
  process.exit(bad ? 1 : 0);
}
if (!COMMIT) { console.error('--commit <sha> is required: vendor from a commit, never a working tree'); process.exit(2); }

const seen = new Set(), pages = [], old = new Set();
const walk = (abs) => {
  if (seen.has(abs)) return; seen.add(abs);
  const inVendor = abs.startsWith(OLD + sep);
  const up = inVendor ? upstream(relative(OLD, abs)) : null;
  if (!up && !existsSync(abs)) return;
  if (inVendor) old.add(abs); else pages.push(abs);
  if (!/\.(m?js|html)$/.test(abs)) return;
  const src = (up ?? readFileSync(abs)).toString('utf8');
  for (const m of src.matchAll(IMPORT)) if (m[1].startsWith('.')) walk(resolve(dirname(abs), m[1].split('?')[0]));
};
if (process.argv.includes('--all')) {
  const hits = execFileSync('sh', ['-c', "grep -rlE \"vendor/khora\" --include='*.js' --include='*.mjs' --include='*.html' . || true"], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
    .filter((f) => !f.startsWith('./vendor/') && !f.startsWith('./node_modules/') && !f.startsWith('./.claude/') && !/\.test\.|\/tests\/|\.scratch|probe-|^\.\/\./.test(f));
  for (const f of hits) walk(resolve(ROOT, f));
  // modules the pages load by a computed name (index.html: base + 'profile-page.js')
  for (const x of ['native/kernel/profile-page.js', 'native/kernel/reality-register.js', 'native/organs/overview.js']) walk(resolve(OLD, x));
}
for (const e of ENTRIES) walk(resolve(ROOT, e));

const rows = [...old].map((abs) => {
  const rel = relative(OLD, abs), up = upstream(rel), local = existsSync(abs) ? readFileSync(abs) : null;
  const shim = !!local && /(?:BROWSER|LOCAL) SHIM/.test(local.toString('utf8'));
  const needsShim = !!up && NODE_IMPORT.test(up.toString('utf8'));
  return { rel, up, local, same: !!up && !!local && Buffer.compare(local, up) === 0, keepShim: shim && needsShim, shim, needsShim };
}).sort((a, b) => (a.rel < b.rel ? -1 : 1));

if (process.argv.includes('--plan')) {
  for (const r of rows) console.log((!r.up ? 'NOT-UPSTREAM ' : !r.local ? 'NEW          ' : r.same ? 'identical    ' : r.keepShim ? 'SHIM-KEPT    ' : r.shim ? 'SHIM-RETIRED ' : r.needsShim ? 'NODE-ONLY!   ' : 'UPDATE       ') + r.rel);
  const n = (f) => rows.filter(f).length;
  console.log(`\n${rows.length} files · ${n((r) => r.same)} identical · ${n((r) => r.up && !r.local)} new · ${n((r) => r.up && r.local && !r.same && !r.keepShim)} updated · ${n((r) => r.keepShim)} shims kept · ${n((r) => r.shim && !r.keepShim)} shims retired · ${n((r) => !r.up)} not upstream`);
  const nodeOnly = rows.filter((r) => r.needsShim && !r.keepShim && !r.same);
  if (nodeOnly.length) console.log('UPSTREAM NODE-ONLY (a page cannot load these as they are):', nodeOnly.map((r) => r.rel).join(', '));
} else if (process.argv.includes('--write')) {
  const files = {};
  for (const r of rows) {
    if (!r.up) continue; // a file with no upstream copy is carried as it is
    const bytes = r.keepShim ? r.local : r.up;
    const to = resolve(OLD, r.rel); mkdirSync(dirname(to), { recursive: true }); writeFileSync(to, bytes);
    files[r.rel] = sha(bytes);
  }
  const priors = {};
  for (const f of PRIORS) {
    const b = JANUS_COMMIT ? show(JANUS, JANUS_COMMIT, `priors/${f}`) : null;
    if (!b) { console.log(`prior absent at janus ${JANUS_COMMIT ?? '(no --janus-commit)'}: ${f}`); continue; }
    const to = resolve(OLD, 'native/priors', f); mkdirSync(dirname(to), { recursive: true }); writeFileSync(to, b);
    files[`native/priors/${f}`] = priors[f] = sha(b);
  }
  // the names a page may fetch from the vendored priors (holodeck-reader.js preloads only names that exist, so the console stays clean)
  const dir = resolve(OLD, 'native/priors');
  writeFileSync(resolve(dir, 'names.json'), JSON.stringify({ schema: 'VendoredPriorNames@1', names: readdirSync(dir).filter((f) => /^[a-z][a-z0-9_-]*\.json$/.test(f) && !/^[0-9a-f]{40}\.json$/.test(f) && f !== 'names.json').sort() }) + '\n');
  writeFileSync(RECORD, JSON.stringify({ repo: 'scores-patch-points/khora', commit: COMMIT, janus: { repo: 'scores-patch-points/janus', commit: JANUS_COMMIT }, at: new Date().toISOString(), shims: rows.filter((r) => r.keepShim).map((r) => r.rel), files }, null, 1) + '\n');
  console.log(`wrote ${Object.keys(files).length - Object.keys(priors).length} files from khora ${COMMIT} + ${Object.keys(priors).length} priors from janus ${JANUS_COMMIT} · shims kept: ${rows.filter((r) => r.keepShim).map((r) => r.rel).join(', ') || 'none'}`);
}
