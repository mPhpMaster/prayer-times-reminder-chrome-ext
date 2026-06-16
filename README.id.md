# Prayer Times Reminder — Chrome Extension (Bahasa Indonesia)

![Waktu Shalat — antarmuka Bahasa Indonesia](screenshots/id.png)

Ekstensi Chrome (Manifest V3) yang:

- 🔔 **Memberi notifikasi 5 menit sebelum setiap shalat** dan lagi saat waktunya tiba (Fajr, Dhuhr, Asr, Maghrib, Isha) — dalam bahasa yang Anda pilih.
- 🔒 **Kunci tab opsional** — saat waktu shalat tiba, memblokir tab browser aktif selama durasi yang dapat diatur (1–120 menit, default 5) dengan overlay hitung mundur; opsi buka kunci manual lewat tombol tutup.
- 🕌 **Menampilkan jadwal shalat harian lengkap** untuk kota/negara Anda, dengan hitung mundur langsung ke shalat berikutnya.
- 🌍 **Dropdown negara & kota** — pilih negara, lalu daftar kota dimuat otomatis.
- 🌐 **8 bahasa** — ganti dari header popup atau **Settings → Language** (lihat [Supported languages](#supported-languages)).
- 🌗 **Tema** — Midnight Emerald (default) atau Classic — dapat dipilih di Pengaturan.
- 📅 **Format tanggal Gregorian** — pilih cara tanggal footer ditampilkan.
- 🌙 **Tanggal Hijriah** ditampilkan bersama tanggal Gregorian.
- 📿 **Dzikir berkala** — pengingat mengambang opsional dengan 100 frasa unik di tab aktif; ketuk untuk menutup atau hilang otomatis setelah 10 detik.

[English](README.en.md) · [Deutsch](README.de.md) · [العربية](README.ar.md) · [اردو](README.ur.md) · [Français](README.fr.md) · [Español](README.es.md) · [हिन्दी](README.hi.md) · [Bahasa Indonesia](README.id.md)

Waktu shalat berasal dari [AlAdhan API](https://aladhan.com/prayer-times-api) gratis; daftar kota dari [CountriesNow API](https://countriesnow.space) gratis. Tidak perlu kunci API.

## Instalasi (load unpacked)

1. Buka `chrome://extensions` di Chrome.
2. Aktifkan **Developer mode** (kanan atas).
3. Klik **Load unpacked** dan pilih folder ini.
4. Klik ikon ekstensi di bilah alat untuk membuka popup.
5. Klik **⚙️ Settings**, pilih **Country** lalu **City** dari dropdown (atau klik **📍 Use my location**), pilih metode perhitungan, lalu **Save & Load**.
6. Pilih bahasa dari dropdown di header popup (atau di **Settings → Language**).

## Pengaturan

| Setting | Description |
|---------|-------------|
| Country / City | Lokasi untuk waktu shalat (atau gunakan geolokasi). |
| Calculation method | Metode AlAdhan (ISNA, Muslim World League, Umm al-Qura, Egyptian, Karachi, Diyanet, dll.). |
| Date format | Cara tanggal Gregorian muncul di footer. |
| Number style | Saat Arab atau Urdu aktif: angka Arabic-Indic (٠١٢٣) atau Barat (0123). |
| Lock tab during prayer | Menyuntikkan overlay layar penuh di tab aktif saat waktu shalat. |
| Lock duration | Berapa lama tab tetap terkunci (1–120 menit). |
| Allow manual unlock | Menampilkan tombol tutup (×) untuk menutup layar kunci lebih awal. |
| Periodic dhikr | Menampilkan dzikir acak di tab aktif pada interval tetap atau acak. |
| Dhikr position | Sudut atau tengah halaman (atas/bawah × kiri/kanan/tengah). |
| Theme | Pilih **Midnight Emerald** (default) atau **Classic**. |
| Language | Pilih bahasa UI (juga tersedia di header popup). |

## Bahasa yang didukung

UI, notifikasi, overlay kunci, kartu dzikir, dan halaman selamat datang dilokalkan. Ganti bahasa dari dropdown header popup atau **Settings → Language**.

| Code | Language | Direction | Notes |
|------|----------|-----------|-------|
| `en` | English | LTR | Fallback default jika string hilang |
| `de` | Deutsch (German) | LTR | |
| `ar` | العربية (Arabic) | RTL | Default saat instal pertama; angka Arabic-Indic opsional (٠١٢٣) |
| `ur` | اردو (Urdu) | RTL | Angka Arabic-Indic opsional (٠١٢٣) |
| `hi` | हिन्दी (Hindi) | LTR | |
| `id` | Bahasa Indonesia | LTR | |
| `fr` | Français (French) | LTR | |
| `es` | Español (Spanish) | LTR | |

Terjemahan ada di `i18n.js` (`I18N` + `SUPPORTED_LANGS`). Frasa dzikir di `tasbih-phrases.js` mencakup Arab dengan label per bahasa jika tersedia.

## Privasi

Lihat [PRIVACY.md](PRIVACY.md) untuk data yang disimpan secara lokal dan API pihak ketiga yang dihubungi.

## Lisensi

MIT — lihat [LICENSE](LICENSE).
