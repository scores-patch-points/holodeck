# build_gold.py — PARA-GOLD v0. Statements are named by (document, exact starting words, how far they run); this script computes the byte span in the
# frozen text file. Nothing here is mined from any Fold output: the pairs and labels are written by hand below, from addressed text.
#   modes: 'sent' (to the end of the sentence), ('until', 'text') (through that text), ('lines', n) (n lines: a label/value pair)
import json, re, hashlib, glob, os, sys

T = {os.path.basename(f)[:-4]: open(f, encoding='utf-8').read() for f in glob.glob('text/*.txt')}
def span(doc, start, mode='sent'):
    t = T[doc]; assert t.count(start) == 1, (doc, start, t.count(start)); i = t.index(start)
    if mode == 'sent':
        m = re.compile(r'[.!?]["”’)]*(?=\s|$)').search(t, i + 12); j = m.end()
    elif mode[0] == 'until':
        j = t.index(mode[1], i) + len(mode[1])
    elif mode[0] == 'lines':
        j = i
        for _ in range(mode[1]): j = t.index('\n', j) + 1
        j -= 1
    b0 = len(t[:i].encode()); b1 = len(t[:j].encode())
    return {'doc': doc, 'start': b0, 'end': b1, 'text': t[i:j]}

S = lambda *a, **k: span(*a, **k)
pairs = [
 # kind S: same referent, same figure, independent sources: equivalent for answering the question
 ('s01', 'same', 'How tall is the Gateway Arch?', S('jeff-fact', 'Maximum Height', ('lines', 2)), S('wiki-Gateway_Arch', 'The Gateway Arch is a 630-foot-tall', ('until', '(192 m) monument')), ''),
 ('s02', 'same', 'How long is the Cumberland River?', S('cumb-army-284227', 'The Cumberland River is an expansive waterway stretching 688 miles'), S('wiki-Cumberland_River', 'The 688-mile-long (1,107 km) river drains'), 'the second statement also states a drainage area; equal on the asked length'),
 ('s03', 'same', 'How long is the Cumberland River?', S('cumb-army-286019', 'For more than 100 years after achieving'), S('wiki-Cumberland_River', 'The 688-mile-long (1,107 km) river drains'), 'the first states the length in passing; equal on the asked length'),
 ('s04', 'same', 'How high is Mount Rushmore above sea level?', S('moru-student', 'Borglum liked the idea, and scouted out a broad wall', ('until', '5,725 foot Mount Rushmore')), S('wiki-Mount_Rushmore', 'Its elevation at its highest point is 5,725 feet'), ''),
 ('s05', 'same', 'How tall are the heads at Mount Rushmore?', S('moru-heads', 'The head of George Washington is 60 feet'), S('wiki-Mount_Rushmore', 'The sculpture features 60-foot-tall (18 m) depictions of the heads', ('until', 'and Abraham Lincoln')), 'the first also states a nose length; equal on the asked head height'),
 ('s06', 'same', 'When did work on Mount Rushmore begin?', S('moru-student', 'Work commenced officially on October 4, 1927.'), S('wiki-Mount_Rushmore', 'Between October 4, 1927', ('until', 'October 31, 1941')), 'the second also states the end date'),
 ('s07', 'same', 'How wide is the widest part of the Mississippi River?', S('miss-nps', 'The widest part of the Mississippi can be found'), S('wiki-Mississippi_River', 'The Upper Mississippi has a number of natural and artificial lakes', ('until', 'over 11 miles (18 km) across')), ''),
 ('s08', 'same', 'How much concrete was used in total at Hoover Dam?', S('hoover-nps', 'Over the next five years, over 4.4 million cubic yards'), S('hoover-project', 'The dam contains 3.25 million cubic yards of concrete; total'), 'the second also states 3.25 million for the dam alone; equal on the asked total, 4.4 million'),
 ('s09', 'same', 'How many steps are in each leg of the Gateway Arch?', S('jeff-fact', 'Number of stairs', ('lines', 2)), S('wiki-Gateway_Arch', 'two sets of 1,076-step emergency stairs (one per leg)', ('until', 'emergency stairs (one per leg)')), ''),
 # kind O: same referent, different figure, different quantity or different standing: not equivalent
 ('o01', 'other', 'How tall is the Gateway Arch?', S('jeff-fact', 'Maximum Height', ('lines', 2)), S('jeff-fact', 'Outer Width - Outside North Leg to Outer South Leg', ('lines', 2)), 'same figure (630 ft), different quantity: width, not height'),
 ('o02', 'other', 'How tall is the Gateway Arch?', S('jeff-fact', 'Maximum Height', ('lines', 2)), S('wiki-Gateway_Arch', 'At submission, Saarinen'), 'a different figure: an earlier plan, 569 ft'),
 ('o03', 'other', 'How long is the Mississippi River?', S('miss-nps', 'The Mississippi River is the second longest river in North America, flowing 2,350 miles'), S('wiki-Mississippi_River', 'From its traditional source of Lake Itasca'), 'two independent sources give 2,350 and 2,340 miles; the NPS page itself lists 2,300 and 2,320'),
 ('o04', 'other', 'How much concrete is in Hoover Dam?', S('hoover-kid', 'There is enough concrete in Hoover Dam', ('until', '(4 1/2 million cubic yards)')), S('hoover-project', 'The dam contains 3.25 million cubic yards of concrete', ('until', '3.25 million cubic yards of concrete')), 'different figures: 4.5 million vs 3.25 million (the sources count different things)'),
 ('o05', 'other', "How long were Armstrong and Aldrin on the Moon's surface?", S('apollo-nasa', 'Armstrong and Aldrin spent 21 hours, 36 minutes'), S('apollo-nasa', 'The entire EVA phase lasted more than two-and-a-half hours', ('until', 'two-and-a-half hours')), 'different quantity: the moonwalk, not the stay on the surface'),
 ('o06', 'other', 'How long is the Cumberland River?', S('cumb-army-284227', 'The Cumberland River is an expansive waterway stretching 688 miles'), S('cumb-army-286019', 'Sharp, who served as Nashville District Operations assistant chief', ('until', 'approximately 190 miles')), 'different quantity: the reach from the mouth to Nashville'),
 ('o07', 'other', 'How tall are the heads at Mount Rushmore?', S('moru-heads', 'The head of George Washington is 60 feet'), S('wiki-Mount_Rushmore', "Borglum's original plan was to make the carvings", ('until', '490-foot-high (150 m) granite pillars')), 'a plan for pillars, not the heads'),
 ('o08', 'other', 'How much did the Concorde programme cost?', S('wiki-Concorde', 'Studies began in 1954 and a UK–France treaty followed in 1962'), S('wiki-Concorde', 'Delays and cost overruns pushed costs'), 'an estimate (70 million pounds) against the later outturn (1.5 to 2.1 billion); different figure and standing'),
 # kind R: different referent, same form of statement
 ('r01', 'other', 'How tall is the Gateway Arch?', S('jeff-fact', 'Maximum Height', ('lines', 2)), S('stli-nps', 'Top of base to torch', ('lines', 3)), 'different referent: the Statue of Liberty'),
 ('r02', 'other', 'How high is Mount Rushmore above sea level?', S('wiki-Mount_Rushmore', 'Its elevation at its highest point is 5,725 feet'), S('wiki-Mount_Rushmore', 'The tallest mountain in the region is Black Elk Peak'), 'different referent: Black Elk Peak'),
 ('r03', 'other', 'How long is the Mississippi River?', S('miss-nps', 'The Mississippi River is the second longest river in North America, flowing 2,350 miles'), S('cumb-army-284227', 'The Cumberland River is an expansive waterway stretching 688 miles'), 'different referent: the Cumberland River'),
 ('r04', 'other', 'How tall is the Statue of Liberty?', S('stli-nps', 'Top of base to torch', ('lines', 3)), S('jeff-height', 'The Gateway Arch is 75 feet taller than the Washington Monument'), 'the second is about the Arch, and gives no height for the Statue'),
 # kind C: one-way: the first entails the second, not the reverse
 ('c01', 'contained', "How long were Armstrong and Aldrin on the Moon's surface?", S('apollo-nasa', 'Armstrong and Aldrin spent 21 hours, 36 minutes'), S('wiki-Apollo_11', 'After more than 21 hours on the surface', ('until', 'lunar orbit')), '21 h 36 min entails "more than 21 hours"; the reverse does not hold'),
]
binding = [  # a sentence whose subject is a pronoun or a definite description, and the referent a reader attending to this text would give it
 ('b01', 'wiki-Eiffel_Tower', 'It is named after the engineer Gustave Eiffel', 'It', 'Eiffel Tower', 'pronoun, with other names in the sentence'),
 ('b02', 'wiki-Eiffel_Tower', 'The tower received 5,889,000 visitors', 'The tower', 'Eiffel Tower', 'definite description'),
 ('b03', 'wiki-Eiffel_Tower', 'It was designated a monument historique', 'It', 'Eiffel Tower', 'pronoun'),
 ('b04', 'wiki-Eiffel_Tower', 'The tower is 330 metres (1,083 ft) tall', 'The tower', 'Eiffel Tower', 'definite description'),
 ('b05', 'wiki-Eiffel_Tower', 'It was the first structure in the world to surpass', 'It', 'Eiffel Tower', 'pronoun'),
 ('b06', 'wiki-Eiffel_Tower', 'The tower has three levels for visitors', 'The tower', 'Eiffel Tower', 'definite description'),
 ('b07', 'wiki-Eiffel_Tower', 'It was envisaged after discussion about a suitable centrepiece', 'It', 'Eiffel Tower', 'pronoun'),
 ('b08', 'wiki-Eiffel_Tower', 'He later established a separate company to manage the tower', 'He', 'Gustave Eiffel', 'personal pronoun; the center has shifted from the tower to its engineer'),
 ('b09', 'wiki-Eiffel_Tower', 'It came to a head as work began at the Champ de Mars', 'It', 'the debate about architecture and engineering (not the tower)', 'pronoun whose referent is the preceding sentence, not the attended topic'),
 ('b10', 'wiki-Concorde', 'It is powered by four Rolls-Royce/Snecma Olympus 593 turbojets', 'It', 'Concorde', 'pronoun'),
 ('b11', 'wiki-Concorde', 'Constructed from aluminium, it was the first airliner', 'it', 'Concorde', 'pronoun after a participial phrase'),
 ('b12', 'wiki-Concorde', 'The airliner had transatlantic range', 'The airliner', 'Concorde', 'definite description with a different head noun'),
 ('b13', 'wiki-Concorde', 'Its only competitor was the Tupolev Tu-144', 'Its', 'Concorde', 'possessive pronoun'),
 ('b14', 'wiki-Concorde', 'On 9 October 1975, it received its French certificate', 'it', 'Concorde', 'pronoun'),
 ('b15', 'wiki-Cumberland_River', 'The river flows generally west', 'The river', 'Cumberland River', 'definite description'),
]
bind = []
for bid, doc, start, surf, ref, note in binding:
    s = span(doc, start, 'sent'); bind.append({'id': bid, **s, 'surface': surf, 'referent': ref, 'note': note})

man = []
URLS = dict(l.split('\t') for l in open('urls.tsv').read().strip().split('\n'))
for f in sorted(glob.glob('text/*.txt')):
    i = os.path.basename(f)[:-4]; raw = f'src/{i}.html' if os.path.exists(f'src/{i}.html') else f'src/{i}.json'
    e = {'id': i, 'raw_sha256': hashlib.sha256(open(raw, 'rb').read()).hexdigest(), 'text_sha256': hashlib.sha256(T[i].encode()).hexdigest(), 'text_bytes': len(T[i].encode())}
    if i.startswith('wiki-'):
        d = json.load(open(raw))['query']['pages'][0]; e.update({'source': 'English Wikipedia (CC BY-SA 4.0)', 'title': d['title'], 'revid': d['revisions'][0]['revid'], 'revision_timestamp': d['revisions'][0]['timestamp'],
                  'how': 'MediaWiki API action=query prop=extracts explaintext=1'})
    else:
        e.update({'source': 'US government page (public domain)', 'url': URLS[i], 'retrieved': '2026-11-03', 'how': 'curl, visible text of <main>, see extract.py'})
    man.append(e)
gold = {'schema': 'ParaGold@0', 'created': '2026-11-03', 'lens': 'a statement is equivalent to another when it answers the same question with the same quantity, standing and referent',
        'kinds': {'same': 'equivalent for answering the question', 'other': 'not equivalent: different figure, quantity, standing or referent', 'contained': 'the first entails the second, not the reverse'},
        'sources': man,
        'pairs': [{'id': p[0], 'kind': p[1], 'question': p[2], 'a': p[3], 'b': p[4], 'note': p[5]} for p in pairs], 'binding': bind}
json.dump(gold, open('PARA-GOLD.json', 'w'), indent=1, ensure_ascii=False)

# verify: every address re-slices to its own text, from the frozen files, and pairs are about the same question
bad = 0
for it in [x for p in gold['pairs'] for x in (p['a'], p['b'])] + gold['binding']:
    b = T[it['doc']].encode()[it['start']:it['end']].decode('utf-8')
    if b != it['text']: bad += 1; print('MISMATCH', it['doc'], it['start'])
from collections import Counter
print('pairs', len(gold['pairs']), dict(Counter(p['kind'] for p in gold['pairs'])), 'binding', len(bind), dict(Counter(('definite' if b['surface'].lower().startswith('the ') else 'pronoun') for b in bind)), 'address mismatches', bad)
for p in gold['pairs'][:3] + gold['pairs'][-3:]: print(p['id'], p['kind'], '|', p['a']['text'][:70].replace('\n', ' / '), '||', p['b']['text'][:70].replace('\n', ' / '))
for b in bind: print(b['id'], b['surface'], '->', b['referent'][:30], '|', b['text'][:100])
