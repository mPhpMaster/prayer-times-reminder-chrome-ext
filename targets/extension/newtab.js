// newtab.js — the extension's new tab: a clock and the weather, the next
// prayer as hours / minutes / seconds boxes (as in the app), today's prayer
// times, a web search (the browser's own engine via chrome.search), a dhikr
// to copy or keep as a favorite, and how far the current prayer's adhkar
// tasks are. The sky behind it follows the prayer times (dawn, morning, noon,
// afternoon, sunset, night) unless the reader picks a fixed background.
//
// On/off: store key "newTabPage" (default on), which follows the account's
// "newTab" setting (PATCH /v1/me settings) so it can be changed from any of the
// apps. Chrome can't switch an override off, so when it's off this page sends
// the tab straight to Chrome's own new-tab page before showing anything.
//
// Kept in this browser only: ntBackground, ntWeather (on/off), ntFavDhikr,
// ntWeatherCache. The weather comes from Open-Meteo (no account, no key),
// asked with the saved city's coordinates rounded to ~10 km.

(function () {
  const $ = (id) => document.getElementById(id);
  const PRAYERS = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];
  const FIVE = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
  const ICONS = { Fajr: "🌄", Sunrise: "🌅", Dhuhr: "☀️", Asr: "🌤️", Maghrib: "🌇", Isha: "🌙" };
  const BACKGROUNDS = ["sky", "emerald", "night", "desert", "dawn"];
  const API_DEFAULT = "https://prayer-times.sarhsoft.com"; // = GAME_API_DEFAULT (game-sync.js)
  const SETTING_CHECK_MS = 6 * 3600 * 1000;
  const WEATHER_MS = 30 * 60 * 1000;
  const SOON_MS = 10 * 60 * 1000; // the countdown pulses in the last ten minutes

  let s = {}; // storage snapshot
  let L = null;
  let lang = "en";
  let today = null; // { at: {prayer: ms}, tomorrowFajr, yesterdayIsha, day }

  function toChromeNewTab() {
    chrome.tabs.getCurrent((tab) => {
      if (!tab) return show();
      chrome.tabs.update(tab.id, { url: "chrome://new-tab-page" }, () => {
        if (chrome.runtime.lastError) show(); // couldn't leave: show ours rather than a blank tab
      });
    });
  }

  function show() {
    document.documentElement.classList.remove("nt-pending");
  }

  function save(patch) {
    Object.assign(s, patch);
    return chrome.storage.local.set(patch);
  }

  let toastTimer = 0;
  function toast(text) {
    clearTimeout(toastTimer);
    $("toast").textContent = text;
    $("toast").hidden = false;
    toastTimer = setTimeout(() => ($("toast").hidden = true), 2200);
  }

  // The account's "newTab" setting, checked now and then (a change on the
  // phone reaches this browser within hours, or at once from the game page).
  async function followAccountSetting() {
    const acct = s.gameAccount;
    if (!acct || !acct.token || Date.now() - (s.newTabCheckedAt || 0) < SETTING_CHECK_MS) return;
    try {
      const res = await fetch(`${String(s.gameApiUrl || API_DEFAULT).replace(/\/+$/, "")}/v1/me`, {
        headers: { authorization: `Bearer ${acct.token}` },
      });
      const patch = { newTabCheckedAt: Date.now() };
      if (res.ok) {
        const { user } = await res.json();
        if (user && user.settings && typeof user.settings.newTab === "boolean") patch.newTabPage = user.settings.newTab;
      }
      await save(patch);
    } catch {
      /* offline: try again next time */
    }
  }

  // ---- time & prayers --------------------------------------------------------------

  function locale() {
    const info = SUPPORTED_LANGS.find((l) => l.code === lang);
    return (info && info.locale) || lang;
  }

  function fmtTime(ms) {
    try {
      return new Date(ms).toLocaleTimeString(locale(), { hour: "numeric", minute: "2-digit", hour12: !uses24hClock(lang) });
    } catch {
      return new Date(ms).toTimeString().slice(0, 5);
    }
  }

  function fmtDate(d) {
    if (DATE_NAMES[lang]) return `${weekdayLabel(lang, locale(), d)}${L.dir === "rtl" ? "، " : ", "}${d.getDate()} ${monthName(lang, locale(), d)}`;
    return d.toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long" });
  }

  const pad = (n) => String(n).padStart(2, "0");
  // Same digits as the prayer-times window (popup.js localizeNum).
  const digits = (str) => (lang === "hi" ? toDevanagariDigits(str) : usesArabicDigits(lang, s.arabicDigits) ? toArabicDigits(str) : str);

  function computeToday() {
    const loc = s.location;
    if (!loc || loc.latitude == null) return null;
    try {
      const now = new Date();
      const day = (d) => {
        const data = PrayerEngine.timings(loc, d);
        return { t: data.timings, tz: data.meta && data.meta.timezone, d };
      };
      const a = day(now);
      const at = {};
      for (const p of PRAYERS) at[p] = prayerTimestamp(a.t[p], now, a.tz);
      const tm = day(new Date(now.getTime() + 86400000));
      const ye = day(new Date(now.getTime() - 86400000));
      return {
        at,
        tomorrowFajr: prayerTimestamp(tm.t.Fajr, tm.d, tm.tz),
        yesterdayIsha: prayerTimestamp(ye.t.Isha, ye.d, ye.tz),
        day: now.getDate(),
      };
    } catch {
      return null;
    }
  }

  // The sky: which part of the day it is, by the prayer times (by the clock
  // when no city is set yet).
  function phase(now) {
    if (!today) {
      const h = new Date(now).getHours();
      return h < 5 ? "night" : h < 7 ? "dawn" : h < 12 ? "morning" : h < 15 ? "noon" : h < 18 ? "afternoon" : h < 20 ? "sunset" : "night";
    }
    const a = today.at;
    if (now < a.Fajr) return "night";
    if (now < a.Sunrise) return "dawn";
    if (now < a.Dhuhr) return "morning";
    if (now < a.Asr) return "noon";
    if (now < a.Maghrib) return "afternoon";
    if (now < a.Isha) return "sunset";
    return "night";
  }

  function renderTimes() {
    const list = $("times");
    $("today-title").textContent = L.ntTodayTitle;
    $("set-city").hidden = !!today;
    $("set-city").textContent = L.webOpenApp;
    if (!today) return list.replaceChildren();
    const now = Date.now();
    const next = FIVE.find((p) => today.at[p] > now) || "Fajr";
    list.replaceChildren(
      ...PRAYERS.map((p) => {
        const li = document.createElement("li");
        if (p === next) li.className = "is-next";
        else if (today.at[p] < now) li.className = "is-past";
        if (p === "Sunrise") li.classList.add("info");
        const name = document.createElement("span");
        name.textContent = `${ICONS[p]}  ${prayerLabel(L, p)}`;
        const t = document.createElement("span");
        t.className = "t";
        t.textContent = digits(fmtTime(today.at[p]));
        li.append(name, t);
        return li;
      })
    );
  }

  function tick() {
    const now = Date.now();
    const d = new Date(now);
    if (today && today.day !== d.getDate()) {
      today = computeToday(); // a new day
      renderTimes();
      renderTasks();
    }
    $("clock").textContent = digits(fmtTime(now));
    $("date").textContent = digits(fmtDate(d));
    document.body.dataset.phase = phase(now);

    if (!today) return ($("next").hidden = true);
    let next = FIVE.find((p) => today.at[p] > now);
    const at = next ? today.at[next] : today.tomorrowFajr;
    if (!next) next = "Fajr";
    // The wait started at the previous prayer (last night's Isha before Fajr).
    const i = FIVE.indexOf(next);
    const from = next === "Fajr" ? (now < today.at.Fajr ? today.yesterdayIsha : today.at.Isha) : today.at[FIVE[i - 1]];
    const secs = Math.max(0, Math.floor((at - now) / 1000));
    $("next").hidden = false;
    $("next-label").textContent = L.nextPrayer;
    $("next-name").textContent = `${ICONS[next]} ${prayerLabel(L, next)} · ${digits(fmtTime(at))}`;
    $("cd-h").textContent = digits(pad(Math.floor(secs / 3600)));
    $("cd-m").textContent = digits(pad(Math.floor((secs % 3600) / 60)));
    $("cd-s").textContent = digits(pad(secs % 60));
    $("boxes").setAttribute("aria-label", L.countdown(Math.floor(secs / 3600), Math.floor((secs % 3600) / 60), secs % 60));
    $("wait-bar").style.width = `${Math.min(100, Math.max(0, ((now - from) / Math.max(1, at - from)) * 100)).toFixed(1)}%`;
    $("next").classList.toggle("soon", at - now <= SOON_MS);
    if (secs === 0) setTimeout(renderTimes, 1500);
  }

  // ---- weather ------------------------------------------------------------------------------

  // WMO weather codes -> an icon (day / night where it matters).
  function weatherIcon(code, isDay) {
    if (code === 0) return isDay ? "☀️" : "🌙";
    if (code <= 2) return isDay ? "🌤️" : "☁️";
    if (code === 3) return "☁️";
    if (code === 45 || code === 48) return "🌫️";
    if (code >= 51 && code <= 57) return "🌦️";
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "🌧️";
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "🌨️";
    if (code >= 95) return "⛈️";
    return "🌡️";
  }

  function showWeather(w) {
    const on = s.ntWeather !== false && w && typeof w.temp === "number";
    $("weather").hidden = !on;
    if (!on) return;
    $("w-icon").textContent = weatherIcon(w.code, w.day);
    $("w-temp").textContent = digits(`${Math.round(w.temp)}°`);
  }

  async function renderWeather() {
    const loc = s.location;
    if (s.ntWeather === false || !loc || loc.latitude == null) return showWeather(null);
    const lat = Math.round(loc.latitude * 10) / 10; // ~10 km: enough for the weather
    const lon = Math.round(loc.longitude * 10) / 10;
    const c = s.ntWeatherCache;
    if (c && c.lat === lat && c.lon === lon && Date.now() - c.at < WEATHER_MS) return showWeather(c);
    if (c && c.lat === lat && c.lon === lon) showWeather(c); // stale meanwhile
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day`);
      if (!res.ok) return;
      const cur = (await res.json()).current || {};
      const w = { at: Date.now(), lat, lon, temp: cur.temperature_2m, code: cur.weather_code, day: cur.is_day === 1 };
      await save({ ntWeatherCache: w });
      showWeather(w);
    } catch {
      /* offline: no weather this time */
    }
  }

  // ---- the current prayer's adhkar tasks ----------------------------------------------

  function renderTasks() {
    const card = $("tasks-card");
    if (!s.location || s.location.latitude == null) return (card.hidden = true);
    try {
      const w = currentWindow(PrayerEngine, s.location, new Date());
      const ids = tasksForWindow(w.prayer).map((t) => t.id);
      const entry = s.gameState && s.gameState.windows && s.gameState.windows[w.key];
      const done = ids.filter((id) => entry && entry.tasks && entry.tasks[id] && entry.tasks[id].doneAt).length;
      const name = prayerLabel(L, w.prayer);
      const share = done / Math.max(1, ids.length);
      $("tasks-text").textContent = done >= ids.length ? L.ntTasksDone(name) : L.ntTasks(name, done, ids.length);
      $("tasks-bar").style.width = `${Math.round(share * 100)}%`;
      const circumference = 2 * Math.PI * 18;
      $("ring-fill").style.strokeDasharray = `${(share * circumference).toFixed(1)} ${circumference.toFixed(1)}`;
      $("ring-pct").textContent = digits(`${Math.round(share * 100)}%`);
      $("tasks-open").textContent = L.ntOpenTasks;
      card.classList.toggle("all-done", done >= ids.length);
      card.hidden = false;
    } catch {
      card.hidden = true;
    }
  }

  // ---- a dhikr ----------------------------------------------------------------------------
  // Shown in the reader's language; in any other language than Arabic the
  // Arabic original follows on its own line. Favorites come up more often.
  let current = null;
  let lastAr = null;
  const favs = () => (Array.isArray(s.ntFavDhikr) ? s.ntFavDhikr : []);

  function pickDhikr() {
    const pool = TASBIH_PHRASES.filter((p) => p.randomReminder !== false);
    const fav = pool.filter((p) => favs().includes(p.ar) && p.ar !== lastAr);
    const from = fav.length && Math.random() < 0.4 ? fav : pool.filter((p) => p.ar !== lastAr);
    return from[Math.floor(Math.random() * from.length)];
  }

  function dhikrText(item) {
    return lang === "ar" ? item.ar : `${itemLabel(item, lang)}\n${item.ar}`;
  }

  function renderDhikr(item = current) {
    current = item || pickDhikr();
    lastAr = current.ar;
    const main = $("dhikr-main");
    if (lang === "ar") {
      main.textContent = current.ar;
      main.lang = "ar";
      main.dir = "rtl";
      $("dhikr-ar").hidden = true;
    } else {
      main.textContent = itemLabel(current, lang);
      main.lang = lang;
      main.dir = "auto";
      $("dhikr-ar").textContent = current.ar;
      $("dhikr-ar").hidden = false;
    }
    const isFav = favs().includes(current.ar);
    $("dhikr-fav").setAttribute("aria-pressed", String(isFav));
    $("dhikr-fav").textContent = isFav ? `♥ ${L.ntUnfav}` : `♡ ${L.ntFav}`;
    $("dhikr-copy").textContent = `⧉ ${L.ntCopy}`;
    $("dhikr-next").textContent = `↻ ${L.ntAnother}`;
  }

  // ---- settings: background and weather -------------------------------------------------

  function applyBackground() {
    const bg = BACKGROUNDS.includes(s.ntBackground) ? s.ntBackground : "sky";
    document.body.dataset.bg = bg;
    for (const b of document.querySelectorAll("[data-bg-choice]")) b.setAttribute("aria-pressed", String(b.dataset.bgChoice === bg));
  }

  function renderSettings() {
    $("settings-title").textContent = L.ntSettings;
    $("bg-title").textContent = L.ntBgTitle;
    $("weather-label").textContent = L.ntWeatherToggle;
    $("weather-on").checked = s.ntWeather !== false;
    $("close-settings").setAttribute("aria-label", L.ntClose);
    const names = { sky: L.ntBgSky, emerald: L.ntBgEmerald, night: L.ntBgNight, desert: L.ntBgDesert, dawn: L.ntBgDawn };
    $("bg-choices").replaceChildren(
      ...BACKGROUNDS.map((bg) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = `bg-choice bg-${bg}`;
        b.dataset.bgChoice = bg;
        const swatch = document.createElement("span");
        swatch.className = "swatch";
        const label = document.createElement("span");
        label.textContent = names[bg];
        b.append(swatch, label);
        b.addEventListener("click", () => save({ ntBackground: bg }).then(applyBackground));
        return b;
      })
    );
    applyBackground();
  }

  function openSettings(open) {
    $("settings").hidden = !open;
    if (open) $("close-settings").focus();
    else $("open-settings").focus();
  }

  // ---- start ------------------------------------------------------------------------------

  function render() {
    L = tr(lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = L.dir;
    document.title = L.appTitle;
    $("q").placeholder = L.ntSearchPh;
    $("q").setAttribute("aria-label", L.ntSearchPh);
    $("cd-h-l").textContent = L.countdownHours;
    $("cd-m-l").textContent = L.countdownMin;
    $("cd-s-l").textContent = L.countdownSec;
    for (const [id, label] of [["go-times", L.webOpenApp], ["go-game", L.webOpenGame], ["open-settings", L.ntSettings]]) {
      $(id).setAttribute("aria-label", label);
      $(id).title = label;
    }
    today = computeToday();
    renderTimes();
    renderTasks();
    renderDhikr(current);
    renderSettings();
    tick();
  }

  $("search").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = $("q").value.trim();
    if (text) chrome.search.query({ text, disposition: "CURRENT_TAB" });
  });
  $("dhikr-next").addEventListener("click", () => renderDhikr(pickDhikr()));
  $("dhikr-copy").addEventListener("click", () => {
    navigator.clipboard.writeText(dhikrText(current)).then(() => toast(L.ntCopied), () => {});
  });
  $("dhikr-fav").addEventListener("click", async () => {
    const list = favs().filter((a) => a !== current.ar);
    if (list.length === favs().length) list.push(current.ar);
    await save({ ntFavDhikr: list });
    renderDhikr(current);
  });
  $("open-settings").addEventListener("click", () => openSettings(true));
  $("close-settings").addEventListener("click", () => openSettings(false));
  $("settings").addEventListener("click", (e) => {
    if (e.target === $("settings")) openSettings(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("settings").hidden) openSettings(false);
  });
  $("weather-on").addEventListener("change", async (e) => {
    await save({ ntWeather: e.target.checked });
    renderWeather();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    for (const [k, v] of Object.entries(changes)) s[k] = v.newValue;
    if (changes.lang) lang = SUPPORTED_LANGS.some((l) => l.code === s.lang) ? s.lang : lang;
    if (changes.lang || changes.location || changes.arabicDigits) {
      render();
      if (changes.location) renderWeather();
    } else if (changes.gameState) renderTasks();
  });

  chrome.storage.local
    .get([
      "newTabPage", "newTabCheckedAt", "lang", "location", "arabicDigits", "gameState", "gameAccount", "gameApiUrl",
      "ntBackground", "ntWeather", "ntFavDhikr", "ntWeatherCache",
    ])
    .then((got) => {
      s = got;
      if (s.newTabPage === false) return toChromeNewTab();
      lang = SUPPORTED_LANGS.some((l) => l.code === s.lang) ? s.lang : DEFAULT_SETTINGS.lang;
      render();
      show();
      setInterval(tick, 1000);
      renderWeather();
      setInterval(renderWeather, WEATHER_MS);
      followAccountSetting();
      $("q").focus();
    });
})();
