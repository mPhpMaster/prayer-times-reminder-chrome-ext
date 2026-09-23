// Boot smoke test: evaluate the extension's scripts in stubbed popup
// (i18n.js + popup.js) and service-worker (background.js) realms to catch
// load-time crashes, const redeclarations across the shared global scope, and
// references to undefined globals. It stubs the DOM and chrome.* APIs, so it is
// not exhaustive — but it proves each realm parses AND initializes.

const fs = require("fs");
const path = require("path");
const vm = require("vm");

// Boot against the assembled extension build (flat folder produced by
// sync-core), mirroring how Chrome loads it. npm test assembles first.
const ROOT = path.resolve(__dirname, "..", "..", "targets", "extension", "build");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const noop = () => {};
const listener = { addListener: noop, removeListener: noop };

function fakeEl() {
  return new Proxy(function () {}, {
    get(_t, p) {
      if (p === "options" || p === "children") return [];
      if (p === "classList") return { add: noop, remove: noop, toggle: noop, contains: () => false };
      if (p === "style" || p === "dataset") return {};
      if (p === "getBoundingClientRect") return () => ({ height: 0, width: 0 });
      if (p === "getAttribute") return () => null;
      if (p === "value" || p === "textContent" || p === "innerHTML" || p === "id") return "";
      if (p === "checked" || p === "hidden" || p === "disabled") return false;
      if (p === Symbol.toPrimitive || p === "toString") return () => "";
      return fakeEl();
    },
    set: () => true,
    apply: () => fakeEl()
  });
}

function chromeStub() {
  return {
    storage: {
      local: { get: () => Promise.resolve({}), set: () => Promise.resolve(), remove: () => Promise.resolve() },
      onChanged: listener
    },
    runtime: {
      sendMessage: () => Promise.resolve({}), getURL: (x) => x,
      getContexts: () => Promise.resolve([]),
      onMessage: listener, onInstalled: listener, onStartup: listener
    },
    offscreen: { createDocument: () => Promise.resolve(), closeDocument: () => Promise.resolve() },
    tabs: {
      query: () => Promise.resolve([]), create: noop, remove: noop,
      sendMessage: () => Promise.resolve({}), getCurrent: (cb) => cb && cb(null), onUpdated: listener
    },
    alarms: { create: noop, clear: () => Promise.resolve(), get: () => Promise.resolve(null), onAlarm: listener },
    scripting: { executeScript: () => Promise.resolve([]) },
    notifications: { create: noop, clear: noop, onClicked: listener }
  };
}

const baseCtx = () => ({
  console, Intl, Date, Math, JSON, String, Number, Array, Object,
  encodeURIComponent, Promise, URLSearchParams,
  setTimeout: () => 0, clearTimeout: noop, setInterval: () => 0, clearInterval: noop,
  fetch: () => Promise.resolve({ ok: false, json: () => Promise.resolve({}) }),
  chrome: chromeStub()
});

let failures = 0;

// ---- Popup realm: i18n.js then popup.js (mirrors popup.html load order) ------
try {
  const win = {};
  const ctx = Object.assign(baseCtx(), {
    window: win, parent: win,
    location: { hash: "", origin: "chrome-extension://test" },
    navigator: { geolocation: { getCurrentPosition: noop } },
    ResizeObserver: function () { this.observe = noop; },
    document: new Proxy({}, {
      get(_t, p) {
        if (p === "getElementById" || p === "querySelector") return () => fakeEl();
        if (p === "querySelectorAll") return () => [];
        if (p === "createElement" || p === "createDocumentFragment") return () => fakeEl();
        if (p === "documentElement" || p === "body") return fakeEl();
        if (p === "addEventListener") return noop;
        return fakeEl();
      }
    })
  });
  win.addEventListener = noop;
  win.location = ctx.location;
  ctx.globalThis = ctx;
  ctx.navigator.geolocation = { getCurrentPosition: noop };
  vm.createContext(ctx);
  // Mirror popup.html load order: adapter installs Platform, platform.js binds it.
  vm.runInContext(read("adapter.js"), ctx, { filename: "adapter.js" });
  vm.runInContext(read("platform.js"), ctx, { filename: "platform.js" });
  vm.runInContext(read("i18n.js"), ctx, { filename: "i18n.js" });
  vm.runInContext(read("vendor/adhan.js"), ctx, { filename: "adhan.js" });
  vm.runInContext(read("vendor/tz-lookup.js"), ctx, { filename: "tz-lookup.js" });
  vm.runInContext(read("prayer-engine.js"), ctx, { filename: "prayer-engine.js" });
  vm.runInContext(read("lock-config.js"), ctx, { filename: "lock-config.js" });
  vm.runInContext(read("notify-plan.js"), ctx, { filename: "notify-plan.js" });
  vm.runInContext(read("popup.js"), ctx, { filename: "popup.js" });
  console.log("  ok: popup realm (adapter + platform + i18n + engine + popup) booted");
} catch (e) {
  console.error("  FAIL: popup realm — " + e.message);
  failures++;
}

// ---- Service-worker realm: background.js (importScripts loads its deps) -------
try {
  const ctx = baseCtx();
  ctx.globalThis = ctx;
  ctx.self = ctx;
  ctx.importScripts = (...files) => files.forEach((f) => vm.runInContext(read(f), ctx, { filename: f }));
  vm.createContext(ctx);
  vm.runInContext(read("background.js"), ctx, { filename: "background.js" });
  console.log("  ok: service-worker realm (background.js) booted");
} catch (e) {
  console.error("  FAIL: background realm — " + e.message);
  failures++;
}

// ---- Offscreen realm: offscreen.js (the prayer-time sound player) ------------
// Also exercises the two branches that matter: "adhan" must load the bundled
// file, and "none" must tear the document down instead of playing anything.
try {
  let played = null;
  let closed = false;
  let onMessage = null;
  const ctx = Object.assign(baseCtx(), {
    window: { close: () => { closed = true; } },
    Audio: function (url) {
      played = url;
      this.addEventListener = noop;
      this.play = () => Promise.resolve();
      this.pause = noop;
    },
    AudioContext: function () {
      this.currentTime = 0;
      this.createOscillator = () => ({ connect: () => ({ connect: noop }), start: noop, stop: noop, frequency: {} });
      this.createGain = () => ({ connect: () => ({ connect: noop }), gain: { setValueAtTime: noop, exponentialRampToValueAtTime: noop } });
      this.close = noop;
    }
  });
  ctx.self = ctx;
  ctx.globalThis = ctx;
  ctx.chrome.runtime.onMessage = { addListener: (fn) => { onMessage = fn; }, removeListener: noop };
  vm.createContext(ctx);
  vm.runInContext(read("offscreen.js"), ctx, { filename: "offscreen.js" });

  if (!onMessage) throw new Error("no onMessage listener registered");
  onMessage({ target: "offscreen", type: "PLAY_SOUND", kind: "adhan" }, null, noop);
  if (played !== "audio/adhan.ogg") throw new Error(`adhan url was ${played}`);
  onMessage({ target: "offscreen", type: "PLAY_SOUND", kind: "none" }, null, noop);
  if (!closed) throw new Error('"none" did not close the document');
  console.log("  ok: offscreen realm (offscreen.js) booted and played");
} catch (e) {
  console.error("  FAIL: offscreen realm — " + e.message);
  failures++;
}

// Surface async init crashes (init() chains run as microtasks).
process.on("unhandledRejection", (e) => {
  console.error("  FAIL: unhandled rejection during init — " + (e && e.message));
  failures++;
});

setTimeout(() => {
  if (failures) { console.error(`\nsmoke: ${failures} failure(s)`); process.exit(1); }
  console.log("\nsmoke: all realms booted cleanly");
}, 100);
