// holodeck-research-log.js — the run's event stream, said in plain words. Pure: events in, rows out. The page shows
// these rows as the acquisition happens and again, whole, in the Research view; it adds nothing of its own.
//
//   const log = makeLog({ label });  run → emit: ev => log.push(ev);  log.rows() / log.stats() / log.summary()
//
// A row is { key, chip, tone, title, line, url? } with tone one of ok · mut · warn · bad. A candidate's row is updated in
// place as it moves (to read → reading → read / couldn't read / not about it), so the list reads like a ledger, not a
// scroll. The register names never appear here: they live in holodeck-research-terrain.js and the docs.

const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
const n = (x, w) => x + ' ' + w + (x === 1 ? '' : 's');
const words = c => Math.round(c / 6).toLocaleString();

export function makeLog({ label = s => s } = {}) {
  const rows = [], byKey = new Map();
  const S = { searches: 0, searchFailed: 0, found: 0, toRead: 0, setAside: 0, read: 0, unread: 0, notAbout: 0, batches: 0, stopped: null };
  const put = (key, row) => { let r = byKey.get(key); if (r) Object.assign(r, row); else { r = { key, ...row }; byKey.set(key, r); rows.push(r); } return r; };
  const state = new Map();   // candidate id -> last state, so counters stay exact when a row is updated
  const map = { toRead: 'toRead', setAside: 'setAside', read: 'read', unread: 'unread', notAbout: 'notAbout' };
  const move = (id, to) => {
    const from = state.get(id); if (from === to) return;
    if (from && map[from] && S[map[from]] > 0) S[map[from]]--;
    if (map[to]) S[map[to]]++;
    state.set(id, to);
  };
  return {
    push(ev) {
      switch (ev.t) {
        case 'lanes': {
          put('lanes', { chip: 'Looking in', tone: 'ok', title: ev.lanes.map(l => label(l.scope)).join(' · '), line: ev.lanes.map(l => label(l.scope) + ' — ' + l.why).filter(x => / — .+/.test(x)).join(' · ') + (ev.held && ev.held.length ? ' · held back until needed: ' + ev.held.map(label).join(', ') : '') });
          break; }
        case 'note': put('note:' + rows.length, { chip: 'Note', tone: 'warn', title: ev.why, line: '' }); break;
        case 'round': if (ev.round > 0) put('round:' + ev.round, { chip: ev.kind === 'widened' ? 'Looking further' : 'Following a name', tone: 'mut', title: ev.why, line: ev.scopes.map(label).join(' · ') + ' · “' + ev.queries.join('”, “') + '”' }); break;
        case 'search': {
          const k = 'search:' + ev.scope + '|' + ev.q;
          if (ev.state === 'start') put(k, { chip: 'Asking', tone: 'mut', title: label(ev.scope), line: '“' + ev.q + '”' });
          else { if (ev.state === 'found') { S.searches++; } else { S.searches++; S.searchFailed++; }
            put(k, ev.state === 'found' ? { chip: 'Found ' + ev.n, tone: ev.n ? 'ok' : 'mut', title: label(ev.scope) + (ev.engine ? ' · ' + ev.engine : ''), line: '“' + ev.q + '”' }
              : { chip: 'No answer', tone: 'bad', title: label(ev.scope), line: '“' + ev.q + '” — ' + ev.why }); }
          break; }
        case 'candidate': {
          S.found++;
          if (ev.verdict === 'admitted') { move(ev.id, 'toRead'); put('c:' + ev.id, { chip: ev.ungated ? 'To read (unscreened)' : 'To read', tone: ev.ungated ? 'mut' : 'ok', title: ev.title, line: host(ev.url) + ' · found by ' + label(ev.scope) + (ev.ungated ? '' : ' · mentions the question’s words well beyond chance'), url: ev.url }); }
          else { move(ev.id, 'setAside'); put('c:' + ev.id, { chip: 'Set aside', tone: 'mut', title: ev.title, line: host(ev.url) + ' · ' + ev.why, url: ev.url }); }
          break; }
        case 'read': {
          if (ev.state === 'reading') { move(ev.id, 'reading'); put('c:' + ev.id, { chip: 'Reading…', tone: 'mut' }); break; }
          if (ev.state === 'read') { move(ev.id, 'read'); put('c:' + ev.id, { chip: 'Read', tone: 'ok', title: ev.title, line: host(ev.url) + ' · ' + (ev.via || 'direct') + ' · ' + n(ev.statements || 0, 'statement') + ', ' + n(ev.referents || 0, 'name') + ' · about the question (' + ev.g + ' vs ' + ev.nullMax + ' by chance)', url: ev.url }); }
          else if (ev.state === 'off-topic') { move(ev.id, 'notAbout'); put('c:' + ev.id, { chip: 'Not about it', tone: 'warn', title: ev.title, line: host(ev.url) + ' · ' + ev.why, url: ev.url }); }
          else { move(ev.id, 'unread'); put('c:' + ev.id, { chip: 'Couldn’t read', tone: 'bad', title: ev.title, line: host(ev.url) + ' · ' + ev.why, url: ev.url }); }
          break; }
        case 'batch': {
          S.batches = ev.n;
          if (!ev.kept) put('batch:' + ev.n, { chip: 'Checked', tone: 'mut', title: 'Batch ' + ev.n + ': none of these could be kept', line: '' });
          else if (!ev.test || ev.test.testable === false) put('batch:' + ev.n, { chip: 'Checked', tone: 'mut', title: 'Batch ' + ev.n + ': ' + n(ev.sources, 'source') + ' read so far — nothing to compare against yet, so reading on', line: n(ev.referents, 'name') + ' so far' });
          else put('batch:' + ev.n, { chip: 'Checked', tone: ev.test.outside ? 'ok' : 'warn',
            title: 'Batch ' + ev.n + ': ' + n(ev.test.observed, 'name') + ' newly confirmed by two sources; re-sampling what was already read confirms up to ' + ev.test.nullMax + ' by chance',
            line: ev.test.outside ? 'More than chance — still learning, reading on.' : 'No more than chance — more reading would not teach it more.' });
          break; }
        case 'stop': {
          S.stopped = ev.stop;
          put('stop', { chip: 'Stopped', tone: ev.stop.reason === 'inside-the-null' ? 'ok' : ev.stop.reason === 'no-candidates' ? 'bad' : 'mut', title: STOP_WORDS[ev.stop.reason] || ev.stop.reason, line: ev.stop.detail });
          break; }
      }
    },
    rows: () => rows.slice(),
    stats: () => ({ ...S }),
    /** One sentence for the end of a run. */
    summary() {
      const x = S; if (!x.found) return 'Nothing was found' + (x.searchFailed ? ' (' + n(x.searchFailed, 'search') + ' failed).' : '.');
      return 'Found ' + x.found + ' · read ' + x.read + (x.unread ? ' · couldn’t read ' + x.unread : '') + (x.notAbout ? ' · ' + x.notAbout + ' not about it' : '') + ' · set aside ' + x.setAside + '.';
    },
  };
}

export const STOP_WORDS = {
  'inside-the-null': 'It stopped because reading more would not have taught it more than chance',
  'candidates-exhausted': 'It stopped because there was nothing further to read',
  'no-candidates': 'It found nothing to read',
  aborted: 'You stopped it',
};
