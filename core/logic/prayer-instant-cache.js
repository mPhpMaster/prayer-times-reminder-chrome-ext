// Cache wall-clock parsing for one calendar date/timezone. The countdown
// repeatedly asks for the same six or seven instants; they do not change
// each second. The resolver is injected to keep this helper platform-free.
function createPrayerInstantCache(resolve) {
  let calendar = "";
  const values = new Map();
  return function instant(time, date, timezone) {
    const key = JSON.stringify([date.getFullYear(), date.getMonth(), date.getDate(), date.getTimezoneOffset(), timezone]);
    if (key !== calendar) { calendar = key; values.clear(); }
    const text = String(time);
    if (!values.has(text)) {
      if (values.size >= 16) values.delete(values.keys().next().value);
      values.set(text, resolve(time, date, timezone));
    }
    return values.get(text);
  };
}
