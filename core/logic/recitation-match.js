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
//   chunkText(text, maxWords)                    -> [{ words, from, to }]  reading chunks

// Harakat, tanween, shadda, sukun, superscript alef, small high/low marks and
// Quranic pause signs — everything that isn't a base letter.
const RM_MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D3-\u08FF]/g;
const RM_TATWEEL = /\u0640/g;
const NOT_LETTER = /[^\u0621-\u064A\s]/g;

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

// The definite article is often swallowed in connected recitation
// ("سبحان اللهِ" is heard as "سبحان لَهِ"), so words are also compared with a
// leading ال / وال / فال / بال reduced to its bare stem.
const dropArticle = (w) => w.replace(/^([وفب]?)ال(?=..)/, "$1");

// Short words ("لا", "له", "ما") carry little signal — require an exact hit.
function shortMatch(heard, want) {
  return heard === want || dropAlef(heard) === dropAlef(want);
}

function wordsMatch(heard, want, minSim) {
  const h2 = dropArticle(heard);
  const w2 = dropArticle(want);
  if (want.length <= 2 || heard.length <= 2) return shortMatch(heard, want) || shortMatch(h2, w2);
  return wordSimilarity(heard, want) >= minSim || (h2 !== heard || w2 !== want ? wordSimilarity(h2, w2) >= minSim : false);
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

// Split a text into short reading chunks (at most maxWords spoken words) so
// the player reads a few words, pauses, and the next chunk appears. Short
// utterances decode faster and more accurately than a whole ayah at once.
// A chunk also ends early at a clause mark (، ۚ ۝ …) so pauses fall naturally.
//   words    display words (vocalized, with any attached marks)
//   from,to  token range [from, to) in tokenize(text) — matches matchRecitation's
//            `matched` / `progress`, so the current chunk is the one holding pos
const CLAUSE_END = /[،؛.:!?ۖ-ۜ۝]$/;
function chunkText(text, maxWords = 3) {
  const chunks = [];
  let cur = null;
  let token = 0;
  for (const word of String(text || "").split(/\s+/).filter(Boolean)) {
    const spoken = normalizeArabic(word) ? 1 : 0; // pause marks like ۝ carry no token
    if (!spoken && !cur && chunks.length) {
      chunks[chunks.length - 1].words.push(word); // a mark stays with the words it ends
      continue;
    }
    if (!cur) cur = { words: [], from: token, to: token };
    cur.words.push(word);
    token += spoken;
    cur.to = token;
    const count = cur.to - cur.from;
    if (count >= maxWords || (count > 0 && CLAUSE_END.test(word))) {
      chunks.push(cur);
      cur = null;
    }
  }
  if (cur && cur.to > cur.from) chunks.push(cur);
  else if (cur && chunks.length) chunks[chunks.length - 1].words.push(...cur.words);
  return chunks;
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
