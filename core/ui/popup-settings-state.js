function T() { return tr(lang); }

// DEFAULT_LOCK_MINUTES / DEFAULT_TASBIH_* and the clamp/apiDate/timingsUrl
// helpers are shared from i18n.js (loaded before this script).

function updateLockOptionsVisibility() {
  el.lockOptions.hidden = !el.tabLock.checked;
}

function getTasbihIntervalMode() {
  return el.tasbihModeRandom.checked ? "random" : "fixed";
}

function updateTasbihOptionsVisibility() {
  const enabled = el.tasbihEnabled.checked;
  el.tasbihOptions.hidden = !enabled;
  if (!enabled) return;
  const isRandom = getTasbihIntervalMode() === "random";
  el.tasbihFixedOptions.hidden = isRandom;
  el.tasbihRandomOptions.hidden = !isRandom;
}

async function saveTasbihSettings() {
  let randomMin = clampTasbihMinutes(el.tasbihRandomMin.value, DEFAULT_TASBIH_RANDOM_MIN);
  let randomMax = clampTasbihMinutes(el.tasbihRandomMax.value, DEFAULT_TASBIH_RANDOM_MAX);
  if (randomMin > randomMax) {
    const tmp = randomMin;
    randomMin = randomMax;
    randomMax = tmp;
    el.tasbihRandomMin.value = String(randomMin);
    el.tasbihRandomMax.value = String(randomMax);
  }
  await Platform.store.set({
    tasbihEnabled: el.tasbihEnabled.checked,
    tasbihIntervalMode: getTasbihIntervalMode(),
    tasbihIntervalMinutes: clampTasbihMinutes(el.tasbihMinutes.value, DEFAULT_TASBIH_MINUTES),
    tasbihRandomMin: randomMin,
    tasbihRandomMax: randomMax,
    tasbihPosition: normalizeTasbihPosition(tasbihPosition)
  });
  tasbihPosition = normalizeTasbihPosition(tasbihPosition);
}

// Convert to Arabic-Indic digits when Arabic is active and the user chose that style.
function localizeNum(str) {
  if (lang === "hi") return toDevanagariDigits(str);
  if (!usesArabicDigits(lang, arabicDigits)) return str;
  return toArabicDigits(str);
}
