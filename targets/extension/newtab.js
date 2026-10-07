// newtab.js — the extension's new tab: a clock, the next prayer with its
// countdown, today's prayer times, a web search (the browser's own engine via
// chrome.search), a dhikr, and how far the current prayer's adhkar tasks are.
// The sky behind it follows the prayer times (dawn, morning, noon, afternoon,
// sunset, night).
//
// On/off: store key "newTabPage" (default on), which follows the account's
// "newTab" setting (PATCH /v1/me settings) so it can be changed from any of the
// apps. Chrome can't switch an override off, so when it's off this page sends
// the tab straight to Chrome's own new-tab page before showing anything.

(function () {
  const $ = (id) => document.getElementById(id);
  const PRAYERS = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];
  const ICONS = { Fajr: "🌄", Sunrise: "🌅", Dhuhr: "☀️", Asr: "🌤️", Maghrib: "🌇", Isha: "🌙" };
  const API_DEFAULT = "https://prayer-times.sarhsoft.com"; // = GAME_API_DEFAULT (game-sync.js)
  const SETTING_CHECK_MS = 6 * 3600 * 1000;

  let s = {}; // storage snapshot
  let L = null;
  let lang = "en";
  let today = null; // { at: {prayer: ms}, tomorrowFajr }

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
      await chrome.storage.local.set(patch);
    } catch {
      /* offline: try again next time */
    }
  }

  // ---- time & prayers --------------------------------------------------------------

  function locale() {
    const info = SUPPORTED_LANGS.find((l) => l.code === lang);
    return (info && info.locale) || lang;
  }

  function fmtTime(ms, withSeconds) {
    const opts = { hour: "numeric", minute: "2-digit", hour12: !uses24hClock(lang) };
    if (withSeconds) opts.second = "2-digit";
    try {
      return new Date(ms).toLocaleTimeString(locale(), opts);
    } catch {
      return new Date(ms).toTimeString().slice(0, withSeconds ? 8 : 5);
    }
  }

  function fmtDate(d) {
    if (DATE_NAMES[lang]) return `${weekdayLabel(lang, locale(), d)}${L.dir === "rtl" ? "، " : ", "}${d.getDate()} ${monthName(lang, locale(), d)}`;
    return d.toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long" });
  }

  function computeToday() {
    const loc = s.location;
    if (!loc || loc.latitude == null) return null;
    try {
      const now = new Date();
      const data = PrayerEngine.timings(loc, now);
      const tz = data.meta && data.meta.timezone;
      const at = {};
      for (const p of PRAYERS) at[p] = prayerTimestamp(data.timings[p], now, tz);
      const tm = new Date(now.getTime() + 86400000);
      const t2 = PrayerEngine.timings(loc, tm);
      return { at, tomorrowFajr: prayerTimestamp(t2.timings.Fajr, tm, t2.meta && t2.meta.timezone), day: now.getDate() };
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
    if (!today) {
      list.replaceChildren();
      return;
    }
    const now = Date.now();
    const next = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"].find((p) => today.at[p] > now) || "Fajr";
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
        t.textContent = fmtTime(today.at[p]);
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
    $("clock").textContent = fmtTime(now);
    $("date").textContent = fmtDate(d);
    document.body.dataset.phase = phase(now);

    if (!today) return ($("next").hidden = true);
    let next = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"].find((p) => today.at[p] > now);
    const at = next ? today.at[next] : today.tomorrowFajr;
    if (!next) next = "Fajr";
    const secs = Math.max(0, Math.floor((at - now) / 1000));
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    $("next").hidden = false;
    $("next-label").textContent = L.nextPrayer;
    $("next-name").textContent = `${ICONS[next]} ${prayerLabel(L, next)} · ${fmtTime(at)}`;
    $("next-in").textContent = L.countdown(h, m, secs % 60);
    if (secs === 0) setTimeout(renderTimes, 1500);
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
      $("tasks-text").textContent = done >= ids.length ? L.ntTasksDone(name) : L.ntTasks(name, done, ids.length);
      $("tasks-bar").style.width = `${Math.round((done / Math.max(1, ids.length)) * 100)}%`;
      $("tasks-open").textContent = L.ntOpenTasks;
      card.classList.toggle("all-done", done >= ids.length);
      card.hidden = false;
    } catch {
      card.hidden = true;
    }
  }

  // ---- a dhikr ----------------------------------------------------------------------------
  // Shown in the reader's language; in any other language than Arabic the
  // Arabic original follows on its own line.
  let lastDhikr = -1;
  function renderDhikr() {
    const pool = TASBIH_PHRASES.filter((p) => p.randomReminder !== false);
    let i;
    do i = Math.floor(Math.random() * pool.length);
    while (pool.length > 1 && i === lastDhikr);
    lastDhikr = i;
    const item = pool[i];
    const main = $("dhikr-main");
    if (lang === "ar") {
      main.textContent = item.ar;
      main.lang = "ar";
      main.dir = "rtl";
      $("dhikr-ar").hidden = true;
    } else {
      main.textContent = itemLabel(item, lang);
      main.lang = lang;
      main.dir = "auto";
      $("dhikr-ar").textContent = item.ar;
      $("dhikr-ar").hidden = false;
    }
    $("dhikr-next").textContent = L.ntAnother;
  }

  // ---- start ------------------------------------------------------------------------------

  function render() {
    L = tr(lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = L.dir;
    document.title = L.appTitle;
    $("q").placeholder = L.ntSearchPh;
    $("q").setAttribute("aria-label", L.ntSearchPh);
    today = computeToday();
    renderTimes();
    renderTasks();
    renderDhikr();
    tick();
  }

  $("search").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = $("q").value.trim();
    if (text) chrome.search.query({ text, disposition: "CURRENT_TAB" });
  });
  $("dhikr-next").addEventListener("click", renderDhikr);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    for (const [k, v] of Object.entries(changes)) s[k] = v.newValue;
    if (changes.lang || changes.location) render();
    else if (changes.gameState) renderTasks();
  });

  chrome.storage.local
    .get(["newTabPage", "newTabCheckedAt", "lang", "location", "gameState", "gameAccount", "gameApiUrl"])
    .then((got) => {
      s = got;
      if (s.newTabPage === false) return toChromeNewTab();
      lang = SUPPORTED_LANGS.some((l) => l.code === s.lang) ? s.lang : DEFAULT_SETTINGS.lang;
      render();
      show();
      setInterval(tick, 1000);
      followAccountSetting();
      $("q").focus();
    });
})();
