function countryLabel(enName) {
  const c = COUNTRIES.find((x) => x.en === enName);
  return c ? itemLabel(c, lang) : enName;
}

// ---- Arabic city labels (Nominatim + local cache) ---------------------------

const cityLabelCache = {};

// Load cached Arabic city labels into memory WITHOUT scanning all of storage on
// every popup open (get(null) would also deserialize the big `cities:<country>`
// arrays). We keep a small `cityLabelsIndex` of countries that have labels and
// read only those keys; a one-time migration builds the index for older installs.
async function loadCityLabelCaches() {
  const { cityLabelsIndex } = await Platform.store.get("cityLabelsIndex");
  if (!Array.isArray(cityLabelsIndex)) {
    const all = await Platform.store.get(null);
    const countries = [];
    for (const [key, value] of Object.entries(all)) {
      if (key.startsWith("cityLabels:") && value && typeof value === "object") {
        const country = key.slice("cityLabels:".length);
        cityLabelCache[country] = value;
        countries.push(country);
      }
    }
    await Platform.store.set({ cityLabelsIndex: countries });
    return;
  }
  if (!cityLabelsIndex.length) return;
  const stored = await Platform.store.get(cityLabelsIndex.map((c) => `cityLabels:${c}`));
  for (const country of cityLabelsIndex) {
    const value = stored[`cityLabels:${country}`];
    if (value && typeof value === "object") cityLabelCache[country] = value;
  }
}

// Real Arabic city names, bundled per country from GeoNames
// (tools/build-city-names.mjs -> city-ar/<ISO>.json). Loaded when a country's
// list is shown in Arabic; null = none bundled for that country.
const bundledCityNames = {};
let bundledCityIndex = null;
async function loadBundledCityNames(country) {
  if (!country) return null;
  if (country in bundledCityNames) return bundledCityNames[country];
  try {
    if (!bundledCityIndex) bundledCityIndex = await (await fetch("city-ar/index.json")).json();
    const cc = bundledCityIndex[country];
    bundledCityNames[country] = cc ? await (await fetch(`city-ar/${cc}.json`)).json() : null;
  } catch {
    bundledCityNames[country] = null;
  }
  return bundledCityNames[country];
}

function cityLabel(cityEn, countryEn) {
  if (lang !== "ar" || !cityEn) return cityEn;
  // GeoNames' Arabic name, else one geocoded for a chosen city; with neither,
  // the original (English) name — never a letter-by-letter guess.
  return bundledCityNames[countryEn]?.[cityEn] || cityLabelCache[countryEn]?.[cityEn] || cityEn;
}

async function fetchCityArabicName(city, country) {
  if (!city || !country) return city;
  const bundled = (await loadBundledCityNames(country))?.[city];
  if (bundled) return bundled;
  if (cityLabelCache[country]?.[city]) return cityLabelCache[country][city];

  try {
    const params = new URLSearchParams({ city, country, format: "json", limit: "1" });
    // The browser forbids setting User-Agent from fetch, so we don't try;
    // Accept-Language steers Nominatim toward the Arabic name.
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { "Accept-Language": "ar" }
    });
    if (!res.ok) return city;
    const data = await res.json();
    const arName = data[0]?.name || city;
    const isNewCountry = !cityLabelCache[country];
    if (!cityLabelCache[country]) cityLabelCache[country] = {};
    cityLabelCache[country][city] = arName;
    const cacheKey = `cityLabels:${country}`;
    const stored = { ...((await Platform.store.get(cacheKey))[cacheKey]), [city]: arName };
    const writes = { [cacheKey]: stored };
    if (isNewCountry) {
      const { cityLabelsIndex } = await Platform.store.get("cityLabelsIndex");
      const idx = Array.isArray(cityLabelsIndex) ? cityLabelsIndex : [];
      if (!idx.includes(country)) writes.cityLabelsIndex = [...idx, country];
    }
    await Platform.store.set(writes);
    return arName;
  } catch {
    return city;
  }
}

function refreshCityOptionLabels(country) {
  for (const opt of el.city.options) {
    if (!opt.value) continue;
    opt.textContent = cityLabel(opt.value, country);
  }
}

async function ensureLocationCityArabic(location) {
  if (!location || location.mode !== "city" || lang !== "ar") return;
  await fetchCityArabicName(location.city, location.country);
  el.locationLabel.textContent = labelFor(location);
  if (el.country.value === location.country) refreshCityOptionLabels(location.country);
}
