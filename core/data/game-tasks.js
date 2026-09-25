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
