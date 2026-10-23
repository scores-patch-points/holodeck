// proc.mjs — run a program and keep its stderr, so a failure names its reason instead of returning a bare null.
import { spawn } from 'node:child_process';

/** run(cmd, args, { input, timeout, env }) -> { code, out, err }.  code -1: could not start; -2: timed out. */
export const run = (cmd, args = [], { input = null, timeout = 0, env = null } = {}) => new Promise((resolve) => {
  let p;
  try { p = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'], env: env ? { ...process.env, ...env } : process.env }); }
  catch (e) { return resolve({ code: -1, out: '', err: String((e && e.message) || e) }); }
  const o = [], e = []; let timer = null, killed = false;
  if (timeout) timer = setTimeout(() => { killed = true; p.kill('SIGKILL'); }, timeout);
  p.stdout.on('data', (d) => o.push(d)); p.stderr.on('data', (d) => e.push(d));
  p.stdin.on('error', () => {});
  p.on('error', (err) => { clearTimeout(timer); resolve({ code: -1, out: '', err: String((err && err.message) || err) }); });
  p.on('close', (code) => { clearTimeout(timer); resolve({ code: killed ? -2 : code, out: Buffer.concat(o).toString('utf8'), err: Buffer.concat(e).toString('utf8') + (killed ? ' [timed out]' : '') }); });
  p.stdin.end(input == null ? undefined : input);
});

/** have(cmd) -> true when `cmd` starts (any exit code) — a cheap presence probe. */
export const have = async (cmd, args = ['--version']) => (await run(cmd, args, { timeout: 8000 })).code !== -1;
