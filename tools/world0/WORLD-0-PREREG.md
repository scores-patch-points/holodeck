# WORLD-0 pre-registration: figures shown and figures said at the same moment. Written 2026-11-03, before any frame is extracted, any OCR is run, or any figure is compared.

**Disclosure of what was seen before this was written.** The sidecar's brief for this video (title slide text, 16 sparse keyframes), one two-minute transcript window used to test the tool (not inspected for figures), and the video's size, hash and codec. No figure on any slide, and no match between slides and speech, has been seen.

**Material.** One recording: `originals/G05_MW0zvoEMdRA_palantir-q4-2024-earnings-karp.mp4`, sha256 `218e419acea957dddba3a69fe5b17fa8314f134fbc84609eac8069c064a1a405`, 2870.134 s, AV1 1920x1080. Sidecar id `g05-mw0zvoemdra-palantir-q4-2024-earnings-karp-218e419a`. Local analysis only; the video is not ours and nothing from it is redistributed. Results carry timestamps, hashes and short excerpts only.

**Question.** When a figure is shown on screen, is an equal figure spoken within the same moment more often than in a time-shuffled recording?

**Method, fixed here.**
1. *Moments.* One frame every 10 s (`ffmpeg ... fps=1/10`, scaled to 1280 wide); frame k stands for t = 10(k-1) s. OCR each frame with tesseract (`--psm 6`), unmodified.
2. *Speech.* Machine transcript lines from `slate window <id> t0 t1` (commands only; `.fold`/`.slate` files are never read), in chunks of 300 s, split in two recursively if a chunk comes back truncated. A line's time is its printed stamp (minutes x 60 + seconds, a stamp of 60 s or more is read as printed). A moment's spoken text is the lines whose stamp is within plus or minus 10 s of t.
3. *Figures (a typed convention, disclosed).* A figure is a number with an optional currency symbol, an optional percent sign or the word "percent", and an optional scale (the words million, billion, thousand, bn, or a single capital M, B or K directly after the number). Value = number x scale (1e6, 1e9, 1e3). Class: `pct` if percent, else `other`. Excluded: values under 10, four-digit years from 1900 to 2100 without a scale or currency symbol, and numbers touching a letter before them. This is a typed convention of the same kind as `findFigures` in the holodeck; no word list is earned here. **Spoken number words ("eight hundred twenty-eight") are NOT normalised in this pilot**; only digits in the transcript count. The count of such words is not measured.
4. *Match.* A written figure and a spoken figure match when the classes agree and the values are within a relative 0.5%.
5. *Observed rate.* Among moments with at least one written figure, the share that have at least one matching spoken figure in their own window.
6. *Null.* 1000 shuffles (seed 20261103): in each, every moment with a written figure takes the spoken text of a randomly chosen other moment at least 120 s away; the rate is recomputed. The null is this distribution.

**Bars (pass or fail, published either way).**
- **W1:** the observed rate exceeds the 99.9th percentile of the null.
- **W2:** the observed rate is at least 3 times the null mean, with at least 10 matching moments.
- **W3:** precision. Up to 30 matching moments (all, if fewer; chosen with seed 20261103) are labelled blind by a fresh context-free AI subagent that sees only the frame's OCR text and the spoken window, and answers whether the speaker states the quantity the slide shows. Precision at least 0.70. A fresh AI labeller is blind but not human, and is not ground truth.
- **W4:** no silent outcome. Every frame ends as figures found, no figure, or unread (OCR under 3 characters), and every moment as speech, no speech, or a truncated chunk; the counts are reported.
- **Untestable rules:** W1 and W2 are reported untestable if fewer than 20 moments have a written figure; W3 untestable if fewer than 15 moments match.

**Not done, stated in advance.** No picture understanding. No slide-interval version of the moment (a slide can stay up for minutes; a per-slide window is a natural second analysis, not a bar here). One video, one genre. Transcripts and OCR are machine-made; the transcript's timestamp quirk (a stamp such as 19:60.0) is read as printed. Frame extraction reads the media and writes only into a scratch folder.

**Honest reading, declared now.** If W1 and W2 hold but W3 fails, the matches are coincidences of value and the pilot failed. A pass shows that time alone pairs figures across the picture and the voice in this recording; it does not show that the Fold understands either.
