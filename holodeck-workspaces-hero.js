// holodeck-workspaces-hero.js — "Workspaces": every workspace on one screen, and everyone in each of them.
//
// A full-screen surface over the page. Left, every workspace this device keeps, as a card: its name, its sources,
// when it was last opened, and who it is shared with (members, who is here now, invitations still open). Right, the
// one you picked: rename it, open it, delete it, invite people by name, copy or cancel an invitation, rename or
// remove a person.
//
// A thin client, like the People panel (holodeck-people-panel.js): the page hands it its own workspaces and its own
// Matrix session, holodeck-invites.js makes every decision about invitations, and this file draws and calls. It
// reads each shared workspace's people through the SAME engine and the same device store, so a link made here
// shows in the People panel and the other way round. The owner's device lets invited people in: while this screen
// is open it does that for the workspace you picked, as the People panel does for the open one.
import { makeInvites, REFUSE, WORDS } from './holodeck-invites.js';
import { restMatrix, gateCrossing } from './holodeck-rest-matrix.js';
import { deviceKeyring } from './holodeck-vault.js';
import { parseInviteLines } from './holodeck-invite-core.js';
import { sortWorkspaces, summarizeWorkspace, shareLine, totals, headerLine, initials, hueOf, ago, expiresIn, pool } from './holodeck-workspaces-core.js';

const STYLE = `
#hd-wsh{position:fixed;inset:0;z-index:72;background:var(--bg,#17171a);color:var(--ink,#f4f4f6);display:flex;flex-direction:column;
  font:400 14px/1.5 var(--sans,system-ui,sans-serif);overflow:hidden}
#hd-wsh *{box-sizing:border-box}
#hd-wsh button{cursor:pointer;font:600 13px var(--sans,system-ui,sans-serif);border-radius:8px;padding:7px 13px;border:1px solid var(--line2,#3f3f46);background:none;color:var(--ink,#f4f4f6)}
#hd-wsh button:hover{border-color:var(--acc,#8ab4ff)}
#hd-wsh button:disabled{opacity:.5;cursor:default}
#hd-wsh button.go{background:var(--acc2,#8ab4ff);border-color:transparent;color:var(--bg,#17171a)}
#hd-wsh button.quiet{border-color:transparent;color:var(--mut,#9d9da8);padding:5px 8px}
#hd-wsh button.quiet:hover{color:var(--ink,#f4f4f6)}
#hd-wsh button.danger{color:var(--bad,#f87171)}
#hd-wsh button.danger:hover{border-color:var(--bad,#f87171)}
#hd-wsh button.solid-bad{background:var(--bad,#f87171);border-color:transparent;color:#fff}
#hd-wsh input,#hd-wsh textarea{background:var(--s2,#29292e);border:1px solid var(--line2,#3f3f46);border-radius:8px;padding:8px 10px;color:var(--ink,#f4f4f6);
  font:400 14px var(--sans,system-ui,sans-serif);outline:none;min-width:0;width:100%}
#hd-wsh input:focus,#hd-wsh textarea:focus{border-color:var(--acc,#8ab4ff)}
#hd-wsh textarea{min-height:84px;resize:vertical;line-height:1.5}
#hd-wsh .mut{color:var(--mut,#9d9da8)} #hd-wsh .bad{color:var(--bad,#f87171)} #hd-wsh .ok{color:var(--ok,#56d364)}
#hd-wsh .eyebrow{font:600 11px var(--mono,ui-monospace,monospace);letter-spacing:.1em;text-transform:uppercase;color:var(--mut,#9d9da8);margin:0}
#hd-wsh .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
#hd-wsh .between{display:flex;gap:10px;align-items:center;justify-content:space-between}

#hd-wsh .top{flex:none;padding:22px clamp(16px,4vw,48px) 0;display:flex;flex-direction:column;gap:16px;border-bottom:1px solid var(--line,#2e2e33);
  background:radial-gradient(1200px 260px at 10% -40%,color-mix(in srgb,var(--acc,#8ab4ff) 16%,transparent),transparent 70%)}
#hd-wsh .brand{display:flex;align-items:center;gap:10px;font:600 12px var(--mono,ui-monospace,monospace);letter-spacing:.14em;text-transform:uppercase}
#hd-wsh .brand i{width:12px;height:12px;border-radius:3px;background:var(--acc2,#8ab4ff);display:block}
#hd-wsh h1{margin:0;font:500 clamp(28px,4vw,40px)/1.1 var(--serif,Georgia,serif);letter-spacing:-.01em}
#hd-wsh .acct{display:flex;align-items:center;gap:8px;font:500 13px var(--sans,system-ui,sans-serif);color:var(--mut,#9d9da8);min-width:0}
#hd-wsh .acct b{color:var(--ink,#f4f4f6);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#hd-wsh .tools{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding-bottom:16px}
#hd-wsh .tools .search{flex:1 1 240px;max-width:420px}
#hd-wsh .seg{display:flex;border:1px solid var(--line2,#3f3f46);border-radius:8px;overflow:hidden;flex:none}
#hd-wsh .seg button{border:0;border-radius:0;padding:7px 12px;font-weight:500;color:var(--mut,#9d9da8)}
#hd-wsh .seg button[aria-pressed=true]{background:var(--sel2,#30333b);color:var(--ink,#f4f4f6)}
#hd-wsh .newws{display:flex;gap:6px;flex:1 1 260px;max-width:380px;margin-left:auto}

#hd-wsh .body{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(360px,440px)}
#hd-wsh .body.nosel{grid-template-columns:minmax(0,1fr)}
#hd-wsh .gridwrap{overflow:auto;padding:20px clamp(16px,4vw,48px) 48px}
#hd-wsh .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px}
#hd-wsh .card{all:unset;box-sizing:border-box;cursor:pointer;display:flex;flex-direction:column;gap:12px;padding:16px;border-radius:14px;
  background:var(--s1,#1c1c20);border:1px solid var(--line,#2e2e33);min-height:158px;transition:border-color .12s,transform .12s}
#hd-wsh .card:hover{border-color:var(--line2,#3f3f46);transform:translateY(-1px)}
#hd-wsh .card:focus-visible{outline:2px solid var(--acc,#8ab4ff);outline-offset:2px}
#hd-wsh .card[aria-current=true]{border-color:var(--acc,#8ab4ff);box-shadow:0 0 0 1px var(--acc,#8ab4ff) inset}
#hd-wsh .tile{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex:none;
  font:600 14px var(--sans,system-ui,sans-serif);color:#fff;letter-spacing:.02em}
#hd-wsh .tile.big{width:56px;height:56px;border-radius:14px;font-size:19px}
#hd-wsh .cname{font:500 16px/1.3 var(--sans,system-ui,sans-serif);color:var(--ink,#f4f4f6);overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
#hd-wsh .meta{font:400 12.5px var(--sans,system-ui,sans-serif);color:var(--mut,#9d9da8)}
#hd-wsh .share{font:500 13px/1.4 var(--sans,system-ui,sans-serif);color:var(--ink2,#c9c9d2);margin-top:auto}
#hd-wsh .badge{font:600 10.5px var(--mono,ui-monospace,monospace);letter-spacing:.06em;border-radius:4px;padding:1px 6px;flex:none;border:1px solid}
#hd-wsh .badge.open{color:var(--acc,#8ab4ff);border-color:var(--acc2,#8ab4ff)}
#hd-wsh .badge.wait{color:var(--amber,#f0b429);border-color:color-mix(in srgb,var(--amber,#f0b429) 50%,transparent)}
#hd-wsh .faces{display:flex;align-items:center}
#hd-wsh .face{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:600 10.5px var(--sans,system-ui,sans-serif);
  color:#fff;border:2px solid var(--s1,#1c1c20);margin-left:-7px;position:relative;flex:none}
#hd-wsh .face:first-child{margin-left:0}
#hd-wsh .face.here::after{content:'';position:absolute;right:-2px;bottom:-2px;width:9px;height:9px;border-radius:50%;background:var(--ok,#56d364);border:2px solid var(--s1,#1c1c20)}
#hd-wsh .face.more{background:var(--s2,#29292e);color:var(--mut,#9d9da8)}
#hd-wsh .empty{padding:48px 0;color:var(--mut,#9d9da8);font-size:15px}

#hd-wsh .detail{border-left:1px solid var(--line,#2e2e33);background:var(--s1,#1c1c20);overflow:auto;padding:22px 22px 60px;display:flex;flex-direction:column;gap:16px}
#hd-wsh .sec{border:1px solid var(--line,#2e2e33);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:10px;background:var(--bg,#17171a)}
#hd-wsh .sec.bad{border-color:color-mix(in srgb,var(--bad,#f87171) 50%,transparent)}
#hd-wsh .dname{font:500 24px/1.2 var(--serif,Georgia,serif);margin:0;overflow-wrap:anywhere}
#hd-wsh .person{display:flex;align-items:center;gap:10px;padding:6px 0;border-top:1px solid var(--line,#2e2e33)}
#hd-wsh .person:first-of-type{border-top:0}
#hd-wsh .person .face{margin:0;width:32px;height:32px;font-size:12px;border-color:var(--bg,#17171a)}
#hd-wsh .person .face.here::after{border-color:var(--bg,#17171a)}
#hd-wsh .who{flex:1;min-width:0;display:flex;flex-direction:column}
#hd-wsh .who b{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#hd-wsh .who span{font-size:12.5px;color:var(--mut,#9d9da8);overflow-wrap:anywhere}
#hd-wsh .link{font:500 12px var(--mono,ui-monospace,monospace);color:var(--ink2,#c9c9d2);overflow-wrap:anywhere;user-select:all}
#hd-wsh .back{display:none}
#hd-wsh .toast{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);background:var(--ink,#f4f4f6);color:var(--bg,#17171a);border-radius:999px;
  padding:8px 16px;font:500 13px var(--sans,system-ui,sans-serif);pointer-events:none;box-shadow:0 8px 24px rgba(0,0,0,.3)}
#hd-wsh details summary{cursor:pointer;color:var(--mut,#9d9da8);font-size:13px}
@media (max-width:880px){
  #hd-wsh .body{grid-template-columns:minmax(0,1fr)}
  #hd-wsh .body.sel .gridwrap{display:none}
  #hd-wsh .detail{border-left:0}
  #hd-wsh .back{display:inline-flex}
  #hd-wsh .newws{max-width:none;margin-left:0}
}
@media (max-width:520px){#hd-wsh .acct .lbl{display:none}}
`;

const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') n.value = v;
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(String(c)));
  return n;
};
const tint = (id, l = 46) => `hsl(${hueOf(id)} 46% ${l}%)`;
const words = (e) => (e && (e.why || e.message)) || String(e);

// the same device store as the People panel: links made on this device, and its keyring's bookkeeping
const idb = {
  open() { return new Promise((res, rej) => { const r = indexedDB.open('holodeck-people', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  async get(k) { try { const d = await idb.open(); return await new Promise((res) => { const q = d.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result ?? null); q.onerror = () => res(null); }); } catch { return null; } },
  async set(k, v) { const d = await idb.open(); return new Promise((res, rej) => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); },
};
const store = { get: (k) => idb.get(k), set: (k, v) => idb.set(k, v) };
const gateOn = () => { try { return localStorage.getItem('hd:gate') !== 'off'; } catch { return true; } };

let root = null, ctx = null, H = null, timer = null, toastT = null, eng = null;

// ---------------------------------------------------------------- the page's session, and one invite engine for it
const sessionNow = () => { try { const s = ctx.session(); return s && !s.guest && s.token && s.base && s.user ? s : null; } catch { return null; } };
function engine() {
  const s = sessionNow();
  if (!s) { eng = null; return null; }
  if (!eng || eng.token !== s.token || eng.gate !== gateOn()) {
    const mx = restMatrix({ base: s.base, token: s.token, user: s.user });
    const gate = gateOn() ? gateCrossing({ base: s.base, openid: () => mx.getOpenIdToken() }) : null;
    eng = { token: s.token, gate: gateOn(), s, mx, inv: makeInvites({ mx, store, gate, vault: deviceKeyring(s.user) }) };
  }
  return eng;
}
const roomsOf = (id) => { try { const r = ctx.roomsFor(id) || {}; return { priv: r.priv || null, pub: r.pub || null }; } catch { return { priv: null, pub: null }; } };
const listNow = () => { try { return ctx.list() || []; } catch { return []; } };

// ---------------------------------------------------------------- reading
/** Everything the screen shows about one shared workspace. With `admit`, the owner's device also lets people in. */
async function readWorkspace(id, { admit = false } = {}) {
  const e = engine(); const rooms = roomsOf(id);
  if (!e || !rooms.priv) return null;
  const st = await e.mx.roomState(rooms.priv);
  const owner = st.creator === e.s.user;
  const admitted = [];
  if (owner && admit) { for (const r of await e.inv.sweep({ rooms })) { if (r.state === 'admitted') admitted.push(r.name); if (r.state === 'blocked') H.blocked = { ...r.blocked, name: r.name, id }; } }
  const vault = (await e.inv.status({ rooms }).catch(() => ({ vault: 'new' }))).vault;
  const people = vault === 'locked' ? [] : await e.inv.people({ rooms });
  const outstanding = owner ? await e.inv.outstanding({ rooms }) : [];
  const online = await e.inv.presence({ rooms }).catch(() => []);
  return { rooms, owner, vault, people, outstanding, online, admitted, summary: summarizeWorkspace({ people, outstanding, online, owner, vault }) };
}
async function readAll() {
  const shared = listNow().filter((w) => roomsOf(w.id).priv);
  if (!engine() || !shared.length) { draw(); return; }
  const got = await pool(shared, 4, (w) => readWorkspace(w.id, { admit: w.id === H.sel }));
  shared.forEach((w, i) => {
    const r = got[i];
    if (r.ok && r.value) { H.sums[w.id] = r.value.summary; H.reads[w.id] = r.value; for (const n of r.value.admitted) say(`${n} joined ${w.name}.`); }
    else if (!r.ok) H.sums[w.id] = { error: words(r.error) };
  });
  draw();
}
async function readSelected() {
  if (!H.sel || !roomsOf(H.sel).priv || !engine()) return;
  try {
    const r = await readWorkspace(H.sel, { admit: true });
    if (r) {
      H.sums[H.sel] = r.summary; H.reads[H.sel] = r; for (const n of r.admitted) say(`${n} joined.`);
      if (r.owner && H.made[H.sel]) { const open = new Set(r.outstanding.map((o) => o.door)); H.made[H.sel] = H.made[H.sel].filter((m) => !m.ok || open.has(m.door)); }   // a used or cancelled link is not one to send
    }
  } catch (e) { H.sums[H.sel] = { error: words(e) }; }
  draw();
}

// ---------------------------------------------------------------- opening and closing
export function openWorkspacesHero(pageCtx = {}) {
  ctx = pageCtx;
  if (!document.getElementById('hd-wsh-style')) { const st = el('style', { id: 'hd-wsh-style' }); st.textContent = STYLE; document.head.append(st); }
  if (root) root.remove();
  H = { q: '', sort: 'recent', sel: ctx.select || null, sums: {}, reads: {}, busy: '', error: '', made: {}, edit: null, draft: '', personEdit: null, ask: null, newName: '', joinOpen: false, blocked: null };
  root = el('div', { id: 'hd-wsh', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Workspaces' });
  document.body.append(root);
  document.addEventListener('keydown', onKey);
  buildTop();
  root.append(el('div', { class: 'body nosel' }, el('div', { class: 'gridwrap' }), el('aside', { class: 'detail', 'aria-label': 'Workspace' })));
  draw();
  readAll().catch(() => {});
  clearInterval(timer);
  timer = setInterval(() => { if (!H.busy && document.visibilityState !== 'hidden') readSelected().catch(() => {}); }, 6000);
  setTimeout(() => { const n = root && root.querySelector('.search'); if (n) n.focus({ preventScroll: true }); }, 30);
}
export function closeWorkspacesHero() {
  clearInterval(timer); timer = null;
  document.removeEventListener('keydown', onKey);
  if (root) { root.remove(); root = null; }
  try { ctx && ctx.onClose && ctx.onClose(); } catch { /* the page's own callback */ }
}
function onKey(e) {
  if (e.key !== 'Escape') return;
  if (H.edit || H.personEdit || H.ask) { H.edit = null; H.personEdit = null; H.ask = null; draw(); return; }
  if (H.sel && window.innerWidth <= 880) { select(null); return; }
  closeWorkspacesHero();
}
function say(text) {
  if (!root) return;
  clearTimeout(toastT);
  root.querySelectorAll('.toast').forEach((n) => n.remove());
  const t = el('div', { class: 'toast', role: 'status' }, text); root.append(t);
  toastT = setTimeout(() => t.remove(), 3000);
}
function select(id) {
  H.sel = id; H.edit = null; H.personEdit = null; H.ask = null; H.error = '';
  draw();
  if (id) readSelected().catch(() => {});
  const d = root && root.querySelector('.detail'); if (d) d.scrollTop = 0;
}

// ---------------------------------------------------------------- acting
async function act(label, fn) {
  H.busy = label; H.error = ''; draw();
  try { await fn(); } catch (e) { H.error = words(e); }
  H.busy = ''; await readSelected().catch(() => {}); draw();
}
async function copy(text, label) {
  try { await navigator.clipboard.writeText(text); say(label || 'Copied'); } catch { H.error = 'Your browser would not copy it — select the link and copy it.'; draw(); }
}
function rename(id) {
  const name = String(H.draft || '').trim();
  if (!name) return;
  try { ctx.rename(id, name); } catch (e) { H.error = words(e); }
  H.edit = null; draw(); setTimeout(draw, 60);
}
function createWs() {
  const name = String(H.newName || '').trim() || 'Untitled workspace';
  let id = null;
  try { id = ctx.create(name); } catch (e) { H.error = words(e); }
  H.newName = ''; const n = root.querySelector('#wsh-new'); if (n) n.value = '';
  if (id) { say(`Made “${name}”.`); setTimeout(() => select(id), 60); } else draw();   // the page's state lands on its next render
}
function remove(id) {
  const w = listNow().find((x) => x.id === id);
  try { ctx.remove(id); } catch (e) { H.error = words(e); }
  delete H.sums[id]; delete H.reads[id];
  H.ask = null; if (H.sel === id) H.sel = null;
  say(`Deleted “${(w && w.name) || 'workspace'}” from this device.`);
  draw(); setTimeout(draw, 60);
}
function invite(id) {
  const box = root.querySelector('#wsh-lines');
  const rows = parseInviteLines(box ? box.value : '');
  if (!rows.length) { H.error = 'Type a name, one person per line.'; draw(); return; }
  return act('Making invitations…', async () => {
    const e = engine();
    if (!e) throw new Error('Sign in to Matrix first.');
    let rooms = roomsOf(id);
    if (!rooms.priv) {                                   // a workspace only on this device: give it its private room, as the People panel does
      const N = await import(new URL('./fold-net.js', import.meta.url).href);
      const w = listNow().find((x) => x.id === id);
      const priv = await N.createWorkspace(e.s, { name: 'Fold · ' + String((w && w.name) || 'Workspace') + ' (private)', isPublic: false, config: { v: 1 } });
      ctx.setRoomsFor(id, { priv });
      rooms = roomsOf(id);
    }
    const made = [];
    for (const r of rows) {
      try { const m = await e.inv.invite({ name: r.name, rooms, base: ctx.linkBase() }); made.push({ name: r.name, link: m.link, door: m.door, ok: true }); }
      catch (err) { made.push({ name: r.name, ok: false, error: words(err) }); }
    }
    H.made[id] = made;
    const now = root.querySelector('#wsh-lines'); if (now) now.value = '';   // the box was redrawn while busy: clear the one on screen
    try { ctx.onShared && ctx.onShared(id); } catch { /* presence starts on the page's side */ }
  });
}
const cancel = (id, door, name) => act('Cancelling…', async () => { await engine().inv.revoke({ rooms: roomsOf(id), door }); H.made[id] = (H.made[id] || []).filter((m) => m.door !== door); say(`Cancelled the invitation for ${name}.`); });
const removePerson = (id, user, name) => act('Removing…', async () => { await engine().inv.remove({ rooms: roomsOf(id), user }); H.ask = null; say(`${name} was removed.`); });
const renamePerson = (id, user) => {
  const n = root.querySelector('#wsh-pname'); const name = n ? n.value.trim() : '';
  if (!name) return;
  return act('Saving…', async () => { await engine().inv.setName({ rooms: roomsOf(id), user, name }); H.personEdit = null; });
};
async function copyDeviceLink(id) {
  try { const key = await engine().inv.deviceKey({ rooms: roomsOf(id) }); await copy(ctx.linkBase().replace(/[#?].*$/, '') + '#vault=' + key, 'Copied a device link — treat it like a password.'); }
  catch (e) { H.error = words(e); draw(); }
}

// ---------------------------------------------------------------- drawing
function buildTop() {
  const s = sessionNow();
  const top = el('header', { class: 'top' },
    el('div', { class: 'between' },
      el('div', { class: 'brand' }, el('i'), 'Holodeck'),
      el('div', { class: 'row', style: { flexWrap: 'nowrap', minWidth: 0 } },
        el('div', { class: 'acct', 'data-acct': '' }, s ? [el('span', { class: 'lbl' }, 'Signed in as'), el('b', {}, s.user)] : ['Not signed in', el('button', { class: 'quiet', type: 'button', onClick: () => { closeWorkspacesHero(); try { ctx.onLogin(); } catch { /* the page's own sign-in */ } } }, 'Sign in')]),
        el('button', { class: 'quiet', type: 'button', 'aria-label': 'Close', title: 'Close (Esc)', onClick: closeWorkspacesHero, style: { fontSize: '18px' } }, '✕'))),
    el('div', {},
      el('h1', {}, 'Your workspaces'),
      el('p', { class: 'mut', 'data-summary': '', style: { margin: '6px 0 0' } }, '')),
    el('div', { class: 'tools' },
      el('input', { class: 'search', type: 'search', placeholder: 'Find a workspace…', 'aria-label': 'Find a workspace', onInput: (e) => { H.q = e.target.value; drawGrid(); },
        onKeydown: (e) => { if (e.key === 'Enter') { const first = sortWorkspaces(listNow(), H)[0]; if (first) select(first.id); } } }),
      el('div', { class: 'seg', role: 'group', 'aria-label': 'Sort' }, [['recent', 'Recent'], ['name', 'A–Z'], ['size', 'Largest'], ['people', 'Most people']].map(([k, l]) => el('button', { type: 'button', 'data-sort': k, 'aria-pressed': String(H.sort === k), onClick: () => { H.sort = k; drawTools(); drawGrid(); } }, l))),
      el('div', { class: 'newws' },
        el('input', { id: 'wsh-new', placeholder: 'Name a new workspace', 'aria-label': 'Name for a new workspace', onInput: (e) => { H.newName = e.target.value; }, onKeydown: (e) => { if (e.key === 'Enter') createWs(); } }),
        el('button', { class: 'go', type: 'button', onClick: createWs, style: { whiteSpace: 'nowrap' } }, '＋ New'))));
  root.append(top);
}
function drawTools() { root.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sort === H.sort))); }

function draw() {
  if (!root) return;
  const list = listNow();
  const t = totals(list, H.sums, roomsOf);
  const sum = root.querySelector('[data-summary]');
  if (sum) sum.textContent = headerLine(t) + (sessionNow() ? '' : ' · sign in to see and invite people');
  const body = root.querySelector('.body');
  const has = !!(H.sel && list.some((w) => w.id === H.sel));
  if (!has) H.sel = null;
  body.className = 'body ' + (has ? 'sel' : 'nosel');
  drawGrid();
  drawDetail();
}

function facesNode(s, max = 5) {
  if (!s || !s.ready || !s.faces.length) return null;
  const f = s.faces.slice().sort((a, b) => (b.here - a.here) || (b.owner - a.owner));
  return el('div', { class: 'faces', 'aria-hidden': 'true' },
    f.slice(0, max).map((p) => el('span', { class: 'face' + (p.here ? ' here' : ''), title: p.name + (p.here ? ' · here' : ''), style: { background: tint(p.user, 40) } }, initials(p.name))),
    f.length > max ? el('span', { class: 'face more' }, '+' + (f.length - max)) : null);
}

function drawGrid() {
  const wrap = root.querySelector('.gridwrap');
  const list = sortWorkspaces(listNow(), { q: H.q, sort: H.sort, summaries: H.sums });
  const signed = !!sessionNow();
  const cards = list.map((w) => {
    const rooms = roomsOf(w.id); const s = H.sums[w.id];
    return el('button', { class: 'card', type: 'button', 'data-ws': w.id, 'aria-current': String(H.sel === w.id), onClick: () => select(H.sel === w.id ? null : w.id) },
      el('div', { class: 'row', style: { flexWrap: 'nowrap', alignItems: 'flex-start' } },
        el('span', { class: 'tile', style: { background: tint(w.id) } }, initials(w.name)),
        el('div', { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' } },
          el('span', { class: 'cname' }, w.name),
          el('span', { class: 'meta' }, (w.n === 1 ? '1 source' : (w.n || 0) + ' sources') + ' · ' + ago(w.at))),
        w.current ? el('span', { class: 'badge open' }, 'OPEN') : null),
      el('div', { class: 'between', style: { marginTop: 'auto' } },
        el('span', { class: 'share' }, shareLine({ rooms, summary: s, signedIn: signed })),
        s && s.ready && s.waiting ? el('span', { class: 'badge wait', title: 'Invitations not yet used' }, s.waiting + ' WAITING') : null),
      facesNode(s));
  });
  wrap.replaceChildren(
    cards.length ? el('div', { class: 'grid' }, cards) : el('div', { class: 'empty' }, H.q ? `No workspace matches “${H.q}”.` : 'No workspaces yet — name one above.'),
    el('div', { style: { marginTop: '28px', maxWidth: '640px' } }, joinBox()));
}

function joinBox() {
  if (!H.joinOpen) return el('button', { class: 'quiet', type: 'button', onClick: () => { H.joinOpen = true; drawGrid(); const n = root.querySelector('#wsh-join'); if (n) n.focus(); } }, 'Someone sent you an invitation link? Join with it');
  const go = () => { const n = root.querySelector('#wsh-join'); const v = n ? n.value.trim() : ''; if (!/join=[a-z0-9]{16}/i.test(v)) { H.error = 'That is not an invitation link — it has “#join=” in it.'; drawDetailOrToast(); return; } closeWorkspacesHero(); ctx.joinWithLink(v); };
  return el('div', { class: 'sec' },
    el('p', { class: 'eyebrow' }, 'Join a workspace'),
    el('div', { class: 'row', style: { flexWrap: 'nowrap' } },
      el('input', { id: 'wsh-join', placeholder: 'Paste the invitation link', onKeydown: (e) => { if (e.key === 'Enter') go(); } }),
      el('button', { class: 'go', type: 'button', onClick: go }, 'Join')),
    el('p', { class: 'mut', style: { margin: 0, fontSize: '13px' } }, 'You choose your own sign-in name, password and authenticator; the person who invited you lets you in.'));
}
function drawDetailOrToast() { if (H.sel) drawDetail(); else { say(H.error); H.error = ''; } }

function drawDetail() {
  const pane = root.querySelector('.detail');
  if (!H.sel) { pane.replaceChildren(); return; }
  // keep what is being typed, where the caret is, and the scroll, across a redraw
  const keep = {}; pane.querySelectorAll('input[id],textarea[id]').forEach((n) => { keep[n.id] = n.value; });
  const a = document.activeElement; const focus = a && pane.contains(a) && a.id ? { id: a.id, s: a.selectionStart, e: a.selectionEnd } : null;
  const top = pane.scrollTop;
  pane.replaceChildren(...detail(H.sel));
  for (const [k, v] of Object.entries(keep)) { const n = pane.querySelector('#' + CSS.escape(k)); if (n && v !== '' && n.value === '') n.value = v; }
  if (focus) { const n = pane.querySelector('#' + CSS.escape(focus.id)); if (n) { n.focus({ preventScroll: true }); try { if (focus.s != null) n.setSelectionRange(focus.s, focus.e); } catch { /* not a text field */ } } }
  pane.scrollTop = top;
}

function detail(id) {
  const w = listNow().find((x) => x.id === id);
  if (!w) return [];
  const rooms = roomsOf(id); const r = H.reads[id]; const s = H.sums[id]; const signed = !!sessionNow();
  const out = [];
  out.push(el('button', { class: 'quiet back', type: 'button', onClick: () => select(null) }, '← All workspaces'));

  // name, and what it is
  out.push(el('div', { class: 'row', style: { flexWrap: 'nowrap', alignItems: 'center', gap: '14px' } },
    el('span', { class: 'tile big', style: { background: tint(w.id) } }, initials(w.name)),
    H.edit === id
      ? el('div', { class: 'row', style: { flex: 1, flexWrap: 'nowrap' } },
        el('input', { id: 'wsh-rename', value: H.draft, 'aria-label': 'Name for this workspace', onInput: (e) => { H.draft = e.target.value; }, onKeydown: (e) => { if (e.key === 'Enter') rename(id); } }),
        el('button', { class: 'go', type: 'button', onClick: () => rename(id) }, 'Save'))
      : el('div', { style: { flex: 1, minWidth: 0 } }, el('h2', { class: 'dname' }, w.name), el('div', { class: 'meta' }, (w.n === 1 ? '1 source' : (w.n || 0) + ' sources') + ' · ' + ago(w.at)))));
  out.push(el('div', { class: 'row' },
    w.current ? el('button', { type: 'button', disabled: true }, 'Open now') : el('button', { class: 'go', type: 'button', onClick: () => { closeWorkspacesHero(); ctx.open(id); } }, 'Open'),
    !w.fixed && H.edit !== id ? el('button', { type: 'button', onClick: () => { H.edit = id; H.draft = w.name; draw(); const n = root.querySelector('#wsh-rename'); if (n) { n.focus(); n.select(); } } }, 'Rename') : null,
    H.edit === id ? el('button', { class: 'quiet', type: 'button', onClick: () => { H.edit = null; draw(); } }, 'Cancel') : null));

  if (H.busy) out.push(el('div', { class: 'sec', role: 'status' }, H.busy));
  if (H.error) out.push(el('div', { class: 'sec bad', role: 'alert' }, el('span', { class: 'bad' }, H.error)));
  if (H.blocked && H.blocked.id === id) out.push(blockedSec(H.blocked));

  // people
  if (!signed) {
    out.push(el('div', { class: 'sec' }, el('p', { class: 'eyebrow' }, 'People'),
      el('p', { style: { margin: 0 } }, rooms.priv ? 'Sign in to Matrix to see who is in this workspace and invite people.' : 'Sign in to Matrix to invite people into this workspace.'),
      el('div', {}, el('button', { class: 'go', type: 'button', onClick: () => { closeWorkspacesHero(); ctx.onLogin(); } }, 'Sign in'))));
  } else if (rooms.priv && !r && !(s && s.error)) {
    out.push(el('div', { class: 'sec mut' }, 'Reading who is in it…'));
  } else if (s && s.error && !r) {
    out.push(el('div', { class: 'sec bad' }, el('span', {}, 'Could not read this workspace’s people: ' + s.error)));
  } else {
    if (r && r.vault === 'locked') out.push(el('div', { class: 'sec bad' }, el('span', {}, WORDS.locked)));
    const canInvite = (!rooms.priv || (r && r.owner)) && !(r && r.vault === 'locked');
    if (canInvite) out.push(inviteSec(id, rooms));
    if ((H.made[id] || []).length) out.push(madeSec(id));
    if (r && r.owner && r.outstanding.length) out.push(pendingSec(id, r));
    if (r) out.push(peopleSec(id, r));
    if (rooms.priv && r && !r.owner) out.push(el('p', { class: 'mut', style: { margin: 0, fontSize: '13px' } }, 'Only the person who made this workspace invites or removes people.'));
  }

  // the rest: what is protected, another device, deleting
  out.push(el('details', {}, el('summary', {}, 'What this does and does not protect'),
    el('div', { class: 'mut', style: { fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' } },
      el('p', { style: { margin: 0 } }, WORDS.link), el('p', { style: { margin: 0 } }, WORDS.bearer), el('p', { style: { margin: 0 } }, WORDS.server),
      r && r.vault === 'ready' ? el('div', {}, el('button', { type: 'button', onClick: () => copyDeviceLink(id) }, 'Copy a link to use this workspace on another device')) : null)));
  if (!w.fixed) out.push(deleteSec(id, w, rooms));
  return out;
}

function inviteSec(id, rooms) {
  return el('div', { class: 'sec', 'data-sec': 'invite' },
    el('p', { class: 'eyebrow' }, 'Invite people'),
    el('textarea', { id: 'wsh-lines', placeholder: 'Ana Smith\nBob Jones', 'aria-label': 'Names, one person per line' }),
    el('div', { class: 'row' }, el('button', { class: 'go', type: 'button', disabled: !!H.busy, onClick: () => invite(id) }, 'Make invitations')),
    el('p', { class: 'mut', style: { margin: 0, fontSize: '13px' } }, (rooms.priv ? '' : 'This workspace is only on this device; the first invitation shares it. ') + 'You get a link for each person to send however you like. They choose their own password and authenticator; you never see either.'));
}

function madeSec(id) {
  const made = H.made[id];
  const okOnes = made.filter((m) => m.ok);
  return el('div', { class: 'sec', 'data-sec': 'made' },
    el('div', { class: 'between' }, el('p', { class: 'eyebrow' }, 'Send these'),
      okOnes.length > 1 ? el('button', { class: 'quiet', type: 'button', onClick: () => copy(okOnes.map((m) => m.name + ' — ' + m.link).join('\n'), `Copied ${okOnes.length} links.`) }, 'Copy all') : null),
    made.map((m) => m.ok
      ? el('div', { 'data-made': m.name, style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
        el('div', { class: 'between' }, el('b', { style: { fontWeight: 500 } }, m.name), el('button', { type: 'button', onClick: () => copy(m.link, `Copied ${m.name}’s link.`) }, 'Copy link')),
        el('div', { class: 'link' }, m.link))
      : el('div', { class: 'bad' }, `✕ ${m.name}: ${m.error}`)),
    el('p', { class: 'mut', style: { margin: 0, fontSize: '13px' } }, WORDS.bearer));
}

function pendingSec(id, r) {
  return el('div', { class: 'sec', 'data-sec': 'pending' },
    el('p', { class: 'eyebrow' }, 'Invitations · ' + r.outstanding.length),
    r.outstanding.map((o) => el('div', { class: 'person', 'data-invite': o.name },
      el('span', { class: 'face', style: { background: 'var(--s2)', color: 'var(--mut)' } }, initials(o.name)),
      el('div', { class: 'who' }, el('b', {}, o.name), el('span', { class: o.state === 'expired' ? 'bad' : '' }, o.state === 'expired' ? 'expired — cancel it and make a new one' : 'link not used yet · ' + expiresIn(o.exp))),
      o.link && o.state !== 'expired' ? el('button', { class: 'quiet', type: 'button', onClick: () => copy(o.link, `Copied ${o.name}’s link.`) }, 'Copy link') : null,
      el('button', { class: 'quiet', type: 'button', onClick: () => cancel(id, o.door, o.name) }, 'Cancel'))));
}

function peopleSec(id, r) {
  const here = new Map((r.online || []).map((o) => [o.user, o]));
  const rows = r.people.slice().sort((a, b) => (b.owner - a.owner) || (b.self - a.self) || String(a.name || a.user).localeCompare(String(b.name || b.user)));
  return el('div', { class: 'sec', 'data-sec': 'people' },
    el('p', { class: 'eyebrow' }, 'People · ' + rows.filter((p) => p.joined).length + (r.summary.here.length ? ' · ' + r.summary.here.length + ' here now' : '')),
    rows.length ? rows.map((p) => {
      const o = here.get(p.user); const name = p.name || p.user.replace(/^@|:.*$/g, '');
      const status = p.self ? 'you' : o ? 'here · ' + (o.title || 'looking around') : p.joined ? 'not here now' : 'invited — has not joined';
      const canEdit = r.owner && !p.self && !p.owner;
      const row = el('div', { class: 'person', 'data-user': p.user },
        el('span', { class: 'face' + (o && !p.self ? ' here' : ''), style: { background: tint(p.user, 40) } }, initials(name)),
        el('div', { class: 'who' }, el('b', {}, name, p.owner ? el('span', { class: 'mut', style: { fontWeight: 400 } }, ' · owner') : null), el('span', { title: p.user }, status)),
        canEdit && H.personEdit !== p.user && H.ask !== 'person:' + p.user ? el('button', { class: 'quiet', type: 'button', onClick: () => { H.personEdit = p.user; H.ask = null; draw(); const n = root.querySelector('#wsh-pname'); if (n) { n.focus(); n.select(); } } }, 'Edit') : null);
      if (canEdit && H.personEdit === p.user) {
        return el('div', {}, row, el('div', { class: 'row', style: { flexWrap: 'nowrap', paddingBottom: '8px' } },
          el('input', { id: 'wsh-pname', value: p.name || '', placeholder: 'Their name, as everyone here sees it', onKeydown: (e) => { if (e.key === 'Enter') renamePerson(id, p.user); } }),
          el('button', { type: 'button', onClick: () => renamePerson(id, p.user) }, 'Save'),
          el('button', { class: 'danger', type: 'button', onClick: () => { H.personEdit = null; H.ask = 'person:' + p.user; draw(); } }, 'Remove'),
          el('button', { class: 'quiet', type: 'button', onClick: () => { H.personEdit = null; draw(); } }, '✕')));
      }
      if (canEdit && H.ask === 'person:' + p.user) {
        return el('div', {}, row, el('div', { class: 'sec bad', style: { marginBottom: '8px' } },
          el('span', {}, `Remove ${name}? They are put out of this workspace’s rooms and the workspace key moves on without them, so they cannot read anything written from now on.`),
          el('div', { class: 'row' }, el('button', { class: 'solid-bad', type: 'button', onClick: () => removePerson(id, p.user, name) }, 'Remove ' + name), el('button', { class: 'quiet', type: 'button', onClick: () => { H.ask = null; draw(); } }, 'Keep'))));
      }
      return row;
    }) : el('p', { class: 'mut', style: { margin: 0 } }, 'Just you so far.'));
}

function blockedSec(b) {
  const text = b.why === 'gate-unreachable'
    ? `${b.name} opened their link, but your homeserver’s login gate did not answer, so nobody can be let in until it does.`
    : b.why === 'old-invitation'
      ? `The invitation for ${b.name} was made before the workspace key existed, so it cannot carry it. Cancel it and make a new one.`
      : `${b.name}’s link was opened by an account that has not set up an authenticator (${b.user}), so they were not let in. The invitation is still open for the person it was meant for.`;
  return el('div', { class: 'sec bad' }, el('span', {}, text));
}

function deleteSec(id, w, rooms) {
  const asking = H.ask === 'ws:' + id;
  return el('div', { class: 'sec' + (asking ? ' bad' : ''), 'data-sec': 'delete' },
    el('p', { class: 'eyebrow' }, 'Delete'),
    asking
      ? [el('span', {}, `Delete “${w.name}” and its ${w.n === 1 ? 'source' : (w.n || 0) + ' sources'} from this device?` + (rooms.priv ? ' Its shared rooms are not deleted: people already in it keep what is there. Remove them first to shut them out.' : '')),
        el('div', { class: 'row' }, el('button', { class: 'solid-bad', type: 'button', onClick: () => remove(id) }, 'Delete for good'), el('button', { class: 'quiet', type: 'button', onClick: () => { H.ask = null; draw(); } }, 'Keep'))]
      : el('div', {}, el('button', { class: 'danger', type: 'button', onClick: () => { H.ask = 'ws:' + id; H.personEdit = null; draw(); } }, 'Delete this workspace…')));
}

export const _state = () => H;
export { REFUSE };
