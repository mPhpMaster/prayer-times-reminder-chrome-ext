// ---- prayer times are home; sign-in is only for the optional game --------------------
const REPO = path.resolve(__dirname, "..", "..");
const mobileIndex = fs.readFileSync(path.join(REPO, "targets", "mobile", "web", "index.html"), "utf8");
ok("Android opens on prayer times (popup.html), not the game", /location\.replace\("popup\.html" \+ location\.hash\)/.test(mobileIndex) && !/"game\.html"/.test(mobileIndex));
const adapterSrc = fs.readFileSync(path.join(REPO, "targets", "mobile", "web", "adapter.js"), "utf8");
ok("Android back: the game's parent is prayer times", /PARENT_PAGE = \{ "game\.html": "popup\.html"/.test(adapterSrc));
ok("prayer times has no parent page (back there leaves the app)", !/"popup\.html": "/.test(adapterSrc));
ok("no 'Google not enabled' placeholder in the game page", !/google-off|googleOff/.test(html));
ok("no 'Google not enabled' string in any language", Object.values(I.GAME_I18N).every((d) => !("googleOff" in d)));
const popupSrc = pageSource(ROOT, "popup.html", "popup");
ok("prayer times never asks for a game account", !/gameAccount|GAME_ACCOUNT_KEY|signIn|\/v1\/auth/.test(popupSrc));

// ---- candidate content catalog: review pending, never published -------------------------
// content/game-catalog.json lists adhkar awaiting shar'i review. It must stay out
// of every build and out of the live game until an item is approved and moved
// into core/data/game-tasks.js by hand.
const catalog = JSON.parse(fs.readFileSync(path.join(REPO, "content", "game-catalog.json"), "utf8"));
const citems = catalog.items;
// (2026-10-15: the morning / evening adhkar moved into the game — the strict
// set and the optional disputed section — so fewer candidates are left.)
ok("catalog has items", citems.length >= 5);
eq("catalog: every item review pending", citems.filter((i) => i.review !== "pending").map((i) => i.id), []);
eq("catalog: nothing marked published", citems.filter((i) => i.published !== false).map((i) => i.id), []);
eq("catalog: ids unique and well-formed", citems.map((i) => i.id).filter((id, n, all) => !/^[a-z0-9-]{1,64}$/.test(id) || all.indexOf(id) !== n), []);
const liveIds = new Set([...Object.keys(C.GAME_TASKS), ...C.GIFTS.map((g) => g.id)]);
eq("catalog: no item is in the live game", citems.filter((i) => liveIds.has(i.id)).map((i) => i.id), []);
eq(
  "catalog: Quran is never typed by hand (reference only)",
  citems.filter((i) => i.quran && i.text !== null).map((i) => i.id),
  []
);
eq(
  "catalog: texts are Arabic only",
  citems.filter((i) => i.text !== null && (/[A-Za-z]/.test(i.text) || !/[؀-ۿ]/.test(i.text))).map((i) => i.id),
  []
);
eq("catalog: repeat is a positive count", citems.filter((i) => !(Number.isInteger(i.repeat) && i.repeat > 0)).map((i) => i.id), []);
eq("catalog: every item names a source", citems.filter((i) => !i.source).map((i) => i.id), []);
ok("catalog is not in the extension build", !fs.existsSync(path.join(ROOT, "game-catalog.json")));
ok("sync-core never copies content/", !/["'`/]content["'`/]/.test(fs.readFileSync(path.join(REPO, "tools", "sync-core.mjs"), "utf8")));

// ---- server stats mirror the app's catalog ------------------------------------------
// GameStats.php decides "window completed" from the task count per prayer and
// names achievements by id; both must match what the app ships.
const statsSrc = fs.readFileSync(path.join(REPO, "backend", "app", "Support", "GameStats.php"), "utf8");
const serverCounts = Object.fromEntries(
  [...statsSrc.match(/WINDOW_TASK_COUNT = \[([^\]]+)\]/)[1].matchAll(/'(\w+)' => (\d+)/g)].map((m) => [m[1], Number(m[2])])
);
eq(
  "server task count per window = app catalog",
  serverCounts,
  Object.fromEntries(Object.entries(C.WINDOW_TASKS).map(([p, ids]) => [p, ids.length]))
);
const serverAch = [...statsSrc.match(/ACHIEVEMENTS = \[([^\]]+)\]/)[1].matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]);
ok("server lists achievements", serverAch.length >= 5);
for (const l of I.SUPPORTED_LANGS) {
  const d = I.GAME_I18N[l.code];
  if (d) eq(`${l.code}: a name and a line for every achievement`, serverAch.filter((id) => !(d.ach && d.ach[id] && d.ach[id].length === 2)), []);
}

// ---- side tasks: the morning and evening adhkar ------------------------------------
{
  const SD = ctx.__side;
  // When: morning from Fajr until Maghrib, evening from Maghrib until the next
  // Fajr, keyed by the day of its Maghrib (stub: Fajr 04:30, Maghrib 17:50).
  const sw = (d, hh, mm) => SD.sideWindow(stubEngine, {}, at(d, hh, mm));
  const noon = sw(25, 13, 0);
  eq("13:00 is the morning adhkar", [noon.kind, noon.key], ["Morning", "2026-09-25:Morning"]);
  eq("morning runs from Fajr to Maghrib", [noon.startsAt, noon.endsAt], [at(25, 4, 30).getTime(), at(25, 17, 50).getTime()]);
  eq("04:30 exactly starts the morning", sw(26, 4, 30).key, "2026-09-26:Morning");
  eq("a minute before Maghrib is still morning", sw(25, 17, 49).key, "2026-09-25:Morning");
  const eve = sw(25, 17, 50);
  eq("Maghrib starts the evening", [eve.kind, eve.key], ["Evening", "2026-09-25:Evening"]);
  eq("evening ends at the next Fajr", eve.endsAt, at(26, 4, 30).getTime());
  eq("02:00 is still yesterday's evening", sw(26, 2, 0).key, "2026-09-25:Evening");
  eq("evening after midnight keeps its Maghrib and Fajr", [sw(26, 2, 0).startsAt, sw(26, 2, 0).endsAt], [at(25, 17, 50).getTime(), at(26, 4, 30).getTime()]);
  eq("side kinds", SD.SIDE_KINDS, ["Morning", "Evening"]);
  ok("side keys never look like a prayer window", !ctx.__w.GAME_PRAYERS.includes("Morning") && !ctx.__w.GAME_PRAYERS.includes("Evening"));

  // Points: a fixed bonus while open, nothing outside.
  eq("side points: open from its start", SD.sidePoints(7, noon.win, noon.startsAt), 7);
  eq("side points: no decay late in the window", SD.sidePoints(7, noon.win, noon.endsAt - 1000), 7);
  eq("side points: none once it closes", SD.sidePoints(7, noon.win, noon.endsAt), 0);
  eq("side points: none before it opens", SD.sidePoints(7, noon.win, noon.startsAt - 1), 0);

  // Catalog.
  const all = { ...C.GAME_TASKS, ...SD.SIDE_ADHKAR };
  for (const kind of SD.SIDE_KINDS) {
    const ts = SD.tasksForSide(kind);
    const pts = splitWindowPoints(ts, SD.SIDE_POINTS);
    ok(`${kind}: every side task exists`, SD.SIDE_TASKS[kind].every((id) => all[id]));
    ok(`${kind}: no task listed twice`, new Set(ts.map((t) => t.id)).size === ts.length);
    eq(`${kind}: the set is worth SIDE_POINTS`, pts.reduce((a, b) => a + b, 0), SD.SIDE_POINTS);
    ok(`${kind}: every side task earns something`, pts.every((x) => x >= 1));
    ok(`${kind}: weight = words x repeat`, ts.every((t) => t.weight === tokenize(t.text).length * t.repeat));
    eq(`${kind}: mu'awwidhat x3`, ["al-ikhlas", "al-falaq", "an-nas"].map((id) => ts.find((t) => t.id === id).repeat), [3, 3, 3]);
    eq(`${kind}: ayat al-Kursi is the reviewed catalog entry`, ts.find((t) => t.id === "ayat-al-kursi").text, C.GAME_TASKS["ayat-al-kursi"].text);
    ok(`${kind}: sayyid al-istighfar is the reviewed entry`, ts.find((t) => t.id === "sayyid-al-istighfar").review === "reviewed");
    eq(`${kind}: subhan Allah wa bihamdih x100`, ts.find((t) => t.id === "subhanallah-wabihamdih-100").repeat, 100);
  }
  const morning = SD.SIDE_TASKS.Morning;
  const evening = SD.SIDE_TASKS.Evening;
  ok("morning only: «عدد خلقه» and «أصبحنا»", morning.includes("subhanallah-adada-khalqih") && !evening.includes("subhanallah-adada-khalqih") && morning.includes("asbahna-wa-asbaha-al-mulk") && !evening.includes("asbahna-wa-asbaha-al-mulk"));
  ok("evening only: «أعوذ بكلمات الله التامات» and «أمسينا»", evening.includes("kalimat-allah-at-tammat") && !morning.includes("kalimat-allah-at-tammat") && evening.includes("amsayna-wa-amsa-al-mulk") && !morning.includes("amsayna-wa-amsa-al-mulk"));
  ok("«بك أصبحنا … النشور» in the morning, «بك أمسينا … المصير» in the evening",
    /النُّشُورُ$/.test(SD.SIDE_ADHKAR["allahumma-bika-asbahna"].text) && /الْمَصِيرُ$/.test(SD.SIDE_ADHKAR["allahumma-bika-amsayna"].text) &&
    morning.includes("allahumma-bika-asbahna") && evening.includes("allahumma-bika-amsayna"));
  ok("«اللهم عالم الغيب والشهادة» ×1 in both sets",
    ["Morning", "Evening"].every((k) => SD.tasksForSide(k).some((t) => t.id === "alim-al-ghayb" && t.repeat === 1)));
  const alim = SD.SIDE_ADHKAR["alim-al-ghayb"].text;
  ok("«عالم الغيب»: Abu Bakr's narration only (no «وأن أقترف…»)", /وَشِرْكِهِ$/.test(alim) && !/أَقْتَرِفَ|اقترف|أَجُرَّهُ/.test(alim));
  const fresh = Object.values(SD.SIDE_ADHKAR);
  eq("side adhkar are reviewed by the owner", fresh.filter((t) => t.review !== "reviewed").map((t) => t.id), []);
  eq("new side adhkar: title, Arabic text and source", fresh.filter((t) => !(t.id && t.title && t.source && tokenize(t.text).length && /[ً-ْ]/.test(t.text) && !/[A-Za-z]/.test(t.text))).map((t) => t.id), []);
  eq("no Quran retyped for the side tasks (only reviewed entries)", fresh.filter((t) => t.kind !== "dhikr").map((t) => t.id), []);
  eq("new ids don't shadow the live catalog", fresh.filter((t) => C.GAME_TASKS[t.id]).map((t) => t.id), []);
  eq("no added honorifics", fresh.filter((t) => /سَيِّد|سيد/.test(t.text)).map((t) => t.id), []);
  eq("new side ids are left out of the candidate catalog", citems.filter((i) => SD.SIDE_ADHKAR[i.id] || SD.DISPUTED_ADHKAR[i.id]).map((i) => i.id), []);
  const s100 = SD.tasksForSide("Morning").find((t) => t.id === "subhanallah-wabihamdih-100");
  eq("100 × «سبحان الله وبحمده» across utterances", matchTask(times("سبحان الله وبحمده", 40) + " " + times("سبحان الله وبحمده", 60), s100).count, 100);
  const adada = SD.SIDE_ADHKAR["subhanallah-adada-khalqih"];
  ok("«عدد خلقه» is not counted by the short tasbih", matchTask(times("سبحان الله وبحمده", 3), adada).count === 0);

  // Names in every language.
  for (const l of I.SUPPORTED_LANGS) {
    const d = I.GAME_I18N[l.code];
    eq(`${l.code}: a name for every side task`, Object.keys(SD.SIDE_ADHKAR).filter((id) => !d.tasks[id]), []);
    ok(`${l.code}: side strings`, typeof d.sideMorning === "string" && typeof d.sideEvening === "string" && typeof d.sideEnds(" ", " ", 50) === "string");
  }
  ok("the reviewed task names are kept", I.gameTaskTitle("en", C.GAME_TASKS["ayat-al-kursi"]) === "Ayat al-Kursi");

  // Local progress: a side window sits beside the prayer window.
  const sp = S.emptyGameState();
  S.markTaskDone(sp, "2026-09-25:Dhuhr", "tasbih-33", 40, 1);
  S.markTaskDone(sp, "2026-09-25:Morning", "ayat-al-kursi", 3, 2);
  S.markTaskDone(sp, "2026-09-25:Evening", "ayat-al-kursi", 3, 3);
  eq("the day's total includes the side adhkar", S.pointsWithPrefix(sp, "2026-09-25"), 46);
  eq("the prayer window's points don't", S.windowPoints(sp.windows["2026-09-25:Dhuhr"]), 40);
  eq("the same item in the prayer and side windows is two records",
    Y.pendingCompletions(sp).map((r) => r.windowKey + " " + r.itemId),
    ["2026-09-25:Dhuhr tasbih-33", "2026-09-25:Morning ayat-al-kursi", "2026-09-25:Evening ayat-al-kursi"]);
  S.savePartial(sp, "2026-09-25:Morning", "al-ikhlas", false, ["قل هو الله احد"]);
  S.savePartial(sp, "2026-09-25:Dhuhr", "tahmid-33", false, ["الحمد لله"]);
  S.savePartial(sp, "2026-09-24:Evening", "al-ikhlas", false, ["قل"]);
  S.clearStalePartials(sp, ["2026-09-25:Dhuhr", "2026-09-25:Morning"]);
  ok("open prayer and side windows keep their partials",
    S.partialHeard(sp, "2026-09-25:Morning", "al-ikhlas", false).length === 1 && S.partialHeard(sp, "2026-09-25:Dhuhr", "tahmid-33", false).length === 1);
  eq("a closed side window loses its partial", S.partialHeard(sp, "2026-09-24:Evening", "al-ikhlas", false), []);
  const guest = S.emptyGameState();
  S.markTaskDone(guest, "2026-09-25:Evening", "ayat-al-kursi", 3, 1).local = true;
  eq("a guest's side adhkar stay on the device", Y.pendingCompletions(guest), []);
  eq("journey and calendar count prayer windows only",
    X.dayJourney(sp, "2026-09-25", P5, () => ["tasbih-33"]).map((s) => s.status), ["none", "done", "none", "none", "none"]);

  // The server mirrors the side catalog and its cap.
  const rulesSrc = fs.readFileSync(path.join(REPO, "backend", "app", "Support", "GameRules.php"), "utf8");
  const serverSide = Object.fromEntries(
    [...rulesSrc.match(/SIDE_TASK_COUNT = \[([^\]]+)\]/)[1].matchAll(/'(\w+)' => (\d+)/g)].map((m) => [m[1], Number(m[2])])
  );
  eq("server side-task counts = app catalog", serverSide, Object.fromEntries(Object.entries(SD.SIDE_TASKS).map(([k, ids]) => [k, ids.length])));
  eq("server side bonus = app SIDE_POINTS", Number(rulesSrc.match(/SIDE_POINTS = (\d+);/)[1]), SD.SIDE_POINTS);
  ok("game page has the side card", /id="side-card"/.test(html) && /id="side-tasks"/.test(html));
}

// ---- optional: adhkar whose authentication is disputed ---------------------------------
{
  const SD = ctx.__side;
  const D = SD.DISPUTED_ADHKAR;
  const ids = ["raditu-billahi-rabba", "hasbiya-allah"];

  // Hidden by default; only an explicit "on" shows them.
  eq("disputed: hidden by default", SD.disputedForSide("Morning"), []);
  eq("disputed: hidden unless turned on (not just truthy)", SD.disputedForSide("Evening", "yes"), []);
  eq("disputed: on -> both in the morning", SD.disputedForSide("Morning", true).map((t) => t.id), ids);
  eq("disputed: on -> both in the evening", SD.disputedForSide("Evening", true).map((t) => t.id), ids);
  eq("disputed: nothing outside a side window", SD.disputedForSide("Dhuhr", true), []);
  // They follow the side window: the morning list from Fajr, the evening's from Maghrib.
  const listAt = (d, hh, mm) => SD.disputedForSide(SD.sideWindow(stubEngine, {}, at(d, hh, mm)).kind, true).length;
  eq("disputed: shown in the morning and the evening windows", [listAt(25, 4, 30), listAt(25, 17, 49), listAt(25, 17, 50), listAt(26, 2, 0)], [2, 2, 2, 2]);

  // Kept out of the strict set and of every prayer window.
  for (const kind of SD.SIDE_KINDS) ok(`${kind}: strict set has no disputed dhikr`, SD.tasksForSide(kind).every((t) => !D[t.id] && !t.disputed));
  ok("prayer windows have no disputed dhikr", ctx.__w.GAME_PRAYERS.every((p) => C.tasksForWindow(p).every((t) => !D[t.id])));
  eq("disputed ids are new", ids.filter((id) => C.GAME_TASKS[id] || SD.SIDE_ADHKAR[id]), []);

  // Content: source and grading shown, reviewed for this section, Arabic only.
  ok("disputed: source, grading, reviewed, flagged", Object.values(D).every((t) => t.source && /مختلف في تصحيحه/.test(t.grading) && t.review === "reviewed" && t.disputed === true && t.kind === "dhikr"));
  eq("رضيت بالله ربًا: Abu Dawud's wording, ﷺ is display only (no token)",
    tokenize(D["raditu-billahi-rabba"].text), tokenize("رضيت بالله ربا وبالاسلام دينا وبمحمد نبيا"));
  ok("رضيت بالله ربًا: no recited addition", !/صَلَّى|صلى/.test(D["raditu-billahi-rabba"].text));
  eq("رضيت ×3, حسبي الله ×7", [D["raditu-billahi-rabba"].repeat, D["hasbiya-allah"].repeat], [3, 7]);
  eq("حسبي الله: the words of al-Tawbah 129", tokenize(D["hasbiya-allah"].text), tokenize("حسبي الله لا اله الا هو عليه توكلت وهو رب العرش العظيم"));
  const rad = SD.disputedForSide("Morning", true)[0];
  eq("رضيت ×3 recognized without the ﷺ", matchTask(times("رضيت بالله ربا وبالاسلام دينا وبمحمد نبيا", 3), rad).count, 3);

  // No points, never synced, not in any total.
  const sd = S.emptyGameState();
  S.markTaskDone(sd, "2026-09-25:Morning", "ayat-al-kursi", 3, 1);
  Object.assign(S.markTaskDone(sd, "2026-09-25:Morning", "raditu-billahi-rabba", 0, 2), { unscored: true, local: true });
  Object.assign(S.markTaskDone(sd, "2026-09-25:Evening", "hasbiya-allah", 0, 3), { unscored: true }); // even without `local`
  eq("disputed: never pending", Y.pendingCompletions(sd).map((r) => r.itemId), ["ayat-al-kursi"]);
  Y.markSynced(sd, Y.pendingCompletions(sd));
  sd.syncAccount = "a";
  Y.adoptSyncAccount(sd, "b");
  eq("disputed: not re-sent to a new account", Y.pendingCompletions(sd).map((r) => r.itemId), ["ayat-al-kursi"]);
  eq("disputed: add nothing to the day", S.pointsWithPrefix(sd, "2026-09-25"), 3);
  ok("disputed don't complete the strict set", !S.allTasksDone(sd.windows["2026-09-25:Morning"], SD.SIDE_TASKS.Morning));

  // Strings and names in every language.
  for (const l of I.SUPPORTED_LANGS) {
    const d = I.GAME_I18N[l.code];
    eq(`${l.code}: a name for every disputed dhikr`, ids.filter((id) => !d.tasks[id]), []);
    ok(`${l.code}: disputed strings`, ["disputedTitle", "disputedNote", "noPoints", "disputedToggle", "disputedDoneMode"].every((k) => typeof d[k] === "string" && d[k]) && typeof d.disputedDone("x") === "string");
  }
  eq("Arabic toggle wording", I.GAME_I18N.ar.disputedToggle, "إظهار الأذكار المختلف في تصحيحها");

  // The page: the card starts hidden, the toggle exists, the setting follows the account.
  ok("disputed card starts hidden", /<section class="side-card disputed-card" id="disputed-card" hidden>/.test(html));
  ok("disputed toggle in the account tab", /id="disputed-on"/.test(html));
  const gameSrc = pageSource(ROOT, "game.html", "game");
  ok("client: off unless stored true", /disputedOn = s\.gameDisputed === true;/.test(gameSrc));
  ok("client: pushes and adopts settings.disputed", /pushSettings\(\{ disputed: disputedOn \}\)/.test(gameSrc) && /typeof s\.disputed === "boolean"/.test(gameSrc) && /disputed: disputedOn \}\);/.test(gameSrc));
  ok("client: a finished disputed dhikr is unscored and local", /if \(task\.disputed\) Object\.assign\(rec, \{ unscored: true, local: true \}\)/.test(gameSrc));
  const userSrc = fs.readFileSync(path.join(REPO, "backend", "app", "Models", "GameUser.php"), "utf8");
  ok("server: settings allow-list has disputed", /SETTINGS = \[[^\]]*'disputed'/.test(userSrc));
}

if (failures.length) {
  console.error(`game: ${failures.length} FAILED, ${passed} passed`);
  failures.forEach((f) => console.error("  ✗ " + f));
  process.exit(1);
}
console.log(`game: all ${passed} passed`);
