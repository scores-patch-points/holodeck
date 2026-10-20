// corpus.js — a SYNTHETIC test corpus, drawn on a canvas, whose truth is known because we wrote it: invoices, receipts, memos, ruled forms,
// statements and letters, in four languages (en fr de es), three typefaces, at different resolutions, with skew, noise and fade. Each document
// is { id, family, lang, canvas, truth }, truth = { kind, fields:[{label,value}], columns?, records?, headings?, words:[…] }.
// It exists to MEASURE the reader and to learn from the measurement; real documents (the 990s) are run alongside, unlabeled.
const lcg = (seed) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; }; };
const pick = (r, a) => a[Math.floor(r() * a.length)];
const FONTS = { serif: 'Georgia, "Times New Roman", serif', sans: '"Open Sans", Helvetica, Arial, sans-serif', mono: '"Courier New", Courier, monospace' };

// the words of each language: labels and a few nouns. Declared data; a language added here is a language tested.
const L = {
  en: { invoice: 'Invoice', no: 'Invoice No', date: 'Date', due: 'Due Date', bill: 'Bill To', total: 'Total', tax: 'Tax', qty: 'Qty', desc: 'Description', price: 'Unit Price', amount: 'Amount', ph: 'Phone', email: 'Email', ref: 'Reference', memo: 'Memorandum', to: 'To', from: 'From', subj: 'Subject', items: ['Consulting hours', 'Printed manuals', 'Site visit', 'Software licence', 'Travel expenses'], names: ['Maria Alvarez', 'James Okafor', 'Chen Wei', 'Priya Nair', 'Tom Becker'], orgs: ['Harbor Supply Co', 'Northgate Press', 'Bluebird Analytics'], heads: ['BACKGROUND', 'FINDINGS', 'NEXT STEPS'], body: ['The committee reviewed the proposal and agreed on the budget.', 'Costs were lower than expected because two sites merged.', 'A follow up report will be sent before the end of the quarter.'], name: 'Name', city: 'City', zip: 'ZIP', receipt: 'Receipt', thanks: 'Thank you' },
  fr: { invoice: 'Facture', no: 'Facture n°', date: 'Date', due: 'Échéance', bill: 'Facturé à', total: 'Total', tax: 'TVA', qty: 'Qté', desc: 'Désignation', price: 'Prix unitaire', amount: 'Montant', ph: 'Téléphone', email: 'Courriel', ref: 'Référence', memo: 'Note de service', to: 'À', from: 'De', subj: 'Objet', items: ['Heures de conseil', 'Manuels imprimés', 'Visite sur site', 'Licence logicielle', 'Frais de déplacement'], names: ['Camille Dupont', 'Hugo Martin', 'Léa Bernard', 'Nadia Perrin'], orgs: ['Meubles Martin', 'Atelier du Nord'], heads: ['CONTEXTE', 'CONSTATS', 'SUITES'], body: ['Le comité a examiné la proposition et approuvé le budget.', 'Les coûts étaient inférieurs aux prévisions.', 'Un rapport de suivi sera envoyé avant la fin du trimestre.'], name: 'Nom', city: 'Ville', zip: 'Code postal', receipt: 'Reçu', thanks: 'Merci' },
  de: { invoice: 'Rechnung', no: 'Rechnungsnr', date: 'Datum', due: 'Fällig am', bill: 'Rechnung an', total: 'Gesamt', tax: 'MwSt', qty: 'Menge', desc: 'Beschreibung', price: 'Einzelpreis', amount: 'Betrag', ph: 'Telefon', email: 'E-Mail', ref: 'Referenz', memo: 'Aktennotiz', to: 'An', from: 'Von', subj: 'Betreff', items: ['Beratungsstunden', 'Gedruckte Handbücher', 'Vor-Ort-Termin', 'Softwarelizenz', 'Reisekosten'], names: ['Anna Schneider', 'Jonas Weber', 'Lena Fischer'], orgs: ['Nordlicht GmbH', 'Werkstatt Müller'], heads: ['HINTERGRUND', 'ERGEBNISSE', 'NÄCHSTE SCHRITTE'], body: ['Der Ausschuss prüfte den Vorschlag und billigte das Budget.', 'Die Kosten lagen unter den Erwartungen.', 'Ein Folgebericht wird vor Quartalsende versandt.'], name: 'Name', city: 'Stadt', zip: 'PLZ', receipt: 'Quittung', thanks: 'Danke' },
  es: { invoice: 'Factura', no: 'Factura n.º', date: 'Fecha', due: 'Vencimiento', bill: 'Facturar a', total: 'Total', tax: 'IVA', qty: 'Cant', desc: 'Descripción', price: 'Precio unitario', amount: 'Importe', ph: 'Teléfono', email: 'Correo', ref: 'Referencia', memo: 'Memorándum', to: 'Para', from: 'De', subj: 'Asunto', items: ['Horas de consultoría', 'Manuales impresos', 'Visita al sitio', 'Licencia de software', 'Gastos de viaje'], names: ['Sofía Ramírez', 'Diego Torres', 'Lucía Gómez'], orgs: ['Taller Sol', 'Distribuidora Andina'], heads: ['ANTECEDENTES', 'HALLAZGOS', 'PRÓXIMOS PASOS'], body: ['El comité revisó la propuesta y aprobó el presupuesto.', 'Los costos fueron menores a lo esperado.', 'Se enviará un informe de seguimiento antes de fin de trimestre.'], name: 'Nombre', city: 'Ciudad', zip: 'CP', receipt: 'Recibo', thanks: 'Gracias' },
};
const NUM = { en: (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2 }), fr: (n) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2 }).replace(/[  ]/g, ' '), de: (n) => n.toLocaleString('de-DE', { minimumFractionDigits: 2 }), es: (n) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, useGrouping: true }) };
const DATE = { en: (d) => `${String(d[1]).padStart(2, '0')}/${String(d[2]).padStart(2, '0')}/${d[0]}`, fr: (d) => `${String(d[2]).padStart(2, '0')}/${String(d[1]).padStart(2, '0')}/${d[0]}`, de: (d) => `${String(d[2]).padStart(2, '0')}.${String(d[1]).padStart(2, '0')}.${d[0]}`, es: (d) => `${String(d[2]).padStart(2, '0')}/${String(d[1]).padStart(2, '0')}/${d[0]}` };

function page(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.textBaseline = 'alphabetic'; return { c, x, w, h }; }
function make(P, truth) { return { P, truth }; }
const money = (r) => Math.round((20 + r() * 4800) * 100) / 100;

// ── the families ──
function invoice(r, lang, px, face) {
  const t = L[lang], P = page(Math.round(8.5 * px), Math.round(11 * px)), { x } = P, u = px / 100, F = (s, b) => `${b ? 'bold ' : ''}${Math.round(s * u)}px ${FONTS[face]}`;
  const no = String(1000 + Math.floor(r() * 8999)), d = [2020 + Math.floor(r() * 6), 1 + Math.floor(r() * 12), 1 + Math.floor(r() * 28)], due = [d[0], d[1], Math.min(28, d[2] + 1)];
  const client = pick(r, t.names), org = pick(r, t.orgs), rows = Array.from({ length: 3 + Math.floor(r() * 3) }, () => { const q = 1 + Math.floor(r() * 9), p = money(r) / 10; return { it: pick(r, t.items), q, p: Math.round(p * 100) / 100, a: Math.round(q * p * 100) / 100 }; });
  const sub = Math.round(rows.reduce((s, a) => s + a.a, 0) * 100) / 100, tax = Math.round(sub * 0.08 * 100) / 100, tot = Math.round((sub + tax) * 100) / 100;
  x.fillStyle = '#111'; x.font = F(30, true); x.fillText(t.invoice.toUpperCase(), 70 * u, 90 * u); x.font = F(13); x.fillText(org, 70 * u, 118 * u);
  const fields = [{ label: t.no, value: no }, { label: t.date, value: DATE[lang](d) }, { label: t.due, value: DATE[lang](due) }, { label: t.bill, value: client }];
  fields.forEach((f, i) => { x.font = F(13, true); x.fillText(f.label + ':', 480 * u, (90 + i * 24) * u); x.font = F(13); x.fillText(f.value, 640 * u, (90 + i * 24) * u); });
  const cols = [t.desc, t.qty, t.price, t.amount], cx = [70, 440, 520, 650].map((v) => v * u); let y = 260;
  x.font = F(13, true); cols.forEach((c, i) => x.fillText(c, cx[i], y * u)); x.fillRect(70 * u, (y + 8) * u, 660 * u, 1.5 * u); y += 34;
  const records = rows.map((a) => { x.font = F(13); [a.it, String(a.q), NUM[lang](a.p), NUM[lang](a.a)].forEach((v, i) => x.fillText(v, cx[i], y * u)); y += 28; return { [t.desc]: a.it, [t.qty]: String(a.q), [t.price]: NUM[lang](a.p), [t.amount]: NUM[lang](a.a) }; });
  y += 14; [[t.tax, NUM[lang](tax)], [t.total, NUM[lang](tot)]].forEach(([k, v], i) => { x.font = F(13, true); x.fillText(k, 520 * u, y * u); x.font = F(i ? 15 : 13, !!i); x.fillText(v, 650 * u, y * u); fields.push({ label: k, value: v }); y += 28; });
  return make(P, { kind: 'invoice', fields, columns: cols, records });
}
function receipt(r, lang, px) {
  const t = L[lang], P = page(Math.round(4 * px), Math.round(7 * px)), { x } = P, u = px / 100, F = (s, b) => `${b ? 'bold ' : ''}${Math.round(s * u)}px ${FONTS.mono}`;
  const d = [2021 + Math.floor(r() * 5), 1 + Math.floor(r() * 12), 1 + Math.floor(r() * 28)], rows = Array.from({ length: 3 + Math.floor(r() * 4) }, () => ({ it: pick(r, t.items), a: Math.round(money(r)) / 10 }));
  const tot = Math.round(rows.reduce((s, a) => s + a.a, 0) * 100) / 100; x.fillStyle = '#111'; x.font = F(15, true); x.fillText(pick(r, t.orgs), 30 * u, 50 * u); x.font = F(11); x.fillText(`${t.receipt} ${DATE[lang](d)}`, 30 * u, 74 * u);
  let y = 110; const records = rows.map((a) => { x.font = F(11); x.fillText(a.it, 30 * u, y * u); x.fillText(NUM[lang](a.a), 270 * u, y * u); y += 22; return { [t.desc]: a.it, [t.amount]: NUM[lang](a.a) }; });
  y += 10; x.font = F(13, true); x.fillText(t.total, 30 * u, y * u); x.fillText(NUM[lang](tot), 270 * u, y * u); y += 36; x.font = F(11); x.fillText(t.thanks, 30 * u, y * u);
  return make(P, { kind: 'receipt', fields: [{ label: t.date, value: DATE[lang](d) }, { label: t.total, value: NUM[lang](tot) }], columns: [t.desc, t.amount], records });
}
function memo(r, lang, px, face) {
  const t = L[lang], P = page(Math.round(8.5 * px), Math.round(11 * px)), { x } = P, u = px / 100, F = (s, b) => `${b ? 'bold ' : ''}${Math.round(s * u)}px ${FONTS[face]}`;
  const d = [2020 + Math.floor(r() * 6), 1 + Math.floor(r() * 12), 1 + Math.floor(r() * 28)], to = pick(r, t.names), from = pick(r, t.names), subj = pick(r, t.items);
  x.fillStyle = '#111'; x.font = F(24, true); x.fillText(t.memo.toUpperCase(), 80 * u, 100 * u);
  const fields = [{ label: t.to, value: to }, { label: t.from, value: from }, { label: t.date, value: DATE[lang](d) }, { label: t.subj, value: subj }];
  fields.forEach((f, i) => { x.font = F(13, true); x.fillText(f.label + ':', 80 * u, (150 + i * 26) * u); x.font = F(13); x.fillText(f.value, 200 * u, (150 + i * 26) * u); });
  x.fillRect(80 * u, 262 * u, 650 * u, 1.5 * u); let y = 310; const headings = [];
  t.heads.forEach((h, i) => { x.font = F(14, true); x.fillText(h, 80 * u, y * u); headings.push(h); y += 28; x.font = F(13); const b = t.body[i % t.body.length]; const mid = b.lastIndexOf(' ', 40); [b.slice(0, mid), b.slice(mid + 1)].forEach((ln) => { x.fillText(ln, 80 * u, y * u); y += 22; }); y += 28; });
  return make(P, { kind: 'memo', fields, headings });
}
function ruledForm(r, lang, px, face) {
  const t = L[lang], P = page(Math.round(8.5 * px), Math.round(11 * px)), { x } = P, u = px / 100, F = (s, b) => `${b ? 'bold ' : ''}${Math.round(s * u)}px ${FONTS[face]}`;
  const d = [2020 + Math.floor(r() * 6), 1 + Math.floor(r() * 12), 1 + Math.floor(r() * 28)];
  const cells = [[t.name, pick(r, t.names)], [t.date, DATE[lang](d)], [t.ph, `(${200 + Math.floor(r() * 700)}) ${200 + Math.floor(r() * 700)}-${1000 + Math.floor(r() * 8999)}`], [t.email, `${pick(r, t.names).split(' ')[1].toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}@example.org`], [t.city, pick(r, ['Nashville', 'Lyon', 'Bremen', 'Sevilla'])], [t.zip, String(10000 + Math.floor(r() * 80000))], [t.ref, `${pick(r, ['AB', 'KX', 'ZT'])}-${1000 + Math.floor(r() * 8999)}`], [t.amount, NUM[lang](money(r))]];
  x.fillStyle = '#111'; x.strokeStyle = '#111'; x.lineWidth = Math.max(1, 1.5 * u); x.font = F(22, true); x.fillText(t.invoice === 'Invoice' ? 'APPLICATION' : t.memo.toUpperCase(), 80 * u, 90 * u);
  const fields = []; cells.forEach(([k, v], i) => { const col = i % 2, row = Math.floor(i / 2), X = (80 + col * 330) * u, Y = (130 + row * 90) * u, W = 320 * u, H = 78 * u; x.strokeRect(X, Y, W, H); x.font = F(9); x.fillText(k, X + 8 * u, Y + 16 * u); x.font = F(15); x.fillText(v, X + 14 * u, Y + 52 * u); fields.push({ label: k, value: v }); });
  return make(P, { kind: 'form', fields });
}
function statement(r, lang, px, face) {
  const t = L[lang], P = page(Math.round(8.5 * px), Math.round(11 * px)), { x } = P, u = px / 100, F = (s, b) => `${b ? 'bold ' : ''}${Math.round(s * u)}px ${FONTS[face]}`;
  const cols = [t.desc, '2022', '2023', '2024'], cx = [80, 360, 480, 600].map((v) => v * u); x.fillStyle = '#111'; x.font = F(20, true); x.fillText(pick(r, t.orgs), 80 * u, 90 * u);
  let y = 160; x.font = F(13, true); cols.forEach((c, i) => x.fillText(c, cx[i], y * u)); x.fillRect(80 * u, (y + 8) * u, 640 * u, 1.5 * u); y += 36;
  const records = t.items.map((it) => { const vals = [2022, 2023, 2024].map(() => NUM[lang](money(r) * 100)); x.font = F(13); x.fillText(it, cx[0], y * u); vals.forEach((v, i) => x.fillText(v, cx[i + 1], y * u)); y += 30; return { [t.desc]: it, 2022: vals[0], 2023: vals[1], 2024: vals[2] }; });
  return make(P, { kind: 'statement', fields: [], columns: cols, records });
}
function letter(r, lang, px, face) {
  const t = L[lang], P = page(Math.round(8.5 * px), Math.round(11 * px)), { x } = P, u = px / 100, F = (s) => `${Math.round(s * u)}px ${FONTS[face]}`;
  const d = [2020 + Math.floor(r() * 6), 1 + Math.floor(r() * 12), 1 + Math.floor(r() * 28)], to = pick(r, t.names), from = pick(r, t.names);
  x.fillStyle = '#111'; x.font = F(13); let y = 110; [DATE[lang](d), '', to, pick(r, t.orgs), '', ...t.body.flatMap((b) => { const mid = b.lastIndexOf(' ', 44); return [b.slice(0, mid), b.slice(mid + 1), '']; }), from].forEach((ln) => { if (ln) x.fillText(ln, 90 * u, y * u); y += 26; });
  return make(P, { kind: 'letter', fields: [], headings: [] });
}
const FAMILIES = { invoice, receipt, memo, form: ruledForm, statement, letter };

// ── degradation: what a scan does to a page ──
function degrade(P, r, { skew = 0, noise = 0, fade = 0, blur = 0 }) {
  const out = page(P.w, P.h), { x, c } = out; x.save(); x.translate(P.w / 2, P.h / 2); x.rotate((skew * Math.PI) / 180); if (blur) x.filter = `blur(${blur}px)`; x.drawImage(P.c, -P.w / 2, -P.h / 2); x.restore(); x.filter = 'none';
  if (fade) { x.fillStyle = `rgba(255,255,255,${fade})`; x.fillRect(0, 0, P.w, P.h); }
  if (noise) { const im = x.getImageData(0, 0, P.w, P.h), d = im.data; for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 255 * noise; d[i] = Math.max(0, Math.min(255, d[i] + n)); d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n)); d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n)); } x.putImageData(im, 0, 0); }
  return c;
}

/** The corpus: `n` documents, deterministic from `seed`. Each: { id, family, lang, face, px, deg, canvas, truth }. */
export function corpus({ n = 24, seed = 1, langs = ['en', 'fr', 'de', 'es'], families = Object.keys(FAMILIES) } = {}) {
  const r = lcg(seed), out = [];
  for (let i = 0; i < n; i++) {
    const family = families[i % families.length], lang = langs[Math.floor(i / families.length) % langs.length], face = pick(r, ['serif', 'sans', 'sans', 'serif']), px = pick(r, [160, 190, 220]);
    const deg = { skew: +((r() - 0.5) * 3).toFixed(2), noise: +(r() * 0.22).toFixed(2), fade: +(r() * 0.18).toFixed(2), blur: r() < 0.3 ? 0.6 : 0 };
    const { P, truth } = FAMILIES[family](r, lang, px, face);
    const words = [...new Set([...truth.fields.flatMap((f) => [f.label, f.value]), ...(truth.columns || []), ...(truth.records || []).flatMap((rec) => Object.values(rec)), ...(truth.headings || [])].join(' ').split(/\s+/).filter((w) => /[\p{L}\p{N}]{3,}/u.test(w)))];
    out.push({ id: `${family}-${lang}-${i}`, family, lang, face, px, deg, canvas: degrade(P, r, deg), truth: { ...truth, words } });
  }
  return out;
}
export const toPng = (c) => new Promise((res) => c.toBlob(async (b) => res(new Uint8Array(await b.arrayBuffer())), 'image/png'));
export const FAMILY_NAMES = Object.keys(FAMILIES);
