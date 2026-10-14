#!/usr/bin/env python3
"""pregen_thumbs.py — make the first-page thumbnails (and cache the PDFs) ahead of anyone asking.

Uses the API's own thumb_path(), so a thumbnail made here is the one the API serves. One department
(--dept), or everything (default), most recently fetched first. Idempotent: existing thumbnails are skipped.

Usage: pregen_thumbs.py [--dept NAME ...] [--workers 4]
"""
import argparse, os, sqlite3, sys, time
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('PORT', '0')   # server.py reads a port from argv; this is not a listener
import server  # noqa: E402  (defines thumb_path / pdf_path; does not start a listener)

ap = argparse.ArgumentParser(); ap.add_argument('--dept', action='append'); ap.add_argument('--workers', type=int, default=4)
a = ap.parse_args()
db = sqlite3.connect('file:' + server.DB + '?mode=ro', uri=True)
q = "SELECT token FROM contracts WHERE destroyed = 0"
args = []
if a.dept: q += ' AND department IN (%s)' % ','.join('?' * len(a.dept)); args = a.dept
toks = [r[0] for r in db.execute(q + ' ORDER BY fetched_at DESC', args) if not os.path.exists(os.path.join(server.THUMBS, r[0] + '.jpg'))]
print('pregen_thumbs: %d to make' % len(toks), flush=True)
t0 = time.time(); n = ok = 0
def one(t):
    global n, ok
    p = server.thumb_path(t); n += 1; ok += 1 if p else 0
    if n % 100 == 0: print('  %d/%d (%d made) %.1f/s' % (n, len(toks), ok, n / (time.time() - t0)), flush=True)
with ThreadPoolExecutor(max_workers=a.workers) as ex: list(ex.map(one, toks))
print('pregen_thumbs: done %d made of %d in %.0fs' % (ok, len(toks), time.time() - t0), flush=True)
