// landing.js — the website's front page: what the app does, buttons into the
// web app, a live look at today's prayers, download links for every platform,
// and every language the app speaks. Text comes from i18n.js and is set with
// textContent only. The language choice is the app's own `lang` setting
// (localStorage "pt:lang"), so the web app opens in the same language.

(function () {
  const $ = (id) => document.getElementById(id);
  const REPO = "https://github.com/mPhpMaster/prayer-times-reminder-chrome-ext";
  const LINKS = {
    chrome: "https://chromewebstore.google.com/detail/prayer-times-reminder/knahkbkmbjghaiillhngjbhoinmeegoc",
    android: "https://play.google.com/apps/testing/com.mphpmaster.prayer",
    windowsStore: "https://apps.microsoft.com/detail/9PFTWDWLNL7C",
    windowsDirect: REPO + "/releases", // replaced by the newest desktop-v release's installer below
    discord: REPO + "/tree/main/targets/vencord",
  };
  const PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
  const ICONS = { Fajr: "🌄", Dhuhr: "☀️", Asr: "🌤️", Maghrib: "🌇", Isha: "🌙" };
  // Shown until the visitor picks a city in the app.
  const SAMPLE = { Fajr: "05:00", Dhuhr: "12:10", Asr: "15:30", Maghrib: "18:05", Isha: "19:35" };
  let lang = "ar";
  let tick = 0;

  function readStore(key) {
    try {
      return JSON.parse(localStorage.getItem("pt:" + key));
    } catch {
      return null;
    }
  }

  function readLang() {
    const v = readStore("lang");
    if (SUPPORTED_LANGS.some((l) => l.code === v)) return v;
    const nav = (navigator.language || "").slice(0, 2);
    return SUPPORTED_LANGS.some((l) => l.code === nav) ? nav : DEFAULT_SETTINGS.lang;
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // ---- the live preview: today's prayers and a countdown -----------------------

  function todayTimes() {
    const location = readStore("location");
    const now = new Date();
    if (location && location.latitude != null && typeof PrayerEngine !== "undefined") {
      try {
        const data = PrayerEngine.timings(location, now);
        const tz = data.meta && data.meta.timezone;
        const at = {};
        for (const p of PRAYERS) at[p] = prayerTimestamp(data.timings[p], now, tz);
        const t2 = PrayerEngine.timings(location, new Date(now.getTime() + 86400000));
        at.nextFajr = prayerTimestamp(t2.timings.Fajr, new Date(now.getTime() + 86400000), t2.meta && t2.meta.timezone);
        if (PRAYERS.every((p) => at[p] != null)) return { at, sample: false };
      } catch {
        /* fall back to the sample */
      }
    }
    const at = {};
    for (const p of PRAYERS) at[p] = prayerTimestamp(SAMPLE[p], now);
    at.nextFajr = at.Fajr + 86400000;
    return { at, sample: true };
  }

  function fmtTime(ms) {
    const info = SUPPORTED_LANGS.find((l) => l.code === lang);
    const locale = (info && info.locale) || lang;
    try {
      return new Date(ms).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit", hour12: !uses24hClock(lang) });
    } catch {
      return new Date(ms).toTimeString().slice(0, 5);
    }
  }

  function renderPreview() {
    const L = tr(lang);
    const { at, sample } = todayTimes();
    const now = Date.now();
    let next = PRAYERS.find((p) => at[p] > now);
    const nextAt = next ? at[next] : at.nextFajr;
    if (!next) next = "Fajr";
    $("next-label").textContent = L.nextPrayer;
    $("next-name").textContent = `${ICONS[next]} ${prayerLabel(L, next)}`;
    const mins = Math.max(0, Math.round((nextAt - now) / 60000));
    $("next-in").textContent = L.webNextIn(Math.floor(mins / 60), mins % 60);
    $("times").replaceChildren(
      ...PRAYERS.map((p) => {
        const li = el("li", p === next ? "is-next" : at[p] < now ? "is-past" : "");
        li.append(el("span", "t-name", `${ICONS[p]}  ${prayerLabel(L, p)}`), el("span", "t-at", fmtTime(at[p])));
        return li;
      })
    );
    $("sample").hidden = !sample;
    $("sample").textContent = L.webSample;
  }

  // ---- page text ------------------------------------------------------------------

  function feature(icon, title, text) {
    const li = el("li", "feature");
    li.append(el("span", "f-icon", icon), el("h3", null, title), el("p", null, text));
    return li;
  }

  function setLink(id, href, name, note) {
    const a = $(id);
    a.href = href;
    $(`${id}-name`).textContent = name;
    if (note != null && $(`${id}-note`)) $(`${id}-note`).textContent = note;
  }

  function render() {
    const L = tr(lang);
    const info = SUPPORTED_LANGS.find((l) => l.code === lang) || { name: lang };
    document.documentElement.lang = lang;
    document.documentElement.dir = L.dir;
    document.title = `${L.appTitle} — Prayer Times Break`;
    $("brand-name").textContent = L.appTitle;
    $("lang-current").textContent = info.name;
    $("title").textContent = L.appTitle;
    $("tagline").textContent = L.webTagline;
    $("open-app").textContent = L.webOpenApp;
    $("open-game").textContent = L.webOpenGame;
    $("browser-note").textContent = L.webBrowserNote;
    $("features-title").textContent = L.webFeatures;
    $("features").replaceChildren(
      feature("🕌", L.webFeatTimesT, L.webFeatTimes),
      feature("⏸️", L.webFeatLockT, L.webFeatLock),
      feature("📿", L.webFeatDhikrT, L.webFeatDhikr),
      feature("🏆", L.webFeatGameT, L.webFeatGame),
      feature("👪", L.webFeatFamilyT, L.webFeatFamily),
      feature("🌍", L.webFeatLangsT, L.webFeatLangs)
    );
    $("downloads-title").textContent = L.webDownloads;
    setLink("dl-chrome", LINKS.chrome, L.webChrome);
    setLink("dl-android", LINKS.android, L.webAndroid, L.webAndroidNote);
    setLink("dl-winstore", LINKS.windowsStore, L.webWindowsStore);
    setLink("dl-windirect", LINKS.windowsDirect, L.webWindowsDirect);
    setLink("dl-discord", LINKS.discord, L.webDiscord);
    $("langs-title").textContent = L.webLangsTitle;
    for (const b of document.querySelectorAll("[data-lang]")) b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
    $("privacy").textContent = L.webPrivacy;
    $("terms").textContent = L.webTerms;
    $("source").textContent = L.webSource;
    renderPreview();
  }

  function setLang(code) {
    lang = code;
    try {
      localStorage.setItem("pt:lang", JSON.stringify(code));
    } catch {
      /* private mode: this visit only */
    }
    render();
  }

  // ---- languages: the top-bar menu and the chips section ----------------------------

  function langButton(l, cls) {
    const b = el("button", cls, l.name);
    b.type = "button";
    b.lang = l.code;
    b.dir = l.dir || "auto";
    b.dataset.lang = l.code;
    b.addEventListener("click", () => {
      setLang(l.code);
      closeMenu();
    });
    return b;
  }

  const menu = $("lang-menu");
  const menuBtn = $("lang-btn");
  function closeMenu() {
    menu.hidden = true;
    menuBtn.setAttribute("aria-expanded", "false");
  }
  for (const l of SUPPORTED_LANGS) {
    const b = langButton(l, "lang-item");
    b.setAttribute("role", "menuitemradio");
    menu.append(b);
    $("lang-chips").append(langButton(l, "chip"));
  }
  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = menu.hidden;
    menu.hidden = !open;
    menuBtn.setAttribute("aria-expanded", String(open));
    if (open) {
      const cur = menu.querySelector(`[data-lang="${lang}"]`);
      if (cur) cur.focus();
    }
  });
  document.addEventListener("click", (e) => {
    if (!menu.hidden && !menu.contains(e.target)) closeMenu();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !menu.hidden) {
      closeMenu();
      menuBtn.focus();
    }
  });

  lang = readLang();
  render();
  tick = setInterval(renderPreview, 30000);
  window.addEventListener("pagehide", () => clearInterval(tick));

  // The newest Windows installer from GitHub Releases (tag desktop-v<version>).
  fetch("https://api.github.com/repos/mPhpMaster/prayer-times-reminder-chrome-ext/releases?per_page=30", {
    headers: { Accept: "application/vnd.github+json" },
  })
    .then((r) => (r.ok ? r.json() : []))
    .then((releases) => {
      const newer = (a, b) => {
        const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
        for (let i = 0; i < 4; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
        return false;
      };
      let best = null;
      for (const r of releases) {
        if (r.draft || r.prerelease || !/^desktop-v\d/.test(r.tag_name)) continue;
        const v = r.tag_name.slice("desktop-v".length);
        if (!best || newer(v, best.v)) best = { v, r };
      }
      const exe = best && (best.r.assets || []).find((a) => /-setup\.exe$/i.test(a.name));
      if (exe && /^https:\/\/github\.com\//.test(exe.browser_download_url)) {
        LINKS.windowsDirect = exe.browser_download_url;
        $("dl-windirect").href = LINKS.windowsDirect;
      }
    })
    .catch(() => {});
})();
