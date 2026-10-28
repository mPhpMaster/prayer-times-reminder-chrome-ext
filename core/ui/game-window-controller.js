// ---- window + list --------------------------------------------------------
// Prayer times are recomputed once a minute (or right at the next prayer),
// not every second — see needsWindowRefresh().
// The side window (morning / evening adhkar) changes at Fajr and Maghrib,
// which are prayer times too, so it is refreshed together with the window.
function refreshWindow(now = Date.now()) {
  if (!needsWindowRefresh(current, lastWindowCheck, now) && !(side && now >= side.endsAt)) return;
  lastWindowCheck = now;
  const w = currentWindow(PrayerEngine, location_, new Date(now));
  const sw = sideWindow(PrayerEngine, location_, new Date(now));
  const prayerChanged = !current || w.key !== current.key;
  const sideChanged = !side || sw.key !== side.key;
  if (!prayerChanged && !sideChanged) return;
  // A reading belongs to the window it was opened in: leave it (saving its
  // partial under that window) before switching to the new one.
  const leave = !!reading && (reading.side ? sideChanged : prayerChanged);
  if (leave) leaveReader();
  if (prayerChanged) {
    current = w;
    tasks = tasksForWindow(w.prayer);
    splitWindowPoints(tasks).forEach((p, i) => (tasks[i].share = p));
  }
  if (sideChanged) {
    side = sw;
    sideTasks = tasksForSide(sw.kind);
    splitWindowPoints(sideTasks, SIDE_POINTS).forEach((p, i) => (sideTasks[i].share = p));
    disputedTasks = disputedForSide(sw.kind, disputedOn);
  }
  // A finished window's partial recitations can't be completed any more.
  clearStalePartials(state, [current.key, side.key]);
  save();
  if (leave) replaceRoute({ name: "tasks" });
  renderList();
}

function entry() {
  return state.windows[current.key];
}

const idsCache = {};
const idsFor = (prayer) => idsCache[prayer] || (idsCache[prayer] = tasksForWindow(prayer).map((t) => t.id));
