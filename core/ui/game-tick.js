// Countdown work is limited to visible surfaces. A live microphone keeps
// only its deadline check while hidden.
function tick() {
  const now = Date.now();
  if (reading && listening && now >= reading.at.win.closesAt) {
    const wasSide = reading.side;
    leaveReader();
    replaceRoute({ name: "tasks" });
    showNotice(wasSide ? G.sideClosed : G.windowClosed);
  }
  if (document.hidden) return;
  if (location_) refreshWindow(now);
  if (!current) return;
  const { win } = current;
  ViewUpdates.text($("window-time"), now < win.opensAt
    ? G.opensIn(fmtLeft(win.opensAt - now), fmtClock(win.opensAt))
    : G.endsIn(fmtLeft(win.closesAt - now), fmtClock(win.closesAt)));
  ViewUpdates.hidden($("pre-open"), now >= win.opensAt);
  const route = parseRoute(location.hash).name;
  if (!["tasks", "read", "side", "gift"].includes(route)) return;
  const e = entry();
  const open = now >= win.opensAt && now < win.closesAt;
  if (route === "tasks") tickTaskList(now, e, open);
  ViewUpdates.text($("pts-window"), windowPoints(e));
  const totals = gameTotals.read(state, current.day);
  ViewUpdates.text($("pts-day"), totals.day);
  ViewUpdates.text($("pts-month"), totals.month);
  if (reading && reading.mode === "play") ViewUpdates.text($("reader-points"), readerPointsText());
}

function tickTaskList(now, e, open) {
  const { win } = current;
  ViewUpdates.text($("rule-now"), open ? G.ruleNow(Math.round(pointsFactor(win, now) * 100)) : G.ruleNotOpen);
  let doneCount = 0;
  for (const b of $("task-groups").querySelectorAll("button[data-id]")) {
    const t = tasks.find(x => x.id === b.dataset.id);
    const rec = e && e.tasks[t.id];
    const done = !!(rec && rec.doneAt);
    if (done) doneCount++;
    b.classList.toggle("done", done);
    b.classList.toggle("locked", !done && !open);
    const at = rec && rec.startedAt ? rec.startedAt : now;
    ViewUpdates.text(b.querySelector(".pts"), done ? `✓ +${rec.points}`
      : open ? G.points(taskPoints(t.share, win, at)) : now < win.opensAt ? G.locked(fmtClock(win.opensAt)) : G.missed);
  }
  ViewUpdates.text($("done-count"), G.doneCount(doneCount, tasks.length));
  renderResume(open, e);
  ViewUpdates.hidden($("gift"), true);
  tickSide(now);
}

// A saved partial changes only at a state mutation. Do not re-run the speech
// matcher every second just to display an unchanged Continue button.
let resumeRendered = "";
function renderResume(open, e) {
  const key = JSON.stringify([gameStateRevision, current.key, open, lang]);
  if (key === resumeRendered) return;
  resumeRendered = key;
  const target = open ? resumeTarget(e, tasks.map(t => t.id)) : null;
  const btn = $("resume");
  ViewUpdates.hidden(btn, !target);
  if (!target) return;
  const task = tasks.find(t => t.id === target.id);
  let progress = "";
  if (target.partial && task.repeat > 1) {
    const match = matchTask(e.tasks[task.id].heard.join(" "), task);
    progress = `${match.count}/${task.repeat}`;
  }
  ViewUpdates.text(btn, target.partial ? G.resume(gameTaskTitle(lang, task), progress) : G.startNext(gameTaskTitle(lang, task)));
  if (btn.dataset.id !== task.id) btn.dataset.id = task.id;
}

let noticeTimer = 0;
function showNotice(text, { autoHide = false } = {}) {
  clearTimeout(noticeTimer);
  $("notice").hidden = !text;
  $("notice").textContent = text || "";
  $("notice").classList.toggle("reward", Boolean(text && autoHide));
  if (text) noticeTimer = setTimeout(() => showNotice(""), autoHide ? NOTICE_HIDE_MS : NOTICE_ERROR_MS);
}
