# Privacy Policy — Prayer Times Reminder

_Last updated: 30 June 2026_

**Prayer Times Reminder** ("the extension") is designed to respect your privacy.
This policy explains what data the extension uses and how.

## What the extension stores

The extension stores the following **locally on your device** using Chrome's
`storage.local` API:

- Your chosen **location** — either a country + city, or (if you opt in) your
  approximate latitude/longitude from the browser's geolocation prompt.
- Your selected **language** (English, German, Arabic, Urdu, Hindi, Indonesian, French, Spanish, or other supported UI language).
- Your **date format** preference for the Hijri and Gregorian dates shown in the popup.
- Your **number style** preference when Arabic or Urdu is active (Arabic-Indic or
  Western digits).
- **Tab lock settings** — whether tab lock is enabled, lock duration (minutes),
  and whether manual unlock is allowed.
- **Theme** preference (Midnight Emerald or Classic).
- **Dhikr (tasbih) settings** — whether periodic dhikr is enabled, reminder
  interval (fixed or random range), and on-screen position.
- A **cache** of today's prayer times and the city list for your country, so the
  popup loads quickly.

This data never leaves your device except as described below, and the developer
has **no access** to it.

## Data sent to third parties

To calculate prayer times and populate the city dropdown, the extension sends
requests to two free public APIs:

- **AlAdhan API** (`api.aladhan.com`) — receives your city/country or
  coordinates and the calculation method in order to return prayer times.
- **CountriesNow API** (`countriesnow.space`) — receives a country name in order
  to return its list of cities.
- **Nominatim API** (`nominatim.openstreetmap.org`) — only when the interface
  language is set to **Arabic**, receives the **name of the city you select**
  (as text, with its country) in order to look up that city's Arabic-script
  label for display. Your coordinates are **not** sent to Nominatim, and it is
  not contacted in other languages.

Only the minimum information needed to fulfill the request is sent. No personal
identifiers, accounts, or contact details are transmitted.

## Tab lock and page access

If you enable **Lock tab during prayer**, the extension injects a script
(`content-lock.js`) into **every open tab** when a prayer alarm fires
(or, when you click **Test tab lock**, into the tab you are testing). This
requires the `scripting` permission plus access to your open tabs. That tab
access is an **optional** host permission (`<all_urls>`) that is **not** granted
at install time — the extension asks for it the first time you turn tab lock on
(or run **Test tab lock**), and you can decline. Tab lock only works once you
allow it.

The injected script:

- Runs on your open tabs at prayer time (or the tab you test on); tabs you open
  or navigate to during the lock window are covered too.
- Does **not** read page content, form data, passwords, or browsing history.
- Shows a local countdown overlay and blocks interaction until the timer ends
  or you dismiss it (if manual unlock is enabled).
- Does not send any data from the page to the developer or to third parties.

Tab lock cannot run on restricted Chrome pages (e.g. `chrome://` or
`chrome-extension://` URLs).

## Periodic dhikr and page access

If you enable **Periodic dhikr**, the extension injects a script
(`content-tasbih.js`) into your **open tabs** on a timer (or when you click
**Test dhikr**). This uses the same `scripting` permission and optional tab
access (`<all_urls>`) as tab lock so the floating card can appear on regular
websites.

The injected script:

- Runs on your open tabs when the dhikr alarm fires (or the tab you test on).
- Does **not** read page content, form data, passwords, or browsing history.
- Shows a small floating card with a dhikr phrase; it does not block page
  interaction. Tap the card to dismiss it, or it auto-hides after 10 seconds.
- Does not send any data from the page to the developer or to third parties.

Dhikr reminders cannot run on restricted Chrome pages (e.g. `chrome://` or
`chrome-extension://` URLs).

## What the extension does NOT do

- It does **not** collect, sell, or share your personal data.
- It does **not** use analytics or tracking.
- It does **not** show ads.
- It does **not** transmit data to the developer.
- It does **not** monitor or record your browsing activity.

## Permissions

| Permission | Why it is needed |
|------------|------------------|
| `alarms` | Schedule reminders at each prayer time; refresh after midnight. |
| `notifications` | Show prayer-time alerts in your system notification area. |
| `storage` | Save your location, language, preferences, and cached times locally. |
| `geolocation` | Optional; only used if you click **Use my location**. |
| `scripting` | Inject the lock overlay and dhikr card scripts into your open tabs. |
| `https://api.aladhan.com/*` | Fetch prayer times for your location. |
| `https://countriesnow.space/*` | Fetch city lists for the country dropdown. |
| `https://nominatim.openstreetmap.org/*` | Reverse-geocode coordinates when you use **Use my location**. |
| `<all_urls>` (optional) | Inject the tab-lock overlay and the dhikr card on your open website tabs. Requested at runtime when you first enable tab lock or dhikr — not granted at install, and you can decline. |

## Contact

Questions about this policy: **mphpmaster@gmail.com**
