// holodeck-cut.js — the one statement cut for text the page holds no master reading of (a draft, an answer, a register sniff, a
// layout fallback): khora's spans.js::splitSentences inside each line, told which dotted tokens are words by English's MEASURED
// punctuation prior (janus priors/punctuation-eng.json, vendored as data), the text's own (spans.js::deriveAbbreviations) and any
// abbreviations a caller hands in (a page's hyperlexicon aliases). A line is the outer unit: a statement never crosses a line
// break. A document the page reads goes through the master pipeline instead (holodeck-reader.js::readDocument), which cuts the
// same way. SCOPE: the default prior is English's.
//   cutLines(text, { abbreviations }) → [{ s, e, text }]   offsets into the text given; text.slice(s, e) === text
import { splitSentences, deriveAbbreviations } from './vendor/khora/native/adapters/text/spans.js';
import PUNCT_ENG from './vendor/khora/native/priors/punctuation-eng.json' with { type: 'json' };

const PRIOR = (PUNCT_ENG.abbreviations || []).flatMap((t) => [t, t.charAt(0).toUpperCase() + t.slice(1), t.toUpperCase()]);

export function cutLines(text, { abbreviations = null } = {}) {
  const src = String(text ?? '');
  const known = new Set([...PRIOR, ...(abbreviations || []), ...deriveAbbreviations(src)]);
  const out = []; const lineRe = /[^\n]+/g; let m;
  while ((m = lineRe.exec(src))) {
    const line = m[0].replace(/\r/g, ' ');
    for (const x of splitSentences(line, { abbreviations: known })) { const s = m.index + x.offset; out.push({ s, e: s + x.text.length, text: src.slice(s, s + x.text.length) }); }
  }
  return out;
}
