# Store submission kit — Prayer Times Reminder

> Kept in `store-release/` (NOT `dist/`, which `tools/build.js` wipes on every run).

App name: **Prayer Times Reminder (Prayer Times Break)** / **مواقيت الصلاة (استراحة الصلاة)**
Listing text (EN + AR): `listings/`. Privacy page to host: `../docs/privacy.html`.

## Chrome Web Store
Upload `packages/prayer-times-reminder-chrome-v2.2.0.zip` · screenshots `assets/chrome/`.

## Google Play
Upload `packages/prayer-times-reminder-android-v2.1.2-215.aab` · feature graphic + icon in `assets/play/` · phone screenshots: **recapture** (`assets/play/screenshots/` is empty — the earlier device captures were lost when dist/ was wiped).

## Microsoft Store  (product type: "MSIX or PWA app")
Upload **`packages/PrayerTimesReminder-windows-v1.0.0.msix`** to the Packages step.
Built with your Store identity `Mohammadalsafadi.PrayerTimesReminder` and **verified to install + run** in an MSIX container; the Store re-signs it (no code-signing cert needed).
- Store logo: `assets/microsoft/icon-512.png`
- Desktop screenshot: **recapture** when the PC is free (`assets/microsoft/screenshots/` empty).
- `packages/*.msi` and `*-setup.exe` are for **direct distribution only** (won't upload to an MSIX product).

MSIX source (manifest + layout): `targets/desktop/msix/`.
