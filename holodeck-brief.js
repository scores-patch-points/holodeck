// holodeck-brief.js — "In brief": the mechanical fold (holodeck-fold-anything.js) of whatever is
// in view, drawn as one card. No model. The page decides the scope (the workspace, a topic, a
// filter, a folder, everything said about a name) and hands the statements; this file folds them,
// draws the lines, and says what it set aside and why.
//
// Every line is a sentence from the sources, unchanged; clicking it opens the source at that
// sentence. The size is a selection budget: one line, five lines, or the five as three paragraphs.
import { foldAnything, loadGrammar } from './holodeck-fold-anything.js';

const STYLE = `
.hd-brief{border:1px solid var(--line,#2e2e33);border-radius:12px;background:var(--s1,#1c1c20);padding:12px 16px;display:flex;flex-direction:column;gap:8px;max-width:980px}
.hd-brief *{box-sizing:border-box}
.hd-brief .hb-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.hd-brief .hb-title{font:600 11px var(--mono,ui-monospace,monospace);letter-spacing:.1em;text-transform:uppercase;color:var(--acc,#8ab4ff)}
.hd-brief .hb-scope{font:500 13px var(--sans,system-ui,sans-serif);color:var(--mut,#9d9da8);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
.hd-brief .hb-seg{display:flex;border:1px solid var(--line2,#3f3f46);border-radius:8px;overflow:hidden;flex:none}
.hd-brief .hb-seg button{border:0;background:none;color:var(--mut,#9d9da8);font:500 12px var(--sans,system-ui,sans-serif);padding:4px 9px;cursor:pointer}
.hd-brief .hb-seg button[aria-pressed=true]{background:var(--sel2,#30333b);color:var(--ink,#f4f4f6)}
.hd-brief .hb-x{border:0;background:none;color:var(--mut,#9d9da8);cursor:pointer;font:500 13px var(--sans,system-ui,sans-serif);padding:2px 6px}
.hd-brief .hb-lines{display:flex;flex-direction:column;gap:6px;margin:0;padding:0;list-style:none}
.hd-brief .hb-line{all:unset;cursor:pointer;display:block;font:400 15.5px/1.55 var(--serif,Georgia,serif);color:var(--ink,#f4f4f6);text-wrap:pretty;border-left:2px solid var(--line2,#3f3f46);padding:1px 0 1px 12px}
.hd-brief .hb-line:hover{border-left-color:var(--acc,#8ab4ff)}
.hd-brief .hb-line:focus-visible{outline:2px solid var(--acc,#8ab4ff);outline-offset:2px}
.hd-brief .hb-para{margin:0;font:400 15.5px/1.6 var(--serif,Georgia,serif);color:var(--ink,#f4f4f6);text-wrap:pretty}
.hd-brief .hb-foot{font:400 12.5px/1.45 var(--sans,system-ui,sans-serif);color:var(--mut,#9d9da8)}
.hd-brief details summary{cursor:pointer;color:var(--mut,#9d9da8);font:400 12.5px var(--sans,system-ui,sans-serif)}
.hd-brief .hb-why{font:400 12.5px/1.45 var(--sans,system-ui,sans-serif);color:var(--mut,#9d9da8);margin:6px 0 0;padding-left:16px}
.hd-brief .hb-note{font:400 13px/1.5 var(--sans,system-ui,sans-serif);color:var(--ink2,#c9c9d2)}
`;
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(String(c)));
  return n;
};
const pref = { get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* a convenience */ } } };
const plural = (n, one, many = one + 's') => n.toLocaleString() + ' ' + (n === 1 ? one : many);

// A long single source folded whole picks its densest lines, not its story (measured 2026-10-13 on a
// four-hour council transcript: appointments and zoning acreage, not the debate). Say so, and point at
// what does work: a topic or a name.
const LONG_ONE_SOURCE = 1500;

let grammar = null; let grammarState = 'idle';
function ensureGrammar(redraw) {
  if (grammarState !== 'idle') return;
  grammarState = 'loading';
  loadGrammar().then((G) => { grammar = G; grammarState = G ? 'ready' : 'failed'; redraw(); });
}

/**
 * mountBrief(root, { key, scopeLabel, A, sts, onOpen }) — draw (or redraw) the card into `root`.
 * `key` names the scope; the fold is recomputed only when it changes.
 */
export function mountBrief(root, opts) {
  if (!document.getElementById('hd-brief-style')) { const st = el('style', { id: 'hd-brief-style' }); st.textContent = STYLE; document.head.append(st); }
  const state = root.__brief || (root.__brief = { key: null, size: Number(pref.get('hd:brief-size', '5')) || 5, cache: new Map() });
  state.opts = opts;
  const redraw = () => draw(root);
  if (state.key !== opts.key) { state.key = opts.key; state.cache.clear(); }
  ensureGrammar(() => { state.cache.clear(); redraw(); });
  redraw();
}

function foldFor(state) {
  const size = state.size === 3 ? 5 : state.size;
  const k = size + '|' + grammarState;
  if (!state.cache.has(k)) {
    const { A, sts } = state.opts;
    state.cache.set(k, foldAnything(A, sts, { size, grammar }));
  }
  return state.cache.get(k);
}

function draw(root) {
  const state = root.__brief; const o = state.opts;
  if (pref.get('hd:brief-off', '') === '1') {
    root.replaceChildren(el('button', { class: 'hd-chip', type: 'button', onClick: () => { pref.set('hd:brief-off', ''); draw(root); } }, 'Show “In brief”'));
    return;
  }
  let F;
  try { F = foldFor(state); } catch (e) { root.replaceChildren(el('div', { class: 'hd-brief' }, el('span', { class: 'hb-note' }, 'The brief could not be folded: ' + ((e && e.message) || e)))); return; }
  const seg = el('div', { class: 'hb-seg', role: 'group', 'aria-label': 'Length' },
    [[1, '1 line'], [5, '5 lines'], [3, '3 paragraphs']].map(([n, l]) => el('button', { type: 'button', 'aria-pressed': String(state.size === n), onClick: () => { state.size = n; pref.set('hd:brief-size', String(n)); draw(root); } }, l)));
  const head = el('div', { class: 'hb-head' },
    el('span', { class: 'hb-title' }, 'In brief'),
    el('span', { class: 'hb-scope', title: o.scopeLabel }, o.scopeLabel),
    F.ok ? seg : null,
    el('button', { class: 'hb-x', type: 'button', title: 'Hide the brief', 'aria-label': 'Hide the brief', onClick: () => { pref.set('hd:brief-off', '1'); draw(root); } }, '✕'));
  const body = [];
  if (!F.ok) body.push(el('span', { class: 'hb-note' }, F.note));
  else if (state.size === 3) body.push(...F.paragraphs.map((p) => el('p', { class: 'hb-para' }, p)));
  else {
    const shown = state.size === 1 ? F.lines.filter((l) => l.text === F.one).slice(0, 1) : F.lines;
    body.push(el('ul', { class: 'hb-lines' }, shown.map((l) => el('li', {}, el('button', { class: 'hb-line', type: 'button', title: 'Open the source at this sentence', onClick: () => { try { o.onOpen && o.onOpen(l); } catch { /* the page opens it */ } } }, l.text)))));
  }
  const docs = [...new Set(o.sts.map((st) => st.doc))];
  const whole = docs.length === 1 ? ((o.A.stsByDoc && o.A.stsByDoc[docs[0]]) || o.A.sts.filter((st) => st.doc === docs[0])).length : 0;
  if (F.ok && whole > LONG_ONE_SOURCE && o.unfiltered) {
    body.push(el('span', { class: 'hb-note' }, 'This is one long source. Folded whole, it brings up its densest lines rather than its story — pick a topic or a name to fold just that.'));
  }
  const why = new Map(); for (const f of F.folded) { const w = typeof f.why === 'string' ? f.why : 'set aside'; why.set(w, (why.get(w) || 0) + 1); }
  const foot = [];
  if (F.scope.statements) {
    const g = grammarState === 'ready' ? 'each checked by the English parser for a verb, a subject and nothing broken' : grammarState === 'loading' ? 'the grammar check is loading' : 'checked by form only (the parser did not load)';
    foot.push(el('span', { class: 'hb-foot' }, 'Every line is a sentence from the sources, unchanged — no model wrote any of it; ' + g + '. Folded from ' + plural(F.scope.statements, 'statement') + (F.scope.sources > 1 ? ' in ' + plural(F.scope.sources, 'source') : '') + '.'));
  }
  if (why.size) {
    foot.push(el('details', {}, el('summary', {}, plural(F.folded.length, 'line') + ' set aside'),
      el('ul', { class: 'hb-why' }, [...why.entries()].sort((a, b) => b[1] - a[1]).map(([w, n]) => el('li', {}, n.toLocaleString() + ' — ' + w)))));
  }
  root.replaceChildren(el('section', { class: 'hd-brief', 'aria-label': 'In brief' }, head, ...body, ...foot));
}

export const _grammarState = () => grammarState;
