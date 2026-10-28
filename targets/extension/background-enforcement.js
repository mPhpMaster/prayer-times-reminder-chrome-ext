// Tab enforcement, bounded injection and centralized sound. Loaded by the worker.
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
    await mapLimit(
        tabs.filter(isInjectableNow), INJECT_CONCURRENCY, (tab) =>
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => window.__prayerTabLockClear && window.__prayerTabLockClear()
            }).catch(() => {})
    );
}
