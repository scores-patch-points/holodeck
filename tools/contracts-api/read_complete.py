#!/usr/bin/env python3
"""read_complete.py — finish reading contracts the OCR lane only read the first pages of (or could not read at all).

ocr_backfill.py used to stop at --max-pages 12 and recorded the contract as 'ok' with pages_read < pages_total, so
those contracts were never revisited. This lane reads the rest:

  partial  ocr-done.jsonl says pages_read < pages_total: OCR pages pages_read..total and APPEND them to extracted-text.txt
           (the pages already there are untouched, so every existing observation's offset stays valid), then add the
           ledger rows for the new text only.
  retry    status 'empty' or 'no-pdf' (and not destroyed per the retention schedule): read every page from scratch.

Every contract it touches gets a line in coverage.jsonl: on success pages_total, pages_read, chars, ocr_pages (plus a new
ocr-done.jsonl entry); on failure a status (error / empty / no-pdf) and NO ocr-done entry, so a failed attempt never hides
that the contract is still only partly read. Latest line per token wins.

Usage: read_complete.py [--workers 2] [--limit N] [--token T ...] [--dry-run]
"""
import argparse, json, os, re, sys, threading, time
os.environ.setdefault('OMP_THREAD_LIMIT', '1')
from concurrent.futures import ThreadPoolExecutor
from collections import Counter

REPO = os.environ.get('NASHVILLE_REPO', '/mnt/watch/nashville-legistar-archive')
DATA = os.path.join(REPO, 'data')
STATE = os.environ.get('OCR_STATE', '/mnt/watch/contracts-api/ocr-done.jsonl')
COVERAGE = os.environ.get('CONTRACTS_COVERAGE', '/mnt/watch/contracts-api/coverage.jsonl')
LEDGER = os.path.join(DATA, 'contract-ledger.jsonl')
sys.path.insert(0, os.path.join(REPO, 'src'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fitz                                            # noqa: E402
import extract_text                                    # noqa: E402
import contract_extract                                # noqa: E402
from ocr_backfill import pdf_for                       # noqa: E402  (VM-local copy, else archive.org, else ePAV)

SEP = '\n\n'   # how ocr_backfill joined pages; appended pages use the same joiner

def latest_state():
    last = {}
    if os.path.exists(STATE):
        for l in open(STATE):
            try: d = json.loads(l)
            except ValueError: continue
            last[d['epav_token']] = d
    return last

def targets(args):
    last = latest_state(); fetched = {}
    with open(os.path.join(DATA, 'epav-fetched.jsonl'), encoding='utf-8') as f:
        for l in f:
            try: r = json.loads(l)
            except ValueError: continue
            if r.get('epav_token') and r.get('identifier'): fetched[r['epav_token']] = r
    out = []
    for tok, d in last.items():
        r = fetched.get(tok)
        if not r or str(r.get('destroyed_per_retention_schedule')).lower() == 'true': continue
        if args.token and tok not in args.token: continue
        pr, pt = d.get('pages_read') or 0, d.get('pages_total') or 0
        if d.get('status') == 'ok' and pt and pr < pt: out.append((r, 'partial', pr))
        elif d.get('status') in ('empty', 'no-pdf'): out.append((r, 'retry', 0))
    out.sort(key=lambda x: (x[1], x[0]['epav_token']))
    return out

def page_texts(doc, start):
    """Text of pages start.. (text layer, else OCR), and how many of them needed OCR."""
    pages, ocr = [], 0
    for i in range(start, len(doc)):
        t = doc[i].get_text('text') or ''
        if len(t.strip()) < extract_text.MIN_PAGE_TEXT_CHARS: t = extract_text._ocr_page(doc[i]); ocr += 1
        pages.append(t)
    return pages, ocr

def existing_row_ids(idents):
    """Ids of the ledger rows already written for these contracts: one pass, a set lookup per line."""
    want = set(idents); ids = set()
    if not want: return ids
    with open(LEDGER, 'rb') as f:
        for l in f:
            i = l.find(b'"doc": "')
            if i < 0: continue
            j = l.find(b'"', i + 8)
            if l[i + 8:j].decode('utf-8', 'replace') in want:
                try: ids.add(json.loads(l)['id'])
                except (ValueError, KeyError): pass
    return ids

# ---- gap lane: scanned pages that hide behind a short text layer -----------------------------------------------------
# The fast lane OCRs a page only when its text layer is under MIN_PAGE_TEXT_CHARS (60). A scanned page that carries a
# stamp (a 66-character "DocuSign Envelope ID: ..." line) is just over that, so its image body was never read. A page is a
# GAP page when its text layer is 60..THIN_PAGE_CHARS characters AND images cover at least IMG_RATIO of it. Their OCR is
# appended after the existing text (offsets stay valid); the pages' numbers are kept in gaps-done.jsonl.
GAPS = os.environ.get('CONTRACTS_GAPS', '/mnt/watch/contracts-api/gaps-done.jsonl')
PDFCACHE = '/mnt/watch/contracts-api/pdfcache'
THIN_PAGE_CHARS, IMG_RATIO = 400, 0.5

GAP_V = 2   # v1 covered only the 60..400-character stamped pages; v2 also OCRs blank pages the OCR lane never saw

def gap_pages(doc, blank=False):
    """Pages to OCR. blank=True also takes pages with < MIN_PAGE_TEXT_CHARS of text layer: a contract the OCR lane never read
    (the fast lane is text-layer only) has its scanned pages missing even when other pages gave it > 200 characters."""
    out = []
    for i, pg in enumerate(doc):
        n = len((pg.get_text('text') or '').strip())
        if n < extract_text.MIN_PAGE_TEXT_CHARS:
            if blank: out.append(i)
            continue
        if n >= THIN_PAGE_CHARS: continue
        area = pg.rect.width * pg.rect.height
        cov = sum(r.width * r.height for im in pg.get_images(full=True) for r in pg.get_image_rects(im[0]))
        if area and cov / area >= IMG_RATIO: out.append(i)
    return out

def local_pdf(rec):
    for p in (os.path.join(DATA, '.epav-local', rec['epav_token'], 'source.pdf'), os.path.join(PDFCACHE, rec['epav_token'] + '.pdf')):
        if os.path.exists(p): return p
    return None

def gap_targets(args):
    pending = {t for t, d in latest_state().items() if d.get('status') in ('empty', 'no-pdf') or ((d.get('pages_total') or 0) > (d.get('pages_read') or 0))}
    done = set()
    if os.path.exists(GAPS):
        for l in open(GAPS):
            try: d = json.loads(l)
            except ValueError: continue
            if (d.get('v') or 1) >= GAP_V: done.add(d['epav_token'])
    out = []
    with open(os.path.join(DATA, 'epav-fetched.jsonl'), encoding='utf-8') as f:
        for l in f:
            try: r = json.loads(l)
            except ValueError: continue
            tok = r.get('epav_token')
            if not tok or not r.get('identifier') or tok in done or tok in pending or (args.token and tok not in args.token): continue
            if str(r.get('destroyed_per_retention_schedule')).lower() == 'true': continue
            if local_pdf(r) or args.remote: out.append(r)   # --remote: no local PDF, fetch the archive.org twin (or ePAV)
    out.sort(key=lambda r: r['epav_token'])
    return out, len(pending)

def gaps_main(args):
    todo, held = gap_targets(args)
    if args.limit: todo = todo[:args.limit]
    print('read_complete --gaps: %d contracts to scan (%d held back for the partial/retry lane)%s' % (len(todo), held, '  [dry run]' if args.dry_run else ''), flush=True)
    if args.dry_run: return
    import fcntl                                  # one gap run at a time: two would append the same pages twice
    lockf = open(os.environ.get('CONTRACTS_GAPS_LOCK', '/mnt/watch/contracts-api/gaps.lock'), 'w')
    try: fcntl.flock(lockf, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError: print('read_complete --gaps: another gap run holds the lock; nothing done', flush=True); return
    lock = threading.Lock(); stats = Counter(); t0 = time.time()
    ocr_read = {t for t, d in latest_state().items() if d.get('status') == 'ok'}   # the OCR lane read every page of these
    def write(path, obj):
        with lock, open(path, 'a') as f: f.write(json.dumps(obj) + '\n')
    def norm(s): return re.sub(r'[^a-z0-9]+', ' ', s.lower())
    def present(ocr, old_norm):
        """Is this page's text already in the contract's text? Three 6-word windows from the OCR; any hit means yes."""
        w = norm(ocr).split()
        if len(w) < 6: return False
        starts = sorted({0, max(0, len(w) // 2 - 3), max(0, len(w) - 6)})
        return any(' '.join(w[s:s + 6]) in old_norm for s in starts)
    def work(rec):
        tok, ident = rec['epav_token'], rec['identifier']; now = lambda: time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        try:
            lp = local_pdf(rec)
            if lp: doc = fitz.open(lp)
            else:
                data, _via = pdf_for(rec)
                if not data: stats['no-pdf'] += 1; return write(COVERAGE, {'epav_token': tok, 'at': now(), 'status': 'no-pdf', 'lane': 'gaps'})   # not marked done: tried again next run
                doc = fitz.open(stream=data, filetype='pdf')
            gaps = gap_pages(doc, blank=tok not in ocr_read)
            if not gaps:
                doc.close(); stats['clean'] += 1; return write(GAPS, {'epav_token': tok, 'at': now(), 'pages': [], 'total': 0, 'v': GAP_V})
            tp = os.path.join(DATA, 'deployed', ident, 'extracted-text.txt')
            old = open(tp, encoding='utf-8', errors='replace').read() if os.path.exists(tp) else ''
            old_norm = norm(old); texts, kept = [], []
            for i in gaps:
                o = extract_text._ocr_page(doc[i])
                if len(o.strip()) >= 20 and not present(o, old_norm): texts.append(o); kept.append(i)
            total = len(doc); doc.close()
            if not kept:
                stats['clean'] += 1; return write(GAPS, {'epav_token': tok, 'at': now(), 'pages': [], 'total': total, 'v': GAP_V})
            gaps, new = kept, SEP.join(texts)
            text = old + (SEP if old else '') + new; cut = len(old) + (len(SEP) if old else 0)
            d = os.path.dirname(tp); os.makedirs(d, exist_ok=True)
            tmp = os.path.join(d, '.extracted-text.%d.tmp' % os.getpid())
            open(tmp, 'w', encoding='utf-8').write(text); os.replace(tmp, tp)
            before = {r['id'] for r in contract_extract.extract_contract_rows(old, ident)} if old.strip() else set()
            rows = [r for r in contract_extract.extract_contract_rows(text, ident) if (r.get('at') or [0])[0] >= cut and r['id'] not in before]
            for r in rows: r['epav_token'] = tok; r['contract_number'] = rec.get('contract_number'); r['archive_url'] = rec.get('archive_url')
            if rows:
                blob = ''.join(json.dumps(r) + '\n' for r in rows).encode()
                fd = os.open(LEDGER, os.O_WRONLY | os.O_APPEND | os.O_CREAT)
                try: os.write(fd, blob)
                finally: os.close(fd)
            write(GAPS, {'epav_token': tok, 'at': now(), 'pages': [i + 1 for i in gaps], 'total': total, 'appended_from': cut, 'chars_added': len(new), 'rows': len(rows), 'v': GAP_V})
            write(COVERAGE, {'epav_token': tok, 'at': now(), 'pages_total': total, 'gap_pages_ocr': len(gaps), 'chars': len(text), 'lane': 'gaps'})
            stats['filled'] += 1; stats['pages'] += len(gaps); stats['rows'] += len(rows)
        except Exception as e:                       # noqa: BLE001 - one bad PDF must not stop the lane
            stats['error'] += 1; write(COVERAGE, {'epav_token': tok, 'at': now(), 'status': 'error', 'error': str(e)[:200], 'lane': 'gaps'})
        n = stats['clean'] + stats['filled'] + stats['error']
        if n % 100 == 0: print('  %d scanned, %d filled (%d pages), %.1f contracts/min' % (n, stats['filled'], stats['pages'], n / max(1, (time.time() - t0) / 60)), flush=True)
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool: list(pool.map(work, todo))
    print('read_complete --gaps: done in %.0fs %s' % (time.time() - t0, dict(stats)), flush=True)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--workers', type=int, default=2); ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--token', action='append'); ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--gaps', action='store_true', help='OCR scanned pages hidden behind a short text layer (see above)')
    ap.add_argument('--remote', action='store_true', help='with --gaps: also contracts with no local PDF (downloaded from archive.org or ePAV)')
    args = ap.parse_args()
    if args.gaps: return gaps_main(args)
    todo = targets(args)
    if args.limit: todo = todo[:args.limit]
    kinds = Counter(k for _, k, _ in todo)
    print('read_complete: %d contracts (%s)%s' % (len(todo), dict(kinds), '  [dry run]' if args.dry_run else ''), flush=True)
    if args.dry_run:
        for r, k, pr in todo[:20]: print('  ', r['epav_token'], k, 'from page', pr + 1, r.get('department'))
        return
    ids = existing_row_ids([r['identifier'] for r, _, _ in todo])
    print('read_complete: %d existing ledger rows for these contracts' % len(ids), flush=True)
    lock = threading.Lock(); stats = Counter(); t0 = time.time()

    def write(path, obj):
        with lock, open(path, 'a') as f: f.write(json.dumps(obj) + '\n')

    def work(item):
        rec, kind, start = item; tok, ident = rec['epav_token'], rec['identifier']
        tp = os.path.join(DATA, 'deployed', ident, 'extracted-text.txt')
        try:
            old = open(tp, encoding='utf-8', errors='replace').read() if kind == 'partial' and os.path.exists(tp) else ''
            if kind == 'partial' and not old.strip(): start, kind = 0, 'retry'
            data, via = pdf_for(rec)
            if not data:
                stats['no-pdf'] += 1; return write(COVERAGE, {'epav_token': tok, 'at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'status': 'no-pdf', 'lane': 'complete'})
            doc = fitz.open(stream=data, filetype='pdf'); total = len(doc)
            pages, ocr = page_texts(doc, start); doc.close()
            new = SEP.join(pages)
            text = old + (SEP if old and new else '') + new
            if len(text.strip()) < 40:
                stats['empty'] += 1; return write(COVERAGE, {'epav_token': tok, 'at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'status': 'empty', 'pages_total': total, 'via': via, 'lane': 'complete'})
            d = os.path.dirname(tp); os.makedirs(d, exist_ok=True)
            tmp = os.path.join(d, '.extracted-text.%d.tmp' % os.getpid())
            open(tmp, 'w', encoding='utf-8').write(text); os.replace(tmp, tp)
            cut = len(old) + (len(SEP) if old else 0)
            rows = [r for r in contract_extract.extract_contract_rows(text, ident) if (r.get('at') or [0])[0] >= cut and r.get('id') not in ids]
            for r in rows: r['epav_token'] = tok; r['contract_number'] = rec.get('contract_number'); r['archive_url'] = rec.get('archive_url')
            if rows:
                blob = ''.join(json.dumps(r) + '\n' for r in rows).encode()
                fd = os.open(LEDGER, os.O_WRONLY | os.O_APPEND | os.O_CREAT)
                try: os.write(fd, blob)
                finally: os.close(fd)
            now = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            write(STATE, {'epav_token': tok, 'at': now, 'status': 'ok', 'rows': len(rows), 'pages_read': total, 'pages_total': total, 'via': via, 'lane': 'complete'})
            write(COVERAGE, {'epav_token': tok, 'at': now, 'pages_total': total, 'pages_read': total, 'chars': len(text), 'ocr_pages': ocr, 'lane': 'complete'})
            stats['ok'] += 1; stats['pages'] += len(pages); stats['rows'] += len(rows)
            if stats['ok'] % 10 == 0: print('  %d done, %d pages, %.1f contracts/min' % (stats['ok'], stats['pages'], stats['ok'] / max(1, (time.time() - t0) / 60)), flush=True)
        except Exception as e:                       # noqa: BLE001 - one bad PDF must not stop the lane
            stats['error'] += 1; write(COVERAGE, {'epav_token': tok, 'at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'status': 'error', 'error': str(e)[:200], 'lane': 'complete'})

    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        list(pool.map(work, todo))
    print('read_complete: done in %.0fs %s' % (time.time() - t0, dict(stats)), flush=True)

if __name__ == '__main__':
    main()
