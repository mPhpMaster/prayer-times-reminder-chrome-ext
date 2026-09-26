// Prayer Times Reminder — background service worker (Manifest V3)
// Responsibilities:
//   1. Fetch today's prayer times for the saved location (Aladhan API).
//   2. Schedule chrome.alarms for every upcoming prayer today (at prayer time).
//   3. Show a (localized) notification when each alarm fires.
//   4. Lock all open tabs for 5 minutes at prayer time (if enabled).
//   5. Refresh + reschedule shortly after midnight for the new day.

importScripts(
    "tasbih-phrases.js", "i18n.js",
    "vendor/adhan.js", "vendor/tz-lookup.js", "prayer-engine.js",
    "scheduler-core.js", "dhikr-core.js", "lock-config.js",
    "notify-plan.js", "game-alerts.js"
);

// The five obligatory prayers we notify for. Sunrise is shown in the popup
// but is not a prayer, so we don't fire a notification for it.
const PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

const REFRESH_ALARM = "refresh-daily";
const TASBIH_ALARM = "tasbih-reminder";
// Ignore alarms that fire more than this late — i.e. Chrome/PC was closed at the
// scheduled time and the alarm only fired on startup (no stale notify/lock/dhikr).
const STALE_ALARM_GRACE_MS = 2 * 60 * 1000;
// DEFAULT_LOCK_MINUTES / DEFAULT_TASBIH_* + clamp/apiDate/timingsUrl helpers are
// shared from i18n.js (imported above).

const TASBIH_STORAGE_KEYS = [
    "tasbihEnabled", "tasbihIntervalMode", "tasbihIntervalMinutes",
    "tasbihRandomMin", "tasbihRandomMax"
];

// Mirrors whether a lock window is active so tabs.onUpdated can skip a storage
// read on every navigation when nothing is locked (lets the worker idle). It's
// re-hydrated on cold start (see bottom of file) and kept in sync below.
let activeLockActive = false;

// Pure scheduling/dhikr math lives in core/logic (scheduler-core.js,
// dhikr-core.js), imported above: planPrayerAlarms, nextRefreshTime,
// normalizeTasbihSettings, tasbihAlarmOptions.

// ---- Location storage -------------------------------------------------------

async function getLocation() {
    const {
        location
    } = await chrome.storage.local.get("location");
    return location || null;
}

// ---- Aladhan API ------------------------------------------------------------

async function fetchTimings(location, date) {
    const res = await fetch(timingsUrl(location, date));
    if (!res.ok) throw new Error(`Aladhan API responded ${res.status}`);
    const json = await res.json();
    if (json.code !== 200 || !json.data || !json.data.timings) {
        throw new Error("Unexpected Aladhan API response");
    }
    return json.data; // { timings, date, meta, ... }
}

// Prefer the offline engine when the location carries coordinates (all new
// locations do — city mode geocodes on save, GPS mode is inherently coords).
// Falls back to the Aladhan API for legacy city locations saved without coords.
async function resolveTimings(location, now) {
    if (location.latitude != null && location.longitude != null) {
        return PrayerEngine.timings(location, now); // { timings, date, meta }
    }
    return fetchTimings(location, apiDate(now));
}

// ---- Scheduling -------------------------------------------------------------

let schedulingPromise = null;

// Coalesce overlapping reschedules — e.g. on install the location write fires
// storage.onChanged AND onInstalled calls scheduleAlarms — so the clear/fetch/
// recreate doesn't run twice at once.
function scheduleAlarms() {
    if (schedulingPromise) return schedulingPromise;
    schedulingPromise = scheduleAlarmsImpl().finally(() => {
        schedulingPromise = null;
    });
    return schedulingPromise;
}

async function scheduleAlarmsImpl() {
    // Clear only the alarms this function owns. The dhikr (tasbih) alarm is a
    // separate, self-perpetuating timer — wiping it here would reset its pending
    // "next dhikr" countdown on every reschedule (startup, daily refresh, etc.).
    await chrome.alarms.clear(REFRESH_ALARM);
    for (const prayer of PRAYERS) await chrome.alarms.clear(`prayer:${prayer}`);

    try {
        const location = await getLocation();
        if (!location) return;

        const now = new Date();
        let data;
        try {
            data = await resolveTimings(location, now);
        } catch (err) {
            console.error("Failed to resolve prayer times:", err);
            chrome.alarms.create(REFRESH_ALARM, {
                delayInMinutes: 30
            });
            return;
        }

        const timings = data.timings;
        // Aladhan reports the location's timezone; anchor alarms to it so they
        // fire at the right wall-clock moment regardless of the device's tz.
        const tz = data.meta?.timezone || null;

        await chrome.storage.local.set({
            cache: {
                timings,
                date: data.date,
                timezone: tz,
                fetchedAt: now.getTime()
            }
        });

        // One alarm at each upcoming prayer time: it both notifies and locks.
        for (const { id, when } of planPrayerAlarms(timings, PRAYERS, now, tz)) {
            chrome.alarms.create(id, { when });
        }

        chrome.alarms.create(REFRESH_ALARM, {
            when: nextRefreshTime(now)
        });
    } finally {
        await ensureTasbihAlarm();
        await scheduleGameAlerts(); // optional game reminders (game-alerts.js)
    }
}

// ---- Notifications ----------------------------------------------------------

async function notifyPrayer(prayer) {
    const {
        lang
    } = await chrome.storage.local.get("lang");
    const L = tr(lang || "en");
    const name = prayerLabel(L, prayer);
    chrome.notifications.create(`prayer-${prayer}-${Date.now()}`, {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: L.notifTitle(name),
        message: L.notifBody(name),
        priority: 2,
        requireInteraction: false,
        silent: false
    });
}

// ---- Tab lock ---------------------------------------------------------------

// The overlay config is built by the shared core helper buildLockConfig
// (core/logic/lock-config.js), so the extension, Tauri, and Android all render
// an identical lock.

// Tabs we can't inject into (browser-internal pages). The Chrome Web Store is
// also off-limits even though it's an https:// URL.
function isLockableTab(tab) {
    if (!tab?.id || !tab.url) return false;
    if (tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://")) return false;
    if (tab.url.startsWith("https://chrome.google.com/webstore")) return false;
    if (tab.url.startsWith("https://chromewebstore.google.com")) return false;
    return true;
}

// Tabs worth injecting into right now. Discarded/asleep tabs have no live
// renderer, so injection would just throw — skip them (a lock re-applies via
// tabs.onUpdated when the user wakes such a tab while a lock is active).
function isInjectableNow(tab) {
    return isLockableTab(tab) && !tab.discarded;
}

// Run an async fn over items with a small concurrency cap, so a prayer-time
// fan-out doesn't fire executeScript into dozens of renderers at once.
async function mapLimit(items, limit, fn) {
    const out = [];
    for (let i = 0; i < items.length; i += limit) {
        out.push(...await Promise.all(items.slice(i, i + limit).map(fn)));
    }
    return out;
}

const INJECT_CONCURRENCY = 8;

// ---- Prayer-time sound ------------------------------------------------------
//
// The injected overlays are muted (see lockAllTabs) and the sound is played once
// here instead, in an offscreen document — a service worker has no audio, and a
// content script would be silenced by the page's autoplay policy and would play
// once per locked tab. offscreen.js does the actual playback.

const OFFSCREEN_URL = "offscreen.html";

async function hasOffscreenDocument() {
    if (chrome.runtime.getContexts) {
        const contexts = await chrome.runtime.getContexts({
            contextTypes: ["OFFSCREEN_DOCUMENT"]
        });
        return contexts.length > 0;
    }
    // getContexts landed in Chrome 116; we still support 111. Fall back to the
    // worker's own client list, where the offscreen page shows up as a window.
    const clients = await self.clients.matchAll();
    return clients.some((c) => c.url.endsWith(OFFSCREEN_URL));
}

async function startLockSound(kind, stopAt) {
    if (!kind || kind === "none") return;
    try {
        // createDocument throws if one already exists (e.g. back-to-back locks).
        if (!(await hasOffscreenDocument())) {
            await chrome.offscreen.createDocument({
                url: OFFSCREEN_URL,
                reasons: ["AUDIO_PLAYBACK"],
                justification: "Play the call to prayer when prayer time arrives."
            });
        }
        await chrome.runtime.sendMessage({
            target: "offscreen",
            type: "PLAY_SOUND",
            kind,
            stopAt
        });
    } catch {
        /* no sound is better than a broken lock */
    }
}

async function stopLockSound() {
    try {
        if (!(await hasOffscreenDocument())) return;
        await chrome.runtime.sendMessage({
            target: "offscreen",
            type: "STOP_SOUND"
        }).catch(() => {});
        await chrome.offscreen.closeDocument();
    } catch {
        /* already gone */
    }
}

async function lockOneTab(tabId, payload) {
    try {
        // Define the overlay helpers once (idempotent guard makes re-injection
        // cheap), then activate with the payload via a one-shot call — no
        // persistent message listener is left resident in the page.
        await chrome.scripting.executeScript({
            target: { tabId },
            files: ["overlay-lock.js"]
        });
        await chrome.scripting.executeScript({
            target: { tabId },
            func: (p) => {
                // Wire the extension's "unlock everywhere" action, then activate.
                window.__prayerLockOnUnlock = () => {
                    try { chrome.runtime.sendMessage({ type: "UNLOCK_ALL" }); } catch {}
                };
                window.__prayerTabLockActivate && window.__prayerTabLockActivate(p);
            },
            args: [payload]
        });
        return true;
    } catch {
        return false;
    }
}

async function lockAllTabs(prayer, {
    test = false,
    allowUnlock: allowUnlockOverride
} = {}) {
    const {
        tabLockEnabled,
        lang,
        arabicDigits,
        lockMinutes,
        allowUnlock: storedAllowUnlock,
        theme,
        prayerSound
    } =
    await chrome.storage.local.get([
        "tabLockEnabled", "lang", "arabicDigits", "lockMinutes", "allowUnlock", "theme",
        "prayerSound"
    ]);
    if (!tabLockEnabled && !test) return {
        ok: false,
        reason: "disabled"
    };

    const allowUnlock = test && allowUnlockOverride !== undefined ?
        allowUnlockOverride === true :
        storedAllowUnlock === true;

    // Lock every open tab across all windows, not just the active one.
    const tabs = await chrome.tabs.query({});
    const lockable = tabs.filter(isInjectableNow);
    if (lockable.length === 0) {
        return {
            ok: false,
            reason: "restricted"
        };
    }

    const L = tr(lang || "en");
    const prayerName = test ? L.testLockPrayer : prayerLabel(L, prayer);
    const payload = buildLockConfig(
        { lang, theme, arabicDigits, lockMinutes, allowUnlock, prayerSound },
        { test, prayerName }
    );
    const unlockAt = payload.unlockAt;

    // Every tab gets a muted copy — the sound plays once, centrally, from the
    // offscreen document. Tabs opened mid-lock re-inject from the stored copy,
    // so that one must be muted too.
    const tabPayload = { ...payload, sound: "none" };

    // Remember the lock window so tabs opened or navigated before unlock time
    // also get locked (the service worker may restart, so persist to storage).
    await chrome.storage.local.set({
        activeLock: {
            unlockAt,
            payload: tabPayload
        }
    });
    activeLockActive = true;

    startLockSound(payload.sound, unlockAt);

    const results = await mapLimit(lockable, INJECT_CONCURRENCY, (tab) => lockOneTab(tab.id, tabPayload));
    return results.some(Boolean) ? {
        ok: true
    } : {
        ok: false,
        reason: "inject-failed"
    };
}

// Returns the in-progress lock window, or null if none / already expired.
// Lazily clears the stored entry once its unlock time has passed.
async function getActiveLock() {
    const {
        activeLock
    } = await chrome.storage.local.get("activeLock");
    if (!activeLock?.unlockAt || activeLock.unlockAt <= Date.now()) {
        if (activeLock) await chrome.storage.local.remove("activeLock");
        activeLockActive = false;
        return null;
    }
    activeLockActive = true;
    return activeLock;
}

// Ends the lock window everywhere: forget it so new tabs don't re-lock, then
// clear the overlay from every currently-locked tab.
async function clearAllLocks() {
    await chrome.storage.local.remove("activeLock");
    activeLockActive = false;
    await stopLockSound();
    const tabs = await chrome.tabs.query({});
    await Promise.all(
        tabs.filter(isInjectableNow).map((tab) =>
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => window.__prayerTabLockClear && window.__prayerTabLockClear()
            }).catch(() => {})
        )
    );
}

// ---- Tasbih reminder --------------------------------------------------------

async function getTasbihSettings() {
    const stored = await chrome.storage.local.get(TASBIH_STORAGE_KEYS);
    return normalizeTasbihSettings(stored);
}

// Create the single dhikr alarm (no clearing). Fixed mode repeats on its own
// via periodInMinutes; random mode is a one-shot that re-arms itself on fire.
function createTasbihAlarm(settings) {
    chrome.alarms.create(TASBIH_ALARM, tasbihAlarmOptions(settings));
}

// Make sure exactly one dhikr timer exists, WITHOUT disturbing a pending one.
// Called from the prayer scheduler / startup / install so those never reset the
// running "next dhikr" countdown.
async function ensureTasbihAlarm() {
    const settings = await getTasbihSettings();
    if (!settings.enabled) {
        await chrome.alarms.clear(TASBIH_ALARM);
        return;
    }
    const existing = await chrome.alarms.get(TASBIH_ALARM);
    if (existing) return;
    createTasbihAlarm(settings);
}

// Force a fresh dhikr timer — used only when the user changes dhikr settings so
// a new interval/mode takes effect immediately.
async function resetTasbihAlarm() {
    await chrome.alarms.clear(TASBIH_ALARM);
    const settings = await getTasbihSettings();
    if (!settings.enabled) return;
    createTasbihAlarm(settings);
}

// Inject the dhikr content script into one tab and show the card. Mirrors
// lockOneTab(); per-tab inject/send failures are swallowed so one bad tab can't
// abort the rest of the fan-out.
async function showTasbihOnTab(tabId, payload) {
    try {
        await chrome.scripting.executeScript({
            target: { tabId },
            files: ["overlay-tasbih.js"]
        });
        await chrome.scripting.executeScript({
            target: { tabId },
            func: (p) => window.__prayerTasbihActivate && window.__prayerTasbihActivate(p),
            args: [payload]
        });
        return true;
    } catch {
        return false;
    }
}

async function showTasbihOnAllTabs({
    test = false
} = {}) {
    const {
        lang,
        tasbihPosition,
        theme
    } = await chrome.storage.local.get(["lang", "tasbihPosition", "theme"]);
    const settings = await getTasbihSettings();
    if (!settings.enabled && !test) return {
        ok: false,
        reason: "disabled"
    };

    // Show on every injectable tab across all windows (same rules as the lock).
    const tabs = await chrome.tabs.query({});
    const injectable = tabs.filter(isInjectableNow);
    if (injectable.length === 0) {
        return {
            ok: false,
            reason: "restricted"
        };
    }

    // Build the payload once so every tab shows the same dhikr phrase.
    const L = tr(lang || "en");
    const payload = {
        type: "ACTIVATE_TASBIH",
        display: randomTasbihPhrase(lang || "en"),
        label: L.tasbihCardLabel,
        dir: L.dir,
        lang: lang || "en",
        theme: normalizeTheme(theme),
        position: normalizeTasbihPosition(tasbihPosition),
        // A test shows a quick 2s preview; the real prayer-time dhikr uses the
        // overlay's default (10s).
        durationMs: test ? 2000 : undefined
    };

    const results = await mapLimit(
        injectable, INJECT_CONCURRENCY, (tab) => showTasbihOnTab(tab.id, payload)
    );
    return results.some(Boolean) ? {
        ok: true
    } : {
        ok: false,
        reason: "inject-failed"
    };
}

// ---- Event wiring -----------------------------------------------------------

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === REFRESH_ALARM) {
        scheduleAlarms();
        return;
    }
    if (alarm.name === TASBIH_ALARM) {
        (async () => {
            // Re-arm the next random dhikr BEFORE anything else, so the cadence
            // continues even if this firing is suppressed (fixed mode auto-
            // repeats via periodInMinutes and needs no re-arm).
            const settings = await getTasbihSettings();
            if (settings.enabled && settings.mode === "random") {
                createTasbihAlarm(settings);
            }
            // Don't pop a card that only fired because Chrome just started (the
            // interval elapsed while it was closed).
            if (alarmFiredLate(alarm.scheduledTime, Date.now(), STALE_ALARM_GRACE_MS)) return;
            await showTasbihOnAllTabs();
        })();
        return;
    }
    if (isGameAlarm(alarm.name)) {
        if (!alarmFiredLate(alarm.scheduledTime, Date.now(), STALE_ALARM_GRACE_MS)) fireGameAlert(alarm.name);
        return;
    }
    if (alarm.name.startsWith("prayer:")) {
        // Skip a backlog of past-due alarms that fire only because Chrome just
        // started — notify/lock only for a prayer happening (about) now.
        if (alarmFiredLate(alarm.scheduledTime, Date.now(), STALE_ALARM_GRACE_MS)) return;
        const prayer = alarm.name.slice("prayer:".length);
        notifyPrayer(prayer);
        lockAllTabs(prayer);
    }
});

// While a lock window is active, lock any tab that finishes loading — covers
// tabs the user opens (Ctrl+T then navigate) or pages they navigate to.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== "complete" || !isLockableTab(tab)) return;
    if (!activeLockActive) return; // no lock window → don't touch storage
    const activeLock = await getActiveLock();
    if (activeLock) lockOneTab(tabId, activeLock.payload);
});

// Reschedule whenever the saved location changes (popup writes it).
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.location) {
        scheduleAlarms();
    } else if (area === "local" && isFirstGameState(changes)) {
        scheduleGameAlerts();
    }
    if (area === "local" && TASBIH_STORAGE_KEYS.some((key) => key in changes)) {
        resetTasbihAlarm();
    }
});

chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === "install") {
        await chrome.storage.local.set({
            ...DEFAULT_SETTINGS,
            ...DEFAULT_CITY_LABELS
        });
        const L = tr(DEFAULT_SETTINGS.lang);
        chrome.tabs.create({
            url: chrome.runtime.getURL("welcome.html")
        });
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

// Re-hydrate the in-memory lock flag whenever the worker cold-starts, so
// tabs.onUpdated re-locks new tabs even after the service worker was suspended.
chrome.storage.local.get("activeLock").then(({ activeLock }) => {
    activeLockActive = !!(activeLock && activeLock.unlockAt > Date.now());
});

// Clicking a notification opens the welcome page (install) or clears others.
chrome.notifications.onClicked.addListener((id) => {
    chrome.notifications.clear(id);
    if (id.startsWith("welcome-pin-")) {
        chrome.tabs.create({
            url: chrome.runtime.getURL("welcome.html")
        });
    } else if (isGameNotification(id)) {
        chrome.tabs.create({
            url: chrome.runtime.getURL("game.html")
        });
    }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "TEST_LOCK") {
        lockAllTabs(null, {
            test: true,
            allowUnlock: msg.allowUnlock === true
        }).then(sendResponse);
        return true;
    }
    if (msg?.type === "TEST_TASBIH") {
        showTasbihOnAllTabs({
            test: true
        }).then(sendResponse);
        return true;
    }
    if (msg?.type === "REFRESH_GAME_ALERTS") {
        scheduleGameAlerts().then(() => sendResponse({
            ok: true
        }));
        return true;
    }
    if (msg?.type === "UNLOCK_ALL") {
        clearAllLocks().then(() => sendResponse({
            ok: true
        }));
        return true;
    }
});