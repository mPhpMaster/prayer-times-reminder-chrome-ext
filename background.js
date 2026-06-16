// Prayer Times Reminder — background service worker (Manifest V3)
// Responsibilities:
//   1. Fetch today's prayer times for the saved location (Aladhan API).
//   2. Schedule chrome.alarms for every upcoming prayer today (5 min before + at time).
//   3. Show a (localized) notification when each alarm fires.
//   4. Lock the active tab for 5 minutes at prayer time (if enabled).
//   5. Refresh + reschedule shortly after midnight for the new day.

importScripts("tasbih-phrases.js", "i18n.js");

const ALADHAN = "https://api.aladhan.com/v1";

// The five obligatory prayers we notify for. Sunrise is shown in the popup
// but is not a prayer, so we don't fire a notification for it.
const PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

const REFRESH_ALARM = "refresh-daily";
const TASBIH_ALARM = "tasbih-reminder";
const REMINDER_MINUTES = 5;
const DEFAULT_LOCK_MINUTES = 5;
const TEST_LOCK_SECONDS = 10;
const DEFAULT_TASBIH_MINUTES = 15;
const DEFAULT_TASBIH_RANDOM_MIN = 5;
const DEFAULT_TASBIH_RANDOM_MAX = 15;

const TASBIH_STORAGE_KEYS = [
    "tasbihEnabled", "tasbihIntervalMode", "tasbihIntervalMinutes",
    "tasbihRandomMin", "tasbihRandomMax"
];

function clampLockMinutes(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return DEFAULT_LOCK_MINUTES;
    return Math.min(120, Math.max(1, Math.round(n)));
}

function clampTasbihMinutes(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(120, Math.max(1, Math.round(n)));
}

function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ---- Location storage -------------------------------------------------------

async function getLocation() {
    const {
        location
    } = await chrome.storage.local.get("location");
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

    try {
        const location = await getLocation();
        if (!location) return;

        const now = new Date();
        let data;
        try {
            data = await fetchTimings(location, apiDate(now));
        } catch (err) {
            console.error("Failed to fetch prayer times:", err);
            chrome.alarms.create(REFRESH_ALARM, {
                delayInMinutes: 30
            });
            return;
        }

        const timings = data.timings;

        await chrome.storage.local.set({
            cache: {
                timings,
                date: data.date,
                fetchedAt: now.getTime()
            }
        });

        for (const prayer of PRAYERS) {
            const when = parseTimeToDate(timings[prayer], now);
            if (!when || when.getTime() <= now.getTime()) continue;

            const prayerMs = when.getTime();
            const reminderMs = prayerMs - REMINDER_MINUTES * 60 * 1000;

            if (reminderMs > now.getTime()) {
                chrome.alarms.create(`prayer-soon:${prayer}`, {
                    when: reminderMs
                });
            }
            chrome.alarms.create(`prayer:${prayer}`, {
                when: prayerMs
            });
        }

        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 1, 0, 0);
        chrome.alarms.create(REFRESH_ALARM, {
            when: tomorrow.getTime()
        });
    } finally {
        await scheduleTasbihAlarm();
    }
}

// ---- Notifications ----------------------------------------------------------

async function notifyPrayer(prayer, soon = false) {
    const {
        lang
    } = await chrome.storage.local.get("lang");
    const L = tr(lang || "en");
    const name = L.prayers[prayer] || prayer;
    chrome.notifications.create(`prayer-${soon ? "soon-" : ""}${prayer}-${Date.now()}`, {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: soon ? L.notifSoonTitle(name) : L.notifTitle(name),
        message: soon ? L.notifSoonBody(name) : L.notifBody(name),
        priority: 2,
        requireInteraction: true,
        silent: false
    });
}

// ---- Tab lock ---------------------------------------------------------------

function lockStrings(lang, prayerName, arabicDigits, allowUnlock) {
    const L = tr(lang || "en");
    return {
        prayerName,
        title: L.lockTitle(prayerName),
        subtitle: L.lockSubtitle,
        countdownPrefix: L.lockCountdown,
        unlockLabel: L.unlockTab,
        dir: L.dir,
        lang: lang || "en",
        arabicDigits: usesArabicDigits(lang || "en", arabicDigits !== false),
        allowUnlock: allowUnlock === true
    };
}

async function lockActiveTab(prayer, { test = false, allowUnlock: allowUnlockOverride } = {}) {
    const { tabLockEnabled, lang, arabicDigits, lockMinutes, allowUnlock: storedAllowUnlock, theme } =
        await chrome.storage.local.get([
            "tabLockEnabled", "lang", "arabicDigits", "lockMinutes", "allowUnlock", "theme"
        ]);
    if (!tabLockEnabled && !test) return { ok: false, reason: "disabled" };

    const allowUnlock = test && allowUnlockOverride !== undefined
        ? allowUnlockOverride === true
        : storedAllowUnlock === true;

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab?.id || !tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://")) {
        return { ok: false, reason: "restricted" };
    }

    const L = tr(lang || "en");
    const prayerName = test ? L.testLockPrayer : (L.prayers[prayer] || prayer);
    const minutes = clampLockMinutes(lockMinutes ?? DEFAULT_LOCK_MINUTES);
    const unlockAt = test
        ? Date.now() + TEST_LOCK_SECONDS * 1000
        : Date.now() + minutes * 60 * 1000;
    const payload = {
        type: "ACTIVATE_LOCK",
        unlockAt,
        theme: normalizeTheme(theme),
        ...lockStrings(lang, prayerName, arabicDigits, allowUnlock)
    };

    try {
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content-lock.js"]
        });
    } catch {
        // Script may already be injected on this tab.
    }

    try {
        await chrome.tabs.sendMessage(tab.id, payload);
        return { ok: true };
    } catch {
        return { ok: false, reason: "inject-failed" };
    }
}

// ---- Tasbih reminder --------------------------------------------------------

async function getTasbihSettings() {
    const stored = await chrome.storage.local.get(TASBIH_STORAGE_KEYS);
    const intervalMinutes = clampTasbihMinutes(
        stored.tasbihIntervalMinutes,
        DEFAULT_TASBIH_MINUTES
    );
    let randomMin = clampTasbihMinutes(stored.tasbihRandomMin, DEFAULT_TASBIH_RANDOM_MIN);
    let randomMax = clampTasbihMinutes(stored.tasbihRandomMax, DEFAULT_TASBIH_RANDOM_MAX);
    if (randomMin > randomMax) {
        const tmp = randomMin;
        randomMin = randomMax;
        randomMax = tmp;
    }
    return {
        enabled: stored.tasbihEnabled === true,
        mode: stored.tasbihIntervalMode === "random" ? "random" : "fixed",
        intervalMinutes,
        randomMin,
        randomMax
    };
}

async function scheduleTasbihAlarm() {
    await chrome.alarms.clear(TASBIH_ALARM);
    const settings = await getTasbihSettings();
    if (!settings.enabled) return;

    if (settings.mode === "fixed") {
        chrome.alarms.create(TASBIH_ALARM, {
            periodInMinutes: settings.intervalMinutes
        });
        return;
    }

    chrome.alarms.create(TASBIH_ALARM, {
        delayInMinutes: randomBetween(settings.randomMin, settings.randomMax)
    });
}

async function showTasbihOnActiveTab({ test = false } = {}) {
    const { lang, tasbihPosition, theme } = await chrome.storage.local.get(["lang", "tasbihPosition", "theme"]);
    const settings = await getTasbihSettings();
    if (!settings.enabled && !test) return { ok: false, reason: "disabled" };

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab?.id || !tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://")) {
        return { ok: false, reason: "restricted" };
    }

    const L = tr(lang || "en");
    const payload = {
        type: "ACTIVATE_TASBIH",
        display: randomTasbihPhrase(lang || "en"),
        label: L.tasbihCardLabel,
        dir: L.dir,
        lang: lang || "en",
        theme: normalizeTheme(theme),
        position: normalizeTasbihPosition(tasbihPosition)
    };

    try {
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content-tasbih.js"]
        });
    } catch {
        // Script may already be injected on this tab.
    }

    try {
        await chrome.tabs.sendMessage(tab.id, payload);
        return { ok: true };
    } catch {
        return { ok: false, reason: "inject-failed" };
    }
}

// ---- Event wiring -----------------------------------------------------------

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === REFRESH_ALARM) {
        scheduleAlarms();
        return;
    }
    if (alarm.name === TASBIH_ALARM) {
        showTasbihOnActiveTab().then(async () => {
            const settings = await getTasbihSettings();
            if (settings.mode === "random") {
                await scheduleTasbihAlarm();
            }
        });
        return;
    }
    if (alarm.name.startsWith("prayer-soon:")) {
        const prayer = alarm.name.slice("prayer-soon:".length);
        notifyPrayer(prayer, true);
        return;
    }
    if (alarm.name.startsWith("prayer:")) {
        const prayer = alarm.name.slice("prayer:".length);
        notifyPrayer(prayer);
        lockActiveTab(prayer);
    }
});

// Reschedule whenever the saved location changes (popup writes it).
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.location) {
        scheduleAlarms();
    }
    if (area === "local" && TASBIH_STORAGE_KEYS.some((key) => key in changes)) {
        scheduleTasbihAlarm();
    }
});

chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === "install") {
        await chrome.storage.local.set({ ...DEFAULT_SETTINGS, ...DEFAULT_CITY_LABELS });
        const L = tr(DEFAULT_SETTINGS.lang);
        chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
        chrome.notifications.create(`welcome-pin-${Date.now()}`, {
            type: "basic",
            iconUrl: "icons/icon128.png",
            title: L.welcomeNotifTitle,
            message: L.welcomeNotifBody,
            priority: 2,
            requireInteraction: true
        });
    }
    scheduleAlarms();
});
chrome.runtime.onStartup.addListener(() => scheduleAlarms());

// Clicking a notification opens the welcome page (install) or clears others.
chrome.notifications.onClicked.addListener((id) => {
    chrome.notifications.clear(id);
    if (id.startsWith("welcome-pin-")) {
        chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
    }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "TEST_LOCK") {
        lockActiveTab(null, {
            test: true,
            allowUnlock: msg.allowUnlock === true
        }).then(sendResponse);
        return true;
    }
    if (msg?.type === "TEST_TASBIH") {
        showTasbihOnActiveTab({ test: true }).then(sendResponse);
        return true;
    }
});