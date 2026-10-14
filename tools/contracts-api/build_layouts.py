#!/usr/bin/env python3
"""build_layouts.py — positioned text for each contract, so the reader can show the page at once.

For every contract (or one --dept) it writes layout/<token>.json: per page, the page size in PDF points and
the text lines with their boxes — taken from the PDF's text layer where there is one, from tesseract's word
boxes (TSV) where the page is a scan. The reader paints this immediately (text where it sits on the page)
and swaps in the real PDF when the bytes arrive, so opening a contract never waits on archive.org.

Uses server.pdf_path(), so the PDF it needs is fetched once and kept in the bounded cache.
Run with the pipeline venv (it has PyMuPDF):
  .venv/bin/python build_layouts.py [--dept NAME ...] [--workers 4] [--max-pages 40] [--max-scan-pages 6] [--rebuild]
"""
import argparse, json, os, sqlite3, subprocess, sys, tempfile, threading, time
os.environ.setdefault('PORT', '0'); os.environ.setdefault('OMP_THREAD_LIMIT', '1')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fitz      # noqa: E402
import server    # noqa: E402

LAYOUT = os.environ.get('CONTRACTS_LAYOUT', '/mnt/watch/contracts-api/layout')
MIN_CHARS = 60
DPI = 150
os.makedirs(LAYOUT, exist_ok=True)

def text_lines(words):
    by = {}
    for x0, y0, x1, y1, w, b, l, _n in words:
        k = (b, l); e = by.get(k)
        if e is None: by[k] = [x0, y0, x1, y1, [w]]
        else: e[0] = min(e[0], x0); e[1] = min(e[1], y0); e[2] = max(e[2], x1); e[3] = max(e[3], y1); e[4].append(w)
    return [[round(e[0], 1), round(e[1], 1), round(e[2] - e[0], 1), round(e[3] - e[1], 1), ' '.join(e[4])] for e in sorted(by.values(), key=lambda e: (round(e[1] / 3), e[0]))]

def ocr_lines(page):
    pix = page.get_pixmap(matrix=fitz.Matrix(DPI / 72.0, DPI / 72.0), alpha=False)
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as fh:
        fh.write(pix.tobytes('png')); tmp = fh.name
    try:
        out = subprocess.run(['tesseract', tmp, 'stdout', '--psm', '6', 'tsv'], capture_output=True, text=True, timeout=120)
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return [], pix.width * 72 / DPI, pix.height * 72 / DPI
    finally:
        try: os.unlink(tmp)
        except OSError: pass
    k72 = 72.0 / DPI; by = {}
    for ln in out.stdout.splitlines()[1:]:
        c = ln.split('\t')
        if len(c) < 12 or c[0] != '5' or not c[11].strip(): continue
        try: l, t, w, h = int(c[6]), int(c[7]), int(c[8]), int(c[9]); conf = float(c[10])
        except ValueError: continue
        if conf < 0: continue
        k = (c[2], c[3], c[4]); e = by.get(k)
        if e is None: by[k] = [l, t, l + w, t + h, [c[11]]]
        else: e[0] = min(e[0], l); e[1] = min(e[1], t); e[2] = max(e[2], l + w); e[3] = max(e[3], t + h); e[4].append(c[11])
    lines = [[round(e[0] * k72, 1), round(e[1] * k72, 1), round((e[2] - e[0]) * k72, 1), round((e[3] - e[1]) * k72, 1), ' '.join(e[4])]
             for e in sorted(by.values(), key=lambda e: (round(e[1] / 25), e[0]))]
    return lines, pix.width * k72, pix.height * k72

def build(tok, max_pages, max_scan):
    src = server.pdf_path(tok)
    if not src: return None
    doc = fitz.open(src); pages = []; scans = 0; partial = False; total = len(doc)
    for i, page in enumerate(doc):
        if i >= max_pages: partial = True; break
        r = page.rect; words = page.get_text('words')
        if len(' '.join(w[4] for w in words).strip()) >= MIN_CHARS:
            pages.append({'n': i + 1, 'w': round(r.width, 1), 'h': round(r.height, 1), 'k': 'text', 'lines': text_lines(words)})
        elif scans < max_scan:
            lines, w, h = ocr_lines(page); scans += 1
            pages.append({'n': i + 1, 'w': round(w, 1), 'h': round(h, 1), 'k': 'ocr', 'lines': lines})
        else:
            partial = True; pages.append({'n': i + 1, 'w': round(r.width, 1), 'h': round(r.height, 1), 'k': 'scan', 'lines': []})
    doc.close()
    return {'token': tok, 'total': total, 'partial': partial, 'pages': pages}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dept', action='append'); ap.add_argument('--workers', type=int, default=4)
    ap.add_argument('--max-pages', type=int, default=40); ap.add_argument('--max-scan-pages', type=int, default=6)
    ap.add_argument('--rebuild', action='store_true'); ap.add_argument('--limit', type=int, default=0)
    a = ap.parse_args()
    db = sqlite3.connect('file:' + server.DB + '?mode=ro', uri=True)
    q = 'SELECT token FROM contracts WHERE destroyed = 0'; args = []
    if a.dept: q += ' AND department IN (%s)' % ','.join('?' * len(a.dept)); args = a.dept
    toks = [r[0] for r in db.execute(q + ' ORDER BY fetched_at DESC', args)]
    if not a.rebuild: toks = [t for t in toks if not os.path.exists(os.path.join(LAYOUT, t + '.json'))]
    if a.limit: toks = toks[:a.limit]
    print('build_layouts: %d to build' % len(toks), flush=True)
    t0 = time.time(); st = {'ok': 0, 'no-pdf': 0, 'error': 0}; lock = threading.Lock()
    def one(t):
        try:
            L = build(t, a.max_pages, a.max_scan_pages)
            if L is None:
                with lock: st['no-pdf'] += 1
                return
            p = os.path.join(LAYOUT, t + '.json'); tmp = p + '.%d.tmp' % os.getpid()
            with open(tmp, 'w') as f: json.dump(L, f, separators=(',', ':'), ensure_ascii=False)
            os.replace(tmp, p)
            with lock:
                st['ok'] += 1
                if st['ok'] % 50 == 0: print('  %d built (%.1f/s)' % (st['ok'], st['ok'] / (time.time() - t0)), flush=True)
        except Exception as e:      # one bad PDF must not stop the lane
            with lock: st['error'] += 1
            print('  error', t, str(e)[:100], flush=True)
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=a.workers) as ex: list(ex.map(one, toks))
    print('build_layouts: done in %.0fs %s' % (time.time() - t0, st), flush=True)

if __name__ == '__main__':
    main()
