// holodeck-referents-view.js — the Referents inbox.
//
// Every referent the reader admitted, in the order it first appeared, each with
// the profile the sources give it. A list-and-detail surface mounted into the
// Sources view beside Grid and Table. Pure DOM, no framework: the page computes
// the rows from its own analysis and hands them here.
//
//   const ctl = mountReferentsView(hostEl, { onOpen(name), onRead(docId, stId) });
//   ctl.set(data);
//   ctl.destroy();
//
//   data = {
//     total: Number, ready: Boolean,
//     rows: [{
//       name, type, typeLabel, typeColor,
//       mentions, sources, aliases: [String],
//       established: Boolean, kindLine, countLine,
//       profile: [{ rel, standing, hasStanding, vals }],
//       firstDoc, firstYear, firstLine, firstDocId, firstStId,
//     }]
//   }

const CSS = `
.hrv{display:flex;flex-direction:column;gap:12px;background:var(--s1);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.hrv-top{display:flex;flex-direction:column;gap:10px}
.hrv-title{font:600 12px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--mut);display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}
.hrv-count{font:400 12px/1.4 var(--sans);letter-spacing:0;text-transform:none;color:var(--dim)}
.hrv-search{background:var(--bg);border:1px solid var(--line2);border-radius:8px;color:var(--ink);font:400 13px var(--sans);padding:6px 10px;outline:none;max-width:420px}
.hrv-search:focus{border-color:var(--acc)}
.hrv-chips{display:flex;gap:6px;flex-wrap:wrap}
.hrv-chip{background:transparent;border:1px solid var(--line2);border-radius:999px;padding:2px 10px;cursor:pointer;font:500 12px var(--sans);color:var(--mut)}
.hrv-chip:hover{border-color:var(--acc)}
.hrv-chip.on{background:var(--sel);border-color:var(--acc2);color:var(--ink)}
.hrv-grid{display:grid;grid-template-columns:minmax(0,340px) minmax(0,1fr);gap:14px;align-items:start}
.hrv-list{display:flex;flex-direction:column;border:1px solid var(--line);border-radius:10px;overflow:auto;max-height:min(70vh,760px);background:var(--bg)}
.hrv-row{display:flex;align-items:center;gap:9px;width:100%;text-align:left;background:none;border:0;border-bottom:1px solid var(--line);padding:8px 11px;cursor:pointer;font:500 14px var(--sans);color:var(--ink)}
.hrv-row:last-child{border-bottom:0}
.hrv-row:hover{background:var(--s1)}
.hrv-row.on{background:var(--sel)}
.hrv-dot{width:8px;height:8px;border-radius:50%;flex:none}
.hrv-rname{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hrv-rn{font:500 12px var(--mono);color:var(--dim);white-space:nowrap}
.hrv-detail{display:flex;flex-direction:column;gap:10px;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:14px 16px;min-height:200px}
.hrv-dhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.hrv-dname{font:500 19px/1.25 var(--serif);color:var(--ink)}
.hrv-dtype{font:500 11px var(--mono);text-transform:uppercase;letter-spacing:.06em;color:var(--mut);border:1px solid var(--line2);border-radius:5px;padding:1px 7px}
.hrv-dmeta{font:400 13px var(--sans);color:var(--mut)}
.hrv-dalias{font:400 13px/1.5 var(--sans);color:var(--ink2)}
.hrv-dsub{font:600 11px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--dim);margin-top:2px}
.hrv-prows{display:flex;flex-direction:column;gap:6px}
.hrv-prow{display:grid;grid-template-columns:minmax(90px,150px) minmax(0,1fr);gap:8px;align-items:baseline;border-top:1px solid var(--line);padding-top:6px}
.hrv-prel{font:500 13px var(--sans);color:var(--ink2)}
.hrv-pval{font:400 14px/1.45 var(--sans);color:var(--ink);min-width:0}
.hrv-pst{display:block;font:400 11px var(--mono);color:var(--mut)}
.hrv-pnote{font:400 13px/1.5 var(--sans);color:var(--mut)}
.hrv-dfirst{display:flex;flex-direction:column;gap:3px;border-top:1px solid var(--line);padding-top:8px}
.hrv-flabel{font:600 11px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--dim)}
.hrv-fline{font:400 14px/1.5 var(--serif);color:var(--ink2);cursor:pointer}
.hrv-fline:hover{color:var(--acc)}
.hrv-dacts{display:flex;gap:8px;flex-wrap:wrap;margin-top:2px}
.hrv-open{background:var(--acc2);border:0;color:#fff;border-radius:8px;padding:6px 14px;cursor:pointer;font:600 13px var(--sans)}
.hrv-empty{padding:22px 10px;text-align:center;font:400 14px var(--sans);color:var(--mut)}
@media(max-width:900px){.hrv-grid{grid-template-columns:minmax(0,1fr)}}
`;

const TYPES = [['all', 'All'], ['person', 'People'], ['organisation', 'Organisations'], ['place', 'Places'], ['other', 'Other']];

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) { const v = attrs[k]; if (v == null || v === false) continue; if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v; else if (k === 'text') e.textContent = v; else if (k.slice(0, 2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v); else e.setAttribute(k, v); }
  kids.flat().forEach(k => { if (k == null || k === false) return; e.appendChild(k.nodeType ? k : document.createTextNode(String(k))); });
  return e;
}

let styleDone = false;
function ensureStyle() { if (styleDone || typeof document === 'undefined') return; styleDone = true; const s = document.createElement('style'); s.id = 'hrv-style'; s.textContent = CSS; document.head.appendChild(s); }

export function mountReferentsView(host, opts = {}) {
  ensureStyle();
  let data = null, filter = 'all', q = '', sel = null;
  const root = el('div', { class: 'hrv-host' });
  if (host) host.appendChild(root);

  const filtered = () => {
    if (!data) return [];
    const ql = q.trim().toLowerCase();
    return data.rows.filter(r => (filter === 'all' || r.type === filter) && (!ql || r.name.toLowerCase().includes(ql) || (r.aliases || []).some(a => a.toLowerCase().includes(ql))));
  };

  function detail(r) {
    if (!r) return el('div', { class: 'hrv-detail' }, el('div', { class: 'hrv-empty' }, data ? 'Pick a referent to see what the sources say about it.' : 'Reading…'));
    const kids = [
      el('div', { class: 'hrv-dhead' }, el('span', { class: 'hrv-dot', style: 'background:' + r.typeColor }), el('span', { class: 'hrv-dname' }, r.name), el('span', { class: 'hrv-dtype' }, r.typeLabel)),
      el('div', { class: 'hrv-dmeta' }, r.mentions + (r.mentions === 1 ? ' mention' : ' mentions') + ' · ' + r.sources + (r.sources === 1 ? ' source' : ' sources') + (r.established ? (r.kindLine ? ' · ' + r.kindLine : '') : ' · no profile yet')),
    ];
    if (r.aliases && r.aliases.length) kids.push(el('div', { class: 'hrv-dalias' }, 'Also written ' + esc(r.aliases.slice(0, 8).join(' · '))));
    if (r.profile && r.profile.length) {
      kids.push(el('div', { class: 'hrv-dsub' }, r.countLine || ''));
      const rows = el('div', { class: 'hrv-prows' });
      r.profile.forEach(p => rows.appendChild(el('div', { class: 'hrv-prow' },
        el('span', { class: 'hrv-prel' }, esc(p.rel)),
        el('span', { class: 'hrv-pval' }, esc(p.vals || ''), p.hasStanding ? el('span', { class: 'hrv-pst' }, esc(p.standing)) : null))));
      kids.push(rows);
    } else {
      kids.push(el('div', { class: 'hrv-pnote' }, data && data.ready ? 'No kind of detail has been recorded about this name yet — it is named, but nothing is said of it that the reader could hold.' : 'The profile reader is still loading; the profiles appear once it is ready.'));
    }
    if (r.firstLine) kids.push(el('div', { class: 'hrv-dfirst' },
      el('div', { class: 'hrv-flabel' }, 'First appears' + (r.firstDoc ? ' · ' + esc(r.firstDoc) : '') + (r.firstYear ? ' · ' + esc(r.firstYear) : '')),
      el('div', { class: 'hrv-fline', title: 'Open it in the source', onclick: () => r.firstDocId && opts.onRead && opts.onRead(r.firstDocId, r.firstStId) }, '“' + esc(r.firstLine) + '”')));
    kids.push(el('div', { class: 'hrv-dacts' }, el('button', { class: 'hrv-open', onclick: () => opts.onOpen && opts.onOpen(r.name) }, 'Open full profile')));
    return el('div', { class: 'hrv-detail' }, kids);
  }

  function draw() {
    const list = filtered();
    const counts = { all: data ? data.rows.length : 0 };
    (data ? data.rows : []).forEach(r => { counts[r.type] = (counts[r.type] || 0) + 1; });
    const chips = el('div', { class: 'hrv-chips' });
    TYPES.forEach(([id, lab]) => { const n = counts[id] || 0; if (id !== 'all' && !n) return;
      chips.appendChild(el('button', { class: 'hrv-chip' + (filter === id ? ' on' : ''), onclick: () => { filter = id; if (filter !== 'all' && sel && !(data.rows.find(r => r.name === sel) || {}).type) sel = null; draw(); } }, lab + ' ' + n)); });
    const top = el('div', { class: 'hrv-top' },
      el('div', { class: 'hrv-title' }, 'Referents', el('span', { class: 'hrv-count' }, data ? data.total + ' admitted, in the order they first appear' : 'reading…')),
      el('input', { class: 'hrv-search', type: 'search', placeholder: 'Search a name, or an also-written form', value: q, oninput: e => { q = e.target.value; draw(); } }),
      chips);
    const selRow = (sel && (list.find(r => r.name === sel) || (data && data.rows.find(r => r.name === sel)))) || list[0] || null;
    if (selRow) sel = selRow.name;
    const listEl = el('div', { class: 'hrv-list' });
    list.forEach(r => listEl.appendChild(el('button', { class: 'hrv-row' + (selRow && r.name === selRow.name ? ' on' : ''), onclick: () => { sel = r.name; draw(); } },
      el('span', { class: 'hrv-dot', style: 'background:' + r.typeColor }),
      el('span', { class: 'hrv-rname' }, r.name),
      el('span', { class: 'hrv-rn' }, String(r.mentions)))));
    if (!list.length) listEl.appendChild(el('div', { class: 'hrv-empty' }, data ? 'No referent matches that.' : 'Reading…'));
    root.replaceChildren(el('div', { class: 'hrv' }, top, el('div', { class: 'hrv-grid' }, listEl, detail(selRow))));
  }

  return {
    set(d) { data = d || null; if (sel && data && !data.rows.some(r => r.name === sel)) sel = null; draw(); },
    destroy() { if (root.parentNode) root.parentNode.removeChild(root); },
  };
}
