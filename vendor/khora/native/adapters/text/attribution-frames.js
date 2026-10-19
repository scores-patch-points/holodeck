// attribution-frames.js — WHO IS SAYING WHAT, to any depth.
//
// attribution.js (the older organ) answers "who is speaking" at depth 0, 1 or 2: a narration frame and one embedded quotation,
// `via` empty. A text does not stop there. Frankenstein is Walton's letters containing Victor's telling containing the creature's;
// a 1912 Senate speech is Smith relating what Ismay said Andrews told him the officer saw. This organ makes the chain unbounded.
//
// A FRAME is a stretch of text held WITHIN someone's saying (a DEF: what holds within a frame). It has
//   · a SPEAKER — the span of the token that names or stands for who says it (resolved to a being by the log, never here);
//   · a CONTENT span — what is said, as the bytes carry it;
//   · a PARENT — the smallest other frame whose content contains it, or none (the root: the source's own voice).
// Nesting is by REFERENCE, not by slot: a frame's parent is another frame, so depth is however long the chain is. Every walk here is
// iterative over explicit stacks — no recursion — so a chain ten thousand frames deep neither overflows nor is cut off.
//
// THREE ways text puts words in a mouth, each derived from the bytes or from a structure, none from a list of speech verbs:
//   quotation     “…”  and  ‘…’ nested to any depth (a stack, not a regex); a straight " toggles but cannot nest.
//   report        X VERB (him|her|them)? that <clause> — the complementizer "that" after a verb, with a clause after it. The scope runs
//                 to the end of the sentence (or of the enclosing quote), so reports are right-branching; said so in `scope`.
//   according-to  "according to X," — a closed construction of the language, not a verb list.
// A speaker is only ever a token that IS a mention (the reading admitted it) or a personal pronoun; a quote nobody tags is `speaker:null`
// with a typed gap — an unowned line is an honest result, and inventing a speaker is worse.
//
// WHAT THIS DOES NOT DO. It does not decide that what is said is TRUE, or that the one who relays it believes it. Nesting's wall:
// witnesses of "X says P" never corroborate P. A frame says WHO holds a sentence within their saying; it is never evidence for the sentence.
const OPEN_D = "“", CLOSE_D = "”", OPEN_S = "‘", CLOSE_S = "’";
const PRONOUNS = new Set("i we he she they you".split(" "));
const TOKEN = /[\p{L}\p{N}][\p{L}\p{N}'’\-]*/gu;

const sentenceEnd = (text, from) => {
  const re = /[.!?](?=\s|$|[”’"])/g; re.lastIndex = from;
  const m = re.exec(text); return m ? m.index + 1 : text.length;
};

/**
 * @param {string} text
 * @param {{isVerb: (w:string)=>boolean, mentionAt?: (s:number,e:number,w:string)=>boolean, offset?: number}} opts
 * @returns {{frames: Array, gaps: Array, unclosed: number}}
 */
export function findFrames(text, { isVerb, mentionAt = null, offset = 0 } = {}) {
  if (typeof isVerb !== "function") throw new TypeError("findFrames: the verb prior is injected — this organ keeps no list of speech verbs");
  const src = String(text ?? "");
  const isMention = mentionAt ?? ((s, e, w) => /^\p{Lu}/u.test(w) || PRONOUNS.has(w.toLowerCase()));
  const toks = [...src.matchAll(TOKEN)].map((m) => ({ w: m[0], s: m.index, e: m.index + m[0].length }));
  const tokAt = new Map(toks.map((t, i) => [t.s, i]));
  const frames = [], gaps = [];

  // ── quotations: a STACK, so nesting has no depth ──
  const stack = []; let straightOpen = -1; let unclosed = 0;
  const quotes = [];
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === OPEN_D) stack.push({ k: "d", s: i });
    else if (ch === CLOSE_D) { let top; while ((top = stack.pop())) { if (top.k === "d") { quotes.push({ s: top.s, e: i + 1, depth: stack.length }); break; } unclosed++; } }
    else if (ch === OPEN_S && (i === 0 || !/[\p{L}\p{N}]/u.test(src[i - 1]))) stack.push({ k: "s", s: i });
    else if (ch === CLOSE_S && !/[\p{L}\p{N}]/u.test(src[i + 1] ?? " ") && stack.some((x) => x.k === "s")) { let top; while ((top = stack.pop())) { if (top.k === "s") { quotes.push({ s: top.s, e: i + 1, depth: stack.length }); break; } unclosed++; } }
    else if (ch === '"') { if (straightOpen < 0) straightOpen = i; else { quotes.push({ s: straightOpen, e: i + 1, depth: stack.length }); straightOpen = -1; } }
  }
  for (const x of stack) { quotes.push({ s: x.s, e: src.length, depth: 0, unclosed: true }); unclosed++; }
  const quoteContaining = (pos) => { let best = null; for (const q of quotes) if (q.s < pos && pos < q.e && (!best || q.e - q.s < best.e - best.s)) best = q; return best; };

  // the speaker tag beside a quotation: "…," said Clerval   /   Clerval said, "…"
  const tokensBetween = (a, b) => toks.filter((t) => t.s >= a && t.e <= b);
  for (const q of quotes) {
    const parentQ = quoteContaining(q.s + 0); // enclosing quote, if any
    const lo = parentQ ? parentQ.s + 1 : 0, hi = parentQ ? parentQ.e - 1 : src.length;
    const after = tokensBetween(q.e, Math.min(hi, q.e + 90)).slice(0, 4), before = tokensBetween(Math.max(lo, q.s - 90), q.s).slice(-4);
    let spk = null, verb = null, form = null;
    for (let i = 0; i + 1 < after.length && !spk; i++) if (isVerb(after[i].w) && isMention(after[i + 1].s, after[i + 1].e, after[i + 1].w)) { spk = after[i + 1]; verb = after[i]; form = "verb-then-name"; }
    for (let i = 0; i + 1 < before.length && !spk; i++) if (isMention(before[i].s, before[i].e, before[i].w) && isVerb(before[i + 1].w)) { spk = before[i]; verb = before[i + 1]; form = "name-then-verb"; }
    frames.push({ form: "quotation", at: [q.s, q.e], content: [q.s + 1, Math.max(q.s + 1, q.e - (q.unclosed ? 0 : 1))], speakerAt: spk ? [spk.s, spk.e] : null, speakerText: spk ? spk.w : null, verb: verb ? verb.w : null, verbAt: verb ? [verb.s, verb.e] : null, scope: "within-the-marks", unclosed: !!q.unclosed, basis: spk ? `the quotation marks are the bytes' own convention; the tag ${form}` : "the quotation marks are the bytes' own convention; no mention stands beside a verb at either boundary" });
    if (!spk) gaps.push({ type: "attribution_unwitnessed", at: [q.s, q.e], detail: "an unowned quotation — left unowned" });
  }

  // ── reports: X VERB (him|her|them|Y)? that <clause> — found from each "that", looking back ──
  const OBJ = new Set(["him", "her", "them", "me", "us", "you"]);
  for (let t = 0; t < toks.length; t++) {
    if (toks[t].w.toLowerCase() !== "that") continue;
    let vb = toks[t - 1], subj = toks[t - 2];
    // SUBJ VERB OBJ that: the thing before "that" is an object, the verb and subject sit before it
    if (vb && !isVerb(vb.w) && toks[t - 3] && (OBJ.has(vb.w.toLowerCase()) || PRONOUNS.has(vb.w.toLowerCase()) || isMention(vb.s, vb.e, vb.w))) { vb = toks[t - 2]; subj = toks[t - 3]; }
    if (!vb || !subj || !isVerb(vb.w) || !isMention(subj.s, subj.e, subj.w)) continue;
    // a clause must follow: within the next few tokens, a verb
    if (!toks.slice(t + 1, t + 6).some((x) => isVerb(x.w))) continue;
    const th = toks[t], q = quoteContaining(th.e);
    const end = Math.min(sentenceEnd(src, th.e), q ? q.e - 1 : src.length);
    frames.push({ form: "report", at: [subj.s, end], content: [th.e, end], speakerAt: [subj.s, subj.e], speakerText: subj.w, verb: vb.w, verbAt: [vb.s, vb.e], scope: "to-the-end-of-the-sentence", basis: `${subj.w} ${vb.w} … that + a clause: a report; its scope runs to the end of the sentence (right-branching — a coordinated second report would nest inside it)` });
  }

  // ── according to X, ──
  for (let i = 0; i + 2 < toks.length; i++) {
    if (toks[i].w.toLowerCase() === "according" && toks[i + 1].w.toLowerCase() === "to" && isMention(toks[i + 2].s, toks[i + 2].e, toks[i + 2].w)) {
      const sp = toks[i + 2]; const comma = src.indexOf(",", sp.e); const startC = comma >= 0 && comma - sp.e < 40 ? comma + 1 : sp.e; const end = sentenceEnd(src, sp.e);
      frames.push({ form: "according-to", at: [toks[i].s, end], content: [startC, end], speakerAt: [sp.s, sp.e], speakerText: sp.w, verb: null, verbAt: null, scope: "to-the-end-of-the-sentence", basis: "“according to X” — a closed construction of the language, not a verb list" });
    }
  }

  // ── PARENTS by containment: the smallest other frame whose CONTENT holds this one's start. Iterative (a sweep), never recursive. ──
  const order = frames.map((f, i) => i).sort((a, b) => frames[a].at[0] - frames[b].at[0] || (frames[b].at[1] - frames[b].at[0]) - (frames[a].at[1] - frames[a].at[0]));
  const open = [];
  for (const i of order) {
    const f = frames[i];
    while (open.length && !(frames[open[open.length - 1]].content[0] <= f.at[0] && f.at[0] < frames[open[open.length - 1]].content[1])) open.pop();
    f.parent = open.length ? open[open.length - 1] : null;
    f.depth = f.parent == null ? 1 : frames[f.parent].depth + 1;
    open.push(i);
  }
  frames.forEach((f, i) => { f.idx = i; f.at = f.at.map((x) => x + offset); f.content = f.content.map((x) => x + offset); if (f.speakerAt) f.speakerAt = f.speakerAt.map((x) => x + offset); if (f.verbAt) f.verbAt = f.verbAt.map((x) => x + offset); });
  return { frames, gaps, unclosed };
}

/**
 * The voices holding a position, innermost first, ending at the source's own voice. Iterative; guards a cycle (a person's own edit could
 * make one) and reports it instead of looping.
 * @param {Map<string, object>} frames  id -> { id, parent, speaker, contentAt, ... }
 */
export function voicesAt(frames, offset, source = null) {
  let best = null;
  for (const f of frames.values()) {
    if (source && f.source && f.source !== source) continue;
    if (f.contentAt[0] <= offset && offset < f.contentAt[1] && (!best || (f.contentAt[1] - f.contentAt[0]) < (best.contentAt[1] - best.contentAt[0]) || ((f.contentAt[1] - f.contentAt[0]) === (best.contentAt[1] - best.contentAt[0]) && (f.depth ?? 0) > (best.depth ?? 0)))) best = f;
  }
  const chain = []; const seen = new Set(); let cur = best, truncated = null;
  while (cur) { if (seen.has(cur.id)) { truncated = "cycle"; break; } seen.add(cur.id); chain.push(cur); cur = cur.parent ? frames.get(cur.parent) ?? null : null; }
  return { chain, depth: chain.length, truncated };
}
