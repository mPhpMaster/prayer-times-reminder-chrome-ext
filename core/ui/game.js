// Phase 1 game screen — the current prayer window, its tasks, points, gift.
// Requires adapter + platform.js + i18n.js + prayer-engine.js + the game
// logic scripts (recitation-match, game-score, game-windows, game-state,
// game-tasks). Local only: progress lives in Platform.store[GAME_STORE_KEY].
//
// Speech: the Google voice dialog, one meaningful segment per utterance (the
// engine the owner picked in the phase 0 spike).

const $ = (id) => document.getElementById(id);
const PRAYER_AR = { Fajr: "الفجر", Dhuhr: "الظهر", Asr: "العصر", Maghrib: "المغرب", Isha: "العشاء" };

let location_ = null;
let state = emptyGameState();
let current = null; // currentWindow() result
let tasks = []; // tasksForWindow(current.prayer), with .share (max points)

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
  const s = await Platform.store.get(["location", GAME_STORE_KEY, "theme"]);
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

// ---- wiring ---------------------------------------------------------------
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
})();
