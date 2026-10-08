// Family alerts (core/logic/family-alerts.js): when a parent's device checks,
// and what the notification says. Evaluated against the assembled extension
// build with i18n.js and the prayer engine, like logic.js.
// Run: node tools/test/family.js  (npm test assembles first).

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..", "..", "targets", "extension", "build");
const ctx = { Intl, Date, Math, String, Number, Array, Object, JSON, encodeURIComponent, console };
vm.createContext(ctx);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx, { filename: f });
for (const f of ["i18n.js", "vendor/adhan.js", "vendor/tz-lookup.js", "prayer-engine.js", "family-alerts.js"]) load(f);
vm.runInContext(
  "this.__f = { planFamilyChecks, parseFamilyCheck, familyAlertTemplates, fillFamilyAlert, I18N, SUPPORTED_LANGS };" +
    "this.__engine = PrayerEngine;",
  ctx
);
const { planFamilyChecks, parseFamilyCheck, familyAlertTemplates, fillFamilyAlert, I18N, SUPPORTED_LANGS } = ctx.__f;

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

// A fake engine: fixed local times every day (device time zone).
const TIMES = { Fajr: "05:00", Sunrise: "06:20", Dhuhr: "12:00", Asr: "15:30", Maghrib: "18:00", Isha: "19:30" };
const engine = { timings: () => ({ timings: TIMES, meta: {} }) };
const at = (d, hm) => new Date(`${d}T${hm}:00`).getTime();
const MIN = 60000;

// ---- planning ----
{
  const now = new Date("2026-10-08T13:00:00");
  eq("off plans nothing", planFamilyChecks(engine, {}, now, "off"), []);
  const w = planFamilyChecks(engine, {}, now, "window");
  // Today's Dhuhr closes at Asr; yesterday's and today's earlier ones are past.
  eq("first window check", { id: w[0].id, when: w[0].when, keys: w[0].keys }, {
    id: "family:window:2026-10-08:Dhuhr", when: at("2026-10-08", "15:30") + 5 * MIN, keys: ["2026-10-08:Dhuhr"],
  });
  const isha = w.find((c) => c.id === "family:window:2026-10-08:Isha");
  eq("Isha closes at the next Fajr", isha && isha.when, at("2026-10-09", "05:00") + 5 * MIN);
  ok("sorted, all in the future", w.every((c, i) => c.when > now.getTime() && (i === 0 || w[i - 1].when <= c.when)));
  eq("window checks today + tomorrow", w.length, 4 + 5);

  const d = planFamilyChecks(engine, {}, now, "daily");
  eq("daily: one per day, at the next Fajr", d.map((c) => [c.id, c.when]), [
    ["family:daily:2026-10-08", at("2026-10-09", "05:00") + 5 * MIN],
    ["family:daily:2026-10-09", at("2026-10-10", "05:00") + 5 * MIN],
  ]);
  eq("daily keys are the day's five", d[0].keys, ["2026-10-08:Fajr", "2026-10-08:Dhuhr", "2026-10-08:Asr", "2026-10-08:Maghrib", "2026-10-08:Isha"]);

  // After midnight, last night's Isha window (and yesterday's summary) are still ahead.
  const early = planFamilyChecks(engine, {}, new Date("2026-10-09T02:00:00"), "window");
  eq("after midnight keeps last night's Isha", early[0].id, "family:window:2026-10-08:Isha");
  eq("after midnight keeps yesterday's summary", planFamilyChecks(engine, {}, new Date("2026-10-09T02:00:00"), "daily")[0].id, "family:daily:2026-10-08");
}

// ---- ids round-trip (alarm names) ----
eq("parse window id", parseFamilyCheck("family:window:2026-10-08:Asr"), {
  id: "family:window:2026-10-08:Asr", kind: "window", day: "2026-10-08", prayer: "Asr", keys: ["2026-10-08:Asr"],
});
eq("parse daily id", parseFamilyCheck("family:daily:2026-10-08").keys.length, 5);

// ---- messages ----
const status = (windowsByChild) => ({
  notify: "window",
  children: Object.entries(windowsByChild).map(([name, windows]) => ({ username: name, displayName: name, windows })),
});
{
  const check = { kind: "window", keys: ["2026-10-08:Asr"], prayer: "Asr", day: "2026-10-08" };
  const tpl = familyAlertTemplates("en", check);
  const st = status({
    Ahmad: { "2026-10-08:Asr": { done: 4, total: 10, complete: false } },
    Sara: { "2026-10-08:Asr": { done: 10, total: 10, complete: true } },
    Omar: { "2026-10-08:Asr": { done: 0, total: 10, complete: false } },
  });
  eq("window: names who didn't finish", fillFamilyAlert(tpl, check, st), {
    title: "Ahmad, Omar: the Asr adhkar aren't done",
    body: "Tap to see your family's progress.",
  });
  eq("window: everyone finished -> nothing", fillFamilyAlert(tpl, check, status({ Sara: { "2026-10-08:Asr": { complete: true } } })), null);
  eq("window: no children -> nothing", fillFamilyAlert(tpl, check, { children: [] }), null);
  const ar = fillFamilyAlert(familyAlertTemplates("ar", check), check, st);
  eq("window: Arabic with Arabic comma", ar.title, "Ahmad، Omar: لم تكتمل مهمات صلاة العصر");
  // Friday's Dhuhr is Jumu'ah.
  const fri = { kind: "window", keys: ["2026-10-09:Dhuhr"], prayer: "Dhuhr", day: "2026-10-09" };
  ok("Friday Dhuhr is named Jumu'ah", familyAlertTemplates("en", fri).title.includes(I18N.en.prayers.Jumuah || "Dhuhr"));
}
{
  const check = parseFamilyCheck("family:daily:2026-10-08");
  const tpl = familyAlertTemplates("en", check);
  const k = (p) => `2026-10-08:${p}`;
  const st = {
    notify: "daily",
    children: [
      { username: "ahmad", displayName: "Ahmad", windows: { [k("Fajr")]: { complete: false }, [k("Dhuhr")]: { complete: true }, [k("Isha")]: { complete: false } } },
      { username: "sara", displayName: "", windows: { [k("Fajr")]: { complete: true } } },
    ],
  };
  eq("daily: one line per child who missed", fillFamilyAlert(tpl, check, st), {
    title: "Yesterday's family adhkar",
    body: "Ahmad didn't finish: Fajr, Isha",
  });
  st.children[0].windows[k("Fajr")].complete = true;
  st.children[0].windows[k("Isha")].complete = true;
  eq("daily: all done", fillFamilyAlert(tpl, check, st).body, I18N.en.familyDailyAllDone);
}

// ---- every language has the alert strings ----
for (const { code } of SUPPORTED_LANGS) {
  const L = I18N[code];
  ok(`${code}: family alert strings`, L && typeof L.familyWindowTitle === "function" && typeof L.familyDailyLine === "function" &&
    typeof L.familyWindowBody === "string" && typeof L.familyDailyTitle === "string" && typeof L.familyDailyAllDone === "string");
  const t = familyAlertTemplates(code, { kind: "window", keys: ["2026-10-08:Asr"], prayer: "Asr", day: "2026-10-08" });
  ok(`${code}: window template keeps {names}`, t.title.includes("{names}"));
  const d = familyAlertTemplates(code, { kind: "daily", keys: [], day: "2026-10-08" });
  ok(`${code}: daily template keeps {name} and {prayers}`, d.line.includes("{name}") && d.line.includes("{prayers}"));
}

if (failures.length) {
  console.error(`family: ${failures.length} failed\n  ` + failures.join("\n  "));
  process.exit(1);
}
console.log(`family: all ${passed} passed`);
