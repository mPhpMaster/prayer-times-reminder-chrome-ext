# iOS app (iPhone / iPad)

[English](#english) · [العربية](#arabic)

<a id="english"></a>

## English

The iOS app is the same Capacitor shell as Android (`targets/mobile`): the
shared `core/` web layer, `web/adapter.js` as the bridge, and a native Xcode
project in `ios/` (Capacitor 8, **Swift Package Manager**, no CocoaPods). It is
built for free on GitHub Actions (`.github/workflows/ios.yml`), so no Mac and no
paid Apple account are needed until you publish.

| | |
|---|---|
| Bundle ID | `com.mphpmaster.prayer` (same as Android) |
| Name under the icon | «مواقيت الصلاة» on Arabic phones, "Prayer Times Reminder" otherwise (`ar.lproj` / `en.lproj` `InfoPlist.strings`) |
| Version | `versionName` / `versionCode` from `android/app/build.gradle` (now 2.4.9 / 232). CI passes them to Xcode as `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION`, so one bump serves both stores. |
| Minimum iOS | 15.0, iPhone + iPad, all orientations on iPad |
| Icons / splash | `python scripts/make_ios_icons.py` (same crescent art as Android; every size + the 1024 App Store icon, no alpha) |

### What works on iOS

- **Prayer times** (offline engine), location by city or GPS (`@capacitor/geolocation`, "while using" only), all settings, 11 languages, themes.
- **Prayer-time notifications** (`@capacitor/local-notifications`). iOS keeps at most **64** pending local notifications, so iOS schedules **3 days** ahead (15 prayers + 30 game alerts) instead of Android's 7, and tops up on every launch / return to the app. Open the app at least every 3 days to keep reminders flowing.
- **Prayer lock, in the app**: when you tap a prayer notification, or a prayer time comes while the app is open, the same lock screen (countdown, chime or adhan) covers the app. The adhan plays from an AAC copy (`ios-assets/audio/adhan.m4a`, added by `scripts/ios-extras.mjs` during `cap sync`) because WKWebView can't play the shared Ogg file.
- **Dhikr game with voice**: `ios/App/App/SpeechPlugin.swift` uses Apple's `SFSpeechRecognizer` (Arabic `ar-SA`) behind the *same* JS contract as Android's `SpeechPlugin`, so `Platform.speech` and the game are unchanged. It asks for microphone + speech-recognition permission on first use. Apple's recognizer may need the internet for Arabic.
- Email/password account, leaderboard, follows, family (in the app), dedications, account deletion, game alerts ("tasks open" / "30 min left").

### What doesn't (and why)

| Feature | Why not on iOS |
|---|---|
| Lock **over other apps** / un-escapable lock | Apple doesn't allow an app to cover, block or relaunch over other apps (no overlay / full-screen-intent / accessibility equivalent; App Review guideline 2.5). The lock is in-app only. |
| Silent during prayer (Do Not Disturb) | No public API to change Focus/DND. The option is hidden. |
| Periodic dhikr balloon over other apps | No drawing over other apps, no exact background alarms. The option is hidden. |
| Parent "children didn't finish" alerts | They ask the server at alert time from a native Android alarm; iOS has no reliable timed background work. Parents see progress in the app. |
| Google sign-in | Needs a new iOS OAuth client + native SDK, and then App Store rule 4.8 also requires *Sign in with Apple*. Hidden for now (email/password works). Steps below. |
| Play Integrity "verified" mark, Android widgets, in-app update checker, offline Whisper engine | Android/Google-Play specific. The App Store updates apps itself. Widgets could come later as a WidgetKit extension. |

All of these are simply absent on iOS: their native plugins don't exist there, and every caller in `adapter.js` / `core` already checks. The iOS-only code is the `isIOS` block at the end of `web/adapter.js` (plus `SCHED_DAYS` and one guard in the permission flow).

### Build

CI (free): every push touching `targets/mobile/**`, `core/**` or the workflow, or **Actions → iOS → Run workflow**. Artifacts:

- `ios-unsigned-ipa` → `PrayerTimes-<ver>-<code>-unsigned.ipa` (for real devices, sideload below)
- `ios-simulator-app` → `PrayerTimes-<ver>-<code>-simulator.zip` (only useful on a Mac: unzip, `xcrun simctl install booted App.app`)

```
gh run download <run-id> -n ios-unsigned-ipa -D D:\chrome-ext\store-release\ios
```

Locally (any OS, regenerates `ios/App/App/public` and `CapApp-SPM/Package.swift`):

```
cd targets/mobile
npm ci
node ../../tools/sync-core.mjs mobile
npx cap sync ios          # works on Windows too; only the Xcode build needs macOS
```

### Install on your iPhone for free (Windows, Sideloadly)

1. Install **iTunes** and **iCloud** from apple.com (the *non-Microsoft-Store* installers; Sideloadly needs their drivers), then **Sideloadly** from sideloadly.io.
2. Download the `ios-unsigned-ipa` artifact (command above) and unzip it to get the `.ipa`.
3. Connect the iPhone by USB, unlock it, tap **Trust this computer**.
4. In Sideloadly: drag in the `.ipa`, type your Apple ID, press **Start** (enter the password / 2FA code when asked; it goes to Apple only).
   Tip: in *Advanced options* tick **Change bundle ID** (e.g. `com.mphpmaster.prayer.dev`) so the real ID stays free for the paid account later.
5. On the iPhone: **Settings → General → VPN & Device Management** → your Apple ID → **Trust**. On iOS 16+ also turn on **Settings → Privacy & Security → Developer Mode** (the phone restarts).
6. Open the app, pick a city, allow notifications.

Free Apple ID limits: the app **stops opening after 7 days** — re-run Sideloadly with the same IPA to refresh (data is kept; Sideloadly's "auto-refresh" can do it over Wi-Fi while the PC is on). At most 3 sideloaded apps per device. AltStore works the same way.

### Publishing on the App Store (after buying the Apple Developer Program, 99 USD/year)

1. **Enroll** at developer.apple.com/programs (Individual). Note your **Team ID** (Membership page).
2. **App ID**: Certificates, IDs & Profiles → Identifiers → + → App ID `com.mphpmaster.prayer`. No extra capabilities are needed (local notifications need none).
3. **App record**: appstoreconnect.apple.com → My Apps → + → New App: iOS, name (must be unique on the store, e.g. «مواقيت الصلاة - تذكير»), primary language Arabic or English, bundle ID above, SKU `prayer-times-ios`.
4. **Signing in CI** (no Mac needed): App Store Connect → Users and Access → Integrations → **App Store Connect API** → generate a key (role **Admin** so Xcode cloud signing can create the distribution certificate; download the `.p8` once). In GitHub → Settings → Secrets and variables → Actions add secrets `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8_BASE64` (`base64 -w0 AuthKey_XXXX.p8`), optionally `IOS_DIST_CERT_P12_BASE64` + `IOS_DIST_CERT_PASSWORD` if you prefer your own certificate, and the **variable** `IOS_APPSTORE_ENABLED=true`. Then Actions → iOS → Run workflow with **appstore** ticked: the `appstore` job archives with automatic signing and uploads to App Store Connect / TestFlight. (With a Mac instead: open `ios/App/App.xcodeproj`, pick your team, Product → Archive → Distribute App.)
5. **Each upload needs a higher build number**: bump `versionCode` (and `versionName` for a new store version) in `android/app/build.gradle`.
6. **Screenshots** (per language, PNG/JPEG, no alpha): iPhone **6.9"** 1320×2868 (or 1290×2796) — required; iPad **13"** 2064×2752 (or 2048×2732) — required because the app runs on iPad. 3–10 each. Take them in the Simulator (Xcode on a Mac or a CI job with `xcrun simctl io booted screenshot`).
7. **App Privacy (nutrition label)** — must match `PRIVACY.md` and `ios/App/App/PrivacyInfo.xcprivacy`:
   - *Data used to track you*: **none**.
   - *Data linked to you* (only with the optional game account), purpose **App Functionality**: Contact Info → **Email Address**, **Name** (display name); Identifiers → **User ID**; User Content → **Gameplay Content** (finished dhikr tasks, points), **Other User Content** (dedication-name requests).
   - *Not collected*: location (stays on the device), audio/voice (Apple's recognizer turns it into text; the developer never receives audio or text), contacts, purchases, diagnostics.
   - Privacy policy URL: `https://mphpmaster.github.io/prayer-times-reminder-chrome-ext/privacy.html`. It already has an "iPhone and iPad app" section (Apple's speech recognition: on-device when supported, otherwise processed by Apple under Apple's privacy policy).
8. **Other answers**: category Lifestyle (or Reference); age rating 4+; export compliance = "None of the algorithms" (`ITSAppUsesNonExemptEncryption` is already `false`); price Free; no in-app purchases (the donate link is already hidden in the mobile apps).
9. **Review notes** (App Review Information): a demo email/password account for the game; "Prayer times work without an account. The dhikr game uses the microphone and Apple speech recognition only while the player taps Start reading; nothing is recorded. Account deletion: Game → My account → Delete my account. The prayer lock is shown inside the app only." Rejection risk to expect: guideline 4.2 (minimum functionality of web-view apps) — point to the native notifications, location, speech recognition and offline prayer engine.

### Google sign-in on iOS (later)

1. Google Cloud console (same project as the web/Android clients) → Credentials → OAuth client ID → **iOS**, bundle ID `com.mphpmaster.prayer`.
2. Add Google's `GoogleSignIn-iOS` package (SPM) and a small `GoogleAuthPlugin.swift` with jsName `GoogleAuth` and `signIn({clientId})` → `{ idToken }` / `signOut()`, registered in `MainViewController.swift` like `SpeechPlugin`; add the reversed client ID as a URL scheme in `Info.plist`.
3. The server must accept that client's ID tokens (add the iOS client ID to the allowed audiences next to `GOOGLE_WEB_CLIENT_ID`).
4. Because a third-party login is then offered, App Store guideline 4.8 requires **Sign in with Apple** as well (needs the paid account: capability + server-side token check).

---

<a id="arabic"></a>

<div dir="rtl">

## العربية

نسخة iOS هي غلاف Capacitor نفسه الذي يستخدمه أندرويد في `targets/mobile`. فيها طبقة الويب المشتركة <span dir="ltr">`core/`</span>، والجسر `web/adapter.js`، ومشروع Xcode أصلي في المجلد <span dir="ltr">`ios/`</span>. المشروع يستخدم Capacitor 8 مع **Swift Package Manager** دون CocoaPods.
يُبنى التطبيق مجانًا على GitHub Actions عبر الملف <span dir="ltr">`.github/workflows/ios.yml`</span>، فلا تحتاج جهاز Mac ولا حسابًا مدفوعًا لدى Apple حتى وقت النشر.

| البند | القيمة |
|---|---|
| معرّف الحزمة | المعرّف `com.mphpmaster.prayer`، وهو نفسه في أندرويد. |
| الاسم تحت الأيقونة | «مواقيت الصلاة» في الأجهزة العربية. وفي غيرها: `Prayer Times Reminder`. |
| الإصدار | يُؤخذ من `android/app/build.gradle` (القيمتان `versionName` و`versionCode`). الإصدار الحالي `2.4.9` ورقم البناء `232`، فرفعٌ واحد يكفي المتجرين. |
| أقل إصدار من iOS | الإصدار `15.0`، للآيفون والآيباد. |
| الأيقونات وشاشة البدء | يولّدها الأمر `python scripts/make_ios_icons.py` بنفس رسم الهلال، بكل المقاسات، مع أيقونة `1024` بلا شفافية. |

### ما يعمل على iOS

- **مواقيت الصلاة** (محسوبة على الجهاز)، والموقع بالمدينة أو بـ GPS (أثناء الاستخدام فقط)، وكل الإعدادات واللغات والسمات.
- **إشعارات أوقات الصلاة**: يسمح iOS بـ **64** إشعارًا مجدولًا كحد أقصى، لذلك تُجدول النسخة **3 أيام** مقدمًا (15 صلاة و30 تنبيه لعبة) بدل 7 في أندرويد، وتُجدَّد عند كل فتح للتطبيق. افتح التطبيق مرة كل 3 أيام على الأقل.
- **قفل الصلاة داخل التطبيق**: عند الضغط على إشعار الصلاة، أو إذا دخل الوقت والتطبيق مفتوح، تظهر شاشة القفل نفسها (عدّ تنازلي، نغمة أو أذان). الأذان بصيغة AAC لأن WKWebView لا يشغّل ملف Ogg.
- **لعبة الأذكار بالصوت**: الملف `SpeechPlugin.swift` يستخدم التعرّف على الكلام من Apple بالعربية (`ar-SA`) بنفس واجهة إضافة أندرويد، فاللعبة لم تتغير. يطلب إذن الميكروفون والتعرّف على الكلام أول مرة، وقد يحتاج الإنترنت للعربية.
- الحساب بالبريد وكلمة المرور، لوحة الصدارة، المتابعة، العائلة (داخل التطبيق)، الإهداءات، حذف الحساب، تنبيهات اللعبة.

### ما لا يعمل (ولماذا)

| الميزة | السبب |
|---|---|
| القفل **فوق التطبيقات الأخرى** والقفل غير القابل للهروب | تمنع Apple أي تطبيق من تغطية تطبيقات أخرى أو حجبها أو الظهور فوقها. القفل داخل التطبيق فقط. |
| الصامت أثناء الصلاة (عدم الإزعاج) | لا توجد واجهة عامة لتغيير وضع التركيز. الخيار مخفي. |
| فقاعة الذكر الدورية فوق التطبيقات | لا رسم فوق التطبيقات ولا منبّهات خلفية دقيقة. الخيار مخفي. |
| تنبيه الوالد «لم يُكمل الأبناء» | يعتمد على منبّه في أندرويد يسأل الخادم وقت التنبيه، ونظام iOS لا يسمح بعمل خلفي موقوت موثوق. يرى الوالد التقدم داخل التطبيق. |
| الدخول بحساب Google | يحتاج عميل OAuth جديدًا لنظام iOS وحزمة أصلية. وبعدها تشترط Apple في القاعدة `4.8` إضافة **الدخول بحساب Apple**. الخيار مخفي حاليًا، والبريد وكلمة المرور يعملان. |
| علامة التوثيق (Play Integrity)، وأدوات الشاشة الرئيسية، ومدقق التحديثات، ومحرك Whisper | ميزات خاصة بأندرويد ومتجر Google Play. متجر Apple يحدّث التطبيقات بنفسه. |

### التثبيت على آيفونك مجانًا (من ويندوز عبر Sideloadly)

1. ثبّت **iTunes** و**iCloud** من موقع apple.com (ليس من متجر مايكروسوفت)، ثم **Sideloadly** من sideloadly.io.
2. نزّل ملف `ios-unsigned-ipa` من GitHub Actions وفك ضغطه لتحصل على ملف <span dir="ltr">`.ipa`</span>. الأمر:
   `gh run download <run-id> -n ios-unsigned-ipa -D D:\chrome-ext\store-release\ios`
3. وصّل الآيفون بالسلك، افتح قفله، واضغط **الوثوق بهذا الكمبيوتر**.
4. في Sideloadly: اسحب ملف <span dir="ltr">`.ipa`</span>، واكتب معرّف Apple ID، واضغط **Start**. كلمة المرور ورمز التحقق يذهبان إلى Apple فقط.
   نصيحة: من *Advanced options* فعّل **Change bundle ID**، واكتب مثلًا `com.mphpmaster.prayer.dev`، ليبقى المعرّف الحقيقي محجوزًا للحساب المدفوع لاحقًا.
5. في الآيفون: **الإعدادات ← عام ← الشبكة الخاصة الافتراضية وإدارة الجهاز** ← حسابك ← **وثوق**. وفي iOS 16 فأحدث فعّل **الإعدادات ← الخصوصية والأمن ← وضع المطوّر** (يُعاد تشغيل الجهاز).
6. افتح التطبيق، اختر مدينتك، واسمح بالإشعارات.

حدود الحساب المجاني: **يتوقف التطبيق عن الفتح بعد 7 أيام**. أعد تشغيل Sideloadly بنفس الملف للتجديد (تبقى بياناتك)، أو فعّل التجديد التلقائي عبر Wi‑Fi. الحد 3 تطبيقات مثبتة بهذه الطريقة لكل جهاز.

### النشر في App Store (بعد شراء عضوية Apple Developer بـ 99 دولارًا سنويًا)

1. **سجّل** في developer.apple.com/programs (فردي) واحفظ **Team ID**.
2. **معرّف التطبيق (App ID)**: من صفحة Certificates, IDs & Profiles أنشئ المعرّف `com.mphpmaster.prayer`. لا يحتاج صلاحيات إضافية.
3. **سجل التطبيق**: افتح موقع appstoreconnect.apple.com، ثم My Apps، ثم زر +، ثم New App. اختر iOS، واسمًا فريدًا في المتجر (مثل «مواقيت الصلاة - تذكير»)، واللغة الأساسية، ومعرّف الحزمة، والرمز `prayer-times-ios` في خانة SKU.
4. **التوقيع على CI بلا Mac**: افتح App Store Connect، ثم Users and Access، ثم Integrations، ثم App Store Connect API، وأنشئ مفتاحًا بدور **Admin** ونزّل ملف <span dir="ltr">`.p8`</span> (مرة واحدة فقط).
   ثم افتح المستودع في GitHub، ثم Settings، ثم Secrets and variables، ثم Actions، وأضف الأسرار `APPLE_TEAM_ID` و`ASC_KEY_ID` و`ASC_ISSUER_ID` و`ASC_KEY_P8_BASE64`، واختياريًا `IOS_DIST_CERT_P12_BASE64` و`IOS_DIST_CERT_PASSWORD`، والمتغير `IOS_APPSTORE_ENABLED=true`.
   بعدها افتح تبويب Actions، ثم iOS، ثم Run workflow مع تفعيل **appstore**، فيُبنى التطبيق موقّعًا ويُرفع إلى App Store Connect وTestFlight.
5. **كل رفع يحتاج رقم بناء أعلى**: ارفع `versionCode` (و`versionName` لإصدار جديد) في `android/app/build.gradle`.
6. **لقطات الشاشة** لكل لغة، من 3 إلى 10 لكل جهاز، تُلتقط من المحاكي:
   - آيفون **6.9 إنش**: المقاس `1320×2868` (أو `1290×2796`).
   - آيباد **13 إنش**: المقاس `2064×2752` (أو `2048×2732`).
7. **خصوصية التطبيق** (مطابقة لـ `PRIVACY.md` و`PrivacyInfo.xcprivacy`): لا تتبّع إطلاقًا. بيانات مرتبطة بالمستخدم (فقط مع حساب اللعبة الاختياري) لغرض **وظائف التطبيق**: البريد الإلكتروني، الاسم (الاسم الظاهر)، معرّف المستخدم، محتوى اللعب، ومحتوى آخر من المستخدم (طلبات أسماء الإهداء). لا يُجمع: الموقع، الصوت، جهات الاتصال، المشتريات، التشخيص.
   رابط سياسة الخصوصية: `https://mphpmaster.github.io/prayer-times-reminder-chrome-ext/privacy.html`، وفيها قسم لتطبيق الآيفون والآيباد يشرح استخدام التعرّف على الكلام من Apple.
8. **إجابات أخرى**: الفئة Lifestyle، والتصنيف العمري +4، والتشفير: لا خوارزميات خاصة (المفتاح مضبوط مسبقًا)، والتطبيق مجاني بلا مشتريات داخلية (رابط التبرع مخفي في تطبيقات الجوال).
9. **ملاحظات المراجعة**: حساب تجريبي (بريد وكلمة مرور) للعبة، وشرح أن المواقيت تعمل بلا حساب، وأن الميكروفون يُستخدم فقط عند «ابدأ القراءة» ولا يُسجَّل شيء، ومكان حذف الحساب، وأن القفل داخل التطبيق فقط.
   توقّع احتمال الرفض بالقاعدة `4.2` (تطبيقات الويب البسيطة)، وردّ عليه بذكر الإشعارات الأصلية والموقع والتعرّف على الكلام والحساب دون اتصال.

### الدخول بحساب Google في iOS (لاحقًا)

أنشئ عميل OAuth من نوع **iOS** في Google Cloud لنفس المعرّف. ثم أضف الحزمة `GoogleSignIn-iOS` وإضافة صغيرة اسم ملفها `GoogleAuthPlugin.swift` واسمها في الجافاسكربت `GoogleAuth`، وسجّلها في `MainViewController.swift`.
بعد ذلك اجعل الخادم يقبل رموز هذا العميل، ثم أضف **الدخول بحساب Apple** لأن القاعدة `4.8` تشترطه.

</div>
