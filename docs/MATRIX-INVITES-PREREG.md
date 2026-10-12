# Matrix invites — pre-registered falsification record

Written and committed **before any test of this feature was run**. Predictions
below are never edited after the fact; results are appended in "Results" at the
end, each against the prediction it answers. A control is an implementation
deliberately broken in the way the claim says cannot happen — a probe that does
not catch its control is not evidence.

Two tiers, because one is faithful to the contract and the other is faithful to
Matrix:

* **unit** — pure modules against `holodeck-fake-matrix.js` (a fake homeserver
  and clients whose "encryption" is real AES-GCM with per-room sessions and key
  delivery only to devices the owner confirmed). Runs in `node --test`; no network.
* **live** — the real matrix-js-sdk (Rust crypto, Megolm) against a local
  Synapse on 127.0.0.1 with federation off. Not part of `node --test`; run with
  `node tests/matrix-invites.live.mjs`. Accounts are registered **only** on that
  local server; nothing here registers on a public homeserver.

The unit tier proves the *decisions* (order of operations, what gets sent
where, what the fold accepts). It does **not** prove Megolm. Only live does.

## What would embarrass the design

### F1 — a plaintext event reaches the transport
* **Claim at risk:** every event the page emits is `m.room.encrypted`; no
  content-bearing state event is written.
* **Probe:** a unique canary string is placed in a source's text, a statement,
  an attachment body, and a ledger note. After a full flow, scan everything the
  server received. unit: the fake server's request log. live: the Synapse
  sqlite database file, the media store directory, and `/rooms/…/messages`
  as an outside member sees it.
* **Controls (must be caught):** (a) a transport that skips the seal; (b) a
  room created without `m.room.encryption`; (c) the legacy `savePrivate`
  state-event path.
* **Prediction:** canary count **0** on the real path in both tiers; **>0** for
  all three controls. Specifically (c) is a positive control for the scanner
  itself: the legacy private room **will** be found leaking the canary in
  plaintext in the live tier. If (c) shows 0, the scanner is blind and F1 is void.

### F2 — an invitee decrypts before the owner confirms
* **Claim at risk:** nothing is readable by an invitee between redeem and the
  owner's "these match".
* **Probe:** invitee redeems (joins the door, sends its request). The owner
  writes canary events to all three stores. The invitee's client is asked to
  read each store room and the door.
* **Control:** an owner flow with confirm-before-check (invites to the store
  rooms and marks the device verified as soon as the request arrives).
* **Prediction:** invitee reads **0 of N** canaries; has no membership in any
  store room; has not received the grant. Control: invitee reads **N of N**.
  After confirm: invitee reads the canaries written *after* the confirm; reads
  the earlier ones iff `history.can` is true (computed, reported, not assumed).

### F3 — a revoked member decrypts events written after revocation
* **Claim at risk:** removal stops new events reaching the removed device.
* **Probe:** member reads canary-A; owner removes them; owner and an editor
  write canary-B; the removed account's still-running client tries both.
* **Control:** removal that updates the ledger but does not kick or rotate.
* **Prediction:** removed member reads **A** (the disclosure is true: removal
  does not undo it) and **not B**. Control: reads B. If the removed member
  *cannot* read A the UI's disclosure is wrong and must be changed, not the test.

### F4 — a read-only member's write operator is accepted by the fold
* **Claim at risk:** the fold, not only the UI or the server, refuses it.
* **Probe:** raw events (bypassing UI and server power levels) from a reader
  sender: INS/DEF/CON; from a former editor after demotion; from a stranger not in
  the ledger; a role-grant event forged by an editor (sender ≠ log creator);
  an event from an editor *before* demotion.
* **Control:** `foldRepo` replaced by a bare `fold` (gate off).
* **Prediction:** all post-demotion/reader/stranger/forged operators absent from
  folded state and listed as typed refusals; the pre-demotion editor event
  **present**; control state contains the reader's entity.

### F5 — a secret appears in a URL, a log line, or localStorage
* **Secrets, enumerated:** access token, password, megolm session keys, recovery
  key, six-digit pairing code, user ids and device ids/fingerprints.
  The invite alias code is the single permitted payload of a link, as a fragment,
  because it is a locator (possession lets you ask, never receive).
* **Probe:** instrument link builders, the panel's log sink, and a recording
  localStorage; run the whole flow; exact-substring scan for every secret.
  Link shape is asserted exactly: no `?`, fragment exactly `join=<code>` over the
  alias alphabet.
* **Controls:** (a) link builder that appends the user id; (b) logger that
  prints the token; (c) code that stores the recovery key in localStorage.
* **Prediction:** new code: **0** hits; all three controls caught. **Known
  exception, stated in advance:** the page's pre-existing `fold-matrix-session`
  localStorage entry holds an access token (written by `fold-net.js`, not by
  this feature). The whole-page localStorage scan in the live/browser tier
  **will find it**; the claim is scoped to keys this feature writes, and the
  legacy token is reported as a finding, not hidden.

### F6 — an unencrypted room is written to
* **Probe:** attempt a send to (a) a legacy unencrypted workspace room, (b) a
  store room whose encryption state has not synced yet (the create→sync race),
  (c) a store room whose `m.room.encryption` is absent in state, (d) a
  content-bearing state write into an encrypted room.
* **Control:** the seal bypassed.
* **Prediction:** four typed refusals (`RoomNotEncrypted` ×3, `ContentInState`)
  each carrying a reason; **zero** transport calls; control: transport receives
  all four.

## Secondary predictions

* **F7 — roles at the server:** a reader's `sendEvent` is refused by Synapse
  (power level 0 < `events_default` 50). Live only.
* **F8 — history honesty:** `history.can === true` only when the owner device is
  cross-signed and the invitee device is cross-signed and visibility is
  `shared`. Control: a build that claims "yes" unconditionally. Live: with
  cross-signing bootstrapped on both accounts the invitee reads pre-join events
  **iff** the bundle path actually succeeded; where it cannot, the typed gap is
  reported and the invite said "no". I do **not** predict the bundle path works
  against Synapse 1.143 on the first try; the prediction is that the *claim
  matches the observation*.
* **F9 — door hygiene:** after confirm/reject/revoke/expiry the alias no longer
  resolves; a second redeem of a consumed code is refused.
* **F10 — no regressions:** every test that passed before this branch passes
  after, by test **name** diff (not count).
* **F11 — account rule:** zero occurrences of either account literal in the
  diff.

## What is not established (declared up front)

Federation (every test is one homeserver; alias resolution and joins across
servers; role-at-timestamp ordering under clock skew); multi-device (a second
device of owner or invitee, device-list changes mid-flight); key backup and
recovery (nothing here sets up secret storage or restores from backup); large
rooms (members counted in single digits; no 1M-record room); homeservers other
than Synapse and SDK versions other than the one tested; cross-signing
bootstrap on an account that already has keys (needs password UIA — typed gap,
not exercised); a hostile homeserver (withholding or reordering events); a
compromised invitee; the 20-bit pairing code against an eavesdropper on the
out-of-band channel; the fake's fidelity to real Megolm; browser IndexedDB
persistence across a real reload for the crypto store.

## Results

(appended below this line; nothing above is edited)
