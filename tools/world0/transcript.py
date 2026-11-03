# transcript.py — WORLD-0 step 2: the machine transcript from `slate window` only (never reading .fold/.slate files), in 300 s chunks, halving a chunk if it comes back truncated.
import subprocess, json, re, os
ID = 'g05-mw0zvoemdra-palantir-q4-2024-earnings-karp-218e419a'; DUR = 2870.134
CWD = os.path.expanduser('~/Documents/claude code'); lines, trunc = {}, []
def fetch(t0, t1):
    r = subprocess.run(['slate', 'window', ID, str(t0), str(t1)], capture_output=True, text=True, cwd=CWD)
    d = json.loads(r.stdout)
    if d.get('truncated') and (t1 - t0) > 10:
        m = (t0 + t1) / 2; fetch(t0, m); fetch(m, t1); return
    if d.get('truncated'): trunc.append([t0, t1])
    for l in d.get('text', '').split('\n'):
        m = re.match(r'\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)', l)
        if m: lines[(int(m[1]) * 60 + float(m[2]), m[3])] = 1
t = 0
while t < DUR: fetch(t, min(t + 300, DUR + 1)); t += 300
out = sorted(lines)
json.dump({'id': ID, 'lines': out, 'truncated_chunks': trunc}, open('transcript.json', 'w'))
print(len(out), 'lines;', len(trunc), 'truncated chunks;', 'span', out[0][0] if out else None, out[-1][0] if out else None)
