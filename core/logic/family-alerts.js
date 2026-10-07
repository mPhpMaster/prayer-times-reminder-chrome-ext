// family-alerts.js — a parent's alerts when a child leaves a prayer's adhkar
// tasks unfinished. Shared by every shell (extension service worker, desktop
// scheduler, website tab, Android — whose native side only fills in the
// templates made here). Needs i18n.js (I18N, prayerLabel, prayerTimestamp).
//
// The server doesn't know when a prayer window closes (that's the phone's
// prayer times), so the parent's own device plans a check for each window's
// close — the next prayer's start, plus a few minutes for the child's phone
// to sync — and asks GET /v1/family/status?keys=… only then.
//
//   mode "window" — after each prayer: "Ahmad, Sara: the Asr tasks aren't done"
//   mode "daily"  — at the next Fajr, one summary of the day that just ended
//   mode "off"    — nothing
//
// Store key "familyAlerts" = { mode, role } is cached by the game page
// whenever it loads the family, so background code knows whether to plan.

const FAMILY_ALERT_PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
const FAMILY_ALERT_DELAY_MIN = 5;
const FAMILY_ALERT_DAYS = 2;
const FAMILY_ALERT_PREFIX = "family:";
// Same server as GAME_API_DEFAULT (game-sync.js), which background code doesn't load.
const FAMILY_API_DEFAULT = "https://prayer-times.sarhsoft.com";

function familyDayKey(date) {
  const p2 = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p2(date.getMonth() + 1)}-${p2(date.getDate())}`;
}

// A check back from its id (alarm name): "family:window:2026-10-08:Asr" / "family:daily:2026-10-08".
function parseFamilyCheck(id) {
  const [kind, day, prayer] = String(id).slice(FAMILY_ALERT_PREFIX.length).split(":");
  if (kind === "window") return { id, kind, day, prayer, keys: [`${day}:${prayer}`] };
  return { id, kind, day, keys: FAMILY_ALERT_PRAYERS.map((p) => `${day}:${p}`) };
}

// The checks still ahead: [{ id, when, kind, keys, prayer?, day }], soonest
// first. Yesterday is included so the night window (Isha → Fajr) and the
// daily summary of yesterday are kept when re-planning after midnight.
function planFamilyChecks(engine, location, now, mode, days = FAMILY_ALERT_DAYS) {
  if (mode !== "window" && mode !== "daily") return [];
  const nowMs = now.getTime();
  const MIN = 60000;
  const times = (date) => {
    const data = engine.timings(location, date);
    const tz = data.meta && data.meta.timezone;
    const t = {};
    for (const p of FAMILY_ALERT_PRAYERS) t[p] = prayerTimestamp(data.timings[p], date, tz);
    return t;
  };
  const out = [];
  let next = null;
  for (let d = -1; d < days; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() + d);
    const after = new Date(date);
    after.setDate(after.getDate() + 1);
    const t = times(date);
    next = times(after);
    const day = familyDayKey(date);
    if (mode === "window") {
      FAMILY_ALERT_PRAYERS.forEach((p, i) => {
        const closes = i + 1 < FAMILY_ALERT_PRAYERS.length ? t[FAMILY_ALERT_PRAYERS[i + 1]] : next.Fajr;
        if (closes == null) return;
        const when = closes + FAMILY_ALERT_DELAY_MIN * MIN;
        if (when > nowMs) out.push({ id: `${FAMILY_ALERT_PREFIX}window:${day}:${p}`, when, kind: "window", keys: [`${day}:${p}`], prayer: p, day });
      });
    } else if (next.Fajr != null) {
      const when = next.Fajr + FAMILY_ALERT_DELAY_MIN * MIN;
      if (when > nowMs) {
        out.push({ id: `${FAMILY_ALERT_PREFIX}daily:${day}`, when, kind: "daily", keys: FAMILY_ALERT_PRAYERS.map((p) => `${day}:${p}`), day });
      }
    }
  }
  return out.sort((a, b) => a.when - b.when);
}

// The words for one check, with {names} / {name} / {prayers} left to fill in
// once the server has answered. Android's native side fills these same
// templates (FamilyAlertScheduler.java), so the wording lives here only.
function familyAlertTemplates(lang, check) {
  const L = (typeof I18N !== "undefined" && (I18N[lang] || I18N.en)) || {};
  const day = check.day ? new Date(`${check.day}T12:00:00`) : new Date();
  const prayers = {};
  for (const p of FAMILY_ALERT_PRAYERS) prayers[p] = prayerLabel(L, p, day);
  const sep = lang === "ar" || lang === "ur" ? "، " : ", ";
  if (check.kind === "window") {
    return { kind: "window", title: L.familyWindowTitle(prayers[check.prayer], "{names}"), body: L.familyWindowBody, sep };
  }
  return {
    kind: "daily",
    title: L.familyDailyTitle,
    line: L.familyDailyLine("{name}", "{prayers}"),
    allDone: L.familyDailyAllDone,
    prayers,
    sep,
  };
}

// The notification for a check, from GET /v1/family/status — or null when
// there is nothing to say (every child finished; no children).
function fillFamilyAlert(tpl, check, status) {
  const children = (status && status.children) || [];
  if (!children.length) return null;
  if (tpl.kind === "window") {
    const key = check.keys[0];
    const late = children.filter((c) => c.windows && c.windows[key] && !c.windows[key].complete).map((c) => c.displayName || c.username);
    if (!late.length) return null;
    return { title: tpl.title.replace("{names}", late.join(tpl.sep)), body: tpl.body };
  }
  const lines = [];
  for (const c of children) {
    const missed = check.keys.filter((k) => c.windows && c.windows[k] && !c.windows[k].complete).map((k) => tpl.prayers[k.slice(11)] || k.slice(11));
    if (missed.length) lines.push(tpl.line.replace("{name}", c.displayName || c.username).replace("{prayers}", missed.join(tpl.sep)));
  }
  return { title: tpl.title, body: lines.length ? lines.join("\n") : tpl.allDone };
}

// Ask the server about one check and build its notification (null: nothing
// to show, offline, or not a parent anymore).
async function familyAlertFor(apiBase, token, lang, check) {
  apiBase = apiBase || FAMILY_API_DEFAULT;
  if (!token) return null;
  try {
    const res = await fetch(`${String(apiBase).replace(/\/+$/, "")}/v1/family/status?keys=${encodeURIComponent(check.keys.join(","))}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const status = await res.json();
    if (status.notify !== check.kind) return null; // the setting changed since this was planned
    return fillFamilyAlert(familyAlertTemplates(lang, check), check, status);
  } catch {
    return null;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { planFamilyChecks, parseFamilyCheck, familyAlertTemplates, fillFamilyAlert, familyAlertFor, FAMILY_ALERT_PREFIX };
}
