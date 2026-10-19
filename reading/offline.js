// offline.js — page side of offline mode. Registers ../sw.js, asks it to fetch everything the manifest lists, and keeps a small status
// chip honest about what is on this device. Nothing here changes how the page reads; it only makes the files the page needs local.
//
// Respects the Save-Data hint: with it on, only the page itself downloads automatically; the OCR engine (the heavy part) waits for a click.
export const PINNED = {
  pdfjs: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.min.mjs',
  pdfjsWorker: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs',
  tesseract: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
  tesseractWorker: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
  tesseractCore: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/',
  tessdata: 'https://tessdata.projectnaptha.com/4.0.0_fast',
};
export const hasSimd = () => { try { return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])); } catch { return false; } };

const mb = (n) => (n / 1048576).toFixed(1) + ' MB';
export function startOffline({ chip, onState } = {}) {
  const state = { supported: 'serviceWorker' in navigator, ready: false, cacheOnly: false, progress: null, groups: {}, error: null };
  const out = () => { render(); onState && onState(state); };
  const q = new URLSearchParams(location.search);
  const saveData = !!(navigator.connection && navigator.connection.saveData);
  let sw = null;
  const send = (m) => { const t = navigator.serviceWorker.controller || sw; if (t) t.postMessage(m); };

  function render() {
    if (!chip) return;
    const g = state.groups;
    const full = ['core', 'data', 'ocr'].every((k) => g[k] && g[k].have === g[k].total && g[k].total > 0);
    let label, title;
    if (!state.supported) { label = 'offline: unsupported here'; title = 'This browser has no service worker, or the page is not served over https / localhost.'; }
    else if (state.error) { label = 'offline: ' + state.error; title = state.error; }
    else if (state.progress && state.progress.done < state.progress.total) { label = `saving for offline… ${state.progress.done}/${state.progress.total} · ${mb(state.progress.bytes)}`; title = state.progress.current || ''; }
    else if (full) { label = state.cacheOnly ? '● offline test mode' : '● works offline'; title = 'Page, priors, PDF reader and OCR engine are on this device.' + (state.cacheOnly ? ' Network requests that are not cached fail, as they would with no connection.' : ''); }
    else if (g.core && g.core.have === g.core.total && g.core.total) { label = 'reads offline · OCR not saved'; title = 'Click to save the in-browser OCR engine (about 10 MB).'; }
    else { label = 'saving for offline…'; title = ''; }
    chip.textContent = label; chip.title = title; chip.dataset.state = full ? 'full' : state.error ? 'err' : 'part';
  }

  function handle(d) {
    if (d.type === 'progress') state.progress = d;
    else if (d.type === 'status') { state.groups = d.groups || {}; state.cacheOnly = !!d.cacheOnly; }
    else if (d.type === 'mode') state.cacheOnly = d.cacheOnly;
    else if (d.type === 'error') state.error = d.error;
    else if (d.type === 'warn') (state.warnings ||= []).push(d);
    out();
  }

  async function wanted() {
    const groups = ['core', 'data'];
    if (!saveData || q.has('offline')) groups.push('ocr');
    if (groups.includes('ocr') && !hasSimd()) groups.push('ocr-compat');
    return groups;
  }

  const api = {
    state,
    download: async (extra) => { send({ type: 'download', groups: extra || (await wanted()) }); },
    saveOcr: () => send({ type: 'download', groups: hasSimd() ? ['core', 'data', 'ocr'] : ['core', 'data', 'ocr', 'ocr-compat'] }),
    cacheOnly: (on) => send({ type: 'cache-only', on }),
    forget: () => send({ type: 'forget' }),
    refresh: () => send({ type: 'status' }),
  };
  if (chip) chip.addEventListener('click', () => { if (!state.error) api.saveOcr(); });
  if (!state.supported) { out(); return api; }
  navigator.serviceWorker.addEventListener('message', (e) => handle(e.data || {}));
  navigator.serviceWorker.register(new URL('../sw.js', import.meta.url)).then(async (reg) => {
    sw = reg.active || reg.waiting || reg.installing;
    await navigator.serviceWorker.ready;
    sw = reg.active;
    state.ready = true;
    api.refresh();
    if (q.get('offline') === 'test') api.cacheOnly(true);
    if (q.get('offline') !== 'off') await api.download();
    out();
  }).catch((err) => { state.error = String(err.message || err); out(); });
  return api;
}
