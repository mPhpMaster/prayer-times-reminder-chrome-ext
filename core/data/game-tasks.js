// game-tasks.js — task catalog for the voice-verified dhikr game.
//
// Phase 0 (voice spike) only: five well-known texts used to measure how well
// the device's speech recognizer follows real recitation. Repeat counts are
// lowered from the sunnah counts so a test run stays short — `sunnahRepeat`
// keeps the real number for the full catalog.
//
// Reading is split into meaningful segments at clause marks (see chunkText):
// waqf signs and ayah ends in Quran text — never edited to force a split —
// and commas at the natural pauses of a dhikr.
//
// Every entry must be ma'thur and carries its source. `review` is
// "pending" until the wording and grading are checked; nothing pending ships
// in a public release (docs/GAME-DESIGN-2026-09-25.md, phase 5). The live
// catalog (GAME_TASKS) and the gifts were reviewed by the owner on
// 2026-10-13, before the Google Play production release ("reviewed").
// The phase 0 spike tasks (developer page only) stay "pending".

const SPIKE_TASKS = [
  {
    id: "subhanallah-wabihamdih",
    kind: "dhikr",
    text: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ",
    repeat: 10,
    sunnahRepeat: 100,
    source: "البخاري ومسلم",
    review: "pending",
  },
  {
    id: "tahlil",
    kind: "dhikr",
    text: "لَا إِلَٰهَ إِلَّا اللَّهُ، وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ",
    repeat: 3,
    sunnahRepeat: 100,
    source: "البخاري ومسلم",
    review: "pending",
  },
  {
    id: "sayyid-al-istighfar",
    kind: "dhikr",
    text:
      "اللَّهُمَّ أَنْتَ رَبِّي، لَا إِلَٰهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، " +
      "أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ لَكَ بِذَنْبِي فَاغْفِرْ لِي، " +
      "فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ",
    repeat: 1,
    sunnahRepeat: 1,
    source: "البخاري",
    review: "pending",
  },
  {
    id: "al-ikhlas",
    kind: "surah",
    text: "قُلْ هُوَ اللَّهُ أَحَدٌ ۝ اللَّهُ الصَّمَدُ ۝ لَمْ يَلِدْ وَلَمْ يُولَدْ ۝ وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ",
    repeat: 3,
    sunnahRepeat: 3,
    source: "سورة الإخلاص (112)",
    review: "pending",
  },
  {
    id: "ayat-al-kursi",
    kind: "ayah",
    text:
      "اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ۚ لَهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ ۗ " +
      "مَنْ ذَا الَّذِي يَشْفَعُ عِنْدَهُ إِلَّا بِإِذْنِهِ ۚ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ ۖ " +
      "وَلَا يُحِيطُونَ بِشَيْءٍ مِنْ عِلْمِهِ إِلَّا بِمَا شَاءَ ۚ وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالْأَرْضَ ۖ " +
      "وَلَا يَئُودُهُ حِفْظُهُمَا ۚ وَهُوَ الْعَلِيُّ الْعَظِيمُ",
    repeat: 1,
    sunnahRepeat: 1,
    source: "البقرة 255",
    review: "pending",
  },
];

// ---- Phase 1 catalog --------------------------------------------------------
// Tasks per prayer window. Every text is ma'thur with its source; reviewed
// by the owner on 2026-10-13 (docs/GAME-DESIGN-2026-09-25.md, phase 5). Long surahs
// with a sunnah virtue (al-Mulk, al-Kahf, end of al-Baqarah) are not added
// until their text is taken from a verified mushaf source, not typed by hand.

const TAHLIL =
  "لَا إِلَٰهَ إِلَّا اللَّهُ، وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ";
const spike = (id) => SPIKE_TASKS.find((t) => t.id === id);

const GAME_TASKS = {
  "istighfar-salam": {
    kind: "dhikr",
    title: "الاستغفار والسلام",
    text:
      "أَسْتَغْفِرُ اللَّهَ، أَسْتَغْفِرُ اللَّهَ، أَسْتَغْفِرُ اللَّهَ، " +
      "اللَّهُمَّ أَنْتَ السَّلَامُ، وَمِنْكَ السَّلَامُ، تَبَارَكْتَ يَا ذَا الْجَلَالِ وَالْإِكْرَامِ",
    repeat: 1,
    source: "مسلم",
  },
  "tasbih-33": { kind: "dhikr", title: "التسبيح", text: "سُبْحَانَ اللَّهِ", repeat: 33, source: "مسلم" },
  "tahmid-33": { kind: "dhikr", title: "التحميد", text: "الْحَمْدُ لِلَّهِ", repeat: 33, source: "مسلم" },
  "takbir-33": { kind: "dhikr", title: "التكبير", text: "اللَّهُ أَكْبَرُ", repeat: 33, source: "مسلم" },
  "tamam-100": { kind: "dhikr", title: "تمام المئة", text: TAHLIL, repeat: 1, source: "مسلم" },
  "ayat-al-kursi": { ...spike("ayat-al-kursi"), title: "آية الكرسي", source: "النسائي في الكبرى (البقرة 255)" },
  "al-ikhlas": { ...spike("al-ikhlas"), title: "سورة الإخلاص", repeat: 1, source: "أبو داود والترمذي والنسائي" },
  "al-falaq": {
    kind: "surah",
    title: "سورة الفلق",
    text:
      "قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ ۝ مِنْ شَرِّ مَا خَلَقَ ۝ وَمِنْ شَرِّ غَاسِقٍ إِذَا وَقَبَ ۝ " +
      "وَمِنْ شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ ۝ وَمِنْ شَرِّ حَاسِدٍ إِذَا حَسَدَ",
    repeat: 1,
    source: "أبو داود والترمذي والنسائي",
  },
  "an-nas": {
    kind: "surah",
    title: "سورة الناس",
    text:
      "قُلْ أَعُوذُ بِرَبِّ النَّاسِ ۝ مَلِكِ النَّاسِ ۝ إِلَٰهِ النَّاسِ ۝ مِنْ شَرِّ الْوَسْوَاسِ الْخَنَّاسِ ۝ " +
      "الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ ۝ مِنَ الْجِنَّةِ وَالنَّاسِ",
    repeat: 1,
    source: "أبو داود والترمذي والنسائي",
  },
  "sayyid-al-istighfar": { ...spike("sayyid-al-istighfar"), title: "سيد الاستغفار", source: "البخاري" },
  "tahlil-10": {
    kind: "dhikr",
    title: "التهليل عشرًا",
    text:
      "لَا إِلَٰهَ إِلَّا اللَّهُ، وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، يُحْيِي وَيُمِيتُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ",
    repeat: 10,
    source: "الترمذي (بعد الفجر والمغرب، يحتاج مراجعة درجته)",
  },
};
for (const [id, t] of Object.entries(GAME_TASKS)) Object.assign(t, { id, review: "reviewed" });

// Every window starts with the adhkar after the obligatory prayer; morning
// (Fajr window) and evening (Asr window) add their own, and the mu'awwidhat
// are said three times morning and evening (أبو داود).
const AFTER_PRAYER = ["istighfar-salam", "tasbih-33", "tahmid-33", "takbir-33", "tamam-100", "ayat-al-kursi"];
const MUAWWIDHAT = ["al-ikhlas", "al-falaq", "an-nas"];
const WINDOW_TASKS = {
  Fajr: [...AFTER_PRAYER, ...MUAWWIDHAT, "tahlil-10", "sayyid-al-istighfar"],
  Dhuhr: [...AFTER_PRAYER, ...MUAWWIDHAT],
  Asr: [...AFTER_PRAYER, ...MUAWWIDHAT, "sayyid-al-istighfar"],
  Maghrib: [...AFTER_PRAYER, ...MUAWWIDHAT, "tahlil-10"],
  Isha: [...AFTER_PRAYER, ...MUAWWIDHAT],
};
// Per-window repeat overrides (the mu'awwidhat ×3 morning and evening).
const WINDOW_REPEAT = {
  Fajr: { "al-ikhlas": 3, "al-falaq": 3, "an-nas": 3 },
  Asr: { "al-ikhlas": 3, "al-falaq": 3, "an-nas": 3 },
};

// weight = words recited in full (word count × repeat): the effort a task
// takes, which splitWindowPoints() turns into its share of the window's points.
// Needs tokenize() from recitation-match.js (loaded first).
function tasksForWindow(prayer) {
  return (WINDOW_TASKS[prayer] || []).map((id) => {
    const t = GAME_TASKS[id];
    const repeat = (WINDOW_REPEAT[prayer] || {})[id] || t.repeat;
    return { ...t, repeat, weight: tokenize(t.text).length * repeat };
  });
}

// ---- Side tasks: the morning and evening adhkar -----------------------------------
// A daily bonus set beside the prayer windows: the morning adhkar from Fajr
// until Maghrib, the evening adhkar from Maghrib until the next Fajr
// (sideWindow in game-windows.js, SIDE_POINTS in game-score.js). Read by voice
// like any task. Quran is never retyped here: ayat al-Kursi and the
// mu'awwidhat are the reviewed entries above. The adhkar below were added
// on 2026-10-15 and reviewed by the owner the same day. Only well
// authenticated morning / evening adhkar; disputed ones (رضيت بالله ربًا،
// حسبي الله سبعًا) are in the optional, unscored DISPUTED_ADHKAR below.
const SIDE_ADHKAR = {
  "asbahna-wa-asbaha-al-mulk": {
    kind: "dhikr",
    title: "أصبحنا وأصبح الملك لله",
    text:
      "أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، " +
      "لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ، " +
      "رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَٰذَا الْيَوْمِ وَخَيْرَ مَا بَعْدَهُ، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَٰذَا الْيَوْمِ وَشَرِّ مَا بَعْدَهُ، " +
      "رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ، رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ",
    repeat: 1,
    source: "مسلم",
  },
  "amsayna-wa-amsa-al-mulk": {
    kind: "dhikr",
    title: "أمسينا وأمسى الملك لله",
    text:
      "أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، " +
      "لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ، " +
      "رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَٰذِهِ اللَّيْلَةِ وَخَيْرَ مَا بَعْدَهَا، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَٰذِهِ اللَّيْلَةِ وَشَرِّ مَا بَعْدَهَا، " +
      "رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ، رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ",
    repeat: 1,
    source: "مسلم",
  },
  "allahumma-bika-asbahna": {
    kind: "dhikr",
    title: "اللهم بك أصبحنا",
    text: "اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ النُّشُورُ",
    repeat: 1,
    source: "أبو داود والترمذي",
  },
  "allahumma-bika-amsayna": {
    kind: "dhikr",
    title: "اللهم بك أمسينا",
    text: "اللَّهُمَّ بِكَ أَمْسَيْنَا، وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ الْمَصِيرُ",
    repeat: 1,
    source: "أبو داود والترمذي",
  },
  "bismillah-la-yadurru": {
    kind: "dhikr",
    title: "بسم الله الذي لا يضر مع اسمه شيء",
    text: "بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ، وَهُوَ السَّمِيعُ الْعَلِيمُ",
    repeat: 3,
    source: "أبو داود والترمذي",
  },
  "asaluka-al-afiya": {
    kind: "dhikr",
    title: "سؤال العفو والعافية",
    text:
      "اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي الدُّنْيَا وَالْآخِرَةِ، " +
      "اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي دِينِي وَدُنْيَايَ وَأَهْلِي وَمَالِي، " +
      "اللَّهُمَّ اسْتُرْ عَوْرَاتِي، وَآمِنْ رَوْعَاتِي، " +
      "اللَّهُمَّ احْفَظْنِي مِنْ بَيْنِ يَدَيَّ، وَمِنْ خَلْفِي، وَعَنْ يَمِينِي، وَعَنْ شِمَالِي، وَمِنْ فَوْقِي، " +
      "وَأَعُوذُ بِعَظَمَتِكَ أَنْ أُغْتَالَ مِنْ تَحْتِي",
    repeat: 1,
    source: "أبو داود وابن ماجه",
  },
  // Abu Bakr's narration only: «وأن أقترف على نفسي سوءًا أو أجرّه إلى مسلم» is
  // from another narration and is left out (owner decision, 2026-10-15).
  "alim-al-ghayb": {
    kind: "dhikr",
    title: "اللهم عالم الغيب والشهادة",
    text:
      "اللَّهُمَّ عَالِمَ الْغَيْبِ وَالشَّهَادَةِ، فَاطِرَ السَّمَاوَاتِ وَالْأَرْضِ، رَبَّ كُلِّ شَيْءٍ وَمَلِيكَهُ، " +
      "أَشْهَدُ أَنْ لَا إِلَٰهَ إِلَّا أَنْتَ، أَعُوذُ بِكَ مِنْ شَرِّ نَفْسِي، وَمِنْ شَرِّ الشَّيْطَانِ وَشِرْكِهِ",
    repeat: 1,
    source: "أبو داود والترمذي (قال الترمذي: حسن صحيح)",
  },
  "ya-hayyu-ya-qayyum": {
    kind: "dhikr",
    title: "يا حي يا قيوم",
    text: "يَا حَيُّ يَا قَيُّومُ، بِرَحْمَتِكَ أَسْتَغِيثُ، أَصْلِحْ لِي شَأْنِي كُلَّهُ، وَلَا تَكِلْنِي إِلَى نَفْسِي طَرْفَةَ عَيْنٍ",
    repeat: 1,
    source: "النسائي في الكبرى والحاكم",
  },
  "subhanallah-adada-khalqih": {
    kind: "dhikr",
    title: "سبحان الله وبحمده عدد خلقه",
    text: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، عَدَدَ خَلْقِهِ، وَرِضَا نَفْسِهِ، وَزِنَةَ عَرْشِهِ، وَمِدَادَ كَلِمَاتِهِ",
    repeat: 3,
    source: "مسلم",
  },
  "kalimat-allah-at-tammat": {
    kind: "dhikr",
    title: "أعوذ بكلمات الله التامات",
    text: "أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ",
    repeat: 3,
    source: "مسلم",
  },
  "subhanallah-wabihamdih-100": {
    kind: "dhikr",
    title: "سبحان الله وبحمده",
    text: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ",
    repeat: 100,
    source: "مسلم",
  },
};
for (const [id, t] of Object.entries(SIDE_ADHKAR)) Object.assign(t, { id, review: "reviewed" });

// The order of the usual morning / evening adhkar books. Ayat al-Kursi,
// sayyid al-istighfar and the mu'awwidhat (×3) come from the reviewed catalog.
const SIDE_TASKS = {
  Morning: [
    "ayat-al-kursi", ...MUAWWIDHAT, "asbahna-wa-asbaha-al-mulk", "allahumma-bika-asbahna", "sayyid-al-istighfar",
    "asaluka-al-afiya", "alim-al-ghayb", "bismillah-la-yadurru", "ya-hayyu-ya-qayyum", "subhanallah-adada-khalqih", "subhanallah-wabihamdih-100",
  ],
  Evening: [
    "ayat-al-kursi", ...MUAWWIDHAT, "amsayna-wa-amsa-al-mulk", "allahumma-bika-amsayna", "sayyid-al-istighfar",
    "asaluka-al-afiya", "alim-al-ghayb", "bismillah-la-yadurru", "ya-hayyu-ya-qayyum", "kalimat-allah-at-tammat", "subhanallah-wabihamdih-100",
  ],
};
const SIDE_REPEAT = { "al-ikhlas": 3, "al-falaq": 3, "an-nas": 3 };

// Like tasksForWindow; `kind` is "Morning" or "Evening" (SIDE_KINDS).
function tasksForSide(kind) {
  return (SIDE_TASKS[kind] || []).map((id) => {
    const t = GAME_TASKS[id] || SIDE_ADHKAR[id];
    const repeat = SIDE_REPEAT[id] || t.repeat;
    return { ...t, repeat, weight: tokenize(t.text).length * repeat };
  });
}

// ---- Optional: morning / evening adhkar whose authentication is disputed ----------
// «أذكار مختلف في تصحيحها»: kept OUT of the strict sets above. Shown under the
// side card in the same windows only when the player turns them on (setting
// "gameDisputed", off by default), each with its source AND its grading note.
// Read by voice, but they earn NO points and never leave the device (game.js
// stamps them `unscored` + `local`; pendingCompletions skips them), so only
// the strict sets compete. Approved for this clearly labelled section by the
// owner on 2026-10-15.
//
// «رضيت بالله ربًا»: Abu Dawud's wording «نبيًّا». ﷺ after the Prophet's name
// is a display mark only: normalizeArabic drops it, so it carries no token and
// the player isn't asked to recite an addition to the narrated wording.
// «حسبي الله…»: the words of al-Tawbah 129 (from its «حَسْبِيَ»), unchanged.
const DISPUTED_ADHKAR = {
  "raditu-billahi-rabba": {
    kind: "dhikr",
    title: "رضيت بالله ربًا",
    text: "رَضِيتُ بِاللَّهِ رَبًّا، وَبِالْإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ ﷺ نَبِيًّا",
    repeat: 3,
    source: "أبو داود والترمذي (قال الترمذي: حسن غريب)",
    grading: "مختلف في تصحيحه: حسّنه بعض العلماء وضعّفه آخرون، وأصل اللفظ صحيح عند مسلم بعد الأذان",
  },
  "hasbiya-allah": {
    kind: "dhikr",
    title: "حسبي الله لا إله إلا هو",
    text: "حَسْبِيَ اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ، عَلَيْهِ تَوَكَّلْتُ، وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ",
    repeat: 7,
    source: "أبو داود (موقوفًا على أبي الدرداء)",
    grading: "مختلف في تصحيحه: رُوي موقوفًا على أبي الدرداء، ورفعه ضعيف",
  },
};
for (const [id, t] of Object.entries(DISPUTED_ADHKAR)) Object.assign(t, { id, review: "reviewed", disputed: true });

const DISPUTED_TASKS = {
  Morning: ["raditu-billahi-rabba", "hasbiya-allah"],
  Evening: ["raditu-billahi-rabba", "hasbiya-allah"],
};

// The optional list for a side window: empty unless the player turned it on.
function disputedForSide(kind, enabled = false) {
  if (enabled !== true) return [];
  return (DISPUTED_TASKS[kind] || []).map((id) => ({ ...DISPUTED_ADHKAR[id] }));
}

// Gifts: a ma'thur du'a / ayah opened after finishing a window, read aloud for
// bonus points. The same gift for everyone in the same window (picked from the
// window key), so friends open the same one.
const GIFTS = [
  { id: "afw-afiya", text: "اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي الدُّنْيَا وَالْآخِرَةِ", source: "أبو داود وابن ماجه" },
  { id: "rabbana-atina", text: "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ", source: "البقرة 201" },
  { id: "muqallib", text: "يَا مُقَلِّبَ الْقُلُوبِ، ثَبِّتْ قَلْبِي عَلَى دِينِكَ", source: "الترمذي" },
  { id: "aini-ala-dhikrik", text: "اللَّهُمَّ أَعِنِّي عَلَى ذِكْرِكَ، وَشُكْرِكَ، وَحُسْنِ عِبَادَتِكَ", source: "أبو داود والنسائي" },
  { id: "afuwwun", text: "اللَّهُمَّ إِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي", source: "الترمذي" },
].map((g) => ({ ...g, kind: "gift", title: "الهدية", repeat: 1, review: "reviewed" }));

function giftForWindow(key) {
  let h = 0;
  for (const c of String(key)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return GIFTS[h % GIFTS.length];
}
