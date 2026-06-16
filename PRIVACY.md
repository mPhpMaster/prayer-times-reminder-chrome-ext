# Privacy Policy — Prayer Times Reminder

_Last updated: 16 June 2026_

**Prayer Times Reminder** ("the extension") is designed to respect your privacy.
This policy explains what data the extension uses and how.

## What the extension stores

The extension stores the following **locally on your device** using Chrome's
`storage.local` API:

- Your chosen **location** — either a country + city, or (if you opt in) your
  approximate latitude/longitude from the browser's geolocation prompt.
- Your selected **language** (English, German, Arabic, Urdu, Hindi, Indonesian, French, Spanish, or other supported UI language).
- Your **date format** preference for the Gregorian date shown in the popup.
- Your **number style** preference when Arabic is active (Arabic-Indic or
  Western digits).
- **Tab lock settings** — whether tab lock is enabled, lock duration (minutes),
  and whether manual unlock is allowed.
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

Only the minimum information needed to fulfill the request is sent. No personal
identifiers, accounts, or contact details are transmitted.

## Tab lock and page access

If you enable **Lock tab during prayer**, the extension injects a script
(`content-lock.js`) into the **currently active tab** when a prayer alarm fires
(or when you click **Test tab lock**). This requires the `tabs`, `scripting`,
and `<all_urls>` permissions so the overlay can be shown on regular websites.

The injected script:

- Runs only on the tab that is active at prayer time (or the tab you test on).
- Does **not** read page content, form data, passwords, or browsing history.
- Shows a local countdown overlay and blocks interaction until the timer ends
  or you dismiss it (if manual unlock is enabled).
- Does not send any data from the page to the developer or to third parties.

Tab lock cannot run on restricted Chrome pages (e.g. `chrome://` or
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
| `alarms` | Schedule reminders 5 minutes before each prayer and at prayer time; refresh after midnight. |
| `notifications` | Show prayer-time alerts in your system notification area. |
| `storage` | Save your location, language, preferences, and cached times locally. |
| `geolocation` | Optional; only used if you click **Use my location**. |
| `tabs` | Find the active tab when applying the prayer-time lock overlay. |
| `scripting` | Inject the lock overlay script into the active tab at prayer time. |
| `https://api.aladhan.com/*` | Fetch prayer times for your location. |
| `https://countriesnow.space/*` | Fetch city lists for the country dropdown. |
| `<all_urls>` | Inject the tab-lock overlay on the active website tab (only when tab lock is used). |

## Contact

Questions about this policy: **mphpmaster@gmail.com**
