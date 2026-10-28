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

function readerMode(isGift, rec, now, win) {
  if (rec && rec.doneAt) return "done";
  if (isGift) return "play";
  if (now < win.opensAt) return "practice";
  if (now >= win.closesAt) return "missed";
  return "play";
}

function readerPointsText() {
  return reading.task.disputed ? G.noPoints : G.points(readerPoints());
}

// The reading's record in its own window (prayer or side).
function readingRecord() {
  const e = state.windows[reading.at.key];
  return reading.isGift ? e && e.gift : e && e.tasks[reading.task.id];
}

function openReader(task, isGift, isSide = false) {
  const at = isSide ? side : current;
  const e = state.windows[at.key];
  const rec = isGift ? e && e.gift : e && e.tasks[task.id];
  const mode = readerMode(isGift, rec, Date.now(), at.win);
  reading = { task, isGift, side: isSide, at, mode };
  const play = mode === "play";
  finals = play ? partialHeard(state, at.key, task.id, isGift) : [];
  chunks = chunkText(task.text);
  shownChunk = -1;
  showNotice("");
  $("reader-title").textContent = isGift ? G.giftTitle : gameTaskTitle(lang, task);
  $("reader-source").textContent = task.grading ? `${task.source} — ${task.grading}` : task.source;
  $("text").replaceChildren(...wordSpans(task.text.split(/\s+/).filter(Boolean), 0));
  $("text").hidden = chunks.length <= 1; // one part: the big card already shows all of it
  $("text").scrollTop = 0;
  $("heard").textContent = finals.join(" ");
  setMic(false);

  const modeText =
    mode === "practice"
      ? G.practice(fmtClock(at.win.opensAt))
      : mode === "missed"
        ? G.missedMode
        : mode === "done"
          ? task.disputed
            ? G.disputedDoneMode
            : (isSide ? G.sideDoneMode : G.doneMode)(rec.points)
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
    savePartial(state, reading.at.key, reading.task.id, reading.isGift, finals);
    save();
  }
  reading = null;
}

function readerPoints() {
  const { task, isGift, at } = reading;
  if (isGift) return GIFT_POINTS;
  if (task.disputed) return 0; // optional disputed adhkar: no points
  const rec = readingRecord();
  const startedAt = rec && rec.startedAt ? rec.startedAt : Date.now();
  return reading.side ? sidePoints(task.share, at.win, startedAt) : taskPoints(task.share, at.win, startedAt);
}

function showChunk(pos) {
  let i = chunks.findIndex((c) => pos < c.to);
  if (i < 0) i = chunks.length - 1;
  const moved = i !== shownChunk;
  if (moved) {
    shownChunk = i;
    $("chunk").replaceChildren(...wordSpans(chunks[i].words, chunks[i].from));
  }
  const c = chunks[i];
  let first = null;
  document.querySelectorAll("#text .w").forEach((s) => {
    const t = s.dataset.t === undefined ? -1 : Number(s.dataset.t);
    const cur = t >= c.from && t < c.to;
    s.classList.toggle("cur", cur);
    if (cur && !first) first = s;
  });
  $("segment").textContent = chunks.length > 1 ? G.segment(i + 1, chunks.length) : "";
  renderChunkNav();
  // Long texts scroll inside their box: keep the current part in view there,
  // without moving the page (the mic stays where the thumb is).
  const box = $("text");
  if (moved && first && box.scrollHeight > box.clientHeight) {
    box.scrollTop = Math.max(0, first.offsetTop - box.clientHeight / 3);
  }
}

// Practice / review: step through the parts by hand. While reading for
// points the recognized voice moves the part on, so the buttons are hidden.
function renderChunkNav() {
  const manual = reading && reading.mode !== "play" && chunks.length > 1;
  $("chunk-nav").hidden = !manual;
  if (!manual) return;
  const rtl = document.documentElement.dir === "rtl";
  const prev = $("chunk-prev");
  const next = $("chunk-next");
  prev.textContent = rtl ? "›" : "‹"; // "back" points to where reading came from
  next.textContent = rtl ? "‹" : "›";
  prev.disabled = shownChunk <= 0;
  next.disabled = shownChunk >= chunks.length - 1;
  prev.setAttribute("aria-label", G.segment(Math.max(1, shownChunk), chunks.length));
  next.setAttribute("aria-label", G.segment(Math.min(chunks.length, shownChunk + 2), chunks.length));
}
function stepChunk(delta) {
  const i = Math.min(chunks.length - 1, Math.max(0, shownChunk + delta));
  showChunk(chunks[i].from);
}

// Reader text size: three steps above the default, one below; kept per device.
const FONT_STEPS = [0.85, 1, 1.15, 1.3, 1.5];
let fontStep = 1;
function applyFontStep() {
  $("reader").style.setProperty("--reader-scale", String(FONT_STEPS[fontStep]));
  $("font-down").disabled = fontStep <= 0;
  $("font-up").disabled = fontStep >= FONT_STEPS.length - 1;
}
function changeFont(delta) {
  fontStep = Math.min(FONT_STEPS.length - 1, Math.max(0, fontStep + delta));
  applyFontStep();
  Platform.store.set({ gameFontStep: fontStep });
}

function updateReader({ final = false } = {}) {
  if (!reading || reading.mode !== "play") return null;
  const { task, isGift } = reading;
  const r = matchTask(finals.join(" "), task, { final });
  // The task starts at its first recognized word — this fixes its points.
  if (noteRecognition(state, reading.at.key, task.id, isGift, r, Date.now())) save();
  const tokens = r.matched.length;
  showChunk(r.done ? tokens - 1 : Math.round(r.progress * tokens));
  document.querySelectorAll("#text .w, #chunk .w").forEach((s) => {
    const i = s.dataset.t;
    s.classList.toggle("hit", i !== undefined && !!r.matched[Number(i)]);
  });
  const frac = task.repeat > 1 ? (r.count + (r.done ? 0 : r.progress)) / task.repeat : r.progress;
  $("fill").style.width = `${Math.round(Math.min(1, frac) * 100)}%`;
  $("counter").textContent = task.repeat > 1 ? `${r.count} / ${task.repeat}` : "";
  $("reader-points").textContent = readerPointsText();
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
        savePartial(state, reading.at.key, reading.task.id, reading.isGift, finals);
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
    showNotice(res.reason === "no-recognizer" ? G.speechNoService : G.speechStartFail(res.reason));
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
  gameClock?.refresh(false);
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
  const { task, isGift, at, side: isSide } = reading;
  const now = Date.now();
  const points = readerPoints();
  if (now >= at.win.closesAt) {
    reading = null;
    replaceRoute({ name: "tasks" });
    showNotice(isSide ? G.sideClosed : G.windowClosed);
    return;
  }
  const before = readingRecord();
  const started = before && before.startedAt;
  const rec = isGift ? markGiftDone(state, at.key, task.id, points, now) : markTaskDone(state, at.key, task.id, points, now); // once: a done task is never re-banked
  if (!account) rec.local = true; // a guest's points stay on this device (never sent, even after signing in)
  if (task.disputed) Object.assign(rec, { unscored: true, local: true }); // optional: no points, never sent
  if (!isGift && started) recordDuration(state, durationKey(task.id, task.repeat), now - started);
  await save();
  syncNow();
  const e = state.windows[at.key];
  let windowComplete = false;
  let sideComplete = false;
  if (task.disputed) {
    // Optional disputed adhkar: not part of the set, nothing to complete.
  } else if (isSide) {
    // The side set has no alerts and no journey step: just say it is complete.
    sideComplete = allTasksDone(e, sideTasks.map((t) => t.id));
  } else if (!isGift && !e.complete && allTasksDone(e, tasks.map((t) => t.id))) {
    // A finished window no longer needs its "30 min left" alert.
    e.complete = true;
    windowComplete = true;
    await save();
    if (Platform.gameAlerts) Platform.gameAlerts.refresh();
  }
  reading = null;
  goBack({ name: "tasks" });
  const sideTitle = isSide && (at.kind === "Morning" ? G.sideMorning : G.sideEvening);
  showNotice(
    task.disputed ? G.disputedDone(gameTaskTitle(lang, task)) : sideComplete ? G.sideDone(sideTitle) : isGift ? G.giftDone(points) : G.taskDone(gameTaskTitle(lang, task), points),
    { autoHide: true }
  );
  if (sideComplete && soundOn) softChime();
  if (windowComplete) celebrate(current.prayer);
}
