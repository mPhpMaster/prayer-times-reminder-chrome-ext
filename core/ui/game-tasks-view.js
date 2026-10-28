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

// route: "read" for the prayer's tasks, "side" for the morning / evening adhkar.
function taskButton(t, route = "read") {
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
  if (t.grading) {
    // Optional disputed adhkar: the grading note, so the player knows.
    const grading = document.createElement("bdi");
    grading.className = "grading";
    grading.lang = "ar";
    grading.textContent = t.grading;
    left.append(grading);
  }
  const pts = document.createElement("span");
  pts.className = "pts";
  b.append(left, pts);
  b.addEventListener("click", () => go({ name: route, arg: t.id }));
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
    ul.append(...list.map((t) => taskButton(t)));
    box.append(h, ul);
  }
  renderSide();
  renderJourney();
  tick();
}

// The side task card: the morning or evening adhkar, a bonus set beside the
// prayer's tasks (its points are filled in by tickSide).
function renderSide() {
  $("side-card").hidden = !side;
  if (!side) return;
  $("side-title").textContent = side.kind === "Morning" ? G.sideMorning : G.sideEvening;
  $("side-tasks").replaceChildren(...sideTasks.map((t) => taskButton(t, "side")));
  $("disputed-card").hidden = !disputedTasks.length;
  $("disputed-tasks").replaceChildren(...disputedTasks.map((t) => taskButton(t, "side")));
}

// Every second, with tick(): the side set is open for its whole window and
// its points don't fall with time.
function tickSide(now) {
  if (!side) return;
  const e = state.windows[side.key];
  let done = 0;
  for (const b of $("side-tasks").querySelectorAll("button[data-id]")) {
    const t = sideTasks.find((x) => x.id === b.dataset.id);
    const rec = e && e.tasks[t.id];
    const isDone = !!(rec && rec.doneAt);
    if (isDone) done++;
    b.classList.toggle("done", isDone);
    ViewUpdates.text(b.querySelector(".pts"), isDone ? `✓ +${rec.points}` : G.points(sidePoints(t.share, side.win, now)));
  }
  ViewUpdates.text($("side-count"), G.doneCount(done, sideTasks.length));
  ViewUpdates.text($("side-time"), G.sideEnds(fmtLeft(side.win.closesAt - now), fmtClock(side.win.closesAt), SIDE_POINTS));
  $("side-card").classList.toggle("all-done", done === sideTasks.length);
  for (const b of $("disputed-tasks").querySelectorAll("button[data-id]")) {
    const rec = e && e.tasks[b.dataset.id];
    const isDone = !!(rec && rec.doneAt);
    b.classList.toggle("done", isDone);
    ViewUpdates.text(b.querySelector(".pts"), isDone ? "✓" : G.noPoints);
  }
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
    h.textContent = weekdayLabel(lang, locale, new Date(2026, 8, 6 + i), true); // 2026-09-06 is a Sunday
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
