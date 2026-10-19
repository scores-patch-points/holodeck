// corpus.js — SEVERAL SOURCES, ONE LOG. The panel over buildCorpusTimeline.
//
// Each source is read on its own; the register it speaks in is DECLARED by whoever gives it (a source with none is read but never linked).
// A link between two sources joins referent ENDS, never the sources, and always carries both ends' registers and the SPLIT between them
// (corroborates / fictionalizes / comments-on / …). A "being" is a view over the links; its ends stay ends. Severing a wrong link is one
// more event on top of the log. Voices: for any position in a source, who is saying it, and who they are relaying, to any depth.
import { buildCorpusTimeline, foldLog, splitOf, CELLS } from '../vendor/khora/native/adapters/text/reading-timeline.js';
import { isTruthClaiming } from '../vendor/khora/native/kernel/reality-register.js';
import { sniffRegister, steerWithLocalModel } from './sniff.js';

const REGS = [['testimony', 'testimony'], ['report', 'report'], ['journalism', 'journalism'], ['reference', 'reference'], ['data', 'data'], ['comment', 'comment'], ['fiction', 'fiction']];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const short = (id) => String(id).replace(/^(being:|ref_)/, '').slice(0, 8);

// illustrative paragraphs written for this demo (not quotations from the record): one testimony, one journalism, one telling
export const TITANIC = [
  { label: 'Inquiry testimony', register: 'testimony', text: 'Senator Smith asked Bruce Ismay whether he had been warned. Bruce Ismay said that Captain Smith told him that ice was reported ahead. Ismay said that Thomas Andrews told him that the ship would sink. “I did not give the order,” said Ismay. Lightoller testified that the officer reported the ice. Thomas Andrews had gone below, Ismay said.' },
  { label: 'Newspaper report', register: 'journalism', text: 'The Tribune reported that Bruce Ismay left the ship in a lifeboat. Thomas Andrews was last seen in the smoking room, according to survivors. Captain Edward Smith stayed on the bridge. Survivors said that Lightoller kept order at the boats. Andrews helped women into the lifeboats, survivors said.' },
  { label: 'Screenplay', register: 'fiction', text: 'Jack Dawson drew Rose DeWitt Bukater in the dark. Cal Hockley told Rose that Thomas Andrews had warned him. Bruce Ismay urged the captain to go faster. “Faster,” said Ismay. Andrews showed Rose the plans of the ship.' },
];

const CSS = `
.src-panel{max-width:1180px;margin:10px auto;padding:0 18px}
.src-panel h2{font-size:15px;margin:0 0 4px}.src-panel .lede{font-size:12.5px;opacity:.78;margin:0 0 10px;max-width:84ch}
.src-card{display:flex;gap:10px;align-items:center;padding:3px 0;margin:0}.src-card b{font-weight:500;flex:0 1 auto}.src-card select{flex:0 0 auto;font-size:12.5px;padding:2px 4px;max-width:70%}.src-card .x{background:none;border:0;opacity:.55;font-size:15px;cursor:pointer;padding:0 4px}.src-card .x:hover{opacity:1}
.src-card input[type=text]{font:inherit;padding:4px 6px;min-width:0}.src-card select{font:inherit;padding:3px}
@media(max-width:760px){.src-card{grid-template-columns:1fr}.src-card input[type=text]{width:100%;box-sizing:border-box}}
.src-card .tx{grid-column:1/-1;font:11.5px/1.45 ui-monospace,monospace;opacity:.8;max-height:3.1em;overflow:hidden;white-space:pre-wrap}
.src-row{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0;align-items:center}
.src-tbl{width:100%;border-collapse:collapse;font-size:12.5px}.src-tbl th,.src-tbl td{text-align:left;padding:4px 7px;border-bottom:1px solid var(--line,#8883);vertical-align:top}
.src-tbl tr[data-being]{cursor:pointer}.src-tbl tr.sel{background:#7a7a7a22}.src-tbl th{font-weight:600;font-size:11px;opacity:.75}
.chip{display:inline-block;font:11px/1 ui-monospace,monospace;padding:3px 7px;border-radius:999px;border:1px solid #8886;margin:1px 3px 1px 0}
.chip.real{border-color:#2a9d6f;color:#2a9d6f}.chip.fictional{border-color:#a05bd0;color:#a05bd0}.chip.fictionalized-real{border-color:#d08a2b;color:#d08a2b}.chip.unexamined{opacity:.6}
.src-prof{border:1px solid var(--line,#8884);border-radius:8px;padding:10px 12px;margin:10px 0;font-size:12.5px}.src-prof .why{opacity:.8;margin:4px 0 8px}
.mono{font-family:ui-monospace,monospace}.dim{opacity:.6}
.voice-text{white-space:pre-wrap;font:12.5px/1.6 ui-monospace,monospace;border:1px solid var(--line,#8884);border-radius:8px;padding:8px 10px;cursor:text}
.voice-chain{margin:8px 0;font-size:13px}.voice-chain .lv{display:block;padding-left:calc(var(--d,0)*16px)}
`;

export function mountSources(host, { makeDeps, openInReader, currentText }) {
  if (!document.getElementById('src-css')) { const s = document.createElement('style'); s.id = 'src-css'; s.textContent = CSS; document.head.appendChild(s); }
  const st = { sources: [], corpus: null, fold: null, overlay: [], sel: null, voiceSrc: null, onlyShared: true, busy: false, err: null };
  let nextId = 1;
  let PRIOR; const prior = () => (PRIOR ??= fetch('./register-prior.json').then((r) => r.json()).catch(() => null));
  // the type of a source is SNIFFED (Zenodotus-measured vocabulary + structural cues, a small local model only when thin); a pick overrides it
  const eff = (s) => s.register || (s.auto && (!s.auto.thin || (s.auto.model && s.auto.model.used)) ? s.auto.register : '');
  let timer = null; const soon = () => { clearTimeout(timer); timer = setTimeout(() => { if (st.sources.length && st.sources.every((x) => !x.pending)) readAll(); }, 250); };
  async function sniffOne(s) {
    s.pending = true; render();
    try { s.auto = sniffRegister(s.text, await prior()); render(); if (s.auto.thin) { s.auto = await steerWithLocalModel(s.auto); } } catch (e) { console.error(e); }
    s.pending = false; render(); soon();
  }
  const add = (label, text, register = '') => { const s = { id: `src_${nextId++}`, label: label || text.trim().split(/\s+/).slice(0, 5).join(' ') + '…', text, register, auto: null, pending: false }; st.sources.push(s); st.corpus = null; sniffOne(s); };

  function regChip(r) { return r ? `<span class="chip">${esc(r)}</span>` : '<span class="chip dim">undeclared</span>'; }
  function render() {
    const autoLabel = (s) => (s.pending ? 'sniffing…' : s.auto ? (eff(s) ? `${eff(s)} · ${Math.round(s.auto.p * 100)}% · sniffed${s.auto.model && s.auto.model.used ? ' + local model' : ''}` : `unsure${s.auto.reason ? ' — ' + s.auto.reason : ''} — pick one, or it is read but not linked`) : '…');
    const sc = st.sources.map((s) => `<div class="src-card" data-src="${s.id}"><b>${esc(s.label)}</b><select data-f="register" aria-label="type of source" title="${esc(s.auto ? s.auto.ranked.slice(0, 2).map((r) => r.register + ' ' + r.p.toFixed(2) + ': ' + r.why.join('; ')).join('\n') : '')}"><option value="">${esc(autoLabel(s))}</option>${REGS.map(([v, l]) => `<option value="${v}"${v === s.register ? ' selected' : ''}>${l}</option>`).join('')}</select><button type="button" data-a="rm" class="x" title="remove this source" aria-label="remove">×</button></div>`).join('') || '<div class="dim" style="font-size:12.5px"></div>';
    if (!st.sources.length) { host.innerHTML = ''; return; }
    host.innerHTML = `<div class="src-panel">
      ${sc}
      ${st.busy ? '<div class="src-row dim">reading…</div>' : ''}
      ${st.err ? `<div class="dim mono">${esc(st.err)}</div>` : ''}${st.corpus ? result() : ''}</div>`;
  }

  function result() {
    const c = st.corpus, f = st.fold, lab = (id) => (c.sources.find((s) => s.id === id) || {}).label || id;
    const beings = f.beings.filter((b) => b.ends.length).sort((a, b) => new Set(b.ends.map((e) => e.source)).size - new Set(a.ends.map((e) => e.source)).size || b.ends.reduce((n, e) => n + e.mentions, 0) - a.ends.reduce((n, e) => n + e.mentions, 0));
    const shown = (st.onlyShared ? beings.filter((b) => new Set(b.ends.map((e) => e.source)).size > 1) : beings).slice(0, 60);
    const kinds = {}; for (const l of f.links) kinds[l.split.kind] = (kinds[l.split.kind] || 0) + 1;
    const rows = shown.map((b) => `<tr data-being="${esc(b.id)}" class="${b.id === st.sel ? 'sel' : ''}"><td>${esc(b.name || '—')}</td><td><span class="chip ${esc(b.reality)}">${esc(b.reality)}</span></td><td>${b.ends.map((e) => `${esc(lab(e.source))} ${regChip(e.register)}×${e.mentions}`).join('<br>')}</td></tr>`).join('');
    return `<div class="src-row dim">${f.links.length} cross-source link${f.links.length === 1 ? '' : 's'} ${Object.entries(kinds).map(([k, n]) => `<span class="chip">${esc(k)} ${n}</span>`).join('')}${c.refused.length ? ` · ${c.refused.length} not linked (type unsure)` : ''}${st.overlay.length ? ` · ${st.overlay.length} from you` : ''}</div>
      <table class="src-tbl"><thead><tr><th>name</th><th>reality</th><th>met in</th></tr></thead><tbody>${rows || '<tr><td colspan="3" class="dim">nothing shared across these sources yet</td></tr>'}</tbody></table>${undecided()}${profile()}${voices()}`;
  }

  // A shared name only NOMINATES. The identity test (holographic, for-whom 'who is this?') joins when it can; when there is not enough reading it
  // says so, and the pair waits here for a person: "same" is one more event of yours on top of the log, severable like any other.
  function undecided() {
    const c = st.corpus, f = st.fold, lab = (id) => (c.sources.find((s) => s.id === id) || {}).label || id;
    const joined = (k) => f.links.some((l) => (l.from.ref === k.from.ref && l.to.ref === k.to.ref) || (l.from.ref === k.to.ref && l.to.ref === k.from.ref));
    const rows = (c.candidates || []).map((k, i) => ({ k, i })).filter(({ k }) => !joined(k) && (k.matched.from.trim().split(/\s+/).length > 1 || k.matched.to.trim().split(/\s+/).length > 1) ).slice(0, 12);
    if (!rows.length) return '';
    return `<div class="src-prof"><div><b>Possibly the same</b> <span class="dim">— the same name, not enough reading to say</span></div>${rows.map(({ k, i }) => `<div style="margin:6px 0">${esc(k.from.name)} <span class="dim">(${esc(lab(k.from.source))})</span> ~ ${esc(k.to.name)} <span class="dim">(${esc(lab(k.to.source))})</span> <button type="button" data-a="same" data-i="${i}" title="${esc(k.identity.basis)}">same</button></div>`).join('')}</div>`;
  }

  function profile() {
    const c = st.corpus, f = st.fold, b = f.beings.find((x) => x.id === st.sel); if (!b) return '';
    const lab = (id) => (c.sources.find((s) => s.id === id) || {}).label || id;
    const links = f.links.filter((l) => b.members.includes(l.fromRoot) || b.members.includes(l.toRoot));
    return `<div class="src-prof"><div><b>${esc(b.name || '—')}</b> <span class="mono dim" title="${esc(b.id)}">${esc(b.id)}</span> <span class="chip ${esc(b.reality)}">${esc(b.reality)}</span></div>
      
      <table class="src-tbl"><thead><tr><th>referent (end)</th><th>source</th><th>register</th><th>mentions</th></tr></thead><tbody>${b.ends.map((e) => `<tr><td class="mono" title="${esc(e.ref)}">${esc(short(e.ref))} ${esc(e.name || '')}</td><td>${esc(lab(e.source))}</td><td>${regChip(e.register)} ${e.truthClaiming ? '<span class="dim">claims truth</span>' : e.truthClaiming === false ? '<span class="dim">tells</span>' : ''}</td><td>${e.mentions}</td></tr>`).join('')}</tbody></table>
      ${links.length ? links.map((l) => `<div style="margin:6px 0" title="${esc('matched “' + (l.matched?.from ?? '') + '” ~ “' + (l.matched?.to ?? '') + '” — ' + (l.checkedBy ?? ''))}"><span class="chip">${esc(l.split.kind)}</span> ${esc(lab(l.from.source))} <span class="dim">(${esc(l.from.register)})</span> ⟶ ${esc(lab(l.to.source))} <span class="dim">(${esc(l.to.register)})</span> <button type="button" data-a="sever" data-link="${esc(l.id)}">sever</button></div>`).join('') : ''}</div>`;
  }

  function voices() {
    const c = st.corpus; const src = c.sources.find((s) => s.id === (st.voiceSrc || c.sources[0].id)) || c.sources[0];
    const text = st.sources.find((s) => s.id === src.id)?.text ?? '';
    return `<details class="src-prof"><summary><b>Who is saying it</b></summary>
      <div class="src-row">${c.sources.map((s) => `<button type="button" data-a="vsrc" data-src="${s.id}"${s.id === src.id ? ' class="primary"' : ''}>${esc(s.label)}</button>`).join('')}</div>
      <div class="voice-text" id="voice-text" data-src="${src.id}">${esc(text)}</div><div class="voice-chain" id="voice-chain" aria-live="polite"><span class="dim">click a word</span></div></details>`;
  }

  function showVoices(srcId, off) {
    const f = st.fold, v = f.voices(off, srcId), out = host.querySelector('#voice-chain'); if (!out) return;
    if (!v.chain.length) { out.innerHTML = '<span class="dim">this source carries no frames (read it with a verb prior to find speakers)</span>'; return; }
    const rev = v.chain.slice().reverse();   // outermost first: the source’s own voice, then each relay inward
    out.innerHTML = rev.map((x, i) => `<span class="lv" style="--d:${i}">${x.root ? `<b>${esc(x.label || 'the source')}</b> <span class="dim">— the source’s own voice${x.creator ? ' (' + esc(x.creator) + ')' : ''} · ${esc(x.register || 'undeclared')}</span>` : `${i ? '↳ ' : ''}<b>${esc(x.name || 'someone unnamed')}</b> <span class="dim">${esc(x.frame.form)}${x.frame.verb ? ' · “' + esc(x.frame.verb) + '”' : ''}${x.ref ? ' · ' + esc(short(x.ref)) : ' · speaker not resolved to a referent'}</span>`}</span>`).join('') + `<div class="dim" style="margin-top:6px">${v.depth} relay${v.depth === 1 ? '' : 's'} deep. A frame says who holds a sentence in their saying — never that it is true.</div>`;
  }

  async function readAll() {
    if (!st.sources.length || st.busy) return; st.busy = true; st.err = null; render();
    await new Promise((r) => setTimeout(r, 30));
    try {
      const deps = await makeDeps();
      st.corpus = buildCorpusTimeline(st.sources.map((s) => ({ id: s.id, label: s.label, text: s.text, register: eff(s), giver: s.register ? 'you' : 'sniffed' })), deps, { maxSnapshots: 8 });
      st.fold = foldLog(st.corpus.log, { overlay: st.overlay }); st.sel = null; st.voiceSrc = null;
    } catch (e) { console.error(e); st.err = 'The sources could not be read together: ' + (e && e.message || e); }
    st.busy = false; render();
  }

  host.addEventListener('click', (ev) => {
    const row = ev.target.closest('[data-being]'); if (row) { st.sel = row.dataset.being; render(); return; }
    const vt = ev.target.closest('#voice-text'); if (vt && st.fold) { const sel = getSelection(); if (sel && sel.anchorNode && vt.contains(sel.anchorNode)) showVoices(vt.dataset.src, sel.anchorOffset); return; }
    const b = ev.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a, card = ev.target.closest('[data-src]');
    if (a === 'rm') { st.sources = st.sources.filter((s) => s.id !== card.dataset.src); st.corpus = null; render(); }
        else if (a === 'addcur') { const t = (currentText() || '').trim(); if (t.length < 8) { st.err = 'Put some text in the box below first.'; render(); return; } add("", t); st.err = null; render(); }
    else if (a === 'titanic') { st.sources = []; for (const t of TITANIC) add(t.label, t.text, t.register); render(); }
        else if (a === 'vsrc') { st.voiceSrc = b.dataset.src; render(); }
    else if (a === 'same') {
      const k = st.corpus.candidates[+b.dataset.i]; if (!k) return;
      const split = splitOf(k.from.register, k.to.register), flip = split.kind === 'fictionalizes' && isTruthClaiming(k.from.register);
      const [from, to] = flip ? [k.to, k.from] : [k.from, k.to];
      st.overlay.push({ op: 'CON', ...CELLS.CON, kind: 'correspondence', at: 'corpus', from, to, split: { ...split, registers: [from.register, to.register], truthClaiming: [isTruthClaiming(from.register), isTruthClaiming(to.register)] }, matched: flip ? { from: k.matched.to, to: k.matched.from } : k.matched, identity: { verdict: 'asserted', forWhom: 'you', basis: 'you said these are one being' }, checkedBy: 'asserted by you', giver: 'you', id: 'you_same_' + from.ref + '_' + to.ref, basis: from.name + ' ↔ ' + to.name + ': ' + split.kind });
      st.fold = foldLog(st.corpus.log, { overlay: st.overlay }); render();
    }
    else if (a === 'sever') { st.overlay.push({ op: 'CON', cell: 'Link', kind: 'correspondence', severs: b.dataset.link, giver: 'you', id: 'you_' + st.overlay.length + '_' + b.dataset.link, basis: 'severed by you' }); st.fold = foldLog(st.corpus.log, { overlay: st.overlay }); render(); }
  });
  host.addEventListener('change', (ev) => {
    const f = ev.target.dataset.f, card = ev.target.closest('[data-src]');
    if (f === 'shared') { st.onlyShared = ev.target.checked; render(); return; }
    if (!f || !card) return; const s = st.sources.find((x) => x.id === card.dataset.src); if (!s) return;
    s[f] = ev.target.value; if (f === 'register') { st.corpus = null; render(); soon(); }
  });
  render();
  const addCurrent = () => { const t = (currentText() || '').trim(); if (t.length < 8) return false; add('', t); return true; };
  const example = () => { st.sources = []; for (const t of TITANIC) add(t.label, t.text, t.register); render(); };
  return { add, addCurrent, example, readAll, state: st };
}
