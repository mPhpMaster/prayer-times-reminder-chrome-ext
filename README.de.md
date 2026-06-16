# Prayer Times Reminder — Chrome Extension (Deutsch)

![Gebetszeiten — deutsche Oberfläche](screenshots/de.png)

Eine Chrome-Erweiterung (Manifest V3), die:

- 🔔 **5 Minuten vor jedem Gebet benachrichtigt** und erneut, wenn die Zeit erreicht ist (Fajr, Dhuhr, Asr, Maghrib, Isha) — in der von Ihnen gewählten Sprache.
- 🔒 **Optionale Tab-Sperre** — wenn die Gebetszeit erreicht ist, blockiert den aktiven Browser-Tab für eine einstellbare Dauer (1–120 Minuten, Standard 5) mit einem Countdown-Overlay; optional manuelles Entsperren über die Schließen-Schaltfläche.
- 🕌 **Den vollständigen täglichen Gebetsplan** für Ihre Stadt/Ihr Land anzeigt, mit einem Live-Countdown zum nächsten Gebet.
- 🌍 **Länder- und Stadt-Dropdowns** — wählen Sie ein Land, die Städteliste wird automatisch geladen.
- 🌐 **8 Sprachen** — wechseln Sie über den Popup-Header oder **Settings → Language** (siehe [Unterstützte Sprachen](#unterstützte-sprachen)).
- 🌗 **Design** — Midnight Emerald (Standard) oder Classic — in den Einstellungen wählbar.
- 📅 **Gregorianisches Datumsformat** — wählen Sie, wie das Datum in der Fußzeile angezeigt wird.
- 🌙 **Hidschri-Datum** wird neben dem gregorianischen Datum angezeigt.
- 📿 **Periodischer Dhikr** — optionaler schwebender Hinweis mit 100 einzigartigen Formulierungen auf dem aktiven Tab; antippen zum Schließen oder automatisches Ausblenden nach 10 Sekunden.

[English](README.en.md) · [Deutsch](README.de.md) · [العربية](README.ar.md) · [اردو](README.ur.md) · [Français](README.fr.md) · [Español](README.es.md) · [हिन्दी](README.hi.md) · [Bahasa Indonesia](README.id.md)

Gebetszeiten stammen von der kostenlosen [AlAdhan API](https://aladhan.com/prayer-times-api); die Städteliste von der kostenlosen [CountriesNow API](https://countriesnow.space). Keine API-Schlüssel erforderlich.

## Installation (load unpacked)

1. Öffnen Sie `chrome://extensions` in Chrome.
2. Aktivieren Sie **Developer mode** (oben rechts).
3. Klicken Sie auf **Load unpacked** und wählen Sie diesen Ordner.
4. Klicken Sie auf das Erweiterungssymbol in der Symbolleiste, um das Popup zu öffnen.
5. Klicken Sie auf **⚙️ Settings**, wählen Sie **Country** und dann **City** aus den Dropdowns (oder klicken Sie **📍 Use my location**), wählen Sie eine Berechnungsmethode, dann **Save & Load**.
6. Wählen Sie Ihre Sprache im Dropdown im Popup-Header (oder unter **Settings → Language**).

## Einstellungen

| Setting | Description |
|---------|-------------|
| Country / City | Standort für Gebetszeiten (oder Geolokalisierung nutzen). |
| Calculation method | AlAdhan-Methode (ISNA, Muslim World League, Umm al-Qura, Egyptian, Karachi, Diyanet, usw.). |
| Date format | Wie das gregorianische Datum in der Fußzeile erscheint. |
| Number style | Wenn Arabisch oder Urdu aktiv: Arabic-Indic (٠١٢٣) oder westliche (0123) Ziffern. |
| Lock tab during prayer | Legt bei Gebetszeit ein Vollbild-Overlay auf den aktiven Tab. |
| Lock duration | Wie lange der Tab gesperrt bleibt (1–120 Minuten). |
| Allow manual unlock | Zeigt eine Schließen-Schaltfläche (×) zum frühen Beenden der Sperre. |
| Periodic dhikr | Zeigt einen zufälligen Dhikr auf dem aktiven Tab in festem oder zufälligem Intervall. |
| Dhikr position | Ecke oder Mitte der Seite (oben/unten × links/rechts/Mitte). |
| Theme | **Midnight Emerald** (Standard) oder **Classic** wählen. |
| Language | UI-Sprache wählen (auch im Popup-Header verfügbar). |

## Unterstützte Sprachen

UI, Benachrichtigungen, Sperr-Overlay, Dhikr-Karte und Willkommensseite sind lokalisiert. Sprache wechseln über das Dropdown im Popup-Header oder **Settings → Language**.

| Code | Language | Direction | Notes |
|------|----------|-----------|-------|
| `en` | English | LTR | Standard-Fallback bei fehlenden Texten |
| `de` | Deutsch (German) | LTR | |
| `ar` | العربية (Arabic) | RTL | Standard bei Erstinstallation; optionale Arabic-Indic-Ziffern (٠١٢٣) |
| `ur` | اردو (Urdu) | RTL | Optionale Arabic-Indic-Ziffern (٠١٢٣) |
| `hi` | हिन्दी (Hindi) | LTR | |
| `id` | Bahasa Indonesia | LTR | |
| `fr` | Français (French) | LTR | |
| `es` | Español (Spanish) | LTR | |

Übersetzungen befinden sich in `i18n.js` (`I18N` + `SUPPORTED_LANGS`). Dhikr-Formulierungen in `tasbih-phrases.js` enthalten Arabisch mit sprachspezifischen Bezeichnungen, wo verfügbar.

## Datenschutz

Siehe [PRIVACY.md](PRIVACY.md) für lokal gespeicherte Daten und kontaktierte Drittanbieter-APIs.

## Lizenz

MIT — siehe [LICENSE](LICENSE).
