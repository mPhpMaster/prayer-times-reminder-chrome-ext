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
    if (!s.available && !s.whisper) {
      setStatus("لا يوجد نموذج تلاوة ولا خدمة تعرف على الصوت في هذا الجهاز.", true);
      return;
    }
    if (!s.whisper) $("engine").querySelector('[value="whisper"]').disabled = true;
    syncEngineUi();
    setStatus(
      (s.whisper ? "نموذج التلاوة موجود على الجهاز. " : "نموذج التلاوة غير موجود على الجهاز. ") +
        "خدمة النظام موجودة. " +
        (s.onDevice ? "التعرف داخل الجهاز متاح. " : "التعرف داخل الجهاز غير متاح، سيُستخدم الإنترنت. ") +
        (s.permission ? "" : "سيُطلب إذن الميكروفون عند أول قراءة.")
    );
  } catch (e) {
    setStatus("تعذّر فحص خدمة التعرف: " + e, true);
  }
}

const engine = () => $("engine").value;
function syncEngineUi() {
  $("offline-row").hidden = engine() !== "default";
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

// Meaningful reading segments (split at clause marks): short utterances
// recognize faster and more accurately than a whole ayah.
let chunks = [];
let shownChunk = -1;
function renderText(task) {
  chunks = chunkText(task.text);
  shownChunk = -1;
  $("text").replaceChildren(...wordSpans(task.text.split(/\s+/).filter(Boolean), 0));
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
  const tokens = r.matched.length;
  showChunk(r.done ? tokens - 1 : Math.round(r.progress * tokens));
  document.querySelectorAll("#text .w, #chunk .w").forEach((s) => {
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
  attempt = { task: current.id, startedAt: Date.now(), firstWordAt: 0, readyMs: 0, restarts: 0, errors: [], segments: [] };
  const res = await Platform.speech
    .start({
      lang: "ar-SA",
      engine: engine(),
      preferOffline: $("prefer-offline").checked,
      getPrompt: () => (chunks[shownChunk] ? chunks[shownChunk].words.join(" ") : undefined),
      onPartial: (text) => {
        partial = text;
        update();
      },
      onFinal: (text, meta = {}) => {
        finals.push(text);
        if (attempt && meta.decodeMs != null) {
          attempt.segments.push({ sec: Math.round(meta.seconds * 10) / 10, ms: meta.decodeMs, text });
        }
        partial = "";
        if (attempt) attempt.restarts++;
        update();
      },
      onState: (on) => {
        // Google dialog loop ended (dialog canceled / nothing heard).
        if (!on && listening && engine() === "google") {
          stopListening("dialog-closed");
          return;
        }
        // Whisper reports ready once the model is loaded; the system
        // recognizer closes the mic briefly between utterances.
        if (on && $("mic").classList.contains("loading")) setStatus("أسمعك، ابدأ القراءة.");
        if (on) $("mic").classList.remove("loading");
        if (on && attempt && !attempt.readyMs) attempt.readyMs = Date.now() - attempt.startedAt;
        if (!on && !listening) setMic(false);
      },
      onSpeech: (speaking) => $("mic").classList.toggle("hearing", speaking),
      onBusy: (n) => {
        $("busy").hidden = n === 0;
        $("busy").textContent = n > 1 ? `جارٍ تفريغ ${n} مقاطع…` : "جارٍ تفريغ ما قلته…";
      },
      onError: (e) => {
        if (attempt) attempt.errors.push(e.message || e.code);
        setStatus("توقف التعرف: " + (e.message || e.code), true);
        stopListening("error");
      },
    })
    .catch((e) => ({ ok: false, reason: String(e && e.message || e) }));
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
  if (engine() === "whisper") {
    $("mic").classList.add("loading");
    setStatus("جارٍ تحميل نموذج التلاوة…");
  }
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
  if (!on) $("mic").classList.remove("loading", "hearing");
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
    engine: engine(),
    offline: $("prefer-offline").checked,
    readyMs: attempt.readyMs || null,
    count: r.count,
    repeat: current.repeat,
    done: r.done,
    seconds: Math.round((Date.now() - attempt.startedAt) / 1000),
    firstWordMs: attempt.firstWordAt ? attempt.firstWordAt - attempt.startedAt : null,
    utterances: attempt.restarts,
    errors: attempt.errors,
    heard: heardText(),
    segments: attempt.segments, // whisper: seconds of audio vs decode ms, per utterance
  };
  const log = (await readLog()).concat(entry).slice(-200);
  await Platform.store.set({ [LOG_KEY]: log });
  renderLog(log);
}

function renderLog(log) {
  $("log").textContent = log.length ? JSON.stringify(log.slice().reverse(), null, 1) : "لا محاولات بعد.";
}

$("engine").addEventListener("change", async () => {
  await stopListening("engine");
  syncEngineUi();
});
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
  // The Google dialog covers the page on purpose; don't treat that as leaving.
  if (document.hidden && engine() !== "google") stopListening("hidden");
});

renderTaskList();
checkRecognizer();
readLog().then(renderLog);
