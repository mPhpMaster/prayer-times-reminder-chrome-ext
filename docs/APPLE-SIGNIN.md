# Sign in with Apple + account linking / تسجيل الدخول باستخدام Apple وربط الحسابات

[العربية](#العربية) · [English](#english)

---

<div dir="rtl">

## العربية

### الوضع الحالي

- الكود جاهز في الخادم وفي كل المنصات، لكن **Apple مطفأ تمامًا** حتى تُضبط متغيرات البيئة أدناه. ما دام مطفأً:
  يعيد الطلب `GET /v1/auth/config` القيمة <span dir="ltr">`"apple": null`</span>، ويكون زر «تسجيل الدخول باستخدام Apple» مخفيًا، ويعيد المسار <span dir="ltr">`/v1/auth/apple`</span> الرد <span dir="ltr">`503 apple-unavailable`</span>.
- **ربط Google بحساب موجود يعمل من الآن** (قسم «طرق تسجيل الدخول» في «حسابي»).
- يحتاج تفعيل Apple إلى عضوية Apple Developer Program برسوم سنوية قدرها 99 دولارًا، ولا بديل مجاني لها.

### ما تنشئه في حساب Apple Developer (مرة واحدة)

1. **معرّف التطبيق (App ID)**: افتح Certificates, Identifiers & Profiles، ثم Identifiers، ثم App IDs.
   المعرّف `com.mphpmaster.prayer` (نفس معرّف تطبيق iOS)، وفعّل فيه **Sign in with Apple** بالخيار Enable as a primary App ID.
2. **معرّف الخدمات (Services ID)**، وهو للويب و Chrome و Windows و Android: افتح Identifiers، ثم اضغط ➕ واختر Services IDs.
   - المعرّف المقترح `com.mphpmaster.prayer.signin`، وهو قيمة `APPLE_SERVICES_ID`.
   - فعّل **Sign in with Apple** ثم اضغط **Configure**:
     - في خانة Primary App ID: `com.mphpmaster.prayer`
     - في خانة Domains and Subdomains: `prayer-times.sarhsoft.com`
     - في خانة Return URLs: `https://prayer-times.sarhsoft.com/v1/auth/apple/callback`
   - إن طلبت الصفحة **التحقق من النطاق** (بزرَّي Download و Verify): ضع الملف الذي تنزّله على الخادم في المسار
     `backend/public/.well-known/apple-developer-domain-association.txt` ثم اضغط Verify.
3. **مفتاح Sign in with Apple** (اختياري، لكنه مطلوب عمليًا لمراجعة App Store): افتح Keys واضغط ➕.
   فعّل Sign in with Apple، ثم اضغط Configure واختر `com.mphpmaster.prayer`، ثم Continue، ثم Register، ثم **Download** لتنزيل الملف `AuthKey_XXXXXXXXXX.p8` (يُنزَّل مرة واحدة فقط).
   - ارفعه إلى الخادم **خارج مجلد public**، مثل <span dir="ltr">`~/keys/AuthKey_XXXXXXXXXX.p8`</span>، بصلاحيات `600`.
   - سجّل **معرّف المفتاح (Key ID)** المكوّن من 10 أحرف، و**معرّف الفريق (Team ID)** الظاهر أعلى يمين صفحة الحساب.
   - به يحفظ الخادم رمز Apple ويُلغيه عند فك الربط أو حذف الحساب (إرشاد App Store رقم <span dir="ltr">`5.1.1(v)`</span>).
4. **البريد المخفي (Hide My Email)**: من يخفي بريده يصلنا منه عنوان مثل `xyz@privaterelay.appleid.com`.
   لكي تصل إليه رسائل الخادم (رمز استعادة كلمة المرور، وتأكيد البريد): افتح Services، ثم **Sign in with Apple for Email Communication**، ثم Configure، وأضف نطاق أو عنوان الإرسال الذي يستخدمه الخادم (`MAIL_FROM_ADDRESS`) مع سجل SPF صحيح.
   بدونه ترتد هذه الرسائل فقط، أما الدخول نفسه فيعمل.

### التفعيل على الخادم (prayer-times.sarhsoft.com)

أضف إلى `backend/.env`:

```env
APPLE_CLIENT_IDS=com.mphpmaster.prayer
APPLE_SERVICES_ID=com.mphpmaster.prayer.signin
APPLE_REDIRECT_URI=https://prayer-times.sarhsoft.com/v1/auth/apple/callback
# المفتاح (اختياري، موصى به):
APPLE_TEAM_ID=XXXXXXXXXX
APPLE_KEY_ID=XXXXXXXXXX
APPLE_PRIVATE_KEY_PATH=/home/<user>/keys/AuthKey_XXXXXXXXXX.p8
# فقط لنسخة Chrome تجريبية غير منشورة (المعرّف المنشور مضاف تلقائيًا):
# APPLE_EXTENSION_IDS=knahkbkmbjghaiillhngjbhoinmeegoc,<dev-extension-id>
```

ثم شغّل `php artisan migrate --force` (يضيف العمودين `apple_sub` و `apple_refresh_token`، وهو آمن على SQLite 3.7 ويمكن تشغيله مرتين)، ثم `php artisan config:clear` (أو `config:cache` إن كنت تستخدمه).

للتحقق افتح `https://prayer-times.sarhsoft.com/v1/auth/config`، ويجب أن يعرض <span dir="ltr">`"apple":{"servicesId":"com.mphpmaster.prayer.signin",...}`</span>.

يجب أن يكون `APP_KEY` مضبوطًا، فهو يُستعمل لتشفير رمز Apple المحفوظ.

### كيف يعمل في كل منصة

| المنصة | الطريقة |
|---|---|
| إضافة Chrome | نافذة `chrome.identity` نفسها المستخدمة مع Google، ثم العودة إلى `https://<id>.chromiumapp.org/apple` |
| الموقع على GitHub Pages | الصفحة تنتقل إلى Apple، ثم تعود عبر `apple-callback.html` |
| تطبيق Windows | المتصفح الافتراضي مع المنفذ المحلي على `127.0.0.1` (من `53917` إلى `53919`)، بنفس آلية Google |
| تطبيق Android | صفحة Apple داخل نافذة WebView في التطبيق (بالإعداد `allowNavigation: appleid.apple.com`)، ثم العودة إلى `https://localhost/apple-callback.html` |
| تطبيق iOS | دعم أصلي عبر إضافة Capacitor اسمها `AppleAuth`، يبنيها مشروع iOS (انظر الأسفل) |

لا يعيد Apple إلا إلى عناوين https على نطاق موثّق، لذلك يرسل Apple الرد (`form_post`) إلى الخادم على المسار <span dir="ltr">`/v1/auth/apple/callback`</span>.
ثم يحوّله الخادم فورًا (بالرمز 303) إلى عنوان التطبيق المحدد في `state`، ومن قائمة مسموحة ثابتة فقط، ويكون الرمز في جزء `#` من العنوان.
يتحقق التطبيق من `state` و `nonce`، ويتحقق الخادم من توقيع الرمز بمفاتيح Apple العامة (JWKS).

**تحديثات تحتاج إصدارًا جديدًا:** تطبيق Android (تغيّر `capacitor.config.json`، فشغّل `npx cap sync`)، وتطبيق Windows (أمر Rust جديد اسمه `apple_sign_in`)، وإضافة Chrome (الملف `apple-auth-chrome.js`). أما الموقع فيتحدث مع النشر التلقائي.

### تطبيق iOS (لاحقًا، في مشروع `targets/mobile/ios`)

- في Xcode: افتح Signing & Capabilities، ثم اضغط ➕ وأضف **Sign in with Apple**.
- إضافة Capacitor اسمها **`AppleAuth`** فيها الدالة <span dir="ltr">`signIn({ nonce })`</span>، وهذه الدالة:
  - تستخدم `ASAuthorizationAppleIDProvider` بالنطاق <span dir="ltr">`.email`</span>.
  - تضع في الطلب **تجزئة SHA-256 لقيمة nonce بصيغة hex**.
  - تعيد <span dir="ltr">`{ identityToken, authorizationCode }`</span> (نصوص UTF-8).
  - عند الإلغاء ترفض بالقيمة <span dir="ltr">`code: "canceled"`</span>، وفي غير ذلك بالقيمة <span dir="ltr">`"failed"`</span>.
- يلتقطها الملف `targets/mobile/web/adapter.js` تلقائيًا (`Platform.appleAuth.native = true`)، ويرسل قيمة nonce الخام إلى الخادم.
- **إرشاد App Store رقم 4.8:** بما أن تطبيق iOS يعرض «المتابعة بحساب Google» فيجب أن يعرض أيضًا «تسجيل الدخول باستخدام Apple» بالقدر نفسه من الظهور. والزر يظهر تلقائيًا متى كانت الإضافة موجودة و `APPLE_CLIENT_IDS` مضبوطًا.

### ربط الحسابات (يعمل بالاتجاهين)

من «حسابي» ← «طرق تسجيل الدخول»: ربط وإلغاء ربط Google و Apple، وحالة البريد وكلمة المرور.
- بعد الربط، الدخول بأيّ منهما يفتح الحساب نفسه.
- إن كان حساب Google أو Apple مرتبطًا بلاعب آخر: <span dir="ltr">`409 account-conflict`</span>.
- إن كان حسابك مرتبطًا بحساب آخر من النوع نفسه: <span dir="ltr">`409 already-linked`</span> (ألغِ الربط أولًا).
- لا يمكن إلغاء آخر طريقة دخول (لا كلمة مرور ولا مزوّد آخر): <span dir="ltr">`409 last-method`</span>.

</div>

---

## English

### Status

- Server and every client are done, but **Apple stays completely off** until the env vars below are set: `GET /v1/auth/config` returns `"apple": null`, the "Sign in with Apple" button is hidden, and `/v1/auth/apple` answers `503 apple-unavailable`.
- **Linking Google to an existing account works today** ("Sign-in methods" under "My account").
- Turning Apple on needs an Apple Developer Program membership ($99/year; there is no free tier for this).

### Create once in the Apple Developer account

1. **App ID** (Certificates, Identifiers & Profiles → Identifiers → App IDs): `com.mphpmaster.prayer` (the iOS bundle id), capability **Sign in with Apple** → "Enable as a primary App ID".
2. **Services ID** (web flow: Chrome, website, Windows, Android): Identifiers → ➕ → Services IDs.
   - Identifier, e.g. `com.mphpmaster.prayer.signin` (= `APPLE_SERVICES_ID`).
   - Enable **Sign in with Apple** → **Configure**: Primary App ID `com.mphpmaster.prayer`; Domains `prayer-times.sarhsoft.com`; Return URL `https://prayer-times.sarhsoft.com/v1/auth/apple/callback`.
   - If the portal asks to **verify the domain** (Download / Verify), put the downloaded file at `backend/public/.well-known/apple-developer-domain-association.txt` on the server, then press Verify.
3. **Sign in with Apple key** (optional, but App Review effectively needs it): Keys → ➕ → Sign in with Apple → Configure → `com.mphpmaster.prayer` → Register → **Download** `AuthKey_XXXXXXXXXX.p8` (one-time download).
   Upload it **outside the web root** (e.g. `~/keys/`, mode `600`); note the **Key ID** and your **Team ID**. With it the server keeps Apple's refresh token (encrypted) and revokes it on unlink and on account deletion (guideline 5.1.1(v)).
4. **Hide My Email**: players may share `xyz@privaterelay.appleid.com`. For the server's mails (password reset, email confirmation) to reach them, register the sending domain/address (`MAIL_FROM_ADDRESS`, with SPF) under Services → **Sign in with Apple for Email Communication**. Without it only those mails bounce; sign-in works.

### Turn it on (server)

```env
APPLE_CLIENT_IDS=com.mphpmaster.prayer
APPLE_SERVICES_ID=com.mphpmaster.prayer.signin
APPLE_REDIRECT_URI=https://prayer-times.sarhsoft.com/v1/auth/apple/callback
APPLE_TEAM_ID=XXXXXXXXXX
APPLE_KEY_ID=XXXXXXXXXX
APPLE_PRIVATE_KEY_PATH=/home/<user>/keys/AuthKey_XXXXXXXXXX.p8
# Only for an unpublished dev copy of the extension (the store id is built in):
# APPLE_EXTENSION_IDS=knahkbkmbjghaiillhngjbhoinmeegoc,<dev-extension-id>
```

Then `php artisan migrate --force` (adds `apple_sub` + `apple_refresh_token`; SQLite 3.7 safe, re-runnable) and `php artisan config:clear` (or `config:cache`). Check `GET /v1/auth/config` shows `apple`. `APP_KEY` must be set (it encrypts the kept token).

### Per platform

| Platform | Flow |
|---|---|
| Chrome | `chrome.identity.launchWebAuthFlow`, back at `https://<id>.chromiumapp.org/apple` |
| Website | the tab goes to Apple and returns through `apple-callback.html` |
| Windows | default browser + the 127.0.0.1:53917–53919 loopback listener (as for Google) |
| Android | Apple's page inside the app WebView (`allowNavigation: appleid.apple.com`), back at `https://localhost/apple-callback.html` |
| iOS | native, via a Capacitor plugin `AppleAuth` (built by the iOS project; see below) |

Apple only returns to https URLs on a verified domain, so it form-posts to the server's `/v1/auth/apple/callback`, which 303-redirects to the app's return address picked by the `state` prefix from a fixed allow-list (`ext-<id>`, `web`, `desk-<port>`, `app`), with the token in the URL fragment. The app checks state + nonce; the server verifies the RS256 signature against Apple's JWKS, `iss`, `aud` (bundle id or Services ID), `exp` and the nonce.

New builds needed: Android (`capacitor.config.json` changed → `npx cap sync`), Windows (new Rust command `apple_sign_in`), Chrome (`apple-auth-chrome.js`). The website updates with its normal deploy.

### iOS (later, in `targets/mobile/ios`)

- Xcode → Signing & Capabilities → ➕ **Sign in with Apple**.
- A Capacitor plugin named **`AppleAuth`** with `signIn({ nonce })`: `ASAuthorizationAppleIDProvider`, scope `.email`, request nonce = **SHA-256 hex of the given nonce**, resolves `{ identityToken, authorizationCode }` (UTF-8 strings); rejects with `code: "canceled"` on cancel, else `"failed"`.
- `targets/mobile/web/adapter.js` picks it up (`Platform.appleAuth.native = true`) and sends the raw nonce to the server.
- **App Store Review Guideline 4.8 (Login Services):** the iOS app offers Google sign-in, so it must also offer Sign in with Apple, equally prominent. The button appears automatically once the plugin exists and `APPLE_CLIENT_IDS` is set.

### API

| Endpoint | Body | Notes |
|---|---|---|
| `GET /v1/auth/config` | – | `apple: {servicesId, redirectUri} \| null` |
| `POST /v1/auth/apple` | `identityToken, nonce?, authorizationCode?, username?, legacyToken?` | like `/auth/google`; `422 username-required` for a new player |
| `POST /v1/auth/apple/callback` | Apple's form post | 303 to the app; `400` for an unknown `state` target |
| `POST /v1/me/link/google` | `idToken` | `409 account-conflict` / `already-linked` |
| `POST /v1/me/link/apple` | `identityToken, nonce?, authorizationCode?` | same |
| `DELETE /v1/me/link/{google\|apple}` | – | `409 last-method` if no other way to sign in remains |
| `GET /v1/me` | – | `user.google`, `user.apple`, `user.hasPassword` |
