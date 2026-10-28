// ---- wiring ---------------------------------------------------------------
for (const b of document.querySelectorAll(".tabs button")) b.addEventListener("click", () => selectTab(b.dataset.tab));
for (const b of document.querySelectorAll("#board-view [data-scope]")) {
  b.addEventListener("click", () => {
    boardScope = b.dataset.scope;
    for (const x of document.querySelectorAll("#board-view [data-scope]")) x.setAttribute("aria-pressed", String(x === b));
    renderBoard();
  });
}
for (const b of document.querySelectorAll("#board-view [data-period]")) {
  b.addEventListener("click", () => {
    boardPeriod = b.dataset.period;
    for (const x of document.querySelectorAll("#board-view [data-period]")) x.setAttribute("aria-pressed", String(x === b));
    renderBoard();
  });
}
$("alerts").addEventListener("change", async (e) => {
  await Platform.store.set({ gameAlerts: e.target.checked });
  if (Platform.gameAlerts) Platform.gameAlerts.refresh();
  pushSettings({ alerts: e.target.checked });
});
$("journey-on").addEventListener("change", async (e) => {
  journeyOn = e.target.checked;
  await Platform.store.set({ gameJourney: journeyOn });
  pushSettings({ journey: journeyOn });
});
$("disputed-on").addEventListener("change", async (e) => {
  await setDisputed(e.target.checked);
  pushSettings({ disputed: disputedOn });
});
$("newtab-on").addEventListener("change", async (e) => {
  await Platform.store.set({ newTabPage: e.target.checked });
  pushSettings({ newTab: e.target.checked });
});
$("sound-on").addEventListener("change", async (e) => {
  soundOn = e.target.checked;
  await Platform.store.set({ gameSound: soundOn });
  pushSettings({ sound: soundOn });
  if (soundOn) softChime(); // let the player hear how quiet it is
});
$("mode-in").addEventListener("click", () => setAuthMode("in"));
$("mode-up").addEventListener("click", () => setAuthMode("up"));
$("auth-form").addEventListener("submit", submitAuth);
$("google-btn").addEventListener("click", signInWithGoogle);
$("google-name").addEventListener("submit", submitGoogleName);
$("apple-btn").addEventListener("click", signInWithApple);
$("google-name-cancel").addEventListener("click", () => {
  pendingGoogleToken = null;
  pendingApple = null;
  showAuthPane("main");
});
$("forgot").addEventListener("click", () => {
  $("reset-email").value = $("email").value.trim();
  $("reset-step2").hidden = true;
  showAuthPane("reset");
});
$("send-code").addEventListener("click", sendResetCode);
$("reset").addEventListener("submit", submitReset);
$("reset-cancel").addEventListener("click", () => showAuthPane("main"));
$("logout").addEventListener("click", logout);
$("search").addEventListener("input", onSearch);
$("hide-progress").addEventListener("change", async (e) => {
  try {
    await api().updateMe({ hideProgress: e.target.checked });
  } catch {
    e.target.checked = !e.target.checked;
    showNotice(G.saveFail);
  }
});
$("profile-back").addEventListener("click", () => goBack({ name: "board" }));
$("profile-follow").addEventListener("click", toggleFollow);
// The toast floats over the screen: it lives on <body>, not inside the glass card
// (a backdrop-filter would pin position:fixed to the card instead of the screen).
document.body.appendChild($("notice"));
$("notice").addEventListener("click", () => showNotice(""));
$("guest-signin").addEventListener("click", () => selectTab("me"));
$("my-profile").addEventListener("click", () => account && go({ name: "profile", arg: account.username }));
$("family-btn").addEventListener("click", () => go({ name: "family" }));
$("family-back").addEventListener("click", () => goBack({ name: "me" }));
$("member-back").addEventListener("click", () => goBack({ name: "family" }));
$("delete-account").addEventListener("click", deleteAccount);
$("verify-send").addEventListener("click", sendVerifyCode);
$("verify").addEventListener("submit", submitVerify);
$("mic").addEventListener("click", () => (listening ? stopListening() : startListening()));
$("back").addEventListener("click", () => goBack({ name: "tasks" }));
$("chunk-prev").addEventListener("click", () => stepChunk(-1));
$("chunk-next").addEventListener("click", () => stepChunk(1));
$("font-down").addEventListener("click", () => changeFont(-1));
$("font-up").addEventListener("click", () => changeFont(1));
$("gift").addEventListener("click", () => go({ name: "gift" }));
$("resume").addEventListener("click", () => go({ name: "read", arg: $("resume").dataset.id }));
$("celebrate-ok").addEventListener("click", closeCelebration);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("celebrate").hidden) closeCelebration();
});
// Back to prayer times (the home screen): step back if we came from there,
// so the history stays short; otherwise open it.
$("tools").addEventListener("click", () => {
  // Desktop: the game has its own window, so bring up the prayer-times popup.
  if (Platform.game && Platform.game.showPrayerTimes) return Platform.game.showPrayerTimes();
  if (/\/popup\.html$/.test(new URL(document.referrer || "x:", location.href).pathname) && history.length > 1) {
    history.go(-(depth() + 1));
  } else {
    location.replace("popup.html");
  }
});

(async function init() {
  await load();
  setAuthMode("in");
  if (!location_) {
    $("window-title").textContent = G.pageTitle;
    showNotice(G.needLocation);
    return;
  }
  refreshWindow();
  render(parseRoute(location.hash)); // reopen the screen we were on (reload / back from Tools)
  gameClock = createPageClock(tick, { runWhenHidden: () => !!(reading && listening) });
  syncNow();
  checkIntegrity(false);
  resumeApple();
})();
