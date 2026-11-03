# build_bind2.py — PARA-GOLD-BIND v2: held-out scoring set for the attention binder, round 3. Hand-labelled by the parent session (not blind), from six
# Wikipedia articles the binder has never seen. Writes PARA-GOLD-BIND-V2.json (full labels) and PARA-GOLD-BIND-V2.binder.json (the scorer's schema).
import json, re, hashlib, glob, os
T = {os.path.basename(f)[:-4]: open(f, encoding='utf-8').read() for f in glob.glob('text/*.txt')}
def span(doc, start):
    t = T[doc]; assert t.count(start) == 1, (doc, start, t.count(start)); i = t.index(start)
    j = re.compile(r'[.!?]["”’)]*(?=\s|$)').search(t, i + 12).end()
    return {'doc': doc, 'start': len(t[:i].encode()), 'end': len(t[:j].encode()), 'text': t[i:j]}
E, H, U, S_, V, TJ = 'wiki-Empire_State_Building', 'wiki-Hagia_Sophia', 'wiki-Hubble_Space_Telescope', 'wiki-Suez_Canal', 'wiki-Voyager_1', 'wiki-Taj_Mahal'
TOPIC = {E: 'Empire State Building', H: 'Hagia Sophia', U: 'Hubble Space Telescope', S_: 'Suez Canal', V: 'Voyager 1', TJ: 'Taj Mahal'}
ACCEPT = {E: ['Empire State Building', 'The Empire State Building'], H: ['Hagia Sophia'], U: ['Hubble Space Telescope', 'The Hubble Space Telescope', 'Hubble'],
          S_: ['Suez Canal', 'The Suez Canal'], V: ['Voyager 1'], TJ: ['Taj Mahal', 'The Taj Mahal']}
# (id, kind, doc, starting words, anaphor, referent, note)
C = [
 ('w01', 'attended', E, 'Its name is derived from', 'Its', 'Empire State Building', 'possessive; a competing candidate (the architects) in the previous sentence'),
 ('w02', 'attended', E, 'It was ranked first on the American Institute of Architects', 'It', 'Empire State Building', 'pronoun; competing candidates (New York City, the Seven Wonders)'),
 ('w03', 'attended', H, 'It was formerly a church', 'It', 'Hagia Sophia', 'pronoun; Istanbul is a competing candidate'),
 ('w04', 'attended', H, 'It is considered the epitome of Byzantine architecture', 'It', 'Hagia Sophia', 'pronoun; the Eastern Roman Empire and the site are competing candidates'),
 ('w05', 'attended', U, 'It was not the first space telescope', 'It', 'Hubble Space Telescope', 'pronoun; Earth orbit is a competing candidate'),
 ('w06', 'attended', U, 'Its intended launch was in 1983', 'Its', 'Hubble Space Telescope', 'possessive; NASA and the European Space Agency are competing candidates'),
 ('w07', 'attended', V, 'It communicates through the NASA Deep Space Network', 'It', 'Voyager 1', 'pronoun; Voyager 2 (its twin) is a competing candidate'),
 ('w08', 'attended', TJ, 'It is regarded as one of the best examples of Mughal architecture', 'It', 'Taj Mahal', 'pronoun; the UNESCO site is a competing candidate'),
 ('w09', 'attended', E, 'The building has a roof height of 1,250 feet', 'The building', 'Empire State Building', 'definite description, same head as the name'),
 ('w10', 'attended', S_, 'The canal is operated and maintained by', 'The canal', 'Suez Canal', 'definite description, same head as the name; the Suez Canal Authority is a competing candidate'),
 ('w11', 'attended', TJ, 'The building complex incorporates the design traditions', 'The building complex', 'Taj Mahal', 'definite description, different head noun'),
 ('w12', 'attended', H, 'The current structure was built by the Byzantine emperor', 'The current structure', 'Hagia Sophia', 'definite description, different head noun; "the site" is a competing candidate'),
 ('w13', 'attended', H, 'The church has been described as', 'The church', 'Hagia Sophia', 'definite description, different head noun'),
 ('w14', 'attended', V, 'The probe made flybys of Jupiter', 'The probe', 'Voyager 1', 'definite description, different head noun'),
 ('w15', 'attended', E, 'The building was designed in the Art Deco style', 'The building', 'Empire State Building', 'definite description, same head as the name'),
 ('w16', 'attended', TJ, 'The complex was designed and executed by a multinational board', 'The complex', 'Taj Mahal', 'definite description, different head noun'),
 ('w17', 'attended', E, 'The building was originally equipped with white searchlights', 'The building', 'Empire State Building', 'opens a section'),
 ('w18', 'attended', TJ, 'The complex is set around a large charbagh', 'The complex', 'Taj Mahal', 'opens a section; different head noun'),
 ('w19', 'attended', S_, 'The canal opened under French control', 'The canal', 'Suez Canal', 'opens a section'),
 ('w20', 'attended', S_, 'The canal had an immediate and dramatic effect on world trade', 'The canal', 'Suez Canal', 'opens a section'),
 ('t01', 'trap-new-entity', U, 'It was followed by Orbiting Astronomical Observatory 2', 'It', 'OAO-1 (a predecessor, not Hubble)', 'refers to OAO-1 of the previous sentence'),
 ('t02', 'trap-new-entity', U, "It was built by NASA's Jet Propulsion Laboratory, and incorporated", 'It', 'the WF/PC camera (an instrument, not the telescope)', 'refers to the instrument of the previous sentence'),
 ('t03', 'trap-new-entity', U, 'It was built by the Goddard Space Flight Center', 'It', 'the Goddard High Resolution Spectrograph (an instrument, not the telescope)', 'refers to the instrument of the previous sentence'),
 ('t04', 'trap-new-entity', U, 'It was optimized for visible and ultraviolet light observations', 'It', 'the HSP photometer (an instrument, not the telescope)', 'refers to the instrument of the previous sentence'),
 ('t05', 'trap-new-entity', V, 'It was the first time active volcanoes had been seen', 'It', 'the discovery of volcanic activity on Io (an event, not the probe)', 'refers to the event of the previous sentence'),
 ('t06', 'trap-new-entity', V, 'It includes the sounds of whales', 'It', 'the Golden Record (not the probe)', 'refers to the record of the previous sentence'),
 ('t07', 'trap-new-entity', E, 'It also praised the 3,000,000 square feet', 'It', 'The New York Times (not the building)', 'refers to the newspaper of the previous sentence'),
 ('t08', 'trap-new-entity', S_, 'It starts at 03:30 EET from Port Said', 'It', 'the southbound convoy (not the canal)', 'refers to the convoy of the previous sentence'),
 ('t09', 'trap-expletive', E, 'It was expected that a taller broadcast tower', 'It', 'none (expletive, extraposed clause)', 'expletive it'),
 ('t10', 'trap-expletive', H, 'It is possible that both they and John the Lydian', 'It', 'none (expletive, extraposed clause)', 'expletive it'),
 ('t11', 'trap-expletive', TJ, 'It is believed that more than 20,000 artisans', 'It', 'none (expletive, extraposed clause)', 'expletive it'),
 ('t12', 'trap-expletive', S_, 'It was said the blockage would have an impact', 'It', 'none (expletive, extraposed clause)', 'expletive it'),
 ('t13', 'trap-definite-other', H, 'The first church on the site was known as', 'The first church', 'the first church on the site (a predecessor, not Hagia Sophia)', 'opens a section; a predecessor building'),
 ('t14', 'trap-definite-other', U, 'The spacecraft in which the telescope and instruments', 'The spacecraft', 'the spacecraft housing the telescope (a part, not the telescope)', 'part-whole; label-debatable'),
 ('t15', 'trap-definite-other', TJ, 'The tomb is the centrepiece of a 17-hectare', 'The tomb', 'the tomb (a part of the complex, not the whole)', 'part-whole; label-debatable'),
 ('t16', 'trap-definite-other', E, 'The site was previously owned by John Jacob Astor', 'The site', 'the site (the land, not the building)', 'opens a section; the land, not the structure'),
]
NAMED = {'t01': ['OAO-1'], 't02': ['WF/PC'], 't03': ['Goddard High Resolution Spectrograph', 'GHRS'], 't04': ['HSP'], 't07': ['The New York Times', 'New York Times']}
OPENS = {'w17', 'w18', 'w19', 'w20', 't13', 't16'}
KIND = {'attended': ('attended', None), 'trap-new-entity': ('elsewhere', 'new-entity'), 'trap-definite-other': ('elsewhere', 'definite-other'), 'trap-expletive': ('out_of_scope', 'expletive')}
cases, binder = [], []
for cid, kind, doc, start, anaphor, ref, note in C:
    s = span(doc, start)
    cases.append({'id': cid, 'kind': kind, **s, 'anaphor': anaphor, 'attended_topic': TOPIC[doc], 'referent': ref, 'opens_section': cid in OPENS, 'note': note})
    k, tk = KIND[kind]; d = {'id': cid, 'doc': doc, 'start': s['start'], 'end': s['end'], 'text': s['text'], 'surface': anaphor, 'kind': k, 'accept': ACCEPT[doc] if k == 'attended' else NAMED.get(cid, [])}
    if tk: d['trapKind'] = tk
    binder.append(d)
man = []
for f in sorted(glob.glob('text/*.txt')):
    i = os.path.basename(f)[:-4]; raw = f'src/{i}.json'; d = json.load(open(raw))['query']['pages'][0]
    man.append({'id': i, 'title': d['title'], 'revid': d['revisions'][0]['revid'], 'revision_timestamp': d['revisions'][0]['timestamp'], 'source': 'English Wikipedia (CC BY-SA 4.0)',
                'raw_sha256': hashlib.sha256(open(raw, 'rb').read()).hexdigest(), 'text_sha256': hashlib.sha256(T[i].encode()).hexdigest(), 'text_bytes': len(T[i].encode())})
json.dump({'schema': 'ParaGoldBind@2', 'created': '2026-11-03', 'purpose': 'held-out scoring set for the attention binder, round 3; hand-labelled by the parent session, not blind', 'sources': man, 'cases': cases},
          open('PARA-GOLD-BIND-V2.json', 'w'), indent=1, ensure_ascii=False)
json.dump({'cases': binder}, open('PARA-GOLD-BIND-V2.binder.json', 'w'), indent=1, ensure_ascii=False)
bad = sum(1 for c in cases if T[c['doc']].encode()[c['start']:c['end']].decode('utf-8') != c['text'])
from collections import Counter
print('cases', len(cases), dict(Counter(c['kind'] for c in cases)), 'opens a section:', sum(c['opens_section'] for c in cases), 'address mismatches', bad)
for c in cases: print(c['id'], c['kind'][:10].ljust(10), c['anaphor'].ljust(20), '|', c['text'][:78])
