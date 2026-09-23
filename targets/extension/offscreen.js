// offscreen.js — plays the prayer-time sound for the extension.
//
// The lock overlay plays its own sound on desktop and Android, where the lock is
// a local page. The extension can't do that: the overlay is injected into every
// open tab, so each copy would play its own adhan, and Chrome's autoplay policy
// blocks audio in a page with no user gesture. So background.js mutes the
// injected overlays (sound: "none") and drives this document instead — one
// sound, on an extension page, where autoplay is allowed.
//
// This document closes itself once the sound is done (or once the lock window
// ends, whichever comes first). Only the ✕ on the overlay reaches background.js;
// a lock that simply runs out never does, so we can't wait to be told to stop.
//
// playBeep / playAdhan are ported from core/ui/overlay-lock.js; keep them in
// step with that file.

let activeSound = null;
let endTimer = null;
let finishAt = null;   // when the scheduled teardown will run
let hardStopAt = null; // end of the lock window — the sound never outlives it

const BEEP_DURATION_MS = 1500; // the two chimes below, plus a little slack

function playBeep() {
    try {
        const Ctx = self.AudioContext || self.webkitAudioContext;
        if (!Ctx) return null;
        const ctx = new Ctx();
        if (ctx.state === "suspended" && ctx.resume) { try { ctx.resume(); } catch {} }
        const now = ctx.currentTime;
        // Two gentle rising chimes (a perfect fifth), each with a soft decay.
        const notes = [
            { f: 880, t: 0.0 }, { f: 1318.51, t: 0.18 },
            { f: 880, t: 0.7 }, { f: 1318.51, t: 0.88 },
        ];
        for (const n of notes) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.value = n.f;
            const start = now + n.t;
            gain.gain.setValueAtTime(0.0001, start);
            gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
            osc.connect(gain).connect(ctx.destination);
            osc.start(start);
            osc.stop(start + 0.4);
        }
        scheduleFinish(BEEP_DURATION_MS);
        return { stop() { try { ctx.close(); } catch {} } };
    } catch { return null; }
}

function playAdhan(url) {
    try {
        const audio = new Audio(url);
        audio.preload = "auto";
        let done = false; // set once we've fallen back OR intentionally stopped
        // Only a genuine load/decode failure should fall back to the chime. Our
        // own teardown also fires "error", and must not play a spurious chime.
        audio.addEventListener("error", () => {
            if (done) return;
            done = true;
            activeSound = playBeep();
        });
        audio.addEventListener("ended", () => finish());
        const p = audio.play();
        if (p && p.catch) p.catch(() => {});
        return {
            stop() {
                done = true; // suppress the error our pause would otherwise raise
                try { audio.pause(); } catch {}
            }
        };
    } catch { return null; }
}

function stopSound() {
    if (activeSound && typeof activeSound.stop === "function") {
        try { activeSound.stop(); } catch {}
    }
    activeSound = null;
}

// Stop and tear the document down — nothing left to play.
function finish() {
    stopSound();
    if (endTimer) { clearTimeout(endTimer); endTimer = null; }
    window.close();
}

// Finish in `ms`, clamped to the end of the lock window. Only ever brings the
// end closer — a fallback chime must not extend a schedule already in place.
function scheduleFinish(ms) {
    const at = Math.min(
        Date.now() + ms,
        hardStopAt == null ? Infinity : hardStopAt,
        finishAt == null ? Infinity : finishAt
    );
    if (finishAt != null && at >= finishAt) return;
    if (endTimer) clearTimeout(endTimer);
    finishAt = at;
    endTimer = setTimeout(finish, Math.max(0, at - Date.now()));
}

function playSound(kind, stopAt) {
    stopSound();
    if (endTimer) { clearTimeout(endTimer); endTimer = null; }
    finishAt = null;
    hardStopAt = stopAt || null;
    if (kind === "none") { finish(); return; }
    // The adhan ends on its own "ended" event; playBeep schedules its own end.
    // The lock window backstops both, in case the audio is longer or stalls.
    activeSound = kind === "adhan"
        ? (playAdhan("audio/adhan.ogg") || playBeep())
        : playBeep();
    if (hardStopAt) scheduleFinish(hardStopAt - Date.now());
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.target !== "offscreen") return;
    if (msg.type === "PLAY_SOUND") playSound(msg.kind || "beep", msg.stopAt);
    else if (msg.type === "STOP_SOUND") stopSound();
    sendResponse({ ok: true });
});
