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
  aboutLink: document.getElementById("about-link"),
  labelCardTimes: document.getElementById("label-card-times"),
  labelCardAlerts: document.getElementById("label-card-alerts"),
  labelCardTasbih: document.getElementById("label-card-tasbih"),
  labelCardAppearance: document.getElementById("label-card-appearance")
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
