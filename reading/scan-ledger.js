// scan-ledger.js — EVERY LAYER of reading a scan, recorded as events in the one append-only log (the suite's EotLedger, Provenance@2), each
// event parented to the layer it was made from, so any assertion can be walked back to the pixels that gave rise to it:
//
//   pixels      the page image, stored once under its own hash                                        source
//   ocr         the recogniser's pass over a page: engine, languages, words, lines, mean confidence    page
//   ocr-word    one event per word it read: text, box, confidence, characters it occupies             word
//   second-look ink the first pass left unread, enlarged/inverted and read again                      word
//   ink-rules   the ruling lines found in the page's own ink (Alhazen inkMask)                        page
//   rows        the layout rules (layout-rules.js): rows joined, residue and collisions set aside     page
//   field       a label and the value read beside/inside it: typed, boxed, with the characters         field
//   learned     a learned rule that retyped or aliased a field (learned.js), naming the rule           field
//   prior       the blank form (or register ground) the reading was tilted by, and how it aligned      page
//   section · table   structure: headings and tables, with the rules that found them and the surprise    block
//   assert      a statement the form makes: (filer, act, object), voiced by its signer                  statement
// Recording is idempotent: the ledger dedupes identical events, so it can be called again as later layers settle.
import { sha256Hex, byteRange } from '../vendor/fold-chat/fold-chat-eot.js';

export const STAGES = ['pixels', 'ocr', 'ocr-word', 'second-look', 'ink-rules', 'rows', 'field', 'learned', 'prior', 'section', 'table', 'assert'];
const box = (b) => (b ? b.map((v) => Math.round(v)) : null);
const chars = (s, e) => ({ unit: 'char', start: s, end: e });

/** The OCR layers. Returns the id of the last event (the parent of whatever reads the text), and the page events by page number. */
export function recordOcr(led, srcId, layout) {
  const pages = new Map(); let last = null;
  const engine = layout.engine || 'ocr', langs = layout.langs || null;
  for (const pg of layout.pages) {
    const pix = led.source({ kind: 'pixels', locator: `page-${pg.n}:${pg.image ? sha256Hex(pg.image).slice(0, 20) : `${pg.w}x${pg.h}`}`, meta: { page: pg.n, w: pg.w, h: pg.h, of: srcId } });
    const e0 = led.event({ stage: 'pixels', source_id: pix, parent: null, unit: 'page', transform: 'document→page image', detail: { page: pg.n, w: pg.w, h: pg.h } });
    const conf = pg.words.length ? Math.round(pg.words.reduce((a, w) => a + (w.c ?? 0), 0) / pg.words.length) : null;
    const e1 = led.event({ stage: 'ocr', source_id: pix, parent: e0, unit: 'page', transform: 'pixels→words', detail: { page: pg.n, engine, langs, words: pg.words.length, lines: pg.lines.length, meanConfidence: conf, secondLook: pg.secondLook || 0 } });
    for (const w of pg.words) led.event({ stage: w.second ? 'second-look' : 'ocr-word', source_id: pix, parent: e1, unit: 'word', range: chars(w.s, w.e), transform: w.second ? `unread ink→word (${w.second})` : 'pixels→word', detail: { t: w.t, box: box(w.b), c: w.c, line: w.line } });
    if (pg.rules) led.event({ stage: 'ink-rules', source_id: pix, parent: e1, unit: 'page', transform: 'ink→ruling lines', detail: { page: pg.n, horizontal: pg.rules.h.length, vertical: pg.rules.v.length, by: pg.rules.by } });
    pages.set(pg.n, { pix, ocr: e1, last });
  }
  last = led.event({ stage: 'ocr', source_id: srcId, parent: null, unit: 'document', transform: 'pages→text', detail: { pages: [...pages.values()].map((p) => p.ocr), engine, langs } });
  return { last, pages };
}

/** The reading layers, from what the reader holds. Everything optional: a layer not yet settled is simply not recorded yet. */
export function recordReading(led, srcId, pagesIdx, { layout, fields = [], sem = null, form = null, hunt = null, tilt = null, learned = null, ground = null, structureRules = null }) {
  const at = (n) => (pagesIdx && pagesIdx.get(n)) || {};
  const fieldEvt = new Map();
  for (const pg of layout.pages) led.event({ stage: 'rows', source_id: at(pg.n).pix || srcId, parent: at(pg.n).ocr || null, unit: 'page', transform: 'words→rows (layout-rules.js)', detail: { page: pg.n, words: pg.words.length } });
  if (hunt && hunt.result && hunt.result.prior) { const p = hunt.result.prior, ps = led.source({ kind: 'prior', locator: `${p.form || p.title || 'prior'}:${p.sha256 ? p.sha256.slice(0, 20) : p.source || ''}`, meta: { title: p.title, year: p.year, giver: p.giver, source: p.source } });
    for (const t of (tilt ? tilt.pages : [])) led.event({ stage: 'prior', source_id: ps, parent: at(t.n).ocr || null, unit: 'page', transform: 'blank form→alignment', detail: { page: t.n, matched: !!t.matched, agreement: t.agreement ?? null, rms: t.align ? t.align.rms : null, found: hunt.result.where } }); }
  for (const f of fields) {
    const id = led.event({ stage: 'field', source_id: at(f.page).pix || srcId, parent: at(f.page).ocr || null, unit: 'field', range: chars(f.s, f.e), transform: f.how ? `cells→label+value (${f.how})` : 'line→label+value', detail: { id: f.id, label: f.label, value: f.value, format: f.format, conf: f.conf, labelBox: box(f.lb), valueBox: box(f.vb) } });
    fieldEvt.set(f.id, id);
    if (f.learned) { const ps = learned && learned.programs && learned.programs[0] ? led.source({ kind: 'program', locator: learned.programs[0].file, meta: { giver: learned.programs[0].giver } }) : srcId;
      led.event({ stage: 'learned', source_id: ps, parent: id, unit: 'field', transform: 'learned rule→retype/alias', detail: { canonical: f.learned.canonical, alias: f.learned.alias || null, retyped: f.learned.retyped || null, repairsOffered: f.learned.repairs || null } }); }
  }
  if (ground && !ground.refused) led.event({ stage: 'prior', source_id: led.source({ kind: 'surprise-prime', locator: ground.genre || 'general', meta: { giver: ground.giver } }), parent: null, unit: 'document', transform: 'register ground for surprise', detail: { genre: ground.genre, why: ground.why, tokens: ground.tokens, cuts: ground.cuts, nullMedian: ground.nullMedian } });
  const rulesUsed = structureRules ? { ...structureRules, from: undefined } : 'declared defaults';
  const walk = (t, pageN) => { if (!Array.isArray(t)) return;
    if (t[0] === 'table' && t[2] && t[2].columns) led.event({ stage: 'table', source_id: at(t[2].page).pix || srcId, parent: at(t[2].page).ocr || null, unit: 'block', range: t[1].length && t[1][0][2] && t[1][0][2].chars ? chars(t[1][0][2].chars[0], t[1][t[1].length - 1][2].chars[1]) : null, transform: 'lines→table (same cell count)', detail: { columns: t[2].columns, rows: t[1].length, headerless: !!t[2].headerless, box: box(t[2].box), rules: rulesUsed } });
    else if (Array.isArray(t[1]) && t[2] && t[2].by && /heading|marker|type set|capitals|shift of ground/.test(t[2].by)) led.event({ stage: 'section', source_id: at(t[2].page).pix || srcId, parent: at(t[2].page).ocr || null, unit: 'block', range: t[2].chars ? chars(t[2].chars[0], t[2].chars[1]) : null, transform: 'line→section', detail: { title: String(t[0]), by: t[2].by, surprise: t[2].surprise || null, box: box(t[2].box), rules: rulesUsed } });
    t.forEach((c) => walk(c)); };
  if (sem) walk(sem);
  if (form) {
    const fe = led.event({ stage: 'assert', source_id: srcId, parent: form.filer.field ? fieldEvt.get(form.filer.field) || null : null, unit: 'statement', transform: 'field→filer', detail: { filer: form.filer.name, basis: form.filer.basis } });
    const ve = form.voice ? led.event({ stage: 'assert', source_id: srcId, parent: form.voice.field ? fieldEvt.get(form.voice.field) || null : fe, unit: 'statement', transform: 'field→signer', detail: { signer: form.voice.name, basis: form.voice.basis } }) : fe;
    for (const c of form.claims) led.event({ stage: 'assert', source_id: srcId, parent: fieldEvt.get(c.field) || ve, unit: 'statement', range: c.chars ? chars(c.chars[0], c.chars[1]) : null, transform: 'field→statement', detail: { subject: c.subject, act: c.act, object: c.object, type: c.type, voice: form.voice ? form.voice.name : null, page: c.page, conf: c.conf } });
  }
  return led;
}

/** Counts per stage, for the panel. */
export const layerCounts = (led) => { const m = {}; for (const e of led.events) m[e.stage] = (m[e.stage] || 0) + 1; return STAGES.filter((s) => m[s]).map((s) => [s, m[s]]); };
/** The chain from an event back to its first ancestor, nearest first. */
export function chainOf(led, id) { const by = new Map(led.events.map((e) => [e.event_id, e])), out = []; for (let e = by.get(id); e && out.length < 20; e = e.parent ? by.get(e.parent) : null) out.push(e); return out; }
