// holodeck-referents-panel.js — "Fix names": rename typos in bulk, and SEG / CON / SYN referents by hand.
// A full-screen activity: the list on the left, the actions in a column that stays in view beside it (above it on a narrow screen).
//
// A thin client of holodeck-referents.js. It draws, collects what a person picks, and files edits into the
// workspace's corrections log through ctx; the app re-reads with the edits applied. Three tabs:
//   Typos   spelling variants the workspace's own null says are too close to be two names; tick, adjust the
//           kept spelling, fold them all at once (SYN). "Not the same" files that they are distinct.
//   Find    search referents by name, alias or near spelling; tick several to SYN (merge / rename) or two to
//           CON (declare a tie); open one to see the spellings folded into it and SEG one out.
//   Log     every edit, revisable: retract or restore, and what no longer applies (and why).
import * as R from './holodeck-referents.js';

const CSS = `
#hd-ref{position:fixed;inset:0;box-sizing:border-box;z-index:56;overflow:auto;background:var(--bg,#0f0e14);color:var(--ink,#ecebf3);
  font:400 14px/1.5 var(--sans,system-ui,sans-serif)}
#hd-ref .r-head{position:sticky;top:0;z-index:2;background:var(--bg,#0f0e14);border-bottom:1px solid var(--line,#2a2833)}
#hd-ref .r-head-in{max-width:1240px;margin:0 auto;padding:16px 24px 12px;display:flex;flex-direction:column;gap:10px}
#hd-ref .r-body{max-width:1240px;margin:0 auto;padding:20px 24px 80px;display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:28px;align-items:start}
#hd-ref .r-mainc{display:flex;flex-direction:column;gap:12px;min-width:0}
#hd-ref .r-side{position:sticky;top:var(--r-head-h,120px);display:flex;flex-direction:column;gap:12px;background:var(--s1,#14131a);border:1px solid var(--line,#2a2833);border-radius:12px;padding:16px}
#hd-ref .r-side h3{margin:0;font:600 11px var(--mono,ui-monospace,monospace);letter-spacing:.08em;text-transform:uppercase;color:var(--mut,#9a97ab)}
#hd-ref .r-side .r-go,#hd-ref .r-side .r-act{width:100%;justify-content:center;display:flex;gap:6px;padding:9px 14px;font-size:14px}
@media (max-width:900px){#hd-ref .r-body{grid-template-columns:minmax(0,1fr);padding:12px 16px 60px}#hd-ref .r-side{order:-1;position:static}#hd-ref .r-head-in{padding:12px 16px 10px}#hd-ref .r-intro{display:none}#hd-ref .r-mainc .r-between{flex-wrap:wrap;gap:2px 10px}}
#hd-ref *{box-sizing:border-box}
#hd-ref h2{margin:0;font:500 22px var(--serif,Georgia,serif)}
#hd-ref .r-mut{color:var(--mut,#9a97ab);font-size:13px;text-wrap:pretty}
#hd-ref .r-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
#hd-ref .r-between{display:flex;justify-content:space-between;align-items:center;gap:10px}
#hd-ref .r-tabs{display:flex;gap:6px}
#hd-ref .r-tab{border:1px solid var(--line2,#34323f);border-radius:999px;padding:4px 12px;background:none;color:var(--ink,#ecebf3);cursor:pointer;font:500 13px var(--sans,system-ui)}
#hd-ref .r-tab.on{background:var(--sel,#2a2550);border-color:var(--acc2,#5b4bd6)}
#hd-ref .r-tab span{font:400 12px var(--mono,ui-monospace,monospace);color:var(--mut,#9a97ab);margin-left:5px}
#hd-ref input[type=text]{background:var(--s2,#1c1b24);border:1px solid var(--line2,#34323f);border-radius:8px;padding:7px 10px;color:var(--ink,#ecebf3);font:500 14px var(--sans,system-ui);outline:none;min-width:0}
#hd-ref input[type=text]:focus{border-color:var(--acc2,#5b4bd6)}
#hd-ref button{cursor:pointer;border-radius:8px;padding:6px 12px;font:600 13px var(--sans,system-ui);border:1px solid var(--line2,#34323f);background:none;color:var(--ink,#ecebf3);white-space:nowrap}
#hd-ref button.r-go{background:var(--acc2,#5b4bd6);border-color:transparent;color:#fff}
#hd-ref button.r-quiet{border-color:transparent;color:var(--mut,#9a97ab);padding:3px 6px;font-weight:500}
#hd-ref button:disabled{opacity:.45;cursor:default}
#hd-ref .r-op{font:600 11px var(--mono,ui-monospace,monospace);letter-spacing:.06em;margin-right:4px;opacity:.85}
#hd-ref .r-list{display:flex;flex-direction:column;border:1px solid var(--line,#2a2833);border-radius:12px;overflow:hidden;background:var(--s1,#14131a)}
#hd-ref .r-chip{border:1px solid var(--line2,#34323f);border-radius:999px;padding:1px 4px 1px 9px;font-size:13px}
#hd-ref .r-typo{display:grid;grid-template-columns:auto minmax(150px,220px) minmax(0,1fr) auto;gap:4px 12px;align-items:start;padding:8px 12px 8px 16px;cursor:pointer}
#hd-ref .r-typo.off{opacity:.55}
@media (max-width:700px){#hd-ref .r-typo{grid-template-columns:auto minmax(0,1fr)}#hd-ref .r-typo .r-ev{grid-column:2}#hd-ref .r-typo button{grid-column:2;justify-self:start}}
#hd-ref .r-item{display:flex;gap:10px;align-items:flex-start;padding:9px 12px;border-top:1px solid var(--line,#2a2833)}
#hd-ref .r-item:first-child{border-top:0}
#hd-ref .r-item.off{opacity:.55}
#hd-ref .r-item input[type=checkbox]{margin-top:4px;accent-color:var(--acc2,#5b4bd6)}
#hd-ref .r-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
#hd-ref .r-name{font-weight:600;overflow-wrap:anywhere;cursor:pointer}
#hd-ref .r-name:hover{color:var(--acc,#8f82ff)}
#hd-ref .r-n{font:400 12px var(--mono,ui-monospace,monospace);color:var(--mut,#9a97ab);white-space:nowrap}
#hd-ref .r-warn{color:var(--amber,#e0a84f);font-size:12.5px}
#hd-ref .r-bad{color:var(--bad,#e5707a)}
#hd-ref .r-wit{font-size:12.5px;color:var(--mut,#9a97ab);padding-left:2px}
#hd-ref .r-wit.for{color:var(--ok,#5fbf8a)}
#hd-ref .r-wit.against{color:var(--amber,#e0a84f)}
#hd-ref .r-verdict{font:600 11px var(--mono,ui-monospace,monospace);letter-spacing:.04em;text-transform:uppercase;margin-right:4px}
#hd-ref .r-v-likely{color:var(--ok,#5fbf8a)} #hd-ref .r-v-contested{color:var(--amber,#e0a84f)} #hd-ref .r-v-doubtful{color:var(--bad,#e5707a)} #hd-ref .r-v-open{color:var(--mut,#9a97ab)}
#hd-ref .r-arrow{color:var(--mut,#9a97ab)}
#hd-ref .r-surf{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:3px 0 3px 10px;border-left:2px solid var(--line2,#34323f)}
`;

let root = null, state = null;
const VERDICT = { likely: 'Likely a typo', contested: 'Witnesses disagree', open: 'Spelling only', doubtful: 'Probably two names' };

export function closeReferentsPanel() { if (root) { root.remove(); root = null; } document.removeEventListener('keydown', onKey); }
function onKey(e) { if (e.key === 'Escape' && root && !(e.target && e.target.tagName === 'INPUT' && e.target.value)) closeReferentsPanel(); }

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pl = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
const pairKey = (a, b) => a < b ? a + '\u0001' + b : b + '\u0001' + a;

/** openReferentsPanel(ctx) — ctx: { getA(), edits(), file(entries[]), revise(id, action), openName(name), toast(msg), workspace } */
export function openReferentsPanel(ctx, { tab = 'typos', q = '' } = {}) {
  if (!document.getElementById('hd-ref-css')) { const st = document.createElement('style'); st.id = 'hd-ref-css'; st.textContent = CSS; document.head.appendChild(st); }
  closeReferentsPanel();
  root = document.createElement('section'); root.id = 'hd-ref'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Fix names');
  document.body.appendChild(root); document.addEventListener('keydown', onKey);
  state = { ctx, tab, q, pick: new Set(), sug: new Map(), open: null, synTo: '', conRel: '', A: null, S: null, nShown: 40 };
  wire(); render();
  if (tab === 'find') setTimeout(() => { const i = root && root.querySelector('#hd-ref-q'); if (i) { i.focus(); i.select(); } }, 0);
}

function data() {
  const A = state.ctx.getA();
  if (A !== state.A) {
    state.A = A;
    // a person's "two names" (distinct) or a hand cut (SEG) is never offered back as a typo
    const live = state.ctx.edits().filter(e => e.status === 'active');
    const skip = new Set([...live.filter(e => e.kind === 'distinct').map(e => pairKey(e.a, e.b)), ...live.filter(e => e.kind === 'seg' && e.of).map(e => pairKey(e.label || e.target, e.of))]);
    state.S = R.suggestions(A, { skip });
    state.groups = R.groupByTarget(state.S.pairs);
    // a fresh suggestion is ticked only on the typo signature (rarer spelling into a more-read one, never read together)
    const next = new Map(); state.S.pairs.forEach(p => { const k = pairKey(p.from, p.to); next.set(k, state.sug.get(k) || { on: p.likely }); }); state.sug = next;
    state.toOf = state.toOf || new Map();
    [...state.pick].forEach(n => { if (!A.names[n]) state.pick.delete(n); });
    if (state.open && !A.names[state.open]) state.open = null;
  }
  return state.A;
}

function render() {
  if (!root) return; const A = data(); const S = state;
  const edits = S.ctx.edits(); const nAct = edits.filter(e => e.status === 'active').length;
  const tabs = [['typos', 'Typos', S.S.pairs.length], ['find', 'Find', Object.keys(A.names).length], ['log', 'Log', nAct]];
  const part = S.tab === 'typos' ? typosHtml(A) : S.tab === 'find' ? findHtml(A) : logHtml(A, edits);
  const h = `<header class="r-head"><div class="r-head-in">
      <div class="r-between"><h2>Fix names</h2><button data-a="close" aria-label="Close and go back">Done</button></div>
      <div class="r-mut r-intro">Rename misspellings in bulk, and say by hand what is one referent (SYN), what should be cut apart (SEG), and what is tied (CON). Every change is kept in this workspace’s log and can be undone.</div>
      <div class="r-tabs" role="tablist">${tabs.map(([k, l, n]) => `<button class="r-tab${S.tab === k ? ' on' : ''}" role="tab" aria-selected="${S.tab === k}" data-a="tab" data-v="${k}">${l}<span>${n}</span></button>`).join('')}</div></div></header>
    <div class="r-body"><div class="r-mainc">${part.main}</div><aside class="r-side" aria-label="Actions">${part.side}</aside></div>`;
  // keep the search box's DOM (and its caret) across renders: React-free, but the same lesson
  const qi = root.querySelector('#hd-ref-q'); const hadFocus = qi && document.activeElement === qi; const sel = qi ? [qi.selectionStart, qi.selectionEnd] : null;
  const scroll = root.scrollTop; root.innerHTML = h; root.scrollTop = scroll;
  const hd = root.querySelector('.r-head'); if (hd) root.style.setProperty('--r-head-h', (hd.offsetHeight + 16) + 'px');
  const q2 = root.querySelector('#hd-ref-q'); if (q2) { q2.value = S.q; if (hadFocus) { q2.focus(); try { q2.setSelectionRange(sel[0], sel[1]); } catch (e) {} } }
}

function typosHtml(A) {
  const S = state; const G = S.groups;
  const kept = S.S.kept ? ` ${pl(S.S.kept, 'pair')} you kept apart ${S.S.kept === 1 ? 'is' : 'are'} not offered again (undo under Log).` : '';
  const capped = S.S.capped ? ` ${pl(S.S.capped, 'short stem')} shared by over 40 names ${S.S.capped === 1 ? 'was' : 'were'} not compared.` : '';
  if (!G.length) return { main: `<div class="r-mut">No near spellings to fold.${kept}${capped}</div>`, side: `<h3>Typos</h3><span class="r-mut">Nothing to fold. Use Find to merge, split or connect names by hand.</span>` };
  const ticked = S.S.pairs.filter(p => S.sug.get(pairKey(p.from, p.to)).on);
  const into = new Set(ticked.map(p => p.to)).size;
  const byV = {}; S.S.pairs.forEach(p => { byV[p.verdict] = (byV[p.verdict] || 0) + 1; });
  let h = `<span class="r-mut">${pl(S.S.pairs.length, 'near spelling')} of ${pl(G.length, 'name')}. The spelling read more often is kept — edit it to rename the name too.${kept}${capped}</span><div class="r-list">`;
  G.slice(0, S.nShown).forEach(g => {
    const to = S.toOf.has(g.to) ? S.toOf.get(g.to) : g.to;
    h += `<div class="r-item" style="flex-direction:column;gap:2px;padding:10px 0 6px">
      <div class="r-row" style="width:100%;padding:0 12px"><span class="r-arrow">keep</span><input type="text" data-a="toName" data-v="${esc(g.to)}" value="${esc(to)}" style="flex:1;max-width:420px" aria-label="Kept spelling for ${esc(g.to)}"><span class="r-n">${pl(g.toN, 'mention')}</span></div>`;
    g.variants.forEach(p => { const k = pairKey(p.from, p.to); const on = S.sug.get(k).on;
      h += `<label class="r-typo${on ? '' : ' off'}">
        <input type="checkbox" data-a="sug" data-v="${esc(k)}" ${on ? 'checked' : ''} aria-label="Fold ${esc(p.from)} into ${esc(to)}">
        <span><span class="r-name" data-a="openName" data-v="${esc(p.from)}">${esc(p.from)}</span><br><span class="r-n">${pl(p.fromN, 'mention')}</span></span>
        <span class="r-main r-ev"><span class="r-mut"><span class="r-verdict r-v-${p.verdict}">${VERDICT[p.verdict]}</span> ${esc(p.why)}</span>
        ${p.witnesses.map(w => `<span class="r-wit ${w.says}">${w.says === 'for' ? '+' : '−'} ${esc(w.why)}</span>`).join('')}${p.witnesses.length ? '' : '<span class="r-wit">nothing beyond the spelling speaks either way</span>'}</span>
        <button class="r-quiet" data-a="distinct" data-v="${esc(k)}" title="File that these are two different names; stop offering this pair">Not the same</button></label>`; });
    h += `</div>`; });
  h += `</div>`;
  if (G.length > S.nShown) h += `<button class="r-quiet" data-a="more">Show ${Math.min(40, G.length - S.nShown)} more</button>`;
  const side = `<h3>Fold ticked spellings</h3>
    <div><b style="font-size:20px">${ticked.length}</b> <span class="r-mut">of ${S.S.pairs.length} ticked${ticked.length ? ', into ' + pl(into, 'name') : ''}</span></div>
    <button class="r-go" data-a="foldSug" ${ticked.length ? '' : 'disabled'}><span class="r-op">SYN</span>Fold ${ticked.length} spelling${ticked.length === 1 ? '' : 's'}</button>
    <div class="r-row" style="gap:4px"><button class="r-quiet" data-a="sugLikely">Tick likely</button><button class="r-quiet" data-a="sugAll">Tick all</button><button class="r-quiet" data-a="sugNone">None</button></div>
    <h3>How a pair is read</h3>
    <span class="r-mut">Small independent witnesses read each pair: the shape of the edit, whether the odd word occurs anywhere else, the company each name keeps, their kind, and whether both are read in one statement. Only pairs where every speaking witness says typo start ticked.</span>
    <span class="r-mut">${['likely', 'contested', 'open', 'doubtful'].filter(v => byV[v]).map(v => `<span class="r-verdict r-v-${v}">${VERDICT[v]}</span> ${byV[v]}`).join(' · ')}</span>`;
  return { main: h, side };
}

function findHtml(A) {
  const S = state; const rows = R.search(A, S.q, { limit: 80 });
  const picked = [...S.pick];
  let h = `<input type="text" id="hd-ref-q" data-a="q" placeholder="Search names, aliases or a misspelling" aria-label="Search referents" autocomplete="off" spellcheck="false" style="font-size:15px;padding:9px 12px">`;
  h += `<div class="r-list">`;
  if (!rows.length) h += `<div class="r-item r-mut">Nothing matches “${esc(S.q)}”.</div>`;
  rows.forEach(r => { const on = S.pick.has(r.name); const open = S.open === r.name;
    h += `<div class="r-item"><input type="checkbox" data-a="pick" data-v="${esc(r.name)}" ${on ? 'checked' : ''} aria-label="Select ${esc(r.name)}">
      <div class="r-main"><div class="r-between"><span class="r-name" data-a="openName" data-v="${esc(r.name)}">${esc(r.name)}</span>
        <span class="r-row" style="gap:4px"><span class="r-n">${pl(r.n, 'mention')} · ${pl(r.docs, 'source')}</span><button class="r-quiet" data-a="toggleOpen" data-v="${esc(r.name)}" aria-expanded="${open}">${open ? 'Close' : 'Spellings'}</button></span></div>
        ${r.aliases.length ? `<span class="r-mut">also ${esc(r.aliases.slice(0, 4).join(', '))}${r.aliases.length > 4 ? ' …' : ''}</span>` : ''}
        ${r.near ? `<span class="r-mut">a near spelling of “${esc(S.q)}”</span>` : ''}
        ${open ? surfHtml(A, r.name) : ''}</div></div>`; });
  h += `</div>`;
  // the action column: SYN for one or more (one = rename), CON for exactly two, SEG from a name's spellings
  const n = picked.length;
  const best = picked.slice().sort((a, b) => (A.names[b].sts.length - A.names[a].sts.length))[0] || '';
  const synTo = S.synTo || best;
  const ties = (A.declaredTies || []).filter(t => picked.includes(t.a) && picked.includes(t.b));
  const side = !n ? `<h3>Selected</h3><span class="r-mut">Tick names in the list.</span>
      <span class="r-mut"><span class="r-op">SYN</span> tick one to rename it, or several to merge them into one name.</span>
      <span class="r-mut"><span class="r-op">CON</span> tick two to say how they are tied.</span>
      <span class="r-mut"><span class="r-op">SEG</span> open a name’s “Spellings” to cut one out.</span>`
    : `<h3>Selected · ${n}</h3><div class="r-row" style="gap:6px">${picked.map(p => `<span class="r-chip">${esc(p)}<button class="r-quiet" data-a="unpick" data-v="${esc(p)}" aria-label="Unselect ${esc(p)}">✕</button></span>`).join('')}</div>
      <h3>${n === 1 ? 'Rename' : 'Merge into one name'}</h3>
      <input type="text" data-a="synTo" value="${esc(synTo)}" aria-label="Name to keep">
      <button class="r-go" data-a="syn"><span class="r-op">SYN</span>${n === 1 ? 'Rename' : 'Merge ' + n + ' names'}</button>
      ${n === 2 ? `<h3>Or connect them</h3><input type="text" data-a="conRel" value="${esc(S.conRel)}" placeholder="is tied to · works for · part of …" aria-label="How they are tied">
      <button class="r-act" data-a="con"><span class="r-op">CON</span>Connect</button>${ties.length ? `<span class="r-mut">Already: ${ties.map(t => esc(t.a + ' ' + t.rel + ' ' + t.b)).join('; ')}</span>` : ''}` : `<span class="r-mut">Tick exactly two to connect them (CON).</span>`}
      <button class="r-quiet" data-a="unpickAll" style="align-self:flex-start">Clear selection</button>`;
  return { main: h, side };
}

function surfHtml(A, name) {
  const sf = R.surfacesOf(A, name);
  if (sf.length < 2) return `<span class="r-mut">Read under one spelling only${sf.length ? ' (“' + esc(sf[0].surface) + '”)' : ''}. To cut by sense, rename it, then merge back what belongs.</span>`;
  return `<div style="display:flex;flex-direction:column;gap:2px;margin-top:4px"><span class="r-mut">Spellings folded into this name:</span>${sf.map(s => `<div class="r-surf"><span>${esc(s.surface)} <span class="r-n">${pl(s.n, 'mention')}</span></span>${s.surface === name ? '<span class="r-n">the name</span>' : `<button class="r-quiet" data-a="seg" data-v="${esc(s.surface)}" data-of="${esc(name)}" title="This spelling is not ${esc(name)}"><span class="r-op">SEG</span>Cut out</button>`}</div>`).join('')}</div>`;
}

function logHtml(A, edits) {
  const done = new Map(((A.referentEdits || {}).skipped || []).map(s => [s.e.id, s.why]));
  const cnt = {}; edits.filter(e => e.status === 'active').forEach(e => { cnt[e.kind] = (cnt[e.kind] || 0) + 1; });
  const side = `<h3>In force</h3>${[['syn', 'SYN', 'merges and renames'], ['seg', 'SEG', 'spellings cut out'], ['distinct', 'SEG', 'pairs kept apart'], ['con', 'CON', 'ties declared'], ['not-name', 'NUL', 'struck as not a name']].filter(([k]) => cnt[k]).map(([k, op, l]) => `<span class="r-mut"><span class="r-op">${op}</span> ${cnt[k]} ${l}</span>`).join('') || '<span class="r-mut">Nothing yet.</span>'}
    <span class="r-mut">Undo takes an edit out; the entry stays on the record and can be restored.</span>`;
  if (!edits.length) return { main: `<div class="r-mut">No changes yet in this workspace.</div>`, side };
  const OP = { syn: 'SYN', seg: 'SEG', con: 'CON', distinct: 'SEG', 'not-name': 'NUL', note: '·' };
  let h = `<div class="r-list">`;
  edits.slice().reverse().forEach(e => { const live = e.status === 'active';
    const line = e.kind === 'distinct' ? '“' + e.a + '” and “' + e.b + '” are two names' : R.sayEdit(e);
    h += `<div class="r-item${live ? '' : ' off'}"><span class="r-op" style="min-width:30px">${OP[e.kind] || '·'}</span><div class="r-main"><span>${esc(line)}</span>
      <span class="r-n">${esc(new Date(e.at).toLocaleString())}${live ? '' : ' · retracted'}</span>${live && done.has(e.id) ? `<span class="r-warn">Not applied: ${esc(done.get(e.id))}</span>` : ''}</div>
      <button class="r-quiet" data-a="${live ? 'retract' : 'restore'}" data-v="${esc(e.id)}">${live ? 'Undo' : 'Restore'}</button></div>`; });
  return { main: h + `</div>`, side };
}

function file(entries, msg) { if (!entries.length) return; state.ctx.file(entries); state.A = null; render(); if (msg) state.ctx.toast(msg); }

function wire() {
  root.addEventListener('input', e => { const t = e.target; const a = t.dataset && t.dataset.a;
    if (a === 'q') { state.q = t.value; render(); }
    else if (a === 'synTo') state.synTo = t.value;
    else if (a === 'conRel') state.conRel = t.value;
    else if (a === 'toName') state.toOf.set(t.dataset.v, t.value); });
  root.addEventListener('keydown', e => { const a = e.target.dataset && e.target.dataset.a; if (e.key !== 'Enter') return;
    if (a === 'synTo') root.querySelector('[data-a=syn]').click(); else if (a === 'conRel') root.querySelector('[data-a=con]').click(); });
  root.addEventListener('change', e => { const t = e.target; const a = t.dataset && t.dataset.a;
    if (a === 'sug') { state.sug.get(t.dataset.v).on = t.checked; render(); }
    else if (a === 'pick') { if (t.checked) state.pick.add(t.dataset.v); else state.pick.delete(t.dataset.v); state.synTo = ''; render(); } });
  root.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b || b.tagName === 'INPUT') return; const a = b.dataset.a, v = b.dataset.v; const S = state;
    if (a === 'close') return closeReferentsPanel();
    if (a === 'tab') { S.tab = v; render(); if (v === 'find') { const i = root.querySelector('#hd-ref-q'); if (i) i.focus(); } return; }
    if (a === 'openName') { e.preventDefault(); S.ctx.openName(v); return; }
    if (a === 'more') { S.nShown += 40; render(); return; }
    if (a === 'sugAll' || a === 'sugNone') { S.sug.forEach(x => { x.on = a === 'sugAll'; }); render(); return; }
    if (a === 'sugLikely') { S.S.pairs.forEach(p => { S.sug.get(pairKey(p.from, p.to)).on = p.likely; }); render(); return; }
    if (a === 'unpickAll') { S.pick.clear(); S.synTo = ''; render(); return; }
    if (a === 'distinct') { e.preventDefault(); const [x, y] = v.split('\u0001'); file([{ kind: 'distinct', a: x, b: y }], 'Kept apart: “' + x + '” and “' + y + '”.'); return; }
    if (a === 'foldSug') {
      const by = new Map(); S.S.pairs.forEach(p => { if (!S.sug.get(pairKey(p.from, p.to)).on) return; (by.get(p.to) || by.set(p.to, []).get(p.to)).push(p.from); });
      const entries = [...by.entries()].map(([to, from]) => { const keep = String(S.toOf.has(to) ? S.toOf.get(to) : to).trim() || to; return { kind: 'syn', from: keep === to ? from : [...from, to], to: keep }; });
      const n = entries.reduce((t, x) => t + x.from.length, 0); S.toOf.clear();
      file(entries, 'Folded ' + pl(n, 'spelling') + ' into ' + pl(entries.length, 'name') + '. Undo under Log.'); return; }
    if (a === 'toggleOpen') { S.open = S.open === v ? null : v; render(); return; }
    if (a === 'unpick') { S.pick.delete(v); S.synTo = ''; render(); return; }
    if (a === 'syn') { const from = [...S.pick]; const to = (S.synTo || from.slice().sort((x, y) => state.A.names[y].sts.length - state.A.names[x].sts.length)[0] || '').trim(); if (!to || !from.length) return;
      if (from.length === 1 && from[0] === to) { S.ctx.toast('That is already its name.'); return; }
      S.pick = new Set([to]); S.synTo = ''; if (S.q && !R.fold(to).includes(R.fold(S.q))) S.q = to;
      file([{ kind: 'syn', from, to, merge: from.length > 1 }], from.length === 1 ? 'Renamed to “' + to + '”.' : 'Merged ' + from.length + ' into “' + to + '”.'); return; }
    if (a === 'con') { const [x, y] = [...S.pick]; const rel = (S.conRel || '').trim() || 'is tied to'; S.conRel = '';
      file([{ kind: 'con', a: x, b: y, rel }], 'Connected: ' + x + ' ' + rel + ' ' + y + '.'); return; }
    if (a === 'seg') { const of = b.dataset.of; file([{ kind: 'seg', target: v, of }], '“' + v + '” is now its own name, apart from “' + of + '”.'); return; }
    if (a === 'retract' || a === 'restore') { S.ctx.revise(v, a); S.A = null; render(); return; }
  });
}

/** Re-render if open (the app calls this when the workspace re-reads). */
export function refreshReferentsPanel() { if (root && state) { state.A = null; render(); } }
