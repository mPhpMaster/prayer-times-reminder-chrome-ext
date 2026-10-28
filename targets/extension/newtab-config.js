// New-tab definitions, kept separate from rendering and data access.
const NewTabConfig = {
  prayers: ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"],
  five: ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"],
  icons: { Fajr: "🌄", Sunrise: "🌅", Dhuhr: "☀️", Asr: "🌤️", Maghrib: "🌇", Isha: "🌙" },
  backgrounds: ["sky", "emerald", "night", "desert", "dawn"],
  settingCheckMs: 6 * 3600 * 1000,
  weatherMs: 30 * 60 * 1000,
  soonMs: 10 * 60 * 1000,
  apiDefault: "https://prayer-times.sarhsoft.com",
  scheduleCacheKey: "newTabPrayerSchedule",
  settingsKeys: [
    "newTabPage", "newTabCheckedAt", "lang", "location", "arabicDigits", "gameAccount", "gameApiUrl",
    "ntBackground", "ntWeather", "ntFavDhikr", "ntWeatherCache",
  ],
};
