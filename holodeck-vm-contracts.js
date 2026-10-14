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
export const pdfUrl = tok => API + '/contract/' + encodeURIComponent(tok) + '/pdf';
export function page({ dept = '', q = '', sort = 'party', offset = 0, limit = 200 } = {}) {
  const p = new URLSearchParams({ dept, q, sort, offset, limit });
  return get('/contracts?' + p);
}

// A list row → a light doc in the reader's shape (same fields the seeded contracts carry, so the table,
// Fields and Filter work unchanged). `vm` marks it as fetched-on-open: its text arrives with detail().
export function toDoc(r) {
  const yr = /(\d{4})\s*$/.exec(r.expires || '');
  return {
    id: 'nash-' + r.token,
    title: ((r.number || r.token) + ' — ' + (r.party || '')).replace(/\s*[—-]\s*$/, ''),
    year: yr ? +yr[1] : null,
    type: 'Contract', format: 'text', pages: null, text: r.gist || '', obs: r.obs || 0, readState: r.read || '',
    thumb: API + '/contract/' + encodeURIComponent(r.token) + '/thumb.jpg',
    url: 'http://documents.nashville.gov/Request/Document/' + r.token,
    pdfSrc: pdfUrl(r.token), archiveUrl: r.archive_url || '',
    vendor: r.party || '', dept: r.department || '', about: r.description || '', contractNo: r.number || '',
    ...(r.expires ? { expires: r.expires } : {}),
    note: 'Metro Nashville contract ' + (r.number || r.token) + (r.department ? ', ' + r.department : '') + ' · served by the VM',
    vm: true,
  };
}

// The reading lane's observations, in document order, with overlapping spans dropped — the text the
// Extracted view and the statements are made from.
export function textOf(d) {
  if (d && !(d.observations || []).length) return d.text || '';   // read as plain text (no clause rows)
  const obs = (d && d.observations || []).slice().sort((x, y) => (x.at[0] || 0) - (y.at[0] || 0));
  const out = []; let end = -1;
  for (const o of obs) { const [a, b] = o.at; if (a != null && a < end && b != null && b <= end) continue; out.push(o.verbatim); if (b != null) end = Math.max(end, b); }
  return out.join('\n');
}
