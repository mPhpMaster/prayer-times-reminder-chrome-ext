// Dependency-free unit tests for the game's pure logic (recitation-match.js,
// game-score.js, game-tasks.js), evaluated against the assembled build.
// Run: node tools/test/game.js  (npm test assembles first).

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..", "..", "targets", "extension", "build");
const ctx = { Math, String, Number, Array, Object, JSON, console };
vm.createContext(ctx);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx, { filename: f });
load("recitation-match.js");
load("game-score.js");
load("game-tasks.js");
vm.runInContext(
  "this.__m = { normalizeArabic, tokenize, matchRecitation, matchTask, wordSimilarity, chunkText };" +
    "this.__s = { taskWindow, pointsFactor, taskPoints, splitWindowPoints };" +
    "this.__tasks = SPIKE_TASKS;",
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

// ---- chunkText: short reading chunks ------------------------------------------
const ikhlasChunks = chunkText(ikhlas.text, 3);
eq("ikhlas chunks break at ayah marks",
  ikhlasChunks.map((c) => c.words.join(" ")),
  ["قُلْ هُوَ اللَّهُ", "أَحَدٌ ۝", "اللَّهُ الصَّمَدُ ۝", "لَمْ يَلِدْ وَلَمْ", "يُولَدْ ۝", "وَلَمْ يَكُنْ لَهُ", "كُفُوًا أَحَدٌ"]);
const allTokens = tokenize(ikhlas.text).length;
ok("chunks cover every token exactly once",
  ikhlasChunks[0].from === 0 && ikhlasChunks.at(-1).to === allTokens &&
  ikhlasChunks.every((c, i) => i === 0 || c.from === ikhlasChunks[i - 1].to));
ok("no chunk exceeds 3 spoken words", chunkText(task("ayat-al-kursi").text, 3).every((c) => c.to - c.from <= 3));
eq("comma ends a chunk", chunkText("سُبْحَانَ اللَّهِ، وَالْحَمْدُ لِلَّهِ", 3).map((c) => c.to - c.from), [2, 2]);
eq("single short dhikr is one chunk", chunkText(sw.text, 3).length, 1);

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
