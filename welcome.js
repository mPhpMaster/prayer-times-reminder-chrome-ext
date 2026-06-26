// Prayer Times Reminder — welcome onboarding wizard.
// Requires i18n.js loaded first (globals: chrome, tr, normalizeTheme,
// DEFAULT_SETTINGS, SUPPORTED_LANGS).
//
// Flow: Language → How to pin → Appearance → Location → Tab lock → Dhikr → Finish.
// The settings steps reuse the popup itself, embedded as popup.html#settings; we
// tell it (via postMessage) which field group to show, sync the language, and
// commit the location on Finish, then close the tab.

// pane: which panel to show. group: the popup field group for settings panes.
// titleKey: i18n key for the step heading (reused from existing strings).
const STEPS = [
  { pane: "language", titleKey: "settingsLangLabel" },
  { pane: "pin", titleKey: "welcomePinTitle" },
  { pane: "settings", group: "appearance", titleKey: "themeLabel" },
  { pane: "settings", group: "location", titleKey: "locationLabel" },
  { pane: "settings", group: "lock", titleKey: "tabLockLabel" },
  { pane: "settings", group: "dhikr", titleKey: "tasbihLabel" }
];

const el = {
  panes: [...document.querySelectorAll(".wizard-pane")],
  progress: document.getElementById("wizard-progress"),
  back: document.getElementById("wizard-back"),
  next: document.getElementById("wizard-next"),
  langSelect: document.getElementById("wizard-lang"),
  stepLangTitle: document.getElementById("step-language-title"),
  stepSettingsTitle: document.getElementById("step-settings-title"),
  frame: document.getElementById("settings-frame")
};

let lang = DEFAULT_SETTINGS.lang;
let stepIndex = 0;
let frameReady = false;
let pendingGroup = null;

function postToFrame(message) {
  el.frame.contentWindow?.postMessage(message, "*");
}

// ---- Rendering --------------------------------------------------------------

function buildProgressDots() {
  el.progress.innerHTML = "";
  for (let i = 0; i < STEPS.length; i++) {
    el.progress.appendChild(document.createElement("span"));
  }
}

function applyLanguage() {
  const L = tr(lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = L.dir;
  document.title = L.appTitle;

  document.getElementById("welcome-title").textContent = L.welcomeTitle;
  document.getElementById("welcome-prayer-break").textContent = L.prayerBreak;
  document.getElementById("welcome-lead").textContent = L.welcomeLead;
  document.getElementById("welcome-pin-title").textContent = L.welcomePinTitle;
  document.getElementById("welcome-step-1").textContent = L.welcomePinStep1;
  document.getElementById("welcome-step-2").textContent = L.welcomePinStep2;
  document.getElementById("welcome-step-3").textContent = L.welcomePinStep3;
  document.getElementById("welcome-note").textContent = L.welcomeNotifBody;

  el.langSelect.value = lang;
  updateChrome();
}

// Step-dependent chrome: pane titles, progress dot, and nav buttons.
function updateChrome() {
  const L = tr(lang);
  const step = STEPS[stepIndex];

  el.stepLangTitle.textContent = L.settingsLangLabel;
  if (step.pane === "settings") {
    el.stepSettingsTitle.textContent = L[step.titleKey] || "";
  }

  [...el.progress.children].forEach((dot, i) =>
    dot.classList.toggle("active", i === stepIndex)
  );

  el.back.textContent = L.back;
  el.back.style.visibility = stepIndex === 0 ? "hidden" : "visible";
  el.next.textContent = stepIndex === STEPS.length - 1 ? L.finish : L.next;
}

function showStep(index) {
  stepIndex = Math.max(0, Math.min(STEPS.length - 1, index));
  const step = STEPS[stepIndex];
  for (const pane of el.panes) pane.hidden = pane.dataset.pane !== step.pane;

  if (step.pane === "settings") {
    if (frameReady) postToFrame({ type: "PTW_GROUP", group: step.group });
    else pendingGroup = step.group;
  }
  updateChrome();
}

// ---- Finish -----------------------------------------------------------------

function closeTab() {
  chrome.tabs.getCurrent((tab) => {
    if (tab) chrome.tabs.remove(tab.id);
    else window.close();
  });
}

function finish() {
  // The popup auto-saves every setting except the location, which we commit now.
  if (frameReady) postToFrame({ type: "PTW_COMMIT" });
  else closeTab();
}

// ---- Events -----------------------------------------------------------------

el.next.addEventListener("click", () => {
  if (stepIndex < STEPS.length - 1) showStep(stepIndex + 1);
  else finish();
});

el.back.addEventListener("click", () => {
  if (stepIndex > 0) showStep(stepIndex - 1);
});

el.langSelect.addEventListener("change", async () => {
  if (!el.langSelect.value) return;
  lang = el.langSelect.value;
  await chrome.storage.local.set({ lang });
  applyLanguage();
  reloadFrame();
});

// Reload the embedded settings so popup.js re-initialises in the newly saved
// language (it reads chrome.storage on init). The frame is hidden during the
// language step, so this reload isn't visible.
function reloadFrame() {
  frameReady = false;
  pendingGroup = STEPS[stepIndex].pane === "settings" ? STEPS[stepIndex].group : null;
  el.frame.contentWindow?.location.reload();
}

window.addEventListener("message", (event) => {
  const msg = event.data;
  if (!msg || typeof msg !== "object") return;

  if (msg.type === "PTW_HEIGHT") {
    el.frame.style.height = `${msg.height}px`;
  } else if (msg.type === "PTW_READY") {
    frameReady = true;
    postToFrame({ type: "PTW_LANG", lang });
    const group = pendingGroup || (STEPS[stepIndex].pane === "settings" ? STEPS[stepIndex].group : null);
    if (group) postToFrame({ type: "PTW_GROUP", group });
    pendingGroup = null;
  } else if (msg.type === "PTW_COMMIT_RESULT") {
    if (msg.ok) {
      closeTab();
    } else {
      // Missing country/city — send the user to the location step to fix it.
      const locIndex = STEPS.findIndex((s) => s.group === "location");
      if (locIndex >= 0) showStep(locIndex);
    }
  }
});

// ---- Init -------------------------------------------------------------------

async function init() {
  const { lang: savedLang, theme } = await chrome.storage.local.get(["lang", "theme"]);
  lang = savedLang || DEFAULT_SETTINGS.lang;
  document.documentElement.dataset.theme = normalizeTheme(theme);

  for (const entry of SUPPORTED_LANGS) {
    const option = document.createElement("option");
    option.value = entry.code;
    option.textContent = entry.name;
    el.langSelect.appendChild(option);
  }

  buildProgressDots();
  applyLanguage();
  showStep(0);
}

init();
