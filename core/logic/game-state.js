// game-state.js — the player's local progress, as plain data. Pure: callers
// load/save it through Platform.store (key GAME_STORE_KEY).
//
// state = { v: 1, windows: { "2026-09-25:Dhuhr": {
//             tasks: { [taskId]: { startedAt, doneAt, points } },
//             gift:  { id, startedAt, doneAt, points } | undefined } } }
//
// Points for a task are fixed when it is first started (game-score.js), and
// only banked when it is finished before the window closes.

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

// First start of a task fixes its points (a restart later doesn't lower them).
function markTaskStarted(state, key, taskId, now) {
  const w = windowEntry(state, key);
  const t = w.tasks[taskId] || (w.tasks[taskId] = {});
  if (!t.startedAt) t.startedAt = now;
  return t;
}

function markTaskDone(state, key, taskId, points, now) {
  const t = markTaskStarted(state, key, taskId, now);
  if (!t.doneAt) {
    t.doneAt = now;
    t.points = points;
  }
  return t;
}

function markGiftStarted(state, key, giftId, now) {
  const w = windowEntry(state, key);
  if (!w.gift) w.gift = { id: giftId, startedAt: now };
  return w.gift;
}

function markGiftDone(state, key, giftId, points, now) {
  const g = markGiftStarted(state, key, giftId, now);
  if (!g.doneAt) {
    g.doneAt = now;
    g.points = points;
  }
  return g;
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
