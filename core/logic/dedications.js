// dedications.js — the About page's dedication (sadaqah jariyah) names.
//
// The list lives on the game server (GET /v1/dedications) so admins can add
// names without an app update; the page keeps the last list it saw (store key
// DEDICATIONS_KEY) and ships DEDICATIONS_FALLBACK for a first run offline.
//
// A name is a map lang -> text in any of the app's languages. How one shows:
//   dedicationLines(names, lang) -> { primary, secondary }
//   - primary: the Arabic text when there is one (the dedication's own
//     language), else the UI language's, else English, else any.
//   - secondary (a quieter line below), never a repeat of primary:
//       ar UI: none;  ur UI: the Urdu text only (Urdu reads Arabic script);
//       other UIs: that language's text, else English (the Latin spelling).
//   cleanDedicationNames(raw) -> the non-empty, trimmed entries (request form)

const DEDICATIONS_KEY = "dedications"; // { list: [{id, names}], savedAt }
const DEDICATION_LANGS = ["ar", "en", "ur", "fr", "es", "hi", "id", "de", "ru", "kk", "uz"];
const DEDICATION_MAX_NAME = 80;

const DEDICATIONS_FALLBACK = [
  { id: 1, names: { ar: "ام بلال - باشية حجازي", en: "Umm Bilal – Bashiyah Hijazi" } },
  { id: 2, names: { ar: "عبدالله الشرمي", en: "Abdullah al-Sharmi" } },
  { id: 3, names: { ar: "ام عبدو صراميجو", en: "Umm Abdo Sarameejo" } },
  { id: 4, names: { ar: "أم فجر جونيرتي", en: "Umm Fajar Juniarti" } },
  { id: 5, names: { ar: "سوهيرمان", en: "Suherman" } },
];

function firstName(names) {
  for (const code of DEDICATION_LANGS) if (names[code]) return names[code];
  for (const v of Object.values(names)) if (v) return v;
  return "";
}

function dedicationLines(names, lang) {
  const n = names || {};
  const primary = n.ar || n[lang] || n.en || firstName(n);
  let secondary = null;
  if (lang === "ar") secondary = null;
  else if (lang === "ur") secondary = n.ur || null;
  else secondary = n[lang] || n.en || null;
  if (secondary === primary) secondary = null;
  return { primary, secondary };
}

// True when the text is mostly Arabic script (for dir="rtl").
function isArabicScript(text) {
  return /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/.test(String(text || ""));
}

function cleanDedicationNames(raw) {
  const out = {};
  for (const code of DEDICATION_LANGS) {
    const v = raw && typeof raw[code] === "string" ? raw[code].replace(/\s+/g, " ").trim() : "";
    if (v) out[code] = v;
  }
  return out;
}

// A list from the server or the store, or null when it isn't one.
function validDedicationList(list) {
  if (!Array.isArray(list)) return null;
  const ok = list.filter((d) => d && typeof d === "object" && d.names && typeof d.names === "object" && firstName(d.names));
  return ok.length === list.length ? ok : null;
}
