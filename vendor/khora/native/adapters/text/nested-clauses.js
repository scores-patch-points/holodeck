// adapters/text/nested-clauses.js — CLAUSES AS A TREE, from a dependency parse.  (2026-10-14)
//
// "Human language is a series of nested propositions of increasing abstraction — clause, sentence, paragraph, section,
// etc. — each itself a GFP, each drillable and collapsible." (the user, 2026-09-23, clause-spans.js). The reader kept the
// first half of that: clause-spans.js cuts a sentence into a TREE of clause spans — and relations-gfp.js:94 then flattens
// it into a list of windows, so "my grandmother said that the storm took the roof because the nails were old" arrives as
// edges with no memory that one clause is the content of another. The record needs the nesting: what she SAID is not
// something that happened, it is the object of her saying.
//
// Handle: Chomsky — the arrangement is universal, a language's grammar is the cube's cells worn by its surfaces. The
// clause is a universal unit; what is language-specific is which dependency relations mark one clause inside another.
// Those are Universal Dependencies' own clausal relations, so this module reads any UD-annotated language (the English
// parser, adapters/text/english-parser.js, is the one in the house today; a treebank's gold rows work identically).
//
//   clausesOf(rows) → [{ id, head, parent, relation, marker, depth, subject, predicate, object, complement, own, tokens }]
//     rows   UD rows of ONE sentence: { id (1-based), form, upos, head, deprel, feats?, start?, end? }
//
// A CLAUSE is a predicate head with its own argument structure: a token that has a subject (nsubj, nsubj:pass, csubj,
// expl) or a copula, or the sentence root when it is verbal. Its PARENT is the nearest clause head above it; the RELATION is
// the dependency that attaches it (ccomp, xcomp, advcl, acl, acl:relcl, csubj, parataxis, conj, root). `own` are the
// tokens that belong to this clause and to no clause beneath it — the clause proper, so a sentence's text is the union of
// its clauses' own tokens and nothing is counted twice.
//
// What this does NOT claim: that the parse is right (it is the parser's; `clausesOf` is exactly as good as its rows —
// nested-clauses.test.js measures that on held-out gold), or that semantics are resolved (a relative clause's gap is named
// by its relative pronoun, not resolved to its antecedent).

/** The dependency relations that attach a CLAUSE to something else. `:` subtypes are folded onto their base. */
export const CLAUSAL = Object.freeze({
  root: "root", ccomp: "complement", xcomp: "open-complement", csubj: "subject-clause", advcl: "adverbial",
  acl: "adnominal", "acl:relcl": "relative", parataxis: "parataxis", conj: "coordinate", list: "list", appos: "apposition",
});
const SUBJECT = new Set(["nsubj", "nsubj:pass", "csubj", "csubj:pass", "expl", "nsubj:outer"]);
const OBJECT = new Set(["obj", "iobj", "dobj"]);
const NEG_LEMMA = new Set(["not", "n't", "n’t", "never", "no", "none", "nobody", "nothing", "nowhere", "neither", "nor", "cannot"]);

const base = (d) => String(d ?? "").split(":")[0];

/** Sentence rows → the clause tree. Pure. */
export function clausesOf(rows) {
  const tok = new Map(rows.map((r) => [r.id, r]));
  const kids = new Map(); for (const r of rows) { if (!kids.has(r.head)) kids.set(r.head, []); kids.get(r.head).push(r); }
  const isHead = (r) => {
    if (r.upos === "PUNCT") return false;
    const ch = kids.get(r.id) ?? [];
    const hasSubj = ch.some((c) => SUBJECT.has(c.deprel) || SUBJECT.has(base(c.deprel)));
    const hasCop = ch.some((c) => c.deprel === "cop");
    if (hasSubj || hasCop) return true;
    if (r.deprel === "root" && (r.upos === "VERB" || r.upos === "AUX")) return true;         // an imperative / subjectless root
    if (["ccomp", "xcomp", "advcl", "acl", "acl:relcl", "csubj", "parataxis"].includes(r.deprel) && (r.upos === "VERB" || r.upos === "AUX")) return true;
    return false;
  };
  const heads = rows.filter(isHead);
  const headIds = new Set(heads.map((h) => h.id));
  const parentOf = (id) => { let h = tok.get(id)?.head; const seen = new Set(); while (h && h !== 0 && !seen.has(h)) { if (headIds.has(h)) return h; seen.add(h); h = tok.get(h)?.head; } return null; };

  // which clause head does each token belong to? (nearest clause head at or above it)
  const owner = new Map();
  const ownerOf = (id) => {
    if (owner.has(id)) return owner.get(id);
    let cur = id, guard = 0; const chain = [];
    while (cur && guard++ < 200) {
      if (headIds.has(cur)) { owner.set(id, cur); return cur; }
      chain.push(cur); cur = tok.get(cur)?.head;
    }
    owner.set(id, null); return null;
  };
  const span = (ids) => { const rs = ids.map((i) => tok.get(i)).filter(Boolean).sort((a, b) => a.id - b.id); return rs.length ? rs : []; };
  const text = (rs) => rs.map((r) => r.form).join(" ").replace(/\s+([,.;:!?)])/g, "$1").replace(/([(])\s+/g, "$1");
  const subtree = (id) => { const out = []; const stack = [id]; while (stack.length) { const x = stack.pop(); out.push(x); for (const c of kids.get(x) ?? []) stack.push(c.id); } return out; };

  const clauseOf = new Map(heads.map((h, i) => [h.id, `c${i}`]));
  const out = heads.map((h) => {
    const ch = kids.get(h.id) ?? [];
    const id = clauseOf.get(h.id);
    const pid = parentOf(h.id);
    // the clause's own tokens: its subtree minus the subtrees of clause heads beneath it
    const nested = new Set(); for (const c of heads) if (c.id !== h.id && parentOf(c.id) === h.id) for (const t of subtree(c.id)) nested.add(t);
    const ownIds = subtree(h.id).filter((t) => !nested.has(t));
    const own = span(ownIds).filter((r) => r.upos !== "PUNCT");
    const argOf = (c) => { const ids = subtree(c.id).filter((t) => !nested.has(t)); const rs = span(ids).filter((r) => r.upos !== "PUNCT"); return { head: c.form, text: text(rs), start: rs[0]?.start ?? null, end: rs.length ? rs[rs.length - 1].end ?? null : null }; };
    const subj = ch.find((c) => SUBJECT.has(c.deprel) || SUBJECT.has(base(c.deprel)));
    const obj = ch.find((c) => OBJECT.has(c.deprel));
    const mark = ch.find((c) => c.deprel === "mark" || c.deprel === "cc" && false);
    const whAdv = ch.find((c) => c.deprel === "advmod" && /^(when|where|while|whenever|wherever|how|why|before|after|until|since|once|as)$/i.test(c.form));
    const relPro = subj && /^(who|whom|whose|which|that)$/i.test(subj.form) ? subj : ch.find((c) => OBJECT.has(c.deprel) && /^(who|whom|whose|which|that)$/i.test(c.form)) ?? null;
    const aux = ch.filter((c) => c.deprel === "aux" || c.deprel === "aux:pass" || c.deprel === "cop").sort((a, b) => a.id - b.id);
    const neg = [h, ...ch].some((c) => (c.deprel === "advmod" || c.deprel === "det" || c.deprel === "nsubj" || c === h || c.deprel === "advmod:neg") && NEG_LEMMA.has(String(c.lemma ?? c.form).toLowerCase())) || ch.some((c) => c.deprel === "advmod" && NEG_LEMMA.has(String(c.form).toLowerCase()));
    const compl = heads.filter((c) => parentOf(c.id) === h.id && (c.deprel === "ccomp" || c.deprel === "xcomp" || c.deprel === "csubj")).map((c) => clauseOf.get(c.id));
    const depth = (() => { let d = 0, p = pid; while (p) { d++; p = parentOf(p); } return d; })();
    const predText = text([...aux, h].sort((a, b) => a.id - b.id));
    return {
      id, head: h.id, parent: pid ? clauseOf.get(pid) : null,
      relation: base(h.deprel) === "root" ? "root" : (CLAUSAL[h.deprel] ?? CLAUSAL[base(h.deprel)] ?? base(h.deprel)),
      deprel: h.deprel,
      marker: mark ? mark.form : whAdv ? whAdv.form : relPro ? relPro.form : null,
      depth, polarity: neg ? "-" : "+",
      subject: subj ? argOf(subj) : null,
      predicate: { head: h.form, lemma: h.lemma ?? null, text: predText, upos: h.upos },
      object: obj ? argOf(obj) : null,
      complement: compl,
      own: { text: text(own), tokens: own.map((r) => r.id), start: own[0]?.start ?? null, end: own.length ? own[own.length - 1].end ?? null : null },
      tokens: subtree(h.id).length,
    };
  });
  return out;
}

/** The triples a clause tree commits to — what a held-out gold comparison scores: (clause head token, parent head token, relation). */
export function treeTriples(rows) {
  const cl = clausesOf(rows); const byId = new Map(cl.map((c) => [c.id, c]));
  return cl.map((c) => `${c.head}\u0000${c.parent ? byId.get(c.parent).head : 0}\u0000${c.relation}`);
}

/** A tree's shape, for a collapsible view: { id, relation, marker, text, children: [...] } roots first. */
export function clauseTree(clauses) {
  const node = new Map(clauses.map((c) => [c.id, { id: c.id, relation: c.relation, marker: c.marker, polarity: c.polarity, text: c.own.text, subject: c.subject?.text ?? null, predicate: c.predicate.text, object: c.object?.text ?? null, children: [] }]));
  const roots = [];
  for (const c of clauses) (c.parent ? node.get(c.parent).children : roots).push(node.get(c.id));
  return roots;
}
