// ---- Select population ------------------------------------------------------

function placeholderOption(text) {
  const o = document.createElement("option");
  o.value = "";
  o.textContent = text;
  return o;
}

function populateCountrySelect() {
  const current = el.country.value;
  el.country.innerHTML = "";
  el.country.appendChild(placeholderOption(T().selectCountry));
  // Sort by the label shown in the active language.
  const sorted = [...COUNTRIES].sort((a, b) =>
    itemLabel(a, lang).localeCompare(itemLabel(b, lang), T().locale || lang)
  );
  for (const c of sorted) {
    const o = document.createElement("option");
    o.value = c.en;
    o.textContent = itemLabel(c, lang);
    el.country.appendChild(o);
  }
  el.country.value = current;
}

function populateMethodSelect() {
  const current = el.method.value;
  el.method.innerHTML = "";
  for (const m of METHODS) {
    const o = document.createElement("option");
    o.value = m.value;
    o.textContent = itemLabel(m, lang);
    el.method.appendChild(o);
  }
  if (current) el.method.value = current;
}

function populateDateFormatSelect() {
  const current = el.dateFormat.value || dateFormat;
  el.dateFormat.innerHTML = "";
  for (const f of DATE_FORMATS) {
    const o = document.createElement("option");
    o.value = f.value;
    o.textContent = itemLabel(f, lang);
    el.dateFormat.appendChild(o);
  }
  el.dateFormat.value = DATE_FORMATS.some((f) => f.value === current)
    ? current
    : DEFAULT_DATE_FORMAT;
}

// Visual order of the 3x2 picker (physical screen layout), independent of the
// TASBIH_POSITIONS array order so each tile sits in its real screen corner.
const POSITION_GRID_ORDER = [
  "top-left", "top-center", "top-right",
  "bottom-left", "bottom-center", "bottom-right"
];

function renderTasbihPositionGrid() {
  const current = normalizeTasbihPosition(tasbihPosition);
  const byKey = new Map(TASBIH_POSITIONS.map((p) => [p.key, p]));
  el.tasbihPosition.replaceChildren();
  for (const key of POSITION_GRID_ORDER) {
    const p = byKey.get(key);
    if (!p) continue;
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "pos-tile";
    tile.dataset.pos = key;
    tile.setAttribute("role", "radio");
    const selected = key === current;
    tile.setAttribute("aria-checked", selected ? "true" : "false");
    tile.tabIndex = selected ? 0 : -1;
    const label = itemLabel(p, lang);
    tile.setAttribute("aria-label", label);
    tile.title = label;
    const dot = document.createElement("span");
    dot.className = "pos-dot";
    tile.appendChild(dot);
    tile.addEventListener("click", () => selectTasbihPosition(key));
    el.tasbihPosition.appendChild(tile);
  }
  tasbihPosition = current;
}

async function selectTasbihPosition(key) {
  tasbihPosition = normalizeTasbihPosition(key);
  for (const tile of el.tasbihPosition.querySelectorAll(".pos-tile")) {
    const on = tile.dataset.pos === tasbihPosition;
    tile.setAttribute("aria-checked", on ? "true" : "false");
    tile.tabIndex = on ? 0 : -1;
  }
  await saveTasbihSettings();
  showError("");
}

function gregorianParts(gregorian) {
  if (!gregorian?.date) return null;
  const [dd, mm, yy] = String(gregorian.date).split("-").map(Number);
  if (!dd || !mm || !yy) return null;
  return { dd, mm, yy };
}

function formatDateDisplay(parts, formatId, monthLong) {
  const d = pad(Number(parts.dd));
  const m = pad(Number(parts.mm));
  const y = String(parts.yy);

  switch (formatId) {
    case "dd-mm-yyyy":
      return `${d}-${m}-${y}`;
    case "dd/MM/yyyy":
      return `${d}/${m}/${y}`;
    case "dd-MMMM-yyyy":
      return `${d} ${monthLong} ${y}`;
    case "MMMM-dd-yyyy":
      return `${monthLong}-${d}-${y}`;
    case "dd-mmMMMM-yyyy":
      return `${d}-${m} ${monthLong}-${y}`;
    case "dd-MMMM-yyyy":
    default:
      // Clean readable "10 April 2026".
      return `${d} ${monthLong} ${y}`;
  }
}

function formatGregorianDate(parts, formatId) {
  if (!parts) return "";
  if (formatId === "readable") return null;

  const locale = T().locale || (lang === "ar" ? "ar" : "en");
  const monthLong = monthName(lang, locale, new Date(parts.yy, parts.mm - 1, parts.dd));
  return formatDateDisplay(parts, formatId, monthLong);
}

function hijriParts(hijri) {
  if (!hijri?.day || !hijri?.month || !hijri?.year) return null;
  const mm = Number(hijri.month.number);
  const dd = Number(hijri.day);
  const yy = Number(hijri.year);
  if (!dd || !mm || !yy) return null;
  return { dd, mm, yy };
}

function formatHijriDate(hijri, formatId) {
  const parts = hijriParts(hijri);
  if (!parts) return "";

  const monthLong = lang === "ar" ? hijri.month.ar : hijri.month.en;
  if (formatId === "readable") {
    const desig = lang === "ar" ? T().ahLabel : (hijri.designation?.abbreviated || "AH");
    return `${hijri.day} ${monthLong} ${hijri.year} ${desig}`;
  }

  return formatDateDisplay(parts, formatId, monthLong);
}

async function getCities(country) {
  const key = `cities:${country}`;
  const cached = (await Platform.store.get(key))[key];
  if (Array.isArray(cached) && cached.length) return cached;
  try {
    const res = await fetch(`${CITIES_API}?country=${encodeURIComponent(country)}`);
    const json = await res.json();
    if (json.error || !Array.isArray(json.data) || !json.data.length) return null;
    const cities = [...new Set(json.data)].sort((a, b) => a.localeCompare(b));
    await Platform.store.set({ [key]: cities });
    return cities;
  } catch {
    return null;
  }
}

// Loads the city dropdown for the chosen country; optionally pre-selects one.
async function loadCities(preselect) {
  const country = el.country.value;
  el.city.innerHTML = "";
  if (!country) {
    el.city.appendChild(placeholderOption(T().selectCity));
    el.city.disabled = true;
    citiesLoadedForCountry = null;
    return;
  }
  el.city.disabled = true;
  el.city.appendChild(placeholderOption(T().loadingCities));

  const cities = await getCities(country);
  el.city.innerHTML = "";

  if (!cities) {
    el.city.appendChild(placeholderOption(T().citiesFailed));
    el.city.disabled = true;
    citiesLoadedForCountry = null;
    showError(T().citiesFailed);
    return;
  }

  el.city.appendChild(placeholderOption(T().selectCity));
  if (lang === "ar") await loadBundledCityNames(country);
  // In Arabic, sort by the Arabic name; cities with no Arabic name (shown in
  // English) come after them.
  // The source lists some places under two spellings (Assiut / Asyūţ); in
  // Arabic both read "أسيوط", so show it once (keeping the preselected one).
  const seen = new Set();
  let rows = cities.map((c) => ({ c, label: cityLabel(c, country) }));
  if (lang === "ar") {
    rows = rows
      .sort((a, b) => Number(b.c === preselect) - Number(a.c === preselect))
      .filter(({ label }) => (seen.has(label) ? false : seen.add(label)));
  }
  if (lang === "ar") {
    const isAr = (t) => /[؀-ۿ]/.test(t);
    rows.sort((a, b) => Number(!isAr(a.label)) - Number(!isAr(b.label)) || a.label.localeCompare(b.label, "ar"));
  }
  const frag = document.createDocumentFragment();
  for (const { c, label } of rows) {
    const o = document.createElement("option");
    o.value = c;
    o.textContent = label;
    frag.appendChild(o);
  }
  el.city.appendChild(frag);
  el.city.disabled = false;
  citiesLoadedForCountry = country;
  if (preselect) el.city.value = preselect;
  if (lang === "ar" && preselect) {
    await fetchCityArabicName(preselect, country);
    refreshCityOptionLabels(country);
  }
}
