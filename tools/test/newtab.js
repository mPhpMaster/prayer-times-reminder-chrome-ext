// New-tab performance regressions: timestamp parity, calendar boundaries,
// cache invalidation, lazy dependencies and small task-progress snapshots.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "../..");
let checks = 0;
function check(value, message) { assert.ok(value, message); checks++; }
function load(context, files) {
  for (const file of files) vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, { filename: file });
}

const context = vm.createContext({ Date, Intl, console });
load(context, [
  "core/data/i18n.js", "core/platform/vendor/adhan.js", "core/platform/vendor/tz-lookup.js",
  "core/logic/prayer-engine.js", "core/logic/game-score.js", "core/logic/game-windows.js",
  "targets/extension/newtab-config.js", "targets/extension/newtab-prayers.js",
]);

const places = [
  [24.7136, 46.6753], [51.5074, -0.1278], [40.7128, -74.006],
  [-33.8688, 151.2093], [21.3099, -157.8581], [35.6762, 139.6503],
];
const originalTimezone = process.env.TZ;
try {
  for (const timezone of ["UTC", "Asia/Riyadh", "America/New_York", "Europe/London"]) {
    process.env.TZ = timezone;
    for (const [latitude, longitude] of places) {
      for (const date of ["2026-03-08T12:00:00", "2026-03-29T12:00:00", "2026-10-29T00:30:00", "2026-11-01T12:00:00"]) {
        context.location = { latitude, longitude, method: 4 };
        context.now = new Date(date);
        const equal = vm.runInContext(`(() => {
          const data = PrayerEngine.timings(location, now);
          const stamps = PrayerEngine.timestamps(location, now);
          return NewTabConfig.prayers.every(p => stamps[p] === prayerTimestamp(data.timings[p], now, data.meta.timezone));
        })()`, context);
        check(equal, `Raw prayer instants preserve existing timings: ${timezone}, ${latitude}, ${date}`);
      }
    }
  }
} finally {
  if (originalTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimezone;
}

context.location = { latitude: 24.7136, longitude: 46.6753, method: 4 };
context.now = new Date("2026-10-29T12:00:00");
check(vm.runInContext(`(() => {
  const today = NewTabPrayers.schedule(PrayerEngine, location, now);
  const instants = [today.at.Fajr - 1, ...NewTabConfig.five.flatMap(p => [today.at[p], today.at[p] + 1])];
  return instants.every(at => {
    const cached = NewTabPrayers.currentWindow(today, at);
    const original = currentWindow(PrayerEngine, location, new Date(at));
    return cached.key === original.key && cached.prayer === original.prayer;
  });
})()`, context), "Cached schedule keeps the task window correct at every prayer boundary and before Fajr");

const fixture = JSON.parse(vm.runInContext("JSON.stringify(NewTabPrayers.schedule(PrayerEngine, location, now))", context));
context.fixture = fixture;
check(vm.runInContext("NewTabPrayers.validSchedule(fixture, NewTabPrayers.cacheKey(location, now))", context), "Current schedule is reusable");
for (const expression of [
  "NewTabPrayers.cacheKey({...location, method: 2}, now)",
  "NewTabPrayers.cacheKey({...location, longitude: 47}, now)",
  "NewTabPrayers.cacheKey(location, new Date(now.getTime() + 86400000))",
]) check(vm.runInContext(`!NewTabPrayers.validSchedule(fixture, ${expression})`, context), "Changed method, city or day invalidates the cache");
check(vm.runInContext("!NewTabPrayers.validSchedule({...fixture, previousDay: undefined}, fixture.key)", context), "Malformed cached schedules are rejected");
for (const location of [null, {}, { latitude: null, longitude: 0 }, { latitude: 91, longitude: 0 }, { latitude: 0, longitude: Infinity }]) {
  context.invalidLocation = location;
  check(vm.runInContext("!NewTabPrayers.validLocation(invalidLocation)", context), "Missing or invalid coordinates do not launch calculation");
}

context.catalog = { Isha: ["one", "two", "three"] };
context.state = { windows: { "2026-10-28:Isha": { tasks: { one: { doneAt: 10 }, two: {}, ignored: { doneAt: 10 } } } } };
context.at = fixture.at.Fajr - 1;
const summary = JSON.parse(vm.runInContext("JSON.stringify(NewTabPrayers.taskSummary(NewTabPrayers.progress(fixture, state, at), catalog))", context));
assert.deepEqual(summary, { prayer: "Isha", total: 3, done: 1 }); checks++;
check(vm.runInContext("!('windows' in NewTabPrayers.progress(fixture, state, at))", context), "The UI retains a small progress summary rather than game history");

async function testDataAccess() {
  const loaded = [];
  let cached = fixture;
  let engineCalls = 0;
  let sessionFails = false;
  const data = vm.createContext({
    Date, Intl, console, AbortSignal,
    document: {
      createElement: () => ({ remove() {} }),
      head: { append: (script) => { loaded.push(script.src); queueMicrotask(() => script.onload()); } },
    },
    chrome: { storage: {
      session: {
        get: async () => { if (sessionFails) throw Error("Unavailable"); return { newTabPrayerSchedule: cached }; },
        set: async (value) => { if (sessionFails) throw Error("Unavailable"); cached = value.newTabPrayerSchedule; },
      },
      local: { get: async () => ({ gameState: {} }) },
    } },
    PrayerEngine: { timestamps: () => { engineCalls++; return fixture.at; } },
    location: context.location, now: context.now,
  });
  load(data, ["targets/extension/newtab-config.js", "targets/extension/newtab-prayers.js", "targets/extension/newtab-data.js"]);
  await vm.runInContext("NewTabData.schedule(location, now)", data);
  check(engineCalls === 0 && loaded.length === 0, "A warm tab loads neither the prayer libraries nor the timezone database");
  cached = null;
  await vm.runInContext("NewTabData.schedule(location, now)", data);
  assert.deepEqual(loaded, ["vendor/adhan.js", "prayer-engine.js"]); checks++;
  check(engineCalls === 3, "A cold tab calculates only today, tomorrow and yesterday");
  await vm.runInContext("NewTabData.schedule(location, now)", data);
  check(engineCalls === 3 && loaded.length === 2, "Subsequent tabs reuse the computed schedule");
  sessionFails = true;
  await vm.runInContext("NewTabData.schedule(location, now)", data);
  check(engineCalls === 6, "Unavailable session storage falls back to offline calculation");
}

testDataAccess().then(() => console.log(`newtab: all ${checks} checks passed`)).catch((error) => { console.error(error); process.exitCode = 1; });
