# Prayer Times Reminder — Chrome Extension

A Manifest V3 Chrome extension that:

- 🔔 **Notifies you when each prayer time arrives** (Fajr, Dhuhr, Asr, Maghrib, Isha) — in your chosen language.
- 🕌 **Shows the full daily prayer schedule** for your city/country, with a live countdown to the next prayer.
- 🌍 **Country & city dropdowns** — pick a country, and the city list loads automatically.
- 🌐 **English / العربية toggle** — full Arabic UI with right-to-left layout, Arabic prayer names, and Arabic-Indic numerals (٤:٣٥).
- 🌙 **Hijri date** shown alongside the Gregorian date.

Prayer times come from the free [AlAdhan API](https://aladhan.com/prayer-times-api); the city list comes from the free [CountriesNow API](https://countriesnow.space). No API keys required.

## Install (load unpacked)

1. Open `chrome://extensions` in Chrome.
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked** and select this folder (`E:\chrome-ext`).
4. Click the extension icon in the toolbar to open the popup.
5. Open **⚙️ Location & settings**, choose your **Country** then **City** from the dropdowns (or click **📍 Use my location**), pick a calculation method, then **Save & Load**.
6. Use the **العربية / English** button in the header to switch language at any time.

That's it — the extension will fetch today's times, show them, and schedule a notification for each upcoming prayer. It automatically refreshes after midnight for the new day.

> **Notifications:** make sure Chrome is allowed to show system notifications in your OS settings, otherwise the alerts won't appear.

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | MV3 manifest (permissions: alarms, notifications, storage, geolocation). |
| `background.js` | Service worker — fetches times, schedules `chrome.alarms`, fires localized notifications. |
| `i18n.js` | Shared translations (EN/AR), prayer names, country list, calculation methods, digit helper. |
| `popup.html` / `popup.css` / `popup.js` | The popup UI (schedule, countdown, language toggle, settings). |
| `icons/` | Extension icons (crescent + star). |
| `make_icons.py` | Regenerates the PNG icons (dev-only, not needed at runtime). |

## How it works

- **Scheduling:** on install/startup and whenever your location changes, the service worker fetches today's timings and creates a one-shot `chrome.alarms` entry at each upcoming prayer time, plus a refresh alarm just after midnight.
- **Notifications:** when a prayer alarm fires, a system notification appears (`requireInteraction` so it stays until dismissed).
- **Popup:** renders the cached schedule instantly, then refreshes from the network; the next prayer is highlighted with a second-by-second countdown.

## Calculation methods

The settings dropdown exposes common AlAdhan methods (ISNA, Muslim World League, Umm al-Qura, Egyptian, Karachi, Diyanet, etc.). Pick whichever matches your local mosque/authority for the most accurate times.
