// lock-config.js — pure: build the overlay-lock config from settings. Shared by
// every shell so the lock renders identically (extension tab lock, Tauri lock
// window, Android LockActivity). No chrome.*, no I/O.
//
// Uses tr / usesArabicDigits / normalizeTheme / clampLockMinutes /
// DEFAULT_LOCK_MINUTES from i18n.js (loaded first).

const TEST_LOCK_SECONDS = 5;

// settings: { lang, theme, arabicDigits, lockMinutes, allowUnlock }
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
  const durationMs = test ? TEST_LOCK_SECONDS * 1000 : minutes * 60 * 1000;

  return {
    type: "ACTIVATE_LOCK",
    test,
    prayerName,
    title: L.lockTitle(prayerName),
    subtitle: L.lockSubtitle,
    countdownPrefix: L.lockCountdown,
    unlockLabel: L.unlockTab,
    dir: L.dir,
    lang,
    arabicDigits: usesArabicDigits(lang, settings.arabicDigits !== false),
    allowUnlock: settings.allowUnlock === true,
    theme: normalizeTheme(settings.theme),
    // Shared unlock moment (absolute) for the countdown, plus a duration the
    // native side uses for its own auto-unlock fallback timer.
    unlockAt: Date.now() + durationMs,
    durationSecs: Math.round(durationMs / 1000),
  };
}
