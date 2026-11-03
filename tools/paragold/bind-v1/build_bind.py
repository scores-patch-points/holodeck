# build_bind.py — PARA-GOLD-BIND v1: a held-out set of binding cases for the attention binder's round 2. Hand-labelled by the parent session (not blind),
# from five Wikipedia articles the binder has never seen. Statements are named by (document, exact starting words); this script computes the byte span.
import json, re, hashlib, glob, os
T = {os.path.basename(f)[:-4]: open(f, encoding='utf-8').read() for f in glob.glob('text/*.txt')}
def span(doc, start):
    t = T[doc]; assert t.count(start) == 1, (doc, start, t.count(start)); i = t.index(start)
    j = re.compile(r'[.!?]["”’)]*(?=\s|$)').search(t, i + 12).end()
    return {'doc': doc, 'start': len(t[:i].encode()), 'end': len(t[:j].encode()), 'text': t[i:j]}
TOPIC = {'wiki-Brooklyn_Bridge': 'Brooklyn Bridge', 'wiki-Colosseum': 'Colosseum', 'wiki-Golden_Gate_Bridge': 'Golden Gate Bridge', 'wiki-Panama_Canal': 'Panama Canal', 'wiki-Sydney_Opera_House': 'Sydney Opera House'}
# (id, kind, doc, starting words, anaphor, referent, note)
C = [
 ('v01', 'attended', 'wiki-Brooklyn_Bridge', 'It was also the longest suspension bridge', 'It', 'Brooklyn Bridge', 'pronoun; the East River is a competing candidate in the previous sentence'),
 ('v02', 'attended', 'wiki-Brooklyn_Bridge', 'Its stone towers are neo-Gothic', 'Its', 'Brooklyn Bridge', 'possessive'),
 ('v03', 'attended', 'wiki-Colosseum', 'It is the largest ancient amphitheatre ever built', 'It', 'Colosseum', 'pronoun'),
 ('v04', 'attended', 'wiki-Colosseum', 'It is one of Rome', 'It', 'Colosseum', 'pronoun; Rome is a competing candidate'),
 ('v05', 'attended', 'wiki-Golden_Gate_Bridge', 'It also carries pedestrian and bicycle traffic', 'It', 'Golden Gate Bridge', 'pronoun; the strait, San Francisco and Marin County are competing candidates'),
 ('v06', 'attended', 'wiki-Panama_Canal', 'It cuts across the narrowest point', 'It', 'Panama Canal', 'pronoun; the Isthmus of Panama is a competing candidate'),
 ('v07', 'attended', 'wiki-Panama_Canal', 'It is now managed and operated by', 'It', 'Panama Canal', 'pronoun; the Panamanian government is a competing candidate'),
 ('v08', 'attended', 'wiki-Sydney_Opera_House', 'It is supported on 588 concrete piers', 'It', 'Sydney Opera House', 'pronoun after a sentence about "the building"'),
 ('v09', 'attended', 'wiki-Panama_Canal', 'The canal is threatened by low water levels', 'The canal', 'Panama Canal', 'definite description'),
 ('v10', 'attended', 'wiki-Golden_Gate_Bridge', 'The bridge opened to the public on May 27, 1937', 'The bridge', 'Golden Gate Bridge', 'definite description'),
 ('v11', 'attended', 'wiki-Brooklyn_Bridge', 'The span was originally called the New York and Brooklyn Bridge', 'The span', 'Brooklyn Bridge', 'definite description with a different head noun (descriptor synonymy)'),
 ('v12', 'attended', 'wiki-Sydney_Opera_House', 'The building comprises multiple performance venues', 'The building', 'Sydney Opera House', 'definite description with a different head noun'),
 ('v13', 'attended', 'wiki-Colosseum', 'The building ceased to be used for entertainment', 'The building', 'Colosseum', 'definite description with a different head noun'),
 ('v14', 'attended', 'wiki-Panama_Canal', 'The expanded waterway began commercial operation', 'The expanded waterway', 'Panama Canal', 'definite description with a different head noun, naming the expanded canal'),
 ('v15', 'attended', 'wiki-Sydney_Opera_House', 'The facility features a modern expressionist design', 'The facility', 'Sydney Opera House', 'definite description with a different head noun'),
 ('v16', 'attended', 'wiki-Golden_Gate_Bridge', 'The bridge faced opposition, including litigation', 'The bridge', 'Golden Gate Bridge', 'definite description; the previous sentence is about the engineer Strauss'),
 # traps: an "It" whose referent is an entity the previous sentence introduced (or an event), not the attended topic
 ('v17', 'trap-new-entity', 'wiki-Brooklyn_Bridge', 'It typically runs 4 feet', 'It', 'the elevated promenade (a part, not the bridge)', 'refers to the promenade introduced in the previous sentence'),
 ('v18', 'trap-new-entity', 'wiki-Panama_Canal', 'It commissioned several naval officers', 'It', 'the Interoceanic Canal Commission (not the canal)', 'refers to the commission the previous sentence introduces'),
 ('v19', 'trap-new-entity', 'wiki-Sydney_Opera_House', 'It contains the Sydney Opera House Grand Organ', 'It', 'the Concert Hall (a part, not the Opera House)', 'refers to the Concert Hall of the previous sentence'),
 ('v20', 'trap-new-entity', 'wiki-Panama_Canal', 'It is the summit canal stretch', 'It', 'Gatun Lake (not the canal)', 'refers to Gatun Lake of the previous sentence'),
 ('v21', 'trap-new-entity', 'wiki-Colosseum', 'It was devastated by the Great Fire of Rome', 'It', 'the area where the Colosseum was later built (not the Colosseum)', 'refers to "the area" of the previous sentence, which predates the building'),
 ('v22', 'trap-new-entity', 'wiki-Sydney_Opera_House', 'It was an all-Wagner orchestral concert', 'It', 'the first public concert in the Concert Hall (an event, not the Opera House)', 'refers to the event of the previous sentence'),
 # traps: expletive "it" (no referent)
 ('v23', 'trap-expletive', 'wiki-Colosseum', 'It is often assumed, as it is with many other Roman projects', 'It', 'none (expletive, extraposed clause)', 'expletive it'),
 ('v24', 'trap-expletive', 'wiki-Sydney_Opera_House', 'It was also Goossens who insisted', 'It', 'none (cleft sentence)', 'expletive it in a cleft'),
 ('v25', 'trap-expletive', 'wiki-Sydney_Opera_House', 'It is frequently erroneously claimed that Utzon', 'It', 'none (expletive, extraposed clause)', 'expletive it'),
 ('v26', 'trap-expletive', 'wiki-Panama_Canal', 'It was announced in July 2009 that the Belgian', 'It', 'none (expletive, extraposed clause)', 'expletive it'),
 # traps: a definite description naming something other than the attended topic
 ('v27', 'trap-definite-other', 'wiki-Brooklyn_Bridge', 'The path is generally 10 to 17 feet (3.0 to 5.2 m) wide. The iron railings', 'The path', 'the elevated promenade (not the bridge)', 'the path is the promenade of the surrounding sentences'),
 ('v28', 'trap-definite-other', 'wiki-Panama_Canal', 'The original locks are 33.5 meters', 'The original locks', 'the original locks (a part, not the canal)', 'a part introduced in the surrounding sentences'),
 ('v29', 'trap-definite-other', 'wiki-Panama_Canal', 'The railroad soon became immensely profitable', 'The railroad', 'the Panama Canal Railway (not the canal)', 'the railroad named in the previous sentence; its name contains the word Canal'),
 ('v30', 'trap-definite-other', 'wiki-Golden_Gate_Bridge', 'The bonds were approved in November 1930', 'The bonds', 'the bonds of the previous sentence (not the bridge)', 'an entity of the previous sentence, not in the cast of the topic'),
]
cases = []
for cid, kind, doc, start, anaphor, ref, note in C:
    s = span(doc, start); cases.append({'id': cid, 'kind': kind, **s, 'anaphor': anaphor, 'attended_topic': TOPIC[doc], 'referent': ref, 'note': note})
man = []
for f in sorted(glob.glob('text/*.txt')):
    i = os.path.basename(f)[:-4]; raw = f'src/{i}.json'; d = json.load(open(raw))['query']['pages'][0]
    man.append({'id': i, 'title': d['title'], 'revid': d['revisions'][0]['revid'], 'revision_timestamp': d['revisions'][0]['timestamp'], 'source': 'English Wikipedia (CC BY-SA 4.0)',
                'raw_sha256': hashlib.sha256(open(raw, 'rb').read()).hexdigest(), 'text_sha256': hashlib.sha256(T[i].encode()).hexdigest(), 'text_bytes': len(T[i].encode())})
g = {'schema': 'ParaGoldBind@1', 'created': '2026-11-03', 'purpose': 'held-out scoring set for the attention binder, round 2; hand-labelled by the parent session, not blind', 'sources': man, 'cases': cases}
json.dump(g, open('PARA-GOLD-BIND-V1.json', 'w'), indent=1, ensure_ascii=False)
bad = sum(1 for c in cases if T[c['doc']].encode()[c['start']:c['end']].decode('utf-8') != c['text'])
from collections import Counter
print('cases', len(cases), dict(Counter(c['kind'] for c in cases)), 'address mismatches', bad)
for c in cases: print(c['id'], c['kind'][:14].ljust(14), c['anaphor'].ljust(10), '|', c['text'][:84])
