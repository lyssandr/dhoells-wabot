# BOTWATSAP — dhoells-wabot

Bot WhatsApp berbasis [Baileys](https://github.com/WhiskeySockets/Baileys) (`@whiskeysockets/baileys`) dengan AI chat, voice note AI, RPG, mini-game, stiker, dan downloader media.

> **Status repo:** snapshot kode **21 Oktober 2026, v3.2.0**.
> Bot live BOTWATSAP yang jalan di VPS sudah lebih baru dari snapshot ini — lihat bagian [Bot live vs repo ini](#bot-live-vs-repo-ini) supaya tidak salah paham.

![Node.js](https://img.shields.io/badge/Node.js-22%2B-339933?style=flat-square&logo=nodedotjs)
![Baileys](https://img.shields.io/badge/Baileys-6.7-25D366?style=flat-square&logo=whatsapp)
![Database](https://img.shields.io/badge/Database-SQLite_WAL-003B57?style=flat-square&logo=sqlite)
![AI](https://img.shields.io/badge/AI-Gemini_Vision-orange?style=flat-square&logo=google)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

---

## Apa itu bot ini?

BOTWATSAP adalah bot WhatsApp modular: satu nomor bot bisa dipakai untuk ngobrol dengan AI, main RPG, main game, bikin stiker, download video, sampai cek jadwal kuliah.

Prefix perintah: `.` (titik). Contoh: ketik `.menu` untuk melihat menu.

---

## Fitur utama (yang ada di kode repo ini)

| Fitur | Keterangan |
|---|---|
| **AI chat + vision** | Tanya AI lewat chat, bisa kirim gambar untuk dianalisis (Gemini, dengan fallback Pollinations kalau Gemini gagal). |
| **TTS / voice note AI** | Jawaban AI bisa dikirim sebagai voice note. |
| **Menu tombol** | Menu utama dan sub-menu (RPG, game, media, AI, utility, admin, owner) dengan tombol interaktif. |
| **RPG** | Daftar class (warrior, archer, mage, assassin, dan lainnya), hunt, dungeon 1–100, raid, arena PvP ranked, guild, party, market, bounty, kasino, pet, dan survival (stamina, HP, karma). |
| **Mini-game** | Gacha anime, suit (RPS), dan game lainnya. |
| **Media** | Stiker, download media, dan olah gambar/audio (Sharp + FFmpeg). |
| **Jadwal kuliah** | Jadwal dan pengingat kuliah (lihat juga bagian live di bawah). |
| **Keamanan** | Rate limiter sliding window anti-spam, dan penanganan error supaya bot tidak crash saat API timeout. |

### Perintah yang paling sering dipakai

| Perintah | Fungsi |
|---|---|
| `.menu` | Menu utama |
| `.menurpg` / `.menugame` / `.menumedia` / `.menuclaryn` / `.menuutil` | Menu per kategori |
| `.claryn <pertanyaan>` | Ngobrol dengan AI (bisa juga kirim gambar) |
| `.role <class>` | Daftar RPG dan pilih class |
| `.hunt` | Berburu monster, dapat EXP + koin |
| `.dungeon` / `.dg` | Masuk dungeon |
| `.shop` / `.inv` | Toko dan inventory RPG |
| `.gacha` | Gacha karakter anime |
| `.jadwal` | Jadwal kuliah |
| `.ping` | Cek latency dan penggunaan memori bot |
| `.help <topik>` | Bantuan per topik, contoh `.help rpg` |

Daftar lengkap ada di dalam bot: ketik `.menu`, lalu pilih kategorinya.

---

## Bot live vs repo ini

Bot live BOTWATSAP di VPS sudah dikembangkan lebih jauh dari snapshot repo ini. Fitur live berikut **belum tentu ada di kode repo ini**:

- **AI live:** grup memakai Agnes langsung, chat pribadi memakai GLM (fallback silang tetap jalan).
- **`.vn <pertanyaan>`** — jawaban AI sebagai voice note.
- **`.peek`** (owner only) — buka ulang foto/video sekali-lihat, dikirim ke DM owner.
- **`.dl <link>`** — download video/foto (Instagram dan TikTok jalan; YouTube masih kena bot-check Google).
- **`.stiker`, `.stikergerak`, `.jernih`, `.smooth`** — stiker biasa, stiker bergerak, dan perbaikan kualitas video.
- **`.gambar`** — generate gambar, **`.edit`** — edit foto dengan AI.
- **Notifikasi kuliah otomatis** — pengingat jadwal sebelum kelas mulai; di grup, panggil bot wajib pakai prefix `.`.

Kalau kamu clone repo ini, yang kamu dapat adalah snapshot 21 Oktober 2026 — bukan salinan 1:1 bot live. Sinkronisasi kode live ke repo ini masih perlu dilakukan terpisah.

---

## Cara menjalankan

### 1. Syarat

- **Node.js v22 atau lebih baru** (dibutuhkan untuk `node:sqlite` bawaan)
- **FFmpeg** (untuk konversi audio/Opus)
- **Git**

### 2. Instalasi

```bash
git clone https://github.com/rsvmusabb/dhoells-wabot.git
cd dhoells-wabot

npm install

# Buat folder database yang dibutuhkan
bash setup-folders.sh
```

### 3. Isi konfigurasi

```bash
cp .env.example .env
```

Lalu isi `.env` dengan kredensialmu sendiri. **Jangan pernah membagikan isi `.env` ke orang lain.**

| Variabel | Wajib? | Keterangan |
|---|---|---|
| `OWNER_NUMBER` | Ya | Nomor WhatsApp owner, contoh `6281234567890` (tanpa `+`, tanpa spasi) |
| `OWNER_LID` | Opsional | LID WhatsApp owner |
| `GEMINI_API_KEYS` | Ya | Satu atau lebih API key Gemini, dipisah koma. Daftar di [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `ELEVENLABS_API_KEY` | Opsional | Untuk suara AI premium. Daftar di [ElevenLabs](https://elevenlabs.io) |
| `ELEVENLABS_VOICE_ID` | Opsional | Voice ID ElevenLabs |
| `FISH_API_KEY` | Opsional | Untuk voice cloning. Daftar di [Fish Audio](https://fish.audio) |
| `FISH_MODEL_ID` | Opsional | Model ID Fish Audio |

### 4. Jalankan

```bash
node index.js
```

Scan QR code yang muncul di terminal lewat WhatsApp di HP kamu: **Setelan > Perangkat Tertaut > Tautkan Perangkat**.

---

## Struktur folder

```text
dhoells-wabot/
├── index.js            # Entry point & koneksi Baileys
├── config.js           # Re-export semua config (isinya ada di config/)
├── config/             # Pengaturan bot, RPG, dungeon, game
│   ├── bot.js          # Nomor owner, API key (via env), ekonomi, menu
│   ├── rpg.js          # Tuning RPG
│   ├── dungeon.js      # Tuning dungeon
│   └── game.js         # Tuning game
├── modules/            # Logika bot, dipisah per domain
│   ├── admin/          # Perintah owner/admin
│   ├── ai/             # Engine AI (Gemini + fallback), TTS
│   ├── games/          # Gacha, suit, mini-game
│   ├── media/          # Scraper, audio, stiker
│   ├── rpg/            # Battle, dungeon, shop, guild, kasino
│   └── utility/        # Menu, help, database, mata uang
├── database/           # Penyimpanan lokal (SQLite, WAL mode)
├── .env.example        # Contoh file .env — isi dengan datamu sendiri
└── setup-folders.sh    # Membuat folder yang dibutuhkan saat instalasi
```

Data pemain, guild, market, dan bounty tersimpan lokal di database SQLite (mode WAL).

---

## Keamanan — baca dulu sebelum deploy

- **Jangan pernah commit file `.env`.** File itu sudah ada di `.gitignore`, begitu juga `auth_info_baileys/` (sesi login WhatsApp) dan file database (`*.db`).
- **Jangan taruh nomor, token, atau API key langsung di kode atau di README.** Semua kredensial wajib lewat environment variable (`.env`).
- **Jangan bagikan folder `auth_info_baileys/` atau file sesi.** Siapa pun yang memegangnya bisa mengendalikan nomor WhatsApp bot.
- Repo ini tidak berisi kredensial asli apa pun — yang ada hanya placeholder seperti `YOUR_GEMINI_API_KEY` dan contoh nomor di `.env.example`.

---

## Lisensi

MIT — lihat file `LICENSE`.
