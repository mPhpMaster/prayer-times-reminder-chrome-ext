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
// Every entry must be ma'thur and carries its source. `review` stays
// "pending" until the wording and grading are checked; nothing pending ships
// in a public release (docs/GAME-DESIGN-2026-09-25.md, phase 5).

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
// Tasks per prayer window. Every text is ma'thur with its source; all stay
// review: "pending" (docs/GAME-DESIGN-2026-09-25.md, phase 5). Long surahs
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
for (const [id, t] of Object.entries(GAME_TASKS)) Object.assign(t, { id, review: "pending" });

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

// Gifts: a ma'thur du'a / ayah opened after finishing a window, read aloud for
// bonus points. The same gift for everyone in the same window (picked from the
// window key), so friends open the same one.
const GIFTS = [
  { id: "afw-afiya", text: "اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي الدُّنْيَا وَالْآخِرَةِ", source: "أبو داود وابن ماجه" },
  { id: "rabbana-atina", text: "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ", source: "البقرة 201" },
  { id: "muqallib", text: "يَا مُقَلِّبَ الْقُلُوبِ، ثَبِّتْ قَلْبِي عَلَى دِينِكَ", source: "الترمذي" },
  { id: "aini-ala-dhikrik", text: "اللَّهُمَّ أَعِنِّي عَلَى ذِكْرِكَ، وَشُكْرِكَ، وَحُسْنِ عِبَادَتِكَ", source: "أبو داود والنسائي" },
  { id: "afuwwun", text: "اللَّهُمَّ إِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي", source: "الترمذي" },
].map((g) => ({ ...g, kind: "gift", title: "الهدية", repeat: 1, review: "pending" }));

function giftForWindow(key) {
  let h = 0;
  for (const c of String(key)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return GIFTS[h % GIFTS.length];
}
