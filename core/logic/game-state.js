// game-state.js — the player's local progress, as plain data. Pure: callers
// load/save it through Platform.store (key GAME_STORE_KEY).
//
// state = { v: 1, windows: { "2026-09-25:Dhuhr": {
//             tasks: { [taskId]: { startedAt, doneAt, points, heard } },
//             gift:  { id, startedAt, doneAt, points, heard } | undefined } } }
//
// Points for a task are fixed when it is first started — its first recognized
// word (game-score.js) — and only banked when it is finished before the window
// closes. `heard` is the unfinished item's transcript so far (resume).

const GAME_STORE_KEY = "gameState";
const KEEP_DAYS = 62; // two months: enough for this month's and last month's totals

function emptyGameState() {
  return { v: 1, windows: {} };
}

function normalizeGameState(s) {
  return s && s.v === 1 && s.windows && typeof s.windows === "object" ? s : emptyGameState();
}

function windowEntry(state, key) {
  return state.windows[key] || (state.windows[key] = { tasks: {} });
}

// The record of one task (or the window's gift), created empty if missing.
function itemRecord(state, key, itemId, isGift) {
  const w = windowEntry(state, key);
  if (isGift) return w.gift || (w.gift = { id: itemId });
  return w.tasks[itemId] || (w.tasks[itemId] = {});
}

// First start of a task fixes its points (a restart later doesn't lower them).
function markTaskStarted(state, key, taskId, now) {
  const t = itemRecord(state, key, taskId, false);
  if (!t.startedAt) t.startedAt = now;
  return t;
}

function markTaskDone(state, key, taskId, points, now) {
  const t = markTaskStarted(state, key, taskId, now);
  if (!t.doneAt) {
    t.doneAt = now;
    t.points = points;
  }
  delete t.heard;
  delete t.heardAt;
  return t;
}

function markGiftStarted(state, key, giftId, now) {
  const g = itemRecord(state, key, giftId, true);
  if (!g.startedAt) g.startedAt = now;
  return g;
}

function markGiftDone(state, key, giftId, points, now) {
  const g = markGiftStarted(state, key, giftId, now);
  if (!g.doneAt) {
    g.doneAt = now;
    g.points = points;
  }
  delete g.heard;
  delete g.heardAt;
  return g;
}

// A task starts at the first word the recognizer matches, NOT when the mic
// opens: opening and closing the mic without reading must not lock the early
// (higher) points. `result` is a matchTask() result. Returns true when this
// call is the one that started it.
function noteRecognition(state, key, itemId, isGift, result, now) {
  if (!result || !(result.count > 0 || (result.matched || []).some(Boolean))) return false;
  const rec = itemRecord(state, key, itemId, isGift);
  if (rec.startedAt) return false;
  rec.startedAt = now;
  return true;
}

// Partial progress: the recognized text so far, so leaving the reader (or
// the app) and coming back resumes the count. Only for the current window —
// clearStalePartials() drops it once the window is over.
function savePartial(state, key, itemId, isGift, heard, now = Date.now()) {
  const rec = itemRecord(state, key, itemId, isGift);
  if (rec.doneAt) return;
  if (heard && heard.length) {
    rec.heard = heard.slice();
    rec.heardAt = now; // "continue" picks the most recent one
  } else {
    delete rec.heard;
    delete rec.heardAt;
  }
}

function partialHeard(state, key, itemId, isGift) {
  const w = state.windows[key];
  const rec = w && (isGift ? w.gift : w.tasks[itemId]);
  return rec && !rec.doneAt && Array.isArray(rec.heard) ? rec.heard.slice() : [];
}

function clearStalePartials(state, currentKey) {
  for (const [key, w] of Object.entries(state.windows)) {
    if (key === currentKey) continue;
    for (const t of Object.values(w.tasks || {})) {
      delete t.heard;
      delete t.heardAt;
    }
    if (w.gift) {
      delete w.gift.heard;
      delete w.gift.heardAt;
    }
  }
  return state;
}

function windowPoints(entry) {
  if (!entry) return 0;
  let sum = 0;
  for (const t of Object.values(entry.tasks || {})) if (t.doneAt) sum += t.points || 0;
  if (entry.gift && entry.gift.doneAt) sum += entry.gift.points || 0;
  return sum;
}

// Totals over windows whose key starts with a prefix: "2026-09-25" (a day) or
// "2026-09" (a month — the leaderboard resets monthly).
function pointsWithPrefix(state, prefix) {
  let sum = 0;
  for (const [key, entry] of Object.entries(state.windows)) if (key.startsWith(prefix)) sum += windowPoints(entry);
  return sum;
}

function allTasksDone(entry, taskIds) {
  return !!entry && taskIds.every((id) => entry.tasks[id] && entry.tasks[id].doneAt);
}

function pruneGameState(state, now) {
  const cutoff = new Date(now - KEEP_DAYS * 24 * 60 * 60 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  const min = `${cutoff.getFullYear()}-${p(cutoff.getMonth() + 1)}-${p(cutoff.getDate())}`;
  for (const key of Object.keys(state.windows)) if (key.slice(0, 10) < min) delete state.windows[key];
  return state;
}

// ---- measured durations ------------------------------------------------------
// How long the player's own last full reading of a task took (first recognized
// word -> done). Shown only when measured — never an estimate. Keyed by task id
// and repeat, since al-Ikhlas x1 and x3 are different efforts. Kept outside
// `windows` so pruning old windows doesn't lose it.
function durationKey(taskId, repeat) {
  return `${taskId}x${repeat || 1}`;
}

function recordDuration(state, key, ms) {
  if (!(ms > 0) || ms > 6 * 60 * 60 * 1000) return; // clock jumps aren't readings
  (state.durations || (state.durations = {}))[key] = Math.round(ms);
}

function lastDuration(state, key) {
  const ms = state.durations && state.durations[key];
  return ms > 0 ? ms : null;
}

// ---- where to continue ---------------------------------------------------------
// The unfinished task the player touched most recently (it has a saved partial),
// else the first task not done yet, else null. `partial` says which.
function resumeTarget(entry, taskIds) {
  let best = null;
  for (const id of taskIds) {
    const t = entry && entry.tasks[id];
    if (t && !t.doneAt && Array.isArray(t.heard) && t.heard.length && (!best || (t.heardAt || 0) > best.at)) {
      best = { id, partial: true, at: t.heardAt || 0 };
    }
  }
  if (best) return { id: best.id, partial: true };
  const next = taskIds.find((id) => !(entry && entry.tasks[id] && entry.tasks[id].doneAt));
  return next ? { id: next, partial: false } : null;
}

// ---- the day's journey and the month calendar ------------------------------------
// taskIdsFor(prayer) -> the ids a window needs (tasksForWindow in the app).
// A window is "done" when all its tasks are done; "some" when at least one is.
function windowStatus(state, key, taskIds) {
  const e = state.windows[key];
  if (allTasksDone(e, taskIds)) return "done";
  return e && Object.values(e.tasks || {}).some((t) => t.doneAt) ? "some" : "none";
}

// The five windows of `day` ("YYYY-MM-DD") with their status. Pure record of
// what was done; the page decides wording (never blame for a missed one).
function dayJourney(state, day, prayers, taskIdsFor) {
  return prayers.map((p) => ({ prayer: p, key: `${day}:${p}`, status: windowStatus(state, `${day}:${p}`, taskIdsFor(p)) }));
}

// Every day of a month ("YYYY-MM") -> "full" (all five windows done), "some"
// (at least one window done) or "none".
function monthCalendar(state, month, prayers, taskIdsFor) {
  const [y, m] = month.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  const out = [];
  for (let d = 1; d <= days; d++) {
    const day = `${month}-${String(d).padStart(2, "0")}`;
    const done = prayers.filter((p) => windowStatus(state, `${day}:${p}`, taskIdsFor(p)) === "done").length;
    out.push({ day, done, status: done === prayers.length ? "full" : done > 0 ? "some" : "none" });
  }
  return out;
}
