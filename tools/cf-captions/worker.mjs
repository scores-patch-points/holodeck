// worker.mjs — a Cloudflare Worker that answers the yt-dlp helper's /health and /captions, so a hosted
// copy of the page can read YouTube captions with nothing running on the reader's machine.
//
// Why a server at all: from a browser origin YouTube's caption track comes back empty (it wants a
// proof-of-origin token a page cannot mint) and its player API sends no CORS header. The ANDROID and
// IOS innertube clients still return tracks whose body is real, so the read is done here and the page
// gets the helper's own JSON shape: { title, author, lang, kind, segments:[{start,end,text}] }.
// Point the page at it with the Settings field "yt-dlp helper" (localStorage hd:ytdl) — no page change.
//
// Not an open relay: only GET /health and GET /captions, only an 11-character video id, only
// youtube.com, only the page's own origins (ALLOW_ORIGINS). It runs on the account that deploys it.
//
// Not covered: /audio, /clip, /stitch (those need yt-dlp and ffmpeg and stay with the local helper).

import { parseJson3 } from '../../holodeck-yt.js';

const PLAYER = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false';
const CLIENTS = [
  { name: 'ANDROID', id: '3', version: '20.10.38', ua: 'com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip',
    ctx: { clientName: 'ANDROID', clientVersion: '20.10.38', androidSdkVersion: 30, hl: 'en' } },
  { name: 'IOS', id: '5', version: '20.10.4', ua: 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)',
    ctx: { clientName: 'IOS', clientVersion: '20.10.4', deviceMake: 'Apple', deviceModel: 'iPhone16,2', osName: 'iPhone', osVersion: '18.3.2.22D82', hl: 'en' } },
];
const DEFAULT_ORIGINS = 'https://scores-patch-points.github.io,http://127.0.0.1,http://localhost';
const VIDEO_ID = /^[\w-]{11}$/;

// Same preference the page's own rung uses: the wanted language, manual before automatic.
function pickTrack(tracks, lang) {
  const want = (lang || 'en').toLowerCase(), base = want.split('-')[0];
  const score = t => { const c = (t.languageCode || '').toLowerCase(); return (t.kind === 'asr' ? 8 : 0) + (c === want ? 0 : c.split('-')[0] === base ? 1 : 4); };
  return tracks.slice().sort((a, b) => score(a) - score(b))[0] || null;
}

// A page origin is allowed when it equals an entry, or is an entry plus a port (so any localhost port works).
function originAllowed(origin, env) {
  if (!origin) return false;
  return String(env.ALLOW_ORIGINS || DEFAULT_ORIGINS).split(',').map(s => s.trim()).filter(Boolean)
    .some(a => origin === a || origin.startsWith(a + ':'));
}

async function playerResponse(client, id) {
  const r = await fetch(PLAYER, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': client.ua, 'x-youtube-client-name': client.id, 'x-youtube-client-version': client.version },
    body: JSON.stringify({ context: { client: client.ctx }, videoId: id }),
  });
  if (!r.ok) throw new Error(client.name + ' player answered HTTP ' + r.status);
  return r.json();
}

// Try each client in turn; return the first that yields tracks, or the last refusal's reason.
async function readTracks(id) {
  let reason = 'no caption track', last = null;
  for (const client of CLIENTS) {
    let j; try { j = await playerResponse(client, id); } catch (e) { reason = String(e.message || e); continue; }
    const ps = j.playabilityStatus || {};
    if (ps.status && ps.status !== 'OK') { reason = (ps.status + (ps.reason ? ': ' + ps.reason : '')).slice(0, 160); continue; }
    last = j;
    const tracks = (((j.captions || {}).playerCaptionsTracklistRenderer || {}).captionTracks) || [];
    if (tracks.length) return { client, tracks, details: j.videoDetails || {} };
    reason = 'no caption track';
  }
  return { client: null, tracks: [], details: (last && last.videoDetails) || {}, reason };
}

async function captions(id, lang) {
  const got = await readTracks(id);
  if (!got.tracks.length) return { status: got.reason === 'no caption track' ? 200 : 502, body: got.reason === 'no caption track'
    ? { title: got.details.title || '', author: got.details.author || '', lang: lang || '', kind: '', segments: [], id } : { error: got.reason } };
  const t = pickTrack(got.tracks, lang);
  // The ANDROID client's track URL already carries fmt=srv3 (XML); the format is replaced, not appended to.
  const track = new URL(t.baseUrl); track.searchParams.set('fmt', 'json3');
  const r = await fetch(track.toString(), { headers: { 'user-agent': got.client.ua } });
  if (!r.ok) return { status: 502, body: { error: 'the caption track answered HTTP ' + r.status } };
  const ms = x => Math.round(x * 1000) / 1000;
  const segments = parseJson3(await r.text()).map(s => ({ start: ms(s.start), end: ms(s.end), text: s.text }));
  if (!segments.length) return { status: 502, body: { error: 'the caption track came back empty' } };
  return { status: 200, body: { title: got.details.title || '', author: got.details.author || '', lang: t.languageCode || lang || '', kind: t.kind === 'asr' ? 'asr' : 'manual', segments, id } };
}

export default {
  async fetch(request, env = {}) {
    const origin = request.headers.get('origin') || '';
    const allowed = originAllowed(origin, env);
    const cors = allowed ? { 'access-control-allow-origin': origin, 'vary': 'origin', 'access-control-allow-methods': 'GET, OPTIONS', 'access-control-allow-headers': '*' } : { 'vary': 'origin' };
    const send = (status, body, extra) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...cors, ...(extra || {}) } });

    if (request.method === 'OPTIONS') return new Response(null, { status: allowed ? 204 : 403, headers: cors });
    if (request.method !== 'GET') return send(405, { error: 'GET only' });
    if (origin && !allowed) return send(403, { error: 'origin not allowed' });

    const url = new URL(request.url);
    if (url.pathname === '/health') return send(200, { ok: true, engine: 'cloudflare-worker', clients: CLIENTS.map(c => c.name) });
    if (url.pathname === '/captions') {
      const id = url.searchParams.get('id') || '';
      if (!VIDEO_ID.test(id)) return send(400, { error: 'id must be an 11-character video id' });
      try {
        const out = await captions(id, url.searchParams.get('lang') || 'en');
        return send(out.status, out.body, out.status === 200 && out.body.segments.length ? { 'cache-control': 'public, max-age=3600' } : {});
      } catch (e) { return send(502, { error: String(e && e.message || e).slice(0, 160) }); }
    }
    return send(404, { error: 'not here: this worker answers /health and /captions' });
  },
};
