# score.py — WORLD-0 step 3, exactly as WORLD-0-PREREG.md fixes it. Run once.
import re, json, glob, os, random
SEED, SHUF, SEP, WIN, TOL = 20261103, 1000, 120, 10, 0.005
FIG = re.compile(r'(?<![\w.])([$£€])?\s?(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s?(%|percent\b|million\b|billion\b|thousand\b|bn\b|[MBK]\b)?', re.I)
SCALE = {'million': 1e6, 'billion': 1e9, 'bn': 1e9, 'thousand': 1e3, 'm': 1e6, 'b': 1e9, 'k': 1e3}
def figures(text):
    out = []
    for m in FIG.finditer(text):
        cur, num, suf = m.group(1), m.group(2), m.group(3)
        if suf and len(suf) == 1 and not suf.isupper() and suf not in '%': suf = None      # a single-letter scale must be a capital M, B or K
        v = float(num.replace(',', '')); cls = 'other'
        if suf in ('%',) or (suf and suf.lower() == 'percent'): cls = 'pct'
        elif suf and suf.lower() in SCALE: v *= SCALE[suf.lower()]
        if v < 10: continue
        if not suf and not cur and re.fullmatch(r'\d{4}', num) and 1900 <= v <= 2100: continue
        out.append((v, cls, m.group(0).strip()))
    return out
def match(a, b): return any(x[1] == y[1] and abs(x[0] - y[0]) <= TOL * max(x[0], y[0]) for x in a for y in b)
tr = json.load(open('transcript.json')); L = [(t, s) for t, s in tr['lines']]
files = sorted(glob.glob('ocr/f_*.txt')); K = len(files)
ocr = [open(f, encoding='utf-8', errors='replace').read() for f in files]; T = [10 * k for k in range(K)]
written = [figures(o) for o in ocr]
spoken_lines = [[s for t, s in L if abs(t - T[k]) <= WIN] for k in range(K)]
spoken = [figures(' '.join(sl)) for sl in spoken_lines]
idx = [k for k in range(K) if written[k]]; N = len(idx)
hits = [k for k in idx if match(written[k], spoken[k])]
obs = len(hits) / N if N else None
rng = random.Random(SEED); pool = {k: [j for j in range(K) if abs(T[j] - T[k]) >= SEP] for k in idx}
null = sorted(sum(match(written[k], spoken[rng.choice(pool[k])]) for k in idx) / N for _ in range(SHUF)) if N else []
mean = sum(null) / len(null) if null else None; p999 = null[int(0.999 * (len(null) - 1))] if null else None
testable = N >= 20
w1 = (obs > p999) if testable else 'untestable'; w2 = (obs >= 3 * mean and len(hits) >= 10) if testable else 'untestable'
gaps = {'frames': K, 'ocr_unread (<3 chars)': sum(len(o.strip()) < 3 for o in ocr), 'frames_with_a_written_figure': N, 'moments_without_speech': sum(1 for sl in spoken_lines if not sl),
        'truncated_transcript_chunks': len(tr['truncated_chunks']), 'transcript_lines': len(L)}
pairs = [{'k': k, 't': T[k], 'written': [x[2] for x in written[k]], 'spoken_matched': [y[2] for y in spoken[k] if any(x[1] == y[1] and abs(x[0] - y[0]) <= TOL * max(x[0], y[0]) for x in written[k])],
          'ocr': ocr[k].strip()[:600], 'speech': ' '.join(spoken_lines[k])[:700]} for k in hits]
srng = random.Random(SEED); sample = sorted(srng.sample(range(len(pairs)), min(30, len(pairs)))) if pairs else []
res = {'prereg_sha256': open('WORLD-0-PREREG.sha256').read().split()[0], 'N_moments_with_written_figure': N, 'hits': len(hits), 'observed_rate': obs, 'null_mean': mean, 'null_p99_9': p999,
       'W1': w1, 'W2': w2, 'W3_pairs_available': len(pairs), 'W3_testable': len(pairs) >= 15, 'W4_counts': gaps}
json.dump(res, open('RESULT.json', 'w'), indent=1); json.dump(pairs, open('pairs.json', 'w'), indent=1)
json.dump([{'id': i, 'ocr': pairs[i]['ocr'], 'speech': pairs[i]['speech']} for i in sample], open('w3-blind-sample.json', 'w'), indent=1)
print(json.dumps(res, indent=1))
