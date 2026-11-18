// Generic example: content lives in a user-provided jadwal/ folder (gitignored).
// Edit the map below to match your own files; no files from that folder are committed.
// ============================================================
// modules/education/jadwal.js — Jadwal Kuliah Command Handler
// Kirim file jadwal (gambar) berdasarkan kode jadwal
// ============================================================

const fs = require('fs');
const path = require('path');
const { isPrivileged } = require('../utility/db');

// Maksimal ukuran file yang dikirim (16 MB, sesuai batas dokumen WhatsApp).
const MAX_FILE_SIZE_BYTES = 16 * 1024 * 1024;

// Mapping kode jadwal ke file gambar
const JADWAL_MAP = {
    'semester3': { file: 'jadwal semester 3.jpeg', title: 'Jadwal Semester 3' },
    'semester':  { file: 'jadwal semester 3.jpeg', title: 'Jadwal Semester 3' },
    's3':        { file: 'jadwal semester 3.jpeg', title: 'Jadwal Semester 3' },
    'lab':       { file: 'jadwal lab.jpeg',         title: 'Jadwal Lab' },
    'praktikum': { file: 'jadwal praktikum.jpeg',   title: 'Jadwal Praktikum' },
    'prak':      { file: 'jadwal praktikum.jpeg',   title: 'Jadwal Praktikum' },
    'uts':       { file: 'jadwal uts.jpeg',          title: 'Jadwal UTS' },
};

// Base directory: cari folder jadwal dari working directory
// Coba beberapa kemungkinan lokasi
function findJadwalDir() {
    const candidates = [
        path.join(process.cwd(), 'jadwal'),                          // cwd/jadwal
        path.join(path.dirname(process.argv[1] || process.cwd()), 'jadwal'),           // lokasi index.js/jadwal
        path.resolve(__dirname, '../../jadwal'),                       // relative dari module
    ];
    for (const dir of candidates) {
        if (fs.existsSync(dir)) {
            return dir;
        }
    }
    // Fallback ke cwd
    return path.join(process.cwd(), 'jadwal');
}

const BASE_DIR = findJadwalDir();

function getAvailableList() {
    let text = '📅 *JADWAL KULIAH*\n\n';
    text += 'Ketik *.jadwal <kode>* untuk lihat jadwal\n\n';
    text += '  ▸ *.jadwal semester3* — Jadwal Semester 3\n';
    text += '  ▸ *.jadwal lab* — Jadwal Lab\n';
    text += '  ▸ *.jadwal praktikum* — Jadwal Praktikum\n';
    text += '  ▸ *.jadwal uts* — Jadwal UTS\n';
    return text;
}

async function handleJadwal(sock, sender, msg, participant, textMessage) {
    // Hanya Owner/Admin Bot yang boleh mengunduh file dari folder lokal.
    if (!isPrivileged(participant || sender)) {
        await sock.sendMessage(sender, { text: '⛔ Hanya *Owner/Admin Bot* yang bisa pakai perintah ini.' }, { quoted: msg });
        return;
    }

    const input = textMessage.trim().toLowerCase();

    // Tanpa argumen → tampilkan daftar jadwal
    if (!input) {
        await sock.sendMessage(sender, { text: getAvailableList() }, { quoted: msg });
        return;
    }

    // Cari jadwal
    const jadwal = JADWAL_MAP[input];
    if (!jadwal) {
        await sock.sendMessage(sender, {
            text: `❌ Jadwal *${input}* tidak ditemukan!\n\nKetik *.jadwal* untuk lihat daftar jadwal tersedia.`
        }, { quoted: msg });
        return;
    }

    const filePath = path.join(BASE_DIR, jadwal.file);

    // Cek file ada
    if (!fs.existsSync(filePath)) {
        console.error('[JADWAL] File tidak ditemukan:', filePath);
        await sock.sendMessage(sender, {
            text: `❌ File jadwal *${jadwal.title}* tidak ditemukan.\n\nPastikan file ada di folder jadwal/.`
        }, { quoted: msg });
        return;
    }

    // Cek ukuran file sebelum dibaca utuh ke memori
    let fileSize;
    try {
        fileSize = fs.statSync(filePath).size;
    } catch (err) {
        console.error('[JADWAL] Gagal membaca ukuran file:', filePath, err.message);
        await sock.sendMessage(sender, {
            text: `❌ File jadwal *${jadwal.title}* tidak ditemukan.\n\nPastikan file ada di folder jadwal/.`
        }, { quoted: msg });
        return;
    }
    if (fileSize > MAX_FILE_SIZE_BYTES) {
        await sock.sendMessage(sender, {
            text: `❌ File jadwal *${jadwal.title}* terlalu besar (${(fileSize / 1024 / 1024).toFixed(1)} MB). Maksimal 16 MB.`
        }, { quoted: msg });
        return;
    }

    // Kirim gambar
    try {
        const fileBuffer = fs.readFileSync(filePath);
        await sock.sendMessage(sender, {
            image: fileBuffer,
            caption: `📅 *${jadwal.title}*\n\nJadwal Kuliah Dhoells Bot`
        }, { quoted: msg });
    } catch (err) {
        console.error('[JADWAL ERROR]', err.message);
        await sock.sendMessage(sender, {
            text: `❌ Gagal mengirim jadwal *${jadwal.title}*. Coba lagi nanti.`
        }, { quoted: msg });
    }
}

module.exports = { handleJadwal };
