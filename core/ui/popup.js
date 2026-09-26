// Prayer Times Reminder — popup logic
// (I18N, COUNTRIES, METHODS, tr() come from i18n.js, loaded first.)

// ALADHAN base URL + clampLockMinutes/clampTasbihMinutes/apiDate/timingsUrl come
// from i18n.js (loaded before this script).
const CITIES_API = "https://countriesnow.space/api/v0.1/countries/cities/q";

// Display order. Sunrise and Duha are informational (not prayers to notify for).
const ROWS = [
  { key: "Fajr", icon: "🌄" },
  { key: "Sunrise", icon: "🌅", sunrise: true, info: true },
  { key: "Duha", icon: "🌞", duha: true, info: true },
  { key: "Dhuhr", icon: "☀️" },
  { key: "Asr", icon: "🌤️" },
  { key: "Maghrib", icon: "🌇" },
  { key: "Isha", icon: "🌙" }
];
const PRAYER_KEYS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

// ---- DOM refs ---------------------------------------------------------------

const el = {
  mainView: document.getElementById("main-view"),
  settingsView: document.getElementById("settings-view"),
  appTitle: document.getElementById("app-title"),
  langSelect: document.getElementById("lang-select"),
  settingsLangSelect: document.getElementById("settings-lang-select"),
  labelSettingsLang: document.getElementById("label-settings-lang"),
  locationLabel: document.getElementById("location-label"),
  weekdayLine: document.getElementById("weekday-line"),
  hijriDate: document.getElementById("hijri-date"),
  headerSettingsBtn: document.getElementById("header-settings-btn"),
  timings: document.getElementById("timings"),
  statusHint: document.getElementById("status-hint"),
  nextPrayer: document.getElementById("next-prayer"),
  nextLabel: document.getElementById("next-label"),
  nextName: document.getElementById("next-name"),
  countdownBlocks: document.getElementById("countdown-blocks"),
  countdownHours: document.getElementById("countdown-hours"),
  countdownMin: document.getElementById("countdown-min"),
  countdownSec: document.getElementById("countdown-sec"),
  countdownHoursLabel: document.getElementById("countdown-hours-label"),
  countdownMinLabel: document.getElementById("countdown-min-label"),
  countdownSecLabel: document.getElementById("countdown-sec-label"),
  progressTrack: document.getElementById("progress-track"),
  nextProgress: document.getElementById("next-progress"),
  nextCountdown: document.getElementById("next-countdown"),
  openSettingsBtn: document.getElementById("open-settings-btn"),
  backBtn: document.getElementById("back-btn"),
  settingsTitle: document.getElementById("settings-title"),
  labelCountry: document.getElementById("label-country"),
  labelCity: document.getElementById("label-city"),
  labelMethod: document.getElementById("label-method"),
  digitsGroup: document.getElementById("digits-group"),
  labelDigits: document.getElementById("label-digits"),
  labelDigitsArabic: document.getElementById("label-digits-arabic"),
  labelDigitsWestern: document.getElementById("label-digits-western"),
  digitsArabic: document.getElementById("digits-arabic"),
  digitsWestern: document.getElementById("digits-western"),
  country: document.getElementById("country"),
  city: document.getElementById("city"),
  method: document.getElementById("method"),
  dateFormat: document.getElementById("date-format"),
  labelDateFormat: document.getElementById("label-date-format"),
  themeClassic: document.getElementById("theme-classic"),
  themeMidnight: document.getElementById("theme-midnight"),
  labelTheme: document.getElementById("label-theme"),
  labelThemeClassic: document.getElementById("label-theme-classic"),
  labelThemeMidnight: document.getElementById("label-theme-midnight"),
  saveBtn: document.getElementById("save-btn"),
  geoBtn: document.getElementById("geo-btn"),
  tabLock: document.getElementById("tab-lock"),
  lockOptions: document.getElementById("lock-options"),
  lockMinutes: document.getElementById("lock-minutes"),
  labelLockMinutes: document.getElementById("label-lock-minutes"),
  allowUnlock: document.getElementById("allow-unlock"),
  labelAllowUnlock: document.getElementById("label-allow-unlock"),
  hintAllowUnlock: document.getElementById("hint-allow-unlock"),
  silentRow: document.getElementById("silent-row"),
  silentPrayer: document.getElementById("silent-prayer"),
  labelSilent: document.getElementById("label-silent"),
  hintSilent: document.getElementById("hint-silent"),
  prayerSound: document.getElementById("prayer-sound"),
  labelSound: document.getElementById("label-sound"),
  hintSound: document.getElementById("hint-sound"),
  optSoundBeep: document.getElementById("opt-sound-beep"),
  optSoundAdhan: document.getElementById("opt-sound-adhan"),
  optSoundNone: document.getElementById("opt-sound-none"),
  labelTabLock: document.getElementById("label-tab-lock"),
  hintTabLock: document.getElementById("hint-tab-lock"),
  testLockBtn: document.getElementById("test-lock-btn"),
  tasbihEnabled: document.getElementById("tasbih-enabled"),
  tasbihOptions: document.getElementById("tasbih-options"),
  tasbihModeFixed: document.getElementById("tasbih-mode-fixed"),
  tasbihModeRandom: document.getElementById("tasbih-mode-random"),
  tasbihFixedOptions: document.getElementById("tasbih-fixed-options"),
  tasbihRandomOptions: document.getElementById("tasbih-random-options"),
  tasbihMinutes: document.getElementById("tasbih-minutes"),
  tasbihRandomMin: document.getElementById("tasbih-random-min"),
  tasbihRandomMax: document.getElementById("tasbih-random-max"),
  tasbihPosition: document.getElementById("tasbih-position"),
  labelTasbih: document.getElementById("label-tasbih"),
  hintTasbih: document.getElementById("hint-tasbih"),
  labelTasbihFixed: document.getElementById("label-tasbih-fixed"),
  labelTasbihRandom: document.getElementById("label-tasbih-random"),
  labelTasbihMinutes: document.getElementById("label-tasbih-minutes"),
  labelTasbihRandomMin: document.getElementById("label-tasbih-random-min"),
  labelTasbihRandomMax: document.getElementById("label-tasbih-random-max"),
  labelTasbihPosition: document.getElementById("label-tasbih-position"),
  testTasbihBtn: document.getElementById("test-tasbih-btn"),
  error: document.getElementById("error"),
  settingsBody: document.getElementById("settings-body"),
  gregorianDate: document.getElementById("gregorian-date"),
  footerSource: document.getElementById("footer-source"),
  extGroup: document.getElementById("ext-group"),
  labelExtSection: document.getElementById("label-ext-section"),
  hintExt: document.getElementById("hint-ext"),
  extInstallBtn: document.getElementById("ext-install-btn"),
  extInstalledNote: document.getElementById("ext-installed-note"),
  winGroup: document.getElementById("win-group"),
  labelWinSection: document.getElementById("label-win-section"),
  hintWin: document.getElementById("hint-win"),
  winLink: document.getElementById("win-link"),
  startupGroup: document.getElementById("startup-group"),
  startupToggle: document.getElementById("startup-toggle"),
  labelStartup: document.getElementById("label-startup"),
  hintStartup: document.getElementById("hint-startup"),
  aboutLink: document.getElementById("about-link")
};

let lang = "ar";
let uiTheme = DEFAULT_THEME;
let arabicDigits = false;
let dateFormat = DEFAULT_DATE_FORMAT;
let tasbihPosition = DEFAULT_TASBIH_POSITION;
let countdownTimer = null;
let currentTimings = null;
let currentDate = null; // AlAdhan date object (gregorian + hijri) for re-rendering
let pendingCityPreselect = null; // saved city to preselect when the city list lazy-loads
let citiesLoadedForCountry = null; // country whose city list is currently built
let currentTimezone = null; // IANA tz from Aladhan meta, for correct instants

function T() { return tr(lang); }

// DEFAULT_LOCK_MINUTES / DEFAULT_TASBIH_* and the clamp/apiDate/timingsUrl
// helpers are shared from i18n.js (loaded before this script).

function updateLockOptionsVisibility() {
  el.lockOptions.hidden = !el.tabLock.checked;
}

function getTasbihIntervalMode() {
  return el.tasbihModeRandom.checked ? "random" : "fixed";
}

function updateTasbihOptionsVisibility() {
  const enabled = el.tasbihEnabled.checked;
  el.tasbihOptions.hidden = !enabled;
  if (!enabled) return;
  const isRandom = getTasbihIntervalMode() === "random";
  el.tasbihFixedOptions.hidden = isRandom;
  el.tasbihRandomOptions.hidden = !isRandom;
}

async function saveTasbihSettings() {
  let randomMin = clampTasbihMinutes(el.tasbihRandomMin.value, DEFAULT_TASBIH_RANDOM_MIN);
  let randomMax = clampTasbihMinutes(el.tasbihRandomMax.value, DEFAULT_TASBIH_RANDOM_MAX);
  if (randomMin > randomMax) {
    const tmp = randomMin;
    randomMin = randomMax;
    randomMax = tmp;
    el.tasbihRandomMin.value = String(randomMin);
    el.tasbihRandomMax.value = String(randomMax);
  }
  await Platform.store.set({
    tasbihEnabled: el.tasbihEnabled.checked,
    tasbihIntervalMode: getTasbihIntervalMode(),
    tasbihIntervalMinutes: clampTasbihMinutes(el.tasbihMinutes.value, DEFAULT_TASBIH_MINUTES),
    tasbihRandomMin: randomMin,
    tasbihRandomMax: randomMax,
    tasbihPosition: normalizeTasbihPosition(tasbihPosition)
  });
  tasbihPosition = normalizeTasbihPosition(tasbihPosition);
}

// Convert to Arabic-Indic digits when Arabic is active and the user chose that style.
function localizeNum(str) {
  if (lang === "hi") return toDevanagariDigits(str);
  if (!usesArabicDigits(lang, arabicDigits)) return str;
  return toArabicDigits(str);
}

// ---- Helpers ----------------------------------------------------------------

function showError(msg) {
  if (!msg) { el.error.hidden = true; el.error.textContent = ""; return; }
  el.error.hidden = false;
  el.error.textContent = msg;
}

function parseTimeToDate(timeStr, refDate = new Date()) {
  const m = String(timeStr).match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const d = new Date(refDate);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d;
}

// Absolute instant (ms) of a prayer's wall-clock time, interpreted in the
// location's timezone (from Aladhan meta) so countdowns/highlighting stay correct
// even when the device timezone differs from the chosen location's.
function prayerInstant(timeStr) {
  return prayerTimestamp(timeStr, new Date(), currentTimezone);
}

function fmtTime(timeStr) {
  const m = String(timeStr).match(/(\d{1,2}):(\d{2})/);
  if (!m) return localizeNum(timeStr);
  const hh = Number(m[1]);
  const mm = m[2];
  let h12 = hh % 12;
  if (h12 === 0) h12 = 12;
  if (lang === "ar" || lang === "ur") {
    const suffix = hh < 12 ? "ص" : "م";
    return `${localizeNum(`${h12}:${mm}`)} ${suffix}`;
  }
  const ampm = hh < 12 ? "AM" : "PM";
  return localizeNum(`${h12}:${mm} ${ampm}`);
}

function countryLabel(enName) {
  const c = COUNTRIES.find((x) => x.en === enName);
  return c ? itemLabel(c, lang) : enName;
}

// ---- Arabic city labels (Nominatim + local cache) ---------------------------

const cityLabelCache = {};

// Load cached Arabic city labels into memory WITHOUT scanning all of storage on
// every popup open (get(null) would also deserialize the big `cities:<country>`
// arrays). We keep a small `cityLabelsIndex` of countries that have labels and
// read only those keys; a one-time migration builds the index for older installs.
async function loadCityLabelCaches() {
  const { cityLabelsIndex } = await Platform.store.get("cityLabelsIndex");
  if (!Array.isArray(cityLabelsIndex)) {
    const all = await Platform.store.get(null);
    const countries = [];
    for (const [key, value] of Object.entries(all)) {
      if (key.startsWith("cityLabels:") && value && typeof value === "object") {
        const country = key.slice("cityLabels:".length);
        cityLabelCache[country] = value;
        countries.push(country);
      }
    }
    await Platform.store.set({ cityLabelsIndex: countries });
    return;
  }
  if (!cityLabelsIndex.length) return;
  const stored = await Platform.store.get(cityLabelsIndex.map((c) => `cityLabels:${c}`));
  for (const country of cityLabelsIndex) {
    const value = stored[`cityLabels:${country}`];
    if (value && typeof value === "object") cityLabelCache[country] = value;
  }
}

function cityLabel(cityEn, countryEn) {
  if (lang !== "ar" || !cityEn) return cityEn;
  // Accurate cached (geocoded) name wins; otherwise a temporary transliteration
  // so the list reads in Arabic instead of English.
  return cityLabelCache[countryEn]?.[cityEn] || transliterateCityToArabic(cityEn);
}

async function fetchCityArabicName(city, country) {
  if (!city || !country) return city;
  if (cityLabelCache[country]?.[city]) return cityLabelCache[country][city];

  try {
    const params = new URLSearchParams({ city, country, format: "json", limit: "1" });
    // The browser forbids setting User-Agent from fetch, so we don't try;
    // Accept-Language steers Nominatim toward the Arabic name.
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { "Accept-Language": "ar" }
    });
    if (!res.ok) return city;
    const data = await res.json();
    const arName = data[0]?.name || city;
    const isNewCountry = !cityLabelCache[country];
    if (!cityLabelCache[country]) cityLabelCache[country] = {};
    cityLabelCache[country][city] = arName;
    const cacheKey = `cityLabels:${country}`;
    const stored = { ...((await Platform.store.get(cacheKey))[cacheKey]), [city]: arName };
    const writes = { [cacheKey]: stored };
    if (isNewCountry) {
      const { cityLabelsIndex } = await Platform.store.get("cityLabelsIndex");
      const idx = Array.isArray(cityLabelsIndex) ? cityLabelsIndex : [];
      if (!idx.includes(country)) writes.cityLabelsIndex = [...idx, country];
    }
    await Platform.store.set(writes);
    return arName;
  } catch {
    return city;
  }
}

function refreshCityOptionLabels(country) {
  for (const opt of el.city.options) {
    if (!opt.value) continue;
    opt.textContent = cityLabel(opt.value, country);
  }
}

async function ensureLocationCityArabic(location) {
  if (!location || location.mode !== "city" || lang !== "ar") return;
  await fetchCityArabicName(location.city, location.country);
  el.locationLabel.textContent = labelFor(location);
  if (el.country.value === location.country) refreshCityOptionLabels(location.country);
}

// ---- Select population ------------------------------------------------------

function placeholderOption(text) {
  const o = document.createElement("option");
  o.value = "";
  o.textContent = text;
  return o;
}

function populateCountrySelect() {
  const current = el.country.value;
  el.country.innerHTML = "";
  el.country.appendChild(placeholderOption(T().selectCountry));
  // Sort by the label shown in the active language.
  const sorted = [...COUNTRIES].sort((a, b) =>
    itemLabel(a, lang).localeCompare(itemLabel(b, lang), T().locale || lang)
  );
  for (const c of sorted) {
    const o = document.createElement("option");
    o.value = c.en;
    o.textContent = itemLabel(c, lang);
    el.country.appendChild(o);
  }
  el.country.value = current;
}

function populateMethodSelect() {
  const current = el.method.value;
  el.method.innerHTML = "";
  for (const m of METHODS) {
    const o = document.createElement("option");
    o.value = m.value;
    o.textContent = itemLabel(m, lang);
    el.method.appendChild(o);
  }
  if (current) el.method.value = current;
}

function populateDateFormatSelect() {
  const current = el.dateFormat.value || dateFormat;
  el.dateFormat.innerHTML = "";
  for (const f of DATE_FORMATS) {
    const o = document.createElement("option");
    o.value = f.value;
    o.textContent = itemLabel(f, lang);
    el.dateFormat.appendChild(o);
  }
  el.dateFormat.value = DATE_FORMATS.some((f) => f.value === current)
    ? current
    : DEFAULT_DATE_FORMAT;
}

// Visual order of the 3x2 picker (physical screen layout), independent of the
// TASBIH_POSITIONS array order so each tile sits in its real screen corner.
const POSITION_GRID_ORDER = [
  "top-left", "top-center", "top-right",
  "bottom-left", "bottom-center", "bottom-right"
];

function renderTasbihPositionGrid() {
  const current = normalizeTasbihPosition(tasbihPosition);
  const byKey = new Map(TASBIH_POSITIONS.map((p) => [p.key, p]));
  el.tasbihPosition.replaceChildren();
  for (const key of POSITION_GRID_ORDER) {
    const p = byKey.get(key);
    if (!p) continue;
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "pos-tile";
    tile.dataset.pos = key;
    tile.setAttribute("role", "radio");
    const selected = key === current;
    tile.setAttribute("aria-checked", selected ? "true" : "false");
    tile.tabIndex = selected ? 0 : -1;
    const label = itemLabel(p, lang);
    tile.setAttribute("aria-label", label);
    tile.title = label;
    const dot = document.createElement("span");
    dot.className = "pos-dot";
    tile.appendChild(dot);
    tile.addEventListener("click", () => selectTasbihPosition(key));
    el.tasbihPosition.appendChild(tile);
  }
  tasbihPosition = current;
}

async function selectTasbihPosition(key) {
  tasbihPosition = normalizeTasbihPosition(key);
  for (const tile of el.tasbihPosition.querySelectorAll(".pos-tile")) {
    const on = tile.dataset.pos === tasbihPosition;
    tile.setAttribute("aria-checked", on ? "true" : "false");
    tile.tabIndex = on ? 0 : -1;
  }
  await saveTasbihSettings();
  showError("");
}

function gregorianParts(gregorian) {
  if (!gregorian?.date) return null;
  const [dd, mm, yy] = String(gregorian.date).split("-").map(Number);
  if (!dd || !mm || !yy) return null;
  return { dd, mm, yy };
}

function formatDateDisplay(parts, formatId, monthLong) {
  const d = pad(Number(parts.dd));
  const m = pad(Number(parts.mm));
  const y = String(parts.yy);

  switch (formatId) {
    case "dd-mm-yyyy":
      return `${d}-${m}-${y}`;
    case "dd/MM/yyyy":
      return `${d}/${m}/${y}`;
    case "dd-MMMM-yyyy":
      return `${d} ${monthLong} ${y}`;
    case "MMMM-dd-yyyy":
      return `${monthLong}-${d}-${y}`;
    case "dd-mmMMMM-yyyy":
      return `${d}-${m} ${monthLong}-${y}`;
    case "dd-MMMM-yyyy":
    default:
      // Clean readable "10 April 2026".
      return `${d} ${monthLong} ${y}`;
  }
}

function formatGregorianDate(parts, formatId) {
  if (!parts) return "";
  if (formatId === "readable") return null;

  const locale = T().locale || (lang === "ar" ? "ar" : "en");
  const monthLong = new Date(parts.yy, parts.mm - 1, parts.dd)
    .toLocaleDateString(locale, { month: "long" });
  return formatDateDisplay(parts, formatId, monthLong);
}

function hijriParts(hijri) {
  if (!hijri?.day || !hijri?.month || !hijri?.year) return null;
  const mm = Number(hijri.month.number);
  const dd = Number(hijri.day);
  const yy = Number(hijri.year);
  if (!dd || !mm || !yy) return null;
  return { dd, mm, yy };
}

function formatHijriDate(hijri, formatId) {
  const parts = hijriParts(hijri);
  if (!parts) return "";

  const monthLong = lang === "ar" ? hijri.month.ar : hijri.month.en;
  if (formatId === "readable") {
    const desig = lang === "ar" ? T().ahLabel : (hijri.designation?.abbreviated || "AH");
    return `${hijri.day} ${monthLong} ${hijri.year} ${desig}`;
  }

  return formatDateDisplay(parts, formatId, monthLong);
}

async function getCities(country) {
  const key = `cities:${country}`;
  const cached = (await Platform.store.get(key))[key];
  if (Array.isArray(cached) && cached.length) return cached;
  try {
    const res = await fetch(`${CITIES_API}?country=${encodeURIComponent(country)}`);
    const json = await res.json();
    if (json.error || !Array.isArray(json.data) || !json.data.length) return null;
    const cities = [...new Set(json.data)].sort((a, b) => a.localeCompare(b));
    await Platform.store.set({ [key]: cities });
    return cities;
  } catch {
    return null;
  }
}

// Loads the city dropdown for the chosen country; optionally pre-selects one.
async function loadCities(preselect) {
  const country = el.country.value;
  el.city.innerHTML = "";
  if (!country) {
    el.city.appendChild(placeholderOption(T().selectCity));
    el.city.disabled = true;
    citiesLoadedForCountry = null;
    return;
  }
  el.city.disabled = true;
  el.city.appendChild(placeholderOption(T().loadingCities));

  const cities = await getCities(country);
  el.city.innerHTML = "";

  if (!cities) {
    el.city.appendChild(placeholderOption(T().citiesFailed));
    el.city.disabled = true;
    citiesLoadedForCountry = null;
    showError(T().citiesFailed);
    return;
  }

  el.city.appendChild(placeholderOption(T().selectCity));
  const frag = document.createDocumentFragment();
  for (const c of cities) {
    const o = document.createElement("option");
    o.value = c;
    o.textContent = cityLabel(c, country);
    frag.appendChild(o);
  }
  el.city.appendChild(frag);
  el.city.disabled = false;
  citiesLoadedForCountry = country;
  if (preselect) el.city.value = preselect;
  if (lang === "ar" && preselect) {
    await fetchCityArabicName(preselect, country);
    refreshCityOptionLabels(country);
  }
}

// ---- Rendering --------------------------------------------------------------

function isMidnightEmeraldTheme() {
  return normalizeTheme(uiTheme) === DEFAULT_THEME;
}

function applyTheme(nextTheme) {
  uiTheme = normalizeTheme(nextTheme);
  document.documentElement.dataset.theme = uiTheme;
  el.themeClassic.checked = uiTheme === "classic";
  el.themeMidnight.checked = uiTheme === "midnight-emerald";
  if (currentTimings) startCountdown(currentTimings);
}

function findNextPrayer(timings) {
  const now = Date.now();
  for (const key of PRAYER_KEYS) {
    const t = prayerInstant(timings[key]);
    if (t && t > now) return { key, time: t };
  }
  return null;
}

function findPreviousPrayer(timings) {
  const now = Date.now();
  let prev = null;
  for (const row of ROWS) {
    const t = prayerInstant(timings[row.key]);
    if (t && t <= now) prev = { key: row.key, time: t };
  }
  return prev;
}

function prayerProgress(timings, next) {
  if (!next) return 0;
  const now = Date.now();
  const prev = findPreviousPrayer(timings);
  const start = prev ? prev.time : new Date().setHours(0, 0, 0, 0);
  const end = next.time;
  if (end <= start) return 0;
  return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
}

// Duha (forenoon) prayer isn't returned by the Aladhan API. Its time begins
// once the sun has risen a spear's length above the horizon — conventionally a
// short while after sunrise — so we derive it as Sunrise + this many minutes.
const DUHA_AFTER_SUNRISE_MINUTES = 20;

// Returns a copy of the timings with a computed Duha entry (Sunrise + offset).
// Idempotent and non-mutating, so it's safe to call on every render.
function withDuha(timings) {
  if (!timings || !timings.Sunrise || timings.Duha) return timings;
  const t = parseTimeToDate(timings.Sunrise);
  if (!t) return timings;
  t.setMinutes(t.getMinutes() + DUHA_AFTER_SUNRISE_MINUTES);
  return { ...timings, Duha: `${pad(t.getHours())}:${pad(t.getMinutes())}` };
}

function renderTimings(timings) {
  timings = withDuha(timings);
  currentTimings = timings;
  el.timings.innerHTML = "";
  const now = new Date();
  const next = findNextPrayer(timings);

  for (const row of ROWS) {
    const raw = timings[row.key];
    if (!raw) continue;
    const t = prayerInstant(raw);

    const li = document.createElement("li");
    li.classList.add("glass-card");
    if (row.sunrise) li.classList.add("sunrise");
    if (row.duha) li.classList.add("duha");
    if (next && next.key === row.key) li.classList.add("is-next");
    else if (t && t < now.getTime()) li.classList.add("is-past");

    const name = prayerLabel(T(), row.key);
    li.innerHTML =
      `<span class="prayer-name"><span class="icon">${row.icon}</span>${name}</span>` +
      `<span class="prayer-time">${fmtTime(raw)}</span>`;
    el.timings.appendChild(li);
  }

  el.statusHint.hidden = true;
  startCountdown(timings);
}

function startCountdown(timings) {
  if (countdownTimer) clearInterval(countdownTimer);

  function tick() {
    const next = findNextPrayer(timings);
    if (!next) {
      el.nextName.textContent = T().fajrTomorrow;
      el.countdownBlocks.hidden = true;
      el.progressTrack.hidden = true;
      el.nextCountdown.hidden = false;
      el.nextCountdown.classList.add("force-show");
      el.nextCountdown.textContent = T().allDone;
      el.nextPrayer.hidden = false;
      return;
    }
    const diff = next.time - Date.now();
    const h = Math.floor(diff / 3.6e6);
    const m = Math.floor((diff % 3.6e6) / 6e4);
    const s = Math.floor((diff % 6e4) / 1000);
    el.nextName.textContent = prayerLabel(T(), next.key);
    if (isMidnightEmeraldTheme()) {
      el.countdownHours.textContent = localizeNum(pad(h));
      el.countdownMin.textContent = localizeNum(pad(m));
      el.countdownSec.textContent = localizeNum(pad(s));
      el.countdownBlocks.hidden = false;
      el.progressTrack.hidden = false;
      el.nextCountdown.hidden = true;
      el.nextCountdown.classList.remove("force-show");
      el.nextProgress.style.width = `${prayerProgress(timings, next)}%`;
    } else {
      el.countdownBlocks.hidden = true;
      el.progressTrack.hidden = true;
      el.nextCountdown.hidden = false;
      el.nextCountdown.classList.add("force-show");
      el.nextCountdown.textContent = localizeNum(T().countdown(h, m, s));
    }
    el.nextPrayer.hidden = false;
    if (diff <= 0) renderTimings(timings);
  }

  tick();
  countdownTimer = setInterval(tick, 1000);
}

function labelFor(location) {
  if (!location) return T().noLocation;
  if (location.mode === "coords") {
    return localizeNum(`${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)}`);
  }
  return `${cityLabel(location.city, location.country)}, ${countryLabel(location.country)}`;
}

// The localized name of the current weekday (e.g. الجمعة / Friday / Freitag),
// tied to the displayed date when available and today otherwise.
function weekdayName() {
  const parts = gregorianParts(currentDate && currentDate.gregorian);
  const d = parts ? new Date(parts.yy, parts.mm - 1, parts.dd) : new Date();
  const locale = T().locale || (lang === "ar" ? "ar" : "en");
  return d.toLocaleDateString(locale, { weekday: "long" });
}

// Renders the Hijri line (with weekday) and the Gregorian line, both in the
// header, in the active language.
function renderDates() {
  el.weekdayLine.textContent = weekdayName();

  const h = currentDate && currentDate.hijri;
  const hijri = h ? localizeNum(formatHijriDate(h, dateFormat)) : "";
  // Add a Hijri era marker (هـ / AH) unless the "readable" format already has one.
  const era = (dateFormat !== "readable" && T().ahLabel) ? ` ${T().ahLabel}` : "";
  el.hijriDate.textContent = hijri ? `${hijri}${era}` : "";

  const g = currentDate && currentDate.gregorian;
  const parts = gregorianParts(g);
  if (parts) {
    const formatted = formatGregorianDate(parts, dateFormat);
    const text = formatted ?? currentDate.readable ?? g.date;
    el.gregorianDate.textContent = localizeNum(text);
  } else if (currentDate) {
    el.gregorianDate.textContent = localizeNum(currentDate.readable || (g && g.date) || "");
  } else {
    el.gregorianDate.textContent = "";
  }
}

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
}

function showSettingsView() {
  el.mainView.hidden = true;
  el.settingsView.hidden = false;
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
  el.openSettingsBtn.textContent = t.openSettings;
  el.settingsTitle.textContent = t.settingsTitle;
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

// Game entry — only where the shell provides speech (Android). The phase 0
// voice spike is a developer page (its Whisper model isn't bundled), so it
// shows in the debug build only.
if (Platform.speech) {
  document.getElementById("game-link").hidden = false;
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

// ---- Welcome-page wizard embed ----------------------------------------------
// When embedded as popup.html#settings, the popup is the settings surface for
// the welcome wizard: it shows one field group at a time (driven by the parent),
// reports its height so the iframe self-sizes, and commits the location on Finish.

function reportEmbedHeight() {
  // Measure the body's content height, not documentElement.scrollHeight: the
  // latter is floored by the iframe's viewport height, so once the iframe grows
  // (all groups are briefly visible before the wizard hides all but one) it can
  // never shrink back, leaving a tall empty gap below the active group.
  const height = Math.ceil(document.body.getBoundingClientRect().height);
  parent.postMessage({ type: "PTW_HEIGHT", height }, location.origin);
}

let currentWizardGroup = null;

// Show only the field group for the current wizard step; hide the rest plus the
// save/location button row (the wizard drives those). The error line stays.
function showWizardGroup(group) {
  currentWizardGroup = group;
  for (const child of el.settingsBody.children) {
    if (child === el.error) continue;
    const g = child.getAttribute("data-group");
    child.hidden = g ? g !== group : true;
  }
  // Respect nested visibility rules within the group we just revealed.
  if (group === "appearance") updateDigitsVisibility();
  if (group === "lock") updateLockOptionsVisibility();
  if (group === "dhikr") updateTasbihOptionsVisibility();
  reportEmbedHeight();
}

function startWizardEmbed() {
  document.body.classList.add("embedded");
  showSettingsView();

  window.addEventListener("message", async (event) => {
    if (event.origin !== location.origin) return;
    const msg = event.data;
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "PTW_GROUP") {
      showWizardGroup(msg.group);
    } else if (msg.type === "PTW_LANG") {
      if (msg.lang) await setLanguage(msg.lang);
      if (currentWizardGroup) showWizardGroup(currentWizardGroup);
      else reportEmbedHeight();
    } else if (msg.type === "PTW_COMMIT") {
      const result = await commitLocation();
      parent.postMessage({ type: "PTW_COMMIT_RESULT", ...result }, location.origin);
    }
  });

  if (window.ResizeObserver) {
    new ResizeObserver(reportEmbedHeight).observe(document.body);
  }

  // Tell the parent we're ready for the initial language + group.
  parent.postMessage({ type: "PTW_READY" }, location.origin);
}

// The desktop shell keeps this popup window alive between opens (hidden +
// suspended, not destroyed), so a dismissal while on Settings would otherwise
// reopen straight into Settings. The shell calls this hook every time it
// re-shows the window. (visibilitychange can't do this: the handler runs after
// resume, when visibilityState already reads "visible" again.) The extension
// popup is torn down on close (never calls this); the wizard embed (#settings)
// must stay on its settings surface.
window.__ptPopupReset = () => {
  if (window.location.hash !== "#settings") showMainView();
};

// Android hardware back: step out of Settings back to the main view. Returns
// true when handled; false means we're already home (or in the wizard embed,
// which owns its own navigation) and the shell should close the app instead.
window.__ptPopupBack = () => {
  if (window.location.hash === "#settings") return false;
  if (el.settingsView.hidden) return false;
  showMainView();
  return true;
};

init().then(() => {
  if (window.location.hash === "#settings") startWizardEmbed();
});
