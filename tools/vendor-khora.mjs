// vendor-khora.mjs — vendor the reading demo's organs from the CANONICAL khora (scores-patch-points/khora) into vendor/khora/,
// and say honestly which files differ from khora (browser shims). vendor/khora/ is the legacy copy; nothing new reads from it.
//
//   node tools/vendor-khora.mjs --plan     list the closure and, per file, identical / shimmed / missing-upstream
//   node tools/vendor-khora.mjs --write    copy khora -> vendor/khora (byte-identical), keeping the shim where eoreader7 had one
//
// The closure is every file reachable from the entry modules through relative imports under vendor/khora/ (the shape khora has:
// native/<dir>/<file>). Files that exist only in vendor/fold-chat/ are another repo's and are left where they are.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KHORA = process.env.KHORA || resolve(ROOT, '../khora');
const OLD = resolve(ROOT, 'vendor/khora');
const NEW = resolve(ROOT, 'vendor/khora');
const JANUS = process.env.JANUS || resolve(ROOT, '../janus');
// priors are DATA the page fetches by path (not imports); their home is janus/priors
const PRIORS = ['pos-eng.json', 'pos-eng-lexicon.json', 'morphology-eng.json', 'reading-rules.json'];
const ENTRIES = ['reading/demo.html', 'reading/how-it-reads.html'];
const IMPORT = /(?:from\s*|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g;

const seen = new Set(), pages = [], old = new Set(), other = new Set();
const walk = (abs) => {
  if (seen.has(abs) || !existsSync(abs)) return;
  seen.add(abs); pages.push(abs);
  if (!/\.(m?js|html)$/.test(abs)) return;
  const src = readFileSync(abs, 'utf8');
  for (const m of src.matchAll(IMPORT)) {
    if (!m[1].startsWith('.')) continue;
    const next = resolve(dirname(abs), m[1]);
    if (next.startsWith(OLD + sep)) old.add(next);
    else if (next.startsWith(ROOT + sep) && /vendor\/(?!eoreader7)/.test(relative(ROOT, next))) other.add(relative(ROOT, next));
    walk(next);
  }
};
if (process.argv.includes('--all')) {
  // every page / module outside vendor/ that reaches the legacy tree (tests and scratch files included only with --tests)
  const { execSync } = await import('node:child_process');
  const withTests = process.argv.includes('--tests');
  const hits = execSync("grep -rlE \"vendor/(eoreader7|khora)\" --include='*.js' --include='*.mjs' --include='*.html' . || true", { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
    .filter((f) => !f.startsWith('./vendor/') && !f.startsWith('./node_modules/') && (withTests || !/\.test\.|\/tests\/|\.scratch|probe-/.test(f)));
  for (const f of hits) walk(resolve(ROOT, f));
  // modules the pages load by a computed name (index.html: base + 'profile-page.js')
  for (const x of ['native/kernel/profile-page.js', 'native/kernel/reality-register.js', 'native/organs/overview.js']) walk(resolve(OLD, x));
} else for (const e of ENTRIES) walk(resolve(ROOT, e));

const rows = [...old].map((abs) => {
  const rel = relative(OLD, abs), up = resolve(KHORA, rel);
  if (!existsSync(abs)) return { rel, has: existsSync(up), same: false, shim: false, missingLocal: true };
  const mine = readFileSync(abs), has = existsSync(up);
  const same = has && Buffer.compare(mine, readFileSync(up)) === 0;
  const shim = /(?:BROWSER|LOCAL) SHIM/.test(mine.toString('utf8'));
  return { rel, has, same, shim };
}).sort((a, b) => (a.rel < b.rel ? -1 : 1));

if (process.argv.includes('--plan')) {
  for (const r of rows) console.log((r.missingLocal ? (r.has ? 'MISSING-LOCAL (in khora)' : 'MISSING-EVERYWHERE') : r.same ? 'identical ' : r.shim ? 'SHIMMED   ' : !r.has ? 'NOT-UPSTREAM' : 'DIFFERS   ') + ' ' + r.rel);
  console.log(`\n${rows.length} files in the closure · ${rows.filter((r) => r.same).length} identical · ${rows.filter((r) => r.shim).length} shimmed · ${rows.filter((r) => !r.has).length} not upstream · ${rows.filter((r) => r.has && !r.same && !r.shim).length} differ`);
  console.log('other vendored trees reached (left in place):', [...other].join(', ') || 'none');
} else if (process.argv.includes('--write')) {
  for (const r of rows) {
    if (r.missingLocal && !r.has) continue;
    const from = r.shim || !r.has || r.missingLocal ? (r.missingLocal ? resolve(KHORA, r.rel) : resolve(OLD, r.rel)) : resolve(KHORA, r.rel); // a shim or a file with no upstream copy is carried as it is
    const to = resolve(NEW, r.rel); mkdirSync(dirname(to), { recursive: true });
    writeFileSync(to, readFileSync(from));
  }
  for (const f of PRIORS) { const to = resolve(NEW, 'native/priors', f); mkdirSync(dirname(to), { recursive: true }); writeFileSync(to, readFileSync(resolve(JANUS, 'priors', f))); }
  // the shim for reading-rules reads its data by path: point it at the new tree
  const rr = resolve(NEW, 'native/kernel/reading-rules.js'); writeFileSync(rr, readFileSync(rr, 'utf8').replaceAll('vendor/khora', 'vendor/khora'));
  // repoint the pages and modules of this closure (never anything under vendor/)
  let n = 0;
  for (const abs of pages) {
    if (abs.startsWith(resolve(ROOT, 'vendor') + sep) || !/\.(m?js|html)$/.test(abs)) continue;
    const t = readFileSync(abs, 'utf8');
    const u = t.replaceAll('vendor/khora', 'vendor/khora').replace(/((?:\.\.\/)+)eoreader7\/native/g, '$1khora/native');
    if (u !== t) { writeFileSync(abs, u); n++; }
  }
  console.log(`wrote ${rows.length} files + ${PRIORS.length} priors under vendor/khora/ · repointed ${n} modules/pages`);
}
