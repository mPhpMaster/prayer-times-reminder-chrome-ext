function parseTimeToDate(timeStr, refDate = new Date()) {
  const m = String(timeStr).match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const d = new Date(refDate);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d;
}

// Absolute instant (ms) of a prayer's wall-clock time, interpreted in the
// location's timezone (from Aladhan meta) so countdowns/highlighting stay correct
// even when the device timezone differs from the chosen location's.
const popupInstant = createPrayerInstantCache(prayerTimestamp);
function prayerInstant(timeStr) { return popupInstant(timeStr, new Date(), currentTimezone); }

function fmtTime(timeStr) {
  const m = String(timeStr).match(/(\d{1,2}):(\d{2})/);
  if (!m) return localizeNum(timeStr);
  const hh = Number(m[1]);
  const mm = m[2];
  let h12 = hh % 12;
  if (h12 === 0) h12 = 12;
  if (lang === "ar" || lang === "ur") {
    const suffix = hh < 12 ? "ص" : "م";
    return `${localizeNum(`${h12}:${mm}`)} ${suffix}`;
  }
  if (uses24hClock(lang)) return `${String(hh).padStart(2, "0")}:${mm}`;
  const ampm = hh < 12 ? "AM" : "PM";
  return localizeNum(`${h12}:${mm} ${ampm}`);
}
