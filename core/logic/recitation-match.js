// recitation-match.js — pure matching of a speech-recognizer transcript against
// a dhikr / ayah text, for the voice-verified game tasks. No platform APIs.
//
// The recognizer never reproduces vocalized (mushaf) text exactly, so both
// sides are normalized to a bare letter skeleton and compared word by word
// with a fuzzy similarity. Repetitions ("سبحان الله وبحمده" ×100) are counted
// by walking the whole transcript through the target cyclically.
//
//   normalizeArabic(text)                        -> "بسم الله"
//   tokenize(text)                               -> ["بسم", "الله"]
//   matchRecitation(heard, target, opts)         -> { count, progress, matched, done }

// Harakat, tanween, shadda, sukun, superscript alef, small high/low marks and
// Quranic pause signs — everything that isn't a base letter.
const RM_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿ]/g;
const RM_TATWEEL = /ـ/g;
const NOT_LETTER = /[^ء-ي\s]/g;

function normalizeArabic(text) {
  return String(text || "")
    .replace(RM_MARKS, "")
    .replace(RM_TATWEEL, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ء/g, "")
    .replace(NOT_LETTER, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text) {
  const n = normalizeArabic(text);
  return n ? n.split(" ") : [];
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

// Long-vowel alefs are the most common spelling drift between mushaf/imla'i
// text and recognizer output (السموات / السماوات, إله / الاه), so a word is
// also compared with its non-initial alefs dropped.
const dropAlef = (w) => w.charAt(0) + w.slice(1).replace(/ا/g, "");

function ratio(a, b) {
  const len = Math.max(a.length, b.length);
  return len ? 1 - levenshtein(a, b) / len : 1;
}

function wordSimilarity(a, b) {
  if (a === b) return 1;
  return Math.max(ratio(a, b), ratio(dropAlef(a), dropAlef(b)));
}

// Short words ("لا", "له", "ما") carry little signal — require an exact hit.
function wordsMatch(heard, want, minSim) {
  if (want.length <= 2 || heard.length <= 2) return heard === want || dropAlef(heard) === dropAlef(want);
  return wordSimilarity(heard, want) >= minSim;
}

// opts:
//   minWordSim   fuzzy threshold per word                         (0.75)
//   minCoverage  share of a repetition's words that must be heard  (0.8)
//   lookahead    target words a heard word may jump over           (3)
//   final        the speaker has stopped — count a trailing
//                repetition that is covered enough                  (false)
//
// Returns:
//   count     completed repetitions
//   progress  0..1 through the current (incomplete) repetition
//   matched   boolean per target word for the current repetition (highlighting)
function matchRecitation(heard, target, opts = {}) {
  const minWordSim = opts.minWordSim ?? 0.75;
  const minCoverage = opts.minCoverage ?? 0.8;
  const lookahead = opts.lookahead ?? 3;
  const H = Array.isArray(heard) ? heard : tokenize(heard);
  const T = Array.isArray(target) ? target : tokenize(target);
  if (!T.length) return { count: 0, progress: 0, matched: [], done: false };

  let count = 0;
  let pos = 0; // next target word expected
  let matched = new Array(T.length).fill(false);
  const covered = () => matched.filter(Boolean).length / T.length;
  const reset = () => {
    pos = 0;
    matched = new Array(T.length).fill(false);
  };
  // A repetition counts once its last word is reached with enough coverage.
  const closeIfComplete = () => {
    if (pos >= T.length && covered() >= minCoverage) {
      count++;
      reset();
      return true;
    }
    return false;
  };

  for (const h of H) {
    let hit = -1;
    for (let j = pos; j < Math.min(T.length, pos + lookahead + 1); j++) {
      if (wordsMatch(h, T[j], minWordSim)) {
        hit = j;
        break;
      }
    }
    if (hit >= 0) {
      matched[hit] = true;
      pos = hit + 1;
      if (pos >= T.length && !closeIfComplete()) reset(); // reached the end too patchy
      continue;
    }
    // Not the expected word — maybe the speaker started the next repetition
    // (the recognizer dropped the tail of this one).
    if (pos > 0 && wordsMatch(h, T[0], minWordSim)) {
      if (covered() >= minCoverage && pos >= T.length - lookahead) count++;
      reset();
      matched[0] = true;
      pos = 1;
      if (T.length === 1) closeIfComplete();
    }
  }

  if (opts.final && pos > 0 && covered() >= minCoverage && pos >= T.length - lookahead) {
    count++;
    reset();
  }

  return { count, progress: pos / T.length, matched, done: false };
}

// Convenience for a task: { text, repeat } -> adds `done` and clamps count.
function matchTask(heard, task, opts = {}) {
  const r = matchRecitation(heard, task.match || task.text, opts);
  const repeat = task.repeat || 1;
  r.count = Math.min(r.count, repeat);
  r.done = r.count >= repeat;
  if (r.done) {
    r.progress = 1;
    r.matched = r.matched.map(() => true);
  }
  return r;
}
