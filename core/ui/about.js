// Prayer Times Reminder — About page.
// Requires the platform adapter + i18n.js loaded first (globals: Platform, tr,
// normalizeTheme, DEFAULT_SETTINGS).
//
// A standalone full page reached from the popup's settings ("About the app").
// Shows the app name, a short description, the app version, and an ongoing-charity
// (sadaqah jariyah) dedication.

let lang = DEFAULT_SETTINGS.lang;

// The dedication. Every entry is shown in Arabic in every UI language; a Latin
// transliteration is added on a quieter line below it only where the script
// differs. Arabic and Urdu share the Arabic script, so they show the name alone.
const DEDICATION = [
  { ar: "ام بلال - باشية حجازي", tr: "Umm Bilal – Bashiyah Hijazi" },
  { ar: "عبدالله الشرمي", tr: "Abdullah al-Sharmi" },
  { ar: "ام عبدو صراميجو", tr: "Umm Abdo Sarameejo" },
  { ar: "أم فجر جونيرتي", tr: "Umm Fajar Juniarti" },
  { ar: "سوهيرمان", tr: "Suherman" }
];

// Urdu reads the Arabic script natively, so it — like Arabic — shows the name
// alone; every other UI gets the transliteration line.
function showsTransliteration() {
  return lang !== "ar" && lang !== "ur";
}

function renderDedication(L) {
  const list = document.getElementById("sadaqah-names");
  list.replaceChildren();
  const withTranslit = showsTransliteration();

  for (const entry of DEDICATION) {
    const li = document.createElement("li");
    const ar = document.createElement("span");
    ar.className = "ded-ar";
    ar.dir = "rtl";
    ar.textContent = entry.ar;
    li.appendChild(ar);
    if (withTranslit) {
      const translit = document.createElement("span");
      translit.className = "ded-translit";
      translit.textContent = entry.tr;
      li.appendChild(translit);
    }
    list.appendChild(li);
  }

  // The closing line ("…and for all Muslims, living and dead") is a phrase, not a
  // name, so it gets a real translation rather than a transliteration.
  const allTranslit = document.getElementById("sadaqah-all-translit");
  allTranslit.textContent = withTranslit ? L.aboutSadaqahAll : "";
  allTranslit.hidden = !withTranslit;
}

function applyLanguage() {
  const L = tr(lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = L.dir;
  document.title = `${L.aboutBtn} — ${L.appTitle}`;

  document.getElementById("about-app-name").textContent = L.appTitle;
  document.getElementById("about-desc").textContent = L.aboutDesc;
  document.getElementById("about-sadaqah-heading").textContent = L.aboutSadaqah;
  document.getElementById("about-back").textContent = L.back;
  renderDedication(L);
}

// Extension-only: surface the packaged version (e.g. "v2.1.2"). Other shells
// don't expose chrome.runtime, so the line stays hidden there.
function showVersion() {
  let version = "";
  try {
    if (typeof chrome !== "undefined" && chrome.runtime?.getManifest) {
      version = chrome.runtime.getManifest().version || "";
    }
  } catch {
    version = "";
  }
  if (!version) return;
  const versionEl = document.getElementById("about-version");
  versionEl.textContent = `v${version}`;
  versionEl.hidden = false;
}

// Back: the browser extension opens this page as its own tab, so close it; the
// desktop and mobile shells navigate here in place, so return to the app window.
document.getElementById("about-back").addEventListener("click", () => {
  if (Platform.name === "chrome") Platform.runtime.closeOnboarding();
  else window.location.href = "popup.html";
});

// Cross-shell navigation hooks the desktop/mobile shells invoke on the *current*
// page (popup.js registers the same names). Without them, Android's hardware-back
// would exit the app from here, and the reused desktop tray window would reopen
// stuck on this page. Both just return to the popup.
window.__ptPopupReset = () => { window.location.href = "popup.html"; };
window.__ptPopupBack = () => { window.location.href = "popup.html"; return true; };

async function init() {
  const { lang: savedLang, theme } = await Platform.store.get(["lang", "theme"]);
  lang = savedLang || DEFAULT_SETTINGS.lang;
  document.documentElement.dataset.theme = normalizeTheme(theme);
  applyLanguage();
  showVersion();
}

init();
