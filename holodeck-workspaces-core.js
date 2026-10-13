// holodeck-workspaces-core.js — the small pure pieces under the Workspaces screen (holodeck-workspaces-hero.js).
//
// PURE: no I/O, no DOM. A workspace is what the page already keeps: a local id and name, the sources added to it,
// when it was last opened, and (once shared) a private Matrix room and maybe a public one. What the screen adds is
// one reading of everyone in each workspace: who is in it, who is here, which invitations are still open.

export const SORTS = Object.freeze(['recent', 'name', 'size', 'people']);

const plural = (n, one, many = one + 's') => n + ' ' + (n === 1 ? one : many);

/** Filter by name and sort. `people` sorts by members, then invitations still open; ties fall back to name. */
export function sortWorkspaces(list, { q = '', sort = 'recent', summaries = {} } = {}) {
  const needle = String(q || '').trim().toLowerCase();
  const hit = (list || []).filter((w) => !needle || String(w.name || '').toLowerCase().includes(needle));
  const byName = (a, b) => String(a.name || '').localeCompare(String(b.name || ''));
  const crowd = (w) => { const s = summaries[w.id]; return s && s.ready ? s.members * 1000 + s.waiting : -1; };
  const cmp = sort === 'name' ? byName
    : sort === 'size' ? (a, b) => (b.n || 0) - (a.n || 0) || byName(a, b)
      : sort === 'people' ? (a, b) => crowd(b) - crowd(a) || byName(a, b)
        : (a, b) => (b.at || 0) - (a.at || 0) || byName(a, b);
  return hit.slice().sort(cmp);
}

/**
 * One workspace's people, read once, as counts and names. Inputs are what holodeck-invites.js returns:
 * people [{ user, name, owner, joined, self }], outstanding [{ door, name, state, exp, link }], online [{ user }].
 */
export function summarizeWorkspace({ people = [], outstanding = [], online = [], owner = false, vault = 'new' } = {}) {
  const here = new Set((online || []).map((o) => o.user));
  const joined = people.filter((p) => p.joined);
  const others = joined.filter((p) => !p.self);
  const shown = (p) => p.name || String(p.user || '').replace(/^@|:.*$/g, '');
  return {
    ready: true,
    owner: !!owner,
    locked: vault === 'locked',
    members: joined.length,
    others: others.length,
    invitedNotJoined: people.filter((p) => !p.joined).length,
    waiting: outstanding.filter((o) => o.state === 'sent').length,
    expired: outstanding.filter((o) => o.state === 'expired').length,
    here: others.filter((p) => here.has(p.user)).map(shown),
    faces: joined.map((p) => ({ user: p.user, name: shown(p), here: here.has(p.user) && !p.self, self: !!p.self, owner: !!p.owner })),
  };
}

/** The one line under a workspace's name that says who it is shared with, in plain words. */
export function shareLine({ rooms = {}, summary = null, signedIn = true } = {}) {
  if (!rooms || !rooms.priv) return rooms && rooms.pub ? 'Public room only · nobody invited' : 'Only on this device';
  if (!signedIn) return 'Shared · sign in to see who is in it';
  if (!summary) return 'Shared · reading who is in it…';
  if (summary.error) return 'Shared · could not read its people just now';
  if (summary.locked) return 'Shared with you · this device cannot read its people yet';
  const bits = [];
  bits.push(summary.others ? 'You and ' + plural(summary.others, 'other') : 'Just you');
  if (summary.waiting) bits.push(plural(summary.waiting, 'invitation') + ' waiting');
  if (summary.here.length) bits.push(summary.here.length === 1 ? summary.here[0] + ' is here' : plural(summary.here.length, 'person', 'people') + ' here');
  return bits.join(' · ');
}

/** Totals for the header across every workspace that has been read. */
export function totals(list, summaries = {}, roomsOf = () => ({})) {
  let shared = 0, people = new Set(), waiting = 0, here = new Set();
  for (const w of list || []) {
    const r = roomsOf(w.id) || {};
    if (r.priv) shared++;
    const s = summaries[w.id];
    if (!s || !s.ready) continue;
    waiting += s.waiting;
    for (const f of s.faces) { if (!f.self) people.add(f.user); if (f.here) here.add(f.user); }
  }
  return { workspaces: (list || []).length, shared, people: people.size, waiting, here: here.size };
}

export function headerLine(t) {
  const bits = [plural(t.workspaces, 'workspace')];
  if (t.shared) bits.push(t.shared + ' shared');
  if (t.people) bits.push(plural(t.people, 'person', 'people') + ' invited in');
  if (t.waiting) bits.push(plural(t.waiting, 'invitation') + ' waiting');
  if (t.here) bits.push(t.here + ' here now');
  return bits.join(' · ');
}

export function initials(name) {
  const w = String(name || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (!w.length) return '·';
  return (w.length === 1 ? w[0].slice(0, 2) : w[0][0] + w[w.length - 1][0]).toUpperCase();
}

/** A stable hue per id, so a workspace keeps its colour across sessions and sorts. */
export function hueOf(id) {
  let h = 2166136261;
  for (const c of String(id || '')) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h % 360;
}

export function ago(ms, now = Date.now()) {
  if (!ms) return 'not opened yet';
  const m = Math.round((now - ms) / 60000);
  if (m < 1) return 'opened just now';
  if (m < 60) return 'opened ' + m + ' min ago';
  const h = Math.round(m / 60);
  if (h < 24) return 'opened ' + h + ' h ago';
  const d = Math.round(h / 24);
  return d < 60 ? 'opened ' + d + ' d ago' : 'opened ' + new Date(ms).toLocaleDateString();
}

export function expiresIn(exp, now = Date.now()) {
  const left = exp - now;
  if (left <= 0) return 'expired';
  const h = Math.round(left / 3600000);
  if (h < 1) return 'expires within the hour';
  if (h < 48) return 'expires in ' + h + ' h';
  return 'expires in ' + Math.round(h / 24) + ' days';
}

/** Run fn over items, at most `limit` at a time; each result or error lands in order. */
export async function pool(items, limit, fn) {
  const out = new Array(items.length); let i = 0;
  const worker = async () => { while (i < items.length) { const k = i++; try { out[k] = { ok: true, value: await fn(items[k], k) }; } catch (e) { out[k] = { ok: false, error: e }; } } };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return out;
}
