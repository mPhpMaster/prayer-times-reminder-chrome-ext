# Prayer Times Break — Discord (Vencord userplugin)

## English

**What it does.** Brings Prayer Times Reminder into Discord through
[Vencord](https://github.com/Vendicated/Vencord):

- Computes today's prayer times **offline** (adhan) for your coordinates.
- At each prayer (Fajr, Dhuhr/Jumu'ah, Asr, Maghrib, Isha) it shows a Vencord
  notification and, if enabled, covers Discord with the same lock screen the
  other apps use, for the set number of minutes.
- Optional periodic dhikr card (the app's curated phrases only).
- `/prayertimes` replies (only visible to you) with today's times and the next prayer.

**Build & install** (Vencord userplugins are compiled from source):

```sh
# 1. In this repo: assemble the plugin folder
npm run sync:vencord            # -> targets/vencord/build/prayerTimesBreak/

# 2. In a Vencord checkout (git clone https://github.com/Vendicated/Vencord)
pnpm install --frozen-lockfile
cp -r <this-repo>/targets/vencord/build/prayerTimesBreak src/userplugins/
pnpm build                      # then `pnpm inject` once, if Vencord isn't installed yet
```

Restart Discord, then enable **PrayerTimesBreak** in *User Settings → Vencord → Plugins*.

**Settings.** Latitude / longitude (required — right-click your location in
Google Maps or OpenStreetMap: the first number is the latitude, the second the
longitude), calculation method (default Umm al-Qura), language (11 languages,
default Arabic), notify at prayer time, lock Discord during prayer, lock
minutes (1–120), allow manual unlock, lock sound (chime / none), periodic dhikr
+ interval + position, theme.

**How it is built.** `targets/vencord/plugin/` holds the thin Discord shell
(`index.ts`, `settings.ts`, `runtime.ts`). `tools/sync-core.mjs vencord` copies
it and generates `core.generated.js`: the shared `core/` scripts (adhan,
tz-lookup, i18n, dhikr phrases, prayer engine, lock config, scheduler) evaluated
in one function scope and re-exported as ES module exports, plus
`installOverlays()` which runs the shared lock/dhikr overlays. Never edit the
generated folder — edit `core/` or `targets/vencord/plugin/` and re-sync.

## العربية

**ما الذي يفعله؟** يضيف «استراحة مواقيت الصلاة» إلى ديسكورد عبر Vencord:

- يحسب مواقيت صلاة اليوم **دون اتصال** حسب إحداثياتك.
- عند كل صلاة (الفجر، الظهر/الجمعة، العصر، المغرب، العشاء) يظهر تنبيه، ويُقفل
  ديسكورد — إن فعّلت ذلك — بشاشة القفل نفسها المستخدمة في بقية التطبيقات للمدة المحددة.
- تذكير دوري اختياري بالذكر (من الأذكار المعتمدة في التطبيق فقط).
- الأمر `/prayertimes` يعرض مواقيت اليوم والصلاة القادمة (يظهر لك وحدك).

**البناء والتثبيت:**

```sh
npm run sync:vencord            # يُنشئ targets/vencord/build/prayerTimesBreak/
# في نسخة من Vencord:
pnpm install --frozen-lockfile
cp -r <المستودع>/targets/vencord/build/prayerTimesBreak src/userplugins/
pnpm build                      # ثم pnpm inject مرة واحدة إن لم يكن Vencord مثبتًا
```

أعد تشغيل ديسكورد ثم فعّل **PrayerTimesBreak** من *إعدادات المستخدم ← Vencord ← Plugins*.

**الإعدادات:** خط العرض وخط الطول (مطلوبان — انقر بزر الفأرة الأيمن على موقعك في
خرائط Google أو OpenStreetMap: الرقم الأول خط العرض والثاني خط الطول)، طريقة الحساب
(أم القرى افتراضيًا)، اللغة (العربية افتراضيًا)، التنبيه عند وقت الصلاة، قفل ديسكورد
أثناء الصلاة، مدة القفل (١–١٢٠ دقيقة)، السماح بفتح القفل يدويًا، صوت القفل، الذكر الدوري
ومدته وموضعه، والسمة.
