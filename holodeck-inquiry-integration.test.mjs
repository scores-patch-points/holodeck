// holodeck-inquiry-integration.test.mjs — the wiring, proven end to end.
//
// The whole point of the wire: a question an exact local door can answer does
// NOT reach a model. The falsifier is built into the harness — every fetch is
// stubbed to REJECT, so if turn() touches the model path (WebLLM import, Ollama,
// or any network) the test fails loudly instead of quietly passing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Reject every network call: the model path must not be reached. The reader's
// priors are served from the vendored files on disk (the browser fetches the
// same files over HTTP) so the REAL reader runs. Anything else is fatal.
const realFetch = globalThis.fetch;
const localJson = (rel) => { try { return JSON.parse(fs.readFileSync(new URL(rel, import.meta.url), 'utf8')); } catch { return null; } };
globalThis.fetch = async (url, opts) => {
  const u = typeof url === 'string' ? url : String(url?.url ?? url);
  if (/pos-eng\.json/.test(u)) { const j = localJson('./vendor/eoreader7/native/priors/pos-eng.json'); return { ok: !!j, status: j ? 200 : 404, json: async () => j ?? {} }; }
  if (/morphology-eng\.json/.test(u)) { const j = localJson('./vendor/eoreader7/native/priors/morphology-eng.json'); return { ok: !!j, status: j ? 200 : 404, json: async () => j ?? {} }; }
  throw new Error('NETWORK TOUCHED — the Fold should have answered without it: ' + u);
};

const { index, turn, emptyConv } = await import('./holodeck-ask.js');

test('an exact local answer is produced with no model and no egress', async () => {
  const docs = [{
    id: 'france', title: 'France',
    text: 'France is a country in Europe. The capital of France is Paris. It has many museums and a long history.',
  }];
  const IX = index(docs);
  const conv = emptyConv();
  const q = 'Fill in the blank: "The capital of France is ______."';
  const out = await turn(conv, IX, q, { model: 'webllm:none', base: 'http://127.0.0.1:1' });
  assert.equal(out.turn.noModel, true, 'the model must not be asked');
  assert.equal(out.turn.disposition, 'answered-from-fold');
  assert.equal(out.turn.foldInquiry?.schema, 'FoldInquiry@1');
  assert.match(out.turn.answer, /Paris/);
  assert.equal(out.turn.foldInquiry.resources.modelCalls, 0);
  assert.equal(out.turn.foldInquiry.resources.externalRequests, 0);
});

test('Stage D/E run on the REAL reader: composition chains, then withheld (no GIVEN affordance)', async () => {
  const docs = [{
    id: 'd', title: 'd',
    text: 'Alice married Bob in Paris. Bob mentored Carol for years. Carol later led the laboratory in Paris.',
  }];
  const IX = index(docs);
  const conv = emptyConv();
  const q = 'Fill in the blank: "Alice married ______ in Paris."';
  const out = await turn(conv, IX, q, { model: 'webllm:none', base: 'http://127.0.0.1:1' });
  assert.equal(out.turn.noModel, true);
  assert.equal(out.turn.answer.trim().startsWith('Bob'), true);
  const d = out.turn.foldInquiry.derivation;
  assert.equal(d?.schema, 'DerivationWall@1');
  assert.ok(d.chains >= 1, 'a chain forms through the earned shared referent');
  assert.equal(d.licensed, 0, 'nothing is licensed without a GIVEN affordance');
  assert.ok(out.turn.foldInquiry.derivations.every((x) => x.witnesses.length === 0));
});

test('FALSIFIER — a prose ask does NOT short-circuit; it reaches the model path', async () => {
  const docs = [{
    id: 'france', title: 'France',
    text: 'France is a country in Europe. The capital of France is Paris. It has many museums and a long history.',
  }];
  const IX = index(docs);
  const conv = emptyConv();
  const q = 'Explain why the capital of France matters to its people.';
  // Under the no-network harness the model path cannot succeed, so a rejection
  // here is the PROOF the Fold did not answer locally and did attempt the mouth.
  await assert.rejects(
    () => turn(conv, IX, q, { model: 'webllm:none', base: 'http://127.0.0.1:1' }),
  );
});

test.after(() => { globalThis.fetch = realFetch; });
