// Dependency-free unit tests for the extracted pure core logic
// (scheduler-core.js + dhikr-core.js), evaluated against the assembled build
// alongside i18n.js (which provides prayerTimestamp / clampTasbihMinutes /
// DEFAULT_TASBIH_*). Run: node tools/test/logic.js  (npm test assembles first).

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..", "..", "targets", "extension", "build");
const ctx = { Intl, Date, Math, String, Number, Array, Object, JSON, encodeURIComponent, console };
vm.createContext(ctx);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx, { filename: f });
load("i18n.js");
load("vendor/adhan.js");
load("vendor/tz-lookup.js");
load("prayer-engine.js");
load("scheduler-core.js");
load("dhikr-core.js");
load("notify-plan.js");
load("lock-config.js");
vm.runInContext(
  "this.__sched = { planPrayerAlarms, nextRefreshTime };" +
    "this.__dhikr = { normalizeTasbihSettings, tasbihAlarmOptions, randomBetweenInclusive };" +
    "this.__engine = PrayerEngine;",
  ctx
);

const { planPrayerAlarms, nextRefreshTime } = ctx.__sched;
const { normalizeTasbihSettings, tasbihAlarmOptions } = ctx.__dhikr;
const PrayerEngine = ctx.__engine;

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

// ---- scheduler-core.planPrayerAlarms ----------------------------------------
// Stub prayerTimestamp so the filter/shape logic is tested deterministically,
// independent of the runner's timezone (the real prayerTimestamp is covered by
// run.js). Each prayer maps to a fixed instant; `now` is a fake at t=1500.
const PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
const STUB = { Fajr: 1000, Dhuhr: 2000, Asr: 3000, Maghrib: 4000, Isha: 5000 };
ctx.prayerTimestamp = (timeStr) => (timeStr in STUB ? STUB[timeStr] : null);
const fakeNow = (t) => ({ getTime: () => t });
const timings = { Fajr: "Fajr", Dhuhr: "Dhuhr", Asr: "Asr", Maghrib: "Maghrib", Isha: "Isha" };
const plan = planPrayerAlarms(timings, PRAYERS, fakeNow(1500), "UTC");

eq("plan drops past Fajr, keeps 4 future", plan.map((p) => p.id), [
  "prayer:Dhuhr", "prayer:Asr", "prayer:Maghrib", "prayer:Isha"
]);
ok("plan Dhuhr carries its instant", plan[0].when === 2000);
ok("plan whens strictly ascending", plan.every((p, i) => i === 0 || p.when > plan[i - 1].when));
eq("plan skips missing/unparseable timing",
  planPrayerAlarms({ Dhuhr: "Dhuhr", Asr: "nope" }, PRAYERS, fakeNow(1500), "UTC").map((p) => p.id),
  ["prayer:Dhuhr"]);
eq("plan empty when all past", planPrayerAlarms(timings, PRAYERS, fakeNow(9000), "UTC"), []);

// ---- scheduler-core.nextRefreshTime -----------------------------------------
const noonToday = new Date(2026, 5, 30, 12, 0, 0); // local noon
const ref = nextRefreshTime(noonToday);
const refDate = new Date(ref);
ok("refresh is in the future", ref > noonToday.getTime());
eq("refresh at 00:01 local", [refDate.getHours(), refDate.getMinutes(), refDate.getSeconds()], [0, 1, 0]);
ok("refresh is tomorrow (local date advances by 1)",
  refDate.getDate() === new Date(noonToday.getTime() + 24 * 3.6e6).getDate());

// ---- dhikr-core.normalizeTasbihSettings -------------------------------------
eq("dhikr defaults: disabled, fixed",
  normalizeTasbihSettings({}),
  { enabled: false, mode: "fixed", intervalMinutes: 15, randomMin: 5, randomMax: 15 });
eq("dhikr enabled + random mode",
  normalizeTasbihSettings({ tasbihEnabled: true, tasbihIntervalMode: "random" }).enabled, true);
eq("dhikr swaps min>max",
  (() => { const s = normalizeTasbihSettings({ tasbihRandomMin: 40, tasbihRandomMax: 12 }); return [s.randomMin, s.randomMax]; })(),
  [12, 40]);
eq("dhikr clamps interval to 120", normalizeTasbihSettings({ tasbihIntervalMinutes: 999 }).intervalMinutes, 120);
eq("dhikr non-random mode -> fixed", normalizeTasbihSettings({ tasbihIntervalMode: "weird" }).mode, "fixed");

// ---- dhikr-core.tasbihAlarmOptions ------------------------------------------
eq("fixed -> periodInMinutes",
  tasbihAlarmOptions({ mode: "fixed", intervalMinutes: 15 }),
  { periodInMinutes: 15 });
eq("random -> delayInMinutes (injected rand)",
  tasbihAlarmOptions({ mode: "random", randomMin: 10, randomMax: 30 }, (a, b) => a + b),
  { delayInMinutes: 40 });
ok("random delay within bounds (real rand)",
  (() => { const o = tasbihAlarmOptions({ mode: "random", randomMin: 5, randomMax: 9 }); return o.delayInMinutes >= 5 && o.delayInMinutes <= 9; })());

// ---- prayer-engine (offline, network-free) ----------------------------------
const riyadh = { latitude: 24.7136, longitude: 46.6753, method: 4 };
ok("tzForCoords resolves Riyadh", PrayerEngine.tzForCoords(24.7136, 46.6753) === "Asia/Riyadh");
ok("adhanParamsForMethod returns params object", typeof PrayerEngine.adhanParamsForMethod(4) === "object");
const out = PrayerEngine.timings(riyadh, new Date(2026, 5, 30));
ok("engine timezone is Riyadh", out.meta.timezone === "Asia/Riyadh");
ok("engine Fajr is HH:MM", /^\d{2}:\d{2}$/.test(out.timings.Fajr));
ok("engine has all 6 timings",
  ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"].every((k) => /^\d{2}:\d{2}$/.test(out.timings[k])));
ok("engine gregorian DD-MM-YYYY", /^\d{2}-\d{2}-\d{4}$/.test(out.date.gregorian.date));
ok("engine hijri has month name + number",
  !!out.date.hijri.month.en && !!out.date.hijri.month.ar && typeof out.date.hijri.month.number === "number");
ok("engine times ordered Fajr<Dhuhr<Maghrib",
  out.timings.Fajr < out.timings.Dhuhr && out.timings.Dhuhr < out.timings.Maghrib);
const qb = PrayerEngine.qibla(riyadh);
ok("qibla is a bearing 0..360", typeof qb === "number" && qb >= 0 && qb <= 360);

// ---- notify-plan (rolling notification expansion) ---------------------------
// Date-aware prayerTimestamp stub + a fixed-timings engine, so the test is
// independent of the runner timezone.
ctx.prayerTimestamp = (timeStr, date) => {
  const hour = { "05:00": 5, "12:00": 12 }[timeStr];
  if (hour == null) return null;
  const d = new Date(date);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
};
const stubEngine = { timings: () => ({ timings: { Fajr: "05:00", Dhuhr: "12:00" }, meta: { timezone: "UTC" } }) };
const noon6am = new Date(2026, 5, 30, 6, 0, 0); // local 06:00 → today's Fajr is past
const notifs = ctx.planPrayerNotifications(stubEngine, riyadh, noon6am, 2, ["Fajr", "Dhuhr"]);
eq("notify: drops today's past Fajr, keeps 3 over 2 days", notifs.length, 3);
ok("notify: all future", notifs.every((n) => n.when > noon6am.getTime()));
ok("notify: ascending whens", notifs.every((n, i) => i === 0 || n.when > notifs[i - 1].when));
ok("notify: integer ids, unique", new Set(notifs.map((n) => n.id)).size === notifs.length && notifs.every((n) => Number.isInteger(n.id)));
ok("notify: carries prayer key", notifs.every((n) => n.prayer === "Fajr" || n.prayer === "Dhuhr"));

// ---- lock-config (shared overlay config builder) ----------------------------
const lc = ctx.buildLockConfig(
  { lang: "en", theme: "classic", arabicDigits: false, lockMinutes: 5, allowUnlock: false },
  { prayerName: "Fajr" }
);
ok("lock-config theme normalized", lc.theme === "classic");
eq("lock-config duration 5min -> 300s", lc.durationSecs, 300);
ok("lock-config unlockAt future", lc.unlockAt > Date.now());
eq("lock-config carries prayerName", lc.prayerName, "Fajr");
ok("lock-config title is non-empty string", typeof lc.title === "string" && lc.title.length > 0);
ok("lock-config allowUnlock false", lc.allowUnlock === false);
ok("lock-config has dir + lang + countdownPrefix",
  !!lc.dir && lc.lang === "en" && typeof lc.countdownPrefix === "string");
const lct = ctx.buildLockConfig({ lang: "en", allowUnlock: true }, { test: true });
eq("lock-config test -> 10s", lct.durationSecs, 10);
ok("lock-config test prayerName non-empty", typeof lct.prayerName === "string" && lct.prayerName.length > 0);
ok("lock-config allowUnlock true honored", lct.allowUnlock === true);
ok("lock-config clamps absurd lockMinutes",
  ctx.buildLockConfig({ lang: "en", lockMinutes: 9999 }, { prayerName: "X" }).durationSecs === 120 * 60);

if (failures.length) {
  console.error(`\n${passed} passed, ${failures.length} FAILED:`);
  for (const f of failures) console.error("  ✗ " + f);
  process.exit(1);
}
console.log(`\n${passed} logic tests passed`);
