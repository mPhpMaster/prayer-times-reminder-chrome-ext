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
npx cap init "Prayer" "com.mphpmaster.prayer" --web-dir=www   # capacitor.config.json is pre-written
npx cap add android
npx cap copy
npx cap open android        # build/run from Android Studio
```

`ANDROID_HOME` is currently unset — point it at `~/AppData/Local/Android/Sdk`.
Build from **PowerShell**, not Git Bash (Gradle workers can't open loopback
sockets there):

```powershell
# debug
node ../../tools/sync-core.mjs mobile; npx cap copy android
cd android; $env:ANDROID_HOME="$env:USERPROFILE\AppData\Local\Android\Sdk"
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
scheduleDhikr, ensureOverlayPermission, ensureBatteryExemption }`. Dhikr is
deliberately NOT a notification (no sound, no shade entry): `DhikrScheduler`
arms one-shot exact `AlarmManager` alarms from the stored settings
(`CapacitorStorage` prefs, so no separate sync channel), each fire shows the
silent click-through `DhikrOverlay` (`TYPE_APPLICATION_OVERLAY` WebView loading
`dhikr.html` → shared `overlay-tasbih.js`), then re-arms (random mode needs a
fresh gap each time). Skips quietly when the screen is off; `BootReceiver`
re-arms after reboot; requires the "display over other apps" grant
(`ensureOverlayPermission`, asked once). The plugin lives under
`android/app/src/main/java/com/mphpmaster/prayer/` and provides:

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
- ✅ Lock teardown is symmetric: manual unlock (X), countdown expiry
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
