#!/usr/bin/env node
// check.mjs — what this machine can read with, and the proof that it reads locally.
//
//   node tools/ocr-server/check.mjs                  the eyes and tools found here
//   node tools/ocr-server/check.mjs --offline [--pdf file.pdf] [--page 4]     (default: page 4 of pdfs/titanic-1997.pdf, the first dense page)
//        reads one page with each on-device eye twice: normally, and inside an OS sandbox that DENIES ALL NETWORK.
//        The eye passes if its two readings are identical and the sandbox is shown to block the network.
//        macOS: sandbox-exec.  Linux: unshare -rn (a network namespace with no interface).  Windows: not verified.
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from './proc.mjs';
import { detect } from './engines.mjs';
import { health } from './reader.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SAMPLE = fileURLToPath(new URL('../../pdfs/titanic-1997.pdf', import.meta.url));

if (!process.argv.includes('--offline')) { console.log(JSON.stringify(await health({ force: true }), null, 1)); process.exit(0); }

// how to run a command with the network denied, on this OS
const denied = (cmd, args) => process.platform === 'darwin' ? ['sandbox-exec', ['-p', '(version 1)(allow default)(deny network*)', cmd, ...args]]
  : process.platform === 'linux' ? ['unshare', ['-rn', cmd, ...args]] : null;

const verdict = { platform: process.platform, sandbox: null, eyes: [] };
const probe = denied('curl', ['-sS', '-m', '5', '-o', '/dev/null', 'https://example.com']);
if (!probe) { verdict.sandbox = 'no network-denying sandbox known for ' + process.platform + ' — NOT VERIFIED'; console.log(JSON.stringify(verdict, null, 1)); process.exit(1); }
const direct = await run('curl', ['-sS', '-m', '5', '-o', '/dev/null', 'https://example.com'], { timeout: 15000 });
const blocked = await run(probe[0], probe[1], { timeout: 15000 });
verdict.sandbox = { tool: probe[0], blocksNetwork: blocked.code !== 0, normalNetworkWorked: direct.code === 0 };
if (blocked.code === 0) { verdict.error = 'the sandbox did not block the network, so nothing here proves anything'; console.log(JSON.stringify(verdict, null, 1)); process.exit(1); }
if (blocked.code === -1) { verdict.error = probe[0] + ' could not start: ' + blocked.err.trim(); console.log(JSON.stringify(verdict, null, 1)); process.exit(1); }

const dir = await mkdtemp(join(tmpdir(), 'hd-offline-'));
let allSame = true;
try {
  const pdf = arg('pdf', SAMPLE), img = join(dir, 'page');
  const r = await run('pdftoppm', ['-r', '150', '-f', arg('page', '4'), '-l', arg('page', '4'), '-png', '-singlefile', pdf, img], { timeout: 120000 });
  if (r.code !== 0) throw new Error('could not render ' + pdf + ': ' + r.err.trim());
  const png = img + '.png';
  const { eyes } = await detect({ force: true });
  for (const e of eyes) {
    const normal = (await e.read([png], {}))[0];
    // the same eye, in the sandbox: a one-line script that imports the adapter and prints its reading
    const script = join(dir, 'read-' + e.id + '.mjs');
    await writeFile(script, `import e from ${JSON.stringify(new URL(`./adapters/${e.id === 'vision' ? 'vision-macos' : e.id}.mjs`, import.meta.url).href)};\nconst [r] = await e.read([${JSON.stringify(png)}], {});\nconsole.log(JSON.stringify(r.lines ? r.lines.map((l) => l.t) : r));\n`);
    const [c, a] = denied(process.execPath, [script]);
    const sandboxed = await run(c, a, { timeout: 300000 });
    let lines = null; try { lines = JSON.parse(sandboxed.out.trim().split('\n').pop()); } catch (x) { /* reported below */ }
    const same = !!lines && JSON.stringify(lines) === JSON.stringify((normal.lines || []).map((l) => l.t));
    allSame = allSame && same;
    verdict.eyes.push({ id: e.id, lines: lines ? lines.length : null, identicalWithNetworkDenied: same, ...(lines ? {} : { error: (sandboxed.err || sandboxed.out).trim().slice(0, 300) }) });
  }
} finally { rm(dir, { recursive: true, force: true }).catch(() => {}); }
console.log(JSON.stringify(verdict, null, 1));
process.exit(allSame && verdict.eyes.length ? 0 : 1);
