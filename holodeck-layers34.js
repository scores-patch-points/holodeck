// holodeck-layers34.js — khora's LAYER 3 (cast-identity: what counts as one thing) and LAYER 4 (the attention binder: what "it" and
// "the tower" point to), as two OPT-IN switches of the Ask. Both are OFF unless asked; with both off nothing here runs and the page is
// byte-identical to the page without this file (test: holodeck-layers34.test.mjs).
//
//   switches:  ?castIdentity=1   (or localStorage hd:castIdentity = "1")   the reader repairs the cast (read-core readWith option)
//              ?binder=1         (or localStorage hd:binder = "1")         the attention binder's bindings are used by the Ask
//              ?binderShuffle=N  the CONTROL: the bound referents are permuted among the bindings (seeded), the gaps are left alone
//
// What the binder gives back is a binding (a referent for a sentence-initial neuter pronoun or definite description) or a TYPED GAP
// (description_off_topic, pronoun_no_margin, center_elsewhere, ...). A gap stays a gap here: it is kept on the statement under its
// reason and never turned into a name. No word list is written in this file; the dials are the ones the binder's own scorer declared.
import { attendedBindingsFor } from './vendor/khora/native/adapters/text/attention-switch.js';

// the binder's declared dials (khora eval/attention/score5.mjs DECLARED at a8302ab), unchanged. `nonPersonal` is not passed: the page has
// no lexicon giver on this machine, so the binder rules by the text's own evidence (ruling: "text_evidence") and says so.
export const BINDER_DIALS = Object.freeze({ window: 12, minActivation: 0.5, minMargin: 0.2, boost: 2, feed: true, centerVeto: true, clauseMateVeto: false,
  minWordShare: 0.25, carryVeto: true, expletiveVeto: true, demonstrativeSubject: true, causalWords: true,
  lineStarts: true, npHead: true, tieResolve: true, foldPlural: true, neverSilent: true, contextMinUses: 2,
  bearerShare: 0.2, weakRouteCarry: false, centerRivalShare: null, openerReset: false, capitalTargets: true });

/** The switches, read from the address and storage; both false when nothing asks. `loc`/`store` are injectable for tests. */
export function layerSwitches(loc = (typeof location !== 'undefined' ? location : null), store = (() => { try { return localStorage; } catch (e) { return null; } })()) {
  const q = new URLSearchParams((loc && loc.search) || '');
  const on = (k) => { const v = q.get(k); if (v !== null) return v === '1' || v === 'true'; try { const s = store && store.getItem('hd:' + k); return s === '1' || s === 'true'; } catch (e) { return false; } };
  const sh = q.get('binderShuffle');
  return { castIdentity: on('castIdentity'), binder: on('binder'), shuffle: sh !== null && /^\d+$/.test(sh) ? Number(sh) : null };
}

/** In the reading worker: the binder's answer over one master reading (WeftEntry@4), as plain data. null when the binder is not asked. */
export function attendedOf(entry, enabled) {
  if (enabled !== true) return null;
  const r = attendedBindingsFor(entry, { enabled: true, ...BINDER_DIALS });
  if (!r) return null;
  const surf = new Map((entry.cast || []).map((c) => [c.ref, c.surface || (c.allSurfaces || [])[0] || null]));
  return {
    ruling: r.ruling || null,
    bindings: (r.bindings || []).map((b) => ({ at: b.at, kind: b.kind, via: b.via ?? null, activation: b.activation ?? null, margin: b.margin ?? null, surface: b.surface ?? null, ref: b.referentId, referent: surf.get(b.referentId) || null })),
    gaps: (r.gaps || []).map((g) => ({ at: g.at, reason: g.reason, surface: g.surface ?? null, kind: g.kind ?? null, sentenceOrder: g.sentenceOrder ?? null })),
  };
}

function mulberry(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// the CONTROL: the same bindings with their referents permuted among them (seeded). Same count, same places, wrong beings.
const shuffled = new WeakMap();
function permuted(att, seed) {
  const key = att.bindings; let hit = shuffled.get(key); if (hit && hit.seed === seed) return hit.bindings;
  const rnd = mulberry(seed), refs = att.bindings.map((b) => b.referent);
  for (let i = refs.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [refs[i], refs[j]] = [refs[j], refs[i]]; }
  const bindings = att.bindings.map((b, i) => ({ ...b, referent: refs[i] }));
  shuffled.set(key, { seed, bindings }); return bindings;
}

/** On one statement (st.s..st.e in the reading's text): the bindings and typed gaps the binder gave for its sentence-initial targets.
 *  `eng` is the page's compacted master reading of the document (it carries `attended` only when the binder was asked). `canonOf` maps a
 *  surface to the page's name for it. Sets st.attended = [{ name, kind, via, margin }] and st.attendedGaps = [{ reason, surface, at }]. */
export function attachAttended(st, eng, canonOf, sw = {}) {
  const att = eng && eng.attended; if (!att) return;
  const bs = sw.shuffle != null ? permuted(att, sw.shuffle) : att.bindings;
  const inSt = (g) => g.at && g.at[0] >= st.s && g.at[0] < st.e;
  const got = bs.filter(inSt).filter((b) => b.referent).map((b) => ({ name: canonOf(b.referent), kind: b.kind, via: b.via, margin: b.margin, at: b.at }));
  if (got.length) st.attended = got;
  const gaps = att.gaps.filter(inSt).map((g) => ({ reason: g.reason, surface: g.surface, at: g.at }));
  if (gaps.length) st.attendedGaps = gaps;
}

/** The names a statement is ABOUT by the binder: the referents bound to its sentence-initial "it" or description. [] when none. */
export const boundNames = (st) => (st && st.attended ? [...new Set(st.attended.map((b) => b.name))] : []);
