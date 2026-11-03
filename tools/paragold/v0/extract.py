# extract.py — PARA-GOLD text extraction, deterministic. Wikipedia: the API's plain-text extract (explaintext). Other pages: visible text of <main>
# (else <body>) with script/style/nav/header/footer/aside/form removed; block elements break lines; whitespace collapsed; empty lines dropped.
import json, glob, os, re, hashlib
from html.parser import HTMLParser
SKIP = {'script','style','noscript','nav','header','footer','aside','form','svg','template'}
BLOCK = {'p','div','li','h1','h2','h3','h4','h5','h6','tr','br','section','article','ul','ol','table','dd','dt','blockquote'}
class P(HTMLParser):
    def __init__(s): super().__init__(convert_charrefs=True); s.skip=0; s.out=[]; s.main=[]; s.inmain=0
    def handle_starttag(s,t,a):
        if t in SKIP: s.skip+=1
        if t=='main': s.inmain+=1
        if t in BLOCK: s.out.append('\n'); s.inmain and s.main.append('\n')
    def handle_endtag(s,t):
        if t in SKIP and s.skip: s.skip-=1
        if t=='main' and s.inmain: s.inmain-=1
        if t in BLOCK: s.out.append('\n'); s.inmain and s.main.append('\n')
    def handle_data(s,d):
        if s.skip: return
        s.out.append(d); s.inmain and s.main.append(d)
def clean(t):
    lines=[re.sub(r'[ \t ]+',' ',l).strip() for l in t.split('\n')]
    return '\n'.join(l for l in lines if l)+'\n'
os.makedirs('text', exist_ok=True); man=[]
for f in sorted(glob.glob('src/*.html')):
    i=os.path.basename(f)[:-5]; p=P(); p.feed(open(f,encoding='utf-8',errors='replace').read())
    t=clean(''.join(p.main) if len(''.join(p.main).strip())>200 else ''.join(p.out)); open(f'text/{i}.txt','w',encoding='utf-8').write(t)
    man.append((i,hashlib.sha256(open(f,'rb').read()).hexdigest(),hashlib.sha256(t.encode()).hexdigest(),len(t.encode())))
for f in sorted(glob.glob('src/wiki-*.json')):
    i=os.path.basename(f)[:-5]; d=json.load(open(f))['query']['pages'][0]; t=clean(d['extract']); open(f'text/{i}.txt','w',encoding='utf-8').write(t)
    man.append((i,hashlib.sha256(open(f,'rb').read()).hexdigest(),hashlib.sha256(t.encode()).hexdigest(),len(t.encode())))
for m in man: print(*m[:1], m[1][:10], m[2][:10], m[3])
