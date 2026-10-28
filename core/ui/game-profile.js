let searchTimer = 0;
function onSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    const q = $("search").value.trim();
    if (q.length < 2) return $("search-results").replaceChildren();
    try {
      const { users } = await api().users(q);
      $("search-results").replaceChildren(...users.filter((u) => u.username !== account.username).map(personItem));
    } catch {
      $("search-results").replaceChildren(messageItem(G.searchFail));
    }
  }, 350);
}

const fmtNum = (n) => Number(n).toLocaleString(locale);
const fmtMonth = (ym) => {
  const d = new Date(`${ym}-01T12:00:00`);
  if (DATE_NAMES[lang]) return `${monthName(lang, locale, d, true)} ${d.getFullYear()}`;
  return d.toLocaleDateString(locale, { month: "long", year: "numeric" });
};
// The phone's local date: streaks and "today" follow its clock, not the server's.
const fmtDayMonth = (d) =>
  DATE_NAMES[lang]
    ? `${d.getDate()} ${monthName(lang, locale, d)}`
    : d.toLocaleDateString(locale, { day: "numeric", month: "short" });
const localDay = () => (current ? current.day : new Date().toLocaleDateString("en-CA"));

async function openProfile(name) {
  profileName = name;
  $("profile-name").textContent = name;
  $("profile-meta").textContent = "";
  $("profile-points").replaceChildren(Object.assign(document.createElement("span"), { className: "skeleton-line" }));
  $("profile-wins").hidden = true;
  $("profile-follow").hidden = true;
  $("profile-stats").hidden = true;
  $("profile-ach").hidden = true;
  $("profile-back").focus();
  if (!account) return ($("profile-points").textContent = G.needAccount);
  try {
    await syncNow(); // your own numbers include what this phone just finished
    const p = await api().profile(name, month(), localDay());
    if (profileName !== name) return; // another profile was opened meanwhile
    $("profile-name").textContent = p.user.displayName;
    $("profile-meta").textContent = [G.followersN(p.followers), G.followingN(p.followingCount), p.joined ? G.joined(fmtMonth(p.joined)) : ""]
      .filter(Boolean)
      .join(" · ");
    $("profile-points").textContent = p.points === null ? G.profileHidden : G.profilePoints(p.points);
    $("profile-follow").hidden = p.self;
    $("profile-follow").textContent = p.following ? G.unfollow : G.follow;
    $("profile-follow").dataset.following = String(p.following);
    renderWins(p.wins);
    renderStats(p.stats, p.points);
    renderAchievements(p.achievements);
  } catch {
    $("profile-points").replaceChildren(G.profileFail, " ", retryButton(() => openProfile(name)));
  }
}

// Period prizes: public even when progress is hidden (the winners list shows
// the name anyway). "Last month's winner", then counts by period type.
function renderWins(w) {
  const el = $("profile-wins");
  if (!w || !w.total) return (el.hidden = true);
  const labels = { month: G.periodMonth, quarter: G.periodQuarter, half: G.periodHalf, year: G.periodYear };
  const parts = ["month", "quarter", "half", "year"].filter((t) => w[t]).map((t) => `${labels[t]} ×${fmtNum(w[t])}`);
  el.textContent = [w.lastMonth ? G.lastMonthWinner : "", G.winsLine(parts.join(" · "))].filter(Boolean).join("\n");
  el.hidden = false;
}

function renderStats(s, monthPoints) {
  $("profile-stats").hidden = !s;
  if (!s) return;
  const rows = [
    [G.statMonth, monthPoints],
    [G.statTotal, s.totalPoints],
    [G.statTasks, s.tasks],
    [G.statWindows, s.windows],
    [G.statFullDays, s.fullDays],
    [G.statDays, s.activeDays],
    [G.statStreak, s.currentStreak],
    [G.statBest, s.bestStreak],
  ];
  $("stats-grid").replaceChildren(
    ...rows.map(([label, value]) => {
      const div = document.createElement("div");
      const dd = document.createElement("dd");
      dd.textContent = fmtNum(value);
      const dt = document.createElement("dt");
      dt.textContent = label;
      div.append(dd, dt); // number first, big; <dl> > <div> keeps dt/dd paired
      return div;
    })
  );
}

// Every achievement, earned ones first (in the order earned), the rest dimmed:
// shows what is possible without ranking anyone.
function renderAchievements(list) {
  $("profile-ach").hidden = !list;
  if (!list) return;
  const earned = new Map(list.map((a) => [a.id, a.earnedAt]));
  // "first-gift" can no longer be earned (gifts are gone): kept only if already won.
  const RETIRED = ["first-gift"];
  const ids = [...earned.keys(), ...Object.keys(G.ach).filter((id) => !earned.has(id) && !RETIRED.includes(id))];
  $("ach-list").replaceChildren(
    ...ids
      .filter((id) => G.ach[id]) // an id newer than this app: skip until it knows the name
      .map((id) => {
        const [title, line] = G.ach[id];
        const li = document.createElement("li");
        li.className = earned.has(id) ? "earned" : "locked";
        const mark = document.createElement("span");
        mark.className = "ach-mark";
        mark.setAttribute("aria-hidden", "true");
        mark.textContent = earned.has(id) ? "✦" : "·";
        const text = document.createElement("span");
        const b = document.createElement("b");
        b.textContent = title;
        const small = document.createElement("small");
        small.textContent = earned.has(id)
          ? `${line} ${fmtDayMonth(new Date(earned.get(id)))}`
          : G.achLocked;
        text.append(b, small);
        li.append(mark, text);
        return li;
      })
  );
}

async function toggleFollow() {
  const following = $("profile-follow").dataset.following === "true";
  try {
    if (following) await api().unfollow(profileName);
    else await api().follow(profileName);
  } catch {
    showNotice(G.offline);
  }
  openProfile(profileName);
}
