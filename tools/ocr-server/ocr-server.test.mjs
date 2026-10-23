// ocr-server.test.mjs — node --test tools/ocr-server/ocr-server.test.mjs
// Pure parts (fusion, prior, parsers) always run. Parts that need poppler or a real eye skip when it is not installed,
// so the suite means the same thing on a Mac, a Linux box and a Windows machine.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Prior, fuse, wordF1, parts, assemble } from './fuse.mjs';
import { parseTsv } from './adapters/tesseract.mjs';
import { fromHelper } from './adapters/vision-macos.mjs';
import { sniff, readDocument } from './reader.mjs';
import { handleOcr, handleHealth, corsHeaders } from './route.mjs';
import { run, have } from './proc.mjs';
import vision from './adapters/vision-macos.mjs';
import { createServer as netServer } from 'node:net';
import { spawn } from 'node:child_process';
import { detect } from './engines.mjs';

const lines = (...ls) => ls.map((t) => ({ t }));
const priorOf = (...pages) => { const p = new Prior(2); pages.forEach((t) => p.add(t)); return p; };
const TEXT_PDF = fileURLToPath(new URL('../../pdfs/titanic-1997.pdf', import.meta.url));
const poppler = (await have('pdfinfo', ['-v'])) && (await have('pdftotext', ['-v'])) && (await have('pdftoppm', ['-v']));

// ── the prior ───────────────────────────────────────────────────────────────────────────────────────────────────
test('parts: letters and digits, lower-cased, across punctuation', () => {
  assert.deepEqual(parts('Jane.Doe@example.gov'), ['jane', 'doe', 'example', 'gov']);
  assert.deepEqual(parts('(Parks)'), ['parks']);
  assert.deepEqual(parts('—'), []);
});
test('a word is known when at least two pages use it, and a page cannot vouch for itself', () => {
  const p = priorOf('Parks replacement trucks', 'Parks landscape', 'trucks only here');
  assert.equal(p.knows('Parks'), true);
  assert.equal(p.knows('trucks,'), true);
  assert.equal(p.knows('landscape'), false); // one page
  const own = Prior.partsOf('Parks landscape');
  assert.equal(p.knows('Parks', own), false); // two pages use it, but one of them is the page asking
  assert.equal(p.knows('—'), true); // pure punctuation: nothing to know
});

// ── fusion ──────────────────────────────────────────────────────────────────────────────────────────────────────
test('agreed words stand and the lines keep their shape', () => {
  const f = fuse(lines('Parks replacement trucks', 'Thanks Robin'), lines('Parks replacement trucks', 'Thanks Robin'), priorOf());
  assert.equal(f.text, 'Parks replacement trucks\nThanks Robin');
  assert.equal(f.stats.agreed, 5); assert.equal(f.dropped.length, 0);
});
test('where the eyes differ, the spelling the document uses wins', () => {
  const prior = priorOf('Parks replacement landscape trucks', 'Parks trucks order');
  const f = fuse(lines('Perks replacement landscape trucks'), lines('Parks replacement landscape trucks'), prior);
  assert.equal(f.text, 'Parks replacement landscape trucks');
  assert.deepEqual(f.dropped, [{ eye: 'base', w: 'Perks' }]);
});
test('where the prior knows both or neither, the primary eye stands', () => {
  const none = fuse(lines('alpha zorb'), lines('alpha zorv'), priorOf());
  assert.equal(none.text, 'alpha zorb');
  const both = priorOf('zorb zorv', 'zorb zorv');
  assert.equal(fuse(lines('alpha zorb'), lines('alpha zorv'), both).text, 'alpha zorb');
});
test('a word only the secondary eye saw is kept only if the document knows it', () => {
  const prior = priorOf('trucks delivery', 'trucks delivery');
  const f = fuse(lines('order trucks'), lines('order trucks delivery'), prior);
  assert.equal(f.text, 'order trucks delivery');
  const g = fuse(lines('order trucks'), lines('order trucks xyzzy'), prior);
  assert.equal(g.text, 'order trucks');
  assert.deepEqual(g.dropped, [{ eye: 'other', w: 'xyzzy' }]);
});
test('strict drops a primary-only word the document does not know, but never a number', () => {
  const prior = priorOf('quote total', 'quote total', 'quote total');
  const base = lines('quote total $42,317 zzzq'), other = lines('quote total');
  assert.equal(fuse(base, other, prior, { policy: 'keep-base' }).text, 'quote total $42,317 zzzq');
  const s = fuse(base, other, prior, { policy: 'strict' });
  assert.equal(s.text, 'quote total $42,317');
  assert.deepEqual(s.dropped, [{ eye: 'base', w: 'zzzq' }]);
});
test('runs of different lengths come from the side the document knows better', () => {
  const prior = priorOf('landscape trucks order', 'landscape trucks order');
  const f = fuse(lines('go landscape trucks order done'), lines('go landsca pe trucks order done'), prior);
  assert.equal(f.text, 'go landscape trucks order done');
});
test('a page too dense to align is left to the primary eye, and says so', () => {
  // the shared first and last words are trimmed before the cells are counted: the middle here is 4 x 4 = 16
  const f = fuse(lines('a b c d e f'), lines('a w x y z f'), priorOf(), { maxCells: 4 });
  assert.equal(f.aligned, false); assert.equal(f.text, 'a b c d e f');
});
test('with a prior that knows nothing, the fusion IS the primary eye (the invariant the prior has to earn its gains against)', () => {
  const base = lines('Subject: FW: Perks replacement | landscape trucke', 'Marlowe, Robin 1 (Fieet Management)');
  const other = lines('Subject: FW: Parks replacement landscape trucks', '| Marlowe Robin | (Fleet Management) xyzzy');
  for (const policy of ['keep-base', 'strict']) {
    const f = fuse(base, other, new Prior(2), { policy });
    assert.equal(f.text, base.map((l) => l.t).join('\n'), policy);
  }
});
test('punctuation is not a word: a stray bar never displaces a real word, known or not', () => {
  const prior = priorOf('Robin Marlowe', 'Robin Marlowe');
  const f = fuse(lines('Robin Quillfeather'), lines('Robin |'), prior);
  assert.equal(f.text, 'Robin Quillfeather');
  assert.deepEqual(f.dropped, [{ eye: 'other', w: '|' }]);
});
test('strict needs a prior that has read something: a tiny prior does not get to throw words away', () => {
  const tiny = priorOf('quote total', 'quote total'); // 2 pages
  assert.equal(fuse(lines('quote total zzzq'), lines('quote total'), tiny, { policy: 'strict' }).text, 'quote total zzzq');
  const enough = priorOf('quote total', 'quote total', 'quote total');
  assert.equal(fuse(lines('quote total zzzq'), lines('quote total'), enough, { policy: 'strict' }).text, 'quote total');
});
test('one eye empty: the other stands alone', () => {
  assert.equal(fuse([], lines('hello there'), priorOf()).text, 'hello there');
  assert.equal(fuse(lines('hello there'), [], priorOf()).text, 'hello there');
});
test('assemble starts a new line wherever the line number changes', () => {
  assert.equal(assemble([{ w: 'a', line: 0 }, { w: 'b', line: 0 }, { w: 'c', line: 1 }]), 'a b\nc');
});
test('wordF1 scores a multiset of words, case and punctuation aside', () => {
  const s = wordF1('The Parks trucks, again.', 'the parks trucks');
  assert.ok(Math.abs(s.precision - 1) < 1e-9); assert.ok(Math.abs(s.recall - 0.75) < 1e-9);
  assert.equal(wordF1('', '').f1, 0);
});

// ── parsers ─────────────────────────────────────────────────────────────────────────────────────────────────────
test('tesseract TSV becomes lines of words with boxes and confidences', () => {
  const head = 'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext';
  const tsv = [head, '1\t1\t0\t0\t0\t0\t0\t0\t100\t100\t-1\t', '5\t1\t1\t1\t1\t1\t10\t20\t30\t10\t96\tParks', '5\t1\t1\t1\t1\t2\t45\t20\t50\t10\t90\ttrucks', '5\t1\t1\t1\t2\t1\t10\t40\t20\t10\t-1\tghost', '5\t1\t1\t1\t2\t2\t10\t40\t20\t10\t80\tThanks'].join('\n');
  const ls = parseTsv(tsv);
  assert.equal(ls.length, 2);
  assert.equal(ls[0].t, 'Parks trucks'); assert.deepEqual(ls[0].b, [10, 20, 95, 30]); assert.equal(ls[0].c, 93);
  assert.equal(ls[1].t, 'Thanks'); // the -1 word is not a word
});
test('the Apple Vision helper line becomes the common shape, confidence 0..100', () => {
  const r = fromHelper({ image: 'p.png', ms: 7, w: 100, h: 50, lines: [{ t: 'Parks trucks', c: 0.5, b: [1, 2, 3, 4], words: [{ t: 'Parks', b: [1, 2, 2, 4] }, { t: 'trucks' }] }] });
  assert.equal(r.lines[0].c, 50); assert.equal(r.lines[0].words[0].c, 50); assert.equal(r.lines[0].words[1].b, null);
  assert.match(fromHelper({ image: 'x', error: 'could not decode the image' }).error, /apple-vision/);
});
test('a language Vision has no mapping for is a typed gap, not a quiet fall back to English', async () => {
  const [r] = await vision.read(['/nonexistent.png'], { lang: 'zzz' });
  assert.match(r.error, /no Vision language mapped for "zzz"/);
  assert.equal(r.lines, undefined);
});
test('sniff reads the first bytes, not the name', () => {
  assert.equal(sniff(Buffer.from('%PDF-1.7\n')), 'pdf');
  assert.equal(sniff(Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10])), 'image');
  assert.equal(sniff(Buffer.from('hello world, plain text')), null);
});

// ── the reader, with eyes we control ────────────────────────────────────────────────────────────────────────────
// a blank 3-page PDF: no text layer at all, so every page is a scan
const BLANK3 = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R 4 0 R 5 0 R]/Count 3>>endobj\n'
  + [3, 4, 5].map((n) => `${n} 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 120 120]>>endobj\n`).join('') + 'trailer<</Root 1 0 R/Size 6>>\n%%EOF\n');
const fakeEye = (id, rank, say) => ({ id, label: id, rank, onDevice: true, platforms: ['*'], async probe() { return { ok: true }; },
  async read(images) { return images.map((image) => { const n = +/p(\d+)\.png$/.exec(image)[1]; return { image, ms: 1, lines: lines(say[n] || 'nothing') }; }); } });

test('a PDF that carries its text is read from the text, and no eye is asked', { skip: !poppler || !existsSync(TEXT_PDF) }, async () => {
  const eye = fakeEye('spy', 0, {}); let asked = 0; const read = eye.read; eye.read = async (...a) => { asked++; return read(...a); };
  const ev = []; const out = await readDocument(await readFile(TEXT_PDF), { max: 9, engines: [eye] }, (e) => ev.push(e));
  assert.equal(asked, 0);
  assert.equal(ev[0].event, 'start'); assert.equal(ev[0].scannedPages, 0); assert.equal(ev.at(-1).event, 'done');
  const pg = ev.filter((e) => e.event === 'page'); assert.deepEqual(pg.map((p) => p.page), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.ok(pg.every((p) => p.eye === 'textlayer')); assert.match(pg[0].text, /Titanic/i);
  assert.equal(out.textLayer, 9); assert.equal(out.ocr, 0);
});
test('scanned pages are read by both eyes and folded; with no text layer the eyes\' agreed words are the prior', { skip: !poppler }, async () => {
  const a = fakeEye('a', 0, { 1: 'Parks replacement trucks order', 2: 'Parks replacement trucks order', 3: 'Perks replacement trucks order' });
  const b = fakeEye('b', 1, { 1: 'Parks replacement trucks order', 2: 'Parks replacement trucks order', 3: 'Parks replacement trucks order' });
  const ev = []; await readDocument(BLANK3, { engines: [a, b], dpi: 72 }, (e) => ev.push(e));
  assert.equal(ev[0].prior.bootstrap, true); assert.equal(ev[0].scannedPages, 3);
  const pg = ev.filter((e) => e.event === 'page'); assert.deepEqual(pg.map((p) => p.page), [1, 2, 3]);
  assert.equal(pg[2].text, 'Parks replacement trucks order'); // page 3: 'Perks' loses to the spelling the other pages agreed on
  assert.deepEqual(pg[2].dropped, [{ eye: 'base', w: 'Perks' }]); assert.equal(pg[2].eye, 'a+b');
  assert.equal(pg[0].witnesses.length, 2);
});
test('one working eye is enough; the other\'s failure is a note, not a hole', { skip: !poppler }, async () => {
  const good = fakeEye('good', 1, { 1: 'hello there', 2: 'hello there', 3: 'hello there' });
  const bad = { ...fakeEye('bad', 0, {}), async read(images) { return images.map((image) => ({ image, error: 'bad: boom' })); } };
  const ev = []; await readDocument(BLANK3, { engines: [bad, good], dpi: 72 }, (e) => ev.push(e));
  const pg = ev.filter((e) => e.event === 'page'); assert.equal(pg[0].text, 'hello there'); assert.equal(pg[0].eye, 'good'); assert.match(pg[0].note, /boom/);
});
test('nothing that can read pixels is a 503 with the install line, before any event', { skip: !poppler }, async () => {
  const ev = []; await assert.rejects(readDocument(BLANK3, { engines: [], dpi: 72 }, (e) => ev.push(e)), (e) => e.status === 503 && /install|brew|apt|Tesseract/i.test(e.message));
  assert.equal(ev.length, 0);
});
test('not a PDF or an image is a 415', async () => {
  await assert.rejects(readDocument(Buffer.from('hello'), {}, () => {}), (e) => e.status === 415);
});

// ── the HTTP face ───────────────────────────────────────────────────────────────────────────────────────────────
test('POST /ocr streams start, pages in order, done; refuses what is not a document; GET /health says what this machine has', { skip: !poppler || !existsSync(TEXT_PDF) }, async () => {
  const srv = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'GET' && url.pathname === '/health') return handleHealth(req, res);
    if (req.method === 'POST' && url.pathname === '/ocr') return handleOcr(req, res, url);
    res.writeHead(404).end();
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  try {
    const r = await fetch(base + '/ocr?max=3', { method: 'POST', body: await readFile(TEXT_PDF) });
    assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /ndjson/);
    const ev = (await r.text()).trim().split('\n').map((l) => JSON.parse(l));
    assert.deepEqual(ev.map((e) => e.event), ['start', 'page', 'page', 'page', 'done']);
    assert.equal(ev[0].total, 3); assert.ok(ev[0].pages >= 3);
    const bad = await fetch(base + '/ocr', { method: 'POST', body: 'not a document' });
    assert.equal(bad.status, 415);
    const h = await (await fetch(base + '/health')).json();
    assert.equal(h.ok, true); assert.ok(Array.isArray(h.engines)); assert.equal(typeof h.canReadPixels, 'boolean'); assert.ok(h.engines.every((e) => e.onDevice));
  } finally { srv.close(); }
});
test('CORS: a loopback page may call the service, a stranger may not, and there is no wildcard', () => {
  assert.equal(corsHeaders({ headers: { origin: 'http://127.0.0.1:8813' } })['Access-Control-Allow-Origin'], 'http://127.0.0.1:8813');
  assert.equal(corsHeaders({ headers: { origin: 'http://localhost:3000' } })['Access-Control-Allow-Origin'], 'http://localhost:3000');
  assert.deepEqual(corsHeaders({ headers: { origin: 'https://evil.example' } }), {});
  assert.deepEqual(corsHeaders({ headers: {} }), {});
});

// ── a real eye on a real page (page 4 of the fixture, the first dense one, as pixels only) ───────────────────────────────────────────
test('the real eyes read a page of pixels and the words come back', { skip: !poppler || !existsSync(TEXT_PDF), timeout: 600000 }, async () => {
  const { eyes } = await detect({ force: true });
  if (!eyes.length) return;
  const dir = await mkdtemp(join(tmpdir(), 'hd-ocr-test-'));
  try {
    const png = join(dir, 'page');
    await run('pdftoppm', ['-r', '150', '-f', '4', '-l', '4', '-png', '-singlefile', TEXT_PDF, png], { timeout: 120000 });
    const truth = (await run('pdftotext', ['-layout', '-f', '4', '-l', '4', TEXT_PDF, '-'])).out;
    for (const e of eyes) {
      const [r] = await e.read([png + '.png'], {});
      assert.ok(r.lines && r.lines.length > 5, e.id + ' read no lines: ' + (r.error || ''));
      const f = wordF1(truth, r.lines.map((l) => l.t).join('\n'));
      assert.ok(f.f1 > 0.8, `${e.id} F1 ${f.f1.toFixed(3)} on a clean rendered page`);
      assert.ok(r.lines.every((l) => l.b && l.b.length === 4 && l.b[2] > l.b[0] && l.b[3] > l.b[1]), e.id + ' boxes are x0,y0,x1,y1');
    }
  } finally { rm(dir, { recursive: true, force: true }).catch(() => {}); }
});

// ── the dev server's wiring: tools/serve.mjs mounts the same reader at POST /ocr ─────────────────────────────────
test('tools/serve.mjs serves POST /ocr and GET /ocr-health from the same reader', { skip: !poppler || !existsSync(TEXT_PDF), timeout: 60000 }, async () => {
  const port = await new Promise((res) => { const s = netServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
  const child = spawn(process.execPath, [fileURLToPath(new URL('../serve.mjs', import.meta.url)), String(port)], { stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('serve.mjs did not start')), 20000); child.stdout.on('data', (d) => { if (String(d).includes('the fold surface on')) { clearTimeout(t); res(); } }); child.on('exit', () => rej(new Error('serve.mjs exited'))); });
    const base = 'http://127.0.0.1:' + port;
    const r = await fetch(base + '/ocr?max=2', { method: 'POST', body: await readFile(TEXT_PDF) });
    assert.equal(r.status, 200);
    const ev = (await r.text()).trim().split('\n').map((l) => JSON.parse(l));
    assert.deepEqual(ev.map((e) => e.event), ['start', 'page', 'page', 'done']);
    assert.ok(ev.slice(1, 3).every((e) => e.eye === 'textlayer' && /\S/.test(e.text)));
    assert.equal((await fetch(base + '/ocr', { method: 'POST', body: 'not a document' })).status, 415);
    const h = await (await fetch(base + '/ocr-health')).json();
    assert.equal(h.ok, true); assert.ok(Array.isArray(h.engines));
  } finally { child.kill(); }
});
