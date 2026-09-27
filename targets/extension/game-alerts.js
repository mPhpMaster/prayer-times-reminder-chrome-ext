// game-alerts.js — the dhikr game's reminders in the extension's service
// worker (loaded by background.js via importScripts, after i18n.js,
// prayer-engine.js and notify-plan.js).
//
//   "open"    — a prayer's adhkar tasks open (start now for full points)
//   "closing" — 30 min before the next prayer, skipped once the window is done
//
// Planned by notify-plan.js (planGameAlerts) for today and tomorrow as
// chrome.alarms named "game:<kind>:<windowKey>:<prayer>"; re-planned with the
// prayer alarms, on a location change, and when the game page finishes a
// window (Platform.gameAlerts.refresh), and the first time the game page is
// opened. Setting: store key "gameAlerts" (default on once the player has
// opened the game). Prayer alerts never depend on this.

const GAME_ALARM_PREFIX = "game:";
const GAME_ALERT_DAYS = 2;
const GAME_ALERT_PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
const GAME_NEXT_PRAYER = { Fajr: "Dhuhr", Dhuhr: "Asr", Asr: "Maghrib", Maghrib: "Isha", Isha: "Fajr" };

// Arabic-first; every other UI language gets English.
const GAME_ALERT_TEXT = {
  ar: {
    openTitle: (p) => `فُتحت مهمات صلاة ${p}`,
    openBody: () => "ابدأ الآن لتأخذ النقاط كاملة.",
    closingTitle: (p, next) => `بقيت نصف ساعة على صلاة ${next}`,
    closingBody: (p) => `أكمل مهمات صلاة ${p} قبل أن تفوتك.`,
  },
  en: {
    openTitle: (p) => `${p} adhkar tasks are open`,
    openBody: () => "Start now to earn full points.",
    closingTitle: (p, next) => `Half an hour until ${next}`,
    closingBody: (p) => `Finish the ${p} adhkar tasks before they close.`,
  },
};

async function clearGameAlarms() {
  const all = await chrome.alarms.getAll();
  await Promise.all(all.filter((a) => a.name.startsWith(GAME_ALARM_PREFIX)).map((a) => chrome.alarms.clear(a.name)));
}

function windowFinished(gameState, key) {
  const w = gameState && gameState.windows && gameState.windows[key];
  return !!(w && w.complete); // set by game.js once every task is done
}

async function scheduleGameAlerts() {
  try {
    await clearGameAlarms();
    const s = await chrome.storage.local.get(["location", "gameAlerts", "gameState"]);
    // Only for players: someone who uses the extension just for prayer times
    // (never opened the game, so no gameState) gets no game reminders.
    if (!s.gameState || s.gameAlerts === false || !s.location || s.location.latitude == null) return;
    const now = Date.now();
    for (const a of planGameAlerts(PrayerEngine, s.location, new Date(now), GAME_ALERT_DAYS, GAME_ALERT_PRAYERS)) {
      if (a.when <= now || (a.kind === "closing" && windowFinished(s.gameState, a.key))) continue;
      chrome.alarms.create(`${GAME_ALARM_PREFIX}${a.kind}:${a.key}`, { when: a.when });
    }
  } catch {
    // best effort — re-planned with the next prayer-alarm refresh
  }
}

// alarm name "game:<kind>:<YYYY-MM-DD>:<Prayer>" -> { kind, key, prayer }
function parseGameAlarm(name) {
  const [kind, day, prayer] = name.slice(GAME_ALARM_PREFIX.length).split(":");
  return { kind, key: `${day}:${prayer}`, prayer };
}

async function fireGameAlert(name) {
  const { kind, key, prayer } = parseGameAlarm(name);
  const s = await chrome.storage.local.get(["gameAlerts", "gameState", "lang"]);
  if (s.gameAlerts === false) return;
  if (kind === "closing" && windowFinished(s.gameState, key)) return;
  const lang = s.lang || "en";
  const text = GAME_ALERT_TEXT[lang] || GAME_ALERT_TEXT.en;
  const L = tr(text === GAME_ALERT_TEXT.ar ? "ar" : "en");
  const name_ = prayerLabel(L, prayer);
  const next = prayerLabel(L, GAME_NEXT_PRAYER[prayer]);
  chrome.notifications.create(`game-${kind}-${key}-${Date.now()}`, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: kind === "open" ? text.openTitle(name_) : text.closingTitle(name_, next),
    message: kind === "open" ? text.openBody(name_) : text.closingBody(name_),
    priority: 1,
  });
}

// storage.onChanged: the game page saved its first state (first time played).
const isFirstGameState = (changes) => !!(changes.gameState && changes.gameState.newValue && !changes.gameState.oldValue);
const isGameAlarm = (name) => name.startsWith(GAME_ALARM_PREFIX);
const isGameNotification = (id) => id.startsWith("game-");
