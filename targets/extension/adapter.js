// adapter-chrome.js — installs the Platform adapter for the Chrome extension.
//
// This is the ONLY place in the extension's page realm where chrome.* lives;
// core code calls Platform.* instead. It runs in the popup and welcome pages
// (loaded before platform.js, which binds the global into `Platform`).
//
// Enforcement (the prayer-time tab lock / dhikr fan-out) physically happens in
// the service worker (background.js). From a page, Platform.enforce/dhikr just
// message the worker to run a test now.

(function () {
  const store = {
    get: (keys) => chrome.storage.local.get(keys ?? null),
    set: (obj) => chrome.storage.local.set(obj),
    remove: (keys) => chrome.storage.local.remove(keys),
    onChange: (cb) =>
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local") cb(changes);
      }),
  };

  const runtime = {
    getURL: (path) => chrome.runtime.getURL(path),
    // Close the onboarding tab (welcome page). Falls back to window.close() if
    // the page wasn't opened as its own tab.
    closeOnboarding: () =>
      new Promise((resolve) => {
        chrome.tabs.getCurrent((tab) => {
          if (tab) chrome.tabs.remove(tab.id, () => resolve());
          else {
            if (typeof window !== "undefined") window.close();
            resolve();
          }
        });
      }),
  };

  const enforce = {
    test: ({ allowUnlock } = {}) =>
      chrome.runtime.sendMessage({
        type: "TEST_LOCK",
        allowUnlock: allowUnlock === true,
      }),
    clear: () => chrome.runtime.sendMessage({ type: "UNLOCK_ALL" }),
  };

  const dhikr = {
    test: () => chrome.runtime.sendMessage({ type: "TEST_TASBIH" }),
  };

  const geo = {
    current: (opts) =>
      new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("no-geolocation"));
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) =>
            resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            }),
          (err) => reject(err),
          opts
        );
      }),
  };

  // Optional host permission (<all_urls>) — requested at runtime instead of at
  // install so the install prompt stays minimal. The tab-lock overlay needs
  // access to every open tab, so we ask for it when the user turns tab lock on
  // (or runs a test lock). ensureLockAccess() MUST be called synchronously from
  // a user gesture (a click/change handler); chrome.permissions.request is a
  // no-op that resolves true instantly if the grant already exists.
  const HOST = { origins: ["<all_urls>"] };
  const permissions = {
    ensureLockAccess: () =>
      new Promise((resolve) => {
        if (!chrome.permissions) { resolve(true); return; }
        chrome.permissions.request(HOST, (granted) => resolve(granted === true));
      }),
    hasLockAccess: () =>
      new Promise((resolve) => {
        if (!chrome.permissions) { resolve(true); return; }
        chrome.permissions.contains(HOST, (has) => resolve(has === true));
      }),
  };

  // The dhikr game (optional; prayer times never need it). Speech and Google
  // sign-in live in ES modules loaded on first use, so the popup and the
  // prayer pages never pay for them.
  const lazy = (file) => {
    let mod = null;
    return () => mod || (mod = import(chrome.runtime.getURL(file)));
  };
  const speechModule = lazy("speech-web.js");
  const hasRecognizer = typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const speech = hasRecognizer
    ? {
        status: () => speechModule().then((m) => m.status()),
        start: (opts) => speechModule().then((m) => m.start(opts)),
        stop: () => speechModule().then((m) => m.stop()),
      }
    : undefined;

  const googleModule = lazy("google-auth-chrome.js");
  const googleAuth = chrome.identity
    ? {
        signIn: (clientId) => googleModule().then((m) => m.signIn(clientId)),
        signOut: () => googleModule().then((m) => m.signOut()).catch(() => {}),
      }
    : undefined;

  // "Tasks open" / "30 min left" notifications are planned by the worker.
  const gameAlerts = {
    refresh: () => chrome.runtime.sendMessage({ type: "REFRESH_GAME_ALERTS" }).catch(() => {}),
  };

  globalThis.__PTPlatform = {
    name: "chrome", store, runtime, enforce, dhikr, geo, permissions, speech, googleAuth, gameAlerts,
  };
})();
