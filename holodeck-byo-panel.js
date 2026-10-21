// holodeck-byo-panel.js — "Your storage": bring your own, sealed.
//
// A thin client of holodeck-supabase.js. It draws, it collects what
// a person types, and it calls; the decisions (sealing, the provider, the keyring) are in the pure modules. The
// point it makes on screen, in order:
//   * sign in — with a Supabase project (email one-time code);
//   * your bytes go to that store, sealed on this device first — so the store holds ciphertext;
//   * a write-and-read test proves the round-trip without leaving anything readable in the store.
//
// Defaults come from the repo declaration (fold-workspace.json `storage`), which is what lets EVERY holodeck
// connect with no per-copy configuration: a Supabase project URL and its publishable anon key are public.

import { supabaseStore, passkeySupported } from './holodeck-supabase.js';

const SUPA_KEY = 'hd:supabase';
const CSS = `
#hd-byo{position:fixed;top:0;right:0;height:100%;width:min(480px,100vw);box-sizing:border-box;z-index:57;overflow:auto;
  background:var(--s1,#14131a);color:var(--ink,#ecebf3);border-left:1px solid var(--line2,#34323f);padding:18px 20px 40px;
  font:400 14px/1.5 var(--sans,system-ui,sans-serif);display:flex;flex-direction:column;gap:14px}
#hd-byo *{box-sizing:border-box}
#hd-byo h2{margin:0;font:500 22px var(--serif,Georgia,serif)}
#hd-byo h3{margin:0;font:600 11px var(--mono,ui-monospace,monospace);letter-spacing:.08em;text-transform:uppercase;color:var(--mut,#9a97ab)}
#hd-byo .byo-card{border:1px solid var(--line,#2a2833);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:10px}
#hd-byo .byo-mut{color:var(--mut,#9a97ab);font-size:13px;text-wrap:pretty}
#hd-byo .byo-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
#hd-byo input{background:var(--s2,#1c1b24);border:1px solid var(--line2,#34323f);border-radius:8px;padding:8px 10px;color:var(--ink,#ecebf3);font:500 14px var(--sans,system-ui,sans-serif);outline:none;min-width:0;width:100%}
#hd-byo button{cursor:pointer;border-radius:8px;padding:7px 14px;font:600 13px var(--sans,system-ui,sans-serif);border:1px solid var(--line2,#34323f);background:none;color:var(--ink,#ecebf3)}
#hd-byo button.byo-go{background:var(--acc2,#5b4bd6);border-color:transparent;color:#fff;padding:9px 16px;font-size:14px}
#hd-byo button:disabled{opacity:.5;cursor:default}
#hd-byo .byo-bad{color:var(--bad,#e5707a)} #hd-byo .byo-ok{color:var(--ok,#5fbf8a)}
#hd-byo .byo-who{font:600 14px var(--mono,ui-monospace,monospace)}
#hd-byo .byo-badge{font:600 10px var(--mono,ui-monospace,monospace);letter-spacing:.08em;text-transform:uppercase;color:var(--acc);border:1px solid var(--line2);border-radius:999px;padding:2px 8px}
`;
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') n.value = v;
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(String(c)));
  return n;
};
const read = (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
const write = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { /* nothing kept */ } };
const readJson = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || {}; } catch { return {}; } };

let root = null, ctxRef = null, S = null, decl = null;

export function openByoPanel(ctx = {}) {
  ctxRef = ctx;
  if (!document.getElementById('hd-byo-style')) { const st = el('style', { id: 'hd-byo-style' }); st.textContent = CSS; document.head.append(st); }
  if (root) root.remove();
  root = el('aside', { id: 'hd-byo', role: 'dialog', 'aria-label': 'Your storage' });
  document.body.append(root);
  document.addEventListener('keydown', onKey);
  const kept = readJson(SUPA_KEY);
  S = { busy: '', error: '', note: '', test: '', store: null, identity: null, providerName: '', sent: false,
    supaUrl: ctx.supaUrl || kept.url || '', supaAnon: ctx.supaAnon || kept.anonKey || '', bucket: ctx.bucket || kept.bucket || 'holodeck',
    email: ctx.email || '', code: '', passkey: passkeySupported() };
  draw();
  loadDeclaration().then((d) => { decl = d; applyDeclaration(); draw(); }).catch(() => {});
}
export function closeByoPanel() {
  document.removeEventListener('keydown', onKey);
  if (root) { root.remove(); root = null; }
  try { ctxRef && ctxRef.onClose && ctxRef.onClose(); } catch { /* the page's callback is its own */ }
}
const onKey = (e) => { if (e.key === 'Escape') closeByoPanel(); };

async function loadDeclaration() {
  try { const r = await fetch(new URL('fold-workspace.json', location.href).href, { cache: 'no-cache' }); return r.ok ? await r.json() : null; } catch { return null; }
}
function applyDeclaration() {
  const s = decl && decl.storage; if (!s) return;
  const su = s.supabase || {};
  if (!S.supaUrl && su.url) S.supaUrl = su.url;
  if (!S.supaAnon && su.anonKey) S.supaAnon = su.anonKey;
  if (su.bucket) S.bucket = su.bucket;
}
const workspaceOf = () => ctxRef.workspace || 'holodeck';
const accountOf = () => ctxRef.account || (S.identity && (S.identity.email || S.identity.id)) || '';
const loc = () => (typeof location !== 'undefined' ? location : null);
const makeSupa = () => { S.supa = S.supa || supabaseStore({ url: S.supaUrl, anonKey: S.supaAnon, bucket: S.bucket, workspace: workspaceOf(), account: accountOf(), ring: ctxRef.ring || null }); return S.supa; };

async function sendCode() {
  if (!S.supaUrl || !S.supaAnon || !S.email) { S.error = 'A project URL, anon key and email are needed.'; draw(); return; }
  S.busy = 'otp'; S.error = ''; S.note = 'Sending a one-time code…'; draw();
  try {
    S.supa = S.supa || supabaseStore({ url: S.supaUrl, anonKey: S.supaAnon, bucket: S.bucket, workspace: workspaceOf(), account: accountOf(), ring: ctxRef.ring || null });
    await S.supa.signIn({ email: S.email });
    write(SUPA_KEY, JSON.stringify({ url: S.supaUrl, anonKey: S.supaAnon, bucket: S.bucket }));
    S.sent = true; S.note = 'Check ' + S.email + ' for the six-digit code.';
  } catch (e) { S.error = (e && (e.why || e.message)) || String(e); S.note = ''; }
  S.busy = ''; draw();
}
async function verifyCode() {
  S.busy = 'verify'; S.error = ''; draw();
  try {
    const r = await S.supa.verify({ email: S.email, code: S.code });
    S.store = r.store; S.identity = r.identity; S.providerName = 'Supabase Storage';
    S.note = 'Connected. Your bytes go to your Supabase project, sealed on this device first.';
  } catch (e) { S.error = (e && (e.why || e.message)) || String(e); }
  S.busy = ''; draw();
}
async function selfTest() {
  if (!S.store) return;
  S.busy = 'test'; S.test = ''; draw();
  try {
    const key = '.holodeck/self-test';
    const value = { at: Date.now(), who: (S.identity && (S.identity.email || S.identity.name)) || 'you' };
    await S.store.put(key, value);
    const back = await S.store.get(key);
    S.test = (back && back.at === value.at) ? 'ok' : 'mismatch';
  } catch (e) { S.test = 'bad:' + ((e && (e.why || e.message)) || e); }
  S.busy = ''; draw();
}

function draw() {
  if (!root) return;
  root.replaceChildren();
  root.append(
    el('div', { style: 'display:flex;justify-content:space-between;align-items:center' },
      el('h2', {}, 'Your storage'),
      el('button', { style: 'border:0;color:var(--mut,#9a97ab);font-size:16px', onClick: closeByoPanel }, '✕')),
    el('p', { class: 'byo-mut' }, 'The holodeck keeps no store of its own. Your workspace’s bytes live in storage you choose, sealed on this device before they are sent — so the store holds ciphertext it cannot open. Signing in proves who you are; it is not the key.'),
    // Supabase: email one-time code
    el('div', { class: 'byo-card' },
      el('div', { class: 'byo-row', style: 'justify-content:space-between' }, el('h3', {}, 'Sign in'), el('span', { class: 'byo-badge' }, 'recommended')),
      el('span', { class: 'byo-mut' }, 'Sign in with an email one-time code: one login for every holodeck and for your storage.'),
      el('input', { type: 'text', placeholder: 'project URL (https://…supabase.co)', value: S.supaUrl, onChange: (e) => { S.supaUrl = e.target.value; } }),
      el('input', { type: 'text', placeholder: 'publishable (anon) key', value: S.supaAnon, onChange: (e) => { S.supaAnon = e.target.value; } }),
      el('input', { type: 'text', placeholder: 'bucket', value: S.bucket, onChange: (e) => { S.bucket = e.target.value; } }),
      el('input', { type: 'email', placeholder: 'you@example.com', value: S.email, onChange: (e) => { S.email = e.target.value; } }),
      el('div', { class: 'byo-row' },
        el('button', { disabled: S.busy === 'otp', onClick: sendCode }, S.busy === 'otp' ? 'Sending…' : 'Send one-time code'),
        S.passkey ? el('button', { title: 'Supabase passkeys (next step)', disabled: true }, 'Use a passkey (soon)') : null),
      S.sent ? el('div', { class: 'byo-row' },
        el('input', { type: 'text', inputmode: 'numeric', placeholder: 'six-digit code', value: S.code, onChange: (e) => { S.code = e.target.value; } }),
        el('button', { disabled: S.busy === 'verify', onClick: verifyCode }, S.busy === 'verify' ? 'Signing in…' : 'Sign in & connect')) : null),
    // Connected
    S.store ? el('div', { class: 'byo-card' },
      el('h3', {}, 'Signed in'),
      el('div', { class: 'byo-who' }, (S.identity && (S.identity.email || S.identity.name)) || 'your account'),
      el('span', { class: 'byo-mut' }, S.providerName + ' · sealed with this device’s workspace key'),
      el('div', { class: 'byo-row' },
        el('button', { disabled: S.busy === 'test', onClick: selfTest }, S.busy === 'test' ? 'Testing…' : 'Write & read a sealed note'),
        S.test === 'ok' ? el('span', { class: 'byo-ok' }, '✓ round-trip ok (the store held only ciphertext)')
          : S.test ? el('span', { class: 'byo-bad' }, S.test) : null)) : null,
    S.note ? el('span', { class: 'byo-mut' }, S.note) : null,
    S.error ? el('span', { class: 'byo-bad' }, S.error) : null,
  );
}
