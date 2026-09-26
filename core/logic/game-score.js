// game-score.js — pure scoring rules for the prayer-window tasks. No platform APIs.
//
// Rules (decided by the product owner, 2026-09-25):
//   - A window's tasks open TASK_DELAY_MIN after its prayer and close at the
//     next prayer; anything not done by then is lost.
//   - Starting a task within the first FULL_MIN of the open window earns the
//     window's full points; the reward then falls linearly until
//     FLOOR_BEFORE_MIN before the next prayer, where it bottoms out at
//     FLOOR_RATIO of full (300 -> 50) and stays there until the window closes.
//   - Points are fixed by when the task was STARTED (first recognized word),
//     so a long recitation begun on time is not penalized for its length.
//   - Finishing every task in a window opens a gift: a du'a / ayah / surah
//     whose recitation adds GIFT_POINTS on top.
//
//   taskWindow(prayerAt, nextPrayerAt)   -> { opensAt, fullUntil, floorAt, closesAt }
//   pointsFactor(win, startedAt)         -> 0..1   (0 = not open yet / lost)
//   taskPoints(maxPoints, win, startedAt)-> integer

const MIN = 60 * 1000;
const TASK_DELAY_MIN = 30;
const FULL_MIN = 30;
const FLOOR_BEFORE_MIN = 30;
const FLOOR_RATIO = 50 / 300;
const WINDOW_POINTS = 300;
const GIFT_POINTS = 100;

function taskWindow(prayerAt, nextPrayerAt) {
  const opensAt = prayerAt + TASK_DELAY_MIN * MIN;
  const closesAt = nextPrayerAt;
  const fullUntil = Math.min(opensAt + FULL_MIN * MIN, closesAt);
  // Short windows (Maghrib -> Isha can be ~75 min) leave no room to decay:
  // full points for the first FULL_MIN, then straight to the floor.
  const floorAt = Math.max(fullUntil, closesAt - FLOOR_BEFORE_MIN * MIN);
  return { opensAt, fullUntil, floorAt, closesAt };
}

function pointsFactor(win, startedAt) {
  if (startedAt < win.opensAt || startedAt >= win.closesAt) return 0;
  if (startedAt <= win.fullUntil) return 1;
  if (startedAt >= win.floorAt) return FLOOR_RATIO;
  const t = (startedAt - win.fullUntil) / (win.floorAt - win.fullUntil);
  return 1 - t * (1 - FLOOR_RATIO);
}

function taskPoints(maxPoints, win, startedAt) {
  return Math.round(maxPoints * pointsFactor(win, startedAt));
}

// Split a window's total across its tasks by weight (default: equal). The
// catalog weighs each task by the words actually recited — its word count
// times its repeat (game-tasks.js) — so a longer / more repeated dhikr earns
// more. Largest-remainder rounding: every task gets at least 1 point and the
// parts always sum to exactly `total`.
function splitWindowPoints(tasks, total = WINDOW_POINTS) {
  if (!tasks.length) return [];
  const weights = tasks.map((t) => (t.weight > 0 ? t.weight : 1));
  const sum = weights.reduce((a, b) => a + b, 0);
  const free = total - tasks.length; // 1 point each up front
  const exact = weights.map((w) => (free * w) / sum);
  const parts = exact.map((x) => 1 + Math.floor(x));
  let left = total - parts.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) parts[order[k][1]]++;
  return parts;
}
