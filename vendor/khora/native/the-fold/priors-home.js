// the-fold/priors-home.js — THE ONE HOME FOR THE PRIORS (janus).
//
// The rules of reading are Relate's, so every prior (pos · frame · role-config ·
// morph-cues · morphology · case-marking · proclitics/enclitics/contractions ·
// code · notation · lang · …) lives at <workspace root>/janus/priors. khora
// READS them from there as DATA — a path, never a module import (janus imports
// khora, one-way, so a module cycle is impossible).
//
// Resolved relative to this module file exactly the way reader-bundle.js
// (native/the-fold) and greek-production.mjs (native/eval/lavar) resolve it:
// `..`-tripping from native/the-fold lands on the workspace root, then
// janus/priors. Data-gated still: an absent file leaves the leg null, never a
// guessed table. A missing home makes every language a typed gap, not English.
// The directory is resolved by prior-source.mjs, the one door every reading module reads a prior through (2026-10-24): under Node it
// is this path; in a page there is no directory (null) and the door fetches the vendored copy instead.
import { PRIORS_HOME } from "./prior-source.mjs";

export const WORKSPACE_ROOT = PRIORS_HOME.root;
export const JANUS_DIR = PRIORS_HOME.janus;
export const PRIORS_DIR = PRIORS_HOME.dir;
export default PRIORS_DIR;
