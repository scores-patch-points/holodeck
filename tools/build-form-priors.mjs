// build-form-priors.mjs — the IRS's own blank forms, as priors the reader can hunt for when something is uploaded.
//
// A filed form is two layers: what the IRS printed (the same on every return of that form and year) and what the filer filled in. The blank
// form is published with a real text layer and its fill-in fields, so both are measurable here, once, offline, and shipped with the page:
//   words   every printed word with its box (pdftotext -bbox-layout)
//   fields  every fill-in field with its box and kind (MuPDF widgets), and its LABEL — the printed text just left of the box on its row, or
//           just above it — and, for a number in a column, the column's heading ("Prior Year", "Current Year")
// No label is written by hand: each comes from the IRS's own print. The page loads one prior only when an upload names that form and year.
//
//   node tools/build-form-priors.mjs [--pages 12]        writes reading/form-priors/f990-YYYY.json and reading/form-priors/index.json
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// labels and headings are measured by the same code the page uses on a prior it finds while hunting (reading/prior-measure.js)
import { labelPage } from '../reading/prior-measure.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = resolve(HERE, '.irs-cache'), OUT = resolve(HERE, '../reading/form-priors');
const PAGES = process.argv.includes('--pages') ? +process.argv[process.argv.indexOf('--pages') + 1] : 12;
const FORMS = [{ form: '990', title: 'Return of Organization Exempt From Income Tax', years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] }];
mkdirSync(OUT, { recursive: true }); mkdirSync(CACHE, { recursive: true });

const WIDGETS_JS = `var doc = Document.openDocument(scriptArgs[0]); var n = Math.min(doc.countPages(), +scriptArgs[1]); var out = [];
for (var i = 0; i < n; i++) { var p = doc.loadPage(i), ws = p.getWidgets(), b = p.getBounds(); var fs = [];
  for (var j = 0; j < ws.length; j++) { var w = ws[j], r = w.getRect(); fs.push({ name: w.getName(), type: w.getFieldType(), rect: [r[0], r[1], r[2], r[3]] }); }
  out.push({ n: i + 1, w: b[2] - b[0], h: b[3] - b[1], fields: fs }); }
print(JSON.stringify(out));`;
const r1 = (x) => Math.round(x * 10) / 10;

function wordsOf(pdf, pages) {
  const html = execFileSync('pdftotext', ['-f', '1', '-l', String(pages), '-bbox-layout', pdf, '-'], { encoding: 'utf8', maxBuffer: 1 << 28 });
  const out = []; let page = null;
  for (const m of html.matchAll(/<page width="([\d.]+)" height="([\d.]+)">|<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g)) {
    if (m[1]) { page = { w: +m[1], h: +m[2], words: [] }; out.push(page); continue; }
    const t = m[7].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    page.words.push([t, r1(+m[3]), r1(+m[4]), r1(+m[5]), r1(+m[6])]);
  }
  return out;
}

const index = [];
for (const F of FORMS) for (const y of F.years) {
  const url = `https://www.irs.gov/pub/irs-prior/f${F.form}--${y}.pdf`, pdf = resolve(CACHE, `f${F.form}--${y}.pdf`);
  if (!existsSync(pdf)) execFileSync('curl', ['-s', '-m', '60', '-o', pdf, url]);
  const bytes = readFileSync(pdf), sha256 = createHash('sha256').update(bytes).digest('hex');
  const words = wordsOf(pdf, PAGES);
  const js = resolve(CACHE, 'widgets.js'); writeFileSync(js, WIDGETS_JS);
  const widgets = JSON.parse(execFileSync('mutool', ['run', js, pdf, String(PAGES)], { encoding: 'utf8', maxBuffer: 1 << 28 }));
  const pages = widgets.map((wp, i) => {
    const ws = (words[i] || { words: [] }).words, fields = wp.fields.map((f) => ({ ...f, rect: f.rect.map(r1), name: f.name.replace(/^topmostSubform\[0\]\./, '') }));
    for (const f of fields) f.line = (f.name.match(/(Line[A-Za-z0-9_]+|Part[A-Za-z0-9_]+)\[/) || [])[1] || null;
    labelPage({ words: ws, fields });
    return { n: wp.n, w: r1(wp.w), h: r1(wp.h), words: ws, fields };
  });
  const file = `f${F.form}-${y}.json`;
  writeFileSync(resolve(OUT, file), JSON.stringify({ schema: 'FormPrior@1', form: F.form, year: y, title: F.title, source: url, sha256, giver: 'the Internal Revenue Service (the blank form, as published)', pages }));
  const nF = pages.reduce((n, p) => n + p.fields.length, 0), nL = pages.reduce((n, p) => n + p.fields.filter((f) => f.label).length, 0);
  index.push({ form: F.form, year: y, title: F.title, file, source: url, sha256, pages: pages.length, fields: nF });
  console.log(`f${F.form} ${y}: ${pages.length} pages · ${pages.reduce((n, p) => n + p.words.length, 0)} printed words · ${nF} fields (${nL} labelled)`);
}
writeFileSync(resolve(OUT, 'index.json'), JSON.stringify({ schema: 'FormPriorIndex@1', note: 'Blank forms as published by the IRS, measured by tools/build-form-priors.mjs. A form is recognised by its own printed title and its footer, e.g. “Form 990 (2018)”.', forms: index }, null, 1));
