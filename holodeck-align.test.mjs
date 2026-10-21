import test from 'node:test';
import assert from 'node:assert/strict';
import { merge, parsePlain, parseMarkdown, tokens, spoken, matchWords, verdictText } from './holodeck-align.js';

const LINES = ['Good evening and welcome to the regular meeting of the council', 'The first item on the agenda is the approval of the minutes from last month', 'Is there a motion to approve the minutes as presented', 'So moved says councilmember Alvarez', 'Seconded by councilmember Okafor all those in favor say aye', 'The ayes have it the minutes are approved'];
const heardOf = (lines, at = 0, per = 6) => lines.map((t, i) => ({ start: at + i * per, end: at + i * per + per - 0.5, text: t }));

test('spoken strips clocks and speaker labels', () => {
  assert.equal(spoken('[00:12] Chair: Good evening'), 'Good evening');
  assert.deepEqual(tokens('Hello, World — it’s 5!'), ['hello', 'world', 'its', '5']);
});

test('parsePlain reads leading clocks as starts', () => {
  const s = parsePlain('[0:05] Hello there\n[0:09] General Kenobi\n\nplain block');
  assert.equal(s.length, 3); assert.equal(s[0].start, 5); assert.equal(s[1].start, 9); assert.equal(s[2].start, null);
});

test('a faithful transcript lines up and is timed from the audio', () => {
  const r = merge(LINES.map(text => ({ text })), heardOf(LINES, 3));
  assert.equal(r.summary.verdict, 'lines up'); assert.equal(r.summary.ok, 6);
  r.segments.forEach((s, i) => { assert.ok(Math.abs(s.start - (3 + i * 6)) < 1.2, 'seg ' + i + ' at ' + s.start); assert.equal(s.text, LINES[i]); });
});

test('recognizer typos and a dropped word still match', () => {
  const h = heardOf(LINES).map(g => ({ ...g, text: g.text.replace('Alvarez', 'Alvares').replace('minutes', 'minute') }));
  const r = merge(LINES.map(text => ({ text })), h);
  assert.equal(r.summary.verdict, 'lines up');
});

test('a passage that is not in the audio is flagged and interpolated, text kept verbatim', () => {
  const given = [...LINES.slice(0, 3), 'Completely invented paragraph about zoning variances and parking', ...LINES.slice(3)];
  const r = merge(given.map(text => ({ text })), heardOf(LINES));
  const bad = r.segments[3];
  assert.equal(bad.check.status, 'none'); assert.equal(bad.check.timed, 'interpolated'); assert.equal(bad.text, given[3]);
  assert.ok(bad.start >= r.segments[2].end - 0.01 && bad.end <= r.segments[4].start + 0.01);
  assert.equal(r.summary.none, 1);
});

test('speech the transcript left out is reported as unheard, not added', () => {
  const extra = 'Before we begin I would like to remind everyone that the chamber is being recorded and that phones should be silenced during the session';
  const h = heardOf([LINES[0], extra, ...LINES.slice(1)]);
  const r = merge(LINES.map(text => ({ text })), h);
  assert.equal(r.summary.unheard.length, 1); assert.ok(r.summary.unheard[0].words >= 20);
  assert.ok(!r.segments.some(s => s.text.includes('phones')));
});

test('supplied timecodes that run late are measured and replaced', () => {
  const r = merge(LINES.map((text, i) => ({ text, start: 30 + i * 6 })), heardOf(LINES));
  assert.ok(Math.abs(r.summary.offset - 30) < 1.2); assert.equal(r.summary.retimed, 6);
  assert.ok(Math.abs(r.segments[0].start) < 1.2); assert.equal(r.segments[0].check.given, 30);
  assert.match(verdictText(r.summary), /30s late/);
});

test('an unrelated transcript does not line up', () => {
  const r = merge([{ text: 'Call me Ishmael some years ago never mind how long precisely' }, { text: 'having little or no money in my purse and nothing particular' }], heardOf(LINES));
  assert.equal(r.summary.verdict, 'does not line up'); assert.equal(r.summary.none, 2);
});

test('times never run backwards and large inputs finish', () => {
  const words = Array.from({ length: 30000 }, (_, i) => 'w' + ((i * 7919) % 5003));
  const g = []; for (let i = 0; i < words.length; i += 20) g.push({ text: words.slice(i, i + 20).join(' ') });
  const h = []; for (let i = 0; i < words.length; i += 20) h.push({ start: i / 3, end: i / 3 + 6, text: words.slice(i, i + 20).join(' ') });
  const t0 = Date.now(); const r = merge(g, h); assert.ok(Date.now() - t0 < 8000);
  let last = -1; r.segments.forEach(s => { assert.ok(s.start >= last); last = s.start; });
  assert.ok(r.summary.coverage > 0.9);
});

test('markdown: formatting and the title are stripped, the app\'s own export keeps its clocks', () => {
  const md = '---\ntitle: x\n---\n# Council meeting\n\n**[0:05]** Good *evening* and [welcome](http://x) everyone\n\n> **[0:11]** Chair: first item\n\n- [0:20] third point\n\n---\n';
  const s = parseMarkdown(md);
  assert.deepEqual(s.map(x => x.start), [5, 11, 20]);
  assert.equal(s[0].text.replace(/\[0:05\]\s*/, ''), 'Good evening and welcome everyone');
  assert.ok(!s.some(x => /Council meeting|title|\*|http/.test(x.text)));
  assert.equal(merge(s, [{ start: 5, end: 10, text: 'Good evening and welcome everyone' }]).segments[0].check.status, 'ok');
});

test('a transcript can be the reference: timed transcript as heard, plain words get its times', () => {
  const ref = [{ start: 10, end: 16, text: LINES[0] }, { start: 16, end: 22, text: LINES[1] }];
  const r = merge(parsePlain(LINES[0] + '\n\n' + LINES[1]), ref);
  assert.equal(r.summary.verdict, 'lines up'); assert.ok(Math.abs(r.segments[1].start - 16) < 1.5);
  assert.match(verdictText(r.summary, { against: 'the other transcript', found: 'found in it', who: 'the other transcript says', clock: 'its times' }), /the other transcript: 100% of its words were found in it/);
});
