# WORLD-0 Amendment 1: arm B, a change-driven index. Written 2026-11-03, before any frame comparison or scoring of either arm. The arm-A extraction is running; none of its output has been looked at.

**Why.** The user's point: a frame should be pulled when a difference that makes a difference occurs, not on a clock. That difference can be sniffed cheaply from the bytes, its threshold learned from the bytes themselves, with priors on top, and what the ingest produces is an INDEX of what changed the viewer, not a pile of frames. Arm A (a frame every 10 s, as registered) wastes frames on a slide that stays up for minutes and cannot tell a transition from noise. It is kept unchanged as the baseline. Arm B is added here. Both are scored once, after both extractions are done.

**Arm B method, fixed here.**
1. *Sniff.* Decode the media at 1 frame per second, scaled to 160 x 90 grayscale (ffmpeg, read-only). d(t) is the mean absolute difference between frame t and frame t-1. The threshold is learned from this video's own bytes: Otsu's method on log(d + 1) over all t. A second whose d is above it is a candidate change.
2. *Confirm.* For each candidate t, take the frame at t + 2 s (after the transition settles; the last frame if past the end), 1280 wide, and OCR it with `tesseract --psm 6`. The candidate becomes an index entry only when its OCR token set (lowercase alphanumeric tokens of 3 or more characters) differs from the previous kept entry's by a Jaccard distance above a null: the 99th percentile of the Jaccard distances between the OCR token sets of arm-A frames 10 s apart inside stretches with no candidate change (static stretches), computed from this video's own arm-A OCR. The first frame always opens the index. A candidate that does not pass is merged (not kept); one whose frame OCR is under 3 characters is unreadable.
3. *Entry.* `{t, t_next (the next entry's t, or the end), frame sha256, new tokens, written figures, kind: "text"}`. The kind is recorded so that priors (which kinds of change were followed by a matched figure) can be learned from this run afterwards. **No prior is applied inside this run**, and none is typed.
4. *Interval match.* An entry's spoken window is the transcript lines with a stamp in [t - 10, t_next + 10]. An entry counts as a moment if its OCR has at least one written figure not present in the previous entry. Figures and the match rule are those of the registration (digits only, typed convention, relative 0.5%).
5. *Null.* 1000 shuffles (seed 20261103): each counted entry takes the spoken window of equal length starting at a random time at least 120 s from its own interval.

**Bars (arm B).**
- **B1:** the share of counted entries with an equal spoken figure in their own window exceeds the 99.9th percentile of the null.
- **B2 (efficiency, the claim of this arm):** the index has at most 50% as many entries as arm A has frames, and the number of distinct (value, class) figures matched in arm B is at least arm A's.
- **B3:** precision of up to 30 matched entries (seed 20261103), labelled blind by a fresh context-free AI subagent that sees only the entry's OCR text and its spoken window, at least 0.70. Blind but not human, and not ground truth.
- **B4:** no silent outcome: every candidate second ends as kept, merged or unreadable; counts reported.
- Untestable if fewer than 20 entries have a new written figure (B1, B2) or fewer than 15 match (B3).

**Not done, stated in advance.** Speech changes (Slate's surf over lexical novelty) and picture-only changes with no text are not indexed in this arm; they are only counted as candidates. No learning from this run's outcomes inside the run. One video. Frames and OCR are machine-made.

**Honest reading, declared now.** Arm B's claim is efficiency, not understanding: if it finds as many distinct matched figures with at most half the frames, the index is a better ingest than the clock; if it finds fewer, the learned threshold or the text confirmation lost information, and that is the result.
