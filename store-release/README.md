# Store submission kit — Prayer Times Reminder

> Kept in `store-release/` (NOT `dist/`, which `tools/build.js` wipes on every run).

App name: **Prayer Times Reminder (Prayer Times Break)** / **مواقيت الصلاة (استراحة الصلاة)**
Listing text (EN + AR): `listings/`. Privacy page to host: `../docs/privacy.html`.

## Chrome Web Store
Item id `knahkbkmbjghaiillhngjbhoinmeegoc`. Upload `packages/prayer-times-reminder-chrome-v2.3.0.zip`
(built by `npm run build`, checked by `npm run verify:package`) · screenshots `assets/chrome/`.

2.3.0 adds the optional dhikr game (popup › "Prayer Adhkar", opens in a tab). Prayer times stay the
popup/home and never need an account.

### Before publishing 2.3.0 — Google sign-in setup (one time)
The game's "Continue with Google" uses `chrome.identity.launchWebAuthFlow` with the backend's **web**
OAuth client (`GOOGLE_WEB_CLIENT_ID`, served by `GET /v1/auth/config`), so the ID token's audience is
the one the server already verifies. In Google Cloud Console › Credentials › that web client ›
**Authorized redirect URIs**, add:

    https://knahkbkmbjghaiillhngjbhoinmeegoc.chromiumapp.org/

(An unpacked dev copy has a different id — add its `https://<dev-id>.chromiumapp.org/` too to test
locally.) The production backend must have `GOOGLE_WEB_CLIENT_ID` set and working mail for
password-reset codes.

### Permission justification — `identity`
> Used only for the optional "Continue with Google" sign-in in the extension's dhikr game (a
> leaderboard). It opens Chrome's Google sign-in window (launchWebAuthFlow) and returns a Google ID
> token that the game server verifies. No Google API is called with it and no other account data is
> read. Prayer times, prayer alerts and all settings work without signing in.

### Privacy practices — data usage (2.3.0)
Tick: **Personally identifiable information** (email address — optional game account),
**Authentication information** (password, sent over HTTPS and stored only as a hash; Google sign-in
token), **User activity** (dhikr tasks finished and points — leaderboard). All only when the user
creates a game account. Certify: not sold, not used for unrelated purposes, not used for
creditworthiness. Privacy policy URL: the hosted `docs/privacy.html`.

### Remote code
No. All code ships in the package; the extension only fetches JSON from its own game API and the
public prayer/city APIs.

### Permission justification — `offscreen`
The dashboard blocks publishing until this is filled in (Privacy practices tab). Paste:

> The extension plays the call to prayer (adhan) or a short chime at prayer time, while the
> prayer-time lock screen is shown. A service worker cannot play audio, and playing it from a
> content script in the user's open tabs does not work: Chrome's autoplay policy blocks audio
> without a user gesture, and the lock screen is shown on every open tab, so the adhan would play
> once per tab at the same time. An offscreen document with the AUDIO_PLAYBACK reason lets the
> extension play the sound exactly once, reliably. The document is created only when a prayer lock
> with sound begins, and it is closed as soon as the audio finishes or the lock ends. It plays only
> an audio file bundled in the extension package, makes no network requests, and does not access or
> handle any user data.

## Google Play
Upload `packages/prayer-times-reminder-android-v2.1.2-215.aab` · feature graphic + icon in `assets/play/` · phone screenshots: **recapture** (`assets/play/screenshots/` is empty — the earlier device captures were lost when dist/ was wiped).

## Microsoft Store  (product type: "MSIX or PWA app")
Upload **`packages/PrayerTimesReminder-windows-v1.0.0.msix`** to the Packages step.
Built with your Store identity `Mohammadalsafadi.PrayerTimesReminder` and **verified to install + run** in an MSIX container; the Store re-signs it (no code-signing cert needed).
- Store logo: `assets/microsoft/icon-512.png`
- Desktop screenshot: **recapture** when the PC is free (`assets/microsoft/screenshots/` empty).
- `packages/*.msi` and `*-setup.exe` are for **direct distribution only** (won't upload to an MSIX product).

MSIX source (manifest + layout): `targets/desktop/msix/`.
