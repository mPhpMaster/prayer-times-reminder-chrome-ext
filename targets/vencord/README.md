# Prayer Times Break — Discord (Vencord plugin)

[العربية ↓](#العربية)

## English

### What it does

Brings Prayer Times Reminder into Discord through [Vencord](https://github.com/Vendicated/Vencord):

- Computes today's prayer times **offline** (adhan) for the city you choose.
- At each prayer (Fajr, Dhuhr/Jumu'ah, Asr, Maghrib, Isha) it shows a notification and, if enabled,
  covers Discord with the same lock screen the other apps use, for the minutes you set.
- An optional periodic dhikr card (the app's approved adhkar only).
- `/prayertimes` — today's times and the next prayer (only you see the reply).
- `/prayertimes-test` — shows the prayer notification and a **one-minute** lock right now (with an
  unlock button), so you can try it without waiting for a prayer.

### Install

Vencord loads personal ("user") plugins only in a Vencord **built from its source code**, so the
plugin is added to that source and Vencord is built once. You need [Git](https://git-scm.com/),
[Node.js](https://nodejs.org/) 18 or newer, and pnpm (`npm install -g pnpm`).

**1. Build the plugin folder** (in this repository):

```sh
npm run sync:vencord        # -> targets/vencord/build/prayerTimesBreak/
```

**2a. You already have Vencord built from source** (a folder with `src/userplugins/`):

```sh
cp -r targets/vencord/build/prayerTimesBreak <vencord-folder>/src/userplugins/
cd <vencord-folder>
pnpm build
```

**2b. You use the normal Vencord installer, or don't have Vencord yet**:

```sh
git clone https://github.com/Vendicated/Vencord
cd Vencord
pnpm install --frozen-lockfile
cp -r <this-repo>/targets/vencord/build/prayerTimesBreak src/userplugins/
pnpm build
pnpm inject                 # points Discord at this build (choose your Discord install)
```

**3. Restart Discord completely**: right-click its tray icon, choose **Quit Discord**, then open it
again (closing the window isn't enough).

**4. Turn it on**: *User Settings → Vencord → Plugins*, search **PrayerTimesBreak**, switch it on,
then open its settings (gear icon).

To update the plugin later, repeat step 1, copy the folder again (replace the old one), run
`pnpm build`, and restart Discord.

### Settings

- **City** — type your city (e.g. *Riyadh*), press *Search* and pick it from the list; this fills
  latitude and longitude. Only the typed city name is sent to OpenStreetMap's search — never your
  device's location. You can still type coordinates by hand below it.
- Calculation method (Umm al-Qura by default), language (11 languages, Arabic by default).
- Notify at prayer time; lock Discord during prayer; lock minutes (1–120); allow manual unlock;
  lock sound (chime / none).
- Periodic dhikr, its interval and position; theme.

### Try it

1. Choose your city in the settings.
2. Type `/prayertimes` in any chat: today's times and the next prayer.
3. Type `/prayertimes-test`: the prayer notification and a one-minute lock appear at once.

### How it is built

`targets/vencord/plugin/` holds the thin Discord shell: `index.ts` (commands), `settings.ts`,
`citySearch.tsx` (the City setting), `native.ts` (the city search, run in Discord's main process
because the page's security rules block the request) and `runtime.ts`. `tools/sync-core.mjs vencord`
copies them and generates `core.generated.js`: the shared `core/` scripts (adhan, tz-lookup, i18n,
dhikr phrases, prayer engine, lock config, scheduler) evaluated in one function scope and
re-exported as ES module exports, plus `installOverlays()` which runs the shared lock/dhikr
overlays. Never edit the generated folder — edit `core/` or `targets/vencord/plugin/` and re-sync.

---

## العربية

### ما الذي يفعله؟

يضيف «استراحة مواقيت الصلاة» إلى ديسكورد عبر [Vencord](https://github.com/Vendicated/Vencord):

- يحسب مواقيت صلاة اليوم **دون اتصال** للمدينة التي تختارها.
- عند كل صلاة (الفجر، الظهر/الجمعة، العصر، المغرب، العشاء) يُظهر تنبيهًا، ويُقفل ديسكورد —
  إن فعّلت ذلك — بشاشة القفل نفسها المستخدمة في بقية التطبيقات للمدة التي تحددها.
- تذكير دوري اختياري بالذكر (من الأذكار المعتمدة في التطبيق فقط).
- الأمر `/prayertimes` — مواقيت اليوم والصلاة القادمة (يظهر لك وحدك).
- الأمر `/prayertimes-test` — يُظهر تنبيه الصلاة وقفلًا **لدقيقة واحدة** الآن (مع زر فتح)،
  لتجربته دون انتظار وقت الصلاة.

### التثبيت

لا يحمّل Vencord الإضافات الشخصية إلا في نسخة **مبنية من شيفرته المصدرية**، لذلك تُضاف الإضافة
إلى تلك الشيفرة ثم يُبنى Vencord مرة واحدة. تحتاج إلى [Git](https://git-scm.com/) و
[Node.js](https://nodejs.org/) الإصدار 18 أو أحدث، وأداة pnpm (`npm install -g pnpm`).

**١. ابنِ مجلد الإضافة** (داخل هذا المستودع):

```sh
npm run sync:vencord        # يُنشئ targets/vencord/build/prayerTimesBreak/
```

**٢-أ. إن كان عندك Vencord مبنيًا من الشيفرة** (مجلد فيه `src/userplugins/`):

```sh
cp -r targets/vencord/build/prayerTimesBreak <مجلد-vencord>/src/userplugins/
cd <مجلد-vencord>
pnpm build
```

**٢-ب. إن كنت تستخدم مثبّت Vencord العادي، أو ليس عندك Vencord بعد**:

```sh
git clone https://github.com/Vendicated/Vencord
cd Vencord
pnpm install --frozen-lockfile
cp -r <هذا-المستودع>/targets/vencord/build/prayerTimesBreak src/userplugins/
pnpm build
pnpm inject                 # يوجّه ديسكورد إلى هذه النسخة (اختر نسخة ديسكورد المثبتة)
```

**٣. أعد تشغيل ديسكورد بالكامل**: انقر بزر الفأرة الأيمن على أيقونته بجانب الساعة، واختر
**Quit Discord**، ثم افتحه من جديد (إغلاق النافذة وحده لا يكفي).

**٤. فعّل الإضافة**: *إعدادات المستخدم ← Vencord ← Plugins*، وابحث عن **PrayerTimesBreak**
وفعّلها، ثم افتح إعداداتها (أيقونة الترس).

لتحديث الإضافة لاحقًا: كرّر الخطوة ١، وانسخ المجلد من جديد (مكان القديم)، ثم `pnpm build`،
وأعد تشغيل ديسكورد.

### الإعدادات

- **المدينة** — اكتب مدينتك (مثل *الرياض*)، واضغط *بحث* واخترها من القائمة؛ فتُملأ خطوط
  العرض والطول تلقائيًا. يُرسَل اسم المدينة المكتوب فقط إلى بحث OpenStreetMap — ولا يُرسل
  موقع جهازك أبدًا. وتبقى الإحداثيات قابلة للتعديل يدويًا تحتها.
- طريقة الحساب (أم القرى افتراضيًا)، واللغة (١١ لغة، العربية افتراضيًا).
- التنبيه عند وقت الصلاة، وقفل ديسكورد أثناء الصلاة، ومدة القفل (١–١٢٠ دقيقة)، والسماح بفتح
  القفل يدويًا، وصوت القفل.
- الذكر الدوري ومدته وموضعه، والسمة.

### التجربة

١. اختر مدينتك من الإعدادات.
٢. اكتب `/prayertimes` في أي محادثة: مواقيت اليوم والصلاة القادمة.
٣. اكتب `/prayertimes-test`: يظهر تنبيه الصلاة وقفل لدقيقة واحدة فورًا.
