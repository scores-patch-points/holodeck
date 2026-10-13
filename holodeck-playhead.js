// holodeck-playhead.js — the words at the play head, arranged three ways beside a playing recording.
//
// A transcript arrives as timed lines (each paragraph carries the second it starts, data-t). The words inside
// a line have no times of their own, so a word's moment is estimated: the line's span (its start to the next
// line's start) is shared out by characters, since speech runs roughly in proportion to its letters. That
// estimate drives every arrangement here and the click-to-jump in the transcript, so they always agree.
//
//   Facing pages — the waveform as a tall panel, the transcript scrolling on the facing side (index.html).
//   Under the wave — the line being spoken appears beneath the waveform, word by word, as the cursor moves.
//   Word lane — a zoomed window of the sound slides past a fixed play head, each word pinned under its moment,
//               the way a subtitle editor lays words on a timeline.
//
// The pure half (cuesOf, indexAt, timeAtChar, laneLayout) is tested; the painters touch only the DOM they are given.

const CHAR_SEC = 0.065;   // the fallback pace for a last line with no recording length: ~15 characters a second

/** Timed lines → cues with estimated word times. `lines` is [{ t, text }] in any order; `duration` (seconds)
 *  closes the last line when known. Each cue: { t, end, text, words: [{ w, t, end, c0, c1, k, i }] }, where
 *  c0/c1 are the word's character offsets in the cue text, k its cue index, i its index in the flat list. */
export function cuesOf(lines, duration) {
  const L = (lines || []).filter(x => x && isFinite(x.t) && String(x.text || '').trim()).map(x => ({ t: +x.t, text: String(x.text) })).sort((a, b) => a.t - b.t);
  const cues = []; let i = 0;
  L.forEach((x, k) => {
    const next = L[k + 1], fall = x.t + Math.max(1, x.text.trim().length * CHAR_SEC);
    let end = next ? next.t : (duration > x.t ? duration : fall);
    if (!(end > x.t)) end = x.t + 0.5;
    const text = x.text, n = text.length, words = [], re = /\S+/g; let m;
    while ((m = re.exec(text))) {
      const c0 = m.index, c1 = c0 + m[0].length;
      words.push({ w: m[0], t: x.t + (end - x.t) * c0 / n, end: x.t + (end - x.t) * c1 / n, c0, c1, k, i: i++ });
    }
    cues.push({ t: x.t, end, text, words });
  });
  return cues;
}

/** Every word of every cue, in order. */
export function wordsOf(cues) { const out = []; (cues || []).forEach(c => c.words.forEach(w => out.push(w))); return out; }

/** The last item whose .t is at or before `t` (-1 when `t` is before the first). Binary search. */
export function indexAt(arr, t) {
  let lo = 0, hi = (arr ? arr.length : 0) - 1, r = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (arr[m].t <= t) { r = m; lo = m + 1; } else hi = m - 1; }
  return r;
}

/** The moment a character offset inside a cue is spoken — the start of the word it falls in. */
export function timeAtChar(cue, off) {
  if (!cue) return 0;
  const ws = cue.words; if (!ws.length) return cue.t;
  for (const w of ws) if (off < w.c1) return w.t;
  return ws[ws.length - 1].t;
}

/** Where the words sit in a lane window of `span` seconds centred on `t`, `width` pixels wide.
 *  Each word gets x (its start), a width from `measure(word)`, and the first row it fits in without
 *  touching the word before it on that row. Words that fit no row are left out (dropped, not overlapped). */
export function laneLayout(words, t, span, width, measure, rows = 3, gap = 6) {
  const a = t - span / 2, b = t + span / 2, px = width / span, out = [], last = new Array(rows).fill(-Infinity);
  let i = Math.max(0, indexAt(words, a));
  for (; i < (words ? words.length : 0); i++) {
    const w = words[i]; if (w.t > b) break; if (w.end < a) continue;
    const x = (w.t - a) * px, ww = measure(w);
    let row = -1; for (let r = 0; r < rows; r++) if (x >= last[r] + gap) { row = r; break; }
    if (row < 0) continue;
    last[row] = x + ww; out.push({ word: w, x, w: ww, row });
  }
  return out;
}

// ---------- the painters ----------

const css = (el, v, d) => { try { return (getComputedStyle(el).getPropertyValue(v) || '').trim() || d; } catch (e) { return d; } };

/** Under the wave: the previous line, dim, above the line being spoken, whose words light as they are reached.
 *  Rebuilds only when the line changes; each tick just moves the marks. Clicking a word calls seek(word.t). */
export function paintCaption(box, cues, t, seek) {
  if (!box) return;
  const k = indexAt(cues, t), cue = cues[k];
  if (box._k !== k) {
    box._k = k; box.textContent = '';
    if (!cue) { const p = document.createElement('div'); p.className = 'hd-ph-hint'; p.textContent = cues.length ? 'The words appear here as the recording reaches them.' : 'No timed transcript yet.'; box.appendChild(p); box._spans = []; return; }
    const prev = cues[k - 1];
    if (prev) { const p = document.createElement('div'); p.className = 'hd-ph-prev'; p.textContent = prev.text.trim(); p.title = 'Play from here'; p.onclick = () => seek(prev.t); box.appendChild(p); }
    const line = document.createElement('div'); line.className = 'hd-ph-line'; box._spans = [];
    cue.words.forEach((w, j) => { if (j) line.appendChild(document.createTextNode(' ')); const s = document.createElement('span'); s.textContent = w.w; s.title = 'Play from here'; s.onclick = () => seek(w.t); line.appendChild(s); box._spans.push(s); });
    box.appendChild(line);
  }
  if (!cue) return;
  cue.words.forEach((w, j) => { const s = box._spans[j]; if (!s) return; const st = w.end <= t ? 'said' : w.t <= t ? 'now' : 'yet'; if (s._st !== st) { s._st = st; s.className = 'hd-ph-' + st; } });
}

/** The seconds a lane shows: enough room per second (~120 px) for speech to read left to right in two rows. */
export function laneSpan(width) { return Math.max(4, Math.min(24, (width || 0) / 120)); }

/** Word lane: a window of the waveform centred on `t` (laneSpan of its width), a fixed play head down the middle,
 *  and the words pinned under the moment each is spoken. Returns the laid-out word boxes for hit-testing, with
 *  the window's seconds as `.span`. */
export function drawLane(canvas, peaks, duration, words, t, span) {
  if (!canvas || !canvas.clientWidth) return [];
  if (!(span > 0)) span = laneSpan(canvas.clientWidth);
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  const W = Math.round(canvas.clientWidth * dpr), H = Math.round(canvas.clientHeight * dpr);
  if (canvas.width !== W) canvas.width = W; if (canvas.height !== H) canvas.height = H;
  const g = canvas.getContext('2d'); g.clearRect(0, 0, W, H);
  const rest = css(canvas, '--dim', '#8a8f98'), acc = css(canvas, '--acc', '#5b8def'), ink = css(canvas, '--ink', '#222'), mut = css(canvas, '--mut', '#777');
  const waveH = Math.round(H * 0.42), mid = waveH / 2 + 4 * dpr, a = t - span / 2, px = W / span;
  // the sound in the window
  if (peaks && peaks.length && duration > 0) {
    const bar = 3 * dpr, n = Math.ceil(W / bar);
    for (let b = 0; b < n; b++) {
      const s = a + (b * bar) / px; if (s < 0 || s > duration) continue;
      const lo = Math.floor(s / duration * peaks.length), hi = Math.max(lo + 1, Math.floor((s + bar / px) / duration * peaks.length));
      let m = 0; for (let i = lo; i < hi && i < peaks.length; i++) if (peaks[i] > m) m = peaks[i];
      const bh = Math.max(dpr * 1.5, m * waveH * 0.9), x = b * bar;
      g.fillStyle = s <= t ? acc : rest; g.globalAlpha = s <= t ? 0.9 : 0.5;
      g.fillRect(x, mid - bh / 2, bar - dpr, bh);
    }
    g.globalAlpha = 1;
  } else { g.fillStyle = rest; g.globalAlpha = 0.4; g.fillRect(0, mid, W, dpr); g.globalAlpha = 1; }
  // second ticks along the base of the wave
  g.fillStyle = mut; g.font = (10 * dpr) + 'px ui-monospace, monospace'; g.textBaseline = 'top';
  for (let s = Math.ceil(a / 5) * 5; s < a + span; s += 5) { if (s < 0) continue; const x = (s - a) * px; g.globalAlpha = 0.5; g.fillRect(x, waveH + 2 * dpr, dpr, 4 * dpr); g.globalAlpha = 0.8; g.fillText(Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'), x + 3 * dpr, waveH + 1 * dpr); }
  g.globalAlpha = 1;
  // the words, each under its moment
  const fs = 14 * dpr, rowH = fs * 1.45, top = waveH + 18 * dpr, rows = Math.max(1, Math.min(2, Math.floor((H - top) / rowH)));
  g.font = '500 ' + fs + 'px ' + css(canvas, '--serif', 'Georgia, serif');
  const lay = laneLayout(words, t, span, W, w => g.measureText(w.w).width, rows, 8 * dpr);
  const hits = [];
  lay.forEach(L => {
    const w = L.word, y = top + L.row * rowH, now = w.t <= t && t < w.end;
    g.fillStyle = now ? acc : w.end <= t ? ink : mut; g.globalAlpha = now ? 1 : w.end <= t ? 0.85 : 0.6;
    g.fillText(w.w, L.x, y);
    g.globalAlpha = 0.35; g.fillRect(L.x, y - 3 * dpr, dpr, 2 * dpr);
    hits.push({ word: w, x0: L.x / dpr, x1: (L.x + L.w) / dpr, y0: y / dpr, y1: (y + rowH) / dpr });
  });
  g.globalAlpha = 1;
  // the play head, fixed in the middle
  g.fillStyle = acc; g.fillRect(W / 2 - dpr, 0, dpr * 2, H);
  hits.span = span;
  return hits;
}
