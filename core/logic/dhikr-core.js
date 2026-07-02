// dhikr-core.js — pure dhikr (tasbih) interval logic. No chrome.*, no I/O.
//
// Uses the shared clamp + DEFAULT_TASBIH_* helpers from i18n.js (loaded first).

// Inclusive random integer in [min, max]. Exposed so callers can inject a
// deterministic picker in tests.
function randomBetweenInclusive(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Normalize raw stored dhikr settings into a clean, clamped shape. Mirrors the
// original getTasbihSettings(): clamp the interval + random bounds and swap the
// bounds if min > max.
function normalizeTasbihSettings(stored) {
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
    randomMax,
  };
}

// Timer options for the dhikr alarm given normalized settings. Fixed mode repeats
// on its own (periodInMinutes); random mode is a one-shot (delayInMinutes) the
// caller re-arms on fire. `rand` is injectable for deterministic tests.
function tasbihAlarmOptions(settings, rand = randomBetweenInclusive) {
  if (settings.mode === "fixed") {
    return { periodInMinutes: settings.intervalMinutes };
  }
  return { delayInMinutes: rand(settings.randomMin, settings.randomMax) };
}
