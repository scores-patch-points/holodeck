#!/usr/bin/env python3
"""fulltext.py — the whole text of every contract, searchable, tolerant of OCR slips.

The contracts API (server.py) only searches header fields and the reader's findings. This indexes every character of each
contract's extracted-text.txt into its own SQLite file (fulltext.db), so the live index is never touched and a build can be thrown
away. Two ways in, one verifier:

  exact    an FTS5 trigram index = a substring index. '"evidence.com"' finds the characters, anywhere, punctuation included.
  fuzzy    the query's trigrams pick candidate chunks (any 40% of them matching), then a bounded edit-distance scan of the
           chunk confirms: 'indemnifcation' (dropped letter) and 'lndemnification' (OCR l for I) still find 'indemnification'.
  folded   both sides are first folded through the one-for-one OCR confusions (1, |, i, ! -> l; 0 -> o), so 'l1ability' and
           'liability' are the same string before edit distance is even needed. Two-for-one slips (rn/m, vv/w) are left to edit distance.

Every hit carries the character offsets (a, b) into extracted-text.txt, so it maps onto the text the rest of the system uses.

  build_fulltext:  fulltext.py build [--tokens T ...] [--sample N] [--db PATH]     (incremental: unchanged files are skipped)
  query:           fulltext.py query "evidence.com" [--db PATH] [--limit 20]
"""
import argparse, json, os, re, sqlite3, sys, time

DATA = os.environ.get('NASHVILLE_DATA', '/mnt/watch/nashville-legistar-archive/data')
DB = os.environ.get('CONTRACTS_FULLTEXT', '/mnt/watch/contracts-api/fulltext.db')
CHUNK, STEP = 1200, 1000            # 200 characters of overlap, so a phrase on a boundary is whole in one chunk

SCHEMA = """
CREATE TABLE IF NOT EXISTS files(token TEXT PRIMARY KEY, size INTEGER, mtime REAL, chunks INTEGER);
CREATE TABLE IF NOT EXISTS chunks(id INTEGER PRIMARY KEY, token TEXT, a INTEGER, b INTEGER, text TEXT);
CREATE INDEX IF NOT EXISTS chunks_token ON chunks(token);
CREATE VIRTUAL TABLE IF NOT EXISTS tri USING fts5(text, content='chunks', content_rowid='id', tokenize='trigram');
CREATE VIRTUAL TABLE IF NOT EXISTS tri_v USING fts5vocab(tri, 'row');     -- how many chunks hold each trigram: picks the rarest for fuzzy
"""

_CH = str.maketrans({'1': 'l', '|': 'l', 'i': 'l', '!': 'l', '0': 'o'})
def fold(s):
    """Lower-case and collapse the characters OCR confuses; the result is for matching only, never shown."""
    return s.lower().translate(_CH)     # character-for-character only, so offsets in the folded text are offsets in the original

def chunks_of(text):
    n = len(text); a = 0
    while a < n:
        b = min(n, a + CHUNK)
        if b < n:
            k = text.rfind(' ', a + CHUNK - 120, b)
            if k > a: b = k
        yield a, b, text[a:b]
        if b >= n: break
        a = max(a + 1, b - (CHUNK - STEP))

def build(args):
    db = sqlite3.connect(args.db); db.execute('PRAGMA journal_mode=WAL'); db.execute('PRAGMA synchronous=OFF'); db.executescript(SCHEMA)
    root = os.path.join(DATA, 'deployed'); t0 = time.time(); n = c = 0
    toks = list(args.tokens or [])
    if not toks or args.sample:
        allt = [d.rsplit('-', 1)[-1] for d in os.listdir(root)]
        if args.sample: import random; random.Random(3).shuffle(allt); allt = [t for t in allt if t not in toks][:args.sample]
        toks += allt
    for tok in toks:
        p = os.path.join(root, 'nashville-epav-contract-' + tok, 'extracted-text.txt')
        if not os.path.exists(p): continue
        st = os.stat(p); row = db.execute('SELECT size, mtime FROM files WHERE token=?', (tok,)).fetchone()
        if row and row[0] == st.st_size and row[1] == st.st_mtime: continue
        if row:                                                           # changed text: drop its old chunks, then re-add
            for (i, t) in db.execute('SELECT id, text FROM chunks WHERE token=?', (tok,)).fetchall():
                db.execute("INSERT INTO tri(tri, rowid, text) VALUES('delete', ?, ?)", (i, t))
            db.execute('DELETE FROM chunks WHERE token=?', (tok,))
        text = open(p, encoding='utf-8', errors='replace').read(); k = 0
        for a, b, t in chunks_of(text):
            cur = db.execute('INSERT INTO chunks(token, a, b, text) VALUES (?,?,?,?)', (tok, a, b, t))
            db.execute('INSERT INTO tri(rowid, text) VALUES (?, ?)', (cur.lastrowid, t)); k += 1
        db.execute('INSERT OR REPLACE INTO files VALUES (?,?,?,?)', (tok, st.st_size, st.st_mtime, k))
        n += 1; c += k
        if n % 200 == 0: db.commit(); print('  %d contracts, %d chunks, %.0fs' % (n, c, time.time() - t0), flush=True)
    db.commit(); print('build: %d contracts, %d chunks in %.0fs; %s' % (n, c, time.time() - t0, args.db))

def near(pat, text, k):
    """Positions where `pat` occurs in `text` within k edits (Sellers' algorithm, one row at a time); returns [(end, cost)]."""
    m = len(pat); prev = list(range(m + 1)); out = []
    for j, ch in enumerate(text, 1):
        cur = [0]
        for i in range(1, m + 1):
            cur.append(min(prev[i - 1] + (pat[i - 1] != ch), prev[i] + 1, cur[i - 1] + 1))
        if cur[m] <= k: out.append((j, cur[m]))
        prev = cur
    return out

def query(db, q, limit=20):
    """[{token, a, b, kind, text, marks}] best first. kind: exact, folded, fuzzy:<edits>."""
    ql = q.lower().strip(); qf = fold(ql)
    if len(ql) < 3: return []
    seen, hits = set(), []
    def add(rid, token, a, text, s, e, kind):
        if (rid, kind) in seen: return
        seen.add((rid, kind)); lo, hi = max(0, s - 110), min(len(text), e + 110)
        hits.append({'token': token, 'a': a + s, 'b': a + e, 'kind': kind, 'text': text[lo:hi], 'marks': [[s - lo, e - lo]], 'before': lo > 0, 'after': hi < len(text)})
    for rid, token, a, text in db.execute('SELECT c.id, c.token, c.a, c.text FROM tri JOIN chunks c ON c.id = tri.rowid WHERE tri MATCH ? LIMIT ?', ('"%s"' % ql.replace('"', ''), 400)):
        i = text.lower().find(ql)
        if i >= 0: add(rid, token, a, text, i, i + len(ql), 'exact')
    tris = sorted({qf[i:i + 3] for i in range(len(qf) - 2)})
    if tris and len(hits) < limit:                                         # folded + fuzzy: candidates by shared trigrams
        pick = tris if len(tris) <= 12 else tris[::max(1, len(tris) // 12)][:12]
        k = max(1, len(qf) // 6)
        for rid, token, a, text in db.execute('SELECT c.id, c.token, c.a, c.text FROM tri JOIN chunks c ON c.id = tri.rowid WHERE tri MATCH ? ORDER BY bm25(tri) LIMIT 300', (' OR '.join('"%s"' % t.replace('"', '') for t in pick),)):
            f = fold(text)
            i = f.find(qf)
            if i >= 0:
                if (rid, 'exact') not in seen: add(rid, token, a, text, i, i + len(qf), 'folded')
                continue
            if len(qf) < 6: continue
            best = min(near(qf, f, k), key=lambda x: x[1], default=None)
            if best: add(rid, token, a, text, max(0, best[0] - len(qf) - best[1]), best[0], 'fuzzy:%d' % best[1])
    rank = lambda k: {'exact': 0, 'folded': 1}.get(k, 2 + int(k.split(':')[1]) if ':' in k else 9)
    hits.sort(key=lambda h: (rank(h['kind']), h['token'], h['a']))
    return hits[:limit]

# ---- contract-level search: what the API serves ---------------------------------------------------------------------------
# search_contracts() answers "which contracts, and where in each". The phrase (all words, in order, any whitespace between) is
# looked up exactly first. Only when that finds fewer than FEW contracts does it widen, so a precise query stays precise:
#   together  every word of a multi-word query is in the same passage (within NEAR characters), in any order
#   fuzzy     the phrase within k edits (k = length // 6, at least 1): a dropped, added or misread character
# Each contract's hits: strongest kind first. kind is exact | folded | together | fuzzy:<edits>.
FEW, NEAR, PER = 3, 400, 3
_KR = {'exact': 0, 'folded': 1, 'together': 2}
def krank(k): return _KR.get(k, 3 + (int(k.split(':')[1]) if ':' in k else 0))
_re_cache = {}
def _ws_re(q):
    r = _re_cache.get(q)
    if r is None: r = _re_cache[q] = re.compile(r'\s+'.join(re.escape(w) for w in q.split()), re.I)
    return r

def open_db(path=DB, contracts=None):
    db = sqlite3.connect('file:%s?mode=ro' % path, uri=True, check_same_thread=False, timeout=30)
    if contracts: db.execute('ATTACH DATABASE ? AS m', ('file:%s?mode=ro' % contracts,))
    return db

def _spans(text, ql, qf):
    out = [(m.start(), m.end(), 'exact', None) for m in _ws_re(ql).finditer(text)]
    if qf != ql:
        for m in _ws_re(qf).finditer(fold(text)):
            if not any(s < m.end() and m.start() < e for s, e, _, _ in out): out.append((m.start(), m.end(), 'folded', None))
    return out

def _together(text, words):
    low = text.lower(); pos = [(w, low.find(w)) for w in words]
    if any(p < 0 for _, p in pos): return None
    s, e = min(p for _, p in pos), max(p + len(w) for w, p in pos)
    if e - s > NEAR: return None
    return s, e, [(p, p + len(w)) for w, p in pos]

def _rare_pieces(db, ql, k):
    """k+1 non-overlapping pieces of the query, each reduced to its rarest trigram. An edit hits one piece at most, so with at most
    k edits one piece is intact and its trigram is in the chunk: looking up these trigrams cannot miss a match."""
    m = len(ql); size = m // (k + 1)
    if size < 3: return []
    try: db.execute('SELECT 1 FROM tri_v LIMIT 1'); vocab = True
    except sqlite3.Error: vocab = False
    out = []
    for i in range(k + 1):
        a, b = i * size, ((i + 1) * size if i < k else m)
        tris = {ql[j:j + 3] for j in range(a, b - 2)}
        if not tris: continue
        cnt = (lambda t: (db.execute('SELECT doc FROM tri_v WHERE term = ?', (t,)).fetchone() or (0,))[0]) if vocab else (lambda t: 0)
        out.append((min(tris, key=cnt), a))
    return out

def _fuzzy_in(text, ql, qf, k, pieces):
    tl, fl = text.lower(), fold(text); pat = ' '.join(qf.split()); m = len(pat); out = []
    for tri, off in pieces:
        p, n = -1, 0
        while n < 8:
            p = tl.find(tri, p + 1)
            if p < 0: break
            n += 1; s = max(0, p - off - k - 3); e = min(len(text), p - off + m + k + 3)
            norm, idx = [], []
            for i in range(s, e):
                c = fl[i]
                if c.isspace():
                    if norm and norm[-1] == ' ': continue
                    c = ' '
                norm.append(c); idx.append(i)
            hits = near(pat, ''.join(norm), k)
            if not hits: continue
            end, cost = min(hits, key=lambda x: (x[1], x[0]))
            a = idx[max(0, end - m - cost)]; b = idx[min(end, len(idx)) - 1] + 1
            if not any(a < y and x < b for x, y, _ in out): out.append((a, b, cost))
    return out

def _hit(text, a, b, kind, marks, base):
    lo, hi = max(0, a - 110), min(len(text), b + 110)
    return {'kind': kind, 'a': base + a, 'b': base + b, 'text': text[lo:hi], 'marks': [[x - lo, y - lo] for x, y in marks], 'before': lo > 0, 'after': hi < len(text)}

def _token_hits(db, tok, ql, qf, words, k, pieces, want_fuzzy):
    seen, hits = set(), []
    for a0, text in db.execute('SELECT a, text FROM chunks WHERE token = ? ORDER BY a LIMIT 1500', (tok,)):
        for s, e, kind, _ in _spans(text, ql, qf):
            if a0 + s in seen: continue
            seen.add(a0 + s); hits.append(_hit(text, s, e, kind, [(s, e)], a0))
        strong = any(h['kind'] in ('exact', 'folded', 'together') for h in hits)
        if len(words) > 1 and not strong:
            t = _together(text, words)
            if t and a0 + t[0] not in seen: seen.add(a0 + t[0]); hits.append(_hit(text, t[0], t[1], 'together', t[2], a0))
        if want_fuzzy and pieces and not strong:
            for s, e, cost in _fuzzy_in(text, ql, qf, k, pieces):
                if a0 + s not in seen: seen.add(a0 + s); hits.append(_hit(text, s, e, 'fuzzy:%d' % cost, [(s, e)], a0))
    hits.sort(key=lambda h: (krank(h['kind']), h['a']))
    return hits

def search_contracts(db, q, limit=50, offset=0, dept='', fuzzy=None, per=PER):
    """{'total', 'approx', 'rows': [{'token', 'hit_total', 'kinds', 'hits'}]}; db from open_db(path, contracts_db) for dept filtering."""
    ql = ' '.join(q.lower().split()); qf = fold(ql); words = [w for w in ql.split() if len(w) >= 3]
    if len(ql) < 3: return {'total': 0, 'approx': False, 'rows': []}
    join, extra, args = (' JOIN m.contracts k ON k.token = c.token', ' AND k.department = ?', [dept]) if dept else ('', '', [])
    phrase = '"%s"' % ql.replace('"', '')
    base = 'FROM tri JOIN chunks c ON c.id = tri.rowid' + join + ' WHERE tri MATCH ?' + extra
    total = db.execute('SELECT COUNT(DISTINCT c.token) ' + base, [phrase] + args).fetchone()[0]
    wide = fuzzy if fuzzy is not None else total < FEW
    toks = [r[0] for r in db.execute('SELECT c.token ' + base + ' GROUP BY c.token ORDER BY COUNT(*) DESC, c.token LIMIT ? OFFSET ?', [phrase] + args + [limit if not wide else 1000, 0 if wide else offset])]
    extras, approx = [], False
    if wide:
        approx = True; have = set(toks); k = max(1, len(qf) // 6); pieces = _rare_pieces(db, ql, k)
        cand = set()
        if len(words) > 1:
            q2 = ' AND '.join('"%s"' % w.replace('"', '') for w in words)
            cand |= {r[0] for r in db.execute('SELECT c.token FROM tri JOIN chunks c ON c.id = tri.rowid' + join + ' WHERE tri MATCH ?' + extra + ' LIMIT 400', [q2] + args)}
        if pieces:
            q3 = ' OR '.join('"%s"' % t for t, _ in pieces)
            cand |= {r[0] for r in db.execute('SELECT c.token FROM tri JOIN chunks c ON c.id = tri.rowid' + join + ' WHERE tri MATCH ?' + extra + ' LIMIT 600', [q3] + args)}
        extras = sorted(cand - have)
    pieces = _rare_pieces(db, ql, max(1, len(qf) // 6)) if wide else []
    rows = []
    for tok in toks + extras:
        hs = _token_hits(db, tok, ql, qf, words, max(1, len(qf) // 6), pieces, wide)
        if not hs: continue
        kinds = {}
        for h in hs: kinds[h['kind']] = kinds.get(h['kind'], 0) + 1
        rows.append({'token': tok, 'hit_total': len(hs), 'kinds': kinds, 'hits': hs[:per]})
    if wide:
        rows.sort(key=lambda r: (krank(r['hits'][0]['kind']), -r['hit_total'], r['token']))
        total = len(rows); rows = rows[offset:offset + limit]
    return {'total': total, 'approx': approx, 'rows': rows}

def contract_hits(db, tok, q, per=60):
    """Every place the query matches inside one contract (the side panel), strongest first."""
    ql = ' '.join(q.lower().split()); qf = fold(ql); words = [w for w in ql.split() if len(w) >= 3]; k = max(1, len(qf) // 6)
    hs = _token_hits(db, tok, ql, qf, words, k, _rare_pieces(db, ql, k), True) if len(ql) >= 3 else []
    kinds = {}
    for h in hs: kinds[h['kind']] = kinds.get(h['kind'], 0) + 1
    return {'token': tok, 'hit_total': len(hs), 'kinds': kinds, 'hits': hs[:per]}

def main():
    ap = argparse.ArgumentParser(); sub = ap.add_subparsers(dest='cmd', required=True)
    b = sub.add_parser('build'); b.add_argument('--tokens', nargs='*'); b.add_argument('--sample', type=int, default=0); b.add_argument('--db', default=DB)
    q = sub.add_parser('query'); q.add_argument('q'); q.add_argument('--db', default=DB); q.add_argument('--limit', type=int, default=20)
    c = sub.add_parser('search'); c.add_argument('q'); c.add_argument('--db', default=DB); c.add_argument('--limit', type=int, default=8); c.add_argument('--dept', default='')
    c.add_argument('--contracts', default='/mnt/watch/contracts-api/contracts.db'); c.add_argument('--fuzzy', action='store_true')
    args = ap.parse_args()
    if args.cmd == 'build': return build(args)
    if args.cmd == 'search':
        t0 = time.time(); r = search_contracts(open_db(args.db, args.contracts), args.q, args.limit, 0, args.dept, True if args.fuzzy else None)
        print('%d contracts%s in %.2fs' % (r['total'], ' (approx)' if r['approx'] else '', time.time() - t0))
        for x in r['rows']:
            print(' ', x['token'], x['hit_total'], x['kinds'])
            for h in x['hits'][:2]: print('      ', h['kind'], '|', re.sub(r'\\s+', ' ', h['text'])[:150])
        return
    db = sqlite3.connect('file:%s?mode=ro' % args.db, uri=True); t0 = time.time(); hs = query(db, args.q, args.limit)
    print('%d hits in %.2fs' % (len(hs), time.time() - t0))
    for h in hs: print('  %-8s %-10s @%-7d %s' % (h['token'], h['kind'], h['a'], re.sub(r'\s+', ' ', h['text'])[:170]))

if __name__ == '__main__':
    main()
