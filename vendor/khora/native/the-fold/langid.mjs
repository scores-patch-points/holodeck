// the-fold/langid.mjs — the language ID the fold suites were tuned on, ported into khora.
//
// khora's old detectLanguage attested only WORD coverage against each POS prior, with no character
// shape, no orthographic marks and no margins the fold measured. The fold's detector — script first,
// then naive Bayes over each language's WORD and CHARACTER (1-3-gram of "_word_") distributions plus its
// declared function words, a decisive-clue layer for short asks, and a margin/fit abstention — scored
// 20/20 on the app's 22 languages and 51/51 on UDHR ground truth (eval/langid/UDHR-FALSIFY-RESULTS.md,
// and khora's own 04-foldsuite-langid analysis: "use the fold's detector for production"). This module
// builds the SAME model in-process from the SAME POSPrior@1 files (`janus/priors/pos-<iso3>.json`,
// the one home for the priors — khora reads it as data, never a module import), so
// nothing new is kept on disk and English is treated the way this repo treats it (not detected — see
// availableStems). The UDHR-extended tier is NOT wired here: it measured 42% wrong at 470-language
// resolution (family-right, code-wrong), so it is a hint at best, never a routing signal.
//
// Returns pos-* STEM codes (ISO 639-3: `cmn`, `spa`, `rus`, ...) so callers pass them straight to
// grammarFor(). DECLARED thresholds as the fold (q = round(-ln p * 10); ALPHA/RHO/KW/K2/K3/FW).
import { PRIORS_DIR } from "./priors-home.js";
import { IS_NODE, priorJson, priorNames } from "./prior-source.mjs";
const fs = IS_NODE ? (await import("node:fs")).default : null;

// The one home for the priors (janus), resolved by priors-home.js. Re-exported
// so callers that import PRIORS_DIR from this module keep working.
export { PRIORS_DIR };

const DECLARED = Object.freeze({
  margin: 4, wordWeight: 1, gramWeight: 0.3, minFunctionWords: 1, strongMargin: 10, minFit: 0.75,
  scriptMinFit: { Cyrillic: 0.8, Arabic: 0, Devanagari: 0 }, fwTop: 80, scriptMargin: { Cyrillic: 2.5 },
  markBonus: 8, decisiveMargin: 2,
});
const CUES = Object.freeze({
  eng: ["why", "did", "does", "who", "what", "how", "would", "should", "could"],
  spa: ["qué", "dónde", "cuándo", "quién", "cuál", "cómo", "porque", "hay", "otra"],
  fra: ["pourquoi", "comment", "quand", "où", "avec", "mais", "dans", "est"],
  deu: ["wer", "warum", "nicht", "mit", "weil", "und", "der", "das"],
  nld: ["waar", "waarom", "hoe", "wat"],
  ita: ["chi", "perché", "dove", "come"],
  rus: ["кто", "что", "это", "они", "как", "мы", "вы", "почему"],
  ukr: ["хто", "що", "є", "він", "вона", "їх", "як", "чому"],
  bul: ["кой", "какво", "това", "съм", "който", "беше"],
});
const MARKS = Object.freeze([[/[¿¡]/, "spa"]]);
// a script one language on disk owns, mapped to its pos stem (only scripts with a prior are named)
const SINGLE = Object.freeze({
  Hangul: "kor", Hebrew: "heb", Greek: "ell", Thai: "tha", Bengali: "ben", Gurmukhi: "pan", Gujarati: "guj",
  Oriya: "ori", Tamil: "tam", Telugu: "tel", Kannada: "kan", Malayalam: "mal", Sinhala: "sin", Lao: "lao",
  Tibetan: "bod", Myanmar: "mya", Georgian: "kat", Armenian: "hye", Ethiopic: "amh", Khmer: "khm",
});
const KW = 500, K2 = 300, K3 = 900, FW = 120, RHO = 0.25, ALPHA = 0.5;

// The candidate set is PINNED (langid-stems.json: the stems the detector was measured on). It used to be "every pos-*.json in the priors
// directory", so publishing more priors to janus changed this detector's answers without any change here: 177 new files turned the rus and
// deu detections into nulls (near-ties) and broke khora main's CI (2026-10-14). A stem enters the set deliberately, with the falsification
// re-run. No pin file = the old behaviour (every prior on disk).
// In a page the candidate set is the stems the page preloaded (no pin is read there).
const PIN = (() => { try { const j = JSON.parse(fs.readFileSync(new URL("./langid-stems.json", import.meta.url), "utf8")); return Array.isArray(j.stems) ? new Set(j.stems) : null; } catch { return null; } })();
export const PINNED_STEMS = PIN ? [...PIN].sort() : null;

/** The pos stems the reader can be asked in: every PINNED prior present on disk except English (which is the default, not
 *  detected — the repo's declared rule), the unimorph-derived files and the `pos-prior-*` backoffs. A
 *  missing home is no stems. `dir` and `pin` are injectable for the tests. */
export function availableStems({ dir = PRIORS_DIR, pin = PIN } = {}) {
  try {
    const names = dir && dir !== PRIORS_DIR ? fs.readdirSync(dir) : priorNames();
    const all = names.filter((f) => /^pos-[a-z-]+\.json$/.test(f) && !/unimorph|^pos-prior-|^pos-en\.json$|-lexicon\.json$/.test(f)).map((f) => f.slice(4, -5)).sort();
    return pin ? all.filter((s) => pin.has(s)) : all;
  } catch { return []; }
}

// ── the compact model, built lazily per stem from its POSPrior@1 ─────────────
const foldW = (s) => s.normalize("NFD").replace(/\p{M}+/gu, "").normalize("NFC");
const LETTERS = /[^\p{L}\p{M}]+/u;
function countsOf(prior) {
  const cnt = new Map();
  for (const [form, tags] of Object.entries(prior.forms || {})) { let c = 0; for (const n of Object.values(tags)) c += n; const f = form.normalize("NFC").toLowerCase(); for (const t of f.split(LETTERS)) if (t && /\p{L}/u.test(t)) cnt.set(t, (cnt.get(t) || 0) + c); }
  return cnt;
}
function q(c, T) { return Math.min(255, Math.max(0, Math.round(-Math.log(c / T) * 10))); }
function scriptOfStem(stem, prior) {
  const counts = {};
  for (const f of Object.keys(prior.forms || {}).slice(0, 4000)) for (const [name] of Object.entries(SCRIPT_RES)) { /* handled below */ }
  const order = [["Han", /\p{Script=Han}/u], ["Kana", /[\p{Script=Hiragana}\p{Script=Katakana}]/u], ["Hangul", /\p{Script=Hangul}/u], ["Arabic", /\p{Script=Arabic}/u], ["Hebrew", /\p{Script=Hebrew}/u], ["Cyrillic", /\p{Script=Cyrillic}/u], ["Greek", /\p{Script=Greek}/u], ["Devanagari", /\p{Script=Devanagari}/u], ["Bengali", /\p{Script=Bengali}/u], ["Thai", /\p{Script=Thai}/u], ["Latin", /\p{Script=Latin}/u]];
  for (const f of Object.keys(prior.forms || {}).slice(0, 4000)) { for (const [name, re] of order) if (re.test(f)) { counts[name] = (counts[name] || 0) + 1; break; } }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : "Latin";
}
function buildModel(cnt, script) {
  const w = new Map();
  for (const [t, c] of cnt) { const f = foldW(t); if (f !== t) { w.set(t, (w.get(t) || 0) + c * (1 - RHO)); w.set(f, (w.get(f) || 0) + c * RHO); } else w.set(t, (w.get(t) || 0) + c); }
  let N = 0; for (const c of cnt.values()) N += c;
  const words = [...w].sort((a, b) => b[1] - a[1]).slice(0, KW);
  const fwAll = new Set(); for (const t of [...cnt].sort((a, b) => b[1] - a[1]).slice(0, FW).map(([t]) => t)) { fwAll.add(t); fwAll.add(foldW(t)); }
  const g1 = new Map(), g2 = new Map(), g3 = new Map();
  for (const [t, c] of w) { const cs = [...("_" + t + "_")]; for (let i = 0; i < cs.length; i++) { if (cs[i] !== "_") g1.set(cs[i], (g1.get(cs[i]) || 0) + c); if (i + 2 <= cs.length) { const g = cs[i] + cs[i + 1]; if (g !== "__") g2.set(g, (g2.get(g) || 0) + c); } if (i + 3 <= cs.length) { const g = cs[i] + cs[i + 1] + cs[i + 2]; g3.set(g, (g3.get(g) || 0) + c); } } }
  let NG = 0; for (const m of [g1, g2, g3]) for (const c of m.values()) NG += c;
  const top = (m, k) => [...m].sort((a, b) => b[1] - a[1]).slice(0, k);
  const grams = [...top(g1, 1e9), ...top(g2, K2), ...top(g3, K3)];
  return {
    script, n: Math.round(N), wf: q(ALPHA, N), gf: q(ALPHA, NG),
    fw: [...fwAll].map((x) => x), w: words.map(([t, c]) => [t, q(c, N)]), g: grams.map(([t, c]) => [t, q(c, NG)]),
  };
}
const models = new Map();
function model(stem) {
  if (models.has(stem)) return models.get(stem);
  const prior = priorJson(`pos-${stem}.json`); if (!prior) { models.set(stem, null); return null; }
  const m = buildModel(countsOf(prior), scriptOfStem(stem, prior));
  models.set(stem, m); return m;
}

// ── the Ancient-Greek register gate (2026-10-08) ─────────────────────────────
// Greek script is shared by Ancient (polytonic) and Modern (monotonic) Greek,
// and the SINGLE map below names the script once: "Greek" → ell. The script
// alone cannot choose between them, so grc was UNREACHABLE through the
// detector. Where the priors allow it IS reachable, by measurement:
//   • the orthographic tell — Greek Extended (U+1F00–U+1FFF) or the combining
//     breathings/perispomeni (U+0313/0314/0342/0345) — is Ancient Greek and
//     monotonic Greek never writes it;
//   • else attestation against BOTH priors' own vocabularies breaks the tie
//     (Ancient forms like μῆνιν/ἄειδε live in pos-grc, Modern ones in pos-ell).
// A caller that NAMES a language bypasses this entirely (the declared fact
// beats the inferred one; see identifyLanguage's `language` option). Where
// neither signal fires, the ell path is byte-identical to before.
const POLYTONIC = /[\u1f00-\u1fff]/u;
const COMBINING_GREEK = /[\u0313\u0314\u0342\u0345]/u;
const formCache = new Map();
function wordset(stem) {
  if (formCache.has(stem)) return formCache.get(stem);
  const prior = priorJson(`pos-${stem}.json`);
  const set = prior ? new Set(Object.keys(prior.forms || {}).map((f) => f.normalize("NFC").toLowerCase())) : null;
  formCache.set(stem, set); return set;
}
/** ancientGreekOf(text, stems) → "grc" | "ell" — the measured register choice. */
function ancientGreekOf(text, stems) {
  const s = String(text ?? "");
  if (POLYTONIC.test(s) || (s.normalize("NFD").match(COMBINING_GREEK) || []).length >= 2) return "grc";
  if (stems.includes("grc") && stems.includes("ell")) {
    const tokens = s.normalize("NFC").toLowerCase().match(/[\p{L}\p{M}]+/gu) || [];
    if (tokens.length) {
      const g = wordset("grc"), e = wordset("ell");
      const gc = g ? tokens.filter((t) => g.has(t)).length / tokens.length : 0;
      const ec = e ? tokens.filter((t) => e.has(t)).length / tokens.length : 0;
      if (gc > ec && gc >= 0.1) return "grc";
    }
  }
  return "ell";
}

// ── scoring (the fold's) ─────────────────────────────────────────────────────
function decodeGroup(stems, script) {
  const g = { codes: [], wf: [], gf: [], words: new Map(), grams: new Map(), fw: [] };
  for (const st of stems) {
    const m = model(st); if (!m || m.script !== script) continue;
    const i = g.codes.length;
    g.codes.push(st); g.wf.push(-m.wf / 10); g.gf.push(-m.gf / 10);
    const fw = new Set(m.fw.slice(0, DECLARED.fwTop));
    g.fw.push(fw);
    for (const [w, qv] of m.w) { const a = g.words.get(w) || []; a.push(i, -qv / 10 + m.wf / 10); g.words.set(w, a); }
    for (const [gr, qv] of m.g) { const a = g.grams.get(gr) || []; a.push(i, -qv / 10 + m.gf / 10); g.grams.set(gr, a); }
  }
  return g.codes.length ? g : null;
}
const groupCache = new Map();
function groupOf(stems, script) {
  const key = script + "|" + stems.join(",");
  if (groupCache.has(key)) return groupCache.get(key);
  const g = decodeGroup(stems, script);
  groupCache.set(key, g); return g;
}
const SCRIPT_RES = [["Han", /\p{Script=Han}/u], ["Kana", /[\p{Script=Hiragana}\p{Script=Katakana}]/u], ["Hangul", /\p{Script=Hangul}/u], ["Arabic", /\p{Script=Arabic}/u], ["Hebrew", /\p{Script=Hebrew}/u], ["Cyrillic", /\p{Script=Cyrillic}/u], ["Greek", /\p{Script=Greek}/u], ["Devanagari", /\p{Script=Devanagari}/u], ["Bengali", /\p{Script=Bengali}/u], ["Thai", /\p{Script=Thai}/u], ["Latin", /\p{Script=Latin}/u]];
const LETTER = /\p{L}/u, MARKR = /\p{M}/u;
function runsOf(text) {
  const s = String(text ?? "").normalize("NFC").toLowerCase();
  const out = []; let cur = null;
  for (const ch of s) {
    if (MARKR.test(ch) && cur) { cur.text += ch; continue; }
    if (!LETTER.test(ch)) { cur = null; continue; }
    let sc = "Latin"; if (ch.codePointAt(0) >= 0x250) for (const [name, re] of SCRIPT_RES) if (re.test(ch)) { sc = name; break; }
    const fam = sc === "Kana" ? "Han" : sc;
    if (cur && cur.fam === fam) { cur.text += ch; if (sc === "Kana") cur.kana += 1; continue; }
    cur = { fam, text: ch, kana: sc === "Kana" ? 1 : 0 }; out.push(cur);
  }
  return out;
}
const CUE_WORD = new Map();
for (const [code, words] of Object.entries(CUES)) for (const w of words) CUE_WORD.set(w, code);

/** identifyLanguage(text) → { language, confident, hits, margin, fit, script, second } | { language:null, confident:false, script, gap }.
 *  The fold's scorer: naive Bayes over words + character grams, a decisive mark/clue wins a short ask, and no
 *  shared-script winner may claim a title whose own vocabulary fits nothing. Codes are pos STEMS. */
export function identifyLanguage(text, { stems = availableStems(), language = null } = {}) {
  const runs = runsOf(text);
  if (!runs.length) return { language: null, confident: false, script: "Other", hits: 0, margin: 0, gap: "no letters in a known script" };
  const latinWords = runs.filter((r) => r.fam === "Latin").length;
  const byFam = new Map();
  for (const r of runs) if (r.fam !== "Latin") { const e = byFam.get(r.fam) || { runs: 0, letters: 0, kana: 0 }; e.runs++; e.letters += r.text.length; e.kana += r.kana; byFam.set(r.fam, e); }
  let nl = null; for (const [fam, e] of byFam) if (!nl || e.letters > nl.e.letters) nl = { fam, e };
  const script = nl && nl.e.runs >= latinWords ? nl.fam : "Latin";
  // DECLARED BEATS INFERRED: a caller that names a language with a prior on
  // disk gets that language, bypassing the SINGLE script default — the path
  // that makes a caller-supplied language:"grc" reach Ancient Greek while the
  // ell default stands for everything unnamed. A named language with no prior
  // is a typed gap, never a silent fall-back.
  if (language) {
    if (stems.includes(language)) return { language, script, confident: true, hits: 1, margin: Infinity, second: null, fit: 1, forced: true };
    return { language: null, script, confident: false, hits: 0, margin: 0, gap: `caller named "${language}" but no prior for it on disk` };
  }
  if (script === "Han") {
    const k = byFam.get("Han")?.kana || 0;
    const cand = stems.filter((s) => ["cmn", "jpn"].includes(s));
    const lang = k > 0 && cand.includes("jpn") ? "jpn" : cand.includes("cmn") ? "cmn" : null;
    if (lang) return { language: lang, script: "Han", confident: true, hits: 1, margin: Infinity, second: null, fit: 1 };
    return { language: null, script: "Han", confident: false, hits: 0, margin: 0, gap: "no Han-script prior on disk" };
  }
  if (SINGLE[script]) {
    // Greek script: resolve the register (ancient grc / modern ell) where the
    // priors allow; every other single-script language is unchanged.
    const lang = script === "Greek" && stems.includes("grc") && stems.includes(SINGLE.Greek)
      ? ancientGreekOf(text, stems)
      : (stems.includes(SINGLE[script]) ? SINGLE[script] : null);
    if (lang) return { language: lang, script, confident: true, hits: 1, margin: Infinity, second: lang === "grc" && stems.includes("ell") ? "ell" : null, fit: 1, ...(script === "Greek" ? { register: lang === "grc" ? "ancient" : "modern" } : {}) };
    return { language: null, script, confident: false, hits: 0, margin: 0, gap: "no prior on disk for this script (" + script + ")" };
  }
  const g = groupOf(stems, script);
  if (!g) return { language: null, script, confident: false, hits: 0, margin: 0, gap: "no prior for script " + script };
  const tokens = runs.filter((r) => r.fam === script).map((r) => r.text);
  const n = g.codes.length, s = new Float64Array(n);
  const fwHits = new Int32Array(n), gramHit = new Int32Array(n);
  let words = 0, grams = 0, gramsAll = 0;
  for (const t of tokens) {
    const wa = g.words.get(t); if (wa) { words++; for (let k = 0; k < wa.length; k += 2) s[wa[k]] += DECLARED.wordWeight * wa[k + 1]; }
    const cs = [...("_" + t + "_")];
    for (let i = 0; i < cs.length; i++) for (let len = 1; len <= 3 && i + len <= cs.length; len++) {
      const gr = len === 1 ? cs[i] : len === 2 ? cs[i] + cs[i + 1] : cs[i] + cs[i + 1] + cs[i + 2];
      if (len === 1 && gr === "_") continue; if (len === 2 && gr === "__") continue;
      gramsAll++;
      const ga = g.grams.get(gr); if (ga) { grams++; for (let k = 0; k < ga.length; k += 2) { s[ga[k]] += DECLARED.gramWeight * ga[k + 1]; gramHit[ga[k]]++; } }
    }
  }
  for (let i = 0; i < n; i++) s[i] += DECLARED.wordWeight * words * g.wf[i] + DECLARED.gramWeight * grams * g.gf[i];
  for (const t of tokens) if (t.length >= 2) for (let i = 0; i < n; i++) if (g.fw[i].has(t)) fwHits[i]++;
  const dec = new Int32Array(n);
  for (const [re, code] of MARKS) { const j = g.codes.indexOf(code); if (j >= 0 && re.test(String(text))) { s[j] += DECLARED.markBonus; fwHits[j]++; dec[j]++; } }
  for (const t of tokens) { const cue = CUE_WORD.get(t); if (cue) { const j = g.codes.indexOf(cue); if (j >= 0) { s[j] += 14; fwHits[j]++; dec[j]++; } } }
  let b = 0, b2 = -1; for (let i = 1; i < s.length; i++) if (s[i] > s[b]) b = i;
  for (let i = 0; i < s.length; i++) if (i !== b && (b2 < 0 || s[i] > s[b2])) b2 = i;
  const margin = s[b] - (b2 >= 0 ? s[b2] : 0);
  const hits = fwHits[b], fit = gramsAll ? gramHit[b] / gramsAll : 0;
  // real word coverage (the old API's meaning): the share of the text's tokens the winner's own word map lists
  let covered = 0, all = 0;
  for (const t of tokens) { if (t.length < 2) continue; all++; const wa = g.words.get(t); if (wa) for (let k = 0; k < wa.length; k += 2) if (wa[k] === b) { covered++; break; } }
  const coverage = all ? covered / all : 0;
  if (!words && !grams) return { language: null, script, confident: false, hits, margin, coverage, gap: "nothing any prior attests" };
  const decisive = dec[b] > 0;
  const needFw = script === "Latin" ? DECLARED.minFunctionWords : 0;
  const need = DECLARED.scriptMargin[script] ?? DECLARED.margin;
  const wantFit = DECLARED.scriptMinFit[script] ?? DECLARED.minFit;
  const own = margin >= (decisive ? DECLARED.decisiveMargin : need) && fit >= (decisive ? 0 : wantFit) && (hits >= needFw || decisive || (margin >= DECLARED.strongMargin && tokens.length >= 2));
  if (!own) return { language: null, script, confident: false, hits, margin, fit, coverage, second: b2 >= 0 ? g.codes[b2] : null, gap: "no candidate clearly wins (margin " + margin.toFixed(1) + ", fit " + fit.toFixed(2) + ") — undetected, never guessed" };
  return { language: g.codes[b], script, confident: true, hits, margin, fit, coverage, second: b2 >= 0 ? g.codes[b2] : null };
}

// ── per-sentence detection: language can switch MID-SENTENCE ─────────────────
// A text is not one language. The reader hears sentence by sentence (language-listener already streams that way);
// a sentence with no language of its own (very short, a name, a fragment) INHERITS the previous sentence's
// confident language, marked `inherited` so nothing is guessed about it. Whole-text identifyLanguage is the
// strongest single signal; this is the per-segment view for a code-switched document.
export function sentenceLanguages(text, { stems = availableStems() } = {}) {
  const t = String(text ?? "").trim();
  if (!t) return [];
  const parts = t.split(/(?<=[.!?。！？؟])\s+/u).map((x) => x.trim()).filter(Boolean);
  const out = []; let last = null;
  for (const raw of parts) {
    const d = identifyLanguage(raw, { stems });
    const tokens = (raw.match(/[\p{L}\p{N}]+/gu) || []).length;
    let language = d.confident ? d.language : null, inherited = false;
    // signal-over-noise: accept the previous sentence's language for a fragment that is all noise on its own —
    // but NEVER for a sentence that confidently says something else (that is the mid-sentence switch)
    if (!language && last && (tokens < 4) && d.margin <= DECLARED.margin) { language = last; inherited = true; }
    out.push({ text: raw, start: t.indexOf(raw), language, confident: d.confident, inherited, margin: d.margin ?? 0, coverage: d.coverage ?? 0, fit: d.fit ?? 0, script: d.script });
    if (language) last = language;
  }
  return out;
}