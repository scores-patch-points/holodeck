// audit-vendor-paths.mjs — every literal vendor/khora/... path a page, module or test names must exist on disk.
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const files = execSync("grep -rlE 'vendor/khora|\\.\\./khora/' --include='*.js' --include='*.mjs' --include='*.html' . || true", { cwd: ROOT, encoding: 'utf8' }).split('\n').filter((f) => f && !f.startsWith('./node_modules') && !f.startsWith('./vendor/fold-chat') && !f.startsWith('./vendor/the-fold'));
const missing = new Map();
for (const f of files) {
  const t = readFileSync(resolve(ROOT, f), 'utf8');
  for (const m of t.matchAll(/vendor\/khora\/[A-Za-z0-9_./-]+\.(?:json|m?js)/g)) if (!existsSync(resolve(ROOT, m[0]))) (missing.get(m[0]) || missing.set(m[0], []).get(m[0])).push(f);
  // relative imports from files that are themselves under vendor/khora or that name ../khora/
  for (const m of t.matchAll(/['"](\.{1,2}\/[^'"\s]+\.(?:json|m?js))['"]/g)) { if (!f.startsWith('./vendor/khora')) continue; const abs = resolve(dirname(resolve(ROOT, f)), m[1]); if (!existsSync(abs)) (missing.get(f + ' -> ' + m[1]) || missing.set(f + ' -> ' + m[1], []).get(f + ' -> ' + m[1])).push(f); }
}
console.log(`${files.length} files name vendor/khora paths · ${missing.size} missing`);
for (const [p, fs] of missing) console.log('  MISSING ' + p + '  (in ' + [...new Set(fs)].slice(0, 3).join(', ') + ')');
