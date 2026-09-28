// Unit tests for the About page's dedication names (dedications.js), the
// request/admin API client (game-sync.js) and the new strings being complete
// in every language, evaluated against the assembled build.
// Run: node tools/test/dedications.js  (npm test assembles first).

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..", "..", "targets", "extension", "build");
const calls = [];
const ctx = {
  Math, String, Number, Array, Object, JSON, console, Date, Intl, encodeURIComponent,
  fetch: async (url, opts) => {
    calls.push({ url, method: opts.method, body: opts.body && JSON.parse(opts.body), auth: opts.headers.authorization });
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  },
};
vm.createContext(ctx);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx, { filename: f });
for (const f of ["i18n.js", "game-i18n.js", "dedication-i18n.js", "admin-i18n.js", "dedications.js", "game-sync.js"]) load(f);
vm.runInContext(
  "this.__d = { dedicationLines, cleanDedicationNames, validDedicationList, isArabicScript, DEDICATIONS_FALLBACK, DEDICATION_LANGS };" +
    "this.__i = { DEDICATION_I18N, ADMIN_I18N, GAME_I18N, SUPPORTED_LANGS, gameApi };",
  ctx
);
const { dedicationLines, cleanDedicationNames, validDedicationList, isArabicScript, DEDICATIONS_FALLBACK, DEDICATION_LANGS } = ctx.__d;
const { DEDICATION_I18N, ADMIN_I18N, GAME_I18N, SUPPORTED_LANGS, gameApi } = ctx.__i;

let passed = 0;
const failures = [];
function eq(name, got, want) {
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a === b) passed++;
  else failures.push(`${name}\n    got:  ${a}\n    want: ${b}`);
}

// ---- display rule -----------------------------------------------------------
const bilal = DEDICATIONS_FALLBACK[0].names;
eq("ar UI: Arabic only", dedicationLines(bilal, "ar"), { primary: "ام بلال - باشية حجازي", secondary: null });
eq("ur UI: Arabic only when no Urdu text", dedicationLines(bilal, "ur"), { primary: "ام بلال - باشية حجازي", secondary: null });
eq("en UI: Arabic + English", dedicationLines(bilal, "en"), { primary: "ام بلال - باشية حجازي", secondary: "Umm Bilal – Bashiyah Hijazi" });
eq("fr UI without French: English spelling", dedicationLines(bilal, "fr").secondary, "Umm Bilal – Bashiyah Hijazi");
eq("fr UI with French text", dedicationLines({ ar: "أم سارة", en: "Umm Sara", fr: "Oum Sara" }, "fr").secondary, "Oum Sara");
eq("ur UI with Urdu text", dedicationLines({ ar: "أم سارة", ur: "ام سارہ" }, "ur").secondary, "ام سارہ");
eq("no Arabic: UI language first", dedicationLines({ en: "Mary", ru: "Мария" }, "ru"), { primary: "Мария", secondary: null });
eq("no Arabic, other UI: English", dedicationLines({ en: "Mary", ru: "Мария" }, "de"), { primary: "Mary", secondary: null });
eq("only one odd language", dedicationLines({ kk: "Айгүл" }, "en"), { primary: "Айгүл", secondary: null });
eq("same text never repeated", dedicationLines({ ar: "سوهيرمان", en: "سوهيرمان" }, "en").secondary, null);
eq("Arabic script detected", [isArabicScript("سوهيرمان"), isArabicScript("ام سارہ"), isArabicScript("Mary")], [true, true, false]);

// ---- the bundled copy is the old hard-coded list, in order --------------------
eq("fallback: five names", DEDICATIONS_FALLBACK.length, 5);
eq("fallback order", DEDICATIONS_FALLBACK.map((d) => d.names.ar), [
  "ام بلال - باشية حجازي",
  "عبدالله الشرمي",
  "ام عبدو صراميجو",
  "أم فجر جونيرتي",
  "سوهيرمان",
]);

// ---- request form cleanup and list validation ----------------------------------
eq("clean: trims, collapses, drops empty and unknown", cleanDedicationNames({ ar: "  أم   سارة ", en: "", xx: "no", fr: "   " }), { ar: "أم سارة" });
eq("valid list", validDedicationList([{ id: 1, names: { ar: "أ" } }]).length, 1);
eq("invalid list: not an array", validDedicationList({}), null);
eq("invalid list: an entry without a name", validDedicationList([{ id: 1, names: {} }]), null);
eq("languages = the app's", [...DEDICATION_LANGS].sort(), SUPPORTED_LANGS.map((l) => l.code).sort());

// ---- strings complete in every language ------------------------------------------
const keys = (o) => Object.keys(o).sort();
for (const l of SUPPORTED_LANGS) {
  eq(`dedication strings: ${l.code}`, keys(DEDICATION_I18N[l.code] || {}), keys(DEDICATION_I18N.en));
  for (const k of ["verifyTitle", "verifyNote", "verifySend", "verifyCodeSent", "verifySubmit", "verifyDone", "mailFailed", "adminLink"]) {
    eq(`game ${l.code}.${k}`, typeof (GAME_I18N[l.code] || {})[k], "string");
  }
}
eq("admin strings: ar = en keys", keys(ADMIN_I18N.ar), keys(ADMIN_I18N.en));
eq("admin errors: ar = en", keys(ADMIN_I18N.ar.errors), keys(ADMIN_I18N.en.errors));
eq("admin actions: ar = en", keys(ADMIN_I18N.ar.actions), keys(ADMIN_I18N.en.actions));

// ---- API client paths -------------------------------------------------------------
(async () => {
  const api = gameApi("https://x.test/", "tok");
  await api.requestDedication({ ar: "أ" }, "note");
  await api.admin.removeAdmin("a+b@x.test");
  await api.admin.approve(7);
  await api.admin.approve(8, { ar: "ب" });
  await api.admin.reorder([3, 1, 2]);
  await api.verifyEmail("123456");
  eq("request POST", [calls[0].method, calls[0].url, calls[0].body], ["POST", "https://x.test/v1/dedications/requests", { names: { ar: "أ" }, note: "note" }]);
  eq("bearer token sent", calls[0].auth, "Bearer tok");
  eq("admin email is URL-encoded", calls[1].url, "https://x.test/v1/admin/admins/a%2Bb%40x.test");
  eq("approve as is", calls[2].body, {});
  eq("approve with edits", calls[3].body, { names: { ar: "ب" } });
  eq("reorder body", calls[4].body, { ids: [3, 1, 2] });
  eq("verify email", [calls[5].url, calls[5].body], ["https://x.test/v1/auth/verify-email", { code: "123456" }]);

  if (failures.length) {
    console.error(`dedications: ${failures.length} failed, ${passed} passed\n  - ` + failures.join("\n  - "));
    process.exit(1);
  }
  console.log(`dedications: all ${passed} passed`);
})();
