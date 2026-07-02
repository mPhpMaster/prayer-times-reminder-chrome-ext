// adapter.js (mobile / Capacitor) — installs the Platform adapter for the
// Capacitor shell. The ONLY place Capacitor APIs are touched; core code calls
// Platform.* exactly as on the extension and desktop. Loaded before platform.js.
//
// No-bundler approach: native plugins are reached via window.Capacitor.Plugins
// (the bridge registers them). Storage -> Preferences, scheduling ->
// LocalNotifications, geolocation -> Geolocation, lock enforcement -> a custom
// Kotlin plugin "PrayerLock" (full-screen Activity + overlay + foreground
// service + DND). See targets/mobile/README.md for the native plugin contract.

(function () {
  const Cap = globalThis.Capacitor || {};
  const P = Cap.Plugins || {};

  // --- store: @capacitor/preferences (key/value, string-encoded) -------------
  const Preferences = P.Preferences;
  const changeListeners = [];
  const store = {
    get: async (keys) => {
      const out = {};
      if (!Preferences) return out;
      if (keys == null) {
        const { keys: all } = await Preferences.keys();
        for (const k of all) out[k] = await readKey(k);
      } else {
        for (const k of [].concat(keys)) {
          const v = await readKey(k);
          if (v !== undefined) out[k] = v;
        }
      }
      return out;
    },
    set: async (obj) => {
      if (!Preferences) return;
      const changes = {};
      for (const [k, v] of Object.entries(obj)) {
        changes[k] = { newValue: v };
        await Preferences.set({ key: k, value: JSON.stringify(v) });
      }
      changeListeners.forEach((cb) => { try { cb(changes); } catch {} });
    },
    remove: async (keys) => {
      if (!Preferences) return;
      for (const k of [].concat(keys)) await Preferences.remove({ key: k });
    },
    onChange: (cb) => { changeListeners.push(cb); },
  };
  async function readKey(k) {
    const { value } = await Preferences.get({ key: k });
    if (value == null) return undefined;
    try { return JSON.parse(value); } catch { return undefined; }
  }

  // --- enforce / dhikr: custom native PrayerLock plugin ----------------------
  const Lock = P.PrayerLock;
  const enforce = {
    // Fire a lock with an already-built overlay config (built via buildLockConfig).
    start: async (config) => {
      if (!Lock) return { ok: false, reason: "no-native-lock" };
      try { await Lock.start(config); return { ok: true }; }
      catch (e) { return { ok: false, reason: String(e) }; }
    },
    test: async ({ allowUnlock } = {}) => {
      const s = await readSettings(["lang", "theme", "arabicDigits", "lockMinutes", "allowUnlock"]);
      if (allowUnlock !== undefined) s.allowUnlock = allowUnlock === true;
      const config = buildLockConfig(s, { test: true });
      return enforce.start(config);
    },
    clear: async () => { if (Lock) await Lock.clear(); return { ok: true }; },
  };
  async function readSettings(keys) {
    const out = {};
    if (!Preferences) return out;
    for (const k of keys) { const v = await readKey(k); if (v !== undefined) out[k] = v; }
    return out;
  }
  const dhikr = {
    test: async () => {
      if (!Lock) return { ok: false, reason: "no-native-lock" };
      try { await Lock.showDhikr({ test: true }); return { ok: true }; }
      catch (e) { return { ok: false, reason: String(e) }; }
    },
  };

  // --- geo: @capacitor/geolocation -------------------------------------------
  const Geolocation = P.Geolocation;
  const geo = {
    current: async (opts) => {
      if (!Geolocation) throw new Error("no-geolocation");
      const pos = await Geolocation.getCurrentPosition(opts);
      return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    },
  };

  const runtime = {
    getURL: (path) => path,
    closeOnboarding: () => Promise.resolve(typeof window !== "undefined" && window.close && window.close()),
  };

  // Android enforcement is native and needs no per-site grant, so lock access
  // is always available — the no-op keeps shared core code uniform.
  const permissions = {
    ensureLockAccess: () => Promise.resolve(true),
    hasLockAccess: () => Promise.resolve(true),
  };

  globalThis.__PTPlatform = { name: "capacitor", store, enforce, dhikr, geo, runtime, permissions };

  // --- scheduled prayer notifications (rolling ~7-day window) ----------------
  // Computed offline from prayer-engine + notify-plan, scheduled via
  // @capacitor/local-notifications, topped up on every launch / resume. Tapping
  // a prayer notification starts the lock. (Auto-firing the full-screen lock
  // while the app is closed needs the native full-screen-intent path in
  // PrayerLockPlugin — see targets/mobile/README.md.)
  const LocalNotifications = P.LocalNotifications;
  const CapApp = P.App;
  const SCHED_DAYS = 7;
  const SCHED_PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

  async function scheduleNotifications() {
    if (!LocalNotifications || typeof planPrayerNotifications !== "function") return;
    try {
      const perm = await LocalNotifications.requestPermissions();
      if (perm && perm.display && perm.display !== "granted") return;
      const { location } = await store.get("location");
      if (!location || location.latitude == null) return;
      const { lang } = await readSettings(["lang"]);
      const L = tr(lang || "en");
      const plan = planPrayerNotifications(PrayerEngine, location, new Date(), SCHED_DAYS, SCHED_PRAYERS);
      const notifications = plan.map((n) => {
        const name = prayerLabel(L, n.prayer);
        return {
          id: n.id,
          title: L.notifTitle ? L.notifTitle(name) : name,
          body: L.notifBody ? L.notifBody(name) : "",
          schedule: { at: new Date(n.when), allowWhileIdle: true },
          extra: { prayer: n.prayer },
        };
      });
      if (notifications.length) await LocalNotifications.schedule({ notifications });
    } catch {
      /* best effort — re-tried on next resume */
    }
  }

  async function startLockForPrayer(prayer) {
    const s = await readSettings([
      "lang", "theme", "arabicDigits", "lockMinutes", "allowUnlock", "tabLockEnabled",
    ]);
    if (s.tabLockEnabled === false) return;
    const L = tr(s.lang || "en");
    const prayerName = prayer ? prayerLabel(L, prayer) : L.testLockPrayer || "";
    enforce.start(buildLockConfig(s, { prayerName }));
  }

  window.addEventListener("load", scheduleNotifications);
  if (CapApp && CapApp.addListener) CapApp.addListener("resume", scheduleNotifications);
  if (LocalNotifications && LocalNotifications.addListener) {
    LocalNotifications.addListener("localNotificationActionPerformed", (e) => {
      const prayer = e && e.notification && e.notification.extra && e.notification.extra.prayer;
      startLockForPrayer(prayer);
    });
  }
})();
