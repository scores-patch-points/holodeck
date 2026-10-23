#!/usr/bin/env node
// to-eot.mjs — a PDF (or image) to an EOT log you can reason over and query, in one pass, on this machine.
//
//   node tools/ocr-server/to-eot.mjs <file.pdf> [--out eot-out] [--max 100000] [--dpi 220] [--policy keep-base|strict] [--no-parse]
//
// 1. reader.mjs reads every page: the text layer where the PDF carries one, the on-device eyes (folded, with the
//    document's own words as the prior) where it does not.
// 2. The text is ingested by EO-terminal's core/eot-ingest.mjs: a hierarchical, content-addressed, append-only log
//    (doc > block > paragraph > sentence), each sentence carrying its EOTRich@1 parse from the Fold's NL -> grammar -> EOT
//    parser. Ingestion is deterministic: the same text gives the same root hash.
// 3. Provenance rides with it. The log header's doc.pages maps every page to its character range in the text and the eye
//    that read it; <name>.reading.json keeps, for every page the pixels were read for, each eye's word count and
//    confidence, the fusion counts, and the words that did not make the reading (with the eye that said them).
//
// EO-terminal is found beside holodeck (../EO-terminal) or at $EO_TERMINAL.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { readDocument } from './reader.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const file = process.argv[2];
if (!file || file.startsWith('--')) { console.error('usage: to-eot.mjs <file.pdf> [--out eot-out] [--max N] [--dpi 220] [--policy keep-base|strict] [--no-parse]'); process.exit(2); }
const EO = resolve(process.env.EO_TERMINAL || fileURLToPath(new URL('../../../EO-terminal/', import.meta.url)));
if (!existsSync(join(EO, 'core/eot-ingest.mjs'))) { console.error('EO-terminal not found at ' + EO + ' — set EO_TERMINAL'); process.exit(2); }
const { ingestDocument, writeLog, readLog } = await import(pathToFileURL(join(EO, 'core/eot-ingest.mjs')).href);

const buf = await readFile(file);
const sha256 = createHash('sha256').update(buf).digest('hex');
const name = basename(file).replace(/\.[^.]+$/, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 60);

// ── 1. read ──────────────────────────────────────────────────────────────────────────────────────────────────────
const t0 = Date.now(); let start = null;
const pages = [], reading = []; let text = '';
await readDocument(buf, { max: Number(arg('max', 100000)), dpi: Number(arg('dpi', 220)), policy: arg('policy', 'keep-base'), pool: 4 }, (e) => {
  if (e.event === 'start') start = e;
  if (e.event !== 'page') return;
  const t = e.text || '', s = text.length; text += t;
  pages.push({ n: e.page, s, e: text.length, eye: e.eye || null, conf: e.conf ?? null, ...(e.error ? { error: e.error } : {}) });
  if (e.witnesses) reading.push({ page: e.page, eye: e.eye, witnesses: e.witnesses, fusion: e.fusion || null, dropped: e.dropped || [], note: e.note || null });
  text += '\n\n';
});
const readMs = Date.now() - t0;

// ── 2. ingest ────────────────────────────────────────────────────────────────────────────────────────────────────
const doc = { id: name, sha256, source: { file: basename(file), bytes: buf.length, pages: start.pages },
  reading: { tool: 'holodeck/tools/ocr-server', engines: start.engines.map((x) => x.id), dpi: start.dpi, policy: arg('policy', 'keep-base'), textLayerPages: start.textLayerPages, scannedPages: start.scannedPages, prior: start.prior },
  pages };
const t1 = Date.now();
const ing = await ingestDocument(text, { doc, parse: !process.argv.includes('--no-parse') });
const ingestMs = Date.now() - t1;

// ── 3. write, read back, check ───────────────────────────────────────────────────────────────────────────────────
const out = resolve(arg('out', 'eot-out')); await mkdir(out, { recursive: true });
const logFile = join(out, name + '.eot.jsonl.zst');
writeLog(logFile, ing);
await writeFile(join(out, name + '.reading.json'), JSON.stringify({ doc: { ...doc, pages: undefined }, pages: reading }, null, 1));
await writeFile(join(out, name + '.text.txt'), text);
const log = readLog(logFile);
const again = await ingestDocument(text, { doc, parse: !process.argv.includes('--no-parse') });
const sent = ing.nodes.filter((n) => n.type === 'sentence'), parsed = sent.filter((n) => n.eot && n.eot.meaning && n.eot.meaning.nodes && n.eot.meaning.nodes.length);
console.log(JSON.stringify({
  file: basename(file), pages: start.pages, textLayerPages: start.textLayerPages, scannedPages: start.scannedPages, engines: start.engines.map((x) => x.id),
  chars: text.length, readSeconds: +(readMs / 1000).toFixed(1), ingestSeconds: +(ingestMs / 1000).toFixed(1),
  nodes: ing.nodes.length, counts: ing.counts, sentencesParsed: parsed.length, of: sent.length,
  log: logFile, logMB: +((await readFile(logFile)).length / 1048576).toFixed(2), rootHash: ing.rootHash, readsBackValid: log.ok, deterministic: again.rootHash === ing.rootHash,
}, null, 1));
