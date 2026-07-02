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
