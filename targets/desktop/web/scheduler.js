// scheduler.js (desktop) — runs in the hidden background window. Computes the
// day's prayer times offline (PrayerEngine), sets a timer for each upcoming
// prayer, and fires the native lock via Platform.enforce.start at prayer time.
// Recomputes shortly after midnight and whenever the location/language changes.
// Reuses the shared core (prayer-engine, scheduler-core, lock-config) — no logic
// is duplicated from the extension's background worker.

const PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
let timers = [];

function clearTimers() {
  timers.forEach(clearTimeout);
  timers = [];
}

async function firePrayer(prayer) {
  const s = await Platform.store.get([
    "lang", "theme", "arabicDigits", "lockMinutes", "allowUnlock", "tabLockEnabled",
    "silentDuringPrayer", "prayerSound",
  ]);
  if (s.tabLockEnabled === false) return; // lock disabled in settings
  const L = tr(s.lang || "en");
  const prayerName = prayerLabel(L, prayer);
  const config = buildLockConfig(s, { prayerName });
  await Platform.enforce.start(config);
}

async function reschedule() {
  clearTimers();
  const { location } = await Platform.store.get("location");
  if (!location || location.latitude == null || location.longitude == null) {
    // No location/coords yet — check again in an hour.
    timers.push(setTimeout(reschedule, 3600 * 1000));
    return;
  }

  const now = new Date();
  let data;
  try {
    data = PrayerEngine.timings(location, now);
  } catch {
    timers.push(setTimeout(reschedule, 600 * 1000));
    return;
  }

  // Future prayers today (planPrayerAlarms already drops past ones).
  for (const { id, when } of planPrayerAlarms(data.timings, PRAYERS, now, data.meta.timezone)) {
    const delay = when - Date.now();
    if (delay <= 0) continue;
    const prayer = id.slice("prayer:".length);
    timers.push(setTimeout(() => firePrayer(prayer), delay));
  }

  // Recompute shortly after midnight for the new day.
  const refreshDelay = Math.max(60 * 1000, nextRefreshTime(now) - Date.now());
  timers.push(setTimeout(reschedule, refreshDelay));
}

// --- Dhikr (tasbih) reminders ------------------------------------------------
const DHIKR_KEYS = [
  "tasbihEnabled", "tasbihIntervalMode", "tasbihIntervalMinutes",
  "tasbihRandomMin", "tasbihRandomMax",
];
let dhikrTimer = null;

async function scheduleDhikr() {
  if (dhikrTimer) { clearTimeout(dhikrTimer); dhikrTimer = null; }
  const settings = normalizeTasbihSettings(await Platform.store.get(DHIKR_KEYS));
  if (!settings.enabled) return;
  const opts = tasbihAlarmOptions(settings); // { periodInMinutes } or { delayInMinutes }
  const minutes = opts.delayInMinutes != null ? opts.delayInMinutes : opts.periodInMinutes;
  dhikrTimer = setTimeout(async () => {
    const s = await Platform.store.get(["lang", "theme", "tasbihPosition"]);
    Platform.dhikr.show({ lang: s.lang || "en", theme: s.theme, position: s.tasbihPosition });
    scheduleDhikr(); // re-arm the next one
  }, Math.max(1000, minutes * 60 * 1000));
}

// Re-plan when relevant settings change in the settings window.
Platform.store.onChange((changes) => {
  if (!changes) return;
  if (changes.location || changes.lang) reschedule();
  if (DHIKR_KEYS.some((k) => k in changes)) scheduleDhikr();
});

reschedule();
scheduleDhikr();
