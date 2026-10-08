// adapter.js (web) — the Platform adapter for the website build on GitHub
// Pages (https://mphpmaster.github.io/prayer-times-reminder-chrome-ext/app/). Loaded before
// platform.js on every page. Plain web APIs only:
//
//   store       localStorage ("pt:" prefix), cross-tab via the storage event
//   enforce     the shared lock overlay inside this page (overlay-lock.js)
//   dhikr       the shared dhikr card inside this page (overlay-tasbih.js)
//   speech      Web Speech (shared speech-web.js) where the browser has it
//   googleAuth  Google sign-in in a popup window (google-auth-web.js)
//
// A website can only act while it is open: prayer-time notices, the lock and
// dhikr reminders run while a tab with the app is open (web-scheduler.js).
// The installable apps do this in the background; the landing page says so.

(function () {
  // --- no framing by other sites (Pages can't send frame-ancestors) ----------
  // welcome.html frames popup.html, so same-origin parents are fine; reading
  // a cross-origin parent's location throws, and then the page stays blank.
  try {
    if (window.top !== window.self && window.top.location.origin !== location.origin) throw 0;
  } catch {
    document.documentElement.style.display = "none";
    throw new Error("framed by another site");
  }

  // --- store: localStorage, like the desktop shell ---------------------------
  const PREFIX = "pt:";
  const listeners = [];
  const LOCAL_DEV = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  function readKey(k) {
    if (k === "gameApiUrl" && !LOCAL_DEV) return undefined;
    const raw = localStorage.getItem(PREFIX + k);
    if (raw == null) return undefined;
    try { return JSON.parse(raw); } catch { return undefined; }
  }
  const store = {
    get: (keys) => {
      const out = {};
      if (keys == null) {
        for (let i = 0; i < localStorage.length; i++) {
          const full = localStorage.key(i);
          if (full && full.startsWith(PREFIX)) out[full.slice(PREFIX.length)] = readKey(full.slice(PREFIX.length));
        }
      } else {
        for (const k of [].concat(keys)) {
          const v = readKey(k);
          if (v !== undefined) out[k] = v;
        }
      }
      return Promise.resolve(out);
    },
    set: (obj) => {
      const changes = {};
      for (const [k, v] of Object.entries(obj)) {
        changes[k] = { oldValue: readKey(k), newValue: v };
        localStorage.setItem(PREFIX + k, JSON.stringify(v));
      }
      listeners.forEach((cb) => { try { cb(changes); } catch {} });
      return Promise.resolve();
    },
    remove: (keys) => {
      for (const k of [].concat(keys)) localStorage.removeItem(PREFIX + k);
      return Promise.resolve();
    },
    onChange: (cb) => {
      listeners.push(cb);
      // Other tabs of the app.
      window.addEventListener("storage", (e) => {
        if (!e.key || !e.key.startsWith(PREFIX)) return;
        let newValue;
        try { newValue = e.newValue == null ? undefined : JSON.parse(e.newValue); } catch { newValue = undefined; }
        cb({ [e.key.slice(PREFIX.length)]: { newValue } });
      });
    },
  };

  // Same-origin scripts loaded on demand (the CSP allows 'self' only).
  const loaded = {};
  function loadScript(src) {
    if (!loaded[src]) {
      // Already a <script> of the page (popup.html has lock-config.js): its
      // top-level consts would clash if it ran twice.
      const tag = Array.from(document.scripts).find((s) => s.getAttribute("src") === src);
      if (tag && document.readyState === "complete") return Promise.resolve();
      loaded[src] = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src;
        s.onload = resolve;
        s.onerror = () => { delete loaded[src]; reject(new Error("failed to load " + src)); };
        document.head.appendChild(s);
      });
    }
    return loaded[src];
  }

  // --- lock: the shared overlay, inside this page -----------------------------
  const enforce = {
    start: async (config) => {
      try {
        await loadScript("overlay-lock.js");
        window.__prayerLockOnUnlock = () => window.__prayerTabLockClear && window.__prayerTabLockClear();
        window.__prayerTabLockActivate(config);
        return { ok: true };
      } catch (e) {
        return { ok: false, reason: String(e) };
      }
    },
    test: async ({ allowUnlock } = {}) => {
      const s = await store.get(["lang", "theme", "arabicDigits", "lockMinutes", "allowUnlock", "prayerSound"]);
      if (allowUnlock !== undefined) s.allowUnlock = allowUnlock === true;
      await loadScript("lock-config.js");
      return enforce.start(buildLockConfig(s, { test: true }));
    },
    clear: async () => {
      if (window.__prayerTabLockClear) window.__prayerTabLockClear();
      return { ok: true };
    },
  };

  // --- dhikr: the shared card, inside this page -------------------------------
  const dhikr = {
    show: async () => {
      try {
        await Promise.all([loadScript("tasbih-phrases.js"), loadScript("overlay-tasbih.js")]);
        const s = await store.get(["lang", "theme", "tasbihPosition"]);
        const lang = s.lang || DEFAULT_SETTINGS.lang;
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
    },
    test: () => dhikr.show(),
  };

  const geo = {
    current: (opts) =>
      new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error("no-geolocation"));
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          reject,
          opts
        );
      }),
  };

  const runtime = {
    getURL: (path) => path,
    closeOnboarding: () => { location.href = "popup.html"; return Promise.resolve(); },
  };

  // No per-site grant on the web: the lock covers this page only.
  const permissions = {
    ensureLockAccess: () => Promise.resolve(true),
    hasLockAccess: () => Promise.resolve(true),
  };

  // --- the dhikr game ------------------------------------------------------------
  const hasRecognizer = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  let speechMod = null;
  const speechModule = () => speechMod || (speechMod = import("./speech-web.js"));
  const speech = hasRecognizer
    ? {
        status: () => speechModule().then((m) => m.status()),
        start: (opts) => speechModule().then((m) => m.start(opts)),
        stop: () => speechModule().then((m) => m.stop()),
      }
    : undefined;

  let googleMod = null;
  const googleModule = () => googleMod || (googleMod = import("./google-auth-web.js"));
  const googleAuth = {
    signIn: (clientId) => googleModule().then((m) => m.signIn(clientId)),
    signOut: () => Promise.resolve(),
  };

  globalThis.__PTPlatform = { name: "web", store, enforce, dhikr, geo, runtime, permissions, speech, googleAuth };

  // The website build is a full page, not a 360px popup.
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = "web.css";
  document.head.appendChild(css);

  // On the prayer-times page, run the in-page schedule (notices, lock, dhikr).
  if (/\/popup\.html$/.test(location.pathname)) {
    window.addEventListener("load", () => {
      Promise.all(["scheduler-core.js", "dhikr-core.js", "lock-config.js"].map(loadScript))
        .then(() => loadScript("web-scheduler.js"))
        .catch(() => {});
    });
  }

  // A parent's family alerts, while the prayer-times or game page is open.
  if (/\/(popup|game)\.html$/.test(location.pathname)) {
    window.addEventListener("load", () => {
      loadScript("family-alerts.js")
        .then(() => loadScript("web-family.js"))
        .catch(() => {});
    });
  }
})();
