// collector.mjs — receives the raw output of one arm from the page and writes it to eval/e2e/raw/<arm>.json, untouched by any model.
//   node eval/e2e/collector.mjs 8815
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'raw'); fs.mkdirSync(dir, { recursive: true });
http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') { res.end(); return; }
  const arm = new URL(req.url, 'http://x').searchParams.get('arm') || 'unnamed'; if (!/^[a-z0-9-]+$/.test(arm)) { res.statusCode = 400; res.end('bad arm'); return; }
  const chunks = []; req.on('data', (c) => chunks.push(c)); req.on('end', () => { const f = path.join(dir, arm + '.json'); if (fs.existsSync(f) && !/^smoke/.test(arm)) { res.statusCode = 409; res.end('already written: a scored arm is written once'); return; } fs.writeFileSync(f, Buffer.concat(chunks)); res.end('ok ' + f); });
}).listen(Number(process.argv[2] || 8815), '127.0.0.1');
