// Dependency-free unit tests for the game's pure logic (recitation-match.js,
// game-score.js, game-windows.js, game-state.js, game-tasks.js), evaluated
// against the assembled build.
// Run: node tools/test/game.js  (npm test assembles first).

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..", "..", "targets", "extension", "build");
const ctx = { Math, String, Number, Array, Object, JSON, console, Date, Intl };
vm.createContext(ctx);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx, { filename: f });
load("i18n.js"); // prayerTimestamp
load("recitation-match.js");
load("game-score.js");
load("game-windows.js");
load("game-state.js");
load("game-tasks.js");
load("game-sync.js");
load("notify-plan.js");
vm.runInContext(
  "this.__m = { normalizeArabic, tokenize, matchRecitation, matchTask, wordSimilarity, chunkText };" +
    "this.__s = { taskWindow, pointsFactor, taskPoints, splitWindowPoints };" +
    "this.__tasks = SPIKE_TASKS;" +
    "this.__w = { currentWindow, GAME_PRAYERS };" +
    "this.__st = { emptyGameState, markTaskStarted, markTaskDone, markGiftDone, windowPoints, pointsWithPrefix, allTasksDone, pruneGameState, normalizeGameState };" +
    "this.__cat = { GAME_TASKS, WINDOW_TASKS, tasksForWindow, GIFTS, giftForWindow };" +
    "this.__sync = { pendingCompletions, markSynced };" +
    "this.__alerts = { planGameAlerts, GAME_ALERT_ID_BASE };",
  ctx
);
const { normalizeArabic, tokenize, matchRecitation, matchTask, chunkText } = ctx.__m;
const { taskWindow, taskPoints, splitWindowPoints } = ctx.__s;
const TASKS = ctx.__tasks;
const task = (id) => TASKS.find((t) => t.id === id);

let passed = 0;
const failures = [];
function eq(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) passed++;
  else failures.push(`${name} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}
function ok(name, cond) {
  if (cond) passed++;
  else failures.push(name);
}

// ---- normalizeArabic ----------------------------------------------------------
eq("strips harakat and shadda", normalizeArabic("سُبْحَانَ اللَّهِ"), "سبحان الله");
eq("unifies alef forms, ta marbuta, alef maqsura", normalizeArabic("أَإِآٱ رحمة على"), "اااا رحمه علي");
eq("drops pause marks and punctuation", normalizeArabic("أَحَدٌ ۝ اللَّهُ، الصَّمَدُ ۚ"), "احد الله الصمد");
eq("drops superscript alef", normalizeArabic("إِلَٰهَ"), "اله");
eq("tokenize empty", tokenize("  ،  "), []);

// ---- matchRecitation: exact and repeated ---------------------------------------
const sw = task("subhanallah-wabihamdih");
eq("one clean repetition", matchRecitation("سبحان الله وبحمده", sw.text).count, 1);
eq("three repetitions in one stream",
  matchRecitation("سبحان الله وبحمده سبحان الله وبحمده سبحان الله وبحمده", sw.text).count, 3);
eq("partial repetition not counted", matchRecitation("سبحان الله", sw.text).count, 0);
ok("partial repetition reports progress", matchRecitation("سبحان الله", sw.text).progress > 0.5);
eq("recognizer spelling drift still matches",
  matchRecitation("سبحان اللة وبحمدة", sw.text).count, 1);
// Real model output (tarteel whisper on synthetic speech): article swallowed,
// vocalized, alef dropped.
eq("whisper output: swallowed article still matches",
  matchRecitation("سُبْحَنَ لَهِ وَبِحَمْدِي", sw.text).count, 1);
eq("article rule does not make لا match الا", matchRecitation("لا", "الا").count, 0);
eq("unrelated speech counts nothing", matchRecitation("السلام عليكم كيف الحال", sw.text).count, 0);

// Recognizer drops the last word of a repetition, then the next one starts.
eq("dropped tail word, next repetition still counts",
  matchRecitation("سبحان الله سبحان الله وبحمده", sw.text).count, 1);

// ---- matchTask: clamps to repeat and flags done --------------------------------
const ikhlas = task("al-ikhlas");
const ikhlasOnce = "قل هو الله احد الله الصمد لم يلد ولم يولد ولم يكن له كفوا احد";
eq("ikhlas x3 done", matchTask([ikhlasOnce, ikhlasOnce, ikhlasOnce].join(" "), ikhlas).done, true);
eq("ikhlas x4 clamps to 3", matchTask([ikhlasOnce, ikhlasOnce, ikhlasOnce, ikhlasOnce].join(" "), ikhlas).count, 3);
eq("ikhlas x2 not done", matchTask([ikhlasOnce, ikhlasOnce].join(" "), ikhlas).done, false);

// ---- long text: ayat al-kursi with typical recognizer output --------------------
// Recognizer-style: imla'i spelling, one misheard word (يؤده), one dropped word.
const kursiHeard =
  "الله لا اله الا هو الحي القيوم لا تاخذه سنة ولا نوم له ما في السماوات وما في الارض " +
  "من ذا الذي يشفع عنده الا باذنه يعلم ما بين ايديهم وما خلفهم ولا يحيطون بشيء من علمه " +
  "الا بما شاء وسع كرسيه السماوات والارض ولا يؤده حفظهما وهو العلي العظيم";
eq("ayat al-kursi recognized", matchTask(kursiHeard, task("ayat-al-kursi")).done, true);
const kursiHalf = kursiHeard.split(" ").slice(0, 20).join(" ");
const half = matchTask(kursiHalf, task("ayat-al-kursi"));
ok("ayat al-kursi half: not done, progress ~0.4", !half.done && half.progress > 0.3 && half.progress < 0.6);
ok("ayat al-kursi half: highlights the first words", half.matched[0] && half.matched[5] && !half.matched[40]);

// Skipping a whole middle clause must not count as a recitation.
const kursiSkipped = kursiHeard.replace("من ذا الذي يشفع عنده الا باذنه يعلم ما بين ايديهم وما خلفهم ", "");
eq("skipping a clause is not a recitation", matchTask(kursiSkipped, task("ayat-al-kursi")).done, false);

// final flag: last word dropped by the recognizer as the speaker stops.
const tahlil = task("tahlil");
const tahlilNoEnd = "لا اله الا الله وحده لا شريك له له الملك وله الحمد وهو على كل شيء";
eq("tail dropped, not final: pending", matchRecitation(tahlilNoEnd, tahlil.text).count, 0);
eq("tail dropped, final: counted", matchRecitation(tahlilNoEnd, tahlil.text, { final: true }).count, 1);

// ---- chunkText: meaningful reading segments ------------------------------------
const seg = (id) => chunkText(task(id).text).map((c) => c.words.join(" "));
eq("ikhlas: one segment per ayah", seg("al-ikhlas"),
  ["قُلْ هُوَ اللَّهُ أَحَدٌ ۝", "اللَّهُ الصَّمَدُ ۝", "لَمْ يَلِدْ وَلَمْ يُولَدْ ۝", "وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ"]);
eq("tahlil: split at its natural pauses", seg("tahlil"),
  ["لَا إِلَٰهَ إِلَّا اللَّهُ،", "وَحْدَهُ لَا شَرِيكَ لَهُ،", "لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ،", "وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ"]);
eq("ayat al-kursi: split at waqf marks", seg("ayat-al-kursi").length, 9);
eq("ayat al-kursi: first segment", seg("ayat-al-kursi")[0], "اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ");
const ikhlasChunks = chunkText(ikhlas.text);
const allTokens = tokenize(ikhlas.text).length;
ok("segments cover every token exactly once",
  ikhlasChunks[0].from === 0 && ikhlasChunks.at(-1).to === allTokens &&
  ikhlasChunks.every((c, i) => i === 0 || c.from === ikhlasChunks[i - 1].to));
eq("maxWords caps a run with no clause mark", chunkText("ا ب ت ث ج ح خ", 3).map((c) => c.to - c.from), [3, 3, 1]);
eq("single short dhikr is one segment", chunkText(sw.text).length, 1);

// ---- game-score --------------------------------------------------------------
const M = 60 * 1000;
const dhuhr = 12 * 60 * M;
const asr = dhuhr + 3 * 60 * M + 30 * M; // 3h30 window
const win = taskWindow(dhuhr, asr);
eq("before tasks open: 0", taskPoints(300, win, dhuhr + 10 * M), 0);
eq("first 30 min: full", taskPoints(300, win, dhuhr + 45 * M), 300);
eq("30 min before next prayer: floor 50", taskPoints(300, win, asr - 30 * M), 50);
eq("last 30 min stays at floor", taskPoints(300, win, asr - 5 * M), 50);
eq("after next prayer: lost", taskPoints(300, win, asr), 0);
const mid = taskPoints(300, win, (win.fullUntil + win.floorAt) / 2);
eq("halfway through the decay: 175", mid, 175);

// Short window (Maghrib -> Isha 75 min): no decay room.
const maghrib = 18 * 60 * M;
const shortWin = taskWindow(maghrib, maghrib + 75 * M);
eq("short window full at open", taskPoints(300, shortWin, maghrib + 30 * M), 300);
eq("short window floor after full period", taskPoints(300, shortWin, maghrib + 65 * M), 50);

eq("split 300 equally over 4", splitWindowPoints([{}, {}, {}, {}]), [75, 75, 75, 75]);
eq("split remainder lands on last", splitWindowPoints([{}, {}, {}], 100), [33, 33, 34]);
eq("split by weight", splitWindowPoints([{ weight: 1 }, { weight: 2 }], 300), [100, 200]);

// ---- game-windows: which window is "now" -----------------------------------------
const { currentWindow } = ctx.__w;
// Stub engine: same times every day, device-local (no tz).
const stubEngine = {
  timings: () => ({ timings: { Fajr: "04:30", Sunrise: "05:50", Dhuhr: "11:45", Asr: "15:10", Maghrib: "17:50", Isha: "19:10" }, meta: {} }),
};
const at = (d, hh, mm) => new Date(2026, 8, d, hh, mm);
const w1 = currentWindow(stubEngine, {}, at(25, 13, 0));
eq("13:00 is in Dhuhr window", [w1.prayer, w1.key], ["Dhuhr", "2026-09-25:Dhuhr"]);
eq("Dhuhr window ends at Asr", w1.nextPrayerAt, at(25, 15, 10).getTime());
eq("tasks open 30 min after Dhuhr", w1.win.opensAt, at(25, 12, 15).getTime());
const w2 = currentWindow(stubEngine, {}, at(25, 22, 0));
eq("22:00 is Isha, closing at tomorrow's Fajr", [w2.prayer, w2.nextPrayerAt], ["Isha", at(26, 4, 30).getTime()]);
const w3 = currentWindow(stubEngine, {}, at(26, 2, 0));
eq("02:00 is still yesterday's Isha window", [w3.prayer, w3.key], ["Isha", "2026-09-25:Isha"]);
eq("04:30 exactly starts Fajr", currentWindow(stubEngine, {}, at(26, 4, 30)).key, "2026-09-26:Fajr");

// ---- notify-plan: game alerts ---------------------------------------------------------
const { planGameAlerts, GAME_ALERT_ID_BASE } = ctx.__alerts;
const alerts = planGameAlerts(stubEngine, {}, at(25, 13, 0), 1, ctx.__w.GAME_PRAYERS);
const fmt = (ms) => { const d = new Date(ms); return `${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
eq("alerts after 13:00: past ones dropped, Isha closes before next Fajr",
  alerts.map((a) => `${a.key} ${a.kind} ${fmt(a.when)}`),
  [
    "2026-09-25:Dhuhr closing 25 14:40",
    "2026-09-25:Asr open 25 15:40",
    "2026-09-25:Asr closing 25 17:20",
    "2026-09-25:Maghrib open 25 18:20",
    "2026-09-25:Maghrib closing 25 18:40",
    "2026-09-25:Isha open 25 19:40",
    "2026-09-25:Isha closing 26 04:00",
  ]);
const week = planGameAlerts(stubEngine, {}, at(25, 0, 0), 7, ctx.__w.GAME_PRAYERS);
ok("alert ids unique and inside [10M, 20M)",
  new Set(week.map((a) => a.id)).size === week.length && week.every((a) => a.id >= GAME_ALERT_ID_BASE && a.id < 20000000));
eq("a week has 2 alerts per window, plus last night's closing", week.length, 7 * 5 * 2 + 1);
const yesterdayPlan = planGameAlerts(stubEngine, {}, at(24, 22, 0), 1, ctx.__w.GAME_PRAYERS);
eq("re-planning after midnight reuses yesterday's id for that alert",
  week[0].id, yesterdayPlan.find((a) => a.key === "2026-09-24:Isha" && a.kind === "closing").id);
eq("after midnight, last night's Isha still gets its closing alert",
  `${week[0].key} ${week[0].kind} ${fmt(week[0].when)}`, "2026-09-24:Isha closing 25 04:00");

// ---- game-state ---------------------------------------------------------------------
const S = ctx.__st;
const st = S.emptyGameState();
S.markTaskStarted(st, "2026-09-25:Dhuhr", "tasbih-33", 100);
S.markTaskStarted(st, "2026-09-25:Dhuhr", "tasbih-33", 999);
eq("restart keeps the first start time", st.windows["2026-09-25:Dhuhr"].tasks["tasbih-33"].startedAt, 100);
S.markTaskDone(st, "2026-09-25:Dhuhr", "tasbih-33", 40, 200);
S.markTaskDone(st, "2026-09-25:Dhuhr", "tasbih-33", 5, 300);
eq("done points are banked once", st.windows["2026-09-25:Dhuhr"].tasks["tasbih-33"].points, 40);
S.markTaskStarted(st, "2026-09-25:Dhuhr", "tahmid-33", 150);
eq("started-but-unfinished earns nothing", S.windowPoints(st.windows["2026-09-25:Dhuhr"]), 40);
S.markGiftDone(st, "2026-09-25:Dhuhr", "afuwwun", 100, 400);
S.markTaskDone(st, "2026-09-24:Isha", "tasbih-33", 30, 1);
S.markTaskDone(st, "2026-08-31:Isha", "tasbih-33", 7, 1);
eq("day total", S.pointsWithPrefix(st, "2026-09-25"), 140);
eq("month total", S.pointsWithPrefix(st, "2026-09"), 170);
ok("allTasksDone false while one is open", !S.allTasksDone(st.windows["2026-09-25:Dhuhr"], ["tasbih-33", "tahmid-33"]));
S.pruneGameState(st, at(25, 12, 0).getTime() + 62 * 86400000);
ok("prune drops windows older than 62 days", !st.windows["2026-08-31:Isha"] && !!st.windows["2026-09-25:Dhuhr"]);
eq("garbage state normalizes to empty", S.normalizeGameState({ foo: 1 }).windows, {});

// ---- game-sync: offline-first queue ---------------------------------------------------
const Y = ctx.__sync;
const st2 = S.emptyGameState();
S.markTaskDone(st2, "2026-09-25:Asr", "tasbih-33", 27, 10);
S.markTaskStarted(st2, "2026-09-25:Asr", "tahmid-33", 11); // not finished: not sent
S.markGiftDone(st2, "2026-09-25:Asr", "afuwwun", 100, 12);
const pend = Y.pendingCompletions(st2);
eq("pending: finished task + gift only", pend.map((r) => [r.itemId, r.kind, r.points]), [["tasbih-33", "task", 27], ["afuwwun", "gift", 100]]);
Y.markSynced(st2, pend);
eq("after ack nothing is pending", Y.pendingCompletions(st2), []);
S.markTaskDone(st2, "2026-09-25:Asr", "tahmid-33", 20, 13);
eq("a newly finished task is pending again", Y.pendingCompletions(st2).map((r) => r.itemId), ["tahmid-33"]);

// ---- catalog ----------------------------------------------------------------------
const C = ctx.__cat;
ok("every window has tasks that exist", ctx.__w.GAME_PRAYERS.every((p) => C.WINDOW_TASKS[p].length && C.WINDOW_TASKS[p].every((id) => C.GAME_TASKS[id])));
ok("every game task has title, text, source, pending review",
  Object.values(C.GAME_TASKS).every((t) => t.id && t.title && tokenize(t.text).length && t.source && t.review === "pending"));
eq("mu'awwidhat x3 in the Fajr window", C.tasksForWindow("Fajr").find((t) => t.id === "al-falaq").repeat, 3);
eq("mu'awwidhat x1 in the Dhuhr window", C.tasksForWindow("Dhuhr").find((t) => t.id === "al-falaq").repeat, 1);
eq("same window -> same gift", C.giftForWindow("2026-09-25:Dhuhr").id, C.giftForWindow("2026-09-25:Dhuhr").id);
ok("gifts tokenize", C.GIFTS.every((g) => tokenize(g.text).length > 0));
eq("falaq: one segment per ayah", chunkText(C.GAME_TASKS["al-falaq"].text).length, 5);

// ---- catalog hygiene ---------------------------------------------------------
ok("every task has id, text, source, review", TASKS.every((t) => t.id && t.text && t.source && t.review));
ok("task ids unique", new Set(TASKS.map((t) => t.id)).size === TASKS.length);
ok("every task tokenizes", TASKS.every((t) => tokenize(t.text).length > 0));

if (failures.length) {
  console.error(`game: ${failures.length} FAILED, ${passed} passed`);
  failures.forEach((f) => console.error("  ✗ " + f));
  process.exit(1);
}
console.log(`game: all ${passed} passed`);
