// holodeck-offices.js — the role a source gives a being, so two sources can be held to the same slot.
//
// "Mr. J. Bruce Ismay (chairman)" in one source and "J. Bruce Ismay, managing director of the White Star Line" in
// another are not two numbers, and no unit word will pair them. They are one SLOT: what Ismay was at the White Star
// Line. The slot is a being (the name the reading admitted) and the body it is held at; the value is the role the
// source states. Two sources that fill one slot with different roles disagree about who held the authority, which is
// what an account of an event is read for.
//
// Read from the statement's own name spans and the words that attach to them, never from a neighbour:
//   NAME (ROLE)                         "Mr. J. Bruce Ismay (chairman)"
//   NAME, [the] ROLE [of the BODY]      "J. Bruce Ismay, managing director of the White Star Line"
//   NAME is/was [the] ROLE [... of the BODY]   "Mr. Ismay is president and one of the founders of the International Mercantile Marine"
// A body with no "of the …" is the nearest body named earlier in the same statement. The role words are a closed prior
// of offices (the same kind of list the figure reader keeps for measures); a role outside it is not read, never guessed.
// Pure: a statement with name spans in, role claims out.

export const ROLE = 'managing director|vice[- ]president|chief engineer|chief officer|first officer|second officer|third officer|wireless operator|chairman|president|director|secretary|treasurer|captain|commander|commodore|purser|manager|owner|builder|designer|surgeon|steward|chief steward';
const ROLE_AT = new RegExp('^(?:the\\s+|a\\s+|an\\s+)?(?:[A-Za-z-]+\\s+){0,1}?(' + ROLE + ')\\b', 'i');
const BODY = /\b(Line|Co|Company|Corporation|Marine|Navigation|Railway|Committee|Board|Association|Firm|Wolff|Ltd|Trust|Society|Bank)\b/;
export const isBody = n => BODY.test(String(n || ''));
const canonRole = r => String(r).toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
export const canonBody = n => String(n || '').toLowerCase().replace(/^the\s+/, '').replace(/\bco\.?\b|\bltd\.?\b|\bcompany\b/g, '').replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** rolesOf(st) -> [{ key, person, body, role, raw, s, e }]  offsets relative to the statement text.
 *  key names the SLOT (person at body); two claims with one key and different roles are a disagreement. */
export function rolesOf(st) {
  const text = String(st.text || ''); const spans = (st.spans || []).slice().sort((a, b) => a.s - b.s);
  const out = [];
  const bodyAfter = (from) => { const m = /^\s*(?:and\s+one\s+of\s+the\s+[a-z]+\s+)?(?:of|at)\s+(?:the\s+)?/i.exec(text.slice(from)); if (!m) return null;
    const at = from + m[0].length; return spans.find(sp => isBody(sp.name) && sp.s >= at - 1 && sp.s <= at + 2) || null; };
  const nearestBodyBefore = (pos) => { let b = null; for (const sp of spans) { if (sp.e > pos) break; if (isBody(sp.name)) b = sp; } return b; };
  for (const sp of spans) {
    if (isBody(sp.name) || /^\d/.test(sp.name) || String(sp.name).split(/\s+/).length < 2 && !/^[A-Z][a-z]+$/.test(sp.name)) continue;
    const rest = text.slice(sp.e);
    let m, role = null, at = 0, body = null;
    if ((m = /^\s*\(\s*(.+?)\s*\)/.exec(rest)) && new RegExp('^(?:' + ROLE + ')$', 'i').test(m[1])) { role = m[1]; at = sp.e + m[0].indexOf(m[1]); body = nearestBodyBefore(sp.s); }
    else if ((m = /^\s*,\s*/.exec(rest)) && (m = ROLE_AT.exec(rest.slice(m[0].length))) && /^(?:the\s+|a\s+|an\s+)?(?:[A-Za-z-]+\s+)?/i.test(m[0])) {
      const lead = /^\s*,\s*/.exec(rest)[0].length; role = m[1]; at = sp.e + lead + m[0].toLowerCase().lastIndexOf(m[1].toLowerCase()); body = bodyAfter(sp.e + lead + m.index + m[0].length); }
    else if ((m = /^\s+(?:is|was|as)\s+(?:the\s+|a\s+)?(?:[a-z]+\s+){0,1}?(managing director|chairman|president|director|secretary|treasurer|captain|commander|manager|owner|purser)\b/i.exec(rest))) {
      role = m[1]; at = sp.e + m[0].toLowerCase().lastIndexOf(m[1].toLowerCase()); body = bodyAfter(sp.e + m[0].length); }
    if (!role) continue;
    const bodyName = body ? body.name : '';
    out.push({ key: 'role|' + sp.name + '|' + canonBody(bodyName), person: sp.name, body: bodyName, role: canonRole(role), raw: text.slice(at, at + role.length), s: at, e: at + role.length });
  }
  return out;
}

export default { rolesOf, isBody, canonBody, ROLE };
