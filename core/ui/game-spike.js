// Phase 0 voice spike — read a task aloud, watch the matcher follow along.
// Requires adapter + platform.js + recitation-match.js + game-tasks.js.
//
// Transcript model: the native recognizer restarts after every utterance, so
// the heard text is every `final` so far plus the live `partial`. The whole
// transcript is re-matched on each update (cheap: a few hundred words at most).

const LOG_KEY = "gameSpikeLog";
const $ = (id) => document.getElementById(id);

let current = null; // selected task
let finals = [];
let partial = "";
let listening = false;
let attempt = null; // { task, startedAt, firstWordAt, restarts, errors }
const completed = new Set();

function setStatus(text, bad = false) {
  $("status").textContent = text;
  $("status").classList.toggle("bad", bad);
}

async function checkRecognizer() {
  if (!Platform.speech) {
    setStatus("هذه المنصة لا توفّر التعرف على الصوت. التجربة تعمل على Android فقط.", true);
    $("tasks").hidden = true;
    return;
  }
  try {
    const s = await Platform.speech.status();
    if (!s.available) {
      setStatus("لا توجد خدمة تعرف على الصوت في هذا الجهاز (ثبّت تطبيق Google أو خدمة مشابهة).", true);
      return;
    }
    setStatus(
      "خدمة التعرف موجودة. " +
        (s.onDevice ? "التعرف داخل الجهاز متاح. " : "التعرف داخل الجهاز غير متاح، سيُستخدم الإنترنت. ") +
        (s.permission ? "" : "سيُطلب إذن الميكروفون عند أول قراءة.")
    );
  } catch (e) {
    setStatus("تعذّر فحص خدمة التعرف: " + e, true);
  }
}

function renderTaskList() {
  const nav = $("tasks");
  nav.replaceChildren();
  for (const t of SPIKE_TASKS) {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-pressed", String(current === t));
    if (completed.has(t.id)) b.classList.add("complete");
    const words = t.text.split(/\s+/).slice(0, 4).join(" ");
    b.textContent = words + (t.text.split(/\s+/).length > 4 ? "…" : "");
    const n = document.createElement("span");
    n.className = "n";
    n.textContent = `${t.repeat} ${t.repeat === 1 ? "مرة" : "مرات"}`;
    b.appendChild(n);
    b.addEventListener("click", () => selectTask(t));
    nav.appendChild(b);
  }
}

// Display words keep their harakat and punctuation; each maps to the index of
// the normalized token it produced (pause marks like ۝ produce none).
function renderText(task) {
  const box = $("text");
  box.replaceChildren();
  let tokenIndex = 0;
  for (const word of task.text.split(/\s+/)) {
    const span = document.createElement("span");
    span.className = "w";
    span.textContent = word;
    if (normalizeArabic(word)) span.dataset.t = String(tokenIndex++);
    box.append(span, " ");
  }
}

async function selectTask(task) {
  await stopListening("switched");
  current = task;
  finals = [];
  partial = "";
  $("reader").hidden = false;
  $("done").hidden = true;
  $("source").textContent = `${task.source} · التكرار في السنة: ${task.sunnahRepeat}`;
  renderText(task);
  renderTaskList();
  update();
}

function heardText() {
  return (finals.join(" ") + " " + partial).trim();
}

function update({ final = false } = {}) {
  if (!current) return;
  const r = matchTask(heardText(), current, { final });
  document.querySelectorAll("#text .w").forEach((s) => {
    const i = s.dataset.t;
    s.classList.toggle("hit", i !== undefined && !!r.matched[Number(i)]);
  });
  const repeat = current.repeat;
  const frac = repeat > 1 ? (r.count + (r.done ? 0 : r.progress)) / repeat : r.progress;
  $("fill").style.width = `${Math.round(Math.min(1, frac) * 100)}%`;
  $("counter").textContent = `${r.count} / ${repeat}`;

  const heard = $("heard");
  heard.replaceChildren(document.createTextNode(finals.join(" ") + " "));
  if (partial) {
    const p = document.createElement("span");
    p.className = "partial";
    p.textContent = partial;
    heard.appendChild(p);
  }

  if (attempt && !attempt.firstWordAt && heardText()) attempt.firstWordAt = Date.now();
  if (r.done && $("done").hidden) {
    $("done").hidden = false;
    completed.add(current.id);
    renderTaskList();
    stopListening("done");
  }
  return r;
}

async function startListening() {
  if (!current || listening) return;
  finals = [];
  partial = "";
  $("done").hidden = true;
  update();
  attempt = { task: current.id, startedAt: Date.now(), firstWordAt: 0, restarts: 0, errors: [] };
  const res = await Platform.speech.start({
    lang: "ar-SA",
    preferOffline: $("prefer-offline").checked,
    onPartial: (text) => {
      partial = text;
      update();
    },
    onFinal: (text) => {
      finals.push(text);
      partial = "";
      if (attempt) attempt.restarts++;
      update();
    },
    onState: (on) => {
      // The mic closes briefly between utterances; only reflect a real stop.
      if (!on && !listening) setMic(false);
    },
    onError: (e) => {
      if (attempt) attempt.errors.push(e.message || e.code);
      setStatus("توقف التعرف: " + (e.message || e.code), true);
      stopListening("error");
    },
  });
  if (!res.ok) {
    setStatus(
      res.reason.includes("microphone-denied") ? "لم يُمنح إذن الميكروفون." : "تعذّر بدء التعرف: " + res.reason,
      true
    );
    attempt = null;
    return;
  }
  listening = true;
  setMic(true);
}

async function stopListening(reason = "user") {
  if (!listening) return;
  listening = false;
  setMic(false);
  await Platform.speech.stop();
  const r = update({ final: true });
  if (attempt && current) await saveAttempt(r, reason);
  attempt = null;
}

function setMic(on) {
  $("mic").classList.toggle("on", on);
  $("mic").textContent = on ? "⏹ إيقاف" : "🎙️ ابدأ القراءة";
}

async function readLog() {
  const s = await Platform.store.get(LOG_KEY);
  return Array.isArray(s[LOG_KEY]) ? s[LOG_KEY] : [];
}

async function saveAttempt(r, reason) {
  const entry = {
    at: new Date(attempt.startedAt).toISOString(),
    task: attempt.task,
    reason,
    offline: $("prefer-offline").checked,
    count: r.count,
    repeat: current.repeat,
    done: r.done,
    seconds: Math.round((Date.now() - attempt.startedAt) / 1000),
    firstWordMs: attempt.firstWordAt ? attempt.firstWordAt - attempt.startedAt : null,
    utterances: attempt.restarts,
    errors: attempt.errors,
    heard: heardText(),
  };
  const log = (await readLog()).concat(entry).slice(-200);
  await Platform.store.set({ [LOG_KEY]: log });
  renderLog(log);
}

function renderLog(log) {
  $("log").textContent = log.length ? JSON.stringify(log.slice().reverse(), null, 1) : "لا محاولات بعد.";
}

$("mic").addEventListener("click", () => (listening ? stopListening("user") : startListening()));
$("back").addEventListener("click", async () => {
  await stopListening("back");
  window.location.href = "popup.html";
});
$("copy-log").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(JSON.stringify(await readLog(), null, 1));
    setStatus("نُسخ السجل.");
  } catch (e) {
    setStatus("تعذّر النسخ: " + e, true);
  }
});
$("clear-log").addEventListener("click", async () => {
  await Platform.store.set({ [LOG_KEY]: [] });
  renderLog([]);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopListening("hidden");
});

renderTaskList();
checkRecognizer();
readLog().then(renderLog);
