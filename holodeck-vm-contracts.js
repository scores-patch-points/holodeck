// holodeck-vm-contracts.js — the Metro contracts workspace, served by the VM.
//
// The reading and indexing happened once on the VM (tools/contracts-api); this module is only the thin
// client: ask for departments, ask for a page, ask for one contract's reading. Nothing is ingested into
// the browser's store — a page of rows becomes light in-memory docs, and the text of one contract is
// fetched when it is opened.
//
// The API base is, in order: ?vmapi=<url>, localStorage hd:vm-api, the VM's public address.

const DEFAULT_API = 'https://watch.hyphae.social/contracts-api';
export const API = (() => {
  try {
    const q = new URLSearchParams(location.search).get('vmapi'); if (q) return q.replace(/\/$/, '');
    const s = localStorage.getItem('hd:vm-api'); if (s) return s.replace(/\/$/, '');
  } catch (e) {}
  return DEFAULT_API;
})();

async function get(path) {
  const r = await fetch(API + path);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

export const departments = () => get('/departments');
export const detail = tok => get('/contract/' + encodeURIComponent(tok));
export const related = tok => get('/contract/' + encodeURIComponent(tok) + '/related');
// the reader opens the copy with an OCR text layer (selectable, findable words on every scanned page); the API falls back
// to the captured PDF when no layered copy has been made yet
export const pdfUrl = tok => API + '/contract/' + encodeURIComponent(tok) + '/pdf?layer=ocr';
// where a phrase sits: the page and box, from the PDF's own words (the VM's /where); and that page as a picture
export const where = (tok, q) => get('/contract/' + encodeURIComponent(tok) + '/where?' + new URLSearchParams({ q, v: 2 }));
export const pagePic = (tok, n, w = 480) => API + '/contract/' + encodeURIComponent(tok) + '/page/' + n + '.jpg?w=' + w;
export async function page({ dept = '', q = '', sort = 'party', offset = 0, limit = 200 } = {}) {
  if (q.trim().length >= 3) {   // a search is a full-text search: every character of every contract, tolerant of OCR slips
    try { return await get('/search?' + new URLSearchParams({ q: q.trim(), dept, offset, limit: Math.min(limit, 100), per: 12 })); }
    catch (e) { /* an API that predates /search: headers and the reader's findings only */ }
  }
  const p = new URLSearchParams({ dept, q, sort, offset, limit });
  return get('/contracts?' + p);
}

// A search row carries the passages where the query was found (up to `per`, strongest first). They are the doc's
// text until it is opened, so the reader's engine — topics, names, links, the orbit — works over the places the
// query appears, across every contract found, with nothing typed into the interface.
function passagesOf(r) {
  return r.hits.map(h => (h.before ? '… ' : '') + h.text.replace(/\s+/g, ' ').trim() + (h.after ? ' …' : '')).join('\n\n');
}

// A list row → a light doc in the reader's shape (same fields the seeded contracts carry, so the table,
// Fields and Filter work unchanged). `vm` marks it as fetched-on-open: its text arrives with detail().
export function toDoc(r) {
  const yr = /(\d{4})\s*$/.exec(r.expires || '');
  return {
    id: 'nash-' + r.token,
    title: ((r.number || r.token) + ' — ' + (r.party || '')).replace(/\s*[—-]\s*$/, ''),
    year: yr ? +yr[1] : null,
    type: 'Contract', format: 'text', pages: null, text: r.hits ? passagesOf(r) : (r.gist || ''), obs: r.obs || 0, readState: r.read || '',
    thumb: API + '/contract/' + encodeURIComponent(r.token) + '/thumb.jpg',
    url: 'http://documents.nashville.gov/Request/Document/' + r.token,
    pdfSrc: pdfUrl(r.token), archiveUrl: r.archive_url || '',
    vendor: r.party || '', dept: r.department || '', about: r.description || '', contractNo: r.number || '',
    ...(r.expires ? { expires: r.expires } : {}),
    note: 'Metro Nashville contract ' + (r.number || r.token) + (r.department ? ', ' + r.department : '') + ' · served by the VM',
    vm: true,
    // a search row also carries where the phrase was found (the passages, how often, how it matched)
    ...(r.hits ? { token: r.token, hits: r.hits, hitTotal: r.hit_total || r.hits.length, hitKinds: r.kinds || {} } : {}),
  };
}

// The text a contract is read with: textOf, with the ignore faculty applied (holodeck-ignore.js, the same pass an uploaded
// PDF gets). A short line on most pages — Metro's blue ARCHIVE stamp is on every page — is blanked length-preservingly, so
// offsets hold, and disclosed on the doc as `ignored`. Without a page count there is no floor to measure against, so
// nothing is blanked rather than guessed.
export async function readText(j) {
  const text = textOf(j);
  if (!j || !j.pages) return { text, ignored: [] };
  try {
    const I = (await import(new URL('holodeck-ignore.js', import.meta.url).href)).planIgnores(text, { pages: j.pages });
    return I.removed ? { text: I.kept, ignored: I.ignored } : { text, ignored: [] };
  } catch (e) { return { text, ignored: [] }; }
}

// The text the Extracted view, the statements and find are made from: the whole extracted text when the VM sends it
// (it does since search reaches every character — a match must be findable where search found it), else the
// reading lane's observations in document order with overlapping spans dropped.
export function textOf(d) {
  if (d && String(d.text || '').trim().length > 200) return d.text;
  if (d && !(d.observations || []).length) return d.text || '';   // read as plain text (no clause rows)
  const obs = (d && d.observations || []).slice().sort((x, y) => (x.at[0] || 0) - (y.at[0] || 0));
  const out = []; let end = -1;
  for (const o of obs) { const [a, b] = o.at; if (a != null && a < end && b != null && b <= end) continue; out.push(o.verbatim); if (b != null) end = Math.max(end, b); }
  return out.join('\n');
}
