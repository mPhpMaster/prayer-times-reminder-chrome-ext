# Mobile target (Android / Capacitor)

Shares `core/` via `tools/sync-core.mjs mobile`, which assembles the web layer
into `www/`. `web/index.html` redirects to the shared `popup.html`; the web ⇄
native bridge is `web/adapter.js` (`Platform` over Capacitor plugins +
`Capacitor.Plugins.PrayerLock`).

## First-time setup / build

```
# from targets/mobile  (Android Studio + JDK 17 + SDK already present)
npm init -y
npm i @capacitor/core @capacitor/cli @capacitor/android \
      @capacitor/preferences @capacitor/local-notifications @capacitor/geolocation @capacitor/app
node ../../tools/sync-core.mjs mobile     # fills www/
npx cap init "Prayer" "com.example.prayer" --web-dir=www   # capacitor.config.json is pre-written
npx cap add android
npx cap copy
npx cap open android        # build/run from Android Studio
```

`ANDROID_HOME` is currently unset — point it at `~/AppData/Local/Android/Sdk`.

## Native lock plugin — to write (`PrayerLock`, Kotlin)

The web adapter calls `Capacitor.Plugins.PrayerLock.{ start, clear, showDhikr }`.
Implement a Capacitor plugin under
`android/app/src/main/java/.../PrayerLockPlugin.kt` providing:

- **Lock**: high-importance notification with `setFullScreenIntent(...)`
  (`USE_FULL_SCREEN_INTENT`) launching a full-screen `Activity`
  (`FLAG_KEEP_SCREEN_ON`, `setShowWhenLocked`) that loads `overlay-lock.js`;
  a foreground `Service` keeps it alive; a `TYPE_APPLICATION_OVERLAY`
  (`SYSTEM_ALERT_WINDOW`) re-asserts if the user leaves.
- **Silent/DND**: `NotificationManager.setInterruptionFilter(INTERRUPTION_FILTER_NONE)`
  (`ACCESS_NOTIFICATION_POLICY`, user-granted).
- **Camera off (optional)**: `DeviceAdminReceiver` + `DevicePolicyManager.setCameraDisabled(true)`.

Scheduling uses `@capacitor/local-notifications` with a rolling ~7-day window
(5/day ≈ 35), topped up on each `App.resume`, computed from
`core/logic/scheduler-core.js` + the offline `prayer-engine`. Request
`SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM`, a high-importance channel, and a
battery-optimization exemption (Doze).

`AndroidManifest.xml` permissions: `SYSTEM_ALERT_WINDOW`, `FOREGROUND_SERVICE`,
`USE_FULL_SCREEN_INTENT`, `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM` /
`USE_EXACT_ALARM`, `ACCESS_NOTIFICATION_POLICY`, `BIND_DEVICE_ADMIN`.

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
- ⛔ **Not built here:** `gradlew assembleDebug` can't run in this sandbox (forked
  worker JVMs can't open a loopback socket). Builds fine on a normal machine.
- **TODO (native):** auto-fire the full-screen lock while the app is *closed* —
  needs a full-screen-intent notification or `AlarmManager` launching
  `LockActivity` from `PrayerLockPlugin` (currently the lock fires on
  notification tap / when the app is open). Plus runtime permission prompts
  (overlay, DND, exact alarm), a boot receiver to reschedule, and optional
  Device Admin camera-off.
