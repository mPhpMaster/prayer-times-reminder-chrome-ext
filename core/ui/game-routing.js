// ---- routing (Android back) -------------------------------------------------
// history.state.depth = how many screens were pushed above the home screen.
function parseRoute(hash) {
  let h = String(hash || "").replace(/^#/, "");
  try {
    h = decodeURIComponent(h);
  } catch {
    h = ""; // malformed escape: home screen
  }
  const [name, ...rest] = h.split("/");
  const arg = rest.join("/");
  if (name === "board" || name === "me" || name === "gift") return { name };
  if (name === "family") return { name };
  if ((name === "read" || name === "side" || name === "profile" || name === "member") && arg) return { name, arg };
  return { name: "tasks" };
}
const routeHash = (r) => (r.arg ? `#${r.name}/${encodeURIComponent(r.arg)}` : `#${r.name}`);
const depth = () => (history.state && history.state.depth) || 0;
const isTab = (r) => r.name === "tasks" || r.name === "board" || r.name === "me";

function go(r) {
  if (routeHash(r) === location.hash) return render(r);
  history.pushState({ depth: depth() + 1 }, "", routeHash(r));
  render(r);
}
function replaceRoute(r) {
  history.replaceState({ depth: depth() }, "", routeHash(r));
  render(r);
}
// Back to the previous screen; if this screen was opened directly (reload,
// notification), fall back to its parent instead of leaving the page.
function goBack(fallback = { name: "tasks" }) {
  if (depth() > 0) history.back();
  else replaceRoute(fallback);
}
// Tabs: from home, a tab is pushed (back returns home); between tabs it is
// replaced (back still returns home); home itself unwinds the stack.
function selectTab(name) {
  const here = parseRoute(location.hash);
  if (name === "tasks") {
    if (depth() > 0) history.go(-depth());
    else replaceRoute({ name: "tasks" });
  } else if (here.name === "tasks") go({ name });
  else replaceRoute({ name });
}
function parentOf(r) {
  if (r.name === "profile") return { name: "board" };
  if (r.name === "member") return { name: "family" };
  if (r.name === "family") return { name: "me" };
  return { name: "tasks" };
}

window.addEventListener("popstate", () => render(parseRoute(location.hash)));

// Called by the adapter on Android back. true = handled here.
window.__ptBack = () => {
  if (!$("celebrate").hidden) {
    closeCelebration();
    return true;
  }
  const r = parseRoute(location.hash);
  if (r.name === "tasks") return false; // home: the shell goes to the previous page / background
  goBack(parentOf(r));
  return true;
};

// The route of the open reader stays on it; anything else leaves it.
function isReadingRoute(r) {
  if (r.name === "read") return !reading.side && !reading.isGift && reading.task.id === r.arg;
  if (r.name === "side") return reading.side && reading.task.id === r.arg;
  return r.name === "gift" && reading.isGift;
}

function render(r) {
  if (reading && !isReadingRoute(r)) {
    leaveReader(); // partial progress is already saved with every recognized phrase
  }
  // A profile keeps the tab it was opened from (board or account) highlighted.
  const tab = isTab(r) ? r.name : r.name === "profile" ? currentTab() : r.name === "family" || r.name === "member" ? "me" : "tasks";
  for (const b of document.querySelectorAll(".tabs button")) b.setAttribute("aria-selected", String(b.dataset.tab === tab));
  const inReader = r.name === "read" || r.name === "side" || r.name === "gift";
  const onTasks = r.name === "tasks" || inReader;
  document.body.classList.toggle("reader-active", inReader);
  document.querySelector(".scores").hidden = !onTasks;
  $("list-view").hidden = r.name !== "tasks";
  $("guest-note").hidden = !!account || !apiUrl;
  $("reader").hidden = !inReader;
  $("board-view").hidden = r.name !== "board";
  $("me-view").hidden = r.name !== "me";
  $("profile-view").hidden = r.name !== "profile";
  $("family-view").hidden = r.name !== "family";
  $("member-view").hidden = r.name !== "member";

  if (r.name === "tasks" && current) renderList();
  if (r.name === "board") renderBoard();
  if (r.name === "me") renderMe();
  if (r.name === "profile") openProfile(r.arg);
  if (r.name === "family") renderFamily();
  if (r.name === "member") openMember(r.arg);
  if (r.name === "gift") return replaceRoute({ name: "tasks" }); // gifts are gone (an old link)
  if (r.name === "read") {
    if (!current) return replaceRoute({ name: "tasks" });
    const task = r.name === "gift" ? giftForWindow(current.key) : tasks.find((t) => t.id === r.arg);
    const giftReady = r.name !== "gift" || allTasksDone(entry(), tasks.map((t) => t.id));
    if (!task || !giftReady) return replaceRoute({ name: "tasks" });
    if (!reading || reading.side || reading.task.id !== task.id) openReader(task, r.name === "gift");
  }
  if (r.name === "side") {
    const task = side && [...sideTasks, ...disputedTasks].find((t) => t.id === r.arg);
    if (!task) return replaceRoute({ name: "tasks" });
    if (!reading || !reading.side || reading.task.id !== task.id) openReader(task, false, true);
  }
}
function currentTab() {
  const b = document.querySelector('.tabs button[aria-selected="true"]');
  return b ? b.dataset.tab : "tasks";
}
