// prayer-engine.js — offline prayer-time engine wrapping adhan-js, with
// tz-lookup for the location's timezone. It produces the SAME data shape the
// code previously fetched from the Aladhan API, so popup.js / background.js
// consume it unchanged (timings as "HH:MM" in the location tz + gregorian/hijri
// date + meta.timezone).
//
// Requires the vendored globals (loaded first): `adhan` (vendor/adhan.js) and
// `tzlookup` (vendor/tz-lookup.js). Pure compute — no chrome.*, no network.

// Aladhan method number -> adhan CalculationParameters. Methods adhan ships
// directly use the factory; the rest use Other() with the angles/intervals
// Aladhan documents for that method.
function adhanParamsForMethod(method) {
  const CM = adhan.CalculationMethod;
  switch (Number(method)) {
    case 1: return CM.Karachi();
    case 2: return CM.NorthAmerica(); // ISNA
    case 3: return CM.MuslimWorldLeague();
    case 4: return CM.UmmAlQura();
    case 5: return CM.Egyptian();
    case 9: return CM.Kuwait();
    case 10: return CM.Qatar();
    case 11: return CM.Singapore();
    case 13: return CM.Turkey(); // Diyanet
    case 15: return CM.MoonsightingCommittee();
    case 16: return CM.Dubai();
    case 8: return otherParams(19.5, null, 90); // Gulf Region (Isha 90 min)
    case 12: return otherParams(12, 12); // Union Islamique de France
    case 14: return otherParams(16, 15); // Spiritual Admin. of Russia
    case 17: return otherParams(20, 18); // JAKIM (Malaysia)
    case 18: return otherParams(18, 18); // Tunisia
    case 19: return otherParams(18, 17); // Algeria
    case 20: return otherParams(20, 18); // Kemenag (Indonesia)
    case 21: return otherParams(19, 17); // Morocco
    case 23: return otherParams(18, 18); // Jordan (Awqaf)
    default: return CM.UmmAlQura();
  }
}

function otherParams(fajrAngle, ishaAngle, ishaInterval) {
  const p = adhan.CalculationMethod.Other();
  p.fajrAngle = fajrAngle;
  if (ishaInterval) {
    p.ishaInterval = ishaInterval;
    p.ishaAngle = 0;
  } else {
    p.ishaAngle = ishaAngle;
  }
  return p;
}

// IANA timezone for coordinates, falling back to the device timezone if the
// lookup fails (e.g. mid-ocean coords).
function tzForCoords(lat, lon) {
  try {
    return tzlookup(lat, lon);
  } catch {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
}

function fmtHM(date, tz) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function hijriMonthName(date, tz, lang) {
  const loc = lang === "ar" ? "ar-u-ca-islamic-umalqura" : "en-u-ca-islamic-umalqura";
  return new Intl.DateTimeFormat(loc, { timeZone: tz, month: "long" }).format(date);
}

// Build the gregorian + hijri date block in the Aladhan shape, computed in `tz`.
function dateBlock(date, tz) {
  const g = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date); // "DD/MM/YYYY"
  const [dd, mm, yy] = g.split("/");
  const gregorian = { date: `${dd}-${mm}-${yy}` };

  const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
    timeZone: tz,
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const hijri = {
    day: String(Number(get("day"))),
    month: {
      number: Number(get("month")),
      en: hijriMonthName(date, tz, "en"),
      ar: hijriMonthName(date, tz, "ar"),
    },
    year: String(Number(get("year"))),
    designation: { abbreviated: "AH" },
  };
  return { readable: gregorian.date, gregorian, hijri };
}

// timings(location, date) -> Aladhan-compatible payload. `location` must carry
// numeric latitude/longitude (city mode resolves these when the city is picked).
function timings(location, date = new Date()) {
  const lat = Number(location.latitude);
  const lon = Number(location.longitude);
  const tz = tzForCoords(lat, lon);
  const params = adhanParamsForMethod(location.method);
  // At high latitudes the sun may never reach the Fajr/Isha twilight angle;
  // Aladhan applies an angle-based adjustment by default, so match it.
  params.highLatitudeRule = adhan.HighLatitudeRule.TwilightAngle;
  const pt = new adhan.PrayerTimes(new adhan.Coordinates(lat, lon), date, params);
  return {
    timings: {
      Fajr: fmtHM(pt.fajr, tz),
      Sunrise: fmtHM(pt.sunrise, tz),
      Dhuhr: fmtHM(pt.dhuhr, tz),
      Asr: fmtHM(pt.asr, tz),
      Maghrib: fmtHM(pt.maghrib, tz),
      Isha: fmtHM(pt.isha, tz),
    },
    date: dateBlock(date, tz),
    meta: { timezone: tz },
  };
}

// Qibla bearing (degrees from true north) for the location's coordinates.
function qibla(location) {
  return adhan.Qibla(
    new adhan.Coordinates(Number(location.latitude), Number(location.longitude))
  );
}

const PrayerEngine = { timings, qibla, adhanParamsForMethod, tzForCoords };
