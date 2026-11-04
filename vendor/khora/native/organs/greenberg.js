// native/organs/greenberg.js — the archon of word-order and script universality.
// Handle: Greenberg — after Joseph Greenberg, "Some Universals of Grammar with
// Particular Reference to the Order of Meaningful Elements" (1963): SOV, SVO
// and VSO are each real, common, well-attested word orders, and none of them
// is what a language defaults to in the absence of evidence — evidence is
// language-specific and must be declared as such. Amendment XVII.
//
// WHAT IT IS. Not a scan of ingested material (see salzter.js/goffman.js for
// that side of the seam) — a structural scan of eoreader7's OWN source for
// the one shape this suite's own law already names, measures, and forbids in
// four different registers, and has already paid to discover the hard way:
//
//   - S86/S87: capitalisation is `extractSurfaces`' ONLY signal for a being,
//     and it collapses to exactly zero on a lowercased novel or a caseless
//     script (Hebrew, Korean) — not a degradation, a collapse.
//   - S89 (constitution Article II.13, "the script earning test"): a
//     mechanism scoped to one language is not a defect; asserting it is
//     script-agnostic without disclosure, or without naming the scope as a
//     received giver, is — "the silence is the more severe failure than
//     the scope."
//   - S92: a whole-document script verdict cannot answer a per-sentence
//     question; a mixed-script document needs the same test run per segment.
//   - S95 rule 2: "No line may say `subject`, `verb` or `object`" — P76
//     already renamed those fields to `end1`/`label`/`end2` so the ledger
//     itself carries no part-of-speech, English or otherwise; a reader's
//     ENGLISH INTERPRETATION of a cell is declared once, in the recipe,
//     never smeared across records.
//   - S96 (capitalisation starves the verb tier too): the identical
//     single-signal defect, one register later — a real, tested, already-
//     built lever (`anchorSpans`) sat wired into nothing for the six days
//     between its own writeup and this organ's first run.
//
// This organ does not re-derive any of that; it turns the pattern each entry
// found by hand into a standing, repeatable check, so the next occurrence is
// a five-second scan instead of a week of hand-reading a chapter against its
// own ledger. Four typed findings, each a WITNESS, never a VERDICT — the same
// posture as every organ here (salzter.js's own words): a finding names the
// shape and the line; whether it is a real gap or an already-disclosed,
// deliberately English-scoped mechanism (S89's licensed case) is for the
// reader — human or the chorus's own Tier-2 lens — to judge, from the actual
// surrounding lines this organ attaches, never from a score of its own.
//
// TRIED AND DROPPED: scoring each hit "probably disclosed nearby" by keyword
// proximity (`script`, `case`, `giver`, `disclosed`...). Checked against real
// material, not just synthetic cases, and it failed there: puzzle-templates.js
// line 69's undisclosed `[A-Z]` name-list regex sat three lines above an
// unrelated puzzle TEMPLATE's own `giver:` attribution field and scored
// "probably disclosed" for it. A confidence number a reviewer learns to trust,
// built on a signal that loose, is worse than no number — S89's own rule
// ("the silence is the more severe failure than the scope") applied to this
// organ's own evidence. So every hit is reported flat, with its immediate
// surrounding lines attached as `context`, and the actual judgment of
// "disclosed or not" is left to whoever reads that context — never a score.
//
// FOUR SHAPES, NOT A STYLE PREFERENCE. This organ never asks for capitalisation
// or word order to be removed — S89 is explicit that a real, disclosed,
// English-scoped mechanism is not a defect. It asks only that the scope be
// DECLARED where the mechanism is used, the same discipline `giver` fields
// already carry everywhere else in this codebase.
//
//   1. capitalization_unguarded — a bare `[A-Z]` character class or a
//      `.toUpperCase() === …` / capitalize-first-letter identity test.
//   2. silent_english_default — a `language` parameter treated as English
//      the moment it is null/undefined, rather than an explicit declared
//      default or a typed gap (morphology.js's own `englishRule`, S89's
//      "the silence is the more severe failure than the scope").
//   3. svo_field_leak — a record reads or writes `subject`/`verb`/`object`
//      as field names. Flagged `needs_migration` when the same file carries
//      no `end1`/`end2`/`label` at all (S95 rule 2 fully unmet); flagged
//      `bridging` when it does (a legacy name kept only as an inbound
//      compatibility shim onto the real schema — S95's own transition
//      posture, not new debt).
//   4. latin_punctuation_only — a sentence-boundary split built on a bare
//      `[.!?]`-style character class (S92's own point: a whole-document or
//      whole-mechanism verdict cannot answer what a mixed- or
//      caseless-script segment needs).
//
//   5. english_codec_default — the Isthmus shape (native/docs/THE-ISTHMUS.md,
//      2026-10-26). Any material reaches EOT only through ITS codec; a
//      language with no codec is a typed gap, never the English codec
//      (THE-READING-PIPELINE.md:36-39). Three lexical forms, each reported
//      with `form`:
//        param_default — `lang = "en"` / `language = "eng"` as a parameter
//                        or destructure default (read-atoms.js's
//                        `readAtoms({ lang = "en" })`, the default the
//                        meaning stage read through for seven PRs);
//        fallback      — `?? "eng"` / `|| "en"` after whatever was declared
//                        or heard;
//        literal       — `language: "eng"` / `lang: "en"` hard-wired at a
//                        call (english-parser.js's `toEot(s, { language:
//                        "eng" })`): the codec chosen by the code, not by
//                        the material.
//      Shape 2 caught only `language == null … || "eng"`; these three forms
//      are how the defect actually shipped, and shape 2 saw none of them.
//   6. english_word_pattern — a regex that decides by matching English words
//      under an ASCII `\b` (`/\bplus\b/`, `/\bwhat('s| is)\b/`,
//      `/\bfunctions?\b/`) or an anchored alternation of lowercase words
//      (`/^(what|is|are|the)$/`). In JS `\b` is ASCII-only even with the
//      `u` flag (S34), and a word list is one language's lexicon standing in
//      for the codec's reading. A mechanism scoped to English and DECLARED
//      as such is S89's licensed case — the context attached says whether it
//      is; this organ never decides.
//
// Deliberately NOT attempted: real AST parsing. Every other structural organ
// in this ladder (salzter.js parses a real AST for Python) has a reason to;
// this one's four shapes are lexical — a character class, a field name, a
// null-coalescing default — and a line-window heuristic states its own
// limits honestly (a `[A-Z]` inside a string literal that is not a regex
// reads identically to one that is) rather than buying precision this scan
// does not need with a dependency it does not otherwise have.

const WINDOW_LINES = 2;

const CAP_CHARCLASS = /\[A-Z\]/;
const CAP_UPPER_TEST =
  /\.toUpperCase\(\)\s*={2,3}|={2,3}[^;\n]{0,40}\.toUpperCase\(\)|\[0\]\.toUpperCase\(\)/;
const ENGLISH_DEFAULT =
  /\blanguage\b[^;\n]{0,60}?(==|===)\s*(null|undefined)[^;\n]{0,80}?\|\|[^;\n]{0,80}?["'](?:eng|english)["']/i;
const SVO_FIELD = /\.(subject|verb|object)\b|\b(subject|verb|object)\s*:/g;
const SVO_EXCLUDE = /\btypeof\b|\binstanceof\b|\bObject\.|new\s+Object\b/;
const LATIN_PUNCT_CHARCLASS = /\[\.\!\?/;
// Shape 5. The English codec names: ISO 639-1/3, the word, and the en-US tag.
const EN_VALUE = String.raw`["'](?:en|eng|english|en-US|en_US)["']`;
const LANG_IDENT = String.raw`\b(?:lang|language|langCode|lang_code|locale|lng)\b`;
const CODEC_PARAM_DEFAULT = new RegExp(String.raw`${LANG_IDENT}\s*(?<![=!<>])=(?!=)\s*${EN_VALUE}`, "i");
const CODEC_FALLBACK = new RegExp(String.raw`(?:\?\?|\|\|)\s*${EN_VALUE}`, "i");
const CODEC_LITERAL = new RegExp(String.raw`${LANG_IDENT}\s*:\s*${EN_VALUE}`, "i");
// `<html lang="en">` in a template is the DOCUMENT's declared language (an
// HTML attribute the page's author sets), not a codec chosen for material.
// Measured on a 12-hit sample of khora: 3 of 12 were this, so it is excluded.
const HTML_LANG_ATTR = /<[a-z][\w-]*\b[^>]*\blang\s*=\s*\\?["']/i;
// Shape 6. In the SOURCE text `\b` is a backslash and a b; a word of two or
// more lowercase ASCII letters follows it (optionally inside a group), or an
// anchored group alternates three or more lowercase words.
const WORD_UNDER_ASCII_B = /\\b\(?(?:\?:)?[a-z]{2,}/;
const ANCHORED_WORD_LIST = /\^\((?:\?:)?[a-z]{2,}(?:\|[a-z']{1,}){2,}\)/;

function splitLines(source) {
  return String(source ?? "").split(/\r\n|\r|\n/);
}

function isCommentOnly(line) {
  return /^\s*(\/\/|\*|\/\*)/.test(line);
}

function contextWindow(lines, idx, span = WINDOW_LINES) {
  const from = Math.max(0, idx - span);
  const to = Math.min(lines.length, idx + span + 1);
  return lines.slice(from, to).join("\n");
}

function finding(rule, file, lineNo, excerpt, extra = {}) {
  return { rule, file, line: lineNo, excerpt: excerpt.trim().slice(0, 160), ...extra };
}

// Deliberately NOT a "confidence: low/needs_review" score built from keyword
// proximity. Tried first, and dropped on real material: this codebase's own
// vocabulary (`giver`, `case`, `disclosed`, `scoped`) is dense enough that
// almost every function has one of those words somewhere in a 30-line window
// for reasons unrelated to THIS gate — puzzle-templates.js:69's AGENT_LIST_RE
// sat three lines from an unrelated template's own `giver:` attribution field
// and would have been scored "probably disclosed" for it. A confidence
// number a reviewer comes to trust, built on a signal that quiet, is worse
// than no number — S89's own rule applied to this organ's own evidence: the
// silence about how weak the proximity signal is would be the more severe
// failure. So: every hit is reported flat, with the surrounding lines
// attached so a reviewer reads the real disclosure (or its absence)
// themselves, in context, rather than trusting a score for it.
function withContext(rule, file, lines, idx, extra = {}) {
  return finding(rule, file, idx + 1, lines[idx], {
    context: contextWindow(lines, idx, 2),
    ...extra,
  });
}

export function scanCapitalizationUnguarded(source, file) {
  const lines = splitLines(source);
  const out = [];
  lines.forEach((line, i) => {
    if (isCommentOnly(line)) return;
    if (!CAP_CHARCLASS.test(line) && !CAP_UPPER_TEST.test(line)) return;
    out.push(withContext("capitalization_unguarded", file, lines, i, { law: ["S86", "S87", "S89"] }));
  });
  return out;
}

export function scanSilentEnglishDefault(source, file) {
  const lines = splitLines(source);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (isCommentOnly(lines[i])) continue;
    const pair = i + 1 < lines.length ? `${lines[i]}\n${lines[i + 1]}` : lines[i];
    if (!ENGLISH_DEFAULT.test(lines[i]) && !ENGLISH_DEFAULT.test(pair)) continue;
    out.push(
      finding("silent_english_default", file, i + 1, lines[i], {
        confidence: "needs_review",
        law: ["S89"],
      }),
    );
  }
  return out;
}

export function scanSvoFieldLeak(source, file) {
  const lines = splitLines(source);
  const fileHasEndSchema = /\bend1\b|\bend2\b|\blabel\s*[:,)]/.test(source ?? "");
  const out = [];
  lines.forEach((line, i) => {
    if (isCommentOnly(line)) return;
    if (SVO_EXCLUDE.test(line)) return;
    const seen = new Set();
    const re = new RegExp(SVO_FIELD.source, "g");
    let m;
    while ((m = re.exec(line)) !== null) {
      const field = (m[1] ?? m[2]).toLowerCase();
      if (seen.has(field)) continue;
      seen.add(field);
      out.push(
        finding("svo_field_leak", file, i + 1, line, {
          field,
          confidence: fileHasEndSchema ? "bridging" : "needs_migration",
          law: ["S95"],
        }),
      );
    }
  });
  return out;
}

export function scanLatinPunctuationOnly(source, file) {
  const lines = splitLines(source);
  const out = [];
  lines.forEach((line, i) => {
    if (isCommentOnly(line)) return;
    if (!LATIN_PUNCT_CHARCLASS.test(line)) return;
    out.push(withContext("latin_punctuation_only", file, lines, i, { law: ["S92"] }));
  });
  return out;
}

export function scanEnglishCodecDefault(source, file) {
  const lines = splitLines(source);
  const out = [];
  lines.forEach((line, i) => {
    if (isCommentOnly(line)) return;
    // Shape 2 already owns `language == null … || "eng"`; one line, one finding.
    if (ENGLISH_DEFAULT.test(line)) return;
    if (HTML_LANG_ATTR.test(line)) return;
    const form = CODEC_PARAM_DEFAULT.test(line)
      ? "param_default"
      : CODEC_FALLBACK.test(line)
        ? "fallback"
        : CODEC_LITERAL.test(line)
          ? "literal"
          : null;
    if (!form) return;
    out.push(withContext("english_codec_default", file, lines, i, { form, law: ["Isthmus", "S89"] }));
  });
  return out;
}

export function scanEnglishWordPattern(source, file) {
  const lines = splitLines(source);
  const out = [];
  lines.forEach((line, i) => {
    if (isCommentOnly(line)) return;
    const form = WORD_UNDER_ASCII_B.test(line) ? "ascii_word_boundary" : ANCHORED_WORD_LIST.test(line) ? "anchored_word_list" : null;
    if (!form) return;
    out.push(withContext("english_word_pattern", file, lines, i, { form, law: ["Isthmus", "S34", "S89"] }));
  });
  return out;
}

export function scanSource(source, file) {
  return [
    ...scanCapitalizationUnguarded(source, file),
    ...scanSilentEnglishDefault(source, file),
    ...scanSvoFieldLeak(source, file),
    ...scanLatinPunctuationOnly(source, file),
    ...scanEnglishCodecDefault(source, file),
    ...scanEnglishWordPattern(source, file),
  ];
}

export function scanFiles(fileTexts) {
  const out = [];
  for (const [file, source] of Object.entries(fileTexts)) out.push(...scanSource(source, file));
  return out;
}

export function summarize(findings) {
  const byRule = {};
  for (const f of findings) {
    byRule[f.rule] = byRule[f.rule] ?? { total: 0, needs_review: 0, low: 0, bridging: 0, needs_migration: 0 };
    byRule[f.rule].total += 1;
    const key = f.form ?? f.confidence ?? "needs_review";
    byRule[f.rule][key] = (byRule[f.rule][key] ?? 0) + 1;
  }
  return byRule;
}

// A directory is walked for source files (JS and TS alike: foldcode's plugin
// is TypeScript, and the shapes are lexical). node_modules, .git and build
// output are skipped; test files are skipped unless --tests, because a
// fixture that DECLARES English for an English sentence is the licensed case.
const SOURCE_EXT = /\.(?:m?js|cjs|tsx?)$/;
const SKIP_DIR = new Set(["node_modules", ".git", "dist", "build", ".turbo", ".next", "coverage"]);
const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/;

export async function collectSources(paths, { tests = false } = {}) {
  const { readFile, readdir, stat } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const fileTexts = {};
  async function visit(p, top) {
    let st;
    try {
      st = await stat(p);
    } catch (err) {
      if (top) throw err;
      return; // a dangling link inside a walked tree is not source
    }
    if (st.isDirectory()) {
      for (const name of await readdir(p)) {
        if (SKIP_DIR.has(name)) continue;
        await visit(join(p, name), false);
      }
      return;
    }
    // A file named on the command line is always read; a walked one only if it is source.
    if (!top && (!SOURCE_EXT.test(p) || (!tests && TEST_FILE.test(p)))) return;
    if (st.size > 2_000_000) return; // a bundle or a generated table, not a mechanism
    fileTexts[p] = await readFile(p, "utf8");
  }
  for (const p of paths) await visit(p, true);
  return fileTexts;
}

async function main(argv) {
  const args = argv.slice(2);
  const flag = (name) => args.includes(name);
  const ruleArg = args.indexOf("--rule");
  const only = ruleArg >= 0 ? args[ruleArg + 1] : null;
  const paths = args.filter((a, i) => !a.startsWith("--") && !(ruleArg >= 0 && i === ruleArg + 1));
  if (paths.length === 0) {
    console.error("usage: node native/organs/greenberg.js [--tests] [--summary] [--json] [--rule <rule>] <file|dir> [...]");
    process.exit(2);
  }
  const fileTexts = await collectSources(paths, { tests: flag("--tests") });
  let findings = scanFiles(fileTexts);
  if (only) findings = findings.filter((f) => f.rule === only);
  if (flag("--json")) {
    console.log(JSON.stringify({ files: Object.keys(fileTexts).length, summary: summarize(findings), findings }, null, 2));
    return;
  }
  if (!flag("--summary")) {
    for (const f of findings) {
      const tag = f.form ?? f.confidence ?? "witness";
      console.log(`${f.file}:${f.line} [${f.rule}/${tag}] ${f.excerpt}`);
    }
    console.log("");
  }
  console.log(`files scanned: ${Object.keys(fileTexts).length}`);
  console.log(JSON.stringify(summarize(findings), null, 2));
}

if (typeof process !== "undefined" && process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv);
}
