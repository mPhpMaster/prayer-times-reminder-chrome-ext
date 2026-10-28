// New-tab prayer, progress and weather presentation. All calculations and I/O
// remain in newtab-prayers.js and newtab-data.js.
function createNewTabCards(readState, { digits, fmtTime }) {
  const $ = (id) => document.getElementById(id);
  const { prayers: PRAYERS, five: FIVE, icons: ICONS } = NewTabConfig;

  function renderTimes() {
    const { L, today } = readState();
    const list = $("times");
    $("today-title").textContent = L.ntTodayTitle;
    $("set-city").hidden = !!today;
    $("set-city").textContent = L.webOpenApp;
    if (!today) return list.replaceChildren();
    const now = Date.now();
    const next = FIVE.find((p) => today.at[p] > now) || "Fajr";
    list.replaceChildren(
      ...PRAYERS.map((p) => {
        const li = document.createElement("li");
        if (p === next) li.className = "is-next";
        else if (today.at[p] < now) li.className = "is-past";
        if (p === "Sunrise") li.classList.add("info");
        const name = document.createElement("span");
        name.textContent = `${ICONS[p]}  ${prayerLabel(L, p)}`;
        const t = document.createElement("span");
        t.className = "t";
        t.textContent = digits(fmtTime(today.at[p]));
        li.append(name, t);
        return li;
      })
    );
  }

  function showWeather(w) {
    const { s } = readState();
    const on = s.ntWeather !== false && w && typeof w.temp === "number";
    $("weather").hidden = !on;
    if (!on) return;
    $("w-icon").textContent = NewTabData.weatherIcon(w.code, w.day);
    $("w-temp").textContent = digits(`${Math.round(w.temp)}°`);
  }

  function renderTasks() {
    const { L, today, progress } = readState();
    const card = $("tasks-card");
    if (!today || !progress) return (card.hidden = true);
    try {
      const { prayer, total, done } = NewTabPrayers.taskSummary(progress, WINDOW_TASKS);
      const name = prayerLabel(L, prayer);
      const share = done / Math.max(1, total);
      $("tasks-text").textContent = done >= total ? L.ntTasksDone(name) : L.ntTasks(name, done, total);
      $("tasks-bar").style.width = `${Math.round(share * 100)}%`;
      const circumference = 2 * Math.PI * 18;
      $("ring-fill").style.strokeDasharray = `${(share * circumference).toFixed(1)} ${circumference.toFixed(1)}`;
      $("ring-pct").textContent = digits(`${Math.round(share * 100)}%`);
      $("tasks-open").textContent = L.ntOpenTasks;
      card.classList.toggle("all-done", done >= total);
      card.hidden = false;
    } catch {
      card.hidden = true;
    }
  }

  return { renderTimes, renderTasks, showWeather };
}
