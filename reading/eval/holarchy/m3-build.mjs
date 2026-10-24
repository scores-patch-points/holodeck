// m3-build.mjs — M3 of the reading-holarchy pre-registration: documents whose units are known because they were built.
//
//   node reading/eval/holarchy/m3-build.mjs <reading-samples dir> <out dir> [seed]
//
// Every document is assembled from clean sentences of the M1 samples, so the words are real prose and the structure is ours.
// The generator records every true boundary at the moment it writes the text; nothing about the truth is inferred afterwards.
//
//   known/      60 documents: sections with a heading line, paragraphs, and (seeded) a numbered or bulleted list, a tab table,
//               an e-mail style quoted block, a code block taken from this repository
//   flat/       20 run-together controls: one known document's sentences joined by single spaces, nothing else (B2)
//
// Offsets are JavaScript string offsets into the document text (UTF-16 code units). A boundary is the offset where a unit starts.
// The sentences come from your own sample files, so the output is written OUTSIDE the repository; only this generator and the
// output's hashes are committed.

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { splitSentences } from '../../../vendor/khora/native/adapters/text/spans.js';

const [, , inDir, outDir, seedArg] = process.argv;
if (!inDir || !outDir) { console.error('usage: node m3-build.mjs <reading-samples dir> <out dir> [seed]'); process.exit(2); }
const SEED = Number(seedArg ?? 20261024);
const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');

// ── a declared PRNG (mulberry32), so every draw is reproducible from the seed ──
function rng(seed) {
  let a = seed >>> 0;
  const next = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)), pick: (xs) => xs[Math.floor(next() * xs.length)], chance: (p) => next() < p };
}

// ── clean sentences from M1: one terminal mark at the end, a capital at the start, no inner ". Capital" that could be a cut ──
const files = readdirSync(inDir).filter((f) => f.endsWith('.txt')).sort();
const sentences = [];
for (const f of files) {
  const text = readFileSync(join(inDir, f), 'utf8');
  for (const s of splitSentences(text)) {
    const t = (typeof s === 'string' ? s : s.text).replace(/\s+/g, ' ').trim();
    if (!/^\p{Lu}/u.test(t) || !/[.!?]$/.test(t)) continue;
    if (/[.!?]["”’)]?\s+\p{Lu}/u.test(t.slice(0, -1))) continue;   // an inner place a splitter could cut
    if (/\t|^[-*>]|^\d+[.)]\s/u.test(t)) continue;                    // nothing that looks like another unit's marker
    if (t.length < 25 || t.length > 260) continue;
    sentences.push({ text: t, file: f });
  }
}

// code blocks: whole top-level functions from this repository's own reading/floor-words.js, by brace matching
const codeSrc = readFileSync(join(repo, 'reading/floor-words.js'), 'utf8');
const codeBlocks = [...codeSrc.matchAll(/^export function [\s\S]*?^}\n/gm)].map((m) => m[0].replace(/\n$/, ''));

// ── a document under construction: text plus the truth recorded as it is written ──
function doc(r) {
  let text = '';
  const truth = {};
  const said = [];                                   // the sentences, in order, as written (the run-together controls reuse them)
  let deck = [];                                     // sentences drawn without replacement inside one document
  const draw = (pool = sentences) => { if (pool !== sentences) return r.pick(pool).text; if (!deck.length) deck = sentences.slice().sort(() => r.next() - 0.5); return deck.pop().text; };
  const mark = (level, at = text.length) => { (truth[level] ??= []).push(at); };
  return {
    get text() { return text; },
    truth, said, draw,
    mark,
    put(s) { text += s; },
  };
}

function prose(D, r, n, { level = 'paragraph' } = {}) {
  D.mark(level);
  for (let i = 0; i < n; i++) {
    if (i) D.put(' ');
    D.mark('sentence');
    const t = D.draw(); D.said.push(t); D.put(t);
  }
}

function heading(D, r) {
  const words = r.pick(sentences).text.replace(/[^\p{L}\p{N}\s'-]/gu, '').split(/\s+/).filter(Boolean);
  const k = r.int(2, 5), start = r.int(0, Math.max(0, words.length - k));
  const h = words.slice(start, start + k).join(' ');
  D.mark('heading');
  D.put(h.charAt(0).toUpperCase() + h.slice(1));
}

function list(D, r) {
  const numbered = r.chance(0.5), n = r.int(3, 5);
  D.mark('paragraph'); D.mark('list');
  for (let i = 0; i < n; i++) {
    if (i) D.put('\n');
    D.mark('item');
    D.put(numbered ? `${i + 1}. ` : '- ');
    D.mark('sentence');
    const t = D.draw(); D.said.push(t); D.put(t);
  }
}

function table(D, r) {
  const rows = r.int(3, 6), cols = 3;
  const labelWords = () => { const w = r.pick(sentences).text.match(/\p{L}{3,}/gu) ?? ['row']; const x = r.pick(w); return x.charAt(0).toUpperCase() + x.slice(1).toLowerCase(); };
  D.mark('paragraph'); D.mark('table');
  for (let i = 0; i < rows; i++) {
    if (i) D.put('\n');
    D.mark('row');
    for (let j = 0; j < cols; j++) {
      if (j) D.put('\t');
      D.mark('cell');
      D.put(j === 0 ? labelWords() : String(r.int(1, 9999)));
    }
  }
}

function quote(D, r) {
  const n = r.int(2, 3);
  D.mark('paragraph'); D.mark('quote');
  for (let i = 0; i < n; i++) {
    if (i) D.put('\n');
    D.mark('qline');
    D.put('> ');
    D.mark('sentence');
    const t = D.draw(); D.said.push(t); D.put(t);
  }
}

function code(D, r) {
  const block = r.pick(codeBlocks);
  D.mark('paragraph'); D.mark('code');
  block.split('\n').forEach((line, i) => { if (i) D.put('\n'); D.mark('cline'); D.put(line); });
}

function known(r) {
  const D = doc(r);
  const sections = r.int(2, 4);
  const extras = [list, table, quote, code].filter(() => r.chance(0.35));
  for (let s = 0; s < sections; s++) {
    if (s) D.put('\n\n');
    D.mark('section');
    heading(D, r);
    const paras = r.int(2, 4);
    for (let p = 0; p < paras; p++) {
      D.put('\n\n');
      prose(D, r, r.int(2, 5));
      if (extras.length && r.chance(0.5)) { D.put('\n\n'); extras.shift()(D, r); }
    }
  }
  while (extras.length) { D.put('\n\n'); extras.shift()(D, r); }
  return D;
}

function flat(from, r) {
  // the known document's sentences only, in order, joined by single spaces: no heading, list, table, quote or code survives
  const D = doc(r);
  from.said.forEach((s, i) => { if (i) D.put(' '); D.mark('sentence'); D.put(s); });
  return D;
}

// ── build, write, hash ──
const r = rng(SEED);
const sets = { known: [], flat: [] };
for (let i = 0; i < 60; i++) sets.known.push(known(r));
for (let i = 0; i < 20; i++) sets.flat.push(flat(sets.known[i * 3], r));

const manifest = { schema: 'HolarchyM3@1', seed: SEED, sentencesAvailable: sentences.length, from: files, generator: createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).digest('hex'), sets: {} };
for (const [name, docs] of Object.entries(sets)) {
  mkdirSync(join(outDir, name), { recursive: true });
  manifest.sets[name] = docs.map((D, i) => {
    const id = `${name}-${String(i + 1).padStart(2, '0')}`;
    writeFileSync(join(outDir, name, `${id}.txt`), D.text);
    writeFileSync(join(outDir, name, `${id}.truth.json`), JSON.stringify(D.truth));
    return { id, sha256: createHash('sha256').update(D.text).digest('hex'), levels: Object.keys(D.truth).filter((k) => Array.isArray(D.truth[k]) && typeof D.truth[k][0] === 'number') };
  });
}
const mtext = JSON.stringify(manifest, null, 1);
writeFileSync(join(outDir, 'manifest.json'), mtext);
console.log(JSON.stringify({ seed: SEED, sentences: sentences.length, codeBlocks: codeBlocks.length, docs: Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, v.length])), manifestSha256: createHash('sha256').update(mtext).digest('hex') }));
