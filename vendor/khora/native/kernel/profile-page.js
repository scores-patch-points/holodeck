// native/kernel/profile-page.js — THE SURFACE PAGE for a thing.
//
// Standing: nomination. Spec: native/docs/REALITY-LEVELS-SPEC.md §13.
//
// A pure, surface-neutral renderer (the profileLines / levelProfileLines /
// registerProfileLines precedent, composed into a page). It DRAWS records; it
// decides nothing and computes nothing about the world. The headline is a
// person's question — WHAT IS THIS, AND WHO SAYS SO — and the engine's terrain
// occupancy is one muted line at the foot, never the headline.
//
// Every line traces to a record: the reality-register fold (the anchor's lead,
// the sources with their declared registers, the real/fiction badge), the
// claims with their standing, the address. A thing with no world anchor says
// so (examined, not convicted). Nothing is smoothed.

import { REGISTER_TRAITS } from "./reality-register.js";

export const REALITY_BADGE = Object.freeze({
  real: "● real",
  "fictionalized-real": "◐ fictionalized-real",
  fictional: "✕ fictional",
  unexamined: "? unexamined",
});

export const STANDING_GLYPH = Object.freeze({ agreed: "●", contested: "◐", unsupported: "✕", single: "▪", figures: "◐" });
export const LEGEND = Object.freeze([
  "   legend   ● real (anchored world · truth-claiming source)",
  "            ◐ fictionalized-real (in the world, also told as story)",
  "            ✕ fictional (story only, no world anchor)",
  "            ? unexamined (no truth-claiming source, no anchor)",
  "            ▪ truth-claiming source   ◇ fiction   ▫ mention only",
  "            ● agree   ◐ contested   ✕ unsupported",
]);

const BARS = "▁▂▃▄▅▆▇█";
const bar = (n, max) => (n <= 0 ? "" : BARS[Math.max(0, Math.min(7, Math.round((n / Math.max(1, max)) * 7)))]);

const padEnd = (s, n) => { const t = String(s); return t.length >= n ? t.slice(0, n) : t + " ".repeat(n - t.length); };
const padStart = (s, n) => { const t = String(s); return t.length >= n ? t.slice(0, n) : " ".repeat(n - t.length) + t; };
const clip = (s, n) => { const t = String(s ?? "").replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

/** A single-line top card: name on the left, badge on the right. */
function card(title, right, lines, width) {
  const inner = width - 4;
  const out = [];
  out.push(`╔${"═".repeat(width - 2)}╗`);
  out.push(`║ ${padEnd(clip(title, inner - right.length - 1), inner - right.length) + right} ║`);
  out.push(`╠${"═".repeat(width - 2)}╣`);
  out.push(`║ ${padEnd("", inner)} ║`);
  for (const l of lines) {
    if (l === null) { out.push(`║ ${padEnd("", inner)} ║`); continue; }
    if (typeof l === "object" && l.rule) { const r = ` ${l.rule} `; out.push(`║ ${padEnd(r + "─".repeat(Math.max(0, inner - r.length)), inner)} ║`); continue; }
    out.push(`║ ${padEnd(clip(l, inner), inner)} ║`);
  }
  out.push(`╚${"═".repeat(width - 2)}╝`);
  return out;
}

/**
 * profileCard(thing, { reality, level, claims, rows, forWhom, width }) -> string
 *
 *   thing    { id, year? }
 *   reality  a realityRegister@1 result (the register/reality face)
 *   level    a levelProfile@1 result (optional — the muted engine line)
 *   claims   [{ text, standing, sources, total, detail }] (optional)
 *   rows     [{ rel, star, standing, values, more }] — the induced KEY PARAMETERS
 *            (entity-profile.js). The KEYS are emergent: a row is a relation the
 *            thing's own kind is defined by, carrying the standing the kind earned
 *            (fixed · one at a time · many-valued · time unknown · unexposed · no
 *            kind). This renderer draws them; it never decides them (optional).
 *   forWhom  { giver, question, ground } or a giver string (S113: identity exists
 *            only for-whom; the frame is shown, never erased) (optional)
 *   width    card width (default 78)
 */
export function profileCard(thing, { reality = null, level = null, claims = [], rows = [], forWhom = null, width = 78 } = {}) {
  const name = reality?.id ?? thing?.id ?? "—";
  const badge = REALITY_BADGE[reality?.realityKind] ?? "? unknown";
  const rights = [badge, thing?.year ? String(thing.year) : null].filter(Boolean).join(" · ");

  const lines = [];
  // WHAT IT IS
  if (reality?.anchor?.found) {
    lines.push(clip(reality.anchor.extract, width - 6));
    lines.push(`  ↳ what it is · Wikipedia  ${reality.anchor.url ?? ""}`);
  } else if (reality?.anchor?.ambiguous) {
    lines.push("  ▸ No single sense could be earned — the for-whom must decide.");
    lines.push(`    (examined, not convicted${(reality.anchor.candidates ?? []).length ? `; candidates: ${(reality.anchor.candidates ?? []).map((c) => c.title).slice(0, 3).join(", ")}` : ""})`);
  } else if (reality) {
    lines.push("  ▸ No world anchor found — no truth-claiming source attests it,");
    lines.push("    and Wikipedia places no such being in the world. (examined, not convicted)");
  }

  // TOLD BY
  lines.push(null);
  lines.push({ rule: "TOLD BY" });
  const att = reality?.attested ?? [];
  if (!att.length) lines.push("  (no source attests this thing)");
  for (const a of att) {
    const label = REGISTER_TRAITS[a.register]?.label ?? a.register;
    const tag = a.register === "fiction" ? "Fiction · NOT evidence" : `${label}${a.truthClaiming ? " · truth-claiming" : ""}`;
    lines.push(`  ${a.register === "fiction" ? "◇" : "▪"} ${padEnd(clip(a.source, 40), 42)}${tag}`);
  }

  // WHAT THE SOURCES SAY — the claims, then the induced KEY PARAMETERS: one row per
  // relation the thing's kind is defined by (★), with the standing the kind earned.
  // The keys are read off the kind induction; nothing is typed by this renderer.
  const sayable = claims.filter((c) => c.standing !== "contested");
  if (sayable.length || rows.length) {
    lines.push(null);
    lines.push({ rule: "WHAT THE SOURCES SAY" });
    for (const c of sayable) lines.push(`  ${STANDING_GLYPH[c.standing] ?? "▪"} ${padEnd(clip(c.text, width - 22), width - 18)}${c.total ? `${c.sources ?? 0} of ${c.total} src` : c.detail ?? ""}`);
    for (const r of rows) {
      const star = r.star ? `${clip(r.star, 2)} ` : "  ";
      lines.push(`  ${star}${padEnd(clip(r.rel, 18), 18)}${padEnd(clip(r.standing ?? "", 13), 13)}${clip(r.values ?? "", Math.max(8, width - 39))}${r.more ? ` +${r.more}` : ""}`);
    }
  }

  // DISAGREEMENTS
  const contested = claims.filter((c) => c.standing === "contested");
  if (contested.length) {
    lines.push(null);
    lines.push({ rule: "DISAGREEMENTS" });
    for (const c of contested) lines.push(`  ◐ ${clip(c.text, width - 10)}`);
    for (const c of contested) if (c.detail) lines.push(`      ${clip(c.detail, width - 10)}`);
  }

  // FOR WHOM — the frame the reading was admitted for (S113: identity exists only
  // for-whom). Shown, never erased; a page with no frame renders as such.
  if (forWhom) {
    const f = typeof forWhom === "string" ? { giver: forWhom } : forWhom;
    lines.push(null);
    lines.push({ rule: "FOR WHOM" });
    lines.push(`  ${[f.giver ? `giver ${clip(f.giver, width - 20)}` : "", f.question ? `question “${clip(f.question, width - 30)}”` : "", f.ground ? `ground ${clip(f.ground, 30)}` : ""].filter(Boolean).join(" · ")}`);
  }

  // the muted engine line
  if (level) {
    const counts = { Ground: 0, Figure: 0, Pattern: 0 };
    for (const d of Object.keys(level.occupancy)) for (const g of Object.keys(level.occupancy[d])) counts[g] += level.occupancy[d][g];
    const max = Math.max(1, ...Object.values(counts));
    lines.push(null);
    lines.push(`  ▸ engine · Ground ${bar(counts.Ground, max) || "·"} · Figure ${bar(counts.Figure, max) || "·"} · Pattern ${bar(counts.Pattern, max) || "·"}   (${level.absent.length}/9 terrains absent)`);
  }

  return card(name, rights, lines, width).join("\n");
}

/** profileIndex({ title, things, width }) -> string — the workspace index:
 *  things grouped by reality-kind, a person's first glance. */
export function profileIndex({ title = "the workspace", things = [], width = 78 } = {}) {
  const order = ["real", "fictionalized-real", "fictional", "unexamined"];
  const groups = new Map(order.map((k) => [k, []]));
  for (const t of things) (groups.get(t.realityKind) ?? groups.get("unexamined")).push(t.name);
  const out = [`   ${title} ${"─".repeat(Math.max(0, width - title.length - 6))}`];
  for (const k of order) {
    if (!groups.get(k).length) continue;
    out.push(`     ${REALITY_BADGE[k]}   ${clip(groups.get(k).join(" · "), width - 16)}`);
  }
  return out.join("\n");
}
