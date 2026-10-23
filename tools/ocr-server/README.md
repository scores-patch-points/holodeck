# ocr-server — the fold's local pixel reader

Reads a PDF or an image into text, page by page, on this machine. Nothing is sent anywhere.

- A page that **carries its own characters** is read from them (exact, almost free).
- A page that **does not** (a scan, a photo) is read by every on-device eye and the eyes are folded into one reading
  (`fuse.mjs`). Where they disagree, the **document's own words** decide: the spelling the rest of the PDF uses wins.
  Every word that did not make the reading is returned in `dropped` with the eye that said it.
- Eyes: **Apple Vision** (macOS, via a small Swift helper compiled on first use) and **tesseract** (macOS, Linux, Windows).
  A Windows `Windows.Media.Ocr` adapter and any other eye is one more file in `adapters/` with `{ id, label, platforms, onDevice, rank, probe(), read() }`.
  Only macOS has been run so far; Linux and Windows are untested.

```bash
npm run ocr                                                  # loopback service on 127.0.0.1:11461: GET /health, POST /ocr
node tools/serve.mjs 8813                                    # the dev server: POST /ocr and GET /ocr-health, same reader
node tools/ocr-server/to-eot.mjs file.pdf --out eot-out      # PDF -> text -> EOT log (needs ../EO-terminal)
node tools/ocr-server/check.mjs                              # what this machine has
node tools/ocr-server/check.mjs --offline                    # each eye read a page with the network denied by the OS
node tools/ocr-server/bench.mjs file.pdf --pages 40 --dpi 220 --admit 0.90   # score the eyes against the PDF's own text layer
npm run test:ocr
```

`POST /ocr?max=40&dpi=220&lang=eng&pool=2&policy=keep-base|strict` streams one JSON line per event:
`start` → `page` (in page order: `text`, `words`, `conf`, `eye`, and for read pages `witnesses`, `fusion`, `dropped`) → `done`.
A 503 (with the install line for this platform) means nothing here can read pixels, so the page falls back to the browser.

**Defaults and why.** `dpi=220` for pixels: on 24 screenshot-quality scan pages the two eyes agreed with each other at F1 0.882 rendered at 150 dpi,
0.925 at 220, 0.922 at 300 (twice the time). `policy=keep-base` keeps a disputed word the document does not know; `strict` drops it (and says so in `dropped`),
which scored higher on clean pages (see the table in `fuse.mjs`) but can lose a rare name only one eye read. Numbers are never dropped on the prior's say-so.

**Known limits.** (1) The fusion's primary eye is fixed, and on two held-out PDFs the fused reading scored below the better single eye
(IRS form 0.963 vs Vision 0.984; a screenplay 0.978 vs tesseract 0.999, both at 220 dpi); it beat the better eye only on the email PDF it was tuned on (0.958 vs 0.944).
(2) Scans have no ground truth: every accuracy figure is on rendered born-digital pages, and for scans only agreement between the eyes has been measured.
(3) Only macOS has been run. The tesseract adapter should work on Linux and Windows, but that is untested, and there is no Windows `Windows.Media.Ocr` adapter yet.
(4) A language Apple Vision has no mapping for is reported as a gap on the page and tesseract reads alone; it does not fall back to English.

`HD_OCR_ENGINES=tesseract` narrows the eyes. `HD_OCR_ORIGINS=https://my.site` lets that page call the standalone service (loopback pages are allowed; never a wildcard).
