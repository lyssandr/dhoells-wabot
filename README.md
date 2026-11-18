# BOTWATSAP — dhoells-wabot

Bot WhatsApp berbasis [Baileys](https://github.com/WhiskeySockets/Baileys) (`@whiskeysockets/baileys`) dengan AI chat, voice note AI, RPG, mini-game, stiker, dan downloader media.

![Node.js](https://img.shields.io/badge/Node.js-22%2B-339933?style=flat-square&logo=nodedotjs)
![Baileys](https://img.shields.io/badge/Baileys-6.7-25D366?style=flat-square&logo=whatsapp)
![Database](https://img.shields.io/badge/Database-SQLite_WAL-003B57?style=flat-square&logo=sqlite)
![AI](https://img.shields.io/badge/AI-Agnes_%2B_GLM-orange?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

---

## Apa itu bot ini?

BOTWATSAP adalah bot WhatsApp modular: satu nomor bot bisa dipakai untuk ngobrol dengan AI, main RPG, main game, bikin stiker, dan download video.

Prefix perintah: `.` (titik). Contoh: ketik `.menu` untuk melihat menu.

Di grup, panggil bot wajib pakai prefix `.` — contohnya `.claryn halo`.

---

## Fitur utama

| Fitur | Keterangan |
|---|---|
| **AI chat** | Ngobrol dengan AI, bisa kirim gambar untuk dianalisis. Grup memakai Agnes, chat pribadi memakai GLM, dan kalau yang satu gagal otomatis pindah ke yang lain. |
| **Voice note AI** | Jawaban AI bisa dikirim sebagai voice note (`.vn`). |
| **Buka sekali-lihat** | Buka ulang foto/video sekali-lihat, dikirim ke DM owner (`.peek`, owner only). |
| **Downloader** | Download video/foto dari link (`.dl`) — Instagram dan TikTok jalan; YouTube masih kena bot-check Google. |
| **Stiker & olah media** | Stiker biasa (`.stiker`), stiker bergerak (`.stikergerak`), ubah video jadi GIF (`.togif`), dan perbaikan kualitas video (`.jernih`, `.smooth`). |
| **Gambar AI** | Generate gambar (`.gambar`) dan edit foto dengan AI (`.edit`). |
| **Menu tombol** | Menu utama dan sub-menu (RPG, game, media, AI, utility, admin, owner) dengan tombol interaktif. |
| **RPG** | Daftar class (warrior, archer, mage, assassin, dan lainnya), hunt, dungeon 1–100, raid, arena PvP ranked, guild, party, market, bounty, kasino, pet, dan survival (stamina, HP, karma). |
| **Mini-game** | Gacha anime, suit, uno, dadu, rolet, slot, dan game lainnya. |
| **Temp mail** | Email sementara untuk daftar layanan (`.tempmail`). |
| **Keamanan** | Rate limiter anti-spam, dan penanganan error supaya bot tidak crash saat API timeout. |

### Perintah yang paling sering dipakai

| Perintah | Fungsi |
|---|---|
| `.menu` | Menu utama |
| `.menurpg` / `.menugame` / `.menumedia` / `.menuclaryn` / `.menuutil` | Menu per kategori |
| `.claryn <pertanyaan>` | Ngobrol dengan AI (bisa juga kirim gambar) |
| `.vn <pertanyaan>` | Jawaban AI sebagai voice note |
| `.peek` | Buka ulang foto/video sekali-lihat (balas pesannya, owner only) |
| `.dl <link>` | Download video/foto dari link |
| `.gambar <deskripsi>` | Generate gambar |
| `.edit <instruksi>` | Edit foto dengan AI (balas fotonya) |
| `.stiker` | Ubah foto/video jadi stiker |
| `.role <class>` | Daftar RPG dan pilih class |
| `.hunt` | Berburu monster, dapat EXP + koin |
| `.dungeon` / `.dg` | Masuk dungeon |
| `.shop` / `.inv` | Toko dan inventory RPG |
| `.gacha` | Gacha karakter anime |
| `.tempmail` | Buat email sementara |
| `.ping` | Cek latency dan penggunaan memori bot |
| `.help <topik>` | Bantuan per topik, contoh `.help rpg` |

Daftar lengkap ada di dalam bot: ketik `.menu`, lalu pilih kategorinya.

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
```

### 3. Isi konfigurasi

```bash
cp .env.example .env
```

Lalu isi `.env` dengan kredensialmu sendiri — nomor WhatsApp owner dan API key AI. **Jangan pernah membagikan isi `.env` ke orang lain.** Lihat `.env.example` untuk daftar lengkap variabelnya.

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
├── config.js           # Pengaturan bot (owner, AI, ekonomi, menu)
├── src/
│   ├── commands/       # Semua perintah (.claryn, .vn, .dl, RPG, game, media, ...)
│   ├── handlers/       # Penanganan pesan masuk
│   ├── services/       # AI, notifikasi, TTS, downloader
│   ├── database/       # Penyimpanan lokal (SQLite, JSON)
│   └── utils/          # Helper (owner gate, JID, tombol, ...)
├── assets/             # Foto bot & aset media
└── .env.example        # Contoh file .env — isi dengan datamu sendiri
```

Data pemain, guild, market, dan bounty tersimpan lokal di database SQLite.

---

## Keamanan — baca dulu sebelum deploy

- **Jangan pernah commit file `.env`.** File itu sudah ada di `.gitignore`, begitu juga folder `session/` (sesi login WhatsApp) dan file database (`*.db`).
- **Jangan taruh nomor, token, atau API key langsung di kode atau di README.** Semua kredensial wajib lewat environment variable (`.env`).
- **Jangan bagikan folder `session/` atau file sesi.** Siapa pun yang memegangnya bisa mengendalikan nomor WhatsApp bot.
- Repo ini tidak berisi kredensial asli apa pun — yang ada hanya placeholder dan contoh nomor di `.env.example`.

---

## Lisensi

MIT — lihat file `LICENSE`.
