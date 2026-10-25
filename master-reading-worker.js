// master-reading-worker.js — module worker. Reads one document at a time through khora's MASTER PIPELINE (holodeck-reader.js::
// readDocument → read-core.mjs::readDocument), off the main thread, and posts back the reading as plain data (WeftEntry@4). The
// page's names, statements and relations come from this one read; nothing on the page finds a name by its own rule.
//   in:  { id, text, cap }   cap: the most characters read (a longer text is cut, and the cut is said)
//   out: { id, entry, cut } · { id, err } · { ready: true }
import { readDocument } from './holodeck-reader.js';

self.onmessage = async (e) => {
  const { id, text = '', cap = 0 } = e.data || {};
  try {
    const t = String(text);
    const cut = cap && t.length > cap ? { read: cap, total: t.length } : null;
    // names and relations only: the clause tree (a 16 MB parser) and the self-read claims are not asked for here
    const W = await readDocument(cut ? t.slice(0, cap) : t, { quality: false, selfRead: false, address: id });
    postMessage({ id, entry: JSON.parse(JSON.stringify(W)), cut });
  } catch (err) {
    postMessage({ id, err: String((err && err.message) || err) });
  }
};
// a module whose imports use top-level await finishes evaluating late; the page waits for this before sending
postMessage({ ready: true });
