// reader-view.js — the reading, in three panels. One rule: every click SELECTS ONE THING (a word, a referent, a mention, a claim, a source).
//
//   left    WHAT WAS READ — an index of what the reader established: people and things, claims, words it could not place, sources.
//   centre  THE SELECTED THING (the hero), under breadcrumbs. By default the document, marked; a referent shows every place it is mentioned.
//   right   WHERE IT CAME FROM — the bytes, the ids, the prior or rule and who gave it, the events that made it; corrections as your events.
//   bottom  REPLAY — the reading again, statement by statement (what it believed then, what later reading revised), and the layer switches.
//
// Nothing here reads anything: it renders the reading the page already made (T, T.timeline and its identity log) and appends a person's
// corrections as events of their own on top of it. The reader's log is never edited; an undo is one more event.
import { foldLog, CELLS } from '../vendor/khora/native/adapters/text/reading-timeline.js';
import { hunt } from './prior-hunt.js';
import { tiltOf } from './prior-tilt.js';
import { MARKER } from './shapes.js';
import { primeFor, gainsAt } from './sections.js';
import { loadPrograms, apply as applyLearned } from './learned.js';
import { recordReading, layerCounts, chainOf } from './scan-ledger.js';
import { buildRows, sortRows, nextSort, tableHTML } from './referent-table.js';
import { fieldsOf, htmlExport, pageHTML, placeHTML, pdfHTML, semanticOf, blockStarts, tupleHTML, tupleChildren, tupleAt, readForm } from './page-views.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ROOT_PATH = String.fromCharCode(36);
const short = (id) => String(id ?? '').replace(/^(ref_|spn_|evt_|being:)/, '').slice(0, 8);
const COL = ['#5aa9ff', '#c68bff', '#ffb454', '#6ee7a8', '#ff8fa3', '#7fe0e0', '#d6e36b', '#f29de4'];
const UPOS_COL = { NOUN: '#5aa9ff', PROPN: '#c68bff', VERB: '#6ee7a8', ADJ: '#ffb454', ADV: '#7fe0e0', AUX: '#6ee7a8' };
const ATTESTED = { treebank: 'the treebank prior (Universal Dependencies, Thrax map)', lexicon: 'the class lexicon (UniMorph)', shape: 'a shape rule (number, email, identifier…)', act: "its act's class (the form itself is not in the prior)", document: 'the document itself (its own definitions and typography)', lookup: 'a lookup' };

const CSS = `
#rv{position:fixed;inset:0;z-index:45;background:var(--bg);color:var(--ink);display:none;grid-template-rows:auto minmax(0,1fr) auto;font:14px/1.5 var(--sans)}
#rv.on{display:grid}
#rv .top{display:flex;align-items:baseline;gap:14px;padding:12px 18px;border-bottom:1px solid var(--line);flex-wrap:wrap}
#rv .top h2{font:600 17px var(--sans);margin:0}
#rv .proof{font:12.5px var(--mono);color:var(--dim)}
#rv .top .sp{flex:1}
#rv button{font:13px var(--sans);background:var(--s1);color:var(--ink);border:1px solid var(--line2);border-radius:7px;padding:4px 10px;cursor:pointer}
#rv button:hover{border-color:var(--acc3)}
#rv .body{display:grid;grid-template-columns:260px minmax(0,1fr) 380px;grid-template-rows:minmax(0,1fr);min-height:0}
@media (min-width:1001px) and (max-width:1320px){#rv .body{grid-template-columns:240px minmax(0,1fr) 300px}}
#rv .modes{display:flex;gap:4px;margin:0 0 14px;flex-wrap:wrap}
#rv .modes button{background:none;border-color:var(--line)}#rv .modes button.on{background:var(--sel2);border-color:var(--acc3)}
#rv .pgh{font:12px var(--mono);color:var(--dim);margin:18px 0 6px}
#rv .pg{position:relative;width:100%;max-width:900px;container-type:inline-size;border:1px solid var(--line);border-radius:4px;overflow:hidden}
#rv .pg img{display:block;width:100%;height:100%}
#rv .pg .wb{position:absolute;border-bottom:2px solid var(--c);background:color-mix(in srgb,var(--c) 18%,transparent);cursor:pointer}
#rv .pg .wb.claim{background:none;border-bottom:1px dashed var(--c)}
#rv .pg .fb{position:absolute;outline:1.5px solid #6ee7a8;outline-offset:2px;border-radius:2px;cursor:pointer}
#rv .pg .wb.on{outline:3px solid #f0b429;outline-offset:1px}
#rv .pg .fb.on{outline:3px solid #f0b429;background:rgba(240,180,41,.15)}
#rv .pg.place{background:#fbfaf7}
#rv .pg .pw{position:absolute;white-space:nowrap;line-height:1;font-family:var(--sans);cursor:pointer;transform-origin:left top;letter-spacing:0}
#rv .pg .pw.printed{color:#6b7280}#rv .pg .pw.filled{color:#1d4ed8;font-weight:600}#rv .pg .pw.fv{background:rgba(29,78,216,.07)}
#rv .pg .pw.mention{color:var(--c);filter:brightness(.6);font-weight:600}
#rv .pg .pw.value{color:#0b7a43;font-weight:600}#rv .pg .pw.label{color:#3359a8}#rv .pg .pw.unplaced{color:#a86b00;text-decoration:underline dotted}
#rv .pg .pw.on{outline:2px solid #f0b429;background:rgba(240,180,41,.25)}
#rv .pg.pdf .ow{position:absolute;white-space:nowrap;overflow:hidden;line-height:1;color:transparent;background:transparent;font-family:var(--sans);cursor:pointer;display:flex;align-items:center;border-radius:2px}
#rv .pg.pdf .ow.plain{background:transparent}
#rv .pg.pdf .ow.mention,#rv .pg.pdf .ow.value,#rv .pg.pdf .ow.label,#rv .pg.pdf .ow.unplaced{background:color-mix(in srgb,var(--c) 22%,transparent);box-shadow:inset 0 -2px 0 color-mix(in srgb,var(--c) 70%,transparent)}
#rv .pg.pdf .ow.unplaced{box-shadow:inset 0 -2px 0 #a86b0099;background:rgba(168,107,0,.12)}
#rv .pg.pdf .ow:hover{outline:1px solid #f0b429;background:rgba(240,180,41,.18)}
#rv .pg.pdf .ow.on{outline:3px solid #f0b429;background:rgba(240,180,41,.35)}
#rv .tp{font:12.5px/1.7 var(--mono);padding-left:2px;cursor:default}#rv .tp[data-sel]{cursor:pointer}#rv .tp[data-sel]:hover{background:var(--s1)}#rv .jw{color:var(--dim);font-size:11.5px;margin-left:6px}
#rv .jt{margin-left:2px}#rv .jt summary{cursor:pointer;font:12.5px var(--mono)}#rv .jc{margin-left:16px;border-left:1px solid var(--line);padding-left:8px}
#rv .jr{font:12.5px/1.6 var(--mono)}#rv .jk{color:var(--acc)}#rv .jh{color:var(--dim)}#rv .jv.string{color:#a5d6a7}#rv .jv.number{color:#ffcc80}
#rv .col{overflow:auto;min-height:0;padding:14px 16px}
#rv .idx{border-right:1px solid var(--line)}
#rv .prov{border-left:1px solid var(--line);font-size:13px}
#rv .grp{font:600 11.5px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--dim);margin:16px 0 6px}
#rv .grp:first-child{margin-top:0}
#rv .it{display:flex;gap:8px;align-items:baseline;padding:4px 7px;border-radius:6px;cursor:pointer;line-height:1.35}
#rv .it:hover{background:var(--s1)}
#rv .it.sel{background:var(--sel2)}
#rv .it .n{margin-left:auto;color:var(--dim);font:12.5px var(--mono)}
#rv .it .dot{width:8px;height:8px;border-radius:50%;flex:0 0 auto;transform:translateY(-1px)}
#rv .rt{width:100%;border-collapse:collapse;table-layout:auto;font-size:13px}
#rv .rt th,#rv .rt td{padding:4px 5px;text-align:left;font-weight:400;line-height:1.35;border-bottom:1px solid var(--line)}
#rv .rt thead th{font:600 11px var(--mono);color:var(--dim);white-space:nowrap}
#rv .rt thead button{all:unset;cursor:pointer;color:inherit;font:inherit}#rv .rt thead button:hover,#rv .rt thead button:focus-visible{color:var(--ink)}
#rv .rt .ar{margin-left:3px;font-size:9px}#rv .rt .num{text-align:right;font-family:var(--mono);font-size:12.5px;color:var(--dim)}
#rv .rt tbody tr{cursor:pointer}#rv .rt tbody tr:hover{background:var(--s1)}#rv .rt tbody tr.sel{background:var(--sel2)}
#rv .rt .c-name{overflow-wrap:normal;word-break:normal;hyphens:manual;min-width:9ch}#rv .rt .c-name>span:last-child{display:inline}#rv .rt .num{width:1%;white-space:nowrap}#rv .rt thead th.num,#rv .rt thead th:not(:first-child){white-space:normal}#rv .rt .c-name .dot{float:left;width:8px;height:8px;border-radius:50%;margin:5px 6px 0 0}
#rv .rt .sm{display:inline-block;width:8px;height:8px;border-radius:2px;margin-left:2px}#rv .rt .c-reality{text-align:center;cursor:help}
#rv .rt .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
#rv .crumbs{font-size:13px;color:var(--dim);margin:0 0 14px}
#rv .crumbs a{color:var(--acc);cursor:pointer;text-decoration:none}
#rv .crumbs a:hover{text-decoration:underline}
#rv .crumbs .here{color:var(--ink)}
#rv .doc{font:16px/1.95 var(--serif);max-width:72ch;white-space:pre-wrap}
#rv .doc .w{cursor:pointer;border-radius:3px}
#rv .doc .w:hover{background:var(--sel2)}
#rv .doc .mn{border-bottom:2px solid var(--rc)}
#rv .doc .cl{background:rgba(138,180,255,.07)}
#rv .doc .un{text-decoration:underline dotted var(--amber) 1.5px;text-underline-offset:4px}
#rv .doc .pick{background:rgba(138,180,255,.28)}
#rv .doc .later{opacity:.28}
#rv .doc .rev{animation:rvflash 1.4s ease-out}
@keyframes rvflash{0%{background:rgba(240,180,41,.55)}100%{background:transparent}}
#rv h3{font:600 20px var(--sans);margin:0 0 4px}
#rv .sub{color:var(--dim);font-size:13px;margin-bottom:16px}
#rv .kwic{display:grid;grid-template-columns:48px 1fr;gap:10px;padding:8px 6px;border-top:1px solid var(--line);cursor:pointer;font:15px/1.6 var(--serif)}
#rv .kwic:hover{background:var(--s1)}
#rv .kwic.sel{background:var(--sel2)}
#rv .kwic .s{font:12px var(--mono);color:var(--dim);padding-top:4px}
#rv .kwic b{border-bottom:2px solid var(--rc);font-weight:600}
#rv .kv{display:grid;grid-template-columns:110px 1fr;gap:4px 10px;margin:6px 0 14px}
#rv .kv .k{color:var(--dim)}
#rv .mono{font-family:var(--mono);font-size:12.5px;word-break:break-all}
#rv .ev{border-left:2px solid var(--line2);padding:4px 0 4px 10px;margin:6px 0}
#rv .ev.you{border-left-color:var(--amber)}
#rv .ev.gone{opacity:.45;text-decoration:line-through}
#rv .ev .h{font:12px var(--mono);color:var(--dim)}
#rv .ph{font:600 12px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--dim);margin:16px 0 6px}
#rv .ph:first-child{margin-top:0}
#rv .fix{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}
#rv .fix select{font:13px var(--sans);background:var(--s1);color:var(--ink);border:1px solid var(--line2);border-radius:7px;padding:3px 6px;max-width:100%}
#rv .tri{font:15px/1.6 var(--serif)}
#rv .tri .r{border-bottom:2px solid var(--rc)}
#rv .tri .a{color:var(--green)}
#rv .bar{display:flex;align-items:center;gap:10px;padding:8px 14px calc(8px + env(safe-area-inset-bottom));border-top:1px solid var(--line);min-width:0;position:relative}
#rv .bar input[type=range]{flex:1 1 auto;min-width:60px;accent-color:var(--acc)}
#rv .bar .at{font:12.5px var(--mono);color:var(--dim);white-space:nowrap}
#rv .lyr{position:relative;font-size:13px}#rv .lyr summary{cursor:pointer;color:var(--ink2);white-space:nowrap;list-style:none}#rv .lyrm{position:absolute;bottom:calc(100% + 8px);right:0;background:var(--s1);border:1px solid var(--line2);border-radius:8px;padding:10px 12px;display:grid;gap:6px;min-width:200px;z-index:2}
#rv .lyr label{display:flex;gap:6px;align-items:center;font-size:13px;color:var(--ink2);cursor:pointer}
#rv .delta{position:absolute;left:14px;bottom:100%;font-size:12.5px;color:var(--amber);background:var(--bg);padding:4px 8px;border:1px solid var(--line);border-radius:6px}
#rv .dim{color:var(--dim)}
#rv .seg,#rv .mob{display:none}
@media (max-width:1000px){
#rv{grid-template-rows:auto auto minmax(0,1fr) auto}
#rv .seg{display:flex;gap:6px;padding:8px 12px;border-bottom:1px solid var(--line)}#rv .seg button{flex:1;min-height:42px;font-size:14px}#rv .seg button.on{background:var(--sel2);border-color:var(--acc3)}
#rv .mob{display:inline-block}#rv .dl{display:none;flex-basis:100%;gap:8px;flex-wrap:wrap}#rv .dl.open{display:flex}
#rv .proof{display:none}#rv .top .sp{display:none}
#rv button{min-height:40px;padding:6px 12px;font-size:14px}
#rv .col{display:none}#rv[data-m="hero"] .hero,#rv[data-m="idx"] .idx,#rv[data-m="prov"] .prov{display:block}
#rv .body{padding-bottom:14px}
}
@media (max-width:1000px){#rv .rt .c-sources,#rv .rt .c-first{display:none}#rv .rt tbody th,#rv .rt tbody td,#rv .rt thead th{height:40px;padding:4px 6px}}
@media (max-width:1000px){#rv .body{display:flex;flex-direction:column;overflow:auto}#rv .col{overflow:visible;flex:0 0 auto}#rv .hero{order:1}#rv .prov{order:2;border-left:0;border-top:1px solid var(--line)}#rv .idx{order:3;border-right:0;border-top:1px solid var(--line)}#rv .top{gap:8px}#rv .top h2{font-size:15px;flex-basis:100%}#rv .doc{font-size:15px;line-height:1.8}#rv .kv{grid-template-columns:96px 1fr}}
`;

/**
 * @param {object} T  the page's reading (buildTrace + T.timeline once it arrives)
 * @param {object} ctx {
 *   hash(s)→hex, explainWord(w)→classification, actsOf(w)→string[], readingJSON(T), download(name,text,mime),
 *   priors: [{name, giver, on}], features, layers: [{feature,label,why}], rerun(features)→Promise<T>, onClose(), sources()→corpus state|null }
 */
export function mountReader(T, ctx) {
  if (!document.getElementById('rv-css')) { const s = document.createElement('style'); s.id = 'rv-css'; s.textContent = CSS; document.head.appendChild(s); }
  let root = document.getElementById('rv');
  if (!root) { root = document.createElement('div'); root.id = 'rv'; document.body.appendChild(root); }
  root.innerHTML = `<div class="top"><h2></h2><span class="proof"></span><span class="sp"></span><button type="button" data-a="layers" title="The layered instrument: every layer, the replay, and the relative solar system">▦ Layers</button><button type="button" data-a="more" class="mob" aria-label="More" title="Downloads">⋯</button><span class="dl"><button type="button" data-a="json">⤓ the reading as JSON</button><button type="button" data-a="scanlog" title="Every layer of reading the scan, from the pixels to the statements, as one append-only log (Provenance@2)">⤓ scan log</button><button type="button" data-a="html" title="The scan's words as standalone semantic HTML, filled-in values carrying their provenance">⤓ as HTML</button></span><button type="button" data-a="close" title="Esc">✕ Close</button></div>
    <div class="seg" role="tablist" aria-label="Panel"><button type="button" data-a="mt" data-m="hero">Reading</button><button type="button" data-a="mt" data-m="idx">What was read</button><button type="button" data-a="mt" data-m="prov">Where from</button></div>
    <div class="body"><div class="col idx"></div><div class="col hero"></div><div class="col prov"></div></div>
    <div class="bar"></div>`;
  root.classList.add('on'); root.dataset.m = 'hero'; root.querySelector('.seg [data-m="hero"]').classList.add('on');
  const $ = (s) => root.querySelector(s);
  const ac = new AbortController(), on = (el, t, fn) => el.addEventListener(t, fn, { signal: ac.signal });
  const st = { mode: T.doc.layout ? 'pdf' : 'text', showClaims: false, sel: { kind: 'doc' }, overlay: [], frontier: null, playing: null, flash: new Set(), delta: ctx.delta || null, features: { ...ctx.features } };
  const text = T.doc.analysis;
  // the label carries how the text was got ("file.pdf — tesseract OCR · 4 pages, 79%…"): the title is the name, the rest is provenance
  const [title, ...how] = String(T.doc.label || 'reading').split(' — '); const extracted = how.join(' — ');

  // ── the model at the current point of the reading ──
  const TL = () => T.timeline && !T.timeline.error && T.timeline.sentences ? T.timeline : null;
  const nStmts = () => (TL() ? TL().sentences.length : T.sents.length);
  const snapAt = () => { const tl = TL(); if (!tl || !tl.snapshots.length) return null; if (st.frontier == null) return tl.snapshots.at(-1); return [...tl.snapshots].reverse().find((s) => s.frontier <= st.frontier) || tl.snapshots[0]; };
  const visibleEnd = () => { const tl = TL(); if (!tl || st.frontier == null) return text.length; const s = tl.sentences[Math.min(st.frontier, tl.sentences.length) - 1]; return s ? s.end : 0; };
  const retracted = () => new Set(st.overlay.filter((e) => e.kind === 'retract').map((e) => e.retracts));
  const activeOverlay = () => { const r = retracted(); return st.overlay.filter((e) => e.kind !== 'retract' && !r.has(e.action)); };
  let foldKey = '', foldVal = null;
  const fold = () => {
    const tl = TL(); if (!tl) return null; const sn = snapAt(); const key = `${sn ? sn.logTo : 'all'}|${st.overlay.length}`;
    if (key !== foldKey) { foldKey = key; foldVal = foldLog(sn ? tl.log.slice(0, sn.logTo) : tl.log, { overlay: activeOverlay() }); foldVal.order = [...foldVal.referents.values()].sort((a, b) => b.mentions.length - a.mentions.length); foldVal.col = new Map(foldVal.order.map((r, i) => [r.id, COL[i % COL.length]])); }
    return foldVal;
  };
  const tokens = () => { const sn = snapAt(); return sn ? sn.tokens : []; };
  const sentOf = (at) => { const tl = TL(); if (!tl) return null; const i = tl.sentences.findIndex((x) => x.offset <= at && at < x.end); return i < 0 ? null : i + 1; };
  const claims = () => T.claims.filter((c) => c.located && c.e <= visibleEnd());
  const unplaced = () => { const m = new Map(); for (const t of tokens()) if (!t.upos && /\p{L}/u.test(t.w)) { const k = t.w.toLowerCase(); (m.get(k) || m.set(k, []).get(k)).push(t); } return [...m.entries()].sort((a, b) => b[1].length - a[1].length); };
  const refName = (f, id) => { const r = f && f.referents.get(f.resolve(id)); return r ? (r.name || short(r.id)) : short(id); };
  const kwic = (s, e, rc) => { const a = Math.max(0, s - 70), b = Math.min(text.length, e + 70); const pre = text.slice(a, s), post = text.slice(e, b); return `${a ? '…' : ''}${esc(pre.replace(/^\S*\s/, a ? '' : '$&'))}<b style="--rc:${rc}">${esc(text.slice(s, e))}</b>${esc(post.replace(/\s\S*$/, b < text.length ? '' : '$&'))}${b < text.length ? '…' : ''}`; };
  const bytes = (s, e) => `${utf8(text.slice(0, s))}–${utf8(text.slice(0, e))}`;
  const utf8 = (x) => new TextEncoder().encode(x).length;

  // ── what the page views draw ──
  const L = T.doc.layout || null;
  let fieldsMemo = null; const fields = () => (fieldsMemo ??= applyLearned(fieldsOf(L, text, st.tilt || null), (st.learned && st.learned.rules) || []));
  const isForm = () => fields().length >= 5;
  let formMemo = null, formKey = ''; const form = () => { const f = fold(); const k = foldKey; if (formMemo && formKey === k) return formMemo; formKey = k; return (formMemo = readForm(fields(), { referents: f ? f.order : [], formWord, known: ctx.known || null })); };
  const R = () => { const f = fold(), mentions = []; if (f) for (const m of f.mentions.values()) { const r = f.assign.get(m.id), ref = r ? f.resolve(r) : null; if (ref && f.referents.has(ref)) mentions.push({ s: m.s, e: m.e, ref, rc: f.col.get(ref) }); }
    return { fields: fields(), mentions, claims: claims(), unplaced: new Set(tokens().filter((t) => !t.upos && /\p{L}/u.test(t.w)).map((t) => t.s)), tokens: tokens(), title, extracted }; };
  let structMemo = null, structKey = '';
  const structure = () => { const k = foldKey; if (structMemo && structKey === k) return structMemo; structKey = k; const f = fold(), tl = TL();
    const src = ['source', [['bytes', T.nBytes], ['sha-256', T.hash], ['source id', T.srcId], ...(extracted ? [['text from', extracted]] : []), ['read', `${text.length} characters`]]];
    const body = L ? semanticOf(L, text, fields(), { gains: st.gains, rules: st.learned && st.learned.use ? st.learned.structure : null }) : (tl ? tl.sentences.map((s) => [`statement ${s.n}`, s.text.trim(), { chars: [s.offset, s.end] }]) : []);
    const names = f ? f.order.filter((r) => r.mentions.length && !formWord(r)).map((r) => [r.name || short(r.id), r.mentions.map((m) => ['mention', m.text, { chars: [m.s, m.e], span: m.id }]), { id: r.id }]) : [];
    const cls = (isForm() && !st.showClaims) ? [] : claims().map((c) => [c.end1, [[c.label, c.end2]], { chars: [c.s, c.e], polarity: c.polarity === '-' ? 'negated' : 'affirmed' }]);
    // every proposition the form makes, nested as the page nests it: filer → section (Part …) → the row's act → [column, value] — one tuple per proposition
    const said = isForm() ? (() => { const F = form();
      const cleanHead = (t) => { const ws = t.split(/\s+/); return ws.filter((w) => /^\p{L}{3,}[,.;:]?$/u.test(w)).length >= Math.max(3, ws.length * 0.7) && (t.match(/[\p{L}\s]/gu) || []).length >= t.length * 0.85; };
      const heads = (L ? body : []).flatMap((pg) => pg[1].filter((sec) => sec[2] && sec[2].chars && (MARKER.test(sec[0]) || cleanHead(sec[0]))).map((sec) => ({ page: sec[2].page, at: sec[2].chars[0], name: sec[0] })));
      const secOf = (c) => { const h = heads.filter((x) => x.page === c.page && x.at <= c.chars[0]).pop(); return h ? h.name : `page ${c.page}`; };
      const bySec = new Map(); for (const c of F.claims) { const k = secOf(c), sec = bySec.get(k) || bySec.set(k, new Map()).get(k), [act, col] = c.act.split(' · '), row = sec.get(c.field) || sec.set(c.field, { act, cols: [], c }).get(c.field); row.cols.push([col || 'value', c.object, { type: c.type, chars: c.chars, value_box: c.value_box, confidence: c.conf }]); }
      const props = [...bySec].map(([name, rows]) => [name, [...rows.values()].map((r) => r.cols.length === 1 && r.cols[0][0] === 'value' ? [r.act, r.cols[0][1], { type: r.c.type, page: r.c.page, chars: r.c.chars, label_box: r.c.label_box, value_box: r.c.value_box, confidence: r.c.conf, by: 'a field read as the filer\'s statement' }] : [r.act, r.cols, { page: r.c.page, label_box: r.c.label_box, by: 'a table row read as the filer\'s statement, one value per column' }]), { by: 'the section the page prints it under' }]);
      return [['what the form says', [['said by', F.filer.name, { by: F.filer.basis }], ...(F.voice ? [['signed', F.voice.name, { by: F.voice.basis }]] : []), [F.filer.name, props, { by: 'every proposition, nested as the form nests it' }]]]]; })() : [];
    return (structMemo = ['reading', [['title', title], src, ...said, ...(L ? body : [['statements', body]]), ['names', names], ['claims', cls]]]); };
  // a FORM's printed words (Yes, No, Part VIII) are labels, not people: a referent whose every mention sits inside a field's label, or whose name is a choice, is form furniture
  const formWord = (r) => { if (!L) return false; const fs = fields(); if (A_choice(r.name)) return true; return fs.length > 0 && r.mentions.every((m) => fs.some((x) => m.s >= x.s && m.e <= x.s + x.label.length)); };
  const A_choice = (s) => /^(yes|no|did|is|was|were|does|do|part\s+[ivxl]+|schedule\s+[a-z])$/i.test(String(s || '').trim());

  // ── the hunt for a prior (prior-hunt.js): local library first, then a search; a prior that aligns only tilts the reading ──
  st.hunt = L ? { status: 'looking for this document’s prior…', result: null } : null; st.tilt = null;
  if (L) (async () => {
    try { const res = await hunt(L, text, { base: new URL('./', import.meta.url), pdfjs: ctx.pdfjs ? await ctx.pdfjs() : null, onStatus: (s) => { st.hunt.status = s; if (st.sel.kind === 'doc') { const el = root.querySelector('.prov'); if (el) el.innerHTML = prov(); } } });
      st.hunt = { status: res.prior ? 'found' : 'none found', result: res };
      if (res.prior) { st.tilt = tiltOf(res.prior, L); fieldsMemo = null; formMemo = null; structMemo = null; }
    } catch (e) { st.hunt = { status: 'the hunt failed: ' + (e && e.message || e), result: null }; }
    render(); scheduleLayers();
  })();

  // ── the scan log: every layer, recorded into the reading's own ledger as the layers settle (scan-ledger.js) ──
  let layersTimer = null;
  const recordLayers = () => { if (!L || !ctx.ledger) return null; const g = ctx.ledger(); if (!g || !g.led) return null;
    const fs = fields(), sem = semanticOf(L, text, fs, { gains: st.gains, rules: st.learned && st.learned.use ? st.learned.structure : null });
    recordReading(g.led, g.srcId, g.pages, { layout: L, fields: fs, sem, form: isForm() ? form() : null, hunt: st.hunt, tilt: st.tilt, learned: st.learned, ground: st.ground, structureRules: st.learned && st.learned.use ? st.learned.structure : null });
    g.refresh(); return g; };
  const scheduleLayers = () => { clearTimeout(layersTimer); layersTimer = setTimeout(() => { try { recordLayers(); const el = root.querySelector('.prov'); if (el && st.sel.kind === 'doc') el.innerHTML = prov(); } catch (e) { /* the log is a record, never a gate on reading */ } }, 500); };

  // ── learned programs (learned.js): little rule programs measured on documents whose truth was known; they tilt, and say so ──
  st.learned = null;
  if (L) setTimeout(async () => { try { const p = await loadPrograms(new URL('./', import.meta.url)); st.learned = { ...p, use: !!p.structure && st.useLearned !== false }; fieldsMemo = null; formMemo = null; structMemo = null; render(); scheduleLayers(); } catch (e) { /* no programs: the reader runs on its declared defaults */ } }, 0);

  // ── the ground for surprise (sections.js): what a reader of this register already knew, so that a section is where the earlier text stops helping ──
  st.gains = null; st.ground = null;
  if (L) setTimeout(async () => {
    try { const pr = await primeFor(text, { base: new URL('./', import.meta.url) }), res = gainsAt(text, blockStarts(L, text), { prime: pr.prime });
      st.gains = res.gains; st.ground = { genre: pr.genre, giver: pr.giver, why: pr.why, register: pr.register, tokens: res.tokens, nullMedian: res.nullMedian, refused: res.refused || null, cuts: res.gains.size };
      structMemo = null; render(); scheduleLayers();
    } catch (e) { st.ground = { refused: String(e && e.message || e) }; }
  }, 0);

  // ── selection, crumbs ──
  const select = (sel) => { if (sel.kind !== 'doc' && matchMedia('(max-width:1000px)').matches && root.dataset.m === 'idx') { root.dataset.m = 'hero'; root.querySelectorAll('.seg button').forEach((x) => x.classList.toggle('on', x.dataset.m === 'hero')); } if ((sel.kind === 'ref' || sel.kind === 'mention') && !sel.name) { const f = fold(); const r = f && f.referents.get(f.resolve(sel.ref)); if (r && r.name) sel = { ...sel, name: r.name }; else if (st.sel.name && st.sel.ref === sel.ref) sel = { ...sel, name: st.sel.name }; } st.sel = sel; render(); };
  function crumbs() {
    const f = fold(), s = st.sel, c = [{ label: title, go: { kind: 'doc' } }];
    if (s.kind === 'ref' || s.kind === 'mention') { c.push({ label: 'People & things', go: { kind: 'doc' } }, { label: (f && f.referents.get(f.resolve(s.ref)) && f.referents.get(f.resolve(s.ref)).name) || s.name || refName(f, s.ref), go: { kind: 'ref', ref: s.ref } }); if (s.kind === 'mention') c.push({ label: `mention ${s.n}` }); }
    else if (s.kind === 'word') c.push({ label: 'Words', go: { kind: 'doc' } }, { label: `“${s.w}”` });
    else if (s.kind === 'claim') c.push({ label: 'Claims', go: { kind: 'doc' } }, { label: `claim ${s.i + 1}` });
    else if (s.kind === 'fclaim') { const x = form().claims.find((y) => y.id === s.id); c.push({ label: 'What the form says', go: { kind: 'doc' } }, { label: x ? x.act : s.id }); }
    else if (s.kind === 'field') { const x = fields().find((y) => y.id === s.id); c.push({ label: 'Fields', go: { kind: 'doc' } }, { label: x ? x.label : s.id }); }
    else if (s.kind === 'source') c.push({ label: 'Sources', go: { kind: 'doc' } }, { label: s.label });
    else if (s.kind === 'being') c.push({ label: 'Across sources', go: { kind: 'doc' } }, { label: s.name || short(s.id) });
    return `<div class="crumbs">${c.map((x, i) => (i < c.length - 1 && x.go ? `<a data-crumb="${i}">${esc(x.label)}</a>` : `<span class="here">${esc(x.label)}</span>`)).join(' › ')}</div>`;
  }
  let crumbGo = [];

  // ── left: what was read ──
  function index() {
    const f = fold(), s = st.sel;
    if (!f) return '<div class="dim">Reading the text sentence by sentence…</div>';
    const allPeople = f.order.filter((r) => r.mentions.length), people = allPeople.filter((r) => !formWord(r)).slice(0, 40), furniture = allPeople.length - allPeople.filter((r) => !formWord(r)).length;
    const it = (sel, label, n, cls, dot) => `<div class="it${cls ? ' sel' : ''}" data-sel='${esc(JSON.stringify(sel))}'>${dot ? `<span class="dot" style="background:${dot}"></span>` : ''}<span>${label}</span>${n != null ? `<span class="n">${n}</span>` : ''}</div>`;
    const fs = fields();
    let h = fs.length ? `<div class="grp">Fields · ${fs.length}</div>${fs.slice(0, 40).map((x) => it({ kind: 'field', id: x.id }, `${esc(x.label)} <span class="dim">${esc(x.value.slice(0, 40))}</span>`, null, s.kind === 'field' && s.id === x.id)).join('')}` : '';
    const C0 = ctx.sources && ctx.sources(), multi = C0 && C0.corpus && C0.sources.length > 1, srt = st.rsort || { key: 'mentions', dir: 'desc' };
    const rows = sortRows(buildRows(people.map((r) => ({ id: r.id, name: r.name, mentions: r.mentions, born: r.born, dot: f.col.get(r.id) })), { beings: multi ? C0.fold.beings : [], sources: multi ? C0.sources : [], selectedId: (s.kind === 'ref' || s.kind === 'mention') ? f.resolve(s.ref) : null }), srt.key, srt.dir);
    h += `<div class="grp">People & things</div>${people.length ? tableHTML(rows, { nSources: multi ? C0.sources.length : 1, sort: srt, palette: COL }) : '<div class="dim">none established yet</div>'}${furniture ? `<div class="dim" style="margin:4px 7px">and ${furniture} printed form word${furniture === 1 ? '' : 's'} (Yes, No, Part …), not listed</div>` : ''}`;
    const cl = claims();
    if (isForm()) { const F = form(); h += `<div class="grp">What the form says · ${F.claims.length}</div><div class="dim" style="margin:0 7px 6px">said by ${esc(F.filer.name)}${F.voice ? `, signed ${esc(F.voice.name)}` : ''}</div>${F.claims.slice(0, 60).map((c) => it({ kind: 'fclaim', id: c.id }, `<span class="dim">${esc(c.act)}</span> ${esc(c.object)}`, null, s.kind === 'fclaim' && s.id === c.id)).join('')}${F.skipped ? `<div class="dim" style="margin:4px 7px">${F.skipped} field${F.skipped === 1 ? '' : 's'} too garbled by the scan to read as a statement</div>` : ''}`; }
    if (isForm() && !st.showClaims) h += `<div class="grp">Sentence claims</div><div class="dim" style="margin:0 7px">This reads as a form (${fields().length} fields). Claims are read from sentences, and a form's lines are not sentences, so none are shown. <a data-a="showclaims" style="color:var(--acc);cursor:pointer">show them anyway</a></div>`;
    else h += `<div class="grp">Claims</div>${cl.map((c) => { const i = T.claims.indexOf(c); return it({ kind: 'claim', i }, `${c.mood === 'interrogative' ? '<span class="dim">asks · </span>' : c.mood === 'exclamative' ? '<span class="dim">exclaims · </span>' : ''}${esc(c.end1)} <span class="dim">${esc(c.label)}</span> ${esc(c.end2)}`, null, s.kind === 'claim' && s.i === i); }).join('') || '<div class="dim">no claim read yet</div>'}`;
    const un = unplaced().slice(0, 20);
    if (un.length) h += `<div class="grp">Words it could not place</div>${un.map(([k, ts]) => it({ kind: 'word', w: ts[0].w, s: ts[0].s, e: ts[0].e }, esc(ts[0].w), ts.length, s.kind === 'word' && s.w.toLowerCase() === k)).join('')}`;
    const C = ctx.sources && ctx.sources();
    if (C && C.corpus) {
      h += `<div class="grp">Sources</div>${C.sources.map((x) => it({ kind: 'source', id: x.id, label: x.label }, esc(x.label), esc(x.register || (x.auto && x.auto.register) || '?'), s.kind === 'source' && s.id === x.id)).join('')}`;
      const across = C.fold.beings.filter((b) => new Set(b.ends.map((e) => e.source)).size > 1);
      if (across.length) h += `<div class="grp">Across sources</div>${across.map((b) => it({ kind: 'being', id: b.id, name: b.name }, esc(b.name || '—'), new Set(b.ends.map((e) => e.source)).size + ' src', s.kind === 'being' && s.id === b.id)).join('')}`;
    }
    return h;
  }

  // ── centre: the selected thing ──
  function docHTML(hiS, hiE) {
    const f = fold(), end = visibleEnd(), toks = tokens(), MEN = [];
    if (f) for (const m of f.mentions.values()) { const r = f.assign.get(m.id), ref = r ? f.resolve(r) : null; if (ref && f.referents.has(ref) && m.s < end) MEN.push({ ...m, ref }); }
    const CL = claims();
    const tokAt = new Map(toks.map((t, i) => [t.s, i]));
    let h = '', i = 0;
    while (i < end) {
      const ti = tokAt.get(i);
      if (ti == null) { let j = i + 1; while (j < end && !tokAt.has(j)) j++; h += esc(text.slice(i, j)); i = j; continue; }
      const t = toks[ti], mn = MEN.find((m) => m.s <= t.s && t.e <= m.e), inClaim = CL.some((c) => c.s <= t.s && t.e <= c.e);
      const cls = ['w', mn ? 'mn' : '', inClaim ? 'cl' : '', !t.upos && /\p{L}/u.test(t.w) ? 'un' : '', hiS != null && t.s >= hiS && t.e <= hiE ? 'pick' : '', st.flash.has(t.s) ? 'rev' : ''].filter(Boolean).join(' ');
      h += `<span class="${cls}" data-t="${ti}"${mn ? ` data-ref="${mn.ref}" data-mid="${mn.id}" style="--rc:${f.col.get(mn.ref)}"` : ''} title="${esc(t.upos || 'not placed')}">${esc(text.slice(t.s, t.e))}</span>`;
      i = t.e;
    }
    if (end < text.length) h += `<span class="later">${esc(text.slice(end, Math.min(text.length, end + 1200)))}${end + 1200 < text.length ? '…' : ''}</span>`;
    return `<div class="doc">${h}</div>`;
  }
  function hero() {
    const f = fold(), s = st.sel; crumbGo = []; let h = crumbs();
    const modes = () => `<div class="modes">${[['scan', 'Raw', !!L], ['pdf', 'Raw + text', !!L], ['text', 'Text', true], ['json', 'JSON', true]].filter((m) => m[2]).map(([m, lab]) => `<button type="button" data-a="mode" data-m="${m}" class="${st.mode === m ? 'on' : ''}">${lab}</button>`).join('')}</div>`;
    const body = (sel) => st.mode === 'scan' && L ? L.pages.map((pg) => `<div class="pgh">page ${pg.n} — as scanned</div><div class="pg" style="aspect-ratio:${pg.w}/${pg.h}"><img src="${pg.image}" alt="page ${pg.n} as scanned"></div>`).join('') : st.mode === 'pdf' && L ? pdfHTML(L, R(), { selected: sel }) : st.mode === 'text' && L ? placeHTML(L, R(), { selected: sel, tilt: st.tilt }) : st.mode === 'json' ? `<div class="dim" style="margin-bottom:8px">the document's own structure, as tuples all the way down — [key, value, where]. Hover a grey note for its exact provenance.</div>${tupleHTML(structure())}` : docHTML();
    if (s.kind === 'doc' || !f) return h + modes() + body(null);
    if (s.kind === 'fclaim') {
      const c = form().claims.find((y) => y.id === s.id); if (!c) return h + modes() + body(null);
      return h + `<div class="tri"><span class="r" style="--rc:#c68bff">${esc(c.subject)}</span> <span class="a">—${esc(c.act)}→</span> <b style="color:#6ee7a8">${esc(c.object)}</b></div><div class="sub">${esc(c.type)} · read from the form's field on page ${c.page}${form().voice ? ` · signed ${esc(form().voice.name)}` : ''}</div>` + (L ? pdfHTML({ ...L, pages: L.pages.filter((p) => p.n === c.page) }, R(), { selected: { kind: 'field', id: c.field } }) : '');
    }
    if (s.kind === 'field') {
      const x = fields().find((y) => y.id === s.id); if (!x) return h + modes() + body(null);
      return h + `<h3>${esc(x.label)}</h3><div class="sub"><b style="color:#6ee7a8;font-size:17px">${esc(x.value)}</b> · ${esc(x.format)} · page ${x.page}</div>` + (L ? pdfHTML({ ...L, pages: L.pages.filter((p) => p.n === x.page) }, R(), { selected: s }) : '');
    }
    if (s.kind === 'ref' || s.kind === 'mention') {
      const id = f.resolve(s.ref), r = f.referents.get(id);
      if (!r) return h + `<div class="sub">This referent is no longer one of its own (merged or retracted at this point of the reading).</div>` + docHTML();
      const rc = f.col.get(id);
      h += `<h3 style="color:${rc}">${esc(r.name || '—')}</h3><div class="sub">${r.mentions.length} mention${r.mentions.length === 1 ? '' : 's'} · first established at statement ${r.born ?? '—'} · <span class="mono">${esc(id)}</span></div>`;
      if (L) { const onPages = new Set(); for (const m of r.mentions) for (const p of L.pages) if (p.words.some((w) => w.s >= m.s && w.e <= m.e)) onPages.add(p.n); if (onPages.size) h += pdfHTML({ ...L, pages: L.pages.filter((p) => onPages.has(p.n)).slice(0, 3) }, R(), { selected: { kind: 'ref', ref: id } }); }
      h += r.mentions.map((m, n) => `<div class="kwic${s.kind === 'mention' && s.mid === m.id ? ' sel' : ''}" data-sel='${esc(JSON.stringify({ kind: 'mention', ref: id, mid: m.id, n: n + 1 }))}'><span class="s">s${sentOf(m.s) ?? '?'}</span><span>${kwic(m.s, m.e, rc)}${m.kind === 'pronoun' ? ' <span class="dim">(pronoun)</span>' : ''}</span></div>`).join('');
      return h;
    }
    if (s.kind === 'word') {
      const k = s.w.toLowerCase(), occ = tokens().filter((t) => t.w.toLowerCase() === k);
      h += `<h3>“${esc(s.w)}”</h3><div class="sub">${occ.length} occurrence${occ.length === 1 ? '' : 's'} in the document</div>`;
      h += occ.map((t) => `<div class="kwic${t.s === s.s ? ' sel' : ''}" data-sel='${esc(JSON.stringify({ kind: 'word', w: t.w, s: t.s, e: t.e }))}'><span class="s">s${sentOf(t.s) ?? '?'}</span><span>${kwic(t.s, t.e, '#ffb454')}</span></div>`).join('');
      return h;
    }
    if (s.kind === 'claim') {
      const c = T.claims[s.i]; if (!c) return h + docHTML();
      const sn = sentOf(c.s), tl = TL(), sent = tl && sn ? tl.sentences[sn - 1] : { offset: c.s, text: text.slice(c.s, c.e) };
      const refOf = (name) => f.order.find((r) => r.surfaces.some((x) => x.toLowerCase() === String(name).toLowerCase()));
      const end = (name) => { const r = refOf(name); return r ? `<span class="r" style="--rc:${f.col.get(r.id)}" data-sel='${esc(JSON.stringify({ kind: 'ref', ref: r.id }))}'>${esc(name)}</span>` : esc(name); };
      h += `<div class="tri">${end(c.end1)} <span class="a">—${esc(c.label)}→</span> ${end(c.end2)}${c.polarity === '-' ? ' <span class="dim">(negated)</span>' : ''}</div><div class="sub">read from statement ${sn ?? '?'}</div>`;
      h += `<div class="doc">${esc(sent.text.slice(0, Math.max(0, c.s - sent.offset)))}<span class="pick">${esc(text.slice(c.s, c.e))}</span>${esc(sent.text.slice(Math.max(0, c.e - sent.offset)))}</div>`;
      return h;
    }
    if (s.kind === 'source' || s.kind === 'being') {
      const C = ctx.sources && ctx.sources(); if (!C || !C.corpus) return h + docHTML();
      if (s.kind === 'source') {
        const src = C.sources.find((x) => x.id === s.id); const men = [...C.fold.mentions.values()].filter((m) => m.source === s.id);
        let out = '', i = 0; for (const m of men.sort((a, b) => a.s - b.s)) { if (m.s < i) continue; out += esc(src.text.slice(i, m.s)) + `<span class="mn" style="--rc:#c68bff">${esc(src.text.slice(m.s, m.e))}</span>`; i = m.e; }
        out += esc(src.text.slice(i));
        return h + `<h3>${esc(src.label)}</h3><div class="sub">${esc(src.register || (src.auto && src.auto.register) || 'type unsure')} · ${men.length} mentions</div><div class="doc">${out}</div>`;
      }
      const b = C.fold.beings.find((x) => x.id === s.id); if (!b) return h + docHTML();
      h += `<h3>${esc(b.name || '—')}</h3><div class="sub">${esc(b.reality)} · met in ${new Set(b.ends.map((e) => e.source)).size} sources</div>`;
      for (const id of b.members) { const r = C.fold.referents.get(id); if (!r) continue; const src = C.sources.find((x) => x.id === (r.mentions[0] || {}).source); if (!src) continue;
        h += `<div class="ph">${esc(src.label)} · ${esc(src.register || (src.auto && src.auto.register) || '')}</div>` + r.mentions.map((m) => { const a = Math.max(0, m.s - 60), z = Math.min(src.text.length, m.e + 60); return `<div class="kwic"><span class="s">${esc(short(m.id))}</span><span>${esc(src.text.slice(a, m.s))}<b style="--rc:#c68bff">${esc(src.text.slice(m.s, m.e))}</b>${esc(src.text.slice(m.e, z))}</span></div>`; }).join(''); }
      return h;
    }
    return h + docHTML();
  }

  // ── right: where it came from ──
  const evRow = (e, f) => { const you = e.giver === 'you'; const gone = you && retracted().has(e.action);
    const what = e.op === 'INS' && e.kind === 'referent' ? 'established a referent' : e.op === 'INS' ? 'admitted a mention' : e.op === 'CON' ? (e.ref ? `linked the span to ${esc(refName(f, e.ref))}` : 'severed the span from any referent') : e.op === 'SYN' ? `merged ${e.from.map((x) => esc(refName(f, x))).join(', ')} into ${esc(refName(f, e.into))}` : e.op;
    return `<div class="ev${you ? ' you' : ''}${gone ? ' gone' : ''}"><div>${what}${e.frontier != null ? ` <span class="dim">at statement ${e.frontier}</span>` : ''}</div><div class="h">${esc(e.op)} · ${esc(e.giver || 'reader')} · ${esc(short(e.id))}${e.basis ? ' — ' + esc(String(e.basis).slice(0, 140)) : ''}</div>${you && !gone && e.action ? `<button type="button" data-a="undo" data-act="${esc(e.action)}">undo</button>` : ''}</div>`; };
  function prov() {
    const f = fold(), s = st.sel, tl = TL();
    if (s.kind === 'doc' || !f) {
      const J = ctx.readingJSON(T); const sn = snapAt(); const revs = tl && st.frontier != null ? tl.revisions.filter((r) => r.because && r.because.sentence === st.frontier) : [];
      return `<div class="ph">This reading</div><div class="kv">${extracted ? `<span class="k">text from</span><span>${esc(extracted)}</span>` : ''}${T.doc.truncated ? `<span class="k">read</span><span>the first ${text.length.toLocaleString()} characters</span>` : ''}<span class="k">bytes</span><span class="mono">${T.nBytes.toLocaleString()} · utf-8</span><span class="k">sha-256</span><span class="mono">${esc(T.hash)}</span><span class="k">source id</span><span class="mono">${esc(T.srcId)}</span><span class="k">statements</span><span>${nStmts()}</span><span class="k">words</span><span>${tokens().length.toLocaleString()} · ${unplaced().reduce((n, [, ts]) => n + ts.length, 0)} not placed</span></div>
        ${(() => { if (!L || !ctx.ledger) return ''; const g = ctx.ledger(); if (!g || !g.led) return ''; const c = layerCounts(g.led); return c.length ? `<div class="ph">Layers recorded</div><div class="ev"><div>${c.map(([k, n]) => `${esc(k)} ${n}`).join(' · ')}</div><div class="h">one append-only log, each event parented to the layer below it; “⤓ scan log” exports it</div></div>` : ''; })()}
        ${st.learned && st.learned.programs.length ? `<div class="ph">Its learned rules</div><div class="ev">${st.learned.structure ? `<div>structure: tables from ${st.learned.structure.tableMinCells} cells in runs of ${st.learned.structure.tableMinRun}, headings in capitals or type ${st.learned.structure.headSize}× the page's own</div><div class="h">${esc(st.learned.structure.from)} · held-out F ${st.learned.structure.default.f ?? ''} → ${st.learned.structure.heldOut.f ?? ''} on documents it never saw; a tilt, never a rewrite</div>` : '<div>structure: a learned program exists but is provisional, so the declared defaults are used</div><div class=\"h\">learned on a synthetic corpus only; see eval/LESSONS.md</div>'}<div class="h">${st.learned.rules.length} label rules</div></div>` : ''}
        ${st.ground ? `<div class="ph">Its ground for surprise</div><div class="ev">${st.ground.refused ? `<div>${esc(st.ground.refused)}</div>` : `<div>${esc(st.ground.genre)} prime · ${st.ground.tokens} tokens read · ${st.ground.cuts} cuts weighed</div><div class="h">${esc(st.ground.why)} · ${esc(st.ground.giver || '')}</div><div class="h">A section is where the earlier text stops predicting the later: each cut is ranked against random cuts in this document (median ${st.ground.nullMedian} bits/token).</div>`}</div>` : ''}
        ${st.hunt ? (() => { const H = st.hunt, r = H.result; if (!r) return `<div class="ph">Its prior</div><div class="ev"><div>${esc(H.status)}</div></div>`;
          if (!r.prior) return `<div class="ph">Its prior</div><div class="ev"><div>none found — read from the page alone</div><div class="h">${esc(r.steps.map((x) => x.step + (x.query ? ' “' + x.query + '”' : '') + (x.result ? ' → ' + x.result : x.why ? ' → ' + x.why : '')).join(' · '))}</div></div>`;
          const t = st.tilt; return `<div class="ph">Its prior</div><div class="ev"><div>${esc(r.prior.title || '')} ${r.prior.year || ''}</div><div class="h">${esc(r.prior.giver || '')} · <span class="mono">${esc(r.prior.source || '')}</span> · sha-256 ${esc(String(r.prior.sha256 || '').slice(0, 16))}…</div><div class="h">found in ${esc(r.where)} — ${esc(r.matched || '')}${r.query ? ' · query “' + esc(r.query) + '” by ' + esc(r.by) : ''}</div></div>${t ? t.pages.map((p) => `<div class="ev"><div>scan page ${p.n} → form page ${p.tn ?? '—'}</div><div class="h">${p.matched ? `aligned on ${p.align.pairs} shared words (±${p.align.rms}px) · ${Math.round(p.agreement * 100)}% of the form's print found on the scan` : esc(p.why)}</div></div>`).join('') : ''}<div class="dim">The prior only tilts the reading: a word the blank form prints here is weighed as printed, a word inside a box it leaves is weighed as filled in. Every label and value shown is the scan's own text.</div>`; })() : ''}
        <div class="ph">What it read with</div>${(J.priors || []).map((p) => `<div class="ev"><div>${esc(p.name)}${p.on === false ? ' <span class="dim">(switched off)</span>' : ''}</div><div class="h">given by ${esc(p.giver || '—')}</div></div>`).join('')}
        <div class="ph">What left this browser</div><div class="ev"><div>${J.run.model_calls} model calls</div><div class="h">${J.run.network.length} network requests, all for the page's own priors and code: ${J.run.network.map((u) => esc(String(u).split('/').pop())).join(', ') || 'none'}</div></div>
        ${revs.length ? `<div class="ph">What statement ${st.frontier} changed</div>${revs.map((r) => `<div class="ev"><div>${esc(r.kind)}: “${esc(String(r.text).slice(0, 40))}” ${esc(String(r.from).slice(0, 40))} → ${esc(String(r.to).slice(0, 40))}</div></div>`).join('')}` : ''}
        <div class="ph">Select anything</div><div class="dim">a name, a word, a claim — on the page or in the index — to see where it came from.</div>`;
    }
    if (s.kind === 'ref' || s.kind === 'mention') {
      const id = f.resolve(s.ref), r = f.referents.get(id); if (!r) return '';
      const log = [...(tl ? tl.log : []), ...st.overlay];
      const ins = log.find((e) => e.op === 'INS' && e.kind === 'referent' && (e.ref === id || r.absorbed.includes(e.ref)));
      const others = f.order.filter((x) => x.id !== id && x.mentions.length).slice(0, 60).map((x) => `<option value="${x.id}">${esc(x.name || short(x.id))} (×${x.mentions.length})</option>`).join('');
      let h = `<div class="ph">The referent</div><div class="kv"><span class="k">id</span><span class="mono">${esc(id)}</span><span class="k">means</span><span>the hash of the event that established it — not of any spelling</span><span class="k">surfaces</span><span>${r.surfaces.map(esc).join(' · ')}</span>${r.absorbed.length ? `<span class="k">merged in</span><span class="mono">${r.absorbed.map(esc).join(', ')}</span>` : ''}</div>`;
      if (ins) h += evRow(ins, f);
      if (s.kind === 'mention') {
        const m = f.mentions.get(s.mid);
        if (m) { const hist = f.history.get(m.id) || [];
          h += `<div class="ph">This mention</div><div class="kv"><span class="k">span id</span><span class="mono">${esc(m.id)}</span><span class="k">bytes</span><span class="mono">${bytes(m.s, m.e)}</span><span class="k">text</span><span>“${esc(m.text)}”${m.kind === 'pronoun' ? ' (pronoun)' : ''}</span></div>${hist.map((e) => evRow(e, f)).join('')}`;
          const v = f.voices(m.s, T.timeline.source && T.timeline.source.id); if (v && v.depth) h += `<div class="ph">Who says this sentence</div>${v.chain.slice().reverse().map((x, i) => `<div class="ev"><div>${i ? '↳ ' : ''}${esc(x.root ? (x.label || 'the source itself') : (x.name || 'someone unnamed'))}${x.frame && x.frame.verb ? ` <span class="dim">“${esc(x.frame.verb)}”</span>` : ''}</div></div>`).join('')}`;
          h += `<div class="ph">Correct it</div><div class="fix"><button type="button" data-a="sever" data-mid="${esc(m.id)}">not this one</button><select data-a="reassign" data-mid="${esc(m.id)}"><option value="">this is someone else…</option><option value="__new">a new referent</option>${others}</select></div>`;
        }
      } else h += `<div class="ph">Correct it</div><div class="fix"><select data-a="merge" data-ref="${esc(id)}"><option value="">same as…</option>${others}</select></div><div class="dim">Or open one mention and say it is someone else.</div>`;
      const mine = st.overlay.filter((e) => e.giver === 'you' && e.kind !== 'retract');
      if (mine.length) h += `<div class="ph">Your events</div><div class="dim" style="margin-bottom:4px">appended on top of the reader's log, which is untouched; undo is one more event</div>${mine.map((e) => evRow(e, f)).join('')}`;
      return h;
    }
    if (s.kind === 'fclaim') {
      const F = form(), c = F.claims.find((y) => y.id === s.id); if (!c) return '';
      return `<div class="ph">This statement</div><div class="kv"><span class="k">said by</span><span>${esc(F.filer.name)} <span class="dim">— ${esc(F.filer.basis)}</span></span>${F.voice ? `<span class="k">signed</span><span>${esc(F.voice.name)} <span class="dim">— ${esc(F.voice.basis)}</span></span>` : ''}<span class="k">says</span><span>${esc(c.act)}</span><span class="k">is</span><span><b>${esc(c.object)}</b></span><span class="k">type</span><span>${esc(c.type)} <span class="dim">(the value's shape)</span></span><span class="k">page</span><span>${c.page}</span><span class="k">label box</span><span class="mono">${c.label_box.map(Math.round).join(', ')}</span><span class="k">value box</span><span class="mono">${c.value_box.map(Math.round).join(', ')}</span><span class="k">characters</span><span class="mono">${c.chars[0]}–${c.chars[1]}</span><span class="k">confidence</span><span>${c.conf}% (OCR, the value's words)</span></div>
        <div class="ph">How it was read</div><div class="ev"><div>a form's field is a statement its filer makes: (filer, label, value)</div><div class="h">the field: Alhazen extractFormFields · its type: Alhazen valueFormat · the words: ${esc(extracted || 'the text')}</div></div><div class="dim">A form says what its filer says; reading it is not checking it.</div>`;
    }
    if (s.kind === 'field') {
      const x = fields().find((y) => y.id === s.id); if (!x) return '';
      return `<div class="ph">This field</div><div class="kv"><span class="k">label</span><span>${esc(x.label)}</span><span class="k">value</span><span><b>${esc(x.value)}</b></span><span class="k">format</span><span>${esc(x.format)} <span class="dim">(the value's shape; Alhazen's valueFormat)</span></span><span class="k">page</span><span>${x.page}</span><span class="k">label box</span><span class="mono">${x.lb.map(Math.round).join(', ')}</span><span class="k">value box</span><span class="mono">${x.vb.map(Math.round).join(', ')}</span><span class="k">characters</span><span class="mono">${x.s}–${x.e}</span><span class="k">OCR confidence</span><span>${x.conf}% (the value's words)</span></div>
        ${(() => { const g = ctx.ledger && ctx.ledger(); if (!g || !g.led) return ''; const ev = g.led.events.find((e) => e.stage === 'field' && e.detail && e.detail.id === s.id); if (!ev) return ''; const kids = g.led.events.filter((e) => e.parent === ev.event_id); return `<div class="ph">How it was read</div><div class="ev">${[...kids.map((k) => ({ stage: k.stage, transform: k.transform })).reverse(), ...chainOf(g.led, ev.event_id).map((e) => ({ stage: e.stage, transform: e.transform }))].map((e) => `<div>${esc(e.stage)} <span class="h">${esc(e.transform || '')}</span></div>`).join('')}</div>`; })()}
        ${x.prior ? `<div class="ph">What the blank form says here</div><div class="kv"><span class="k">form</span><span>${esc(x.prior.form || '')} ${x.prior.year || ''}, page ${x.prior.page}</span><span class="k">its box</span><span class="mono">${esc(x.prior.box || 'none here')}</span>${x.prior.printed_beside_it ? `<span class="k">prints beside it</span><span>“${esc(x.prior.printed_beside_it)}”</span>` : ''}${x.prior.column_on_form ? `<span class="k">its column</span><span>“${esc(x.prior.column_on_form)}”</span>` : ''}<span class="k">weight</span><span>${x.amp} <span class="dim">(1 = the page alone; ${x.prior.filled}% of the value sits in a fill-in box, ${x.prior.value_printed}% is printed on the blank form)</span></span></div><div class="dim">The form's words are evidence, shown as the form's; the reading keeps the scan's own.</div>` : ''}
        <div class="ph">How it was read</div><div class="ev"><div>a label and a value on one printed line</div><div class="h">Alhazen extractFormFields — a colon, or a wide gap on the page, between them</div></div><div class="ev"><div>the words, from the page's pixels</div><div class="h">${esc(extracted || 'OCR')}</div></div>`;
    }
    if (s.kind === 'word') {
      const t = tokens().find((x) => x.s === s.s) || {}; const c = ctx.explainWord(s.w) || {}; const acts = ctx.actsOf(s.w) || [];
      const revs = tl ? tl.revisions.filter((r) => r.kind === 'pos' && r.s === s.s) : [];
      return `<div class="ph">This word</div><div class="kv"><span class="k">bytes</span><span class="mono">${bytes(s.s, s.e)}</span><span class="k">read as</span><span>${esc(t.upos || 'not placed')}${t.ambiguous ? ' <span class="dim">(ambiguous)</span>' : ''}</span><span class="k">because</span><span>${esc(ATTESTED[t.attested] || (t.upos ? t.attested : 'no prior holds this form, and the document does not settle it'))}</span>${(t.via || []).length ? `<span class="k">after</span><span>${t.via.map(esc).join(' → ')}</span>` : ''}${c.candidates && c.candidates.length ? `<span class="k">candidates</span><span>${c.candidates.slice(0, 4).map((x) => `${esc(x.upos)}${x.share != null ? ' ' + Math.round(x.share * 100) + '%' : ''}`).join(' · ')}</span>` : ''}${acts.length ? `<span class="k">its act</span><span>${acts.slice(0, 5).map(esc).join(' · ')} <span class="dim">(a set, never one chosen)</span></span>` : ''}</div>
        ${revs.length ? `<div class="ph">How the reading changed its mind</div>${revs.map((r) => `<div class="ev"><div>${esc(r.from)} → ${esc(r.to)}</div><div class="h">at statement ${r.because && r.because.sentence}</div></div>`).join('')}` : ''}`;
    }
    if (s.kind === 'claim') {
      const c = T.claims[s.i]; if (!c) return '';
      const v = f.voices(c.s, T.timeline && T.timeline.source && T.timeline.source.id);
      return `<div class="ph">This claim</div><div class="kv"><span class="k">bytes</span><span class="mono">${bytes(c.s, c.e)}</span><span class="k">act</span><span>${esc(c.label)}</span><span class="k">polarity</span><span>${c.polarity === '-' ? 'negated' : 'affirmed'}</span><span class="k">standing</span><span>${esc(c.standing || (c.contested ? 'contested' : 'read'))}</span></div>
        ${v && v.chain.length ? `<div class="ph">Who says it</div>${v.chain.slice().reverse().map((x, i) => `<div class="ev"><div>${i ? '↳ ' : ''}${esc(x.root ? (x.label || 'the source itself') : (x.name || 'someone unnamed'))}${x.frame && x.frame.verb ? ` <span class="dim">“${esc(x.frame.verb)}”</span>` : ''}</div><div class="h">${x.root ? 'the source’s own voice' : esc(x.frame.form)}</div></div>`).join('')}<div class="dim">A frame says who holds a sentence in their saying — never that it is true.</div>` : ''}`;
    }
    if (s.kind === 'source' || s.kind === 'being') {
      const C = ctx.sources && ctx.sources(); if (!C || !C.corpus) return '';
      if (s.kind === 'source') { const src = C.sources.find((x) => x.id === s.id); const a = src.auto; return `<div class="ph">This source</div><div class="kv"><span class="k">type</span><span>${esc(src.register || (a && a.register) || 'unsure')}${a && !src.register ? ` · inferred, ${Math.round(a.p * 100)}%` : src.register ? ' · declared' : ''}</span><span class="k">because</span><span>${esc(a && a.ranked && a.ranked[0] ? a.ranked[0].why.join('; ') : '—')}</span><span class="k">id</span><span class="mono">${esc(src.id)}</span></div>`; }
      const b = C.fold.beings.find((x) => x.id === s.id); if (!b) return '';
      const links = C.fold.links.filter((l) => b.members.includes(l.fromRoot) || b.members.includes(l.toRoot)), lab = (id) => (C.sources.find((x) => x.id === id) || {}).label || id;
      return `<div class="ph">Why these are one being</div>${links.map((l) => `<div class="ev${l.giver === 'you' ? ' you' : ''}"><div>${esc(lab(l.from.source))} ⟶ ${esc(lab(l.to.source))}: ${esc(l.split.kind)}</div><div class="h">${esc(l.checkedBy || '')}</div></div>`).join('') || '<div class="dim">no link</div>'}<div class="dim">Each end keeps its own source and type; a being is only a view over the links.</div>`;
    }
    return '';
  }

  // ── bottom: replay + layers ──
  function bar() {
    const n = nStmts(), f = st.frontier == null ? n : st.frontier, off = ctx.layers.filter((l) => st.features[l.feature] === false).length;
    return `<button type="button" data-a="play" title="replay the reading statement by statement">${st.playing ? '❚❚' : '▶'}</button><input type="range" min="1" max="${Math.max(1, n)}" value="${f}" data-a="scrub" aria-label="statement"><span class="at">${f} / ${n}</span>
      <details class="lyr"><summary>layers${off ? ` · ${off} off` : ''}</summary><div class="lyrm">${ctx.layers.map((l) => `<label title="${esc(l.why)}"><input type="checkbox" data-a="layer" data-f="${l.feature}"${st.features[l.feature] !== false ? ' checked' : ''}>${esc(l.label)}</label>`).join('')}<div class="dim">switch one off and the reading re-runs</div></div></details>${st.delta ? `<span class="delta">${esc(st.delta)}</span>` : ''}`;
  }

  function render() {
    $('.top h2').textContent = title;
    const J = ctx.readingJSON(T); $('.proof').textContent = `${J.run.steps} steps · ${J.run.ms} ms · ${J.run.network.length} network requests · ${J.run.model_calls} model calls · nothing overwritten`;
    $('.idx').innerHTML = index(); $('.hero').innerHTML = hero(); $('.prov').innerHTML = prov(); $('.bar').innerHTML = bar();
    st.flash.clear();
    const on1 = root.querySelector('.hero .fb.on, .hero .wb.on, .hero .pw.on'); if (on1) on1.scrollIntoView({ block: 'center' });
  }

  // ── corrections: your events, appended; undo is a retraction, also appended ──
  let nAct = 0;
  const mk = (body, action) => { const ev = { ...body, giver: 'you', action, frontier: st.frontier ?? nStmts() }; ev.id = 'evt_' + ctx.hash(JSON.stringify(ev) + st.overlay.length).slice(0, 16); return ev; };
  const currentCon = (mid) => { const f = fold(); return f && f.cons.get(mid); };
  function act(name, a) {
    const action = `you_${++nAct}_${Date.now().toString(36)}`, f = fold();
    if (name === 'sever') st.overlay.push(mk({ op: 'CON', ...CELLS.CON, span: a.mid, ref: null, supersedes: currentCon(a.mid) ?? null, basis: 'you: not this one' }, action));
    else if (name === 'reassign' && a.to === '__new') { const m = f.mentions.get(a.mid); const ins = mk({ op: 'INS', ...CELLS.INS, kind: 'referent', seed: a.mid, basis: `you: “${m ? m.text : ''}” is someone of its own` }, action); ins.ref = 'ref_' + ins.id.slice(4); st.overlay.push(ins, mk({ op: 'CON', ...CELLS.CON, span: a.mid, ref: ins.ref, supersedes: currentCon(a.mid) ?? null, basis: 'you' }, action)); st.sel = { kind: 'ref', ref: ins.ref }; }
    else if (name === 'reassign') { st.overlay.push(mk({ op: 'CON', ...CELLS.CON, span: a.mid, ref: a.to, supersedes: currentCon(a.mid) ?? null, basis: `you: this is ${refName(f, a.to)}` }, action)); }
    else if (name === 'merge') { st.overlay.push(mk({ op: 'SYN', ...CELLS.SYN, from: [a.ref], into: a.to, basis: `you: ${refName(f, a.ref)} is ${refName(f, a.to)}` }, action)); st.sel = { kind: 'ref', ref: a.to }; }
    else if (name === 'undo') st.overlay.push({ op: 'CON', kind: 'retract', retracts: a.act, giver: 'you', action: `undo_${a.act}`, id: 'evt_undo_' + a.act });
    foldKey = ''; render();
  }

  // ── events ──
  let timer = null;
  const stop = () => { clearInterval(timer); timer = null; st.playing = null; };
  const play = () => { if (timer) { stop(); render(); return; } const n = nStmts(); if (st.frontier == null || st.frontier >= n) st.frontier = 1; st.playing = true;
    const step = () => { const tl = TL(); const before = new Map(tokens().map((t) => [t.s, t.upos])); st.frontier = Math.min(n, (st.frontier || 0) + 1);
      for (const t of tokens()) if (before.has(t.s) && before.get(t.s) !== t.upos) st.flash.add(t.s);
      if (tl) for (const r of tl.revisions) if (r.because && r.because.sentence === st.frontier && r.s != null) st.flash.add(r.s);
      if (st.frontier >= n) { stop(); st.frontier = null; } render(); };
    render(); timer = setInterval(step, 900); };
  on(root, 'click', (e) => {
    const cr = e.target.closest('[data-crumb]'); if (cr) { const c = [{ kind: 'doc' }]; const s = st.sel; if ((s.kind === 'mention') && +cr.dataset.crumb === 2) return select({ kind: 'ref', ref: s.ref, name: s.name }); return select(c[0]); }
    const rs = e.target.closest('[data-rsort]'); if (rs) { st.rsort = nextSort(st.rsort || { key: 'mentions', dir: 'desc' }, rs.dataset.rsort); return render(); }
    const it = e.target.closest('[data-sel]'); if (it && !e.target.closest('select')) return select(JSON.parse(it.dataset.sel));
    const w = e.target.closest('.doc .w');
    if (w && st.sel.kind === 'doc' || w && e.target.closest('.hero')) { if (w.dataset.ref) return select({ kind: 'ref', ref: w.dataset.ref }); const t = tokens()[+w.dataset.t]; if (t) return select({ kind: 'word', w: t.w, s: t.s, e: t.e }); }
    const b = e.target.closest('button[data-a], a[data-a]'); if (!b) return; const a = b.dataset.a;
    if (a === 'mode') { st.mode = b.dataset.m; return render(); } if (a === 'showclaims') { st.showClaims = true; return render(); }
    if (a === 'mt') { root.dataset.m = b.dataset.m; root.querySelectorAll('.seg button').forEach((x) => x.classList.toggle('on', x === b)); root.querySelector('.body').scrollTop = 0; return; }
    if (a === 'more') { root.querySelector('.dl').classList.toggle('open'); return; }
    if (a === 'layers') { ctx.showLayers && ctx.showLayers(); return; }
    if (a === 'scanlog' && L) { const g = recordLayers(); if (g) ctx.download(`${(T.doc.label || 'reading').replace(/[^\w]+/g, '-').slice(0, 40)}-scan-log.json`, JSON.stringify(g.led.eot({ root: T.eot && T.eot.root }), null, 1), 'application/json'); } else if (a === 'html' && L) ctx.download(`${(T.doc.label || 'reading').replace(/[^\w]+/g, '-').slice(0, 40)}-reading.html`, htmlExport(L, R(), { title: T.doc.label || 'reading', tilt: st.tilt }), 'text/html;charset=utf-8'); else if (a === 'close') close(); else if (a === 'json') ctx.download(`${(T.doc.label || 'reading').replace(/[^\w]+/g, '-').slice(0, 40)}-reading.json`, JSON.stringify({ reading: structure(), run: ctx.readingJSON(T).run, corrections: st.overlay }, null, 2), 'application/json');
    else if (a === 'play') play(); else if (a === 'sever') act('sever', { mid: b.dataset.mid }); else if (a === 'undo') act('undo', { act: b.dataset.act });
  });
  on(root, 'change', async (e) => {
    const el = e.target, a = el.dataset.a;
    if (a === 'reassign' && el.value) act('reassign', { mid: el.dataset.mid, to: el.value });
    else if (a === 'merge' && el.value) act('merge', { ref: el.dataset.ref, to: el.value });
    else if (a === 'layer') { st.features = { ...st.features, [el.dataset.f]: el.checked }; stop(); await ctx.rerun(st.features, { sel: st.sel, overlay: st.overlay }); }
  });
  root.addEventListener('toggle', (e) => { const d = e.target; if (!d.classList || !d.classList.contains('jt') || !d.open || d.querySelector(':scope > .jc')) return; const node = d.dataset.path === ROOT_PATH ? structure() : tupleAt(structure(), d.dataset.path); if (node && Array.isArray(node[1])) d.insertAdjacentHTML('beforeend', tupleChildren(node[1], d.dataset.path, 9)); }, { capture: true, signal: ac.signal });
  on(root, 'input', (e) => { if (e.target.dataset.a === 'scrub') { stop(); const v = +e.target.value; st.frontier = v >= nStmts() ? null : v; render(); } });
  on(document, 'keydown', (e) => { if (!root.classList.contains('on') || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return; if (e.key === 'Escape') { if (st.sel.kind !== 'doc') select({ kind: 'doc' }); else close(); } });
  T.onTimeline = () => { foldKey = ''; render(); };
  function close() { stop(); ac.abort(); root.classList.remove('on'); ctx.onClose && ctx.onClose(); }
  if (ctx.keep) { if (ctx.keep.overlay) st.overlay = ctx.keep.overlay; if (ctx.keep.sel) st.sel = ctx.keep.sel; }
  render();
  return { close, state: st, select, render, T };
}
