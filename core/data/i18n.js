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
        dataSource: "Data: adhan (offline)",
        ahLabel: "AH",
        notifTitle: (p) => `${p} — Prayer Time`,
        notifBody: (p) => `It is now time for ${p}. حَيَّ عَلَى الصَّلَاة`,
        tabLockLabel: "Lock tab during prayer",
        tabLockHint: "Blocks the active browser tab for the set duration when prayer time arrives.",
        screenLockLabel: "Lock the screen during prayer",
        screenLockHint: "Covers your whole screen for the set duration when prayer time arrives.",
        extSectionLabel: "Browser tab lock (Chrome)",
        extHint: "Also lock your browser tabs during prayer by adding the companion Chrome extension.",
        extInstallBtn: "Get the Chrome extension",
        extInstalledNote: "✓ Chrome extension installed",
        startupLabel: "Launch on Windows startup",
        startupHint: "Start automatically when you sign in to Windows.",
        lockMinutesLabel: "Lock duration (minutes)",
        allowUnlockLabel: "Allow manual unlock",
        allowUnlockHint: "Lets you dismiss the lock screen early by tapping it (or pressing Esc).",
        silentLabel: "Silent (Do Not Disturb) during prayer",
        silentHint: "Silences calls and notifications while the lock is active.",
        soundLabel: "Prayer time sound",
        soundHint: "Play a sound when prayer time arrives.",
        soundBeep: "Chime",
        soundAdhan: "Adhan",
        soundNone: "None",
        unlockTab: "Unlock",
        lockTapHint: "Tap anywhere to unlock",
        testLockBtn: "Test lock",
        testLockPrayer: "Test Prayer",
        lockTitle: (p) => `It is time for ${p}`,
        lockSubtitle: "Locked so you can focus on prayer. It will unlock automatically when the timer ends.",
        lockCountdown: "Unlocks in",
        errLockTab: "Could not lock this tab. Try a normal website (not chrome:// pages).",
        tabLockPermDenied: "Tab locking needs permission to access your open tabs. Allow it when Chrome asks.",
        tasbihLabel: "Periodic dhikr reminder",
        tasbihHint: "Shows a random dhikr on your open tabs while you browse. Tap to dismiss.",
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
        welcomeLead: "Choose your language to begin — prayer times, an optional tab lock at prayer, and periodic dhikr reminders, in 8 languages.",
        desktopPromoTitle: "Prayer Times for Windows",
        desktopPromoSub: "A desktop app that locks your entire screen at prayer time.",
        desktopPromoLink: "Learn more",
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
        aboutBtn: "About the app",
        aboutDesc: "See your daily prayer times, gently lock your browser tab when it's time to pray, and get a passing dhikr reminder while you browse.",
        aboutSadaqah: "This app is an ongoing charity (sadaqah jariyah) on behalf of:",
        aboutSadaqahAll: "And for all Muslims, the living and the dead.",
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
        dataSource: "المصدر: adhan (offline)",
        ahLabel: "هـ",
        notifTitle: (p) => `حان وقت صلاة ${p}`,
        notifBody: (p) => `حان الآن وقت صلاة ${p}. حَيَّ عَلَى الصَّلَاة`,
        tabLockLabel: "قفل التبويب أثناء الصلاة",
        tabLockHint: "يمنع استخدام التبويب النشط للمدة المحددة عند حلول وقت الصلاة.",
        screenLockLabel: "قفل الشاشة أثناء الصلاة",
        screenLockHint: "يغطّي شاشتك بالكامل للمدة المحددة عند حلول وقت الصلاة.",
        extSectionLabel: "قفل تبويبات المتصفح (Chrome)",
        extHint: "اقفل تبويبات متصفحك أيضًا أثناء الصلاة بإضافة إضافة Chrome المصاحبة.",
        extInstallBtn: "احصل على إضافة Chrome",
        extInstalledNote: "✓ إضافة Chrome مثبّتة",
        startupLabel: "التشغيل مع بدء تشغيل ويندوز",
        startupHint: "يبدأ التطبيق تلقائيًا عند تسجيل الدخول إلى ويندوز.",
        lockMinutesLabel: "مدة القفل (دقائق)",
        allowUnlockLabel: "السماح بالفتح اليدوي",
        allowUnlockHint: "يتيح لك إنهاء شاشة القفل مبكرًا بالنقر عليها (أو بالضغط على Esc).",
        silentLabel: "الصامت (عدم الإزعاج) أثناء الصلاة",
        silentHint: "يكتم المكالمات والإشعارات طوال مدة القفل.",
        soundLabel: "صوت وقت الصلاة",
        soundHint: "يشغّل صوتاً عند دخول وقت الصلاة.",
        soundBeep: "طنين",
        soundAdhan: "أذان",
        soundNone: "بدون",
        unlockTab: "فتح القفل",
        lockTapHint: "انقر في أي مكان لفتح القفل",
        testLockBtn: "تجربة القفل",
        testLockPrayer: "تجربة",
        lockTitle: (p) => `حان وقت صلاة ${p}`,
        lockSubtitle: "تم القفل لمساعدتك على التركيز في الصلاة. سيُفتح تلقائيًا عند انتهاء المؤقت.",
        lockCountdown: "يُفتح بعد",
        errLockTab: "تعذّر قفل هذا التبويب. جرّب موقعًا عاديًا (وليس صفحات chrome://).",
        tabLockPermDenied: "قفل التبويبات يحتاج إذنًا للوصول إلى تبويباتك المفتوحة. اسمح به عندما يطلبه Chrome.",
        tasbihLabel: "التسبيح الدوري",
        tasbihHint: "يعرض تسبيحة عشوائية في تبويباتك المفتوحة أثناء التصفح. انقر لإخفائها.",
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
        welcomeLead: "اختر لغتك للبدء — مواقيت الصلاة، وقفل اختياري للتبويب وقت الصلاة، وتذكير بالذكر الدوري، بثماني لغات.",
        desktopPromoTitle: "مواقيت الصلاة لويندوز",
        desktopPromoSub: "تطبيق سطح مكتب يقفل شاشتك بالكامل وقت الصلاة.",
        desktopPromoLink: "اعرف المزيد",
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
        aboutBtn: "حول التطبيق",
        aboutDesc: "اعرف أوقات صلواتك اليومية، واقفل تبويب المتصفح برفقٍ عند دخول وقت الصلاة، وتلقَّ تذكيراً بذكرٍ عابرٍ أثناء تصفّحك.",
        aboutSadaqah: "هذا التطبيق صدقة جارية عن:",
        aboutSadaqahAll: "وعن جميع المسلمين الأحياء منهم والأموات.",
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
        dataSource: "ماخذ: adhan (offline)",
        ahLabel: "ھ",
        notifTitle: (p) => `${p} — نماز کا وقت`,
        notifBody: (p) => `اب ${p} کا وقت ہے۔ حَيَّ عَلَى الصَّلَاة`,
        tabLockLabel: "نماز کے دوران ٹیب لاک کریں",
        tabLockHint: "نماز کے وقت آنے پر مقررہ مدت کے لیے فعال براؤزر ٹیب کو بلاک کرتا ہے۔",
        screenLockLabel: "نماز کے دوران اسکرین لاک کریں",
        screenLockHint: "نماز کا وقت آنے پر مقررہ مدت کے لیے پوری اسکرین کو ڈھانپ دیتا ہے۔",
        extSectionLabel: "براؤزر ٹیب لاک (Chrome)",
        extHint: "ساتھی Chrome ایکسٹینشن شامل کر کے نماز کے دوران اپنے براؤزر ٹیبز بھی لاک کریں۔",
        extInstallBtn: "Chrome ایکسٹینشن حاصل کریں",
        extInstalledNote: "✓ Chrome ایکسٹینشن انسٹال ہے",
        startupLabel: "ونڈوز اسٹارٹ اپ پر چلائیں",
        startupHint: "ونڈوز میں سائن ان کرتے ہی ایپ خودکار طور پر شروع ہو جائے۔",
        lockMinutesLabel: "لاک کی مدت (منٹ)",
        allowUnlockLabel: "دستی طور پر ان لاک کی اجازت دیں",
        allowUnlockHint: "لاک اسکرین پر ٹیپ کر کے (یا Esc دبا کر) اسے پہلے ختم کرنے دیتا ہے۔",
        silentLabel: "نماز کے دوران خاموش (ڈسٹرب نہ کریں)",
        silentHint: "لاک فعال ہونے کے دوران کالز اور اطلاعات کو خاموش کر دیتا ہے۔",
        soundLabel: "نماز کے وقت کی آواز",
        soundHint: "نماز کا وقت آنے پر آواز چلائیں۔",
        soundBeep: "گھنٹی",
        soundAdhan: "اذان",
        soundNone: "کوئی نہیں",
        unlockTab: "ان لاک کریں",
        lockTapHint: "ان لاک کرنے کے لیے کہیں بھی ٹیپ کریں",
        testLockBtn: "لاک آزمائیں",
        testLockPrayer: "ٹیسٹ نماز",
        lockTitle: (p) => `${p} کا وقت ہو گیا ہے`,
        lockSubtitle: "لاک ہے تاکہ آپ نماز پر توجہ دے سکیں۔ ٹائمر ختم ہوتے ہی یہ خودکار طور پر ان لاک ہو جائے گا۔",
        lockCountdown: "اتنے وقت میں ان لاک ہوگا",
        errLockTab: "اس ٹیب کو لاک نہیں کیا جا سکا۔ عام ویب سائٹ آزمائیں (chrome:// صفحات نہیں)۔",
        tabLockPermDenied: "ٹیب لاک کرنے کے لیے آپ کے کھلے ٹیبز تک رسائی کی اجازت درکار ہے۔ Chrome پوچھے تو اجازت دیں۔",
        tasbihLabel: "وقفے وقفے سے ذکر کی یاددہانی",
        tasbihHint: "براؤزنگ کے دوران آپ کے کھلے ٹیبز پر ایک بے ترتیب ذکر دکھاتا ہے۔ ہٹانے کے لیے کلک کریں۔",
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
        welcomeLead: "شروع کرنے کے لیے اپنی زبان منتخب کریں — اوقاتِ نماز، نماز کے وقت اختیاری ٹیب لاک، اور وقفے وقفے سے ذکر کی یاد دہانی، 8 زبانوں میں۔",
        desktopPromoTitle: "ونڈوز کے لیے اوقاتِ نماز",
        desktopPromoSub: "ایک ڈیسک ٹاپ ایپ جو نماز کے وقت آپ کی پوری اسکرین لاک کر دیتی ہے۔",
        desktopPromoLink: "مزید جانیں",
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
        aboutBtn: "ایپ کے بارے میں",
        aboutDesc: "اپنی روزانہ کی نماز کے اوقات دیکھیں، نماز کے وقت براؤزر ٹیب کو نرمی سے مقفل کریں، اور دورانِ براؤزنگ ایک ذکر کی یاد دہانی پائیں۔",
        aboutSadaqah: "یہ ایپ ایک صدقۂ جاریہ ہے، اِن کی طرف سے:",
        aboutSadaqahAll: "اور تمام مسلمانوں کے لیے، زندہ ہوں یا فوت شدہ۔",
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
        dataSource: "Données : adhan (offline)",
        ahLabel: "AH",
        notifTitle: (p) => `${p} — Heure de prière`,
        notifBody: (p) => `C'est maintenant l'heure de ${p}. حَيَّ عَلَى الصَّلَاة`,
        tabLockLabel: "Verrouiller l'onglet pendant la prière",
        tabLockHint: "Bloque l'onglet actif pendant la durée définie lorsque l'heure de la prière arrive.",
        screenLockLabel: "Verrouiller l'écran pendant la prière",
        screenLockHint: "Couvre tout votre écran pendant la durée définie lorsque l'heure de la prière arrive.",
        extSectionLabel: "Verrouillage des onglets (Chrome)",
        extHint: "Verrouillez aussi vos onglets pendant la prière en ajoutant l'extension Chrome associée.",
        extInstallBtn: "Obtenir l'extension Chrome",
        extInstalledNote: "✓ Extension Chrome installée",
        startupLabel: "Lancer au démarrage de Windows",
        startupHint: "Démarre automatiquement à l'ouverture de session Windows.",
        lockMinutesLabel: "Durée du verrouillage (minutes)",
        allowUnlockLabel: "Autoriser le déverrouillage manuel",
        allowUnlockHint: "Permet de fermer l'écran de verrouillage plus tôt en le touchant (ou avec Échap).",
        silentLabel: "Silencieux (Ne pas déranger) pendant la prière",
        silentHint: "Coupe les appels et les notifications pendant le verrouillage.",
        soundLabel: "Son à l'heure de la prière",
        soundHint: "Émet un son à l'arrivée de l'heure de prière.",
        soundBeep: "Carillon",
        soundAdhan: "Adhan",
        soundNone: "Aucun",
        unlockTab: "Déverrouiller",
        lockTapHint: "Touchez n'importe où pour déverrouiller",
        testLockBtn: "Tester le verrouillage",
        testLockPrayer: "Prière test",
        lockTitle: (p) => `C'est l'heure de ${p}`,
        lockSubtitle: "Verrouillé pour vous aider à vous concentrer sur la prière. Se déverrouille automatiquement à la fin du minuteur.",
        lockCountdown: "Déverrouillage dans",
        errLockTab: "Impossible de verrouiller cet onglet. Essayez un site normal (pas les pages chrome://).",
        tabLockPermDenied: "Le verrouillage des onglets nécessite l'autorisation d'accéder à vos onglets ouverts. Acceptez lorsque Chrome le demande.",
        tasbihLabel: "Rappel de dhikr périodique",
        tasbihHint: "Affiche un dhikr aléatoire sur vos onglets ouverts pendant la navigation. Cliquez pour le fermer.",
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
        welcomeLead: "Choisissez votre langue pour commencer — horaires de prière, verrouillage d'onglet optionnel à la prière et rappels de dhikr, en 8 langues.",
        desktopPromoTitle: "Prayer Times pour Windows",
        desktopPromoSub: "Une application de bureau qui verrouille tout votre écran à l'heure de la prière.",
        desktopPromoLink: "En savoir plus",
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
        aboutBtn: "À propos de l'application",
        aboutDesc: "Consultez vos horaires de prière quotidiens, verrouillez en douceur votre onglet à l'heure de la prière et recevez un rappel de dhikr pendant votre navigation.",
        aboutSadaqah: "Cette application est une aumône continue (sadaqah jâriyah) au nom de :",
        aboutSadaqahAll: "Et pour tous les musulmans, les vivants et les morts.",
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
        dataSource: "Datos: adhan (offline)",
        ahLabel: "AH",
        notifTitle: (p) => `${p} — Hora de oración`,
        notifBody: (p) => `Ahora es la hora de ${p}. حَيَّ عَلَى الصَّلَاة`,
        tabLockLabel: "Bloquear pestaña durante la oración",
        tabLockHint: "Bloquea la pestaña activa del navegador durante la duración configurada cuando llega la hora de la oración.",
        screenLockLabel: "Bloquear la pantalla durante la oración",
        screenLockHint: "Cubre toda la pantalla durante el tiempo establecido cuando llega la hora de la oración.",
        extSectionLabel: "Bloqueo de pestañas (Chrome)",
        extHint: "Bloquea también las pestañas del navegador durante la oración añadiendo la extensión de Chrome complementaria.",
        extInstallBtn: "Obtener la extensión de Chrome",
        extInstalledNote: "✓ Extensión de Chrome instalada",
        startupLabel: "Iniciar con Windows",
        startupHint: "Se inicia automáticamente al iniciar sesión en Windows.",
        lockMinutesLabel: "Duración del bloqueo (minutos)",
        allowUnlockLabel: "Permitir desbloqueo manual",
        allowUnlockHint: "Permite cerrar la pantalla de bloqueo antes tocándola (o pulsando Esc).",
        silentLabel: "Silencio (No molestar) durante la oración",
        silentHint: "Silencia llamadas y notificaciones mientras el bloqueo está activo.",
        soundLabel: "Sonido a la hora de la oración",
        soundHint: "Reproduce un sonido cuando llega la hora de la oración.",
        soundBeep: "Timbre",
        soundAdhan: "Adán",
        soundNone: "Ninguno",
        unlockTab: "Desbloquear",
        lockTapHint: "Toca en cualquier lugar para desbloquear",
        testLockBtn: "Probar bloqueo",
        testLockPrayer: "Oración de prueba",
        lockTitle: (p) => `Es hora de ${p}`,
        lockSubtitle: "Bloqueado para ayudarte a concentrarte en la oración. Se desbloqueará automáticamente cuando termine el temporizador.",
        lockCountdown: "Se desbloquea en",
        errLockTab: "No se pudo bloquear esta pestaña. Prueba un sitio normal (no páginas chrome://).",
        tabLockPermDenied: "El bloqueo de pestañas necesita permiso para acceder a tus pestañas abiertas. Concédelo cuando Chrome lo pida.",
        tasbihLabel: "Recordatorio periódico de dhikr",
        tasbihHint: "Muestra un dhikr aleatorio en tus pestañas abiertas mientras navegas. Haz clic para cerrarlo.",
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
        welcomeLead: "Elige tu idioma para empezar: horarios de oración, bloqueo de pestaña opcional en la oración y recordatorios de dhikr, en 8 idiomas.",
        desktopPromoTitle: "Prayer Times para Windows",
        desktopPromoSub: "Una app de escritorio que bloquea toda tu pantalla a la hora de la oración.",
        desktopPromoLink: "Más información",
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
        aboutBtn: "Acerca de la aplicación",
        aboutDesc: "Consulta tus horarios de oración diarios, bloquea suavemente la pestaña del navegador a la hora de rezar y recibe un recordatorio de dhikr mientras navegas.",
        aboutSadaqah: "Esta aplicación es una caridad continua (sadaqah yariyah) en nombre de:",
        aboutSadaqahAll: "Y por todos los musulmanes, vivos y muertos.",
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
        dataSource: "डेटा: adhan (offline)",
        ahLabel: "हि",
        notifTitle: (p) => `${p} — नमाज़ का समय`,
        notifBody: (p) => `अब ${p} का समय है। حَيَّ عَلَى الصَّلَاة`,
        tabLockLabel: "नमाज़ के दौरान टैब लॉक करें",
        tabLockHint: "नमाज़ के समय आने पर निर्धारित अवधि के लिए सक्रिय ब्राउज़र टैब को ब्लॉक करता है।",
        screenLockLabel: "नमाज़ के दौरान स्क्रीन लॉक करें",
        screenLockHint: "नमाज़ का समय आने पर निर्धारित अवधि के लिए आपकी पूरी स्क्रीन को ढक देता है।",
        extSectionLabel: "ब्राउज़र टैब लॉक (Chrome)",
        extHint: "साथी Chrome एक्सटेंशन जोड़कर नमाज़ के दौरान अपने ब्राउज़र टैब भी लॉक करें।",
        extInstallBtn: "Chrome एक्सटेंशन प्राप्त करें",
        extInstalledNote: "✓ Chrome एक्सटेंशन इंस्टॉल है",
        startupLabel: "विंडोज़ स्टार्टअप पर लॉन्च करें",
        startupHint: "विंडोज़ में साइन इन करते ही ऐप स्वतः शुरू हो जाए।",
        lockMinutesLabel: "लॉक अवधि (मिनट)",
        allowUnlockLabel: "मैन्युअल अनलॉक की अनुमति दें",
        allowUnlockHint: "लॉक स्क्रीन पर टैप करके (या Esc दबाकर) इसे जल्दी हटाने देता है।",
        silentLabel: "नमाज़ के दौरान साइलेंट (परेशान न करें)",
        silentHint: "लॉक सक्रिय रहने के दौरान कॉल और सूचनाएँ मौन कर देता है।",
        soundLabel: "नमाज़ के समय की ध्वनि",
        soundHint: "नमाज़ का समय आने पर ध्वनि बजाएँ।",
        soundBeep: "घंटी",
        soundAdhan: "अज़ान",
        soundNone: "कोई नहीं",
        unlockTab: "अनलॉक करें",
        lockTapHint: "अनलॉक करने के लिए कहीं भी टैप करें",
        testLockBtn: "लॉक परीक्षण",
        testLockPrayer: "परीक्षण नमाज़",
        lockTitle: (p) => `${p} का समय हो गया है`,
        lockSubtitle: "लॉक है ताकि आप नमाज़ पर ध्यान दे सकें। टाइमर समाप्त होते ही यह स्वचालित रूप से अनलॉक हो जाएगा।",
        lockCountdown: "इतने समय में अनलॉक होगा",
        errLockTab: "इस टैब को लॉक नहीं किया जा सका। सामान्य वेबसाइट आज़माएँ (chrome:// पेज नहीं)।",
        tabLockPermDenied: "टैब लॉक करने के लिए आपके खुले टैब तक पहुँच की अनुमति चाहिए। Chrome पूछे तो अनुमति दें।",
        tasbihLabel: "आवधिक ज़िक्र अनुस्मारक",
        tasbihHint: "ब्राउज़ करते समय आपके खुले टैब पर एक यादृच्छिक ज़िक्र दिखाता है। हटाने के लिए टैप करें।",
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
        welcomeLead: "शुरू करने के लिए अपनी भाषा चुनें — नमाज़ के समय, नमाज़ पर वैकल्पिक टैब लॉक, और समय-समय पर ज़िक्र की याद, 8 भाषाओं में।",
        desktopPromoTitle: "विंडोज़ के लिए Prayer Times",
        desktopPromoSub: "एक डेस्कटॉप ऐप जो नमाज़ के समय आपकी पूरी स्क्रीन लॉक कर देता है।",
        desktopPromoLink: "और जानें",
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
        aboutBtn: "ऐप के बारे में",
        aboutDesc: "अपने दैनिक नमाज़ के समय देखें, नमाज़ के समय अपने ब्राउज़र टैब को धीरे से लॉक करें, और ब्राउज़िंग के दौरान एक ज़िक्र अनुस्मारक पाएँ।",
        aboutSadaqah: "यह ऐप एक सतत दान (सदक़ा जारिया) है, इनकी ओर से:",
        aboutSadaqahAll: "और सभी मुसलमानों के लिए, जो जीवित हैं और जो गुज़र चुके हैं।",
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
        dataSource: "Data: adhan (offline)",
        ahLabel: "H",
        notifTitle: (p) => `${p} — Waktu Shalat`,
        notifBody: (p) => `Sekarang waktunya shalat ${p}. حَيَّ عَلَى الصَّلَاة`,
        tabLockLabel: "Kunci tab saat shalat",
        tabLockHint: "Memblokir tab browser aktif selama durasi yang ditetapkan saat waktu shalat tiba.",
        screenLockLabel: "Kunci layar saat shalat",
        screenLockHint: "Menutupi seluruh layar Anda selama durasi yang ditetapkan saat waktu shalat tiba.",
        extSectionLabel: "Kunci tab browser (Chrome)",
        extHint: "Kunci juga tab browser Anda saat shalat dengan menambahkan ekstensi Chrome pendamping.",
        extInstallBtn: "Dapatkan ekstensi Chrome",
        extInstalledNote: "✓ Ekstensi Chrome terpasang",
        startupLabel: "Jalankan saat Windows menyala",
        startupHint: "Mulai otomatis saat Anda masuk ke Windows.",
        lockMinutesLabel: "Durasi kunci (menit)",
        allowUnlockLabel: "Izinkan buka kunci manual",
        allowUnlockHint: "Memungkinkan Anda menutup layar kunci lebih awal dengan mengetuknya (atau menekan Esc).",
        silentLabel: "Senyap (Jangan Ganggu) saat salat",
        silentHint: "Membisukan panggilan dan notifikasi selama penguncian aktif.",
        soundLabel: "Suara waktu salat",
        soundHint: "Memutar suara saat waktu salat tiba.",
        soundBeep: "Nada",
        soundAdhan: "Azan",
        soundNone: "Tidak ada",
        unlockTab: "Buka kunci",
        lockTapHint: "Ketuk di mana saja untuk membuka kunci",
        testLockBtn: "Uji kunci",
        testLockPrayer: "Shalat uji",
        lockTitle: (p) => `Sudah waktunya shalat ${p}`,
        lockSubtitle: "Dikunci agar Anda dapat fokus beribadah. Akan terbuka otomatis saat pengatur waktu berakhir.",
        lockCountdown: "Terbuka dalam",
        errLockTab: "Tidak dapat mengunci tab ini. Coba situs web biasa (bukan halaman chrome://).",
        tabLockPermDenied: "Penguncian tab memerlukan izin untuk mengakses tab yang terbuka. Izinkan saat Chrome meminta.",
        tasbihLabel: "Pengingat dzikir berkala",
        tasbihHint: "Menampilkan dzikir acak di tab-tab terbuka Anda saat Anda menjelajah. Ketuk untuk menutup.",
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
        welcomeLead: "Pilih bahasa untuk memulai — waktu shalat, kunci tab opsional saat shalat, dan pengingat dzikir berkala, dalam 8 bahasa.",
        desktopPromoTitle: "Prayer Times untuk Windows",
        desktopPromoSub: "Aplikasi desktop yang mengunci seluruh layar Anda saat waktu shalat.",
        desktopPromoLink: "Pelajari lebih lanjut",
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
        aboutBtn: "Tentang aplikasi",
        aboutDesc: "Lihat jadwal salat harian Anda, kunci tab peramban dengan lembut saat waktu salat, dan dapatkan pengingat zikir singkat saat menjelajah.",
        aboutSadaqah: "Aplikasi ini adalah sedekah jariah (amal berkelanjutan) atas nama:",
        aboutSadaqahAll: "Dan bagi seluruh umat Islam, yang hidup maupun yang telah wafat.",
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
        dataSource: "Daten: adhan (offline)",
        ahLabel: "AH",
        notifTitle: (p) => `${p} — Gebetszeit`,
        notifBody: (p) => `Jetzt ist Zeit für ${p}. حَيَّ عَلَى الصَّلَاة`,
        tabLockLabel: "Tab während des Gebets sperren",
        tabLockHint: "Sperrt den aktiven Browser-Tab für die eingestellte Dauer, wenn die Gebetszeit eintritt.",
        screenLockLabel: "Bildschirm während des Gebets sperren",
        screenLockHint: "Deckt Ihren gesamten Bildschirm für die festgelegte Dauer ab, wenn die Gebetszeit beginnt.",
        extSectionLabel: "Browser-Tab-Sperre (Chrome)",
        extHint: "Sperren Sie während des Gebets auch Ihre Browser-Tabs, indem Sie die begleitende Chrome-Erweiterung hinzufügen.",
        extInstallBtn: "Chrome-Erweiterung holen",
        extInstalledNote: "✓ Chrome-Erweiterung installiert",
        startupLabel: "Beim Windows-Start starten",
        startupHint: "Startet automatisch bei der Windows-Anmeldung.",
        lockMinutesLabel: "Sperrdauer (Minuten)",
        allowUnlockLabel: "Manuelles Entsperren erlauben",
        allowUnlockHint: "Ermöglicht, den Sperrbildschirm durch Antippen (oder mit Esc) vorzeitig zu beenden.",
        silentLabel: "Lautlos (Nicht stören) während des Gebets",
        silentHint: "Schaltet Anrufe und Benachrichtigungen während der Sperre stumm.",
        soundLabel: "Ton zur Gebetszeit",
        soundHint: "Spielt einen Ton ab, wenn die Gebetszeit beginnt.",
        soundBeep: "Klang",
        soundAdhan: "Adhan",
        soundNone: "Kein Ton",
        unlockTab: "Entsperren",
        lockTapHint: "Zum Entsperren irgendwo tippen",
        testLockBtn: "Sperre testen",
        testLockPrayer: "Testgebet",
        lockTitle: (p) => `Es ist Zeit für ${p}`,
        lockSubtitle: "Gesperrt, damit Sie sich auf das Gebet konzentrieren können. Wird automatisch entsperrt, wenn der Timer abläuft.",
        lockCountdown: "Entsperrt in",
        errLockTab: "Dieser Tab konnte nicht gesperrt werden. Normale Website versuchen (keine chrome://-Seiten).",
        tabLockPermDenied: "Das Sperren von Tabs benötigt die Berechtigung für den Zugriff auf Ihre geöffneten Tabs. Erlauben Sie es, wenn Chrome fragt.",
        tasbihLabel: "Regelmäßige Dhikr-Erinnerung",
        tasbihHint: "Zeigt einen zufälligen Dhikr auf Ihren geöffneten Tabs beim Surfen. Tippen zum Schließen.",
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
        welcomeLead: "Wählen Sie zum Start Ihre Sprache — Gebetszeiten, optionale Tab-Sperre zum Gebet und regelmäßige Dhikr-Erinnerungen, in 8 Sprachen.",
        desktopPromoTitle: "Prayer Times für Windows",
        desktopPromoSub: "Eine Desktop-App, die zur Gebetszeit Ihren ganzen Bildschirm sperrt.",
        desktopPromoLink: "Mehr erfahren",
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
        aboutBtn: "Über die App",
        aboutDesc: "Sieh deine täglichen Gebetszeiten, sperre deinen Browser-Tab sanft zur Gebetszeit und erhalte beim Surfen eine Dhikr-Erinnerung.",
        aboutSadaqah: "Diese App ist eine fortlaufende Wohltätigkeit (Sadaqa Dschariya) im Namen von:",
        aboutSadaqahAll: "Und für alle Muslime, die Lebenden und die Toten.",
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

// ---- Timezone-aware prayer instants ----------------------------------------
// Aladhan returns prayer times in the *location's* timezone (meta.timezone). To
// get the correct absolute instant we must interpret the wall-clock HH:MM in that
// IANA zone, not the device's zone — otherwise alarms/countdowns are wrong
// whenever the device timezone differs from the chosen location's.

// Offset (ms) of `timeZone` at the given UTC instant: (wall-clock as-UTC) - utc.
function tzOffsetMs(utcMs, timeZone) {
    const dtf = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour12: false,
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
    const p = {};
    for (const part of dtf.formatToParts(new Date(utcMs))) p[part.type] = part.value;
    const asUTC = Date.UTC(
        Number(p.year), Number(p.month) - 1, Number(p.day),
        Number(p.hour) % 24, Number(p.minute), Number(p.second)
    );
    return asUTC - utcMs;
}

// Absolute timestamp (ms) for wall-clock Y/M/D H:M in the given IANA timeZone.
function zonedTimeToTimestamp(year, month, day, hour, minute, timeZone) {
    const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
    const ts = guess - tzOffsetMs(guess, timeZone);
    // One refinement handles offset/DST transitions near the target time.
    const ts2 = guess - tzOffsetMs(ts, timeZone);
    return ts2;
}

// Absolute timestamp (ms) for a "HH:MM" prayer time on the date of `ref`,
// interpreted in `timeZone` when provided, else in the device's local zone.
function prayerTimestamp(timeStr, ref, timeZone) {
    const m = String(timeStr).match(/(\d{1,2}):(\d{2})/);
    if (!m) return null;
    const y = ref.getFullYear(), mo = ref.getMonth() + 1, d = ref.getDate();
    const hh = Number(m[1]), mm = Number(m[2]);
    if (timeZone) return zonedTimeToTimestamp(y, mo, d, hh, mm, timeZone);
    return new Date(y, mo - 1, d, hh, mm, 0, 0).getTime();
}

// ---- Shared Aladhan config + clamps (used by popup.js AND background.js) -----
const ALADHAN = "https://api.aladhan.com/v1";
const DEFAULT_LOCK_MINUTES = 5;
const DEFAULT_TASBIH_MINUTES = 15;
const DEFAULT_TASBIH_RANDOM_MIN = 5;
const DEFAULT_TASBIH_RANDOM_MAX = 15;

function clampLockMinutes(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return DEFAULT_LOCK_MINUTES;
    return Math.min(120, Math.max(1, Math.round(n)));
}

function clampTasbihMinutes(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(120, Math.max(1, Math.round(n)));
}

// Aladhan wants the date as DD-MM-YYYY.
function apiDate(d) {
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

// Request URL for either a city/country pair or raw coordinates.
function timingsUrl(location, date) {
    const method = location.method ?? 2; // 2 = ISNA (sensible default)
    if (location.mode === "coords") {
        return `${ALADHAN}/timings/${date}?latitude=${location.latitude}` +
            `&longitude=${location.longitude}&method=${method}`;
    }
    return `${ALADHAN}/timingsByCity/${date}?city=${encodeURIComponent(location.city)}` +
        `&country=${encodeURIComponent(location.country)}&method=${method}`;
}

// True if an alarm fired too long after its scheduled time to still be relevant
// — e.g. it was queued while Chrome was closed and only fired on startup.
function alarmFiredLate(scheduledTime, now, graceMs) {
    return (now - (scheduledTime || 0)) > graceMs;
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
    // Guard against the language code colliding with a structural field (e.g.
    // lang "id" vs a numeric `id`): only use a string translation, else English.
    const v = item[lang];
    return typeof v === "string" ? v : item.en;
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
// AlAdhan calculation methods. `value` is the API method id (NOT `id` — that
// would collide with the Indonesian language code "id" in itemLabel). Shia
// methods (0 Jafari, 7 Tehran) are intentionally omitted per content policy.
const METHODS = [{
        value: 2,
        en: "ISNA (North America)",
        ar: "ISNA (أمريكا الشمالية)"
    },
    {
        value: 3,
        en: "Muslim World League",
        ar: "رابطة العالم الإسلامي"
    },
    {
        value: 4,
        en: "Umm al-Qura (Makkah)",
        ar: "أم القرى (مكة)"
    },
    {
        value: 5,
        en: "Egyptian General Authority",
        ar: "الهيئة المصرية العامة للمساحة"
    },
    {
        value: 1,
        en: "University of Karachi",
        ar: "جامعة كراتشي"
    },
    {
        value: 8,
        en: "Gulf Region",
        ar: "منطقة الخليج"
    },
    {
        value: 9,
        en: "Kuwait",
        ar: "الكويت"
    },
    {
        value: 10,
        en: "Qatar",
        ar: "قطر"
    },
    {
        value: 11,
        en: "Singapore (MUIS)",
        ar: "سنغافورة (MUIS)"
    },
    {
        value: 12,
        en: "Union Islamique de France",
        ar: "اتحاد المنظمات الإسلامية بفرنسا"
    },
    {
        value: 13,
        en: "Diyanet (Turkey)",
        ar: "ديانة (تركيا)"
    },
    {
        value: 14,
        en: "Spiritual Admin. of Russia",
        ar: "الإدارة الروحية لمسلمي روسيا"
    },
    {
        value: 16,
        en: "Dubai (UAE)",
        ar: "دبي (الإمارات)"
    },
    {
        value: 17,
        en: "JAKIM (Malaysia)",
        ar: "جاكيم (ماليزيا)"
    },
    {
        value: 20,
        en: "Kemenag (Indonesia)",
        ar: "وزارة الشؤون الدينية (إندونيسيا)"
    },
    {
        value: 21,
        en: "Morocco",
        ar: "المغرب"
    },
    {
        value: 18,
        en: "Tunisia",
        ar: "تونس"
    },
    {
        value: 19,
        en: "Algeria",
        ar: "الجزائر"
    },
    {
        value: 23,
        en: "Jordan (Awqaf)",
        ar: "الأوقاف (الأردن)"
    },
    {
        value: 15,
        en: "Moonsighting Committee Worldwide",
        ar: "لجنة رؤية الهلال العالمية"
    }
];

const DEFAULT_DATE_FORMAT = "dd-MMMM-yyyy";
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
// `value` (not `id`) is the format key — avoids the "id" language-code collision.
const DATE_FORMATS = [{
        value: "dd-MMMM-yyyy",
        en: "10 April 2026",
        ar: "١٠ أبريل ٢٠٢٦"
    },
    {
        value: "dd-mmMMMM-yyyy",
        en: "10-04 April-2026",
        ar: "١٠-٠٤ أبريل-٢٠٢٦"
    },
    {
        value: "dd-mm-yyyy",
        en: "10-04-2026",
        ar: "١٠-٠٤-٢٠٢٦"
    },
    {
        value: "dd/MM/yyyy",
        en: "10/04/2026",
        ar: "١٠/٠٤/٢٠٢٦"
    },
    {
        value: "MMMM-dd-yyyy",
        en: "April-10-2026",
        ar: "أبريل-١٠-٢٠٢٦"
    },
    {
        value: "readable",
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
        method: 4, // Umm al-Qura (Makkah)
        latitude: 24.7136, // seeds the offline engine on first run (no geocode needed)
        longitude: 46.6753
    },
    arabicDigits: false,
    tabLockEnabled: true,
    lockMinutes: 5,
    allowUnlock: false,
    silentDuringPrayer: true,
    prayerSound: "beep", // "beep" | "adhan" | "none" — sound when prayer time arrives
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

// --- Temporary Latin -> Arabic city transliteration --------------------------
// A rough, offline phonetic rendering so the city dropdown shows Arabic instead
// of English before an accurate name is geocoded. Accurate names (Nominatim
// cache) always win over this; this is only the fallback. Not linguistically
// exact — a placeholder ("ترجمة مؤقتة") until real names are fetched/curated.

// Curated overrides for well-known places where a phonetic guess would be wrong
// or awkward. Keyed by lowercased, apostrophe-stripped English name.
const CITY_AR_OVERRIDES = {
    mecca: "مكة", makkah: "مكة",
    medina: "المدينة المنورة", madinah: "المدينة المنورة",
    riyadh: "الرياض", jeddah: "جدة", jiddah: "جدة",
    dammam: "الدمام", mina: "منى", arafat: "عرفات",
    taif: "الطائف", tabuk: "تبوك", khobar: "الخبر",
    jubail: "الجبيل", yanbu: "ينبع", buraidah: "بريدة",
    hail: "حائل", abha: "أبها", najran: "نجران",
    jizan: "جازان", qatif: "القطيف", hofuf: "الهفوف"
};

// Strip Latin diacritics but keep macrons (ā ī ū) as long-vowel markers, and
// fold underdotted/accented consonants to base letter (or digraph).
function normalizeLatinCity(s) {
    return String(s)
        .replace(/[āĀ]/g, "Â").replace(/[īĪ]/g, "Î").replace(/[ūŪ]/g, "Û")
        .replace(/[ḥḨḩ]/g, "h").replace(/[ṣŠš]/g, "s").replace(/[ṭ]/g, "t")
        .replace(/[ḍ]/g, "d").replace(/[ẓż]/g, "z").replace(/[ġ]/g, "gh")
        .replace(/[ṯ]/g, "th").replace(/[ḏ]/g, "dh").replace(/[ñ]/g, "n")
        .replace(/[áàâäã]/g, "a").replace(/[éèêë]/g, "e").replace(/[íìîï]/g, "i")
        .replace(/[óòôö]/g, "o").replace(/[úùûü]/g, "u")
        .replace(/[ʿʾ'`’]/g, "'");
}

const LATIN_AR_DIGRAPHS = {
    sh: "ش", kh: "خ", th: "ث", dh: "ذ", gh: "غ", ph: "ف", ch: "تش", ck: "ك",
    oo: "و", ou: "و", ee: "ي", ai: "ي", ay: "ي", ei: "ي", au: "و", aw: "و"
};
const LATIN_AR_CONS = {
    b: "ب", t: "ت", j: "ج", h: "ه", d: "د", r: "ر", z: "ز", s: "س",
    f: "ف", q: "ق", k: "ك", l: "ل", m: "م", n: "ن", w: "و", y: "ي",
    g: "ج", p: "ب", v: "ف", c: "ك", x: "كس"
};

function transliterateCityWord(word) {
    let taMarbuta = false;
    let w = word;
    // A trailing short "a" / "ah" becomes a ta marbuta (ة).
    if (/a$/i.test(w) && !/Â$/.test(w)) { taMarbuta = true; w = w.replace(/a$/i, ""); }
    else if (/ah$/i.test(w)) { taMarbuta = true; w = w.replace(/ah$/i, ""); }

    let out = "";
    let i = 0;
    let emitted = false; // whether we've written the first real letter yet
    while (i < w.length) {
        const two = w.slice(i, i + 2).toLowerCase();
        const ch = w[i];
        const lower = ch.toLowerCase();

        if (ch === "Â") { out += "ا"; i += 1; emitted = true; continue; }
        if (ch === "Î") { out += "ي"; i += 1; emitted = true; continue; }
        if (ch === "Û") { out += "و"; i += 1; emitted = true; continue; }

        if (LATIN_AR_DIGRAPHS[two]) { out += LATIN_AR_DIGRAPHS[two]; i += 2; emitted = true; continue; }

        if (ch === "'") { if (emitted) out += "ع"; i += 1; continue; }

        if (LATIN_AR_CONS[lower]) {
            out += LATIN_AR_CONS[lower];
            if (w[i + 1] && w[i + 1].toLowerCase() === lower) i += 1; // collapse shadda
            i += 1; emitted = true; continue;
        }

        if ("aeiou".includes(lower)) {
            if (!emitted) { out += "ا"; emitted = true; } // word-initial carrier alif
            i += 1; continue; // medial/final short vowels are omitted
        }

        i += 1; // skip anything else
    }
    if (taMarbuta) out += "ة";
    return out.replace(/يي+/g, "ي").replace(/وو+/g, "و").replace(/اا+/g, "ا");
}

function transliterateCityToArabic(name) {
    if (!name) return name;
    const key = normalizeLatinCity(name).replace(/'/g, "").toLowerCase();
    if (CITY_AR_OVERRIDES[key]) return CITY_AR_OVERRIDES[key];
    return normalizeLatinCity(name).split(/[\s-]+/).map(transliterateCityWord).filter(Boolean).join(" ");
}