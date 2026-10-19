// ingest.js — ONE DOOR FOR ANY FILE: bytes in, a text face + typed gaps out.
//
// Fold invariant: A FORMAT WE CANNOT READ IS A NAMED GAP, NEVER EMPTY TEXT.
// Every reader says what it found and what it could not (`gaps`), so a scan with
// no text layer reads as "needs OCR", not as a document with nothing in it
// (READING-POLICY: absence of a reading is a fact about the reader).
//
// Readers (no third-party libraries — a zip walker + zlib, per the no-CDN rule):
//   text     txt md tex rst py js … (as given)            csv tsv (a table AND text)
//   json     pretty; ipynb -> its cells (markdown/code/outputs), each labelled
//   html     web.js extractReadable
//   zip      docx odt pptx xlsx (XML text; xlsx as tables)
//   pdf      FlateDecode streams -> Tj/TJ text. Fonts with custom encodings that
//            do not decode are DETECTED (garbled ratio) and reported, not passed off.
//   image    png jpg tif bmp gif webp -> Tesseract (psm 3); no OCR binary = gap
// Returns { name, kind, text, tables, gaps, meta }.

import zlib from "node:zlib";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { extractReadable } from "./web.js";

export const INGEST_SCHEMA = "EOIngest@1";
const gap = (kind, reason) => ({ kind, reason });
const EXT = (n) => (String(n).toLowerCase().match(/\.([a-z0-9]+)$/) ?? [])[1] ?? "";
const utf8 = (b) => Buffer.from(b).toString("utf8");

// ── zip ──────────────────────────────────────────────────────────────────
export function readZip(buf) {
  const b = Buffer.from(buf);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 66000); i--) if (b.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) return null;
  const n = b.readUInt16LE(eocd + 10);
  let p = b.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let i = 0; i < n; i++) {
    if (b.readUInt32LE(p) !== 0x02014b50) break;
    const method = b.readUInt16LE(p + 10), csize = b.readUInt32LE(p + 20);
    const nl = b.readUInt16LE(p + 28), el = b.readUInt16LE(p + 30), cl = b.readUInt16LE(p + 32);
    const off = b.readUInt32LE(p + 42);
    const name = b.slice(p + 46, p + 46 + nl).toString("utf8");
    const lnl = b.readUInt16LE(off + 26), lel = b.readUInt16LE(off + 28);
    const data = b.slice(off + 30 + lnl + lel, off + 30 + lnl + lel + csize);
    files.set(name, () => (method === 0 ? data : zlib.inflateRawSync(data)));
    p += 46 + nl + el + cl;
  }
  return files;
}
const unxml = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&amp;/g, "&");
const textOfXml = (xml, para) => unxml(xml.replace(new RegExp(`</${para}>`, "g"), "\n").replace(/<w:tab\/>/g, "\t").replace(/<[^>]+>/g, "")).replace(/\n{3,}/g, "\n\n").trim();

function fromZip(name, buf, ext) {
  const z = readZip(buf);
  if (!z) return { kind: ext, text: "", gaps: [gap("unreadable_container", "not a readable zip")] };
  const get = (n) => (z.has(n) ? utf8(z.get(n)()) : null);
  if (ext === "docx") return { kind: "docx", text: textOfXml(get("word/document.xml") ?? "", "w:p"), gaps: get("word/document.xml") ? [] : [gap("missing_part", "word/document.xml")] };
  if (ext === "odt") return { kind: "odt", text: textOfXml(get("content.xml") ?? "", "text:p"), gaps: [] };
  if (ext === "pptx") {
    const slides = [...z.keys()].filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k)).sort((a, c) => Number(a.match(/\d+/)) - Number(c.match(/\d+/)));
    return { kind: "pptx", text: slides.map((s, i) => `[slide ${i + 1}]\n${textOfXml(utf8(z.get(s)()), "a:p")}`).join("\n\n"), gaps: slides.length ? [] : [gap("missing_part", "no slides")] };
  }
  if (ext === "xlsx") {
    const shared = [...(get("xl/sharedStrings.xml") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => unxml(m[1].replace(/<[^>]+>/g, "")));
    const sheets = [...z.keys()].filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort();
    const tables = [];
    for (const s of sheets) {
      const rows = [];
      for (const r of utf8(z.get(s)()).matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
        const cells = [];
        for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
          const t = c[1].match(/t="(\w+)"/)?.[1], v = c[2]?.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? c[2]?.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? "";
          const col = (c[1].match(/r="([A-Z]+)\d+"/)?.[1] ?? "A").split("").reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1;
          cells[col] = t === "s" ? shared[Number(v)] ?? "" : unxml(v);
        }
        rows.push(Array.from(cells, (x) => x ?? ""));
      }
      tables.push({ name: s.match(/sheet\d+/)[0], header: rows[0] ?? [], rows: rows.slice(1) });
    }
    return { kind: "xlsx", text: tables.map(tableText).join("\n\n"), tables, gaps: tables.length ? [gap("formulas_not_evaluated", "cached values only; a formula's own text is not read")] : [gap("missing_part", "no worksheets")] };
  }
  return { kind: ext, text: "", gaps: [gap("unsupported_container", ext)] };
}

// ── tables ───────────────────────────────────────────────────────────────
export function parseDelimited(text, sep) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); cell = ""; if (row.some((x) => x !== "")) rows.push(row); row = []; }
    else cell += c;
  }
  row.push(cell); if (row.some((x) => x !== "")) rows.push(row);
  return { header: rows[0] ?? [], rows: rows.slice(1) };
}
export const TABLE_TEXT_ROWS = 2000; // declared: beyond this the TEXT face shows a head and the count; the table itself is kept whole
const tableText = (t) => { const rows = t.rows.slice(0, TABLE_TEXT_ROWS); return `[table ${t.name ?? ""}] ${t.header.join(" | ")}\n${rows.map((r) => t.header.map((h, i) => `${h}=${r[i] ?? ""}`).join("; ")).join("\n")}${t.rows.length > rows.length ? `\n[… ${t.rows.length - rows.length} more rows in the table, not in this text]` : ""}`; };

// ── pdf ──────────────────────────────────────────────────────────────────
const pdfString = (s) => (/\0/.test(s) && (s.match(/\0/g).length >= s.length / 3) ? s.replace(/\0/g, "") : s).replace(/\\([nrtbf()\\])/g, (_, c) => ({ n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" }[c] ?? c)).replace(/\\(\d{1,3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)));
function fromPdf(buf) {
  const s = Buffer.from(buf).toString("latin1");
  let droppedGlyphs = 0; const pages = [], images = []; let streams = 0, decoded = 0, failed = 0;
  for (const m of s.matchAll(/stream\r?\n([\s\S]*?)\r?\n?endstream/g)) {
    streams++;
    const raw = Buffer.from(m[1], "latin1");
    let body;
    if (raw[0] === 0xff && raw[1] === 0xd8) { images.push(raw); continue; } // a DCTDecode (JPEG) page image
    try { body = zlib.inflateSync(raw).toString("latin1"); } catch { body = raw.toString("latin1"); if (/[\x00-\x08]/.test(body.slice(0, 200))) { failed++; continue; } }
    if (!/\bBT\b/.test(body)) continue;
    decoded++;
    let out = "";
    for (const t of body.matchAll(/\[((?:[^\]\\]|\\.)*)\]\s*TJ|\(((?:[^)\\]|\\.)*)\)\s*(?:Tj|'|")|\bT\*|\bET\b/g)) {
      if (t[1] !== undefined) out += [...t[1].matchAll(/\(((?:[^)\\]|\\.)*)\)|(-?\d+\.?\d*)/g)].map((x) => (x[1] !== undefined ? pdfString(x[1]) : Number(x[2]) < -110 ? " " : "")).join("");
      else if (t[2] !== undefined) out += pdfString(t[2]);
      else out += "\n";
    }
    droppedGlyphs += (out.match(/[^\x20-\x7e\n\t\u00a0-\uffff]/g) ?? []).length; // codes with no decodable Unicode (ligatures, symbol fonts)
    out = out.replace(/[^\x20-\x7e\n\t\u00a0-\uffff]/g, "");
    if (out.trim()) pages.push(out.replace(/[ \t]+\n/g, "\n").trim());
  }
  const text = pages.map((p, i) => `[page ${i + 1}]\n${p}`).join("\n\n");
  const letters = (text.match(/[A-Za-z]/g) ?? []).length, printable = (text.match(/[\x20-\x7e\n]/g) ?? []).length;
  const gaps = [];
  let ocr = "";
  if (!text.trim() && images.length) {
    const reads = images.map((im) => fromImage("page.jpg", im, "jpg"));
    ocr = reads.map((r, i) => `[page image ${i + 1}]\n${r.text}`).filter((x) => x.length > 20).join("\n\n");
    for (const g of reads.flatMap((r) => r.gaps).filter((g, i, a) => a.findIndex((h) => h.kind === g.kind) === i)) gaps.push(g);
    gaps.push(gap("scanned_pdf_read_by_ocr", `${images.length} embedded page image(s) read by OCR; no text layer existed`));
  } else if (!text.trim()) gaps.push(gap("needs_ocr", `no text layer and no embedded JPEG in ${streams} stream(s); rasterise the pages and ingest them as images.`));
  else if (printable / Math.max(1, text.length) < 0.85 || letters / Math.max(1, printable) < 0.5) gaps.push(gap("garbled_text_layer", "the text layer uses a font encoding this reader does not decode (ToUnicode maps are not read); treat the text as unreliable"));
  if (failed && !images.length) gaps.push(gap("undecodable_streams", `${failed} stream(s) could not be inflated`));
  if (droppedGlyphs) gaps.push(gap("dropped_glyphs", `${droppedGlyphs} character code(s) had no decodable Unicode (ligatures such as fi/fl, symbols such as Λ, σ, ±) and were removed: read numbers and symbols against the page`));
  gaps.push(gap("layout_not_read", "reading order is the content stream's order; multi-column layout and tables are not reconstructed"));
  return { kind: "pdf", text: text || ocr, gaps, meta: { streams, textStreams: decoded } };
}

// ── image ────────────────────────────────────────────────────────────────
function fromImage(name, buf, ext) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ingest-")); const p = path.join(dir, `in.${ext === "jpeg" ? "jpg" : ext}`);
  fs.writeFileSync(p, buf);
  try {
    const text = execFileSync("tesseract", [p, "stdout", "--psm", "3"], { encoding: "utf8", timeout: 60000, stdio: ["ignore", "pipe", "ignore"] }).trim();
    return { kind: "image", text, gaps: text ? [gap("ocr_is_a_reading", "text below is what Tesseract read, not what the image says; check figures against the picture")] : [gap("ocr_found_nothing", "no text recognised; the image may be a plot or photograph")] };
  } catch (e) {
    return { kind: "image", text: "", gaps: [gap("ocr_unavailable", String(e.code === "ENOENT" ? "tesseract is not installed" : e.message).slice(0, 120))] };
  }
}

// ── notebooks ────────────────────────────────────────────────────────────
function fromIpynb(text) {
  let nb; try { nb = JSON.parse(text); } catch { return { kind: "ipynb", text: "", gaps: [gap("bad_json", "not valid notebook JSON")] }; }
  const src = (c) => (Array.isArray(c) ? c.join("") : String(c ?? ""));
  const cells = (nb.cells ?? []).map((c, i) => {
    const outs = (c.outputs ?? []).map((o) => src(o.text ?? o.data?.["text/plain"] ?? "")).filter(Boolean).join("\n");
    return `[${c.cell_type} ${i + 1}]\n${src(c.source)}${outs ? `\n[output]\n${outs}` : ""}`;
  });
  return { kind: "ipynb", text: cells.join("\n\n"), notebook: nb, gaps: [gap("outputs_are_recorded_not_verified", "outputs in an imported notebook were produced elsewhere; re-run to verify")] };
}

/** ingest({ name, bytes }) -> { schema, name, kind, text, tables, gaps, meta } */
export function ingest({ name, bytes }) {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const ext = EXT(name);
  let r;
  if (["docx", "odt", "pptx", "xlsx"].includes(ext)) r = fromZip(name, buf, ext);
  else if (ext === "pdf" || buf.slice(0, 5).toString() === "%PDF-") r = fromPdf(buf);
  else if (["png", "jpg", "jpeg", "tif", "tiff", "bmp", "gif", "webp"].includes(ext)) r = fromImage(name, buf, ext);
  else {
    const t = utf8(buf);
    if (/[\x00-\x08]/.test(t.slice(0, 4000))) r = { kind: "binary", text: "", gaps: [gap("unsupported_binary", `${ext || "unknown"}: no reader for these bytes`)] };
    else if (ext === "ipynb") r = fromIpynb(t);
    else if (ext === "csv" || ext === "tsv") { const tb = { name, ...parseDelimited(t, ext === "tsv" ? "\t" : ",") }; r = { kind: ext, text: tableText(tb), tables: [tb], gaps: tb.rows.length > TABLE_TEXT_ROWS ? [gap("table_text_truncated", `${tb.rows.length} rows: the text face shows the first ${TABLE_TEXT_ROWS}; table(name) has all of them`)] : [] }; }
    else if (ext === "json") { let p = null; try { p = JSON.stringify(JSON.parse(t), null, 1); } catch { /* keep raw */ } r = { kind: "json", text: p ?? t, gaps: p ? [] : [gap("bad_json", "kept as raw text")] }; }
    else if (ext === "html" || ext === "htm") { const x = extractReadable(t); r = { kind: "html", text: [x.title, x.text].filter(Boolean).join("\n\n"), gaps: [] }; }
    else r = { kind: ext || "text", text: t, gaps: [] };
  }
  const text = r.text ?? "";
  return { schema: INGEST_SCHEMA, name, kind: r.kind, text, tables: r.tables ?? [], notebook: r.notebook, gaps: r.gaps ?? [], meta: { bytes: buf.length, chars: text.length, ...(r.meta ?? {}) } };
}
