# Mobile target (Android / Capacitor)

> **iPhone / iPad:** the same shell also builds for iOS (`ios/`, free unsigned
> builds on GitHub Actions) — see [IOS.md](IOS.md).

Shares `core/` via `tools/sync-core.mjs mobile`, which assembles the web layer
into `www/`. `web/index.html` redirects to the shared `popup.html`; the web ⇄
native bridge is `web/adapter.js` (`Platform` over Capacitor plugins +
`Capacitor.Plugins.PrayerLock`).

## First-time setup / build

```
# from targets/mobile  (Android Studio + JDK 21 + SDK already present)
npm init -y
npm i @capacitor/core @capacitor/cli @capacitor/android \
      @capacitor/preferences @capacitor/local-notifications @capacitor/geolocation @capacitor/app
node ../../tools/sync-core.mjs mobile     # fills www/
npx cap init "Prayer" "com.mphpmaster.prayer" --web-dir=www   # capacitor.config.json is pre-written
npx cap add android
npx cap copy
npx cap open android        # build/run from Android Studio
```

`ANDROID_HOME` is currently unset — point it at `~/AppData/Local/Android/Sdk`.
The Capacitor plugins compile with a **JDK 21** toolchain; the default JDK 17
fails with `Cannot find a Java installation … languageVersion=21`, so set
`JAVA_HOME` to a JDK 21 (e.g. `C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot`).
Build from **PowerShell**, not Git Bash (Gradle workers can't open loopback
sockets there):

```powershell
# debug
node ../../tools/sync-core.mjs mobile; npx cap copy android
cd android; $env:ANDROID_HOME="$env:USERPROFILE\AppData\Local\Android\Sdk"
$env:JAVA_HOME="C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot"
.\gradlew.bat assembleDebug

# release (signed): APK for sideloading + AAB for Google Play
.\gradlew.bat assembleRelease bundleRelease
# -> app/build/outputs/apk/release/app-release.apk
# -> app/build/outputs/bundle/release/app-release.aab
```

Release signing reads `android/keystore.properties` →
`android/keystore/prayer-release.keystore` (both **gitignored**). ⚠️ Back both
files up somewhere safe: a Play-published app can only ever be updated with
this exact keystore. Version lives in `app/build.gradle`
(`versionCode` / `versionName`) — bump `versionCode` for every store upload.

## Native lock plugin (`PrayerLock`, Java — implemented)

The web adapter calls `Capacitor.Plugins.PrayerLock.{ start, clear, showDhikr,
scheduleDhikr, ensureOverlayPermission, ensureBatteryExemption,
ensureFullScreenIntentPermission }`. Dhikr is
deliberately NOT a notification (no sound, no shade entry): `DhikrScheduler`
arms one-shot exact `AlarmManager` alarms from the stored settings
(`CapacitorStorage` prefs, so no separate sync channel), each fire shows the
silent `DhikrOverlay` balloon — tapping it dismisses it; touches outside the
balloon pass through to the app below (`TYPE_APPLICATION_OVERLAY` WebView loading
`dhikr.html` → shared `overlay-tasbih.js`), then re-arms (random mode needs a
fresh gap each time). Skips quietly when the screen is off; `BootReceiver`
re-arms after reboot; requires the "display over other apps" grant
(`ensureOverlayPermission`, asked via the permission flow — see below). The plugin lives under
`android/app/src/main/java/com/mphpmaster/prayer/` and provides:

- **Lock**: high-importance notification with `setFullScreenIntent(...)`
  (`USE_FULL_SCREEN_INTENT`) launching a full-screen `Activity`
  (`FLAG_KEEP_SCREEN_ON`, `setShowWhenLocked`) that loads `overlay-lock.js`;
  a foreground `Service` keeps it alive; a `TYPE_APPLICATION_OVERLAY`
  (`SYSTEM_ALERT_WINDOW`) re-asserts if the user leaves.
- **Silent/DND**: `NotificationManager.setInterruptionFilter(INTERRUPTION_FILTER_ALARMS)` (alarms-only: silences calls, ringtone and notifications but keeps media, so the lock's own adhan/chime still plays — `NONE` muted it)
  (`ACCESS_NOTIFICATION_POLICY`, user-granted).
- **Camera off (optional)**: `DeviceAdminReceiver` + `DevicePolicyManager.setCameraDisabled(true)`.

Scheduling uses `@capacitor/local-notifications` with a rolling ~7-day window
(5/day ≈ 35), topped up on each `App.resume`, computed from
`core/logic/scheduler-core.js` + the offline `prayer-engine`. Request
`SCHEDULE_EXACT_ALARM`, a high-importance channel, and a
battery-optimization exemption (Doze).

`AndroidManifest.xml` permissions: `SYSTEM_ALERT_WINDOW`, `FOREGROUND_SERVICE`,
`USE_FULL_SCREEN_INTENT`, `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM` /
`USE_EXACT_ALARM`, `ACCESS_NOTIFICATION_POLICY`, `BIND_DEVICE_ADMIN`.

### Permission flow

`runPermissionFlow()` in `web/adapter.js` asks for the grants **one at a time**:
notifications → full-screen intent → exact alarms ("Alarms & reminders") → Do Not Disturb → display over other apps
→ battery exemption, skipping any already granted (`PrayerLock.permissionStatus`,
which never prompts) or irrelevant to the current settings (e.g. overlay only
when dhikr is on). Each step first shows a short in-app sheet explaining why;
the system screen opens only on "Continue", and the next step waits until the
user is back. It waits for a city to be chosen, and re-runs when a relevant
setting turns on. Each step is asked once (`*Asked` flags); **Settings → Check
permissions** re-runs it for anything still missing, e.g. after an accidental
Deny. Android 11+ ignores the `package:` URI for the DND and overlay screens and
shows the full app list, which is why those sheets tell the user to find the
app in it, by the label the system actually shows (`permissionStatus().appLabel`,
which follows the phone's language: "مواقيت الصلاة" on an Arabic phone).

## Status

- ✅ Capacitor Android project generated (`cap add android`); web layer assembled.
- ✅ Native enforcement written (Java): `PrayerLockPlugin` + `LockActivity`
  (full-screen WebView reusing `overlay-lock.js`) + `LockForegroundService`;
  registered in `MainActivity`; permissions in the manifest.
- ✅ Lock config built via the shared `buildLockConfig` and passed to
  `PrayerLock.start`.
- ✅ Rolling prayer **notifications** scheduled in `web/adapter.js`
  (`scheduleNotifications`, 7-day window, on launch + `App.resume`); tapping a
  prayer notification starts the lock (`localNotificationActionPerformed` →
  `startLockForPrayer`).
- ✅ **Dhikr**: silent floating balloon over any app (native
  `AlarmManager` → `DhikrOverlay`, no notifications/sound); in-page balloon as
  the no-permission fallback; legacy dhikr notifications (ids ≥ 20 000 000)
  are swept on launch.
- ✅ **Delivery reliability**: prayer notifications on a high-importance
  `prayers` channel (5) instead of the plugin's DEFAULT channel, plus a
  one-time battery-optimization exemption prompt
  (`PrayerLock.ensureBatteryExemption`, `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`)
  — required on vivo/oppo/xiaomi or scheduled alarms silently die. Verified:
  notification fires with the app process killed; dhikr overlay draws for its
  full 11 s window on the alarm cadence.
- ✅ **Lock actually surfaces when the app is backgrounded/killed**:
  `LockForegroundService`'s notification uses `setFullScreenIntent(...)` on a
  HIGH-importance channel (`prayer-lock-alarm`) targeting `LockActivity`
  directly — the OS-sanctioned way to launch a full-screen UI from the
  background (same mechanism as alarm-clock/calling apps), instead of relying
  on `LockLauncher`'s plain `startActivity()`, which several OEMs (Android 10+)
  silently block even with `SYSTEM_ALERT_WINDOW` granted. On Android 14+ this
  also needs a one-time user grant (`PrayerLock.ensureFullScreenIntentPermission`,
  `ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT`) — asked via the permission flow
  (see Permission flow above). The notification is also tappable as a manual fallback.
- ✅ Lock teardown is symmetric: manual unlock (tap anywhere), countdown expiry
  (`__prayerLockOnExpire`), and a native fallback timer in `LockActivity` all
  stop the foreground service, restore DND (`Dnd.java`), and finish the
  Activity — no lingering black screen.
- ✅ **Real prayer-time enforcement** (`PrayerLockScheduler` + `PrayerAlarmReceiver`
  + `LockLauncher`): the web layer hands the rolling 7-day plan with ready-made
  lock configs to `PrayerLock.schedulePrayerLocks`; native arms exact
  `AlarmManager` alarms and at fire time stamps a fresh `unlockAt` and launches
  the full-screen lock **over any app, with the app closed** (background
  activity start is allowed via the SYSTEM_ALERT_WINDOW grant). Locks overdue
  by >10 min (phone was off) are dropped, not fired late. Re-armed on boot.
- ✅ **Escape resistance**: `LockActivity` re-launches itself (~0.5 s) whenever
  it loses the foreground while the countdown runs (`onUserLeaveHint`/`onStop`
  → `LockLauncher.bringToFront`) — home and recents lead straight back to the
  lock. Turning the screen off is allowed (`showWhenLocked` keeps the lock
  there on wake).
- ✅ **Never over a call**: if a prayer lock is due while a call is active or
  ringing (`CallState.isInCall` via `AudioManager` mode — no READ_PHONE_STATE),
  `PrayerLockScheduler` re-queues it ~20 s out and re-checks, so it fires the
  moment the call ends and still runs its full duration. It never ends the call
  (emergency-safe, no `ANSWER_PHONE_CALLS`). Device-verified with a debug-only
  simulated-call hook (removed from the shipped build).
- ✅ **Silent during prayer**: `Dnd.enable/restore` around the lock, gated on
  the `silentDuringPrayer` setting (shared toggle in the lock settings, on by
  default, hidden on the browser extension). The notification-policy grant is
  requested once via `PrayerLock.ensureDndAccess`
  (`ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS`).
- ✅ **Un-escapable (watchdog)**: `LockState` + `LockWatchdogReceiver` — an
  exact AlarmManager tick (~4 s) re-launches the lock if the user kills the
  foreground service / swipes the app / the process dies mid-prayer. Alarms are
  system-held, so they survive process death; verified on device by crashing
  the process mid-lock and watching it cold-restart with the lock back on top
  and DND still on. Cleared at expiry / manual unlock; re-armed on boot.
  **Limitation:** Settings > App info > *Force stop* cancels the app's alarms
  (OS kill switch) — no normal app can resist that without Device Admin /
  Accessibility (heavily restricted on Play).
- ⛔ **Not built here:** `gradlew assembleDebug` can't run under Git Bash
  ("Unable to establish loopback connection") — build from PowerShell.
- **TODO (native):** optional Device Admin camera-off.

## Home-screen widgets (`HomeWidgets`, Java)

Four widgets in the launcher's picker: **Next prayer** (2x2, compact at 2x1),
**Prayer times** (4x2 grid; one row when short, a list when narrow),
**Prayer adhkar** (the game's tasks for the current prayer window; tap opens
the game) and **Prayer countdown** (the popup's "Next prayer" card: hours and
minutes boxes + progress since the previous prayer). Screenshots:
`docs/android-widgets/`.

- **Data:** the prayer engine is JS, so `adapter.js` (`publishWidgets`)
  publishes a snapshot through `Capacitor.Plugins.HomeWidgets.update` on
  launch, resume and any change of location / language / theme / digits /
  game progress — only while a widget is placed (`HomeWidgets.placed`).
  It holds ready-formatted times for yesterday + 7 days (the same horizon as
  the notification and lock schedules), the task summary per window (game
  scripts are loaded on demand on pages without them) and the labels in the
  app's language. Native (`HomeWidgets.java`) picks the next prayer and the
  current window by the clock; past the snapshot (app not opened for a week,
  or the clock moved outside it) the widgets say "open the app".
- **No seconds, no app work per minute:** countdowns are `Chronometer`s the
  launcher ticks; a format precision cuts their "H:MM:SS" to "H:MM" (`%.4s`)
  or to the minutes box's "MM" (`%.2s`). The hour part is fixed per render, so
  one **non-wakeup** (`RTC`) alarm re-renders at the next boundary: a prayer
  time, a window's tasks opening, midnight, the countdowns' hour boundaries,
  and every 15 min for the countdown card's progress bar. That is roughly
  12 renders/day for the next-prayer, times and adhkar widgets and ~24 more
  for the hour boundaries; the countdown card adds up to 96 progress steps,
  delivered only while the phone is awake. No wakeups, no service,
  `updatePeriodMillis="0"`, nothing armed while no widget is placed; all
  rendering runs on one background thread, bursts are coalesced and the parsed
  snapshot is cached. Re-rendered on boot, time / timezone / locale changes.
- **Moving / resizing costs nothing:** launchers send a burst of "options
  changed" broadcasts while a widget is dragged. On Android 12+ every widget
  carries one layout per size (a `RemoteViews` size map), so the launcher
  switches layouts itself and the app ignores those broadcasts; below 12 only
  the resized widget is re-rendered, after the drag settles, and only if its
  layout changes. (The first version re-rendered every widget on each of
  them, which could loop with the launcher and end in "isn't responding".)
- **Look:** the app's colours (`res/values*/widget_colors.xml`), light/dark
  from the phone (`values-night`), the app's theme picks the background
  (Classic vs Midnight Emerald), RTL from the app language, prayer names in
  Amiri (`res/font/amiri_bold.ttf`, OFL, from `core/assets/fonts`) for ar/ur.
  Picker names/descriptions in all 11 languages (`res/values-*/widget_strings.xml`).
- **Known limit:** the countdown digits come from the phone's locale
  (Chronometer); the static times follow the app's digit setting.

## Android back

`web/adapter.js` owns the hardware back / back gesture: first the page's own
screens (`game.js` `__ptBack`: reader, tabs, profile, dialog — hash routes;
`popup.js` `__ptPopupBack`: Settings), then the page's parent page
(`PARENT_PAGE`: Tools -> game), and only on the game's home screen
`App.minimizeApp()`. The WebView's own `canGoBack` is not used — on device it
reports `false` after an in-app page change.

## Google sign-in (`GoogleAuth`, Java)

`GoogleAuthPlugin` uses Android Credential Manager ("Sign in with Google").
The OAuth **web** client id comes from the game server (`/v1/auth/config`,
`GOOGLE_WEB_CLIENT_ID` in the backend `.env`), so nothing is baked into the app;
the server verifies the ID token's audience. For it to work, the Google Cloud
project needs Android OAuth clients for `com.mphpmaster.prayer` with the SHA-1
of the Play app-signing key and the upload key (and `com.mphpmaster.prayer.debug`
with the debug key for debug builds).
