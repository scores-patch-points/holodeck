#!/usr/bin/env python3
"""searchable.py — give every scanned page of a contract's PDF an invisible OCR text layer, so a PDF viewer's own
find (the reader's Original view, PDF.js) finds the words on the page they are printed on.

The captured page is never replaced: its image and its own text are copied byte for byte, and the OCR words are ADDED on
top in invisible ink (render mode 3), each at the box tesseract read it from. The layered copy is written beside the
captured one (searchable/<token>.pdf); the captured PDF stays exactly as it was filed, and the API serves the layered copy
only when asked (?layer=ocr).

Which pages: extract_text.needs_ocr — a page whose text layer is empty, or short with images over most of it (the stamped
scans: "DocuSign Envelope ID ... ARCHIVE" is 66 characters). Same rule the readers use, same 200 dpi as their OCR.
Rotated pages are left without a layer and counted, not guessed at.

State: searchable-done.jsonl (latest line per token wins). Usage:
  .venv/bin/python searchable.py [--workers 2] [--limit N] [--token T ...] [--dry-run]
"""
import argparse, csv, io, json, os, subprocess, sys, tempfile, threading, time
os.environ.setdefault('OMP_THREAD_LIMIT', '1')
from concurrent.futures import ThreadPoolExecutor
from collections import Counter

REPO = os.environ.get('NASHVILLE_REPO', '/mnt/watch/nashville-legistar-archive')
DATA = os.path.join(REPO, 'data')
OUT = os.environ.get('CONTRACTS_SEARCHABLE', '/mnt/watch/contracts-api/searchable')
STATE = os.environ.get('CONTRACTS_SEARCHABLE_STATE', '/mnt/watch/contracts-api/searchable-done.jsonl')
sys.path.insert(0, os.path.join(REPO, 'src')); sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fitz                                            # noqa: E402
import extract_text                                    # noqa: E402
from ocr_backfill import pdf_for                       # noqa: E402  (VM-local copy, else archive.org, else ePAV)

DPI = extract_text.OCR_DPI

def words_of(page):
    """tesseract's word boxes for one page, in PDF points: [(x0, y0, x1, y1, word)]."""
    pix = page.get_pixmap(matrix=fitz.Matrix(DPI / 72.0, DPI / 72.0), alpha=False)
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as fh: fh.write(pix.tobytes('png')); tmp = fh.name
    try:
        r = subprocess.run(['tesseract', tmp, 'stdout', '--psm', '6', 'tsv'], capture_output=True, text=True, timeout=extract_text.OCR_TIMEOUT)
    except (subprocess.TimeoutExpired, FileNotFoundError): return None
    finally: os.unlink(tmp)
    if r.returncode != 0: return None
    k = 72.0 / DPI; out = []
    for row in csv.DictReader(io.StringIO(r.stdout), delimiter='\t', quoting=csv.QUOTE_NONE):
        w = (row.get('text') or '').strip()
        if not w or row.get('level') != '5': continue
        try: x, y, ww, hh = (int(row[c]) for c in ('left', 'top', 'width', 'height'))
        except (TypeError, ValueError): continue
        out.append((x * k, y * k, (x + ww) * k, (y + hh) * k, w))
    return out

def layer(page, words):
    """Invisible text, each word stretched to its own box so a viewer's highlight lands on the printed word."""
    for x0, y0, x1, y1, w in words:
        fs = max(1.0, (y1 - y0) * 0.92); nat = fitz.get_text_length(w, fontname='helv', fontsize=fs)
        if nat <= 0: continue
        sx = max(0.05, (x1 - x0) / nat); base = fitz.Point(x0, y1 - (y1 - y0) * 0.18)
        page.insert_text(base, w, fontsize=fs, fontname='helv', render_mode=3, morph=(base, fitz.Matrix(sx, 1)))

def latest():
    last = {}
    if os.path.exists(STATE):
        for l in open(STATE):
            try: d = json.loads(l); last[d['epav_token']] = d
            except (ValueError, KeyError): pass
    return last

def targets(args):
    done = {t for t, d in latest().items() if d.get('status') in ('ok', 'clean')}
    out = []
    with open(os.path.join(DATA, 'epav-fetched.jsonl'), encoding='utf-8') as f:
        for l in f:
            try: r = json.loads(l)
            except ValueError: continue
            t = r.get('epav_token')
            if not t or not r.get('identifier') or t in done or (args.token and t not in args.token): continue
            if str(r.get('destroyed_per_retention_schedule')).lower() == 'true': continue
            out.append(r)
    out.sort(key=lambda r: r['epav_token'])
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--workers', type=int, default=2); ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--token', action='append'); ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args(); os.makedirs(OUT, exist_ok=True)
    todo = targets(args)
    if args.limit: todo = todo[:args.limit]
    print('searchable: %d contracts to check%s' % (len(todo), '  [dry run]' if args.dry_run else ''), flush=True)
    if args.dry_run: return
    lock = threading.Lock(); st = Counter(); t0 = time.time()
    def record(o):
        with lock, open(STATE, 'a') as f: f.write(json.dumps(o) + '\n')
    def work(rec):
        tok = rec['epav_token']; now = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        try:
            data, via = pdf_for(rec)
            if not data: st['no-pdf'] += 1; return record({'epav_token': tok, 'at': now, 'status': 'no-pdf'})
            doc = fitz.open(stream=data, filetype='pdf')
            want = [p.number for p in doc if extract_text.needs_ocr(p, p.get_text('text') or '')]
            if not want:
                doc.close(); st['clean'] += 1; return record({'epav_token': tok, 'at': now, 'status': 'clean', 'pages': len(doc)})
            layered = rotated = failed = 0
            for i in want:
                p = doc[i]
                if p.rotation: rotated += 1; continue
                ws = words_of(p)
                if ws is None: failed += 1; continue
                if ws: layer(p, ws); layered += 1
            tmp = os.path.join(OUT, '.%s.%d.tmp' % (tok, os.getpid()))
            doc.save(tmp, garbage=1, deflate=True); total = len(doc); doc.close(); os.replace(tmp, os.path.join(OUT, tok + '.pdf'))
            st['ok'] += 1; st['pages'] += layered
            record({'epav_token': tok, 'at': now, 'status': 'ok', 'pages': total, 'scanned': len(want), 'layered': layered, 'rotated': rotated, 'failed': failed, 'via': via})
        except Exception as e:                       # noqa: BLE001 - one bad PDF must not stop the lane
            st['error'] += 1; record({'epav_token': tok, 'at': now, 'status': 'error', 'error': str(e)[:200]})
        n = st['ok'] + st['clean'] + st['error'] + st['no-pdf']
        if n % 50 == 0: print('  %d checked, %d layered (%d pages), %.1f/min' % (n, st['ok'], st['pages'], n / max(1, (time.time() - t0) / 60)), flush=True)
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool: list(pool.map(work, todo))
    print('searchable: done in %.0fs %s' % (time.time() - t0, dict(st)), flush=True)

if __name__ == '__main__':
    main()
