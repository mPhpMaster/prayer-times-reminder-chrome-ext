// ---- Rendering --------------------------------------------------------------

function isMidnightEmeraldTheme() {
  return normalizeTheme(uiTheme) === DEFAULT_THEME;
}

function applyTheme(nextTheme) {
  uiTheme = normalizeTheme(nextTheme);
  document.documentElement.dataset.theme = uiTheme;
  el.themeClassic.checked = uiTheme === "classic";
  el.themeMidnight.checked = uiTheme === "midnight-emerald";
  if (currentTimings) startCountdown(currentTimings);
}

function findNextPrayer(timings) {
  const now = Date.now();
  for (const key of PRAYER_KEYS) {
    const t = prayerInstant(timings[key]);
    if (t && t > now) return { key, time: t };
  }
  return null;
}

function findPreviousPrayer(timings) {
  const now = Date.now();
  let prev = null;
  for (const row of ROWS) {
    const t = prayerInstant(timings[row.key]);
    if (t && t <= now) prev = { key: row.key, time: t };
  }
  return prev;
}

function prayerProgress(timings, next) {
  if (!next) return 0;
  const now = Date.now();
  const prev = findPreviousPrayer(timings);
  const start = prev ? prev.time : new Date().setHours(0, 0, 0, 0);
  const end = next.time;
  if (end <= start) return 0;
  return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
}

// Duha (forenoon) prayer isn't returned by the Aladhan API. Its time begins
// once the sun has risen a spear's length above the horizon — conventionally a
// short while after sunrise — so we derive it as Sunrise + this many minutes.
const DUHA_AFTER_SUNRISE_MINUTES = 20;

// Returns a copy of the timings with a computed Duha entry (Sunrise + offset).
// Idempotent and non-mutating, so it's safe to call on every render.
function withDuha(timings) {
  if (!timings || !timings.Sunrise || timings.Duha) return timings;
  const t = parseTimeToDate(timings.Sunrise);
  if (!t) return timings;
  t.setMinutes(t.getMinutes() + DUHA_AFTER_SUNRISE_MINUTES);
  return { ...timings, Duha: `${pad(t.getHours())}:${pad(t.getMinutes())}` };
}

function renderTimings(timings) {
  timings = withDuha(timings);
  currentTimings = timings;
  el.timings.innerHTML = "";
  const now = new Date();
  const next = findNextPrayer(timings);

  for (const row of ROWS) {
    const raw = timings[row.key];
    if (!raw) continue;
    const t = prayerInstant(raw);

    const li = document.createElement("li");
    li.classList.add("glass-card");
    if (row.sunrise) li.classList.add("sunrise");
    if (row.duha) li.classList.add("duha");
    if (next && next.key === row.key) li.classList.add("is-next");
    else if (t && t < now.getTime()) li.classList.add("is-past");

    const name = prayerLabel(T(), row.key);
    const nameEl = document.createElement("span");
    nameEl.className = "prayer-name";
    const iconEl = document.createElement("span");
    iconEl.className = "icon";
    iconEl.textContent = row.icon;
    nameEl.append(iconEl, name);
    const timeEl = document.createElement("span");
    timeEl.className = "prayer-time";
    timeEl.textContent = fmtTime(raw);
    li.append(nameEl, timeEl);
    el.timings.appendChild(li);
  }

  el.statusHint.hidden = true;
  startCountdown(timings);
}

function startCountdown(timings) {
  if (countdownTimer) countdownTimer.stop();

  function tick() {
    const next = findNextPrayer(timings);
    if (!next) {
      ViewUpdates.text(el.nextName, T().fajrTomorrow);
      ViewUpdates.hidden(el.countdownBlocks, true);
      ViewUpdates.hidden(el.progressTrack, true);
      ViewUpdates.hidden(el.nextCountdown, false);
      el.nextCountdown.classList.toggle("force-show", true);
      ViewUpdates.text(el.nextCountdown, T().allDone);
      ViewUpdates.hidden(el.nextPrayer, false);
      return;
    }
    const diff = next.time - Date.now();
    const h = Math.floor(diff / 3.6e6);
    const m = Math.floor((diff % 3.6e6) / 6e4);
    const s = Math.floor((diff % 6e4) / 1000);
    ViewUpdates.text(el.nextName, prayerLabel(T(), next.key));
    if (isMidnightEmeraldTheme()) {
      ViewUpdates.text(el.countdownHours, localizeNum(pad(h)));
      ViewUpdates.text(el.countdownMin, localizeNum(pad(m)));
      ViewUpdates.text(el.countdownSec, localizeNum(pad(s)));
      ViewUpdates.hidden(el.countdownBlocks, false);
      ViewUpdates.hidden(el.progressTrack, false);
      ViewUpdates.hidden(el.nextCountdown, true);
      el.nextCountdown.classList.toggle("force-show", false);
      ViewUpdates.style(el.nextProgress, "width", `${prayerProgress(timings, next).toFixed(1)}%`);
    } else {
      ViewUpdates.hidden(el.countdownBlocks, true);
      ViewUpdates.hidden(el.progressTrack, true);
      ViewUpdates.hidden(el.nextCountdown, false);
      el.nextCountdown.classList.toggle("force-show", true);
      ViewUpdates.text(el.nextCountdown, localizeNum(T().countdown(h, m, s)));
    }
    ViewUpdates.hidden(el.nextPrayer, false);
    if (diff <= 0) renderTimings(timings);
  }

  countdownTimer = createPageClock(tick, { enabled: () => el.settingsView.hidden });
}

function labelFor(location) {
  if (!location) return T().noLocation;
  if (location.mode === "coords") {
    return localizeNum(`${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)}`);
  }
  return `${cityLabel(location.city, location.country)}, ${countryLabel(location.country)}`;
}

// The localized name of the current weekday (e.g. الجمعة / Friday / Freitag),
// tied to the displayed date when available and today otherwise.
function weekdayName() {
  const parts = gregorianParts(currentDate && currentDate.gregorian);
  const d = parts ? new Date(parts.yy, parts.mm - 1, parts.dd) : new Date();
  const locale = T().locale || (lang === "ar" ? "ar" : "en");
  return weekdayLabel(lang, locale, d);
}

// Renders the Hijri line (with weekday) and the Gregorian line, both in the
// header, in the active language.
function renderDates() {
  el.weekdayLine.textContent = weekdayName();

  const h = currentDate && currentDate.hijri;
  const hijri = h ? localizeNum(formatHijriDate(h, dateFormat)) : "";
  // Add a Hijri era marker (هـ / AH) unless the "readable" format already has one.
  const era = (dateFormat !== "readable" && T().ahLabel) ? ` ${T().ahLabel}` : "";
  el.hijriDate.textContent = hijri ? `${hijri}${era}` : "";

  const g = currentDate && currentDate.gregorian;
  const parts = gregorianParts(g);
  if (parts) {
    const formatted = formatGregorianDate(parts, dateFormat);
    const text = formatted ?? currentDate.readable ?? g.date;
    el.gregorianDate.textContent = localizeNum(text);
  } else if (currentDate) {
    el.gregorianDate.textContent = localizeNum(currentDate.readable || (g && g.date) || "");
  } else {
    el.gregorianDate.textContent = "";
  }
}
