// build-city-names — real Arabic city names for the city dropdown.
//
// The city list comes from countriesnow in English; before this, Arabic was a
// letter-by-letter transliteration ("ازبت ال برج"), which reads badly. This
// builds, from GeoNames (CC BY 4.0, https://www.geonames.org), one small JSON
// per country mapping the English city name to its Arabic name:
//
//   core/assets/city-ar/index.json   { "Egypt": "EG", ... }   (COUNTRIES en -> ISO)
//   core/assets/city-ar/EG.json      { "Izbat al Burj": "عزبة البرج", ... }
//
// Sources (cached in tools/.cache/, gitignored — about 220 MB, one-time):
//   cities500.zip          every place with population >= 500 (id, names, country)
//   <ISO>.zip              the country's full dump, for its populated places
//                          (districts like Az Zamalik aren't in cities500);
//                          skipped for the few huge countries (FULL_DUMP_MAX)
//   alternateNamesV2.zip   alternate names with their language; only "ar" is kept
//   countryInfo.txt        ISO code <-> English country name
//
// Picking the Arabic name: GeoNames' "preferred" Arabic name first, then a
// plain one; historic and colloquial names are skipped. Matching the app's
// list (countriesnow) ignores diacritics and also uses GeoNames' English
// alternate names. A city with no Arabic name is left out — the app then
// shows its English name rather than a wrong guess.
//
// Run: node tools/build-city-names.mjs   (needs `tar`, built into Windows 10+)

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { execFileSync } from "node:child_process";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = path.join(ROOT, "tools", ".cache", "geonames");
const OUT = path.join(ROOT, "core", "assets", "city-ar");
const BASE = "https://download.geonames.org/export/dump/";
const FULL_DUMP_MAX = 12 * 1024 * 1024; // bytes; bigger country dumps fall back to cities500
const PARALLEL = 8; // the server throttles each connection

// COUNTRIES en names (i18n.js) that differ from GeoNames' country names.
const COUNTRY_ALIASES = {
  "Ivory Coast": "CI", "Côte d'Ivoire": "CI", "Cote d'Ivoire": "CI",
  "Czech Republic": "CZ", Czechia: "CZ", "North Macedonia": "MK", Macedonia: "MK",
  "Democratic Republic of the Congo": "CD", "DR Congo": "CD", "Republic of the Congo": "CG", Congo: "CG",
  "United States": "US", USA: "US", "United Kingdom": "GB", UK: "GB",
  Palestine: "PS", "Palestinian Territory": "PS", "South Korea": "KR", "North Korea": "KP",
  Russia: "RU", Syria: "SY", Iran: "IR", Laos: "LA", Vietnam: "VN", Moldova: "MD",
  Bolivia: "BO", Venezuela: "VE", Tanzania: "TZ", Brunei: "BN", "Cape Verde": "CV", "Cabo Verde": "CV",
  Eswatini: "SZ", Swaziland: "SZ", "East Timor": "TL", "Timor-Leste": "TL", Micronesia: "FM",
  "Vatican City": "VA", "The Gambia": "GM", Gambia: "GM", "The Bahamas": "BS", Bahamas: "BS",
  Netherlands: "NL", "The Netherlands": "NL", Myanmar: "MM", Burma: "MM", Kosovo: "XK", Taiwan: "TW", Turkey: "TR", "Türkiye": "TR",
};

async function download(name) {
  const file = path.join(CACHE, name);
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return file;
  fs.mkdirSync(CACHE, { recursive: true });
  for (let attempt = 1; ; attempt++) {
    try {
      console.log(`downloading ${name}…`);
      const res = await fetch(BASE + name);
      if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(file + ".part", buf);
      fs.renameSync(file + ".part", file); // never leave a half file behind as "cached"
      return file;
    } catch (e) {
      if (attempt >= 4) throw e;
      console.log(`  retry ${name} (${e.message})`);
    }
  }
}

function unzip(zip, member) {
  const out = path.join(CACHE, member);
  // Windows' bsdtar reads zips; Git Bash's GNU tar would take "C:" for a remote host.
  const tar = process.platform === "win32" ? path.join(process.env.SystemRoot || "C:/Windows", "System32", "tar.exe") : "tar";
  if (!fs.existsSync(out)) execFileSync(tar, ["-xf", zip, "-C", CACHE, member], { stdio: "inherit" });
  return out;
}

function lines(file) {
  return readline.createInterface({ input: fs.createReadStream(file, "utf8"), crlfDelay: Infinity });
}

// COUNTRIES from core/data/i18n.js (a script of globals: evaluate just that array).
function appCountries() {
  const src = fs.readFileSync(path.join(ROOT, "core", "data", "i18n.js"), "utf8");
  const start = src.indexOf("const COUNTRIES = [");
  const end = src.indexOf("];", start);
  const ctx = {};
  vm.runInNewContext(`${src.slice(start, end + 2)}; this.COUNTRIES = COUNTRIES;`, ctx);
  return ctx.COUNTRIES.map((c) => c.en);
}

const PERSIAN_ONLY = /[پچژگکیۀ]/; // Persian/Urdu letters: not an Arabic spelling

async function size(name) {
  const res = await fetch(BASE + name, { method: "HEAD" });
  return Number(res.headers.get("content-length") || 0);
}

async function inBatches(items, n, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += n) out.push(...(await Promise.all(items.slice(i, i + n).map(fn))));
  return out;
}

async function main() {
  const citiesZip = await download("cities500.zip");
  const altZip = await download("alternateNamesV2.zip");
  const countryInfo = await download("countryInfo.txt");
  const citiesTxt = unzip(citiesZip, "cities500.txt");
  const altTxt = unzip(altZip, "alternateNamesV2.txt");

  // ISO <-> country name
  const isoByName = { ...COUNTRY_ALIASES };
  for await (const line of lines(countryInfo)) {
    if (!line || line.startsWith("#")) continue;
    const f = line.split("\t");
    isoByName[f[4]] = f[0];
  }

  // geonameid -> { cc, names:Set(English spellings) }
  const cities = new Map();
  for await (const line of lines(citiesTxt)) {
    const f = line.split("\t");
    cities.set(f[0], { cc: f[8], names: new Set([f[1], f[2]].filter(Boolean)) });
  }
  console.log(`cities500: ${cities.size} places`);

  // Full per-country dumps: every populated place (feature class P).
  const wanted = [...new Set(appCountries().map((en) => isoByName[en]).filter(Boolean))];
  const small = (await inBatches(wanted, PARALLEL, async (cc) => ((await size(`${cc}.zip`)) <= FULL_DUMP_MAX ? cc : null))).filter(Boolean);
  await inBatches(small, PARALLEL, (cc) => download(`${cc}.zip`));
  for (const cc of small) {
    const txt = unzip(path.join(CACHE, `${cc}.zip`), `${cc}.txt`);
    for await (const line of lines(txt)) {
      const f = line.split("	");
      if (f[6] !== "P") continue;
      const c = cities.get(f[0]);
      if (c) continue;
      cities.set(f[0], { cc: f[8], names: new Set([f[1], f[2]].filter(Boolean)) });
    }
  }
  console.log(`+ full dumps of ${small.length} countries: ${cities.size} places (skipped: ${wanted.filter((c) => !small.includes(c)).join(" ")})`);

  // geonameid -> best Arabic name
  const best = new Map(); // id -> { name, rank }
  for await (const line of lines(altTxt)) {
    const f = line.split("\t"); // id, geonameid, lang, name, preferred, short, colloquial, historic, from, to
    if (f[2] !== "ar" || !cities.has(f[1])) continue;
    // Arabic script only (some "ar" rows are Latin, e.g. "Ţūkh"); no Persian letters.
    const name = arabicName(f[3]);
    if (f[6] === "1" || f[7] === "1" || !name) continue;
    const rank = (f[4] === "1" ? 0 : 2) + (f[5] === "1" ? 1 : 0);
    const cur = best.get(f[1]);
    if (!cur || rank < cur.rank) best.set(f[1], { name, rank });
  }
  console.log(`Arabic names for ${best.size} places`);

  // English / Latin alternate names of those places ("Helwan", "Mersa Matruh"),
  // so more spellings of the same place match.
  const LATIN = /^[\p{Script=Latin}\s'’‘\-.()]+$/u;
  for await (const line of lines(altTxt)) {
    const f = line.split("	");
    if ((f[2] !== "en" && f[2] !== "") || !best.has(f[1]) || f[7] === "1" || !LATIN.test(f[3])) continue;
    cities.get(f[1]).names.add(f[3]);
  }

  // Per country: normalized spelling -> Arabic. Places from cities500 (the
  // bigger ones) come first in `cities`, so they win a shared spelling.
  const byCc = {};
  for (const [id, c] of cities) {
    const b = best.get(id);
    if (!b) continue;
    const m = byCc[c.cc] || (byCc[c.cc] = new Map());
    for (const n of c.names) {
      const k = normCity(n);
      if (k && !m.has(k)) m.set(k, b.name);
    }
  }

  // Keep only the cities the app actually lists (countriesnow, the app's
  // source), keyed by the exact spelling it uses.
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const index = {};
  const missing = [];
  const report = [];
  let bytes = 0;
  let listed = 0;
  let named = 0;
  for (const en of appCountries()) {
    const cc = isoByName[en];
    if (!cc) {
      missing.push(en);
      continue;
    }
    const list = await appCityList(en);
    const m = byCc[cc] || new Map();
    const out = {};
    for (const city of list) {
      const ar = m.get(normCity(city));
      if (ar) out[city] = ar;
    }
    const n = Object.keys(out).length;
    listed += list.length;
    named += n;
    report.push(`${cc} ${n}/${list.length}`);
    if (!n) continue;
    index[en] = cc;
    const json = JSON.stringify(out);
    bytes += json.length;
    fs.writeFileSync(path.join(OUT, `${cc}.json`), json);
  }
  fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index));
  console.log(report.join("  "));
  console.log(`Arabic names for ${named} of ${listed} listed cities (${Math.round((named / listed) * 100)}%), ${(bytes / 1024).toFixed(0)} KB`);
  if (missing.length) console.log(`no ISO match (city names stay English): ${missing.join(", ")}`);
}

// A clean Arabic name, or null: Arabic letters only, harakat and tatweel
// removed so the list reads uniformly ("بُرَيدَة" -> "بريدة").
function arabicName(raw) {
  const n = String(raw || "")
    .replace(/[ً-ْٰـ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!n || !/^[؀-ۿ\s\-()'.،]+$/.test(n) || PERSIAN_ONLY.test(n)) return null;
  return n;
}

// Spelling-insensitive key: no diacritics (ţ/ṭ, ā), apostrophes or hyphens.
function normCity(s) {
  return String(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’'`ʻʿʾ]/g, "")
    .replace(/[-_]/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// The country's city list exactly as the app gets it (cached).
async function appCityList(country) {
  const dir = path.join(CACHE, "..", "countriesnow");
  const file = path.join(dir, `${country}.json`);
  if (!fs.existsSync(file)) {
    fs.mkdirSync(dir, { recursive: true });
    const res = await fetch(`https://countriesnow.space/api/v0.1/countries/cities/q?country=${encodeURIComponent(country)}`);
    const json = await res.json().catch(() => ({}));
    fs.writeFileSync(file, JSON.stringify(Array.isArray(json.data) ? [...new Set(json.data)] : []));
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
