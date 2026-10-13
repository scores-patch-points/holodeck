# People, invitations, and the login gate

Invite people to a Holodeck workspace with a **magic link**. They choose their **own** sign-in name and password and
set up their **own** authenticator app. Every sign-in afterwards needs the password **and** the six digits. You never
see or hold any of it, so the link you send cannot be used to sign in as them.

## What the person sees

1. You open **People**, type a name per line, press **Make invitations**, and send each person their link any way you
   like (nothing is emailed by the app).
2. They open the link. The page shows a QR code. They scan it with an authenticator app, choose a sign-in name and a
   password (12+ characters), type the six digits the app shows, and press **Create account and join**.
3. Your Holodeck (open in any browser signed in as you) checks, asks the gate that the account really enrolled, and
   lets that account into the workspace's existing rooms. They appear under the name you typed, with what they are
   reading.

## What it is made of

| piece | where | does |
|---|---|---|
| `tools/login-gate/` | beside your homeserver | checks the six digits before the password reaches the homeserver; enrols an authenticator when an account is created; holds the secrets, encrypted |
| `holodeck-invites.js` | the page | makes the invitation (a signing key: private half in the link, public half in room state), lets an enrolled account in, names, presence |
| `holodeck-rest-matrix.js` | the page | plain Matrix REST; account creation and sign-in through the gate |
| `holodeck-people-panel.js` | the page | the one screen |
| `holodeck-invite-core.js` | both | TOTP (RFC 6238), proof, paste parsing, presence |
| `holodeck-qr.js` | the page | the QR code |

## Not tied to one browser

The link carries a private signing key; the workspace's **private room state** carries only the matching public key
(with the name and expiry). The person proves they hold the link by signing their account and the door. So **any
browser signed in as you can let people in** — you can make the invitation on a laptop and have it completed while only
your phone has Holodeck open. Nothing secret is stored on your side, so clearing site data costs you at most the
convenience copy of a link, never an invitation. The homeserver sees the public key and the signature and can forge
neither. The cost: the names of people with pending invitations are readable by members of the workspace.

The authenticator secret is not on your side at all: it is in the person's app and the gate's encrypted store.

## Deploying the gate (this is yours to do; the app cannot)

The gate sees passwords in transit exactly as the homeserver does, so it runs **on the homeserver's machine or
private network** and nowhere less trusted. Your reverse proxy sends it only these paths; everything else goes to the
homeserver as before.

```nginx
location ~ ^/_matrix/client/(v3|r0)/(login|register)$ {
    proxy_pass http://127.0.0.1:8788;
    proxy_set_header X-Forwarded-For $remote_addr;   # overwrite, never append: the gate trusts this header
}
location /gate/ {
    proxy_pass http://127.0.0.1:8788;
    proxy_set_header X-Forwarded-For $remote_addr;
}
```

```bash
cd tools/login-gate
cp login-gate.example.json gate.json        # edit: upstream, serverName, admins (your @you:host), storePath
export GATE_KEY=$(node cli.mjs keygen)      # 32 bytes, base64; keep it out of the config file and out of git
node cli.mjs enroll gate.json @you:host     # enrol YOUR account too: prints a QR URI and key for your app
node cli.mjs serve  gate.json               # run it (as a service, with GATE_KEY in its environment)
```

Then, and only then, consider `"enforce": "all"` (refuse accounts that never enrolled, except `allowUnenrolled`).

**Things that bypass the gate, and what to do about each**

* The homeserver's own port reachable from outside: firewall it so login and register can only arrive through the proxy.
* SSO / OIDC login or `m.login.token`: the gate refuses `m.login.token` on the paths it is routed, but an SSO
  callback is a different path. Disable SSO, or accept that it is outside this protection.
* Matrix accounts made some other way (admin API, shared-secret registration): they are not enrolled. With
  `enforce: "enrolled"` they sign in with a password alone; with `"all"` they are refused.
* Federation is untouched.

**Other Matrix apps (Element, etc.)** can sign in to an enrolled account: type the six digits straight after the
password in the password field.

**Losing a phone:** there is no self-service recovery. Run `node cli.mjs remove gate.json @them:host`; they enrol again.

## What this does and does not protect

* **Protects:** a stolen or guessed password alone; a link, an email, or the owner's own mailbox; the owner (or an
  invited person's session) being used to sign in as someone else.
* **Does not protect:** someone who already holds a session token (the browser's); a fake page that relays the six
  digits in real time (TOTP is not phishing-resistant — passkeys are, and are a follow-up); the content of the rooms
  from whoever runs the homeserver (they are ordinary, unencrypted Matrix rooms, which is how this workspace already
  stores its data); a person whose invitation link is opened first by someone else who also enrols (the link is a
  bearer invitation until used: send it as you would a key, and watch the list).
* **The gate adds a trade:** someone can lock a person out for five minutes by failing on purpose. That is the lesser harm.

## Tests

`node --test holodeck-invite-core.test.mjs holodeck-invites.test.mjs holodeck-rest-matrix.test.mjs holodeck-qr.test.mjs tools/login-gate/gate.test.mjs`

The homeserver in those tests is a small in-test HTTP double (`tests/fake-homeserver.mjs`), **not Synapse**. See
`MATRIX-INVITES-PREREG.md`, Part II, for what was predicted and what was found.

A browser demo of the real panels against that double and the real gate: `node tests/people-stack.mjs 8874`, then open
`tests/people.demo.html` from any static server.
