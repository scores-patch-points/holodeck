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
  GET /contract/<token>/layout        the pages' text with its boxes (build_layouts.py): paints before the PDF arrives
  GET /contract/<token>/related       what this contract is related to: vendor, signers, similar topics, department, prior/next
  GET /export.csv?<filters>           every contract matching the filters as CSV (UTF-8 with BOM, opens in Excel)
  GET /pivot?rows=&cols=&measure=&<filters>   a pivot table computed here: rows x cols of count / sum / avg / max amount / vendors
  GET /dims                           the fields a pivot can group by
  filters (contracts, export, pivot): dept (repeatable), q, and any dimension as its own parameter, e.g. year=2027&read=unread

The fold's work (reading, observation extraction) happened once on this host and is in the index;
a request is a lookup, so a department's whole list comes back in milliseconds. Every response
carries X-Ms, the server-side time. Bound to loopback; nginx fronts it.
"""
import csv, io, json, os, re, sqlite3, subprocess, sys, threading, time, urllib.request, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DB = os.environ.get('CONTRACTS_DB', '/mnt/watch/contracts-api/contracts.db')
DATA = os.environ.get('CONTRACTS_DATA', '/mnt/watch/nashville-legistar-archive/data')
CACHE = os.environ.get('CONTRACTS_PDFCACHE', '/mnt/watch/contracts-api/pdfcache')
PORT = int(os.environ.get('PORT', sys.argv[1] if len(sys.argv) > 1 else 8840))
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
TOK = re.compile(r'^[A-Za-z0-9]{3,32}$')
THUMBS = os.environ.get('CONTRACTS_THUMBS', '/mnt/watch/contracts-api/thumbs')
LAYOUT = os.environ.get('CONTRACTS_LAYOUT', '/mnt/watch/contracts-api/layout')
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
        r = conn().execute("SELECT department, COUNT(*) n FROM contracts WHERE department != '' GROUP BY department ORDER BY department COLLATE NOCASE").fetchall()
        _dept['v'] = [{'department': x['department'], 'n': x['n']} for x in r]; _dept['t'] = st
    return _dept['v']

BANDS = ('no amount found', '< $10k', '$10k–50k', '$50k–250k', '$250k–1M', '$1M+')
DIMS = {
    'department':  ('Department', "c.department"),
    'vendor':      ('Vendor', "c.party"),
    'year':        ('Expiry year', "CASE WHEN c.expires GLOB '*[12][09][0-9][0-9]' THEN substr(c.expires, -4) ELSE 'unknown' END"),
    'status':      ('Status', "COALESCE(NULLIF(c.status, ''), 'unknown')"),
    'read':        ('Reading', "CASE COALESCE(g.read, '') WHEN 'ledger' THEN 'read (clauses)' WHEN 'text' THEN 'read (text)' ELSE 'unread' END"),
    'archive':     ('Archive.org', "CASE WHEN c.archive_url != '' THEN 'on archive.org' ELSE 'pending' END"),
    'amount_band': ('Largest amount found', "CASE WHEN COALESCE(g.amount, 0) = 0 THEN 'no amount found' WHEN g.amount < 10000 THEN '< $10k' WHEN g.amount < 50000 THEN '$10k–50k' WHEN g.amount < 250000 THEN '$50k–250k' WHEN g.amount < 1000000 THEN '$250k–1M' ELSE '$1M+' END"),
    'series':      ('Number series', "CASE WHEN c.number GLOB '[A-Za-z]*' THEN upper(substr(c.number, 1, 1)) ELSE 'numeric' END"),
}
MEASURES = {
    'count':   ('Contracts', 'COUNT(*)'),
    'amount':  ('Sum of largest amounts', 'ROUND(SUM(COALESCE(g.amount, 0)))'),
    'avg':     ('Average largest amount', 'ROUND(AVG(NULLIF(g.amount, 0)))'),
    'max':     ('Largest amount', 'ROUND(MAX(g.amount))'),
    'vendors': ('Distinct vendors', 'COUNT(DISTINCT c.party)'),
}
FROM = ' FROM contracts c LEFT JOIN gist g ON g.token = c.token'

def where_of(p):
    """The filters every list, export and pivot share: department(s), a text query, any dimension as its own parameter."""
    where, args = [], []
    depts = [d for d in (p.get('dept') or []) if d]
    if depts: where.append('c.department IN (%s)' % ','.join('?' * len(depts))); args += depts
    q = (p.get('q') or [''])[0].strip()
    if q:
        m = fts(q)
        if m: where.append('c.token IN (SELECT value FROM json_each(?))'); args.append(json.dumps(match_tokens(m)))
    for k, (_label, expr) in DIMS.items():
        if k == 'department': continue
        for v in (p.get(k) or []):
            if v != '': where.append('(%s) = ?' % expr); args.append(v)
    return (' WHERE ' + ' AND '.join(where)) if where else '', args

SORTS = {'party': 'c.party COLLATE NOCASE ASC', 'number': 'c.number ASC', 'expires': "substr(c.expires,-4) DESC, c.expires DESC", 'recent': 'c.fetched_at DESC'}
def row(x): return {'token': x['token'], 'number': x['number'], 'party': x['party'], 'department': x['department'], 'description': x['description'],
                    'expires': x['expires'], 'status': x['status'], 'archived': bool(x['archive_url']), 'archive_url': x['archive_url'], 'destroyed': bool(x['destroyed'])}

_mt = {}
def match_tokens(m):
    """Every contract a full-text expression hits: its own fields OR any observation of the reading. Computed once per
    expression and index build (the same term is asked again for another department, page or sort), then handed to
    SQL as a set; one pass over the observation index beats re-running it inside a per-row subquery (measured 100x)."""
    k = (m, int(os.stat(DB).st_mtime))
    r = _mt.get(k)
    if r is None:
        if len(_mt) > 128: _mt.clear()
        c = conn()
        ids = {x[0] for x in c.execute('SELECT c.token FROM contracts c WHERE c.rowid IN (SELECT rowid FROM contracts_fts WHERE contracts_fts MATCH ?)', (m,))}
        ids |= {x[0] for x in c.execute('SELECT DISTINCT o.token FROM obs_fts f JOIN obs o ON o.id = f.rowid WHERE obs_fts MATCH ?', (m,))}
        r = _mt[k] = sorted(ids)
    return r

_rc = {}
def search(p):
    """Cached per (query, index build): the same department page is asked for again and again."""
    k = (urllib.parse.urlencode(sorted((a, tuple(b)) for a, b in p.items())), int(os.stat(DB).st_mtime))
    r = _rc.get(k)
    if r is None:
        if len(_rc) > 400: _rc.clear()
        r = _rc[k] = _search(p)
    return r

def _search(p):
    sort = SORTS.get((p.get('sort') or ['party'])[0], SORTS['party'])
    limit = max(1, min(int((p.get('limit') or ['50'])[0]), 200)); offset = max(0, int((p.get('offset') or ['0'])[0]))
    w, args = where_of(p); c = conn()
    total = c.execute('SELECT COUNT(*)' + FROM + w, args).fetchone()[0]
    rs = c.execute('SELECT c.*, g.obs_n, g.gist, g.read, g.amount' + FROM + w + ' ORDER BY ' + sort + ' LIMIT ? OFFSET ?', args + [limit, offset]).fetchall()
    # obs / gist / read come from the index (build_index.py keeps them current), not from lookups per row
    out = []
    for x in rs:
        r = row(x); r['obs'] = x['obs_n'] or 0; r['gist'] = x['gist'] or ''; r['read'] = x['read'] or ''; r['amount'] = x['amount'] or None
        out.append(r)
    return {'total': total, 'offset': offset, 'limit': limit, 'rows': out}

def export_csv(p):
    sort = SORTS.get((p.get('sort') or ['party'])[0], SORTS['party'])
    w, args = where_of(p)
    rs = conn().execute('SELECT c.*, g.read, g.amount' + FROM + w + ' ORDER BY ' + sort + ' LIMIT 100000', args).fetchall()
    buf = io.StringIO(); wr = csv.writer(buf)
    wr.writerow(['contract_number', 'vendor', 'department', 'description', 'expires', 'status', 'reading', 'largest_amount_found', 'on_archive_org', 'archive_url', 'epav_token'])
    for x in rs:
        wr.writerow([x['number'], x['party'], x['department'], x['description'], x['expires'], x['status'], x['read'] or 'unread',
                     int(x['amount']) if x['amount'] else '', 'yes' if x['archive_url'] else 'no', x['archive_url'], x['token']])
    return '\ufeff' + buf.getvalue(), len(rs)

def pivot(p):
    rk = (p.get('rows') or ['department'])[0]; ck = (p.get('cols') or [''])[0]; mk = (p.get('measure') or ['count'])[0]
    if rk not in DIMS or (ck and ck not in DIMS) or mk not in MEASURES: raise ValueError('unknown rows/cols/measure')
    rexp = DIMS[rk][1]; cexp = DIMS[ck][1] if ck else "'All'"; mexp = MEASURES[mk][1]
    w, args = where_of(p); c = conn()
    cells = {}; rtot = {}; ctot = {}
    for r_, c_, v in c.execute('SELECT %s, %s, %s%s%s GROUP BY 1, 2' % (rexp, cexp, mexp, FROM, w), args): cells[(r_, c_)] = v
    for r_, v in c.execute('SELECT %s, %s%s%s GROUP BY 1' % (rexp, mexp, FROM, w), args): rtot[r_] = v
    if ck:
        for c_, v in c.execute('SELECT %s, %s%s%s GROUP BY 1' % (cexp, mexp, FROM, w), args): ctot[c_] = v
    grand = c.execute('SELECT %s%s%s' % (mexp, FROM, w), args).fetchone()[0]
    n = c.execute('SELECT COUNT(*)' + FROM + w, args).fetchone()[0]
    def order(labels, dim, tot):
        if dim == 'amount_band': return sorted(labels, key=lambda x: BANDS.index(x) if x in BANDS else 99)
        if dim == 'year': return sorted(labels)
        return sorted(labels, key=lambda x: (-(tot.get(x) or 0), str(x)))
    rl = order(list(rtot), rk, rtot); cl = order(list(ctot), ck, ctot) if ck else ['All']
    trunc = {'rows': len(rl) > 300, 'cols': len(cl) > 24}; rl, cl = rl[:300], cl[:24]
    return {'rows': rk, 'cols': ck or None, 'measure': mk, 'measure_label': MEASURES[mk][0], 'row_label': DIMS[rk][0], 'col_label': DIMS[ck][0] if ck else None,
            'contracts': n, 'row_labels': rl, 'col_labels': cl, 'cells': [[cells.get((r_, c_)) for c_ in cl] for r_ in rl],
            'row_totals': [rtot.get(r_) for r_ in rl], 'col_totals': [ctot.get(c_) for c_ in cl] if ck else None, 'grand': grand, 'truncated': trunc,
            'note': 'Amounts are the largest dollar figure the reading found in each contract, not an audited contract value.' if mk in ('amount', 'avg', 'max') else ''}

STOPWORDS = set('and the for with of to in on at by or a an agreement contract services service amendment inc llc co corp'.split())
def _date_key(s):
    m = re.match(r'^(\d{1,2})/(\d{1,2})/(\d{4})$', (s or '').strip())
    return (int(m.group(3)), int(m.group(1)), int(m.group(2))) if m else None

def _brief(x): return {'token': x['token'], 'number': x['number'], 'party': x['party'], 'description': x['description'], 'expires': x['expires'], 'department': x['department']}

def _amount(c, tok):
    best = None
    for (f,) in c.execute("SELECT fields FROM obs WHERE token=? AND kind='amount'", (tok,)):
        m = re.search(r'\$(\d[\d,]*(?:\.\d+)?)', json.loads(f or '{}').get('amount', '') or '')
        if m:
            v = float(m.group(1).replace(',', ''))
            if best is None or v > best: best = v
    return best

def related(tok):
    """Related contracts, each with the reason it is related, none of it inferred: same vendor string, same department,
    a signer's e-mail on both, words of the description shared (full-text), and the vendor's own sequence by expiry."""
    c = conn(); me = c.execute('SELECT * FROM contracts WHERE token=?', (tok,)).fetchone()
    if not me: return None
    out = {'token': tok}
    # same vendor
    if me['party']:
        rows = c.execute('SELECT * FROM contracts WHERE party=? COLLATE NOCASE AND token!=? ORDER BY substr(expires,-4) DESC, expires DESC', (me['party'], tok)).fetchall()
        out['vendor'] = {'label': me['party'], 'total': len(rows), 'items': [_brief(x) for x in rows[:6]]}
    # same department (a count and a way in, not a list)
    if me['department']:
        out['department'] = {'name': me['department'], 'total': c.execute('SELECT COUNT(*) FROM contracts WHERE department=?', (me['department'],)).fetchone()[0]}
    # same signers
    sg = []
    for name, email in c.execute('SELECT name, email FROM signers WHERE token=?', (tok,)).fetchall():
        rs = c.execute('SELECT DISTINCT c.* FROM signers s JOIN contracts c ON c.token = s.token WHERE s.email=? AND s.token!=? ORDER BY substr(c.expires,-4) DESC LIMIT 40', (email, tok)).fetchall()
        if rs: sg.append({'name': name, 'email': email, 'total': len(rs), 'items': [_brief(x) for x in rs[:5]]})
    out['signers'] = sg
    # similar topics: the description's own words, matched against other contracts' fields (best match first)
    words = [w for w in dict.fromkeys(re.findall(r'[A-Za-z]{4,}', me['description'] or '')) if w.lower() not in STOPWORDS][:6]
    if words:
        expr = ' OR '.join('"%s"' % w for w in words)
        try:
            rs = c.execute('SELECT c.* FROM contracts_fts f JOIN contracts c ON c.rowid = f.rowid WHERE contracts_fts MATCH ? AND c.token != ? AND c.party != ? ORDER BY bm25(contracts_fts) LIMIT 6',
                           (expr, tok, me['party'] or '')).fetchall()
        except sqlite3.OperationalError:
            rs = []
        out['topics'] = {'words': words, 'items': [_brief(x) for x in rs]}
    # prior / subsequent in this vendor's own sequence, by expiry
    mine = _date_key(me['expires'])
    if mine and me['party']:
        seq = [(k, x) for x in c.execute('SELECT * FROM contracts WHERE party=? COLLATE NOCASE AND token!=?', (me['party'], tok)) for k in [_date_key(x['expires'])] if k]
        prior = max((p for p in seq if p[0] <= mine), key=lambda p: p[0], default=None)
        nxt = min((p for p in seq if p[0] > mine), key=lambda p: p[0], default=None)
        def card(x): d = _brief(x['x'] if isinstance(x, dict) else x); d['amount'] = _amount(c, d['token']); return d
        out['lineage'] = {'basis': "this vendor's contracts, ordered by expiry", 'self': dict(_brief(me), amount=_amount(c, tok)),
                          'prior': card(prior[1]) if prior else None, 'next': card(nxt[1]) if nxt else None}
    return out

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
            if path == '/dims': return self.send(200, {'dims': [{'key': k, 'label': v[0]} for k, v in DIMS.items()], 'measures': [{'key': k, 'label': v[0]} for k, v in MEASURES.items()]}, t0=t0)
            if path == '/pivot':
                try: return self.send(200, pivot(p), t0=t0)
                except ValueError as e: return self.send(400, {'error': str(e)}, t0=t0)
            if path == '/export.csv':
                text, n = export_csv(p); dn = (p.get('dept') or [''])[0] if len(p.get('dept') or []) == 1 else ''
                fn = 'metro-contracts' + ('-' + re.sub(r'[^A-Za-z0-9]+', '-', dn).strip('-').lower() if dn else '') + '.csv'
                return self.send(200, text.encode('utf-8'), 'text/csv; charset=utf-8', {'Content-Disposition': 'attachment; filename="%s"' % fn, 'X-Rows': str(n), 'Cache-Control': 'no-store'}, t0=t0)
            if path == '/contracts': return self.send(200, search(p), t0=t0)
            m = re.match(r'^/contract/([A-Za-z0-9]+)(/pdf|/thumb\.jpg|/layout|/related)?$', path)
            if m and TOK.match(m.group(1)):
                if m.group(2) == '/related':
                    r = related(m.group(1))
                    return self.send(200, r, t0=t0) if r else self.send(404, {'error': 'unknown contract'}, t0=t0)
                if m.group(2) == '/layout':
                    lp = os.path.join(LAYOUT, m.group(1) + '.json')
                    if not os.path.exists(lp): return self.send(404, {'error': 'no layout yet'}, extra={'Cache-Control': 'public, max-age=60'}, t0=t0)
                    return self.send(200, open(lp, 'rb').read(), extra={'Cache-Control': 'public, max-age=3600'}, t0=t0)
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
