// ---- Data loading -----------------------------------------------------------

async function fetchAladhanTimings(location) {
  const res = await fetch(timingsUrl(location, apiDate(new Date())));
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const json = await res.json();
  if (json.code !== 200 || !json.data) throw new Error(T().errNotFound);
  return json.data; // { timings, date, meta }
}

async function loadTimings(location) {
  showError("");
  el.statusHint.hidden = false;
  el.statusHint.textContent = T().loading;
  try {
    // Offline engine when the location has coordinates (city mode geocodes on
    // save; GPS mode is coords). Legacy coord-less city locations use the API.
    const data =
      location.latitude != null && location.longitude != null
        ? PrayerEngine.timings(location)
        : await fetchAladhanTimings(location);
    currentDate = data.date;
    currentTimezone = data.meta?.timezone || null;
    renderTimings(data.timings);
    renderDates();
    await Platform.store.set({
      cache: { timings: data.timings, date: data.date, timezone: currentTimezone, fetchedAt: Date.now() }
    });
  } catch (err) {
    el.statusHint.hidden = true;
    showError(err.message || T().errGeneric);
  }
}

// ---- Views ------------------------------------------------------------------

function showMainView() {
  el.settingsView.hidden = true;
  el.mainView.hidden = false;
  showError("");
  countdownTimer?.refresh();
}

function showSettingsView() {
  el.mainView.hidden = true;
  el.settingsView.hidden = false;
  countdownTimer?.refresh();
  showError("");
  updateDigitsVisibility();
  maybeLoadCities();
}

// Build the (potentially large) city list only when Settings is actually shown,
// not on every popup open — keeps opening the popup to view times cheap.
async function maybeLoadCities() {
  if (!el.country.value || citiesLoadedForCountry === el.country.value) return;
  const preselect = pendingCityPreselect;
  pendingCityPreselect = null;
  await loadCities(preselect);
}

function updateDigitsVisibility() {
  el.digitsGroup.hidden = lang !== "ar" && lang !== "ur";
}

function populateLangSelect() {
  const current = lang;
  const selects = [el.langSelect, el.settingsLangSelect].filter(Boolean);
  for (const selectEl of selects) {
    selectEl.innerHTML = "";
    for (const entry of SUPPORTED_LANGS) {
      const o = document.createElement("option");
      o.value = entry.code;
      o.textContent = entry.name;
      selectEl.appendChild(o);
    }
    selectEl.value = SUPPORTED_LANGS.some((e) => e.code === current) ? current : "en";
  }
}

// ---- Language ---------------------------------------------------------------

function applyLanguage() {
  const t = T();
  document.documentElement.lang = lang;
  document.documentElement.dir = t.dir;

  el.appTitle.textContent = t.appTitle;
  el.langSelect.value = lang;
  el.settingsLangSelect.value = lang;
  el.nextLabel.textContent = t.nextPrayer;
  el.countdownHoursLabel.textContent = t.countdownHours;
  el.countdownMinLabel.textContent = t.countdownMin;
  el.countdownSecLabel.textContent = t.countdownSec;
  fillLegalLinks(t);
  el.openSettingsBtn.textContent = t.openSettings;
  el.settingsTitle.textContent = t.settingsTitle;
  el.labelCardTimes.textContent = t.settingsCardTimes;
  el.labelCardAlerts.textContent = t.settingsCardAlerts;
  el.labelCardTasbih.textContent = t.settingsCardTasbih;
  el.labelCardAppearance.textContent = t.settingsCardAppearance;
  el.backBtn.textContent = t.back;
  el.labelCountry.textContent = t.country;
  el.labelCity.textContent = t.city;
  el.labelMethod.textContent = t.method;
  el.labelDateFormat.textContent = t.dateFormatLabel;
  el.labelSettingsLang.textContent = t.settingsLangLabel;
  el.labelTheme.textContent = t.themeLabel;
  el.labelThemeClassic.textContent = t.themeClassic;
  el.labelThemeMidnight.textContent = t.themeMidnightEmerald;
  el.labelDigits.textContent = t.digitsLabel;
  el.labelDigitsArabic.textContent = t.digitsArabic;
  el.labelDigitsWestern.textContent = t.digitsWestern;
  el.saveBtn.textContent = t.save;
  el.geoBtn.textContent = t.useLocation;
  el.footerSource.textContent = t.dataSource;
  // On non-browser shells (desktop/mobile) the lock covers the whole screen, not
  // a browser tab — so use screen-lock wording there. Extension keeps "tab".
  const browserShell = Platform.name === "chrome";
  el.labelTabLock.textContent = browserShell ? t.tabLockLabel : t.screenLockLabel;
  el.hintTabLock.textContent = browserShell ? t.tabLockHint : t.screenLockHint;
  el.labelLockMinutes.textContent = t.lockMinutesLabel;
  el.labelAllowUnlock.textContent = t.allowUnlockLabel;
  el.hintAllowUnlock.textContent = t.allowUnlockHint;
  el.labelSilent.textContent = t.silentLabel;
  el.hintSilent.textContent = t.silentHint;
  // Silent = OS-level Do Not Disturb / audio mute. The browser extension can't
  // silence the device, so the option only appears on the desktop and mobile
  // shells (where the lock covers the whole screen).
  el.silentRow.hidden = browserShell;
  // Prayer-time announcement sound. Offered on every shell: desktop and mobile
  // play it from their lock window, and the extension plays it from an offscreen
  // document (a web page couldn't — no autoplay without a gesture).
  el.labelSound.textContent = t.soundLabel;
  el.hintSound.textContent = t.soundHint;
  el.optSoundBeep.textContent = t.soundBeep;
  el.optSoundAdhan.textContent = t.soundAdhan;
  el.optSoundNone.textContent = t.soundNone;
  el.testLockBtn.textContent = t.testLockBtn;
  el.labelTasbih.textContent = t.tasbihLabel;
  el.hintTasbih.textContent = t.tasbihHint;
  el.labelTasbihFixed.textContent = t.tasbihFixed;
  el.labelTasbihRandom.textContent = t.tasbihRandom;
  el.labelTasbihMinutes.textContent = t.tasbihMinutesLabel;
  el.labelTasbihRandomMin.textContent = t.tasbihMinLabel;
  el.labelTasbihRandomMax.textContent = t.tasbihMaxLabel;
  el.labelTasbihPosition.textContent = t.tasbihPositionLabel;
  el.testTasbihBtn.textContent = t.testTasbihBtn;
  el.labelExtSection.textContent = t.extSectionLabel;
  el.hintExt.textContent = t.extHint;
  el.extInstallBtn.textContent = t.extInstallBtn;
  el.extInstalledNote.textContent = t.extInstalledNote;
  el.labelWinSection.textContent = t.desktopPromoTitle;
  el.hintWin.textContent = t.desktopPromoSub;
  el.winLink.textContent = t.desktopPromoLink;
  el.labelStartup.textContent = t.startupLabel;
  el.hintStartup.textContent = t.startupHint;
  el.aboutLink.textContent = t.aboutBtn;
  document.getElementById("game-link").textContent = t.gameBtn;

  updateLockOptionsVisibility();
  updateTasbihOptionsVisibility();
  updateDigitsVisibility();

  populateLangSelect();
  // Relabel dropdown options for the new language (preserving selections).
  populateCountrySelect();
  populateMethodSelect();
  populateDateFormatSelect();
  renderTasbihPositionGrid();
  // Refresh the city placeholder text without refetching (skip if cities failed).
  if (!el.city.disabled && el.city.options.length && el.city.options[0].value === "") {
    el.city.options[0].textContent = t.selectCity;
  }
  if (el.country.value) {
    refreshCityOptionLabels(el.country.value);
    if (lang === "ar" && el.city.value) {
      fetchCityArabicName(el.city.value, el.country.value).then(() =>
        refreshCityOptionLabels(el.country.value)
      );
    }
  }

  // Re-render dynamic text.
  Platform.store.get("location").then(({ location }) => {
    el.locationLabel.textContent = labelFor(location);
    if (lang === "ar") ensureLocationCityArabic(location);
  });
  if (currentTimings) renderTimings(currentTimings);
  else el.statusHint.textContent = t.setLocationHint;
  renderDates();
}

async function setLanguage(next) {
  lang = next;
  await Platform.store.set({ lang });
  applyLanguage();
}
