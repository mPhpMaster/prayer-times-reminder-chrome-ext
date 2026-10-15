# Sign in with Apple + account linking / تسجيل الدخول باستخدام Apple وربط الحسابات

[العربية](#العربية) · [English](#english)

---

## العربية

### الوضع الحالي

- الكود جاهز في الخادم وفي كل المنصات، لكن **Apple مطفأ تمامًا** حتى تُضبط متغيرات البيئة أدناه. ما دام مطفأً:
  `GET /v1/auth/config` يعيد `"apple": null`، وزر «تسجيل الدخول باستخدام Apple» مخفي، و`/v1/auth/apple` يعيد `503 apple-unavailable`.
- **ربط Google بحساب موجود يعمل من الآن** (قسم «طرق تسجيل الدخول» في «حسابي»).
- يحتاج تفعيل Apple إلى عضوية Apple Developer Program (رسوم سنوية 99$)، لا بديل مجاني لها.

### ما تنشئه في حساب Apple Developer (مرة واحدة)

1. **App ID** — Certificates, Identifiers & Profiles ← Identifiers ← App IDs:
   المعرّف `com.mphpmaster.prayer` (نفس معرّف تطبيق iOS)، وفعّل **Sign in with Apple** (Enable as a primary App ID).
2. **Services ID** (للويب وChrome وWindows وAndroid) — Identifiers ← ➕ ← Services IDs:
   - Identifier مقترح: `com.mphpmaster.prayer.signin` (هذا هو `APPLE_SERVICES_ID`).
   - فعّل **Sign in with Apple** ثم **Configure**:
     - Primary App ID: `com.mphpmaster.prayer`
     - Domains and Subdomains: `prayer-times.sarhsoft.com`
     - Return URLs: `https://prayer-times.sarhsoft.com/v1/auth/apple/callback`
   - إن طلبت الصفحة **التحقق من النطاق** (Download / Verify): ضع الملف الذي تنزّله في
     `backend/public/.well-known/apple-developer-domain-association.txt` على الخادم ثم اضغط Verify.
3. **مفتاح Sign in with Apple** (اختياري لكنه مطلوب عمليًا لمراجعة App Store) — Keys ← ➕:
   فعّل Sign in with Apple ← Configure ← اختر `com.mphpmaster.prayer` ← Continue ← Register ← **Download** ملف `AuthKey_XXXXXXXXXX.p8` (يُنزَّل مرة واحدة فقط).
   - ارفعه إلى الخادم **خارج مجلد public**، مثل `~/keys/AuthKey_XXXXXXXXXX.p8`، وصلاحياته `600`.
   - سجّل **Key ID** (10 أحرف) و**Team ID** (أعلى يمين صفحة الحساب).
   - به يحفظ الخادم رمز Apple ويُلغيه عند فك الربط أو حذف الحساب (إرشاد App Store رقم 5.1.1(v)).
4. **البريد المخفي (Hide My Email)** — من يخفي بريده يصلنا عنوان مثل `xyz@privaterelay.appleid.com`. لكي تصل إليه رسائل الخادم (رمز استعادة كلمة المرور، تأكيد البريد): Services ← **Sign in with Apple for Email Communication** ← Configure ← أضف نطاق/عنوان الإرسال الذي يستخدمه الخادم (`MAIL_FROM_ADDRESS`) مع سجل SPF صحيح. بدونه ترتد هذه الرسائل فقط؛ الدخول نفسه يعمل.

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

ثم: `php artisan migrate --force` (يضيف العمودين `apple_sub` و`apple_refresh_token`؛ آمن على SQLite 3.7 ويمكن تشغيله مرتين)، ثم `php artisan config:clear` (أو `config:cache` إن كنت تستخدمه).
تحقق: `https://prayer-times.sarhsoft.com/v1/auth/config` يجب أن يعرض `"apple":{"servicesId":"com.mphpmaster.prayer.signin",...}`.

`APP_KEY` يجب أن يكون مضبوطًا (يُستعمل لتشفير رمز Apple المحفوظ).

### كيف يعمل في كل منصة

| المنصة | الطريقة |
|---|---|
| Chrome | نافذة `chrome.identity` نفسها المستخدمة لـGoogle؛ يعود إلى `https://<id>.chromiumapp.org/apple` |
| الموقع (GitHub Pages) | الصفحة تنتقل إلى Apple ثم تعود عبر `apple-callback.html` |
| Windows | المتصفح الافتراضي + المنفذ المحلي 127.0.0.1:53917–53919 (نفس آلية Google) |
| Android | صفحة Apple داخل WebView التطبيق (`allowNavigation: appleid.apple.com`) ثم العودة إلى `https://localhost/apple-callback.html` |
| iOS | أصلي عبر إضافة Capacitor اسمها `AppleAuth` (يبنيها مشروع iOS — انظر الأسفل) |

Apple لا يعيد إلا إلى عناوين https على نطاق موثّق، لذلك يرسل Apple الرد (`form_post`) إلى الخادم على
`/v1/auth/apple/callback`، والخادم يحوّله فورًا (303) إلى عنوان التطبيق المحدد في `state` من قائمة مسموحة ثابتة فقط، والرمز في جزء `#` من العنوان. التطبيق يتحقق من `state` و`nonce`، والخادم يتحقق من توقيع الرمز بمفاتيح Apple العامة (JWKS).

**تحديثات تحتاج إصدارًا جديدًا:** Android (تغيّر `capacitor.config.json`، شغّل `npx cap sync`)، وWindows (أمر Rust جديد `apple_sign_in`)، وإضافة Chrome (ملف `apple-auth-chrome.js`). الموقع يتحدث مع النشر التلقائي.

### iOS (لاحقًا، في مشروع `targets/mobile/ios`)

- في Xcode: Signing & Capabilities ← ➕ **Sign in with Apple**.
- إضافة Capacitor اسمها **`AppleAuth`** بدالة `signIn({ nonce })`:
  تستخدم `ASAuthorizationAppleIDProvider` بنطاق `.email`، وتضع في الطلب **SHA-256 (hex) للـnonce**، وتعيد `{ identityToken, authorizationCode }` (نصوص UTF-8)، وعند الإلغاء ترفض بـ`code: "canceled"`، وغيره `"failed"`.
- `targets/mobile/web/adapter.js` يلتقطها تلقائيًا (`Platform.appleAuth.native = true`) ويرسل الـnonce الخام للخادم.
- **إرشاد App Store رقم 4.8:** بما أن تطبيق iOS يعرض «المتابعة بحساب Google» فيجب أن يعرض أيضًا «تسجيل الدخول باستخدام Apple» بالقدر نفسه من الظهور. والزر يظهر تلقائيًا متى كانت الإضافة موجودة و`APPLE_CLIENT_IDS` مضبوطًا.

### ربط الحسابات (يعمل بالاتجاهين)

من «حسابي» ← «طرق تسجيل الدخول»: ربط/إلغاء ربط Google وApple، وحالة البريد وكلمة المرور.
- بعد الربط، الدخول بأيّ منهما يفتح الحساب نفسه.
- إن كان حساب Google/Apple مرتبطًا بلاعب آخر: `409 account-conflict`.
- إن كان حسابك مرتبطًا بحساب آخر من النوع نفسه: `409 already-linked` (ألغِ الربط أولًا).
- لا يمكن إلغاء آخر طريقة دخول (لا كلمة مرور ولا مزوّد آخر): `409 last-method`.

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
