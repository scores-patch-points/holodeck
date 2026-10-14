#!/usr/bin/env python3
"""server.py — read-only contracts API over the derived index (build_index.py).

  GET /health                         counts, index age
  GET /departments                    [{department, n}] most contracts first
  GET /contracts?dept=&q=&sort=&limit=&offset=
                                      rows + total. q is full-text over the contract's party, number,
                                      description AND the verbatim text the reading lane extracted.
  GET /contract/<token>               metadata + the reading lane's observations (clauses, figures …)
  GET /contract/<token>/pdf           the filed PDF: local copy, else archive.org twin, else ePAV; cached
  GET /contract/<token>/thumb.jpg     first page as a small JPEG (made once, cached)

The fold's work (reading, observation extraction) happened once on this host and is in the index;
a request is a lookup, so a department's whole list comes back in milliseconds. Every response
carries X-Ms, the server-side time. Bound to loopback; nginx fronts it.
"""
import json, os, re, sqlite3, subprocess, sys, threading, time, urllib.request, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DB = os.environ.get('CONTRACTS_DB', '/mnt/watch/contracts-api/contracts.db')
DATA = os.environ.get('CONTRACTS_DATA', '/mnt/watch/nashville-legistar-archive/data')
CACHE = os.environ.get('CONTRACTS_PDFCACHE', '/mnt/watch/contracts-api/pdfcache')
PORT = int(os.environ.get('PORT', sys.argv[1] if len(sys.argv) > 1 else 8840))
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
TOK = re.compile(r'^[A-Za-z0-9]{3,32}$')
THUMBS = os.environ.get('CONTRACTS_THUMBS', '/mnt/watch/contracts-api/thumbs')
os.makedirs(CACHE, exist_ok=True); os.makedirs(THUMBS, exist_ok=True)

def extracted_text(ident, limit):
    """The pipeline's own extracted text for a contract (text layer or OCR), or ''."""
    if not ident or '/' in ident: return ''
    p = os.path.join(DATA, 'deployed', ident, 'extracted-text.txt')
    try:
        with open(p, encoding='utf-8', errors='replace') as f: t = f.read(limit)
        return t if len(t.strip()) >= 40 else ''
    except OSError:
        return ''

_local = threading.local()
def conn():
    c = getattr(_local, 'c', None)
    if c is None:
        c = sqlite3.connect('file:' + DB + '?mode=ro', uri=True, timeout=30, check_same_thread=False)
        c.row_factory = sqlite3.Row
        _local.c = c
    return c

def fts(q):
    words = re.findall(r'[\w][\w.\-]*', q or '', re.U)
    words = [w.replace('"', '') for w in words if w][:8]
    return ' '.join('"%s"%s' % (w, '*' if i == len(words) - 1 else '') for i, w in enumerate(words)) if words else ''

_dept = {'t': 0, 'v': None}
def departments():
    st = os.stat(DB).st_mtime
    if _dept['v'] is None or _dept['t'] != st:
        r = conn().execute("SELECT department, COUNT(*) n FROM contracts WHERE department != '' GROUP BY department ORDER BY n DESC").fetchall()
        _dept['v'] = [{'department': x['department'], 'n': x['n']} for x in r]; _dept['t'] = st
    return _dept['v']

SORTS = {'party': 'c.party COLLATE NOCASE ASC', 'number': 'c.number ASC', 'expires': "substr(c.expires,-4) DESC, c.expires DESC", 'recent': 'c.fetched_at DESC'}
def row(x): return {'token': x['token'], 'number': x['number'], 'party': x['party'], 'department': x['department'], 'description': x['description'],
                    'expires': x['expires'], 'status': x['status'], 'archived': bool(x['archive_url']), 'archive_url': x['archive_url'], 'destroyed': bool(x['destroyed'])}

def search(p):
    dept = (p.get('dept') or [''])[0]; q = (p.get('q') or [''])[0].strip()
    sort = SORTS.get((p.get('sort') or ['party'])[0], SORTS['party'])
    limit = max(1, min(int((p.get('limit') or ['50'])[0]), 200)); offset = max(0, int((p.get('offset') or ['0'])[0]))
    where, args = [], []
    if dept: where.append('c.department = ?'); args.append(dept)
    if q:
        m = fts(q)
        if m:
            where.append('(c.rowid IN (SELECT rowid FROM contracts_fts WHERE contracts_fts MATCH ?) OR c.token IN '
                         '(SELECT o.token FROM obs o WHERE o.id IN (SELECT rowid FROM obs_fts WHERE obs_fts MATCH ? LIMIT 20000)))')
            args += [m, m]
    w = (' WHERE ' + ' AND '.join(where)) if where else ''
    c = conn()
    total = c.execute('SELECT COUNT(*) FROM contracts c' + w, args).fetchone()[0]
    rs = c.execute('SELECT c.* FROM contracts c' + w + ' ORDER BY ' + sort + ' LIMIT ? OFFSET ?', args + [limit, offset]).fetchall()
    out = [row(x) for x in rs]
    idents = {x['token']: x['identifier'] for x in rs}
    # what the reading lane holds for each row: how many observations, and the opening of the reading as a
    # gist — enough for the reader to show real statements on a card without a request per contract.
    for r in out:
        r['obs'] = c.execute('SELECT COUNT(*) FROM obs WHERE token=?', (r['token'],)).fetchone()[0]
        r['gist'] = ''; r['read'] = ''
        if r['obs']:
            g = ' '.join(o[0] for o in c.execute('SELECT verbatim FROM obs WHERE token=? ORDER BY a LIMIT 14', (r['token'],)).fetchall())
            r['gist'] = re.sub(r'\s+', ' ', g)[:1600]; r['read'] = 'ledger'
        else:
            # read as text (a text layer, or the OCR lane) but the deterministic extractor found no clause rows
            t = extracted_text(idents.get(r['token']), 4000)
            if t: r['gist'] = re.sub(r'\s+', ' ', t)[:1600]; r['read'] = 'text'
    return {'total': total, 'offset': offset, 'limit': limit, 'rows': out}

def detail(tok):
    c = conn(); x = c.execute('SELECT * FROM contracts WHERE token=?', (tok,)).fetchone()
    if not x: return None
    obs = c.execute('SELECT kind, a, b, verbatim, fields FROM obs WHERE token=? ORDER BY a LIMIT 1000', (tok,)).fetchall()
    out = row(x); out['epav_url'] = x['epav_url']
    out['observations'] = [{'kind': o['kind'], 'at': [o['a'], o['b']], 'verbatim': o['verbatim'], 'fields': json.loads(o['fields'] or '{}')} for o in obs]
    out['text'] = extracted_text(x['identifier'], 60000)
    out['read'] = 'ledger' if obs else ('text' if out['text'] else '')
    return out

def grab(url, timeout=25):
    try:
        r = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=timeout)
        b = r.read()
        return b if b[:5] == b'%PDF-' else None
    except Exception:
        return None

_pdf_lock = threading.Lock()
def pdf_path(tok):
    """A file path to the contract's PDF (cache, VM-local, else fetched into the cache), or None."""
    cp = os.path.join(CACHE, tok + '.pdf')
    if os.path.exists(cp): return cp
    lp = os.path.join(DATA, '.epav-local', tok, 'source.pdf')
    if os.path.exists(lp): return lp
    b, _ = pdf_bytes(tok)
    return cp if b else None

_thumb_sem = threading.BoundedSemaphore(4)
_thumb_miss = {}
def thumb_path(tok):
    tp = os.path.join(THUMBS, tok + '.jpg')
    if os.path.exists(tp): return tp
    if _thumb_miss.get(tok, 0) > time.time(): return None
    with _thumb_sem:
        if os.path.exists(tp): return tp
        src = pdf_path(tok)
        if src:
            try:
                subprocess.run(['pdftoppm', '-jpeg', '-jpegopt', 'quality=72', '-f', '1', '-l', '1', '-scale-to-x', '360', '-scale-to-y', '-1', '-singlefile', src, os.path.join(THUMBS, tok)],
                               check=True, timeout=40, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            except Exception:
                pass
        if os.path.exists(tp): return tp
        _thumb_miss[tok] = time.time() + 600   # don't re-fetch a PDF that is not there yet on every card paint
        return None

def pdf_bytes(tok):
    cp = os.path.join(CACHE, tok + '.pdf')
    if os.path.exists(cp): return open(cp, 'rb').read(), 'cache'
    lp = os.path.join(DATA, '.epav-local', tok, 'source.pdf')
    if os.path.exists(lp): return open(lp, 'rb').read(), 'vm-local'
    b = grab('https://archive.org/download/nashville-epav-contract-%s/%s.pdf' % (tok, tok)); via = 'archive.org'
    if not b: b = grab('http://documents.nashville.gov/Request/Open/%s?source=Contracts&sourceAppId=14&isArchived=True' % tok); via = 'ePAV'
    if not b: return None, None
    tmp = cp + '.%d.tmp' % os.getpid()
    with _pdf_lock:
        open(tmp, 'wb').write(b); os.replace(tmp, cp)
    return b, via

class H(BaseHTTPRequestHandler):
    server_version = 'contracts-api'
    def log_message(self, f, *a): sys.stderr.write('%s %s\n' % (self.address_string(), f % a))
    def send(self, code, body, ctype='application/json; charset=utf-8', extra=None, t0=None):
        if isinstance(body, (dict, list)): body = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', ctype); self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*'); self.send_header('Cache-Control', 'public, max-age=30')
        if t0 is not None: self.send_header('X-Ms', '%.1f' % ((time.time() - t0) * 1000))
        for k, v in (extra or {}).items(): self.send_header(k, v)
        self.end_headers(); self.wfile.write(body)
    def do_OPTIONS(self): self.send(204, b'', 'text/plain')
    def do_GET(self):
        t0 = time.time(); u = urllib.parse.urlparse(self.path); p = urllib.parse.parse_qs(u.query); path = u.path.rstrip('/') or '/'
        try:
            if path == '/health':
                c = conn(); m = dict(c.execute('SELECT k, v FROM meta').fetchall())
                return self.send(200, {'ok': True, 'contracts': int(m.get('contracts', 0)), 'observations': c.execute('SELECT COUNT(*) FROM obs').fetchone()[0], 'built_at': m.get('built_at')}, t0=t0)
            if path == '/departments': return self.send(200, departments(), t0=t0)
            if path == '/contracts': return self.send(200, search(p), t0=t0)
            m = re.match(r'^/contract/([A-Za-z0-9]+)(/pdf|/thumb\.jpg)?$', path)
            if m and TOK.match(m.group(1)):
                if m.group(2) == '/thumb.jpg':
                    tp = thumb_path(m.group(1))
                    if not tp: return self.send(404, {'error': 'no thumbnail yet'}, extra={'Cache-Control': 'public, max-age=300'}, t0=t0)
                    return self.send(200, open(tp, 'rb').read(), 'image/jpeg', {'Cache-Control': 'public, max-age=604800, immutable'}, t0=t0)
                if m.group(2):
                    b, via = pdf_bytes(m.group(1))
                    if not b: return self.send(404, {'error': 'no PDF for ' + m.group(1) + ' yet (not on archive.org or ePAV)'}, t0=t0)
                    return self.send(200, b, 'application/pdf', {'X-Source': via, 'Cache-Control': 'public, max-age=86400'}, t0=t0)
                d = detail(m.group(1))
                return self.send(200, d, t0=t0) if d else self.send(404, {'error': 'unknown contract'}, t0=t0)
            return self.send(404, {'error': 'not found'}, t0=t0)
        except sqlite3.OperationalError as e:
            return self.send(503, {'error': 'index not ready: ' + str(e)}, t0=t0)
        except Exception as e:
            return self.send(500, {'error': str(e)}, t0=t0)

if __name__ == '__main__':
    s = ThreadingHTTPServer(('127.0.0.1', PORT), H); s.daemon_threads = True
    print('contracts-api on 127.0.0.1:%d  db=%s' % (PORT, DB), flush=True); s.serve_forever()
