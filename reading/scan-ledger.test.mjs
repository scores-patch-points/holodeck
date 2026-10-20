import test from 'node:test'; import assert from 'node:assert/strict';
import { EotLedger } from '../vendor/fold-chat/fold-chat-eot.js';
import { recordOcr, recordReading, layerCounts, chainOf } from './scan-ledger.js';
const w = (t, s, x) => ({ t, s, e: s + t.length, b: [x, 10, x + 40, 24], c: 90, line: 0 });
const layout = { engine: 'test', langs: 'eng', pages: [{ n: 1, w: 200, h: 100, image: 'data:image/jpeg;base64,AAAA', words: [w('Name', 0, 5), w('Ada', 5, 60), { ...w('Lovelace', 9, 110), second: 'enlarged' }], lines: [{ s: 0, e: 17, words: [0, 3], b: [5, 10, 150, 24] }], rules: { h: [[0, 5, 200, 6]], v: [], by: 'ink' }, secondLook: 1 }] };
const field = { id: 'fld_1', page: 1, label: 'Name', value: 'Ada Lovelace', format: 'name', conf: 90, s: 0, e: 17, lb: [5, 10, 45, 24], vb: [60, 10, 150, 24] };
test('every layer is an event, and an assertion walks back to the pixels', () => {
  const led = new EotLedger({ artifact: 't' }), src = led.source({ kind: 'document', locator: 'x' }), o = recordOcr(led, src, layout);
  recordReading(led, src, o.pages, { layout, fields: [field], form: { filer: { name: 'Ada Lovelace', basis: 'b', field: 'fld_1' }, voice: null, claims: [{ field: 'fld_1', subject: 'Ada Lovelace', act: 'name', object: 'Ada Lovelace', type: 'name', page: 1, chars: [0, 17], conf: 90 }] } });
  const stages = Object.fromEntries(layerCounts(led)); for (const s of ['pixels', 'ocr', 'ocr-word', 'second-look', 'ink-rules', 'field', 'assert']) assert.ok(stages[s], s);
  const a = led.events.filter((e) => e.stage === 'assert').at(-1), chain = chainOf(led, a.event_id).map((e) => e.stage);
  assert.deepEqual(chain, ['assert', 'field', 'ocr', 'pixels']);
});
test('recording again adds nothing (the ledger dedupes)', () => {
  const led = new EotLedger({ artifact: 't' }), src = led.source({ kind: 'document', locator: 'x' }), o = recordOcr(led, src, layout), run = () => recordReading(led, src, o.pages, { layout, fields: [field] });
  run(); const n = led.events.length; run(); assert.equal(led.events.length, n);
});
