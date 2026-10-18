// holodeck-byo-panel.test.mjs — the panel is a thin client; this checks it mounts, draws the control, and does
// nothing until a client id is given (the decisions live in the tested modules). linkedom stands in for a page.
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

test('the panel mounts, draws both providers, and closes cleanly', async () => {
  const { document } = withDom();
  const M = await import('./holodeck-byo-panel.js');
  M.openByoPanel({ workspace: '!ws:x' });
  const root = document.getElementById('hd-byo');
  assert.ok(root, 'the panel mounted');
  const buttons = [...root.querySelectorAll('button')].map((b) => b.textContent);
  assert.ok(buttons.some((t) => /Send one-time code/.test(t)), 'the email fallback is drawn: ' + buttons.join(', '));
  const g = [...root.querySelectorAll('button')].find((b) => /Continue with Google/.test(b.textContent));
  assert.ok(g, 'Continue with Google is offered');
  assert.ok(g.className.includes('byo-go'), 'Continue with Google is the primary action');
  assert.ok(buttons.some((t) => /Connect Google Drive/.test(t)), 'the Drive option is still available');
  assert.ok(root.querySelector('details'), 'the Drive option is behind an advanced disclosure');
  assert.ok(/Your storage/.test(root.textContent), 'the panel names what it is');
  M.closeByoPanel();
  assert.equal(document.getElementById('hd-byo'), null, 'the panel is removed on close');
});

test('the client id is read from localStorage when the caller gives none', async () => {
  const { document } = withDom();
  localStorage.setItem('hd:google-client-id', 'cid-from-storage');
  const M = await import('./holodeck-byo-panel.js');
  M.openByoPanel({ workspace: '!ws:x' });
  const inputs = [...document.getElementById('hd-byo').querySelectorAll('input')];
  assert.ok(inputs.some((i) => i.value === 'cid-from-storage'), 'the stored client id prefilled');
  M.closeByoPanel();
});
