// ---- tabs: board ------------------------------------------------------------
const month = () => (current ? current.day.slice(0, 7) : new Date().toISOString().slice(0, 7));

// A "Try again" button for a screen that couldn't reach the server.
function retryButton(onRetry) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "link retry";
  b.textContent = tr(lang).uiRetry;
  b.addEventListener("click", onRetry);
  return b;
}

// Shimmering placeholders while a list loads from the server.
function skeletonItems(n) {
  return Array.from({ length: n }, () => {
    const li = document.createElement("li");
    li.className = "skeleton";
    li.setAttribute("aria-hidden", "true");
    return li;
  });
}

function messageItem(text) {
  const li = document.createElement("li");
  li.className = "msg";
  li.textContent = text;
  return li;
}

function socialUnavailableText() {
  return !apiUrl ? G.noServer : G.needAccount;
}

// A list row that opens a profile: a real <button> inside the <li>, so it is
// reachable with Tab, activates with Enter/Space and is announced by screen
// readers with a full label (rank, name, points).
function rowButton(parts, label, onClick) {
  const li = document.createElement("li");
  const b = document.createElement("button");
  b.type = "button";
  b.className = "row-btn";
  b.setAttribute("aria-label", label);
  for (const [cls, text] of parts) {
    const span = document.createElement("span");
    span.className = cls;
    span.textContent = text;
    span.setAttribute("aria-hidden", "true");
    b.appendChild(span);
  }
  b.addEventListener("click", onClick);
  li.appendChild(b);
  return li;
}

// "2026-10" / "2026-Q4" / "2026-H2" / "2026" -> a name in the player's language.
function periodName(type, key) {
  if (!key) return "";
  const y = key.slice(0, 4);
  if (type === "month") return fmtMonth(key);
  if (type === "quarter") return G.quarterN(Number(key.slice(6)), y);
  if (type === "half") return G.halfN(Number(key.slice(6)), y);
  return y;
}

// The latest winners: for the selected period type, or every type on "all".
function renderWinners(winners) {
  const box = $("board-winners");
  const types = boardPeriod === "all" ? ["month", "quarter", "half", "year"] : [boardPeriod];
  const groups = types.map((t) => [t, winners && winners[t]]).filter(([, w]) => w && w.winners.length);
  box.hidden = !groups.length;
  box.replaceChildren(
    ...groups.map(([type, w]) => {
      const div = document.createElement("div");
      div.className = "winners-card";
      const h = document.createElement("p");
      h.className = "winners-title";
      h.textContent = G.winnersOf(periodName(type, w.key));
      const ol = document.createElement("ol");
      ol.className = "board";
      for (const u of w.winners) {
        const li = rowButton(
          [["rank", "🏆"], ["name", u.displayName], ["p", u.points == null ? "—" : u.points]],
          G.winnerRow(u.displayName, u.points),
          () => go({ name: "profile", arg: u.username })
        );
        if (!ol.children.length) li.className = "top"; // the first winner stands out
        ol.appendChild(li);
      }
      div.append(h, ol);
      return div;
    })
  );
}

let boardLoad = 0; // the latest renderBoard call; older answers are dropped

async function renderBoard() {
  const box = $("board");
  const load = ++boardLoad;
  $("board-me").textContent = "";
  $("board-month").textContent = "";
  if (!apiUrl) {
    $("board-winners").hidden = true;
    return box.replaceChildren(messageItem(socialUnavailableText()));
  }
  // Anyone can see the board; "following" needs an account.
  const scopes = document.querySelector("#board-view [data-scope]").parentElement;
  scopes.hidden = !account;
  if (!account && boardScope !== "all") {
    boardScope = "all";
    for (const x of document.querySelectorAll("#board-view [data-scope]")) x.setAttribute("aria-pressed", String(x.dataset.scope === "all"));
  }
  box.replaceChildren(...skeletonItems(6));
  try {
    if (account) await syncNow();
    const data = await api().leaderboard(boardPeriod, boardScope, localDay());
    if (load !== boardLoad) return; // the period or scope changed meanwhile
    // An older server ignores `period` and answers with this month.
    const type = data.period || "month";
    $("board-month").textContent = type === "all" ? G.boardAll : G.boardPeriod(periodName(type, data.periodKey || data.month));
    renderWinners(data.winners);
    const rows = [];
    for (const r of data.rows) {
      const li = rowButton(
        [["rank", r.rank], ["name", r.displayName], ["p", r.points]],
        G.boardRow(r.rank, r.displayName, r.points) + (r.playVerified ? ` (${G.verifiedTitle})` : ""),
        () => go({ name: "profile", arg: r.username })
      );
      if (r.playVerified) {
        const mark = document.createElement("span");
        mark.className = "verified";
        mark.textContent = "✓";
        mark.title = G.verifiedTitle;
        mark.setAttribute("aria-hidden", "true");
        li.querySelector(".name").append(" ", mark);
      }
      if (account && r.username === account.username) {
        li.classList.add("me");
        li.firstChild.setAttribute("aria-current", "true");
      }
      rows.push(li);
    }
    // Replace the loading skeletons (appending left them above the rows).
    box.replaceChildren(...(rows.length ? rows : [messageItem(G.boardEmpty)]));
    $("board-me").textContent = !data.me ? G.guestBoardNote : data.me.hideProgress ? G.myPointsHidden(data.me.points) : G.myPoints(data.me.points);
  } catch {
    if (load !== boardLoad) return;
    const li = messageItem(G.offline);
    li.append(retryButton(renderBoard));
    box.replaceChildren(li);
  }
}

function personItem(u) {
  return rowButton([["name", u.displayName]], G.openProfile(u.displayName), () => go({ name: "profile", arg: u.username }));
}
