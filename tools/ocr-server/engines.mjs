// engines.mjs — the eyes that read pixels on THIS machine, in preference order, probed once and remembered.
//
// An eye is admitted only if it runs here and is on-device; HD_OCR_ENGINES=tesseract (comma list) narrows the set.
// macOS gets Apple Vision first; every platform gets tesseract. A Windows adapter (Windows.Media.Ocr) and a Linux
// one beyond tesseract are NOT written yet: they slot in as one more file in adapters/ with the same four members.
import vision from './adapters/vision-macos.mjs';
import tesseract from './adapters/tesseract.mjs';

export const ADAPTERS = [vision, tesseract];
let cache = null, at = 0;

/** detect({ force }) -> { eyes:[adapter...], report:[{ id, label, ok, ... }] } — eyes is usable adapters, best first */
export async function detect({ force = false, ttl = 60000 } = {}) {
  if (!force && cache && Date.now() - at < ttl) return cache;
  const only = (process.env.HD_OCR_ENGINES || '').split(',').map((s) => s.trim()).filter(Boolean);
  const mine = ADAPTERS.filter((a) => a.platforms.includes(process.platform) && (!only.length || only.includes(a.id)));
  const probed = await Promise.all(mine.map(async (a) => ({ a, p: await a.probe() })));
  const eyes = probed.filter((x) => x.p.ok && x.a.onDevice).map((x) => x.a).sort((x, y) => x.rank - y.rank);
  const report = ADAPTERS.map((a) => {
    const x = probed.find((q) => q.a === a);
    return x ? { id: a.id, label: a.label, onDevice: a.onDevice, ...x.p } : { id: a.id, label: a.label, ok: false, note: only.length && !only.includes(a.id) ? 'not enabled (HD_OCR_ENGINES)' : 'not available on ' + process.platform };
  });
  at = Date.now();
  return (cache = { eyes, report });
}
