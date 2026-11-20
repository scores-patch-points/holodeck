// cast-identity.js — ONE NAME, ONE BEING (opt-in: readWith({ castIdentity: true | { lead, hapax, variants, rescue, claims, initials, unmerge, fold, casing, spans } })).
//
// A pass over the cast the reader built, run before the entry is assembled; off, nothing here runs and the entry is JSON-identical to base.
// It repairs the defects the cast census found (CAST-CENSUS-2.md) and the ones the first scored exam showed (RESULT-CAST-A2.md), each by a
// structural rule, the text's own evidence, or the part-of-speech prior (data) — there is no list of words in this file
// (eval/cast/cast-identity-gate.mjs scans for one). The steps, in order:
//   LEAD     a surface the text shows is a name plus a sentence's edge: "The Colosseum" (a positional capital on a surface that mostly opens
//            a sentence), "Colosseum A" (every mention runs across a break), "Notre-Dame's" (a possessive of another surface).
//   HAPAX    a surface written once that is another surface plus edge words ("April White Star", "Mission Control Center") while the
//            rest stands alone three times or more, and the edge words are the sentence's company, not a prefix to names.
//   VARIANTS two beings holding one name written with a hyphen, a period or a diacritic differently are one.
//   RESCUE   a name the capital tier truncated or dropped: a joiner inside a token ("Trans-Siberian"); a number or model designation
//            ending a name ("Voyager 1", "Apollo 11", "Boeing 747-400"), and the bare number that ends it; an initial or an abbreviation with its
//            period ("John A. Roebling", "St. Peter's Basilica"); a connector between capitalised runs ("Great Wall of China", "Notre-Dame de Paris":
//            one the prior does not use as a conjunction, introduced with its left side) or a coordinating word the two sides almost never leave
//            ("Harland and Wolff"); a run of five or more tokens; a closed run that extends a being by one capitalised word ("Cumberland River");
//            and a capitalised word the reader dropped as ambiguous that recurs outside every being ("Valdez").
//   CLAIMS   a parenthesis after a name lists forms of it ("Large Hadron Collider (LHC)", "U.S. Route 66 or U.S. Highway 66 (US 66 or Route 66)"):
//            the names and forms are one being; no other being keeps them.
//   INITIALS an all-capital short form that is the capitals of exactly one multi-token name belongs to it.
//   UNMERGE  a short form first used before the longer name it sits in, or mostly used outside it, leaves; two full names that share only a tail are two beings.
//   FOLD     a being most of whose mentions lie inside ONE longer being is a part of it; so is one whose first mention lies inside a longer being's
//            mention ("Everest" in "Mount Everest"), unless it stands after a connector ("Paris" in "Notre-Dame de Paris") or is a one-word name beside that name plus one common noun ("Millau" and "Millau Viaduct": the place or the thing). Otherwise it stays a being of
//            its own and a typed gap (`cast_identity_short_form_open`) says so.
//   SPANS    a full stop after a single capital is the name's only if the name before it does not recur without it ("Robert F. Kennedy" keeps it, "Edward I." does not);
//            no mention overlaps a longer mention of another being; a mention ends where the name ends (a line break, a sentence's full stop).
// Pure given its inputs. `mentionsOf` is read-core's own matcher, handed in so a mention is found the one way.

const TOK = /[\p{L}\p{N}](?:[\p{L}\p{N}'’]|[-–/.](?=[\p{L}\p{N}]))*/gu;
const CAP = /^\p{Lu}/u, LOW = /^\p{Ll}/u, NUM = /^\p{N}[\p{L}\p{N}'’]*(?:[-–/.][\p{L}\p{N}]+)*$/u;
const JOINER = /[-–/]/;
// a designation: a token with a digit and a joiner ("F-1", "747-400")
const DESIG = /\p{N}/u;
const isDesig = (t) => JOINER.test(t) && DESIG.test(t);
// the recurrence a joined unit must show: declared, and reported in PREREG-CAST-A1.md
export const RECUR = { unit: 2, connector: 3, share: 0.8 };
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const lc = (s) => s.toLocaleLowerCase();
const refOfKey = (k) => `ref:auto:${k.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_|_$/g, "")}`;
const words = (s) => String(s).trim().split(/\s+/).filter(Boolean);
const bare = (w) => w.replace(/['’]s$/i, "");
const longest = (surfaces) => [...surfaces].sort((a, b) => b.length - a.length)[0];

/** spans reduced to the maximal ones: a span inside another, or starting inside the previous one, is dropped */
export function maximal(spans) {
  const s = [...spans].sort((a, b) => a[0] - b[0] || b[1] - a[1]); const out = []; let end = -1;
  for (const x of s) if (x[0] >= end) { out.push(x); end = x[1]; }
  return out;
}
const inside = (x, y) => x[0] >= y[0] && x[1] <= y[1];
const insideCount = (a, b) => { let k = 0; for (const x of a) if (b.some((y) => inside(x, y))) k++; return k; };

/**
 * every token of the text with its place, and `positional(token)`: the text's own evidence that a capital on this word is the sentence's and
 * not the name's — it writes the word in lower case at least as often as it writes it capitalised away from a sentence's opening.
 */
export function scan(text) {
  const toks = []; const low = new Map(), mid = new Map();
  for (const m of text.matchAll(TOK)) {
    const t = { t: m[0], s: m.index, e: m.index + m[0].length, i: toks.length };
    toks.push(t);
    const k = lc(bare(t.t));
    if (LOW.test(t.t)) low.set(k, (low.get(k) ?? 0) + 1);
    else if (CAP.test(t.t) && !opensSentence(text, t.s)) mid.set(k, (mid.get(k) ?? 0) + 1);
  }
  // a period between two words that the text writes between the same two words again and again is the words' own ("St. Peter's"), not a sentence's end
  const pairs = new Map();
  for (let i = 0; i + 1 < toks.length; i++) if (/^\.[ \t]+$/.test(text.slice(toks[i].e, toks[i + 1].s))) { const k = `${toks[i].t}|${toks[i + 1].t}`; pairs.set(k, (pairs.get(k) ?? 0) + 1); }
  return { toks, pairs, bare: new Map(), positional: (w) => { const k = lc(bare(w)); const l = low.get(k) ?? 0; return l > 0 && l >= (mid.get(k) ?? 0); } };
}
const sameLine = (text, a, b) => /^[ \t]+$/.test(text.slice(a.e, b.s));
/** may a name run from token a to the next token b: a space, or a period that is an initial's, an abbreviation's or the pair's own (it recurs, and the word after it is not one a sentence opens with) */
const initialOwn = (text, a, sc) => {
  // a single capital with its period is an initial unless the name before it recurs without the period ("Saturn V" is a name and the full stop the sentence's)
  const p = sc.toks[a.i - 1]; if (!p || !sameLine(text, p, a)) return true;
  const k = `${p.t} ${a.t}`; if (!sc.bare.has(k)) sc.bare.set(k, (text.match(new RegExp(`(?<![\\p{L}\\p{N}])${esc(p.t)}[ \\t]+${esc(a.t)}(?![.\\p{L}\\p{N}])`, "gu")) ?? []).length);
  return sc.bare.get(k) < RECUR.connector;
};
const gapOk = (text, a, b, sc, abbreviations) => sameLine(text, a, b) || (/^\.[ \t]+$/.test(text.slice(a.e, b.s)) && ((/^\p{Lu}$/u.test(a.t) && initialOwn(text, a, sc)) || abbreviations.has(a.t) || a.t.includes(".") || ((sc.pairs.get(`${a.t}|${b.t}`) ?? 0) >= RECUR.connector && !sc.positional(b.t))));

/** a position that opens a sentence or a line (a quote or bracket in front of it does not count against that) */
function opensSentence(text, i) {
  let j = i - 1;
  while (j >= 0 && /[ \t"'“‘(\[]/.test(text[j])) j--;
  return j < 0 || !/[\p{L}\p{N},&’-]/u.test(text[j]);
}

/** does a mention's text cross a line, or a sentence's end — a period that is not an abbreviation's, an initial's or the token's own */
function crossesBreak(span, abbreviations, bareRecurs = () => false) {
  if (/\n/.test(span)) return true;
  const w = span.split(/\s+/);
  // a period after a single capital is the name's own only when the name before it does not recur without the period ("Robert F. Kennedy", not "Saturn V. Consequently")
  return w.slice(0, -1).some((x, i) => { if (!x.endsWith(".")) return /[!?]$/.test(x); const t = x.slice(0, -1); return !(abbreviations.has(t) || t.includes(".") || (/^\p{Lu}$/u.test(t) && !bareRecurs(w.slice(0, i + 1).join(" ").slice(0, -1)))); });
}

/** mentions of every surface; a later token of a name the text writes in lower case ("Antikythera mechanism") is the same name */
function spansFor(text, surfaces, mentionsOf, casing, nominalOk) {
  const base = mentionsOf(text, surfaces);
  if (!casing) return base;
  const extra = [];
  for (const s of surfaces) {
    const w = words(s); if (w.length < 2 || !w.slice(1).some((x) => CAP.test(x) && lc(x) !== x) || !w.slice(1).every((x) => !CAP.test(x) || nominalOk(x))) continue;
    const body = w.map((x, q) => (q === 0 ? esc(x) : esc(x).replace(/^(\\?.)/u, (c) => (CAP.test(c) ? `[${c}${lc(c)}]` : c)))).join("\\.?\\s+");
    const hits = [...text.matchAll(new RegExp(`(?<![\\p{L}\\p{N}])${body}\\.?(?![\\p{L}\\p{N}])`, "gu"))].map((m) => [m.index, m.index + m[0].length]);
    // the variant counts only when it recurs (RECUR.connector times) as its own unit
    const exact = hits.filter(([a, b]) => text.slice(a, b).replace(/\.$/, "") === s || text.slice(a, b).replace(/\.$/, "") === w.join(" ")).length;
    if (hits.length - exact >= RECUR.connector) extra.push(...hits);
  }
  return extra.length ? maximal([...base, ...extra]) : base;
}

/**
 * RESCUE — names the capital tier truncated or never started. Each candidate recurs as that unit (RECUR), is written capitalised more
 * often than not, and is one of: a window holding an inner joiner, a number after a capitalised token, or one lower-case connector between
 * capitalised tokens (the connector's unit must also be the common way one side appears); or a headed run — capitalised tokens whose first
 * token the text never writes in lower case and whose mentions mostly open a sentence, while the remainder is already a being's surface.
 * A candidate wholly explained by a longer one with the same count is dropped.
 */
export function rescue(text, sc, surfaceSet, connectorOk = () => true, abbreviations = new Set()) {
  const { toks, positional } = sc;
  const found = new Map(); const MAXW = 8; const n = toks.length;
  const initialGap = (a, b) => gapOk(text, a, b, sc, abbreviations);
  const open = (a, b) => b >= 0 && b < n && initialGap(toks[Math.min(a, b)], toks[Math.max(a, b)]) && CAP.test(toks[b].t) && !positional(toks[b].t);
  for (let i = 0; i < n; i++) {
    // a window may open on a word the text also writes in lower case when this occurrence is capitalised away from a sentence's opening
    if (!CAP.test(toks[i].t) || (positional(toks[i].t) && opensSentence(text, toks[i].s))) continue;
    let low = 0, bad = false;
    for (let j = i; j < n && j - i < MAXW; j++) {
      if (j > i && !initialGap(toks[j - 1], toks[j])) break;
      const t = toks[j].t;
      if (LOW.test(t)) { low++; if (low > 1) break; if (connectorOk(t) === false) bad = true; continue; }
      low = 0;
      if (!CAP.test(t) && !NUM.test(t)) break;
      if (NUM.test(t) && j === i) break;
      const w = toks.slice(i, j + 1);
      const end = toks[j].s + bare(toks[j].t).length;
      const k = text.slice(toks[i].s, end).replace(/\s+/g, " ");
      const hasConn = w.some((x, q) => q > 0 && q < w.length - 1 && LOW.test(x.t));
      const hasNum = w.some((x, q) => q > 0 && NUM.test(x.t));
      const hasJoin = w.some((x) => JOINER.test(x.t));
      const hasInit = w.some((x, q) => q > 0 && q < w.length - 1 && /^\p{Lu}$/u.test(x.t) && text[x.e] === ".");
      const hasAbbr = w.some((x, q) => q < w.length - 1 && text[x.e] === "." && !/^\p{Lu}$/u.test(x.t));
      const hasPoss = w.some((x, q) => q < w.length - 1 && /['’]s$/.test(x.t));
      // an owner's possessive before a thing ("Burj Khalifa's Lake", "Eurotunnel's 1990") makes a different thing; only a name whose own period precedes it ("St. Peter's Basilica") keeps one
      if (hasPoss && !hasAbbr) continue;
      if (hasConn && hasNum) continue;
      const caps = w.every((x) => CAP.test(x.t));
      const closed = caps && !hasJoin && !open(i, i - 1) && !open(j, j + 1);
      const headed = j > i && caps && !hasJoin && !positional(w[0].t) && (surfaceSet.has(w.slice(1).map((x) => x.t).join(" ")) || surfaceSet.has(w.slice(0, -1).map((x) => x.t).join(" "))) && !surfaceSet.has(k) && closed;
      const long = closed && w.length >= 5;
      if (!hasConn && !hasNum && !hasJoin && !hasInit && !hasAbbr && !hasPoss && !headed && !long) continue;
      if (hasConn && NUM.test(w[w.length - 1].t)) continue;
      if (hasJoin && !hasConn && open(j, j + 1)) continue;
      const kind = hasConn ? "connector" : hasNum ? "number" : hasJoin ? "joiner" : hasInit ? "initial" : hasAbbr ? "abbr" : hasPoss ? "poss" : headed ? "headed" : "long";
      if ((kind === "headed" || kind === "long") && !closed) continue;
      const e = found.get(k) ?? { key: k, kind, coord: hasConn && bad, starts: [], spans: [], connAt: hasConn ? w.findIndex((x, q) => q > 0 && LOW.test(x.t)) : -1 };
      e.starts.push(toks[i].s); e.spans.push([toks[i].s, end]); found.set(k, e);
    }
  }
  const out = [];
  for (const c of found.values()) {
    if (surfaceSet.has(c.key)) continue;
    // an initial with its period before a surname the cast already holds is evidence enough in one mention
    const lastTok = c.key.split(" ").pop();
    const need = c.kind === "connector" ? RECUR.connector
      : c.kind === "initial" && surfaceSet.has(lastTok) ? 1
      // a model designation (digits with a joiner or a letter) the text writes at least twice is a name's own, so its first unit is evidence enough ("Boeing 747-400" beside the bare "747-400")
      : (c.kind === "number" || c.kind === "joiner") && (NUM.test(lastTok) || isDesig(lastTok)) && /\D/.test(lastTok) && toks.filter((x) => x.t === lastTok || bare(x.t) === lastTok).length >= RECUR.unit && ![...found.values()].some((u) => u !== c && (u.kind === "number" || u.kind === "joiner") && u.key.includes(" ") && u.key.split(" ").pop() === lastTok) ? 1
      : RECUR.unit;
    if (c.spans.length < need) continue;
    // written capitalised more often than not: the same string in this exact case is the majority of its case-blind occurrences
    const body = c.key.split(" ").map(esc).join("[ \\t]+");
    const count = (flags) => (text.match(new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, flags)) ?? []).length;
    if (count("gu") * 2 <= count("giu")) continue;
    if (c.kind === "joiner") {
      // a name's joiner joins parts that are not names alone ("Trans-Alaska"); two parts each written alone, capitalised, are a route or a pair ("Chicago–Los Angeles")
      const seg = c.key.split(/[-–/]/).map((x) => x.trim());
      if (!/^[\p{Lu}\p{N}]/u.test(seg[0]) || !/^[\p{Lu}\p{N}]/u.test(seg[seg.length - 1])) continue;
      const alone = (x) => (text.match(new RegExp(`(?<![\\p{L}\\p{N}\\-–/])(?<!\\p{Lu}[\\p{L}'’]*[ \\t])${x.split(/\s+/).map(esc).join("[ \\t]+")}(?![\\p{L}\\p{N}\\-–/])(?![ \\t]\\p{Lu})`, "gu")) ?? []).length;
      const named = seg.filter((x) => /^\p{L}/u.test(x));
      if (named.length > 1 && named.every((x) => alone(x) >= RECUR.connector)) continue;
    }
    if (c.coord) {
      // a coordinating word joins a name only when the pair almost never occurs apart ("Harland and Wolff"): the unit accounts for RECUR.share of each side's mentions
      const w = c.key.split(" "), L = w.slice(0, c.connAt).join(" "), R = w.slice(c.connAt + 1).join(" ");
      const n = (x) => (text.match(new RegExp(`(?<![\\p{L}\\p{N}])${x.split(" ").map(esc).join("[ \\t]+")}(?![\\p{L}\\p{N}])`, "gu")) ?? []).length;
      if (c.spans.length < RECUR.share * n(L) || c.spans.length < RECUR.share * n(R)) continue;
    }
    if (c.kind === "connector" && !c.coord) {
      // the unit is how the text first introduces its left side: the first mention of that run stands inside the unit's first mention
      const w = c.key.split(" "), at = c.connAt;
      const L = w.slice(0, at).join(" ");
      const first = text.search(new RegExp(`(?<![\\p{L}\\p{N}])${L.split(" ").map(esc).join("[ \\t]+")}(?![\\p{L}\\p{N}])`, "u"));
      if (first < 0 || first !== Math.min(...c.starts)) continue;
    }
    out.push(c);
  }
  // the number that ends a rescued unit ("747" of "Boeing 747") is also written alone: it is a short form of the unit when it recurs (three characters or more, so that "1" is not)
  const seen = new Set(out.map((c) => c.key));
  for (const c of [...out]) {
    if (c.kind !== "number" && c.kind !== "joiner") continue;
    const T = c.key.split(" ").pop();
    if (!(NUM.test(T) || isDesig(T)) || T.length < 3 || seen.has(T) || surfaceSet.has(T)) continue;
    const spans = toks.filter((x) => x.t === T).map((x) => [x.s, x.s + T.length]);
    if (spans.length >= RECUR.unit) { seen.add(T); out.push({ key: T, kind: "tail", of: out.filter((u) => (u.kind === "number" || u.kind === "joiner") && u.key.split(" ").pop() === T).map((u) => u.key), starts: spans.map((x) => x[0]), spans }); }
  }
  // a sibling of such a number that the text writes only with a joiner ("747-400", "747-8" beside "747"): its stem before the joiner is a short form of a unit
  for (const [T, spans] of toks.reduce((m, x) => (NUM.test(x.t) && /[-–/]/.test(x.t) ? m.set(x.t, [...(m.get(x.t) ?? []), [x.s, x.e]]) : m), new Map())) {
    if (seen.has(T) || surfaceSet.has(T) || spans.length < RECUR.unit || !seen.has(T.split(/[-–/]/)[0])) continue;
    seen.add(T); out.push({ key: T, kind: "tail", of: out.filter((u) => (u.kind === "number" || u.kind === "joiner") && u.key.split(" ").pop() === T).map((u) => u.key), starts: spans.map((x) => x[0]), spans });
  }
  // a candidate wholly explained by a longer one with the same count is dropped
  return out.filter((c) => c.kind === "long" || c.kind === "headed" || c.kind === "tail" || !out.some((d) => d !== c && d.key.length > c.key.length && d.key.includes(c.key) && c.spans.every((x) => d.spans.some((y) => inside(x, y)))));
}

/**
 * BARE — a capitalised word the text never writes in lower case, written away from a sentence's opening, that recurs outside every being
 * the reader built: the reader dropped it as ambiguous among longer names ("Valdez" beside "Exxon Valdez" and "Valdez Marine Terminal"), but its
 * mentions belong to some being. It becomes a being of its own; whether it is a part of a longer name is for FOLD to say, from the text.
 */
export function bareNames(text, { toks, positional }, rows, abbreviations = new Set()) {
  const have = new Set(rows.flatMap((r) => r.surfaces));
  const covered = rows.flatMap((r) => r.spans).sort((a, b) => a[0] - b[0]);
  const isCovered = (x) => { let lo = 0, hi = covered.length - 1; while (lo <= hi) { const m = (lo + hi) >> 1; if (covered[m][0] <= x.s) { if (covered[m][1] > x.s) return true; lo = m + 1; } else hi = m - 1; } return covered.some((c) => c[0] <= x.s && c[1] > x.s); };
  const by = new Map();
  for (const x of toks) {
    if (!CAP.test(x.t) || positional(x.t) || lettersOf(x.t).length < 2 || abbreviations.has(x.t) || have.has(bare(x.t)) || NUM.test(x.t)) continue;
    if (isCovered(x)) continue;
    const e = by.get(bare(x.t)) ?? { key: bare(x.t), kind: "bare", spans: [], mid: 0 };
    e.spans.push([x.s, x.s + bare(x.t).length]); if (!opensSentence(text, x.s)) e.mid++;
    by.set(e.key, e);
  }
  return [...by.values()].filter((e) => e.spans.length >= RECUR.unit && e.mid >= 1);
}

const lettersOf = (s) => s.replace(/[^\p{L}\p{N}]/gu, "");
const initials = (name) => words(name).filter((w) => CAP.test(w)).map((w) => w[0]).join("");
const shares = (a, b) => { const A = new Set(words(a).map((w) => lc(lettersOf(bare(w)))).filter((w) => w.length > 1)); return words(b).some((w) => A.has(lc(lettersOf(bare(w))))); };
// a surface without its periods, possessives and case, for asking whether one name holds another
const nz = (s) => words(s).map((w) => bare(w).replace(/\./g, "").replace(/[-–/]/g, " ").toLowerCase()).join(" ").replace(/\s+/g, " ");
// is `short` found in `long` only after a lower-case word ("Paris" in "Notre-Dame de Paris"): the object of a connector is not the head of the name
const afterConnector = (shortNz, x) => { const wx = words(x).flatMap((w) => nz(w).split(" ").map((z) => [z, /^\p{Ll}/u.test(w)])), n = shortNz.split(" ").length; for (let i = 0; i + n <= wx.length; i++) if (wx.slice(i, i + n).map((z) => z[0]).join(" ") === shortNz) return i > 0 && wx.slice(0, i).some((z) => z[1]); return false; };
const subrun = (short, long) => (" " + long + " ").includes(" " + short + " ");

/**
 * CLAIMS — "Name (Short)" and "Name (Short or Other)". The parenthesis holds nothing but capitalised runs, numbers and lower-case
 * joining tokens; each capitalised run is a claimed form of the name when it is the name's initialism, or shares a token with it without
 * being a part of it. `name` is the longest tail of the capitalised run before "(" whose first token is not positional.
 */
export function claims(text, sc, abbreviations = new Set()) {
  const { toks } = sc; const out = [];
  const runFrom = (q) => { let p = q; while (p > 0 && gapOk(text, toks[p - 1], toks[p], sc, abbreviations) && (CAP.test(toks[p - 1].t) || NUM.test(toks[p - 1].t))) p--; return p; };
  const slice = (a, b) => text.slice(toks[a].s, toks[b].e).replace(/\s+/g, " ");
  for (const m of text.matchAll(/\(([^()\n]{2,100})\)/g)) {
    const open = m.index; if (text[open - 1] !== " ") continue;
    const q = toks.findIndex((x) => x.e === open - 1); if (q < 0) continue;
    const p = runFrom(q);
    if (q - p < 1) continue;
    if (m[1].replace(TOK, "").replace(/[\s,;]/g, "").length) continue;
    const forms = []; let cur = [];
    for (const w of m[1].split(/[\s,;]+/).filter(Boolean)) { if (LOW.test(w)) { if (cur.length) forms.push(cur.join(" ")); cur = []; } else cur.push(w); }
    if (cur.length) forms.push(cur.join(" "));
    for (let s = p; s < q; s++) {
      const name = slice(s, q);
      const claimed = forms.filter((f) => f !== name && !subrun(f, name) && !subrun(name, f) && ((lettersOf(f).length > 1 && lettersOf(f).toUpperCase() === initials(name).toUpperCase()) || shares(f, name)));
      if (!claimed.length) continue;
      const members = [name, ...claimed];
      // "Name or Other Name (Short or Other Short)": the name before a lower-case joiner that shares a token with these is another of the same thing
      if (p >= 2 && LOW.test(toks[p - 1].t) && sameLine(text, toks[p - 1], toks[p]) && sameLine(text, toks[p - 2], toks[p - 1]) && (CAP.test(toks[p - 2].t) || NUM.test(toks[p - 2].t))) {
        const l = runFrom(p - 2), other = slice(l, p - 2);
        if (!subrun(other, name) && !subrun(name, other) && members.some((x) => x !== other && shares(x, other))) members.unshift(other);
      }
      out.push(members); break;
    }
  }
  return out;
}

/**
 * @param {object} a
 * @param {string} a.text         the newline-normalised text the rows' spans index
 * @param {Array}  a.rows         [{ ref, surfaces, spans, standing, represent }] the base cast
 * @param {Function} a.mentionsOf (text, surfaces) → spans, the base's own matcher
 * @param {Set}    a.abbreviations this read's abbreviation set
 * @param {Function} a.commonNoun  (token) → does the part-of-speech prior use it mostly as a common noun, not a name ("President")?
 * @param {Function} a.nominalOk   (token) → is it a noun, a name or an adjective by the part-of-speech prior (so a lower-case twin of it may continue a name)?
 * @param {Function} a.connectorOk (lower-case token) → may it join two capitalised runs of a name? (the read's own part-of-speech prior decides)
 * @param {object} a.options      { lead, rescue, claims, unmerge, fold, casing, spans } each on unless false
 * @returns {{ rows, refMap: Map<string,string>, report }}
 */
export function castIdentity({ text, rows, mentionsOf, abbreviations = new Set(), connectorOk = () => true, nominalOk = () => true, commonNoun = () => false, options = {} }) {
  const on = (k) => options[k] !== false;
  const report = { rescued: [], claimed: [], dropped: [], unmerged: [], folded: [], gaps: [], spansFixed: 0, recur: RECUR };
  const refMap = new Map();
  let work = rows.map((r) => ({ ref: r.ref, surfaces: [...r.surfaces], spans: r.spans.map((s) => [...s]), represent: r.represent, dirty: false, dest: null }));
  const sc = scan(text);
  const bareRecurs = (before) => before.length > 0 && (text.match(new RegExp(`(?<![\\p{L}\\p{N}])${before.split(/\s+/).map(esc).join("[ \\t]+")}(?![.\\p{L}\\p{N}])`, "gu")) ?? []).length >= RECUR.connector;
  const mo = (surfaces) => spansFor(text, surfaces, mentionsOf, on("casing"), nominalOk);
  const respan = (r) => { r.spans = r.surfaces.length ? mo(r.surfaces) : []; r.dirty = false; };
  const owners = () => { const m = new Map(); for (const r of work) for (const s of r.surfaces) if (!m.has(s)) m.set(s, r); return m; };
  const settle = () => { for (const r of work) if (r.dirty) respan(r); for (const r of work) if (!r.surfaces.length && r.dest) refMap.set(r.ref, r.dest); work = work.filter((r) => r.surfaces.length); };

  // LEAD
  if (on("lead")) {
    const own = owners();
    for (const r of work) for (const s of [...r.surfaces]) {
      const w = words(s);
      // a possessive of another surface ("Notre-Dame's"): the 's is the sentence's, not the name's
      if (/['’]s$/.test(s) && own.has(bare(s)) && own.get(bare(s)) !== own.get(s)) { const r0 = own.get(s); r0.surfaces = r0.surfaces.filter((x) => x !== s); r0.dirty = true; r0.dest = own.get(bare(s)).ref; report.dropped.push({ surface: s, into: bare(s) }); continue; }
      if (w.length < 2) continue;
      const sp = mentionsOf(text, [s]); if (!sp.length) continue;
      let rest = null;
      // a capital at the head that the text writes in lower case at least as often as capitalised away from a sentence's opening, on a surface that mostly opens a sentence ("The", "On")
      if (CAP.test(w[0]) && sc.positional(w[0]) && own.has(w.slice(1).join(" ")) && sp.filter(([a]) => opensSentence(text, a)).length * 2 >= sp.length) rest = w.slice(1).join(" ");
      // a surface every mention of which runs across a line or a sentence's end: the name is what stands before the break
      else if (sp.every(([a, b]) => crossesBreak(text.slice(a, b), abbreviations, bareRecurs))) { for (let k = w.length - 1; k >= 1 && !rest; k--) if (own.has(w.slice(0, k).join(" "))) rest = w.slice(0, k).join(" "); if (rest === null) rest = ""; }
      if (rest === null || (rest !== "" && own.get(rest) === r && r.surfaces.length < 2)) continue;
      r.surfaces = r.surfaces.filter((x) => x !== s); r.dirty = true; r.dest = rest === "" ? null : own.get(rest).ref;
      report.dropped.push({ surface: s, into: rest });
    }
    settle();
  }

  // HAPAX — a surface written once that is another surface of this text plus tokens at either edge ("President Emmanuel Macron", "April White Star", "Mission Control Center"),
  // while the rest stands alone RECUR.connector times or more: the edge tokens are the sentence's company, not a name of their own
  const hapax = () => {
    const own = owners();
    for (const r of work) for (const s of [...r.surfaces]) {
      const w = words(s); if (w.length < 2) continue;
      const sp = mentionsOf(text, [s]); if (sp.length !== 1) continue;
      let rest = null;
      for (let k = 1; k < w.length && !rest; k++) for (const x of [w.slice(k).join(" "), w.slice(0, w.length - k).join(" ")]) {
        const o = own.get(x); if (o && o !== undefined && mentionsOf(text, [x]).length - 1 >= RECUR.connector) { rest = x; break; }
      }
      if (rest === null) continue;
      // the edge tokens must be the sentence's company: a word the text writes in lower case as often, or a word that stands alone and is not a prefix to names ("RMS" is: it comes before a name every time)
      const edge = w.filter((x) => !words(rest).includes(x));
      const lead = s.startsWith(edge[0] + " ") && !s.endsWith(" " + edge[edge.length - 1]) ? true : s.startsWith(edge[0] + " ");
      const solo = (x) => { const hits = sc.toks.filter((t) => t.t === x && !(t.s >= sp[0][0] && t.e <= sp[0][1])); if (hits.length < RECUR.connector) return false; const nb = hits.filter((t) => { const q = sc.toks[lead ? sc.toks.indexOf(t) + 1 : sc.toks.indexOf(t) - 1]; return q && CAP.test(q.t); }).length; return nb * 2 < hits.length; };
      if (!edge.length || !edge.every((x) => sc.positional(x) || commonNoun(x) || solo(x))) continue;
      r.surfaces = r.surfaces.filter((q) => q !== s); r.dirty = true; r.dest = own.get(rest).ref; report.dropped.push({ surface: s, into: rest, by: "hapax" });
    }
    settle();
  };
  if (on("hapax")) hapax();

  // VARIANTS — two beings holding the same name written with a hyphen, a period or a diacritic differently ("Trans-Alaska Pipeline System", "Trans Alaska Pipeline System") are one
  const variants = () => {
    const ck = (x) => words(x).map((w) => bare(w).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[-–/.]/g, " ").toLowerCase().trim()).join(" ").replace(/\s+/g, " ");
    const by = new Map();
    for (const r of work) for (const x of r.surfaces) { const k = ck(x); if (k.includes(" ")) (by.get(k) ?? by.set(k, new Set()).get(k)).add(r); }
    for (const rs of by.values()) {
      if (rs.size < 2) continue;
      const [root, ...rest] = [...rs].filter((r) => r.surfaces.length).sort((a, b) => b.spans.length - a.spans.length);
      for (const r of rest) { if (!r.surfaces.length) continue; root.surfaces.push(...r.surfaces); root.dirty = true; report.folded.push({ surface: longest(r.surfaces), into: longest(root.surfaces), by: "variant" }); r.surfaces = []; r.dest = root.ref; }
    }
    settle();
  };
  if (on("variants")) variants();

  // RESCUE
  if (on("rescue")) {
    const have = new Set(work.flatMap((r) => r.surfaces));
    const barely = bareNames(text, sc, work, abbreviations).filter((b) => !have.has(b.key));
    const found = [...rescue(text, sc, new Set([...have, ...barely.map((b) => b.key)]), connectorOk, abbreviations), ...barely];
    const made = new Map();
    for (const c of found.filter((x) => x.kind !== "tail")) {
      const spans = mo([c.key]);
      if (spans.length < 1) continue;
      const row = { ref: refOfKey(c.key), surfaces: [c.key], spans, represent: c.key, dirty: false, dest: null };
      work.push(row); made.set(c.key, row);
      report.rescued.push({ surface: c.key, kind: c.kind, mentions: spans.length });
    }
    // a number written alone that ends exactly one rescued unit is that unit's short form; one that ends several is left to FOLD
    for (const c of found.filter((x) => x.kind === "tail")) {
      const units = (c.of ?? []).map((k) => made.get(k)).filter(Boolean);
      if (units.length === 1) { units[0].surfaces.push(c.key); units[0].dirty = true; report.rescued.push({ surface: c.key, kind: "tail", into: units[0].surfaces[0] }); continue; }
      const spans = mo([c.key]);
      if (!spans.length) continue;
      work.push({ ref: refOfKey(c.key), surfaces: [c.key], spans, represent: c.key, dirty: false, dest: null });
      report.rescued.push({ surface: c.key, kind: "tail", mentions: spans.length });
    }
    // a unit that ends in a designation the reader already holds as a being ("Rocketdyne F-1" beside "F-1") is that being with a modifier
    const own0 = owners();
    for (const [k, row] of made) {
      const T = k.split(" ").pop(); const o = own0.get(T);
      if (isDesig(T) && o && o !== row) { o.surfaces.push(k); o.dirty = true; row.surfaces = []; row.dest = o.ref; report.rescued.push({ surface: k, kind: "modified", into: T }); }
    }
    work = work.filter((r) => r.surfaces.length);
    // a unit with a possessive inside ("St. Peter's Basilica") is also written up to the possessive ("St. Peter's"): the prefix goes to the unit that has most mentions
    const prefixOf = new Map();
    for (const [k, row] of made) {
      const w = words(k), q = w.findIndex((x, i) => i < w.length - 1 && /['’]s$/.test(x));
      if (q < 0 || !w.slice(0, q).some((x) => text.includes(x.replace(/\.$/, "") + ". "))) continue;
      const pre = w.slice(0, q + 1).join(" "), cur = prefixOf.get(pre);
      if (!cur || row.spans.length > cur.spans.length) prefixOf.set(pre, row);
    }
    for (const [pre, row] of prefixOf) if (!have.has(pre)) { row.surfaces.push(pre); row.dirty = true; }
    for (const r of work) if (r.dirty) respan(r);
    if (on("variants")) variants();
    if (on("hapax")) hapax();
  }

  // CLAIMS
  if (on("claims")) {
    for (const raw of claims(text, sc, abbreviations)) {
      const own = owners();
      // a positional capital in front of a known name is not part of the claim ("The Burj Khalifa (Burj Dubai)")
      const members = [...new Set(raw.map((x) => { const w = words(x); return w.length > 1 && sc.positional(w[0]) && own.has(w.slice(1).join(" ")) ? w.slice(1).join(" ") : x; }))];
      // the being the group joins is one whose own longest name is a member (not a being that holds a member as part of a longer name: "LHC" of "LHC Computing Grid")
      const owned = members.map((x) => own.get(x)).filter(Boolean);
      const heads = owned.filter((r) => members.includes(longest(r.surfaces)));
      const root = (heads.length ? heads : owned).sort((a, b) => b.spans.length - a.spans.length)[0];
      if (!root) continue;
      for (const x of members) {
        const from = own.get(x); if (from === root) continue;
        if (from) { from.surfaces = from.surfaces.filter((q) => q !== x); from.dirty = true; if (!from.surfaces.length) from.dest = root.ref; }
        else if (!mentionsOf(text, [x]).length) continue;
        root.surfaces.push(x); root.dirty = true;
        report.claimed.push({ form: x, of: members[0], from: from?.surfaces?.[0] ?? null });
      }
    }
    settle();
  }

  // INITIALS — an all-capital short form that is the capitals of exactly one multi-token name in this text belongs to that name
  if (on("initials")) {
    for (const x of work) for (const s of [...x.surfaces]) {
      if (words(s).length !== 1 || lettersOf(s).length < 2 || s !== s.toUpperCase()) continue;
      const own = owners(); const c = new Set();
      for (const [k, o] of own) if (words(k).length > 1 && initials(k).toUpperCase() === lettersOf(s)) c.add(o);
      if (c.has(x)) continue;
      if (c.size > 1) { report.gaps.push({ gap: "cast_identity_initials_tie", surface: s, between: [...c].map((o) => longest(o.surfaces)) }); continue; }
      if (c.size !== 1) continue;
      const to = [...c][0];
      x.surfaces = x.surfaces.filter((q) => q !== s); x.dirty = true; if (!x.surfaces.length) x.dest = to.ref;
      to.surfaces.push(s); to.dirty = true;
      report.claimed.push({ form: s, of: longest(to.surfaces), by: "initials" });
    }
    settle();
  }

  // UNMERGE
  if (on("unmerge")) {
    const added = [];
    for (const r of work) {
      if (r.surfaces.length < 2) continue;
      const long = r.surfaces.filter((x) => words(x).length > 1); const leave = new Set();
      for (const L of long) {
        const lSp = mentionsOf(text, [L]); if (!lSp.length) continue;
        for (const S of r.surfaces) {
          if (S === L || !subrun(S, L) || L.endsWith(" " + S)) continue;
          const sSp = mentionsOf(text, [S]); const out = sSp.filter((x) => !lSp.some((y) => inside(x, y)));
          // a short form mostly used before the long name was first written, or mostly used outside it, is not that name's mention
          if (out.length && (out.filter((x) => x[0] < lSp[0][0]).length * 2 > out.length || out.length * 2 > sSp.length)) leave.add(S);
        }
      }
      // two full names neither of whose words the other holds are two beings: the one with fewer mentions leaves, with what only it holds
      const fold = (w) => w.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const set = (x) => new Set(words(x).map((w) => fold(bare(w))));
      const held = (X, Y) => [...X].every((w) => Y.has(w));
      for (let a = 0; a < long.length; a++) for (let b = a + 1; b < long.length; b++) {
        const A = set(long[a]), B = set(long[b]);
        if (held(A, B) || held(B, A) || abbreviations.has(words(long[a])[0]) || abbreviations.has(words(long[b])[0])) continue;
        const go = mentionsOf(text, [long[a]]).length <= mentionsOf(text, [long[b]]).length ? long[a] : long[b], stay = go === long[a] ? long[b] : long[a];
        leave.add(go);
        for (const x of r.surfaces) if (x !== go && subrun(x, go) && !subrun(x, stay)) leave.add(x);
      }
      if (!leave.size || leave.size >= r.surfaces.length) continue;
      const gone = r.surfaces.filter((x) => leave.has(x));
      r.surfaces = r.surfaces.filter((x) => !leave.has(x)); r.dirty = true;
      for (const g of gone) report.unmerged.push({ surface: g, from: longest(r.surfaces) });
      let ref = refOfKey(longest(gone)); for (let n = 2; work.some((w) => w.ref === ref) || added.some((w) => w.ref === ref); n++) ref = `${refOfKey(longest(gone))}~${n}`;
      added.push({ ref, surfaces: gone, spans: [], represent: longest(gone), dirty: true, dest: null });
    }
    work.push(...added);
    // a lone all-capital short form that is the capitals of exactly one multi-token name joins that name
    for (const x of added) {
      if (!work.includes(x)) continue;
      const own = owners(); const c = new Set();
      for (const s of x.surfaces) if (words(s).length === 1 && lettersOf(s).length > 1 && s === s.toUpperCase()) for (const [k, o] of own) if (o !== x && words(k).length > 1 && initials(k).toUpperCase() === lettersOf(s)) c.add(o);
      if (c.size === 1) { const to = [...c][0]; to.surfaces.push(...x.surfaces); to.dirty = true; x.surfaces = []; x.dest = to.ref; report.claimed.push({ form: longest(to.surfaces), by: "initials" }); }
    }
    settle();
  }

  // FOLD
  if (on("fold")) {
    for (const r of work) if (r.dirty || on("casing")) respan(r);
    const lenOf = (r) => longest(r.surfaces).length;
    const parent = new Map(), why = new Map();
    for (const S of work) {
      if (!S.spans.length) continue;
      const cands = [];
      for (const P of work) {
        if (P === S || !P.spans.length || lenOf(P) <= lenOf(S) || !P.surfaces.some((x) => x.length > longest(S.surfaces).length && subrun(nz(longest(S.surfaces)), nz(x)) && !afterConnector(nz(longest(S.surfaces)), x))) continue;
        cands.push({ P, k: insideCount(S.spans, P.spans) });
      }
      if (!cands.length) continue;
      const maj = cands.filter((c) => c.k * 2 > S.spans.length).sort((a, b) => b.k - a.k);
      if (maj.length) {
        if (maj.length > 1 && maj[0].k === maj[1].k) {
          if (maj[0].P.spans.length === maj[1].P.spans.length) { report.gaps.push({ gap: "cast_identity_tie", surface: longest(S.surfaces), between: [longest(maj[0].P.surfaces), longest(maj[1].P.surfaces)] }); continue; }
          parent.set(S, maj[0].P.spans.length < maj[1].P.spans.length ? maj[0].P : maj[1].P); why.set(S, "majority"); continue;
        }
        parent.set(S, maj[0].P); why.set(S, "majority"); continue;
      }
      // a short form the text first writes inside a longer name was introduced by it ("Everest" in "Mount Everest")
      // but a bare one-word name beside "Name + one common noun" (\"Millau\" and \"Millau Viaduct\") may be the place, not the thing: a typed gap, not a join
      const kindHead = (P) => P.surfaces.some((x) => { const n = nz(x), m = nz(longest(S.surfaces)); if (!n.startsWith(m + " ")) return false; const w = words(x); const t = w[w.length - 1]; return (commonNoun(t) || sc.positional(t)) && words(longest(S.surfaces)).length === 1 && words(x).length === 2; });
      const intro = cands.filter((c) => c.P.spans.some((y) => inside(S.spans[0], y)) && !kindHead(c.P));
      if (intro.length) {
        intro.sort((a, b) => lenOf(b.P) - lenOf(a.P));
        if (intro.length > 1 && lenOf(intro[0].P) === lenOf(intro[1].P) && intro[0].P.ref !== intro[1].P.ref) { report.gaps.push({ gap: "cast_identity_tie", surface: longest(S.surfaces), between: [longest(intro[0].P.surfaces), longest(intro[1].P.surfaces)] }); continue; }
        parent.set(S, intro[0].P); why.set(S, "introduced"); continue;
      }
      // otherwise it stays a being of its own: whether it is the longer name's short form cannot be told from the text (a typed gap)
      if (S.spans.length >= RECUR.connector && report.gaps.length < 40) report.gaps.push({ gap: "cast_identity_short_form_open", surface: longest(S.surfaces), containers: cands.slice(0, 3).map((c) => longest(c.P.surfaces)) });
    }
    const root = (r) => { let x = r, n = 0; while (parent.has(x) && n++ < 50) x = parent.get(x); return x; };
    const groups = new Map();
    for (const r of work) { const g = root(r); (groups.get(g) ?? groups.set(g, []).get(g)).push(r); }
    const next = [];
    for (const [g, members] of groups) {
      if (members.length === 1) { next.push(g); continue; }
      for (const m of members) if (m !== g) { refMap.set(m.ref, g.ref); report.folded.push({ surface: longest(m.surfaces), into: longest(g.surfaces), by: why.get(m) ?? "chain" }); }
      next.push({ ...g, surfaces: [...new Set([...g.surfaces, ...members.flatMap((m) => m.surfaces)])], spans: maximal(members.flatMap((m) => m.spans)) });
    }
    work = next;
  }

  // SPANS
  if (on("spans")) {
    // one place, one being: the longer mention keeps it
    const all = work.flatMap((r) => r.spans.map((s) => ({ r, s })));
    for (const r of work) r.spans = r.spans.filter((s) => !all.some((o) => o.r !== r && o.s[1] - o.s[0] > s[1] - s[0] && o.s[0] < s[1] && s[0] < o.s[1]));
    for (const r of work) {
      const out = [];
      for (let [a, b] of r.spans) {
        const nl = text.slice(a, b).search(/\s*\n/);
        if (nl > 0) b = a + nl;
        while (b > a && text[b - 1] === ".") {
          const tok = text.slice(a, b - 1).match(/[\p{L}\p{N}][\p{L}\p{N}'’.]*$/u)?.[0] ?? "";
          const next = text.slice(b).match(/^[ \t]*(\S)/)?.[1] ?? "";
          if (abbreviations.has(tok) || tok.includes(".") || (/^\p{Lu}$/u.test(tok) && /^\p{Lu}$/u.test(next) && !bareRecurs(text.slice(a, b - 1)))) break;
          b--; report.spansFixed++;
        }
        if (b > a) out.push([a, b]);
      }
      r.spans = maximal(out);
    }
  }

  return { rows: work.filter((r) => r.spans.length).map(({ dirty, dest, ...r }) => r), refMap, report };
}
