// Prayer Times Reminder — welcome page logic
// Requires i18n.js loaded first (globals: chrome, normalizeTheme, tr, DEFAULT_SETTINGS).

async function applyWelcomeLanguage() {
    const {
        lang,
        theme
    } = await chrome.storage.local.get(["lang", "theme"]);

    document.documentElement.dataset.theme = normalizeTheme(theme);

    const L = tr(lang || DEFAULT_SETTINGS.lang);
    document.documentElement.lang = lang || DEFAULT_SETTINGS.lang;
    document.documentElement.dir = L.dir;

    document.getElementById("welcome-title").textContent = L.welcomeTitle;
    document.getElementById("welcome-lead").textContent = L.welcomeLead;

    document.getElementById("welcome-pin-title").textContent = L.welcomePinTitle;
    document.getElementById("welcome-step-1").textContent = L.welcomePinStep1;
    document.getElementById("welcome-step-2").textContent = L.welcomePinStep2;
    document.getElementById("welcome-step-3").textContent = L.welcomePinStep3;
    document.getElementById("welcome-note").textContent = L.welcomeNotifBody;

    document.title = L.appTitle;
}

applyWelcomeLanguage();