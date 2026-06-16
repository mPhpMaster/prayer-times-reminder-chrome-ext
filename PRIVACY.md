# Privacy Policy — Prayer Times Reminder

_Last updated: 16 June 2026_

**Prayer Times Reminder** ("the extension") is designed to respect your privacy.
This policy explains what data the extension uses and how.

## What the extension stores

The extension stores the following **locally on your device** using Chrome's
`storage.local` API:

- Your chosen **location** — either a country + city, or (if you opt in) your
  approximate latitude/longitude from the browser's geolocation prompt.
- Your selected **language** (English or Arabic).
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

## What the extension does NOT do

- It does **not** collect, sell, or share your personal data.
- It does **not** use analytics or tracking.
- It does **not** show ads.
- It does **not** transmit data to the developer.

## Permissions

- `alarms` — schedule a reminder at each prayer time.
- `notifications` — show the prayer-time reminder.
- `storage` — save your location, language, and cached times locally.
- `geolocation` — optional; only used if you click "Use my location".
- Host access to `api.aladhan.com` and `countriesnow.space` — to fetch prayer
  times and city lists.

## Contact

Questions about this policy: **mphpmaster@gmail.com**
