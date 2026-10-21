// holodeck-byo-panel.test.mjs — the panel is a thin client; this checks it mounts, draws the control, and and offers email one-time-code sign-in (the decisions live in the tested modules). linkedom stands in for a page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';

function withDom() {
  const { window, document } = parseHTML('<!doctype html><html><head></head><body></body></html>');
  const m = new Map();
  globalThis.window = window; globalThis.document = document;
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  return { window, document };
}

test('the panel mounts, draws the email sign-in, offers no Google, and closes cleanly', async () => {
  const { document } = withDom();
  const M = await import('./holodeck-byo-panel.js');
  M.openByoPanel({ workspace: '!ws:x' });
  const root = document.getElementById('hd-byo');
  assert.ok(root, 'the panel mounted');
  const buttons = [...root.querySelectorAll('button')].map((b) => b.textContent);
  assert.ok(buttons.some((t) => /Send one-time code/.test(t)), 'the email fallback is drawn: ' + buttons.join(', '));
  assert.ok(!/Google|Drive/.test(root.textContent), 'no Google or Drive option is drawn');
  assert.ok(/Your storage/.test(root.textContent), 'the panel names what it is');
  M.closeByoPanel();
  assert.equal(document.getElementById('hd-byo'), null, 'the panel is removed on close');
});
