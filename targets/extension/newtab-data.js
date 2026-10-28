// New-tab I/O. Heavy prayer libraries and the task catalog are loaded only
// after the clock/search have painted; game history never blocks startup.
const NewTabData = (() => {
  const scripts = new Map();

  function loadScript(src) {
    if (!scripts.has(src)) {
      const pending = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src;
        script.onload = resolve;
        script.onerror = () => { script.remove(); reject(new Error(`Could not load ${src}`)); };
        document.head.append(script);
      }).catch((error) => { scripts.delete(src); throw error; });
      scripts.set(src, pending);
    }
    return scripts.get(src);
  }

  async function schedule(location, date = new Date()) {
    if (!NewTabPrayers.validLocation(location)) return null;
    const key = NewTabPrayers.cacheKey(location, date);
    const session = chrome.storage.session;
    if (session) {
      try {
        const cached = (await session.get(NewTabConfig.scheduleCacheKey))[NewTabConfig.scheduleCacheKey];
        if (NewTabPrayers.validSchedule(cached, key)) return cached;
      } catch { /* A session cache failure must not hide prayer times. */ }
    }
    await loadScript("vendor/adhan.js");
    await loadScript("prayer-engine.js");
    const today = NewTabPrayers.schedule(PrayerEngine, location, date);
    if (!NewTabPrayers.validSchedule(today, key)) return null;
    if (session) {
      try { await session.set({ [NewTabConfig.scheduleCacheKey]: today }); } catch { /* Compute again next tab. */ }
    }
    return today;
  }

  async function progress(today) {
    await loadScript("game-tasks.js");
    const { gameState } = await chrome.storage.local.get("gameState");
    return NewTabPrayers.progress(today, gameState);
  }

  async function accountSetting(settings) {
    const account = settings.gameAccount;
    if (!account?.token || Date.now() - (settings.newTabCheckedAt || 0) < NewTabConfig.settingCheckMs) return null;
    const response = await fetch(`${String(settings.gameApiUrl || NewTabConfig.apiDefault).replace(/\/+$/, "")}/v1/me`, {
      headers: { authorization: `Bearer ${account.token}` }, signal: AbortSignal.timeout(5000),
    });
    const patch = { newTabCheckedAt: Date.now() };
    if (response.ok) {
      const { user } = await response.json();
      if (typeof user?.settings?.newTab === "boolean") patch.newTabPage = user.settings.newTab;
    }
    return patch;
  }

  async function weather(latitude, longitude) {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,is_day`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const current = (await response.json()).current;
    if (!current || typeof current.temperature_2m !== "number") return null;
    return { at: Date.now(), lat: latitude, lon: longitude, temp: current.temperature_2m, code: current.weather_code, day: current.is_day === 1 };
  }

  function weatherIcon(code, isDay) {
    if (code === 0) return isDay ? "☀️" : "🌙";
    if (code <= 2) return isDay ? "🌤️" : "☁️";
    if (code === 3) return "☁️";
    if (code === 45 || code === 48) return "🌫️";
    if (code >= 51 && code <= 57) return "🌦️";
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "🌧️";
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "🌨️";
    return code >= 95 ? "⛈️" : "🌡️";
  }

  return { schedule, progress, accountSetting, weather, weatherIcon };
})();
