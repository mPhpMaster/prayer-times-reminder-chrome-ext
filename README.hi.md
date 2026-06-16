# Prayer Times Reminder — Chrome Extension (हिन्दी)

![नमाज़ के समय — हिन्दी UI](screenshots/hi.png)

A Manifest V3 Chrome extension that:

- 🔔 **हर नमाज़ से 5 मिनट पहले** और फिर समय आने पर भी (Fajr, Dhuhr, Asr, Maghrib, Isha) — आपकी चुनी हुई भाषा में नोटिफाई करता है।
- 🔒 **ऐच्छिक टैब लॉक** — समय आने पर सक्रिय ब्राउज़र टैब को (1–120 मिनट, डिफ़ॉल्ट 5) तक लॉक करता है, काउंटडाउन ओवरले के साथ; जल्दी अनलॉक के लिए क्लोज़ बटन भी उपलब्ध।
- 🕌 **आपके शहर/देश के लिए पूरा दैनिक नमाज़ शेड्यूल** — अगली नमाज़ तक लाइव काउंटडाउन के साथ।
- 🌍 **Country & city dropdowns** — देश चुनें, फिर शहर की लिस्ट अपने-आप लोड हो जाएगी।
- 🌐 **8 भाषाएँ** — popup हेडर से या **Settings → Language** से स्विच करें (नीचे [Supported languages](#supported-languages))।
- 🌗 **Theme** — Midnight Emerald (डिफ़ॉल्ट) या Classic — Settings में चुनें।
- 📅 **Gregorian date format** — फ़ुटर में तारीख़ कैसे दिखेगी चुनें।
- 🌙 **Hijri date** — Gregorian तारीख़ के साथ दिखती है।
- 📿 **Periodic dhikr** — सक्रिय टैब पर एक रैंडम धिक्र (100 वाक्य) फ़्लोट करता है; टैप करके बंद करें या 10 सेकंड बाद अपने-आप छिप जाएगा।

[English](README.en.md) · [Deutsch](README.de.md) · [العربية](README.ar.md) · [اردو](README.ur.md) · [Français](README.fr.md) · [Español](README.es.md) · [हिन्दी](README.hi.md) · [Bahasa Indonesia](README.id.md)

Prayer times come from the free [AlAdhan API](https://aladhan.com/prayer-times-api); the city list comes from the free [CountriesNow API](https://countriesnow.space). No API keys required.

## Install (load unpacked)

1. Open `chrome://extensions` in Chrome.
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked** and select this folder.
4. Click the extension icon in the toolbar to open the popup.
5. Click **⚙️ Settings**, choose your **Country** then **City** from the dropdowns (or click **📍 Use my location**), pick a calculation method, then **Save & Load**.
6. Choose your language from the **dropdown** in the popup header (or in **Settings → Language**).

## Settings

| Setting | Description |
|---------|-------------|
| Country / City | Location used for prayer times (or use geolocation). |
| Calculation method | AlAdhan method (ISNA, Muslim World League, Umm al-Qura, Egyptian, Karachi, Diyanet, etc.). |
| Date format | How the Gregorian date appears in the footer. |
| Number style | When Arabic or Urdu is active: Arabic-Indic (٠١٢٣) or Western (0123) digits for times and countdowns. |
| Lock tab during prayer | Active tab पर prayer time के समय full-page overlay inject करता है। |
| Lock duration | Tab कितनी देर locked रहता है (1–120 minutes). |
| Allow manual unlock | Lock screen early dismiss करने के लिए close (×) बटन दिखाता है। |
| Periodic dhikr | Active tab पर fixed या random interval पर dhikr दिखाता है। |
| Dhikr position | Page का corner या center (top/bottom × left/right/center). |
| Theme | Midnight Emerald (default) या Classic. |
| Language | UI language (popup header में भी)। |

## Supported languages

The UI, notifications, lock overlay, dhikr card, and welcome page are localized. Change language from the popup header dropdown or **Settings → Language**.

| Code | Language | Direction | Notes |
|------|----------|-----------|-------|
| `en` | English | LTR | Default fallback if a string is missing |
| `de` | Deutsch (German) | LTR | |
| `ar` | العربية (Arabic) | RTL | Default on first install; optional Arabic-Indic numerals (٠١٢٣) |
| `ur` | اردو (Urdu) | RTL | Optional Arabic-Indic numerals (٠١٢٣) |
| `hi` | हिन्दी (Hindi) | LTR | |
| `id` | Bahasa Indonesia | LTR | |
| `fr` | Français (French) | LTR | |
| `es` | Español (Spanish) | LTR | |

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | MV3 manifest |
| `background.js` | Service worker — fetches times, schedules alarms, localized notifications, tab lock |
| `i18n.js` | Shared translations (EN/DE/AR/UR/HI/ID/FR/ES), prayer names, country list, calculation methods, date formats, digit helper. |
| `popup.html` / `popup.css` / `popup.js` | The popup UI (schedule, countdown, language selector, settings). |
| `welcome.html` / `welcome.css` | First-install welcome page (localized). |

## How it works

- **Scheduling:** Install/startup और location change होने पर service worker आज के timings लाकर आगामी हर prayer से 5 मिनट पहले और prayer time पर notifications सेट करता है।
- **Tab lock:** Enabled होने पर prayer time पर active tab में overlay inject होता है।
- **Dhikr reminder:** Enabled होने पर periodic dhikr active tab पर दिखता है।

## Privacy

See [PRIVACY.md](PRIVACY.md) for what data is stored locally and which third-party APIs are contacted.

## License

MIT — see [LICENSE](LICENSE).

