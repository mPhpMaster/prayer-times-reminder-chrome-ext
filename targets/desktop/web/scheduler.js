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

// --- Family alerts ------------------------------------------------------------
// A parent's "the children didn't finish" checks (family-alerts.js); the game
// window caches { mode, role } in "familyAlerts" whenever it loads the family.
let familyTimers = [];

async function fireFamilyCheck(check) {
  const s = await Platform.store.get(["gameAccount", "gameApiUrl", "lang"]);
  if (!s.gameAccount || !s.gameAccount.token) return;
  const msg = await familyAlertFor(s.gameApiUrl, s.gameAccount.token, s.lang || "en", check);
  if (!msg) return;
  try {
    await globalThis.__TAURI__.core.invoke("notify_family", { title: msg.title, body: msg.body });
  } catch {
    /* no toast (older shell): nothing else to do */
  }
}

async function scheduleFamily() {
  familyTimers.forEach(clearTimeout);
  familyTimers = [];
  const s = await Platform.store.get(["location", "familyAlerts"]);
  const fa = s.familyAlerts;
  if (fa && fa.role === "parent" && s.location && s.location.latitude != null) {
    try {
      for (const c of planFamilyChecks(PrayerEngine, s.location, new Date(), fa.mode)) {
        const delay = c.when - Date.now();
        if (delay > 0) familyTimers.push(setTimeout(() => fireFamilyCheck(c), delay));
      }
    } catch {
      /* no prayer times yet */
    }
  }
  familyTimers.push(setTimeout(scheduleFamily, 12 * 3600 * 1000)); // new days' times
}

// Re-plan when relevant settings change in the settings window.
Platform.store.onChange((changes) => {
  if (!changes) return;
  if (changes.location || changes.familyAlerts) scheduleFamily();
  if (changes.location || changes.lang) reschedule();
  if (DHIKR_KEYS.some((k) => k in changes)) scheduleDhikr();
});

// --- New version -------------------------------------------------------------
// A Microsoft Store install asks the Store (native, updater.rs); a setup.exe /
// MSI install reads GitHub Releases, where each desktop version is published
// as tag "desktop-v<version>" with its installer attached. One toast per
// version: a click installs the Store update, or opens the new installer.
const RELEASES_API =
  "https://api.github.com/repos/mPhpMaster/prayer-times-reminder-chrome-ext/releases?per_page=30";
const DESKTOP_TAG = "desktop-v";
const UPDATE_CHECK_MS = 24 * 3600 * 1000;

// True if dotted version a is newer than b ("1.0.10" > "1.0.9").
function isNewerVersion(a, b) {
  const pa = String(a).split(".").map(Number);
  const pb = String(b).split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0;
  }
  return false;
}

async function latestGithubRelease(current) {
  const res = await fetch(RELEASES_API, { headers: { Accept: "application/vnd.github+json" } });
  if (!res.ok) return null;
  let best = null;
  for (const r of await res.json()) {
    if (r.draft || r.prerelease || !String(r.tag_name).startsWith(DESKTOP_TAG)) continue;
    const v = r.tag_name.slice(DESKTOP_TAG.length);
    if (!best || isNewerVersion(v, best.version)) best = { version: v, release: r };
  }
  if (!best || !isNewerVersion(best.version, current)) return null;
  const assets = best.release.assets || [];
  const installer = assets.find((a) => /-setup\.exe$/i.test(a.name)) || assets.find((a) => /\.msi$/i.test(a.name));
  return { version: best.version, url: installer ? installer.browser_download_url : best.release.html_url };
}

async function checkForUpdate() {
  try {
    const invoke = globalThis.__TAURI__.core.invoke;
    let update = null;
    if (globalThis.__PT_STORE_INSTALL__) {
      const version = await invoke("store_update_version");
      if (version) update = { version, url: null };
    } else {
      update = await latestGithubRelease(await globalThis.__TAURI__.app.getVersion());
    }
    if (!update) return;
    const { lang, updateNotified } = await Platform.store.get(["lang", "updateNotified"]);
    if (updateNotified === update.version) return;
    const L = tr(lang || DEFAULT_SETTINGS.lang);
    await invoke("notify_update", { title: L.updateTitle, body: L.updateBody, url: update.url });
    await Platform.store.set({ updateNotified: update.version });
  } catch {
    /* offline, rate-limited, no Store: try again tomorrow */
  } finally {
    setTimeout(checkForUpdate, UPDATE_CHECK_MS);
  }
}

reschedule();
scheduleDhikr();
scheduleFamily();
setTimeout(checkForUpdate, 60 * 1000);
