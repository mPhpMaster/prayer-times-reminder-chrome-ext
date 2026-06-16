// Prayer Times Reminder — popup logic
// (I18N, COUNTRIES, METHODS, tr() come from i18n.js, loaded first.)

const ALADHAN = "https://api.aladhan.com/v1";
const CITIES_API = "https://countriesnow.space/api/v0.1/countries/cities/q";

// Display order. Sunrise is informational (not a prayer to notify for).
const ROWS = [
  { key: "Fajr", icon: "🌄" },
  { key: "Sunrise", icon: "🌅", sunrise: true },
  { key: "Dhuhr", icon: "☀️" },
  { key: "Asr", icon: "🌤️" },
  { key: "Maghrib", icon: "🌇" },
  { key: "Isha", icon: "🌙" }
];
const PRAYER_KEYS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

// ---- DOM refs ---------------------------------------------------------------

const el = {
  appTitle: document.getElementById("app-title"),
  langToggle: document.getElementById("lang-toggle"),
  locationLabel: document.getElementById("location-label"),
  hijriDate: document.getElementById("hijri-date"),
  timings: document.getElementById("timings"),
  statusHint: document.getElementById("status-hint"),
  nextPrayer: document.getElementById("next-prayer"),
  nextLabel: document.getElementById("next-label"),
  nextName: document.getElementById("next-name"),
  nextCountdown: document.getElementById("next-countdown"),
  settingsSummary: document.getElementById("settings-summary"),
  labelCountry: document.getElementById("label-country"),
  labelCity: document.getElementById("label-city"),
  labelMethod: document.getElementById("label-method"),
  country: document.getElementById("country"),
  city: document.getElementById("city"),
  method: document.getElementById("method"),
  saveBtn: document.getElementById("save-btn"),
  geoBtn: document.getElementById("geo-btn"),
  error: document.getElementById("error"),
  settings: document.getElementById("settings"),
  footerDate: document.getElementById("footer-date"),
  footerSource: document.getElementById("footer-source")
};

let lang = "en";
let countdownTimer = null;
let currentTimings = null;
let currentDate = null; // AlAdhan date object (gregorian + hijri) for re-rendering

function T() { return tr(lang); }

// Convert ASCII digits to Arabic-Indic when Arabic is active.
function localizeNum(str) {
  return lang === "ar" ? toArabicDigits(str) : str;
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
  if (lang === "ar") {
    const suffix = hh < 12 ? "ص" : "م";
    return `${toArabicDigits(`${h12}:${mm}`)} ${suffix}`;
  }
  const ampm = hh < 12 ? "AM" : "PM";
  return `${h12}:${mm} ${ampm}`;
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
  return c ? (lang === "ar" ? c.ar : c.en) : enName;
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
    (lang === "ar" ? a.ar : a.en).localeCompare(lang === "ar" ? b.ar : b.en, lang)
  );
  for (const c of sorted) {
    const o = document.createElement("option");
    o.value = c.en;                       // value is always English (for the APIs)
    o.textContent = lang === "ar" ? c.ar : c.en;
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
    o.textContent = lang === "ar" ? m.ar : m.en;
    el.method.appendChild(o);
  }
  if (current) el.method.value = current;
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
    o.textContent = c;
    frag.appendChild(o);
  }
  el.city.appendChild(frag);
  el.city.disabled = false;
  if (preselect) el.city.value = preselect;
}

// ---- Rendering --------------------------------------------------------------

function findNextPrayer(timings) {
  const now = new Date();
  for (const key of PRAYER_KEYS) {
    const t = parseTimeToDate(timings[key]);
    if (t && t.getTime() > now.getTime()) return { key, time: t };
  }
  return null;
}

function renderTimings(timings) {
  currentTimings = timings;
  el.timings.innerHTML = "";
  const now = new Date();
  const next = findNextPrayer(timings);

  for (const row of ROWS) {
    const raw = timings[row.key];
    if (!raw) continue;
    const t = parseTimeToDate(raw);

    const li = document.createElement("li");
    if (row.sunrise) li.classList.add("sunrise");
    if (next && next.key === row.key) li.classList.add("is-next");
    else if (t && t.getTime() < now.getTime() && !row.sunrise) li.classList.add("is-past");

    const name = T().prayers[row.key] || row.key;
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
      el.nextCountdown.textContent = T().allDone;
      el.nextPrayer.hidden = false;
      return;
    }
    const diff = next.time.getTime() - Date.now();
    const h = Math.floor(diff / 3.6e6);
    const m = Math.floor((diff % 3.6e6) / 6e4);
    const s = Math.floor((diff % 6e4) / 1000);
    el.nextName.textContent = T().prayers[next.key] || next.key;
    el.nextCountdown.textContent = localizeNum(T().countdown(h, m, s));
    el.nextPrayer.hidden = false;
    if (diff <= 0) renderTimings(timings);
  }

  tick();
  countdownTimer = setInterval(tick, 1000);
}

function labelFor(location) {
  if (!location) return T().noLocation;
  if (location.mode === "coords") {
    return `📍 ${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)}`;
  }
  return `${location.city}, ${countryLabel(location.country)}`;
}

// Renders the Hijri date line and the Gregorian footer date in the active language.
function renderDates() {
  const h = currentDate && currentDate.hijri;
  if (h) {
    const month = lang === "ar" ? h.month.ar : h.month.en;
    const desig = lang === "ar" ? T().ahLabel : (h.designation?.abbreviated || "AH");
    el.hijriDate.textContent = localizeNum(`${h.day} ${month} ${h.year} ${desig}`);
  } else {
    el.hijriDate.textContent = "";
  }

  const g = currentDate && currentDate.gregorian;
  if (g && lang === "ar") {
    const [dd, mm, yy] = String(g.date).split("-").map(Number); // DD-MM-YYYY
    if (dd && mm && yy) {
      el.footerDate.textContent = toArabicDigits(
        new Date(yy, mm - 1, dd)
          .toLocaleDateString("ar", { day: "numeric", month: "long", year: "numeric" })
      );
    } else {
      el.footerDate.textContent = currentDate.readable || "";
    }
  } else if (currentDate) {
    el.footerDate.textContent = currentDate.readable || (g && g.date) || "";
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

// ---- Language ---------------------------------------------------------------

function applyLanguage() {
  const t = T();
  document.documentElement.lang = lang;
  document.documentElement.dir = t.dir;

  el.appTitle.textContent = t.appTitle;
  el.langToggle.textContent = t.langButton;
  el.nextLabel.textContent = t.nextPrayer;
  el.settingsSummary.textContent = t.settings;
  el.labelCountry.textContent = t.country;
  el.labelCity.textContent = t.city;
  el.labelMethod.textContent = t.method;
  el.saveBtn.textContent = t.save;
  el.geoBtn.textContent = t.useLocation;
  el.footerSource.textContent = t.dataSource;

  // Relabel dropdown options for the new language (preserving selections).
  populateCountrySelect();
  populateMethodSelect();
  // Refresh the city placeholder text without refetching (skip if cities failed).
  if (!el.city.disabled && el.city.options.length && el.city.options[0].value === "") {
    el.city.options[0].textContent = t.selectCity;
  }

  // Re-render dynamic text.
  chrome.storage.local.get("location").then(({ location }) => {
    el.locationLabel.textContent = labelFor(location);
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
  const { location, cache, lang: savedLang } =
    await chrome.storage.local.get(["location", "cache", "lang"]);

  lang = savedLang || "en";
  populateCountrySelect();
  populateMethodSelect();
  applyLanguage();

  if (location) {
    el.locationLabel.textContent = labelFor(location);
    el.method.value = String(location.method ?? 2);
    if (location.mode !== "coords") {
      el.country.value = location.country || "";
      if (el.country.value) loadCities(location.city);
    }
  } else {
    el.settings.open = true; // first run: prompt for a location
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

el.langToggle.addEventListener("click", () => {
  setLanguage(lang === "en" ? "ar" : "en");
});

el.country.addEventListener("change", () => {
  showError("");
  loadCities();
});

el.saveBtn.addEventListener("click", async () => {
  const country = el.country.value;
  const city = el.city.value;
  const method = Number(el.method.value);

  if (!country || !city) {
    showError(T().errFields);
    return;
  }

  const location = { mode: "city", city, country, method };
  await chrome.storage.local.set({ location });
  el.locationLabel.textContent = labelFor(location);
  await loadTimings(location);
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
    },
    (err) => {
      el.geoBtn.disabled = false;
      el.geoBtn.textContent = T().useLocation;
      showError(T().errGeoFail(err.message));
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
  );
});

init();
