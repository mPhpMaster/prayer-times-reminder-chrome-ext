// Prayer Times Reminder — background service worker (Manifest V3)
// Responsibilities:
//   1. Fetch today's prayer times for the saved location (Aladhan API).
//   2. Schedule a chrome.alarms entry for every upcoming prayer today.
//   3. Show a (localized) notification when each prayer's alarm fires.
//   4. Refresh + reschedule shortly after midnight for the new day.

importScripts("i18n.js"); // provides I18N + tr()

const ALADHAN = "https://api.aladhan.com/v1";

// The five obligatory prayers we notify for. Sunrise is shown in the popup
// but is not a prayer, so we don't fire a notification for it.
const PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

const REFRESH_ALARM = "refresh-daily";

// ---- Location storage -------------------------------------------------------

async function getLocation() {
  const { location } = await chrome.storage.local.get("location");
  return location || null;
}

// ---- Aladhan API ------------------------------------------------------------

// Aladhan wants the date as DD-MM-YYYY.
function apiDate(d) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

// Builds the request URL for either a city/country pair or raw coordinates.
function timingsUrl(location, date) {
  const method = location.method ?? 2; // 2 = ISNA (sensible default)
  if (location.mode === "coords") {
    return `${ALADHAN}/timings/${date}?latitude=${location.latitude}` +
      `&longitude=${location.longitude}&method=${method}`;
  }
  return `${ALADHAN}/timingsByCity/${date}?city=${encodeURIComponent(location.city)}` +
    `&country=${encodeURIComponent(location.country)}&method=${method}`;
}

async function fetchTimings(location, date) {
  const res = await fetch(timingsUrl(location, date));
  if (!res.ok) throw new Error(`Aladhan API responded ${res.status}`);
  const json = await res.json();
  if (json.code !== 200 || !json.data || !json.data.timings) {
    throw new Error("Unexpected Aladhan API response");
  }
  return json.data; // { timings, date, meta, ... }
}

// API times look like "05:12" or sometimes "05:12 (EET)". Pull out HH:MM and
// anchor them to the given reference day in the *local* timezone.
function parseTimeToDate(timeStr, refDate) {
  const m = String(timeStr).match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const d = new Date(refDate);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d;
}

// ---- Scheduling -------------------------------------------------------------

async function scheduleAlarms() {
  await chrome.alarms.clearAll();

  const location = await getLocation();
  if (!location) return; // nothing configured yet

  const now = new Date();
  let data;
  try {
    data = await fetchTimings(location, apiDate(now));
  } catch (err) {
    console.error("Failed to fetch prayer times:", err);
    // Retry in 30 minutes if the network/API is unavailable.
    chrome.alarms.create(REFRESH_ALARM, { delayInMinutes: 30 });
    return;
  }

  const timings = data.timings;

  // Cache for the popup so it can render instantly without a network call.
  await chrome.storage.local.set({
    cache: { timings, date: data.date, fetchedAt: now.getTime() }
  });

  for (const prayer of PRAYERS) {
    const when = parseTimeToDate(timings[prayer], now);
    if (when && when.getTime() > now.getTime()) {
      chrome.alarms.create(`prayer:${prayer}`, { when: when.getTime() });
    }
  }

  // Reschedule just after midnight for the next day.
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 1, 0, 0);
  chrome.alarms.create(REFRESH_ALARM, { when: tomorrow.getTime() });
}

// ---- Notifications ----------------------------------------------------------

async function notifyPrayer(prayer) {
  const { lang } = await chrome.storage.local.get("lang");
  const L = tr(lang || "en");
  const name = L.prayers[prayer] || prayer;
  chrome.notifications.create(`prayer-${prayer}-${Date.now()}`, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: L.notifTitle(name),
    message: L.notifBody(name),
    priority: 2,
    requireInteraction: true,
    silent: false
  });
}

// ---- Event wiring -----------------------------------------------------------

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REFRESH_ALARM) {
    scheduleAlarms();
    return;
  }
  if (alarm.name.startsWith("prayer:")) {
    const prayer = alarm.name.slice("prayer:".length);
    notifyPrayer(prayer);
  }
});

// Reschedule whenever the saved location changes (popup writes it).
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.location) {
    scheduleAlarms();
  }
});

chrome.runtime.onInstalled.addListener(() => scheduleAlarms());
chrome.runtime.onStartup.addListener(() => scheduleAlarms());

// Clicking a notification opens the popup-equivalent page.
chrome.notifications.onClicked.addListener((id) => {
  chrome.notifications.clear(id);
});
