// Shared translations + data for both the popup and the background worker.
// Loaded in the popup via <script src="i18n.js"> and in the service worker
// via importScripts("i18n.js"), so everything here is attached to globals.

const I18N = {
  en: {
    dir: "ltr",
    appTitle: "Prayer Times",
    langButton: "العربية",
    noLocation: "No location set",
    nextPrayer: "Next prayer",
    loading: "Loading prayer times…",
    setLocationHint: "Choose your country and city below to load prayer times.",
    settings: "⚙️ Location & settings",
    country: "Country",
    city: "City",
    method: "Calculation method",
    save: "Save & Load",
    useLocation: "📍 Use my location",
    locating: "Locating…",
    selectCountry: "Select a country…",
    selectCity: "Select a city…",
    loadingCities: "Loading cities…",
    citiesFailed: "Couldn't load cities — try another country or check your connection.",
    errFields: "Please choose both a country and a city.",
    errNotFound: "Location not found. Try a different city.",
    errGeneric: "Could not load prayer times.",
    errNoGeo: "Geolocation is not available here.",
    errGeoFail: (m) => `Location access failed: ${m}`,
    allDone: "All prayers done for today 🌙",
    fajrTomorrow: "Fajr (tomorrow)",
    countdown: (h, m, s) => `in ${h}h ${pad(m)}m ${pad(s)}s`,
    dataSource: "Data: AlAdhan API",
    ahLabel: "AH",
    notifTitle: (p) => `${p} — Prayer Time`,
    notifBody: (p) => `It is now time for ${p}. حَيَّ عَلَى الصَّلَاة`,
    prayers: {
      Fajr: "Fajr", Sunrise: "Sunrise", Dhuhr: "Dhuhr",
      Asr: "Asr", Maghrib: "Maghrib", Isha: "Isha"
    }
  },
  ar: {
    dir: "rtl",
    appTitle: "مواقيت الصلاة",
    langButton: "English",
    noLocation: "لم يتم تحديد الموقع",
    nextPrayer: "الصلاة القادمة",
    loading: "جارٍ تحميل المواقيت…",
    setLocationHint: "اختر دولتك ومدينتك بالأسفل لعرض مواقيت الصلاة.",
    settings: "⚙️ الموقع والإعدادات",
    country: "الدولة",
    city: "المدينة",
    method: "طريقة الحساب",
    save: "حفظ وتحميل",
    useLocation: "📍 استخدم موقعي",
    locating: "جارٍ تحديد الموقع…",
    selectCountry: "اختر دولة…",
    selectCity: "اختر مدينة…",
    loadingCities: "جارٍ تحميل المدن…",
    citiesFailed: "تعذّر تحميل المدن — جرّب دولة أخرى أو تحقّق من اتصالك.",
    errFields: "يرجى اختيار الدولة والمدينة.",
    errNotFound: "لم يتم العثور على الموقع. جرّب مدينة أخرى.",
    errGeneric: "تعذّر تحميل مواقيت الصلاة.",
    errNoGeo: "تحديد الموقع غير متاح هنا.",
    errGeoFail: (m) => `فشل الوصول إلى الموقع: ${m}`,
    allDone: "انتهت صلوات اليوم 🌙",
    fajrTomorrow: "الفجر (غدًا)",
    countdown: (h, m, s) => `بعد ${h}س ${pad(m)}د ${pad(s)}ث`,
    dataSource: "المصدر: AlAdhan API",
    ahLabel: "هـ",
    notifTitle: (p) => `حان وقت صلاة ${p}`,
    notifBody: (p) => `حان الآن وقت صلاة ${p}. حَيَّ عَلَى الصَّلَاة`,
    prayers: {
      Fajr: "الفجر", Sunrise: "الشروق", Dhuhr: "الظهر",
      Asr: "العصر", Maghrib: "المغرب", Isha: "العشاء"
    }
  }
};

function pad(n) {
  return String(n).padStart(2, "0");
}

// Map Western digits 0-9 to Arabic-Indic ٠-٩ (used for times/dates in Arabic mode).
const AR_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
function toArabicDigits(str) {
  return String(str).replace(/[0-9]/g, (d) => AR_DIGITS[Number(d)]);
}

// Returns the dictionary for a language, falling back to English.
function tr(lang) {
  return I18N[lang] || I18N.en;
}

// Curated countries. `en` is sent to both APIs (which expect English names);
// `ar` is only the label shown in Arabic mode.
const COUNTRIES = [
  { en: "Afghanistan", ar: "أفغانستان" },
  { en: "Albania", ar: "ألبانيا" },
  { en: "Algeria", ar: "الجزائر" },
  { en: "Argentina", ar: "الأرجنتين" },
  { en: "Australia", ar: "أستراليا" },
  { en: "Austria", ar: "النمسا" },
  { en: "Azerbaijan", ar: "أذربيجان" },
  { en: "Bahrain", ar: "البحرين" },
  { en: "Bangladesh", ar: "بنغلاديش" },
  { en: "Belgium", ar: "بلجيكا" },
  { en: "Bosnia and Herzegovina", ar: "البوسنة والهرسك" },
  { en: "Brazil", ar: "البرازيل" },
  { en: "Brunei", ar: "بروناي" },
  { en: "Canada", ar: "كندا" },
  { en: "China", ar: "الصين" },
  { en: "Denmark", ar: "الدنمارك" },
  { en: "Egypt", ar: "مصر" },
  { en: "France", ar: "فرنسا" },
  { en: "Germany", ar: "ألمانيا" },
  { en: "India", ar: "الهند" },
  { en: "Indonesia", ar: "إندونيسيا" },
  { en: "Iran", ar: "إيران" },
  { en: "Iraq", ar: "العراق" },
  { en: "Italy", ar: "إيطاليا" },
  { en: "Japan", ar: "اليابان" },
  { en: "Jordan", ar: "الأردن" },
  { en: "Kazakhstan", ar: "كازاخستان" },
  { en: "Kenya", ar: "كينيا" },
  { en: "Kuwait", ar: "الكويت" },
  { en: "Kyrgyzstan", ar: "قيرغيزستان" },
  { en: "Lebanon", ar: "لبنان" },
  { en: "Libya", ar: "ليبيا" },
  { en: "Malaysia", ar: "ماليزيا" },
  { en: "Maldives", ar: "المالديف" },
  { en: "Mauritania", ar: "موريتانيا" },
  { en: "Morocco", ar: "المغرب" },
  { en: "Netherlands", ar: "هولندا" },
  { en: "Nigeria", ar: "نيجيريا" },
  { en: "Norway", ar: "النرويج" },
  { en: "Oman", ar: "عُمان" },
  { en: "Pakistan", ar: "باكستان" },
  { en: "Palestine", ar: "فلسطين" },
  { en: "Philippines", ar: "الفلبين" },
  { en: "Qatar", ar: "قطر" },
  { en: "Russia", ar: "روسيا" },
  { en: "Saudi Arabia", ar: "السعودية" },
  { en: "Senegal", ar: "السنغال" },
  { en: "Singapore", ar: "سنغافورة" },
  { en: "Somalia", ar: "الصومال" },
  { en: "South Africa", ar: "جنوب أفريقيا" },
  { en: "Spain", ar: "إسبانيا" },
  { en: "Sri Lanka", ar: "سريلانكا" },
  { en: "Sudan", ar: "السودان" },
  { en: "Sweden", ar: "السويد" },
  { en: "Switzerland", ar: "سويسرا" },
  { en: "Syria", ar: "سوريا" },
  { en: "Tajikistan", ar: "طاجيكستان" },
  { en: "Thailand", ar: "تايلاند" },
  { en: "Tunisia", ar: "تونس" },
  { en: "Turkey", ar: "تركيا" },
  { en: "Turkmenistan", ar: "تركمانستان" },
  { en: "Ukraine", ar: "أوكرانيا" },
  { en: "United Arab Emirates", ar: "الإمارات العربية المتحدة" },
  { en: "United Kingdom", ar: "المملكة المتحدة" },
  { en: "United States", ar: "الولايات المتحدة" },
  { en: "Uzbekistan", ar: "أوزبكستان" },
  { en: "Yemen", ar: "اليمن" }
];

// AlAdhan calculation methods (id + bilingual label).
const METHODS = [
  { id: 2, en: "ISNA (North America)", ar: "ISNA (أمريكا الشمالية)" },
  { id: 3, en: "Muslim World League", ar: "رابطة العالم الإسلامي" },
  { id: 4, en: "Umm al-Qura (Makkah)", ar: "أم القرى (مكة)" },
  { id: 5, en: "Egyptian General Authority", ar: "الهيئة المصرية العامة للمساحة" },
  { id: 1, en: "University of Karachi", ar: "جامعة كراتشي" },
  { id: 8, en: "Gulf Region", ar: "منطقة الخليج" },
  { id: 9, en: "Kuwait", ar: "الكويت" },
  { id: 10, en: "Qatar", ar: "قطر" },
  { id: 11, en: "Singapore (MUIS)", ar: "سنغافورة (MUIS)" },
  { id: 12, en: "Union Islamique de France", ar: "اتحاد المنظمات الإسلامية بفرنسا" },
  { id: 13, en: "Diyanet (Turkey)", ar: "ديانة (تركيا)" },
  { id: 14, en: "Spiritual Admin. of Russia", ar: "الإدارة الروحية لمسلمي روسيا" },
  { id: 0, en: "Shia Ithna-Ashari", ar: "الشيعة الإثنا عشرية" }
];
