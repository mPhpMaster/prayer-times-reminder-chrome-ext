// ---- Events -----------------------------------------------------------------

el.openSettingsBtn.addEventListener("click", () => {
  showSettingsView();
});

// Desktop: open the Chrome Web Store listing for the companion extension.
el.extInstallBtn.addEventListener("click", () => {
  if (Platform.browserExt) Platform.browserExt.install();
});

// Desktop: toggle launch-on-Windows-startup; revert the checkbox if it fails.
el.startupToggle.addEventListener("change", async () => {
  if (!Platform.autostart) return;
  const res = await Platform.autostart.set(el.startupToggle.checked);
  if (!res || res.ok !== true) el.startupToggle.checked = !el.startupToggle.checked;
});

el.headerSettingsBtn.addEventListener("click", () => {
  showSettingsView();
});

el.backBtn.addEventListener("click", () => {
  showMainView();
});

// "About the app" opens the standalone about page. In the browser extension the
// popup is a transient window, so the anchor's target=_blank opens a new tab; on
// the desktop/mobile shells (full windows) we navigate to it in place instead.
el.aboutLink.addEventListener("click", (e) => {
  if (Platform.name === "chrome") return; // let the anchor open a new tab
  e.preventDefault();
  window.location.href = "about.html";
});

// Game entry — only where the shell provides speech (Android, Chrome). The
// phase 0 voice spike is a developer page (its Whisper model isn't bundled),
// so it shows in the debug build only. The extension popup is too small and
// transient for the game (and can't ask for the microphone), so there it
// opens in its own tab, like "About".
if (Platform.speech) {
  document.getElementById("game-link").hidden = false;
  if (Platform.name === "chrome") {
    document.getElementById("game-link").target = "_blank";
    document.getElementById("game-link").rel = "noopener";
  } else if (Platform.game) {
    // Desktop: the popup is a small flyout, so the game gets its own window.
    document.getElementById("game-link").addEventListener("click", (e) => {
      e.preventDefault();
      Platform.game.open();
    });
  }
  if (Platform.devBuild) {
    Platform.devBuild().then((dev) => {
      if (dev) document.getElementById("game-spike-link").hidden = false;
    });
  }
}

el.langSelect.addEventListener("change", () => {
  if (el.langSelect.value) setLanguage(el.langSelect.value);
});

el.settingsLangSelect.addEventListener("change", () => {
  if (el.settingsLangSelect.value) setLanguage(el.settingsLangSelect.value);
});

el.country.addEventListener("change", () => {
  showError("");
  loadCities();
});

// In Arabic mode, fetch the Arabic label for just the city the user picks
// (on demand — no bulk crawl). Cached lookups make repeat selections free.
el.city.addEventListener("change", () => {
  if (lang === "ar" && el.city.value) {
    fetchCityArabicName(el.city.value, el.country.value).then(() =>
      refreshCityOptionLabels(el.country.value)
    );
  }
});

el.dateFormat.addEventListener("change", async () => {
  dateFormat = el.dateFormat.value || DEFAULT_DATE_FORMAT;
  await Platform.store.set({ dateFormat });
  renderDates();
  showError("");
});

document.querySelectorAll('input[name="theme"]').forEach((input) => {
  input.addEventListener("change", async () => {
    if (!input.checked) return;
    applyTheme(input.value);
    await Platform.store.set({ theme: uiTheme });
  });
});

// Validate the chosen country/city, persist the location, and load its timings.
// Shared by the Save button and the welcome wizard's Finish step.
async function commitLocation() {
  const country = el.country.value;
  const city = el.city.value;
  const method = Number(el.method.value);

  if (!country || !city) {
    showError(T().errFields);
    return { ok: false, reason: "fields" };
  }

  const location = { mode: "city", city, country, method };
  // Geocode the city to coordinates so the offline engine can compute times
  // without the API. If geocoding fails, the location is stored without coords
  // and loadTimings() transparently falls back to Aladhan.
  const coords = await geocodeCity(city, country);
  if (coords) {
    location.latitude = coords.latitude;
    location.longitude = coords.longitude;
  }
  await Platform.store.set({ location });
  el.locationLabel.textContent = labelFor(location);
  ensureLocationCityArabic(location);
  await loadTimings(location);
  return { ok: true };
}

// Resolve a city/country to coordinates via Nominatim (also used for Arabic
// labels). Returns null on any failure so callers can fall back to the API.
async function geocodeCity(city, country) {
  try {
    const params = new URLSearchParams({ city, country, format: "json", limit: "1" });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { "Accept-Language": "en" }
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data[0]) return null;
    return { latitude: Number(data[0].lat), longitude: Number(data[0].lon) };
  } catch {
    return null;
  }
}

el.saveBtn.addEventListener("click", async () => {
  const result = await commitLocation();
  if (result.ok) showMainView();
});

el.geoBtn.addEventListener("click", async () => {
  showError("");
  el.geoBtn.disabled = true;
  el.geoBtn.textContent = T().locating;
  try {
    const coords = await Platform.geo.current({
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 600000
    });
    const location = {
      mode: "coords",
      latitude: coords.latitude,
      longitude: coords.longitude,
      method: Number(el.method.value)
    };
    await Platform.store.set({ location });
    el.locationLabel.textContent = labelFor(location);
    el.geoBtn.disabled = false;
    el.geoBtn.textContent = T().useLocation;
    await loadTimings(location);
    showMainView();
  } catch (err) {
    el.geoBtn.disabled = false;
    el.geoBtn.textContent = T().useLocation;
    if (err && err.message === "no-geolocation") showError(T().errNoGeo);
    else showError(T().errGeoFail(err && err.message));
  }
});

el.tabLock.addEventListener("change", async () => {
  // Turning the lock ON needs host access to inject the overlay into open tabs.
  // Request it here, inside the change gesture (chrome.permissions.request
  // requires a user gesture); on other platforms this resolves true instantly.
  if (el.tabLock.checked && Platform.permissions) {
    const granted = await Platform.permissions.ensureLockAccess();
    if (!granted) {
      el.tabLock.checked = false;
      updateLockOptionsVisibility();
      showError(T().tabLockPermDenied);
      return;
    }
  }
  await Platform.store.set({ tabLockEnabled: el.tabLock.checked });
  updateLockOptionsVisibility();
  showError("");
});

el.lockMinutes.addEventListener("change", async () => {
  const minutes = clampLockMinutes(el.lockMinutes.value);
  el.lockMinutes.value = String(minutes);
  await Platform.store.set({ lockMinutes: minutes });
  showError("");
});

el.allowUnlock.addEventListener("change", async () => {
  await Platform.store.set({ allowUnlock: el.allowUnlock.checked });
  showError("");
});

el.silentPrayer.addEventListener("change", async () => {
  await Platform.store.set({ silentDuringPrayer: el.silentPrayer.checked });
  showError("");
});

el.prayerSound.addEventListener("change", async () => {
  await Platform.store.set({ prayerSound: el.prayerSound.value });
  showError("");
});

async function setArabicDigits(useArabic) {
  arabicDigits = useArabic;
  el.digitsArabic.checked = useArabic;
  el.digitsWestern.checked = !useArabic;
  await Platform.store.set({ arabicDigits: useArabic });
  if (currentTimings) renderTimings(currentTimings);
  renderDates();
  Platform.store.get("location").then(({ location }) => {
    el.locationLabel.textContent = labelFor(location);
  });
}

el.digitsArabic.addEventListener("change", () => {
  if (el.digitsArabic.checked) setArabicDigits(true);
});

el.digitsWestern.addEventListener("change", () => {
  if (el.digitsWestern.checked) setArabicDigits(false);
});

el.testLockBtn.addEventListener("click", async () => {
  showError("");
  // Ensure host access first (may prompt on the extension); the click is the
  // user gesture chrome.permissions.request needs.
  if (Platform.permissions) {
    const granted = await Platform.permissions.ensureLockAccess();
    if (!granted) { showError(T().tabLockPermDenied); return; }
  }
  el.testLockBtn.disabled = true;
  // The test lock auto-unlocks after TEST_LOCK_SECONDS (5s) — or 30s for the
  // adhan preview, since buildLockConfig extends it so the adhan is actually
  // audible (see lock-config.js) — or the user taps it to unlock early.
  // Re-enable the button as soon as the user is back here after the lock took
  // over (mobile/desktop: the lock covered this page, so hidden/blur -> visible/
  // focus means it's gone, even if unlocked early), or right away if the test
  // failed to start, with a flat timer
  // over the lock's lifetime as the fallback, so it can never get stuck.
  const testSecs = el.prayerSound.value === "adhan" ? 30 : TEST_LOCK_SECONDS;
  let leftPage = false;
  const onLeave = () => { if (document.visibilityState === "hidden" || !document.hasFocus()) leftPage = true; };
  const onBack = () => { if (leftPage && document.visibilityState === "visible") reenable(); };
  const reenable = () => {
    el.testLockBtn.disabled = false;
    clearTimeout(fallback);
    document.removeEventListener("visibilitychange", onLeave);
    document.removeEventListener("visibilitychange", onBack);
    window.removeEventListener("blur", onLeave);
    window.removeEventListener("focus", onBack);
  };
  const fallback = setTimeout(reenable, testSecs * 1000);
  document.addEventListener("visibilitychange", onLeave);
  document.addEventListener("visibilitychange", onBack);
  window.addEventListener("blur", onLeave);
  window.addEventListener("focus", onBack);
  try {
    const result = await Platform.enforce.test({
      allowUnlock: el.allowUnlock.checked
    });
    if (!result?.ok) {
      showError(T().errLockTab);
      reenable();
    }
  } catch {
    showError(T().errLockTab);
    reenable();
  }
});

el.tasbihEnabled.addEventListener("change", async () => {
  await saveTasbihSettings();
  updateTasbihOptionsVisibility();
  showError("");
});

el.tasbihModeFixed.addEventListener("change", async () => {
  if (!el.tasbihModeFixed.checked) return;
  await saveTasbihSettings();
  updateTasbihOptionsVisibility();
  showError("");
});

el.tasbihModeRandom.addEventListener("change", async () => {
  if (!el.tasbihModeRandom.checked) return;
  await saveTasbihSettings();
  updateTasbihOptionsVisibility();
  showError("");
});

for (const input of [el.tasbihMinutes, el.tasbihRandomMin, el.tasbihRandomMax]) {
  input.addEventListener("change", async () => {
    if (input === el.tasbihMinutes) {
      el.tasbihMinutes.value = String(clampTasbihMinutes(el.tasbihMinutes.value, DEFAULT_TASBIH_MINUTES));
    }
    await saveTasbihSettings();
    showError("");
  });
}


el.testTasbihBtn.addEventListener("click", async () => {
  showError("");
  el.testTasbihBtn.disabled = true;
  // The test card lives ~2s then auto-hides (or the user taps it to dismiss).
  // Re-enable the button in step with that — a flat 2s timer, decoupled from
  // the platform call, so the button can never get stuck greyed out.
  setTimeout(() => { el.testTasbihBtn.disabled = false; }, 2000);
  try {
    const result = await Platform.dhikr.test();
    if (!result?.ok) {
      showError(T().errTasbihTab);
    }
  } catch {
    showError(T().errTasbihTab);
  }
});
