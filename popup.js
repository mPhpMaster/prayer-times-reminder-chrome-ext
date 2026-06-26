// Prayer Times Reminder — popup logic
// (I18N, COUNTRIES, METHODS, tr() come from i18n.js, loaded first.)

const ALADHAN = "https://api.aladhan.com/v1";
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
  hijriDate: document.getElementById("hijri-date"),
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
  footerDate: document.getElementById("footer-date"),
  footerSource: document.getElementById("footer-source")
};

let lang = "ar";
let uiTheme = DEFAULT_THEME;
let arabicDigits = false;
let dateFormat = DEFAULT_DATE_FORMAT;
let tasbihPosition = DEFAULT_TASBIH_POSITION;
let countdownTimer = null;
let currentTimings = null;
let currentDate = null; // AlAdhan date object (gregorian + hijri) for re-rendering

function T() { return tr(lang); }

const DEFAULT_LOCK_MINUTES = 5;
const DEFAULT_TASBIH_MINUTES = 15;
const DEFAULT_TASBIH_RANDOM_MIN = 5;
const DEFAULT_TASBIH_RANDOM_MAX = 15;

function clampLockMinutes(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_LOCK_MINUTES;
  return Math.min(120, Math.max(1, Math.round(n)));
}

function updateLockOptionsVisibility() {
  el.lockOptions.hidden = !el.tabLock.checked;
}

function clampTasbihMinutes(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(120, Math.max(1, Math.round(n)));
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
  await chrome.storage.local.set({
    tasbihEnabled: el.tasbihEnabled.checked,
    tasbihIntervalMode: getTasbihIntervalMode(),
    tasbihIntervalMinutes: clampTasbihMinutes(el.tasbihMinutes.value, DEFAULT_TASBIH_MINUTES),
    tasbihRandomMin: randomMin,
    tasbihRandomMax: randomMax,
    tasbihPosition: normalizeTasbihPosition(el.tasbihPosition.value)
  });
  tasbihPosition = normalizeTasbihPosition(el.tasbihPosition.value);
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

function apiDate(d) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}

function parseTimeToDate(timeStr, refDate = new Date()) {
  const m = String(timeStr).match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const d = new Date(refDate);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d;
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

function timingsUrl(location, date) {
  const method = location.method ?? 2;
  if (location.mode === "coords") {
    return `${ALADHAN}/timings/${date}?latitude=${location.latitude}` +
      `&longitude=${location.longitude}&method=${method}`;
  }
  return `${ALADHAN}/timingsByCity/${date}?city=${encodeURIComponent(location.city)}` +
    `&country=${encodeURIComponent(location.country)}&method=${method}`;
}

function countryLabel(enName) {
  const c = COUNTRIES.find((x) => x.en === enName);
  return c ? itemLabel(c, lang) : enName;
}

// ---- Arabic city labels (Nominatim + local cache) ---------------------------

const cityLabelCache = {};
let enrichToken = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadCityLabelCaches() {
  const all = await chrome.storage.local.get(null);
  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith("cityLabels:") && value && typeof value === "object") {
      cityLabelCache[key.slice("cityLabels:".length)] = value;
    }
  }
}

function cityLabel(cityEn, countryEn) {
  if (lang !== "ar" || !cityEn) return cityEn;
  return cityLabelCache[countryEn]?.[cityEn] || cityEn;
}

async function fetchCityArabicName(city, country) {
  if (!city || !country) return city;
  if (cityLabelCache[country]?.[city]) return cityLabelCache[country][city];

  try {
    const params = new URLSearchParams({ city, country, format: "json", limit: "1" });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        "Accept-Language": "ar",
        "User-Agent": "PrayerTimesReminder/2.0 (Chrome Extension)"
      }
    });
    if (!res.ok) return city;
    const data = await res.json();
    const arName = data[0]?.name || city;
    if (!cityLabelCache[country]) cityLabelCache[country] = {};
    cityLabelCache[country][city] = arName;
    const cacheKey = `cityLabels:${country}`;
    const stored = { ...((await chrome.storage.local.get(cacheKey))[cacheKey]), [city]: arName };
    await chrome.storage.local.set({ [cacheKey]: stored });
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

async function enrichCityLabels(country, cities) {
  const token = ++enrichToken;
  for (const city of cities) {
    if (token !== enrichToken || lang !== "ar" || el.country.value !== country) return;
    if (cityLabelCache[country]?.[city]) continue;
    await fetchCityArabicName(city, country);
    if (token !== enrichToken || lang !== "ar" || el.country.value !== country) return;
    refreshCityOptionLabels(country);
    const { location } = await chrome.storage.local.get("location");
    if (location?.mode === "city" && location.city === city && location.country === country) {
      el.locationLabel.textContent = labelFor(location);
    }
    await sleep(1100);
  }
}

async function ensureLocationCityArabic(location) {
  if (!location || location.mode !== "city" || lang !== "ar") return;
  await fetchCityArabicName(location.city, location.country);
  el.locationLabel.textContent = labelFor(location);
  if (el.country.value === location.country) refreshCityOptionLabels(location.country);
}

function scheduleCityArabicLabels(country, cities, preselect) {
  if (lang !== "ar" || !country || !cities?.length) return;
  const ordered = preselect
    ? [preselect, ...cities.filter((c) => c !== preselect)]
    : cities;
  enrichCityLabels(country, ordered);
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
    o.value = m.id;
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
    o.value = f.id;
    o.textContent = itemLabel(f, lang);
    el.dateFormat.appendChild(o);
  }
  el.dateFormat.value = DATE_FORMATS.some((f) => f.id === current)
    ? current
    : DEFAULT_DATE_FORMAT;
}

function populateTasbihPositionSelect() {
  const current = normalizeTasbihPosition(el.tasbihPosition.value || tasbihPosition);
  el.tasbihPosition.innerHTML = "";
  for (const p of TASBIH_POSITIONS) {
    const o = document.createElement("option");
    o.value = p.key;
    o.textContent = itemLabel(p, lang);
    el.tasbihPosition.appendChild(o);
  }
  el.tasbihPosition.value = current;
  tasbihPosition = current;
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
    default:
      return `${d}-${m} ${monthLong}-${y}`;
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
  const cached = (await chrome.storage.local.get(key))[key];
  if (Array.isArray(cached) && cached.length) return cached;
  try {
    const res = await fetch(`${CITIES_API}?country=${encodeURIComponent(country)}`);
    const json = await res.json();
    if (json.error || !Array.isArray(json.data) || !json.data.length) return null;
    const cities = [...new Set(json.data)].sort((a, b) => a.localeCompare(b));
    await chrome.storage.local.set({ [key]: cities });
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
    return;
  }
  el.city.disabled = true;
  el.city.appendChild(placeholderOption(T().loadingCities));

  const cities = await getCities(country);
  el.city.innerHTML = "";

  if (!cities) {
    el.city.appendChild(placeholderOption(T().citiesFailed));
    el.city.disabled = true;
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
  if (preselect) el.city.value = preselect;
  if (lang === "ar") {
    if (preselect) {
      await fetchCityArabicName(preselect, country);
      refreshCityOptionLabels(country);
    }
    scheduleCityArabicLabels(country, cities, preselect);
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
  const now = new Date();
  for (const key of PRAYER_KEYS) {
    const t = parseTimeToDate(timings[key]);
    if (t && t.getTime() > now.getTime()) return { key, time: t };
  }
  return null;
}

function findPreviousPrayer(timings) {
  const now = new Date();
  let prev = null;
  for (const row of ROWS) {
    const t = parseTimeToDate(timings[row.key]);
    if (t && t.getTime() <= now.getTime()) prev = { key: row.key, time: t };
  }
  return prev;
}

function prayerProgress(timings, next) {
  if (!next) return 0;
  const now = Date.now();
  const prev = findPreviousPrayer(timings);
  const start = prev ? prev.time.getTime() : new Date().setHours(0, 0, 0, 0);
  const end = next.time.getTime();
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
    const t = parseTimeToDate(raw);

    const li = document.createElement("li");
    li.classList.add("glass-card");
    if (row.sunrise) li.classList.add("sunrise");
    if (row.duha) li.classList.add("duha");
    if (next && next.key === row.key) li.classList.add("is-next");
    else if (t && t.getTime() < now.getTime()) li.classList.add("is-past");

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
    const diff = next.time.getTime() - Date.now();
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
    return localizeNum(`📍 ${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)}`);
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

// Renders the Hijri date line and the Gregorian footer date in the active language.
function renderDates() {
  const weekday = weekdayName();
  const h = currentDate && currentDate.hijri;
  const hijri = h ? localizeNum(formatHijriDate(h, dateFormat)) : "";
  el.hijriDate.textContent = hijri ? `${weekday} • ${hijri}` : weekday;

  const g = currentDate && currentDate.gregorian;
  const parts = gregorianParts(g);
  if (parts) {
    const formatted = formatGregorianDate(parts, dateFormat);
    const text = formatted ?? currentDate.readable ?? g.date;
    el.footerDate.textContent = localizeNum(text);
  } else if (currentDate) {
    el.footerDate.textContent = localizeNum(currentDate.readable || (g && g.date) || "");
  } else {
    el.footerDate.textContent = "";
  }
}

// ---- Data loading -----------------------------------------------------------

async function loadTimings(location) {
  showError("");
  el.statusHint.hidden = false;
  el.statusHint.textContent = T().loading;
  try {
    const res = await fetch(timingsUrl(location, apiDate(new Date())));
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const json = await res.json();
    if (json.code !== 200 || !json.data) throw new Error(T().errNotFound);
    currentDate = json.data.date;
    renderTimings(json.data.timings);
    renderDates();
    await chrome.storage.local.set({
      cache: { timings: json.data.timings, date: json.data.date, fetchedAt: Date.now() }
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
  el.labelTabLock.textContent = t.tabLockLabel;
  el.hintTabLock.textContent = t.tabLockHint;
  el.labelLockMinutes.textContent = t.lockMinutesLabel;
  el.labelAllowUnlock.textContent = t.allowUnlockLabel;
  el.hintAllowUnlock.textContent = t.allowUnlockHint;
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

  updateLockOptionsVisibility();
  updateTasbihOptionsVisibility();
  updateDigitsVisibility();

  populateLangSelect();
  // Relabel dropdown options for the new language (preserving selections).
  populateCountrySelect();
  populateMethodSelect();
  populateDateFormatSelect();
  populateTasbihPositionSelect();
  // Refresh the city placeholder text without refetching (skip if cities failed).
  if (!el.city.disabled && el.city.options.length && el.city.options[0].value === "") {
    el.city.options[0].textContent = t.selectCity;
  }
  if (el.country.value) {
    refreshCityOptionLabels(el.country.value);
    if (lang === "ar") {
      const cities = [...el.city.options].map((o) => o.value).filter(Boolean);
      scheduleCityArabicLabels(el.country.value, cities, el.city.value || undefined);
    } else {
      enrichToken++;
    }
  }

  // Re-render dynamic text.
  chrome.storage.local.get("location").then(({ location }) => {
    el.locationLabel.textContent = labelFor(location);
    if (lang === "ar") ensureLocationCityArabic(location);
  });
  if (currentTimings) renderTimings(currentTimings);
  else el.statusHint.textContent = t.setLocationHint;
  renderDates();
}

async function setLanguage(next) {
  lang = next;
  await chrome.storage.local.set({ lang });
  applyLanguage();
}

// ---- Init -------------------------------------------------------------------

async function init() {
  const {
    location, cache, lang: savedLang, theme: savedTheme, tabLockEnabled, arabicDigits: savedDigits,
    lockMinutes, allowUnlock, dateFormat: savedDateFormat,
    tasbihEnabled, tasbihIntervalMode, tasbihIntervalMinutes,
    tasbihRandomMin, tasbihRandomMax, tasbihPosition: savedTasbihPosition
  } = await chrome.storage.local.get([
    "location", "cache", "lang", "theme", "tabLockEnabled", "arabicDigits", "lockMinutes",
    "allowUnlock", "dateFormat", "tasbihEnabled", "tasbihIntervalMode",
    "tasbihIntervalMinutes", "tasbihRandomMin", "tasbihRandomMax", "tasbihPosition"
  ]);

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
  populateTasbihPositionSelect();
  applyLanguage();

  if (location) {
    el.locationLabel.textContent = labelFor(location);
    el.method.value = String(location.method ?? DEFAULT_SETTINGS.location.method);
    if (location.mode !== "coords") {
      el.country.value = location.country || "";
      if (el.country.value) await loadCities(location.city);
      ensureLocationCityArabic(location);
    }
  }

  // Instant render from cache if it's from today.
  if (cache && cache.timings) {
    const fetched = new Date(cache.fetchedAt);
    if (fetched.toDateString() === new Date().toDateString()) {
      currentDate = cache.date;
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

el.backBtn.addEventListener("click", () => {
  showMainView();
});

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

el.dateFormat.addEventListener("change", async () => {
  dateFormat = el.dateFormat.value || DEFAULT_DATE_FORMAT;
  await chrome.storage.local.set({ dateFormat });
  renderDates();
  showError("");
});

document.querySelectorAll('input[name="theme"]').forEach((input) => {
  input.addEventListener("change", async () => {
    if (!input.checked) return;
    applyTheme(input.value);
    await chrome.storage.local.set({ theme: uiTheme });
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
  await chrome.storage.local.set({ location });
  el.locationLabel.textContent = labelFor(location);
  ensureLocationCityArabic(location);
  await loadTimings(location);
  return { ok: true };
}

el.saveBtn.addEventListener("click", async () => {
  const result = await commitLocation();
  if (result.ok) showMainView();
});

el.geoBtn.addEventListener("click", () => {
  showError("");
  if (!navigator.geolocation) {
    showError(T().errNoGeo);
    return;
  }
  el.geoBtn.disabled = true;
  el.geoBtn.textContent = T().locating;
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const location = {
        mode: "coords",
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        method: Number(el.method.value)
      };
      await chrome.storage.local.set({ location });
      el.locationLabel.textContent = labelFor(location);
      el.geoBtn.disabled = false;
      el.geoBtn.textContent = T().useLocation;
      await loadTimings(location);
      showMainView();
    },
    (err) => {
      el.geoBtn.disabled = false;
      el.geoBtn.textContent = T().useLocation;
      showError(T().errGeoFail(err.message));
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
  );
});

el.tabLock.addEventListener("change", async () => {
  await chrome.storage.local.set({ tabLockEnabled: el.tabLock.checked });
  updateLockOptionsVisibility();
  showError("");
});

el.lockMinutes.addEventListener("change", async () => {
  const minutes = clampLockMinutes(el.lockMinutes.value);
  el.lockMinutes.value = String(minutes);
  await chrome.storage.local.set({ lockMinutes: minutes });
  showError("");
});

el.allowUnlock.addEventListener("change", async () => {
  await chrome.storage.local.set({ allowUnlock: el.allowUnlock.checked });
  showError("");
});

async function setArabicDigits(useArabic) {
  arabicDigits = useArabic;
  el.digitsArabic.checked = useArabic;
  el.digitsWestern.checked = !useArabic;
  await chrome.storage.local.set({ arabicDigits: useArabic });
  if (currentTimings) renderTimings(currentTimings);
  renderDates();
  chrome.storage.local.get("location").then(({ location }) => {
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
  el.testLockBtn.disabled = true;
  try {
    const result = await chrome.runtime.sendMessage({
      type: "TEST_LOCK",
      allowUnlock: el.allowUnlock.checked
    });
    if (!result?.ok) {
      showError(T().errLockTab);
    }
  } catch {
    showError(T().errLockTab);
  } finally {
    el.testLockBtn.disabled = false;
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

el.tasbihPosition.addEventListener("change", async () => {
  await saveTasbihSettings();
  showError("");
});

el.testTasbihBtn.addEventListener("click", async () => {
  showError("");
  el.testTasbihBtn.disabled = true;
  try {
    const result = await chrome.runtime.sendMessage({ type: "TEST_TASBIH" });
    if (!result?.ok) {
      showError(T().errTasbihTab);
    }
  } catch {
    showError(T().errTasbihTab);
  } finally {
    el.testTasbihBtn.disabled = false;
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
  parent.postMessage({ type: "PTW_HEIGHT", height }, "*");
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
      parent.postMessage({ type: "PTW_COMMIT_RESULT", ...result }, "*");
    }
  });

  if (window.ResizeObserver) {
    new ResizeObserver(reportEmbedHeight).observe(document.body);
  }

  // Tell the parent we're ready for the initial language + group.
  parent.postMessage({ type: "PTW_READY" }, "*");
}

init().then(() => {
  if (window.location.hash === "#settings") startWizardEmbed();
});
