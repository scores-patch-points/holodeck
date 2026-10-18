// Generate the reading's OUTPUT for the real corpora: drive reading/index.html
// headlessly and write, for each source, the diagrammed text and the reading JSON.
//
//   node reading/generate.mjs                     # the demo-motorola records
//   node reading/generate.mjs path/to/source.txt  # any text files instead
//
// Writes reading/examples/<slug>.txt and .json. No model is called at any point.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const here = import.meta.dirname;
const root = resolve(here, "..");
const outDir = join(here, "examples");
const PORT = 8148;

const DEFAULT_CORPUS = [
  "demo-motorola/Council debate on RS2026-2264 verbatim record 2026-10-06.txt",
  "demo-motorola/Metro Code 13.08.080 surveillance technology.txt",
  "demo-motorola/RS2026-2264 resolution and certification.txt",
];
const corpus = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_CORPUS;

const slugOf = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
const url = `http://127.0.0.1:${PORT}/reading/index.html`;

const server = spawn(process.execPath, [join(root, "tools/serve.mjs"), String(PORT)], { cwd: root, stdio: "ignore" });
process.on("exit", () => { try { server.kill(); } catch {} });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 400)));

mkdirSync(outDir, { recursive: true });
const ran = [];
for (const rel of corpus){
  const path = resolve(root, rel);
  const text = readFileSync(path, "utf8");
  const label = basename(path).replace(/\.[a-z0-9]+$/i, "");
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof window.__reading === "object", null, { timeout: 60000 });
  const res = await page.evaluate(async ([t, l]) => {
    await window.__read(t, l);
    return { text: window.__reading.text(), json: window.__reading.json() };
  }, [text, label]);
  const slug = slugOf(label);
  writeFileSync(join(outDir, `${slug}.txt`), res.text);
  writeFileSync(join(outDir, `${slug}.json`), JSON.stringify(res.json, null, 2));
  const s = res.json.summary;
  ran.push({ slug, srcBytes: text.length, statements: s.statements, propositions: s.propositions, read: s.read, beyond: s.beyond_reach, unheard: s.unheard, unlocated: res.json.unlocated.length, referents: s.referents, steps: res.json.run.steps, models: res.json.run.model_calls });
}
console.log(JSON.stringify(ran, null, 1));
await browser.close();
process.exit(0);
