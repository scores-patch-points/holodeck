// m25-build.mjs — M2 and M5 of the reading-holarchy pre-registration, with the reference boundaries each is scored against.
//
//   node reading/eval/holarchy/m25-build.mjs <titanic readings.json> <acorn dir> <out dir>
//
// M2  the eight 1912 Titanic readings of the Holodeck's public sample set. The HTML is the reference tree. The text the finder
//     reads is the HTML with its tags stripped, by one declared rule: every block element (h2, h3, p, table) becomes one block,
//     blocks are separated by a blank line, a <br> is a line break, a table row is a line and its cells are separated by tabs,
//     inline tags are dropped and entities decoded. References: `heading` (h2 and h3 starts), `h2`, `h3`, `block` (the start of
//     every block: p, h2, h3, table), `line` (each <br> line inside a block), `row` and `cell` (the table).
// M5  three source files of this repository read as code, and the data table as CSV. The code reference is an external parser
//     used only as the reference, never as a candidate break type: acorn, every statement start in the program body and in every
//     block or function body (`stmt`), and every block's opening brace (`block`). The CSV reference is its rows and cells.
//
// Offsets are JavaScript string offsets into the text written. Nothing here reads the finder.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const [, , readingsPath, acornDir, outDir] = process.argv;
if (!readingsPath || !acornDir || !outDir) { console.error('usage: node m25-build.mjs <readings.json> <acorn dir> <out dir>'); process.exit(2); }
const require = createRequire(import.meta.url);
const acorn = require(join(acornDir, 'acorn'));
const walk = require(join(acornDir, 'acorn-walk'));
const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const sha = (s) => createHash('sha256').update(s).digest('hex');

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENT[e.toLowerCase()] ?? m));
const inline = (h) => decode(h.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).split('\n').map((l) => l.replace(/\s+/g, ' ').trim());

// ── M2: strip the HTML by the declared rule, recording the reference as it writes ──
function stripHtml(html) {
  let text = '';
  const truth = { heading: [], h2: [], h3: [], block: [], line: [], row: [], cell: [] };
  const sep = () => { if (text) text += '\n\n'; };
  const BLOCK = /<(h2|h3|p|table)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  for (const m of html.matchAll(BLOCK)) {
    const tag = m[1].toLowerCase(), inner = m[2];
    if (tag === 'table') {
      const rows = [...inner.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((r) => [...r[1].matchAll(/<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((c) => inline(c[2]).join(' ').trim()));
      if (!rows.length) continue;
      sep(); truth.block.push(text.length);
      rows.forEach((cells, i) => { if (i) text += '\n'; truth.row.push(text.length); cells.forEach((c, j) => { if (j) text += '\t'; truth.cell.push(text.length); text += c; }); });
      continue;
    }
    const lines = inline(inner).filter((l) => l);
    if (!lines.length) continue;
    sep(); truth.block.push(text.length);
    if (tag === 'h2' || tag === 'h3') { truth.heading.push(text.length); truth[tag].push(text.length); }
    lines.forEach((l, i) => { if (i) text += '\n'; truth.line.push(text.length); text += l; });
  }
  for (const k of Object.keys(truth)) if (!truth[k].length) delete truth[k];
  return { text, truth };
}

// ── M5: code, with acorn's statements as the reference ──
function codeTruth(src) {
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' });
  const stmt = new Set(ast.body.map((n) => n.start)), block = new Set();
  walk.full(ast, (n) => { if (n.type === 'BlockStatement' || n.type === 'StaticBlock' || n.type === 'ClassBody') { block.add(n.start); for (const b of n.body) stmt.add(b.start); } });
  return { stmt: [...stmt].sort((a, b) => a - b), block: [...block].sort((a, b) => a - b) };
}

function csvOf(html) {
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((r) => [...r[1].matchAll(/<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((c) => inline(c[2]).join(' ').trim()));
  let text = ''; const truth = { row: [], cell: [] };
  rows.forEach((cells, i) => { if (i) text += '\n'; truth.row.push(text.length); cells.forEach((c, j) => { if (j) text += ','; truth.cell.push(text.length); text += /[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c; }); });
  return { text, truth };
}

const readings = JSON.parse(readFileSync(readingsPath, 'utf8')).readings;
const manifest = { schema: 'HolarchyM25@1', readings: { path: readingsPath, sha256: sha(readFileSync(readingsPath)) }, acorn: require(join(acornDir, 'acorn', 'package.json')).version, generator: sha(readFileSync(fileURLToPath(import.meta.url))), m2: [], m5: [] };
mkdirSync(join(outDir, 'm2'), { recursive: true }); mkdirSync(join(outDir, 'm5'), { recursive: true });
readings.forEach((r, i) => {
  const id = `m2-${String(i + 1).padStart(2, '0')}-${r.type.toLowerCase().replace(/[^a-z]+/g, '-')}`;
  const { text, truth } = stripHtml(r.html);
  writeFileSync(join(outDir, 'm2', `${id}.txt`), text); writeFileSync(join(outDir, 'm2', `${id}.truth.json`), JSON.stringify(truth));
  manifest.m2.push({ id, title: r.title, sha256: sha(text), levels: Object.fromEntries(Object.entries(truth).map(([k, v]) => [k, v.length])) });
});
for (const rel of ['reading/floor-words.js', 'holodeck-lookup.js', 'reading/look-joins.js']) {
  const src = readFileSync(join(repo, rel), 'utf8'), id = `m5-code-${rel.replace(/[^a-z0-9]+/gi, '-').replace(/-js$/, '')}`, truth = codeTruth(src);
  writeFileSync(join(outDir, 'm5', `${id}.txt`), src); writeFileSync(join(outDir, 'm5', `${id}.truth.json`), JSON.stringify(truth));
  manifest.m5.push({ id, from: rel, sha256: sha(src), levels: { stmt: truth.stmt.length, block: truth.block.length } });
}
{
  const table = readings.find((r) => r.type === 'Data table'), { text, truth } = csvOf(table.html), id = 'm5-csv-numbers-saved';
  writeFileSync(join(outDir, 'm5', `${id}.txt`), text); writeFileSync(join(outDir, 'm5', `${id}.truth.json`), JSON.stringify(truth));
  manifest.m5.push({ id, from: 'Data table reading, as CSV', sha256: sha(text), levels: { row: truth.row.length, cell: truth.cell.length } });
}
const mtext = JSON.stringify(manifest, null, 1);
writeFileSync(join(outDir, 'manifest.json'), mtext);
console.log(JSON.stringify({ m2: manifest.m2.map((x) => [x.id, x.levels]), m5: manifest.m5.map((x) => [x.id, x.levels]), manifestSha256: sha(mtext) }));
