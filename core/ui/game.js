// Game screen — the current prayer window, its tasks, points, gift, the day's
// journey, and the social tabs. Requires adapter + platform.js + i18n.js +
// game-i18n.js + prayer-engine.js + the game logic scripts (recitation-match,
// game-score, game-windows, game-state, game-tasks, game-sync). Local first:
// progress lives in Platform.store[GAME_STORE_KEY].
//
// Screens are hash routes so Android back (adapter.js -> window.__ptBack)
// steps through them: #tasks (home), #board, #me, #read/<taskId>, #gift,
// #profile/<username>. Each pushed screen records its depth in history.state.
//
// Speech: the Google voice dialog, one meaningful segment per utterance.
//
// Accounts: email + password or Google (game-sync.js, GoogleAuthPlugin). A
// name-only account from before is "legacy" and is linked on sign-in.

const $ = (id) => document.getElementById(id);
const NOTICE_HIDE_MS = 4000; // success messages fade out; errors and hints stay
const CELEBRATE_HIDE_MS = 7000;

let lang = "ar";
let G = gameT(lang); // UI strings (game-i18n.js)
let locale = "ar";

let location_ = null;
let state = emptyGameState();
let current = null; // currentWindow() result
let lastWindowCheck = 0;
let tasks = []; // tasksForWindow(current.prayer), with .share (max points)

// Settings
let journeyOn = true;
let soundOn = false;

// Account / server
let account = null; // { username, token, email, legacy }
let apiUrl = "";
const api = () => gameApi(apiUrl, account && account.token);
let authCfg = null; // /v1/auth/config, fetched once
let boardScope = "all";
let profileName = null;

// Reader state
let reading = null; // { task, isGift, mode: "play" | "practice" | "missed" | "done" }
let finals = [];
let listening = false;
let chunks = [];
let shownChunk = -1;

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
  return new Date(ms).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
}
function fmtLeft(ms) {
  const m = Math.max(0, Math.ceil(ms / 60000));
  return G.left(Math.floor(m / 60), m % 60);
}
function fmtDuration(ms) {
  return ms < 60000 ? G.underMinute : G.minutes(Math.round(ms / 60000));
}

// ---- load / save ----------------------------------------------------------
async function load() {
  const s = await Platform.store.get(["location", "lang", GAME_STORE_KEY, "theme", GAME_ACCOUNT_KEY, GAME_API_KEY, "gameJourney", "gameSound"]);
  applyLanguage(s.lang);
  account = s[GAME_ACCOUNT_KEY] && s[GAME_ACCOUNT_KEY].token ? s[GAME_ACCOUNT_KEY] : null;
  // Accounts saved before real sign-in carry no email: name-only (legacy)
  // until the server says otherwise.
  if (account && account.legacy === undefined) account.legacy = !account.email;
  apiUrl = s[GAME_API_KEY] || GAME_API_DEFAULT;
  journeyOn = s.gameJourney !== false;
  soundOn = s.gameSound === true;
  if (s.theme && typeof normalizeTheme === "function") {
    document.documentElement.dataset.theme = normalizeTheme(s.theme);
  }
  location_ = s.location && s.location.latitude != null ? s.location : null;
  state = pruneGameState(normalizeGameState(s[GAME_STORE_KEY]), Date.now());
}
function save() {
  return Platform.store.set({ [GAME_STORE_KEY]: state });
}

// ---- routing (Android back) -------------------------------------------------
// history.state.depth = how many screens were pushed above the home screen.
function parseRoute(hash) {
  const h = decodeURIComponent(String(hash || "").replace(/^#/, ""));
  const [name, ...rest] = h.split("/");
  const arg = rest.join("/");
  if (name === "board" || name === "me" || name === "gift") return { name };
  if ((name === "read" || name === "profile") && arg) return { name, arg };
  return { name: "tasks" };
}
const routeHash = (r) => (r.arg ? `#${r.name}/${encodeURIComponent(r.arg)}` : `#${r.name}`);
const depth = () => (history.state && history.state.depth) || 0;
const isTab = (r) => r.name === "tasks" || r.name === "board" || r.name === "me";

function go(r) {
  if (routeHash(r) === location.hash) return render(r);
  history.pushState({ depth: depth() + 1 }, "", routeHash(r));
  render(r);
}
function replaceRoute(r) {
  history.replaceState({ depth: depth() }, "", routeHash(r));
  render(r);
}
// Back to the previous screen; if this screen was opened directly (reload,
// notification), fall back to its parent instead of leaving the page.
function goBack(fallback = { name: "tasks" }) {
  if (depth() > 0) history.back();
  else replaceRoute(fallback);
}
// Tabs: from home, a tab is pushed (back returns home); between tabs it is
// replaced (back still returns home); home itself unwinds the stack.
function selectTab(name) {
  const here = parseRoute(location.hash);
  if (name === "tasks") {
    if (depth() > 0) history.go(-depth());
    else replaceRoute({ name: "tasks" });
  } else if (here.name === "tasks") go({ name });
  else replaceRoute({ name });
}
function parentOf(r) {
  if (r.name === "profile") return { name: "board" };
  return { name: "tasks" };
}

window.addEventListener("popstate", () => render(parseRoute(location.hash)));

// Called by the adapter on Android back. true = handled here.
window.__ptBack = () => {
  if (!$("celebrate").hidden) {
    closeCelebration();
    return true;
  }
  const r = parseRoute(location.hash);
  if (r.name === "tasks") return false; // home: the shell goes to the previous page / background
  goBack(parentOf(r));
  return true;
};

function render(r) {
  if (reading && !(r.name === "read" && reading.task.id === r.arg) && !(r.name === "gift" && reading.isGift)) {
    leaveReader(); // partial progress is already saved with every recognized phrase
  }
  // A profile keeps the tab it was opened from (board or account) highlighted.
  const tab = isTab(r) ? r.name : r.name === "profile" ? currentTab() : "tasks";
  for (const b of document.querySelectorAll(".tabs button")) b.setAttribute("aria-selected", String(b.dataset.tab === tab));
  const onTasks = r.name === "tasks" || r.name === "read" || r.name === "gift";
  document.querySelector(".scores").hidden = !onTasks;
  $("list-view").hidden = r.name !== "tasks";
  $("reader").hidden = !(r.name === "read" || r.name === "gift");
  $("board-view").hidden = r.name !== "board";
  $("me-view").hidden = r.name !== "me";
  $("profile-view").hidden = r.name !== "profile";

  if (r.name === "tasks" && current) renderList();
  if (r.name === "board") renderBoard();
  if (r.name === "me") renderMe();
  if (r.name === "profile") openProfile(r.arg);
  if (r.name === "read" || r.name === "gift") {
    if (!current) return replaceRoute({ name: "tasks" });
    const task = r.name === "gift" ? giftForWindow(current.key) : tasks.find((t) => t.id === r.arg);
    const giftReady = r.name !== "gift" || allTasksDone(entry(), tasks.map((t) => t.id));
    if (!task || !giftReady) return replaceRoute({ name: "tasks" });
    if (!reading || reading.task.id !== task.id) openReader(task, r.name === "gift");
  }
}
function currentTab() {
  const b = document.querySelector('.tabs button[aria-selected="true"]');
  return b ? b.dataset.tab : "tasks";
}

// ---- window + list --------------------------------------------------------
// Prayer times are recomputed once a minute (or right at the next prayer),
// not every second — see needsWindowRefresh().
function refreshWindow(now = Date.now()) {
  if (!needsWindowRefresh(current, lastWindowCheck, now)) return;
  lastWindowCheck = now;
  const w = currentWindow(PrayerEngine, location_, new Date(now));
  if (!current || w.key !== current.key) {
    const hadWindow = !!current;
    current = w;
    tasks = tasksForWindow(w.prayer);
    splitWindowPoints(tasks).forEach((p, i) => (tasks[i].share = p));
    // A finished window's partial recitations can't be completed any more.
    clearStalePartials(state, current.key);
    save();
    if (hadWindow && reading) {
      leaveReader();
      replaceRoute({ name: "tasks" });
    }
    renderList();
  }
}

function entry() {
  return state.windows[current.key];
}

const idsCache = {};
const idsFor = (prayer) => idsCache[prayer] || (idsCache[prayer] = tasksForWindow(prayer).map((t) => t.id));

// Short adhkar / repeated adhkar / Quran — a long list is easier to scan.
function taskGroup(t) {
  if (t.kind === "surah" || t.kind === "ayah") return "quran";
  return t.repeat > 1 ? "repeated" : "short";
}
const GROUPS = [
  ["short", "grpShort"],
  ["repeated", "grpRepeated"],
  ["quran", "grpQuran"],
];

function taskButton(t) {
  const li = document.createElement("li");
  const b = document.createElement("button");
  b.type = "button";
  b.dataset.id = t.id;
  const left = document.createElement("span");
  const name = document.createElement("span");
  name.className = "name";
  name.textContent = gameTaskTitle(lang, t);
  const meta = document.createElement("span");
  meta.className = "meta";
  const src = document.createElement("bdi"); // Arabic source inside any-direction UI
  src.lang = "ar";
  src.textContent = t.source;
  meta.append(t.repeat > 1 ? `${G.times(t.repeat)} · ` : "", src);
  // Only a duration the player actually took — never an estimate.
  const ms = lastDuration(state, durationKey(t.id, t.repeat));
  if (ms) meta.append(` · ${G.lastTime(fmtDuration(ms))}`);
  left.append(name, meta);
  const pts = document.createElement("span");
  pts.className = "pts";
  b.append(left, pts);
  b.addEventListener("click", () => go({ name: "read", arg: t.id }));
  li.appendChild(b);
  return li;
}

function renderList() {
  $("window-title").textContent = G.windowTitle(prayerName(current.prayer));
  const box = $("task-groups");
  box.replaceChildren();
  for (const [group, key] of GROUPS) {
    const list = tasks.filter((t) => taskGroup(t) === group);
    if (!list.length) continue;
    const h = document.createElement("h3");
    h.className = "group-title";
    h.textContent = G[key];
    const ul = document.createElement("ul");
    ul.className = "tasks";
    ul.append(...list.map(taskButton));
    box.append(h, ul);
  }
  renderJourney();
  tick();
}

// The day's five windows and this month's calendar. Encouraging only: a past
// window that wasn't completed is shown plainly, never as a failure.
function renderJourney() {
  $("journey").hidden = !journeyOn || !current;
  if ($("journey").hidden) return;
  const order = GAME_PRAYERS.indexOf(current.prayer);
  const steps = dayJourney(state, current.day, GAME_PRAYERS, idsFor);
  const ol = $("journey-steps");
  ol.replaceChildren();
  let done = 0;
  steps.forEach((s, i) => {
    if (s.status === "done") done++;
    const st = s.status === "done" ? "done" : s.status === "some" ? "some" : i === order ? "now" : i > order ? "later" : "open";
    const label = { done: G.stDone, some: G.stSome, now: G.stNow, later: G.stLater, open: G.stOpen }[st];
    const li = document.createElement("li");
    li.className = `step ${st}`;
    li.setAttribute("aria-label", `${prayerName(s.prayer)}: ${label}`);
    const dot = document.createElement("span");
    dot.className = "step-dot";
    dot.setAttribute("aria-hidden", "true");
    dot.textContent = st === "done" ? "✓" : "";
    const name = document.createElement("span");
    name.className = "step-name";
    name.setAttribute("aria-hidden", "true");
    name.textContent = prayerName(s.prayer);
    li.append(dot, name);
    ol.appendChild(li);
  });
  $("journey-count").textContent = G.journeyCount(done);
  $("journey-all").hidden = done < GAME_PRAYERS.length;

  const month = current.day.slice(0, 7);
  const days = monthCalendar(state, month, GAME_PRAYERS, idsFor);
  const grid = $("cal-grid");
  grid.replaceChildren();
  // Weekday initials, Sunday first (flows right-to-left in Arabic / Urdu).
  for (let i = 0; i < 7; i++) {
    const h = document.createElement("span");
    h.className = "cal-head";
    h.setAttribute("aria-hidden", "true");
    h.textContent = new Date(2026, 8, 6 + i).toLocaleDateString(locale, { weekday: "narrow" }); // 2026-09-06 is a Sunday
    grid.appendChild(h);
  }
  const first = new Date(`${month}-01T12:00:00`).getDay(); // 0 = Sunday
  for (let i = 0; i < first; i++) grid.appendChild(document.createElement("span"));
  for (const d of days) {
    const cell = document.createElement("span");
    cell.className = `cal-day ${d.status}${d.day === current.day ? " today" : ""}`;
    cell.textContent = String(Number(d.day.slice(8)));
    const label = d.status === "full" ? G.calFull : d.status === "some" ? G.calSome : "";
    cell.setAttribute("aria-label", label ? `${cell.textContent}: ${label}` : cell.textContent);
    cell.setAttribute("role", "img");
    grid.appendChild(cell);
  }
}

// Called every second: countdowns, live potential points, states.
function tick() {
  const now = Date.now();
  if (location_) refreshWindow(now);
  if (!current) return;
  const { win } = current;
  const e = entry();
  const open = now >= win.opensAt && now < win.closesAt;

  $("window-time").textContent =
    now < win.opensAt
      ? G.opensIn(fmtLeft(win.opensAt - now), fmtClock(win.opensAt))
      : G.endsIn(fmtLeft(win.closesAt - now), fmtClock(win.closesAt));

  $("pre-open").hidden = now >= win.opensAt;
  $("rule-now").textContent = open ? G.ruleNow(Math.round(pointsFactor(win, now) * 100)) : G.ruleNotOpen;

  let doneCount = 0;
  for (const b of $("task-groups").querySelectorAll("button[data-id]")) {
    const t = tasks.find((x) => x.id === b.dataset.id);
    const rec = e && e.tasks[t.id];
    const pts = b.querySelector(".pts");
    const done = !!(rec && rec.doneAt);
    if (done) doneCount++;
    b.classList.toggle("done", done);
    // Never disabled: a locked task opens for practice, a done one as read-only.
    b.classList.toggle("locked", !done && !open);
    if (done) {
      pts.textContent = `✓ +${rec.points}`;
    } else {
      // Points are fixed at the first recognized word; before that they fall with time.
      const at = rec && rec.startedAt ? rec.startedAt : now;
      pts.textContent = open ? G.points(taskPoints(t.share, win, at)) : now < win.opensAt ? G.locked(fmtClock(win.opensAt)) : G.missed;
    }
  }
  $("done-count").textContent = G.doneCount(doneCount, tasks.length);
  renderResume(open, e);

  const done = allTasksDone(e, tasks.map((t) => t.id));
  const giftDone = e && e.gift && e.gift.doneAt;
  $("gift").hidden = !(open && done && !giftDone);

  $("pts-window").textContent = windowPoints(e);
  $("pts-day").textContent = pointsWithPrefix(state, current.day);
  $("pts-month").textContent = pointsWithPrefix(state, current.day.slice(0, 7));

  if (reading && reading.mode === "play") $("reader-points").textContent = G.points(readerPoints());
  if (reading && listening && now >= win.closesAt) {
    leaveReader();
    replaceRoute({ name: "tasks" });
    showNotice(G.windowClosed);
  }
}

// "▶ Continue: التحميد (10/33)" — the task with the most recent saved partial,
// else the next one not done.
function renderResume(open, e) {
  const target = open ? resumeTarget(e, tasks.map((t) => t.id)) : null;
  const btn = $("resume");
  btn.hidden = !target;
  if (!target) return;
  const t = tasks.find((x) => x.id === target.id);
  let prog = "";
  if (target.partial && t.repeat > 1) {
    const r = matchTask(e.tasks[t.id].heard.join(" "), t);
    prog = `${r.count}/${t.repeat}`;
  }
  btn.textContent = target.partial ? G.resume(gameTaskTitle(lang, t), prog) : G.startNext(gameTaskTitle(lang, t));
  btn.dataset.id = t.id;
}

let noticeTimer = 0;
function showNotice(text, { autoHide = false } = {}) {
  clearTimeout(noticeTimer);
  $("notice").hidden = !text;
  $("notice").textContent = text || "";
  if (text && autoHide) noticeTimer = setTimeout(() => showNotice(""), NOTICE_HIDE_MS);
}

// ---- celebration ------------------------------------------------------------
// A short, calm card when a prayer's adhkar are all done. Motion follows the
// system "reduce motion" setting (CSS); the soft sound is opt-in.
let celebrateTimer = 0;
function celebrate(prayer) {
  const allFive = dayJourney(state, current.day, GAME_PRAYERS, idsFor).every((s) => s.status === "done");
  $("celebrate-title").textContent = G.celebrateTitle(prayerName(prayer));
  $("celebrate-body").textContent = allFive ? G.dayAll : G.celebrateBody;
  $("celebrate").hidden = false;
  $("celebrate-ok").focus();
  if (soundOn) softChime();
  clearTimeout(celebrateTimer);
  celebrateTimer = setTimeout(closeCelebration, CELEBRATE_HIDE_MS);
}
function closeCelebration() {
  clearTimeout(celebrateTimer);
  $("celebrate").hidden = true;
}
// Two quiet sine notes (no bundled sound file).
function softChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [523.25, 659.25].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const t0 = ctx.currentTime + i * 0.22;
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.06, t0 + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
      o.connect(g).connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + 0.95);
    });
    setTimeout(() => ctx.close(), 1600);
  } catch {
    // no audio: the card alone is enough
  }
}

// ---- reader ---------------------------------------------------------------
function wordSpans(words, firstToken) {
  const out = [];
  let tokenIndex = firstToken;
  for (const word of words) {
    const span = document.createElement("span");
    span.className = "w";
    span.textContent = word;
    if (normalizeArabic(word)) span.dataset.t = String(tokenIndex++);
    out.push(span, document.createTextNode(" "));
  }
  return out;
}

function readerMode(isGift, rec, now) {
  if (rec && rec.doneAt) return "done";
  if (isGift) return "play";
  if (now < current.win.opensAt) return "practice";
  if (now >= current.win.closesAt) return "missed";
  return "play";
}

function openReader(task, isGift) {
  const e = entry();
  const rec = isGift ? e && e.gift : e && e.tasks[task.id];
  const mode = readerMode(isGift, rec, Date.now());
  reading = { task, isGift, mode };
  const play = mode === "play";
  finals = play ? partialHeard(state, current.key, task.id, isGift) : [];
  chunks = chunkText(task.text);
  shownChunk = -1;
  showNotice("");
  $("reader-title").textContent = isGift ? G.giftTitle : gameTaskTitle(lang, task);
  $("reader-source").textContent = task.source;
  $("text").replaceChildren(...wordSpans(task.text.split(/\s+/).filter(Boolean), 0));
  $("heard").textContent = finals.join(" ");
  setMic(false);

  const modeText =
    mode === "practice"
      ? G.practice(fmtClock(current.win.opensAt))
      : mode === "missed"
        ? G.missedMode
        : mode === "done"
          ? G.doneMode(rec.points)
          : finals.length
            ? G.resumed
            : "";
  $("reader-mode").textContent = modeText;
  $("reader-mode").hidden = !modeText;
  for (const id of ["mic", "reader-hint", "counter", "reader-points"]) $(id).hidden = !play;
  document.querySelector("#reader .progress").hidden = !play;

  if (play) updateReader();
  else showChunk(0);
  window.scrollTo({ top: 0 });
}

// Leave the reader without finishing: stop the mic; the partial transcript
// was saved with each phrase, so reopening resumes at the same count.
function leaveReader() {
  if (listening) {
    listening = false;
    setMic(false);
    Platform.speech.stop();
  }
  if (reading && reading.mode === "play" && finals.length) {
    savePartial(state, current.key, reading.task.id, reading.isGift, finals);
    save();
  }
  reading = null;
}

function readerPoints() {
  const { task, isGift } = reading;
  if (isGift) return GIFT_POINTS;
  const rec = entry() && entry().tasks[task.id];
  return taskPoints(task.share, current.win, rec && rec.startedAt ? rec.startedAt : Date.now());
}

function showChunk(pos) {
  let i = chunks.findIndex((c) => pos < c.to);
  if (i < 0) i = chunks.length - 1;
  if (i !== shownChunk) {
    shownChunk = i;
    $("chunk").replaceChildren(...wordSpans(chunks[i].words, chunks[i].from));
  }
  const c = chunks[i];
  document.querySelectorAll("#text .w").forEach((s) => {
    const t = s.dataset.t === undefined ? -1 : Number(s.dataset.t);
    s.classList.toggle("cur", t >= c.from && t < c.to);
  });
}

function updateReader({ final = false } = {}) {
  if (!reading || reading.mode !== "play") return null;
  const { task, isGift } = reading;
  const r = matchTask(finals.join(" "), task, { final });
  // The task starts at its first recognized word — this fixes its points.
  if (noteRecognition(state, current.key, task.id, isGift, r, Date.now())) save();
  const tokens = r.matched.length;
  showChunk(r.done ? tokens - 1 : Math.round(r.progress * tokens));
  document.querySelectorAll("#text .w, #chunk .w").forEach((s) => {
    const i = s.dataset.t;
    s.classList.toggle("hit", i !== undefined && !!r.matched[Number(i)]);
  });
  const frac = task.repeat > 1 ? (r.count + (r.done ? 0 : r.progress)) / task.repeat : r.progress;
  $("fill").style.width = `${Math.round(Math.min(1, frac) * 100)}%`;
  $("counter").textContent = task.repeat > 1 ? `${r.count} / ${task.repeat}` : "";
  $("reader-points").textContent = G.points(readerPoints());
  if (r.done) finishReading();
  return r;
}

async function startListening() {
  if (!reading || reading.mode !== "play" || listening) return;
  if (!Platform.speech) {
    showNotice(G.speechUnavailable);
    return;
  }
  // No start time is recorded here: opening the mic doesn't lock any points.
  showNotice("");
  $("reader-mode").hidden = true;
  listening = true;
  setMic(true);
  const res = await Platform.speech
    .start({
      lang: "ar-SA",
      engine: "google",
      getPrompt: () => (chunks[shownChunk] ? chunks[shownChunk].words.join(" ") : undefined),
      onFinal: (text) => {
        if (!reading) return;
        finals.push(text);
        savePartial(state, current.key, reading.task.id, reading.isGift, finals);
        save();
        $("heard").textContent = finals.join(" ");
        updateReader();
      },
      onState: (on, info) => {
        if (on || !listening) return;
        stopListening(); // dialog closed / nothing heard
        if (info && info.reason === "no-speech") showNotice(G.noSpeech);
      },
      onError: (e) => {
        showNotice(G.speechStopped(e.message || e.code));
        stopListening();
      },
    })
    .catch((e) => ({ ok: false, reason: String((e && e.message) || e) }));
  if (!res.ok) {
    showNotice(G.speechStartFail(res.reason));
    listening = false;
    setMic(false);
  }
}

async function stopListening() {
  if (!listening) return;
  listening = false;
  setMic(false);
  await Platform.speech.stop();
  updateReader({ final: true });
}

function setMic(on) {
  $("mic").classList.toggle("on", on);
  $("mic").textContent = on ? G.micStop : G.micStart;
}

async function finishReading() {
  if (!reading || reading.finishing) return;
  reading.finishing = true;
  // Stop the dialog loop synchronously, before it relaunches for "the next segment".
  if (listening) {
    listening = false;
    setMic(false);
    Platform.speech.stop();
  }
  const { task, isGift } = reading;
  const now = Date.now();
  const points = readerPoints();
  if (now >= current.win.closesAt) {
    reading = null;
    replaceRoute({ name: "tasks" });
    showNotice(G.windowClosed);
    return;
  }
  const started = isGift ? entry() && entry().gift && entry().gift.startedAt : entry() && entry().tasks[task.id] && entry().tasks[task.id].startedAt;
  if (isGift) markGiftDone(state, current.key, task.id, points, now);
  else {
    markTaskDone(state, current.key, task.id, points, now); // once: a done task is never re-banked
    if (started) recordDuration(state, durationKey(task.id, task.repeat), now - started);
  }
  await save();
  syncNow();
  // A finished window no longer needs its "30 min left" alert.
  const e = entry();
  let windowComplete = false;
  if (!isGift && !e.complete && allTasksDone(e, tasks.map((t) => t.id))) {
    e.complete = true;
    windowComplete = true;
    await save();
    if (Platform.gameAlerts) Platform.gameAlerts.refresh();
  }
  reading = null;
  goBack({ name: "tasks" });
  showNotice(isGift ? G.giftDone(points) : G.taskDone(gameTaskTitle(lang, task), points), { autoHide: true });
  if (windowComplete) celebrate(current.prayer);
}

// ---- sync -----------------------------------------------------------------
// Sends finished items the server hasn't acknowledged, in batches, and marks
// each batch synced only after the server accepted it. If the account changes
// mid-sync, nothing is marked for the old one: the new account re-sends
// everything (adoptSyncAccount) and the server keeps one row per item.
let syncing = false;
async function syncNow() {
  if (!account || !apiUrl || syncing) return;
  const token = account.token;
  const rows = pendingCompletions(state);
  if (!rows.length) return;
  syncing = true;
  try {
    for (const batch of syncBatches(rows)) {
      await gameApi(apiUrl, token).pushProgress(batch);
      if (!account || account.token !== token) return;
      markSynced(state, batch);
      await save();
    }
  } catch (e) {
    if (e.status === 401 && account && account.token === token) await forgetAccount(); // token no longer valid
  } finally {
    syncing = false;
    if (account && account.token !== token) syncNow();
  }
}

async function forgetAccount() {
  account = null;
  await Platform.store.remove(GAME_ACCOUNT_KEY);
}

// ---- tabs: board ------------------------------------------------------------
const month = () => (current ? current.day.slice(0, 7) : new Date().toISOString().slice(0, 7));

function messageItem(text) {
  const li = document.createElement("li");
  li.className = "msg";
  li.textContent = text;
  return li;
}

function socialUnavailableText() {
  return !apiUrl ? G.noServer : G.needAccount;
}

// A list row that opens a profile: a real <button> inside the <li>, so it is
// reachable with Tab, activates with Enter/Space and is announced by screen
// readers with a full label (rank, name, points).
function rowButton(parts, label, onClick) {
  const li = document.createElement("li");
  const b = document.createElement("button");
  b.type = "button";
  b.className = "row-btn";
  b.setAttribute("aria-label", label);
  for (const [cls, text] of parts) {
    const span = document.createElement("span");
    span.className = cls;
    span.textContent = text;
    span.setAttribute("aria-hidden", "true");
    b.appendChild(span);
  }
  b.addEventListener("click", onClick);
  li.appendChild(b);
  return li;
}

async function renderBoard() {
  const box = $("board");
  $("board-me").textContent = "";
  $("board-month").textContent = G.boardMonth(month());
  if (!apiUrl || !account) return box.replaceChildren(messageItem(socialUnavailableText()));
  box.replaceChildren();
  try {
    await syncNow();
    const data = await api().leaderboard(month(), boardScope);
    for (const r of data.rows) {
      const li = rowButton(
        [["rank", r.rank], ["name", r.displayName], ["p", r.points]],
        G.boardRow(r.rank, r.displayName, r.points),
        () => go({ name: "profile", arg: r.username })
      );
      if (r.username === account.username) {
        li.classList.add("me");
        li.firstChild.setAttribute("aria-current", "true");
      }
      box.appendChild(li);
    }
    if (!data.rows.length) box.replaceChildren(messageItem(G.boardEmpty));
    $("board-me").textContent = data.me.hideProgress ? G.myPointsHidden(data.me.points) : G.myPoints(data.me.points);
  } catch {
    box.replaceChildren(messageItem(G.offline));
  }
}

function personItem(u) {
  return rowButton([["name", u.displayName]], G.openProfile(u.displayName), () => go({ name: "profile", arg: u.username }));
}

// ---- tabs: account (settings + sign-in) --------------------------------------
let authMode = "in"; // "in" | "up"
let pendingGoogleToken = null; // ID token waiting for a new player's public name

function authErrorText(e) {
  const map = {
    "bad-email": G.badEmail,
    "weak-password": G.weakPassword,
    "email-taken": G.emailTaken,
    "bad-credentials": G.badCredentials,
    "bad-username": G.badUsername,
    "username-taken": G.usernameTaken,
    "account-conflict": G.accountConflict,
    "google-invalid": G.googleFailed,
    "google-unavailable": G.googleOff,
    "bad-code": G.badCode,
    "code-expired": G.codeExpired,
    "too-many-attempts": G.tooMany,
    "http-429": G.tooMany,
    canceled: G.googleCanceled,
    "no-account": G.googleNoAccount,
    failed: G.googleFailed,
  };
  return (e && map[e.code]) || G.offline;
}

function showAuthPane(which) {
  $("auth-main").hidden = which !== "main";
  $("google-name").hidden = which !== "google-name";
  $("reset").hidden = which !== "reset";
}

function setAuthMode(mode) {
  authMode = mode;
  $("mode-in").setAttribute("aria-pressed", String(mode === "in"));
  $("mode-up").setAttribute("aria-pressed", String(mode === "up"));
  $("name-field").hidden = mode !== "up";
  $("password").autocomplete = mode === "up" ? "new-password" : "current-password";
  $("auth-submit").textContent = mode === "up" ? G.submitSignUp : G.submitSignIn;
}

async function loadAuthConfig() {
  if (authCfg || !apiUrl) return authCfg;
  try {
    authCfg = await gameApi(apiUrl).authConfig();
  } catch {
    authCfg = null; // offline: try again next time
  }
  return authCfg;
}

async function renderMe() {
  const s = await Platform.store.get(["gameAlerts"]);
  $("alerts").checked = s.gameAlerts !== false;
  $("journey-on").checked = journeyOn;
  $("sound-on").checked = soundOn;
  if (!apiUrl) {
    $("auth").hidden = false;
    $("auth-main").hidden = true;
    $("auth-intro").textContent = G.noServer;
    $("account").hidden = true;
    return;
  }
  if (account) {
    try {
      const { user } = await api().me();
      account = { ...account, username: user.username, email: user.email, legacy: user.legacy };
      await Platform.store.set({ [GAME_ACCOUNT_KEY]: account });
      $("hide-progress").checked = user.hideProgress;
    } catch (e) {
      if (e.status === 401) await forgetAccount();
    }
  }
  const signedIn = account && !account.legacy;
  $("auth").hidden = !!signedIn;
  $("account").hidden = !account;
  $("logout").hidden = !signedIn; // a name-only account has nothing to sign back in with
  $("legacy-note").hidden = !(account && account.legacy);
  if (account && account.legacy) $("legacy-note").textContent = G.legacyNote(account.username);
  if (!signedIn && $("google-name").hidden && $("reset").hidden) showAuthPane("main");

  const cfg = await loadAuthConfig();
  const googleReady = !!(cfg && cfg.google && Platform.googleAuth);
  $("google-btn").hidden = !googleReady;
  $("google-off").hidden = googleReady;

  if (!account) return;
  $("me-name").textContent = account.username;
  $("me-email").textContent = account.email ? G.signedInEmail(account.email) : "";
  try {
    const { users } = await api().following();
    $("following").replaceChildren(...(users.length ? users.map(personItem) : [messageItem(G.notFollowing)]));
  } catch {
    // offline: the list stays as it was
  }
}

// Every successful sign-in lands here: store the account, move this device's
// local progress to it (re-sent in full; the server ignores duplicates).
async function signedIn({ user, token }, message) {
  account = { username: user.username, token, email: user.email, legacy: user.legacy };
  await Platform.store.set({ [GAME_ACCOUNT_KEY]: account });
  if (adoptSyncAccount(state, user.username)) await save();
  pendingGoogleToken = null;
  $("password").value = "";
  $("reset-password").value = "";
  showAuthPane("main");
  await renderMe();
  syncNow();
  showNotice(message || G.welcome(user.username), { autoHide: true });
}

const legacyToken = () => (account && account.legacy ? account.token : undefined);

async function withBusy(button, fn) {
  button.disabled = true;
  try {
    await fn();
  } catch (e) {
    showNotice(authErrorText(e));
  } finally {
    button.disabled = false;
  }
}

function submitAuth(ev) {
  ev.preventDefault();
  const email = $("email").value.trim();
  const password = $("password").value;
  withBusy($("auth-submit"), async () => {
    const res =
      authMode === "up"
        ? await gameApi(apiUrl).signUp(email, password, $("username").value.trim(), legacyToken())
        : await gameApi(apiUrl).signIn(email, password, legacyToken());
    await signedIn(res);
  });
}

function signInWithGoogle() {
  withBusy($("google-btn"), async () => {
    const cfg = await loadAuthConfig();
    if (!cfg || !cfg.google || !Platform.googleAuth) throw { code: "google-unavailable" };
    const idToken = await Platform.googleAuth.signIn(cfg.google.clientId);
    try {
      await signedIn(await gameApi(apiUrl).google(idToken, undefined, legacyToken()));
    } catch (e) {
      if (e.code !== "username-required") throw e;
      pendingGoogleToken = idToken; // new player: ask for a public name first
      showAuthPane("google-name");
      $("google-username").focus();
    }
  });
}

function submitGoogleName(ev) {
  ev.preventDefault();
  withBusy(ev.submitter || $("google-name").querySelector("button[type=submit]"), async () => {
    await signedIn(await gameApi(apiUrl).google(pendingGoogleToken, $("google-username").value.trim(), legacyToken()));
  });
}

async function logout() {
  try {
    await api().logout();
  } catch {
    // offline: this device forgets the token anyway
  }
  if (Platform.googleAuth) await Platform.googleAuth.signOut();
  await forgetAccount();
  showNotice(G.loggedOut, { autoHide: true });
  renderMe();
}

function sendResetCode() {
  const email = $("reset-email").value.trim();
  withBusy($("send-code"), async () => {
    await gameApi(apiUrl).forgot(email);
    $("reset-step2").hidden = false; // shown whether or not the email exists
    $("reset-code").focus();
  });
}

function submitReset(ev) {
  ev.preventDefault();
  withBusy(ev.submitter || $("send-code"), async () => {
    const res = await gameApi(apiUrl).reset($("reset-email").value.trim(), $("reset-code").value.trim(), $("reset-password").value);
    await signedIn(res, G.passwordChanged);
  });
}

// Google Play requires in-app account deletion. Server-side only: the local
// game history on this device stays, it just stops syncing.
async function deleteAccount() {
  if (!confirm(G.deleteConfirm(account.username))) return;
  $("delete-account").disabled = true;
  try {
    await api().deleteMe();
    if (Platform.googleAuth) await Platform.googleAuth.signOut();
    await forgetAccount();
    showNotice(G.deleted, { autoHide: true });
    renderMe();
  } catch (e) {
    if (e.status === 401) {
      await forgetAccount(); // already gone on the server
      renderMe();
    } else {
      showNotice(G.deleteFail);
    }
  } finally {
    $("delete-account").disabled = false;
  }
}

let searchTimer = 0;
function onSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    const q = $("search").value.trim();
    if (q.length < 2) return $("search-results").replaceChildren();
    try {
      const { users } = await api().users(q);
      $("search-results").replaceChildren(...users.filter((u) => u.username !== account.username).map(personItem));
    } catch {
      $("search-results").replaceChildren(messageItem(G.searchFail));
    }
  }, 350);
}

async function openProfile(name) {
  profileName = name;
  $("profile-name").textContent = name;
  $("profile-points").textContent = "…";
  $("profile-follow").hidden = true;
  $("profile-back").focus();
  if (!account) return ($("profile-points").textContent = G.needAccount);
  try {
    const p = await api().profile(name, month());
    $("profile-name").textContent = p.user.displayName;
    $("profile-points").textContent = p.points === null ? G.profileHidden : G.profilePoints(p.points);
    $("profile-follow").hidden = p.user.username === account.username;
    $("profile-follow").textContent = p.following ? G.unfollow : G.follow;
    $("profile-follow").dataset.following = String(p.following);
  } catch {
    $("profile-points").textContent = G.profileFail;
  }
}

async function toggleFollow() {
  const following = $("profile-follow").dataset.following === "true";
  try {
    if (following) await api().unfollow(profileName);
    else await api().follow(profileName);
  } catch {
    showNotice(G.offline);
  }
  openProfile(profileName);
}

// ---- wiring ---------------------------------------------------------------
for (const b of document.querySelectorAll(".tabs button")) b.addEventListener("click", () => selectTab(b.dataset.tab));
for (const b of document.querySelectorAll("#board-view .seg button")) {
  b.addEventListener("click", () => {
    boardScope = b.dataset.scope;
    for (const x of document.querySelectorAll("#board-view .seg button")) x.setAttribute("aria-pressed", String(x === b));
    renderBoard();
  });
}
$("alerts").addEventListener("change", async (e) => {
  await Platform.store.set({ gameAlerts: e.target.checked });
  if (Platform.gameAlerts) Platform.gameAlerts.refresh();
});
$("journey-on").addEventListener("change", async (e) => {
  journeyOn = e.target.checked;
  await Platform.store.set({ gameJourney: journeyOn });
});
$("sound-on").addEventListener("change", async (e) => {
  soundOn = e.target.checked;
  await Platform.store.set({ gameSound: soundOn });
  if (soundOn) softChime(); // let the player hear how quiet it is
});
$("mode-in").addEventListener("click", () => setAuthMode("in"));
$("mode-up").addEventListener("click", () => setAuthMode("up"));
$("auth-form").addEventListener("submit", submitAuth);
$("google-btn").addEventListener("click", signInWithGoogle);
$("google-name").addEventListener("submit", submitGoogleName);
$("google-name-cancel").addEventListener("click", () => {
  pendingGoogleToken = null;
  showAuthPane("main");
});
$("forgot").addEventListener("click", () => {
  $("reset-email").value = $("email").value.trim();
  $("reset-step2").hidden = true;
  showAuthPane("reset");
});
$("send-code").addEventListener("click", sendResetCode);
$("reset").addEventListener("submit", submitReset);
$("reset-cancel").addEventListener("click", () => showAuthPane("main"));
$("logout").addEventListener("click", logout);
$("search").addEventListener("input", onSearch);
$("hide-progress").addEventListener("change", async (e) => {
  try {
    await api().updateMe({ hideProgress: e.target.checked });
  } catch {
    e.target.checked = !e.target.checked;
    showNotice(G.saveFail);
  }
});
$("profile-back").addEventListener("click", () => goBack({ name: "board" }));
$("profile-follow").addEventListener("click", toggleFollow);
$("delete-account").addEventListener("click", deleteAccount);
$("mic").addEventListener("click", () => (listening ? stopListening() : startListening()));
$("back").addEventListener("click", () => goBack({ name: "tasks" }));
$("gift").addEventListener("click", () => go({ name: "gift" }));
$("resume").addEventListener("click", () => go({ name: "read", arg: $("resume").dataset.id }));
$("celebrate-ok").addEventListener("click", closeCelebration);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("celebrate").hidden) closeCelebration();
});
$("tools").addEventListener("click", () => (window.location.href = "popup.html"));

(async function init() {
  await load();
  setAuthMode("in");
  if (!location_) {
    $("window-title").textContent = G.pageTitle;
    showNotice(G.needLocation);
    return;
  }
  refreshWindow();
  render(parseRoute(location.hash)); // reopen the screen we were on (reload / back from Tools)
  setInterval(tick, 1000);
  syncNow();
})();
