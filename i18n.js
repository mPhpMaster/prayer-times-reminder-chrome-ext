// Shared translations + data for both the popup and the background worker.
// Loaded in the popup via <script src="i18n.js"> and in the service worker
// via importScripts("i18n.js"), so everything here is attached to globals.

const I18N = {
    en: {
        dir: "ltr",
        locale: "en",
        appTitle: "Prayer Times",
        prayerBreak: "Prayer Times Break: when prayer time arrives, your open tabs lock so you can step away and pray.",
        noLocation: "No location set",
        nextPrayer: "Next prayer",
        loading: "Loading prayer times…",
        setLocationHint: "Open settings to choose your country and city.",
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
        countdownHours: "HOURS",
        countdownMin: "MIN",
        countdownSec: "SEC",
        dataSource: "Data: AlAdhan API",
        ahLabel: "AH",
        notifTitle: (p) => `${p} — Prayer Time`,
        notifBody: (p) => `It is now time for ${p}. حَيَّ عَلَى الصَّلَاة`,
        tabLockLabel: "Lock tab during prayer",
        tabLockHint: "Blocks the active browser tab for the set duration when prayer time arrives.",
        lockMinutesLabel: "Lock duration (minutes)",
        allowUnlockLabel: "Allow manual unlock",
        allowUnlockHint: "Shows a close button on the lock screen to dismiss it early.",
        unlockTab: "Unlock tab",
        testLockBtn: "Test tab lock",
        testLockPrayer: "Test Prayer",
        lockTitle: (p) => `It is time for ${p}`,
        lockSubtitle: "This tab is locked so you can focus on prayer. It will unlock automatically when the timer ends.",
        lockCountdown: "Tab unlocks in",
        errLockTab: "Could not lock this tab. Try a normal website (not chrome:// pages).",
        tasbihLabel: "Periodic dhikr reminder",
        tasbihHint: "Shows a random dhikr on the active tab while you browse. Tap to dismiss.",
        tasbihFixed: "Every X minutes",
        tasbihRandom: "Random interval",
        tasbihMinutesLabel: "Interval (minutes)",
        tasbihMinLabel: "Minimum (minutes)",
        tasbihMaxLabel: "Maximum (minutes)",
        tasbihPositionLabel: "On-screen position",
        tasbihCardLabel: "Dhikr",
        testTasbihBtn: "Test dhikr",
        errTasbihTab: "Could not show dhikr on this tab. Try a normal website (not chrome:// pages).",
        welcomeTitle: "Prayer Times is installed",
        welcomeLead: "Pin the extension to your toolbar so prayer times are always one click away.",
        welcomePinTitle: "How to pin",
        welcomePinStep1: "Click the Extensions menu (puzzle icon) in the Chrome toolbar.",
        welcomePinStep2: "Find Prayer Times Reminder in the list.",
        welcomePinStep3: "Click Pin to toolbar (or the pin icon).",
        welcomeNotifTitle: "Pin Prayer Times",
        welcomeNotifBody: "Open the Extensions menu and pin Prayer Times to the toolbar for quick access.",
        openSettings: "⚙️ Settings",
        settingsTitle: "Settings",
        next: "Next",
        finish: "Finish",
        locationLabel: "Location",
        back: "← Back",
        digitsLabel: "Number style",
        digitsArabic: "Arabic (٠١٢٣)",
        digitsWestern: "English (0123)",
        dateFormatLabel: "Date format",
        settingsLangLabel: "Language",
        themeLabel: "Theme",
        themeClassic: "Classic",
        themeMidnightEmerald: "Midnight Emerald",
        prayers: {
            Fajr: "Fajr",
            Sunrise: "Sunrise",
            Duha: "Duha",
            Dhuhr: "Dhuhr",
            Jumuah: "Jumu'ah",
            Asr: "Asr",
            Maghrib: "Maghrib",
            Isha: "Isha"
        }
    },
    ar: {
        dir: "rtl",
        locale: "ar",
        appTitle: "مواقيت الصلاة",
        prayerBreak: "استراحة مواقيت الصلاة: عند حلول وقت الصلاة، تُقفل تبويباتك المفتوحة لتبتعد عن الشاشة وتؤدّي الصلاة.",
        noLocation: "لم يتم تحديد الموقع",
        nextPrayer: "الصلاة القادمة",
        loading: "جارٍ تحميل المواقيت…",
        setLocationHint: "افتح الإعدادات لاختيار دولتك ومدينتك.",
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
        countdownHours: "ساعات",
        countdownMin: "دقيقة",
        countdownSec: "ثانية",
        dataSource: "المصدر: AlAdhan API",
        ahLabel: "هـ",
        notifTitle: (p) => `حان وقت صلاة ${p}`,
        notifBody: (p) => `حان الآن وقت صلاة ${p}. حَيَّ عَلَى الصَّلَاة`,
        tabLockLabel: "قفل التبويب أثناء الصلاة",
        tabLockHint: "يمنع استخدام التبويب النشط للمدة المحددة عند حلول وقت الصلاة.",
        lockMinutesLabel: "مدة القفل (دقائق)",
        allowUnlockLabel: "السماح بفتح التبويب يدويًا",
        allowUnlockHint: "يعرض زر إغلاق على شاشة القفل لإلغائها مبكرًا.",
        unlockTab: "فتح التبويب",
        testLockBtn: "تجربة قفل التبويب",
        testLockPrayer: "تجربة",
        lockTitle: (p) => `حان وقت صلاة ${p}`,
        lockSubtitle: "تم قفل هذا التبويب لمساعدتك على التركيز في الصلاة. سيتم فتحه تلقائيًا عند انتهاء المؤقت.",
        lockCountdown: "يفتح التبويب بعد",
        errLockTab: "تعذّر قفل هذا التبويب. جرّب موقعًا عاديًا (وليس صفحات chrome://).",
        tasbihLabel: "التسبيح الدوري",
        tasbihHint: "يعرض تسبيحة عشوائية في التبويب النشط أثناء التصفح. انقر لإخفائها.",
        tasbihFixed: "كل X دقيقة",
        tasbihRandom: "فترة عشوائية",
        tasbihMinutesLabel: "الفترة (دقائق)",
        tasbihMinLabel: "الحد الأدنى (دقائق)",
        tasbihMaxLabel: "الحد الأقصى (دقائق)",
        tasbihPositionLabel: "مكان الظهور في الصفحة",
        tasbihCardLabel: "تسبيح",
        testTasbihBtn: "تجربة التسبيح",
        errTasbihTab: "تعذّر عرض التسبيح في هذا التبويب. جرّب موقعًا عاديًا (وليس صفحات chrome://).",
        welcomeTitle: "تم تثبيت مواقيت الصلاة",
        welcomeLead: "ثبّت الإضافة في شريط الأدوات لتصل إلى المواقيت بنقرة واحدة.",
        welcomePinTitle: "طريقة التثبيت",
        welcomePinStep1: "انقر على قائمة الإضافات (أيقونة اللغز) في شريط Chrome.",
        welcomePinStep2: "ابحث عن مواقيت الصلاة في القائمة.",
        welcomePinStep3: "انقر تثبيت في شريط الأدوات (أو أيقونة الدبوس).",
        welcomeNotifTitle: "ثبّت مواقيت الصلاة",
        welcomeNotifBody: "افتح قائمة الإضافات وثبّت مواقيت الصلاة في شريط الأدوات للوصول السريع.",
        openSettings: "⚙️ الإعدادات",
        settingsTitle: "الإعدادات",
        next: "التالي",
        finish: "إنهاء",
        locationLabel: "الموقع",
        back: "رجوع ←",
        digitsLabel: "شكل الأرقام",
        digitsArabic: "عربية (٠١٢٣)",
        digitsWestern: "إنجليزية (0123)",
        dateFormatLabel: "تنسيق التاريخ",
        settingsLangLabel: "اللغة",
        themeLabel: "المظهر",
        themeClassic: "كلاسيكي",
        themeMidnightEmerald: "منتصف الليل الزمردي",
        prayers: {
            Fajr: "الفجر",
            Sunrise: "الشروق",
            Duha: "الضحى",
            Dhuhr: "الظهر",
            Jumuah: "الجمعة",
            Asr: "العصر",
            Maghrib: "المغرب",
            Isha: "العشاء"
        }
    },
    ur: {
        dir: "rtl",
        locale: "ur-PK",
        appTitle: "اوقاتِ نماز",
        prayerBreak: "اوقاتِ نماز کا وقفہ: جب نماز کا وقت آتا ہے تو آپ کے کھلے ٹیبز لاک ہو جاتے ہیں تاکہ آپ اسکرین سے ہٹ کر نماز پڑھ سکیں۔",
        noLocation: "کوئی مقام منتخب نہیں",
        nextPrayer: "اگلی نماز",
        loading: "اوقاتِ نماز لوڈ ہو رہے ہیں…",
        setLocationHint: "اپنا ملک اور شہر منتخب کرنے کے لیے سیٹنگز کھولیں۔",
        settings: "⚙️ مقام اور سیٹنگز",
        country: "ملک",
        city: "شہر",
        method: "حساب کا طریقہ",
        save: "محفوظ کریں اور لوڈ کریں",
        useLocation: "📍 میرا مقام استعمال کریں",
        locating: "مقام معلوم کیا جا رہا ہے…",
        selectCountry: "ملک منتخب کریں…",
        selectCity: "شہر منتخب کریں…",
        loadingCities: "شہر لوڈ ہو رہے ہیں…",
        citiesFailed: "شہر لوڈ نہ ہو سکے — کوئی دوسرا ملک آزمائیں یا اپنا کنکشن چیک کریں۔",
        errFields: "براہِ کرم ملک اور شہر دونوں منتخب کریں۔",
        errNotFound: "مقام نہیں ملا۔ کوئی اور شہر آزمائیں۔",
        errGeneric: "اوقاتِ نماز لوڈ نہ ہو سکے۔",
        errNoGeo: "یہاں جغرافیائی مقام دستیاب نہیں ہے۔",
        errGeoFail: (m) => `مقام تک رسائی ناکام: ${m}`,
        allDone: "آج کی تمام نمازیں مکمل ہو گئیں 🌙",
        fajrTomorrow: "فجر (کل)",
        countdown: (h, m, s) => `${h} گھنٹے ${pad(m)} منٹ ${pad(s)} سیکنڈ میں`,
        countdownHours: "گھنٹے",
        countdownMin: "منٹ",
        countdownSec: "سیکنڈ",
        dataSource: "ماخذ: AlAdhan API",
        ahLabel: "ھ",
        notifTitle: (p) => `${p} — نماز کا وقت`,
        notifBody: (p) => `اب ${p} کا وقت ہے۔ حَيَّ عَلَى الصَّلَاة`,
        tabLockLabel: "نماز کے دوران ٹیب لاک کریں",
        tabLockHint: "نماز کے وقت آنے پر مقررہ مدت کے لیے فعال براؤزر ٹیب کو بلاک کرتا ہے۔",
        lockMinutesLabel: "لاک کی مدت (منٹ)",
        allowUnlockLabel: "دستی طور پر ان لاک کی اجازت دیں",
        allowUnlockHint: "لاک اسکرین پر بند کرنے کا بٹن دکھاتا ہے تاکہ اسے پہلے ختم کیا جا سکے۔",
        unlockTab: "ٹیب ان لاک کریں",
        testLockBtn: "ٹیب لاک آزمائیں",
        testLockPrayer: "ٹیسٹ نماز",
        lockTitle: (p) => `${p} کا وقت ہو گیا ہے`,
        lockSubtitle: "یہ ٹیب لاک ہے تاکہ آپ نماز پر توجہ دے سکیں۔ ٹائمر ختم ہوتے ہی یہ خودکار طور پر ان لاک ہو جائے گا۔",
        lockCountdown: "ٹیب اتنے وقت میں ان لاک ہوگا",
        errLockTab: "اس ٹیب کو لاک نہیں کیا جا سکا۔ عام ویب سائٹ آزمائیں (chrome:// صفحات نہیں)۔",
        tasbihLabel: "وقفے وقفے سے ذکر کی یاددہانی",
        tasbihHint: "براؤزنگ کے دوران فعال ٹیب پر ایک بے ترتیب ذکر دکھاتا ہے۔ ہٹانے کے لیے کلک کریں۔",
        tasbihCardLabel: "ذکر",
        tasbihFixed: "ہر X منٹ بعد",
        tasbihRandom: "بے ترتیب وقفہ",
        tasbihMinutesLabel: "وقفہ (منٹ)",
        tasbihMinLabel: "کم از کم (منٹ)",
        tasbihMaxLabel: "زیادہ سے زیادہ (منٹ)",
        tasbihPositionLabel: "اسکرین پر مقام",
        testTasbihBtn: "ذکر آزمائیں",
        errTasbihTab: "اس ٹیب پر ذکر دکھایا نہیں جا سکا۔ عام ویب سائٹ آزمائیں (chrome:// صفحات نہیں)۔",
        welcomeTitle: "اوقاتِ نماز انسٹال ہو گیا",
        welcomeLead: "ایکسٹینشن کو ٹول بار میں پن کریں تاکہ اوقاتِ نماز ہمیشہ ایک کلک کی دوری پر ہوں۔",
        welcomePinTitle: "پن کیسے کریں",
        welcomePinStep1: "Chrome ٹول بار میں Extensions مینو (پزل آئیکن) پر کلک کریں۔",
        welcomePinStep2: "فہرست میں Prayer Times Reminder تلاش کریں۔",
        welcomePinStep3: "Pin to toolbar (یا پن آئیکن) پر کلک کریں۔",
        welcomeNotifTitle: "Prayer Times کو پن کریں",
        welcomeNotifBody: "فوری رسائی کے لیے Extensions مینو کھولیں اور Prayer Times کو ٹول بار میں پن کریں۔",
        openSettings: "⚙️ سیٹنگز",
        settingsTitle: "سیٹنگز",
        next: "اگلا",
        finish: "مکمل",
        locationLabel: "مقام",
        back: "← واپس",
        digitsLabel: "اعداد کی طرز",
        digitsArabic: "عربی (٠١٢٣)",
        digitsWestern: "انگریزی (0123)",
        dateFormatLabel: "تاریخ کی ترتیب",
        settingsLangLabel: "زبان",
        themeLabel: "تھیم",
        themeClassic: "کلاسک",
        themeMidnightEmerald: "مڈنائٹ ایمرلڈ",
        prayers: {
            Fajr: "فجر",
            Sunrise: "طلوعِ آفتاب",
            Duha: "چاشت",
            Dhuhr: "ظہر",
            Jumuah: "جمعہ",
            Asr: "عصر",
            Maghrib: "مغرب",
            Isha: "عشاء"
        }
    },
    fr: {
        dir: "ltr",
        locale: "fr-FR",
        appTitle: "Heures de prière",
        prayerBreak: "Pause des heures de prière : à l'heure de la prière, vos onglets ouverts se verrouillent pour vous permettre de vous éloigner et de prier.",
        noLocation: "Aucun lieu défini",
        nextPrayer: "Prochaine prière",
        loading: "Chargement des heures de prière…",
        setLocationHint: "Ouvrez les paramètres pour choisir votre pays et votre ville.",
        settings: "⚙️ Lieu et paramètres",
        country: "Pays",
        city: "Ville",
        method: "Méthode de calcul",
        save: "Enregistrer et charger",
        useLocation: "📍 Utiliser ma position",
        locating: "Localisation en cours…",
        selectCountry: "Sélectionnez un pays…",
        selectCity: "Sélectionnez une ville…",
        loadingCities: "Chargement des villes…",
        citiesFailed: "Impossible de charger les villes — essayez un autre pays ou vérifiez votre connexion.",
        errFields: "Veuillez choisir à la fois un pays et une ville.",
        errNotFound: "Lieu introuvable. Essayez une autre ville.",
        errGeneric: "Impossible de charger les heures de prière.",
        errNoGeo: "La géolocalisation n'est pas disponible ici.",
        errGeoFail: (m) => `Échec de l'accès à la localisation : ${m}`,
        allDone: "Toutes les prières d'aujourd'hui sont terminées 🌙",
        fajrTomorrow: "Fajr (demain)",
        countdown: (h, m, s) => `dans ${h}h ${pad(m)}min ${pad(s)}s`,
        countdownHours: "HEURES",
        countdownMin: "MIN",
        countdownSec: "SEC",
        dataSource: "Données : API AlAdhan",
        ahLabel: "AH",
        notifTitle: (p) => `${p} — Heure de prière`,
        notifBody: (p) => `C'est maintenant l'heure de ${p}. حَيَّ عَلَى الصَّلَاة`,
        tabLockLabel: "Verrouiller l'onglet pendant la prière",
        tabLockHint: "Bloque l'onglet actif pendant la durée définie lorsque l'heure de la prière arrive.",
        lockMinutesLabel: "Durée du verrouillage (minutes)",
        allowUnlockLabel: "Autoriser le déverrouillage manuel",
        allowUnlockHint: "Affiche un bouton de fermeture sur l'écran de verrouillage pour l'arrêter plus tôt.",
        unlockTab: "Déverrouiller l'onglet",
        testLockBtn: "Tester le verrouillage d'onglet",
        testLockPrayer: "Prière test",
        lockTitle: (p) => `C'est l'heure de ${p}`,
        lockSubtitle: "Cet onglet est verrouillé pour vous aider à vous concentrer sur la prière. Il se déverrouillera automatiquement à la fin du minuteur.",
        lockCountdown: "L'onglet se déverrouille dans",
        errLockTab: "Impossible de verrouiller cet onglet. Essayez un site normal (pas les pages chrome://).",
        tasbihLabel: "Rappel de dhikr périodique",
        tasbihHint: "Affiche un dhikr aléatoire sur l'onglet actif pendant la navigation. Cliquez pour le fermer.",
        tasbihCardLabel: "Dhikr",
        tasbihFixed: "Toutes les X minutes",
        tasbihRandom: "Intervalle aléatoire",
        tasbihMinutesLabel: "Intervalle (minutes)",
        tasbihMinLabel: "Minimum (minutes)",
        tasbihMaxLabel: "Maximum (minutes)",
        tasbihPositionLabel: "Position à l'écran",
        testTasbihBtn: "Tester le dhikr",
        errTasbihTab: "Impossible d'afficher le dhikr sur cet onglet. Essayez un site normal (pas les pages chrome://).",
        welcomeTitle: "Prayer Times est installé",
        welcomeLead: "Épinglez l'extension à votre barre d'outils pour garder les heures de prière à un clic.",
        welcomePinTitle: "Comment épingler",
        welcomePinStep1: "Cliquez sur le menu Extensions (icône puzzle) dans la barre d'outils Chrome.",
        welcomePinStep2: "Trouvez Prayer Times Reminder dans la liste.",
        welcomePinStep3: "Cliquez sur Épingler à la barre d'outils (ou l'icône épingle).",
        welcomeNotifTitle: "Épinglez Prayer Times",
        welcomeNotifBody: "Ouvrez le menu Extensions et épinglez Prayer Times à la barre d'outils pour un accès rapide.",
        openSettings: "⚙️ Paramètres",
        settingsTitle: "Paramètres",
        next: "Suivant",
        finish: "Terminer",
        locationLabel: "Emplacement",
        back: "← Retour",
        digitsLabel: "Style des chiffres",
        digitsArabic: "Arabes (٠١٢٣)",
        digitsWestern: "Occidentaux (0123)",
        dateFormatLabel: "Format de date",
        settingsLangLabel: "Langue",
        themeLabel: "Thème",
        themeClassic: "Classique",
        themeMidnightEmerald: "Émeraude de minuit",
        prayers: {
            Fajr: "Fajr",
            Sunrise: "Lever du soleil",
            Duha: "Duha",
            Dhuhr: "Dhuhr",
            Jumuah: "Jumu'ah",
            Asr: "Asr",
            Maghrib: "Maghrib",
            Isha: "Isha"
        }
    },
    es: {
        dir: "ltr",
        locale: "es-ES",
        appTitle: "Horarios de oración",
        prayerBreak: "Pausa de horarios de oración: cuando llega la hora de la oración, tus pestañas abiertas se bloquean para que puedas apartarte y orar.",
        noLocation: "No se ha establecido ninguna ubicación",
        nextPrayer: "Próxima oración",
        loading: "Cargando horarios de oración…",
        setLocationHint: "Abre los ajustes para elegir tu país y ciudad.",
        settings: "⚙️ Ubicación y ajustes",
        country: "País",
        city: "Ciudad",
        method: "Método de cálculo",
        save: "Guardar y cargar",
        useLocation: "📍 Usar mi ubicación",
        locating: "Obteniendo ubicación…",
        selectCountry: "Selecciona un país…",
        selectCity: "Selecciona una ciudad…",
        loadingCities: "Cargando ciudades…",
        citiesFailed: "No se pudieron cargar las ciudades — prueba con otro país o revisa tu conexión.",
        errFields: "Por favor, elige tanto un país como una ciudad.",
        errNotFound: "Ubicación no encontrada. Prueba con otra ciudad.",
        errGeneric: "No se pudieron cargar los horarios de oración.",
        errNoGeo: "La geolocalización no está disponible aquí.",
        errGeoFail: (m) => `Falló el acceso a la ubicación: ${m}`,
        allDone: "Todas las oraciones de hoy han terminado 🌙",
        fajrTomorrow: "Fajr (mañana)",
        countdown: (h, m, s) => `en ${h}h ${pad(m)}min ${pad(s)}s`,
        countdownHours: "HORAS",
        countdownMin: "MIN",
        countdownSec: "SEG",
        dataSource: "Datos: API AlAdhan",
        ahLabel: "AH",
        notifTitle: (p) => `${p} — Hora de oración`,
        notifBody: (p) => `Ahora es la hora de ${p}. حَيَّ عَلَى الصَّلَاة`,
        tabLockLabel: "Bloquear pestaña durante la oración",
        tabLockHint: "Bloquea la pestaña activa del navegador durante la duración configurada cuando llega la hora de la oración.",
        lockMinutesLabel: "Duración del bloqueo (minutos)",
        allowUnlockLabel: "Permitir desbloqueo manual",
        allowUnlockHint: "Muestra un botón de cierre en la pantalla de bloqueo para quitarlo antes.",
        unlockTab: "Desbloquear pestaña",
        testLockBtn: "Probar bloqueo de pestaña",
        testLockPrayer: "Oración de prueba",
        lockTitle: (p) => `Es hora de ${p}`,
        lockSubtitle: "Esta pestaña está bloqueada para ayudarte a concentrarte en la oración. Se desbloqueará automáticamente cuando termine el temporizador.",
        lockCountdown: "La pestaña se desbloquea en",
        errLockTab: "No se pudo bloquear esta pestaña. Prueba un sitio normal (no páginas chrome://).",
        tasbihLabel: "Recordatorio periódico de dhikr",
        tasbihHint: "Muestra un dhikr aleatorio en la pestaña activa mientras navegas. Haz clic para cerrarlo.",
        tasbihCardLabel: "Dhikr",
        tasbihFixed: "Cada X minutos",
        tasbihRandom: "Intervalo aleatorio",
        tasbihMinutesLabel: "Intervalo (minutos)",
        tasbihMinLabel: "Mínimo (minutos)",
        tasbihMaxLabel: "Máximo (minutos)",
        tasbihPositionLabel: "Posición en pantalla",
        testTasbihBtn: "Probar dhikr",
        errTasbihTab: "No se pudo mostrar el dhikr en esta pestaña. Prueba un sitio normal (no páginas chrome://).",
        welcomeTitle: "Prayer Times está instalado",
        welcomeLead: "Fija la extensión en tu barra de herramientas para que los horarios de oración estén a un clic.",
        welcomePinTitle: "Cómo fijarlo",
        welcomePinStep1: "Haz clic en el menú de Extensiones (icono de rompecabezas) en la barra de herramientas de Chrome.",
        welcomePinStep2: "Busca Prayer Times Reminder en la lista.",
        welcomePinStep3: "Haz clic en Fijar a la barra de herramientas (o en el icono de chincheta).",
        welcomeNotifTitle: "Fija Prayer Times",
        welcomeNotifBody: "Abre el menú de Extensiones y fija Prayer Times en la barra de herramientas para acceso rápido.",
        openSettings: "⚙️ Ajustes",
        settingsTitle: "Ajustes",
        next: "Siguiente",
        finish: "Finalizar",
        locationLabel: "Ubicación",
        back: "← Atrás",
        digitsLabel: "Estilo de números",
        digitsArabic: "Árabes (٠١٢٣)",
        digitsWestern: "Occidentales (0123)",
        dateFormatLabel: "Formato de fecha",
        settingsLangLabel: "Idioma",
        themeLabel: "Tema",
        themeClassic: "Clásico",
        themeMidnightEmerald: "Esmeralda de medianoche",
        prayers: {
            Fajr: "Fajr",
            Sunrise: "Amanecer",
            Duha: "Duha",
            Dhuhr: "Dhuhr",
            Jumuah: "Yumu'a",
            Asr: "Asr",
            Maghrib: "Magrib",
            Isha: "Isha"
        }
    },
    hi: {
        dir: "ltr",
        locale: "hi-IN",
        appTitle: "नमाज़ के समय",
        prayerBreak: "नमाज़ के समय का विराम: नमाज़ का समय आने पर आपके खुले टैब लॉक हो जाते हैं ताकि आप स्क्रीन से हटकर नमाज़ पढ़ सकें।",
        noLocation: "कोई स्थान सेट नहीं है",
        nextPrayer: "अगली नमाज़",
        loading: "नमाज़ के समय लोड हो रहे हैं…",
        setLocationHint: "अपना देश और शहर चुनने के लिए सेटिंग्स खोलें।",
        settings: "⚙️ स्थान और सेटिंग्स",
        country: "देश",
        city: "शहर",
        method: "गणना विधि",
        save: "सहेजें और लोड करें",
        useLocation: "📍 मेरा स्थान उपयोग करें",
        locating: "स्थान ज्ञात किया जा रहा है…",
        selectCountry: "देश चुनें…",
        selectCity: "शहर चुनें…",
        loadingCities: "शहर लोड हो रहे हैं…",
        citiesFailed: "शहर लोड नहीं हो सके — दूसरा देश आज़माएँ या अपना कनेक्शन जाँचें।",
        errFields: "कृपया देश और शहर दोनों चुनें।",
        errNotFound: "स्थान नहीं मिला। कोई दूसरा शहर आज़माएँ।",
        errGeneric: "नमाज़ के समय लोड नहीं हो सके।",
        errNoGeo: "यहाँ जियोलोकेशन उपलब्ध नहीं है।",
        errGeoFail: (m) => `स्थान तक पहुँच विफल: ${m}`,
        allDone: "आज की सभी नमाज़ें पूरी हो गईं 🌙",
        fajrTomorrow: "फज्र (कल)",
        countdown: (h, m, s) => `${h} घंटे ${pad(m)} मिनट ${pad(s)} सेकंड में`,
        countdownHours: "घंटे",
        countdownMin: "मिनट",
        countdownSec: "सेकंड",
        dataSource: "डेटा: AlAdhan API",
        ahLabel: "हि",
        notifTitle: (p) => `${p} — नमाज़ का समय`,
        notifBody: (p) => `अब ${p} का समय है। حَيَّ عَلَى الصَّلَاة`,
        tabLockLabel: "नमाज़ के दौरान टैब लॉक करें",
        tabLockHint: "नमाज़ के समय आने पर निर्धारित अवधि के लिए सक्रिय ब्राउज़र टैब को ब्लॉक करता है।",
        lockMinutesLabel: "लॉक अवधि (मिनट)",
        allowUnlockLabel: "मैन्युअल अनलॉक की अनुमति दें",
        allowUnlockHint: "लॉक स्क्रीन पर बंद करने का बटन दिखाता है ताकि इसे जल्दी हटाया जा सके।",
        unlockTab: "टैब अनलॉक करें",
        testLockBtn: "टैब लॉक परीक्षण",
        testLockPrayer: "परीक्षण नमाज़",
        lockTitle: (p) => `${p} का समय हो गया है`,
        lockSubtitle: "यह टैब लॉक है ताकि आप नमाज़ पर ध्यान दे सकें। टाइमर समाप्त होते ही यह स्वचालित रूप से अनलॉक हो जाएगा।",
        lockCountdown: "टैब इतने समय में अनलॉक होगा",
        errLockTab: "इस टैब को लॉक नहीं किया जा सका। सामान्य वेबसाइट आज़माएँ (chrome:// पेज नहीं)।",
        tasbihLabel: "आवधिक ज़िक्र अनुस्मारक",
        tasbihHint: "ब्राउज़ करते समय सक्रिय टैब पर एक यादृच्छिक ज़िक्र दिखाता है। हटाने के लिए टैप करें।",
        tasbihCardLabel: "ज़िक्र",
        tasbihFixed: "हर X मिनट",
        tasbihRandom: "यादृच्छिक अंतराल",
        tasbihMinutesLabel: "अंतराल (मिनट)",
        tasbihMinLabel: "न्यूनतम (मिनट)",
        tasbihMaxLabel: "अधिकतम (मिनट)",
        tasbihPositionLabel: "स्क्रीन पर स्थिति",
        testTasbihBtn: "ज़िक्र परीक्षण",
        errTasbihTab: "इस टैब पर ज़िक्र नहीं दिखाया जा सका। सामान्य वेबसाइट आज़माएँ (chrome:// पेज नहीं)।",
        welcomeTitle: "नमाज़ के समय इंस्टॉल हो गया",
        welcomeLead: "एक्सटेंशन को टूलबार में पिन करें ताकि नमाज़ के समय हमेशा एक क्लिक की दूरी पर हों।",
        welcomePinTitle: "पिन कैसे करें",
        welcomePinStep1: "Chrome टूलबार में Extensions मेनू (पज़ल आइकन) पर क्लिक करें।",
        welcomePinStep2: "सूची में Prayer Times Reminder ढूँढें।",
        welcomePinStep3: "Pin to toolbar (या पिन आइकन) पर क्लिक करें।",
        welcomeNotifTitle: "Prayer Times को पिन करें",
        welcomeNotifBody: "त्वरित पहुँच के लिए Extensions मेनू खोलें और Prayer Times को टूलबार में पिन करें।",
        openSettings: "⚙️ सेटिंग्स",
        settingsTitle: "सेटिंग्स",
        next: "आगे",
        finish: "समाप्त",
        locationLabel: "स्थान",
        back: "← वापस",
        digitsLabel: "अंकों की शैली",
        digitsArabic: "अरबी (٠١٢٣)",
        digitsWestern: "अंग्रेज़ी (0123)",
        dateFormatLabel: "तारीख़ प्रारूप",
        settingsLangLabel: "भाषा",
        themeLabel: "थीम",
        themeClassic: "क्लासिक",
        themeMidnightEmerald: "मिडनाइट एमराल्ड",
        prayers: {
            Fajr: "फज्र",
            Sunrise: "सूर्योदय",
            Duha: "चाश्त",
            Dhuhr: "ज़ुहर",
            Jumuah: "जुमा",
            Asr: "अस्र",
            Maghrib: "मग़रिब",
            Isha: "इशा"
        }
    },
    id: {
        dir: "ltr",
        locale: "id-ID",
        appTitle: "Waktu Shalat",
        prayerBreak: "Jeda Waktu Shalat: saat waktu shalat tiba, tab Anda yang terbuka terkunci agar Anda bisa menjauh dan shalat.",
        noLocation: "Lokasi belum diatur",
        nextPrayer: "Shalat berikutnya",
        loading: "Memuat waktu shalat…",
        setLocationHint: "Buka pengaturan untuk memilih negara dan kota Anda.",
        settings: "⚙️ Lokasi & pengaturan",
        country: "Negara",
        city: "Kota",
        method: "Metode perhitungan",
        save: "Simpan & Muat",
        useLocation: "📍 Gunakan lokasi saya",
        locating: "Menentukan lokasi…",
        selectCountry: "Pilih negara…",
        selectCity: "Pilih kota…",
        loadingCities: "Memuat kota…",
        citiesFailed: "Kota tidak dapat dimuat — coba negara lain atau periksa koneksi Anda.",
        errFields: "Silakan pilih negara dan kota.",
        errNotFound: "Lokasi tidak ditemukan. Coba kota lain.",
        errGeneric: "Tidak dapat memuat waktu shalat.",
        errNoGeo: "Geolokasi tidak tersedia di sini.",
        errGeoFail: (m) => `Akses lokasi gagal: ${m}`,
        allDone: "Semua shalat hari ini selesai 🌙",
        fajrTomorrow: "Subuh (besok)",
        countdown: (h, m, s) => `dalam ${h} jam ${pad(m)} menit ${pad(s)} detik`,
        countdownHours: "JAM",
        countdownMin: "MENIT",
        countdownSec: "DETIK",
        dataSource: "Data: AlAdhan API",
        ahLabel: "H",
        notifTitle: (p) => `${p} — Waktu Shalat`,
        notifBody: (p) => `Sekarang waktunya shalat ${p}. حَيَّ عَلَى الصَّلَاة`,
        tabLockLabel: "Kunci tab saat shalat",
        tabLockHint: "Memblokir tab browser aktif selama durasi yang ditetapkan saat waktu shalat tiba.",
        lockMinutesLabel: "Durasi kunci (menit)",
        allowUnlockLabel: "Izinkan buka kunci manual",
        allowUnlockHint: "Menampilkan tombol tutup di layar kunci untuk menutupnya lebih awal.",
        unlockTab: "Buka kunci tab",
        testLockBtn: "Uji kunci tab",
        testLockPrayer: "Shalat uji",
        lockTitle: (p) => `Sudah waktunya shalat ${p}`,
        lockSubtitle: "Tab ini dikunci agar Anda dapat fokus beribadah. Tab akan terbuka otomatis saat pengatur waktu berakhir.",
        lockCountdown: "Tab terbuka dalam",
        errLockTab: "Tidak dapat mengunci tab ini. Coba situs web biasa (bukan halaman chrome://).",
        tasbihLabel: "Pengingat dzikir berkala",
        tasbihHint: "Menampilkan dzikir acak di tab aktif saat Anda menjelajah. Ketuk untuk menutup.",
        tasbihCardLabel: "Dzikir",
        tasbihFixed: "Setiap X menit",
        tasbihRandom: "Interval acak",
        tasbihMinutesLabel: "Interval (menit)",
        tasbihMinLabel: "Minimum (menit)",
        tasbihMaxLabel: "Maksimum (menit)",
        tasbihPositionLabel: "Posisi di layar",
        testTasbihBtn: "Uji dzikir",
        errTasbihTab: "Tidak dapat menampilkan dzikir di tab ini. Coba situs web biasa (bukan halaman chrome://).",
        welcomeTitle: "Waktu Shalat terpasang",
        welcomeLead: "Sematkan ekstensi ke bilah alat agar waktu shalat selalu satu klik saja.",
        welcomePinTitle: "Cara menyematkan",
        welcomePinStep1: "Klik menu Ekstensi (ikon puzzle) di bilah alat Chrome.",
        welcomePinStep2: "Temukan Prayer Times Reminder dalam daftar.",
        welcomePinStep3: "Klik Sematkan ke bilah alat (atau ikon pin).",
        welcomeNotifTitle: "Sematkan Waktu Shalat",
        welcomeNotifBody: "Buka menu Ekstensi dan sematkan Waktu Shalat ke bilah alat untuk akses cepat.",
        openSettings: "⚙️ Pengaturan",
        settingsTitle: "Pengaturan",
        next: "Berikutnya",
        finish: "Selesai",
        locationLabel: "Lokasi",
        back: "← Kembali",
        digitsLabel: "Gaya angka",
        digitsArabic: "Arab (٠١٢٣)",
        digitsWestern: "Barat (0123)",
        dateFormatLabel: "Format tanggal",
        settingsLangLabel: "Bahasa",
        themeLabel: "Tema",
        themeClassic: "Klasik",
        themeMidnightEmerald: "Midnight Emerald",
        prayers: {
            Fajr: "Subuh",
            Sunrise: "Terbit",
            Duha: "Dhuha",
            Dhuhr: "Dzuhur",
            Jumuah: "Jumat",
            Asr: "Ashar",
            Maghrib: "Maghrib",
            Isha: "Isya"
        }
    },
    de: {
        dir: "ltr",
        locale: "de-DE",
        appTitle: "Gebetszeiten",
        prayerBreak: "Gebetszeiten-Pause: Wenn die Gebetszeit kommt, werden Ihre offenen Tabs gesperrt, damit Sie innehalten und beten können.",
        noLocation: "Kein Ort festgelegt",
        nextPrayer: "Nächstes Gebet",
        loading: "Gebetszeiten werden geladen…",
        setLocationHint: "Öffnen Sie die Einstellungen, um Land und Stadt auszuwählen.",
        settings: "⚙️ Ort & Einstellungen",
        country: "Land",
        city: "Stadt",
        method: "Berechnungsmethode",
        save: "Speichern & Laden",
        useLocation: "📍 Meinen Standort verwenden",
        locating: "Standort wird ermittelt…",
        selectCountry: "Land auswählen…",
        selectCity: "Stadt auswählen…",
        loadingCities: "Städte werden geladen…",
        citiesFailed: "Städte konnten nicht geladen werden — anderes Land wählen oder Verbindung prüfen.",
        errFields: "Bitte wählen Sie Land und Stadt.",
        errNotFound: "Ort nicht gefunden. Andere Stadt versuchen.",
        errGeneric: "Gebetszeiten konnten nicht geladen werden.",
        errNoGeo: "Geolokalisierung hier nicht verfügbar.",
        errGeoFail: (m) => `Standortzugriff fehlgeschlagen: ${m}`,
        allDone: "Alle Gebete für heute sind vorbei 🌙",
        fajrTomorrow: "Fajr (morgen)",
        countdown: (h, m, s) => `in ${h} Std. ${pad(m)} Min. ${pad(s)} Sek.`,
        countdownHours: "STD",
        countdownMin: "MIN",
        countdownSec: "SEK",
        dataSource: "Daten: AlAdhan API",
        ahLabel: "AH",
        notifTitle: (p) => `${p} — Gebetszeit`,
        notifBody: (p) => `Jetzt ist Zeit für ${p}. حَيَّ عَلَى الصَّلَاة`,
        tabLockLabel: "Tab während des Gebets sperren",
        tabLockHint: "Sperrt den aktiven Browser-Tab für die eingestellte Dauer, wenn die Gebetszeit eintritt.",
        lockMinutesLabel: "Sperrdauer (Minuten)",
        allowUnlockLabel: "Manuelles Entsperren erlauben",
        allowUnlockHint: "Zeigt eine Schließen-Schaltfläche auf dem Sperrbildschirm zum vorzeitigen Beenden.",
        unlockTab: "Tab entsperren",
        testLockBtn: "Tab-Sperre testen",
        testLockPrayer: "Testgebet",
        lockTitle: (p) => `Es ist Zeit für ${p}`,
        lockSubtitle: "Dieser Tab ist gesperrt, damit Sie sich auf das Gebet konzentrieren können. Er wird automatisch entsperrt, wenn der Timer abläuft.",
        lockCountdown: "Tab wird entsperrt in",
        errLockTab: "Dieser Tab konnte nicht gesperrt werden. Normale Website versuchen (keine chrome://-Seiten).",
        tasbihLabel: "Regelmäßige Dhikr-Erinnerung",
        tasbihHint: "Zeigt einen zufälligen Dhikr auf dem aktiven Tab beim Surfen. Tippen zum Schließen.",
        tasbihCardLabel: "Dhikr",
        tasbihFixed: "Alle X Minuten",
        tasbihRandom: "Zufälliges Intervall",
        tasbihMinutesLabel: "Intervall (Minuten)",
        tasbihMinLabel: "Minimum (Minuten)",
        tasbihMaxLabel: "Maximum (Minuten)",
        tasbihPositionLabel: "Position auf dem Bildschirm",
        testTasbihBtn: "Dhikr testen",
        errTasbihTab: "Dhikr konnte auf diesem Tab nicht angezeigt werden. Normale Website versuchen (keine chrome://-Seiten).",
        welcomeTitle: "Prayer Times installiert",
        welcomeLead: "Heften Sie die Erweiterung an die Symbolleiste, damit Gebetszeiten immer einen Klick entfernt sind.",
        welcomePinTitle: "So heften Sie sie an",
        welcomePinStep1: "Klicken Sie auf das Erweiterungsmenü (Puzzle-Symbol) in der Chrome-Symbolleiste.",
        welcomePinStep2: "Finden Sie Prayer Times Reminder in der Liste.",
        welcomePinStep3: "Klicken Sie auf An Symbolleiste anheften (oder das Pin-Symbol).",
        welcomeNotifTitle: "Prayer Times anheften",
        welcomeNotifBody: "Öffnen Sie das Erweiterungsmenü und heften Sie Prayer Times an die Symbolleiste für schnellen Zugriff.",
        openSettings: "⚙️ Einstellungen",
        settingsTitle: "Einstellungen",
        next: "Weiter",
        finish: "Fertig",
        locationLabel: "Standort",
        back: "← Zurück",
        digitsLabel: "Ziffernstil",
        digitsArabic: "Arabisch (٠١٢٣)",
        digitsWestern: "Westlich (0123)",
        dateFormatLabel: "Datumsformat",
        settingsLangLabel: "Sprache",
        themeLabel: "Design",
        themeClassic: "Klassisch",
        themeMidnightEmerald: "Midnight Emerald",
        prayers: {
            Fajr: "Fajr",
            Sunrise: "Sonnenaufgang",
            Duha: "Duha",
            Dhuhr: "Dhuhr",
            Jumuah: "Jumu'ah",
            Asr: "Asr",
            Maghrib: "Maghrib",
            Isha: "Isha"
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

// Map Western digits 0-9 to Devanagari digits ०-९ (used for times/dates in Hindi mode).
const HI_DIGITS = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];

function toDevanagariDigits(str) {
    return String(str).replace(/[0-9]/g, (d) => HI_DIGITS[Number(d)]);
}

// Returns the dictionary for a language, falling back to English.
function tr(lang) {
    return I18N[lang] || I18N.en;
}

// On Fridays the midday prayer is the congregational Jumu'ah, prayed at the
// Dhuhr time. Returns the label to show for a prayer key on the given day
// (defaults to today). Used by both the popup and the background worker.
function prayerLabel(L, key, date = new Date()) {
    if (key === "Dhuhr" && date.getDay() === 5) {
        return L.prayers.Jumuah || L.prayers.Dhuhr;
    }
    return L.prayers[key] || key;
}

const SUPPORTED_LANGS = [{
        code: "en",
        name: "English",
        dir: "ltr",
        locale: "en"
    },
    {
        code: "de",
        name: "Deutsch",
        dir: "ltr",
        locale: "de-DE"
    },
    {
        code: "ar",
        name: "العربية",
        dir: "rtl",
        locale: "ar"
    },
    {
        code: "ur",
        name: "اردو",
        dir: "rtl",
        locale: "ur-PK"
    },
    {
        code: "hi",
        name: "हिन्दी",
        dir: "ltr",
        locale: "hi-IN"
    },
    {
        code: "id",
        name: "Bahasa Indonesia",
        dir: "ltr",
        locale: "id-ID"
    },
    {
        code: "fr",
        name: "Français",
        dir: "ltr",
        locale: "fr-FR"
    },
    {
        code: "es",
        name: "Español",
        dir: "ltr",
        locale: "es-ES"
    }
];

function itemLabel(item, lang) {
    if (lang === "ar" && item.ar) return item.ar;

    return item[lang] ?? item.en;
}

function isRtl(lang) {
    return (I18N[lang] || I18N.en).dir === "rtl";
}

function usesArabicDigits(lang, arabicDigits) {
    return (lang === "ar" || lang === "ur") && arabicDigits;
}

function formatTasbihDisplay(item, lang) {
    const code = lang || "en";
    // The same dhikr in Arabic, shown on a new line beneath every non-Arabic
    // rendering so the original is always present (translation first, Arabic below).
    const arabicLine = {
        text: item.ar,
        dir: "rtl",
        variant: "arabic"
    };
    switch (code) {
        case "ar":
            return {
                lines: [arabicLine]
            };
        case "ur":
            return {
                lines: [{
                        text: item.ur || item.ar,
                        dir: "rtl",
                        variant: "urdu"
                    },
                    arabicLine
                ]
            };
        case "fr":
        case "es":
        case "hi":
        case "id":
        case "de":
            return {
                lines: [{
                        text: item[code] || item.en,
                        dir: "ltr",
                        variant: "translation"
                    },
                    arabicLine
                ]
            };
        default:
            return {
                lines: [{
                        text: item.en,
                        dir: "ltr",
                        variant: "transliteration"
                    },
                    arabicLine
                ]
            };
    }
}

// Curated countries. `en` is sent to both APIs (which expect English names);
// `ar` is only the label shown in Arabic mode.
const COUNTRIES = [{
        en: "Afghanistan",
        ar: "أفغانستان"
    },
    {
        en: "Albania",
        ar: "ألبانيا"
    },
    {
        en: "Algeria",
        ar: "الجزائر"
    },
    {
        en: "Argentina",
        ar: "الأرجنتين"
    },
    {
        en: "Australia",
        ar: "أستراليا"
    },
    {
        en: "Austria",
        ar: "النمسا"
    },
    {
        en: "Azerbaijan",
        ar: "أذربيجان"
    },
    {
        en: "Bahrain",
        ar: "البحرين"
    },
    {
        en: "Bangladesh",
        ar: "بنغلاديش"
    },
    {
        en: "Belgium",
        ar: "بلجيكا"
    },
    {
        en: "Bosnia and Herzegovina",
        ar: "البوسنة والهرسك"
    },
    {
        en: "Brazil",
        ar: "البرازيل"
    },
    {
        en: "Brunei",
        ar: "بروناي"
    },
    {
        en: "Canada",
        ar: "كندا"
    },
    {
        en: "China",
        ar: "الصين"
    },
    {
        en: "Denmark",
        ar: "الدنمارك"
    },
    {
        en: "Egypt",
        ar: "مصر"
    },
    {
        en: "France",
        ar: "فرنسا"
    },
    {
        en: "Germany",
        ar: "ألمانيا"
    },
    {
        en: "India",
        ar: "الهند"
    },
    {
        en: "Indonesia",
        ar: "إندونيسيا"
    },
    {
        en: "Iran",
        ar: "إيران"
    },
    {
        en: "Iraq",
        ar: "العراق"
    },
    {
        en: "Italy",
        ar: "إيطاليا"
    },
    {
        en: "Japan",
        ar: "اليابان"
    },
    {
        en: "Jordan",
        ar: "الأردن"
    },
    {
        en: "Kazakhstan",
        ar: "كازاخستان"
    },
    {
        en: "Kenya",
        ar: "كينيا"
    },
    {
        en: "Kuwait",
        ar: "الكويت"
    },
    {
        en: "Kyrgyzstan",
        ar: "قيرغيزستان"
    },
    {
        en: "Lebanon",
        ar: "لبنان"
    },
    {
        en: "Libya",
        ar: "ليبيا"
    },
    {
        en: "Malaysia",
        ar: "ماليزيا"
    },
    {
        en: "Maldives",
        ar: "المالديف"
    },
    {
        en: "Mauritania",
        ar: "موريتانيا"
    },
    {
        en: "Morocco",
        ar: "المغرب"
    },
    {
        en: "Netherlands",
        ar: "هولندا"
    },
    {
        en: "Nigeria",
        ar: "نيجيريا"
    },
    {
        en: "Norway",
        ar: "النرويج"
    },
    {
        en: "Oman",
        ar: "عُمان"
    },
    {
        en: "Pakistan",
        ar: "باكستان"
    },
    {
        en: "Palestine",
        ar: "فلسطين"
    },
    {
        en: "Philippines",
        ar: "الفلبين"
    },
    {
        en: "Qatar",
        ar: "قطر"
    },
    {
        en: "Russia",
        ar: "روسيا"
    },
    {
        en: "Saudi Arabia",
        ar: "السعودية"
    },
    {
        en: "Senegal",
        ar: "السنغال"
    },
    {
        en: "Singapore",
        ar: "سنغافورة"
    },
    {
        en: "Somalia",
        ar: "الصومال"
    },
    {
        en: "South Africa",
        ar: "جنوب أفريقيا"
    },
    {
        en: "Spain",
        ar: "إسبانيا"
    },
    {
        en: "Sri Lanka",
        ar: "سريلانكا"
    },
    {
        en: "Sudan",
        ar: "السودان"
    },
    {
        en: "Sweden",
        ar: "السويد"
    },
    {
        en: "Switzerland",
        ar: "سويسرا"
    },
    {
        en: "Syria",
        ar: "سوريا"
    },
    {
        en: "Tajikistan",
        ar: "طاجيكستان"
    },
    {
        en: "Thailand",
        ar: "تايلاند"
    },
    {
        en: "Tunisia",
        ar: "تونس"
    },
    {
        en: "Turkey",
        ar: "تركيا"
    },
    {
        en: "Turkmenistan",
        ar: "تركمانستان"
    },
    {
        en: "Ukraine",
        ar: "أوكرانيا"
    },
    {
        en: "United Arab Emirates",
        ar: "الإمارات العربية المتحدة"
    },
    {
        en: "United Kingdom",
        ar: "المملكة المتحدة"
    },
    {
        en: "United States",
        ar: "الولايات المتحدة"
    },
    {
        en: "Uzbekistan",
        ar: "أوزبكستان"
    },
    {
        en: "Yemen",
        ar: "اليمن"
    }
];

// AlAdhan calculation methods (id + bilingual label).
const METHODS = [{
        id: 2,
        en: "ISNA (North America)",
        ar: "ISNA (أمريكا الشمالية)"
    },
    {
        id: 3,
        en: "Muslim World League",
        ar: "رابطة العالم الإسلامي"
    },
    {
        id: 4,
        en: "Umm al-Qura (Makkah)",
        ar: "أم القرى (مكة)"
    },
    {
        id: 5,
        en: "Egyptian General Authority",
        ar: "الهيئة المصرية العامة للمساحة"
    },
    {
        id: 1,
        en: "University of Karachi",
        ar: "جامعة كراتشي"
    },
    {
        id: 8,
        en: "Gulf Region",
        ar: "منطقة الخليج"
    },
    {
        id: 9,
        en: "Kuwait",
        ar: "الكويت"
    },
    {
        id: 10,
        en: "Qatar",
        ar: "قطر"
    },
    {
        id: 11,
        en: "Singapore (MUIS)",
        ar: "سنغافورة (MUIS)"
    },
    {
        id: 12,
        en: "Union Islamique de France",
        ar: "اتحاد المنظمات الإسلامية بفرنسا"
    },
    {
        id: 13,
        en: "Diyanet (Turkey)",
        ar: "ديانة (تركيا)"
    },
    {
        id: 14,
        en: "Spiritual Admin. of Russia",
        ar: "الإدارة الروحية لمسلمي روسيا"
    },
    {
        id: 0,
        en: "Shia Ithna-Ashari",
        ar: "الشيعة الإثنا عشرية"
    }
];

const DEFAULT_DATE_FORMAT = "dd-mmMMMM-yyyy";
const DEFAULT_TASBIH_POSITION = "top-center";

const TASBIH_POSITIONS = [{
        key: "top-left",
        en: "Top left",
        ar: "أعلى اليسار",
        ur: "اوپر بائیں",
        hi: "ऊपर बाएँ",
        id: "Kiri atas",
        de: "Oben links",
        fr: "En haut à gauche",
        es: "Arriba a la izquierda"
    },
    {
        key: "top-right",
        en: "Top right",
        ar: "أعلى اليمين",
        ur: "اوپر دائیں",
        hi: "ऊपर दाएँ",
        id: "Kanan atas",
        de: "Oben rechts",
        fr: "En haut à droite",
        es: "Arriba a la derecha"
    },
    {
        key: "top-center",
        en: "Top center",
        ar: "أعلى الوسط",
        ur: "اوپر درمیان",
        hi: "ऊपर केंद्र",
        id: "Tengah atas",
        de: "Oben mittig",
        fr: "En haut au centre",
        es: "Arriba al centro"
    },
    {
        key: "bottom-left",
        en: "Bottom left",
        ar: "أسفل اليسار",
        ur: "نیچے بائیں",
        hi: "नीचे बाएँ",
        id: "Kiri bawah",
        de: "Unten links",
        fr: "En bas à gauche",
        es: "Abajo a la izquierda"
    },
    {
        key: "bottom-right",
        en: "Bottom right",
        ar: "أسفل اليمين",
        ur: "نیچے دائیں",
        hi: "नीचे दाएँ",
        id: "Kanan bawah",
        de: "Unten rechts",
        fr: "En bas à droite",
        es: "Abajo a la derecha"
    },
    {
        key: "bottom-center",
        en: "Bottom center",
        ar: "أسفل الوسط",
        ur: "نیچے درمیان",
        hi: "नीचे केंद्र",
        id: "Tengah bawah",
        de: "Unten mittig",
        fr: "En bas au centre",
        es: "Abajo al centro"
    }
];

function normalizeTasbihPosition(value) {
    const key = String(value || DEFAULT_TASBIH_POSITION);
    return TASBIH_POSITIONS.some((p) => p.key === key) ? key : DEFAULT_TASBIH_POSITION;
}

// Date format presets applied to both the Hijri and Gregorian dates (id matches the pattern name).
const DATE_FORMATS = [{
        id: "dd-mmMMMM-yyyy",
        en: "10-04 April-2026",
        ar: "١٠-٠٤ أبريل-٢٠٢٦"
    },
    {
        id: "dd-mm-yyyy",
        en: "10-04-2026",
        ar: "١٠-٠٤-٢٠٢٦"
    },
    {
        id: "dd/MM/yyyy",
        en: "10/04/2026",
        ar: "١٠/٠٤/٢٠٢٦"
    },
    {
        id: "dd-MMMM-yyyy",
        en: "10 April 2026",
        ar: "١٠ أبريل ٢٠٢٦"
    },
    {
        id: "MMMM-dd-yyyy",
        en: "April-10-2026",
        ar: "أبريل-١٠-٢٠٢٦"
    },
    {
        id: "readable",
        en: "Long text (API default)",
        ar: "نص طويل (افتراضي)"
    }
];

const DEFAULT_THEME = "midnight-emerald";

function normalizeTheme(theme) {
    return theme === "classic" ? "classic" : DEFAULT_THEME;
}

// Applied on first install (chrome.runtime.onInstalled reason === "install").
const DEFAULT_SETTINGS = {
    theme: DEFAULT_THEME,
    lang: "ar",
    location: {
        mode: "city",
        city: "Riyadh",
        country: "Saudi Arabia",
        method: 4 // Umm al-Qura (Makkah)
    },
    arabicDigits: false,
    tabLockEnabled: true,
    lockMinutes: 5,
    allowUnlock: false,
    dateFormat: DEFAULT_DATE_FORMAT,
    tasbihEnabled: true,
    tasbihIntervalMode: "random",
    tasbihIntervalMinutes: 15,
    tasbihRandomMin: 5,
    tasbihRandomMax: 15,
    tasbihPosition: DEFAULT_TASBIH_POSITION
};

function randomTasbihPhrase(lang) {
    const code = lang || "en";
    const fallback = {
        ar: "سُبْحَانَ اللَّهِ",
        en: "Subhan Allah",
        ur: "سُبْحَانَ اللہ",
        hi: "अल्लाह की पाकیزگی है",
        id: "Maha Suci Allah",
        de: "Gepriesen sei Allah",
        fr: "Gloire à Allah",
        es: "Gloria a Allah"
    };
    if (typeof TASBIH_PHRASES === "undefined" || !TASBIH_PHRASES.length) {
        return formatTasbihDisplay(fallback, code);
    }
    const item = TASBIH_PHRASES[Math.floor(Math.random() * TASBIH_PHRASES.length)];
    return formatTasbihDisplay(item, code);
}

const DEFAULT_CITY_LABELS = {
    "cityLabels:Saudi Arabia": {
        Riyadh: "الرياض"
    }
};