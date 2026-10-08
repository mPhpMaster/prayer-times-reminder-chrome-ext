// web-scheduler.js — while the prayer-times page is open in a tab: a browser
// notification at each prayer, the lock (if enabled) over this page, and the
// periodic dhikr card. Loaded by adapter.js on popup.html, after the shared
// scheduler-core / dhikr-core / lock-config. A website can't wake up on its
// own; the installable apps do this in the background.

(function () {
  const PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
  let timers = [];

  async function onPrayer(prayer) {
    const s = await Platform.store.get([
      "lang", "theme", "arabicDigits", "lockMinutes", "allowUnlock", "tabLockEnabled", "prayerSound",
    ]);
    const L = tr(s.lang || DEFAULT_SETTINGS.lang);
    const name = prayerLabel(L, prayer);
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(L.notifTitle(name), { body: L.notifBody(name), icon: "icons/icon128.png", tag: "prayer-" + prayer });
      } catch {
        /* some browsers only notify from a service worker */
      }
    }
    if (s.tabLockEnabled !== false) Platform.enforce.start(buildLockConfig(s, { prayerName: name }));
  }

  async function plan() {
    timers.forEach(clearTimeout);
    timers = [];
    const { location } = await Platform.store.get("location");
    if (!location || location.latitude == null || location.longitude == null) return;
    const now = new Date();
    let data;
    try {
      data = PrayerEngine.timings(location, now);
    } catch {
      return;
    }
    for (const { id, when } of planPrayerAlarms(data.timings, PRAYERS, now, data.meta.timezone)) {
      const delay = when - Date.now();
      if (delay > 0) timers.push(setTimeout(() => onPrayer(id.slice("prayer:".length)), delay));
    }
    timers.push(setTimeout(plan, Math.max(60 * 1000, nextRefreshTime(now) - Date.now())));
  }

  // Dhikr card on the user's interval.
  const DHIKR_KEYS = ["tasbihEnabled", "tasbihIntervalMode", "tasbihIntervalMinutes", "tasbihRandomMin", "tasbihRandomMax"];
  let dhikrTimer = null;
  async function planDhikr() {
    clearTimeout(dhikrTimer);
    const settings = normalizeTasbihSettings(await Platform.store.get(DHIKR_KEYS));
    if (!settings.enabled) return;
    const opts = tasbihAlarmOptions(settings);
    const minutes = opts.delayInMinutes != null ? opts.delayInMinutes : opts.periodInMinutes;
    dhikrTimer = setTimeout(() => {
      Platform.dhikr.show();
      planDhikr();
    }, Math.max(1000, minutes * 60 * 1000));
  }

  Platform.store.onChange((changes) => {
    if (changes.location || changes.lang) plan();
    if (DHIKR_KEYS.some((k) => k in changes)) planDhikr();
  });

  // Ask once for notification permission, on the user's first click (browsers
  // ignore or penalise prompts that aren't tied to a user action).
  if ("Notification" in window && Notification.permission === "default") {
    document.addEventListener("click", () => Notification.requestPermission().catch(() => {}), { once: true });
  }

  plan();
  planDhikr();
})();
