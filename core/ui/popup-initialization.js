// ---- Init -------------------------------------------------------------------

// Desktop-only: surface the companion Chrome extension (browser tab lock) and
// reflect whether it's already installed. Hidden entirely on the extension and
// mobile shells (they don't expose Platform.browserExt).
// Cross-promote the companion app, mirror-image per platform: the browser
// extension promotes the Windows app; the Windows app promotes the extension
// (plus its own startup toggle). Neither ever promotes itself.
const WINDOWS_APP_URL = ""; // set to the download/landing URL to show a CTA link

async function setupCrossPromo() {
  if (Platform.name === "chrome") {
    // Browser extension → promote the companion WINDOWS app.
    el.winGroup.hidden = false;
    if (WINDOWS_APP_URL) {
      el.winLink.href = WINDOWS_APP_URL;
      el.winLink.hidden = false;
    } else {
      el.winLink.hidden = true;
    }
    return;
  }
  if (Platform.name !== "tauri") return; // mobile: no cross-promo

  // Windows app → startup toggle + promote the companion CHROME extension.
  if (Platform.autostart) {
    el.startupGroup.hidden = false;
    try {
      el.startupToggle.checked = await Platform.autostart.get();
    } catch {
      el.startupToggle.checked = false;
    }
  }
  if (Platform.browserExt) {
    el.extGroup.hidden = false;
    try {
      const installed = await Platform.browserExt.installed();
      el.extInstalledNote.hidden = installed !== true;
      el.extInstallBtn.hidden = installed === true;
    } catch {
      el.extInstalledNote.hidden = true;
      el.extInstallBtn.hidden = false;
    }
  }
}

async function init() {
  // Let CSS adapt the layout per shell (browser popup vs. full desktop/mobile window).
  document.documentElement.dataset.platform = Platform.name || "chrome";

  const {
    location: savedLocation, cache, lang: savedLang, theme: savedTheme, tabLockEnabled, arabicDigits: savedDigits,
    lockMinutes, allowUnlock, silentDuringPrayer, prayerSound, dateFormat: savedDateFormat,
    tasbihEnabled, tasbihIntervalMode, tasbihIntervalMinutes,
    tasbihRandomMin, tasbihRandomMax, tasbihPosition: savedTasbihPosition
  } = await Platform.store.get([
    "location", "cache", "lang", "theme", "tabLockEnabled", "arabicDigits", "lockMinutes",
    "allowUnlock", "silentDuringPrayer", "prayerSound", "dateFormat", "tasbihEnabled", "tasbihIntervalMode",
    "tasbihIntervalMinutes", "tasbihRandomMin", "tasbihRandomMax", "tasbihPosition"
  ]);

  // Fresh run on a shell with no installer to seed defaults (desktop / mobile —
  // the extension does this in onInstalled): persist DEFAULT_SETTINGS so there's
  // a location + settings to work with immediately.
  let location = savedLocation;
  if (location === undefined) {
    await Platform.store.set(DEFAULT_SETTINGS);
    location = DEFAULT_SETTINGS.location;
  }

  lang = savedLang ?? DEFAULT_SETTINGS.lang;
  applyTheme(savedTheme ?? DEFAULT_SETTINGS.theme);
  arabicDigits = savedDigits !== undefined ? savedDigits : DEFAULT_SETTINGS.arabicDigits;
  dateFormat = savedDateFormat ?? DEFAULT_SETTINGS.dateFormat;
  el.tabLock.checked = tabLockEnabled !== undefined
    ? Boolean(tabLockEnabled)
    : DEFAULT_SETTINGS.tabLockEnabled;
  el.lockMinutes.value = String(clampLockMinutes(
    lockMinutes !== undefined ? lockMinutes : DEFAULT_SETTINGS.lockMinutes
  ));
  el.allowUnlock.checked = allowUnlock !== undefined
    ? Boolean(allowUnlock)
    : DEFAULT_SETTINGS.allowUnlock;
  el.silentPrayer.checked = silentDuringPrayer !== undefined
    ? Boolean(silentDuringPrayer)
    : DEFAULT_SETTINGS.silentDuringPrayer;
  el.prayerSound.value = ["beep", "adhan", "none"].includes(prayerSound)
    ? prayerSound
    : DEFAULT_SETTINGS.prayerSound;
  el.tasbihEnabled.checked = tasbihEnabled !== undefined
    ? Boolean(tasbihEnabled)
    : DEFAULT_SETTINGS.tasbihEnabled;
  const mode = tasbihIntervalMode ?? DEFAULT_SETTINGS.tasbihIntervalMode;
  el.tasbihModeFixed.checked = mode !== "random";
  el.tasbihModeRandom.checked = mode === "random";
  el.tasbihMinutes.value = String(clampTasbihMinutes(
    tasbihIntervalMinutes !== undefined ? tasbihIntervalMinutes : DEFAULT_SETTINGS.tasbihIntervalMinutes,
    DEFAULT_TASBIH_MINUTES
  ));
  el.tasbihRandomMin.value = String(clampTasbihMinutes(
    tasbihRandomMin !== undefined ? tasbihRandomMin : DEFAULT_SETTINGS.tasbihRandomMin,
    DEFAULT_TASBIH_RANDOM_MIN
  ));
  el.tasbihRandomMax.value = String(clampTasbihMinutes(
    tasbihRandomMax !== undefined ? tasbihRandomMax : DEFAULT_SETTINGS.tasbihRandomMax,
    DEFAULT_TASBIH_RANDOM_MAX
  ));
  tasbihPosition = normalizeTasbihPosition(
    savedTasbihPosition ?? DEFAULT_SETTINGS.tasbihPosition
  );
  el.digitsArabic.checked = arabicDigits;
  el.digitsWestern.checked = !arabicDigits;
  await loadCityLabelCaches();
  populateLangSelect();
  populateCountrySelect();
  populateMethodSelect();
  populateDateFormatSelect();
  renderTasbihPositionGrid();
  applyLanguage();
  await setupCrossPromo();

  if (location) {
    el.locationLabel.textContent = labelFor(location);
    el.method.value = String(location.method ?? DEFAULT_SETTINGS.location.method);
    if (location.mode !== "coords") {
      el.country.value = location.country || "";
      // Defer building the city list until the user opens Settings.
      pendingCityPreselect = location.city || null;
      ensureLocationCityArabic(location);
    }
  }

  // Instant render from cache if it's from today.
  if (cache && cache.timings) {
    const fetched = new Date(cache.fetchedAt);
    if (fetched.toDateString() === new Date().toDateString()) {
      currentDate = cache.date;
      currentTimezone = cache.timezone || null;
      renderTimings(cache.timings);
      renderDates();
    }
  }

  if (location) loadTimings(location);
}
