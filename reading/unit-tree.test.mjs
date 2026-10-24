// unit-tree.test.mjs — the finder's mechanics on small hand-made texts (never on the pre-registered material).
import test from 'node:test';
import assert from 'node:assert/strict';
import { candidateTypes, admitTypes, buildTrees, findUnits, blocksOf } from './unit-tree.js';
import { splitSentences } from '../vendor/khora/native/adapters/text/spans.js';
import { scanPunctuation } from './punctuation.js';

const deps = { splitSentences, scanPunctuation };
const typesOf = (text) => Object.fromEntries(candidateTypes(text, deps).map((c) => [c.type, c.units]));

test('blocks are runs of lines between blank lines; a heading is a one-line block that does not end a sentence', () => {
  const t = 'Harbour works\n\nThe pier was built in spring. It was long.\n\nTides\n\nThe tide came in twice a day.';
  assert.equal(blocksOf(t).length, 4);
  const T = typesOf(t);
  assert.deepEqual(T.heading.map(([s]) => t.slice(s, s + 5)), ['Harbo', 'Tides']);
  assert.equal(T.block.length, 4);
  assert.equal(T.sentence.length, 5, 'a heading block is its own sentence to the splitter');
});

test('lists, tables and code are found by their own shapes', () => {
  const t = [
    'Steps to follow today.', '',
    '1. Mix the flour.', '2. Add the water.', '3. Knead the dough.', '',
    'item\tcount\tcost', 'flour\t2\t5', 'salt\t1\t1', '',
    'function a() {', '  const x = 1;', '  return x;', '}', 'function b() {', '  return 2;', '}',
  ].join('\n');
  const T = typesOf(t);
  assert.equal(T.enumerated.length, 3);
  assert.equal(T.row.length, 3);
  assert.equal(T.cell.length, 9);
  assert.deepEqual(T.statement.map(([s]) => t.slice(s, t.indexOf('\n', s))), ['function a() {', 'const x = 1;', 'return x;', 'function b() {', 'return 2;']);
});

test('a block comment does not hide the statement after it', () => {
  const t = '/** a doc\n * comment\n */\nexport function f() {\n  return 1;\n}\nconst y = 2;';
  const T = typesOf(t);
  assert.deepEqual(T.statement.map(([s]) => t.slice(s, s + 6)), ['export', 'return', 'const ']);
});

test('nesting: types that nest share a tree; a quotation that crosses sentences starts another; every unit sits inside its parent', () => {
  const t = 'He said “come here. Now.” Then he left. She said “stay. Please.” He stayed.\n\nThe second block has one sentence.';
  const cands = candidateTypes(t, deps);
  const { trees, placement } = buildTrees(t, cands, new Set(['block', 'sentence', 'word', 'container']));
  const treeOf = (type) => placement.find((p) => p.type === type).tree;
  assert.equal(treeOf('block'), treeOf('sentence'));
  assert.equal(treeOf('sentence'), treeOf('word'));
  assert.notEqual(treeOf('container'), treeOf('sentence'), 'the quotation crosses a sentence boundary');
  for (const tr of trees) {
    const by = new Map(tr.units.map((u) => [u.addr, u]));
    for (const u of tr.units) {
      assert.match(u.addr, /^T\d+:\/\d+(\/\d+)*$/);
      const p = by.get(u.parent);
      if (p) assert.ok(p.s <= u.s && u.e <= p.e, `${u.addr} inside ${p.addr}`);
    }
  }
});

test('(b): paragraphs that keep to their own words are admitted; lines wrapped at a fixed width are not', () => {
  const topics = [['tide', 'harbour', 'pier'], ['flour', 'dough', 'oven'], ['vote', 'council', 'budget'], ['comet', 'orbit', 'telescope'], ['violin', 'concert', 'score'], ['seed', 'soil', 'harvest']];
  const para = (ws, i) => [0, 1, 2].map((j) => `The ${ws[j]} and the ${ws[(j + 1) % 3]} met the ${ws[(j + 2) % 3]} again ${i}.`).join(' ');
  const text = topics.map(para).join('\n\n');
  const blocks = admitTypes(text, candidateTypes(text, deps), deps, { draws: 500 });
  const row = blocks.tests.find((r) => r.type === 'block');
  assert.equal(row.finer, 'sentence');
  assert.equal(row.verdict, 'admitted');
  assert.ok(row.signals.lexical.p < 0.01);
  // the same prose hard-wrapped every 40 characters inside one block: the wraps fall anywhere, so no signal beats the null
  const flat = topics.map(para).join(' ');
  const wrapped = flat.replace(/(.{1,40})(\s|$)/g, '$1\n').trim();
  const lines = admitTypes(wrapped, candidateTypes(wrapped, deps), deps, { draws: 500 }).tests.find((r) => r.type === 'line');
  assert.equal(lines.finer, 'word');
  assert.notEqual(lines.verdict, 'admitted');
});

test('findUnits returns trees, levels and the evidence for each type', () => {
  const r = findUnits('One line here.\n\nAnother line there.\n\nA third one.', deps, { draws: 100 });
  assert.ok(r.trees.length >= 1);
  assert.ok(r.levels.some((l) => l.type === 'sentence'));
  assert.ok(r.evidence.candidates.length >= 3);
  assert.ok(Array.isArray(r.evidence.tests));
});
