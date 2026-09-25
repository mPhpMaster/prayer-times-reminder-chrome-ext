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
      const s = await readSettings(["lang", "theme", "arabicDigits", "lockMinutes", "allowUnlock", "silentDuringPrayer", "prayerSound"]);
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
  // --- dhikr: shared balloon in-app, local notifications in the background ---
  // popup.html doesn't ship the phrase bank / balloon (the extension injects
  // them into tabs instead), so pull them in on first use.
  let dhikrDeps = null;
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error("failed to load " + src));
      document.head.appendChild(s);
    });
  }
  function ensureDhikrDeps() {
    if (!dhikrDeps) {
      dhikrDeps = Promise.all([
        typeof TASBIH_PHRASES === "undefined" ? loadScript("tasbih-phrases.js") : null,
        window.__prayerTasbihActivate ? null : loadScript("overlay-tasbih.js"),
      ]).catch(() => { dhikrDeps = null; });
    }
    return dhikrDeps;
  }
  // Fallback path only (no overlay permission): the shared balloon inside the
  // current page. The real dhikr surface is the native floating overlay.
  async function showDhikrInPage() {
    try {
      await ensureDhikrDeps();
      if (!window.__prayerTasbihActivate) return { ok: false, reason: "no-overlay" };
      const s = await readSettings(["lang", "theme", "tasbihPosition"]);
      const lang = s.lang || "en";
      const L = tr(lang);
      window.__prayerTasbihActivate({
        display: randomTasbihPhrase(lang),
        label: L.tasbihCardLabel,
        dir: L.dir,
        lang,
        theme: normalizeTheme(s.theme),
        position: normalizeTasbihPosition(s.tasbihPosition),
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: String(e) };
    }
  }
  const dhikr = {
    // Silent floating balloon over whatever app is open (native overlay,
    // dhikr.html + shared overlay-tasbih.js). Falls back to the in-page
    // balloon when the overlay permission hasn't been granted.
    show: async () => {
      if (Lock && Lock.showDhikr) {
        try {
          const r = await Lock.showDhikr();
          if (r && r.shown) return { ok: true };
        } catch {}
      }
      return showDhikrInPage();
    },
    test: () => dhikr.show(),
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

  // --- speech: native continuous recognizer (SpeechPlugin) -------------------
  // Streams text only; matching against the task lives in recitation-match.js.
  // start() resolves once the mic is open (after the RECORD_AUDIO prompt).
  const Speech = P.Speech;
  let speechHandles = [];
  const speech = Speech && {
    status: () => Speech.isAvailable(),
    checkSupport: (lang = "ar-SA") => Speech.checkSupport({ lang }),
    downloadModel: (lang = "ar-SA", onDevice = false) => Speech.downloadModel({ lang, onDevice }),
    start: async ({ lang = "ar-SA", preferOffline = true, engine = "default", onPartial, onFinal, onState, onSpeech, onBusy, onError } = {}) => {
      await speech.stop();
      // The global plugin proxy returns the handle directly or as a Promise
      // depending on the bridge version — accept both.
      const on = (ev, fn, pick) =>
        fn && Promise.resolve(Speech.addListener(ev, (e) => fn(pick(e)))).then((h) => speechHandles.push(h));
      await Promise.all([
        on("partial", onPartial, (e) => e.text),
        on("final", onFinal, (e) => e.text),
        on("state", onState, (e) => e.listening),
        on("speech", onSpeech, (e) => e.speaking), // whisper engine: VAD hears speech
        on("busy", onBusy, (e) => e.pending),      // whisper engine: segments being decoded
        on("error", onError, (e) => e),
      ].filter(Boolean));
      try { await Speech.start({ lang, preferOffline, engine }); return { ok: true }; }
      catch (e) { return { ok: false, reason: String(e && e.message || e) }; }
    },
    stop: async () => {
      try { await Speech.stop(); } catch {}
      const hs = speechHandles;
      speechHandles = [];
      await Promise.all(hs.map((h) => Promise.resolve().then(() => h.remove()).catch(() => {})));
    },
  };

  globalThis.__PTPlatform = { name: "capacitor", store, enforce, dhikr, geo, runtime, permissions, speech };

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

  // High-importance channel so prayer notifications actually surface
  // (heads-up + sound); the plugin's default channel is only IMPORTANCE_DEFAULT,
  // which OEM battery savers happily swallow. Idempotent — Android ignores
  // re-creates of an existing channel. (Dhikr is NOT a notification — it's the
  // silent native overlay balloon.)
  const PRAYER_CHANNEL = "prayers";
  async function ensureChannels() {
    if (!LocalNotifications || !LocalNotifications.createChannel) return;
    try {
      await LocalNotifications.createChannel({
        id: PRAYER_CHANNEL,
        name: "Prayer times — مواقيت الصلاة",
        description: "Prayer time reminders",
        importance: 5,
        visibility: 1,
      });
    } catch {}
  }

  // Delivery reliability: aggressive OEMs (vivo/oppo/xiaomi…) kill scheduled
  // alarms unless the app is exempt from battery optimization. Ask once via the
  // native plugin (system dialog); a stored flag keeps us from nagging.
  async function ensureBatteryExemption() {
    if (!Lock || !Lock.ensureBatteryExemption) return;
    try {
      const { batteryExemptAsked } = await store.get("batteryExemptAsked");
      if (batteryExemptAsked) return;
      await store.set({ batteryExemptAsked: true });
      await Lock.ensureBatteryExemption();
    } catch {}
  }

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
          channelId: PRAYER_CHANNEL,
          extra: { prayer: n.prayer },
        };
      });
      if (notifications.length) await LocalNotifications.schedule({ notifications });
    } catch {
      /* best effort — re-tried on next resume */
    }
  }

  // --- periodic dhikr (native alarms -> silent floating balloon) --------------
  // Dhikr deliberately does NOT use notifications (no sound, no shade entry):
  // PrayerLock.scheduleDhikr arms AlarmManager from the stored settings and each
  // fire shows the click-through overlay balloon. Earlier builds scheduled dhikr
  // as notifications with ids >= 20M — sweep any of those still pending.
  const LEGACY_DHIKR_ID_BASE = 20000000;

  async function syncDhikrSchedule() {
    try {
      if (LocalNotifications) {
        const pending = await LocalNotifications.getPending();
        const stale = (pending.notifications || [])
          .filter((n) => Number(n.id) >= LEGACY_DHIKR_ID_BASE)
          .map((n) => ({ id: n.id }));
        if (stale.length) await LocalNotifications.cancel({ notifications: stale });
      }
      if (!Lock || !Lock.scheduleDhikr) return;
      await Lock.scheduleDhikr();
      // The floating balloon needs "display over other apps" — ask once.
      const { tasbihEnabled, overlayPermAsked } = await store.get([
        "tasbihEnabled", "overlayPermAsked",
      ]);
      if (tasbihEnabled === true && !overlayPermAsked && Lock.ensureOverlayPermission) {
        await store.set({ overlayPermAsked: true });
        await Lock.ensureOverlayPermission();
      }
    } catch {
      /* best effort — re-tried on next resume / settings change */
    }
  }

  // --- native prayer-time lock (fires over ANY app, app closed too) ----------
  // The notification path above only locks if the user taps it; the real
  // enforcement is native: hand the same rolling plan (with ready-made lock
  // configs) to AlarmManager via PrayerLock.schedulePrayerLocks. Silent (DND)
  // during the lock needs notification-policy access — ask once.
  async function schedulePrayerLockAlarms() {
    if (!Lock || !Lock.schedulePrayerLocks) return;
    try {
      const s = await readSettings([
        "lang", "theme", "arabicDigits", "lockMinutes", "allowUnlock", "silentDuringPrayer", "tabLockEnabled",
      ]);
      let entries = [];
      if (
        s.tabLockEnabled !== false &&
        typeof planPrayerNotifications === "function" &&
        typeof buildLockConfig === "function"
      ) {
        const { location } = await store.get("location");
        if (location && location.latitude != null) {
          const L = tr(s.lang || "en");
          const plan = planPrayerNotifications(
            PrayerEngine, location, new Date(), SCHED_DAYS, SCHED_PRAYERS
          );
          entries = plan.map((n) => ({
            when: n.when,
            config: buildLockConfig(s, { prayerName: prayerLabel(L, n.prayer) }),
          }));
        }
      }
      await Lock.schedulePrayerLocks({ entries });
      if (entries.length) await ensureDndAccess();
    } catch {
      /* best effort — re-tried on next resume / settings change */
    }
  }

  async function ensureDndAccess() {
    if (!Lock || !Lock.ensureDndAccess) return;
    try {
      const { dndAccessAsked } = await store.get("dndAccessAsked");
      if (dndAccessAsked) return;
      await store.set({ dndAccessAsked: true });
      await Lock.ensureDndAccess();
    } catch {}
  }

  async function startLockForPrayer(prayer) {
    const s = await readSettings([
      "lang", "theme", "arabicDigits", "lockMinutes", "allowUnlock", "silentDuringPrayer", "tabLockEnabled", "prayerSound",
    ]);
    if (s.tabLockEnabled === false) return;
    const L = tr(s.lang || "en");
    const prayerName = prayer ? prayerLabel(L, prayer) : L.testLockPrayer || "";
    enforce.start(buildLockConfig(s, { prayerName }));
  }

  async function scheduleAll() {
    await ensureChannels();
    scheduleNotifications();
    schedulePrayerLockAlarms();
    syncDhikrSchedule();
    ensureBatteryExemption();
  }

  window.addEventListener("load", scheduleAll);
  if (CapApp && CapApp.addListener) CapApp.addListener("resume", scheduleAll);
  // Android hardware back: from Settings go back to the main view (popup.js
  // hook); already on the main view -> close the app. Registering this listener
  // replaces Capacitor's default back handling, which otherwise does nothing
  // useful in a single-page app.
  if (CapApp && CapApp.addListener) {
    CapApp.addListener("backButton", () => {
      const handled =
        typeof window.__ptPopupBack === "function" && window.__ptPopupBack();
      if (!handled && CapApp.exitApp) CapApp.exitApp();
    });
  }
  // Re-arm the alarms as soon as their settings change.
  const LOCK_KEYS = ["location", "lang", "theme", "arabicDigits", "lockMinutes", "allowUnlock", "silentDuringPrayer", "tabLockEnabled"];
  store.onChange((changes) => {
    const keys = Object.keys(changes);
    if (keys.some((k) => k.startsWith("tasbih"))) syncDhikrSchedule();
    if (keys.some((k) => LOCK_KEYS.includes(k))) schedulePrayerLockAlarms();
  });
  if (LocalNotifications && LocalNotifications.addListener) {
    LocalNotifications.addListener("localNotificationActionPerformed", (e) => {
      const extra = e && e.notification && e.notification.extra;
      startLockForPrayer(extra && extra.prayer);
    });
  }
})();
