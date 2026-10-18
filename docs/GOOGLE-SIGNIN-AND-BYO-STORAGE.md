# Sign in with Google, keep your own storage, sealed

## Supabase (the default) — no Google app at all

For "every holodeck can connect with no per-copy config", the default provider is **Supabase**, not Google. A
Supabase project's **URL and publishable `anon` key are public** (Row Level Security protects the rows), so they
ship in `fold-workspace.json` `storage.supabase` and **one project serves every holodeck** — no OAuth client, no
per-origin registration, no Google review. A person signs in with an **email one-time code** (passkeys are the
next step, via Supabase's WebAuthn API), and their session's access token authorizes Storage under RLS.

| module | does |
|---|---|
| `holodeck-storage-supabase.js` | a storage **provider** over Supabase Storage (opaque bytes; `fetch` + token injected) |
| `holodeck-supabase.js` | **email one-time-code** sign-in + the facade (`supabaseStore`) that wraps the provider in `sealedStore` |

### Encrypted at rest and in transit (enforced, not assumed)

* **In transit:** the provider and the auth client **refuse a non-HTTPS project URL** (`insecure-transport`).
  Loopback `http` is allowed for local development, as Supabase allows.
* **At rest:** the provider **refuses to write anything that is not a sealed envelope** (`plaintext-refused`).
  Content is sealed on the device (AES-256-GCM, `holodeck-vault.js`) before it is ever sent, so Supabase — and
  its own at-rest disk encryption — only ever hold ciphertext. There is no plaintext path.
* The facade is the only supported entry: it always wraps the provider in `sealedStore`. The raw provider is
  sealed-only by default; `requireSealed: false` exists only for the provider's own byte-level tests.

Set `storage.supabase.url` / `.anonKey` / `.bucket` once; every holodeck reads them and the panel prefills.

### Single sign-in: "Continue with Google", through Supabase

If the goal is *one login everywhere*, do the Google half **through Supabase** rather than per-holodeck. One
Google OAuth client and one Supabase project serve every holodeck; the holodeck origins are allow-listed **once**.

The browser goes:
`app → {project}/auth/v1/authorize?provider=google → Google → {project}/auth/v1/callback → app#access_token=…`
(implicit flow). `oauthAuthorizeUrl()` builds the first hop; `sessionFromRedirect()` reads the session Supabase
leaves in the fragment; `supabaseStore().resume(href)` adopts it and connects the sealed store — **the same
session token is the Storage token**, so one login unlocks both halves.

What you set up once:

1. **Supabase → Authentication → Providers → Google:** enable, paste a Google OAuth **Client ID + secret**.
2. **Google Cloud → Credentials → OAuth client (Web application):** Authorized redirect URI =
   `https://<project-ref>.supabase.co/auth/v1/callback` (self-hosted: `https://<your-domain>/auth/v1/callback`).
   The secret lives in Supabase, never in this repo.
3. **Supabase → Authentication → URL Configuration:** Site URL + Redirect URLs = **every holodeck origin**
   (`http://localhost:8813`, `https://<account>.github.io`, `https://<vm-domain>`). Wildcards are allowed
   (`https://<account>.github.io/**`).
4. `fold-workspace.json → storage.supabase.url/anonKey` (the anon key is public).

Then every holodeck shows **Continue with Google** and signs the person into their workspace *and* its storage
in one click. The one caveat that bites: an **unverified** Google consent screen only admits listed test users
until the app is verified — but that is *one* app, not one per holodeck.

**Identity-only is what keeps it painless.** Google exempts apps that request only `openid`, `email`, `profile`
(Sign in with Google): users need no test-user allowlist, see **no** "unverified app" warning, and their
authorization **does not expire after 7 days** — even in Testing, and with **no verification**. *Any other scope
breaks the exception.* So this path asks Google for identity only and stores bytes in **Supabase Storage**; it
never requests a Drive scope. (The **"Connect Google Drive"** card in the panel is an advanced option that *does*
request `drive.appdata`, which re-opens Google's test-user cap, the unverified warning and the 7-day expiry — it
is kept out of the way for exactly that reason.)

The client uses the **implicit flow** (no server to exchange a PKCE code). `resume()` returns a typed
`pkce-unsupported` if the project is configured for PKCE only, so the failure is named, never silent.

---

# Sign in with Google, keep your own storage, sealed

The holodeck is a **client**, not a service. Two things follow, and this note is both:

* **Identity = the person's Matrix account**, and it can be a Google account underneath. Google proves *who*
  they are; the homeserver issues the Matrix session the surface already uses (`fold-net.js`).
* **Storage = whatever the person brings**, holding **ciphertext only**. The first provider is the person's
  own Google Drive, in the hidden **app folder** (`drive.appdata`) — the app sees only a folder it owns,
  never the rest of the Drive.

The two halves stay separate on purpose: **Google says who you are; the keyring says you can read your
content.** A Google sign-in is never a way to decrypt.

## The pieces (all in this repo, all pure)

| module | does |
|---|---|
| `holodeck-google-signin.js` | Google Identity Services: the **ID token** (identity) and the **access token** for `drive.appdata`; the script loader; JWT claims |
| `holodeck-storage-drive.js` | a storage **provider** over the Drive app folder (opaque bytes in/out; `fetch` + token injected) |
| `holodeck-storage.js` | the provider **seam** and the **sealed store** (seal on write, open on read, refuse a downgrade); the sealed **manifest**; `memory` / `localStorage` providers |
| `holodeck-byo.js` | the **facade**: `byoStorage({ clientId, workspace }).signIn()` → identity + a sealed store over the person's Drive |

The bytes the store holds are `holodeck-vault.js` sealed values (`{vault,kid,iv,ct}`), with the AAD binding
each blob to the workspace and its own path. A store cannot move one blob onto another key and open it, and a
provider that returns plaintext is refused as a **downgrade**.

## The flow

```
  person clicks "Sign in with Google"
        │
        ├─ google.accounts.id      → ID token (JWT)  ──►  the homeserver verifies it (MAS upstream)  ──►  Matrix session
        └─ google.accounts.oauth2  → access token    ──►  drive.appdata provider
                                                              │
   deviceKeyring(account)  ── the workspace key, on the device ─┴─►  sealedStore(provider, ring, workspace)
                                                              │
                                            put(value)  = seal  → Drive holds ciphertext
                                            get(key)    = open  ← Drive handed ciphertext back
```

## Server wiring (yours to do; the app cannot)

The Google→Matrix half is **matrix-authentication-service (MAS)** as Synapse's auth service (MSC3861).
Add Google as an upstream provider and every Matrix client — including this surface — can sign in with it.

```yaml
# mas config: upstream_oauth2
upstream_oauth2:
  providers:
    - id: 01HFS6S2SVAR7Y7QYMZJ53ZAGZ          # a ULID you generate
      human_name: Google
      brand_name: "google"
      issuer: "https://accounts.google.com"
      client_id: "<google-client-id>"
      client_secret: "<google-client-secret>"
      scope: "openid profile email"
      claims_imports:
        localpart: { action: ignore }
        displayname: { action: suggest }
        email: { action: suggest }
        account_name: { template: "{{ user.email }}" }
```

In the Google Cloud console: create an **OAuth Client ID (Web application)**; authorized redirect URI is
`https://<mas-host>/upstream/callback/<provider-ulid>`. Then in Synapse, delegate auth to MAS
(`experimental_features.msc3861`). The surface needs no change: `fold-net.js` still logs in against the
homeserver, which now offers Google.

**Caveat — the gate.** Today `holodeck-gate` puts a password + authenticator in front of Matrix login. An SSO
callback is a different path and **bypasses the gate** (`docs/PEOPLE-AND-GATE.md`). Choose one: route the SSO
callback through the gate as well, or accept that Google sign-in is outside the TOTP. Do not assume both.

## Google Drive as storage

The provider requests **only** `https://www.googleapis.com/auth/drive.appdata`. That scope is invisible to
`drive.file`/`drive` listing, needs no folder picker, and is where a holodeck keeps its sealed blobs. Two
Google facts to plan for: an OAuth app in **testing mode** is limited to listed test users and its refresh
tokens expire in 7 days; publishing `drive.appdata` needs **OAuth app verification** (it is not the full
`drive` restricted scope, so no security assessment is expected, but the consent screen and branding are
reviewed). `drive.appdata` is a *non-sensitive* scope, so this is the light path — unlike hyphae's Drive sweep,
which needs `drive`.

## What the store still sees (and says so)

Google sees: that an account has an app folder, the number of files, their sizes, their filenames **as we
choose to name them** (use opaque keys), and when each changed. It does **not** see plaintext, the workspace
key, names, or what a blob is. Freshness is not guaranteed — a hostile store can replay an older sealed value.
Use opaque blob keys (a hash), never a human title, so the filename leaks nothing. The app folder allows two
files with one name, so the provider refreshes its listing before creating and **updates a key in place** —
one key is one file.

## What it does NOT give

* **Not the key.** Google identity ≠ keyring. The key is the device link (`#vault=…`) or an SSSS recovery
  phrase; losing it loses the content.
* **Not recovery.** A person who can sign in with Google but lost the keyring can authenticate and still read
  nothing — by design.

## Falsifying controls

* A provider that hands back content which is **not sealed** must make `sealedStore.get` throw `vault-downgrade`
  — never return it (`holodeck-storage.test.mjs`).
* A blob **moved onto another key** must not open there (AAD binds the path) — `vault-tampered`.
* A **tampered byte** must fail authentication — `vault-tampered`; the control is the untampered read that opens.
* A **401** from Drive must refresh the token once and retry, not fail the put (`holodeck-storage-drive.test.mjs`).
* A Google **refusal** must reject the request with a typed error, not resolve undefined.

## Tests

```bash
node --test holodeck-storage.test.mjs holodeck-storage-drive.test.mjs holodeck-google-signin.test.mjs holodeck-byo.test.mjs
```

No network, no Google, no real Drive: a fake `fetch` holds a name→file map and a fake `google.accounts`
fires the same callbacks GIS does.
