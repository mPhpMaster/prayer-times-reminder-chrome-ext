// validate-adhan — compare the offline prayer-engine against the Aladhan API for
// a spread of cities + methods, printing the minute difference per prayer. Used
// in Phase 2 to confirm 0–1 min parity before dropping the API. Needs network.
//
//   node tools/validate-adhan.mjs

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Load the vendored libs + engine into one classic-script-like context.
const sandbox = { console, Intl, Date, Math, globalThis: null };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of [
  "core/platform/vendor/adhan.js",
  "core/platform/vendor/tz-lookup.js",
  "core/logic/prayer-engine.js",
]) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), sandbox, { filename: f });
}
// PrayerEngine is a top-level lexical const (accessible to sibling scripts at
// runtime); surface it onto the context object so this harness can read it.
vm.runInContext("this.PrayerEngine = PrayerEngine;", sandbox);
const PrayerEngine = sandbox.PrayerEngine;

const CITIES = [
  { name: "Riyadh", latitude: 24.7136, longitude: 46.6753, method: 4 },
  { name: "Makkah", latitude: 21.3891, longitude: 39.8579, method: 4 },
  { name: "Cairo", latitude: 30.0444, longitude: 31.2357, method: 5 },
  { name: "Karachi", latitude: 24.8607, longitude: 67.0011, method: 1 },
  { name: "London", latitude: 51.5074, longitude: -0.1278, method: 3 },
  { name: "New York", latitude: 40.7128, longitude: -74.006, method: 2 },
  { name: "Istanbul", latitude: 41.0082, longitude: 28.9784, method: 13 },
  { name: "Jakarta", latitude: -6.2088, longitude: 106.8456, method: 20 },
  { name: "Singapore", latitude: 1.3521, longitude: 103.8198, method: 11 },
  { name: "Kuwait City", latitude: 29.3759, longitude: 47.9774, method: 9 },
];
const PRAYERS = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];

function toMinutes(hhmm) {
  const m = String(hhmm).match(/(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function ddmmyyyy(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
}

async function aladhan(city, dateStr) {
  const url =
    `https://api.aladhan.com/v1/timings/${dateStr}` +
    `?latitude=${city.latitude}&longitude=${city.longitude}&method=${city.method}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Aladhan ${res.status}`);
  const json = await res.json();
  if (json.code !== 200) throw new Error("Aladhan bad response");
  return json.data.timings;
}

async function main() {
  const now = new Date();
  const dateStr = ddmmyyyy(now);
  let maxDiff = 0;
  let rows = 0;
  let net = 0;
  console.log(`Comparing engine vs Aladhan for ${dateStr}\n`);
  console.log("city           method " + PRAYERS.map((p) => p.padStart(8)).join("") + "   tz");
  for (const city of CITIES) {
    let api;
    try {
      api = await aladhan(city, dateStr);
      net++;
    } catch (e) {
      console.log(`${city.name.padEnd(14)} ${String(city.method).padEnd(6)} (network: ${e.message})`);
      continue;
    }
    const mine = PrayerEngine.timings(city, now);
    const diffs = PRAYERS.map((p) => {
      const a = toMinutes(api[p]);
      const b = toMinutes(mine.timings[p]);
      if (a == null || b == null) return "  n/a";
      let d = b - a;
      if (Math.abs(d) > 720) d -= Math.sign(d) * 1440; // wrap across midnight
      maxDiff = Math.max(maxDiff, Math.abs(d));
      rows++;
      return `${d >= 0 ? "+" : ""}${d}`.padStart(8);
    });
    console.log(
      `${city.name.padEnd(14)} ${String(city.method).padEnd(6)}${diffs.join("")}   ${mine.meta.timezone}`
    );
  }
  console.log(`\nrows compared: ${rows} (over ${net} cities) — max |diff| = ${maxDiff} min`);
  if (net === 0) {
    console.log("No network — could not reach Aladhan. Engine output (Riyadh):");
    console.log(JSON.stringify(PrayerEngine.timings(CITIES[0], now), null, 2));
  } else if (maxDiff <= 1) {
    console.log("PASS: within 1-minute tolerance.");
  } else {
    console.log(`REVIEW: max diff ${maxDiff} min — check method mappings above.`);
  }
}

main();
