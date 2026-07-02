// scheduler-core.js — pure prayer-time scheduling math. No chrome.*, no I/O.
//
// Shared by every shell's background layer: each shell turns the returned plan
// into its own platform timers (chrome.alarms on the extension, Tauri timers on
// desktop, scheduled notifications on mobile). Relies on prayerTimestamp() from
// i18n.js (loaded first) to anchor each wall-clock time to the location's tz.

// Future prayer alarms for `now`'s day: one { id, when } per prayer whose time
// (interpreted in `tz`) is still ahead of `now`. Past-due prayers are omitted.
function planPrayerAlarms(timings, prayers, now, tz) {
  const nowMs = now.getTime();
  const plan = [];
  for (const prayer of prayers) {
    const when = prayerTimestamp(timings[prayer], now, tz);
    if (when == null) continue;
    if (when > nowMs) plan.push({ id: `prayer:${prayer}`, when });
  }
  return plan;
}

// Next daily-refresh instant: 00:01 tomorrow in the device's local time, so the
// background layer recomputes the day's times shortly after midnight.
function nextRefreshTime(now) {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 1, 0, 0);
  return tomorrow.getTime();
}
