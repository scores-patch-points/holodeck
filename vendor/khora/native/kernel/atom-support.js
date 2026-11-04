// atom-support.js — a claim weighed against its source ATOM BY ATOM (MEANING-ATOMS.md §4). Each claim atom is met when a source atom has the
// same predicate (same word, a dictionary synonym, or a shared English key) over the same referents (the same name, one containing the
// other, the same number, or nouns that are synonyms or share a key), with a compatible standing; it is contradicted when the source holds the
// same atom with the other polarity. A claim is supported when every load-bearing atom is met; one-place facts on a referent (an adjective)
// count too, met by the same adjective or by a source referent whose words carry it. The result names each atom's state, so a verdict is
// explained ("met: …; not met: …").
//   atomSupport(claimAtoms, sourceAtoms, { claimLang, sourceLang, same, keysOf }) → { verdict: "E" | "C" | "N", table: [{ atom, state, by }] }
//   same(lang, a, b, pos): optional, wikt-gloss.js synonymy (true when two words of one language mean the same)
//   keysOf(lang, word): optional, the word's English keys (wikt-gloss.js gloss.all), so words of two languages can meet
const low = (s) => String(s ?? "").normalize("NFKC").toLowerCase();
const ART = /^(the|a|an|el|la|los|las|lo|un|una|le|les|l'|l’|un|une|des|du|de la|der|die|das|den|dem|des|ein|eine|einen|einem|einer)\s+/u;
const words = (s) => low(s).replace(ART, "").replace(/[’']/g, " ").replace(/[“”"«»()\[\],.:;!?]/g, " ").split(/\s+/).filter(Boolean);
const stem = (w) => low(w).replace(/[^\p{L}\p{N}]/gu, "").slice(0, 5);
const numOf = (s) => { const m = /(\d[\d\s.,']*\d|\d)/u.exec(String(s ?? "")); if (!m) return null; let t = m[1].replace(/[\s']/g, ""); if (/,\d{3}(\D|$)/.test(t) && !/\.\d/.test(t)) t = t.replace(/,/g, ""); else if (/\.\d{3}(\D|$)/.test(t) && /,/.test(t)) t = t.replace(/\./g, "").replace(",", "."); else t = t.replace(",", "."); const v = parseFloat(t); return Number.isFinite(v) ? v : null; };
const DEG = /^(most|more|less|least):/;
// PERSPECTIVE: an atom is held in a sense, and two atoms stated for different years are of different senses (stage.js senseStanding): the source's neither
// meets the claim's nor contradicts it. Only STATED years decide; an atom with none is held in no stated year and is compared as before.
export const otherYears = (c, s) => !!(c.time?.length && s.time?.length && !c.time.some((y) => s.time.includes(y)));
const argText = (a) => (a && typeof a === "object" ? a.name ?? a.value ?? "" : String(a ?? ""));

// unread: the claim's content words no claim atom carries; a claim with any is never supported (what was not read cannot be checked)
// CANONICAL REWRITES of the claim, declared once (MEANING-ATOMS §5.1), so it meets a source that says the same in its usual form:
// - "no X is higher than Y" is "Y is the highest": a negated comparison from a "no" quantifier becomes the superlative of its second
//   referent, and the other negated atoms on the "no X" referent are said of that referent, asserted ("NOT in(no mountain, Washington)" →
//   in(Rainier, Washington));
// - "X is another name for Y" is named(Y, X).
const NO = /^(no|none|neither|kein|keine|keiner|keinen|aucun|aucune|nul|nulle|ningún|ninguna|ninguno|nadie)\s/i;
const NAME = /^(name|nom|nombre|name|bezeichnung|名前|別名|名称)$/i;
export function canonical(C) {
  let out = [...C];
  const noArg = (a) => a && typeof a === "object" && NO.test(String(a.name ?? a.value ?? ""));
  const cmp = out.find((c) => c.neg && (c.args ?? []).length === 2 && noArg(c.args[0]) && !noArg(c.args[1]));
  if (cmp) {
    const Y = cmp.args[1], X = cmp.args[0], w = low(cmp.pred).replace(/^(more|most):/, "").split(/[_\s]+/)[0];
    const key = (a) => a.entity ?? low(a.value ?? a.name);
    out = out.filter((c) => !(c.pred === cmp.pred || (c.args ?? []).length === 2 && key(c.args[0]) === key(X) && key(c.args[1]) === key(Y)))
      .map((c) => (c.neg && noArg(c.args?.[0]) && key(c.args[0]) === key(X) ? { ...c, neg: false, args: [Y, ...c.args.slice(1)], rewritten: "no-comparative" } : c));
    out.push({ pred: `most:${w}`, args: [Y], neg: false, hedged: !!cmp.hedged, rewritten: "no-comparative", text: `most:${w}(${Y.name ?? Y.value})` });
  }
  for (const n of out.filter((c) => c.pred === "is_a" && NAME.test(low(c.args?.[1]?.value ?? c.args?.[1]?.name ?? "").replace(ART, "").split(/\s+/).at(-1) ?? ""))) {
    const X = n.args[0], f = out.find((c) => c !== n && (c.args ?? []).length === 2 && /(_|^)(for|de|für|pour|del|の)$/.test(c.pred) && (c.args[0].entity ?? c.args[0].value) === (X.entity ?? X.value));
    if (!f) continue;
    out = out.filter((c) => c !== n && c !== f);
    out.push({ pred: "named", args: [f.args[1], X], neg: !!n.neg, hedged: !!n.hedged, rewritten: "another-name", text: `named(${f.args[1].name ?? f.args[1].value}, ${X.name ?? X.value})` });
  }
  return out;
}
// the meeting tests over one claim and one source (its referents' names on each side), shared with the learned matcher (atom-match.js)
export function meeters(C, S, { claimLang = "en", sourceLang = "en", same = null, keysOf = null } = {}) {
  const keys = (lang, w) => { const ks = new Set([stem(w)]); if (keysOf && lang !== "en") for (const k of keysOf(lang, low(w)) ?? []) for (const x of words(k)) ks.add(stem(x)); return ks; };
  const wordMeet = (a, b) => {
    if (stem(a) && stem(a) === stem(b)) return true;
    if (claimLang === sourceLang && same?.(claimLang, low(a), low(b))) return true;
    // a predicate is written in English keys whatever the language (atoms.js glosses it), so two of them can be English synonyms
    if (claimLang !== sourceLang && /^[a-z]+$/.test(low(a)) && /^[a-z]+$/.test(low(b)) && same?.("en", low(a), low(b))) return true;
    const ka = keys(claimLang, a), kb = keys(sourceLang, b); for (const k of ka) if (k.length >= 3 && kb.has(k)) return true;
    return false;
  };
  // the same referent: the same number; the same name or one inside the other; the same head noun (or its synonym or key)
  // every name a referent has on its side: its own and what a named(x, …) atom calls it
  const namesOf = (atoms) => { const m = new Map(); for (const a of atoms) if (a.pred === "named" && a.args?.[0]?.entity != null) { const k = a.args[0].entity; (m.get(k) ?? m.set(k, new Set()).get(k)).add(argText(a.args[1])); } return m; };
  const NC = namesOf(C), NS = namesOf(S);
  const allNames = (a, N) => [argText(a), ...(a?.entity != null ? [...(N.get(a.entity) ?? [])] : [])];
  // two figures of one measure meet by their values in base units (any bracketed equivalent too), within 2%, or 5% when either is approximate
  const figMeet = (x, y) => { if (!x?.measure || x.measure !== y?.measure || x.base == null || y.base == null) return null; const tol = 0.02; return [x.base, ...(x.alts ?? [])].some((a) => [y.base, ...(y.alts ?? [])].some((b) => Math.abs(a - b) <= tol * Math.max(Math.abs(a), Math.abs(b), 1e-9))); };
  const refMeet = (x, y) => { const f = figMeet(x, y); if (f != null) return f; if (x?.person && x.person === y?.person) return true; return allNames(x, NC).some((tx) => allNames(y, NS).some((ty) => refMeet1(tx, ty))); };
  // two names of one referent: every content word of the claim's is met by a word of the source's
  const STOP = new Set(["de", "del", "des", "du", "of", "von", "vom", "der", "die", "das", "la", "le", "el", "the", "di", "da", "y", "et", "und", "and", "en", "in", "a", "à"]);
  const refMeet1 = (tx, ty) => {
    const nx = numOf(tx), ny = numOf(ty);
    if (nx != null || ny != null) return nx != null && ny != null && Math.abs(nx - ny) <= 0.02 * Math.max(Math.abs(nx), Math.abs(ny), 1e-9);
    const wx = words(tx), wy = words(ty); if (!wx.length || !wy.length) return false;
    const jx = wx.join(" "), jy = wy.join(" ");
    if (jx === jy || jx.includes(jy) || jy.includes(jx)) return true;
    const hx = wx.at(-1), hy = wy.at(-1);
    if (wordMeet(hx, hy) || wordMeet(wx[0], wy[0]) && (wx.length === 1 || wy.length === 1)) return true;
    const cw = wx.filter((w) => !STOP.has(w)), sw = wy.filter((w) => !STOP.has(w));
    if (cw.length && cw.every((a) => sw.some((b) => wordMeet(a, b)))) return true;
    // a name met by its distinctive word ("Titicaca" in "El lago Titicaca")
    const cap = (s) => (s.match(/\p{Lu}[\p{L}'’-]{3,}/gu) ?? []).map(low);
    const cx = cap(tx), cy = cap(ty); return cx.length > 0 && cx.some((w) => cy.includes(w));
  };
  const predWords = (p) => low(p).replace(DEG, "").split(/[_\s]+/).filter((w) => w && w.length > 1);
  // a declared canonical form (MEANING-ATOMS §5.1): a verb of being somewhere with a place is "be_in" — lie, sit, stand, be located or
  // situated, be found (se encuentra, se trouve), exist (ある), with the place's case word
  const LOC = /^(lie|sit|stand|locate|situate|find|exist|be|liegen|befinden|encontrar|ubicar|situar|trouver|situer|trouv|ある|位置)$/;
  const canon = (p) => { const ws = predWords(p); return ws.length >= 1 && ws.length <= 2 && LOC.test(ws[0]) && (ws.length === 2 || /^be_/.test(p) || ws[0] !== "be") ? "be_in" : p; };
  const predMeet = (p, q) => {
    if (p === q || (canon(p) === "be_in" && canon(q) === "be_in")) return true;
    const dp = DEG.exec(p)?.[1] ?? null, dq = DEG.exec(q)?.[1] ?? null; if (dp !== dq) return false;
    if (p === "is_a" || q === "is_a" || p === "named" || q === "named") return p === q;
    if (/^has_/.test(p) && /^has_/.test(q)) return true; // a figure meets a figure; the value decides
    // every content word of the claim's predicate must be met (a direction or manner word too: "lie_nordwestlich" is not "lie"); a case word
    // (four letters or fewer: in, of, de, à, über) may be met by the source's or left to the place it marks
    const a = predWords(p), b = predWords(q), content = a.filter((x) => x.length > 4 || /\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}/u.test(x));
    return (content.length ? content : a).every((x) => b.some((y) => wordMeet(x, y)));
  };
  // the claim's arguments in the source atom's, in order (a source atom may carry one more: "occupy(sector, known, 2112 km²)")
  const argsMeet = (cargs, sargs) => { let j = 0; for (const a of cargs) { while (j < sargs.length && !refMeet(a, sargs[j])) j++; if (j >= sargs.length) return false; j++; } return true; };
  // a source that only reports or hedges a fact does not support it asserted
  const standing = (c, s) => !s.hedged || !!c.hedged;
  return { wordMeet, refMeet, figMeet, predMeet, predWords, argsMeet, standing, canon };
}
export { low, words, stem, argText, DEG, NO };
// swapFlags (PREREG run 22a): claim atoms (two or more arguments; not is_a, named, has_*) whose arguments the source holds under a different
// predicate (role swap), or in the reverse order under a meeting predicate (direction swap). A different predicate over the same arguments is a
// swap; no lexicon of antonyms or converses is consulted.
export function swapFlags(C0, S, { claimLang = "en", sourceLang = "en", same = null, keysOf = null } = {}) {
  const C = canonical(C0), { predMeet, argsMeet } = meeters(C, S, { claimLang, sourceLang, same, keysOf });
  const out = [];
  for (const c of C) {
    const cargs = c.args ?? []; if (cargs.length < 2 || c.pred === "is_a" || c.pred === "named" || /^has_/.test(c.pred) || DEG.test(c.pred)) continue;
    const full = S.some((s) => (s.args ?? []).length >= cargs.length && predMeet(c.pred, s.pred) && argsMeet(cargs, s.args));
    if (full) continue;
    const role = S.find((s) => (s.args ?? []).length >= cargs.length && !predMeet(c.pred, s.pred) && argsMeet(cargs, s.args));
    const dir = S.find((s) => (s.args ?? []).length >= cargs.length && predMeet(c.pred, s.pred) && argsMeet([...cargs].reverse(), s.args));
    if (role) out.push({ kind: "role", claim: c.text, source: role.text }); else if (dir) out.push({ kind: "direction", claim: c.text, source: dir.text });
  }
  return out;
}
export function atomSupport(C0, S, { claimLang = "en", sourceLang = "en", same = null, keysOf = null, unread = [] } = {}) {
  const C = canonical(C0);
  const { wordMeet, refMeet, predMeet, predWords, argsMeet, standing } = meeters(C, S, { claimLang, sourceLang, same, keysOf });
  const table = [];
  for (const c of C) {
    const cargs = c.args ?? [];
    let by = null, contra = null;
    // a one-place fact from a word of the referent's own name ("lago Menor" → menor) identifies it, and is not a further claim
    if (cargs.length === 1) { const w = predWords(c.pred).at(-1), t = argText(cargs[0]); if (w && new RegExp(`(^|\\s)\\p{Lu}`, "u").test(t) && words(t).some((x) => stem(x) === stem(w)) && /\p{Lu}/u.test(t.split(/\s+/).find((x) => stem(x) === stem(w)) ?? "")) { table.push({ atom: c, state: "met", by: null, identifying: true }); continue; } }
    for (const s of S) {
      const sargs = s.args ?? []; if (sargs.length < cargs.length) continue;
      if (otherYears(c, s)) continue;
      if (cargs.length === 1) {
        // a one-place fact: the same adjective on the same referent, or a source referent whose words carry it
        if (sargs.length === 1 && predMeet(c.pred, s.pred) && refMeet(cargs[0], sargs[0])) { if (!!c.neg === !!s.neg) { if (standing(c, s)) { by = s; break; } continue; } if (!s.hedged) contra ??= s; continue; }
        const w = predWords(c.pred).at(-1);
        if (w && !DEG.test(c.pred) && standing(c, s) && sargs.some((a) => refMeet(cargs[0], a) && words(argText(a)).some((x) => wordMeet(w, x)))) { by = s; break; }
        continue;
      }
      if (!predMeet(c.pred, s.pred)) continue;
      if (!argsMeet(cargs, sargs)) continue;
      if (!!c.neg !== !!s.neg) { if (!s.hedged) contra ??= s; continue; }
      if (!standing(c, s)) continue;
      by = s; break;
    }
    table.push({ atom: c, state: by ? "met" : contra ? "contradicted" : "unmet", by: by ?? contra ?? null });
  }
  const verdict = !table.length ? "N" : table.some((t) => t.state === "contradicted") ? "C" : table.every((t) => t.state === "met") && !unread.length ? "E" : "N";
  return { verdict, table, unread };
}
