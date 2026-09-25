// notify-plan.js — pure: expand prayer times into a rolling list of scheduled
// notifications for the mobile shell (no chrome.*, no Capacitor). The Capacitor
// adapter turns each entry into an @capacitor/local-notifications schedule,
// re-running on app load / resume to top the window up.
//
// `engine` is PrayerEngine (offline); relies on the global prayerTimestamp
// (i18n.js) to anchor each "HH:MM" to the location timezone. Returns one
// { id, prayer, when } per upcoming prayer across the next `days` days.

function planPrayerNotifications(engine, location, now, days, prayers) {
  const out = [];
  const nowMs = now.getTime();
  for (let d = 0; d < days; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() + d);
    const data = engine.timings(location, date);
    const tz = data.meta && data.meta.timezone;
    for (const prayer of prayers) {
      const when = prayerTimestamp(data.timings[prayer], date, tz);
      if (when == null || when <= nowMs) continue;
      out.push({ id: notifId(when, prayer, prayers), prayer, when });
    }
  }
  return out;
}

// A stable small integer id (LocalNotifications requires an int): bucket by the
// notification's day so re-planning produces the same ids and doesn't duplicate.
function notifId(when, prayer, prayers) {
  const dayNum = Math.floor(when / 86400000);
  const idx = prayers.indexOf(prayer);
  return dayNum * 10 + (idx < 0 ? 9 : idx);
}

// ---- game alerts ------------------------------------------------------------
// Two alerts per prayer window (docs/GAME-DESIGN-2026-09-25.md, phase 4):
//   "open"    — tasks open (prayer + 30 min): start now for full points
//   "closing" — 30 min before the next prayer, when points hit their floor
// Mirrors game-score.js (TASK_DELAY_MIN, FLOOR_BEFORE_MIN); kept standalone
// because this file is loaded on pages without the game scripts.
// `key` matches game-windows.js ("YYYY-MM-DD:Prayer", the prayer's local day)
// so the adapter can skip "closing" for a window the player already finished.
// Ids live in [GAME_ALERT_ID_BASE, 20M): above prayer ids (dayNum*10), below
// the legacy dhikr sweep threshold.
const GAME_ALERT_ID_BASE = 10000000;
const GAME_ALERT_OPEN_MIN = 30;
const GAME_ALERT_CLOSE_BEFORE_MIN = 30;

function planGameAlerts(engine, location, now, days, prayers) {
  const out = [];
  const nowMs = now.getTime();
  const MIN = 60000;
  const p2 = (n) => String(n).padStart(2, "0");
  const dayTimes = (date) => {
    const data = engine.timings(location, date);
    const tz = data.meta && data.meta.timezone;
    const t = {};
    for (const p of prayers) t[p] = prayerTimestamp(data.timings[p], date, tz);
    return t;
  };
  let today = dayTimes(now);
  // Last night's window (the last prayer, until today's first) may still be
  // open after midnight: keep its "closing" alert when re-planning then.
  {
    const yDate = new Date(now);
    yDate.setDate(yDate.getDate() - 1);
    const last = prayers.length - 1;
    const yTimes = dayTimes(yDate);
    const start = yTimes[prayers[last]];
    const closing = today[prayers[0]] - GAME_ALERT_CLOSE_BEFORE_MIN * MIN;
    if (start != null && closing > nowMs && closing > start + GAME_ALERT_OPEN_MIN * MIN) {
      const day = `${yDate.getFullYear()}-${p2(yDate.getMonth() + 1)}-${p2(yDate.getDate())}`;
      // Same id the day loop gave it yesterday (day number from that day's first prayer).
      const id = GAME_ALERT_ID_BASE + Math.floor(yTimes[prayers[0]] / 86400000) * 20 + last * 2 + 1;
      out.push({ id, kind: "closing", prayer: prayers[last], key: `${day}:${prayers[last]}`, when: closing });
    }
  }
  for (let d = 0; d < days; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() + d);
    const nextDate = new Date(now);
    nextDate.setDate(nextDate.getDate() + d + 1);
    const tomorrow = dayTimes(nextDate);
    const day = `${date.getFullYear()}-${p2(date.getMonth() + 1)}-${p2(date.getDate())}`;
    const dayNum = Math.floor(today[prayers[0]] / 86400000);
    prayers.forEach((prayer, i) => {
      const start = today[prayer];
      const next = i + 1 < prayers.length ? today[prayers[i + 1]] : tomorrow[prayers[0]];
      if (start == null || next == null) return;
      const key = `${day}:${prayer}`;
      const base = GAME_ALERT_ID_BASE + dayNum * 20 + i * 2;
      const open = start + GAME_ALERT_OPEN_MIN * MIN;
      const closing = next - GAME_ALERT_CLOSE_BEFORE_MIN * MIN;
      if (open > nowMs) out.push({ id: base, kind: "open", prayer, key, when: open });
      if (closing > nowMs && closing > open) out.push({ id: base + 1, kind: "closing", prayer, key, when: closing });
    });
    today = tomorrow;
  }
  return out;
}
