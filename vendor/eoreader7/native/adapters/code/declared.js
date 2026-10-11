// declared.js — C3 reader: the entities a source file DECLARES, recovered from RECEIVED priors only.
//
// Lovelace's law (archon-holocracy role:lovelace): the engine has no pretensions to originate anything. Reading
// code is recovering what the text ORDERS (declarations), not guessing intent. This module is GRAMMAR-AGNOSTIC:
// one code path for every language. All language knowledge is a received prior JSON,
// "CodeDeclarationFramePrior@1", built by buildDeclaredPrior() from a TRAIN corpus whose giver is an independent
// authority (tree-sitter tokens/defs: eval/coding-competence/gold.mjs). The measuring instrument is
// eval/coding-competence/c3-declared.mjs, whose header holds the pre-registration; read it first.
//
// What the prior holds (see the header there for the derivation thresholds):
//   lexical    comment openers/closers, quote openers, qualifier ("::"), name suffix ("?" "!"): so comments and
//              strings are SKIPPED, not read
//   keywords   closed class K: REFUSES, a keyword never names a being
//   declaring  words D (def, class, func, #define ...) derived as "the word before a def name"
//   frames     P(def | frame) at backoff levels h4 h3 h2 h1 (with enclosing scope S) and g2 g1 (without), plus
//              fine-kind counts; since amendment A7 also the left-context-only levels c1 q2 q3 (no token to the right
//              of the candidate is read: the strict-prefix chain CHAINS.prefix) and the coarse chain CHAINS.coarse
//   witnesses  casing class and recurrence bucket as ONE additive log-likelihood-ratio each, never THE signal
//
// Priors NOMINATE (frame probability) and REFUSE (keywords); the text's own evidence ADMITS (the frame instance in
// THIS text, its recurrence in this file, its casing). The prior never yields a name that is not a token of the text.
//
// No model is called anywhere here, and nothing of the file read reaches the prior.

export const DECLARED_PRIOR_SCHEMA = "CodeDeclarationFramePrior@1";

// Declared parameters (P4: bare integers/fractions, each with its reason; frozen in c3-declared.mjs header).
export const PARAMS = Object.freeze({
  LWIN: 2,                // left context tokens: `export default class NAME` needs 2
  RWIN: 3,                // right context tokens: `NAME : (G) =>` / `NAME (G) :` / `NAME = function (G)` need 3
  ALPHA: 2,               // backoff pseudo-count: one prior observation's weight against the evidence of the level
  MIN_N: 2,               // a frame seen once is an anecdote: pruned (absent keys back off)
  K_SHARE: 0.9,           // closed class: keyword in >= 90% of occurrences...
  K_MIN: 3,               // ...of at least 3
  SOFT_SHARE: 0.1,        // a received keyword tagged a NAME in >= 10% of >= K_MIN train occurrences is only contextual (soft)
  D_P: 0.5,               // declaring word: followed by a def name more often than not...
  D_MIN: 5,               // ...in at least 5 cases
  COMMENT_PRECISION: 0.95,
  COMMENT_SUPPORT: 5,
  QUOTE_MIN: 5,           // a quote opener needs >= 5 quoted tokens and the same precision as a comment opener
  QUAL_MIN: 5,
  QUAL_SHARE: 0.01,
  KIND_MIN: 3,            // a frame names the kind only with >= 3 def cases
  DECISION_LOGIT: 0,      // posterior >= 0.5: the Bayes decision, not a tuned threshold
});

export const CASING_CLASSES = Object.freeze(["pascal", "screaming", "upper1", "camel", "snake", "lower", "other"]);
export const RECURRENCE_BUCKETS = Object.freeze(["0", "1", "2-3", "4-7", "8+"]);
// h4 h3 h2 h1 (with enclosing scope S) and g2 g1 (without) are the FROZEN levels of arm b (c3 header, FREEZE block).
// c1 q2 q3 were added by amendment A7 (2026-10-06) as ADDITIONAL tables: c1 = previous token alone, q2 = S|L1, q3 = S|L2 L1.
// They read NOTHING to the right of the candidate, so a chain made only of them is a strict PREFIX reader (rule 1).
export const LEVELS = Object.freeze(["h4", "h3", "h2", "h1", "g2", "g1", "c1", "q2", "q3"]);
const CHAIN_SCOPE = Object.freeze(["h4", "h3", "h2", "h1"]);
const CHAIN_NOSCOPE = Object.freeze(["h4", "g2", "g1"]);
/** the backoff chains, coarse -> fine (the estimator folds from the base rate through them in this order) */
export const CHAINS = Object.freeze({
  full: CHAIN_SCOPE,                                   // arm b (frozen)
  noscope: CHAIN_NOSCOPE,                              // ablation b-scope
  h4: Object.freeze(["h4"]),                           // b-h4: the simplest trained chain (previous | next token)
  prefix: Object.freeze(["c1", "q2", "q3"]),           // b-prefix: left context and scope only (strict prefix)
  coarse: Object.freeze(["c1", "h4", "h3", "h2", "h1"]), // b-coarse: arm b plus one coarse backoff level (A7, D1)
});
/** the reading options of every arm of the family (single source: c3-declared.mjs and its tests read this table) */
export const ARM_OPTS = Object.freeze({
  b: Object.freeze({}),
  "b-casing": Object.freeze({ noCasing: true }),
  "b-recurrence": Object.freeze({ noRecurrence: true }),
  "b-scope": Object.freeze({ noScope: true }),
  "b-h4": Object.freeze({ chain: "h4" }),
  "b-prefix": Object.freeze({ chain: "prefix", noRecurrence: true }),
  "b-coarse": Object.freeze({ chain: "coarse" }),
});

const KIND_COARSE = Object.freeze({
  function: "callable", method: "callable", class: "type", interface: "type", type: "type", enum: "type", variant: "type",
  module: "module", macro: "macro", constant: "constant",
});
export function coarseKind(kind) { return KIND_COARSE[kind] ?? "other"; }

/** The final segment of a qualified name (after the last "::" or "."). Applied to gold and predictions alike. */
export function finalSegment(name) {
  const s = String(name ?? "");
  const a = s.lastIndexOf("::");
  const b = s.lastIndexOf(".");
  const cut = Math.max(a >= 0 ? a + 2 : -1, b >= 0 ? b + 1 : -1);
  const out = cut >= 0 ? s.slice(cut) : s;
  return out;
}

/** Casing class of a name: ONE witness (rule 4), never an identity. */
export function casingOf(name) {
  const s = String(name ?? "").replace(/^[_$]+/, "");
  if (!s) return "other";
  if (/^[A-Z]$/.test(s)) return "upper1";
  if (/^[A-Z][A-Z0-9_]+$/.test(s)) return "screaming";
  if (/^[A-Z]/.test(s) && /[a-z]/.test(s)) return "pascal";
  if (/^[a-z]/.test(s)) {
    if (s.includes("_")) return "snake";
    if (/[A-Z]/.test(s)) return "camel";
    return "lower";
  }
  return "other";
}

export function recurrenceBucket(otherOccurrences) {
  const c = otherOccurrences;
  if (c <= 0) return "0";
  if (c === 1) return "1";
  if (c <= 3) return "2-3";
  if (c <= 7) return "4-7";
  return "8+";
}

// ── lexical machinery ───────────────────────────────────────────────────────────────────────────────────────────
const WORD_RE = /[\p{L}_$][\p{L}\p{N}_$]*/uy;
const OPCH = new Set("+-*/%=<>!&|^~?:.".split(""));
const BR_OPEN = { "(": ")", "[": "]", "{": "}" };
const BR_CLOSE = { ")": "(", "]": "[", "}": "{" };
const isSpace = (c) => c === " " || c === "\t" || c === "\r" || c === "\f" || c === "\v" || (c > "\x7f" && /\s/.test(c));
const isWordCh = (c) => /[\p{L}\p{N}_$]/u.test(c);

/** Compile the lexical part of a prior (or a derived lexical object) into the form tokenize() reads. */
export function compileLexical(lexical = {}, keywords = []) {
  const openers = [];
  for (const o of lexical.lineComments ?? []) openers.push({ o, c: null });
  for (const [o, c] of lexical.blockComments ?? []) openers.push({ o, c });
  openers.sort((a, b) => b.o.length - a.o.length);
  const quotes = [...(lexical.quotes ?? [])].sort((a, b) => b.length - a.length);
  return {
    openers, quotes,
    qual: [...(lexical.qualifiers ?? [])],
    suffix: new Set(lexical.nameSuffix ?? []),
    kw: new Set(keywords),
  };
}

function commentEnd(text, i, cx) {
  for (const { o, c } of cx.openers) {
    if (!text.startsWith(o, i)) continue;
    if (c) {
      const j = text.indexOf(c, i + o.length);
      return j < 0 ? text.length : j + c.length;
    }
    const nl = text.indexOf("\n", i);
    return nl < 0 ? text.length : nl;
  }
  return -1;
}

function quoteEnd(text, i, cx) {
  for (const o of cx.quotes) {
    if (!text.startsWith(o, i)) continue;
    const n = text.length;
    if (o.length === 3) { const j = text.indexOf(o, i + 3); return j < 0 ? n : j + 3; }
    if (o === "`") { const j = text.indexOf("`", i + 1); return j < 0 ? n : j + 1; }
    let j = i + 1;
    while (j < n) {
      const c = text[j];
      if (c === "\\") { j += 2; continue; }
      if (c === o) return j + 1;
      if (c === "\n") return j;
      j += 1;
    }
    return n;
  }
  return -1;
}

/**
 * tokenize(text, cx) -> { toks, spans }. Token types: w word (t.kw when a member of the closed class K), n number,
 * s quoted, p punctuation/operator run (brackets, , ; are single), nl newline marker (blank lines collapse).
 * Comments and quoted text are SKIPPED (returned in spans for masking), never read.
 */
export function tokenize(text, cx) {
  const n = text.length;
  const toks = [];
  const spans = [];
  const lastIsNl = () => toks.length === 0 || toks[toks.length - 1].t === "nl";
  let i = 0;
  while (i < n) {
    const ch = text[i];
    if (ch === "\n") { if (!lastIsNl()) toks.push({ t: "nl", s: i, e: i + 1, x: "\n" }); i += 1; continue; }
    if (isSpace(ch)) { i += 1; continue; }
    const ce = commentEnd(text, i, cx);
    if (ce >= 0) { spans.push({ s: i, e: ce, k: "comment" }); i = Math.max(ce, i + 1); continue; }
    const qe = quoteEnd(text, i, cx);
    if (qe >= 0) {
      let s = i;
      const prev = toks[toks.length - 1];
      if (prev && prev.t === "w" && prev.e === i && prev.x.length <= 2 && /^[A-Za-z]+$/.test(prev.x)) { toks.pop(); s = prev.s; }
      toks.push({ t: "s", s, e: qe, x: "S" });
      spans.push({ s: i, e: qe, k: "string" });
      i = qe;
      continue;
    }
    if (ch >= "0" && ch <= "9") {
      let j = i + 1;
      while (j < n && (isWordCh(text[j]) || (text[j] === "." && text[j + 1] >= "0" && text[j + 1] <= "9"))) j += 1;
      toks.push({ t: "n", s: i, e: j, x: "N" });
      i = j;
      continue;
    }
    if (ch === "#" && cx.kw.size) {
      WORD_RE.lastIndex = i + 1;
      const m = WORD_RE.exec(text);
      if (m && m.index === i + 1 && cx.kw.has("#" + m[0])) {
        toks.push({ t: "w", s: i, e: i + 1 + m[0].length, x: "#" + m[0], last: "#" + m[0], kw: true });
        i += 1 + m[0].length;
        continue;
      }
    }
    WORD_RE.lastIndex = i;
    const wm = WORD_RE.exec(text);
    if (wm && wm.index === i) {
      let e = i + wm[0].length;
      if (cx.suffix.size && cx.suffix.has(text[e]) && text[e + 1] !== "=") e += 1;
      let lastStart = i;
      let qualified = false;
      for (let guard = 0; guard < 16; guard += 1) {
        const q = cx.qual.find((qq) => text.startsWith(qq, e));
        if (!q) break;
        WORD_RE.lastIndex = e + q.length;
        const nm = WORD_RE.exec(text);
        if (!nm || nm.index !== e + q.length) break;
        lastStart = e + q.length;
        e = lastStart + nm[0].length;
        if (cx.suffix.size && cx.suffix.has(text[e]) && text[e + 1] !== "=") e += 1;
        qualified = true;
      }
      const x = text.slice(i, e);
      toks.push({ t: "w", s: i, e, x, last: text.slice(lastStart, e), kw: !qualified && cx.kw.has(x) });
      i = e;
      continue;
    }
    if (BR_OPEN[ch] || BR_CLOSE[ch] || ch === "," || ch === ";") { toks.push({ t: "p", s: i, e: i + 1, x: ch }); i += 1; continue; }
    if (OPCH.has(ch)) {
      let j = i + 1;
      while (j < n && OPCH.has(text[j]) && commentEnd(text, j, cx) < 0) j += 1;
      toks.push({ t: "p", s: i, e: j, x: text.slice(i, j) });
      i = j;
      continue;
    }
    toks.push({ t: "p", s: i, e: i + 1, x: ch });
    i += 1;
  }
  return { toks, spans };
}

/** text with comments and quoted text blanked to spaces (newlines kept): what the baselines read */
export function maskText(text, spans) {
  if (!spans.length) return text;
  let out = "";
  let at = 0;
  for (const sp of spans) {
    out += text.slice(at, sp.s);
    out += text.slice(sp.s, sp.e).replace(/[^\n]/g, " ");
    at = sp.e;
  }
  return out + text.slice(at);
}

function indentOf(text, pos) {
  let ls = text.lastIndexOf("\n", pos - 1) + 1;
  let w = 0;
  while (ls < pos) {
    const c = text[ls];
    if (c === " ") w += 1;
    else if (c === "\t") w += 4;
    else break;
    ls += 1;
  }
  return w;
}

/**
 * annotate(text, toks, decl) — one structure pass: bracket depth and matches (t.m), and the ENCLOSING SCOPE S of every
 * token (the bracket/indent structure witness): inside a bracket, the innermost opener plus (for `{`) the LAST
 * declaring word of its header; at depth 0, the declaring word of the header line of the nearest lower-indented line
 * (or "top"). `decl` is the Set of declaring words D (derived, received).
 */
export function annotate(text, toks, decl) {
  const st = [];
  const lastD = [null];
  const istack = [];
  let atLineStart = true;
  let lineScope = "top";
  for (let i = 0; i < toks.length; i += 1) {
    const t = toks[i];
    if (t.t === "nl") { atLineStart = true; continue; }
    if (atLineStart && st.length === 0) {
      const ind = indentOf(text, t.s);
      while (istack.length && istack[istack.length - 1].indent >= ind) istack.pop();
      lineScope = istack.length ? istack[istack.length - 1].decl : "top";
      let d = "none";
      for (let j = i; j < toks.length && toks[j].t !== "nl"; j += 1) {
        if (toks[j].t === "w" && decl.has(toks[j].x)) { d = toks[j].x; break; }
      }
      istack.push({ indent: ind, decl: d });
    }
    atLineStart = false;
    if (st.length) { const top = st[st.length - 1]; t.S = top.ch === "{" ? "{" + top.decl : top.ch; } else t.S = lineScope;
    t.d = st.length;
    if (t.t === "p") {
      if (BR_OPEN[t.x]) {
        const level = st.length;
        const dd = t.x === "{" ? (lastD[level] ?? "none") : "none";
        st.push({ ch: t.x, idx: i, decl: dd });
        lastD[st.length] = null;
        if (t.x === "{") lastD[level] = null;
        t.m = -1;
      } else if (BR_CLOSE[t.x]) {
        let k = st.length - 1;
        while (k >= 0 && st[k].ch !== BR_CLOSE[t.x]) k -= 1;
        if (k >= 0) {
          const open = toks[st[k].idx];
          open.m = i;
          t.m = st[k].idx;
          st.length = k;
          if (t.x === "}") lastD[st.length] = null;
        } else t.m = -1;
      } else if (t.x === ";") lastD[st.length] = null;
    } else if (t.t === "w" && decl.has(t.x)) lastD[st.length] = t.x;
  }
  for (const t of toks) if (t.m === undefined) t.m = -1;
}

// ── frames ──────────────────────────────────────────────────────────────────────────────────────────────────────
function absTok(t, V) {
  if (t.t === "w") return V.has(t.x) ? t.x : "I";
  if (t.t === "n") return "N";
  if (t.t === "s") return "S";
  if (t.t === "nl") return "^";
  return t.x;
}

function leftCtx(toks, i, V, W) {
  const out = [];
  let j = i - 1;
  while (out.length < W && j >= 0) {
    const t = toks[j];
    if (t.t === "nl") { out.push("^"); break; }
    if (t.t === "p") {
      if ((t.x === ")" || t.x === "]") && t.m >= 0) { out.push(t.x === ")" ? "(G)" : "[G]"); j = t.m - 1; continue; }
      if (t.x === "}") {
        if (j === i - 1 && t.m >= 0) { out.push("{G}"); j = t.m - 1; continue; }
        out.push("}"); break;
      }
      if (t.x === ";" || t.x === "{" || t.x === "(" || t.x === "[") { out.push(t.x); break; }
      out.push(t.x); j -= 1; continue;
    }
    out.push(absTok(t, V));
    j -= 1;
  }
  while (out.length < W) out.push(".");
  return out;
}

function rightCtx(toks, i, V, W) {
  const out = [];
  let j = i + 1;
  while (out.length < W && j < toks.length) {
    const t = toks[j];
    if (t.t === "nl") {
      out.push("^");
      const nx = toks[j + 1];
      if (nx && nx.t === "p" && nx.x === "{") { j += 1; continue; }
      break;
    }
    if (t.t === "p") {
      if ((t.x === "(" || t.x === "[") && t.m >= 0) { out.push(t.x === "(" ? "(G)" : "[G]"); j = t.m + 1; continue; }
      if (t.x === "{" || t.x === "}" || t.x === ";" || t.x === ")" || t.x === "]" || t.x === "(" || t.x === "[") { out.push(t.x); break; }
      out.push(t.x); j += 1; continue;
    }
    out.push(absTok(t, V));
    j += 1;
  }
  while (out.length < W) out.push(".");
  return out;
}

/** the six frame keys of the candidate at index i (a word token that is not in K) */
export function frameKeys(toks, i, V, params = PARAMS) {
  const L = leftCtx(toks, i, V, params.LWIN);
  const R = rightCtx(toks, i, V, params.RWIN);
  const S = toks[i].S ?? "top";
  return {
    h4: `${L[0]}|${R[0]}`,
    h3: `${S}|${L[0]}|${R[0]}`,
    h2: `${S}|${L[0]}|${R[0]} ${R[1]}`,
    h1: `${S}|${L[1]} ${L[0]}|${R[0]} ${R[1]} ${R[2]}`,
    g2: `${L[0]}|${R[0]} ${R[1]}`,
    g1: `${L[1]} ${L[0]}|${R[0]} ${R[1]} ${R[2]}`,
    // A7: left-context-only levels (no R at all: strict prefix)
    c1: `${L[0]}`,
    q2: `${S}|${L[0]}`,
    q3: `${S}|${L[1]} ${L[0]}`,
  };
}

const isCandidate = (t) => t.t === "w" && !t.kw;

function recurrenceMap(toks) {
  const m = new Map();
  for (const t of toks) if (isCandidate(t)) m.set(t.last, (m.get(t.last) ?? 0) + 1);
  return m;
}

// ── the received prior: build (TRAIN only) ────────────────────────────────────────────────────────────────────────
function spanIndex(goldTokens) {
  // gold tokens are sorted and non-overlapping (gold.py P6): binary search by start
  const starts = goldTokens.map((t) => t.start);
  return (q) => {
    let lo = 0, hi = starts.length - 1, best = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (starts[mid] <= q) { best = mid; lo = mid + 1; } else hi = mid - 1; }
    if (best < 0) return null;
    const g = goldTokens[best];
    return q < g.end ? g.class : null;
  };
}

/** derive the lexical prior from the grammar's own comment/string tokens (TRAIN files only) */
export function deriveLexical(files, params, inScope) {
  const openerStats = new Map(); // prefix -> { A, closers: Map }
  const codeOcc = new Map();
  const quoteCode = new Map(); // quote char -> occurrences in code text (outside comment/string/literal tokens)
  const quoteCount = new Map();
  let defTotal = 0, qualCount = 0, qmark = 0, bang = 0;
  const alnum = /[\p{L}\p{N}]/u;
  const wsOrQuote = /[\s"'`]/;
  const prefixesOf = (s) => {
    const out = [];
    if (s.length >= 1 && !alnum.test(s[0]) && !wsOrQuote.test(s[0])) {
      out.push(s[0]);
      if (s.length >= 2 && !alnum.test(s[1]) && !wsOrQuote.test(s[1])) out.push(s.slice(0, 2));
    }
    return out;
  };
  for (const f of files) {
    for (const g of f.gold.tokens) {
      const txt = f.text.slice(g.start, g.end);
      if (g.class === "comment") {
        for (const p of prefixesOf(txt)) {
          if (!openerStats.has(p)) openerStats.set(p, { A: 0, last2: new Map(), multi: 0 });
          const o = openerStats.get(p);
          o.A += 1;
          // a BLOCK comment is evidenced by tokens that span lines and end alike; a line comment never contains a newline
          if (txt.includes("\n")) { o.multi += 1; const l2 = txt.slice(-2); o.last2.set(l2, (o.last2.get(l2) ?? 0) + 1); }
        }
      } else if (g.class === "string" || g.class === "literal") {
        const m = /^[A-Za-z]{0,2}(["'`])/.exec(txt);
        if (m) {
          const q = m[1];
          const body = txt.slice(m[0].length - 1);
          const triple = q !== "`" && body.length >= 6 && body.startsWith(q.repeat(3)) && body.endsWith(q.repeat(3));
          const key = triple ? q.repeat(3) : q;
          quoteCount.set(key, (quoteCount.get(key) ?? 0) + 1);
        }
      }
    }
    for (const d of f.gold.defs) {
      if (!inScope(d)) continue;
      defTotal += 1;
      if (d.name.includes("::")) qualCount += 1;
      if (d.name.endsWith("?")) qmark += 1;
      if (d.name.endsWith("!")) bang += 1;
    }
  }
  // precision of each candidate opener: occurrences in code text (outside comment/string tokens) vs comment starts
  const cand = [...openerStats.entries()].filter(([, o]) => o.A >= params.COMMENT_SUPPORT).map(([p]) => p);
  for (const p of cand) codeOcc.set(p, 0);
  if (cand.length) {
    for (const f of files) {
      const cls = spanIndex(f.gold.tokens);
      for (const p of cand) {
        let pos = f.text.indexOf(p);
        while (pos >= 0) {
          const c = cls(pos);
          // gold class "other" (preprocessor arguments, heredoc starts) is text the grammar hides: not evidence of code
          if (c !== "comment" && c !== "string" && c !== "other") codeOcc.set(p, codeOcc.get(p) + 1);
          pos = f.text.indexOf(p, pos + p.length);
        }
      }
    }
  }
  const quoteChars = [...new Set([...quoteCount.keys()].map((k) => k[0]))];
  for (const ch of quoteChars) quoteCode.set(ch, 0);
  if (quoteChars.length) {
    for (const f of files) {
      const cls = spanIndex(f.gold.tokens);
      for (const ch of quoteChars) {
        let pos = f.text.indexOf(ch);
        while (pos >= 0) {
          const c = cls(pos);
          if (c !== "comment" && c !== "string" && c !== "literal" && c !== "other") quoteCode.set(ch, quoteCode.get(ch) + 1);
          pos = f.text.indexOf(ch, pos + 1);
        }
      }
    }
  }
  // longest prefix first: a 2-char opener (// /* ## #!) is accepted on its own precision; a 1-char opener (# ;) is
  // accepted only on the comment tokens the 2-char openers did not cover (the residual), so "/" can never stand in
  // for "//" and "/*" (amendment A3)
  const accepted = [];
  const covered = new Map();
  const byLen = (n) => [...cand].filter((p) => p.length === n).sort();
  for (const p of byLen(2)) {
    const A = openerStats.get(p).A;
    const B = codeOcc.get(p);
    if (A / (A + B) >= params.COMMENT_PRECISION) { accepted.push(p); covered.set(p[0], (covered.get(p[0]) ?? 0) + A); }
  }
  for (const p of byLen(1)) {
    const A = openerStats.get(p).A - (covered.get(p) ?? 0);
    const B = codeOcc.get(p);
    if (A >= params.COMMENT_SUPPORT && A / (A + B) >= params.COMMENT_PRECISION) accepted.push(p);
  }
  const lineComments = [];
  const blockComments = [];
  for (const p of accepted) {
    const o = openerStats.get(p);
    let best = null, bestN = 0;
    for (const [l2, c] of o.last2) if (c > bestN) { best = l2; bestN = c; }
    if (best && o.multi >= params.COMMENT_SUPPORT && bestN / o.multi >= 0.8 && !alnum.test(best)) blockComments.push([p, best]);
    else lineComments.push(p);
  }
  const quotes = [...quoteCount.entries()].filter(([q, c]) => {
    const ch = q[0];
    return c >= params.QUOTE_MIN && c / (c + (quoteCode.get(ch) ?? 0)) >= params.COMMENT_PRECISION;
  }).map(([q]) => q);
  return {
    lineComments, blockComments, quotes,
    qualifiers: defTotal && qualCount >= params.QUAL_MIN && qualCount / defTotal >= params.QUAL_SHARE ? ["::"] : [],
    nameSuffix: [
      ...(defTotal && qmark >= params.QUAL_MIN && qmark / defTotal >= params.QUAL_SHARE ? ["?"] : []),
      ...(defTotal && bang >= params.QUAL_MIN && bang / defTotal >= params.QUAL_SHARE ? ["!"] : []),
    ],
  };
}

/**
 * closed class K from the grammar's own keyword tokens: { hard: [...], identShare: Map(word -> { n, ident }) }.
 * `ident` counts occurrences the grammar tags identifier/type (a word used as a NAME): evidence that a received
 * "keyword" is only a contextual (soft) keyword in this language, which never refuses (S83: soft keywords are
 * legally declarable).
 */
export function deriveKeywords(files, params) {
  const stat = new Map();
  const wordLike = /^#?[\p{L}_$][\p{L}\p{N}_$]*$/u;
  for (const f of files) {
    for (const g of f.gold.tokens) {
      const txt = f.text.slice(g.start, g.end);
      if (!wordLike.test(txt)) continue;
      let s = stat.get(txt);
      if (!s) { s = { n: 0, k: 0, ident: 0 }; stat.set(txt, s); }
      s.n += 1;
      if (g.class === "keyword") s.k += 1;
      else if (g.class === "identifier" || g.class === "type") s.ident += 1;
    }
  }
  const hard = [...stat.entries()].filter(([, s]) => s.k >= params.K_MIN && s.k / s.n >= params.K_SHARE).map(([w]) => w).sort();
  return { hard, stat };
}

function labelTokens(toks, defs, inScope) {
  const byEnd = new Map();
  for (const d of defs) {
    if (!inScope(d)) continue;
    if (!byEnd.has(d.nameEnd)) byEnd.set(d.nameEnd, d);
  }
  let reachable = 0;
  for (const t of toks) {
    if (!isCandidate(t)) continue;
    const d = byEnd.get(t.e);
    if (d && t.s <= d.nameStart) { t.label = d.kind; reachable += 1; } else t.label = null;
  }
  return reachable;
}

function bump(map, key, def, kind) {
  let r = map.get(key);
  if (!r) { r = [0, 0, null]; map.set(key, r); }
  r[0] += 1;
  if (def) { r[1] += 1; if (!r[2]) r[2] = {}; r[2][kind] = (r[2][kind] ?? 0) + 1; }
}

/**
 * buildDeclaredPrior({ language, files:[{text, gold, repo?}], inScope(def)->bool, provenance, params })
 * -> CodeDeclarationFramePrior@1 (plain JSON). TRAIN files only: the caller guarantees the split.
 */
export function buildDeclaredPrior({ language, files, inScope, provenance = {}, params = PARAMS, extraKeywords = null }) {
  if (!Array.isArray(files) || !files.length) throw new TypeError("buildDeclaredPrior: files are required");
  const scoped = typeof inScope === "function" ? inScope : () => true;
  const lexical = deriveLexical(files, params, scoped);
  // closed class K = the grammar's own keyword tokens over TRAIN, plus a RECEIVED keyword prior when one exists for the
  // language (extraKeywords: e.g. priors/code-kw-js.json, giver = the language engine); both are refusals, never admissions
  const { hard: trainKeywords, stat: kwStat } = deriveKeywords(files, params);
  // a received keyword the grammar tags as a NAME in >= SOFT_SHARE of >= K_MIN train occurrences is only contextual here
  const softKeywords = [];
  const keptReceived = [];
  for (const w of extraKeywords ?? []) {
    const st = kwStat.get(w);
    if (st && st.n >= params.K_MIN && st.ident / st.n >= params.SOFT_SHARE) softKeywords.push(w); else keptReceived.push(w);
  }
  const keywords = [...new Set([...trainKeywords, ...keptReceived])].sort();
  const lexCx = compileLexical(lexical, keywords);

  // pass 1: tokenize, label, learn declaring words D
  const prevStat = new Map();
  let reachableDefs = 0, totalDefs = 0;
  const per = files.map((f) => {
    const { toks } = tokenize(f.text, lexCx);
    reachableDefs += labelTokens(toks, f.gold.defs, scoped);
    totalDefs += f.gold.defs.filter(scoped).length;
    for (let i = 1; i < toks.length; i += 1) {
      const t = toks[i];
      if (!isCandidate(t)) continue;
      const pv = toks[i - 1];
      if (pv.t !== "w") continue;
      let s = prevStat.get(pv.x);
      if (!s) { s = { n: 0, d: 0 }; prevStat.set(pv.x, s); }
      s.n += 1;
      if (t.label) s.d += 1;
    }
    return { f, toks };
  });
  const declaring = [...prevStat.entries()].filter(([, s]) => s.d >= params.D_MIN && s.d / s.n >= params.D_P).map(([w]) => w).sort();
  const D = new Set(declaring);
  const V = new Set([...keywords, ...declaring]);

  // pass 2: scope structure, frames, witnesses
  const tabs = Object.fromEntries(LEVELS.map((l) => [l, new Map()]));
  const casing = new Map();
  const recur = new Map();
  const base = { n: 0, d: 0 };
  const globalKinds = {};
  for (const { f, toks } of per) {
    annotate(f.text, toks, D);
    const rec = recurrenceMap(toks);
    for (let i = 0; i < toks.length; i += 1) {
      const t = toks[i];
      if (!isCandidate(t)) continue;
      const def = Boolean(t.label);
      const keys = frameKeys(toks, i, V, params);
      for (const l of LEVELS) bump(tabs[l], keys[l], def, t.label);
      bump(casing, casingOf(t.last), def, t.label);
      bump(recur, recurrenceBucket((rec.get(t.last) ?? 1) - 1), def, t.label);
      base.n += 1;
      if (def) { base.d += 1; globalKinds[t.label] = (globalKinds[t.label] ?? 0) + 1; }
    }
  }
  const frames = {};
  for (const l of LEVELS) {
    const o = {};
    for (const [k, r] of tabs[l]) {
      if (r[0] < params.MIN_N && l !== "h4") continue;
      o[k] = r[2] ? [r[0], r[1], r[2]] : [r[0], r[1]];
    }
    frames[l] = o;
  }
  const flat = (m) => Object.fromEntries([...m.entries()].map(([k, r]) => [k, [r[0], r[1]]]));
  return {
    schema: DECLARED_PRIOR_SCHEMA,
    language,
    provenance: {
      giver: "tree-sitter grammar tokens and tags over the TRAIN split of the code corpus (eval/coding-competence/gold.mjs): an independent authority applied to different repositories than the held-out files",
      supervised: "yes: frame probabilities are supervised by the giver on train; the measure is transfer to unseen repositories",
      note: "priors NOMINATE and REFUSE, never admit; the text's own evidence admits",
      files: files.length,
      repos: [...new Set(files.map((f) => f.repo).filter(Boolean))].sort(),
      candidates: base.n,
      keywordGivers: { trainTokens: trainKeywords.length, received: extraKeywords ? extraKeywords.length : 0, receivedSoftened: softKeywords.length },
      inScopeGoldDefs: totalDefs,
      reachableByTokenizer: reachableDefs,
      reachableShare: totalDefs ? reachableDefs / totalDefs : null,
      ...provenance,
    },
    params: { ...params },
    lexical,
    keywords,
    softKeywords: softKeywords.sort(),
    declaring,
    base,
    globalKinds,
    frames,
    casing: flat(casing),
    recurrence: flat(recur),
  };
}

// ── the prior, compiled for reading ───────────────────────────────────────────────────────────────────────────────
const _compiled = new WeakMap();

export function compilePrior(prior) {
  if (_compiled.has(prior)) return _compiled.get(prior);
  const lex = compileLexical(prior.lexical, prior.keywords);
  const tables = {};
  for (const l of LEVELS) tables[l] = new Map(Object.entries(prior.frames?.[l] ?? {}));
  const witness = (tab, classes) => {
    let N = 0, D = 0;
    for (const c of classes) { const r = tab?.[c]; if (r) { N += r[0]; D += r[1]; } }
    const K = classes.length;
    const llr = {};
    for (const c of classes) {
      const r = tab?.[c];
      if (!r) { llr[c] = 0; continue; }
      llr[c] = Math.log((r[1] + 1) / (D + K)) - Math.log((r[0] - r[1] + 1) / (N - D + K));
    }
    return llr;
  };
  const P = {
    prior, lex,
    V: new Set([...(prior.keywords ?? []), ...(prior.declaring ?? [])]),
    D: new Set(prior.declaring ?? []),
    tables,
    base: (prior.base.d + 0.5) / (prior.base.n + 1),
    llrCasing: witness(prior.casing, CASING_CLASSES),
    llrRecur: witness(prior.recurrence, RECURRENCE_BUCKETS),
    params: { ...PARAMS, ...(prior.params ?? {}) },
  };
  _compiled.set(prior, P);
  return P;
}

/** the chain (array of level names) an opts object asks for */
export function chainOf(opts = {}) {
  if (opts.chain) {
    const c = Array.isArray(opts.chain) ? opts.chain : CHAINS[opts.chain];
    if (!c) throw new RangeError(`readDeclared: unknown chain ${String(opts.chain)}`);
    return c;
  }
  return opts.noScope ? CHAIN_NOSCOPE : CHAIN_SCOPE;
}

function chainProb(P, keys, chain) {
  let p = P.base;
  for (const l of chain) {
    const r = P.tables[l].get(keys[l]);
    if (!r || r[0] < P.params.MIN_N) continue;
    p = (r[1] + P.params.ALPHA * p) / (r[0] + P.params.ALPHA);
  }
  return p;
}

function kindOf(P, keys, chain) {
  for (let q = chain.length - 1; q >= 0; q -= 1) {
    const r = P.tables[chain[q]].get(keys[chain[q]]);
    if (r && r[1] >= P.params.KIND_MIN && r[2]) {
      let best = null, bn = -1;
      for (const [k, c] of Object.entries(r[2])) if (c > bn || (c === bn && k < best)) { best = k; bn = c; }
      return best;
    }
  }
  let best = null, bn = -1;
  for (const [k, c] of Object.entries(P.prior.globalKinds ?? {})) if (c > bn) { best = k; bn = c; }
  return best ?? "function";
}

/**
 * scoreOccurrences(text, prior, opts) -> one row per CANDIDATE token (a word that is not in the closed class K):
 * { i, name, qualified, start, end, logit, p (frame probability), scope, keys }. The admission rule is logit >= DECISION_LOGIT. This is the
 * per-occurrence view readDeclared reduces to one item per name, and the view the c3 prefix-invariance probe compares.
 */
export function scoreOccurrences(text, prior, opts = {}) {
  const P = compilePrior(prior);
  const chain = chainOf(opts);
  const { toks } = tokenize(text, P.lex);
  annotate(text, toks, P.D);
  const rec = opts.noRecurrence ? null : recurrenceMap(toks);
  const out = [];
  for (let i = 0; i < toks.length; i += 1) {
    const t = toks[i];
    if (!isCandidate(t)) continue;
    const keys = frameKeys(toks, i, P.V, P.params);
    const p = Math.min(1 - 1e-6, Math.max(1e-6, chainProb(P, keys, chain)));
    let logit = Math.log(p / (1 - p));
    if (!opts.noCasing) logit += P.llrCasing[casingOf(t.last)] ?? 0;
    if (rec) logit += P.llrRecur[recurrenceBucket((rec.get(t.last) ?? 1) - 1)] ?? 0;
    out.push({ i, name: t.last, qualified: t.x, start: t.s, end: t.e, logit, p, scope: t.S, keys });
  }
  return { rows: out, P, chain };
}

/**
 * readDeclared(text, prior, opts) -> [{ name, qualified, kind (coarse), fineKind, start, end, logit, p, scope }]
 * One item per distinct normalised name (the highest-logit occurrence; the first one on a tie). opts: { noCasing,
 * noRecurrence, noScope, chain } are the ablations and the A7 arms (see ARM_OPTS). The prior never produces a name
 * that is not a token of `text`.
 */
export function readDeclared(text, prior, opts = {}) {
  const { rows, P, chain } = scoreOccurrences(text, prior, opts);
  const best = new Map();
  for (const r of rows) {
    if (r.logit < P.params.DECISION_LOGIT) continue;
    const prev = best.get(r.name);
    if (prev && prev.logit >= r.logit) continue;
    const fine = kindOf(P, r.keys, chain);
    best.set(r.name, { name: r.name, qualified: r.qualified, kind: coarseKind(fine), fineKind: fine, start: r.start, end: r.end, logit: r.logit, p: r.p, scope: r.scope });
  }
  return [...best.values()].sort((a, b) => a.start - b.start);
}
