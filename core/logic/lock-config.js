// lock-config.js — pure: build the overlay-lock config from settings. Shared by
// every shell so the lock renders identically (extension tab lock, Tauri lock
// window, Android LockActivity). No chrome.*, no I/O.
//
// Uses tr / usesArabicDigits / normalizeTheme / clampLockMinutes /
// DEFAULT_LOCK_MINUTES from i18n.js (loaded first).

const TEST_LOCK_SECONDS = 5;

// settings: { lang, theme, arabicDigits, lockMinutes, allowUnlock, silentDuringPrayer }
// opts:     { test?, prayerName? }  — prayerName is the already-localized name.
function buildLockConfig(settings, opts) {
  opts = opts || {};
  const test = opts.test === true;
  const lang = settings.lang || "en";
  const L = tr(lang);
  const prayerName = opts.prayerName != null ? opts.prayerName : (test ? L.testLockPrayer : "");

  const minutes = clampLockMinutes(
    settings.lockMinutes != null ? settings.lockMinutes : DEFAULT_LOCK_MINUTES
  );
  // The test lock is short (just to preview), but the adhan needs time to be
  // heard — a 5s test cuts it off before you hear anything. Give the adhan test
  // 30s (tap the lock to stop it sooner when manual unlock is allowed).
  const testSecs = settings.prayerSound === "adhan" ? 30 : TEST_LOCK_SECONDS;
  const durationMs = test ? testSecs * 1000 : minutes * 60 * 1000;

  return {
    type: "ACTIVATE_LOCK",
    test,
    prayerName,
    title: L.lockTitle(prayerName),
    subtitle: L.lockSubtitle,
    countdownPrefix: L.lockCountdown,
    unlockLabel: L.unlockTab,
    unlockHint: L.lockTapHint,
    dir: L.dir,
    lang,
    arabicDigits: usesArabicDigits(lang, settings.arabicDigits !== false),
    allowUnlock: settings.allowUnlock === true,
    // Silence the device (OS DND on mobile, audio mute on desktop) for the lock
    // duration. Defaults on; the browser extension ignores it (no capability).
    silent: settings.silentDuringPrayer !== false,
    // Sound to play when prayer time arrives: "beep" (synth chime), "adhan"
    // (bundled audio), or "none". The test lock previews it too, so the user can
    // hear their choice (the test allows manual unlock to stop it early).
    sound: settings.prayerSound || "beep",
    theme: normalizeTheme(settings.theme),
    // Shared unlock moment (absolute) for the countdown, plus a duration the
    // native side uses for its own auto-unlock fallback timer.
    unlockAt: Date.now() + durationMs,
    durationSecs: Math.round(durationMs / 1000),
  };
}
