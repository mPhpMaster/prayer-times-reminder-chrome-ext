// adapter.js (desktop / Tauri) — installs the Platform adapter for the Tauri
// shell. The ONLY place Tauri APIs (window.__TAURI__) are touched; core code
// calls Platform.* exactly as on the extension. Loaded before platform.js.
//
// Requires tauri.conf.json `app.withGlobalTauri = true` so __TAURI__ is present.
// Native enforcement (lock window, Core Audio mute, camera, key hook, timers)
// lives in Rust (src-tauri/src/main.rs); here we just invoke it.

(function () {
  const TAURI = globalThis.__TAURI__ || {};
  const invoke = TAURI.core ? TAURI.core.invoke : () => Promise.reject(new Error("no-tauri"));
  const logJs = (m) => { try { invoke("log_js", { msg: String(m) }); } catch (e) {} };
  logJs(
    "adapter loaded: __TAURI__=" + (globalThis.__TAURI__ ? "yes" : "NO") +
    " core=" + (TAURI.core ? "yes" : "NO") +
    " invoke=" + (typeof invoke)
  );

  // --- store: localStorage-backed (WebView2 persists it per app) -------------
  const PREFIX = "pt:";
  const changeListeners = [];
  function readKey(k) {
    const raw = localStorage.getItem(PREFIX + k);
    if (raw == null) return undefined;
    try { return JSON.parse(raw); } catch { return undefined; }
  }
  function writeKey(k, v) {
    localStorage.setItem(PREFIX + k, JSON.stringify(v));
  }
  const store = {
    get: (keys) => {
      const out = {};
      if (keys == null) {
        for (let i = 0; i < localStorage.length; i++) {
          const full = localStorage.key(i);
          if (full && full.startsWith(PREFIX)) {
            const k = full.slice(PREFIX.length);
            out[k] = readKey(k);
          }
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
        writeKey(k, v);
      }
      changeListeners.forEach((cb) => { try { cb(changes); } catch {} });
      return Promise.resolve();
    },
    remove: (keys) => {
      for (const k of [].concat(keys)) localStorage.removeItem(PREFIX + k);
      return Promise.resolve();
    },
    onChange: (cb) => {
      changeListeners.push(cb);
      // Cross-window: WebView2 fires a `storage` event in OTHER windows when one
      // window writes localStorage, so the hidden scheduler hears settings edits
      // made in the popup window.
      window.addEventListener("storage", (e) => {
        if (!e.key || !e.key.startsWith(PREFIX)) return;
        const k = e.key.slice(PREFIX.length);
        let newValue;
        try { newValue = e.newValue == null ? undefined : JSON.parse(e.newValue); } catch { newValue = undefined; }
        cb({ [k]: { newValue } });
      });
    },
  };

  // --- enforce / dhikr: drive the Rust backend -------------------------------
  const enforce = {
    // Fire a lock with an already-built overlay config (used by the scheduler).
    start: (config) => {
      logJs("enforce.start -> invoke start_lock");
      return invoke("start_lock", { config })
        .then(() => { logJs("start_lock resolved OK"); return { ok: true }; })
        .catch((e) => { logJs("start_lock REJECTED: " + e); return { ok: false, reason: String(e) }; });
    },
    // Build a test-lock config from current settings, then fire it.
    test: async () => {
      logJs("enforce.test clicked; buildLockConfig=" + typeof buildLockConfig);
      try {
        const s = await store.get(["lang", "theme", "arabicDigits", "lockMinutes"]);
        s.allowUnlock = true; // a test lock always shows an unlock button (X + Esc)
        const config = buildLockConfig(s, { test: true });
        logJs("built lock config ok");
        return enforce.start(config);
      } catch (e) {
        logJs("enforce.test ERROR: " + e);
        return { ok: false, reason: String(e) };
      }
    },
    clear: () => invoke("clear_lock").then(() => ({ ok: true })).catch(() => ({ ok: false })),
  };
  const dhikr = {
    // Show a dhikr card. The window (tasbih.html) picks the actual phrase; we
    // just pass the current language/theme/position.
    show: (config) => {
      logJs("dhikr.show -> invoke show_dhikr");
      return invoke("show_dhikr", { config })
        .then(() => { logJs("show_dhikr resolved OK"); return { ok: true }; })
        .catch((e) => { logJs("show_dhikr REJECTED: " + e); return { ok: false, reason: String(e) }; });
    },
    test: async () => {
      logJs("dhikr.test clicked");
      try {
        const s = await store.get(["lang", "theme", "tasbihPosition"]);
        return dhikr.show({ lang: s.lang || "en", theme: s.theme, position: s.tasbihPosition });
      } catch (e) {
        logJs("dhikr.test ERROR: " + e);
        return { ok: false, reason: String(e) };
      }
    },
  };

  const runtime = {
    getURL: (path) => path, // desktop assets are same-origin relative
    closeOnboarding: () => Promise.resolve(typeof window !== "undefined" && window.close()),
  };

  const geo = {
    current: (opts) =>
      new Promise((resolve, reject) => {
        if (!navigator.geolocation) { reject(new Error("no-geolocation")); return; }
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          (err) => reject(err),
          opts
        );
      }),
  };

  // Desktop enforcement is native (Rust) and needs no per-site grant, so lock
  // access is always available — the no-op keeps shared core code uniform.
  const permissions = {
    ensureLockAccess: () => Promise.resolve(true),
    hasLockAccess: () => Promise.resolve(true),
  };

  globalThis.__PTPlatform = { name: "tauri", store, enforce, dhikr, runtime, geo, permissions };
})();
