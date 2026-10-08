/*
 * Prayer Times Break — Vencord userplugin
 * Copyright (c) 2026 mPhpMaster
 * SPDX-License-Identifier: MIT
 */

// The Discord shell's platform layer: timers, notifications and driving the
// shared overlays. All prayer math, text and overlay UI come from core/ via
// core.generated.js — nothing here re-implements them.

import { showNotification } from "@api/Notifications";

import {
    buildLockConfig,
    clampLockMinutes,
    clampTasbihMinutes,
    DEFAULT_TASBIH_MINUTES,
    installOverlays,
    LockConfig,
    normalizeTasbihPosition,
    normalizeTheme,
    planPrayerAlarms,
    PrayerEngine,
    prayerLabel,
    prayerTimestamp,
    PrayerTimingsResult,
    randomTasbihPhrase,
    tr
} from "./core.generated";
import { onSettingsChange, settings } from "./settings";

const PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;
const LISTED = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;

// A prayer whose moment passed more than this long ago (e.g. the PC slept
// through it) is skipped instead of locking Discord out of the blue.
const LATE_GRACE_MS = 10 * 60 * 1000;
// Safety net for sleep/wake, clock changes and the midnight re-plan.
const WATCHDOG_MS = 30 * 1000;
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

// Globals installed by core/ui/overlay-lock.js and overlay-tasbih.js.
interface OverlayWindow {
    __prayerTabLockActivate?: (config: LockConfig) => void;
    __prayerTabLockClear?: () => void;
    __prayerTabLockInjected?: boolean;
    __prayerTasbihActivate?: (payload: Record<string, unknown>) => void;
    __prayerTasbihClear?: () => void;
    __prayerTasbihInjected?: boolean;
}
const OVERLAY_GLOBALS = [
    "__prayerTabLockActivate", "__prayerTabLockClear", "__prayerTabLockInjected",
    "__prayerTasbihActivate", "__prayerTasbihClear", "__prayerTasbihInjected"
] as const;
const win = () => window as unknown as OverlayWindow;

interface PlannedPrayer { key: string; prayer: string; when: number; }

let running = false;
let plannedDay = "";
let plan: PlannedPrayer[] = [];
const fired = new Set<string>();
let nextTimer: ReturnType<typeof setTimeout> | null = null;
let watchdog: ReturnType<typeof setInterval> | null = null;
let dhikrTimer: ReturnType<typeof setInterval> | null = null;
let dhikrEveryMs = 0;
let lockUntil = 0;

// ---- settings -> core shapes ------------------------------------------------

function lang(): string {
    return String(settings.store.language || "ar");
}

/** The configured location, or null while latitude/longitude are unset (0, 0). */
export function configuredLocation() {
    const latitude = Number(settings.store.latitude);
    const longitude = Number(settings.store.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    if (latitude === 0 && longitude === 0) return null;
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
    return { latitude, longitude, method: Number(settings.store.method ?? 4) };
}

function dayKey(d: Date) {
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// ---- prayer-time scheduling -------------------------------------------------

function replan() {
    plan = [];
    const now = new Date();
    plannedDay = dayKey(now);
    const loc = configuredLocation();
    if (!loc) return;
    let data: PrayerTimingsResult;
    try {
        data = PrayerEngine.timings(loc, now);
    } catch (e) {
        console.error("[PrayerTimesBreak] could not compute prayer times", e);
        return;
    }
    for (const { id, when } of planPrayerAlarms(data.timings, PRAYERS, now, data.meta.timezone)) {
        const prayer = id.replace(/^prayer:/, "");
        plan.push({ key: `${plannedDay}:${prayer}`, prayer, when });
    }
}

function armNextTimer() {
    if (nextTimer) clearTimeout(nextTimer);
    nextTimer = null;
    const now = Date.now();
    const next = plan.find(p => !fired.has(p.key) && p.when > now);
    if (!next) return;
    nextTimer = setTimeout(check, Math.min(next.when - now + 50, MAX_TIMEOUT_MS));
}

function check() {
    if (!running) return;
    const now = new Date();
    if (dayKey(now) !== plannedDay) {
        fired.clear();
        replan();
    }
    for (const p of plan) {
        if (fired.has(p.key) || p.when > now.getTime()) continue;
        fired.add(p.key);
        if (now.getTime() - p.when <= LATE_GRACE_MS) onPrayerTime(p.prayer);
    }
    armNextTimer();
}

function onPrayerTime(prayer: string) {
    const L = tr(lang());
    const name = prayerLabel(L, prayer, new Date());
    const s = settings.store;

    if (s.notify) {
        showNotification({
            title: L.notifTitle(name),
            body: L.notifBody(name)
        });
    }

    if (s.lockEnabled) {
        const config = buildLockConfig({
            lang: lang(),
            theme: normalizeTheme(s.theme),
            lockMinutes: clampLockMinutes(s.lockMinutes),
            allowUnlock: s.allowUnlock === true,
            prayerSound: s.sound === "none" ? "none" : "beep",
            arabicDigits: false
        }, { prayerName: name });
        config.onUnlock = () => { lockUntil = 0; };
        lockUntil = config.unlockAt;
        win().__prayerTasbihClear?.();
        installOverlays();
        win().__prayerTabLockActivate?.(config);
    }
}

// /prayertimes-test: the notification and a one-minute lock (with an unlock
// button), for the next prayer, right now — to try the plugin.
export function previewLock() {
    const L = tr(lang());
    const loc = configuredLocation();
    const next = loc ? nextPrayerName() : "Dhuhr";
    const name = prayerLabel(L, next, new Date());
    showNotification({ title: L.notifTitle(name), body: L.notifBody(name) });
    const config = buildLockConfig({
        lang: lang(),
        theme: normalizeTheme(settings.store.theme),
        lockMinutes: 1,
        allowUnlock: true,
        prayerSound: settings.store.sound === "none" ? "none" : "beep",
        arabicDigits: false
    }, { prayerName: name });
    config.onUnlock = () => { lockUntil = 0; };
    lockUntil = config.unlockAt;
    win().__prayerTasbihClear?.();
    installOverlays();
    win().__prayerTabLockActivate?.(config);
}

function nextPrayerName(): string {
    try {
        const loc = configuredLocation();
        if (!loc) return "Fajr";
        const now = new Date();
        const data = PrayerEngine.timings(loc, now);
        const tz = data.meta && data.meta.timezone;
        for (const p of ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"]) {
            const at = prayerTimestamp(data.timings[p], now, tz);
            if (at && at > now.getTime()) return p;
        }
    } catch { /* fall through */ }
    return "Fajr";
}

// ---- dhikr reminders --------------------------------------------------------

function showDhikr() {
    if (!running || Date.now() < lockUntil) return; // never on top of the prayer lock
    const code = lang();
    const L = tr(code);
    // Same payload shape as the extension / desktop / mobile shells.
    const payload = {
        type: "ACTIVATE_TASBIH",
        display: randomTasbihPhrase(code),
        label: L.tasbihCardLabel,
        dir: L.dir,
        lang: code,
        theme: normalizeTheme(settings.store.theme),
        position: normalizeTasbihPosition(settings.store.dhikrPosition)
    };
    installOverlays();
    win().__prayerTasbihActivate?.(payload);
}

function rearmDhikr() {
    const every = settings.store.dhikrEnabled
        ? clampTasbihMinutes(settings.store.dhikrMinutes, DEFAULT_TASBIH_MINUTES) * 60 * 1000
        : 0;
    if (every === dhikrEveryMs && (every === 0) === (dhikrTimer === null)) return; // unchanged
    if (dhikrTimer) clearInterval(dhikrTimer);
    dhikrTimer = every ? setInterval(showDhikr, every) : null;
    dhikrEveryMs = every;
}

// ---- lifecycle --------------------------------------------------------------

function reschedule() {
    if (!running) return;
    replan();
    armNextTimer();
    rearmDhikr();
}

let warnedNoLocation = false;

export function start() {
    running = true;
    fired.clear();
    onSettingsChange(reschedule);
    reschedule();
    watchdog = setInterval(check, WATCHDOG_MS);
    if (!configuredLocation() && !warnedNoLocation) {
        warnedNoLocation = true;
        const L = tr(lang());
        showNotification({ title: L.noLocation, body: L.vencordCoordsHint });
    }
}

export function stop() {
    running = false;
    onSettingsChange(() => { });
    if (nextTimer) clearTimeout(nextTimer);
    if (watchdog) clearInterval(watchdog);
    if (dhikrTimer) clearInterval(dhikrTimer);
    nextTimer = watchdog = dhikrTimer = null;
    dhikrEveryMs = 0;
    plan = [];
    plannedDay = "";
    lockUntil = 0;

    const w = win();
    try { w.__prayerTabLockClear?.(); } catch { }
    try { w.__prayerTasbihClear?.(); } catch { }
    document.getElementById("prayer-times-lock-root")?.remove();
    document.getElementById("prayer-times-tasbih-root")?.remove();
    // Drop the overlay globals (incl. their install guards) so a later start()
    // re-installs them cleanly.
    for (const key of OVERLAY_GLOBALS) delete (w as unknown as Record<string, unknown>)[key];
}

// ---- /prayertimes -----------------------------------------------------------

function countdownText(L: ReturnType<typeof tr>, ms: number) {
    const total = Math.max(0, Math.floor(ms / 1000));
    return L.countdown(Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60);
}

/** Today's times + the next prayer, localized, as a Discord message body. */
export function todayReport(): string {
    const L = tr(lang());
    const loc = configuredLocation();
    if (!loc) return `**${L.noLocation}**\n${L.vencordCoordsHint}`;

    const now = new Date();
    const data = PrayerEngine.timings(loc, now);
    const tz = data.meta.timezone;
    const { hijri } = data.date;
    const hijriMonth = lang() === "ar" ? hijri.month.ar : hijri.month.en;

    const lines = [
        `🕌 **${L.appTitle}** — ${data.date.gregorian.date} · ${hijri.day} ${hijriMonth} ${hijri.year} ${L.ahLabel}`,
        `📍 ${loc.latitude}, ${loc.longitude} (${tz})`,
        ""
    ];
    for (const key of LISTED) lines.push(`**${prayerLabel(L, key, now)}**: ${data.timings[key]}`);
    lines.push("");

    const next = PRAYERS
        .map(key => ({ key, when: prayerTimestamp(data.timings[key], now, tz) }))
        .find(p => p.when != null && p.when > now.getTime());
    if (next && next.when != null) {
        lines.push(`⏭️ **${L.nextPrayer}**: ${prayerLabel(L, next.key, now)} ${data.timings[next.key]} (${countdownText(L, next.when - now.getTime())})`);
    } else {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const t = PrayerEngine.timings(loc, tomorrow);
        lines.push(`${L.allDone}`);
        lines.push(`⏭️ **${L.nextPrayer}**: ${L.fajrTomorrow} ${t.timings.Fajr}`);
    }
    return lines.join("\n");
}
