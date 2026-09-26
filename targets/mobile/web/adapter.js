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
  let googleLoop = null; // { active } while the Google-dialog engine is running

  // engine "google": one Google voice dialog per utterance, relaunched until
  // stop() or the user cancels the dialog. Pairs with the 3-word reading chunks.
  async function runGoogleLoop(loop, { lang, getPrompt, onFinal, onState, onError }) {
    onState && onState(true);
    while (loop.active) {
      let r;
      try {
        r = await Speech.recognizeOnce({ lang, prompt: getPrompt ? getPrompt() : undefined });
      } catch (e) {
        onError && onError({ code: -3, message: String(e && e.message || e) });
        break;
      }
      if (!loop.active) break;
      if (r && r.text) onFinal && onFinal(r.text, {});
      else break; // canceled / nothing heard: stop, the player presses start again
    }
    loop.active = false;
    onState && onState(false);
  }

  const speech = Speech && {
    status: () => Speech.isAvailable(),
    checkSupport: (lang = "ar-SA") => Speech.checkSupport({ lang }),
    downloadModel: (lang = "ar-SA", onDevice = false) => Speech.downloadModel({ lang, onDevice }),
    start: async ({ lang = "ar-SA", preferOffline = true, engine = "default", onPartial, onFinal, onState, onSpeech, onBusy, onError, getPrompt } = {}) => {
      await speech.stop();
      if (engine === "google") {
        if (!Speech.recognizeOnce) return { ok: false, reason: "no-google-dialog" };
        googleLoop = { active: true };
        runGoogleLoop(googleLoop, { lang, getPrompt, onFinal, onState, onError });
        return { ok: true };
      }
      // The global plugin proxy returns the handle directly or as a Promise
      // depending on the bridge version — accept both.
      const on = (ev, fn, pick) =>
        fn && Promise.resolve(Speech.addListener(ev, (e) => fn(pick(e), e))).then((h) => speechHandles.push(h));
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
      if (googleLoop) { googleLoop.active = false; googleLoop = null; }
      try { await Speech.stop(); } catch {}
      const hs = speechHandles;
      speechHandles = [];
      await Promise.all(hs.map((h) => Promise.resolve().then(() => h.remove()).catch(() => {})));
    },
  };

  // The debug build installs as com.mphpmaster.prayer.debug (build.gradle
  // applicationIdSuffix), so developer-only screens can hide in release.
  const devBuild = () =>
    P.App.getInfo()
      .then((i) => /\.debug$/.test(i.id))
      .catch(() => false);

  globalThis.__PTPlatform = { name: "capacitor", store, enforce, dhikr, geo, runtime, permissions, speech, devBuild };

  // --- scheduled prayer notifications (rolling ~7-day window) ----------------
  // Computed offline from prayer-engine + notify-plan, scheduled via
  // @capacitor/local-notifications, topped up on every launch / resume. Tapping
  // a prayer notification starts the lock. Auto-firing the full-screen lock
  // while the app is closed is handled by the native full-screen-intent path
  // in PrayerLockPlugin / LockForegroundService — see targets/mobile/README.md.
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

  async function scheduleNotifications() {
    if (!LocalNotifications || typeof planPrayerNotifications !== "function") return;
    try {
      // Only check here — asking is the permission flow's job (see below).
      const perm = await LocalNotifications.checkPermissions();
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
    } catch {
      /* best effort — re-tried on next resume / settings change */
    }
  }

  // --- native prayer-time lock (fires over ANY app, app closed too) ----------
  // The notification path above only locks if the user taps it; the real
  // enforcement is native: hand the same rolling plan (with ready-made lock
  // configs) to AlarmManager via PrayerLock.schedulePrayerLocks.
  async function schedulePrayerLockAlarms() {
    if (!Lock || !Lock.schedulePrayerLocks) return;
    // A page without the planners must not send an empty schedule — that
    // would disarm every prayer lock (it did, when game.html became home).
    if (typeof planPrayerNotifications !== "function" || typeof buildLockConfig !== "function") return;
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
    } catch {
      /* best effort — re-tried on next resume / settings change */
    }
  }

  // --- permissions: one system screen at a time, each explained first --------
  // Android grants these on separate system screens. Earlier builds opened them
  // all at once from each scheduler, so they stacked on top of each other with
  // no word on why. Now: read what's missing (no prompt), and for each missing
  // step show a short in-app sheet, open its screen only on "Continue", and
  // wait until the user is back before the next. A step is remembered once
  // answered either way; Settings -> "Check permissions" re-runs the flow for
  // whatever is still missing (e.g. after an accidental Deny).
  const PERM_STEPS = [
    // [key, asked-flag, relevant(settings)]
    ["notifications", "notifPermAsked", () => true],
    ["fullScreen", "fullScreenIntentAsked", (s) => s.tabLockEnabled !== false],
    ["exactAlarm", "exactAlarmAsked", () => true],
    ["dnd", "dndAccessAsked", (s) => s.tabLockEnabled !== false && s.silentDuringPrayer !== false],
    ["overlay", "overlayPermAsked", (s) => s.tasbihEnabled === true],
    ["battery", "batteryExemptAsked", () => true],
  ];
  const PERM_REQUEST = {
    notifications: () => LocalNotifications.requestPermissions(),
    fullScreen: () => Lock.ensureFullScreenIntentPermission(),
    exactAlarm: () => Lock.ensureExactAlarmPermission(),
    dnd: () => Lock.ensureDndAccess(),
    overlay: () => Lock.ensureOverlayPermission(),
    battery: () => Lock.ensureBatteryExemption(),
  };
  // [title, why] per step, plus the sheet's buttons and the settings entry.
  const PERM_TEXT = {
    en: {
      notifications: ["Notifications", "So you get a reminder when each prayer time comes in."],
      fullScreen: ["Full-screen lock", "Lets the prayer lock cover the screen at prayer time, even while you're using another app."],

      exactAlarm: ["Alarms & reminders", "So reminders and the prayer lock start at the exact minute of each prayer, not a few minutes late."],
      dnd: ["Do Not Disturb", "Keeps your phone silent while the prayer lock is on. Find \"{app}\" in the list and turn it on."],
      overlay: ["Display over other apps", "Needed to show the dhikr reminder on top of whatever app is open. Find \"{app}\" in the list and allow it."],
      battery: ["Run in background", "Stops the phone's battery saver from cancelling prayer-time alarms."],
      cont: "Continue", later: "Not now", ok: "OK",
      check: "Check permissions", allSet: ["All set", "Every permission the app needs is granted."],
    },
    ar: {
      notifications: ["الإشعارات", "ليصلك تنبيه عند دخول وقت كل صلاة."],
      fullScreen: ["القفل بملء الشاشة", "ليغطي قفلُ الصلاة الشاشةَ عند دخول الوقت، حتى لو كنت تستخدم تطبيقًا آخر."],

      exactAlarm: ["المنبّهات والتذكيرات", "حتى يبدأ التذكير وقفل الصلاة في دقيقة دخول الوقت تمامًا، لا بعدها بدقائق."],
      dnd: ["عدم الإزعاج", "ليبقى الجوال صامتًا أثناء قفل الصلاة. ابحث عن «{app}» في القائمة وفعّله."],
      overlay: ["الظهور فوق التطبيقات", "لإظهار تذكير الذكر فوق أي تطبيق مفتوح. ابحث عن «{app}» في القائمة واسمح له."],
      battery: ["العمل في الخلفية", "حتى لا يُلغي موفّر البطارية منبّهات أوقات الصلاة."],
      cont: "متابعة", later: "ليس الآن", ok: "حسنًا",
      check: "فحص الأذونات", allSet: ["كل شيء جاهز", "جميع الأذونات التي يحتاجها التطبيق ممنوحة."],
    },
    ur: {
      notifications: ["اطلاعات", "تاکہ ہر نماز کا وقت ہونے پر آپ کو یاد دہانی ملے۔"],
      fullScreen: ["فل اسکرین لاک", "نماز کے وقت نماز لاک پوری اسکرین پر آ سکے، چاہے آپ کوئی اور ایپ استعمال کر رہے ہوں۔"],

      exactAlarm: ["الارم اور یاد دہانیاں", "تاکہ یاد دہانی اور نماز لاک ہر نماز کے عین وقت پر شروع ہوں، چند منٹ دیر سے نہیں۔"],
      dnd: ["ڈسٹرب نہ کریں", "نماز لاک کے دوران فون خاموش رہے۔ فہرست میں \"{app}\" تلاش کر کے آن کریں۔"],
      overlay: ["دیگر ایپس کے اوپر دکھائیں", "ذکر کی یاد دہانی کسی بھی کھلی ایپ کے اوپر دکھانے کے لیے۔ فہرست میں \"{app}\" تلاش کر کے اجازت دیں۔"],
      battery: ["پس منظر میں چلائیں", "تاکہ بیٹری سیور نماز کے الارم منسوخ نہ کرے۔"],
      cont: "جاری رکھیں", later: "ابھی نہیں", ok: "ٹھیک ہے",
      check: "اجازتیں چیک کریں", allSet: ["سب تیار ہے", "ایپ کو درکار تمام اجازتیں مل چکی ہیں۔"],
    },
    fr: {
      notifications: ["Notifications", "Pour recevoir un rappel à l'heure de chaque prière."],
      fullScreen: ["Verrouillage plein écran", "Permet au verrouillage de prière de couvrir l'écran à l'heure de la prière, même dans une autre application."],

      exactAlarm: ["Alarmes et rappels", "Pour que les rappels et le verrouillage démarrent à la minute exacte de chaque prière, pas quelques minutes plus tard."],
      dnd: ["Ne pas déranger", "Garde le téléphone silencieux pendant le verrouillage. Trouvez « {app} » dans la liste et activez-le."],
      overlay: ["Superposition aux autres applis", "Nécessaire pour afficher le rappel de dhikr au-dessus de l'appli ouverte. Trouvez « {app} » dans la liste et autorisez-le."],
      battery: ["Exécution en arrière-plan", "Empêche l'économiseur de batterie d'annuler les alarmes de prière."],
      cont: "Continuer", later: "Plus tard", ok: "OK",
      check: "Vérifier les autorisations", allSet: ["Tout est prêt", "Toutes les autorisations nécessaires sont accordées."],
    },
    es: {
      notifications: ["Notificaciones", "Para recibir un aviso cuando llegue la hora de cada oración."],
      fullScreen: ["Bloqueo a pantalla completa", "Permite que el bloqueo de oración cubra la pantalla a la hora de la oración, incluso en otra app."],

      exactAlarm: ["Alarmas y recordatorios", "Para que los avisos y el bloqueo empiecen en el minuto exacto de cada oración, no unos minutos tarde."],
      dnd: ["No molestar", "Mantiene el teléfono en silencio durante el bloqueo. Busca «{app}» en la lista y actívalo."],
      overlay: ["Mostrar sobre otras apps", "Necesario para mostrar el recordatorio de dhikr sobre cualquier app abierta. Busca «{app}» en la lista y permítelo."],
      battery: ["Ejecutar en segundo plano", "Evita que el ahorro de batería cancele las alarmas de oración."],
      cont: "Continuar", later: "Ahora no", ok: "Aceptar",
      check: "Revisar permisos", allSet: ["Todo listo", "La app tiene todos los permisos que necesita."],
    },
    hi: {
      notifications: ["सूचनाएँ", "ताकि हर नमाज़ का समय होने पर आपको याद दिलाया जाए।"],
      fullScreen: ["फ़ुल-स्क्रीन लॉक", "नमाज़ के समय नमाज़ लॉक पूरी स्क्रीन पर आ सके, भले ही आप कोई दूसरा ऐप चला रहे हों।"],

      exactAlarm: ["अलार्म और रिमाइंडर", "ताकि याद दिलाना और नमाज़ लॉक हर नमाज़ के ठीक समय पर शुरू हों, कुछ मिनट देर से नहीं।"],
      dnd: ["परेशान न करें", "नमाज़ लॉक के दौरान फ़ोन शांत रहे। सूची में \"{app}\" ढूँढकर चालू करें।"],
      overlay: ["दूसरे ऐप्स के ऊपर दिखाएँ", "ज़िक्र की याद किसी भी खुले ऐप के ऊपर दिखाने के लिए। सूची में \"{app}\" ढूँढकर अनुमति दें।"],
      battery: ["बैकग्राउंड में चलाएँ", "ताकि बैटरी सेवर नमाज़ के अलार्म रद्द न करे।"],
      cont: "जारी रखें", later: "अभी नहीं", ok: "ठीक है",
      check: "अनुमतियाँ जाँचें", allSet: ["सब तैयार है", "ऐप को ज़रूरी सभी अनुमतियाँ मिल गई हैं।"],
    },
    id: {
      notifications: ["Notifikasi", "Agar Anda mendapat pengingat saat waktu setiap salat tiba."],
      fullScreen: ["Kunci layar penuh", "Agar kunci salat menutupi layar saat waktu salat, meski Anda sedang memakai aplikasi lain."],

      exactAlarm: ["Alarm & pengingat", "Agar pengingat dan kunci salat dimulai tepat pada menit waktu salat, bukan terlambat beberapa menit."],
      dnd: ["Jangan Ganggu", "Menjaga ponsel tetap senyap selama kunci salat. Cari \"{app}\" di daftar lalu aktifkan."],
      overlay: ["Tampil di atas aplikasi lain", "Diperlukan untuk menampilkan pengingat zikir di atas aplikasi yang terbuka. Cari \"{app}\" di daftar lalu izinkan."],
      battery: ["Berjalan di latar belakang", "Agar penghemat baterai tidak membatalkan alarm waktu salat."],
      cont: "Lanjutkan", later: "Nanti", ok: "OK",
      check: "Periksa izin", allSet: ["Semua siap", "Semua izin yang dibutuhkan aplikasi sudah diberikan."],
    },
    de: {
      notifications: ["Benachrichtigungen", "Damit Sie zu jeder Gebetszeit eine Erinnerung erhalten."],
      fullScreen: ["Vollbild-Sperre", "Damit die Gebetssperre zur Gebetszeit den Bildschirm abdeckt, auch in einer anderen App."],

      exactAlarm: ["Wecker & Erinnerungen", "Damit Erinnerungen und die Gebetssperre genau zur Gebetsminute starten, nicht ein paar Minuten zu spät."],
      dnd: ["Nicht stören", "Hält das Telefon während der Gebetssperre stumm. Suchen Sie „{app}“ in der Liste und schalten Sie es ein."],
      overlay: ["Über anderen Apps einblenden", "Nötig, um die Dhikr-Erinnerung über jeder geöffneten App zu zeigen. Suchen Sie „{app}“ in der Liste und erlauben Sie es."],
      battery: ["Im Hintergrund ausführen", "Verhindert, dass der Akkusparer die Gebetsalarme abbricht."],
      cont: "Weiter", later: "Nicht jetzt", ok: "OK",
      check: "Berechtigungen prüfen", allSet: ["Alles bereit", "Alle nötigen Berechtigungen sind erteilt."],
    },
  };

  async function permissionState() {
    let st = {};
    try { if (Lock && Lock.permissionStatus) st = await Lock.permissionStatus(); } catch {}
    try {
      const p = await LocalNotifications.checkPermissions();
      st.notifications = p.display === "granted";
    } catch {}
    return st;
  }

  // Resolves once the user is back from the system screen/dialog. If nothing
  // took the app to the background (no grant screen on this OEM), resolve
  // right away instead of waiting for a resume that never comes.
  function waitForReturn() {
    return new Promise((resolve) => {
      let paused = false;
      let handles = [];
      const finish = () => {
        clearTimeout(noScreen);
        clearTimeout(cap);
        handles.forEach((h) => h && h.remove && h.remove());
        resolve();
      };
      const noScreen = setTimeout(() => { if (!paused) finish(); }, 2500);
      const cap = setTimeout(finish, 10 * 60 * 1000);
      Promise.all([
        CapApp.addListener("pause", () => { paused = true; }),
        CapApp.addListener("resume", finish),
      ]).then((hs) => { handles = hs; }).catch(() => {});
    });
  }

  // Minimal modal in the popup's own theme. Resolves true on the primary button.
  function permSheet(lang, title, body, primary, secondary) {
    return new Promise((resolve) => {
      const L = tr(lang);
      const wrap = document.createElement("div");
      wrap.dir = L.dir || "ltr";
      wrap.style.cssText =
        "position:fixed;inset:0;z-index:2147483647;display:flex;align-items:flex-end;" +
        "justify-content:center;padding:16px;background:oklch(0 0 0 / 0.6)";
      const card = document.createElement("div");
      card.style.cssText =
        "width:100%;max-width:440px;box-sizing:border-box;padding:20px;border-radius:var(--radius,1rem);" +
        "background:var(--card,#1c2b2b);color:var(--foreground,#fff);border:1px solid var(--border,#fff2);" +
        "box-shadow:var(--shadow-card,none);font-family:inherit";
      const h = document.createElement("h2");
      h.textContent = title;
      h.style.cssText = "margin:0 0 8px;font-size:1.15rem;color:var(--primary,#2dd4a7)";
      const p = document.createElement("p");
      p.textContent = body;
      p.style.cssText = "margin:0 0 18px;line-height:1.6;color:var(--muted-foreground,#ccc)";
      const row = document.createElement("div");
      row.style.cssText = "display:flex;gap:10px;justify-content:flex-end";
      const btn = (label, isPrimary, value) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = label;
        b.style.cssText =
          "padding:10px 18px;border-radius:calc(var(--radius,1rem) * .6);font:inherit;cursor:pointer;" +
          (isPrimary
            ? "border:0;background:var(--primary,#2dd4a7);color:var(--primary-foreground,#000);font-weight:600"
            : "border:1px solid var(--border,#fff2);background:transparent;color:var(--foreground,#fff)");
        b.addEventListener("click", () => { wrap.remove(); resolve(value); });
        row.appendChild(b);
      };
      if (secondary) btn(secondary, false, false);
      btn(primary, true, true);
      card.append(h, p, row);
      wrap.appendChild(card);
      document.body.appendChild(wrap);
    });
  }

  let permFlowActive = false;
  // force: ignore the "already asked" flags (the Settings button).
  async function runPermissionFlow({ force = false } = {}) {
    if (permFlowActive || !Lock || !CapApp) return;
    permFlowActive = true;
    try {
      const s = await readSettings([
        "lang", "tabLockEnabled", "silentDuringPrayer", "tasbihEnabled",
      ]);
      const { location } = await store.get("location");
      // First run: let the user pick a city before asking for anything.
      if (!force && !(location && location.latitude != null)) return;
      const lang = s.lang || "en";
      const T = PERM_TEXT[lang] || PERM_TEXT.en;
      const state = await permissionState();
      const asked = await store.get(PERM_STEPS.map((p) => p[1]));
      let prompted = false;
      for (const [key, askedKey, relevant] of PERM_STEPS) {
        if (state[key] !== false || !relevant(s)) continue;
        if (!force && asked[askedKey]) continue;
        prompted = true;
        const [title, why] = T[key];
        // {app}: the name the system lists show, which follows the PHONE's
        // language (e.g. "مواقيت الصلاة"), not the app's own language setting.
        const body = why.replace("{app}", state.appLabel || "Prayer Times");
        const go = await permSheet(lang, title, body, T.cont, T.later);
        await store.set({ [askedKey]: true });
        if (!go) continue;
        const back = key === "notifications" ? null : waitForReturn();
        try { await PERM_REQUEST[key](); } catch {}
        if (back) await back;
      }
      if (force && !prompted) await permSheet(lang, T.allSet[0], T.allSet[1], T.ok);
      if (prompted) scheduleNotifications(); // notifications may have just been allowed
    } catch {
      /* best effort — re-tried on next launch / settings change */
    } finally {
      permFlowActive = false;
    }
  }

  // Settings entry to re-run the flow, next to the "Test lock" button.
  async function addPermissionsButton() {
    const anchor = document.getElementById("test-lock-btn");
    if (!anchor || document.getElementById("check-perms-btn")) return;
    const b = document.createElement("button");
    b.type = "button";
    b.id = "check-perms-btn";
    b.className = anchor.className;
    b.style.marginTop = "8px";
    const label = async () => {
      const { lang } = await readSettings(["lang"]);
      b.textContent = (PERM_TEXT[lang] || PERM_TEXT.en).check;
    };
    await label();
    b.addEventListener("click", () => runPermissionFlow({ force: true }));
    anchor.insertAdjacentElement("afterend", b);
    store.onChange((changes) => { if ("lang" in changes) label(); });
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

  // --- game alerts: "tasks open" / "30 min left" per prayer window ------------
  // Planned by notify-plan.js (planGameAlerts). "closing" is skipped for a
  // window the player already finished (gameState), and the whole set is
  // re-planned after each finished window via Platform.gameAlerts.refresh().
  // Setting: store key "gameAlerts" (default on).
  const PRAYER_AR = { Fajr: "الفجر", Dhuhr: "الظهر", Asr: "العصر", Maghrib: "المغرب", Isha: "العشاء" };
  const NEXT_PRAYER = { Fajr: "Dhuhr", Dhuhr: "Asr", Asr: "Maghrib", Maghrib: "Isha", Isha: "Fajr" };

  async function scheduleGameAlerts() {
    if (!LocalNotifications || typeof planGameAlerts !== "function") return;
    try {
      const pending = await LocalNotifications.getPending();
      const old = (pending.notifications || [])
        .filter((n) => Number(n.id) >= GAME_ALERT_ID_BASE && Number(n.id) < LEGACY_DHIKR_ID_BASE)
        .map((n) => ({ id: n.id }));
      if (old.length) await LocalNotifications.cancel({ notifications: old });

      const s = await store.get(["location", "gameAlerts", "gameState"]);
      if (s.gameAlerts === false || !s.location || s.location.latitude == null) return;
      const windows = (s.gameState && s.gameState.windows) || {};
      const finished = (key) => {
        const w = windows[key];
        return !!(w && w.complete); // set by game.js once every task is done
      };
      const notifications = planGameAlerts(PrayerEngine, s.location, new Date(), SCHED_DAYS, SCHED_PRAYERS)
        .filter((a) => a.kind === "open" || !finished(a.key))
        .map((a) => ({
          id: a.id,
          title: a.kind === "open" ? `فُتحت مهمات صلاة ${PRAYER_AR[a.prayer]}` : `بقيت نصف ساعة على صلاة ${PRAYER_AR[NEXT_PRAYER[a.prayer]]}`,
          body: a.kind === "open"
            ? "ابدأ الآن لتأخذ النقاط كاملة."
            : `أكمل مهمات صلاة ${PRAYER_AR[a.prayer]} قبل أن تفوتك.`,
          schedule: { at: new Date(a.when), allowWhileIdle: true },
          channelId: PRAYER_CHANNEL,
          extra: { game: a.kind, key: a.key },
        }));
      if (notifications.length) await LocalNotifications.schedule({ notifications });
    } catch {
      /* best effort — re-tried on next resume */
    }
  }
  globalThis.__PTPlatform.gameAlerts = { refresh: scheduleGameAlerts };

  async function scheduleAll() {
    await ensureChannels();
    scheduleNotifications();
    schedulePrayerLockAlarms();
    syncDhikrSchedule();
    scheduleGameAlerts();
    runPermissionFlow();
  }

  window.addEventListener("load", scheduleAll);
  window.addEventListener("load", addPermissionsButton);
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
  const PERM_TRIGGER_KEYS = ["location", "tabLockEnabled", "silentDuringPrayer", "tasbihEnabled"];
  const LOCK_KEYS = ["location", "lang", "theme", "arabicDigits", "lockMinutes", "allowUnlock", "silentDuringPrayer", "tabLockEnabled"];
  store.onChange((changes) => {
    const keys = Object.keys(changes);
    if (keys.some((k) => k.startsWith("tasbih"))) syncDhikrSchedule();
    if (keys.some((k) => LOCK_KEYS.includes(k))) schedulePrayerLockAlarms();
    // A feature just switched on (or a city was picked) may need a grant.
    if (keys.some((k) => PERM_TRIGGER_KEYS.includes(k))) runPermissionFlow();
  });
  if (LocalNotifications && LocalNotifications.addListener) {
    LocalNotifications.addListener("localNotificationActionPerformed", (e) => {
      const extra = e && e.notification && e.notification.extra;
      if (extra && extra.game) return; // game alert: opening the app is enough
      startLockForPrayer(extra && extra.prayer);
    });
  }
})();
