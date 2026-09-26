# Privacy Policy — Prayer Times Reminder

_Last updated: 27 September 2026_

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

- Your **dhikr game** progress (tasks finished, points, times) and game
  settings, if you play the optional game.

This data never leaves your device except as described below, and the developer
has **no access** to it. Prayer times, prayer alerts and every prayer setting
work **without any account**.

## Data sent to third parties

Prayer times are calculated **offline, on your device**. To populate the city
dropdown and locate the city you pick, the extension sends requests to these
free public APIs:

- **CountriesNow API** (`countriesnow.space`) — receives a country name in order
  to return its list of cities.
- **Nominatim API** (`nominatim.openstreetmap.org`) — receives the **name of the
  city you select** (as text, with its country) when you save it, in order to
  look up that city's coordinates for the offline calculation; when the
  interface language is **Arabic**, it is also used to look up the city's
  Arabic-script label for display. Your own device coordinates are **not** sent
  to Nominatim.
- **AlAdhan API** (`api.aladhan.com`) — only as a fallback, for a location saved
  without coordinates (e.g. by an older version, or if the city lookup above
  failed): receives your city/country and the calculation method in order to
  return prayer times.

Only the minimum information needed to fulfill the request is sent. No personal
identifiers, accounts, or contact details are sent to these services.

## Optional dhikr game and game account

The popup's **Prayer Adhkar** link opens an optional game page. Playing works
entirely in the extension, and your progress stays on your device.

- **Voice.** When you tap the microphone to recite, the page uses Chrome's
  built-in speech recognition, which asks for microphone permission the first
  time. Your voice is processed by that service under
  [Google's privacy policy](https://policies.google.com/privacy). The extension
  only receives the recognized text, compares it with the dhikr locally, and
  does not store or send your voice or the text to the developer.
- **Game account (optional, only for the leaderboard and follows).** You can
  sign in with an **email address and password**, or with **Google** (Chrome's
  own sign-in window, via the `identity` permission — the extension receives
  only the sign-in token Google issues for the game). The game server
  (`prayer-times.sarhsoft.com`, HTTPS) then stores your email, a one-way hash of
  your password (never the password), Google's account ID if you use Google,
  your public username, the dhikr tasks you finish (task, points, start and
  finish times), the players you follow, and whether you hid your progress.
  Your location, city and prayer times are never sent. You can delete the
  account at any time from **My account › Delete my account**; see
  [the full policy](https://github.com/mPhpMaster/prayer-times-reminder-chrome-ext/blob/main/docs/privacy.html).

## Tab lock and page access

If you enable **Lock tab during prayer**, the extension injects a script
(`overlay-lock.js`) into **every open tab** when a prayer alarm fires
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
(`overlay-tasbih.js`) into your **open tabs** on a timer (or when you click
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
- It does **not** transmit data to the developer, except the optional game
  account data you choose to share (above).
- It does **not** monitor or record your browsing activity.

## Permissions

| Permission | Why it is needed |
|------------|------------------|
| `alarms` | Schedule reminders at each prayer time; refresh after midnight. |
| `notifications` | Show prayer-time alerts in your system notification area. |
| `storage` | Save your location, language, preferences, and cached times locally. |
| `geolocation` | Optional; only used if you click **Use my location**. |
| `scripting` | Inject the lock overlay and dhikr card scripts into your open tabs. |
| `identity` | Optional **Continue with Google** in the dhikr game: opens Chrome's Google sign-in window. Not used for anything else; prayer features never need it. |
| `<all_urls>` (optional) | Inject the tab-lock overlay and the dhikr card on your open website tabs. Requested at runtime when you first enable tab lock or dhikr — **not** granted at install, and you can decline. |

The extension declares **no** host permissions for the AlAdhan, CountriesNow, or
Nominatim APIs — it reaches them as ordinary cross-origin network requests (see
**Data sent to third parties** above), not through granted access to those sites.
`<all_urls>` is the extension's only host permission, it is **optional**, and it
is used solely to place the lock/dhikr overlay on your tabs — never to read them.

## Contact

Questions about this policy: **mphpmaster@gmail.com**
