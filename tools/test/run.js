// Dependency-free unit tests for the shared pure helpers in i18n.js.
// Run: node tools/test/run.js   (or: npm test)
//
// i18n.js is a plain script (no exports), so we evaluate it in a vm context and
// read the function declarations off that context's global object.

const fs = require("fs");
const path = require("path");
const vm = require("vm");

// Run against the assembled extension build (the actual shippable artifact),
// which sync-core produces as a flat folder. Run `node tools/sync-core.mjs
// extension` first (npm test does this).
const ROOT = path.resolve(__dirname, "..", "..", "targets", "extension", "build");
const ctx = { Intl, Date, Math, String, Number, Array, Object, JSON, encodeURIComponent, console };
vm.createContext(ctx);
// Append exports so we can read the lexical `const` data arrays off the context.
vm.runInContext(
  fs.readFileSync(path.join(ROOT, "i18n.js"), "utf8") +
    "\nthis.__METHODS = METHODS; this.__DATE_FORMATS = DATE_FORMATS;",
  ctx
);

let passed = 0;
const failures = [];
function eq(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) passed++;
  else failures.push(`${name} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}
function ok(name, cond) {
  if (cond) passed++;
  else failures.push(name);
}

const {
  pad, toArabicDigits, toDevanagariDigits, clampLockMinutes, clampTasbihMinutes,
  apiDate, timingsUrl, usesArabicDigits, isRtl, normalizeTheme,
  normalizeTasbihPosition, prayerLabel, formatTasbihDisplay, tr,
  zonedTimeToTimestamp, prayerTimestamp, randomTasbihPhrase,
  itemLabel, alarmFiredLate, __METHODS, __DATE_FORMATS
} = ctx;

// pad + digit maps
eq("pad pads", pad(5), "05");
eq("toArabicDigits", toArabicDigits("2026"), "٢٠٢٦");
eq("toDevanagariDigits", toDevanagariDigits("19"), "१९");

// clamps
eq("clampLock NaN -> default", clampLockMinutes("x"), 5);
eq("clampLock caps at 120", clampLockMinutes(999), 120);
eq("clampLock floors at 1", clampLockMinutes(0), 1);
eq("clampLock rounds", clampLockMinutes(7.6), 8);
eq("clampTasbih uses fallback", clampTasbihMinutes(undefined, 15), 15);
eq("clampTasbih caps", clampTasbihMinutes(500, 15), 120);

// apiDate
eq("apiDate DD-MM-YYYY", apiDate(new Date(2026, 0, 5)), "05-01-2026");

// timingsUrl
eq("timingsUrl city",
  timingsUrl({ mode: "city", city: "Al Khobar", country: "Saudi Arabia", method: 4 }, "05-01-2026"),
  "https://api.aladhan.com/v1/timingsByCity/05-01-2026?city=Al%20Khobar&country=Saudi%20Arabia&method=4");
eq("timingsUrl coords",
  timingsUrl({ mode: "coords", latitude: 24.7, longitude: 46.7, method: 2 }, "05-01-2026"),
  "https://api.aladhan.com/v1/timings/05-01-2026?latitude=24.7&longitude=46.7&method=2");
ok("timingsUrl default method=2",
  timingsUrl({ mode: "city", city: "X", country: "Y" }, "01-01-2026").includes("method=2"));

// language predicates
eq("usesArabicDigits ar+true", usesArabicDigits("ar", true), true);
eq("usesArabicDigits en", usesArabicDigits("en", true), false);
eq("isRtl ar", isRtl("ar"), true);
eq("isRtl en", isRtl("en"), false);

// normalizers
eq("normalizeTheme classic", normalizeTheme("classic"), "classic");
eq("normalizeTheme junk -> default", normalizeTheme("xyz"), "midnight-emerald");
eq("normalizeTasbihPosition valid", normalizeTasbihPosition("bottom-left"), "bottom-left");
eq("normalizeTasbihPosition junk -> default", normalizeTasbihPosition("nope"), "top-center");

// prayerLabel: Friday midday becomes Jumu'ah
const L = tr("en");
eq("Dhuhr on Friday -> Jumuah", prayerLabel(L, "Dhuhr", new Date(2026, 0, 2)), "Jumu'ah");
eq("Dhuhr on Thursday -> Dhuhr", prayerLabel(L, "Dhuhr", new Date(2026, 0, 1)), "Dhuhr");

// formatTasbihDisplay: non-Arabic always carries the Arabic original on a 2nd line
const fr = formatTasbihDisplay({ ar: "سُبْحَانَ اللَّهِ", en: "Subhan Allah", fr: "Gloire à Allah" }, "fr");
eq("fr dhikr has 2 lines", fr.lines.length, 2);
eq("fr dhikr 2nd line is arabic", fr.lines[1].variant, "arabic");
eq("ar dhikr has 1 line", formatTasbihDisplay({ ar: "سُبْحَانَ اللَّهِ" }, "ar").lines.length, 1);

// timezone conversion (correctness of the H3 fix)
eq("tz Riyadh +3", zonedTimeToTimestamp(2026, 6, 30, 5, 0, "Asia/Riyadh"), Date.UTC(2026, 5, 30, 2, 0, 0));
eq("tz NY EDT -4", zonedTimeToTimestamp(2026, 6, 30, 5, 0, "America/New_York"), Date.UTC(2026, 5, 30, 9, 0, 0));
eq("tz NY EST -5", zonedTimeToTimestamp(2026, 1, 15, 5, 0, "America/New_York"), Date.UTC(2026, 0, 15, 10, 0, 0));
eq("prayerTimestamp unparseable -> null", prayerTimestamp("nope", new Date(), "UTC"), null);

// randomTasbihPhrase falls back gracefully when TASBIH_PHRASES isn't loaded
const r = randomTasbihPhrase("en");
ok("randomTasbihPhrase returns lines", r && Array.isArray(r.lines) && r.lines.length >= 1);

// itemLabel must NOT use a structural field as a label when the language code
// collides with it (Indonesian "id"); it should fall back to English.
eq("itemLabel method, id-lang -> en name", itemLabel({ value: 2, en: "ISNA", ar: "x" }, "id"), "ISNA");
eq("itemLabel date-format, id-lang -> en", itemLabel({ value: "dd-mm-yyyy", en: "10-04-2026", ar: "x" }, "id"), "10-04-2026");
eq("itemLabel ar still wins", itemLabel({ value: 2, en: "ISNA", ar: "آيزنا" }, "ar"), "آيزنا");
eq("itemLabel real id translation kept", itemLabel({ key: "x", en: "Top", id: "Atas" }, "id"), "Atas");

// METHODS / DATE_FORMATS shape after the id->value rename + additions.
eq("METHODS count", __METHODS.length, 20);
ok("METHODS values all numeric", __METHODS.every((m) => typeof m.value === "number"));
ok("METHODS exclude Shia (0,7)", __METHODS.every((m) => m.value !== 0 && m.value !== 7));
ok("METHODS dropped legacy id field", __METHODS.every((m) => !("id" in m)));
ok("METHODS include Kemenag(20)+JAKIM(17)", __METHODS.some((m) => m.value === 20) && __METHODS.some((m) => m.value === 17));
ok("DATE_FORMATS use value (no id)", __DATE_FORMATS.every((f) => !("id" in f) && typeof f.value === "string"));

// alarmFiredLate gate (startup notification-flood fix).
const T = 1_700_000_000_000;
eq("alarm ~on time -> not late", alarmFiredLate(T - 30_000, T, 120_000), false);
eq("alarm hours late -> late", alarmFiredLate(T - 3_600_000, T, 120_000), true);
eq("alarm missing scheduledTime -> late", alarmFiredLate(undefined, T, 120_000), true);

if (failures.length) {
  console.error(`\n${passed} passed, ${failures.length} FAILED:`);
  for (const f of failures) console.error("  ✗ " + f);
  process.exit(1);
}
console.log(`\n${passed} tests passed`);
