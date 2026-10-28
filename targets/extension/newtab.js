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
  const { five: FIVE, icons: ICONS, backgrounds: BACKGROUNDS, weatherMs: WEATHER_MS, soonMs: SOON_MS } = NewTabConfig;

  let s = {}; // storage snapshot
  let L = null;
  let lang = "en";
  let today = null;
  let progress = null; // Only completed IDs for the current window, never the full history.
  let timeFormat = null;
  let lastDate = "";
  let lastOffset = null;
  let lastNext = "";
  let revision = 0;
  let clockTimer = 0;
  let weatherTimer = 0;
  let listening = false;
  let started = false;

  function text(id, value) {
    if ($(id).textContent !== value) $(id).textContent = value;
  }

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
    try {
      const patch = await NewTabData.accountSetting(s);
      if (patch) await save(patch);
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
      if (!timeFormat) timeFormat = new Intl.DateTimeFormat(locale(), { hour: "numeric", minute: "2-digit", hour12: !uses24hClock(lang) });
      return timeFormat.format(ms);
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
  const cards = createNewTabCards(() => ({ s, L, today, progress }), { digits, fmtTime });

  async function refreshProgress(expected = revision) {
    if (!today || document.hidden) return;
    try {
      const next = await NewTabData.progress(today);
      if (expected !== revision || document.hidden) return;
      progress = next;
      renderTasks();
    } catch { $("tasks-card").hidden = true; }
  }

  async function refreshPrayers() {
    const expected = ++revision;
    try {
      const next = await NewTabData.schedule(s.location);
      if (expected !== revision || document.hidden) return;
      today = next;
      progress = null;
      renderTasks();
      lastNext = "";
      renderTimes();
      tick();
      refreshProgress(expected);
    } catch {
      if (expected === revision) { today = null; progress = null; renderTimes(); renderTasks(); tick(); }
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

  function renderTimes() { return cards.renderTimes(); }

  function tick() {
    const now = Date.now();
    const d = new Date(now);
    const day = NewTabPrayers.dayKey(d);
    const offset = d.getTimezoneOffset();
    if (lastOffset !== offset) { timeFormat = null; lastDate = ""; lastNext = ""; }
    if (today && (today.day !== day || (lastOffset !== null && lastOffset !== offset))) {
      today = null;
      progress = null;
      renderTasks();
      refreshPrayers();
    }
    lastOffset = offset;
    text("clock", digits(fmtTime(now)));
    if (lastDate !== day) { text("date", digits(fmtDate(d))); lastDate = day; }
    const sky = phase(now);
    if (document.body.dataset.phase !== sky) document.body.dataset.phase = sky;

    if (!today) return ($("next").hidden = true);
    let next = FIVE.find((p) => today.at[p] > now);
    const at = next ? today.at[next] : today.tomorrowFajr;
    if (!next) next = "Fajr";
    // The wait started at the previous prayer (last night's Isha before Fajr).
    const i = FIVE.indexOf(next);
    const from = next === "Fajr" ? (now < today.at.Fajr ? today.yesterdayIsha : today.at.Isha) : today.at[FIVE[i - 1]];
    const secs = Math.max(0, Math.floor((at - now) / 1000));
    $("next").hidden = false;
    if (lastNext !== String(at)) {
      text("next-label", L.nextPrayer);
      text("next-name", `${ICONS[next]} ${prayerLabel(L, next)} · ${digits(fmtTime(at))}`);
      lastNext = String(at);
      renderTimes();
      if (progress && NewTabPrayers.currentWindow(today, now).key !== progress.key) refreshProgress();
    }
    text("cd-h", digits(pad(Math.floor(secs / 3600))));
    text("cd-m", digits(pad(Math.floor((secs % 3600) / 60))));
    text("cd-s", digits(pad(secs % 60)));
    $("boxes").setAttribute("aria-label", L.countdown(Math.floor(secs / 3600), Math.floor((secs % 3600) / 60), secs % 60));
    const width = `${Math.min(100, Math.max(0, ((now - from) / Math.max(1, at - from)) * 100)).toFixed(1)}%`;
    if ($("wait-bar").style.width !== width) $("wait-bar").style.width = width;
    $("next").classList.toggle("soon", at - now <= SOON_MS);
    if (secs === 0) setTimeout(renderTimes, 1500);
  }

  // ---- weather ------------------------------------------------------------------------------

  function showWeather (w) { return cards.showWeather (w); }

  async function renderWeather() {
    const loc = s.location;
    if (s.ntWeather === false || !loc || loc.latitude == null) return showWeather(null);
    const lat = Math.round(loc.latitude * 10) / 10; // ~10 km: enough for the weather
    const lon = Math.round(loc.longitude * 10) / 10;
    const c = s.ntWeatherCache;
    if (c && c.lat === lat && c.lon === lon && Date.now() - c.at < WEATHER_MS) return showWeather(c);
    if (c && c.lat === lat && c.lon === lon) showWeather(c); // stale meanwhile
    try {
      const w = await NewTabData.weather(lat, lon);
      if (!w || s.ntWeather === false || lat !== Math.round(s.location?.latitude * 10) / 10 || lon !== Math.round(s.location?.longitude * 10) / 10) return;
      await save({ ntWeatherCache: w });
      showWeather(w);
    } catch {
      /* offline: no weather this time */
    }
  }

  // ---- the current prayer's adhkar tasks ----------------------------------------------

  function renderTasks() { return cards.renderTasks(); }

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
    timeFormat = null;
    lastDate = "";
    lastNext = "";
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

  function storageChanged(changes, area) {
    if (area !== "local") return;
    for (const [k, v] of Object.entries(changes)) {
      if (NewTabConfig.settingsKeys.includes(k)) s[k] = v.newValue;
    }
    if (changes.newTabPage?.newValue === false) return toChromeNewTab();
    if (changes.lang) lang = SUPPORTED_LANGS.some((l) => l.code === s.lang) ? s.lang : lang;
    if (changes.lang || changes.location || changes.arabicDigits) {
      if (changes.location) { today = null; progress = null; }
      render();
      if (changes.location) { refreshPrayers(); renderWeather(); }
    }
    if (changes.gameState && today) {
      progress = NewTabPrayers.progress(today, changes.gameState.newValue);
      renderTasks();
    }
    if (changes.ntBackground) applyBackground();
    if (changes.ntWeather || changes.ntWeatherCache) renderWeather();
    if (changes.ntFavDhikr) renderDhikr(current);
  }

  function activeTimers() {
    clearInterval(clockTimer);
    clearInterval(weatherTimer);
    if (listening) chrome.storage.onChanged.removeListener(storageChanged);
    listening = !document.hidden;
    document.body.classList.toggle("nt-paused", !listening);
    if (!listening) return;
    chrome.storage.onChanged.addListener(storageChanged);
    tick();
    clockTimer = setInterval(tick, 1000);
    weatherTimer = setInterval(renderWeather, WEATHER_MS);
  }

  function afterPaint(callback) {
    requestAnimationFrame(() => setTimeout(callback, 0));
  }

  async function resume() {
    if (!started) return;
    activeTimers();
    if (document.hidden) { ++revision; return; }
    try {
      s = await chrome.storage.local.get(NewTabConfig.settingsKeys);
      if (document.hidden) return;
      if (s.newTabPage === false) return toChromeNewTab();
      lang = SUPPORTED_LANGS.some((l) => l.code === s.lang) ? s.lang : DEFAULT_SETTINGS.lang;
      today = null;
      progress = null;
      render();
      afterPaint(() => { refreshPrayers(); renderWeather(); followAccountSetting(); });
    } catch { /* The existing clock and search remain usable if storage fails. */ }
  }

  document.addEventListener("visibilitychange", resume);
  window.addEventListener("pageshow", (event) => { if (event.persisted) resume(); });
  window.addEventListener("pagehide", () => {
    clearInterval(clockTimer);
    clearInterval(weatherTimer);
    if (listening) chrome.storage.onChanged.removeListener(storageChanged);
    listening = false;
    ++revision;
  });

  chrome.storage.local
    .get(NewTabConfig.settingsKeys)
    .then((got) => {
      s = got;
      if (s.newTabPage === false) return toChromeNewTab();
      lang = SUPPORTED_LANGS.some((l) => l.code === s.lang) ? s.lang : DEFAULT_SETTINGS.lang;
      render();
      show();
      started = true;
      activeTimers();
      afterPaint(() => { if (!document.hidden) { refreshPrayers(); renderWeather(); followAccountSetting(); } });
      $("q").focus();
    })
    .catch(() => {
      lang = "en";
      render();
      show();
      started = true;
      activeTimers();
    });
})();
