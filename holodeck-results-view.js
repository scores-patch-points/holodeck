// holodeck-results-view.js — three ways to read the results of a search, over the same rows.
//
//   cards    each result as a card: the page the phrase sits on (marked), the sentence around it, and what it appears with
//   context  each result as a row: the page, the passage, and a small graph of the phrase and the names around it
//   map      every result on one concept map (the phrase in the middle, names around it, documents outside), with an
//            inspector for the one you click
//
// DOM only, like holodeck-referents-view.js: no data work lives here. The page hands over `data` (the rows, with the passages the
// phrase was found in and the names the reader found beside it); a position on the page comes from the VM (`where`) and is drawn only
// when the VM found one — a scanned page with no text layer says so instead of getting a made-up box. Colours are the page's own
// theme variables, so light and dark both work, and a name's colour is the reader's own for its type.

const NS = 'http://www.w3.org/2000/svg';
const CSS = `
.rv{container-type:inline-size;font:400 14px/1.45 var(--sans);color:var(--ink);--rv-hl:rgba(240,180,41,.45)}
.rv *{box-sizing:border-box}
.rv .rv-sum{display:flex;gap:6px 14px;flex-wrap:wrap;align-items:baseline;margin:2px 0 14px;color:var(--mut);font-size:13.5px}
.rv .rv-sum b{color:var(--ink);font-weight:600}
.rv .rv-lab{font:700 11px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--acc)}
.rv .rv-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px}
.rv .rv-card,.rv .rv-row,.rv .rv-insp{background:var(--s1);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.rv .rv-card{display:flex;flex-direction:column}
.rv .rv-body{padding:14px;display:flex;flex-direction:column;gap:10px;min-width:0}
.rv .rv-title{font-weight:600;font-size:15px;line-height:1.3;background:none;border:0;padding:0;text-align:left;color:var(--ink);cursor:pointer}
.rv .rv-title:hover{color:var(--acc)}
.rv .rv-sub{color:var(--mut);font-size:12.5px}
.rv .rv-pass{font-size:13.5px;line-height:1.55;color:var(--ink2,var(--ink));overflow-wrap:anywhere}
.rv .rv-row .rv-pass{font-size:15px;border-left:3px solid var(--rv-hl);padding-left:12px}
.rv mark{background:var(--rv-hl);color:inherit;border-radius:3px;padding:0 2px;font-weight:600}
.rv .rv-chips{display:flex;flex-wrap:wrap;gap:6px}
.rv .rv-chip{font-size:12px;padding:3px 9px;border-radius:99px;white-space:nowrap}
.rv .rv-chip i{font-style:normal;opacity:.7}
.rv .rv-with{border-top:1px solid var(--line);padding-top:10px;display:flex;flex-direction:column;gap:7px}
.rv .rv-none{color:var(--mut);font-size:12.5px}
.rv .rv-page{position:relative;overflow:hidden;background:var(--bg);border-bottom:1px solid var(--line)}
.rv .rv-sheet{position:absolute;left:0;right:0;top:0;background:#fff}
.rv .rv-sheet img,.rv .rv-thumb{display:block;width:100%;height:100%;object-fit:cover}
.rv .rv-box{position:absolute;border:2px solid var(--acc);background:var(--rv-hl);border-radius:3px;box-shadow:0 0 0 3px color-mix(in srgb,var(--acc) 22%,transparent)}
.rv .rv-pg{position:absolute;left:8px;bottom:8px;max-width:calc(100% - 70px);background:#14161f;color:#fff;font:600 11px var(--mono);padding:3px 7px;border-radius:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:.03em}
.rv .rv-pdf{position:absolute;right:8px;bottom:8px;background:#d93025;color:#fff;font:700 12px var(--sans);padding:3px 8px;border-radius:6px}
.rv .rv-row .rv-pgx{display:none}
.rv .rv-rows{display:flex;flex-direction:column;gap:14px}
.rv .rv-row{display:grid;grid-template-columns:150px minmax(0,1fr) 270px;gap:20px;padding:16px;align-items:stretch}
.rv .rv-row .rv-page{height:200px;border:1px solid var(--line);border-radius:8px}
.rv .rv-graph{background:var(--bg);border-radius:10px;min-height:200px;display:flex;align-items:center;justify-content:center}
.rv .rv-graph svg{width:100%;max-width:360px;height:auto;max-height:230px;display:block;margin:0 auto}
.rv .rv-map{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,340px);gap:20px;align-items:start}
.rv .rv-mapbox{background:var(--s1);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.rv .rv-mapbox svg{width:100%;height:auto;display:block}
.rv .rv-insp{padding:16px;display:flex;flex-direction:column;gap:12px;min-width:0}
.rv .rv-insp .rv-page{height:150px;border:1px solid var(--line);border-radius:8px}
.rv .rv-more{color:var(--mut);font-size:12.5px;margin-top:10px}
.rv svg text{font-family:var(--sans)}
.rv .rv-doc{cursor:pointer}
.rv .rv-open{align-self:flex-start;background:none;border:1px solid var(--line2);border-radius:8px;color:var(--acc);cursor:pointer;font:500 13px var(--sans);padding:5px 12px}
@container (max-width:760px){
  .rv .rv-row{grid-template-columns:110px minmax(0,1fr)}
  .rv .rv-row .rv-graph{grid-column:1 / -1}
  .rv .rv-map{grid-template-columns:minmax(0,1fr)}
}
@container (max-width:420px){ .rv .rv-row{grid-template-columns:minmax(0,1fr)} .rv .rv-row .rv-page{height:170px} .rv .rv-row .rv-pgx{display:inline} }
`;

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const k in props || {}) { const v = props[k]; if (v == null || v === false) continue;
    if (k === 'class') el.className = v; else if (k === 'style') el.style.cssText = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else el.setAttribute(k, v === true ? '' : v); }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}
function s(tag, attrs, ...kids) {
  const el = document.createElementNS(NS, tag);
  for (const k in attrs || {}) if (attrs[k] != null) el.setAttribute(k, attrs[k]);
  for (const c of kids.flat()) if (c != null) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}
const tint = (c, pct = 16) => 'color-mix(in srgb,' + c + ' ' + pct + '%,var(--s1))';
const plural = (n, w) => n.toLocaleString() + ' ' + w + (n === 1 ? '' : 's');
const clip = (t, n) => (t.length > n ? t.slice(0, n - 1) + '…' : t);

// the sentence around the phrase, the phrase marked (its marks come from the VM, offsets into the passage)
function passage(hit) {
  const t = hit.text || '', out = []; let pos = 0;
  for (const [a, b] of (hit.marks || []).slice().sort((x, y) => x[0] - y[0])) { if (a < pos) continue; out.push(t.slice(pos, a), h('mark', null, t.slice(a, b))); pos = b; }
  out.push(t.slice(pos));
  return h('div', { class: 'rv-pass' }, hit.before ? '… ' : '', out.map(x => (typeof x === 'string' ? x.replace(/\s+/g, ' ') : x)), hit.after ? ' …' : '');
}
const chips = (ents, max = 8) => ents.length
  ? h('div', { class: 'rv-chips' }, ents.slice(0, max).map(e => h('span', { class: 'rv-chip', style: 'background:' + tint(e.color) + ';color:' + e.color }, e.name, h('i', null, ' ·' + e.n))))
  : h('div', { class: 'rv-none' }, 'No names were read beside it.');

// what the result has in common with the others: the same contract, or shared names
function relation(d, docs) {
  const same = docs.filter(o => o !== d && o.number && o.number === d.number);
  if (same.length) return 'Same contract number (' + d.number + ') as ' + same.map(o => o.short).join(', ') + '.';
  const mine = new Set(d.ents.map(e => e.name)); let best = null;
  for (const o of docs) { if (o === d) continue; const c = o.ents.filter(e => mine.has(e.name)).map(e => e.name); if (c.length && (!best || c.length > best.c.length)) best = { o, c }; }
  return best ? 'Shares ' + plural(best.c.length, 'name') + ' with ' + best.o.short + ': ' + best.c.slice(0, 3).join(', ') + '.' : (docs.length > 1 ? 'No other result shares a name with it.' : '');
}

export function mountResultsView(host, opts = {}) {
  if (!document.getElementById('hd-rv-css')) { const st = document.createElement('style'); st.id = 'hd-rv-css'; st.textContent = CSS; document.head.append(st); }
  const root = h('div', { class: 'rv' }); host.append(root);
  let data = null, mode = 'cards', sel = 0, dead = false;
  const whereCache = new Map(); let inflight = 0; const queue = [];
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(es => es.forEach(e => e.target._fit && e.target._fit())) : null;

  // a position is asked for lazily and a few at a time: each is a PDF read on the VM
  function locate(d) {
    const k = d.token + '|' + data.q;
    if (!whereCache.has(k)) whereCache.set(k, new Promise(res => { queue.push(() => Promise.resolve(opts.whereOf ? opts.whereOf(d) : null).then(res, () => res(null)).finally(() => { inflight--; pump(); })); pump(); }));
    return whereCache.get(k);
  }
  function pump() { while (inflight < 3 && queue.length) { inflight++; queue.shift()(); } }

  // the page the phrase sits on, with the place marked; or the first page and a plain statement that the place is not known
  function pageArt(d, height) {
    const el = h('div', { class: 'rv-page', style: 'height:' + height + 'px' });
    const label = h('div', { class: 'rv-pg' }, 'locating…'); el.append(h('div', { class: 'rv-pdf' }, 'PDF'), label);
    const first = () => { if (d.thumb) el.prepend(h('img', { class: 'rv-thumb', src: d.thumb, alt: '', loading: 'lazy' })); };
    locate(d).then(w => {
      if (dead || !el.isConnected && !el.parentNode) return;
      const f = w && w.found && w.found[0];
      if (!f) { first(); label.textContent = w && w.pages ? 'P.1 of ' + w.pages + ' · place not found' : 'place not found'; label.title = (w && w.note) || ''; return; }
      const sheet = h('div', { class: 'rv-sheet', style: 'aspect-ratio:' + f.w + '/' + f.h }, h('img', { src: opts.pageUrl(d, f.page, 460), alt: '', loading: 'lazy' }),
        h('div', { class: 'rv-box', style: 'left:' + f.box[0] * 100 + '%;top:' + f.box[1] * 100 + '%;width:' + f.box[2] * 100 + '%;height:' + f.box[3] * 100 + '%' }));
      el.prepend(sheet);
      el._fit = () => { const W = el.clientWidth, H = height, Hs = W * f.h / f.w; sheet.style.transform = 'translateY(' + Math.round(Math.max(H - Hs, Math.min(0, H / 2 - (f.box[1] + f.box[3] / 2) * Hs))) + 'px)'; };
      el._fit(); if (ro) ro.observe(el);
      label.replaceChildren('P.' + f.page, h('span', { class: 'rv-pgx' }, (w.pages ? ' of ' + w.pages : '') + (w.found.length > 1 ? ' · +' + (w.found.length - 1) + ' more' : '')));
    });
    return el;
  }
  const title = d => h('button', { class: 'rv-title', onclick: () => opts.onOpen && opts.onOpen(d.id), title: 'Open this contract' }, d.title);
  const sub = d => h('div', { class: 'rv-sub' }, [d.year ? 'source ' + d.year : '', plural(d.hitTotal, 'mention')].filter(Boolean).join(' · '));

  function cards() {
    const ents = new Set(); data.docs.forEach(d => d.ents.forEach(e => ents.add(e.name)));
    return [h('div', { class: 'rv-sum' }, h('span', null, h('b', null, data.docs.length), ' found'), h('span', null, plural(data.docs.reduce((n, d) => n + d.hitTotal, 0), 'mention')), h('span', null, plural(ents.size, 'name') + ' beside it'),
        h('span', null, 'Each card shows where the phrase sits on the page, the sentence around it, and what it appears with.')),
      h('div', { class: 'rv-cards' }, data.docs.map(d => h('div', { class: 'rv-card' }, pageArt(d, 170),
        h('div', { class: 'rv-body' }, h('div', null, title(d), sub(d)), d.hits[0] ? passage(d.hits[0]) : null,
          h('div', { class: 'rv-with' }, h('div', { class: 'rv-lab' }, 'Appears with'), chips(d.ents))))))];
  }

  // the phrase and the names around it, one document at a time
  function localGraph(d) {
    const W = 270, H = 200, cx = 135, cy = 100, ents = d.ents.slice(0, 6), svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Names around the phrase' });
    ents.forEach((e, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / ents.length, x = cx + 98 * Math.cos(a), y = cy + 74 * Math.sin(a);
      svg.append(s('line', { x1: cx, y1: cy, x2: x, y2: y, stroke: 'var(--acc)', 'stroke-opacity': '.45', 'stroke-width': 1 + e.n * .6 })); });
    const pill = (x, y, txt, fill, color, bold, border) => { const w = Math.min(130, txt.length * (bold ? 7 : 6.1) + 18);
      return s('g', null, s('rect', { x: x - w / 2, y: y - 11, width: w, height: 22, rx: 11, fill, stroke: border || 'none', 'stroke-width': 1.5 }), s('text', { x, y: y + 4, 'text-anchor': 'middle', 'font-size': bold ? 12 : 11, 'font-weight': bold ? 700 : 500, fill: color }, clip(txt, 20))); };
    ents.forEach((e, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / ents.length; svg.append(pill(cx + 98 * Math.cos(a), cy + 74 * Math.sin(a), e.name, tint(e.color, 22), e.color)); });
    svg.append(pill(cx, cy, data.q, 'var(--rv-hl)', 'var(--ink)', true, 'var(--acc)'));
    return h('div', { class: 'rv-graph' }, ents.length ? svg : h('div', { class: 'rv-none', style: 'padding:16px' }, 'No names were read beside the phrase in this document.'));
  }
  function context() {
    return [h('div', { class: 'rv-sum' }, h('span', null, h('b', null, data.docs.length), ' found'), h('span', null, 'Each row: the page, the passage, and the names around the phrase.')),
      h('div', { class: 'rv-rows' }, data.docs.map(d => h('div', { class: 'rv-row' }, pageArt(d, 200),
        h('div', { class: 'rv-body' }, h('div', { style: 'display:flex;justify-content:space-between;gap:10px;align-items:baseline' }, title(d), h('span', { class: 'rv-sub', style: 'white-space:nowrap' }, d.year ? 'source ' + d.year : '')),
          h('div', { class: 'rv-lab' }, plural(d.hitTotal, 'mention') + (d.dept ? ' · ' + d.dept : '')), d.hits[0] ? passage(d.hits[0]) : null,
          h('div', { class: 'rv-sub' }, relation(d, data.docs))), localGraph(d))))];
  }

  // every result, every name, on one map; click a document to read it in the inspector
  function map() {
    const docs = data.docs.slice(0, 12), W = 640, H = 580, cx = 320, cy = 290;
    const tot = new Map(); docs.forEach(d => d.ents.forEach(e => { const t = tot.get(e.name) || { ...e, n: 0 }; t.n += e.n; tot.set(e.name, t); }));
    const ents = [...tot.values()].sort((a, b) => b.n - a.n).slice(0, 8), at = new Map();
    ents.forEach((e, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / ents.length; at.set(e.name, [cx + 122 * Math.cos(a), cy + 106 * Math.sin(a)]); });
    const cur = docs[Math.min(sel, docs.length - 1)], mine = new Set(cur.ents.map(e => e.name));
    const dpos = docs.map((_, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / docs.length; return [cx + 246 * Math.cos(a), cy + 236 * Math.sin(a)]; });
    const svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Concept map of the results' });
    ents.forEach(e => svg.append(s('line', { x1: cx, y1: cy, x2: at.get(e.name)[0], y2: at.get(e.name)[1], stroke: 'var(--acc)', 'stroke-opacity': mine.has(e.name) ? .5 : .12, 'stroke-width': 1.5 })));
    docs.forEach((d, i) => d.ents.forEach(e => { const p = at.get(e.name); if (p) svg.append(s('line', { x1: dpos[i][0], y1: dpos[i][1], x2: p[0], y2: p[1], stroke: 'var(--acc)', 'stroke-opacity': i === sel ? .55 : .1, 'stroke-width': 1 + e.n * .5 })); }));
    ents.forEach(e => { const [x, y] = at.get(e.name), w = Math.min(132, e.name.length * 6.4 + 18);
      svg.append(s('g', { opacity: mine.has(e.name) ? 1 : .38 }, s('rect', { x: x - w / 2, y: y - 12, width: w, height: 24, rx: 12, fill: tint(e.color, 22) }), s('text', { x, y: y + 4, 'text-anchor': 'middle', 'font-size': 12, fill: e.color }, clip(e.name, 19)))); });
    const qw = Math.min(200, data.q.length * 8.5 + 32);
    svg.append(s('g', null, s('rect', { x: cx - qw / 2, y: cy - 16, width: qw, height: 32, rx: 16, fill: 'var(--rv-hl)', stroke: 'var(--acc)', 'stroke-width': 2 }), s('text', { x: cx, y: cy + 5, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700, fill: 'var(--ink)' }, clip(data.q, 24))));
    docs.forEach((d, i) => { const [x, y] = dpos[i];
      const g = s('g', { class: 'rv-doc', tabindex: 0, role: 'button', 'aria-label': d.title }, s('rect', { x: x - 68, y: y - 21, width: 136, height: 42, rx: 10, fill: 'var(--s1)', stroke: i === sel ? 'var(--acc)' : 'var(--line2)', 'stroke-width': 2 }),
        s('text', { x, y: y - 3, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 600, fill: 'var(--ink)' }, clip(d.short, 18)), s('text', { x, y: y + 13, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--mut)' }, d.year ? 'source ' + d.year : plural(d.hitTotal, 'mention')));
      const pick = () => { sel = i; paint(); }; g.addEventListener('click', pick); g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } }); svg.append(g); });
    const insp = h('div', { class: 'rv-insp' }, h('div', { class: 'rv-lab' }, 'Selected'), title(cur), pageArt(cur, 150), cur.hits[0] ? passage(cur.hits[0]) : null,
      h('div', { class: 'rv-lab', style: 'border-top:1px solid var(--line);padding-top:10px' }, 'Appears with'), chips(cur.ents), h('div', { class: 'rv-sub' }, relation(cur, docs)),
      h('button', { class: 'rv-open', onclick: () => opts.onOpen && opts.onOpen(cur.id) }, 'Open contract →'));
    return [h('div', { class: 'rv-sum' }, h('span', null, h('b', null, data.docs.length), ' found'), h('span', null, 'Click a document to see where the phrase sits and which names it connects to.')),
      h('div', { class: 'rv-map' }, h('div', { class: 'rv-mapbox' }, svg), insp),
      data.docs.length > docs.length ? h('div', { class: 'rv-more' }, 'Showing the first ' + docs.length + ' of ' + data.docs.length.toLocaleString() + ' on the map; the other views list them all.') : null];
  }

  function paint() {
    if (dead || !data) return;
    root.replaceChildren();
    if (!data.docs.length) { root.append(h('div', { class: 'rv-none', style: 'padding:24px 4px' }, 'No contract has “' + data.q + '” in it.')); return; }
    root.append(...(mode === 'context' ? context() : mode === 'map' ? map() : cards()).filter(Boolean));
  }
  return {
    set(d, m) { const key = JSON.stringify([d.q, d.docs.map(x => x.id + ':' + x.ents.length + ':' + x.hitTotal)]); const changed = !data || data._key !== key || m !== mode;
      if (data && data._key !== key) sel = 0; data = d; data._key = key; mode = m || mode; if (changed) paint(); },
    destroy() { dead = true; if (ro) ro.disconnect(); root.remove(); },
  };
}
