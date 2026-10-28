// Calendar and task summaries for the new tab. No DOM, storage or network.
const NewTabPrayers = (() => {
  function dayKey(date) {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  }

  function dateOffset(date, offset) {
    const shifted = new Date(date);
    shifted.setDate(shifted.getDate() + offset);
    return shifted;
  }

  function validLocation(location) {
    return location && location.latitude != null && location.longitude != null &&
      Number.isFinite(Number(location.latitude)) && Math.abs(Number(location.latitude)) <= 90 &&
      Number.isFinite(Number(location.longitude)) && Math.abs(Number(location.longitude)) <= 180;
  }

  function cacheKey(location, date) {
    return JSON.stringify([1, dayKey(date), date.getTimezoneOffset(), Number(location.latitude),
      Number(location.longitude), location.method ?? 4]);
  }

  function validSchedule(schedule, key) {
    return schedule && schedule.key === key && typeof schedule.day === "string" &&
      typeof schedule.previousDay === "string" && schedule.at &&
      NewTabConfig.prayers.every((p) => Number.isFinite(schedule.at[p])) &&
      Number.isFinite(schedule.tomorrowFajr) && Number.isFinite(schedule.yesterdayIsha);
  }

  function schedule(engine, location, date = new Date()) {
    const yesterday = dateOffset(date, -1);
    const tomorrow = dateOffset(date, 1);
    return {
      key: cacheKey(location, date), day: dayKey(date),
      at: engine.timestamps(location, date),
      tomorrowFajr: engine.timestamps(location, tomorrow).Fajr,
      yesterdayIsha: engine.timestamps(location, yesterday).Isha,
      previousDay: dayKey(yesterday),
    };
  }

  function currentWindow(today, now = Date.now()) {
    if (!today) return null;
    const prayer = [...NewTabConfig.five].reverse().find((p) => now >= today.at[p]) || "Isha";
    const day = now < today.at.Fajr ? today.previousDay : today.day;
    const [year, month, date] = day.split("-");
    return { prayer, key: `${year}-${month.padStart(2, "0")}-${date.padStart(2, "0")}:${prayer}` };
  }

  function progress(today, state, now = Date.now()) {
    const window = currentWindow(today, now);
    if (!window) return null;
    const tasks = state?.windows?.[window.key]?.tasks || {};
    return { ...window, done: Object.keys(tasks).filter((id) => tasks[id]?.doneAt) };
  }

  function taskSummary(progress, catalog) {
    if (!progress) return null;
    const ids = catalog[progress.prayer] || [];
    return { prayer: progress.prayer, total: ids.length, done: ids.filter((id) => progress.done.includes(id)).length };
  }

  return { dayKey, validLocation, cacheKey, validSchedule, schedule, currentWindow, progress, taskSummary };
})();
