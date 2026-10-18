// holodeck-byo.js — one call that ties it together: sign in with Google, keep your bytes in your own
// Drive app folder, sealed under the workspace key the device already holds.
//
// This is the facade the page uses. It does no work of its own; it composes the three modules:
//   holodeck-google-signin.js   → the ID token (identity) and the access token (drive.appdata)
//   holodeck-storage-drive.js   → the provider: opaque bytes in Google's hidden app folder
//   holodeck-storage.js         → sealedStore: seal on the way out, open on the way in, refuse a downgrade
//   holodeck-vault.js           → the workspace keyring, on the device, never sent anywhere
//
// The two halves stay separate on purpose. Google says WHO the person is; the keyring says they can READ
// their content. A Google sign-in is never a way to decrypt: the keyring is the device link or the SSSS
// recovery phrase, and losing it loses the content — Google or not.
//
// PURE-ish. It touches the DOM only through loadGis(); everything else is injected or comes from the modules.

import { loadGis, idClient, tokenClient, tokenSource, identityOf } from './holodeck-google-signin.js';
import { driveAppData } from './holodeck-storage-drive.js';
import { sealedStore, putManifest, getManifest, MANIFEST_KEY } from './holodeck-storage.js';
import { deviceKeyring } from './holodeck-vault.js';

export const DRIVE_APPDATA = 'https://www.googleapis.com/auth/drive.appdata';

/**
 * byoStorage({ clientId, scope = DRIVE_APPDATA, workspace, account, gsi?, gisOpts?, fetch? })
 *   workspace  the workspace name (its private room id, as everywhere) — the vault scope
 *   account    the signed-in Matrix account (the keyring is per account too)
 * Returns an object with the pieces and the flow:
 *   { provider, store, manifest, signIn, signOut, tokenSource, identity, workspace }
 */
export function byoStorage({ clientId, scope = DRIVE_APPDATA, workspace, account = '', gsi = null, gisOpts = {}, fetch: fetchImpl, ring = null } = {}) {
  if (!clientId) throw new Error('byoStorage needs a Google OAuth client id');
  if (!workspace) throw new Error('byoStorage needs a workspace (its private room id)');
  const keyring = () => ring || deviceKeyring(account);
  let accounts = gsi, idc = null, ts = null, provider = null, store = null, identity = null;

  async function signIn({ prompt = '', hint } = {}) {
    accounts = accounts || await loadGis(gisOpts);
    idc = idc || idClient(accounts, { clientId });
    ts = ts || tokenSource(tokenClient(accounts, { clientId, scope }));
    const idToken = await idc.prompt();
    identity = idToken ? identityOf(idToken) : null;
    const token = await ts({ prompt });                  // requests drive.appdata
    provider = provider || driveAppData({ token: () => ts(), fetch: fetchImpl });
    store = store || sealedStore(provider, keyring(), workspace);
    return { identity, idToken, provider, store };
  }

  function signOut() { if (idc) idc.disableAutoSelect(); identity = null; }

  return {
    get provider() { return provider; },
    get store() { return store; },
    get identity() { return identity; },
    workspace,
    signIn, signOut,
    tokenSource: () => ts,
    /** Seal the pointer a second device reads to find this workspace in the app folder. */
    writeManifest: (prefix = '') => putManifest(provider, keyring(), workspace, { provider: 'drive-appdata', prefix }),
    readManifest: () => getManifest(provider, keyring(), workspace),
    MANIFEST_KEY,
  };
}
