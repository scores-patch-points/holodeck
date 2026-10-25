// local-reading-worker.js — module worker. Reads the workspace's own documents through khora's master pipeline
// (holodeck-reader.js::readDocument), off the main thread, and posts back the merged FoldReadingIndex the tab used to build in place.
// The loop is the one in index.html's loadLocalReading (same inputs, same order, same merge), so the result is the same.
import * as M from './holodeck-reading.js';
import { readDocument } from './holodeck-reader.js';

self.onmessage = async e => {
  try {
    const { docs = [] } = e.data || {};
    const readings = [];
    for (const d of docs) {
      if (d.elements && d.elements.length) {
        readings.push(M.readSighted(d.id, d.elements, { readingText: d.readingText }));
      } else {
        const text = String(d.text || '').slice(0, 60000);
        let W = null; try { W = await readDocument(text, { quality: false, selfRead: false, address: d.id }); } catch (err) { W = null; }
        readings.push({ name: d.id, ...M.readDoc(d.id, text, { edges: (W && W.edges) || [] }, { passages: ((W && W.sentences) || []).length }) });
      }
      postMessage({ progress: readings.length, of: docs.length });
    }
    postMessage({ done: true, index: M.mergeReadings(readings, { from: 'workspace (read in this tab)' }) });
  } catch (err) {
    postMessage({ err: String((err && err.message) || err) });
  }
};
// A module whose imports use top-level await finishes evaluating late; a message posted before `onmessage` is set is
// lost. So the page waits for this, and only then sends the documents.
postMessage({ ready: true });
