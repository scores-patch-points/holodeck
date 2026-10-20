// build-punctuation-priors.mjs — the ABBREVIATIONS of each language, MEASURED, not typed. A word whose dot is not the end of a sentence ("Dr.",
// "Mr.", "St.", "etc.", "z. B.") is found from text itself by what it does:
//   · it is short (at most MAX_LEN letters) and occurs often (at least MIN_N times) in at least MIN_FILES different files (a language's own
//     convention, not one book's);
//   · it is almost always written with its dot (dotRate >= MIN_DOT) — an ordinary word is mostly written without one;
//   · or it is a TITLE: written with a capital at least TITLE_CAP of the time and with its dot at least TITLE_DOT of the time (British "Mr Darcy" and
//     American "Mr. Darcy" are both found);
//   · its dot almost never falls at the end of a paragraph (a sentence-final word's dot often does: paraEnd <= MAX_PARA) — an abbreviation
//     is followed by more of the same sentence.
// Nothing here knows any word. The result is data, one file per language (reading/punctuation-priors/<lang>.json), with its giver and its numbers,
// and the reader adds to it from the document it is reading.
//   node tools/build-punctuation-priors.mjs [--zen ../Zenodotus]
import { readdirSync, readFileSync, writeFileSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ZEN = resolve(HERE, process.argv.includes('--zen') ? process.argv[process.argv.indexOf('--zen') + 1] : '../../Zenodotus');
const OUT = resolve(HERE, '../reading/punctuation-priors');
// declared, structural: the criteria (not tuned to any document) and the corpora each language is read from
const MAX_LEN = 4, MIN_N = 8, MIN_DOT = 0.9, MAX_PARA = 0.03, MIN_FILES = 3, TITLE_CAP = 0.95, TITLE_DOT = 0.5, PER_FILE = 400_000, MAX_FILES = 80;
const CORPORA = {
  en: ['01-literature-books/gutenberg', '02-encyclopedic/wikipedia', '11-multi-language/war-and-peace/en'],
  fr: ['11-multi-language/french-originals', '11-multi-language/gutenberg-non-en/fr', '11-multi-language/war-and-peace/fr'],
  de: ['11-multi-language/german-originals', '11-multi-language/gutenberg-non-en/de'],
  es: ['24-global-literature/es'],
  pt: ['24-global-literature/pt'],
  it: ['11-multi-language/italian-originals'],
  ru: ['11-multi-language/war-and-peace/ru'],
};
const TEXT = /\.(txt|md)$/i;
const files = (dir) => { const out = []; const walk = (d) => { for (const n of readdirSync(d).sort()) { const p = join(d, n); const s = statSync(p); if (s.isDirectory()) walk(p); else if (TEXT.test(n) && !/\.eot\.json$/.test(n) && s.size > 5000) out.push(p); } }; walk(dir); return out; };
const WORD = /\p{L}+/gu;

mkdirSync(OUT, { recursive: true });
const index = { schema: 'PunctuationPriorIndex@1', criteria: { MAX_LEN, MIN_N, MIN_DOT, MAX_PARA }, langs: {} };
for (const [lang, dirs] of Object.entries(CORPORA)) {
  const pick = (all) => { const step = Math.max(1, Math.ceil(all.length / MAX_FILES)); return all.filter((_, i) => i % step === 0).slice(0, MAX_FILES); };
  const fl = dirs.flatMap((d) => (existsSync(join(ZEN, d)) ? pick(files(join(ZEN, d))) : []));
  const n = new Map(), dot = new Map(), para = new Map(), inFiles = new Map(), cap = new Map(); let tokens = 0;
  for (const f of fl) {
    const t = readFileSync(f, 'utf8').slice(0, PER_FILE).replace(/\r\n?/g, '\n'), seenHere = new Set();
    for (const m of t.matchAll(WORD)) { tokens++; const w = m[0]; if (w.length > MAX_LEN) continue; const k = w.toLowerCase(); n.set(k, (n.get(k) || 0) + 1); if (w[0] !== w[0].toLowerCase()) cap.set(k, (cap.get(k) || 0) + 1);
      if (t[m.index + w.length] === '.') { dot.set(k, (dot.get(k) || 0) + 1); if (!seenHere.has(k)) { seenHere.add(k); inFiles.set(k, (inFiles.get(k) || 0) + 1); } if (/^\.[ \t]*\n[ \t]*\n/.test(t.slice(m.index + w.length, m.index + w.length + 8)) || m.index + w.length + 1 >= t.length) para.set(k, (para.get(k) || 0) + 1); } }
  }
  const abbreviations = [], evidence = {};
  for (const [k, c] of n) { const d = dot.get(k) || 0; if (c < MIN_N || k.length < 1) continue; const rate = d / c, pe = (para.get(k) || 0) / Math.max(1, d); const titled = (cap.get(k) || 0) / c >= TITLE_CAP && rate >= TITLE_DOT && c >= MIN_N * 2; if ((rate >= MIN_DOT || titled) && pe <= MAX_PARA && (inFiles.get(k) || 0) >= Math.min(MIN_FILES, fl.length)) { abbreviations.push(k); evidence[k] = { n: c, files: inFiles.get(k), dotRate: +rate.toFixed(3), paraEnd: +pe.toFixed(3) }; } }
  abbreviations.sort();
  const rec = { schema: 'PunctuationPrior@1', lang, giver: `Zenodotus ${dirs.join(' + ')} (${fl.length} files, ${tokens} tokens)`, criteria: { MAX_LEN, MIN_N, MIN_DOT, MAX_PARA, MIN_FILES, TITLE_CAP, TITLE_DOT }, thin: fl.length < 10, abbreviations, evidence };
  writeFileSync(join(OUT, `${lang}.json`), JSON.stringify(rec));
  index.langs[lang] = { file: `${lang}.json`, abbreviations: abbreviations.length, files: fl.length, tokens };
  console.log(`${lang}: ${fl.length} files, ${tokens} tokens → ${abbreviations.length} abbreviations: ${abbreviations.slice(0, 40).join(' ')}`);
}
writeFileSync(join(OUT, 'index.json'), JSON.stringify(index, null, 1));
