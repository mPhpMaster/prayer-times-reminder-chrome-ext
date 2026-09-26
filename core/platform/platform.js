// platform.js — the unified platform contract.
//
// Each shell (Chrome extension, Tauri desktop, Capacitor mobile) installs a
// `globalThis.__PTPlatform` object implementing the shape below BEFORE the core
// UI/logic scripts run. Core code (core/ui/*, core/logic/*) then talks only to
// `Platform.*` and never touches chrome.*, Tauri invoke(), or Capacitor plugins
// directly — which is what lets one core run unchanged on every shell.
//
// Contract (every method is async / returns a Promise unless noted):
//   Platform.name                          "chrome" | "tauri" | "capacitor"
//   Platform.store.get(keys)               -> object   (keys: string | string[] | null)
//   Platform.store.set(obj)                -> void
//   Platform.store.remove(keys)            -> void
//   Platform.store.onChange(cb)            cb(changes) on local-store changes (sync registration)
//   Platform.geo.current(opts)             -> { latitude, longitude }
//   Platform.enforce.test({ allowUnlock }) -> { ok, reason? }   run a test lock now
//   Platform.enforce.clear()               -> { ok }            end any active lock
//   Platform.dhikr.test()                  -> { ok, reason? }   show a test dhikr now
//   Platform.runtime.getURL(path)          -> string   (sync)
//   Platform.devBuild?()                   -> boolean   optional (Android): true only in the
//                                            debug build; gates developer-only screens
//   Platform.speech?                       optional (Android only for now):
//     .status()                            -> { available, onDevice, permission, whisper }
//     .start({ lang, preferOffline, engine: "default"|"onDevice"|"whisper",
//              onPartial, onFinal, onState, onSpeech, onError }) -> { ok, reason? }
//                                          onState(false, { reason }) when it ends:
//                                          "no-speech" | "error" | "stopped"
//     .stop()                              close the mic
//   Platform.runtime.closeOnboarding()     close the onboarding/welcome surface
//
// Background scheduling + the prayer-time enforcement fan-out are provided by
// each shell's own background layer built on the pure helpers in core/logic/*
// (scheduler-core, dhikr-core); they are not part of this page-facing contract.

const Platform = globalThis.__PTPlatform;

if (!Platform) {
  // Fail loudly and early: a missing adapter otherwise surfaces later as a
  // confusing "cannot read properties of undefined". The shell must load its
  // adapter (e.g. adapter-chrome.js) before any core script.
  throw new Error(
    "Platform adapter missing — load a platform adapter before core scripts."
  );
}
