// adapters/vision-macos.mjs — Apple Vision, macOS only. The text recogniser in Apple's Vision framework runs on
// this Mac (CPU, GPU and Neural Engine); it opens no sockets. tools/ocr-server/check.mjs --offline proves that on
// each run by reading a page with the network denied by the OS and comparing it with the ordinary reading.
//
// The Swift helper (vision.swift) is compiled once, with the Xcode command line tools' swiftc, into a cache folder
// keyed by the hash of its source, so editing the source rebuilds it and nothing else does.
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run, have } from '../proc.mjs';

const SRC = fileURLToPath(new URL('./vision.swift', import.meta.url));
const CACHE = process.env.HD_OCR_CACHE || join(process.env.XDG_CACHE_HOME || join(homedir(), '.cache'), 'holodeck-ocr');
// tesseract-style language codes (what the /ocr route takes) -> Vision's BCP-47 names
const LANGS = { eng: 'en-US', fra: 'fr-FR', deu: 'de-DE', spa: 'es-ES', ita: 'it-IT', por: 'pt-BR' };

let building = null;
/** ensureBuilt() -> { bin } | { error, hint } — compiled once per process, and once per source hash on disk. */
export function ensureBuilt() {
  return (building ||= (async () => {
    const hash = createHash('sha1').update(await readFile(SRC)).digest('hex').slice(0, 10);
    const bin = join(CACHE, 'vision-' + hash);
    try { await stat(bin); return { bin }; } catch (e) { /* not built yet */ }
    if (!(await have('swiftc', ['--version']))) return { error: 'swiftc is not installed', hint: 'xcode-select --install' };
    await mkdir(CACHE, { recursive: true });
    const r = await run('swiftc', ['-O', SRC, '-o', bin], { timeout: 300000 });
    if (r.code !== 0) return { error: 'swiftc failed: ' + r.err.trim().split('\n').slice(-3).join(' | ') };
    return { bin };
  })().then((b) => { if (b.error) building = null; return b; }));
}

/** the helper's JSON line for one image -> the common shape (confidence 0..100) */
export function fromHelper(o) {
  if (o.error) return { image: o.image, error: 'apple-vision: ' + o.error };
  return { image: o.image, ms: o.ms, w: o.w, h: o.h,
    lines: (o.lines || []).map((l) => ({ t: l.t, c: Math.round(l.c * 1000) / 10, b: l.b, words: (l.words || []).map((w) => ({ t: w.t, b: w.b || null, c: Math.round(l.c * 1000) / 10 })) })) };
}

export default {
  id: 'vision', label: 'Apple Vision', platforms: ['darwin'], onDevice: true, rank: 0,
  async probe() {
    const b = await ensureBuilt();
    if (b.error) return { ok: false, note: b.error, hint: b.hint || null };
    const r = await run(b.bin, ['--selftest'], { timeout: 20000 });
    let j = null; try { j = JSON.parse(r.out.trim().split('\n').pop()); } catch (e) { /* fall through */ }
    return j && j.ok ? { ok: true, version: 'revision ' + j.revision, languages: j.languages } : { ok: false, note: 'the Vision helper did not answer its self-test: ' + (r.err.trim() || r.out.trim() || 'exit ' + r.code) };
  },
  async read(images, { lang = 'eng', timeout = 120000 } = {}) {
    // a language Vision has no name here for is a typed gap, never a silent fall back to English
    const vl = LANGS[lang];
    if (!vl) return images.map((image) => ({ image, error: `apple-vision: no Vision language mapped for "${lang}" (mapped: ${Object.keys(LANGS).join(', ')})` }));
    const b = await ensureBuilt();
    if (b.error) return images.map((image) => ({ image, error: 'apple-vision: ' + b.error }));
    const r = await run(b.bin, ['accurate', '--lang', vl, ...images], { timeout: timeout * images.length });
    const got = new Map();
    for (const l of r.out.split('\n')) { if (!l.trim()) continue; try { const o = JSON.parse(l); got.set(o.image, fromHelper(o)); } catch (e) { /* a torn line */ } }
    return images.map((image) => got.get(image) || { image, error: 'apple-vision: no reading came back' + (r.err.trim() ? ' (' + r.err.trim().slice(0, 200) + ')' : '') });
  },
};
