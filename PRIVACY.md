# Privacy Policy — Prayer Times Reminder

_Last updated: 8 October 2026_

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
- If you play the optional **dhikr game**: your progress (tasks finished,
  points, times), game settings, the recognized text of a task you have not
  finished yet (so you can resume it; it is removed when the task is done), and,
  if you sign in, your username, email address and this device's access token.

This data never leaves your device except as described below, and the developer
has **no access** to it. Prayer times, prayer alerts and every prayer setting
work **without any account**.

## Data sent to third parties

Prayer times are calculated **offline, on your device**. To populate the city
dropdown and locate the city you pick, the extension sends requests to these
free public APIs:

- **Open-Meteo** (`api.open-meteo.com`) — only for the weather on the Chrome
  extension’s new tab, if shown: the saved city’s coordinates **rounded to about
  10 km**. No account, name or identifier is sent; the weather can be turned off
  in the new tab’s settings.
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

The **Prayer Adhkar** link in the popup's settings opens an optional game page in its own tab. Playing works
entirely in the extension, and your progress stays on your device.

- **Voice.** When you tap **Start reading**, the game page uses Chrome's
  built-in speech recognition (the Web Speech API). Chrome asks for microphone
  permission the first time; the microphone is not an extension permission and
  you can revoke it in Chrome's site settings. Chrome sends the audio to
  Google's speech service to turn it into text, under
  [Google's privacy policy](https://policies.google.com/privacy). The extension
  does not record or keep your voice. It receives only the recognized text and
  compares it with the dhikr on your device; the text is never sent to the
  developer and stays on your device only until that task is finished.
- **Game account (optional, only for the leaderboard and follows).** You can
  sign in with an **email address and password**, or with **Google** (Chrome's
  own sign-in window, via the `identity` permission — the extension receives
  only the sign-in token Google issues for the game, and passes it to the game
  server, which checks it with Google). The game server
  (`prayer-times.sarhsoft.com`, HTTPS) then stores your email, a one-way bcrypt
  hash of your password (never the password), Google's account ID if you use
  Google (not your Google name or photo), your public username and optional
  display name, the dhikr tasks you finish (task, points, start and finish
  times), the players you follow, whether you hid your progress, and for each
  signed-in device a hash of its access token and when it was last used. If you
  ask for a password reset, a code valid for 15 minutes is emailed to you and
  only its hash is stored.
- **What other players see.** Your username, display name and monthly points
  appear on the leaderboard and your profile for other signed-in players,
  unless you turn on **Hide my progress**. Your email is never shown.
- Your location, city and prayer times are never sent to the game server. You
  can sign out (which revokes that device's token) or delete the account at any
  time from **My account › Delete my account**; this removes your account,
  points, follows and sign-in links from the server at once. Without the
  extension, see [how to request deletion](https://mphpmaster.github.io/prayer-times-reminder-chrome-ext/delete-account.html).

## Dedication names on the About page

The About page lists the people this app is an ongoing charity (sadaqah
jariyah) for. The list is loaded from the game server
(`prayer-times.sarhsoft.com`) and kept on your device so it shows offline;
loading it sends no personal data.

- **Requesting a name (signed-in players only).** You can ask for a name to be
  added, written in one or more of the app's languages, with an optional note.
  The server stores the name(s), the note, the request's status, and which
  account sent it. The app's admins see the request together with your
  username and email, and may edit, approve or decline it; if they decline,
  you see their reason under **My requests**. No email is sent to you.
- **Approved names are public**: everyone who uses the app sees them on the
  About page. Only send a name you have the right to share.
- Deleting your account removes your pending requests; names already approved
  stay on the About page, no longer linked to any account.

## Email confirmation and admins

- To confirm your email, the server emails you a 6-digit code (valid 15
  minutes; only its hash is stored). Google sign-in confirms it automatically.
- The app's **admins** (accounts whose confirmed email the owner has made an
  admin) can review name requests, manage the About page list, see account
  usernames, emails and points, and reset or delete accounts (for example
  when asked to, or for abuse). Every admin action is logged on the server.

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
| `notifications` | Show prayer-time alerts in your system notification area (and the game's optional "tasks are open" reminders). |
| `storage` | Save your location, language, preferences, cached times, and game progress locally. |
| `geolocation` | Optional; only used if you click **Use my location**. |
| `scripting` | Inject the lock overlay and dhikr card scripts into your open tabs. |
| `offscreen` | Play the adhan or chime packaged with the extension; Chrome's background worker cannot play audio directly. |
| `identity` | Optional **Continue with Google** in the dhikr game: opens Chrome's Google sign-in window. Not used for anything else; prayer features never need it. |
| `<all_urls>` (optional) | Inject the tab-lock overlay and the dhikr card on your open website tabs. Requested at runtime when you first enable tab lock or dhikr — **not** granted at install, and you can decline. |

The extension declares **no** host permissions for the AlAdhan, CountriesNow, or
Nominatim APIs — it reaches them as ordinary cross-origin network requests (see
**Data sent to third parties** above), not through granted access to those sites.
`<all_urls>` is the extension's only host permission, it is **optional**, and it
is used solely to place the lock/dhikr overlay on your tabs — never to read them.

## Contact

Questions about this policy: **mphpmaster@gmail.com**

Terms & Conditions: [TERMS.md](TERMS.md) · Web version of this policy:
<https://mphpmaster.github.io/prayer-times-reminder-chrome-ext/privacy.html>
