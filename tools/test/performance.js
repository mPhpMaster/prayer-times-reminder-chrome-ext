// Lifecycle and caching regressions that can multiply across Chrome tabs.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ROOT = path.resolve(__dirname, "../..");
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }
function events() {
  const handlers = new Map();
  return {
    addEventListener(type, fn) { if (!handlers.has(type)) handlers.set(type, new Set()); handlers.get(type).add(fn); },
    removeEventListener(type, fn) { handlers.get(type)?.delete(fn); },
    dispatch(type, event = {}) { for (const fn of [...(handlers.get(type) || [])]) fn(event); },
    count() { return [...handlers.values()].reduce((n, set) => n + set.size, 0); },
  };
}

const timers = new Map();
let timerId = 0;
const document = { ...events(), hidden: false, body: { classList: { toggle() {} } } };
const window = events();
const context = vm.createContext({
  document, window, Date, Intl, console,
  setInterval: fn => { const id = ++timerId; timers.set(id, fn); return id; },
  clearInterval: id => timers.delete(id),
});
for (const file of ["core/ui/page-clock.js", "core/logic/prayer-instant-cache.js", "core/logic/game-totals-cache.js"]) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, { filename: file });
}
const createClock = vm.runInContext("createPageClock", context);
let calls = 0;
let enabled = true;
let microphone = false;
const clock = createClock(() => calls++, { enabled: () => enabled, runWhenHidden: () => microphone });
check(calls === 1 && timers.size === 1, "A visible page starts exactly one clock");
document.hidden = true;
document.dispatch("visibilitychange");
check(timers.size === 0 && calls === 1, "A hidden page performs no periodic work");
microphone = true;
clock.refresh(false);
check(timers.size === 1 && calls === 1, "An active microphone keeps a deadline timer without a reentrant render");
[...timers.values()][0]();
check(calls === 2, "The microphone deadline callback remains live while hidden");
microphone = false;
clock.refresh(false);
check(timers.size === 0, "Stopping the microphone removes its hidden deadline polling");
document.hidden = false;
document.dispatch("visibilitychange");
check(timers.size === 1 && calls === 3, "Returning to the tab refreshes its clock immediately");
for (let i = 0; i < 20; i++) clock.refresh();
check(timers.size === 1, "Repeated refreshes cannot accumulate timers");
enabled = false;
clock.refresh();
check(timers.size === 0, "Opening Settings pauses a countdown whose surface is not displayed");
enabled = true;
clock.refresh();
window.dispatch("pagehide");
check(timers.size === 0, "Navigating away releases the interval");
window.dispatch("pageshow", { persisted: true });
check(timers.size === 1, "A back/forward-cache restore resumes the interval");
clock.stop();
check(timers.size === 0 && document.count() === 0 && window.count() === 0, "Replacing a clock releases all event listeners and timers");
clock.refresh();
check(timers.size === 0, "A disposed clock cannot restart");

const createInstants = vm.runInContext("createPrayerInstantCache", context);
let parses = 0;
const instant = createInstants((text, date, zone) => { parses++; return `${text}:${date.getDate()}:${zone}`; });
const today = new Date("2026-10-29T12:00:00");
for (let i = 0; i < 1000; i++) instant("04:30", today, "Asia/Riyadh");
check(parses === 1, "A thousand countdown reads resolve the same instant once");
instant("04:30", today, "Europe/London");
check(parses === 2, "Changing the selected timezone invalidates instants");
instant("04:30", new Date("2026-10-30T12:00:00"), "Europe/London");
check(parses === 3, "A new calendar date invalidates instants");
const bounded = createInstants(text => { parses++; return text; });
for (let i = 0; i < 20; i++) bounded(`${i}:00`, today, "UTC");
const count = parses;
bounded("0:00", today, "UTC");
check(parses === count + 1, "Unexpected distinct timing strings cannot grow the cache without bound");

const createTotals = vm.runInContext("createGameTotalsCache", context);
let scans = 0;
const totals = createTotals((state, prefix) => { scans++; return prefix.length === 10 ? state.day : state.month; });
const state = { day: 10, month: 100 };
for (let i = 0; i < 1000; i++) totals.read(state, "2026-10-29");
check(scans === 2, "A thousand game ticks scan history only once per total");
state.day = 30;
totals.invalidate();
check(totals.read(state, "2026-10-29").day === 30 && scans === 4, "Saving a changed completion refreshes totals");
totals.read(state, "2026-10-30");
check(scans === 6, "Changing the task day refreshes daily and monthly totals");

// Numeric planner paths must preserve scheduled instants, IDs and window keys.
for (const file of ["core/data/i18n.js", "core/platform/vendor/adhan.js", "core/platform/vendor/tz-lookup.js", "core/logic/prayer-engine.js", "core/logic/notify-plan.js", "core/logic/family-alerts.js"]) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, { filename: file });
}
for (const location of [
  { latitude: 24.7136, longitude: 46.6753, method: 4 },
  { latitude: 51.5074, longitude: -0.1278, method: 3 },
  { latitude: 40.7128, longitude: -74.006, method: 2 },
]) {
  context.testLocation = location;
  for (const date of ["2026-03-08T00:30:00", "2026-03-29T12:00:00", "2026-11-01T12:00:00"]) {
    context.testDate = new Date(date);
    check(vm.runInContext(`(() => {
      const legacy = { timings: PrayerEngine.timings };
      const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
      const plans = engine => [planPrayerNotifications(engine, testLocation, testDate, 2, prayers),
        planGameAlerts(engine, testLocation, testDate, 2, prayers), planFamilyChecks(engine, testLocation, testDate, 'window')];
      return JSON.stringify(plans(PrayerEngine)) === JSON.stringify(plans(legacy));
    })()`, context), "Faster prayer/game/family planners keep notification times and IDs unchanged");
  }
}

// A hidden reminder must not retain its root for an invisible fade-out timer.
for (const hidden of [true, false]) {
  let removed = false;
  let fadeDelay = 0;
  const root = { remove() { removed = true; }, shadowRoot: { querySelector: () => ({ classList: { add() {} } }) } };
  const overlay = vm.createContext({ window: {}, document: { hidden, getElementById: () => root },
    setTimeout(fn, delay) { fadeDelay = delay; return 1; }, clearTimeout() {} });
  vm.runInContext(fs.readFileSync(path.join(ROOT, "core/ui/overlay-tasbih.js"), "utf8"), overlay);
  overlay.window.__prayerTasbihClear();
  check(hidden ? removed && fadeDelay === 0 : !removed && fadeDelay === 200,
    hidden ? "Hidden dhikr cards are removed without an animation timer" : "Visible dhikr cards retain their dismissal animation");
}

console.log(`performance: all ${checks} checks passed`);
