#!/usr/bin/env python3
"""build_index.py — derive the contracts SQLite index from the pipeline's own files.

Reads (never writes) the Metro contract DB data dir on the VM:
  epav-fetched.jsonl     one row per fetched contract: party, department, description, archive_url …
  contract-ledger.jsonl  the reading lane's verbatim observations per contract (clauses, figures, parties …)

and keeps a derived index (contracts.db) that tools/contracts-api/server.py serves. The index is
disposable: delete it and the next run rebuilds it from the two files. The ledger is append-only,
so it is read incrementally from the byte offset stored in `meta`; if the file ever shrinks the
observations are rebuilt from zero.

Usage: build_index.py [--data DIR] [--db FILE]
"""
import argparse, json, os, sqlite3, sys, time

ap = argparse.ArgumentParser()
ap.add_argument('--data', default='/mnt/watch/nashville-legistar-archive/data')
ap.add_argument('--db', default='/mnt/watch/contracts-api/contracts.db')
a = ap.parse_args()

os.makedirs(os.path.dirname(a.db), exist_ok=True)
db = sqlite3.connect(a.db, timeout=60)
db.execute('PRAGMA journal_mode=WAL'); db.execute('PRAGMA synchronous=NORMAL')
db.executescript('''
CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE IF NOT EXISTS contracts(
  token TEXT PRIMARY KEY, number TEXT, party TEXT, department TEXT, description TEXT,
  expires TEXT, status TEXT, archive_url TEXT, identifier TEXT, destroyed INTEGER, fetched_at TEXT, epav_url TEXT);
CREATE INDEX IF NOT EXISTS contracts_dept ON contracts(department);
CREATE INDEX IF NOT EXISTS contracts_party ON contracts(party);
CREATE TABLE IF NOT EXISTS obs(
  id INTEGER PRIMARY KEY, token TEXT, kind TEXT, a INTEGER, b INTEGER, verbatim TEXT, fields TEXT);
CREATE INDEX IF NOT EXISTS obs_token ON obs(token);
CREATE TABLE IF NOT EXISTS gist(token TEXT PRIMARY KEY, obs_n INTEGER, gist TEXT, read TEXT);
CREATE TABLE IF NOT EXISTS signers(token TEXT, name TEXT, email TEXT);
CREATE INDEX IF NOT EXISTS signers_tok ON signers(token);
CREATE INDEX IF NOT EXISTS signers_email ON signers(email);
CREATE TABLE IF NOT EXISTS signers_done(token TEXT PRIMARY KEY, mtime REAL);
CREATE VIRTUAL TABLE IF NOT EXISTS obs_fts USING fts5(verbatim, content='obs', content_rowid='id', tokenize='porter unicode61');
''')

def meta_get(k, d=None):
    r = db.execute('SELECT v FROM meta WHERE k=?', (k,)).fetchone(); return r[0] if r else d
def meta_set(k, v): db.execute('INSERT OR REPLACE INTO meta(k,v) VALUES(?,?)', (k, str(v)))

t0 = time.time()

# ---- contracts: full refresh (25 MB, seconds) ----
rows = []
with open(os.path.join(a.data, 'epav-fetched.jsonl'), encoding='utf-8') as f:
    for line in f:
        try: d = json.loads(line)
        except ValueError: continue
        tok = d.get('epav_token')
        if not tok: continue
        rows.append((tok, d.get('contract_number') or '', d.get('contracting_party') or '', d.get('department') or d.get('source_department_query') or '',
                     d.get('description') or '', d.get('expiration_date') or '', d.get('status') or '', d.get('archive_url') or '', d.get('identifier') or '',
                     1 if str(d.get('destroyed_per_retention_schedule')).lower() == 'true' else 0, d.get('fetched_at') or '', d.get('epav_url') or ''))
db.execute('BEGIN')
db.executemany('INSERT OR REPLACE INTO contracts VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', rows)
db.execute('DROP TABLE IF EXISTS contracts_fts')
db.execute("CREATE VIRTUAL TABLE contracts_fts USING fts5(number, party, description, department, content='contracts', content_rowid='rowid', tokenize='porter unicode61')")
db.execute('INSERT INTO contracts_fts(rowid, number, party, description, department) SELECT rowid, number, party, description, department FROM contracts')
meta_set('contracts', len(rows)); db.commit()

# ---- observations: incremental from the append-only ledger ----
lp = os.path.join(a.data, 'contract-ledger.jsonl')
size = os.path.getsize(lp); off = int(meta_get('ledger_offset', 0))
if size < off:  # file was rewritten: start over
    db.execute('DELETE FROM obs'); db.execute("INSERT INTO obs_fts(obs_fts) VALUES('delete-all')"); off = 0
n = 0; touched = set()
with open(lp, 'rb') as f:
    f.seek(off)
    batch = []
    def flush():
        global batch
        if not batch: return
        db.execute('BEGIN')
        for tok, kind, a0, b0, ver, flds in batch:
            touched.add(tok)
            cur = db.execute('INSERT INTO obs(token,kind,a,b,verbatim,fields) VALUES (?,?,?,?,?,?)', (tok, kind, a0, b0, ver, flds))
            db.execute('INSERT INTO obs_fts(rowid, verbatim) VALUES (?,?)', (cur.lastrowid, ver))
        db.commit(); batch = []
    while True:
        line = f.readline()
        if not line: break
        if not line.endswith(b'\n'): break           # a half-written last line: pick it up next run
        off += len(line)
        try: d = json.loads(line)
        except ValueError: continue
        tok = d.get('epav_token')
        if not tok: continue
        at = d.get('at') or [None, None]
        batch.append((tok, d.get('kind') or '', at[0], at[1] if len(at) > 1 else None, d.get('verbatim') or '', json.dumps(d.get('fields') or {}, ensure_ascii=False)))
        n += 1
        if len(batch) >= 5000: flush()
    flush()
# ---- gist: per contract, how many observations and the opening of the reading (what a card shows) ----
# Kept in its own table so a list is one indexed SELECT, not two lookups per row. Refreshed for contracts whose
# observations just arrived and for any not read as ledger yet (their extracted text may have appeared: OCR lane).
import re
ident = dict(db.execute('SELECT token, identifier FROM contracts'))
have = dict(db.execute('SELECT token, read FROM gist'))
todo = set(touched) | {t for t in ident if have.get(t) != 'ledger'}
db.execute('BEGIN'); gn = 0
for tok in todo:
    if tok not in ident: continue
    n_obs = db.execute('SELECT COUNT(*) FROM obs WHERE token=?', (tok,)).fetchone()[0]
    g, rd = '', ''
    if n_obs:
        g = re.sub(r'\s+', ' ', ' '.join(r[0] for r in db.execute('SELECT verbatim FROM obs WHERE token=? ORDER BY a LIMIT 14', (tok,))))[:1600]; rd = 'ledger'
    else:
        tp = os.path.join(a.data, 'deployed', ident[tok] or '-', 'extracted-text.txt')
        try:
            with open(tp, encoding='utf-8', errors='replace') as fh: t = fh.read(4000)
            if len(t.strip()) >= 40: g = re.sub(r'\s+', ' ', t)[:1600]; rd = 'text'
        except OSError:
            pass
    if (have.get(tok), ) != (rd,) or tok in touched or g:
        db.execute('INSERT OR REPLACE INTO gist VALUES (?,?,?,?)', (tok, n_obs, g, rd)); gn += 1
db.commit()
# ---- signers: who signed, from the DocuSign certificate's "Signer Events" block (deterministic: a name line above
# an e-mail line). Only for contracts whose text changed since last run. Read as: this person's e-mail appears
# as a signer of this contract; nothing is inferred beyond that. ----
EMAIL = re.compile(r'^[\w.+\-]+@[\w\-]+(?:\.[\w\-]+)+$')
STOP = re.compile(r'^(in person signer events|editor delivery events|agent delivery events|intermediary delivery events|'
                  r'certified delivery events|carbon copy events|witness events|notary events|envelope summary events|payment events)', re.I)
SKIP = re.compile(r'^(signature|timestamp|signer events|\(none\)|sent|viewed|signed|accepted|resent|status|security level|using ip address)', re.I)
def signers_of(text):
    ls = [l.strip() for l in text.splitlines()]; out = {}
    for i, l in enumerate(ls):
        if l.lower() != 'signer events': continue
        j = i + 1
        while j < len(ls) and not STOP.match(ls[j]):
            if EMAIL.match(ls[j]):
                k = j - 1
                while k > i and not ls[k]: k -= 1
                nm = ls[k] if k > i else ''
                if nm and not SKIP.match(nm) and 2 <= len(nm.split()) <= 5 and re.match(r"^[A-Za-z][A-Za-z.'\- ]+$", nm): out[ls[j].lower()] = nm
            j += 1
        break
    return out
done = dict(db.execute('SELECT token, mtime FROM signers_done'))
db.execute('BEGIN'); sn = 0
for tok, idn in ident.items():
    tp = os.path.join(a.data, 'deployed', idn or '-', 'extracted-text.txt')
    try: mt = os.path.getmtime(tp)
    except OSError: continue
    if done.get(tok) == mt: continue
    try:
        with open(tp, encoding='utf-8', errors='replace') as fh: txt = fh.read()
    except OSError: continue
    db.execute('DELETE FROM signers WHERE token=?', (tok,))
    for em, nm in signers_of(txt).items(): db.execute('INSERT INTO signers VALUES (?,?,?)', (tok, nm, em)); sn += 1
    db.execute('INSERT OR REPLACE INTO signers_done VALUES (?,?)', (tok, mt))
db.commit()
meta_set('ledger_offset', off); meta_set('built_at', time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())); db.commit()
print(json.dumps({'contracts': len(rows), 'gists_refreshed': gn, 'signers_added': sn, 'new_observations': n, 'ledger_offset': off, 'seconds': round(time.time() - t0, 1)}))
