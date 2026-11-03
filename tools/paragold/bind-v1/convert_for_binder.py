# convert_for_binder.py — writes PARA-GOLD-BIND-V1.binder.json: the same 30 cases and the same byte spans as PARA-GOLD-BIND-V1.json, in the schema of
# khora eval/attention/score2.mjs (kind attended | elsewhere | out_of_scope, trapKind, surface, accept). No label is changed.
import json
g = json.load(open('PARA-GOLD-BIND-V1.json'))
TOPIC_NAMES = {t: [t, 'The ' + t] for t in {c['attended_topic'] for c in g['cases']}}
NAMED_REFERENT = {'v18': ['Interoceanic Canal Commission'], 'v19': ['Concert Hall'], 'v20': ['Gatun Lake'], 'v29': ['Panama Canal Railway']}
KIND = {'attended': ('attended', None), 'trap-new-entity': ('elsewhere', 'new-entity'), 'trap-definite-other': ('elsewhere', 'definite-other'), 'trap-expletive': ('out_of_scope', 'expletive')}
cases = []
for c in g['cases']:
    k, tk = KIND[c['kind']]
    accept = TOPIC_NAMES[c['attended_topic']] if k == 'attended' else NAMED_REFERENT.get(c['id'], [])
    d = {'id': c['id'], 'doc': c['doc'], 'start': c['start'], 'end': c['end'], 'text': c['text'], 'surface': c['anaphor'], 'kind': k, 'accept': accept}
    if tk: d['trapKind'] = tk
    cases.append(d)
json.dump({'cases': cases}, open('PARA-GOLD-BIND-V1.binder.json', 'w'), indent=1, ensure_ascii=False)
from collections import Counter
print(len(cases), dict(Counter(c['kind'] for c in cases)), dict(Counter(c.get('trapKind') for c in cases if c.get('trapKind'))))
