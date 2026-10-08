// Prayer Times Reminder — About page.
// Requires the platform adapter + i18n.js loaded first (globals: Platform, tr,
// normalizeTheme, DEFAULT_SETTINGS).
//
// A standalone full page reached from the popup's settings ("About the app").
// Shows the app name, a short description, the app version, the ongoing-charity
// (sadaqah jariyah) dedication, and a form for signed-in players to ask for a
// name to be added (an admin approves it on the Admin page).

let lang = DEFAULT_SETTINGS.lang;

// The dedication names come from the game server (admins approve requests,
// no app update needed); the last list seen is kept on the device and
// DEDICATIONS_FALLBACK covers a first run offline (dedications.js).
let dedications = DEDICATIONS_FALLBACK;

function renderDedication(L) {
  const list = document.getElementById("sadaqah-names");
  list.replaceChildren();

  for (const entry of dedications) {
    const { primary, secondary } = dedicationLines(entry.names, lang);
    const li = document.createElement("li");
    const main = document.createElement("span");
    const arabic = isArabicScript(primary);
    main.className = arabic ? "ded-ar" : "ded-main";
    main.dir = arabic ? "rtl" : "auto";
    main.textContent = primary;
    li.appendChild(main);
    if (secondary) {
      const sub = document.createElement("span");
      sub.className = "ded-translit";
      sub.dir = "auto";
      sub.textContent = secondary;
      li.appendChild(sub);
    }
    list.appendChild(li);
  }

  // The closing line ("…and for all Muslims, living and dead") is a phrase, not a
  // name, so it gets a real translation rather than a transliteration.
  const withTranslit = lang !== "ar" && lang !== "ur";
  const allTranslit = document.getElementById("sadaqah-all-translit");
  allTranslit.textContent = withTranslit ? L.aboutSadaqahAll : "";
  allTranslit.hidden = !withTranslit;
}

async function loadDedications() {
  const saved = (await Platform.store.get(DEDICATIONS_KEY))[DEDICATIONS_KEY];
  const cached = saved && validDedicationList(saved.list);
  if (cached) {
    dedications = cached;
    renderDedication(tr(lang));
  }
  try {
    const res = await gameApi(apiUrl).dedications();
    const fresh = validDedicationList(res && res.dedications);
    if (!fresh) return;
    dedications = fresh;
    renderDedication(tr(lang));
    await Platform.store.set({ [DEDICATIONS_KEY]: { list: fresh, savedAt: Date.now() } });
  } catch {
    // offline: the saved (or bundled) list stays
  }
}

// ---- "Request a name" (signed-in players) -----------------------------------
let apiUrl = GAME_API_DEFAULT;
let account = null; // the game account ({ username, token, email, legacy }), if signed in
const $ = (id) => document.getElementById(id);
const signedIn = () => !!(account && account.token && !account.legacy);

// The request form: Arabic and the UI language up front, the others folded.
function buildRequestFields() {
  const D = dedT(lang);
  const langs = (typeof SUPPORTED_LANGS !== "undefined" ? SUPPORTED_LANGS : []).filter((l) => DEDICATION_LANGS.includes(l.code));
  const main = ["ar", lang].filter((c, i, a) => a.indexOf(c) === i);
  const field = (l) => {
    const label = document.createElement("label");
    label.className = "ded-field";
    const name = document.createElement("span");
    name.textContent = l.name;
    const input = document.createElement("input");
    input.dataset.lang = l.code;
    input.maxLength = DEDICATION_MAX_NAME;
    input.dir = l.dir || "auto";
    input.lang = l.code;
    input.autocomplete = "off";
    label.append(name, input);
    return label;
  };
  const up = langs.filter((l) => main.includes(l.code)).sort((a, b) => main.indexOf(a.code) - main.indexOf(b.code));
  $("ded-main-fields").replaceChildren(...up.map(field));
  $("ded-more-fields").replaceChildren(...langs.filter((l) => !main.includes(l.code)).map(field));
  $("ded-more-label").textContent = D.otherLangs;
  $("ded-note").placeholder = D.notePh;
}

function requestNames() {
  const raw = {};
  for (const input of document.querySelectorAll("#ded-form input[data-lang]")) raw[input.dataset.lang] = input.value;
  return cleanDedicationNames(raw);
}

function showMessage(text) {
  $("ded-msg").textContent = text || "";
  $("ded-msg").hidden = !text;
}

function requestErrorText(e) {
  const D = dedT(lang);
  const map = {
    "bad-names": D.errBadNames,
    "too-many-pending": D.errTooManyPending,
    "http-429": D.errTooMany,
    "sign-in-required": D.signInFirst,
    unauthorized: D.signInFirst,
  };
  return (e && map[e.code]) || D.errOffline;
}

function statusText(status) {
  const D = dedT(lang);
  return { pending: D.statusPending, approved: D.statusApproved, rejected: D.statusRejected }[status] || status;
}

async function renderMyRequests() {
  if (!signedIn()) {
    $("ded-mine").hidden = true;
    return;
  }
  try {
    const { requests } = await gameApi(apiUrl, account.token).myDedicationRequests();
    $("ded-mine").hidden = !requests.length;
    $("ded-mine-list").replaceChildren(
      ...requests.map((r) => {
        const li = document.createElement("li");
        const name = document.createElement("span");
        name.className = "ded-mine-name";
        name.dir = "auto";
        name.textContent = dedicationLines(r.names, lang).primary;
        const badge = document.createElement("span");
        badge.className = "ded-status ded-" + r.status;
        badge.textContent = statusText(r.status);
        li.append(name, badge);
        if (r.status === "rejected" && r.reason) {
          const why = document.createElement("span");
          why.className = "ded-reason";
          why.dir = "auto";
          why.textContent = dedT(lang).reason(r.reason);
          li.appendChild(why);
        }
        return li;
      })
    );
  } catch {
    // offline: leave the list as it was
  }
}

function renderRequestSection() {
  const D = dedT(lang);
  $("ded-request-title").textContent = D.requestTitle;
  $("ded-intro").textContent = D.requestIntro;
  $("ded-signin-note").textContent = D.signInFirst;
  $("ded-signin-btn").textContent = D.signInBtn;
  $("ded-open").textContent = D.openForm;
  $("ded-submit").textContent = D.submit;
  $("ded-cancel").textContent = D.cancel;
  $("ded-public-note").textContent = D.publicNote;
  $("ded-mine-title").textContent = D.myRequests;
  $("ded-signin").hidden = signedIn();
  $("ded-open").hidden = !signedIn() || !$("ded-form").hidden;
  buildRequestFields();
}

$("ded-open").addEventListener("click", () => {
  showMessage("");
  $("ded-form").hidden = false;
  $("ded-open").hidden = true;
  const first = document.querySelector("#ded-main-fields input");
  if (first) first.focus();
});

$("ded-cancel").addEventListener("click", () => {
  $("ded-form").reset();
  $("ded-form").hidden = true;
  $("ded-open").hidden = false;
});

$("ded-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const names = requestNames();
  if (!Object.keys(names).length) {
    showMessage(dedT(lang).errAtLeastOne);
    return;
  }
  $("ded-submit").disabled = true;
  try {
    await gameApi(apiUrl, account.token).requestDedication(names, $("ded-note").value.trim() || undefined);
    $("ded-form").reset();
    $("ded-form").hidden = true;
    $("ded-open").hidden = false;
    showMessage(dedT(lang).sent);
    renderMyRequests();
  } catch (e) {
    showMessage(requestErrorText(e));
  } finally {
    $("ded-submit").disabled = false;
  }
});

function applyLanguage() {
  const L = tr(lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = L.dir;
  document.title = `${L.aboutBtn} — ${L.appTitle}`;

  document.getElementById("about-app-name").textContent = L.appTitle;
  document.getElementById("about-desc").textContent = L.aboutDesc;
  document.getElementById("about-sadaqah-heading").textContent = L.aboutSadaqah;
  document.getElementById("about-back").textContent = L.back;
  fillLegalLinks(L);
  renderDedication(L);
  renderRequestSection();
}

// Extension-only: surface the packaged version (e.g. "v2.1.2"). Other shells
// don't provide Platform.runtime.version, so the line stays hidden there.
function showVersion() {
  let version = "";
  try {
    version = (Platform.runtime.version && Platform.runtime.version()) || "";
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
  const s = await Platform.store.get(["lang", "theme", GAME_ACCOUNT_KEY, GAME_API_KEY]);
  lang = s.lang || DEFAULT_SETTINGS.lang;
  apiUrl = s[GAME_API_KEY] || GAME_API_DEFAULT;
  account = s[GAME_ACCOUNT_KEY] || null;
  document.documentElement.dataset.theme = normalizeTheme(s.theme);
  applyLanguage();
  showVersion();
  loadDedications();
  renderMyRequests();
}

init();
