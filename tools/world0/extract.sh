#!/bin/sh
# extract.sh — WORLD-0 step 1: one frame every 10 s (frame k = t 10(k-1) s), then OCR each with tesseract --psm 6. Read-only on the media; writes only here.
set -eu
W="/private/tmp/claude-501/-Users-mlacy-Documents-claude-code/32866c18-a0cd-406b-951b-044c2008e7c1/scratchpad/world0"
M="$HOME/Documents/claude code/originals/G05_MW0zvoEMdRA_palantir-q4-2024-earnings-karp.mp4"
cd "$W"
ffmpeg -v error -i "$M" -vf "fps=1/10,scale=1280:-1" -q:v 3 -y frames/f_%04d.jpg
echo "frames: $(ls frames | wc -l)"
ls frames/f_*.jpg | xargs -P 4 -I{} sh -c 'b=$(basename {} .jpg); tesseract {} ocr/$b --psm 6 >/dev/null 2>&1'
echo "ocr files: $(ls ocr/*.txt | wc -l)"
