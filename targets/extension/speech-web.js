// speech-web.js — Platform.speech for the Chrome extension, on the browser's
// Web Speech API (webkitSpeechRecognition). ES module, imported lazily by
// adapter.js the first time the game opens the mic.
//
// Same contract as the Android shell (core/platform/platform.js):
//   start({ lang, onPartial, onFinal, onState, onError }) -> { ok, reason? }
//   stop()
// onState(false, { reason }) says why listening ended: "no-speech" (nothing
// heard / the player went quiet), "error", or "stopped" (stop() was called).
// The recognizer ends on its own after a pause; while phrases keep coming it
// is restarted, so one "Start reading" covers a whole recitation.

const STOP_FLUSH_MS = 1500; // wait this long for the last final result on stop()

let session = null; // { rec, active, heard, reason, ended: Promise }

function recognizerClass() {
  return globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition || null;
}

// Web Speech error codes -> a short, stable reason for the game's notice.
function errorReason(code) {
  if (code === "not-allowed" || code === "service-not-allowed") return "mic-denied";
  if (code === "audio-capture") return "no-mic";
  if (code === "network") return "offline";
  return code || "error";
}

export function status() {
  return Promise.resolve({ available: !!recognizerClass(), onDevice: false, permission: "prompt", whisper: false });
}

export async function stop() {
  const s = session;
  session = null;
  if (!s) return;
  s.active = false;
  s.reason = "stopped";
  try {
    s.rec.stop(); // flushes the phrase being spoken as a final result
  } catch {
    // already ended
  }
  await Promise.race([s.ended, new Promise((r) => setTimeout(r, STOP_FLUSH_MS))]);
}

export async function start({ lang = "ar-SA", onPartial, onFinal, onState, onError } = {}) {
  await stop();
  const Rec = recognizerClass();
  if (!Rec) return { ok: false, reason: "unsupported" };

  const rec = new Rec();
  rec.lang = lang;
  rec.continuous = true;
  rec.interimResults = !!onPartial;
  rec.maxAlternatives = 1;

  let endedResolve;
  const s = { rec, active: true, started: false, heard: false, reason: "no-speech", ended: new Promise((r) => (endedResolve = r)) };
  session = s;

  let startResolve;
  const started = new Promise((r) => (startResolve = r));

  rec.onstart = () => {
    s.started = true;
    startResolve({ ok: true });
    s.heard = false;
  };
  rec.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const text = String(e.results[i][0].transcript || "").trim();
      if (!text) continue;
      if (e.results[i].isFinal) {
        s.heard = true;
        if (onFinal) onFinal(text, {});
      } else if (onPartial) onPartial(text, {});
    }
  };
  rec.onerror = (e) => {
    const code = e && e.error;
    if (code === "aborted") return;
    if (code === "no-speech") {
      s.reason = "no-speech";
      return;
    }
    const reason = errorReason(code);
    s.reason = "error";
    s.active = false;
    // Before the mic opened, start() itself reports the failure.
    if (!s.started) return startResolve({ ok: false, reason });
    if (onError) onError({ code: reason, message: reason });
  };
  rec.onend = () => {
    // Still reading (a phrase arrived since the last start): keep listening.
    if (s.active && s.heard && session === s) {
      try {
        rec.start();
        return;
      } catch {
        s.reason = "error";
      }
    }
    s.active = false;
    if (session === s) session = null;
    startResolve({ ok: false, reason: s.reason });
    endedResolve();
    if (onState) onState(false, { reason: s.reason });
  };

  try {
    rec.start();
  } catch (e) {
    session = null;
    return { ok: false, reason: String((e && e.message) || e) };
  }
  const res = await started;
  if (res.ok && onState) onState(true);
  return res;
}
