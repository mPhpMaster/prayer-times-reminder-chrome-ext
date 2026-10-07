// landing.js — the website's front page: what the app does, buttons into the
// web app, and download links for every platform. Text comes from i18n.js and
// is set with textContent only. The language choice is the app's own `lang`
// setting (localStorage "pt:lang"), so the web app opens in the same language.

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

  function readLang() {
    try {
      const v = JSON.parse(localStorage.getItem("pt:lang"));
      if (SUPPORTED_LANGS.some((l) => l.code === v)) return v;
    } catch {}
    const nav = (navigator.language || "").slice(0, 2);
    return SUPPORTED_LANGS.some((l) => l.code === nav) ? nav : DEFAULT_SETTINGS.lang;
  }

  function item(text, href, note) {
    const li = document.createElement("li");
    if (href) {
      const a = document.createElement("a");
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = text;
      li.appendChild(a);
    } else {
      li.textContent = text;
    }
    if (note) {
      const small = document.createElement("small");
      small.textContent = note;
      li.appendChild(small);
    }
    return li;
  }

  function render(lang) {
    const L = tr(lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = L.dir;
    document.title = `${L.appTitle} — Prayer Times Break`;
    $("title").textContent = L.appTitle;
    $("tagline").textContent = L.webTagline;
    $("open-app").textContent = L.webOpenApp;
    $("open-game").textContent = L.webOpenGame;
    $("browser-note").textContent = L.webBrowserNote;
    $("features-title").textContent = L.webFeatures;
    $("features").replaceChildren(
      ...[L.webFeatTimes, L.webFeatLock, L.webFeatDhikr, L.webFeatGame, L.webFeatLangs].map((t) => item(t))
    );
    $("downloads-title").textContent = L.webDownloads;
    $("downloads").replaceChildren(
      item(L.webChrome, LINKS.chrome),
      item(L.webAndroid, LINKS.android, L.webAndroidNote),
      item(L.webWindowsStore, LINKS.windowsStore),
      item(L.webWindowsDirect, LINKS.windowsDirect),
      item(L.webDiscord, LINKS.discord)
    );
  }

  const select = $("lang");
  for (const l of SUPPORTED_LANGS) {
    const o = document.createElement("option");
    o.value = l.code;
    o.textContent = l.name;
    select.appendChild(o);
  }
  select.value = readLang();
  select.addEventListener("change", () => {
    try { localStorage.setItem("pt:lang", JSON.stringify(select.value)); } catch {}
    render(select.value);
  });
  render(select.value);

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
        render(select.value);
      }
    })
    .catch(() => {});
})();
