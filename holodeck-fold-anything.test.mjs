// node --test holodeck-fold-anything.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { wholeSentence, isTellingItself, foldAnything, splitSentences } from './holodeck-fold-anything.js';

test('the grammar gate keeps whole sentences and trims only edge debris', () => {
  assert.deepEqual(wholeSentence('” Sónya, Natásha and the old count were all hugging him in the room.'), { ok: true, line: 'Sónya, Natásha and the old count were all hugging him in the room.' });
  assert.equal(wholeSentence('“Attendez,” said Anna Pávlovna, reflecting on it all.').ok, true);   // an opening quote is the sentence's own
  assert.equal(wholeSentence('and then the council voted to audit the lease.').why, 'does not open a sentence');
  assert.equal(wholeSentence('The council voted to audit the lease and').why, 'does not close a sentence');
  assert.equal(wholeSentence('He said “we will audit the lease next year.').why, 'its quotation marks do not balance');
  assert.equal(wholeSentence('The rent (as reported rose by twelve percent.').why, 'its brackets do not balance');
  assert.equal(wholeSentence('WATER DEPARTMENT LEASE AUDIT REPORT SUMMARY.').why, 'a heading, not a sentence');
  assert.equal(wholeSentence('Yes.').ok, false);
});

test('Houdini folds out the text talking about itself', () => {
  assert.equal(isTellingItself('In this article we describe the lease audit.'), true);
  assert.equal(isTellingItself('See below for the full vote count.'), true);
  assert.equal(isTellingItself('The council voted 30 to 8 to audit the lease.'), false);
});

// a small analysis in the page's shape: statements with doc, byte span, names, figures
function analysis(docs) {
  const sts = []; let id = 0;
  for (const [doc, lines] of Object.entries(docs)) {
    let s = 0;
    for (const [text, names = [], figs = []] of lines) { sts.push({ id: 'st' + id++, doc, text, s, e: s + text.length, names, figs }); s += text.length + 1; }
  }
  const stsByDoc = {}; for (const st of sts) (stsByDoc[st.doc] = stsByDoc[st.doc] || []).push(st);
  return { sts, stsByDoc, byId: Object.fromEntries(sts.map((s) => [s.id, s])) };
}
const A = analysis({
  minutes: [
    ['The Metro Council met on October 6, 2026, at the Historic Courthouse.', ['Metro Council', 'Historic Courthouse']],
    ['Council member Ana Smith proposed a review of the Water Department lease.', ['Ana Smith', 'Water Department']],
    ['In this report we summarise the meeting for residents.', []],
    ['” The Water Department leases its office from Harbor Holdings.', ['Water Department', 'Harbor Holdings']],
    ['Harbor Holdings raised the rent by 12 percent in 2025.', ['Harbor Holdings'], [{ unit: 'percent', v: 12 }]],
    ['and the vice mayor asked about the timeline', ['Vice Mayor']],
    ['The council voted 30 to 8 to audit the lease.', ['Metro Council'], [{ unit: 'votes', v: 30 }]],
  ],
  memo: [
    ['Harbor Holdings said the increase followed a property tax reassessment.', ['Harbor Holdings']],
    ['The Finance Director will report the audit results in January.', ['Finance Director']],
    ['It was a long night.', []],
  ],
});

test('the fold of a two-source scope: whole sentences only, every line traced, in source order', () => {
  const F = foldAnything(A, A.sts, { size: 4, docOrder: ['minutes', 'memo'] });
  assert.equal(F.ok, true);
  assert.equal(F.lines.length, 4);
  for (const l of F.lines) {
    assert.equal(wholeSentence(l.text).ok, true, l.text);
    const st = A.byId[l.id];
    assert.ok(st.text.includes(l.text), 'every line is the source’s own words: ' + l.text);   // never reworded
  }
  const pos = F.lines.map((l) => (l.doc === 'minutes' ? 0 : 1000) + l.s);
  assert.deepEqual(pos, pos.slice().sort((a, b) => a - b));   // the sources' own order
  assert.ok(!F.lines.some((l) => /this report|long night|vice mayor asked/.test(l.text)));
  assert.ok(F.scope.beings);
});

test('the debris-trimmed line is offered, and the fragment and the meta line are named in what was folded', () => {
  const F = foldAnything(A, A.sts, { size: 7 });
  assert.ok(F.lines.some((l) => l.text === 'The Water Department leases its office from Harbor Holdings.'));
  const why = Object.fromEntries(F.folded.map((f) => [f.text.slice(0, 12), f.why]));
  assert.ok(Object.values(why).includes('talks about its own telling') || Object.values(why).includes('names no one and states no measure'));
});

test('a scope of two statements is not folded — it says so', () => {
  const F = foldAnything(A, A.sts.slice(0, 2));
  assert.equal(F.ok, false); assert.match(F.note, /Too little here/);
});

test('per grain: a scope with almost no beings is folded by worth alone, not emptied', () => {
  const P = analysis({ paper: [
    ['Attention weights are computed from queries and keys in every layer.'],
    ['The model reaches a higher score after twelve hours of training on eight processors.'],
    ['Recurrence is removed entirely from the architecture described here.'],
    ['Parallel training becomes possible because no step waits on the one before.'],
    ['The approach generalises to parsing with little task-specific tuning.'],
  ] });
  const F = foldAnything(P, P.sts, { size: 3 });
  assert.equal(F.scope.beings, false);
  assert.equal(F.lines.length, 3);
});

test('the splitter keeps byte spans and whole sentences', () => {
  const t = 'The council met. It voted 30 to 8! Did it audit the lease? Yes';
  const S = splitSentences(t);
  assert.deepEqual(S.map((x) => x.text), ['The council met.', 'It voted 30 to 8!', 'Did it audit the lease?', 'Yes']);
  for (const x of S) assert.equal(t.slice(x.s, x.e), x.text);
});

import { speechDebris, clauseCheck, loadGrammar } from './holodeck-fold-anything.js';

test('speech debris: fillers, a word said twice, a bare-number fragment — and "had had" is English', () => {
  assert.equal(speechDebris('Um, this requires only a simple majority on second reading.'), 'a filler or self-correction from speech');
  assert.equal(speechDebris("It's back to you, uh, for a motion."), 'a filler or self-correction from speech');
  assert.equal(speechDebris('And this, this is a substitute recommended by the planning department.'), 'a word said twice in a row');
  assert.equal(speechDebris('2 that specified that specific date of December 16th.'), 'a fragment starting on a bare number');
  assert.equal(speechDebris('A contract for a strategic, excuse me, permanent supportive housing plan was proposed.'), 'a filler or self-correction from speech');
  assert.equal(speechDebris('Excuse me, the council is now in session.'), null);   // an address, not a repair
  assert.equal(speechDebris('She had had enough of the council by then.'), null);
  assert.equal(speechDebris('The council voted 30 to 8 to audit the lease.'), null);
  assert.equal(speechDebris('The umbrella stand was by the door.'), null);   // "um" inside a word is not a filler
});

// Hand-labelled lines from the real material (the 2026-10-06 council transcript and War and Peace):
// true = a grammatical English sentence. The parser must agree on every one.
const LABELLED = [
  [true, 'Motorola Solutions needs to be boycotted in Nashville due to its contracts with the US Immigration and Customs Enforcement, ICE, and Customs and Border Protection, CBP.'],
  [false, 'Next is agenda item 10 ordinance BL 2026 dash one five two zero sponsor Benedict.'],
  [false, 'The Metro code of laws is owning ornaments, the Metro government by changing from CF to SP zoning on property located at 300 McCann Street at the Northwest corner of McCann Street and third Avenue South.'],
  [false, 'The Metro government by changing from RS 10 to our 10 zoning for property located at one eight one two Elizabeth road located approximately 385 feet south of John Millett drive.'],
  [false, 'The last contract with Motorola for ECD expired in 2009 and was.'],
  [false, "Um, uh, special counsel responsive to Miss Gad's request relative to the contract related to Motorola, please, sir."],
  [true, 'Motorola Solutions has received millions from ICE and Motorola Solutions has been described in public reporting as an ICE contractor.'],
  [true, 'The council voted 30 to 8 to audit the lease.'],
  [true, "Pierre had been educated abroad, and this reception at Anna Pávlovna's was the first he had attended in Russia."],
  [true, 'Napoleon led six hundred thousand men into Russia and captured Moscow.'],
  [true, 'Rosenberg said that the contract cannot be used for surveillance.'],
  [false, 'Meeting of the current term of the Metropolitan Council of Nashville and Davidson County.'],
  [true, 'There are 20 meetings remaining in this council term.'],
  [false, 'This is an ordinance to men title 17 the Metro code of laws zoning ordinance the Metro government by changing from IR to MUA and s zoning for property located at one three to six third Avenue North approximately 70 feet south of Taylor Street.'],
];
test('the clause check (the UD parser, no model) agrees with every hand label', async () => {
  const G = await loadGrammar();
  assert.ok(G, 'the parser and its trained model load');
  for (const [want, l] of LABELLED) assert.equal(clauseCheck(G, l).ok && !speechDebris(l), want, l);
});
