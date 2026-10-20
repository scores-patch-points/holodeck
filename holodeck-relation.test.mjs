// holodeck-relation.test.mjs — A FIGURE'S RELATION IS READ FROM ITS OWN CLAUSE, NOT A CORPUS WORD LIST.
//   node --test holodeck-relation.test.mjs
//
// docs/SOURCE-CONTRADICTION-PREREG.md R5. The measurement: an UNSEEN corpus's own casualty verbs ("died", "killed")
// read as a relation through the vendored POS prior alone, with no hand-grown list — while a bare dimension ("feet")
// with no content verb nearby yields NO relation, so the E1 gate (an iceberg's size never folds onto a ship's) holds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const a = src.indexOf('function figureRelation(');
const b = src.indexOf('\nfunction holoTopics(');
assert.ok(a > 0 && b > a, 'figureRelation is findable in index.html');
const { figureRelation } = await import('data:text/javascript,' + encodeURIComponent(src.slice(a, b) + '\nexport { figureRelation };'));

// the vendored POS prior's own heads for the words this measures (pos-eng.json)
const POS = {
  died: { VERB: 14 }, killed: { VERB: 18 }, drowned: { VERB: 9 }, rescued: { VERB: 6 }, saved: { VERB: 5 },
  was: { AUX: 300 }, were: { AUX: 200 }, have: { AUX: 100 }, been: { AUX: 90 },
  feet: { NOUN: 19 }, people: { NOUN: 239 }, person: { NOUN: 69 }, death: { NOUN: 40 }, ship: { NOUN: 90 },
  long: { ADJ: 30 }, high: { ADJ: 22 }, destroyed: { VERB: 9 },
};
const pos = (w) => POS[String(w).toLowerCase().replace(/['’]s$/, '')] || null;

test('the relation is read from the figure\'s own clause VERB (POS), not a corpus word list', () => {
  const win1 = 'More than 3,000 people died and over 80% of the city was destroyed.';
  assert.equal(figureRelation(win1, win1.indexOf('3,000'), pos), 'died', 'an unseen casualty verb is read from grammar');
  const win2 = 'About 500 persons have been killed, a thousand injured, and the property loss will exceed $200,000,000.';
  assert.equal(figureRelation(win2, win2.indexOf('500'), pos), 'killed');
});

test('E1 gate: a bare dimension with only an auxiliary/adjective nearby yields NO relation', () => {
  const win = 'The iceberg was 200 feet high.';
  assert.equal(figureRelation(win, win.indexOf('200'), pos), '', 'an ADJ/AUX near a dimension is not a relation');
  const win2 = 'The ship was 882 feet long.';
  assert.equal(figureRelation(win2, win2.indexOf('882'), pos), '', 'so an iceberg\'s feet never fold onto the ship\'s');
});

test('the NEAREST relation wins: "705 rescued by the Carpathia" reads rescued, not a drowned earlier', () => {
  const win = 'Many were drowned; 705 rescued by the Carpathia.';
  assert.equal(figureRelation(win, win.indexOf('705'), pos), 'rescued');
});

test('with no POS prior, the reader fails open — it guesses no verb at all (the witness list is holoTopics\' own)', () => {
  const win = 'More than 3,000 people died and over 80% of the city was destroyed.';
  assert.equal(figureRelation(win, win.indexOf('3,000'), null), '', 'no prior ⇒ no verb read, never a silent guess');
});

test('a bare counted head noun is not a verb: "700 deaths" reads no relation (a named limit, not a guess)', () => {
  const win = 'The frequently quoted value of 700 deaths is now believed to underestimate the loss.';
  assert.equal(figureRelation(win, win.indexOf('700'), pos), '');
});
