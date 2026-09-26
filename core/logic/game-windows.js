// game-windows.js — which prayer window "now" falls in. Pure: the prayer
// engine is passed in (PrayerEngine in the app, a stub in tests).
//
// A window runs from one prayer to the next; Isha's runs to the next day's
// Fajr, so between midnight and Fajr we are still in yesterday's Isha window.
// Its key is dated by the day its prayer happened, so it stays one window.
//
//   prayerDay(engine, location, date)       -> { Fajr: ms, Dhuhr: ms, ... }
//   currentWindow(engine, location, now)    -> { key, prayer, day, prayerAt, nextPrayerAt, win }

const GAME_PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

function prayerDay(engine, location, date) {
  const data = engine.timings(location, date);
  const tz = data.meta && data.meta.timezone;
  const out = {};
  for (const p of GAME_PRAYERS) out[p] = prayerTimestamp(data.timings[p], date, tz);
  return out;
}

// Local calendar day of a Date as "YYYY-MM-DD" (the same day prayerTimestamp uses).
function dayKey(date) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

function shiftDays(date, n) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + n);
  return d;
}

function currentWindow(engine, location, now = new Date()) {
  const nowMs = now.getTime();
  const today = prayerDay(engine, location, now);

  if (nowMs < today.Fajr) {
    const yDate = shiftDays(now, -1);
    const yesterday = prayerDay(engine, location, yDate);
    return makeWindow("Isha", yDate, yesterday.Isha, today.Fajr);
  }
  for (let i = GAME_PRAYERS.length - 1; i >= 0; i--) {
    const p = GAME_PRAYERS[i];
    if (nowMs < today[p]) continue;
    const next =
      i + 1 < GAME_PRAYERS.length
        ? today[GAME_PRAYERS[i + 1]]
        : prayerDay(engine, location, shiftDays(now, 1)).Fajr;
    return makeWindow(p, now, today[p], next);
  }
  return null; // unreachable: nowMs >= Fajr hits the loop
}

function makeWindow(prayer, date, prayerAt, nextPrayerAt) {
  const day = dayKey(date);
  return { key: `${day}:${prayer}`, prayer, day, prayerAt, nextPrayerAt, win: taskWindow(prayerAt, nextPrayerAt) };
}

// The window only changes at a prayer time, so the per-second tick recomputes
// prayer times (currentWindow) just once a minute — or at once when the next
// prayer is reached, so the switch is never late. Countdowns use the cached
// window's timestamps and stay second-accurate.
const WINDOW_RECHECK_MS = 60 * 1000;
function needsWindowRefresh(current, lastCheckMs, nowMs) {
  return !current || nowMs >= current.nextPrayerAt || nowMs - lastCheckMs >= WINDOW_RECHECK_MS || nowMs < lastCheckMs;
}
