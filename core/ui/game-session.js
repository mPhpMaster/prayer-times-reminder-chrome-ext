// ---- language -------------------------------------------------------------
function applyLanguage(code) {
  lang = code || "ar";
  G = gameT(lang);
  const info = (typeof SUPPORTED_LANGS !== "undefined" && SUPPORTED_LANGS.find((l) => l.code === lang)) || null;
  locale = info ? info.locale : "ar";
  document.documentElement.lang = lang;
  document.documentElement.dir = info ? info.dir : "rtl";
  for (const el of document.querySelectorAll("[data-g]")) if (typeof G[el.dataset.g] === "string") el.textContent = G[el.dataset.g];
  for (const el of document.querySelectorAll("[data-g-ph]")) el.placeholder = G[el.dataset.gPh];
  for (const el of document.querySelectorAll("[data-g-aria]")) el.setAttribute("aria-label", G[el.dataset.gAria]);
}

function prayerName(key) {
  const L = typeof tr === "function" ? tr(lang) : null;
  return L && typeof prayerLabel === "function" ? prayerLabel(L, key) : key;
}

// ---- time helpers ---------------------------------------------------------
function fmtClock(ms) {
  const key = `${locale}:${new Date().getTimezoneOffset()}`;
  if (key !== gameClockFormatKey) {
    gameClockFormatKey = key;
    gameClockFormat = new Intl.DateTimeFormat(locale, uses24hClock(lang)
      ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }
      : { hour: "numeric", minute: "2-digit" });
  }
  return gameClockFormat.format(ms);
}
let gameClockFormatKey = "";
let gameClockFormat = null;
function fmtLeft(ms) {
  const m = Math.max(0, Math.ceil(ms / 60000));
  return G.left(Math.floor(m / 60), m % 60);
}
function fmtDuration(ms) {
  return ms < 60000 ? G.underMinute : G.minutes(Math.round(ms / 60000));
}

// ---- load / save ----------------------------------------------------------
async function load() {
  const s = await Platform.store.get(["location", "lang", GAME_STORE_KEY, "theme", GAME_ACCOUNT_KEY, GAME_API_KEY, "gameJourney", "gameSound", "gameFontStep", "gameDisputed"]);
  if (Number.isInteger(s.gameFontStep) && FONT_STEPS[s.gameFontStep]) fontStep = s.gameFontStep;
  applyFontStep();
  applyLanguage(s.lang);
  account = s[GAME_ACCOUNT_KEY] && s[GAME_ACCOUNT_KEY].token ? s[GAME_ACCOUNT_KEY] : null;
  // Accounts saved before real sign-in carry no email: name-only (legacy)
  // until the server says otherwise.
  if (account && account.legacy === undefined) account.legacy = !account.email;
  apiUrl = s[GAME_API_KEY] || GAME_API_DEFAULT;
  journeyOn = s.gameJourney !== false;
  soundOn = s.gameSound === true;
  disputedOn = s.gameDisputed === true;
  if (s.theme && typeof normalizeTheme === "function") {
    document.documentElement.dataset.theme = normalizeTheme(s.theme);
  }
  location_ = s.location && s.location.latitude != null ? s.location : null;
  state = pruneGameState(normalizeGameState(s[GAME_STORE_KEY]), Date.now());
}
function save() {
  gameStateRevision++;
  gameTotals.invalidate();
  return Platform.store.set({ [GAME_STORE_KEY]: state });
}
