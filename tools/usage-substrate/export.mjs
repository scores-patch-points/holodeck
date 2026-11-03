// export.mjs — the shipped record: build.mjs's output trimmed to what the Ask reads (usage-substrate.json at the repo root).
//   node export.mjs <build-out.json> <usage-substrate.json>
import fs from 'node:fs';
const [, , IN, OUT] = process.argv;
const S = JSON.parse(fs.readFileSync(IN, 'utf8'));
const out = { schema: 'UsageSubstrate@1', prereg: S.prereg, head: S.head, docs: S.docs, tokens: S.tokens, giver: S.giver, selectionNull: S.selectionNull,
  licensed: S.licensed.map(([w]) => w), measure: S.measure.map(([w]) => w),
  selects: Object.fromEntries(Object.entries(S.selects).map(([q, v]) => [q, v.map(([w, p, c, at]) => [w, p, c, at])])) };
fs.writeFileSync(OUT, JSON.stringify(out));
console.error('wrote', OUT, Object.keys(out.selects).length, 'question words');
