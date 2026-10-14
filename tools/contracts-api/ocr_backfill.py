#!/usr/bin/env python3
"""ocr_backfill.py — read the scanned contracts.

About 14k of the VM's contracts are scans with no text layer. The fast lane extracts text-layer only and
the slow lane (read_backfill.py) OCRs only when it still holds the PDF — but the uploader drops the local
PDF once archive.org has it, so those contracts stay unread. This lane re-fetches the PDF (VM-local, else
the archive.org twin, else ePAV), OCRs it with the pipeline's own tesseract helper, writes the text where
the other lanes expect it (data/deployed/<identifier>/extracted-text.txt) and appends the deterministic
ledger rows (contract_extract) to contract-ledger.jsonl — the same rows the fetch lane writes for contracts
that have a text layer. The contracts API picks them up on its next index refresh.

Reads from the pipeline's src/ (extract_text, contract_extract, live) and data dir; keeps its own state in
ocr-done.jsonl so a contract that cannot be read is recorded once, not retried every run.

Order: departments with the fewest unread contracts first, so whole departments finish early.
Pages: the first --max-pages pages by default (parties, term, amount, signatures sit there), recorded as
pages_read/pages_total so a partial read says so. --max-pages 0 reads every page.

Usage: ocr_backfill.py [--workers 6] [--limit N] [--dept NAME ...] [--max-pages 12] [--retry-failed]
"""
import argparse, json, os, sys, threading, time, urllib.request
os.environ.setdefault('OMP_THREAD_LIMIT', '1')       # one tesseract thread per page; parallelism is across pages/contracts
from concurrent.futures import ThreadPoolExecutor
from collections import Counter

REPO = os.environ.get('NASHVILLE_REPO', '/mnt/watch/nashville-legistar-archive')
DATA = os.path.join(REPO, 'data')
STATE = os.environ.get('OCR_STATE', '/mnt/watch/contracts-api/ocr-done.jsonl')
sys.path.insert(0, os.path.join(REPO, 'src'))
import fitz                                            # noqa: E402
import extract_text                                    # noqa: E402
import contract_extract                                # noqa: E402
try:
    import live                                        # noqa: E402
except Exception:
    live = None

UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
LEDGER = os.path.join(DATA, 'contract-ledger.jsonl')

def grab(url, timeout=90):
    try:
        b = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=timeout).read()
        return b if b[:5] == b'%PDF-' else None
    except Exception:
        return None

def pdf_for(rec):
    tok, ident = rec['epav_token'], rec['identifier']
    for p in (os.path.join(DATA, '.epav-local', tok, 'source.pdf'), os.path.join('/mnt/watch/contracts-api/pdfcache', tok + '.pdf')):
        if os.path.exists(p):
            return open(p, 'rb').read(), 'local'
    b = grab('https://archive.org/download/%s/%s.pdf' % (ident, tok))
    if b: return b, 'archive.org'
    b = grab('http://documents.nashville.gov/Request/Open/%s?source=Contracts&sourceAppId=14&isArchived=True' % tok)
    if b: return b, 'ePAV'
    return None, None

def ocr_pdf(data, max_pages):
    doc = fitz.open(stream=data, filetype='pdf')
    total = len(doc); pages = []
    for i, page in enumerate(doc):
        if max_pages and i >= max_pages: break
        t = page.get_text('text') or ''
        if len(t.strip()) < extract_text.MIN_PAGE_TEXT_CHARS:
            t = extract_text._ocr_page(page)
        pages.append(t)
    doc.close()
    return pages, total

def candidates(args):
    done = {}
    if os.path.exists(STATE):
        for l in open(STATE):
            try: d = json.loads(l)
            except ValueError: continue
            done[d['epav_token']] = d
    led = set()
    with open(LEDGER, 'rb') as f:
        for l in f:
            i = l.find(b'"epav_token": "')
            if i > 0: led.add(l[i + 15:i + 23].decode())
    out, seen = [], set()
    with open(os.path.join(DATA, 'epav-fetched.jsonl'), encoding='utf-8') as f:
        for l in f:
            try: r = json.loads(l)
            except ValueError: continue
            tok, ident = r.get('epav_token'), r.get('identifier')
            if not tok or not ident or tok in seen: continue
            seen.add(tok)
            if str(r.get('destroyed_per_retention_schedule')).lower() == 'true': continue
            if tok in led: continue
            d = done.get(tok)
            if d and (d.get('status') == 'ok' or not args.retry_failed): continue
            tp = os.path.join(DATA, 'deployed', ident, 'extracted-text.txt')
            if os.path.exists(tp) and os.path.getsize(tp) >= 200: continue
            if args.dept and r.get('department') not in args.dept: continue
            out.append(r)
    size = Counter(r.get('department') for r in out)
    out.sort(key=lambda r: (size[r.get('department')], r.get('department') or '', r['epav_token']))
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--workers', type=int, default=6); ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--dept', action='append'); ap.add_argument('--max-pages', type=int, default=12)
    ap.add_argument('--retry-failed', action='store_true')
    args = ap.parse_args()
    cands = candidates(args)
    if args.limit: cands = cands[:args.limit]
    print('ocr_backfill: %d scanned contracts to read (%s)' % (len(cands), ', '.join('%s %d' % kv for kv in Counter(r.get('department') for r in cands).most_common(4))), flush=True)
    lock = threading.Lock(); stats = Counter(); t0 = time.time()

    def record(rec, **kw):
        with lock:
            with open(STATE, 'a') as f:
                f.write(json.dumps({'epav_token': rec['epav_token'], 'at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), **kw}) + '\n')

    def work(rec):
        tok, ident = rec['epav_token'], rec['identifier']
        try:
            data, via = pdf_for(rec)
            if not data:
                stats['no-pdf'] += 1; return record(rec, status='no-pdf')
            pages, total = ocr_pdf(data, args.max_pages)
            text = '\n\n'.join(pages)
            if len(text.strip()) < 40:
                stats['empty'] += 1; return record(rec, status='empty', pages_total=total, via=via)
            d = os.path.join(DATA, 'deployed', ident); os.makedirs(d, exist_ok=True)
            tmp = os.path.join(d, '.extracted-text.%d.tmp' % os.getpid())
            open(tmp, 'w', encoding='utf-8').write(text); os.replace(tmp, os.path.join(d, 'extracted-text.txt'))
            rows = contract_extract.extract_contract_rows(text, ident)
            for r in rows:
                r['epav_token'] = tok; r['contract_number'] = rec.get('contract_number'); r['archive_url'] = rec.get('archive_url')
            if rows:
                blob = ''.join(json.dumps(r) + '\n' for r in rows).encode()
                fd = os.open(LEDGER, os.O_WRONLY | os.O_APPEND | os.O_CREAT)
                try: os.write(fd, blob)             # one write: concurrent appenders never interleave inside it
                finally: os.close(fd)
            stats['ok'] += 1
            record(rec, status='ok', rows=len(rows), pages_read=len(pages), pages_total=total, via=via)
            if live:
                try: live.event('read', epav_token=tok, contract_number=rec.get('contract_number'), department=rec.get('department'), lane='ocr')
                except Exception: pass
            n = stats['ok']
            if n % 25 == 0: print('  %d read, %d rows last, %.1f contracts/min' % (n, len(rows), n / max(1, (time.time() - t0) / 60)), flush=True)
        except Exception as e:                       # noqa: BLE001 - one bad PDF must not stop the lane
            stats['error'] += 1; record(rec, status='error', error=str(e)[:200])

    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        list(pool.map(work, cands))
    print('ocr_backfill: done in %.0fs %s' % (time.time() - t0, dict(stats)), flush=True)

if __name__ == '__main__':
    main()
