// Game screen — the current prayer window, its tasks, points, gift, the day's
// journey, and the social tabs. Requires adapter + platform.js + i18n.js +
// game-i18n.js + prayer-engine.js + the game logic scripts (recitation-match,
// game-score, game-windows, game-state, game-tasks, game-sync). Local first:
// progress lives in Platform.store[GAME_STORE_KEY].
//
// Screens are hash routes so Android back (adapter.js -> window.__ptBack)
// steps through them: #tasks (home), #board, #me, #read/<taskId>,
// #side/<taskId> (morning / evening adhkar), #gift, #profile/<username>. Each pushed screen records its depth in history.state.
//
// Speech: the Google voice dialog, one meaningful segment per utterance.
//
// Accounts: email + password, Google (game-sync.js, GoogleAuthPlugin) or Apple
// (Platform.appleAuth, apple-auth.js); one account can link Google and Apple
// ("Sign-in methods"). A name-only account from before is "legacy" and is
// linked on sign-in.

const $ = (id) => document.getElementById(id);
const NOTICE_HIDE_MS = 4000; // a toast: success fades after 4 s,
const NOTICE_ERROR_MS = 7000; // a problem stays a little longer; a tap closes either
const CELEBRATE_HIDE_MS = 7000;

let lang = "ar";
let G = gameT(lang); // UI strings (game-i18n.js)
let locale = "ar";

let location_ = null;
let state = emptyGameState();
let gameStateRevision = 0;
let current = null; // currentWindow() result
let lastWindowCheck = 0;
let gameClock = null;
const gameTotals = createGameTotalsCache(pointsWithPrefix);
let tasks = []; // tasksForWindow(current.prayer), with .share (max points)
let side = null; // sideWindow() result: the morning / evening adhkar, open beside the prayer window
let sideTasks = []; // tasksForSide(side.kind), with .share (fixed bonus points)
let disputedTasks = []; // disputedForSide(side.kind, disputedOn): optional, no points, device only

// Settings
let journeyOn = true;
let soundOn = false;
let disputedOn = false; // show the adhkar whose authentication is disputed (off by default)

// Account / server
let account = null; // { username, token, email, legacy, emailVerified, admin }
let apiUrl = "";
const api = () => gameApi(apiUrl, account && account.token);
let authCfg = null; // /v1/auth/config, fetched once
let boardScope = "all";
let boardPeriod = "month"; // all | year | half | quarter | month
let profileName = null;

// Reader state
// `at` is the window the reading banks into: `current`, or `side` for the
// morning / evening adhkar (side: true).
let reading = null; // { task, isGift, side, at, mode: "play" | "practice" | "missed" | "done" }
let finals = [];
let listening = false;
let chunks = [];
let shownChunk = -1;
