// Chrome-shell tests: the extension's own game pieces (speech-web.js,
// google-auth-chrome.js, game-alerts.js) against fakes, plus release checks on
// the assembled build — manifest permissions, no remote code, no inline
// scripts, and every game script the pages load actually shipped.
// Run: node tools/test/chrome-shell.js  (npm test assembles first).

const fs = require("fs");
const os = require("os");
const path = require("path");
const vm = require("vm");
const { pathToFileURL } = require("url");

const BUILD = path.resolve(__dirname, "..", "..", "targets", "extension", "build");
const read = (f) => fs.readFileSync(path.join(BUILD, f), "utf8");

let passed = 0;
const failures = [];
function ok(name, cond) {
  if (cond) passed++;
  else failures.push(name);
}

// The shell modules are ES modules in a CommonJS package: import a .mjs copy.
async function importModule(file) {
  const tmp = path.join(os.tmpdir(), `pt-${process.pid}-${file.replace(/\.js$/, ".mjs")}`);
  fs.writeFileSync(tmp, read(file));
  try {
    return await import(pathToFileURL(tmp).href);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

// ---- manifest + packaging --------------------------------------------------
function manifestChecks() {
  const m = JSON.parse(read("manifest.json"));
  ok("manifest v3", m.manifest_version === 3);
  ok("no key field (the store rejects it)", !("key" in m));
  const allowed = ["alarms", "notifications", "storage", "geolocation", "scripting", "offscreen", "identity"];
  ok("only the expected permissions", m.permissions.every((p) => allowed.includes(p)) && m.permissions.length === allowed.length);
  ok("identity permission for Google sign-in", m.permissions.includes("identity"));
  ok("no identity.email (install warning, not needed)", !m.permissions.includes("identity.email"));
  ok("no install-time host permissions", !m.host_permissions);
  ok("host access stays optional", JSON.stringify(m.optional_host_permissions) === '["<all_urls>"]');
  ok("default (strict) extension CSP", !m.content_security_policy);
  ok("no externally_connectable / oauth2 leftovers", !m.externally_connectable && !m.oauth2);
  ok("popup is the prayer-times page", m.action.default_popup === "popup.html");

  for (const page of ["popup.html", "game.html", "welcome.html", "about.html", "offscreen.html"]) {
    if (!fs.existsSync(path.join(BUILD, page))) continue;
    const html = read(page);
    ok(`${page}: no inline <script>`, !/<script(?![^>]*\bsrc=)[^>]*>\s*\S/i.test(html));
    ok(`${page}: no remote <script>`, !/<script[^>]+src=["']https?:/i.test(html));
    ok(`${page}: no inline handlers`, !/\son[a-z]+=["']/i.test(html));
    for (const [, src] of html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) {
      ok(`${page}: ships ${src}`, fs.existsSync(path.join(BUILD, src)));
    }
  }
  for (const f of ["speech-web.js", "google-auth-chrome.js", "game-alerts.js", "notify-plan.js"]) {
    ok(`build ships ${f}`, fs.existsSync(path.join(BUILD, f)));
  }
  const all = fs.readdirSync(BUILD).filter((f) => f.endsWith(".js"));
  const modules = ["speech-web.js", "google-auth-chrome.js"];
  for (const f of all.filter((x) => !modules.includes(x))) {
    let parsed = true;
    try {
      new vm.Script(read(f), { filename: f });
    } catch {
      parsed = false;
    }
    ok(`${f} parses`, parsed);
  }
  ok("no eval / new Function in shipped scripts", all.every((f) => !/\beval\(|new Function\(/.test(read(f))));
  ok("game UI never says Google is disabled", !/googleOff|google-off/.test(read("game.js") + read("game.html") + read("game-i18n.js")));
}

// ---- speech-web.js -----------------------------------------------------------
class FakeRecognizer {
  constructor() {
    FakeRecognizer.last = this;
    this.starts = 0;
  }
  start() {
    this.starts++;
    setTimeout(() => (FakeRecognizer.failWith ? this.onerror({ error: FakeRecognizer.failWith }) : this.onstart()), 0);
    if (FakeRecognizer.failWith) setTimeout(() => this.onend(), 1);
  }
  stop() {
    setTimeout(() => this.onend(), 0);
  }
  say(text) {
    const r = [{ transcript: text }];
    r.isFinal = true;
    this.onresult({ resultIndex: 0, results: [r] });
  }
}
const tick = () => new Promise((r) => setTimeout(r, 5));

async function speechChecks() {
  globalThis.webkitSpeechRecognition = FakeRecognizer;
  const sp = await importModule("speech-web.js");
  ok("speech status available", (await sp.status()).available === true);

  const finals = [];
  const states = [];
  let res = await sp.start({ lang: "ar-SA", onFinal: (t) => finals.push(t), onState: (on, i) => states.push([on, i && i.reason]) });
  const rec = FakeRecognizer.last;
  ok("speech start ok", res.ok === true && rec.lang === "ar-SA" && rec.continuous === true);
  rec.say("سبحان الله");
  ok("final phrase delivered", finals[0] === "سبحان الله");
  rec.onend(); // paused after a phrase: keeps listening
  ok("restarts while reading", rec.starts === 2);
  await tick();
  rec.onend(); // silence with nothing new heard
  ok("ends with no-speech", JSON.stringify(states.at(-1)) === JSON.stringify([false, "no-speech"]));

  await sp.start({ onState: (on, i) => states.push([on, i && i.reason]) });
  await sp.stop();
  ok("stop() ends with stopped", JSON.stringify(states.at(-1)) === JSON.stringify([false, "stopped"]));

  FakeRecognizer.failWith = "not-allowed";
  let errors = 0;
  res = await sp.start({ onError: () => errors++ });
  ok("mic denied -> start fails with mic-denied", res.ok === false && res.reason === "mic-denied");
  ok("mic denied reported once (by start)", errors === 0);
  FakeRecognizer.failWith = null;

  delete globalThis.webkitSpeechRecognition;
  res = await sp.start({});
  ok("no recognizer -> unsupported", res.ok === false && res.reason === "unsupported");
}

// ---- google-auth-chrome.js ---------------------------------------------------
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function googleChecks() {
  let answer = null; // (params) -> { url } | { error }
  let launched = null;
  let cleared = 0;
  globalThis.atob = (s) => Buffer.from(s, "base64").toString("binary");
  globalThis.chrome = {
    runtime: { lastError: null },
    identity: {
      getRedirectURL: () => "https://knahkbkmbjghaiillhngjbhoinmeegoc.chromiumapp.org/",
      clearAllCachedAuthTokens: async () => cleared++,
      launchWebAuthFlow: (opts, cb) => {
        launched = opts;
        const p = new URL(opts.url).searchParams;
        const a = answer(p);
        chrome.runtime.lastError = a.error ? { message: a.error } : null;
        cb(a.url);
        chrome.runtime.lastError = null;
      },
    },
  };
  const ga = await importModule("google-auth-chrome.js");
  const token = (nonce) => `h.${b64url({ nonce, aud: "cid", email: "a@b.c" })}.s`;
  const redirect = (p, extra) => `${p.get("redirect_uri")}#${new URLSearchParams(extra)}`;

  answer = (p) => ({ url: redirect(p, { id_token: token(p.get("nonce")), state: p.get("state") }) });
  const id = await ga.signIn("cid");
  const q = new URL(launched.url).searchParams;
  ok("google: interactive flow", launched.interactive === true && launched.url.startsWith("https://accounts.google.com/o/oauth2/v2/auth?"));
  ok("google: id_token for the server's client id", q.get("response_type") === "id_token" && q.get("client_id") === "cid");
  ok("google: extension redirect URL", q.get("redirect_uri") === "https://knahkbkmbjghaiillhngjbhoinmeegoc.chromiumapp.org/");
  ok("google: openid email scope + account chooser", q.get("scope").includes("openid") && q.get("scope").includes("email") && q.get("prompt") === "select_account");
  ok("google: returns the id token", typeof id === "string" && id.split(".").length === 3);

  const codeOf = async (fn) => {
    try {
      await fn();
      return "no-error";
    } catch (e) {
      return e.code;
    }
  };
  answer = () => ({ error: "The user did not approve access." });
  ok("google: closed window -> canceled", (await codeOf(() => ga.signIn("cid"))) === "canceled");
  answer = (p) => ({ url: redirect(p, { error: "access_denied", state: p.get("state") }) });
  ok("google: access_denied -> canceled", (await codeOf(() => ga.signIn("cid"))) === "canceled");
  answer = () => ({ error: "Authorization page could not be loaded." });
  ok("google: page failure -> failed", (await codeOf(() => ga.signIn("cid"))) === "failed");
  answer = (p) => ({ url: redirect(p, { id_token: token("forged"), state: p.get("state") }) });
  ok("google: nonce mismatch rejected", (await codeOf(() => ga.signIn("cid"))) === "failed");
  answer = (p) => ({ url: redirect(p, { id_token: token(p.get("nonce")), state: "other" }) });
  ok("google: state mismatch rejected", (await codeOf(() => ga.signIn("cid"))) === "failed");
  ok("google: no client id -> failed", (await codeOf(() => ga.signIn(""))) === "failed");
  await ga.signOut();
  ok("google: sign-out clears the identity cache", cleared === 1);
  delete globalThis.chrome;
}

// ---- game-alerts.js (worker) -------------------------------------------------
async function alertChecks() {
  const alarms = new Map();
  const notes = [];
  let store = {};
  const ctx = {
    console, Date, Math, JSON, String, Number, Array, Object, Intl, Promise,
    chrome: {
      alarms: {
        getAll: async () => [...alarms.keys()].map((name) => ({ name })),
        clear: async (n) => alarms.delete(n),
        create: (n, o) => alarms.set(n, o),
      },
      storage: { local: { get: async () => store } },
      notifications: { create: (id, o) => notes.push({ id, ...o }) },
    },
  };
  vm.createContext(ctx);
  for (const f of ["i18n.js", "vendor/adhan.js", "vendor/tz-lookup.js", "prayer-engine.js", "notify-plan.js", "game-alerts.js"]) {
    vm.runInContext(read(f), ctx, { filename: f });
  }
  const run = (code) => vm.runInContext(code, ctx);
  const location = { latitude: 21.4225, longitude: 39.8262, method: "UmmAlQura" };

  store = { location, gameState: { v: 1, windows: {} } };
  await run("scheduleGameAlerts()");
  const names = [...alarms.keys()];
  ok("alerts: planned open + closing alarms", names.some((n) => n.startsWith("game:open:")) && names.some((n) => n.startsWith("game:closing:")));
  ok("alerts: all in the future", [...alarms.values()].every((o) => o.when > Date.now()));

  const closing = names.find((n) => n.startsWith("game:closing:"));
  const key = closing.split(":").slice(2).join(":");
  store = { location, gameState: { v: 1, windows: { [key]: { tasks: {}, complete: true } } } };
  await run("scheduleGameAlerts()");
  ok("alerts: finished window has no closing alarm", !alarms.has(closing));
  await run(`fireGameAlert(${JSON.stringify(closing)})`);
  ok("alerts: finished window never notifies", notes.length === 0);

  store = { location, lang: "ar", gameState: { v: 1, windows: {} } };
  await run(`fireGameAlert(${JSON.stringify(closing)})`);
  ok("alerts: closing notification in Arabic", notes.length === 1 && /نصف ساعة/.test(notes[0].title) && notes[0].id.startsWith("game-"));

  store = { location, gameAlerts: false, gameState: { v: 1, windows: {} } };
  await run("scheduleGameAlerts()");
  ok("alerts: turned off -> no alarms", alarms.size === 0);

  store = { location };
  await run("scheduleGameAlerts()");
  ok("alerts: prayer-only user (never opened the game) -> no alarms", alarms.size === 0);
  ok("alerts: first saved game state triggers planning", run("isFirstGameState({ gameState: { newValue: { v: 1 } } })") === true);
  ok("alerts: later saves don't", run("isFirstGameState({ gameState: { oldValue: {}, newValue: {} } })") === false);
}

(async () => {
  manifestChecks();
  await speechChecks();
  await googleChecks();
  await alertChecks();
  if (failures.length) {
    console.error(`chrome-shell: ${failures.length} failed, ${passed} passed`);
    for (const f of failures) console.error("  FAIL: " + f);
    process.exit(1);
  }
  console.log(`chrome-shell: all ${passed} checks passed`);
})().catch((e) => {
  console.error("chrome-shell: crashed —", e);
  process.exit(1);
});
