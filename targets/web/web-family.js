// web-family.js — a parent's "the children didn't finish" alerts while the
// prayer-times or game page is open in a tab (a website can't wake up on its
// own). Loaded by adapter.js after the shared family-alerts.js; plans the same
// checks as the apps and shows a browser notification when one has news.

(function () {
  let timers = [];

  async function fire(check) {
    const s = await Platform.store.get(["gameAccount", "gameApiUrl", "lang"]);
    if (!s.gameAccount || !s.gameAccount.token) return;
    const apiUrl = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) ? s.gameApiUrl : undefined;
    const msg = await familyAlertFor(apiUrl, s.gameAccount.token, s.lang || "en", check);
    if (!msg || !("Notification" in window) || Notification.permission !== "granted") return;
    try {
      const n = new Notification(msg.title, { body: msg.body, icon: "icons/icon128.png", tag: check.id });
      n.onclick = () => {
        window.focus();
        if (!/\/game\.html$/.test(location.pathname)) location.href = "game.html#family";
        else location.hash = "#family";
        n.close();
      };
    } catch {
      /* some browsers only notify from a service worker */
    }
  }

  async function plan() {
    timers.forEach(clearTimeout);
    timers = [];
    const s = await Platform.store.get(["location", "familyAlerts"]);
    const fa = s.familyAlerts;
    if (!fa || fa.role !== "parent" || !s.location || s.location.latitude == null) return;
    let checks;
    try {
      checks = planFamilyChecks(PrayerEngine, s.location, new Date(), fa.mode);
    } catch {
      return;
    }
    for (const c of checks) {
      const delay = c.when - Date.now();
      // setTimeout can't wait longer than ~24.8 days; checks are at most 2 days out.
      if (delay > 0) timers.push(setTimeout(() => fire(c), delay));
    }
    // Re-plan daily (new days' prayer times).
    timers.push(setTimeout(plan, 12 * 3600 * 1000));
  }

  Platform.store.onChange((changes) => {
    if (changes.location || changes.familyAlerts) plan();
  });
  plan();
})();
