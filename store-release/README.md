# Store submission kit — Prayer Times Reminder

> Kept in `store-release/` (NOT `dist/`, which `tools/build.js` wipes on every run).

App name: **Prayer Times Reminder (Prayer Times Break)** / **مواقيت الصلاة (استراحة الصلاة)**
Listing text (EN + AR): `listings/`. Privacy page to host: `../docs/privacy.html`.

## Chrome Web Store
Upload `packages/prayer-times-reminder-chrome-v2.2.4.zip` · screenshots `assets/chrome/`.

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
