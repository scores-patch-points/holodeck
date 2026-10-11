// the-fold/weft.js — THE WEFT: the reading log. The append-only record of reading PASSES (one per document
// read), each pass ADDRESSED (SidecarRead@2: a byte anchor per mention, a byteOffset per relation), from
// which the holograph — the cloth — is projected at a cursor and re-expanded by address.
//
// THE NAME (native/docs/THE-SPINE.md): the warp is the received structure (priors, grammar, schema); the
// WEFT is the log (the readings, appended pass by pass); the cloth is the holograph; the loom is generation
// (penelope). "His scars are her weft." The thread this system grew from began here: read a thing, keep the
// log — and the log is what the holograph is projected from.
//
// THREE PROPERTIES, the holograph's (THE-HOLOGRAPH.md §1), made real over the weft:
//   · every part points at the whole — each holon carries a permanent address (`<source>#<byteOffset>`);
//   · abstraction compresses — a holon stands in for its material, re-expandable by address;
//   · the consumer never gets the addresses — `mouthFacing` strikes them (the shadow).
//
// PURE. No I/O, no model. `appendPass` is IMMUTABLE (a new weft; P1). `clothAt` folds at a cursor (P3).
// `reopen` takes a byte address and a bytes-lookup the CALLER injects — this module never reads a file.
const freeze = Object.freeze;

export const WEFT_ENTRY_SCHEMA = "WeftEntry@1";
export const WEFT_SCHEMA = "Weft@1";

/** An empty weft — a frozen list of passes. Never mutated. */
export const emptyWeft = () => Object.freeze([]);

/** Append a reading pass (immutable; P1). Returns a NEW weft. A pass is a SidecarRead@2-shaped reading. */
export function appendPass(weft, pass) {
  if (pass == null || typeof pass !== "object") throw new TypeError("weft: a pass must be an object");
  const address = pass.address ?? pass.source ?? null;
  if (!address) throw new TypeError("weft: a pass must carry an address");
  const seq = weft.length;
  return Object.freeze([...weft, Object.freeze({ schema: WEFT_ENTRY_SCHEMA, seq, ...pass, address })]);
}

/** The permanent address of a byte position in a source: `<source>#<byteOffset>` (the format the record renders). */
export const holonAddress = (source, byteOffset) => (Number.isFinite(byteOffset) ? `${source}#${byteOffset}` : null);

/** Fold the weft at a cursor (P3) into the CLOTH: the holograph's holons, each carrying its address.
 *  referents dedup by `ref` across passes (a being seen in many reads is one holon with many addresses);
 *  relations dedup by (relation + participant surfaces). asOf is a pass-index cursor (default: the end). */
export function clothAt(weft, { asOf = Infinity } = {}) {
  const referents = new Map();
  const relations = new Map();
  let passes = 0;
  for (const pass of weft) {
    if (pass.seq > asOf) break;
    passes += 1;
    for (const c of pass.cast ?? []) {
      const ref = c.ref ?? c.surface;
      if (!ref || !c.surface) continue;
      if (!referents.has(ref)) referents.set(ref, { ref, surfaces: new Set(), mentionsAt: [], address: null });
      const r = referents.get(ref);
      r.surfaces.add(c.surface);
      for (const at of c.mentionsAt ?? []) { r.mentionsAt.push(at); if (!r.address) r.address = holonAddress(pass.address, at); }
      if (!r.address) r.address = holonAddress(pass.address, 0);
    }
    for (const rel of pass.relations ?? []) {
      const parts = (rel.participants ?? []).map((p) => p?.surface).filter(Boolean);
      if (parts.length < 2) continue;
      const key = `${rel.relation}|${parts.join("|")}`;
      if (relations.has(key)) continue;
      const at = rel.at ?? rel.scope?.byteOffset;
      relations.set(key, { relation: rel.relation, participants: parts, address: holonAddress(pass.address, at), standing: (rel.participants ?? []).every((p) => p?.standing === "referent") ? "referent" : "mixed" });
    }
  }
  return freeze({
    schema: "Cloth@1",
    at: asOf === Infinity ? "end" : asOf,
    passes,
    referents: freeze([...referents.values()].map((r) => freeze({ ref: r.ref, surfaces: freeze([...r.surfaces]), mentionsAt: freeze([...r.mentionsAt]), address: r.address }))),
    relations: freeze([...relations.values()].map(freeze)),
  });
}

/** Re-expand a holon address to the verbatim bytes at it. `read(source)` returns the source's bytes (string
 *  or Buffer) — INJECTED; this module never touches disk. Returns { address, at, text } or a typed gap. */
export function reopen(address, { read = null, span = 160 } = {}) {
  if (typeof address !== "string" || !address.includes("#")) return { gap: "not_an_address", address: address ?? null };
  const i = address.lastIndexOf("#");
  const source = address.slice(0, i); const at = Number(address.slice(i + 1));
  if (!Number.isFinite(at)) return { gap: "address_has_no_offset", address, source };
  if (typeof read !== "function") return { gap: "no_reader_injected", address, source, at };
  const raw = read(source);
  if (raw == null) return { gap: "source_unreadable", address, source, at };
  const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw), "utf8");
  if (at < 0 || at > buf.length) return { gap: "address_out_of_range", address, source, at, bytes: buf.length };
  return { address, source, at, text: buf.slice(at, Math.min(buf.length, at + span)).toString("utf8") };
}

/** The SHADOW of the cloth: every address struck, so it can be handed to a mouth (THE-HOLOGRAPH.md §1, prop 3;
 *  firewall.js::mouthFacing is the same rule for prompt text). Names survive; addresses do not. */
export function mouthFacing(cloth) {
  return freeze({
    schema: "ClothShadow@1",
    referents: freeze(cloth.referents.map((r) => freeze({ ref: r.ref, surfaces: r.surfaces }))),
    relations: freeze(cloth.relations.map((r) => freeze({ relation: r.relation, participants: r.participants, standing: r.standing }))),
  });
}

export const WEFT_ATTESTATION_SCHEMA = "WeftAttestation@1";

/** THE SEAM the ruliad consumes. One ATTESTATION per relation the reading saw: its ends, its label, and its
 *  ADDRESS (`<source>#<byteOffset>`). The ruliad (the hyperlexicon generator, janus) folds this stream into
 *  composition affordances whose `witnesses` are these addresses — every field row points back into the weft.
 *  Both sides call THIS generator; the ruliad never re-parses the weft (one parser, no duplicate organs).
 *  The weft stays KIND-FREE: it supplies surfaces/refs/addresses; the ruliad owns the kinds and the field. */
export function* weftAttestations(weft, { asOf = Infinity } = {}) {
  for (const pass of weft) {
    if (Number.isFinite(pass.seq) && pass.seq > asOf) break;
    for (const rel of pass.relations ?? []) {
      const parts = rel.participants ?? [];
      if (parts.length < 2 || !rel.relation) continue;
      const at = rel.at ?? rel.scope?.byteOffset;
      yield {
        schema: WEFT_ATTESTATION_SCHEMA,
        witness: holonAddress(pass.address, at),
        source: pass.address,
        at: Number.isFinite(at) ? at : null,
        category: pass.category ?? null,
        label: rel.relation,
        left: { ref: parts[0]?.ref ?? null, surface: parts[0]?.surface ?? null, standing: parts[0]?.standing ?? null },
        right: { ref: parts[1]?.ref ?? null, surface: parts[1]?.surface ?? null, standing: parts[1]?.standing ?? null },
      };
    }
    // the REAL reader's shape: engineRelationsFor edges (end1/label/end2 + refs/spans/assertion).
    for (const edge of pass.edges ?? []) {
      if (!edge?.label || !edge.end1 || !edge.end2) continue;
      const s0 = edge.spans?.[0];
      const at = Number.isFinite(s0?.start) ? s0.start : null;
      yield {
        schema: WEFT_ATTESTATION_SCHEMA,
        witness: edge.refs?.[0] ?? holonAddress(pass.address, at),
        source: pass.address,
        at,
        category: pass.category ?? null,
        label: edge.label,
        left: { ref: null, surface: edge.end1Face ?? edge.end1, standing: "referent" },
        right: { ref: null, surface: edge.end2Face ?? edge.end2, standing: "referent" },
      };
    }
  }
}

export const WEFT_REFERENTS_SCHEMA = "WeftReferents@2";

/** THE @2 SEAM janus asked for (janus/KIND-INDUCTION-REPLY.md): per-REFERENT records for kind induction, folded
 *  at a cursor. Yields `{ ref, surfaces, mentionsAt, passes, company }` where COMPANY is a `Map<otherRef,count>`
 *  — **company only, never content** — over BOTH-BOUND relations (`standing:"referent"` on every end). `passes`
 *  is the number of weft passes the referent appears in. Additive to `weftAttestations`; the weft stays
 *  kind-free — the consumer induces kinds from `company` (company-induced, never taught). Pure; generator; `asOf`
 *  is a pass-seq cursor (P3), so kinds re-key without erasing. */
const refKey = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function* weftReferents(weft, { asOf = Infinity } = {}) {
  const byRef = new Map();
  const ensure = (ref) => { if (!byRef.has(ref)) byRef.set(ref, { ref, surfaces: new Set(), mentionsAt: [], passes: 0, company: new Map() }); return byRef.get(ref); };
  for (const pass of weft) {
    if (Number.isFinite(pass.seq) && pass.seq > asOf) break;
    const seen = new Set();
    const hasCast = Array.isArray(pass.cast) && pass.cast.length > 0;
    const castBySurface = new Map();   // refKey(surface) -> cast ref (the admitted beings)
    for (const c of pass.cast ?? []) {
      const ref = c?.ref ?? c?.surface; if (!ref) continue;
      const r = ensure(ref);
      if (c.surface) { r.surfaces.add(c.surface); castBySurface.set(refKey(c.surface), ref); }
      for (const s of c.allSurfaces ?? []) { r.surfaces.add(s); castBySurface.set(refKey(s), ref); }
      for (const at of c.mentionsAt ?? []) r.mentionsAt.push(at);
      if (!seen.has(ref)) { seen.add(ref); r.passes += 1; }
    }
    for (const rel of pass.relations ?? []) {
      const parts = rel.participants ?? [];
      if (parts.length < 2 || !rel.relation) continue;
      if (!parts.every((p) => p?.standing === "referent" && p?.ref)) continue;   // both-bound only
      for (let i = 0; i < parts.length; i += 1) {
        const self = parts[i]?.ref; const other = parts[1 - i]?.ref ?? parts[(i + 1) % parts.length]?.ref;
        if (!self || !other || self === other) continue;
        const r = ensure(self);
        r.company.set(String(other), (r.company.get(String(other)) ?? 0) + 1);
      }
    }
    // edges — company between BEINGS. When the pass carries a `cast` (WeftEntry@3+), only ends that
    // resolve to admitted referents join (the reader's own cast; common nouns are NOT beings). A pass
    // without a cast (legacy WeftEntry@2) falls back to treating the ends as the referents, disclosed.
    for (const edge of pass.edges ?? []) {
      const A = edge?.end1Face ?? edge?.end1, B = edge?.end2Face ?? edge?.end2;
      if (!A || !B) continue;
      let a, b;
      if (hasCast) { a = castBySurface.get(refKey(A)); b = castBySurface.get(refKey(B)); if (!a || !b) continue; }
      else { a = A; b = B; for (const s of [a, b]) { const r = ensure(s); r.surfaces.add(s); if (!seen.has(s)) { seen.add(s); r.passes += 1; } } }
      if (a !== b) { ensure(a).company.set(String(b), (ensure(a).company.get(String(b)) ?? 0) + 1); ensure(b).company.set(String(a), (ensure(b).company.get(String(a)) ?? 0) + 1); }
    }
  }
  for (const r of byRef.values()) {
    const company = {}; for (const [k, v] of r.company) company[k] = v;
    yield freeze({ schema: WEFT_REFERENTS_SCHEMA, ref: r.ref, surfaces: freeze([...r.surfaces]), mentionsAt: freeze([...new Set(r.mentionsAt)].sort((a, b) => a - b)), passes: r.passes, company: freeze(company) });
  }
}

export const WEFT = Object.freeze({ schema: WEFT_SCHEMA, note: "the reading log; the holograph is its cloth, projected at a cursor and re-expanded by address. Its attestations (weftAttestations) and referents (weftReferents, the @2 kind-induction seam) are what the ruliad/hyperlexicon folds (THE-SPINE.md, THE-HOLOGRAPH.md)." });
