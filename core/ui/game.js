// Phase 1 game screen — the current prayer window, its tasks, points, gift.
// Requires adapter + platform.js + i18n.js + prayer-engine.js + the game
// logic scripts (recitation-match, game-score, game-windows, game-state,
// game-tasks). Local only: progress lives in Platform.store[GAME_STORE_KEY].
//
// Speech: the Google voice dialog, one meaningful segment per utterance (the
// engine the owner picked in the phase 0 spike).
//
// Social (phases 2-3): an optional username account on the game API
// (game-sync.js). Without a server URL or account the game stays local.

const $ = (id) => document.getElementById(id);
const PRAYER_AR = { Fajr: "الفجر", Dhuhr: "الظهر", Asr: "العصر", Maghrib: "المغرب", Isha: "العشاء" };

let location_ = null;
let state = emptyGameState();
let current = null; // currentWindow() result
let tasks = []; // tasksForWindow(current.prayer), with .share (max points)

// Account / server
let account = null; // { username, token }
let apiUrl = "";
const api = () => gameApi(apiUrl, account && account.token);
let boardScope = "all";
let profileName = null;

// Reader state
let reading = null; // { task, isGift }
let finals = [];
let listening = false;
let chunks = [];
let shownChunk = -1;

// ---- time helpers ---------------------------------------------------------
function fmtClock(ms) {
  return new Date(ms).toLocaleTimeString("ar", { hour: "numeric", minute: "2-digit" });
}
function fmtLeft(ms) {
  const m = Math.max(0, Math.ceil(ms / 60000));
  const h = Math.floor(m / 60);
  return h ? `${h} س ${m % 60} د` : `${m} د`;
}

// ---- load / save ----------------------------------------------------------
async function load() {
  const s = await Platform.store.get(["location", GAME_STORE_KEY, "theme", GAME_ACCOUNT_KEY, GAME_API_KEY]);
  account = s[GAME_ACCOUNT_KEY] && s[GAME_ACCOUNT_KEY].token ? s[GAME_ACCOUNT_KEY] : null;
  apiUrl = s[GAME_API_KEY] || GAME_API_DEFAULT;
  if (s.theme && typeof normalizeTheme === "function") {
    document.documentElement.dataset.theme = normalizeTheme(s.theme);
  }
  location_ = s.location && s.location.latitude != null ? s.location : null;
  state = pruneGameState(normalizeGameState(s[GAME_STORE_KEY]), Date.now());
}
function save() {
  return Platform.store.set({ [GAME_STORE_KEY]: state });
}

// ---- window + list --------------------------------------------------------
function refreshWindow() {
  const w = currentWindow(PrayerEngine, location_, new Date());
  if (!current || w.key !== current.key) {
    if (reading) closeReader("window-changed");
    current = w;
    tasks = tasksForWindow(w.prayer);
    splitWindowPoints(tasks).forEach((p, i) => (tasks[i].share = p));
    renderList();
  }
}

function entry() {
  return state.windows[current.key];
}

function renderList() {
  $("window-title").textContent = `مهمات صلاة ${PRAYER_AR[current.prayer]}`;
  const e = entry();
  const ul = $("tasks");
  ul.replaceChildren();
  for (const t of tasks) {
    const rec = e && e.tasks[t.id];
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.id = t.id;
    const left = document.createElement("span");
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = t.title;
    const meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = `${t.repeat > 1 ? t.repeat + " مرة · " : ""}${t.source}`;
    left.append(name, meta);
    const pts = document.createElement("span");
    pts.className = "pts";
    b.append(left, pts);
    if (rec && rec.doneAt) b.classList.add("done");
    b.addEventListener("click", () => openReader(t, false));
    li.appendChild(b);
    ul.appendChild(li);
  }
  tick();
}

// Called every second: countdowns, live potential points, locks.
function tick() {
  const now = Date.now();
  if (location_) refreshWindow();
  if (!current) return;
  const { win } = current;
  const e = entry();
  const open = now >= win.opensAt && now < win.closesAt;

  $("window-time").textContent =
    now < win.opensAt
      ? `تبدأ المهمات بعد ${fmtLeft(win.opensAt - now)} (${fmtClock(win.opensAt)})`
      : `تنتهي مع الصلاة التالية بعد ${fmtLeft(win.closesAt - now)} (${fmtClock(win.closesAt)})`;

  $("pre-open").hidden = now >= win.opensAt;

  for (const b of $("tasks").querySelectorAll("button")) {
    const t = tasks.find((x) => x.id === b.dataset.id);
    const rec = e && e.tasks[t.id];
    const pts = b.querySelector(".pts");
    if (rec && rec.doneAt) {
      pts.textContent = `✓ +${rec.points}`;
      b.disabled = false;
    } else {
      // Points are fixed at the first start; before that they fall with time.
      const at = rec && rec.startedAt ? rec.startedAt : now;
      pts.textContent = open
        ? `${taskPoints(t.share, win, at)} نقطة`
        : now < win.opensAt
          ? `🔒 تُفتح ${fmtClock(win.opensAt)}`
          : "فاتت";
      b.disabled = !open;
    }
  }

  const done = allTasksDone(e, tasks.map((t) => t.id));
  const giftDone = e && e.gift && e.gift.doneAt;
  $("gift").hidden = !(open && done && !giftDone);
  $("gift").textContent = "🎁 افتح الهدية";

  $("pts-window").textContent = windowPoints(e);
  $("pts-day").textContent = pointsWithPrefix(state, current.day);
  $("pts-month").textContent = pointsWithPrefix(state, current.day.slice(0, 7));

  if (reading && listening && now >= win.closesAt) closeReader("window-closed");
}

function showNotice(text) {
  $("notice").hidden = !text;
  $("notice").textContent = text;
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

function openReader(task, isGift) {
  const e = entry();
  const rec = isGift ? e && e.gift : e && e.tasks[task.id];
  if (rec && rec.doneAt) return; // already banked
  reading = { task, isGift };
  finals = [];
  chunks = chunkText(task.text);
  shownChunk = -1;
  $("list-view").hidden = true;
  $("reader").hidden = false;
  $("reader-title").textContent = isGift ? "🎁 هديتك" : task.title;
  $("reader-source").textContent = task.source;
  $("text").replaceChildren(...wordSpans(task.text.split(/\s+/).filter(Boolean), 0));
  $("heard").textContent = "";
  updateReader();
  window.scrollTo({ top: 0 });
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
  if (!reading) return null;
  const { task } = reading;
  const r = matchTask(finals.join(" "), task, { final });
  const tokens = r.matched.length;
  showChunk(r.done ? tokens - 1 : Math.round(r.progress * tokens));
  document.querySelectorAll("#text .w, #chunk .w").forEach((s) => {
    const i = s.dataset.t;
    s.classList.toggle("hit", i !== undefined && !!r.matched[Number(i)]);
  });
  const frac = task.repeat > 1 ? (r.count + (r.done ? 0 : r.progress)) / task.repeat : r.progress;
  $("fill").style.width = `${Math.round(Math.min(1, frac) * 100)}%`;
  $("counter").textContent = task.repeat > 1 ? `${r.count} / ${task.repeat}` : "";
  $("reader-points").textContent = `${readerPoints()} نقطة`;
  if (r.done) finishReading();
  return r;
}

async function startListening() {
  if (!reading || listening) return;
  if (!Platform.speech) {
    showNotice("التعرف على الصوت غير متاح على هذه المنصة.");
    return;
  }
  const now = Date.now();
  const { task, isGift } = reading;
  if (isGift) markGiftStarted(state, current.key, task.id, now);
  else markTaskStarted(state, current.key, task.id, now); // fixes this task's points
  await save();

  listening = true;
  setMic(true);
  const res = await Platform.speech
    .start({
      lang: "ar-SA",
      engine: "google",
      getPrompt: () => (chunks[shownChunk] ? chunks[shownChunk].words.join(" ") : undefined),
      onFinal: (text) => {
        finals.push(text);
        $("heard").textContent = finals.join(" ");
        updateReader();
      },
      onState: (on) => {
        if (!on && listening) stopListening(); // dialog closed / nothing heard
      },
      onError: (e) => {
        showNotice("توقف التعرف على الصوت: " + (e.message || e.code));
        stopListening();
      },
    })
    .catch((e) => ({ ok: false, reason: String((e && e.message) || e) }));
  if (!res.ok) {
    showNotice("تعذّر بدء التعرف على الصوت: " + res.reason);
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
  $("mic").textContent = on ? "⏹ إيقاف" : "🎙️ ابدأ القراءة";
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
  if (now >= current.win.closesAt) return closeReader("window-closed");
  if (isGift) markGiftDone(state, current.key, task.id, points, now);
  else markTaskDone(state, current.key, task.id, points, now);
  await save();
  syncNow();
  // A finished window no longer needs its "30 min left" alert.
  const e = entry();
  if (!isGift && !e.complete && allTasksDone(e, tasks.map((t) => t.id))) {
    e.complete = true;
    await save();
    if (Platform.gameAlerts) Platform.gameAlerts.refresh();
  }
  await closeReader("done");
  showNotice(isGift ? `🎁 تقبّل الله، +${points} نقطة` : `✓ ${task.title}: +${points} نقطة`);
}

async function closeReader(reason) {
  if (listening) {
    listening = false;
    setMic(false);
    await Platform.speech.stop();
  }
  reading = null;
  $("reader").hidden = true;
  $("list-view").hidden = false;
  if (reason === "window-closed") showNotice("انتهى وقت هذه الصلاة، وما لم يكتمل من مهماتها فاتك.");
  renderList();
}

// ---- sync -----------------------------------------------------------------
let syncing = false;
async function syncNow() {
  if (!account || !apiUrl || syncing) return;
  const rows = pendingCompletions(state);
  if (!rows.length) return;
  syncing = true;
  try {
    await api().pushProgress(rows);
    markSynced(state, rows);
    await save();
  } catch (e) {
    if (e.status === 401) await forgetAccount(); // token no longer valid on this server
  } finally {
    syncing = false;
  }
}

async function forgetAccount() {
  account = null;
  await Platform.store.remove(GAME_ACCOUNT_KEY);
}

// ---- tabs -----------------------------------------------------------------
const month = () => (current ? current.day.slice(0, 7) : new Date().toISOString().slice(0, 7));

function showTab(name) {
  for (const b of document.querySelectorAll(".tabs button")) b.setAttribute("aria-selected", String(b.dataset.tab === name));
  const tasksTab = name === "tasks";
  $("list-view").hidden = !tasksTab || !!reading;
  $("reader").hidden = !tasksTab || !reading;
  document.querySelector(".scores").hidden = !tasksTab;
  $("board-view").hidden = name !== "board";
  $("me-view").hidden = name !== "me";
  $("profile-view").hidden = true;
  if (name === "board") renderBoard();
  if (name === "me") renderMe();
}

function messageItem(text) {
  const li = document.createElement("li");
  li.textContent = text;
  return li;
}

function socialUnavailableText() {
  return !apiUrl ? "خادم اللعبة غير مُعدّ بعد، فاللعب الآن على جهازك فقط." : "أنشئ حسابًا من «حسابي» لترى المتصدرين.";
}

async function renderBoard() {
  const box = $("board");
  $("board-me").textContent = "";
  $("board-month").textContent = `ترتيب شهر ${month()} (يُصفَّر كل شهر)`;
  if (!apiUrl || !account) return box.replaceChildren(messageItem(socialUnavailableText()));
  box.replaceChildren();
  try {
    await syncNow();
    const data = await api().leaderboard(month(), boardScope);
    for (const r of data.rows) {
      const li = document.createElement("li");
      if (r.username === account.username) li.classList.add("me");
      for (const [cls, text] of [["rank", r.rank], ["name", r.displayName], ["p", r.points]]) {
        const span = document.createElement("span");
        span.className = cls;
        span.textContent = text;
        li.appendChild(span);
      }
      li.addEventListener("click", () => openProfile(r.username));
      box.appendChild(li);
    }
    if (!data.rows.length) box.replaceChildren(messageItem("لا أحد في القائمة بعد هذا الشهر."));
    $("board-me").textContent = data.me.hideProgress
      ? `نقاطك هذا الشهر: ${data.me.points} (مخفية عن الآخرين)`
      : `نقاطك هذا الشهر: ${data.me.points}`;
  } catch {
    box.replaceChildren(messageItem("تعذّر الاتصال بخادم اللعبة."));
  }
}

function personItem(u, onClick) {
  const li = document.createElement("li");
  const n = document.createElement("span");
  n.className = "name";
  n.textContent = u.displayName;
  li.appendChild(n);
  li.addEventListener("click", onClick);
  return li;
}

async function renderMe() {
  $("alerts").checked = (await Platform.store.get("gameAlerts")).gameAlerts !== false;
  $("account-form").hidden = !!account;
  $("account").hidden = !account;
  if (!apiUrl) {
    $("account-form").querySelector("p").textContent = socialUnavailableText();
    $("register").disabled = true;
    return;
  }
  if (!account) return;
  $("me-name").textContent = account.username;
  try {
    const { user } = await api().me();
    $("hide-progress").checked = user.hideProgress;
    const { users } = await api().following();
    $("following").replaceChildren(
      ...(users.length ? users.map((u) => personItem(u, () => openProfile(u.username))) : [messageItem("لا تتابع أحدًا بعد.")])
    );
  } catch (e) {
    if (e.status === 401) {
      await forgetAccount();
      renderMe();
    }
  }
}

async function register() {
  const name = $("username").value.trim();
  $("register").disabled = true;
  try {
    const { user, token } = await gameApi(apiUrl).register(name);
    account = { username: user.username, token };
    await Platform.store.set({ [GAME_ACCOUNT_KEY]: account });
    await syncNow();
    renderMe();
  } catch (e) {
    showNotice(
      e.code === "username-taken"
        ? "هذا الاسم مأخوذ، جرّب اسمًا آخر."
        : e.code === "bad-username"
          ? "الاسم من 3 إلى 20 حرفًا أو رقمًا، بلا مسافات."
          : "تعذّر الاتصال بخادم اللعبة."
    );
  } finally {
    $("register").disabled = false;
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
      $("search-results").replaceChildren(
        ...users.filter((u) => u.username !== account.username).map((u) => personItem(u, () => openProfile(u.username)))
      );
    } catch {
      $("search-results").replaceChildren(messageItem("تعذّر البحث الآن."));
    }
  }, 350);
}

async function openProfile(name) {
  profileName = name;
  $("board-view").hidden = true;
  $("me-view").hidden = true;
  $("profile-view").hidden = false;
  $("profile-name").textContent = name;
  $("profile-points").textContent = "…";
  $("profile-follow").hidden = true;
  try {
    const p = await api().profile(name, month());
    $("profile-name").textContent = p.user.displayName;
    $("profile-points").textContent = p.points === null ? "أخفى هذا اللاعب تقدمه." : `نقاطه هذا الشهر: ${p.points}`;
    $("profile-follow").hidden = p.user.username === account.username;
    $("profile-follow").textContent = p.following ? "إلغاء المتابعة" : "تابِع";
    $("profile-follow").dataset.following = String(p.following);
  } catch {
    $("profile-points").textContent = "تعذّر تحميل الملف.";
  }
}

async function toggleFollow() {
  const following = $("profile-follow").dataset.following === "true";
  try {
    if (following) await api().unfollow(profileName);
    else await api().follow(profileName);
  } catch {
    showNotice("تعذّر الاتصال بخادم اللعبة.");
  }
  openProfile(profileName);
}

// ---- wiring ---------------------------------------------------------------
for (const b of document.querySelectorAll(".tabs button")) b.addEventListener("click", () => showTab(b.dataset.tab));
for (const b of document.querySelectorAll(".seg button")) {
  b.addEventListener("click", () => {
    boardScope = b.dataset.scope;
    for (const x of document.querySelectorAll(".seg button")) x.setAttribute("aria-pressed", String(x === b));
    renderBoard();
  });
}
$("register").addEventListener("click", register);
$("alerts").addEventListener("change", async (e) => {
  await Platform.store.set({ gameAlerts: e.target.checked });
  if (Platform.gameAlerts) Platform.gameAlerts.refresh();
});
$("search").addEventListener("input", onSearch);
$("hide-progress").addEventListener("change", async (e) => {
  try {
    await api().updateMe({ hideProgress: e.target.checked });
  } catch {
    e.target.checked = !e.target.checked;
    showNotice("تعذّر حفظ الإعداد الآن.");
  }
});
$("profile-back").addEventListener("click", () => {
  const tab = document.querySelector('.tabs button[aria-selected="true"]').dataset.tab;
  showTab(tab);
});
$("profile-follow").addEventListener("click", toggleFollow);
$("mic").addEventListener("click", () => (listening ? stopListening() : startListening()));
$("back").addEventListener("click", () => closeReader("back"));
$("gift").addEventListener("click", () => openReader(giftForWindow(current.key), true));
$("tools").addEventListener("click", () => (window.location.href = "popup.html"));

(async function init() {
  await load();
  if (!location_) {
    $("window-title").textContent = "أذكار الصلاة";
    showNotice("اختر موقعك أولًا من الأدوات والإعدادات، لتُحسب مواقيت الصلاة ومهماتها.");
    return;
  }
  refreshWindow();
  setInterval(tick, 1000);
  syncNow();
})();
